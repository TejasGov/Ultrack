export function validateProfile(p){
  if(p?.schemaVersion!==1||!p.id)throw Error('Unsupported vehicle profile.');
  if(p.body?.forward!=='-X'||!(p.body.displayLength>0)||!Number.isFinite(p.body.lift))throw Error('Invalid body normalization.');
  if(!/^[a-f\d]{64}$/i.test(p.body.sha256))throw Error('Body source hash is missing.');
  if(p.body.normalizationBounds){
    const b=p.body.normalizationBounds;
    if(b.length!==2||b.some(v=>v.length!==3||!v.every(Number.isFinite))||b[0].some((v,i)=>v>=b[1][i]))throw Error('Invalid normalization bounds.');
  }
  if(p.body.trimRegions&&!p.body.trimRegions.every(r=>r.min?.length===3&&r.max?.length===3&&r.min.every(Number.isFinite)&&r.max.every(Number.isFinite)&&r.min.every((v,i)=>v<r.max[i])))throw Error('Invalid body trim region.');
  for(const axle of ['front','rear']){
    const w=p.wheels?.[axle];
    if(!w||!['x','radius','width','track'].every(k=>Number.isFinite(w[k]))||w.radius<=0||w.width<=0||w.track<=w.width)throw Error(`Invalid ${axle} wheel fit.`);
    if(Math.abs(w.x)+w.radius>p.body.displayLength/2)throw Error(`${axle} wheel lies beyond the body envelope.`);
  }
  if(p.wheels.front.x>=p.wheels.rear.x)throw Error('Axles must follow the -X forward convention.');
  for(const [name,points] of Object.entries(p.glass??{})){
    if(points.length<3||!points.every(a=>a.length===3&&a.every(Number.isFinite)))throw Error(`Invalid ${name} glass anchors.`);
  }
  if(p.body.kind==='complete-car'){
    if(!p.license?.url||!p.license?.licenseUrl)throw Error('Complete model requires attribution.');
    if(p.lights?.headlamp?.type!=='native'||!['front','rear'].every(k=>p.lights[k]?.length>=2&&p.lights[k].every(a=>a.length===3&&a.every(Number.isFinite))))throw Error('Invalid native lamps.');
    return p;
  }
  if(p.glassFits){
    if(p.glassFits.sourceSha256!==p.body.sha256)throw Error('Glazing fit belongs to a different shell.');
    for(const [name,f] of Object.entries(p.glassFits))if(name!=='sourceSha256'){
      if(!Number.isInteger(f.rows)||!Number.isInteger(f.columns)||f.rows<2||f.columns<2||f.points?.length!==f.rows*f.columns||!f.points.every(p=>p.length===3&&p.every(Number.isFinite)))throw Error('Invalid glazing surface.');
    }
  }
  if(p.mirrors.sourceSha256){
    if(p.mirrors.sourceSha256!==p.body.sha256)throw Error('Mirror fit belongs to a different shell.');
    for(const side of ['1','-1'])if(!p.mirrors.mounts?.[side]?.every(Number.isFinite)||!p.mirrors.surfaceMounts?.[side]?.every(Number.isFinite))throw Error('Invalid measured mirror mounts.');
  }
  const fits=['frontRecess','rearRecess'].flatMap(name=>p.lights?.[name]?[[name,p.lights[name]]]:[]);
  const headlamp=p.lights?.headlamp;
  if(!headlamp||!['signature','enclosed'].includes(headlamp.type)||!headlamp.design)throw Error('Choose a concept-specific headlamp design before assembly.');
  if(headlamp.type==='enclosed')for(const [i,headlamp] of [p.lights.headlamp,...(p.lights.headlamp.additional??[])].entries()){
    if(!headlamp.aperture?.closed||!(headlamp.depth>0)||!headlamp.optics?.length||!headlamp.running?.length)throw Error('An enclosed headlamp needs a closed aperture, housing depth and optical layout.');
    if(!['y','z'].includes(headlamp.capProjection)||!(headlamp.capWindow>0)||!(headlamp.runningWidth>0)||!headlamp.running.every(guide=>guide.length>=2&&guide.every(p=>p.length===2&&p.every(Number.isFinite))))throw Error('Invalid headlamp lens surface or running-light guides.');
    for(const optic of headlamp.optics){
      if(!['low','high'].includes(optic.beam)||optic.zy?.length!==2||!optic.zy.every(Number.isFinite)||!(optic.radius>0||optic.size?.every(v=>Number.isFinite(v)&&v>0)))throw Error('Invalid headlamp optical module.');
    }
    fits.push([`headlamp.aperture[${i}]`,headlamp.aperture]);
  }
  for(const name of ['frontFits','rearFits'])if(p.lights?.[name]){
    if(!Array.isArray(p.lights[name])||!p.lights[name].length)throw Error(`Invalid ${name}.`);
    p.lights[name].forEach((fit,i)=>fits.push([`${name}[${i}]`,fit]));
  }
  for(const [name,fit] of fits){
    if(fit.sourceSha256?.toUpperCase()!==p.body.sha256.toUpperCase())throw Error(`${name} fit belongs to a different shell.`);
    if(!Number.isInteger(fit.rows)||fit.rows<2||!Number.isInteger(fit.columns)||fit.columns<3||fit.width<=0||fit.ledWidth<=0||fit.lensWidth<fit.ledWidth||fit.width<fit.lensWidth)throw Error(`Invalid ${name} dimensions.`);
    for(const side of ['1','-1']){
      if(fit.sides?.[side]?.length!==fit.rows*fit.columns||!fit.sides[side].every(v=>v.length===3&&v.every(Number.isFinite)))throw Error(`Invalid ${name} surface samples.`);
      if(fit.capX?.[side]?.length!==fit.rows||!fit.capX[side].every(Number.isFinite))throw Error(`Invalid ${name} lens cap.`);
    }
  }
  if(p.exhaust){
    const e=p.exhaust,point=p=>p?.length===3&&p.every(Number.isFinite);
    if(e.sourceSha256!==p.body.sha256)throw Error('Exhaust fit belongs to a different body.');
    if(!e.tips?.length||new Set(e.tips.map(t=>t.id)).size!==e.tips.length||!e.tips.every(t=>t.id&&point(t.entry)&&point(t.position)&&point(t.direction)&&Math.abs(Math.hypot(...t.direction)-1)<1e-5&&t.radius>0&&t.length>t.radius*2))throw Error('Invalid exhaust outlets.');
    if(!(e.nitro?.length>0)||!/^#[a-f\d]{6}$/i.test(e.nitro.color)||!/^#[a-f\d]{6}$/i.test(e.nitro.coreColor)||e.nitro.defaultBoost!==0)throw Error('Nitro preview must start off with valid effect settings.');
  }
  if(p.jaguarDesign){
    const d=p.jaguarDesign,point=p=>p?.length===3&&p.every(Number.isFinite);
    if(d.sourceSha256!==p.body.sha256)throw Error('Jaguar details belong to a different body.');
    if(!d.bumperRails?.every(a=>a.length>10&&a.every(point))||!d.letterStrokes?.every(a=>a.length>=2&&a.every(point))||!d.plate?.points?.every(point)||d.plate.points.length!==d.plate.rows*d.plate.columns)throw Error('Invalid Jaguar detail fit.');
  }
  if(p.nuvolariDesign){
    const fit=p.nuvolariDesign;
    if(fit.sourceSha256!==p.body.sha256)throw Error('Nuvolari details belong to a different body.');
    const point=p=>p?.length===3&&p.every(Number.isFinite);
    if(!fit.patches?.every(p=>p.rows>1&&p.columns>1&&p.points.length===p.rows*p.columns&&p.points.every(point))||!fit.badges?.every(b=>b.rings.length===4&&b.rings.every(r=>r.length>20&&r.every(point)))||fit.exhaust?.length!==2||!fit.exhaust.every(point))throw Error('Invalid Nuvolari design fit.');
  }
  if(p.coachwork){
    if(p.coachwork.sourceSha256!==p.body.sha256)throw Error('Panel gaps belong to a different body.');
    if(!p.coachwork.seams?.length||!p.coachwork.seams.every(s=>s.width>0&&s.width<.01&&s.points.length>20&&s.points.every(p=>p.length===3&&p.every(Number.isFinite))))throw Error('Invalid recessed panel gap fit.');
  }
  return p;
}
