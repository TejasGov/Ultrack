// Ultrack V1: the game around the viewer. States: title -> menu -> setup / garage / settings -> session (countdown,
// racing, pause) -> results. Owns the screens, the session, the player's settings and profile (store.js), audio and
// commentary, and tells main.js which camera to run (flythrough behind menus, an orbit in the garage, the chase cam
// on track). main.js calls update(dt) every frame.
import * as THREE from 'three';
import './ui.css';
import TEAMS from '../../../assets/teams/teams.json';
import { store, ASSISTS, WEATHER, BLUR, fmtTime } from './store.js';
import { GameAudio, Gearbox, brakeSquealSlip } from './audio.js';
import { STATIONS, stationOf } from './music.js';
import { EV } from './ev.js';
import { Session, MODES } from './session.js';
import { InputDebug } from './input-debug.js';
import { Hud } from './hud.js';
import { Nav, setNav, h, CreditsScreen, RecordsScreen, TitleScreen, MenuScreen, SetupScreen, GarageScreen, SettingsScreen, PauseScreen, ResultsScreen, RadioScreen, carName } from './ui.js';
import { PhysicsWorld } from '../physics/world.js';
import { handling } from '../physics/handling.js';
import { setWeather } from '../physics/weather.js';
import { KEYS, GRID, paintCar, defaultPaint } from '../cars.js';
import { nextView, VIEWS } from '../camera.js';
import { rewardFor } from './economy.js';
import { applyUpgrades } from './carinfo.js';
import { canSelectCar, carProgression } from './progression.js';
import { RaceLoading } from './race-loading.js';
import { CareerStartScreen, CareerHubScreen, CareerDealScreen, CareerReportScreen } from './career-ui.js';
import { hardPaceFor, setHardMode, teamInfo, quickProfile } from './career/rules.js';
import { trackOf } from '../tracks.js';
import { TIERS } from '../perf.js';

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
      settings: SettingsScreen(this), pause: PauseScreen(this), results: ResultsScreen(this), radio: RadioScreen(this),
      careerStart: CareerStartScreen(this), careerHub: CareerHubScreen(this), careerDeal: CareerDealScreen(this), careerReport: CareerReportScreen(this),
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
    this.preloadRace();   // the title says Ready from main.js once the frame loop polls the pad (a pad press before that was lost)
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
    if(this.ctx.prefetchVenue){this.ctx.prefetchVenue();PhysicsWorld.preload(this.ctx.collisionUrl).catch(()=>{});}   // earlyBytes: the downloads start now, only the parsing waits for idle
    this.preloadP=(async()=>{   // Start awaits all of it: a warm-up that starts after Start would overlap race prep and be cut short
      await new Promise(r=>setTimeout(r,800));
      await new Promise(r=>globalThis.requestIdleCallback?requestIdleCallback(()=>r(),{timeout:2000}):setTimeout(r,200));
      if(stop())return void(this.preloading===id&&(this.preloading=null));   // retried by lineup() when the menu is back
      this.prepareWorld();
      await Promise.all([this.ensureVehicles(keys,{announce:false}),this.ctx.ensureVenue?.(),this.audio.preload(store.data.car)]);
      if(stop())return void(this.preloading===id&&(this.preloading=null));
      await (this.warmP=this.ctx.warmRace?.(keys,stop));
      if(stop()&&this.preloading===id)this.preloading=null;   // cut short mid warm-up (the garage): lineup() retries it as above
    })().catch(error=>{console.warn('Race preload:',error);if(this.preloading===id)this.preloading=null;});
  }
  /** The circuit picked in the setup screen: saved, the old venue and collision world dropped, the new track's data loaded and the
   *  race preload restarted. A track that will not load leaves the player on the one they had. Calls queue, so quick toggling
   *  settles on the last choice. */
  selectTrack(id) {
    return this.trackP = (this.trackP ?? Promise.resolve()).then(async () => {
      const next = trackOf(id), prev = this.ctx.trackId();
      if (next.id === prev) return;
      this.preloading = null;                                           // cancels a preload in flight (its stop() sees the change)
      await this.warmP?.catch(() => {});
      this.worldP?.then((w) => w.dispose(), () => {}); this.worldP = null;
      this.setBusy(`Loading ${next.name}…`,{ms:0});
      try {
        await this.ctx.setTrack(next.id);
        store.set('track', next.id); store.set('look', next.look);       // a circuit opens at its own hour; Time of day changes it
        this.hud?.dispose(); this.hud = new Hud(this.root, this.ctx.track());
        this.setBusy(''); this.applySettings(); this.lineup();
      } catch (error) {
        console.warn('Track switch failed:', error);
        store.set('track', prev); this.setBusy(`${next.name} could not load.`,{kind:'error'}); this.lineup();   // setTrack unloaded the old venue: preload it again
      }
    });
  }
  /** the collision world: built in the menu if the preload got there, else now (each session owns one) */
  takeWorld(){const world=this.worldP??PhysicsWorld.create(this.ctx.collisionUrl,this.ctx.physicsOpts);this.worldP=null;return world;}
  prepareWorld(){if(!this.worldP){this.worldP=PhysicsWorld.create(this.ctx.collisionUrl,this.ctx.physicsOpts);this.worldP.catch(()=>{this.worldP=null;});}}
  async ensureVehicles(keys,{announce=true}={}){
    const request=announce?(this.busyRequest=(this.busyRequest??0)+1):0;   // only shown requests count: a silent preload must not orphan the message
    if(announce)this.setBusy('Preparing '+keys.length+' '+(keys.length===1?'car':'cars')+'…',{ms:0});
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
  // kind 'error' (ui.css: accent edge, error icon) stays until replaced; an info toast goes after 4 s; ms 0 keeps a progress note up
  setBusy(message,{kind='info',ms=kind==='error'?0:4000}={}){clearTimeout(this.busyT);
    this.busyEl??=h('div.asset-loading',{'role':'status','aria-live':'polite'});
    if(!this.busyEl.parentNode)this.root.append(this.busyEl);
    this.busyEl.textContent=message;this.busyEl.hidden=!message;
    this.busyEl.dataset.kind=kind;if(message&&ms)this.busyT=setTimeout(()=>{if(this.busyEl.textContent===message)this.busyEl.hidden=true;},ms);
  }

  // ---------------------------------------------------------------------------------------------- screens
  show(name, arg) {
    this.field?.input?.setEnabled(false);
    const prev = this.screen;
    if (prev && prev !== this.screens[name]) { prev.el.classList.remove('on'); const el = prev.el; setTimeout(() => { if (this.screen?.el !== el) el.classList.add('hidden'); }, 260); prev.onHide?.(); }   // the 250 ms screen fade (ui-tokens --dur-3)
    this.screen = this.screens[name]; this.screenName = name;
    const el = this.screen.el; el.classList.remove('hidden'); requestAnimationFrame(() => el.classList.add('on'));
    if (prev === this.screens.menu) this.menuIdx = this.nav.i;
    if (this.screen.nav) this.nav.reset(name === 'menu' ? this.menuIdx ?? 0 : 0);
    this.screen.onShow?.(arg);                   // a screen may set its own starting item (the garage: your car)
    if (name === 'garage') this.cameraFor('garage');
    else if (['menu', 'setup', 'title', 'credits', 'records', 'careerStart', 'careerHub', 'careerDeal', 'careerReport'].includes(name) || (name === 'settings' && arg !== 'pause') || (name === 'radio' && !this.session)) { if (this.state !== 'menu') { this.state = 'menu'; } this.cameraFor('menu'); if (prev === this.screens.garage) this.lineup(); }
  }

  hideScreens() {
    for (const s of Object.values(this.screens)) { s.el.classList.remove('on'); const el = s.el; setTimeout(() => { if (this.screen?.el !== el) el.classList.add('hidden'); }, 260); }
    this.screen = null; this.screenName = null;
  }

  key(e) {
    if(e.defaultPrevented)return;
    if(this.raceLoading?.active){if(e.code!=='Tab')e.preventDefault();return;}   // Tab reaches Back; Enter and the rest stay swallowed
    if (this.screenName === 'title') { this.screens.title.onKey(); return; }
    if (this.session && !this.screen) {
      if (e.code === 'Escape') { if (!e.repeat) this.pause(); e.preventDefault(); }
      if (e.code === 'KeyC' && !e.repeat) this.cycleCamera();   // one view per press: key repeat would flicker through all five
    }
    const plain = !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey && !e.target?.closest?.('input, textarea, select, [contenteditable]');
    if (e.code === 'KeyN' && plain) this.cycleRadio();   // M is the race minimap
    if (e.code === 'KeyT' && plain) this.openRadio();
    if (['settings', 'garage', 'careerHub'].includes(this.screenName) && (e.code === 'KeyQ' || e.code === 'KeyE')) this.screens[this.screenName].onKeyTab(e.code === 'KeyQ' ? -1 : 1);
  }

  // ---------------------------------------------------------------------------------------------- radio
  updateMusic() {   // a career round's report is its results screen
    this.audio.music?.update(['results', 'careerReport'].includes(this.screenName) ? 'results' : !this.session ? 'menu' : 'race', this.screenName === 'pause', store.settings.radio);
  }
  /** N: Soundtrack -> Classical -> Off; the change starts now so the toast can name the piece */
  cycleRadio() {
    const i = STATIONS.findIndex(([id]) => id === store.settings.radio), [id, label] = STATIONS[(i + 1) % STATIONS.length];
    store.set('radio', id); this.updateMusic();
    const piece = this.audio.music?.now?.title;
    this.setBusy(`Radio: ${label}${piece && id !== 'off' ? ' · ' + piece : ''}`, { ms: 3000 });
    this.screen?.refresh?.();
  }
  /** T: the Radio screen from the menu, pause or settings; mid-race it pauses first; on the Radio screen T closes it */
  openRadio() {
    if (this.screenName === 'radio') return this.screen.back();
    if (this.session && !this.screen) this.pause();
    if (['menu', 'pause', 'settings'].includes(this.screenName) && !this.screen.modal) this.show('radio', this.screenName);
  }
  /** a track from the Radio screen plays now, on its own station */
  pickTrack(track) { const was = store.settings.radio; store.set('radio', stationOf(track)); this.audio.music?.pick(track); if (was !== store.settings.radio) this.screen?.refresh?.(); }

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
    const el = this.camEl ??= this.root.appendChild(h('div', { id: 'cam-label', style: { opacity: '0' } }));   // styled as a HUD tile by #cam-label in hud.css
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
    try{await this.ensureVehicles([key]);}catch(error){console.warn('Car preview:',error);if(request===this.previewRequest)this.setBusy('Car could not load. Select another car or retry.',{kind:'error'});return;}
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

  /** the grid for a race: the player's car and each other team's lead car, as many as the grid has slots; with more teams than that, the teams furthest from the player's in the expected order (tiers.json expPos) sit out */
  racersFor(hero, rivals) {
    if (!rivals) return [hero];
    const mine = TEAMS.teams.find((t) => t.cars.some((c) => c.key === hero)), at = (t) => teamInfo(t.id).expPos, me = mine ? at(mine) : 0;
    const near = TEAMS.teams.filter((t) => t !== mine).sort((a, b) => Math.abs(at(a) - me) - Math.abs(at(b) - me) || at(a) - at(b)).slice(0, GRID - 1);
    return [hero, ...TEAMS.teams.filter((t) => near.includes(t)).map((t) => t.cars[0].key)];
  }

  // ---------------------------------------------------------------------------------------------- settings
  applySettings() {
    const S = store.settings, { params } = this.ctx;
    setHardMode(S.hardMode);
    const t = trackOf(S.track), look = t.times && !t.times.includes(S.look) ? t.look : S.look;     // a saved Night never lands on a day-only track (tracks.js `times`)
    if (params.quality !== S.quality) { params.quality = S.quality; this.ctx.applyQuality(); }
    const W = WEATHER[S.weather] ?? WEATHER.damp, tier = S.quality === 'auto' ? this.ctx.device?.tier : S.quality;
    params.wet = W.wet; params.rain = Math.min(W.rain, TIERS[tier]?.rain ?? 1); setWeather(W.wet);   // the tier's rain cap here: applyQuality only runs on a quality change
    const fx = this.field?.fx;   // exhaust gas thickens in damp air; low tiers emit fewer particles
    if (fx) { fx.damp = W.wet; fx.quality = ({ low: 0.5, medium: 0.75 })[tier] ?? 1; }
    params.speedBlur = BLUR[S.motionBlur] ?? 1;
    params.reduceMotion = S.reduceMotion;
    if (params.look !== look) { params.look = look; this.ctx.setLook(look).catch((e) => console.warn('Time of day:', e)); } else this.ctx.applyAll();   // a failed sky reverts params.look: the next apply retries it
    if (this.field) this.field.assists = { ...ASSISTS[S.assists] };
    this.audio.setVolumes(S);
  }

  // ---------------------------------------------------------------------------------------------- sessions
  /** career: { racers, gridOrder, pace, levels, drivers, kind, done, home } from careerSession (a career round or the Shootout) */
  async startSession(mode, career = null) {
    if (!career && !canSelectCar(store.data.car, store.data)) {
      this.setBusy(`This car requires level ${carProgression(store.data.car).level}. Choose an available car in the garage.`,{kind:'error'});
      return;
    }
    if (this.starting) return; this.starting = true;
    await this.trackP;                                                  // a circuit change in flight lands first
    const S = store.settings, M = MODES[mode], racers = career?.racers ?? this.racersFor(store.data.car, M.rivals), home = career?.home ?? 'menu';
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
    await this.raceLoading?.open({mode,reduceMotion:S.reduceMotion,track:trackOf(S.track).name,label:career?.label,field:career?.field,onCancel:()=>{
      cancelled=true;this.raceLoading.close();this.ctx.clearDriverHoardings?.();this.lineup();this.show(home);
    }});
    if(cancelled)return;
    await (this.preloadP??this.warmP)?.catch(()=>{});   // the whole menu preload, warm-up included, finishes first: it owns the renderer's shadow flag and the hero's visibility, and Start needs the same programs
    if(cancelled)return;
    this.endSession();
    // Independent work starts together. Static collision construction does not advance a race clock.
    // Wait for all jobs even on failure so every newly created world can be disposed safely.
    const jobs=await Promise.allSettled([
      stage('Grid',()=>this.ensureVehicles(racers,{announce:false})),
      stage('Circuit',()=>this.ctx.ensureVenue?.()),
      stage('Track physics',async()=>{preparedWorld=await this.takeWorld();}),
      stage('Audio',()=>this.audio.engineFor(store.data.car).catch(error=>console.warn('Engine audio unavailable:',error))),
    ]);
    if(cancelled||this.screen!==requestedFrom)return;
    const failure=jobs.find(job=>job.status==='rejected');if(failure)throw failure.reason;
    const F=this.field;
    this.hideScreens();
    applyUpgrades(career?.levels ?? ((k)=>store.levels(k)),career?undefined:store.data.car,career?.power);   // a career sets every car: AI teams carry their development levels; its race and qualifying the player's mood (career/life.js drivePower)
    this.earned=null;
    F.gridOrder=career?.gridOrder??null;F.paceFor=career?.pace?(k)=>career.pace[k]:null;F.aiFor=career?.ai?(k)=>career.ai[k]:(k)=>quickProfile(k,(k.length*7919)>>>0,this.ctx.trackId());F.orders=career?.orders??null;F.nemesisKey=career?.nemesis?.key??null;F.mateKey=career?.mateKey??null;F.runUp=career?.runUp??0;F.hardPace=hardPaceFor(store.settings.hardMode);   // read by grid() in configure and by enablePhysics
    F.configure({ hero: store.data.car, racers });
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
    this.careerRun = career && { ...career, crashes: 0, spins: 0, hits: [], contacts: {}, passes: {}, offTrack: 0, orders: null };   // hits: the km/h of each hard hit, billed by the career (qualifying and races only); contacts (km/h by car) and passes (by car) heat rivals; orders: a team order given in this race (career.orders is only what the team would ask)
    this.session = new Session(F, mode, { laps: S.laps, drivers: career?.drivers });     // last: update() runs a session only once it is complete
    this.setBusy('');
    this.mode = mode; this.lastLaps = S.laps;
    this.audio.commentary?.setTags([...M.tags, S.look === 'day' ? null : S.look === 'dusk' ? 'dusk' : 'night', S.weather === 'rain' ? 'rain' : 'dry', trackOf(S.track).tag].filter(Boolean));
    if (this.audio.engine?.rev) this.audio.play(this.audio.engine.prof.start ?? this.audio.engine.rev, { bus: 'engine', gain: 0.7 });
    this.cameraFor('chase');
    F.rig = null;                                // a fresh chase rig, snapped behind the car
    this.state = 'session'; this.quietT = 0; this.startPos = this.session.heroPos; this.racePb = false;
    this.hud.reset(); this.hud.goals(career?.kind === 'sponsor' ? career : null); this.hud.show(true);
    // reply 0 in a race: lights out comes ~14 s in and would cut Alastair's answer mid-sentence
    if (mode === 'race') this.sayLater('intro_session', { priority: 3, force: true, reply: 0 }, 400);
    else this.say('intro_session', { priority: 3, force: true });
    } catch(error) {
      console.error('Session could not start:',error);this.raceLoading?.close();this.careerRun=null;this.endSession();this.lineup();this.show(home);this.setBusy('Session could not load. Try Start again.',{kind:'error'});
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
    if (this.field) { this.field.gridOrder = this.field.paceFor = this.field.aiFor = this.field.orders = this.field.nemesisKey = this.field.mateKey = null; this.field.runUp = 0; }
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
  /** a delayed line: dropped if its session has ended or been restarted by then (a new Session is a new object) */
  sayLater(cat, opts, ms) { const s = this.session; setTimeout(() => { if (s && this.session === s) this.say(cat, opts); }, ms); }

  // ---------------------------------------------------------------------------------------------- per frame
  update(dt, fps) {
    this.inputDebug?.update(dt,this.field);
    if(this.raceLoading?.active){const b=navigator.getGamepads?.().find((g)=>g?.connected)?.buttons[1]?.pressed;if(b&&!this.loadB)this.raceLoading.cancel?.();this.loadB=b;return;}   // first: the pad must not drive the Setup screen under the loading overlay; B is its Back
    this.nav.pad(dt);
    if (this.screenName === 'title' && navigator.getGamepads?.().some((g) => g?.buttons.some((b) => b.pressed))) this.screens.title.onKey();
    const s = this.session, F = this.field;
    this.updateMusic(); this.screen?.tick?.();   // the Radio screen's progress
    if (!s) { if (this.state === 'menu' && this.ctx.params.mode === 'orbit') this.ctx.controls.update(); return; }
    // start button on the pad pauses
    const pad = navigator.getGamepads?.().find((g) => g?.connected);
    const startBtn = pad?.buttons[9]?.pressed; if (startBtn && !this.startBtn) { if (!this.screen) this.pause(); else if (this.screenName === 'pause' && !this.screen.modal) this.resume(); } this.startBtn = startBtn;   // Menu toggles pause
    const rb = pad?.buttons[5]?.pressed; if (rb && !this.rbBtn && !this.screen) this.cycleCamera(); this.rbBtn = rb;
    if (this.ctx.params.paused) return;
    if (F.rig) { F.rig.fovOffset = store.settings.fovOffset; F.rig.view = this.camView ?? 'near'; }
    const events = s.update(dt);
    const v = F.hero.vehicle;
    // engine: the display gearbox turns speed and throttle into rpm
    const thr = s.state === 'grid' ? (F.playerThrottle ?? 0) : Math.abs(v.state.driveInput ?? v.controls.throttle);
    const shift = this.gearbox.update(dt, v.speed, thr, v.state.reverse ?? v.vForward < -0.5);
    if (shift === 'up' && thr > 0.8) this.audio.shift();
    this.audio.engineUpdate(this.gearbox.rpm, thr, 1, v.speed, Math.max(Math.abs(v.latSlip ?? 0), brakeSquealSlip(v.controls, v.speed)));   // the tyres squeal under hard braking and a pulled handbrake too, not only sliding sideways (smoke and skid marks stay on the real slip)
    this.audio.traffic?.update(F.cars, F.hero, dt);
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
    if (s.state === 'done' && s.doneT > 3.2 && !this.resultsShown) { this.results(); if (this.session !== s) return; }   // a career session ends here: its cars are gone
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
        // the first five valid laps of a trial pay (lapDone has already logged this one); later laps pay only a PB
        if (s.mode === 'trial') { const r = this.pay({ mode: 'trial', validLaps: e.valid && s.trk.get(hero).laps.filter((l) => l.valid).length <= 5 ? 1 : 0, pb: record }); if (r.total) pay = `  +${r.total} U`; }
        if (s.mode === 'race' && e.pb && e.valid) this.racePb = true;
        H.lapDelta(e.valid ? e.delta : null, e.pb || record);
        H.message(e.valid ? `Lap ${e.n}` : 'Lap invalid', `${fmtTime(e.t)}  ${delta}${pay}`, !e.valid ? 'bad' : e.pb || record ? 'good' : delta.startsWith('+') ? 'bad' : '', 3.2);
        A.play(e.pb || record ? 'race/best-lap.ogg' : 'race/lap-complete.ogg', { gain: 0.8 });
        if (s.mode === 'race' && e.fastest) this.say('fastest_lap', { priority: 2 });
        else if (e.pb || record) this.say('personal_best', { priority: 2 });
        else if (e.n === 1 && s.mode === 'race') this.say('lap_one_complete', { priority: 1 });
        if (s.mode === 'race' && s.laps >= 3 && e.n === Math.floor(s.laps / 2)) this.sayLater('halfway', { priority: 1 }, 3000);
        break;
      }
      case 'finalLap': {
        // team orders, the player's call (career races): told to let a teammate by only when they are within mateGap s behind, so it never asks the player to give up a real lead
        const F = this.field, mate = F.orders === 'toMate' && F.cars.find((c) => c.key === F.mateKey), O = mate && F.aiFor?.(F.mateKey)?.k.orders;
        const behindS = O ? (s.progress(hero) - s.progress(mate)) / s.N * s.len / Math.max(20, mate.vehicle.speed) : Infinity, told = !!O && behindS > 0 && behindS < O.mateGap;
        if (told && this.careerRun) this.careerRun.orders = { kind: 'toMate' };
        H.message('Final lap', told ? `Team: let ${s.driver(mate).name} by` : '', 'gold', told ? 4 : 2.6); A.play('race/final-lap-bell.ogg'); this.say('final_lap', { priority: 3 }); break;
      }
      case 'ordersDone': { const c = this.field.cars.find((x) => x.key === e.key); if (this.careerRun) this.careerRun.orders = { kind: 'toYou', obeyed: true }; if (c) H.message(`Team: ${s.driver(c).name} lets you through`, '', 'gold', 3); break; }
      case 'mistake': { const c = this.field.cars.find((x) => x.key === e.key); if (c) H.message(`${s.driver(c).name} ${e.kind === 'lift' ? 'lifts' : 'runs wide'}`, '', '', 2.2); break; }
      case 'defend': this.say('defending', { cooldown: 30 }); break;
      case 'sideBySide': this.say('side_by_side', { cooldown: 25 }); break;
      case 'position':
        if (this.careerRun && e.by) this.careerRun.passes[e.by] = (this.careerRun.passes[e.by] ?? 0) + 1;
        A.play(e.to < e.from ? 'race/position-up.ogg' : 'race/position-down.ogg', { gain: 0.6 });
        if (e.to === 1) this.say('lead_taken', { priority: 3, cooldown: 15 });
        else if (e.from === 1) this.say('lead_lost', { priority: 3, cooldown: 15 });
        else this.say(e.to < e.from ? 'overtake_player' : 'overtaken_player', { priority: 2, cooldown: 12 });
        if (e.to < e.from) A.play('crowd/hoots.ogg', { bus: 'crowd', gain: 0.4 });
        break;
      case 'invalid': H.message('Lap invalid', 'track limits', 'bad', 2.2); break;
      case 'offTrack': if (this.careerRun) this.careerRun.offTrack++; this.say('off_track', { priority: 2, cooldown: 14 }); A.play('crowd/groan.ogg', { bus: 'crowd', gain: 0.5 }); break;
      case 'impact': this.careerRun?.hits.push(e.kmh); break;
      case 'contact': if (this.careerRun) (this.careerRun.contacts[e.key] ??= []).push(e.kmh); break;
      case 'crash': if (this.careerRun) this.careerRun.crashes++; A.crash(e.kmh); this.say(e.kmh > 70 ? 'hard_crash' : 'soft_crash', { priority: 3, cooldown: 10 }); A.play('crowd/gasp.ogg', { bus: 'crowd', gain: 0.5 }); break;
      case 'spin': if (this.careerRun) this.careerRun.spins++; this.say('spin', { priority: 2, cooldown: 12 }); A.play('crowd/groan.ogg', { bus: 'crowd', gain: 0.5 }); break;
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
    if (s.mode === 'quali') this.hud.message(this.careerRun?.kind === 'test' ? 'Test day done' : this.careerRun?.kind === 'shootout' ? 'Shootout done' : 'Qualifying done', fmtTime(e.best), 'gold', 3);
    if (s.mode === 'race') {
      const p = e.pos, rows = s.results(), fastest = rows.find((r) => r.hero)?.best;
      if (!this.careerRun) this.pay({ mode: 'race', pos: p, cars: rows.length, laps: s.laps, finished: true, pb: this.racePb,
        fastest: Number.isFinite(fastest) && fastest <= Math.min(...rows.map((r) => r.best ?? Infinity)) });
      this.hud.message(p === 1 ? 'Winner' : `P${p}`, `${fmtTime(s.raceT)}`, p === 1 ? 'gold' : '', 3.2);
      this.say(p === 1 ? 'player_wins' : p <= 3 ? 'player_podium' : p === s.order.length ? 'player_last' : 'player_midfield', { priority: 3, force: true });
      A.cheer(p <= 3);
      if (p === 1) { A.play('fireworks/big-finale.ogg', { bus: 'crowd', gain: 0.9, delay: 0.6 }); this.sayLater('winner_fireworks', { priority: 2 }, 7000); }
    } else if (s.mode === 'drift') {
      if (!this.careerRun) {
        this.driftRecord = store.driftRecord(hero.key, e.score);
        this.pay({ mode: 'drift', score: e.score, record: this.driftRecord });
      }
      this.hud.message('Time', `${Math.round(e.score).toLocaleString('en')} pts`, 'gold', 3);
    }
  }

  results() {
    this.resultsShown = true; this.hud.show(false);
    if (this.careerRun) return this.careerDone();
    const s = this.session, reward = this.earned;
    this.audio.engineUpdate(this.gearbox.rpm, 0, 0.4);
    if (s.mode === 'race') this.show('results', { mode: 'race', rows: s.results(), laps: s.laps, reward });
    else if (s.mode === 'drift') this.show('results', { mode: 'drift', score: s.drift.score, record: this.driftRecord, reward });
    this.state = 'results';
  }

  // ---------------------------------------------------------------------------------------------- career (docs/career-mode.md)
  /** a career session (career-hub.js): kind 'shootout' | 'quali' | 'test' | 'sponsor' (a short race, the Sponsor Challenge) | 'practice' | 'race' on spec's circuit, hour, weather, laps and car. The free-play
   *  car and conditions are saved aside, and leaveCareer (or store.js, if the game closes first) puts them back (R12); done(data) gets the outcome */
  async careerSession(kind, spec, done) {
    if (!store.data.freePlay) { store.data.freePlay = { car: store.data.car, track: store.settings.track, look: store.settings.look, weather: store.settings.weather, laps: store.settings.laps }; store.save(); }
    await this.selectTrack(spec.track);
    if (this.ctx.trackId() !== spec.track) return;                       // the circuit would not load: selectTrack has said so
    store.data.car = spec.car; Object.assign(store.settings, { look: spec.look, weather: spec.weather, laps: spec.laps ?? store.settings.laps }); store.save();
    this.applySettings();
    await this.startSession(kind === 'race' || kind === 'sponsor' ? 'race' : kind === 'practice' ? 'free' : 'quali', { ...spec.session, kind, done, home: spec.home });
  }
  /** a career session ends (the flag, the last qualifying lap, End qualifying, Retire): its numbers go back to the career screens */
  careerDone(retired = false) {
    const run = this.careerRun, s = this.session; if (!run || !s) return;
    const T = s.trk.get(this.field.hero), rows = s.mode === 'race' ? s.results() : null;
    const data = { kind: run.kind, best: T.best, mateLap: s.rivalLap(), score: s.drift?.score ?? null, dnf: retired, crashes: run.crashes, hits: run.hits, spins: run.spins, pro: store.settings.assists === 'pro',
      order: rows?.map((r) => r.key), bests: rows && Object.fromEntries(rows.map((r) => [r.key, r.best ?? null])), contacts: run.contacts, passes: run.passes, offTrack: run.offTrack, totals: rows?.map((r) => [r.key, r.total]),
      orders: run.orders?.kind === 'toMate' ? (retired ? null : { kind: 'toMate', obeyed: rows.findIndex((r) => r.key === run.mateKey) < rows.findIndex((r) => r.hero) }) : run.orders ?? null };   // obeyed: the teammate finished ahead; a retirement settles nothing
    this.careerRun = null; this.hideScreens(); this.endSession(); this.lineup(); this.state = 'menu'; this.cameraFor('menu');
    run.done(data);
  }
  /** out of the career to the main menu: the free-play car, circuit and conditions as they were */
  leaveCareer() {
    const f = store.data.freePlay; delete store.data.freePlay;
    if (f) {
      store.data.car = f.car; Object.assign(store.settings, { track: f.track, look: f.look, weather: f.weather, laps: f.laps }); store.save();
      this.selectTrack(f.track).then(() => { store.set('look', f.look); this.applySettings(); });
    }
    this.lineup(); this.applySettings(); this.show('menu');
  }

  /** time trial and free drive end from the pause menu: show the laps driven */
  trialResults() {
    this.hud.show(false);
    const T = this.session.trk.get(this.field.hero);
    this.show('results', { mode: 'trial', laps: T.laps, best: T.best, record: T.best !== null && store.bestOf(this.field.hero.key) === T.best, reward: this.earned });
  }
}

export { carName };
