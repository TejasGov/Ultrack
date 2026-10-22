"""Verify shipped recording bytes, source licence receipts, decode and peak budget."""
import hashlib,json,subprocess
from pathlib import Path
import numpy as np
ROOT=Path(__file__).resolve().parents[2]
BASE=ROOT/'assets/audio'
bank=json.loads((BASE/'recorded-engine-bank.json').read_text())
receipts=json.loads((BASE/'recordings/receipts.json').read_text())
teams=json.loads((ROOT/'assets/teams/teams.json').read_text())
keys={c['key'] for t in teams['teams'] for c in t['cars']}
assert set(bank['profiles'])==keys
total=0;own=0;shared=0
for key,p in bank['profiles'].items():
    assert p['source']['license']=='CC BY 3.0'
    if p.get('sharedWith'):   # a car mapped onto another car's verified recording: same loops, no files of its own
        assert p['cars']==[key] and p['loops']==bank['profiles'][p['sharedWith']]['loops'] and not bank['profiles'][p['sharedWith']].get('sharedWith'),key
        shared+=1
        continue
    own+=1
    assert not p.get('pops') and not p.get('shifts')
    for layer,l in p['loops'].items():
        assert l['file'].startswith('engines/recorded/')
        path=BASE/l['file'];r=next(r for r in receipts if r['car']==key and r['layer']==layer)
        assert hashlib.sha256(path.read_bytes()).hexdigest()==r['sha256']
        src=BASE/'recordings/src'/('youtube-'+json.loads((BASE/'recordings/plan.json').read_text())['profiles'][key]['video']+'.webm')
        assert hashlib.sha256(src.read_bytes()).hexdigest()==p['source']['sourceSha256']
        d=subprocess.run(['ffmpeg','-v','error','-i',str(path),'-ar','48000','-ac','1','-f','f32le','-'],capture_output=True,check=True)
        pcm=np.frombuffer(d.stdout,dtype='<f4');assert len(pcm)>4800
        assert np.isfinite(pcm).all() and .015<float(np.sqrt(np.mean(pcm*pcm)))<.2
        assert float(np.max(np.abs(pcm)))<.99,(key,layer,'clipping')
        shipped=ROOT/'track-viewer/public/assets/audio'/l['file']
        assert shipped.read_bytes()==path.read_bytes()
        total+=path.stat().st_size
manifest=json.loads((BASE/'manifest.json').read_text())
assert not any(a['file'].startswith(('exhaust/','nitro/')) for a in manifest['assets'])
assert all(not a['file'].startswith('engines/') or a['file'].startswith('engines/recorded/') for a in manifest['assets'])
assert (ROOT/'track-viewer/public/assets/audio/announcers/voice_manifest.json').read_bytes()==(BASE/'announcers/voice_manifest.json').read_bytes()
print(f'PASS: {own} own recordings ({own*5} decoded licensed loops) and {shared} cars mapped onto them, {total:,} loop bytes, matching shipped hashes, no generated engine/exhaust/boost entries; announcer manifest unchanged.')
