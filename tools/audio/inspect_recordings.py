"""Small, bounded spectrograms for selecting clean engine-only regions."""
import json, subprocess
from pathlib import Path
import numpy as np
from scipy import signal
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

ROOT=Path(__file__).resolve().parents[2]
SOURCES={'av12':'eh5WmIWNkLQ','furari-488':'reWmK4awXng','mp1x':'WKjvGg0hSAA',
 'aston-martin-valk':'9nE5FoIYa2Y','mustang':'eAfIb9VvPqY','bentley-gt':'_yken1hIYOY',
 'porsche1':'vSaavmjn3qo','bmw1':'dmtl68ED5KU','jaguarxkjss':'-hdl5ZmNt-4','buggati':'jT9eWupIUnM'}

def decode(path,rate=12000):
 p=subprocess.run(['ffmpeg','-v','error','-i',str(path),'-ar',str(rate),'-ac','1','-f','f32le','-'],capture_output=True,check=True)
 return np.frombuffer(p.stdout,dtype='<f4').copy()

if __name__=='__main__':
 for key,vid in SOURCES.items():
  src=ROOT/f'assets/audio/recordings/src/youtube-{vid}.webm'
  if not src.exists():continue
  y=decode(src);f,t,s=signal.spectrogram(y,12000,nperseg=2048,noverlap=1024)
  fig,ax=plt.subplots(figsize=(15,3));sel=f<2000
  db=10*np.log10(s[sel]+1e-12);mx=np.percentile(db,99.8)
  ax.pcolormesh(t,f[sel],db,vmin=mx-55,vmax=mx,cmap='magma',rasterized=True)
  ax.set(title=f'{key}: {vid}',xlabel='Source seconds',ylabel='Hz');ax.set_xticks(np.arange(0,len(y)/12000,5));ax.grid(axis='x',alpha=.2)
  fig.tight_layout();fig.savefig(ROOT/f'research/{key}-recording.png',dpi=100);plt.close(fig)
