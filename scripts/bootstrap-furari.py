"""Bootstrap Furari assembly from its completed, preserved Meshy shell."""
from pathlib import Path
import json,struct,hashlib
import numpy as np
root=Path(__file__).resolve().parents[1];d=root/'meshy_output/body-batch-5/furari-488'
raw=(d/'model.glb').read_bytes();n=struct.unpack_from('<I',raw,12)[0];doc=json.loads(raw[20:20+n]);binary=raw[28+n:];q=doc['meshes'][0]['primitives'][0];a=doc['accessors'][q['attributes']['POSITION']];view=doc['bufferViews'][a['bufferView']]
v=np.frombuffer(binary,dtype='<f4',count=a['count']*3,offset=view.get('byteOffset',0)+a.get('byteOffset',0)).reshape(-1,3)
p=json.loads((root/'car-lab/src/vehicle/profiles/mp1x.json').read_text())
p.update(id='furari-488-body-only-v1',name='Furari 488-R',concept='Furari 488 concept',description='Body-only shell with independent paint, fitted enclosed lamps and shared hardware.',defaults=dict(color='#b80e21',finish='gloss',rimColor='black'))
sha=hashlib.sha256(raw).hexdigest().upper();state=json.loads((d/'state.json').read_text())
p['body']=dict(file='meshy_output/body-batch-5/furari-488/model.glb',url='/models/furari-488-body-shell.glb?v='+sha[:12].lower(),sha256=sha,taskId=state['taskId'],displayLength=4.6,lift=.08,forward='-X',triangles=doc['accessors'][q['indices']]['count']//3,normalizationBounds=[v.min(0).tolist(),v.max(0).tolist()])
p['wheels']=dict(front=dict(x=-1.32,radius=.35,width=.26,track=1.83),rear=dict(x=1.42,radius=.36,width=.29,track=1.85))
p['glass']=dict(windshield=[[-.83,.70,.65],[-.22,1.03,.5],[-.22,1.03,-.5],[-.83,.70,-.65]],side=[[-.66,.70,.74],[-.18,1.01,.54],[.64,1.0,.55],[.69,.73,.76]],quarter=[[.72,.98,.56],[.75,.74,.75],[1.04,.80,.67]],rear=[[.75,1.01,.45],[.75,1.01,-.45],[1.39,.76,-.6],[1.39,.76,.6]])
p['glassMaterial']=dict(roughness=.11,opacity=.96)
p['windshieldWrap']=[.09,.05]
p['mirrors']=dict(style='aero-blade',mount=[-.64,.74,.72],stalkEnd=[-.62,.8,.92],center=[-.60,.85,1.0])
p['lights']={k:v for k,v in p['lights'].items() if k not in ['frontFits','rearFits','frontRecess','rearRecess']}
p['lights']['headlamp']=dict(type='enclosed',design='Furari swept full lamp housings with separate projector optics and outer running signature')
p['fitStatus']='Assembly anchors pending measurement against the fresh shell.'
(root/'car-lab/src/vehicle/profiles/furari-488.json').write_text(json.dumps(p,indent=2)+'\n')
print(json.dumps(dict(triangles=p['body']['triangles'],bounds=p['body']['normalizationBounds'],hash=sha)))
