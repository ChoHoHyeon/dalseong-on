/* ============================================================
   달성On — 조례·지침 초안 만들기 (rule.js)
   · 일부개정 : 현행 조문 + 개정 요지 → 개정안 조문 · 신구조문대비표 · 개정 이유
   · 제정·지침 : 목적·주요 내용 → 조문 체계(목적-정의-적용범위-절차-서식) 초안
   · 위임근거가 확인되지 않는 권리제한·의무부과·벌칙 조문은 만들지 않고 「확인 요청」으로 돌린다(지방자치법 제28조).
   · 결과 : 화면 미리보기 → 복사(대비표는 표로 붙여넣기) / 한글(hwpx)
   ============================================================ */
(function(){
"use strict";
const $=s=>document.querySelector(s);
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const U={busy:false,out:null};

const RULE=`[자치법규 입안 기준 — 「지방자치법」 제28조, 법제처 「자치법규 입안 길라잡이」]
· 조문 형식: 제1조(목적) 처럼 "제n조(제목)" 뒤에 본문. 항은 ①②③, 호는 1. 2. 3., 목은 가. 나. 다.
· 제정 조례·지침의 기본 체계: 목적 → 정의 → 적용 범위(다른 법령과의 관계) → 책무·절차(실체 규정) → 위원회·지원(필요 시) → 서식·시행 세칙 위임 → 부칙(시행일).
· 조례는 법령의 범위에서 정하고, 주민의 권리 제한·의무 부과·벌칙은 법률의 위임이 있어야 한다. 위임근거가 확인되지 않으면 해당 조문을 만들지 말고 「확인 요청」 항목으로 적는다.
· 일부개정 시 개정 조문만 쓰고, 그대로 두는 조문은 "(현행과 같음)"으로 표시한다. 신설은 "<신  설>", 삭제는 "<삭  제>".
· 용어는 「행정기본법」·상위 법령 용어를 따르고, 한 조문에 한 가지 내용만 담는다. "하여야 한다"(의무) "할 수 있다"(재량) "한다"(선언)를 구분한다.
· 용어 통일: 군수→"달성군수(이하 "군수"라 한다)", 군→"대구광역시 달성군(이하 "군"이라 한다)".
· 사실·수치·상위 법령 조문 번호를 모르면 지어내지 않고 "○○" 또는 「○○법」 제○조로 비워 둔다.
· 제명은 "대구광역시 달성군 ○○ 조례"처럼 지자체 이름을 붙인 정식 제명으로 쓴다.
· 일부개정 개정문(법제처 개정문 작성례):
  - 첫 줄: "대구광역시 달성군 ○○ 조례 일부를 다음과 같이 개정한다."
  - 자구 수정: 제7조 중 "할 수 있다"를 "하여야 한다"로 한다.
  - 호·항 신설: 제5조제2항에 제4호를 다음과 같이 신설한다.  (다음 줄에 신설 호 전문)
  - 조 전부 개정: 제7조를 다음과 같이 한다.  (다음 줄에 바뀐 조 전문)
  - 삭제: 제9조를 삭제한다.
  - 같은 조 안 여러 변경은 "제7조 중 ~로 하고, 같은 조에 제2항 및 제3항을 각각 다음과 같이 신설한다."처럼 한 문장으로 잇는다.`;

function sys(mode){
  const common=`당신은 대구광역시 달성군의 자치법규(조례·규칙·훈령·예규) 입안 담당자입니다. 아래 기준을 그대로 따릅니다.
${RULE}

반드시 아래 형식으로만 출력합니다. 설명·마크다운 강조·표 문법은 쓰지 않습니다.`;
  if(mode==='amend') return `${common}
제목: (예: 대구광역시 달성군 ○○ 조례 일부개정조례안)
개정문:
(위 개정문 작성례대로. 첫 줄은 "… 조례 일부를 다음과 같이 개정한다.")
개정이유:
(2~4줄)
주요내용:
가. (한 줄)
나. (한 줄)
대비표:
@@ 제n조(제목)
현행:
(현행 조문 전체 — 입력된 조문을 그대로)
개정안:
(개정 조문 전체 — 바뀌는 부분만 고친 완전한 조문. 신설은 <신  설>, 삭제는 <삭  제>)
@@ 제m조(제목)
현행:
...
개정안:
...
부칙:
이 조례는 공포한 날부터 시행한다.
확인요청:
- (위임근거·상위법령·예산 등 담당자가 확인해야 할 사항, 없으면 "없음")`;
  return `${common}
제목: (예: 달성군 ○○ 지원 조례안 / 달성군 ○○ 운영 지침)
제정이유:
(2~4줄)
본문:
제1조(목적) 이 조례(지침)는 ...
제2조(정의) 이 조례에서 사용하는 용어의 뜻은 다음과 같다.
  1. "○○"란 ...을 말한다.
제3조(적용 범위) ...
(이하 조문 — 책무, 절차, 위원회·지원, 서식·시행세칙 위임 순. 조문은 8~15개 내외)
부칙:
이 조례는 공포한 날부터 시행한다.
확인요청:
- (위임근거·상위법령·예산 등 담당자가 확인해야 할 사항, 없으면 "없음")`;
}

/* 응답 파싱: 섹션 헤더(제목:/개정이유:/…) + 대비표 @@ 블록 */
function parse(t,mode){
  const o={title:'',amend:[],reason:'',main:[],table:[],body:[],buchik:'',check:[]}; let sec='',cur=null,sub='';
  t.split(/\r?\n/).forEach(raw=>{
    const l=raw.replace(/\s+$/,''); const s=l.trim();
    let m;
    if((m=s.match(/^제목\s*[:：]\s*(.*)$/))){ o.title=m[1].trim(); sec=''; return; }
    if(/^개정문\s*[:：]\s*$/.test(s)){ sec='amend'; return; }
    if(/^(개정이유|제정이유)\s*[:：]\s*$/.test(s)){ sec='reason'; return; }
    if(/^주요내용\s*[:：]\s*$/.test(s)){ sec='main'; return; }
    if(/^대비표\s*[:：]\s*$/.test(s)){ sec='table'; return; }
    if(/^본문\s*[:：]\s*$/.test(s)){ sec='body'; return; }
    if(/^부칙\s*[:：]?\s*$/.test(s)){ sec='buchik'; return; }
    if(/^확인\s*요청\s*[:：]\s*$/.test(s)){ sec='check'; return; }
    if(sec==='table'){
      if((m=s.match(/^@@\s*(.+)$/))){ cur={art:m[1].trim(),old:[],neu:[]}; o.table.push(cur); sub=''; return; }
      if(/^현행\s*[:：]\s*$/.test(s)){ sub='old'; return; }
      if(/^개정안\s*[:：]\s*$/.test(s)){ sub='neu'; return; }
      if(cur&&sub) cur[sub].push(l); return;
    }
    if(!s) { if(sec==='body'&&o.body.length) o.body.push(''); return; }
    if(sec==='reason') o.reason+=(o.reason?'\n':'')+s;
    else if(sec==='main') o.main.push(s);
    else if(sec==='body') o.body.push(l);
    else if(sec==='amend') o.amend.push(l);
    else if(sec==='buchik') o.buchik+=(o.buchik?'\n':'')+s;
    else if(sec==='check') o.check.push(s.replace(/^[-·•]\s*/,''));
  });
  const trim=a=>{ while(a.length&&!a[a.length-1].trim()) a.pop(); return a; };
  o.table.forEach(r=>{ trim(r.old); trim(r.neu);
    ['old','neu'].forEach(k=>{ let a=r[k].filter((l,i,arr)=>!(/^\s*<\s*(신\s*설|삭\s*제)\s*>\s*$/.test(l)&&arr.length>1));   // 본문이 있는데 끝에 <신 설> 표식만 따로 붙은 경우 제거
      if(a.length&&!/^\s*(제\d+조|<)/.test(a[0])) a=[r.art, ...a];                                                      // 조 제목(제n조(…))을 각 칸 첫 줄에
      r[k]=a; }); });
  trim(o.body); trim(o.amend);
  if(mode==='amend'&&!o.amend.length) o.amend=amendFromTable(o);
  o.check=o.check.filter(x=>x&&!/^없음/.test(x));
  return o;
}

/* 모델이 개정문을 빠뜨린 경우: 대비표에서 "제n조를 다음과 같이 한다." 형태로 만든다 */
function amendFromTable(o){
  const base=(o.title||'').replace(/\s*일부개정조례안\s*$/,'').replace(/안$/,'');
  const L=[`${base} 일부를 다음과 같이 개정한다.`,''];
  o.table.forEach(r=>{ const n=r.neu.filter(x=>x.trim()); const num=(r.art.match(/^제\d+조(?:의\d+)?/)||[r.art])[0];
    if(!n.length||/<\s*삭\s*제\s*>/.test(n.join(''))){ L.push(`${num}를 삭제한다.`); return; }
    if(n.every(x=>/현행과\s*같음/.test(x)||/^제\d+조/.test(x)&&/현행과\s*같음/.test(x))) return;
    L.push(`${num}를 다음과 같이 한다.`,...n.map(x=>x.replace(/\s*<\s*(신\s*설|개\s*정)\s*>\s*$/,''))); });
  return L;
}
/* 조문 줄 → 조례 서식 HTML (조 제목 굵게, 항·호·목 들여쓰기) */
function lawHtml(lines){
  return lines.map((raw,i)=>{ const t=raw.trim(); if(!t){ const nx=(lines.slice(i+1).find(x=>x.trim())||''); return /^\s*제\d+(조|장)/.test(nx)?'<div class="lw-gap"></div>':''; } let m;
    if(/^제\d+장\s/.test(t)) return `<p class="lw-ch">${esc(t)}</p>`;
    if((m=t.match(/^(제\d+조(?:의\d+)?\([^)]*\))\s*(.*)$/))) return `<p class="lw-art"><b>${esc(m[1])}</b> ${esc(m[2])}</p>`;
    if(/^[①-⑳]/.test(t)) return `<p class="lw-hang">${esc(t)}</p>`;
    if(/^\d+\.\s/.test(t)) return `<p class="lw-ho">${esc(t)}</p>`;
    if(/^[가-하]\.\s/.test(t)) return `<p class="lw-mok">${esc(t)}</p>`;
    return `<p class="lw-p">${esc(t)}</p>`; }).join('');
}
function lawLines(o,mode){ return mode==='amend'?o.amend:o.body; }

/* 오프라인 시연: 틀만 */
function offline(mode){
  const name=($('#ruName').value||'').trim()||'달성군 ○○ 조례';
  const gist=($('#ruGist').value||'').split(/\r?\n/).map(x=>x.replace(/^[-·•\d.)\s]+/,'').trim()).filter(Boolean);
  if(mode==='amend'){
    const cur=($('#ruCur').value||'').trim();
    const arts=[]; let a=null;
    cur.split(/\r?\n/).forEach(l=>{ const m=l.match(/^\s*(제\d+조(?:의\d+)?\s*\([^)]*\))/); if(m){ a={art:m[1].replace(/\s+/,''),old:[l.trim()],neu:[]}; arts.push(a);} else if(a&&l.trim()) a.old.push(l.trim()); });
    if(!arts.length) arts.push({art:'제○조(○○)',old:[cur||'(현행 조문을 붙여넣으세요)'],neu:[]});
    arts.forEach((r,i)=>{ r.neu=i===0&&gist.length?[r.old[0].replace(/\)\s.*$/,') ')+'○○ '+gist[0]+' (개정안 — 모델 연결 시 작성)']:['(현행과 같음)']; });
    const oo={title:`${name} 일부개정조례안`,reason:`「○○법」 개정 사항을 반영하고, ${gist[0]||'운영상 나타난 미비점'}을 개선·보완하려는 것임.`,
      main:gist.map((g,i)=>`${'가나다라마'[i]||'○'}. ${g}`),table:arts,body:[],buchik:'이 조례는 공포한 날부터 시행한다.',check:['상위 법령 위임근거(「○○법」 제○조) 확인 필요']};
    oo.amend=amendFromTable(oo); return oo;
  }
  const body=[`제1조(목적) 이 ${/지침|훈령|예규/.test(name)?'지침':'조례'}는 ${gist[0]||'○○'}에 필요한 사항을 규정함을 목적으로 한다.`,'',
    `제2조(정의) 이 ${/지침/.test(name)?'지침':'조례'}에서 사용하는 용어의 뜻은 다음과 같다.`,'  1. "○○"란 ○○을 말한다.','',
    '제3조(적용 범위) ○○에 대하여 다른 법령이나 조례에 특별한 규정이 있는 경우를 제외하고는 이 조례에서 정하는 바에 따른다.','',
    ...gist.slice(1,6).flatMap((g,i)=>[`제${4+i}조(○○) ${g}.`,'']),
    `제${4+Math.min(gist.length-1,5)}조(시행 세칙) 이 ${/지침/.test(name)?'지침':'조례'}의 시행에 필요한 사항은 군수가 따로 정한다.`];
  return {title:name.endsWith('안')?name:name+'안',reason:`${gist[0]||'○○'}을 위한 제도적 근거를 마련하려는 것임.`,main:[],table:[],body,buchik:'이 조례는 공포한 날부터 시행한다.',check:['위임근거 미확인 — 주민 권리 제한·의무 부과 조문이 필요하면 상위 법령 확인']};
}

/* 미리보기 */
function render(o,mode){
  const T=o.table.length?`<table class="rp-tbl"><thead><tr><th>현  행</th><th>개 정 안</th></tr></thead><tbody>${o.table.map(r=>`<tr><td><pre>${esc(r.old.join('\n')||'<신  설>')}</pre></td><td><pre>${esc(r.neu.join('\n')||'<삭  제>')}</pre></td></tr>`).join('')}</tbody></table>`:'';
  $('#ruleView').innerHTML=`<div class="lw-paper">
      <h3 class="lw-title">${esc(o.title)}</h3>
      <div class="lw-body">${lawHtml(lawLines(o,mode))}</div>
      <p class="lw-buchik">부      칙</p>
      <div class="lw-body">${lawHtml(o.buchik.split('\n'))}</div>
    </div>
    ${mode==='new'?compareHtml(U.struct,o):''}
    ${o.check.length?`<div class="rp-check"><b>⚠ 담당자 확인 요청</b><ul>${o.check.map(c=>`<li>${esc(c)}</li>`).join('')}</ul></div>`:''}
    <details class="lw-extra"><summary>📎 부속 자료 초안 — ${mode==='amend'?'개정 이유 · 주요 내용 · 신구조문대비표':'제정 이유'} <small>(별도 문서 서식은 추후 확정)</small></summary>
      <div class="rp">
        <div class="rp-sec">${mode==='amend'?'개정 이유':'제정 이유'}</div><div class="rp-cir" style="white-space:pre-wrap">${esc(o.reason)}</div>
        ${o.main.length?`<div class="rp-sec">주요 내용</div>${o.main.map(m=>`<div class="rp-cir">${esc(m)}</div>`).join('')}`:''}
        ${T?`<div class="rp-sec">신구조문대비표</div>${T}<div class="pact" style="margin-top:8px"><button id="ruCopyT">대비표 표로 복사</button></div>`:''}
      </div></details>`;
  const ct=$('#ruCopyT'); if(ct) ct.onclick=()=>copyTable(o);
  $('#ruleOut').hidden=false; window.dsSave&&dsSave('rule',o.title,lawText(o,mode)); $('#ruleOut').scrollIntoView({behavior:'smooth',block:'start'});
}
function lawText(o,mode){ return [o.title,'',...lawLines(o,mode),'','부      칙',o.buchik].join('\n'); }
function plainText(o){ const L=[o.title,'','1. 이유',o.reason]; if(o.main.length){L.push('','2. 주요 내용',...o.main);} if(o.body.length){L.push('','조문',...o.body);} if(o.table.length){L.push('','신구조문대비표'); o.table.forEach(r=>L.push(`[${r.art}]`,'현행:',...r.old,'개정안:',...r.neu,''));} L.push('부칙',o.buchik); if(o.check.length) L.push('','※ 확인 요청',...o.check.map(c=>'- '+c)); return L.join('\n'); }
async function copyTable(o){
  if(!o.table.length){ navigator.clipboard.writeText(plainText(o)); return toast?.('복사했습니다'); }
  const html=`<table border="1" style="border-collapse:collapse;width:100%"><tr><th style="width:50%">현  행</th><th>개 정 안</th></tr>${o.table.map(r=>`<tr><td style="vertical-align:top;white-space:pre-wrap">${esc(r.old.join('\n')||'<신  설>')}</td><td style="vertical-align:top;white-space:pre-wrap">${esc(r.neu.join('\n')||'<삭  제>')}</td></tr>`).join('')}</table>`;
  try{ await navigator.clipboard.write([new ClipboardItem({'text/html':new Blob([html],{type:'text/html'}),'text/plain':new Blob([plainText(o)],{type:'text/plain'})})]); toast?.('대비표를 표로 복사했습니다 — 한글에 붙여넣기(Ctrl+V)'); }
  catch(e){ navigator.clipboard.writeText(plainText(o)); toast?.('텍스트로 복사했습니다'); }
}

async function callModel(system,user,o={}){
  const S=window.S||{}; const msgs=[{role:'user',content:user}]; if(o.prefill) msgs.push({role:'assistant',content:o.prefill});
  const body={model:S.model||'claude-sonnet-4-5',max_tokens:o.max||4000,stream:true,system,messages:msgs};
  if(o.tools) body.tools=o.tools;
  const payload=JSON.stringify(body);
  const r=S.key
    ? await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'content-type':'application/json','x-api-key':S.key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},body:payload})
    : await fetch('/api/chat',{method:'POST',headers:{'content-type':'application/json','x-access-code':S.code||''},body:payload});
  if(!r.ok) throw new Error('모델 호출 실패 ('+r.status+')');
  const rd=r.body.getReader(), dec=new TextDecoder(); let buf='',text='';
  while(true){ const {value,done}=await rd.read(); if(done) break; buf+=dec.decode(value,{stream:true});
    const ls=buf.split('\n'); buf=ls.pop();
    for(const ln of ls){ if(!ln.startsWith('data:')) continue; try{ const j=JSON.parse(ln.slice(5));
      if(j.type==='content_block_delta'&&j.delta?.text){ text+=j.delta.text; o.onText&&o.onText(text); }
      if(j.type==='message_stop') o.done=true;
      if(j.type==='content_block_start'&&j.content_block?.type==='server_tool_use') o.onTool&&o.onTool(j.content_block.input);
      if(j.type==='error') throw new Error(j.error?.message||'모델 오류');
    }catch(e){ if(/모델 오류|overloaded|error/i.test(e.message)) throw e; } } }
  return text;
}
/* 긴 조례: 서버 함수 시간 제한(약 30초)으로 응답이 중간에 끊기면, 쓴 데까지를 이어서 계속 쓰게 한다(최대 5번) */
async function callLong(system,user,o={}){
  let all=''; for(let k=0;k<5;k++){ const oo={...o,prefill:all?all.replace(/\s+$/,''):undefined,onText:t=>o.onText&&o.onText((all?all.replace(/\s+$/,''):'')+t)};
    let part=''; try{ part=await callModel(system,user,oo); }catch(e){ if(!all) throw e; }
    all=(all?all.replace(/\s+$/,''):'')+part; if(oo.done||!part) break; o.onCont&&o.onCont(k+1); }
  return all;
}
const modelOn=()=>{ const S=window.S||{}; return (S.key||S.server)&&!S.offline; };
const jsonOf=t=>{ t=String(t); const f=[...t.matchAll(/```(?:json)?\s*([\s\S]*?)```/g)].map(m=>m[1]).reverse();
  for(const c of f){ try{ return JSON.parse(c); }catch(e){} }
  const end=t.lastIndexOf('}'); for(let i=t.indexOf('{');i>=0&&i<end;i=t.indexOf('{',i+1)){ try{ return JSON.parse(t.slice(i,end+1)); }catch(e){} } return null; };

/* ── 진행 단계 표시 ── */
const ST={};
function stepsInit(mode){
  const L=[['kw','요청 내용 정리','검색어를 뽑습니다'],['law','관련 법령 찾기','국가법령정보센터 · 상위 법령'],['ordin','다른 지자체 비슷한 조례 찾기','자치법규정보시스템 자료'],
    ['cur',mode==='amend'?'달성군 현행 조례 불러오기':'달성군에 같은 조례가 있는지 확인','달성군 자치법규'],['read','참고 조문 읽기','찾은 법령·조례 본문'],['write','조례안 작성','실제 조례 서식으로']];
  $('#ruStepList').innerHTML=L.map(([k,t,d],i)=>`<li id="rs-${k}" class="wait"><span class="rs-n">${i+1}</span><div><b>${t}</b><small>${d}</small><em></em></div><i class="rs-t"></i></li>`).join('');
  $('#ruRefs').innerHTML=''; $('#ruSteps').hidden=false; $('#ruSteps').scrollIntoView({behavior:'smooth',block:'start'});
}
function step(k,state,msg){ const li=$('#rs-'+k); if(!li) return; li.className=state; if(msg!=null) li.querySelector('em').textContent=msg;
  if(state==='run'){ if(li.dataset.st==='run'){ return; } li.dataset.st='run'; ST[k]=Date.now(); clearInterval(ST['_'+k]); ST['_'+k]=setInterval(()=>{ li.querySelector('.rs-t').textContent=Math.round((Date.now()-ST[k])/1000)+'초'; },500); }
  else { li.dataset.st=state; clearInterval(ST['_'+k]); if(ST[k]) li.querySelector('.rs-t').textContent=Math.max(1,Math.round((Date.now()-ST[k])/1000))+'초'; } }

/* ── 법령·조례 찾기: ① law.go.kr Open API(/api/law) → ② 모델 웹검색(law.go.kr·elis.go.kr 한정) → ③ 직접 찾아보기 링크 ── */
async function lawApi(qs){ const r=await fetch('/api/law?'+qs); const j=await r.json().catch(()=>({error:'응답 오류'})); if(!r.ok||j.error) throw new Error(j.error||('HTTP '+r.status)); return j; }
const fullName=x=>{ const o=/^(법률|대통령령|총리령|부령|.*부령)$/.test(x.kind||'')?'':(x.org||'').trim(), n=(x.name||'').trim(); return o&&!n.startsWith(o.split(' ').pop())&&!n.startsWith(o)?o+' '+n:n; };
const linkOf=(t,x)=>t==='law'?`https://www.law.go.kr/lsInfoP.do?lsiSeq=${x.mst}`:`https://www.law.go.kr/ordinInfoP.do?ordinSeq=${x.mst}`;
const searchLinks=q=>`<a href="https://www.law.go.kr/LSW/lsSc.do?query=${encodeURIComponent(q)}" target="_blank" rel="noopener">국가법령정보센터에서 「${esc(q)}」 찾기</a> · <a href="https://www.elis.go.kr/main" target="_blank" rel="noopener">자치법규정보시스템 열기</a>`;
function baseName(n){ return String(n||'').replace(/^(대구광역시\s*)?달성군\s*/,'').replace(/\s*(일부개정|전부개정)?조례안?$|\s*(규칙|지침|훈령|예규)안?$/,'').replace(/에\s*관한$/,'').trim(); }
async function keywords(mode,name,gist){
  const fb={law:[baseName(name)],ordin:[baseName(name)]};
  if(!modelOn()) return fb;
  try{ const t=await callModel('자치법규 검색어를 뽑는 도우미. JSON만 출력.',`조례 이름: ${name}\n내용: ${gist}\n\n국가법령정보센터 검색에 쓸 짧은 검색어를 뽑아 JSON으로만 답하세요.\n※ 법령·조례 "이름"에 들어 있는 낱말로만 검색됩니다. 이름에 실제로 들어갈 1~2단어 명사로 쓰세요.\n{"law":["상위 법률 이름 검색어 1~2개 (예: 공공데이터, 지능정보화)"],"ordin":["다른 지자체 조례 이름 검색어 2~3개, 짧은 것부터 (예: 공공데이터, 데이터 품질)"]}`,{max:300});
    const j=jsonOf(t); if(j&&j.law&&j.ordin) return {law:j.law.slice(0,2),ordin:j.ordin.slice(0,3)}; }catch(e){}
  return fb;
}
async function webRefs(mode,name,gist){
  const t=await callModel('당신은 자치법규 조사원입니다. 반드시 웹 검색으로 확인한 것만 적고, 결과는 JSON만 출력합니다.',
`아래 조례를 ${mode==='amend'?'개정':'제정'}하려 합니다. 국가법령정보센터(law.go.kr)와 자치법규정보시스템(elis.go.kr)에서 찾아 주세요.
조례 이름: ${name}
넣고 싶은 내용: ${gist}

1) 근거가 되는 상위 법령(법률·시행령) 2~3개와 관련 조문 번호
2) 다른 지자체(광역·기초)의 비슷한 조례 3~5개와 참고할 만한 조문 요지
${mode==='amend'?'3) 대구광역시 달성군의 해당 현행 조례가 있으면 그 조문 원문':''}
JSON 형식: {"laws":[{"name":"","articles":"제n조(…) 요지","url":""}],"ordins":[{"org":"","name":"","points":"참고 조문 요지","url":""}]${mode==='amend'?',"current":"달성군 현행 조문 원문(없으면 빈칸)"':''}}`,
    {max:3000,tools:[{type:'web_search_20250305',name:'web_search',max_uses:4,allowed_domains:['law.go.kr','elis.go.kr']}],onTool:i=>{ if(i&&i.query) step(U.stepNow||'law','run','검색: '+i.query); }});
  const j=jsonOf(t); if(!j) throw new Error('검색 결과를 읽지 못했습니다'); return j;
}

async function findRefs(mode,name,gist){
  const R={laws:[],ordins:[],current:'',texts:[],via:''};
  step('kw','run'); const kw=await keywords(mode,name,gist); step('kw','done','검색어: '+[...new Set([...kw.law,...kw.ordin])].join(', '));
  // ① Open API — 단계마다 따로 시도(한 단계가 막혀도 나머지는 계속), 결과 0건이면 짧은 검색어로 한 번 더
  const qs=a=>[...new Set(a.flatMap(q=>[q,String(q).split(/\s+/)[0]]).filter(Boolean))];
  let okLaw=false, okOrd=false;
  step('law','run');
  try{ for(const q of qs(kw.law)){ if(R.laws.length>=4) break; const j=await lawApi('target=law&n=5&q='+encodeURIComponent(q)); j.list.forEach(x=>{ if(!R.laws.some(y=>y.mst===x.mst)) R.laws.push({...x,url:linkOf('law',x)}); }); }
    R.laws=R.laws.filter(x=>!/시행규칙/.test(x.name)&&!/^(법원|대법원|선거관리위원회|중앙선거관리위원회|국회|헌법재판소|감사원)\s/.test(x.name)&&!/규칙$/.test(x.kind||'')).slice(0,4); okLaw=true; step('law','done',R.laws.length?R.laws.map(x=>x.name).join(' · '):'찾은 법령 없음'); }
  catch(e){ R.lawErr=e.message; step('law','skip',/미신청|읽지 못/.test(e.message)?'법령 API 미신청 — 다른 지자체 조례로 상위 법령을 확인합니다':'연결 안 됨'); }
  step('ordin','run');
  try{ for(const q of qs(kw.ordin)){ if(R.ordins.length>=5) break; const j=await lawApi('target=ordin&n=20&q='+encodeURIComponent(q)); j.list.forEach(x=>{ if(!/달성군/.test(x.org)&&!/의회/.test(x.name)&&!R.ordins.some(y=>y.mst===x.mst)) R.ordins.push({...x,url:linkOf('ordin',x)}); }); }
    R.ordins=R.ordins.slice(0,5); okOrd=true; step('ordin','done',R.ordins.length?R.ordins.length+'건 — '+R.ordins.slice(0,3).map(fullName).join(' · '):'찾은 조례 없음'); }
  catch(e){ R.apiErr=e.message; step('ordin','skip','연결 안 됨'); }
  if(okLaw||okOrd){
    step('cur','run');
    try{ let own=[]; for(const q of qs([baseName(name)])){ own=(await lawApi('target=ordin&org=달성군&n=5&q='+encodeURIComponent('달성군 '+q))).list; if(own.length) break; }
      if(mode==='amend'){ const hit=own[0]; if(hit&&!$('#ruCur').value.trim()){ const b=await lawApi('target=ordin&mst='+hit.mst); R.current=b.text; step('cur','done','불러옴: '+hit.name); } else step('cur','done',$('#ruCur').value.trim()?'입력한 현행 조문 사용':'달성군 조례를 찾지 못함 — 현행 조문을 붙여넣어 주세요'); }
      else step('cur','done',own.length?`⚠ 비슷한 달성군 조례 있음: ${own.slice(0,2).map(x=>x.name).join(' · ')} — 「고치기」가 맞는지 확인하세요`:'같은 내용의 달성군 조례 없음'); }
    catch(e){ step('cur','skip','확인 못 함'); }
    step('read','run');
    for(const x of [...R.ordins.slice(0,3),...R.laws.slice(0,1)]){ try{ const b=await lawApi(`target=${R.laws.includes(x)?'law':'ordin'}&mst=${x.mst}`); R.texts.push({name:fullName(x),org:x.org||'',law:R.laws.includes(x),titles:artTitles(b.text),text:b.text.slice(0,4000)}); step('read','run',`${R.texts.length}건 읽음`); }catch(e){} }
    step('read','done',R.texts.length?R.texts.map(x=>x.name).join(' · '):'본문을 읽지 못함');
    R.via='api'; return R;
  }
  // ② 모델 웹검색
  if(modelOn()){
    try{ U.stepNow='law'; step('law','run','웹 검색으로 찾는 중'); step('ordin','run','웹 검색으로 찾는 중');
      const j=await webRefs(mode,name,gist);
      R.laws=(j.laws||[]).slice(0,4); R.ordins=(j.ordins||[]).slice(0,5); R.current=j.current||'';
      step('law','done',R.laws.length?R.laws.map(x=>x.name).join(' · '):'찾은 법령 없음');
      step('ordin','done',R.ordins.length?R.ordins.length+'건 — '+R.ordins.slice(0,3).map(fullName).join(' · '):'찾은 조례 없음');
      step('cur','done',mode==='amend'?(R.current?'현행 조문 찾음(원문 대조 필요)':($('#ruCur').value.trim()?'입력한 현행 조문 사용':'찾지 못함 — 현행 조문을 붙여넣어 주세요')):'웹 검색 결과로 확인');
      step('read','done','검색 요지로 대신함 (본문 대조는 담당자 확인)');
      R.via='web'; return R;
    }catch(e){ R.webErr=e.message; }
  }
  ['law','ordin','cur','read'].forEach(k=>step(k,'skip','연결 안 됨 — 아래 링크로 직접 확인'));
  $('#ruRefs').innerHTML=`<p class="hint">⚠ 법령 검색에 연결하지 못했습니다 (${esc(R.apiErr||'')}). ${searchLinks(baseName(name))}</p>`;
  R.via='none'; return R;
}
/* 조문 구성 비교: 참고 조례들의 조 제목을 모아 몇 곳에 공통으로 있는지 센다 */
function artTitles(t){ return [...String(t).matchAll(/제\d+조(?:의\d+)?\s*\(([^)]+)\)/g)].map(m=>m[1].trim()).filter(x=>!/^삭제/.test(x)); }
function normT(t){ return String(t).replace(/\s|ㆍ|·|,/g,'').replace(/^(공공데이터|데이터)(의)?/,'').replace(/(에관한사항|등)$/,'').replace(/적용범위/,'적용범위').replace(/^(군수|도지사|시장|구청장|지방자치단체|자치단체장)의?책무/,'책무').replace(/^(조례|규칙)?시행규칙$|^규칙$|^시행세칙$/,'시행규칙').replace(/위원회의?설치및구성|위원회설치/,'위원회설치'); }
function structOf(R){
  const refs=(R.texts||[]).filter(x=>!x.law&&x.titles&&x.titles.length); if(refs.length<2) return null;
  const M=new Map();
  refs.forEach((r,i)=>{ const seen=new Set(); r.titles.forEach(t=>{ const k=normT(t); if(!k||seen.has(k)) return; seen.add(k); if(!M.has(k)) M.set(k,{label:t,k,in:new Set()}); M.get(k).in.add(i); }); });
  const rows=[...M.values()].map(x=>({...x,n:x.in.size})).sort((a,b)=>b.n-a.n);
  const avg=Math.round(refs.reduce((a,r)=>a+r.titles.length,0)/refs.length);
  return {refs,rows,avg,common:rows.filter(x=>x.n>=2)};
}
function hasT(list,k){ return list.some(t=>{ const a=normT(t); return a===k||(a.length>=2&&k.length>=2&&(a.includes(k)||k.includes(a))); }); }
function compareHtml(st,o){
  if(!st) return ''; const mine=artTitles(lawLines(o,U.mode).join('\n'));
  const short=r=>(r.org||r.name).replace(/^(대구광역시|경기도|경상북도|경상남도|전라남도|전라북도|전북특별자치도|충청남도|충청북도|강원특별자치도|제주특별자치도)\s+/,'').slice(0,8)||'참고';
  const rows=st.rows.filter(x=>x.n>=2||hasT(mine,x.k)).concat(mine.filter(t=>!st.rows.some(x=>x.k===normT(t)||hasT([t],x.k))).map(t=>({label:t,k:normT(t),in:new Set(),n:0,only:1})));
  const miss=st.common.filter(x=>!hasT(mine,x.k));
  return `<div class="ru-cmp"><b>📋 비슷한 조례와 조문 구성 비교</b> <small>참고 조례 ${st.refs.length}건 · 평균 ${st.avg}개 조 / 이번 초안 ${mine.length}개 조${miss.length?` · <span class="miss">공통 조문 중 빠진 것 ${miss.length}개</span>`:' · 공통 조문 모두 포함'}</small>
    <div class="ru-cmpwrap"><table><thead><tr><th>조문</th>${st.refs.map(r=>`<th title="${esc(r.name)}">${esc(short(r))}</th>`).join('')}<th class="me">이번 초안</th></tr></thead><tbody>
    ${rows.map(x=>{ const m=hasT(mine,x.k)||x.only; return `<tr class="${!m&&x.n>=2?'miss':''}"><td>${esc(x.label)}${x.only?' <i>추가</i>':''}</td>${st.refs.map((r,i)=>`<td>${x.in.has(i)?'●':''}</td>`).join('')}<td class="me">${m?'✔':(x.n>=2?'빠짐':'')}</td></tr>`; }).join('')}
    </tbody></table></div></div>`;
}

function refsHtml(R){
  if(!R||(!R.laws.length&&!R.ordins.length)) return '';
  const li=(x,t)=>`<li><a href="${esc(x.url||'#')}" target="_blank" rel="noopener">${esc(fullName(x))}</a>${x.articles||x.points?`<small>${esc(x.articles||x.points)}</small>`:''}</li>`;
  return `<div class="ru-refs"><b>📚 참고한 법령·조례</b> <small>${R.via==='api'?'국가법령정보센터 Open API':'웹 검색(law.go.kr·elis.go.kr)'} · 링크를 눌러 원문을 확인하세요</small>
    <div class="ru-refcols">${R.laws.length?`<div><i>상위 법령</i><ul>${R.laws.map(x=>li(x,'law')).join('')}</ul></div>`:''}${R.ordins.length?`<div><i>다른 지자체 조례</i><ul>${R.ordins.map(x=>li(x,'ordin')).join('')}</ul></div>`:''}</div></div>`;
}

async function make(){
  if(U.busy) return; const mode=$('#ruMode').value;
  const name=($('#ruName').value||'').trim(), gist=($('#ruGist').value||'').trim();
  if(!name){ $('#ruMsg').textContent='조례·지침 이름을 입력해 주세요.'; return $('#ruName').focus(); }
  if(!gist){ $('#ruMsg').textContent='넣고 싶은 내용을 문장으로 적어 주세요.'; return $('#ruGist').focus(); }
  U.busy=true; $('#ruGo').disabled=true; $('#ruMsg').textContent=''; $('#ruleOut').hidden=true;
  stepsInit(mode);
  try{
    const R=await findRefs(mode,name,gist); U.refs=R;
    if(mode==='amend'&&!$('#ruCur').value.trim()&&R.current){ $('#ruCur').value=R.current; $('#ruCurWrap').hidden=false; $('#ruCurState').textContent='— 자동으로 불러옴 (원문과 대조하세요)'; }
    const cur=($('#ruCur').value||'').trim();
    $('#ruRefs').innerHTML=refsHtml(R)+($('#ruRefs').innerHTML.includes('⚠')?$('#ruRefs').innerHTML:'');
    step('write','run');
    if(modelOn()){
      const ref=[
        R.laws.length?'[상위 법령]\n'+R.laws.map(x=>`- ${x.name}${x.articles?' : '+x.articles:''}`).join('\n'):'',
        R.ordins.length?'[다른 지자체 비슷한 조례]\n'+R.ordins.map(x=>`- ${fullName(x)}${x.points?' : '+x.points:''}`).join('\n'):'',
        ...R.texts.map(x=>`[참고 본문 — ${x.name}]\n${x.text}`)].filter(Boolean).join('\n\n');
      const st=structOf(R); U.struct=st;
      const stTxt=st?`\n[참고 조례 조문 구성 — ${st.refs.length}개 조례 중 몇 곳에 있는지]\n`+st.rows.slice(0,30).map(x=>`- ${x.label} (${x.n}/${st.refs.length})`).join('\n')
        +`\n※ 2곳 이상에 공통으로 있는 조문은 담당자 내용과 무관하지 않은 한 빠짐없이 넣으세요(목적·정의·적용 범위·다른 조례와의 관계·책무·계획·책임관·위원회·위탁·평가 및 포상·시행규칙 등). 넣지 않기로 한 공통 조문은 확인요청에 "제외: 조문명 — 이유"로 적으세요. 조문 수는 참고 조례 평균(약 ${st.avg}개) 수준으로 쓰세요.`:'';
      const u=[`<작성 요청>`,`작업: ${mode==='amend'?'일부개정(개정문 + 신구조문대비표)':'제정 조례·지침 초안'}`,`자치법규 이름: ${name}`,
        ($('#ruBase').value||'').trim()?`담당자가 알려준 상위 법령: ${$('#ruBase').value.trim()}`:'',
        mode==='amend'?(cur?`현행 조문:\n${cur}`:'현행 조문: (없음 — 개정 대상 조문을 추정하지 말고 확인요청에 적을 것)'):'',
        `담당자가 넣고 싶은 내용(문장 그대로 — 이것이 초안의 기준):\n${gist}`,`</작성 요청>`,
        ref?`\n<참고 자료 — 검색으로 찾은 것>\n${ref}${mode==='new'?stTxt:''}\n</참고 자료>\n※ 담당자 내용을 기준으로 쓰고, 참고 자료는 조문 체계·표현·위임근거 확인에만 쓰세요. 참고 자료에 없는 상위 법령 조문 번호는 지어내지 말고 「○○법」 제○조로 비워 두세요. 다른 지자체 조문을 그대로 베끼지 말고 달성군 실정에 맞게 쓰세요.`:''].filter(Boolean).join('\n');
      const text=await callLong(sys(mode),u,{max:8000,onText:t=>step('write','run',`${t.length}자 작성 중`)}); U.out=parse(text,mode);
      if(!U.out.title||(!U.out.table.length&&!U.out.body.length&&!U.out.amend.length)) throw new Error('응답 형식을 읽지 못했습니다. 다시 생성해 주세요.');
      step('write','done','완료');
      $('#ruMsg').textContent='작성 완료 — 위임근거·상위 법령·용어는 법무 검토 전 담당자가 확인하세요.';
    }else{ await new Promise(r=>setTimeout(r,400)); U.out=offline(mode); step('write','done','오프라인 모드 — 틀만 만들었습니다'); }
    U.mode=mode; render(U.out,mode); if(window.S&&S.stats) S.stats.gen++; window.dsHit&&dsHit('gen','rule');
  }catch(err){ step('write','fail','⚠ '+err.message); $('#ruMsg').textContent='⚠ '+err.message; }
  finally{ U.busy=false; $('#ruGo').disabled=false; }
}

async function hwpx(){
  if(!U.out) return; const o=U.out;
  try{
    const blob=await DalseongHwpx.build({kind:'law', title:o.title, lines:[...lawLines(o,U.mode),'','부      칙',...o.buchik.split('\n')]});
    const nm=`${o.title.replace(/[\\/:*?"<>|]/g,'').slice(0,40)}_${new Date().toISOString().slice(0,10).replace(/-/g,'')}.hwpx`;
    DalseongHwpx.download(blob,nm); if(window.S&&S.stats) S.stats.hwpx++; toast?.('한글 파일 생성: '+nm);
  }catch(e){ toast?.('한글 파일 생성 실패: '+e.message); }
}

/* 고치기: 달성군 조례 찾기 → 고르면 현행 조문 불러오기 */
async function findOwn(){
  const q=baseName($('#ruName').value)||$('#ruName').value.trim(); if(!q){ $('#ruName').focus(); return; }
  const box=$('#ruPick'); box.hidden=false; box.innerHTML='<span class="hint">달성군 조례 찾는 중…</span>';
  try{ const j=await lawApi('target=ordin&org=달성군&n=8&q='+encodeURIComponent('달성군 '+q));
    if(!j.list.length){ box.innerHTML=`<span class="hint">「${esc(q)}」 달성군 조례를 찾지 못했습니다. 이름을 줄여 보거나 현행 조문을 직접 붙여넣어 주세요.</span>`; return; }
    box.innerHTML=j.list.map(x=>`<button type="button" data-mst="${esc(x.mst)}" data-name="${esc(x.name)}">${esc(x.name)} <small>${esc(x.kind)} · 시행 ${esc(x.date)}</small></button>`).join('');
    box.querySelectorAll('button').forEach(b=>b.onclick=async()=>{ $('#ruName').value=b.dataset.name; box.innerHTML='<span class="hint">현행 조문 불러오는 중…</span>';
      try{ const t=await lawApi('target=ordin&mst='+b.dataset.mst); $('#ruCur').value=t.text; $('#ruCurWrap').hidden=false; $('#ruCurWrap').open=true; $('#ruCurState').textContent='— 불러옴: '+b.dataset.name; box.hidden=true; }
      catch(e){ box.innerHTML=`<span class="hint">⚠ 본문을 불러오지 못했습니다 — 직접 붙여넣어 주세요 (${esc(e.message)})</span>`; } });
  }catch(e){ box.innerHTML=`<span class="hint">⚠ 법령 검색 연결 안 됨 — 현행 조문을 아래에 직접 붙여넣어 주세요. ${searchLinks(q)}</span>`; $('#ruCurWrap').hidden=false; $('#ruCurWrap').open=true; }
}

function init(){
  if($('#ruGo')._on) return; $('#ruGo')._on=1;
  const sw=m=>{ $('#ruMode').value=m; document.querySelectorAll('.ru-mode').forEach(b=>b.classList.toggle('on',b.dataset.mode===m)); const a=m==='amend';
    $('#ruCurWrap').hidden=!a; $('#ruFind').hidden=!a; $('#ruPick').hidden=true;
    $('#ruNameCap').firstChild.textContent=a?'고칠 달성군 조례 이름 ':'만들 조례·지침 이름 '; $('#ruNameHint').textContent=a?'이름 일부만 넣고 「달성군 조례 찾기」':'가제여도 됩니다';
    $('#ruName').placeholder=a?'예) 공공데이터 제공 및 이용 활성화':'예) 달성군 공공데이터 품질관리 조례';
    $('#ruGist').placeholder=a?'무엇을 왜 바꾸고 싶은지 문장으로 편하게 적어 주세요.\n예) 공공데이터책임관이 하는 일에 데이터기반행정 업무 총괄도 넣고 싶어요. 품질관리는 지금 "할 수 있다"로 되어 있는데 매년 한 번 이상 품질진단을 꼭 하도록 바꾸고, 결과를 홈페이지에 공개하는 근거도 만들고 싶습니다.'
      :'어떤 내용을 담고 싶은지 문장으로 편하게 적어 주세요.\n예) 우리 군이 가진 공공데이터의 품질을 체계적으로 관리하고 싶어요. 부서마다 데이터 관리 책임자를 두고, 매년 품질진단을 해서 결과를 공개하고, 우수 부서는 포상할 수 있게 하고 싶습니다. 진단 방법은 군수가 따로 정하도록 하면 좋겠어요.'; };
  document.querySelectorAll('.ru-mode').forEach(b=>b.onclick=()=>sw(b.dataset.mode)); sw($('#ruMode').value||'new');
  $('#ruFind').onclick=findOwn; $('#ruName').addEventListener('keydown',e=>{ if(e.key==='Enter'&&$('#ruMode').value==='amend'){ e.preventDefault(); findOwn(); } });
  $('#ruGo').onclick=make; $('#ruAgain').onclick=make; $('#ruHwpx').onclick=hwpx;
  $('#ruCopy').onclick=()=>{ if(!U.out) return; navigator.clipboard.writeText(lawText(U.out,U.mode)); toast?.('조례안을 복사했습니다 — 한글에 붙여넣기'); };
  $('#ruSample').onclick=()=>{
    if($('#ruMode').value==='amend'){
      $('#ruName').value='지능정보화'; $('#ruCur').value='';
      $('#ruGist').value='생성형 AI 같은 인공지능을 행정업무에 활용하는 근거를 넣고 싶습니다. 군수가 매년 세우는 실행계획에 AI 활용 계획도 포함하게 하고, 직원들에게 AI 활용 교육을 할 수 있게 하고 싶어요. 그리고 AI를 쓸 때 개인정보와 비공개 자료를 넣지 않는 등 지켜야 할 원칙도 조문으로 두고 싶습니다.';
      findOwn().then(()=>{ const b=document.querySelector('#ruPick button'); if(b) b.click(); });
    }else{
      $('#ruName').value='대구광역시 달성군 공공데이터 품질관리 조례';
      $('#ruGist').value='우리 군이 가진 공공데이터의 품질을 체계적으로 관리하고 싶습니다. 부서마다 데이터 관리 책임자를 두고, 매년 품질진단을 해서 결과를 홈페이지에 공개하고, 품질관리를 잘한 부서와 직원은 포상할 수 있게 하고 싶어요. 진단 방법과 세부 기준은 군수가 따로 정하도록 하면 좋겠습니다.';
    }
    toast?.('예시를 채웠습니다 — 「초안 만들기」를 눌러보세요');
  };
  $('#ruReset').onclick=()=>{ ['ruName','ruBase','ruCur','ruGist'].forEach(id=>$('#'+id).value=''); $('#ruleOut').hidden=true; $('#ruSteps').hidden=true; $('#ruPick').hidden=true; $('#ruMsg').textContent=''; };
}
window.RULEDRAFT={init};
})();
