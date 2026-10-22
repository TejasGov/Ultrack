"""Reproducible local donor extraction. Preserves the original Meshy file.

This is a fitted prototype, not automatic retopology: remove measured wheel,
mirror and glazing face regions, retain the body/aero, and omit baked textures.
"""
import hashlib
import json
from pathlib import Path
import struct
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
PROFILE = ROOT / 'meshy_output/mclaren-assembly/profile.json'


def digest(data):
    return hashlib.sha256(data).hexdigest().upper()


def near_triangle(points, a, b, c, depth):
    u, v = b - a, c - a
    normal = np.cross(u, v)
    normal /= np.linalg.norm(normal)
    delta = points - a
    distance = delta @ normal
    projected = delta - distance[:, None] * normal
    uu, uv, vv = u @ u, u @ v, v @ v
    pu, pv = projected @ u, projected @ v
    den = uu * vv - uv * uv
    s, t = (vv * pu - uv * pv) / den, (uu * pv - uv * pu) / den
    return (s >= 0) & (t >= 0) & (s + t <= 1) & (np.abs(distance) < depth)


def main():
    profile = json.loads(PROFILE.read_text(encoding='utf-8'))
    source = (ROOT / profile['body']['sourceFile']).resolve()
    output = (ROOT / profile['body']['file']).resolve()
    if not source.is_relative_to(ROOT) or not output.is_relative_to(ROOT) or source == output:
        raise ValueError('Source/output must be distinct workspace paths.')
    raw = source.read_bytes()
    identity = digest(raw)
    expected = profile['body']['sourceSha256']
    if expected != identity:
        raise ValueError('Donor hash mismatch; inspect and pin sourceSha256 before extraction.')
    magic, version, length = struct.unpack_from('<4sII', raw)
    if magic != b'glTF' or version != 2 or length != len(raw):
        raise ValueError('Invalid source GLB.')
    jlen = struct.unpack_from('<I', raw, 12)[0]
    doc = json.loads(raw[20:20+jlen])
    if len(doc['nodes']) != 1 or any(k in doc['nodes'][0] for k in ['matrix','translation','rotation','scale']):
        raise ValueError('Extraction expects the measured single untransformed mesh.')
    binary = raw[28+jlen:]

    def accessor(index):
        a = doc['accessors'][index]
        view = doc['bufferViews'][a['bufferView']]
        components = {'VEC3': 3, 'SCALAR': 1}[a['type']]
        if 'byteStride' in view or 'sparse' in a:
            raise ValueError('Packed non-sparse accessors required.')
        return np.frombuffer(binary, dtype={5126:'<f4',5125:'<u4',5123:'<u2'}[a['componentType']],
                             count=a['count']*components,
                             offset=view.get('byteOffset',0)+a.get('byteOffset',0)).reshape(-1,components)

    primitive = doc['meshes'][0]['primitives'][0]
    vertices = accessor(primitive['attributes']['POSITION']).astype(np.float64)
    normals = accessor(primitive['attributes']['NORMAL']).copy()
    faces = accessor(primitive['indices']).reshape(-1,3)
    vertices[:,0] -= (vertices[:,0].min()+vertices[:,0].max())/2
    vertices[:,2] -= (vertices[:,2].min()+vertices[:,2].max())/2
    vertices[:,1] -= vertices[:,1].min()
    vertices *= profile['body']['displayLength']/np.ptp(vertices[:,0])
    centers = vertices[faces].mean(axis=1)
    x,y,z = centers.T
    fit = profile['body']['extraction']
    masks = {}
    masks['donorWheels'] = np.zeros(len(faces),dtype=bool)
    for axle in ['front','rear']:
        spec = profile['wheels'][axle]
        radial = np.hypot(x-spec['x'],y-fit['wheelCutHeight'][axle])
        masks['donorWheels'] |= (radial < fit['wheelCutRadius'][axle]) & (np.abs(z)>fit['wheelCutInnerZ'])
    masks['donorMirrors'] = np.zeros(len(faces),dtype=bool)
    for x0,y0,z0,x1,y1,z1 in fit['mirrorBoxes']:
        masks['donorMirrors'] |= (x>x0)&(x<x1)&(y>y0)&(y<y1)&(np.abs(z)>z0)&(np.abs(z)<z1)
    masks['donorGlazing'] = np.zeros(len(faces),dtype=bool)
    for name, corners in profile['glass'].items():
        for sign in ([-1,1] if name in ['side','quarter'] else [1]):
            p = np.array(corners,dtype=float);p[:,2] *= sign
            masks['donorGlazing'] |= near_triangle(centers,p[0],p[1],p[2],fit['glassCutDepth'])
            if len(p)==4:
                masks['donorGlazing'] |= near_triangle(centers,p[0],p[2],p[3],fit['glassCutDepth'])
    removed = np.logical_or.reduce(list(masks.values()))
    kept_faces = faces[~removed]
    used, inverse = np.unique(kept_faces,return_inverse=True)
    positions = vertices[used].astype('<f4')
    normal_data = normals[used].astype('<f4')
    indices = inverse.astype('<u4').reshape(-1,3)
    blobs = [positions.tobytes(),normal_data.tobytes(),indices.tobytes()]
    views = [];offset = 0
    for index,blob in enumerate(blobs):
        views.append({'buffer':0,'byteOffset':offset,'byteLength':len(blob),'target':34963 if index==2 else 34962})
        offset += len(blob)
    result = {
        'asset':{'version':'2.0','generator':'RaceUltimate local donor extraction v1'},
        'scene':0,'scenes':[{'nodes':[0]}],'nodes':[{'name':'mclaren-derived-shell','mesh':0}],
        'meshes':[{'primitives':[{'attributes':{'POSITION':0,'NORMAL':1},'indices':2,'material':0}]}],
        'materials':[{'name':'neutral-shell','pbrMetallicRoughness':{'baseColorFactor':[.5,.5,.5,1],'metallicFactor':0,'roughnessFactor':.5}}],
        'buffers':[{'byteLength':offset}],'bufferViews':views,
        'accessors':[
            {'bufferView':0,'componentType':5126,'count':len(positions),'type':'VEC3','min':positions.min(0).tolist(),'max':positions.max(0).tolist()},
            {'bufferView':1,'componentType':5126,'count':len(normal_data),'type':'VEC3'},
            {'bufferView':2,'componentType':5125,'count':indices.size,'type':'SCALAR'}
        ]
    }
    json_chunk=json.dumps(result,separators=(',',':')).encode();json_chunk+=b' '*((-len(json_chunk))%4)
    bin_chunk=b''.join(blobs)
    final=struct.pack('<4sII',b'glTF',2,28+len(json_chunk)+len(bin_chunk))+struct.pack('<II',len(json_chunk),0x4e4f534a)+json_chunk+struct.pack('<II',len(bin_chunk),0x004e4942)+bin_chunk
    output.parent.mkdir(parents=True,exist_ok=True)
    output.write_bytes(final)
    receipt={'method':'local measured face-region extraction v1','source':str(source.relative_to(ROOT)),'sourceSha256':identity,'sourceTriangles':len(faces),'output':str(output.relative_to(ROOT)),'outputSha256':digest(final),'outputTriangles':len(indices),'removedTriangles':int(removed.sum()),'removalRegionCountsMayOverlap':{k:int(v.sum()) for k,v in masks.items()},'profile':str(PROFILE.relative_to(ROOT)),'providerCalls':0,'newProviderCredits':0,'gameReady':False,'limits':['Surface ripples preserved','Cut boundaries are prototype fits','No retopology, mesh healing or final optical fit']}
    (output.parent/'receipt.json').write_text(json.dumps(receipt,indent=2),encoding='utf-8')
    profile['body']['sha256']=digest(final);profile['body']['triangles']=len(indices)
    PROFILE.write_text(json.dumps(profile,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
    print(json.dumps(receipt,indent=2))


if __name__ == '__main__':
    main()
