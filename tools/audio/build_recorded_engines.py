"""Build the real-recording bank. Original audio and licence evidence stay in src/.

Requires ffmpeg, numpy, scipy. The plan defines explicit non-music source trims.
No generated engine audio, model substitutions or automatic download of search hits.
"""
import hashlib, json, math, subprocess, tempfile
from pathlib import Path
import numpy as np
from scipy import signal

ROOT=Path(__file__).resolve().parents[2]
BASE=ROOT/'assets/audio'
WORK=BASE/'recordings'
RATE=48000

def digest(path):return hashlib.sha256(path.read_bytes()).hexdigest()

def decode(path):
    p=subprocess.run(['ffmpeg','-v','error','-i',str(path),'-ar',str(RATE),'-ac','1','-f','f32le','-'],capture_output=True,check=True)
    return np.frombuffer(p.stdout,dtype='<f4').copy()

def trim(samples,start,seconds):
    if not all(math.isfinite(n) for n in (start,seconds)) or start<0 or seconds<.15 or start+seconds>len(samples)/RATE:
        raise ValueError('Invalid or out-of-range trim')
    return samples[round(start*RATE):round((start+seconds)*RATE)].copy()

def loop_region(y):
    # Cut close to similar zero crossings, then overlap the seam. Work on recorded
    # audio, preserving its harmonics and noise instead of synthesising an engine.
    crosses=np.flatnonzero((y[:-1]<=0)&(y[1:]>0))+1
    if len(crosses)>4:
        begins=crosses[crosses<min(2400,len(y)//8)]
        ends=crosses[crosses>len(y)-min(2400,len(y)//8)]
        if len(begins) and len(ends):
            a=int(begins[0]); width=128
            valid=ends[ends+width<len(y)]
            if len(valid):
                b=int(min(valid,key=lambda k:np.mean((y[a:a+width]-y[k:k+width])**2)))
                y=y[a:b]
    n=min(round(.02*RATE),len(y)//8)
    x=np.linspace(0,1,n,endpoint=False)
    seam=y[-n:]*(1-x)+y[:n]*x
    # Exact contiguous interior + smooth seam. Opus encoder preserves loop trim.
    return np.concatenate([y[n:-n],seam]).astype('<f4')

def encode(y,path,loop=False):
    y=signal.sosfilt(signal.butter(2,35,fs=RATE,btype='highpass',output='sos'),y)
    y=signal.sosfilt(signal.butter(2,11000,fs=RATE,output='sos'),y)
    if loop:y=loop_region(y)
    rms=float(np.sqrt(np.mean(y*y)))
    if rms<1e-5:raise ValueError('Silent engine trim: '+str(path))
    # Preserve the recording's dynamics, with no brickwall loudness distortion.
    y*=min(.115/rms,.83/max(np.max(np.abs(y)),1e-6))
    if not loop:
        n=min(round(.02*RATE),len(y)//4)
        y[:n]*=np.linspace(0,1,n);y[-n:]*=np.linspace(1,0,n)
    subprocess.run(['ffmpeg','-v','error','-y','-f','f32le','-ar',str(RATE),'-ac','1','-i','pipe:0',
        '-c:a','libopus','-b:a','96k',str(path)],input=y.astype('<f4').tobytes(),check=True)
    return {'duration':round(len(y)/RATE,5),'peak':round(float(np.max(np.abs(y))),5),'rms':round(float(np.sqrt(np.mean(y*y))),5),'sha256':digest(path)}

def build():
    plan=json.loads((WORK/'plan.json').read_text(encoding='utf8'))
    bank={'schemaVersion':1,'kind':'real-recordings','profiles':{}}
    receipts=[];credits=[];credit_index=[]
    out=BASE/'engines/recorded';out.mkdir(exist_ok=True,parents=True)
    # Validate every source before modifying the published index.
    sources={}
    for key,p in plan['profiles'].items():
        stem=WORK/'src'/('youtube-'+p['video'])
        meta=json.loads(stem.with_suffix('.info.json').read_text(encoding='utf8'))
        if meta.get('license')!='Creative Commons Attribution license (reuse allowed)':
            raise ValueError('Source has no verified CC reuse licence: '+key)
        if 'we do not own the rights' in meta.get('description','').lower():
            raise ValueError('Uploader disclaims ownership: '+key)
        src=stem.with_suffix('.webm');sources[key]=(meta,src)
    with tempfile.TemporaryDirectory(prefix='ultrack-recorded-') as tmp:
        tmp=Path(tmp)
        for key,p in plan['profiles'].items():
            meta,src=sources[key];y=decode(src)
            credit={'author':meta['channel'],'title':meta['title'],'url':meta['webpage_url'],
                'license':'CC BY 3.0','licenseUrl':'https://creativecommons.org/licenses/by/3.0/',
                'sourceSha256':digest(src),'changes':'Trimmed, high/low-pass filtered, level matched, seam crossfaded and encoded to Opus. Runtime pitch and load follow driving.'}
            loops={}
            previous=0
            for layer,(start,seconds,rpm) in p['loops'].items():
                if layer!='decel' and rpm<=previous:raise ValueError('RPM anchors must increase')
                if layer!='decel':previous=rpm
                file=f'{key}-{layer}.ogg';stats=encode(trim(y,start,seconds),tmp/file,loop=True)
                loops[layer]={'file':'engines/recorded/'+file,'rpm':rpm}
                receipts.append({'car':key,'layer':layer,'start':start,'seconds':seconds,'referenceRpmEstimate':rpm,'source':credit,**stats})
            preview=f'{key}-source.ogg';start,seconds=p['preview'];encode(trim(y,start,seconds),tmp/preview)
            bank['profiles'][key]={'name':p['name'],'redline':p['redline'],'cars':[key],'loops':loops,'source':credit,
                'match':p['match'],'quality':p.get('quality','recording-derived-preview'),'preview':'engines/recorded/'+preview,
                'pops':[],'shifts':[]}
            credits.append(f"- **{p['name']}** — [{meta['title']}]({credit['url']}), {credit['author']}. [CC BY 3.0]({credit['licenseUrl']}). {p['match']}")
            credit_index.append({'car':key,'name':p['name'],**credit})
            print(key,'built',flush=True)
        for f in tmp.iterdir():(out/f.name).write_bytes(f.read_bytes())
    (BASE/'recorded-engine-bank.json').write_text(json.dumps(bank,indent=2)+'\n',encoding='utf8')
    (WORK/'receipts.json').write_text(json.dumps(receipts,indent=2)+'\n',encoding='utf8')
    (WORK/'credits.json').write_text(json.dumps(credit_index,indent=2)+'\n',encoding='utf8')
    manifest_path=BASE/'manifest.json'
    archive=BASE/'src/manifest-v1.json';archive.parent.mkdir(parents=True,exist_ok=True)
    if not archive.exists():archive.write_bytes(manifest_path.read_bytes())
    manifest=json.loads(archive.read_text(encoding='utf8'))
    manifest['version']=2;manifest['engineProfiles']=bank['profiles']
    manifest['assets']=[a for a in manifest['assets'] if not a['file'].startswith(('engines/','exhaust/','nitro/'))]
    for key,p in bank['profiles'].items():
        for layer,l in p['loops'].items():
            r=next(r for r in receipts if r['car']==key and r['layer']==layer)
            manifest['assets'].append({'id':l['file'][:-4],'file':l['file'],'category':'engine','loop':True,'seconds':r['duration'],'channels':1,'rms':r['rms'],'samplePeak':r['peak'],'source':p['source'],'referenceRpmEstimate':l['rpm']})
    manifest_path.write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf8')
    (WORK/'CREDITS.md').write_text('# Real engine recordings\n\nCaptured YouTube metadata confirms Creative Commons Attribution (reuse allowed) for each selected source as of 2026-10-20. Metadata and original audio are retained in `src/` for audit. Credits refer to the recordings, not an endorsement.\n\n'+ '\n\n'.join(credits)+'\n\nAll edited audio retains CC BY 3.0. Changes: explicit source trims, filtering, level matching, loop seam edits, Opus encoding, and runtime pitch/load changes. RPM values are estimated audio anchors; not measured dyno RPM. No added AI pops or shift bangs. The AMG ONE source only covers low-speed operation and still needs a clean full-load take.\n',encoding='utf8')
    print('Published',len(bank['profiles']),'recorded profiles;',sum(f.stat().st_size for f in out.glob('*.ogg')),'bytes')

if __name__=='__main__':build()
