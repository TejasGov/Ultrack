import {createBuildingLod} from './scenery-buildings.js';
import {createYachtLod} from './scenery-yachts.js';

// Opt-in comparison. Original geometry stays resident so switching does not fetch assets or alter physics.
export class SceneryExperiment {
  constructor(root, {panel = false, params, resize, renderer} = {}) {
    const started=performance.now();
    this.controllers = {buildings:createBuildingLod(root,{renderer}), yachts:createYachtLod(root,{renderer})};
    this.ready=Promise.all(Object.values(this.controllers).map(c=>c.ready)).then(()=>{this.preparationMs=performance.now()-started;return this;});
    this.enabled = {buildings:true, yachts:true};
    this.params=params; this.resize=resize;
    this.controllers.buildings.setEnabled(true); this.controllers.yachts.setEnabled(true);
    if(panel)this.createPanel();
  }
  setEnabled(enabled) {
    for(const key of Object.keys(this.controllers))this.setPart(key,enabled);
  }
  setPart(key, enabled) {
    if(!this.controllers[key])throw Error(`Unknown scenery group: ${key}`);
    this.enabled[key]=!!enabled;this.controllers[key].setEnabled(!!enabled);
    if(this.inputs?.[key])this.inputs[key].checked=!!enabled;
    if(this.camera)this.update(this.camera);
  }
  update(camera) {this.camera=camera;for(const c of Object.values(this.controllers))c.update(camera);}
  getStats() {return Object.fromEntries(Object.entries(this.controllers).map(([k,c])=>[k,c.getStats()]));}
  createPanel() {
    const box=this.panel=document.createElement('aside');
    box.id='scenery-experiment';
    box.hidden=true;
    box.style.cssText='position:fixed;right:14px;top:250px;z-index:12000;width:270px;padding:14px;color:#eaf3f5;background:#091014ed;border:1px solid #597176;border-radius:8px;font:12px/1.5 system-ui;box-shadow:0 4px 24px #0008';
    box.innerHTML='<strong style="letter-spacing:.1em">SCENERY · A/B TEST</strong><div style="color:#a8bdc1;margin:5px 0 10px">Close objects keep their original detail.</div><div data-options></div><div style="display:flex;gap:7px;margin:10px 0"><button data-mode="original">Original</button><button data-mode="lod">Adaptive LOD</button></div><label style="display:block"><input type="checkbox" data-lock> Lock resolution for comparison</label><output style="display:block;white-space:pre-line;margin-top:10px;font:11px/1.6 monospace"></output><small style="display:block;color:#a8bdc1;margin-top:8px">Counts cover every render pass. FPS also depends on cars, lighting and effects. Toggle at the same location.</small>';
    this.inputs={};
    for(const key of Object.keys(this.controllers)){
      const label=document.createElement('label');label.style.cssText='display:block;margin:4px 0';
      const input=this.inputs[key]=document.createElement('input');input.type='checkbox';input.checked=true;
      input.addEventListener('change',()=>{this.setPart(key,input.checked);input.blur();});
      label.append(input,` ${key==='buildings'?'Building':'Yacht'} LOD`);box.querySelector('[data-options]').append(label);
    }
    for(const b of box.querySelectorAll('button')){
      b.style.cssText='border:1px solid #67838a;background:#193038;color:#fff;padding:6px 10px;cursor:pointer;border-radius:3px';
      b.addEventListener('click',()=>{this.setEnabled(b.dataset.mode==='lod');b.blur();});
    }
    this.lock=box.querySelector('[data-lock]');
    this.previousDynamic=this.params.dynamicRes;
    this.lock.checked=true;this.params.dynamicRes=false;
    this.lock.addEventListener('change',()=>{this.params.dynamicRes=this.lock.checked?false:this.previousDynamic;this.lock.blur();});
    // Control focus should not accelerate the car or leak Enter/Space into the menu underneath.
    box.addEventListener('keydown',e=>e.stopPropagation());box.addEventListener('keyup',e=>e.stopPropagation());
    document.body.append(box);this.output=box.querySelector('output');
  }
  sample({fps,gpuMs,calls,triangles,scale}, now=performance.now()) {
    if(!this.output||now-(this.lastSample??-Infinity)<500)return;
    this.lastSample=now;
    const stats=this.getStats();
    const states=Object.entries(stats).map(([k,v])=>`${k}: ${this.enabled[k]?'adaptive':'original'} · ${v.active??v.activeProxies??0} LOD`);
    const yacht=stats.yachts;
    const saving=yacht.baselineTriangles?`\nYachts (main view):\n${(yacht.baselineTriangles/1000).toFixed(1)}k → ${(yacht.submittedTriangles/1000).toFixed(1)}k tris · ${yacht.baselineDraws} → ${yacht.submittedDraws} draws`:'';
    this.output.textContent=`${fps.toFixed(0)} FPS${Number.isFinite(gpuMs)?` · GPU ${gpuMs.toFixed(1)} ms`:''}\n${calls} draws · ${(triangles/1000).toFixed(1)}k triangles\nRender scale ${scale.toFixed(2)}\n${states.join('\n')}${saving}`;
  }
  dispose() {
    for(const c of Object.values(this.controllers))c.dispose();
    if(this.panel)this.params.dynamicRes=this.previousDynamic;
    this.panel?.remove();
  }
}
