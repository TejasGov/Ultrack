// Single resumable body-only job. All provider operations go through CLI 0.4.0.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const entry=process.argv[2];if(!entry||!fs.existsSync(entry))throw Error('Pass the verified Meshy CLI 0.4.0 entry file.');
const car=process.argv[3]??'mclaren-body-only';
const allowed={'mclaren-body-only':['meshy_output/mclaren-body-only','concept-mclaren.png'],mustang:['meshy_output/body-batch-2/mustang','concept-mustang.png'],porsche1:['meshy_output/body-batch-2/porsche1','concept-porsche1.jpg'],'aston-martin-valk':['meshy_output/body-batch-2/aston-martin-valk','concept-aston-martin-valk.jpg']};
for(const key of ['buggati','bentley-gt','bmw1'])allowed[key]=[`meshy_output/body-batch-3/${key}`,`concept-${key}.jpg`];
for(const key of ['jaguarxkjss','nuvolari','tesla1'])allowed[key]=[`meshy_output/body-batch-4/${key}`,`concept-${key}.jpg`];
allowed['furari-488']=['meshy_output/body-batch-5/furari-488','concept-furari-488.png'];
if(!Object.hasOwn(allowed,car))throw Error('Unknown authorized body job.');
const dir=path.join(root,allowed[car][0]),stateFile=path.join(dir,'state.json');
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const write=(f,v)=>{const temporary=f+'.tmp';fs.writeFileSync(temporary,JSON.stringify(v,null,2)+'\n');fs.renameSync(temporary,f);};
const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
async function cli(args,label){
  return new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,[entry,...args,'--workspace',dir,'--output-schema','v1','--format','json','--no-update-check'],{cwd:root,windowsHide:true,stdio:['ignore','pipe','pipe']});
    let stdout='',stderr='';child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);
    child.on('error',reject);child.on('close',code=>{
      fs.writeFileSync(path.join(dir,label+'.stdout.json'),stdout);fs.writeFileSync(path.join(dir,label+'.stderr.log'),stderr);
      let data;try{data=JSON.parse(stdout);}catch{return reject(Error(`CLI ${label}: invalid JSON; inspect its local log.`));}
      if(code||!data.ok)return reject(Error(`CLI ${label}: exit ${code}; ${data.error?.code??'inspect local log'}.`));
      resolve(data.result);
    });
  });
}
let state;
if(fs.existsSync(stateFile))state=read(stateFile);
else{
  const refs=['front','side','rear'].map(view=>({view,file:path.join(dir,'references',view+'.png')}));
  for(const r of refs)r.sha256=hash(r.file);
  const request={image_urls:refs.map(r=>r.file),ai_model:'meshy-7.1',geometry_resolution:'standard',image_enhancement:false,should_texture:false,should_remesh:false,target_formats:['glb'],multi_view_thumbnails:true};
  write(path.join(dir,'request.json'),request);
  state={schemaVersion:1,car,resource:'multi-image-to-3d',operationId:crypto.randomUUID(),status:'prepared',estimatedCredits:20,pricingSource:'https://docs.meshy.ai/en/api/pricing',pricingChecked:'2026-10-19',sourceConcept:allowed[car][1],references:refs,requestHash:hash(path.join(dir,'request.json'))};write(stateFile,state);
}
for(const ref of state.references)if(hash(ref.file)!==ref.sha256)throw Error('Reference image changed since preparation.');
if(hash(path.join(dir,'request.json'))!==state.requestHash)throw Error('Recorded request changed.');
if(!state.taskId){
  if(state.status!=='prepared')throw Error('Submission is uncertain; reconcile the operation ID before any new paid request.');
  const balance=await cli(['balance'],'balance-before');if(balance.balance<20)throw Error('Insufficient balance.');
  state.balanceBefore=balance.balance;state.status='submitting';write(stateFile,state);
  console.log(`Submitting ONE body-only ${car} generation, estimated 20 credits.`);
  try{
    const result=await cli(['multi-image-to-3d','create','--data','@'+path.join(dir,'request.json'),'--operation-id',state.operationId,'--async'],'submission');
    state.taskId=result.submission?.task_id??result.task_id;if(!state.taskId)throw Error('No accepted task ID.');
    state.status='submitted';write(stateFile,state);
  }catch(error){state.status='submission_unknown';write(stateFile,state);throw error;}
}
if(!state.projectDir){const result=await cli(['project','init','--root',dir,'--name',car+'-body-only','--task-id',state.taskId,'--task-type',state.resource],'project-init');state.projectDir=result.project_dir;write(stateFile,state);}
console.log(`Waiting for ${state.resource} task ${state.taskId}.`);
const waited=await cli([state.resource,'wait',state.taskId,'--timeout','600','--project',state.projectDir,'--stage','body-shell-generation'],'wait');
state.taskStatus=waited.task.status;state.consumedCredits=waited.task.consumed_credits;write(stateFile,state);
if(waited.task.status!=='SUCCEEDED')throw Error(`Task status ${waited.task.status}; resume this task, do not create another.`);
const taskJson=path.join(state.projectDir,`task_${state.taskId}.json`);
const assets=await cli(['download','--task-json',taskJson,'--list'],'assets');
console.log('Available assets: '+assets.assets.map(a=>a.key).join(', '));
if(!fs.existsSync(path.join(dir,'model.glb')))await cli(['download','--task-json',taskJson,'--model-format','glb','--output-dir',dir,'--project',state.projectDir,'--stage','delivery'],'download-model');
if(!fs.existsSync(path.join(dir,'previews/thumbnail.png')))await cli(['download','--task-json',taskJson,'--kind','thumbnail','--output-dir',path.join(dir,'previews'),'--project',state.projectDir,'--stage','preview'],'download-previews');
state.status='downloaded';state.modelFile=path.join(dir,'model.glb');state.modelSha256=hash(state.modelFile);write(stateFile,state);
console.log(JSON.stringify({status:state.status,taskId:state.taskId,resource:state.resource,consumedCredits:state.consumedCredits,modelFile:state.modelFile,sha256:state.modelSha256}));
