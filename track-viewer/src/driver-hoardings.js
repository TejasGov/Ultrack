import * as THREE from 'three';
import TEAMS from '../../assets/teams/teams.json';

export function racingPosters(keys){
  return [...new Set(keys)].map(key=>{
    const team=TEAMS.teams.find(t=>t.cars.some(c=>c.key===key)),car=team?.cars.find(c=>c.key===key);
    if(!car)throw Error('Unknown driver hoarding: '+key);
    const slug=car.driver.name.toLowerCase().replace(/[^a-z0-9]+/g,'-');
    return {key,team:team.id,driver:car.driver.name,url:`/assets/drivers/${slug}/poster-hoarding.webp`};
  });
}
export function hoardingPose(track,index,count){
  const points=track.centerline,n=points.length,i=Math.floor((.035+index/count*.91)*n)%n;
  const p=points[i],a=points[(i+n-2)%n],b=points[(i+2)%n];
  const dx=b[0]-a[0],dz=b[2]-a[2],length=Math.hypot(dx,dz),side=index%2?1:-1;
  const offset=(track.halfWidth[i]??7)+5;
  const position=new THREE.Vector3(p[0]+dz/length*offset*side,p[1]+4.5,p[2]-dx/length*offset*side);
  return {position,target:new THREE.Vector3(p[0]-dx/length*25,p[1]+2,p[2]-dz/length*25),index:i};
}

export class DriverHoardings{
  constructor(scene){
    this.root=new THREE.Group();this.root.name='race_driver_hoardings';scene.add(this.root);
    this.loader=new THREE.TextureLoader();this.textures=new Map();this.revision=0;this.entries=[];
    this.plane=new THREE.PlaneGeometry(8,4.5);this.frame=new THREE.BoxGeometry(8.3,4.8,.22);
    this.post=new THREE.BoxGeometry(.18,3,.18);
    this.metal=new THREE.MeshStandardMaterial({color:0x1b2028,roughness:.65});
  }
  clear(){this.revision++;this.entries=[];this.root.clear();for(const m of this.materials??[])m.dispose();this.materials=[];}
  async set(keys,track){
    this.clear();const revision=this.revision,entries=racingPosters(keys);
    const wanted=new Set(entries.map(entry=>entry.url));
    for(const [url,promise] of this.textures)if(!wanted.has(url)){this.textures.delete(url);promise.then(texture=>texture?.dispose());}
    const textures=await Promise.all(entries.map(e=>{
      if(!this.textures.has(e.url))this.textures.set(e.url,this.loader.loadAsync(e.url).then(texture=>{texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;return texture;}).catch(error=>{console.warn('Driver hoarding:',e.key,error);return null;}));// the null stays cached: a missing poster warns once, not on every race start
      return this.textures.get(e.url);
    }));
    if(revision!==this.revision)return;
    const maps=textures.filter(Boolean);this.entries=entries.filter((entry,i)=>textures[i]);// no poster, no board: a flat team-colour slab reads as a placeholder prop
    this.entries.forEach((entry,i)=>{
      const pose=hoardingPose(track,i,this.entries.length),board=new THREE.Group();board.name=`driver_hoarding_${entry.key}`;
      board.position.copy(pose.position);pose.target.y=pose.position.y;board.lookAt(pose.target);
      const frame=new THREE.Mesh(this.frame,this.metal);frame.position.z=-.15;board.add(frame);
      const material=new THREE.MeshBasicMaterial({map:maps[i],toneMapped:false});
      this.materials.push(material);
      const image=new THREE.Mesh(this.plane,material);image.position.z=.015;board.add(image);
      for(const x of [-3.3,3.3]){const post=new THREE.Mesh(this.post,this.metal);post.position.set(x,-3.75,-.16);board.add(post);}
      this.root.add(board);
    });
  }
}
