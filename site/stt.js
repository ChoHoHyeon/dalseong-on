/* ============================================================
   달성On — 녹음 → 글 (stt.js)  · 회의록 정리하기에서 사용
   · Whisper(small) 음성인식 모델을 브라우저 안(Web Worker)에서 직접 돌린다.
     녹음 파일·변환 텍스트는 이 PC 밖으로 나가지 않는다. (외부 음성인식 API 미사용)
   · 첫 실행 때 모델(약 250MB)을 한 번 내려받아 브라우저 캐시에 둔다. WebGPU가 되면 그것을, 아니면 WASM(CPU)을 쓴다.
   · 폐쇄망: 모델 파일을 내부 서버에 두고 아래 MODEL_HOST 만 바꾸면 동일하게 동작.
   사용:  DsSTT.transcribe(file, onProgress) → Promise<text>
   ============================================================ */
window.DsSTT=(function(){
"use strict";
const LIB='https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.1/dist/transformers.min.js';
const MODEL='onnx-community/whisper-small';
const MODEL_HOST='';   // 폐쇄망용 내부 서버 주소(비우면 Hugging Face)
let worker=null, ready=false, device='wasm';

const WORKER_SRC=`
import { pipeline, env } from '${LIB}';
${MODEL_HOST?`env.remoteHost='${MODEL_HOST}';`:''}
env.allowLocalModels=false;
let asr=null, dev='wasm';
async function load(){
  if(asr) return;
  try{ if(navigator.gpu && await navigator.gpu.requestAdapter()) dev='webgpu'; }catch(e){}
  const opts = dev==='webgpu' ? {device:'webgpu', dtype:{encoder_model:'fp32', decoder_model_merged:'q4'}} : {device:'wasm', dtype:'q8'};
  try{
    asr = await pipeline('automatic-speech-recognition','${MODEL}',{...opts, progress_callback:p=>postMessage({t:'load',p})});
  }catch(e){
    if(dev==='webgpu'){ dev='wasm'; asr = await pipeline('automatic-speech-recognition','${MODEL}',{device:'wasm',dtype:'q8',progress_callback:p=>postMessage({t:'load',p})}); }
    else throw e;
  }
  postMessage({t:'ready',dev});
}
onmessage=async e=>{
  const m=e.data;
  try{
    if(m.t==='load'){ await load(); return; }
    if(m.t==='run'){
      await load();
      // 30초 이하 조각으로 직접 나누되, 말이 끊기는 조용한 지점(20~29초 사이 가장 작은 소리)에서 자른다.
      // (모델 내부 30초 분할·겹침 합치기를 쓰면 경계에서 문장이 빠지는 문제가 있어 쓰지 않음)
      const a=m.audio, SR=16000, W=SR/10; const cuts=[0];
      while(a.length-cuts[cuts.length-1]>29*SR){ const st=cuts[cuts.length-1]; let best=st+29*SR, bv=Infinity;
        for(let p=st+20*SR;p+W<=st+29*SR;p+=W/2){ let e=0; for(let k=p;k<p+W;k+=4) e+=a[k]*a[k]; if(e<bv){ bv=e; best=p+W/2; } }
        cuts.push(Math.floor(best)); }
      cuts.push(a.length); const n=cuts.length-1; let out='';
      for(let i=0;i<n;i++){
        const seg=a.subarray(cuts[i],cuts[i+1]); if(seg.length<SR/2) continue;
        const r=await asr(seg,{language:'korean',task:'transcribe',return_timestamps:false});
        const t=(r.text||'').trim(); if(t) out+=t+' ';
        postMessage({t:'seg',i:i+1,n,sec:Math.round(cuts[i+1]/SR),tot:Math.round(a.length/SR),text:out});
      }
      postMessage({t:'done',text:out.trim()});
    }
  }catch(err){ postMessage({t:'error',msg:String(err&&err.message||err)}); }
};`;

function getWorker(){
  if(worker) return worker;
  const url=URL.createObjectURL(new Blob([WORKER_SRC],{type:'text/javascript'}));
  worker=new Worker(url,{type:'module'}); return worker;
}
/* 파일 → 16kHz mono Float32 */
async function decode(file){
  const buf=await file.arrayBuffer();
  const ac=new (window.AudioContext||window.webkitAudioContext)();
  const ab=await ac.decodeAudioData(buf); ac.close?.();
  const oc=new OfflineAudioContext(1, Math.ceil(ab.duration*16000), 16000);
  const src=oc.createBufferSource(); src.buffer=ab; src.connect(oc.destination); src.start();
  const out=await oc.startRendering();
  return {audio:out.getChannelData(0), seconds:ab.duration};
}
function transcribe(file,onProgress){
  return new Promise(async(ok,no)=>{
    let decoded;
    try{ onProgress?.({stage:'decode',msg:'녹음 파일 읽는 중…'}); decoded=await decode(file); }
    catch(e){ return no(new Error('이 파일은 브라우저가 읽지 못합니다(mp3·m4a·wav·webm·ogg 권장): '+(e.message||e))); }
    const w=getWorker(); const files={};
    const h=e=>{
      const m=e.data;
      if(m.t==='load'){ const p=m.p||{}; if(p.status==='progress'&&p.file){ files[p.file]=[p.loaded||0,p.total||0]; const L=Object.values(files).reduce((s,[a])=>s+a,0), T=Object.values(files).reduce((s,[,b])=>s+b,0); onProgress?.({stage:'model',pct:T?Math.round(L/T*100):0,msg:`음성인식 모델 준비 중 (처음 한 번만 내려받습니다) ${T?Math.round(L/1048576)+'/'+Math.round(T/1048576)+'MB':''}`}); } else if(p.status==='ready'||p.status==='done'){ onProgress?.({stage:'model',pct:100,msg:'모델 준비 완료'}); } }
      else if(m.t==='ready'){ ready=true; device=m.dev; onProgress?.({stage:'run',pct:0,msg:`글로 바꾸는 중… (${device==='webgpu'?'그래픽카드 가속':'CPU'}, 이 PC 안에서 처리)`}); }
      else if(m.t==='seg'){ onProgress?.({stage:'run',pct:Math.round(m.i/m.n*100),msg:`글로 바꾸는 중… ${Math.floor(m.sec/60)}분 ${m.sec%60}초 / ${Math.floor(m.tot/60)}분 ${m.tot%60}초 (이 PC 안에서 처리)`,text:m.text}); }
      else if(m.t==='done'){ w.removeEventListener('message',h); ok(m.text); }
      else if(m.t==='error'){ w.removeEventListener('message',h); no(new Error(m.msg)); }
    };
    w.addEventListener('message',h);
    onProgress?.({stage:'model',pct:0,msg:`녹음 ${Math.round(decoded.seconds/60)}분 ${Math.round(decoded.seconds%60)}초 · 음성인식 모델 준비 중…`});
    w.postMessage({t:'run',audio:decoded.audio},[decoded.audio.buffer]);
  });
}
function warm(){ try{ getWorker().postMessage({t:'load'}); }catch(e){} }
return {transcribe, warm, get ready(){return ready;}, get device(){return device;}};
})();
