/** Bound decoding/assembly work so background content cannot saturate startup. */
export class AssetQueue {
  constructor(limit=2){this.limit=limit;this.active=0;this.waiting=[];}
  // low: far LODs and the like wait behind every car a race or the garage is waiting for
  run(task,{low=false}={}){return new Promise((resolve,reject)=>{
    const job={task,resolve,reject,low};
    if(low)this.waiting.push(job);else{const at=this.waiting.findIndex(j=>j.low);this.waiting.splice(at<0?this.waiting.length:at,0,job);}
    this.drain();});}
  drain(){while(this.active<this.limit&&this.waiting.length){const job=this.waiting.shift();this.active++;
    Promise.resolve().then(job.task).then(job.resolve,job.reject).finally(()=>{this.active--;this.drain();});}}
}
