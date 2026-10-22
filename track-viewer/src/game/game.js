// Ultrack V1: the game around the viewer. States: title -> menu -> setup / garage / settings -> session (countdown,
// racing, pause) -> results. Owns the screens, the session, the player's settings and profile (store.js), audio and
// commentary, and tells main.js which camera to run (flythrough behind menus, an orbit in the garage, the chase cam
// on track). main.js calls update(dt) every frame.
import * as THREE from 'three';
import './ui.css';
import TEAMS from '../../../assets/teams/teams.json';
import { store, ASSISTS, WEATHER, BLUR, fmtTime } from './store.js';
import { GameAudio, Gearbox } from './audio.js';
import { EV } from './ev.js';
import { Session, MODES } from './session.js';
import { InputDebug } from './input-debug.js';
import { Hud } from './hud.js';
import { Nav, setNav, h, CreditsScreen, RecordsScreen, TitleScreen, MenuScreen, SetupScreen, GarageScreen, SettingsScreen, PauseScreen, ResultsScreen, carName } from './ui.js';
import { PhysicsWorld } from '../physics/world.js';
import { handling } from '../physics/handling.js';
import { setWeather } from '../physics/weather.js';
import { KEYS, paintCar, defaultPaint } from '../cars.js';
import { nextView, VIEWS } from '../camera.js';
import { rewardFor } from './economy.js';
import { applyUpgrades } from './carinfo.js';
import { canSelectCar, carProgression } from './progression.js';
import { RaceLoading } from './race-loading.js';

export class Game {
  /** ctx: { params, camera, controls, track(), device, applyAll, applyQuality, setLook, resize, newTrails, collisionUrl } */
  constructor(ctx) {
    this.ctx = ctx; this.audio = new GameAudio(); this.loaded = false; this.state = 'title';
    this.venueReady=new Promise((resolve,reject)=>{this.resolveVenue=resolve;this.rejectVenue=reject;});this.venueReady.catch(()=>{});
    this.ctx.params.look=store.settings.look; // Fetch the saved sky once, rather than dusk then the chosen look.
    if(!KEYS.includes(store.data.car)){store.data.car='av12';store.save();}
    this.root = h('div', { id: 'ui' }); document.body.append(this.root);
    this.raceLoading = new RaceLoading(this.root);
    if(new URLSearchParams(location.search).get('dev')==='1'||new URLSearchParams(location.search).has('inputDebug'))this.inputDebug=new InputDebug(this.root);
    this.nav = new Nav(this); setNav(this.nav);
    this.screens = {
      credits: CreditsScreen(this), records: RecordsScreen(this), title: TitleScreen(this), menu: MenuScreen(this), setup: SetupScreen(this), garage: GarageScreen(this),
      settings: SettingsScreen(this), pause: PauseScreen(this), results: ResultsScreen(this),
    };
    for (const s of Object.values(this.screens)) this.root.append(s.el);
    this.show('title');
    addEventListener('keydown', (e) => this.key(e));
    this.cameraFor('menu');
    addEventListener('blur',()=>this.pause());
    document.addEventListener('visibilitychange',()=>{if(document.hidden)this.pause();});
  }

  // ---------------------------------------------------------------------------------------------- boot
  /** the cars are in: paint them from the profile and put the player's car on the grid */
  attach(field) {
    this.field = field;
    // the first applySettings ran before the field existed: give the exhaust/spray its weather now
    if (field.fx) field.fx.damp = (WEATHER[store.settings.weather] ?? WEATHER.damp).wet;
    applyUpgrades((k) => store.levels(k));
    this.hud = new Hud(this.root, this.ctx.track());
    for (const c of field.all) paintCar(c, store.paintOf(c.key) ?? {});
    field.onPop = (c) => { if (c.hero && this.session) this.audio.pop(); };
    this.lineup();
    this.loaded = true;this.resolveVenue(field);
    this.preloadRace();
    this.screens.title.progress(1); this.screens.title.ready();
  }

  /** the first key or click: audio starts (browsers need a gesture), the menu opens */
  async boot() {
    if(this.booting){this.show('menu');return;}this.booting=true;
    const audio=this.audio.start(); // Still invoked inside the user gesture.
    this.raceLoading.preload();
    this.applySettings();this.show('menu');
    audio.then(()=>{this.audio.preload(store.data.car).catch(()=>{});this.audio.setVolumes(store.settings);this.audio.crowdOn();this.audio.play('race/count-tick.ogg',{gain:.5});}).catch(e=>console.warn('audio:',e));
  }
  get startupCar(){return store.data.car;}
  /** While the menus are up: load and warm everything Start needs (the circuit, the 8 race cars, the collision world, the
   *  engine audio, the race shader variants). Start joins the same promises, so a quick click only waits for the rest.
   *  The menus draw only the showroom, so none of this is visible; it re-runs when the player's car changes. */
  preloadRace() {
    if(new URLSearchParams(location.search).get('preload')==='0')return;
    const keys=this.racersFor(store.data.car,true),id=keys.join();
    if(this.preloading===id)return;this.preloading=id;
    const stop=()=>this.session||this.screenName==='garage'||this.preloading!==id;   // the garage changes the hero under us
    (async()=>{
      await new Promise(r=>setTimeout(r,800));
      await new Promise(r=>globalThis.requestIdleCallback?requestIdleCallback(()=>r(),{timeout:2000}):setTimeout(r,200));
      if(stop())return void(this.preloading===id&&(this.preloading=null));   // retried by lineup() when the menu is back
      this.prepareWorld();
      await Promise.all([this.ensureVehicles(keys,{announce:false}),this.ctx.ensureVenue?.(),this.audio.preload(store.data.car)]);
      if(stop())return void(this.preloading===id&&(this.preloading=null));
      await (this.warmP=this.ctx.warmRace?.(keys,stop));
    })().catch(error=>{console.warn('Race preload:',error);if(this.preloading===id)this.preloading=null;});
  }
  /** the collision world: built in the menu if the preload got there, else now (each session owns one) */
  takeWorld(){const world=this.worldP??PhysicsWorld.create(this.ctx.collisionUrl);this.worldP=null;return world;}
  prepareWorld(){if(!this.worldP){this.worldP=PhysicsWorld.create(this.ctx.collisionUrl);this.worldP.catch(()=>{this.worldP=null;});}}
  async ensureVehicles(keys,{announce=true}={}){
    const request=this.busyRequest=(this.busyRequest??0)+1;
    if(announce)this.setBusy('Preparing '+keys.length+' '+(keys.length===1?'car':'cars')+'…');
    try{
      await this.venueReady;
      const cars=await this.field.ensure(keys);
      for(const c of cars)paintCar(c,store.paintOf(c.key)??{});
      return cars;
    }finally{if(announce&&request===this.busyRequest)this.setBusy('');}
  }
  /** a purchase in the garage: the physics learns the new levels, and a live vehicle (if any) is retuned */
  upgradesChanged(key){
    applyUpgrades((k)=>store.levels(k));
    const v=this.field?.all.find(c=>c.key===key)?.vehicle;
    if(v?.retune)v.retune(handling(key));
  }
  /** add a session payout to the profile and to the running tally the results screen shows */
  pay(info){
    const r=rewardFor(info);if(!r.total)return r;
    store.earn(r.total);
    const t=this.earned??={total:0,lines:[]};t.total+=r.total;
    for(const [label,v] of r.lines){const l=t.lines.find(x=>x[0]===label);if(l)l[1]+=v;else t.lines.push([label,v]);}
    return r;
  }
  setBusy(message){
    this.busyEl??=h('div.asset-loading',{'role':'status','aria-live':'polite'});
    if(!this.busyEl.parentNode)this.root.append(this.busyEl);
    this.busyEl.textContent=message;this.busyEl.hidden=!message;
  }

  // ---------------------------------------------------------------------------------------------- screens
  show(name, arg) {
    this.field?.input?.setEnabled(false);
    const prev = this.screen;
    if (prev && prev !== this.screens[name]) { prev.el.classList.remove('on'); const el = prev.el; setTimeout(() => { if (this.screen?.el !== el) el.classList.add('hidden'); }, 450); prev.onHide?.(); }
    this.screen = this.screens[name]; this.screenName = name;
    const el = this.screen.el; el.classList.remove('hidden'); requestAnimationFrame(() => el.classList.add('on'));
    if (prev === this.screens.menu) this.menuIdx = this.nav.i;
    if (this.screen.nav) this.nav.reset(name === 'menu' ? this.menuIdx ?? 0 : 0);
    this.screen.onShow?.(arg);                   // a screen may set its own starting item (the garage: your car)
    if (name === 'garage') this.cameraFor('garage');
    else if (['menu', 'setup', 'title', 'credits', 'records'].includes(name) || (name === 'settings' && arg !== 'pause')) { if (this.state !== 'menu') { this.state = 'menu'; } this.cameraFor('menu'); if (prev === this.screens.garage) this.lineup(); }
  }

  hideScreens() {
    for (const s of Object.values(this.screens)) { s.el.classList.remove('on'); const el = s.el; setTimeout(() => { if (this.screen?.el !== el) el.classList.add('hidden'); }, 450); }
    this.screen = null; this.screenName = null;
  }

  key(e) {
    if(e.defaultPrevented)return;
    if(this.raceLoading?.active){e.preventDefault();return;}
    if (this.screenName === 'title') { this.screens.title.onKey(); return; }
    if (this.session && !this.screen) {
      if (e.code === 'Escape') { this.pause(); e.preventDefault(); }
      if (e.code === 'KeyC') this.cycleCamera();
    }
    if ((this.screenName === 'settings' || this.screenName === 'garage') && (e.code === 'KeyQ' || e.code === 'KeyE')) this.screens[this.screenName].onKeyTab(e.code === 'KeyQ' ? -1 : 1);
  }

  // ---------------------------------------------------------------------------------------------- cameras
  cameraFor(kind) {
    const { params, controls } = this.ctx;
    if (kind === 'menu') {                       // a slow, high flythrough of the circuit behind the menus
      Object.assign(params, { mode: 'flythrough', speedKmh: 70, camHeight: 3.4, paused: false });
      controls.autoRotate = false;
    } else if (kind === 'garage') {
      const c = this.field?.hero; if (!c) return;
      params.mode = 'orbit';
      const p = c.root.position, f = new THREE.Vector3(Math.cos(c.root.rotation.y), 0, -Math.sin(c.root.rotation.y));
      controls.target.copy(p).add(new THREE.Vector3(0, 0.55, 0));
      this.ctx.camera.position.copy(p).addScaledVector(f, 3.2).add(new THREE.Vector3(f.z * 3.8, 1.3, -f.x * 3.8));   // front three-quarter
      Object.assign(controls, { autoRotate: true, autoRotateSpeed: 0.7, minDistance: 3.6, maxDistance: 6.2, maxPolarAngle: Math.PI * 0.47, enablePan: false });
      controls.update();
    } else if (kind === 'chase') {
      params.mode = 'chase'; controls.autoRotate = false;
    }
    this.ctx.applyAll();
  }

  /** C / pad RB: the next of the five views (camera.js VIEWS), its name flashed for a moment */
  cycleCamera() {
    const rig = this.field.rig; if (!rig) return;
    this.camView = rig.view = nextView(this.camView ?? rig.view);
    const el = this.camEl ??= this.root.appendChild(h('div', { id: 'cam-label', style: { position: 'absolute', left: '32px', bottom: '30px', padding: '9px 18px', font: 'italic 800 15px/1 var(--label)',
      letterSpacing: '0.26em', color: 'var(--ink)', background: 'rgba(9, 14, 22, 0.74)', border: '1px solid rgba(255, 255, 255, 0.12)', borderRadius: '10px', opacity: '0', pointerEvents: 'none' } }));
    el.textContent = VIEWS[this.camView].label;
    el.style.transition = 'opacity 0.12s'; el.style.opacity = '1';       // in at once, out slowly: opacity only, nothing blinks
    clearTimeout(this.camT); this.camT = setTimeout(() => { el.style.transition = 'opacity 0.7s ease-out'; el.style.opacity = '0'; }, 1100);
  }

  // ---------------------------------------------------------------------------------------------- the garage
  paintOf(key) {
    const c=this.field?.all.find(x=>x.key===key);
    return c?.paint??{...defaultPaint(c??{team:TEAMS.teams.find(t=>t.cars.some(e=>e.key===key))}),...(store.paintOf(key)??{})};
  }
  setPaint(key,p){
    const c=this.field?.all.find(x=>x.key===key);
    store.setPaint(key,c&&p&&JSON.stringify(p)===JSON.stringify(defaultPaint(c))?null:p);
    if(c)paintCar(c,p??{});
  }

  /** the car on the showroom spot (a little past the start line, the grid lined up behind it) */
  async previewCar(key) {
    const request=this.previewRequest=(this.previewRequest??0)+1;
    try{await this.ensureVehicles([key]);}catch(error){console.warn('Car preview:',error);if(request===this.previewRequest)this.setBusy('Car could not load. Select another car or retry.');return;}
    if(request!==this.previewRequest||this.screenName!=='garage')return;
    const F = this.field; if (!F) return;
    F.configure({ hero: key, racers: [key] });
    // on the centre line 36 m past the start: the orbit (≤ 6.2 m) stays clear of the walls and fences either side
    const C = this.ctx.track().centerline, i = 8, p = C[i], q = C[i + 1];
    const c = F.hero; c.root.position.set(p[0], p[1], p[2]);
    c.root.rotation.y = Math.atan2(q[2] - p[2], -(q[0] - p[0])) - Math.PI; c.car.rotation.y = Math.PI;
    this.cameraFor('garage');
  }

  /** what the menus show: the player's car and the five rivals on the grid */
  lineup() { this.field?.configure({ hero: store.data.car, racers: [store.data.car] }); if(this.loaded)this.preloadRace(); }

  /** the grid for a race: the player's car and each other team's lead car */
  racersFor(hero, rivals) {
    if (!rivals) return [hero];
    const mine = TEAMS.teams.find((t) => t.cars.some((c) => c.key === hero));
    return [hero, ...TEAMS.teams.filter((t) => t !== mine).map((t) => t.cars[0].key)];
  }

  // ---------------------------------------------------------------------------------------------- settings
  applySettings() {
    const S = store.settings, { params } = this.ctx;
    const look = S.look;
    if (params.quality !== S.quality) { params.quality = S.quality; this.ctx.applyQuality(); }
    const W = WEATHER[S.weather] ?? WEATHER.damp;
    params.wet = W.wet; params.rain = W.rain; setWeather(W.wet);
    const fx = this.field?.fx;   // exhaust gas thickens in damp air; low tiers emit fewer particles
    if (fx) { fx.damp = W.wet; fx.quality = ({ low: 0.5, medium: 0.75 })[S.quality === 'auto' ? this.ctx.device?.tier : S.quality] ?? 1; }
    params.speedBlur = BLUR[S.motionBlur] ?? 1;
    params.reduceMotion = S.reduceMotion;
    if (params.look !== look) { params.look = look; this.ctx.setLook(look); } else this.ctx.applyAll();
    if (this.field) this.field.assists = { ...ASSISTS[S.assists] };
    this.audio.setVolumes(S);
  }

  // ---------------------------------------------------------------------------------------------- sessions
  async startSession(mode) {
    if (!canSelectCar(store.data.car, store.data)) {
      this.setBusy(`This car requires level ${carProgression(store.data.car).level}. Choose an available car in the garage.`);
      return;
    }
    if (this.starting) return; this.starting = true;
    const S = store.settings, M = MODES[mode];
    const requestedFrom=this.screen;
    let preparedWorld, cancelled=false;
    const started=performance.now(),timings={};
    const stage=async(name,work)=>{
      const t=performance.now();
      const value=await work();timings[name]=Math.round(performance.now()-t);
      this.raceLoading?.complete(name);return value;
    };
    try {
    this.setBusy('');
    await this.raceLoading?.open({mode,reduceMotion:S.reduceMotion,onCancel:()=>{
      cancelled=true;this.raceLoading.close();this.ctx.clearDriverHoardings?.();this.lineup();this.show('menu');
    }});
    if(cancelled)return;
    await this.warmP?.catch(()=>{});   // a menu warm-up in flight finishes first: it owns the renderer's shadow flag and the hero's visibility, and Start needs the same programs
    if(cancelled)return;
    this.endSession();
    // Independent work starts together. Static collision construction does not advance a race clock.
    // Wait for all jobs even on failure so every newly created world can be disposed safely.
    const jobs=await Promise.allSettled([
      stage('Grid',()=>this.ensureVehicles(this.racersFor(store.data.car,M.rivals),{announce:false})),
      stage('Circuit',()=>this.ctx.ensureVenue?.()),
      stage('Track physics',async()=>{preparedWorld=await this.takeWorld();}),
      stage('Audio',()=>this.audio.engineFor(store.data.car).catch(error=>console.warn('Engine audio unavailable:',error))),
    ]);
    if(cancelled||this.screen!==requestedFrom)return;
    const failure=jobs.find(job=>job.status==='rejected');if(failure)throw failure.reason;
    const F=this.field;
    this.hideScreens();
    applyUpgrades((k)=>store.levels(k),store.data.car);
    this.earned=null;
    F.configure({ hero: store.data.car, racers: this.racersFor(store.data.car, M.rivals) });
    this.cameraFor('chase');
    // Prepare shader variants/textures behind the intro, before the race clock and controls start.
    await stage('Graphics',async()=>{
      await this.ctx.setDriverHoardings?.(mode==='race'?F.cars.map(c=>c.key):[]);
      if(!cancelled)await this.ctx.prepareRaceRenderer?.({isCancelled:()=>cancelled});
    });
    if(cancelled)return;
    this.lastLoad={totalMs:Math.round(performance.now()-started),stages:timings};
    console.info('Race preparation:',this.lastLoad);
    this.raceLoading?.close();
    this.pw = preparedWorld;preparedWorld=null;
    F.enablePhysics(this.pw, { player: true });
    F.assists = { ...ASSISTS[S.assists] };
    F.input.clear();F.input.setEnabled(true);
    this.ctx.newTrails(F.cars.filter((c) => !c.hero));   // the cars ahead leave trails; your own read as stripes on the road from the chase cam
    const h0 = handling(F.hero.key);
    const ev = EV.has(F.hero.key) || this.audio.engine?.ev;
    this.gearbox = new Gearbox(h0.top, this.audio.engine?.prof.redline ?? 8000, ev);
    this.session = new Session(F, mode, { laps: S.laps });     // last: update() runs a session only once it is complete
    this.setBusy('');
    this.mode = mode; this.lastLaps = S.laps;
    this.audio.commentary?.setTags([...M.tags, S.look === 'night' ? 'night' : S.look === 'dusk' ? 'dusk' : 'night', S.weather === 'rain' ? 'rain' : 'dry', 'corniche']);
    if (this.audio.engine?.rev) this.audio.play(this.audio.engine.prof.start ?? this.audio.engine.rev, { bus: 'engine', gain: 0.7 });
    this.cameraFor('chase');
    F.rig = null;                                // a fresh chase rig, snapped behind the car
    this.state = 'session'; this.quietT = 0; this.startPos = this.session.heroPos; this.racePb = false;
    this.hud.show(true);
    // reply 0 in a race: lights out comes ~14 s in and would cut Alastair's answer mid-sentence
    if (mode === 'race') setTimeout(() => this.say('intro_session', { priority: 3, force: true, reply: 0 }), 400);
    else this.say('intro_session', { priority: 3, force: true });
    } catch(error) {
      console.error('Session could not start:',error);this.raceLoading?.close();this.endSession();this.lineup();this.show('menu');this.setBusy('Session could not load. Try Start again.');
    } finally {
      preparedWorld?.dispose();this.raceLoading?.close();
      if(!this.session){this.audio.engineOff();this.ctx.clearDriverHoardings?.();}
      this.starting=false;
    }
  }

  endSession() {
    this.ctx.clearDriverHoardings?.();
    if (this.pw) { this.field.physics = false; for (const c of this.field.all) delete c.vehicle; this.pw.dispose(); this.pw = null; }
    applyUpgrades((k)=>store.levels(k));          // back to the garage view: every car as saved
    this.session = null; this.audio.engineOff(); this.audio.nitro(false); this.audio.commentary?.stop();
    this.hud?.show(false); this.ctx.params.paused = false; this.resultsShown = false;
    setTimeout(()=>{if(!this.starting&&!this.session)this.prepareWorld();},1500);   // the next race's collision world, built while the menu is up
  }

  pause() {
    if (!this.session || this.screen) return;
    this.ctx.params.paused = true; this.state = 'paused';
    this.audio.engineUpdate(0, 0, 0); this.audio.nitro(false);
    this.hud.show(false);
    this.show('pause');
  }
  resume() { this.field?.input?.setEnabled(true);this.hideScreens(); this.hud.show(true); this.ctx.params.paused = false; this.state = 'session'; }
  restart() { const m = this.mode; this.hideScreens(); this.startSession(m); }
  quit() { this.hideScreens(); this.endSession(); this.lineup(); this.applySettings(); this.show('menu'); }

  /** how much speed blur the post pass may use: a little behind the menus (the flythrough moves slowly) */
  get blurScale() { return this.session ? 1 : 0.2; }

  say(cat, opts = {}) { if (store.settings.commentaryOn) { const ok = this.audio.commentary?.say(cat, opts); if (ok) this.quietT = 0; return ok; } return false; }

  // ---------------------------------------------------------------------------------------------- per frame
  update(dt, fps) {
    this.inputDebug?.update(dt,this.field);
    this.nav.pad(dt);
    if(this.raceLoading?.active)return;
    if (this.screenName === 'title' && navigator.getGamepads?.().some((g) => g?.buttons.some((b) => b.pressed))) this.screens.title.onKey();
    const s = this.session, F = this.field;
    if (!s) { if (this.state === 'menu' && this.ctx.params.mode === 'orbit') this.ctx.controls.update(); return; }
    // start button on the pad pauses
    const pad = navigator.getGamepads?.().find((g) => g?.connected);
    const startBtn = pad?.buttons[9]?.pressed; if (startBtn && !this.startBtn && !this.screen) this.pause(); this.startBtn = startBtn;
    const rb = pad?.buttons[5]?.pressed; if (rb && !this.rbBtn && !this.screen) this.cycleCamera(); this.rbBtn = rb;
    if (this.ctx.params.paused) return;
    if (F.rig) { F.rig.fovOffset = store.settings.fovOffset; F.rig.view = this.camView ?? 'near'; }
    const events = s.update(dt);
    const v = F.hero.vehicle;
    // engine: the display gearbox turns speed and throttle into rpm
    const thr = s.state === 'grid' ? (F.playerThrottle ?? 0) : Math.abs(v.state.driveInput ?? v.controls.throttle);
    const shift = this.gearbox.update(dt, v.speed, thr, v.state.reverse ?? v.vForward < -0.5);
    if (shift === 'up' && thr > 0.8) this.audio.shift();
    this.audio.engineUpdate(this.gearbox.rpm, thr, 1, v.speed, v.latSlip);
    this.audio.nitro(v.state.nitroOn);
    if (v.state.nitroOn && !this.nitroWas) this.say('nitro_used', { cooldown: 40, priority: 1 });
    this.nitroWas = v.state.nitroOn;
    for (const e of events) this.onEvent(e);
    // the booth fills the quiet
    this.quietT += dt;
    if (s.state === 'running' && this.quietT > 24 && !this.audio.commentary?.busy) {
      const pick = Math.random();
      this.say(pick < 0.55 ? 'general_filler' : pick < 0.85 ? 'booth_exchanges' : 'paddock_report', { priority: 1, cooldown: 0 });
      this.quietT = 0;
    }
    if (s.mode === 'race' && s.state === 'running' && s.raceT > 7 && !this.startSaid) { this.startSaid = true; this.say(s.heroPos < this.startPos ? 'race_start_good' : 'race_start_bad', { priority: 2 }); }
    if (s.state === 'done' && s.doneT > 3.2 && !this.resultsShown) this.results();
    this.hud.update(dt, s, F, this.gearbox, fps);
  }

  onEvent(e) {
    const s = this.session, A = this.audio, H = this.hud, hero = this.field.hero;
    switch (e.type) {
      case 'light': H.lights(e.n); A.play('race/lights-on.ogg', { gain: 0.8 }); if (e.n === 1) this.say('grid_and_lights', { extraTags: ['lights_on'], priority: 2, cooldown: 0 }); break;
      case 'count': H.count(String(e.n)); A.play(`race/count-${e.n}.ogg`, { gain: 0.8 }); break;
      case 'go':
        H.lights(0);
        if (s.M.start === 'lights') { A.play('race/lights-out.ogg'); A.play('race/horn-start.ogg', { gain: 0.6 }); H.count('GO'); this.say('grid_and_lights', { extraTags: ['lights_out'], priority: 3, force: true }); A.cheer(false); }
        else if (s.M.start === 'count') { A.play('race/count-go.ogg'); H.count('GO'); }
        this.startSaid = false; break;
      case 'lap': {
        const isTrial = s.mode !== 'race';
        const record = e.valid && isTrial && store.bestLap(hero.key, e.t);
        if (!isTrial && e.valid) store.bestLap(hero.key, e.t);
        const delta = e.delta !== null && e.delta !== undefined ? `${e.delta > 0 ? '+' : '−'}${Math.abs(e.delta).toFixed(3)}` : '';
        let pay='';
        if (s.mode === 'trial') { const r = this.pay({ mode: 'trial', validLaps: e.valid ? 1 : 0, pb: record }); if (r.total) pay = `  +${r.total} U`; }
        if (s.mode === 'race' && e.pb && e.valid) this.racePb = true;
        H.lapDelta(e.valid ? e.delta : null, e.pb || record);
        H.message(e.valid ? `Lap ${e.n}` : 'Lap invalid', `${fmtTime(e.t)}  ${delta}${pay}`, !e.valid ? 'bad' : e.pb || record ? 'good' : delta.startsWith('+') ? 'bad' : '', 3.2);
        A.play(e.pb || record ? 'race/best-lap.ogg' : 'race/lap-complete.ogg', { gain: 0.8 });
        if (s.mode === 'race' && e.fastest) this.say('fastest_lap', { priority: 2 });
        else if (e.pb || record) this.say('personal_best', { priority: 2 });
        else if (e.n === 1 && s.mode === 'race') this.say('lap_one_complete', { priority: 1 });
        if (s.mode === 'race' && s.laps >= 3 && e.n === Math.floor(s.laps / 2)) setTimeout(() => this.say('halfway', { priority: 1 }), 3000);
        break;
      }
      case 'finalLap': H.message('Final lap', '', 'gold', 2.6); A.play('race/final-lap-bell.ogg'); this.say('final_lap', { priority: 3 }); break;
      case 'position':
        A.play(e.to < e.from ? 'race/position-up.ogg' : 'race/position-down.ogg', { gain: 0.6 });
        if (e.to === 1) this.say('lead_taken', { priority: 3, cooldown: 15 });
        else if (e.from === 1) this.say('lead_lost', { priority: 3, cooldown: 15 });
        else this.say(e.to < e.from ? 'overtake_player' : 'overtaken_player', { priority: 2, cooldown: 12 });
        if (e.to < e.from) A.play('crowd/hoots.ogg', { bus: 'crowd', gain: 0.4 });
        break;
      case 'invalid': H.message('Lap invalid', 'track limits', 'bad', 2.2); break;
      case 'offTrack': this.say('off_track', { priority: 2, cooldown: 14 }); A.play('crowd/groan.ogg', { bus: 'crowd', gain: 0.5 }); break;
      case 'crash': A.crash(e.kmh); this.say(e.kmh > 70 ? 'hard_crash' : 'soft_crash', { priority: 3, cooldown: 10 }); A.play('crowd/gasp.ogg', { bus: 'crowd', gain: 0.5 }); break;
      case 'spin': this.say('spin', { priority: 2, cooldown: 12 }); A.play('crowd/groan.ogg', { bus: 'crowd', gain: 0.5 }); break;
      case 'driftBank': H.message(`+${Math.round(e.pts).toLocaleString('en')}`, `×${e.mult.toFixed(1)}`, 'gold', 1.6); A.play('race/checkpoint.ogg', { gain: 0.5 }); break;
      case 'driftFail': H.message('Chain lost', `−${Math.round(e.lost).toLocaleString('en')}`, 'bad', 1.6); break;
      case 'finish': this.finish(e); break;
      default: break;
    }
  }

  finish(e) {
    const s = this.session, A = this.audio, hero = this.field.hero;
    A.play('race/horn-long.ogg', { gain: 0.6 });
    this.field.setPlayer(false);                 // the AI brings the car round on a cool-down lap
    if (s.mode === 'race') {
      const p = e.pos, rows = s.results(), fastest = rows.find((r) => r.hero)?.best;
      this.pay({ mode: 'race', pos: p, cars: rows.length, laps: s.laps, finished: true, pb: this.racePb,
        fastest: Number.isFinite(fastest) && fastest <= Math.min(...rows.map((r) => r.best ?? Infinity)) });
      this.hud.message(p === 1 ? 'Winner' : `P${p}`, `${fmtTime(s.raceT)}`, p === 1 ? 'gold' : '', 3.2);
      this.say(p === 1 ? 'player_wins' : p <= 3 ? 'player_podium' : p === s.order.length ? 'player_last' : 'player_midfield', { priority: 3, force: true });
      A.cheer(p <= 3);
      if (p === 1) { A.play('fireworks/big-finale.ogg', { bus: 'crowd', gain: 0.9, delay: 0.6 }); setTimeout(() => this.say('winner_fireworks', { priority: 2 }), 7000); }
    } else if (s.mode === 'drift') {
      this.driftRecord = store.driftRecord(hero.key, e.score);
      this.pay({ mode: 'drift', score: e.score, record: this.driftRecord });
      this.hud.message('Time', `${Math.round(e.score).toLocaleString('en')} pts`, 'gold', 3);
    }
  }

  results() {
    this.resultsShown = true; this.hud.show(false);
    const s = this.session, reward = this.earned;
    this.audio.engineUpdate(this.gearbox.rpm, 0, 0.4);
    if (s.mode === 'race') this.show('results', { mode: 'race', rows: s.results(), laps: s.laps, reward });
    else if (s.mode === 'drift') this.show('results', { mode: 'drift', score: s.drift.score, record: this.driftRecord, reward });
    this.state = 'results';
  }

  /** time trial and free drive end from the pause menu: show the laps driven */
  trialResults() {
    this.hud.show(false);
    const T = this.session.trk.get(this.field.hero);
    this.show('results', { mode: 'trial', laps: T.laps, best: T.best, record: T.best !== null && store.data.best[this.field.hero.key] === T.best, reward: this.earned });
  }
}

export { carName };
