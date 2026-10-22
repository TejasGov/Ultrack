"""One reviewable driver intro, with exact outlined team typography and local logos.

The generated illustration is a separate immutable source. This script composes
the code-native title layout and animated preview; it does not regenerate art.
"""
from pathlib import Path
import base64,json,hashlib,html
from fontTools.ttLib import TTFont
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'assets/drivers/matteo-varrone';OUT.mkdir(parents=True,exist_ok=True)
team=next(t for t in json.loads((ROOT/'assets/teams/teams.json').read_text(encoding='utf8'))['teams'] if t['id']=='saetta')
entry=next(c for c in team['cars'] if c['key']=='av12');driver=entry['driver']
assert driver['name']=='Matteo Varrone' and team['sponsor']=='Ray-Ban'
font_dir=ROOT/'track-viewer/public/assets/fonts'
faces={'team':TTFont(font_dir/team['font']['file']),'copy':TTFont(font_dir/'barlow-condensed-latin-700-normal.woff2')}

def lettering(text,x,baseline,height,color,face='team',maxwidth=1200,tracking=0):
    f=faces[face];gs=f.getGlyphSet();cmap=f.getBestCmap();advance=0;glyphs=[];b=BoundsPen(gs)
    for char in text:
        name=cmap.get(ord(char),cmap.get(ord('-')));glyphs.append((name,advance))
        gs[name].draw(TransformPen(b,(1,0,0,1,advance,0)));advance+=f['hmtx'][name][0]+tracking*f['head'].unitsPerEm
    x0,y0,x1,y1=b.bounds;scale=min(height/(y1-y0),maxwidth/(x1-x0));pen=SVGPathPen(gs)
    for name,advance in glyphs:gs[name].draw(TransformPen(pen,(scale,0,0,-scale,x+(advance-x0)*scale,baseline+y0*scale)))
    return f'<path fill="{color}" d="{pen.getCommands()}"/>'

def image(path,x,y,w,h,cls='',self_contained=False):
    if self_contained:
        p=ROOT/path;mime={'.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml'}[p.suffix]
        # librsvg's embedded-image decoder does not handle WebP on this host;
        # the portable poster embeds the original PNG, while the web page uses WebP.
        if p.suffix=='.webp':p=OUT/'source/illustration-v1.png';mime='image/png'
        url='data:'+mime+';base64,'+base64.b64encode(p.read_bytes()).decode()
    else:url='/'+str(path).replace('\\','/')
    return f'<image class="{cls}" href="{url}" x="{x}" y="{y}" width="{w}" height="{h}" preserveAspectRatio="xMidYMid meet"/>'

def scene(self_contained=False):
    img=lambda path,x,y,w,h,cls='':image(path,x,y,w,h,cls,self_contained)
    ink='#1b2027';red=team['colors']['primary'];gold=team['colors']['secondary'];cream=team['colors']['accent']
    parts=[f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 1920 1080" width="1920" height="1080" role="img" aria-labelledby="intro-title intro-desc"><title id="intro-title">Matteo Varrone — Saetta number 7</title><desc id="intro-desc">Original GTA V loading-screen-inspired illustrated driver introduction. Matteo lifts his sunglasses beside a red Lamborghini Aventador. Saetta and Ray-Ban branding, with his name in Racing Sans One.</desc><defs><clipPath id="frame"><path d="M0 0h1920v1080H0Z"/></clipPath></defs><g clip-path="url(#frame)">',
        f'<path d="M0 0h1920v1080H0Z" fill="{cream}"/>',img('assets/drivers/matteo-varrone/illustration-v1.webp',0,0,1920,1080,'art'),
        '<g class="team-id">',img('assets/teams/logos/saetta-lockup-onLight.svg',84,54,320,80),
        lettering('MODENA, ITALY  /  SAETTA RACING',100,163,13,ink,'copy',500,.055),'</g>',
        f'<g class="headline"><path d="M94 255h64v5H94Z" fill="{gold}"/>',
        lettering('MATTEO',88,351,57,ink,maxwidth=500),
        lettering('VARRONE',82,508,137,red,maxwidth=860),
        lettering("SAETTA'S GOLDEN BOY",94,559,19,ink,'copy',550,.045),
        f'<path d="M94 596h48v4H94Z" fill="{red}"/>',
        lettering('LAST ON THE BRAKES.',94,637,23,ink,'copy',490,.008),
        lettering('FIRST TO MAKE AN IMPRESSION.',94,673,18,ink,'copy',460,.016),'</g>',
        '<g class="driver-data">',f'<path d="M94 768h78v90H94Z" fill="{red}"/>',
        lettering('7',109,837,56,cream,maxwidth=50),
        '<path d="M197 778h13v20h-13Z" fill="#15935c"/><path d="M210 778h13v20h-13Z" fill="#fff"/><path d="M223 778h13v20h-13Z" fill="#ce2538"/>',
        lettering('ITALY',250,799,20,ink,'copy',180,.02),lettering('26 YEARS OLD',197,842,15,ink,'copy',250,.04),'</g>',
        '<g class="car-data">',lettering('THE MACHINE',96,912,12,ink,'copy',300,.09),
        f'<path d="M94 930h350v104H94Z" fill="{ink}"/>',
        img('assets/sponsors/logos/lamborghini.png',108,946,56,65),
        lettering('AV–12',181,983,35,cream,maxwidth=235),
        lettering('LAMBORGHINI AVENTADOR',181,1015,12,cream,'copy',240,.015),'</g>',
        '<g class="sponsor">',f'<path d="M1638 52h198v145h-198Z" fill="#ed1c24"/>',
        lettering('TITLE PARTNER',1663,78,10,'#ffffff','copy',160,.07),
        img('assets/sponsors/logos/rayban.png',1656,89,161,95),'</g>',
        '<g class="signature">',lettering('ULTRACK',1660,1017,15,'#f5f1e8','copy',160,.13),
        '<path d="M1840 1001h7v18h-7Z" fill="#15935c"/><path d="M1847 1001h7v18h-7Z" fill="#fff"/><path d="M1854 1001h7v18h-7Z" fill="#ce2538"/></g>',
        '</g></svg>']
    return ''.join(parts)

(OUT/'poster-v1.svg').write_bytes(scene(True).encode('utf8'))
style='''
:root{color-scheme:dark;background:#0d0e12;color:#f5f1e8;font:14px system-ui,sans-serif}*{box-sizing:border-box}body{margin:0;min-height:100svh;display:flex;flex-direction:column;justify-content:center;padding:22px;gap:16px}header,footer{display:flex;justify-content:space-between;align-items:center;width:min(1600px,100%);margin:0 auto;gap:16px}header{font-size:11px;letter-spacing:.16em;color:#a6a9b2}a{color:inherit;text-decoration:none}a:hover{text-decoration:underline}.stage{width:min(1600px,100%);margin:auto;aspect-ratio:16/9;overflow:hidden;background:#f5f1e8;box-shadow:0 24px 100px #0008}.stage>svg{display:block;width:100%;height:100%}.art{transform-box:fill-box;transform-origin:70% 50%;animation:camera 8s cubic-bezier(.16,.65,.3,1) both}.team-id{animation:reveal .8s .1s both}.headline{animation:headline 1.1s .45s cubic-bezier(.16,1,.3,1) both}.sponsor{animation:reveal .7s .3s both}.driver-data,.car-data{animation:reveal .9s 1s both}.signature{animation:reveal .8s 1.3s both}footer{font-size:12px;color:#b3b4bc}nav{display:flex;gap:10px;align-items:center}button,.download{font:inherit;color:#f5f1e8;background:#202129;border:1px solid #474852;border-radius:4px;padding:9px 14px;cursor:pointer}button:hover,.download:hover{border-color:#f2b705;text-decoration:none}button:focus-visible,a:focus-visible{outline:2px solid #f2b705;outline-offset:4px}.duration{height:2px;background:#35353d;margin-top:9px;overflow:hidden}.duration:after{content:'';display:block;height:100%;background:#f2b705;transform-origin:left;animation:duration 8s linear both}.progress{flex:1;max-width:380px}.progress span{font-size:10px;letter-spacing:.13em;color:#898c97}@keyframes camera{from{transform:scale(1.035) translateX(8px);opacity:0}10%{opacity:1}to{transform:scale(1);opacity:1}}@keyframes headline{from{opacity:0;transform:translateX(-70px)}to{opacity:1;transform:translateX(0)}}@keyframes reveal{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}@keyframes duration{from{transform:scaleX(0)}to{transform:scaleX(1)}}@media(prefers-reduced-motion:reduce){*,*:after{animation:none!important}}@media(max-width:680px){body{padding:10px;gap:14px}header{font-size:9px}footer{flex-wrap:wrap}.progress{max-width:none;width:100%;flex-basis:100%}button,.download{padding:8px 10px;font-size:11px}}
'''
page=f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Matteo Varrone · Saetta driver intro</title><style>{style}</style></head><body><header><span>ULTRACK / DRIVER INTRO · CONCEPT 01</span><a href="/">BACK TO GAME ↗</a></header><main class="stage" id="stage">{scene()}</main><footer><div class="progress"><span>MATTEO VARRONE / SAETTA #7 · 8 SECOND INTRO</span><div class="duration" id="duration"></div></div><nav><button type="button" id="replay">Replay intro ↺</button><a class="download" href="/assets/drivers/matteo-varrone/poster-v1.png" download>Download poster ↓</a></nav></footer><script>const stage=document.getElementById('stage');function replay(){{for(const root of [stage,document.getElementById('duration')])for(const animation of root.getAnimations({{subtree:true}})){{animation.currentTime=0;animation.play();}}}}document.getElementById('replay').addEventListener('click',replay);document.addEventListener('keydown',event=>{{if(event.code==='Space'&&event.target===document.body){{event.preventDefault();replay();}}}});</script></body></html>'''
(OUT/'intro-v1.html').write_bytes(page.encode('utf8'))
meta={'schemaVersion':1,'status':'awaiting-user-style-approval','driver':driver,'team':team['id'],'raceNumber':entry['number'],'carKey':entry['key'],'manufacturer':'Lamborghini','car':'Aventador / AV–12','titleSponsor':team['sponsor'],'font':team['font'],'style':'Original fictional driver in GTA V loading-screen-inspired inked, cel-shaded illustration. No real driver likeness.','illustration':'illustration-v1.webp','sourceIllustration':'source/illustration-v1.png','sourceSha256':hashlib.sha256((OUT/'source/illustration-v1.png').read_bytes()).hexdigest(),'motion':'8-second camera settle, staggered team/sponsor reveal, name slide and metadata reveal. Reduced-motion support. Driver is a still illustration, not a skeletal character animation.','scope':'One driver concept only; not installed as an automatic race intro pending style approval.'}
(OUT/'intro.json').write_text(json.dumps(meta,indent=2,ensure_ascii=False)+'\n',encoding='utf8')
print('Built Matteo Varrone intro layout, self-contained poster SVG and motion preview.')
