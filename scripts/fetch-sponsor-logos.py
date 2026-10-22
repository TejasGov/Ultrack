from pathlib import Path
import json,urllib.request,hashlib
root=Path('assets/sponsors');(root/'sources').mkdir(parents=True,exist_ok=True)
si='https://raw.githubusercontent.com/simple-icons/simple-icons/develop/icons/'
car='https://raw.githubusercontent.com/filippofilip95/car-logos-dataset/master/logos/optimized/'
items=[
('redbull','Red Bull',['VOLTRAVA'],si+'redbull.svg','#061e42','#ffffff'),
('pirelli','Pirelli',['KESTROVA'],'https://www.pirelli.com/global/en-ww/assets/images/pirelli-logo.png','#fff200',None),
('emirates','Emirates',['AZURINE'],si+'emirates.svg','#d71920','#ffffff'),
('hsbc','HSBC',['MERIDAX'],si+'hsbc.svg','#ffffff','#db0011'),
('cocacola','Coca-Cola',['DUNEFIZZ'],si+'cocacola.svg','#d00013','#ffffff'),
('rolex','Rolex',['HALCYRA'],'https://upload.wikimedia.org/wikipedia/commons/1/1c/Rolex_wordmark_logo.svg','#ffffff',None),
('shell','Shell',['ORVANE'],si+'shell.svg','#fbd600','#dd1d21'),
]
names=[('ferrari','FERRARI','#d40000'),('mclaren','McLAREN','#ff8000'),('lamborghini','LAMBORGHINI','#111111'),('porsche','PORSCHE','#f2f2f2'),('aston-martin','ASTON MARTIN','#00482b'),('bugatti','BUGATTI','#0b2d6b'),('mercedes-amg','MERCEDES-AMG','#111111'),('bmw-m','BMW M','#ffffff')]
items += [(i,n,[n],car+i+'.png','#ffffff' if i in ['mercedes-amg','aston-martin'] else bg,None) for i,n,bg in names]
items += [('rayban','Ray-Ban',['RayBan'],'https://visionsourceshowcase.luxottica.com/wp-content/uploads/Ray-Ban-Logo-1200-1024x695.jpg','#ed1c24',None)]
manifest=[]
for id,name,aliases,url,bg,ink in items:
 suffix='.svg' if '.svg' in url else '.jpg' if '.jpg' in url else '.png';file=root/'sources'/(id+suffix)
 data=urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'UltrackLocalPrototype/1.0'})).read()
 file.write_bytes(data)
 manifest.append({'id':id,'name':name,'aliases':aliases,'source':url,'sourceFile':str(file).replace('\\','/'),'sourceSha256':hashlib.sha256(data).hexdigest(),'file':'logos/'+id+'.png','background':bg,'ink':ink})
 if id=='rayban':manifest[-1].update({'usage':'team-sponsor','venue':False,'sourceCrop':{'left':0,'top':0,'width':1024,'height':609}})
 print(id,len(data))
(root/'manifest.json').write_text(json.dumps({'schemaVersion':1,'downloadedOn':'2026-10-20','brands':manifest},indent=2)+'\n',encoding='utf-8')
