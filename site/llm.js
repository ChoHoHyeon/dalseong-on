/* ============================================================
   달성On — 공통 모델 호출 (llm.js)
   · 서버 중계(/api/chat, Netlify 함수)는 한 번에 약 30초까지만 응답을 보낸다.
     긴 글(회의록·보도자료·조례안 등)이 중간에 끊기면, 쓴 데까지를 넘겨 "이어서" 쓰게 해 붙인다(최대 5번).
   · 사용: const text = await dsLLM(system, user, {max:6000, onText:t=>…});
   ============================================================ */
(function(){
"use strict";
async function once(system,user,o){
  const S=window.S||{}; const msgs=[{role:'user',content:user}]; if(o.prefill) msgs.push({role:'assistant',content:o.prefill});
  const payload=JSON.stringify({model:S.model||'claude-sonnet-4-5',max_tokens:o.max||4000,stream:true,system,messages:msgs});
  const r=S.key
    ? await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'content-type':'application/json','x-api-key':S.key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},body:payload})
    : await fetch('/api/chat',{method:'POST',headers:{'content-type':'application/json','x-access-code':S.code||''},body:payload});
  if(!r.ok) throw new Error('모델 호출 실패 ('+r.status+')');
  const rd=r.body.getReader(), dec=new TextDecoder(); let buf='',text='',done=false;
  try{
    while(true){ const {value,done:end}=await rd.read(); if(end) break; buf+=dec.decode(value,{stream:true});
      const ls=buf.split('\n'); buf=ls.pop();
      for(const ln of ls){ if(!ln.startsWith('data:')) continue; let j; try{ j=JSON.parse(ln.slice(5)); }catch(e){ continue; }
        if(j.type==='content_block_delta'&&j.delta?.text){ text+=j.delta.text; o.onPart&&o.onPart(text); }
        if(j.type==='message_stop') done=true;
        if(j.type==='error') throw new Error(j.error?.message||'모델 오류'); } }
  }catch(e){ if(!text) throw e; }   // 중간에 끊긴 경우: 받은 데까지 돌려주고 이어 쓰기
  return {text,done};
}
window.dsLLM=async function(system,user,o={}){
  let all='';
  for(let k=0;k<5;k++){
    const pre=all.replace(/\s+$/,'');
    let r; try{ r=await once(system,user,{...o,prefill:pre||undefined,onPart:t=>o.onText&&o.onText(pre+t)}); }catch(e){ if(!all) throw e; break; }
    if(pre&&o.restartRe&&o.restartRe.test(r.text)) break;     // 이어 쓰기가 처음부터 다시 쓰면 버림
    all=pre+r.text;
    if(r.done||!r.text||(o.endRe&&o.endRe.test(r.text))) break;
    o.onCont&&o.onCont(k+1);
  }
  return all;
};
})();
