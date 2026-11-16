const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
function setup(){
 const nodes=new Map(),timers=new Map();let seq=0,stopped=0,blob;
 function el(){return {value:'',textContent:'',innerHTML:'',hidden:true,dataset:{},style:{setProperty(){}},classList:{add(){},remove(){},toggle(){}},appendChild(){},setAttribute(){},addEventListener(){},querySelector(){return el()},getTracks(){return []}}}
 function node(id){if(!nodes.has(id))nodes.set(id,el());return nodes.get(id)}
 const stream={getTracks:()=>[{stop(){stopped++}}]};
 class Recorder{
  static isTypeSupported(){return true}
  constructor(){this.state='inactive';this.mimeType='audio/webm'}
  start(){this.state='recording'}
  stop(){this.state='inactive';this.ondataavailable({data:new Blob(['audio-bytes'])});this.onstop()}
 }
 class Recognition{start(){this.starts=(this.starts||0)+1}stop(){this.onend?.()}abort(){this.onend?.()}}
 const context=vm.createContext({document:{querySelector:node,querySelectorAll:()=>[],createElement:el,createElementNS:el},
 localStorage:{getItem(){return null},setItem(){},removeItem(){}},navigator:{mediaDevices:{getUserMedia:async()=>stream}},
 window:{MediaRecorder:Recorder,SpeechRecognition:Recognition,addEventListener(){}},MediaRecorder:Recorder,
 URL:{createObjectURL:b=>{blob=b;return 'blob:recording'},revokeObjectURL(){}},Blob,console,
 setTimeout:(fn,ms)=>{timers.set(++seq,{fn,ms});return seq},clearTimeout:id=>timers.delete(id),setInterval:()=>++seq,clearInterval(){}});
 vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1],context);
 return {run:code=>vm.runInContext(code,context),context,nodes,node,timers,getStopped:()=>stopped,getBlob:()=>blob};
}
(async()=>{
 let t=setup();await t.run('startRecording()');assert.equal(t.run('state.mediaRecorder.state'),'recording');assert.equal(t.node('#recordBtn').textContent,'● 녹음 중 · 눌러서 정지');
 t.run("state.recognition.onstart()");
 t.run("state.recognition.onresult({resultIndex:0,results:[Object.assign([{transcript:'이번 실험에서는 음성 녹음 기능과 전사 내용을 비교합니다.'}],{isFinal:true})]})");
 t.run("state.recognition.onresult({resultIndex:0,results:[Object.assign([{transcript:'이번 실험에서는 음성 녹음 기능과 전사 내용을 비교합니다.'}],{isFinal:true})]})");
 assert.equal(t.node('#transcript').value,'이번 실험에서는 음성 녹음 기능과 전사 내용을 비교합니다.');
 t.run('stopRecording()');assert.ok(t.getStopped()>0);assert.equal(t.node('#recordingOutput').hidden,false);assert.equal(await t.getBlob().text(),'audio-bytes');assert.equal(t.node('#saveRecording').href,'blob:recording');assert.match(t.node('#saveRecording').download,/\.webm$/);
 t=setup();t.context.navigator.mediaDevices.getUserMedia=async()=>{const e=Error();e.name='NotAllowedError';throw e};await t.run('startRecording()');assert.equal(t.run('state.recording'),false);assert.match(t.node('#speechStatus').textContent,/거부/);
 t=setup();await t.run('startRecording()');t.run("state.recognition.onerror({error:'network'})");const starts=t.run('state.recognition.starts');t.run('state.recognition.onend()');assert.equal(t.run('state.recognition.starts'),starts);assert.equal(t.run('state.mediaRecorder.state'),'recording');assert.match(t.node('#speechStatus').textContent,/서버 연결 실패/);t.run('stopRecording()');
 t=setup();await t.run('startRecording()');const watchdog=[...t.timers.values()].find(x=>x.ms===10000);watchdog.fn();assert.match(t.node('#speechStatus').textContent,/시간 초과/);assert.equal(t.run('state.mediaRecorder.state'),'recording');t.run('stopRecording()');
 t=setup();delete t.context.window.SpeechRecognition;await t.run('startRecording()');assert.match(t.node('#speechStatus').textContent,/전사 미지원/);assert.equal(t.run('state.mediaRecorder.state'),'recording');t.run('stopRecording()');
 t=setup();let resolve;t.context.navigator.mediaDevices.getUserMedia=()=>new Promise(r=>resolve=r);const pending=t.run('startRecording()');t.run('stopRecording()');let released=0;resolve({getTracks:()=>[{stop(){released++}}]});await pending;assert.equal(released,1);assert.equal(t.run('state.recording'),false);
 console.log('PASS: recorder lifecycle, audio save, repeated speech results, denied permission, bounded speech errors, timeout, unsupported speech and cancelled microphone request. Speech events are simulated; this does not measure real speech accuracy.');
})().catch(e=>{console.error(e);process.exitCode=1});
