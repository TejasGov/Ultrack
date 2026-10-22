"""Inspect local car references and GLB structure without changing source assets."""
import argparse
import hashlib
import json
import struct
from pathlib import Path


def inspect_glb(path):
    with path.open('rb') as stream:
        header = stream.read(12)
        magic, version, length = struct.unpack('<4sII', header)
        if magic != b'glTF' or version != 2 or length != path.stat().st_size:
            raise ValueError(f'Invalid GLB 2 header: {path}')
        doc = None
        while stream.tell() < length:
            size, kind = struct.unpack('<II', stream.read(8))
            if kind == 0x4E4F534A:
                doc = json.loads(stream.read(size))
                break
            stream.seek(size, 1)
    if doc is None:
        raise ValueError('Missing glTF JSON chunk')
    accessors = doc.get('accessors', [])
    mesh_counts = []
    for mesh in doc.get('meshes', []):
        triangles = 0
        for primitive in mesh.get('primitives', []):
            position = primitive.get('attributes', {}).get('POSITION')
            index = primitive.get('indices', position)
            count = accessors[index]['count'] if index is not None else 0
            mode = primitive.get('mode', 4)
            triangles += count // 3 if mode == 4 else max(0, count - 2) if mode in (5, 6) else 0
        mesh_counts.append(triangles)
    return {
        'path': str(path), 'bytes': path.stat().st_size,
        'unique_mesh_triangles': sum(mesh_counts),
        'mesh_node_triangles': sum(mesh_counts[n['mesh']] for n in doc.get('nodes', []) if 'mesh' in n),
        'triangle_count_note': 'Accessor counts; mesh_node_triangles includes all mesh-bearing nodes, not only the active scene. GPU instancing extensions are not expanded.',
        'meshes': len(mesh_counts),
        'primitives': sum(len(m.get('primitives', [])) for m in doc.get('meshes', [])),
        'nodes': [{'name': n.get('name', ''), 'mesh': n.get('mesh')} for n in doc.get('nodes', [])],
        'materials': [{
            'name': m.get('name', ''),
            'metallic': m.get('pbrMetallicRoughness', {}).get('metallicFactor', 1),
            'roughness': m.get('pbrMetallicRoughness', {}).get('roughnessFactor', 1),
            'base_color_texture': 'baseColorTexture' in m.get('pbrMetallicRoughness', {}),
            'metallic_roughness_texture': 'metallicRoughnessTexture' in m.get('pbrMetallicRoughness', {}),
            'normal_texture': 'normalTexture' in m,
            'extensions': list(m.get('extensions', {}))
        } for m in doc.get('materials', [])],
        'textures': len(doc.get('textures', [])),
        'images': len(doc.get('images', [])),
        'extensions': doc.get('extensionsUsed', []),
        'visual_inspection': 'Not established by structural inspection.'
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--glb')
    args = parser.parse_args()
    if args.glb:
        print(json.dumps(inspect_glb(Path(args.glb).resolve()), indent=2))
        return
    from PIL import Image, ImageDraw, ImageOps
    root = Path(__file__).resolve().parents[1]
    output = root / 'meshy_output' / '_inspection'
    output.mkdir(parents=True, exist_ok=True)
    files = sorted(root.glob('concept-*'))
    inventory = []
    sheet = Image.new('RGB', (1440, ((len(files) + 2) // 3) * 310), '#171a21')
    draw = ImageDraw.Draw(sheet)
    for i, path in enumerate(files):
        with Image.open(path) as im:
            im = ImageOps.exif_transpose(im)
            inventory.append({'file': path.name, 'width': im.width, 'height': im.height,
                              'bytes': path.stat().st_size,
                              'sha256': hashlib.sha256(path.read_bytes()).hexdigest()})
            tile = ImageOps.contain(im.convert('RGB'), (464, 270))
            x, y = (i % 3) * 480, (i // 3) * 310
            sheet.paste(tile, (x + (480 - tile.width) // 2, y + (274 - tile.height) // 2))
            draw.text((x + 10, y + 280), path.name, fill='white')
    sheet.save(output / 'concept-contact-sheet.jpg', quality=90)
    (output / 'concept-inventory.json').write_text(json.dumps(inventory, indent=2), encoding='utf-8')
    report = inspect_glb(root / 'La_furari.glb')
    (output / 'furari-inspection.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps({'references': len(inventory), 'contact_sheet': str(output / 'concept-contact-sheet.jpg'),
                      'furari_bytes': report['bytes'], 'furari_mesh_node_triangles': report['mesh_node_triangles'],
                      'furari_meshes': report['meshes'], 'furari_materials': len(report['materials']),
                      'furari_node_names': [n['name'] for n in report['nodes']][:35]}, indent=2))


if __name__ == '__main__':
    main()
