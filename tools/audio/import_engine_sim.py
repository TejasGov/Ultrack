"""Build a runtime engine bank from approved fixed-RPM recordings, never from AI SFX.

python tools/audio/import_engine_sim.py recordings/bank.json [--check-only]
The plan is relative to its own directory. See engine-sim-plan.example.json.
"""
import argparse, hashlib, json, math, shutil, subprocess, tempfile
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
LAYERS=('idle','low','mid','high','decel')

def validate_plan(plan, directory):
    if plan.get('schemaVersion')!=1 or not plan.get('profiles'):raise ValueError('Expected schemaVersion 1 and profiles.')
    cars=set()
    for name,profile in plan['profiles'].items():
        if not name or any(c not in 'abcdefghijklmnopqrstuvwxyz0123456789-' for c in name):raise ValueError('Invalid profile name.')
        credit=profile.get('source',{})
        if not all(credit.get(k) for k in ('author','url','license')):raise ValueError('Each recording needs author, URL and license.')
        if 'elevenlabs' in str(credit).lower():raise ValueError('V2 engine recordings must not use ElevenLabs.')
        red=profile.get('redline',0)
        if not isinstance(red,(int,float)) or not math.isfinite(red) or not 2000<red<30000:raise ValueError('Invalid redline.')
        if not profile.get('cars') or any(c in cars for c in profile['cars']):raise ValueError('Missing or duplicate car assignment.')
        cars.update(profile['cars'])
        previous=0
        for layer in LAYERS:
            take=profile.get('loops',{}).get(layer,{})
            rpm=take.get('rpm',0);start=take.get('start',0);seconds=take.get('seconds',5)
            if not all(isinstance(n,(int,float)) and math.isfinite(n) for n in (rpm,start,seconds)):raise ValueError('Invalid recording trim.')
            if not 0<rpm<=red*1.1 or start<0 or seconds<2:raise ValueError('Invalid RPM or trim length.')
            if layer!='decel' and rpm<=previous:raise ValueError('Idle/low/mid/high RPM must increase.')
            if layer!='decel':previous=rpm
            if not take.get('file') or not (directory/take['file']).is_file():raise ValueError('Missing '+layer+' recording.')

def build(plan, directory, destination, ffmpeg='ffmpeg'):
    validate_plan(plan,directory)
    destination.mkdir(parents=True,exist_ok=True)
    bank={'schemaVersion':1,'profiles':{}}
    receipts=[]
    # All encodes must succeed before publishing the bank index.
    with tempfile.TemporaryDirectory(prefix='ultrack-engine-') as tmp:
        tmp=Path(tmp)
        for name,p in plan['profiles'].items():
            loops={}
            for layer in LAYERS:
                take=p['loops'][layer];src=(directory/take['file']).resolve();dst=tmp/f'{name}-{layer}.ogg'
                probe=subprocess.run(['ffprobe','-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',str(src)],capture_output=True,text=True,check=True)
                duration=float(probe.stdout.strip())
                if not math.isfinite(duration) or duration+0.01<take.get('start',0)+take.get('seconds',5):raise ValueError('Recording is shorter than requested trim: '+str(src))
                # Join the end into the beginning; the loop starts/ends at the same phase of the head segment.
                filters='[0:a]highpass=f=25,loudnorm=I=-20:TP=-2:LRA=8,asplit=2[a][b];[a]atrim=start=0.05,asetpts=PTS-STARTPTS[tail];[b]atrim=end=0.05,asetpts=PTS-STARTPTS[head];[tail][head]acrossfade=d=0.05:c1=tri:c2=tri[out]'
                subprocess.run([ffmpeg,'-v','error','-y','-ss',str(take.get('start',0)),'-t',str(take.get('seconds',5)),'-i',str(src),'-filter_complex',filters,'-map','[out]','-ar','48000','-ac','2','-c:a','libopus','-b:a','128k',str(dst)],check=True)
                loops[layer]={'file':f'engines/engine-sim/{dst.name}','rpm':take['rpm']}
                receipts.append({'profile':name,'layer':layer,'source':str(src),'sourceSha256':hashlib.sha256(src.read_bytes()).hexdigest(),'outputSha256':hashlib.sha256(dst.read_bytes()).hexdigest(),'credit':p['source']})
            for car in p['cars']:bank['profiles'][car]={'redline':p['redline'],'cars':p['cars'],'loops':loops,'source':p['source']}
        outputs=destination/'engines/engine-sim';outputs.mkdir(parents=True,exist_ok=True)
        for file in tmp.iterdir():shutil.copy2(file,outputs/file.name)
    (destination/'engine-sim-bank.json').write_text(json.dumps(bank,indent=2)+'\n',encoding='utf-8')
    (destination/'engine-sim-receipts.json').write_text(json.dumps(receipts,indent=2)+'\n',encoding='utf-8')
    return bank

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('plan',type=Path);parser.add_argument('--check-only',action='store_true');args=parser.parse_args()
    plan=json.loads(args.plan.read_text(encoding='utf-8-sig'));validate_plan(plan,args.plan.resolve().parent)
    if not args.check_only:build(plan,args.plan.resolve().parent,ROOT/'assets/audio')
    print('Validated recording bank.' if args.check_only else 'Imported fixed-RPM engine bank.')
