// Tail-light trails: removed. A lamp leaves no streak at a normal shutter; the old additive ribbons (0.22 s of
// world-space history behind each lamp, up to ~13 m long at speed, brightened by braking) were a detached red line
// following the car. The only smear a lamp gets now is the camera's own speed blur, which is attached to the car.
// Kept as an inert stub so main.js's wiring (newTrails, hide lists) needs no change.
import * as THREE from 'three';

export class Trails {
  constructor() { this.mesh = new THREE.Mesh(new THREE.BufferGeometry()); this.mesh.visible = false; this.mesh.name = 'tail_trails'; }
  attach() {}
  update() {}
}
