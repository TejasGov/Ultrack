// Cheongsan Park's runtime effect, loaded through tracks.js `venue`: the wind farm turns. Slowly, one turn in about four seconds, each rotor at its own phase and pace; nothing blinks.
// Each rotor hangs from a pivot at its true hub (track.json rotorHubs): the web pack re-centres mesh origins, so turning the node itself would make the blades wobble about the wrong point.
import * as THREE from 'three';
const q = new THREE.Quaternion(), wq = new THREE.Quaternion();
export async function create({ root, track }) {
  const rotors = []; root.updateMatrixWorld(true);
  root.traverse((o) => {
    const id = /^turbine_([A-E])_rotor/.exec(o.name)?.[1], hub = id && track?.rotorHubs?.[id];
    if (!hub || o.userData.rotorSeen) return;
    o.userData.rotorSeen = true;
    rotors.push({ o, hub, rate: 1.45 + 0.28 * Math.sin(rotors.length * 2.4), phase: rotors.length * 1.7 });
  });
  for (const r of rotors) {
    const pivot = new THREE.Group(); pivot.position.fromArray(r.hub); root.add(pivot); root.worldToLocal(pivot.position); pivot.updateMatrixWorld(true); pivot.attach(r.o);
    r.o.getWorldQuaternion(wq); r.axis = new THREE.Vector3(0, 0, 1).applyQuaternion(wq).normalize(); r.pivot = pivot;     // the hub axis: Blender's local Y comes out as glTF's local -Z; the pack only moves and scales, never turns
  }
  return {
    update(t) { for (const r of rotors) { r.pivot.quaternion.setFromAxisAngle(r.axis, r.phase + t * r.rate); } },
    dispose() { rotors.length = 0; },
  };
}
