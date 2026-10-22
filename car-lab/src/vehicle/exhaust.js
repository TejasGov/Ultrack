import * as THREE from 'three';

// Sockets use local +Z as the plume direction. Parent vehicle transforms carry
// the tips, sockets and effects together when driving integration is added.
export function createExhaust(profile){
  const root=new THREE.Group();root.name='exhaust-system';root.position.y=profile.body.lift;
  const spec=profile.exhaust,sockets=[],effects=[];
  if(spec&&spec.sourceSha256!==profile.body.sha256)throw Error('Exhaust fit belongs to a different body.');
  const steel=new THREE.MeshStandardMaterial({color:'#abb4bc',metalness:.96,roughness:.23,side:THREE.DoubleSide});
  const soot=new THREE.MeshStandardMaterial({color:'#07090b',roughness:.96,side:THREE.DoubleSide});
  for(const tip of spec?.tips??[]){
    const mouth=new THREE.Group();mouth.name='exhaust-tip-'+tip.id;mouth.position.fromArray(tip.position);mouth.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),new THREE.Vector3(...tip.direction).normalize());root.add(mouth);
    const r=tip.radius,inner=r*.81;
    const section=[[r*.9,-tip.length],[r,-.014],[r,0],[inner,0],[inner,-tip.length*.85],[r*.9,-tip.length]].map(([x,y])=>new THREE.Vector2(x,y));
    const pipe=new THREE.Mesh(new THREE.LatheGeometry(section,48).rotateX(Math.PI/2),steel);pipe.name='hollow-stainless-pipe-'+tip.id;
    // Lathe +Y maps to +Z; the longitudinal profile extends inward from z=0.
    mouth.add(pipe);
    const bore=new THREE.Mesh(new THREE.CircleGeometry(inner,48),soot);bore.name='soot-dark-bore-'+tip.id;bore.position.z=-tip.length*.8;mouth.add(bore);
    const socket=new THREE.Group();socket.name='nitro-exhaust-'+tip.id;socket.position.z=.005;socket.userData={effect:'nitro',directionAxis:'+Z',outletRadius:inner};mouth.add(socket);sockets.push(socket);
    const plume=new THREE.Group();plume.name='nitro-plume-'+tip.id;socket.add(plume);
    for(const [name,radius,length,color,opacity] of [['outer',inner*.96,spec.nitro.length,spec.nitro.color,.26],['core',inner*.48,spec.nitro.length*.66,spec.nitro.coreColor,.75]]){
      const material=new THREE.MeshBasicMaterial({color:new THREE.Color(color).multiplyScalar(2),transparent:true,opacity,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide});
      const flame=new THREE.Mesh(new THREE.ConeGeometry(radius,length,24,1,true).rotateX(Math.PI/2),material);flame.position.z=length/2;flame.name='nitro-'+name+'-'+tip.id;flame.renderOrder=3;plume.add(flame);
    }
    const spill=new THREE.PointLight(spec.nitro.color,0,1.2,2);spill.position.z=.12;plume.add(spill);effects.push({plume,spill});
  }
  function update({boost=0,time=0}={}){
    boost=Number.isFinite(boost)?THREE.MathUtils.clamp(boost,0,1):0;time=Number.isFinite(time)?time:0;
    effects.forEach(({plume,spill},i)=>{plume.visible=boost>0;plume.scale.setScalar(.5+.5*boost);plume.scale.z=boost*(.92+.06*Math.sin(time*59+i*1.7)+.025*Math.sin(time*107));spill.intensity=boost*.6;});
  }
  update();return {root,sockets,update};
}
