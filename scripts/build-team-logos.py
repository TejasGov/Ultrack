"""Original Ultrack team emblems and outlined wordmarks. No runtime font dependency.

Requires fonttools[woff] (including brotli). Run from the project root, then
node track-viewer/scripts/prepare-team-logos.mjs for PNG/WebP and the review sheet.
"""
from pathlib import Path
import hashlib,json,html
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.transformPen import TransformPen

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'assets/teams/logos';OUT.mkdir(parents=True,exist_ok=True)
TEAMS=json.loads((ROOT/'assets/teams/teams.json').read_text(encoding='utf-8-sig'))['teams']

# All emblems share a 100-unit design grid. Deliberately simple silhouettes keep
# the identities readable as small car decals and garage-list icons.
EMBLEMS={
 'saetta': ('Lightning bolt', '<path d="M65 5 22 53h28L37 95l44-53H54Z"/><path d="M26 19h21M16 29h22" fill="none" stroke="currentColor" stroke-width="3"/>'),
 'corvid': ('Raven', '<path d="m8 19 40 13 15-17 23 9 7 11-19-1-9 25-9 25-13-17-13 3 11-24Z"/><path d="m16 31 25 18-18-7 24 22-1-15Z" fill="{cut}"/><path d="m70 25 4 2-4 3Z" fill="{cut}"/>'),
 'kalt': ('Technical K monogram', '<path d="M17 10h15v80H17ZM40 46 72 10h20L57 50l35 40H72L40 54Z"/><path d="M8 10H2v18M92 90h6V72" fill="none" stroke="currentColor" stroke-width="2"/>'),
 'mojave': ('Desert sunrise', '<path d="M8 74h84v7H8Zm5-10 19-19 19 19 17-13 20 13v5H13Z"/><path d="M31 42a20 20 0 0 1 38 0h-9a12 12 0 0 0-20 0Z"/><path d="M50 7v10M25 15l6 8M75 15l-6 8M9 33l10 3M91 33l-10 3" fill="none" stroke="currentColor" stroke-width="5"/>'),
 'aurum': ('Art Deco A in a lozenge', '<path d="m50 5 42 45-42 45L8 50Z" fill="none" stroke="currentColor" stroke-width="3"/><path d="m50 17 30 33-30 33-30-33Z" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="m50 24-20 49h9l4-11h14l4 11h9L50 24Zm0 18 5 14H45Z" fill-rule="evenodd"/>'),
 'liberty': ('Winged star', '<path d="m50 16 8 22 24 1-19 15 6 23-19-13-19 13 6-23-19-15 24-1Z"/><path d="M3 33h18l8 7H3Zm0 13h23l8 7H9Zm12 13h14l8 7H21ZM97 33H79l-8 7h26Zm0 13H74l-8 7h25ZM85 59H71l-8 7h16Z"/>'),
 'sarab': ('Falcon above a dune', '<path d="m50 40 21-18 25-8-12 17-23 22-11 24-11-24-23-22L4 14l25 8Z"/><path d="m50 23 8 7-8 10-8-10Z"/><path d="M11 86q23-14 46-3t32-2" fill="none" stroke="currentColor" stroke-width="3"/>'),
}

def wordmark(team):
    f=TTFont(ROOT/'track-viewer/public/assets/fonts'/team['font']['file']);gs=f.getGlyphSet();cmap=f.getBestCmap()
    bounds=BoundsPen(gs);x=0;letters=[];tracking=f['head'].unitsPerEm*.018
    for c in team['name'].upper():
        name=cmap[ord(c)];letters.append((name,x));gs[name].draw(TransformPen(bounds,(1,0,0,1,x,0)))
        x+=f['hmtx'][name][0]+tracking
    x0,y0,x1,y1=bounds.bounds;s=min(720/(x1-x0),122/(y1-y0));tx=260-x0*s;ty=128+(y0+y1)*s/2
    pen=SVGPathPen(gs)
    for name,x in letters:gs[name].draw(TransformPen(pen,(s,0,0,-s,tx+x*s,ty)))
    return pen.getCommands()

def luminance(color):
    rgb=[int(color[i:i+2],16)/255 for i in (1,3,5)]
    return sum(c*w for c,w in zip(rgb,(.2126,.7152,.0722)))

index={'schemaVersion':1,'description':'Original team emblems; outlined lettering from bundled OFL typefaces. Transparent, self-contained SVG masters and baked textures.','teams':{}}
for t in TEAMS:
    key=t['id'];c=t['colors'];label,shape=EMBLEMS[key];letters=wordmark(t)
    dark=c['primary'] if luminance(c['primary'])<.55 else c['secondary']
    # onTeam is selected for the actual paint scheme; onDark for menus, onLight
    # for light surfaces. Tiny transparent counters use masks, not painted holes.
    team_ink=c['secondary'] if luminance(c['primary'])>.55 else c['accent']
    team_accent=c['secondary'] if abs(luminance(c['secondary'])-luminance(c['primary']))>.15 else team_ink
    palettes={'onTeam':(team_ink,team_accent),'onDark':('#f5f1e8',c['accent'] if luminance(c['secondary'])<.2 else c['secondary']),'onLight':(dark,dark)}
    info={'name':t['name'],'emblem':label,'font':t['font'],'colors':c,'variants':{}}
    for variant,(ink,accent) in palettes.items():
        files={}
        for kind,view,body in [('lockup','0 0 1024 256',f'<g transform="translate(28 32) scale(1.92)" color="{accent}" fill="currentColor">{shape}</g><path fill="{ink}" d="{letters}"'+(' stroke="'+ink+'" stroke-width="2.4" paint-order="stroke"' if t['font'].get('bold') else '')+'/>'),('icon','0 0 256 256',f'<g transform="translate(28 28) scale(2)" color="{accent}" fill="currentColor">{shape}</g>')]:
            # Counters in the raven are cut through the artwork by a mask.
            body=body.replace('{cut}','black')
            if key=='corvid':
                bird=shape.replace('{cut}','black').replace('currentColor','white')
                # Main silhouette is white; detail shapes remain black in mask.
                body=body.replace(shape.replace('{cut}','black'),f'<defs><mask id="raven" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100"><g fill="white">{bird}</g></mask></defs><path d="M0 0h100v100H0Z" mask="url(#raven)"/>')
            file=f'{key}-{kind}-{variant}.svg'
            if variant=='onTeam':
                edge=1024 if kind=='lockup' else 256
                body=f'<defs><filter id="edge" filterUnits="userSpaceOnUse" x="0" y="0" width="{edge}" height="256"><feMorphology in="SourceAlpha" operator="dilate" radius="1.5" result="spread"/><feFlood flood-color="{c["primary"]}"/><feComposite in2="spread" operator="in"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><g filter="url(#edge)">{body}</g>'
            svg=f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{view}" role="img" aria-label="{html.escape(t["name"])}"><title>{html.escape(t["name"])} — {label}</title>{body}</svg>\n'
            (OUT/file).write_bytes(svg.encode('utf8'));files[kind]={'svg':file,'png':file.replace('.svg','.png'),'webp':file.replace('.svg','.webp'),'sourceSha256':hashlib.sha256(svg.encode()).hexdigest()}
        info['variants'][variant]=files
    index['teams'][key]=info
(OUT/'manifest.json').write_text(json.dumps(index,indent=2)+'\n',encoding='utf8')
print('Built outlined SVG masters for',len(TEAMS),'teams.')
