"""Record study evidence honestly; never invent approval or completed runtime checks."""
import json
from pathlib import Path
HERE=Path(__file__).resolve().parent
E=HERE/'evidence'
A=json.loads((HERE/'out/study-audit.json').read_text())
def update(name,fn):
    p=E/name;d=json.loads(p.read_text());fn(d);p.write_text(json.dumps(d,indent=2),encoding='utf8')
def brief(d):
    d.update(purpose='Initial construction of the supplied Tokyo hiragana racing circuit',runtimeSurface='Planned RaceUltimate Three.js/Rapier; not integrated',boundsMeters=[2110,1340,190])
    d['hero']={'id':'racing-car','role':'Player-controlled race car; reserve roadway and crossing envelope','reservedBoundsMeters':[5.5,2.4,2.1]}
    d['symmetry']={'mode':'none','order':1,'appliesTo':['architecture','barriers','circulation','repeatedProps'],'exceptions':['Source-authored asymmetric hiragana course; no artificial symmetry imposed']}
    d['circulation']={'description':'Closed 5180 m route, 18 m working road width. Pit/service access remains to design.','minimumClearanceMeters':18}
    d['productionCamera']={'viewport':[1600,1100],'location':[1400,-2050,2200],'target':[-30,20,0],'verticalFovDegrees':31,'note':'Overview study; game racing camera and performance contract pending'}
    d['performanceBudget']={'maxSceneTriangles':2000000,'maxVLowBytes':25000000,'maxHighTextureBytes':268435456,'status':'Provisional planning ceilings, not measured targets or final quality limits'}
    d['creditBudget']={'maximumCredits':0,'approvalRequired':True}
    d['environment']={'type':'procedural','identity':'tokyo-study-world','source':'Local Blender world and sun','assignmentKey':'tokyo-study'}
    d['artifacts'].update(floorPlan='../out/plan.png',visualTarget='../out/overview.png',studyBlend='../out/tokyo_study.blend')
    d['stage']='Pre-Function initial study authorized by user; approvals pending'
update('room-brief.json',brief)
def layout(d):
    d['instances']=A['landmarks'];d['centerline']='../out/centerline.json';d['source']='../source/map.json';d['surfaces']=[{'id':'track','widthMeters':18,'lengthMeters':A['horizontal_length_m']},{'id':'terrain','type':'valley-carved grid'},{'id':'bay','type':'water study'}]
    d['productionCamera']={'location':[1400,-2050,2200],'target':[-30,20,0],'verticalFovDegrees':31}
update('room-layout.json',layout)
def props(d):
    d['generation'].update(status='Not requested; no paid provider used',pricingVerifiedAt='',creditsPerTexturedTask=None)
    d['assets']=[{'id':'street-kit','function':'Reusable road furniture, fence and lamps','description':'Procedural initial kit; detailed geometry pending','class':'reusable','dimensionsMeters':[3,1,9],'attachmentFace':'floor','semanticFront':'toward roadway','polygonTarget':4000,'rejectionCriteria':['Visible unsupported fixtures','Silhouette degradation at racing-camera distance','Intrusion into road envelope'],'status':'study'}, {'id':'landmark-family','function':'Distinct district landmarks and route navigation','description':'Twelve individually named placement studies; bespoke silhouettes pending','class':'hero','attachmentFace':'floor','semanticFront':'road frontage','polygonTarget':150000,'rejectionCriteria':['Generic silhouette at final-art review','Footprint deviation without design reason','Unscheduled false openings'],'status':'study'}]
update('props.json',props)
def reviews(d):
    d['function']['notes']='User requested initial Blender construction from supplied map. This is not explicit approval of the generated layout or reference assets.'
    d['function']['evidence']=['../source/map.json','../out/tokyo_study.blend','../out/plan.png','../out/study-audit.json']
    d['function']['strangestElement']='Source crossing captions differ from the actual interpolated crossing; measured separation recorded in audit.'
    d['form']['notes']='Pending bespoke architecture, structural review, detailed opening schedule and driving-height detail review.'
    d['runtime']['notes']='No exports, deployment or runtime integration.'
update('milestone-reviews.json',reviews)
def openings(d):
    d['scope']='Open-air exterior study; detailed building apertures not authored yet. Glazing bands are surface studies, not modeled building interiors.'
    d['crossing']=A['crossings'];d['note']='Viaduct is an open post-and-deck arrangement. No decorative arch is substituted for an aperture.'
update('openings.json',openings)
def report(d):
    d['stage']='initial-study';d['audit']='../out/study-audit.json';d['remaining']=A['remaining'];d['runtimeExported']=False;d['approvalStatus']='Pending';d['observations']=['Corrected road ribbon winding after the initial driving render exposed hidden markings.','Corrected grandstand local facing direction.','Widened overview framing to include the site.'];d['proposedLessons']=[]
update('final-report.json',report)
print('Study evidence updated; all approval gates remain pending.')
