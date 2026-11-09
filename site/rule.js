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
· 사실·수치·상위 법령 조문 번호를 모르면 지어내지 않고 "○○" 또는 「○○법」 제○조로 비워 둔다.`;

function sys(mode){
  const common=`당신은 대구광역시 달성군의 자치법규(조례·규칙·훈령·예규) 입안 담당자입니다. 아래 기준을 그대로 따릅니다.
${RULE}

반드시 아래 형식으로만 출력합니다. 설명·마크다운 강조·표 문법은 쓰지 않습니다.`;
  if(mode==='amend') return `${common}
제목: (예: 달성군 ○○ 조례 일부개정조례안)
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
  const o={title:'',reason:'',main:[],table:[],body:[],buchik:'',check:[]}; let sec='',cur=null,sub='';
  t.split(/\r?\n/).forEach(raw=>{
    const l=raw.replace(/\s+$/,''); const s=l.trim();
    let m;
    if((m=s.match(/^제목\s*[:：]\s*(.*)$/))){ o.title=m[1].trim(); sec=''; return; }
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
    else if(sec==='buchik') o.buchik+=(o.buchik?'\n':'')+s;
    else if(sec==='check') o.check.push(s.replace(/^[-·•]\s*/,''));
  });
  const trim=a=>{ while(a.length&&!a[a.length-1].trim()) a.pop(); return a; };
  o.table.forEach(r=>{ trim(r.old); trim(r.neu);
    ['old','neu'].forEach(k=>{ let a=r[k].filter((l,i,arr)=>!(/^\s*<\s*(신\s*설|삭\s*제)\s*>\s*$/.test(l)&&arr.length>1));   // 본문이 있는데 끝에 <신 설> 표식만 따로 붙은 경우 제거
      if(a.length&&!/^\s*(제\d+조|<)/.test(a[0])) a=[r.art, ...a];                                                      // 조 제목(제n조(…))을 각 칸 첫 줄에
      r[k]=a; }); });
  trim(o.body);
  o.check=o.check.filter(x=>x&&!/^없음/.test(x));
  return o;
}

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
    return {title:`${name} 일부개정조례안`,reason:`「○○법」 개정 사항을 반영하고, ${gist[0]||'운영상 나타난 미비점'}을 개선·보완하려는 것임.`,
      main:gist.map((g,i)=>`${'가나다라마'[i]||'○'}. ${g}`),table:arts,body:[],buchik:'이 조례는 공포한 날부터 시행한다.',check:['상위 법령 위임근거(「○○법」 제○조) 확인 필요']};
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
  $('#ruleView').innerHTML=`<div class="rp">
    <div class="rp-title">${esc(o.title)}</div>
    <div class="rp-sec">1. ${mode==='amend'?'개정 이유':'제정 이유'}</div><div class="rp-cir" style="white-space:pre-wrap">${esc(o.reason)}</div>
    ${o.main.length?`<div class="rp-sec">2. 주요 내용</div>${o.main.map(m=>`<div class="rp-cir">${esc(m)}</div>`).join('')}`:''}
    ${o.body.length?`<div class="rp-sec">2. 조문</div><pre class="rp-law">${esc(o.body.join('\n'))}</pre>`:''}
    ${T?`<div class="rp-sec">3. 신구조문대비표</div>${T}`:''}
    <div class="rp-sec">${T||o.body.length?'4':'3'}. 부칙</div><div class="rp-cir" style="white-space:pre-wrap">${esc(o.buchik)}</div>
    ${o.check.length?`<div class="rp-check"><b>⚠ 담당자 확인 요청</b><ul>${o.check.map(c=>`<li>${esc(c)}</li>`).join('')}</ul></div>`:''}
  </div>`;
  $('#ruleOut').hidden=false; $('#ruleOut').scrollIntoView({behavior:'smooth',block:'start'});
}
function plainText(o){ const L=[o.title,'','1. 이유',o.reason]; if(o.main.length){L.push('','2. 주요 내용',...o.main);} if(o.body.length){L.push('','조문',...o.body);} if(o.table.length){L.push('','신구조문대비표'); o.table.forEach(r=>L.push(`[${r.art}]`,'현행:',...r.old,'개정안:',...r.neu,''));} L.push('부칙',o.buchik); if(o.check.length) L.push('','※ 확인 요청',...o.check.map(c=>'- '+c)); return L.join('\n'); }
async function copyTable(o){
  if(!o.table.length){ navigator.clipboard.writeText(plainText(o)); return toast?.('복사했습니다'); }
  const html=`<table border="1" style="border-collapse:collapse;width:100%"><tr><th style="width:50%">현  행</th><th>개 정 안</th></tr>${o.table.map(r=>`<tr><td style="vertical-align:top;white-space:pre-wrap">${esc(r.old.join('\n')||'<신  설>')}</td><td style="vertical-align:top;white-space:pre-wrap">${esc(r.neu.join('\n')||'<삭  제>')}</td></tr>`).join('')}</table>`;
  try{ await navigator.clipboard.write([new ClipboardItem({'text/html':new Blob([html],{type:'text/html'}),'text/plain':new Blob([plainText(o)],{type:'text/plain'})})]); toast?.('대비표를 표로 복사했습니다 — 한글에 붙여넣기(Ctrl+V)'); }
  catch(e){ navigator.clipboard.writeText(plainText(o)); toast?.('텍스트로 복사했습니다'); }
}

async function callModel(system,user){
  const S=window.S||{}; const payload=JSON.stringify({model:S.model||'claude-sonnet-4-5',max_tokens:4000,stream:true,system,messages:[{role:'user',content:user}]});
  const r=S.key
    ? await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'content-type':'application/json','x-api-key':S.key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},body:payload})
    : await fetch('/api/chat',{method:'POST',headers:{'content-type':'application/json','x-access-code':S.code||''},body:payload});
  if(!r.ok) throw new Error('모델 호출 실패 ('+r.status+')');
  const rd=r.body.getReader(), dec=new TextDecoder(); let buf='',text='';
  while(true){ const {value,done}=await rd.read(); if(done) break; buf+=dec.decode(value,{stream:true});
    const ls=buf.split('\n'); buf=ls.pop();
    for(const ln of ls){ if(!ln.startsWith('data:')) continue; try{ const j=JSON.parse(ln.slice(5)); if(j.type==='content_block_delta'&&j.delta?.text){ text+=j.delta.text; $('#ruMsg').textContent=`작성 중… ${text.length}자`; } }catch(e){} } }
  return text;
}

async function make(){
  if(U.busy) return; const mode=$('#ruMode').value;
  const name=($('#ruName').value||'').trim(), gist=($('#ruGist').value||'').trim(), cur=($('#ruCur').value||'').trim();
  if(!name){ $('#ruMsg').textContent='조례·지침 이름은 입력해 주세요.'; return $('#ruName').focus(); }
  if(mode==='amend'&&!cur){ $('#ruMsg').textContent='일부개정은 현행 조문을 붙여넣어야 대비표를 만듭니다.'; return $('#ruCur').focus(); }
  if(!gist){ $('#ruMsg').textContent=mode==='amend'?'개정 요지를 입력해 주세요.':'목적·주요 내용을 입력해 주세요.'; return $('#ruGist').focus(); }
  U.busy=true; $('#ruGo').disabled=true; $('#ruMsg').textContent='작성 중…';
  try{
    const S=window.S||{};
    if((S.key||S.server)&&!S.offline){
      const u=[`<작성 요청>`,`작업: ${mode==='amend'?'일부개정(신구조문대비표 포함)':'제정 조례·지침 초안'}`,`자치법규 이름: ${name}`,
        ($('#ruBase').value||'').trim()?`상위 법령·위임근거: ${$('#ruBase').value.trim()}`:'상위 법령·위임근거: 미확인(권리제한·의무부과·벌칙 조문은 만들지 말고 확인요청에 적을 것)',
        mode==='amend'?`현행 조문:\n${cur}`:'', `${mode==='amend'?'개정 요지':'목적·주요 내용'}:\n${gist}`,`</작성 요청>`].filter(Boolean).join('\n');
      const text=await callModel(sys(mode),u); U.out=parse(text,mode);
      if(!U.out.title||(!U.out.table.length&&!U.out.body.length)) throw new Error('응답 형식을 읽지 못했습니다. 다시 생성해 주세요.');
      $('#ruMsg').textContent='작성 완료 — 위임근거·상위 법령·용어는 법무 검토 전 담당자가 확인하세요.';
    }else{ await new Promise(r=>setTimeout(r,400)); U.out=offline(mode); $('#ruMsg').textContent='오프라인 시연 모드 — 모델 연결 시 조문을 작성합니다.'; }
    U.mode=mode; render(U.out,mode); if(window.S&&S.stats) S.stats.gen++,window.dsHit&&dsHit('gen');
  }catch(err){ $('#ruMsg').textContent='⚠ '+err.message; }
  finally{ U.busy=false; $('#ruGo').disabled=false; }
}

async function hwpx(){
  if(!U.out) return; const o=U.out;
  const L=[`# 1. ${U.mode==='amend'?'개정 이유':'제정 이유'}`,...o.reason.split('\n').map(x=>'○ '+x)];
  if(o.main.length) L.push('# 2. 주요 내용',...o.main.map(x=>'○ '+x));
  if(o.body.length) L.push('# 2. 조문',...o.body.filter(x=>x.trim()).map(x=>/^\s*제\d+조/.test(x)?'○ '+x.trim():'  - '+x.trim()));
  if(o.table.length){ L.push('# 3. 신구조문대비표 (한글에서 표로 정리)'); o.table.forEach(r=>{ L.push('□ '+r.art,'○ 현행',...r.old.map(x=>'  - '+x),'○ 개정안',...r.neu.map(x=>'  - '+x)); }); }
  L.push('# 부칙',...o.buchik.split('\n').map(x=>'○ '+x));
  if(o.check.length) L.push('# 담당자 확인 요청',...o.check.map(x=>'※ '+x));
  try{
    const blob=await DalseongHwpx.build({kind:'free', title:o.title, sub:'달성군 [행정국 정보통신과]', date:new Date().toLocaleDateString('ko-KR'), answer:L.join('\n')});
    const nm=`${o.title.replace(/[\\/:*?"<>|]/g,'').slice(0,40)}_${new Date().toISOString().slice(0,10).replace(/-/g,'')}.hwpx`;
    DalseongHwpx.download(blob,nm); if(window.S&&S.stats) S.stats.hwpx++; toast?.('한글 파일 생성: '+nm);
  }catch(e){ toast?.('한글 파일 생성 실패: '+e.message); }
}

function init(){
  if($('#ruGo')._on) return; $('#ruGo')._on=1;
  const sw=()=>{ const a=$('#ruMode').value==='amend'; $('#ruCurWrap').hidden=!a; $('#ruGistCap').textContent=a?'개정 요지':'목적·주요 내용'; $('#ruGist').placeholder=a?'한 줄에 하나씩 — 무엇을 어떻게 바꾸는지\n예) 지원 대상에 1인 가구 추가\n위원회 위원 수 10명 → 12명\n제8조 보고 주기 분기 → 반기':'한 줄에 하나씩\n예) 공공데이터 개방·품질관리 체계 마련\n공공데이터 책임관 지정·역할\n데이터 품질진단 연 1회 실시\n개방 심의위원회 구성'; };
  $('#ruMode').onchange=sw; sw();
  $('#ruGo').onclick=make; $('#ruAgain').onclick=make; $('#ruHwpx').onclick=hwpx;
  $('#ruCopy').onclick=()=>{ if(U.out) copyTable(U.out); };
  $('#ruSample').onclick=()=>{
    $('#ruMode').value='amend'; sw(); $('#ruName').value='달성군 공공데이터 제공 및 이용 활성화에 관한 조례'; $('#ruBase').value='「공공데이터의 제공 및 이용 활성화에 관한 법률」 제12조·제22조';
    $('#ruCur').value='제5조(공공데이터책임관) ① 군수는 공공데이터의 제공과 이용 활성화에 관한 업무를 총괄하는 공공데이터책임관을 지정한다.\n② 공공데이터책임관은 다음 각 호의 업무를 수행한다.\n  1. 공공데이터 제공 계획의 수립·시행\n  2. 공공데이터 목록의 관리\n  3. 그 밖에 공공데이터 제공에 필요한 사항\n\n제7조(품질관리) 군수는 공공데이터의 품질을 높이기 위하여 필요한 조치를 할 수 있다.';
    $('#ruGist').value='공공데이터책임관 업무에 "데이터기반행정 활성화 총괄" 추가\n제7조 품질관리를 재량("할 수 있다")에서 의무("하여야 한다")로 바꾸고 연 1회 이상 품질진단 실시 명시\n품질진단 결과 공표 근거 신설';
    toast?.('예시를 채웠습니다 — 「초안 만들기」를 눌러보세요');
  };
  $('#ruReset').onclick=()=>{ ['ruName','ruBase','ruCur','ruGist'].forEach(id=>$('#'+id).value=''); $('#ruleOut').hidden=true; $('#ruMsg').textContent=''; };
}
window.RULEDRAFT={init};
})();
