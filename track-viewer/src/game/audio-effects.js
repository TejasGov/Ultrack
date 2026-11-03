/** Circuit PA: speech-band filtering, mild speaker saturation and a short slapback. */
export function createPA(ctx, output) {
  const input=ctx.createGain(),high=ctx.createBiquadFilter(),low=ctx.createBiquadFilter();
  high.type='highpass';high.frequency.value=300;low.type='lowpass';low.frequency.value=3500;
  const drive=ctx.createWaveShaper(),curve=new Float32Array(1024);
  for(let i=0;i<curve.length;i++){const x=i/(curve.length-1)*2-1;curve[i]=Math.tanh(x*1.5)/Math.tanh(1.5);}
  drive.curve=curve;drive.oversample='2x';
  const dry=ctx.createGain(),delay=ctx.createDelay(.5),wet=ctx.createGain(),feedback=ctx.createGain();
  dry.gain.value=.85;delay.delayTime.value=.095;wet.gain.value=.18;feedback.gain.value=.16;
  input.connect(high).connect(low).connect(drive);drive.connect(dry).connect(output);
  drive.connect(delay).connect(wet).connect(output);delay.connect(feedback).connect(delay);
  return {input,nodes:[high,low,drive,dry,delay,wet,feedback]};
}

/** No samples: quiet electric motor plus speed-driven tyre and wind noise. */
export class RoadAudio {
  constructor(ctx,bus,{electric=false}={}) {
    this.ctx=ctx;this.nodes=[];this.sources=[];this.electric=electric;
    const noise=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate),data=noise.getChannelData(0);
    let seed=9182;for(let i=0;i<data.length;i++){seed=(1664525*seed+1013904223)>>>0;data[i]=seed/2147483648-1;}
    const layer=(freq,q)=>{
      const src=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();
      src.buffer=noise;src.loop=true;filter.type='bandpass';filter.frequency.value=freq;filter.Q.value=q;gain.gain.value=0;
      src.connect(filter).connect(gain).connect(bus.effects);src.start();this.sources.push(src);this.nodes.push(src,filter,gain);return {filter,gain};
    };
    this.wind=layer(900,.45);this.tyres=layer(450,.7);
    if(electric){
      this.motor=ctx.createOscillator();this.motor.type='sine';this.motorGain=ctx.createGain();this.motorGain.gain.value=0;
      this.motor.connect(this.motorGain).connect(bus.engine);this.motor.start();this.sources.push(this.motor);this.nodes.push(this.motor,this.motorGain);
      this.inverter=layer(4800,1.2);
    }
  }
  update(speed,throttle,mute=1,slip=0) {
    if(this.stopped)return;
    const t=this.ctx.currentTime,v=Math.max(0,Math.min(1.5,Math.abs(speed)/90)),load=Math.max(0,Math.min(1,throttle));
    const set=(p,value)=>p.setTargetAtTime(value,t,.08);
    set(this.wind.gain.gain,.075*v*v*mute);set(this.tyres.gain.gain,(.025*v+.035*Math.min(1,Math.abs(slip)))*mute);
    set(this.wind.filter.frequency,500+v*1700);
    if(this.electric){
      set(this.motor.frequency,100+Math.abs(speed)*23);set(this.motorGain.gain,Math.min(1,v*12)*(.005+.014*load)*mute);
      set(this.inverter.gain.gain,.005*load*Math.min(1,v*5)*mute);
    }
  }
  stop() {if(this.stopped)return;this.stopped=true;this.sources.forEach(s=>s.stop());this.nodes.forEach(n=>n.disconnect());}
}

/**
 * Opponents: the nearest three cars get an engine voice placed around the player, with Doppler, and a pass adds a rush of air. Every car shares one
 * buffer, so the grid costs no extra files, and the voices follow the cars, so the cost doesn't grow with the grid.
 */
const VOICES=3,RANGE=80,STEP=.05,SOUND=343;
export class TrafficAudio {
  constructor(ctx,bus,buffer,bank) {
    Object.assign(this,{ctx,bus,buffer,bank,wait:0,last:new Map(),stopped:false});
    const place=(node,to)=>{const p=ctx.createPanner();p.panningModel='equalpower';p.distanceModel='inverse';p.refDistance=7;p.rolloffFactor=1.4;node.connect(p).connect(to);return p;};
    this.voices=Array.from({length:VOICES},()=>{
      const filter=ctx.createBiquadFilter(),gain=ctx.createGain();filter.type='lowpass';gain.gain.value=0;filter.connect(gain);
      return {car:null,src:null,filter,gain,panner:place(gain,bus.engine)};
    });
    const noise=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate),data=noise.getChannelData(0);
    let seed=4471;for(let i=0;i<data.length;i++){seed=(1664525*seed+1013904223)>>>0;data[i]=seed/2147483648-1;}
    this.air=ctx.createBufferSource();this.air.buffer=noise;this.air.loop=true;
    this.airFilter=ctx.createBiquadFilter();this.airFilter.type='bandpass';this.airFilter.Q.value=.7;this.airGain=ctx.createGain();this.airGain.gain.value=0;
    this.air.connect(this.airFilter).connect(this.airGain);this.airPanner=place(this.airGain,bus.effects);this.air.start();
  }
  velocity(car,step) {
    const p=car.root.position,l=this.last.get(car),v=l?{x:(p.x-l.x)/step,y:(p.y-l.y)/step,z:(p.z-l.z)/step}:{x:0,y:0,z:0};
    this.last.set(car,{x:p.x,y:p.y,z:p.z});
    return Math.hypot(v.x,v.y,v.z)>200?{x:0,y:0,z:0}:v;   // a reset to the grid is no 700 km/h pass
  }
  /** cars and hero as the field holds them; runs at 20 Hz, smoothing covers the frames between */
  update(cars,hero,dt) {
    if(this.stopped||(this.wait+=dt)<STEP)return;
    const step=this.wait,t=this.ctx.currentTime;this.wait=0;
    const h=hero.root.position,q=hero.root.quaternion,fx=1-2*(q.y*q.y+q.z*q.z),fz=2*(q.x*q.z-q.w*q.y),len=Math.hypot(fx,fz)||1,fwd={x:fx/len,z:fz/len};
    const hv=this.velocity(hero,step);
    const near=cars.filter(c=>c!==hero).map(car=>{
      const p=car.root.position,v=this.velocity(car,step),dx=p.x-h.x,dy=p.y-h.y,dz=p.z-h.z,d=Math.hypot(dx,dy,dz)||.01,rel={x:v.x-hv.x,y:v.y-hv.y,z:v.z-hv.z};
      return {car,d,lx:dx*-fwd.z+dz*fwd.x,lz:-(dx*fwd.x+dz*fwd.z),ly:dy,closing:-(rel.x*dx+rel.y*dy+rel.z*dz)/d,rel:Math.hypot(rel.x,rel.y,rel.z)};
    }).filter(n=>n.d<RANGE).sort((a,b)=>a.d-b.d).slice(0,VOICES);
    for(const v of this.voices)if(v.car&&!near.some(n=>n.car===v.car))this.release(v,t);
    for(const n of near){
      const v=this.voices.find(x=>x.car===n.car)??this.voices.find(x=>!x.car);if(!v)continue;
      if(v.car!==n.car)this.claim(v,n.car);
      const prof=this.bank.profiles[n.car.key];if(!v.src||!prof)continue;
      const frac=n.car._fx?.rpm??.6,doppler=Math.min(1.3,Math.max(.77,SOUND/(SOUND-n.closing)));
      v.src.playbackRate.setTargetAtTime(Math.min(2.6,Math.max(.35,frac*prof.redline*(prof.pitch??1)/v.loop.rpm*doppler)),t,.06);
      v.gain.gain.setTargetAtTime(.32+.5*frac,t,.08);
      v.filter.frequency.setTargetAtTime(Math.max(1200,20000/(1+n.d/6)),t,.08);
      this.move(v.panner,n,t);
    }
    const n=near[0],pass=n?Math.min(1,n.rel/22)*Math.max(0,1-n.d/16)**2:0;
    this.airGain.gain.setTargetAtTime(pass*.55,t,.05);
    if(n){this.airFilter.frequency.setTargetAtTime(600+1800*pass,t,.05);this.move(this.airPanner,n,t);}
  }
  move(panner,n,t) {
    panner.positionX.setTargetAtTime(n.lx,t,.04);panner.positionY.setTargetAtTime(n.ly,t,.04);panner.positionZ.setTargetAtTime(n.lz,t,.04);
  }
  claim(v,car) {
    const prof=this.bank.profiles[car.key],loop=prof&&this.bank.traffic[prof.pack];
    v.car=car;if(!loop)return;
    const src=this.ctx.createBufferSource();src.buffer=this.buffer;src.loop=true;src.loopStart=loop.loopStart;src.loopEnd=loop.loopEnd;
    src.connect(v.filter);src.start(0,loop.loopStart+Math.random()*(loop.loopEnd-loop.loopStart));
    v.src=src;v.loop=loop;
  }
  release(v,t) {
    v.gain.gain.setTargetAtTime(0,t,.06);
    try{v.src?.stop(t+.3);}catch{/* already stopped */}
    v.src=null;v.car=null;
  }
  /** pause and results: the frame loop stops updating, so nothing else would quiet the voices */
  silence() {
    if(this.stopped)return;
    const t=this.ctx.currentTime;
    for(const v of this.voices)if(v.car)this.release(v,t);
    this.airGain.gain.setTargetAtTime(0,t,.05);
  }
  stop() {
    if(this.stopped)return;
    this.silence();this.stopped=true;
    try{this.air.stop();}catch{/* already stopped */}
    this.last.clear();
  }
  report() { return this.voices.map(v=>v.car?v.car.key:null); }
}
