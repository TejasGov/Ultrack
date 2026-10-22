import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

function part(geometry,material,name){const mesh=new THREE.Mesh(geometry,material);mesh.name=name;mesh.castShadow=mesh.receiveShadow=true;return mesh;}
function merged(geometries,material,name){const flat=geometries.map(g=>g.index?g.toNonIndexed():g);const geometry=mergeGeometries(flat);if(!geometry)throw Error(`Could not assemble ${name}.`);const mesh=part(geometry,material,name);new Set([...geometries,...flat]).forEach(g=>g.dispose());return mesh;}
function cylinder(radius,depth,segments=64){return new THREE.CylinderGeometry(radius,radius,depth,segments).rotateX(Math.PI/2);}
function link(a,b,width,depth){
  const from=new THREE.Vector3(...a),to=new THREE.Vector3(...b),delta=to.clone().sub(from);
  const geometry=new RoundedBoxGeometry(width,delta.length(),depth,2,Math.min(width,depth)*.25);
  geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize()));geometry.translate(...from.add(to).multiplyScalar(.5).toArray());return geometry;
}
const polar=(r,a,z)=>[Math.cos(a)*r,Math.sin(a)*r,z];

// Reusable wheel resource: local axle is +Z; tire ground radius is exact.
export function createWheelResource({radius:R,width:W,style='split'},m){
  const root=new THREE.Group();root.name='wheel-resource';
  const profile=[[.70,-.50],[.86,-.52],[.95,-.40],[.994,-.26],[1,-.13],[1,.13],[.994,.26],[.95,.40],[.86,.52],[.70,.50],[.70,-.50]].map(([r,y])=>new THREE.Vector2(r*R,y*W));
  root.add(part(new THREE.LatheGeometry(profile,96).rotateX(Math.PI/2),m.rubber,'tire'));
  const rubberRings=[];
  for(const side of [-1,1])for(const r of [.78,.86])rubberRings.push(new THREE.TorusGeometry(R*r,.0016,6,96).translate(0,0,side*W*.515));
  root.add(merged(rubberRings,m.rubber,'sidewall-rings'));
  const grooves=[];
  for(const y of [-.20,0,.20])grooves.push(new THREE.TorusGeometry(R*.998,.0019,6,96).translate(0,0,y*W));
  root.add(merged(grooves,m.barrel,'tread-channels'));
  root.add(part(new THREE.CylinderGeometry(R*.723,R*.723,W*.84,64,1,true).rotateX(Math.PI/2),m.barrel,'rim-barrel'));
  const alloy=[];
  for(const side of [-1,1]){
    const face=side*W*.44;
    alloy.push(new THREE.TorusGeometry(R*.727,.010,10,80).translate(0,0,face));
    alloy.push(new THREE.TorusGeometry(R*.678,.005,8,80).translate(0,0,face-side*.008));
    alloy.push(cylinder(R*.14,.03,32).translate(0,0,face));
    const count=style==='turbine'?12:10;
    for(let i=0;i<count;i++){
      const angle=i/count*Math.PI*2;
      if(style==='split'){
        alloy.push(link(polar(R*.13,angle,face),polar(R*.40,angle,face-side*.025),.015,.026));
        for(const fork of [-1,1])alloy.push(link(polar(R*.40,angle,face-side*.025),polar(R*.69,angle+fork*.065,face-side*.01),.012,.025));
      }else alloy.push(link(polar(R*.15,angle,face),polar(R*.70,angle+.20,face-side*.014),.023,.027));
    }
    for(let i=0;i<5;i++)alloy.push(cylinder(.009,.008,10).translate(...polar(R*.095,i/5*Math.PI*2,face+side*.022)));
  }
  root.add(merged(alloy,m.rim,'forged-rim'));
  const discs=[];for(const side of [-1,1])discs.push(cylinder(R*.585,.014).translate(0,0,side*W*.26));
  root.add(merged(discs,m.rotor,'brake-rotor'));
  const drill=[];
  for(const side of [-1,1])for(const ring of [.40,.50])for(let i=0;i<22;i++)drill.push(new THREE.CircleGeometry(.004,6).rotateY(side<0?Math.PI:0).translate(...polar(R*ring,i/22*Math.PI*2+ring,side*(W*.26+.0075))));
  root.add(merged(drill,m.barrel,'rotor-drill-marks'));
  const calipers=[];for(const side of [-1,1])calipers.push(new RoundedBoxGeometry(.063,R*.43,.056,2,.009).translate(R*.43,0,side*W*.28));
  root.add(merged(calipers,m.caliper,'brake-calipers'));
  return root;
}

export function createWheelSet(profile,m,style){
  const root=new THREE.Group();root.name='wheels';const wheels=[];
  for(const [axle,spec] of Object.entries(profile.wheels)){
    const resource=createWheelResource({...spec,style},m);
    for(const [side,sign] of [['L',1],['R',-1]]){
      const pivot=new THREE.Group();pivot.name=`wheel_${axle==='front'?'F':'R'}${side}`;pivot.position.set(spec.x,spec.radius,sign*spec.track/2);
      const spin=resource.clone();spin.name=`${pivot.name}_spin`;const calipers=spin.getObjectByName('brake-calipers');spin.remove(calipers);calipers.name=`${pivot.name}_calipers`;pivot.add(spin,calipers);root.add(pivot);wheels.push({pivot,spin,axle,side,spec});
    }
  }
  return {root,wheels};
}

export function createGlass(profile,m){
  const root=new THREE.Group();root.name='glass';
  function pane(corners,name,bulge=0){
    const fit=profile.glassFits?.[name==='rear-glass'?'rear':name];
    if(fit){
      if(profile.glassFits.sourceSha256!==profile.body.sha256)throw Error('Glazing fit belongs to a different shell.');
      const indices=[];
      for(let r=0;r<fit.rows-1;r++)for(let c=0;c<fit.columns-1;c++){const i=r*fit.columns+c;indices.push(i,i+1,i+fit.columns,i+1,i+fit.columns+1,i+fit.columns);}
      const g=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(fit.points.flat(),3));g.setIndex(indices);g.computeVertexNormals();root.add(part(g,m.glass,name));
      const boundary=[];
      for(let c=0;c<fit.columns;c++)boundary.push(fit.points[c]);
      for(let r=1;r<fit.rows;r++)boundary.push(fit.points[r*fit.columns+fit.columns-1]);
      for(let c=fit.columns-2;c>=0;c--)boundary.push(fit.points[(fit.rows-1)*fit.columns+c]);
      for(let r=fit.rows-2;r>0;r--)boundary.push(fit.points[r*fit.columns]);
      const seal=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(boundary.map(p=>new THREE.Vector3(...p)),true),160,.0045,6,true);root.add(part(seal,m.trim,name+'-seal'));return;
    }
    const positions=[],indices=[],N=12;
    if(corners.length===3){const g=new THREE.BufferGeometry().setFromPoints(corners.map(p=>new THREE.Vector3(...p)));g.setIndex([0,1,2]);g.computeVertexNormals();root.add(part(g,m.glass,name));return;}
    const [a,b,c,d]=corners.map(p=>new THREE.Vector3(...p));
    const normal=b.clone().sub(a).cross(d.clone().sub(a)).normalize();
    for(let v=0;v<=N;v++)for(let u=0;u<=N;u++){
      const s=u/N,t=v/N;const p=a.clone().lerp(b,s).lerp(d.clone().lerp(c,s),t);p.addScaledVector(normal,Math.sin(s*Math.PI)*Math.sin(t*Math.PI)*bulge);
      if(name==='windshield'&&profile.windshieldWrap)p.x-=Math.sin(t*Math.PI)*THREE.MathUtils.lerp(profile.windshieldWrap[0],profile.windshieldWrap[1],s);
      positions.push(...p.toArray());
      if(u<N&&v<N){const i=v*(N+1)+u;indices.push(i,i+1,i+N+1,i+1,i+N+2,i+N+1);}
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();root.add(part(g,m.glass,name));
  }
    pane(profile.glass.windshield,'windshield',profile.glassBulge?.windshield??.018);
    if(!profile.rearWindowLouver)pane(profile.glass.rear,'rear-glass',.012);
  for(const sign of [-1,1])for(const name of ['side','quarter'])pane(profile.glass[name].map(([x,y,z])=>[x,y,z*sign]),`${name}-${sign}`,name==='side'?.005:0);
  if(profile.rearWindowLouver){
    const fit=profile.rearWindowLouver;
    if(fit.sourceSha256!==profile.body.sha256)throw Error('Rear window louver belongs to a different shell.');
    const grille=new THREE.Group();grille.name='rear-window-rubber-louver';
    const positions=fit.points.flat(),indices=[];
    for(let r=0;r<fit.rows-1;r++)for(let c=0;c<fit.columns-1;c++){const i=r*fit.columns+c;indices.push(i,i+1,i+fit.columns,i+1,i+fit.columns+1,i+fit.columns);}
    const backing=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(positions,3));backing.setIndex(indices);backing.computeVertexNormals();
    const rubber=m.rubber.clone();rubber.side=THREE.DoubleSide;rubber.color.set('#111519');
    grille.add(part(backing,rubber,'louver-dark-backing'));
    for(let r=0;r<fit.rows-1;r+=2){
      const verts=[],faces=[];
      for(let c=0;c<fit.columns;c++){
        const a=new THREE.Vector3(...fit.points[r*fit.columns+c]),b=new THREE.Vector3(...fit.points[(r+1)*fit.columns+c]);
        const edge=a.clone().lerp(b,.82);a.x+=.018;edge.x+=.032;verts.push(...a.toArray(),...edge.toArray());
        if(c<fit.columns-1){const i=c*2;faces.push(i,i+1,i+2,i+1,i+3,i+2);}
      }
      const g=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(verts,3));g.setIndex(faces);g.computeVertexNormals();grille.add(part(g,rubber,'rubber-louver-slat-'+r/2));
    }
    root.add(grille);
  }
  root.position.y=profile.body.lift;root.children.forEach(p=>{p.renderOrder=2;p.castShadow=false;});
  const interior=part(new RoundedBoxGeometry(1.45,.30,1.02,2,.12),m.trim,'cabin-dark-insert');interior.position.set(.05,.50,0);root.add(interior);
  return root;
}

export function createMirrors(profile,m){
  if(profile.mirrors.sourceSha256&&profile.mirrors.sourceSha256!==profile.body.sha256)throw Error('Mirror mounting fit belongs to a different shell.');
  const root=new THREE.Group();root.name='mirrors';root.position.y=profile.body.lift;
  for(const sign of [-1,1]){
    const flip=p=>[p[0],p[1],p[2]*sign],center=flip(profile.mirrors.center);
    const mount=profile.mirrors.mounts?.[String(sign)]??flip(profile.mirrors.mount),end=flip(profile.mirrors.stalkEnd);
    root.add(part(link(mount,end,profile.mirrors.style==='heritage-bullet'?.018:profile.mirrors.style==='aero-blade'?.027:.032,.028),m.trim,`mirror-stalk-${sign}`));
    root.add(part(link(end,center,profile.mirrors.style==='heritage-bullet'?.018:profile.mirrors.style==='aero-blade'?.027:.032,.028),m.trim,`mirror-housing-neck-${sign}`));
    const foot=part(new THREE.SphereGeometry(1,24,12).scale(.044,.033,.030),m.trim,`mirror-mount-foot-${sign}`);foot.position.fromArray(mount);root.add(foot);
    const premium=profile.mirrors.style;
    if(['heritage-bullet','aero-blade'].includes(premium)){
      const heritage=premium==='heritage-bullet';
      const housing=part(heritage?new THREE.SphereGeometry(1,40,24).scale(.105,.043,.055):new THREE.SphereGeometry(1,40,24).scale(.090,.032,.126),heritage?m.reflector:m.trim,`mirror-housing-${sign}`);housing.position.fromArray(center);root.add(housing);
      if(!heritage){const cap=part(new THREE.SphereGeometry(1,40,20,0,Math.PI*2,0,Math.PI*.5).scale(.091,.033,.127),m.mirrorPaint,`mirror-paint-cap-${sign}`);cap.position.set(center[0],center[1],center[2]);root.add(cap);}
      const plate=part(heritage?new THREE.CircleGeometry(1,40).rotateY(Math.PI/2).scale(1,.034,.046):new THREE.CircleGeometry(1,40).rotateY(Math.PI/2).scale(1,.023,.096),m.mirrorGlass,`mirror-face-${sign}`);plate.position.set(center[0]+(heritage?.097:.083),center[1],center[2]);root.add(plate);
      continue;
    }
    const classic=profile.mirrors.style==='classic';
      const housing=part(new THREE.SphereGeometry(1,32,16).scale(...(classic?[.065,.075,.075]:[.145,.060,.093])),classic?m.reflector:m.trim,`mirror-housing-${sign}`);housing.position.fromArray(center);root.add(housing);
    const cap=part(new THREE.SphereGeometry(1,32,12,0,Math.PI*2,0,Math.PI*.5).scale(...(classic?[.066,.076,.076]:[.146,.061,.094])),classic?m.reflector:m.mirrorPaint,`mirror-paint-cap-${sign}`);cap.position.fromArray(center);root.add(cap);
    const plate=part(new THREE.CircleGeometry(1,32).rotateY(Math.PI/2).scale(1,classic?.060:.043,classic?.060:.071),m.mirrorGlass,`mirror-face-${sign}`);plate.position.set(center[0]+(classic?.062:.134),center[1],center[2]);root.add(plate);
  }
  return root;
}

export function disposeParts(root){
  const geometries=new Set();root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);});geometries.forEach(g=>g.dispose());
}
