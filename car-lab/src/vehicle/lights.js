import * as THREE from 'three';
import { createEnclosedHeadlamp } from './headlamps.js';

// Fit coordinates are local to the normalized shell; -X is forward.
// Emissive optics stay separate from real lights that illuminate other surfaces.
export function createVehicleLights(profile,m){
  const root=new THREE.Group();root.name='lights';root.position.y=profile.body.lift;
  const beams=[],rearSpill=[],reverseSpill=[];
  function mesh(geometry,material,name){
    const o=new THREE.Mesh(geometry,material);o.name=name;o.castShadow=false;root.add(o);return o;
  }
  function path(points,radius,material,name){
    return mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),24,radius,10,false),material,name);
  }
  function fittedLamp(sign,fit,name,kind=name){
    const direction=fit.direction??1,isRear=kind==='rear';
    if(fit.sourceSha256.toUpperCase()!==profile.body.sha256.toUpperCase())throw Error('Lamp fit belongs to a different shell.');
    const points=fit.sides[String(sign)],columns=fit.columns,rows=fit.rows;
    function ribbon(width,offset,material,name){
      const positions=[],indices=[];
      for(let row=0;row<rows;row++)for(let col=0;col<columns;col++){
        const u=(.5+(col/(columns-1)-.5)*width/fit.width)*(columns-1),lo=Math.floor(u),hi=Math.min(columns-1,lo+1),fraction=u-lo;
        const a=points[row*columns+lo],b=points[row*columns+hi];
        positions.push((fit.capX?.[String(sign)]?.[row]??THREE.MathUtils.lerp(a[0],b[0],fraction))+offset*direction,THREE.MathUtils.lerp(a[1],b[1],fraction),THREE.MathUtils.lerp(a[2],b[2],fraction));
        if(row<rows-1&&col<columns-1){const i=row*columns+col;const faces=[i,i+1,i+columns,i+1,i+columns+1,i+columns];if(sign*direction<0)for(let j=0;j<faces.length;j+=3)[faces[j+1],faces[j+2]]=[faces[j+2],faces[j+1]];indices.push(...faces);}
      }
      const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();
      return mesh(geometry,material,`${name}-${sign}`);
    }
    ribbon(fit.width,fit.offsets.housing,m.lampHousing,`${name}-housing`);
    if(fit.closed){
      // A closed aperture needs a backing bowl and full lens, not only a rim strip.
      const boundary=[];
      for(let row=0;row<rows;row++){
        const p=points[row*columns+Math.floor(columns/2)];
        boundary.push(new THREE.Vector3(fit.capX[String(sign)][row],p[1],p[2]));
      }
      const center=boundary.reduce((a,p)=>a.add(p),new THREE.Vector3()).multiplyScalar(1/rows);
      for(const [suffix,offset,material] of [['bowl',-.008,m.lampHousing],['cover',.005,isRear?m.rearLens:m.frontLens]]){
        const vertices=[center.x+offset*direction,center.y,center.z],indices=[];
        boundary.forEach(p=>vertices.push(p.x+offset*direction,p.y,p.z));
        for(let i=1;i<rows;i++)indices.push(0,i,i+1);
        const geometry=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();
        const surface=material.clone();surface.side=THREE.DoubleSide;
        mesh(geometry,surface,`${name}-${suffix}-${sign}`);
      }
    }
    if(fit.capX){
      const positions=[],indices=[];
      for(let row=0;row<rows;row++)for(const col of [0,columns-1]){
        const p=points[row*columns+col],x=fit.capX[String(sign)][row]+fit.offsets.housing*direction;
        positions.push(...p,x,p[1],p[2]);
        if(row<rows-1){const i=row*4+(col===0?0:2);indices.push(i,i+1,i+4,i+1,i+5,i+4);}
      }
      const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();
      const material=m.lampHousing.clone();material.side=THREE.DoubleSide;mesh(geometry,material,`${name}-housing-walls-${sign}`);
    }
    ribbon(fit.lensWidth,fit.offsets.lens,isRear?m.rearLens:m.frontLens,`${name}-lens`).renderOrder=3;
    // A small volumetric diffuser remains visible around the return bend;
    // a one-sided decal disappears when the recess wall turns edge-on.
    const core=[];
    for(let row=0;row<rows;row++){const p=points[row*columns+Math.floor(columns/2)];core.push(new THREE.Vector3((fit.capX?.[String(sign)]?.[row]??p[0])+fit.offsets.led*direction,p[1],p[2]));}
    const geometry=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(core,false,'centripetal'),rows*2,fit.ledWidth/2,10,false);
    mesh(geometry,isRear?m.taillight:m.headlight,`${name}-led-${sign}`);
  }
  function strip(points,sign,name){
    const rear=name==='rear',out=new THREE.Vector3(rear?1:-.5,rear?.12:.85,sign*.12).normalize();
    const p=points.map(([x,y,z])=>new THREE.Vector3(x,y,z*sign));
    path(p.map(v=>v.clone().addScaledVector(out,.012)),rear?.030:.026,m.lampHousing,`${name}-housing-${sign}`);
    path(p.map(v=>v.clone().addScaledVector(out,.034)),rear?.014:.010,rear?m.taillight:m.headlight,`${name}-led-${sign}`);
    const lens=path(p.map(v=>v.clone().addScaledVector(out,.036)),rear?.022:.019,rear?m.rearLens:m.frontLens,`${name}-lens-${sign}`);
    lens.renderOrder=3;
  }
  for(const sign of [-1,1]){
    let enclosed;
    if(profile.lights.headlamp?.type==='enclosed'){
      enclosed=createEnclosedHeadlamp(profile,m,sign);root.add(enclosed.root);
      for(const [i,spec] of (profile.lights.headlamp.additional??[]).entries())root.add(createEnclosedHeadlamp(profile,m,sign,spec,`-aux-${i}`).root);
    }
    for(const name of ['front','frontBranch','rear']){
      if(enclosed&&name!=='rear')continue;
      if(name==='frontBranch'&&(profile.lights.frontRecess||profile.lights.frontFits))continue;
      const fits=profile.lights[name+'Fits'];
      if(fits){fits.forEach((fit,i)=>fittedLamp(sign,fit,`${name}-${i}`,name));continue;}
      const fit=profile.lights[name+'Recess'];if(fit)fittedLamp(sign,fit,name);else if(profile.lights[name])strip(profile.lights[name],sign,name);
    }
    const p=new THREE.Vector3(...(profile.lights.projector??profile.lights.front[1]));p.z*=sign;
    if(!profile.lights.projector)p.add(new THREE.Vector3(-.032,.045,-sign*.055));
    const outward=new THREE.Vector3(-.96,.10,sign*.22).normalize();
    function optic(radius,depth,material,name,offset){
      const scale=profile.lights.projectorScale??1;
      const o=mesh(new THREE.CylinderGeometry(radius*scale,radius*scale,depth*scale,32),material,`${name}-${sign}`);
      o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),outward);o.position.copy(p).addScaledVector(outward,offset*scale);return o;
    }
    if(!enclosed){
      optic(.046,.044,m.lampHousing,'projector-housing',0);
      optic(.031,.006,m.rim,'projector-reflector',.024);
      optic(.023,.008,m.projector,'projector-core',.031);
      optic(.035,.010,m.frontLens,'projector-lens',.037).renderOrder=3;
    }
    const target=new THREE.Object3D();target.name=`headlight-target-${sign}`;target.position.set(p.x-14,-profile.body.lift,sign*1.3);root.add(target);
    const beam=new THREE.SpotLight(0xe5f1ff,0,35,.32,.65,2);beam.name=`headlight-beam-${sign}`;
    beam.position.copy(enclosed?.beamOrigin??p.clone().addScaledVector(outward,.075));beam.target=target;root.add(beam);beams.push(beam);
    const rearMid=profile.lights.rear[Math.floor(profile.lights.rear.length/2)];
    const tail=new THREE.PointLight(0xff1018,0,2.8,2);tail.name=`tail-spill-${sign}`;
    const spill=profile.lights.tailSpill??[rearMid[0]+.10,rearMid[1]-.10,rearMid[2]];
    tail.position.set(spill[0],spill[1],sign*spill[2]);
    root.add(tail);rearSpill.push(tail);
    const rearX=profile.lights.rear.at(-1)[0]+.043,rearY=profile.lights.rear.at(-1)[1]-.06;
    const reversePoints=(profile.lights.reverse??[[rearX,rearY,.32],[rearX,rearY,.47]]).map(([x,y,z])=>new THREE.Vector3(x,y,z*sign));
    const reversing=new THREE.PointLight(0xe5efff,0,4,2);reversing.name=`reverse-spill-${sign}`;reversing.position.copy(reversePoints[0]).lerp(reversePoints.at(-1),.5).add(new THREE.Vector3(.05,0,0));root.add(reversing);reverseSpill.push(reversing);
    path(reversePoints,.022,m.lampHousing,`reverse-housing-${sign}`);
    path(reversePoints.map(v=>v.clone().add(new THREE.Vector3(.017,0,0))),.010,m.reverseLight,`reverse-led-${sign}`);
  }
  const centerX=profile.lights.rear.at(-1)[0]+.035,centerY=profile.lights.rear.at(-1)[1]+.07;
  const stop=(profile.lights.centerStop??[[centerX,centerY,-.19],[centerX,centerY,.19]]).map(p=>new THREE.Vector3(...p));
  path(stop,.018,m.lampHousing,'center-stop-housing');
  path(stop.map(v=>v.clone().add(new THREE.Vector3(.018,0,0))),.009,m.brakeLight,'center-stop-led');
  let state={mode:'low',brake:0,reverse:false};
  function update(input={}){
    const mode=['off','running','low','high'].includes(input.mode)?input.mode:state.mode;
    const brake=Number.isFinite(input.brake)?THREE.MathUtils.clamp(input.brake,0,1):state.brake;
    const reverse=typeof input.reverse==='boolean'?input.reverse:state.reverse;
    state={mode,brake,reverse};
    const running=mode!=='off',on=mode==='low'||mode==='high';
    m.headlight.emissiveIntensity=running?2.8:0;
    m.projector.emissiveIntensity=on?(mode==='high'?22:14):0;
    m.highProjector.emissiveIntensity=mode==='high'?18:0;
    m.taillight.emissiveIntensity=(running?1.4:0)+brake*6.6;
    m.brakeLight.emissiveIntensity=brake*10;
    m.reverseLight.emissiveIntensity=reverse?6:0;
    for(const beam of beams){beam.intensity=on?(mode==='high'?1500:650):0;beam.angle=mode==='high'?.23:.32;beam.visible=on;}
    for(const spill of rearSpill){spill.intensity=((running?.04:0)+brake*.45)*((profile.lights.rearRecess||profile.lights.rearFits)?.35:1);spill.visible=spill.intensity>0;}
    for(const spill of reverseSpill){spill.intensity=reverse?.55:0;spill.visible=reverse;}
    return {...state};
  }
  update();
  return {root,update,get state(){return {...state};}};
}
