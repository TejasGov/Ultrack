"""Discover YouTube CC recordings; metadata only, never download unlicensed hits."""
import concurrent.futures, json
from pathlib import Path
from urllib.parse import urlencode
import yt_dlp

ROOT = Path(__file__).resolve().parents[2]
QUERIES = {
    'av12': 'Lamborghini Aventador exhaust idle rev sound',
    'furari-488': 'Ferrari 488 exhaust idle rev sound',
    'mp1x': 'McLaren 720s exhaust idle rev sound',
    'jaguarxkjss': 'Mercedes AMG One engine sound',
    'aston-martin-valk': 'Aston Martin Valkyrie engine sound',
    'mustang': 'Ford Mustang V8 exhaust idle rev sound',
    'bmw1': 'BMW M4 exhaust idle rev sound',
    'buggati': 'Bugatti Chiron engine sound',
    'bentley-gt': 'Bentley Continental GT exhaust sound',
    'porsche1': 'Porsche 911 engine idle rev sound',
}

def search(item):
    car, query = item
    url = 'https://www.youtube.com/results?' + urlencode({'search_query':query, 'sp':'EgIwAQ=='})
    opts = {'quiet':True,'no_warnings':True,'socket_timeout':15,'retries':1}
    with yt_dlp.YoutubeDL({**opts,'extract_flat':True,'playlistend':3}) as y:
        entries = y.extract_info(url, download=False).get('entries',[])
    hits=[]
    for e in entries:
        try:
            with yt_dlp.YoutubeDL(opts) as y:d=y.extract_info(e['url'],download=False)
            hits.append({k:d.get(k) for k in ('id','title','webpage_url','license','channel','duration','description','chapters')})
        except Exception as exc: hits.append({'id':e.get('id'),'error':str(exc)})
    return car,hits

if __name__=='__main__':
    results={}
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        for car,hits in pool.map(search,QUERIES.items()):
            results[car]=hits
            print(car,[(h.get('id'),h.get('title'),h.get('license'),h.get('duration')) for h in hits],flush=True)
            (ROOT/'research/youtube-engine-candidates.json').write_text(json.dumps(results,indent=2)+'\n',encoding='utf8')
