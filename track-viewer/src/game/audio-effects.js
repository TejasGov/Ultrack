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
