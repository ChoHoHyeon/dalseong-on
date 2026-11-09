/* ============================================================
   달성On — 회의록 정리하기 (minutes.js)
   · 회의 메모·녹취 텍스트를 붙여넣으면 안건별 논의 요지 · 결정사항 · 후속조치(담당·기한)로 정리한 회의록 초안을 만든다.
   · 녹음 파일 변환은 외부 전송 문제로 넣지 않는다(내부망 음성인식 서버 연계 시 추가).
   · 결과 : 화면 미리보기 → 복사 / 한글(hwpx)
   ============================================================ */
(function(){
"use strict";
const $=s=>document.querySelector(s);
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const M={busy:false,out:null};

const SYS=`당신은 대구광역시 달성군의 회의록 작성 담당자입니다. 회의 메모·녹취를 바탕으로 회의록을 정리합니다.
· 발언을 그대로 옮기지 않고 개조식(명사형 종결)으로 요지만 정리한다. 발언자가 분명하면 "(○○과장)"처럼 괄호로 붙인다.
· 메모에 없는 내용은 지어내지 않는다. 결정이 안 난 사항은 「미결(추후 논의)」로 적는다.
· 후속조치는 "할 일 — 담당 — 기한" 세 가지가 보이게 쓴다. 기한·담당이 없으면 "○○".
· 날짜는 "2026. 11. 9.(월) 14:00" 형식.
반드시 아래 형식으로만 출력한다. 마크다운·표는 쓰지 않는다.
제목: (○○ 회의 결과 / 회의록)
# 1. 회의 개요
○ 일  시 : 
○ 장  소 : 
○ 참  석 : 
○ 안  건 : 
# 2. 안건별 논의 내용
□ (안건 1)
○ (논의 요지)
  - (세부)
□ (안건 2)
...
# 3. 결정 사항
○ ...
# 4. 후속 조치
○ (할 일) — 담당 ○○ — 기한 ○○
# 5. 기타
○ (다음 회의 일정 등, 없으면 "해당 없음")`;

const v=id=>($('#'+id).value||'').trim();
function fmtWhen(d,t){ if(!d) return ''; const dt=new Date(d+'T00:00:00'); const w='일월화수목금토'[dt.getDay()]; return `${dt.getFullYear()}. ${dt.getMonth()+1}. ${dt.getDate()}.(${w})${t?' '+t:''}`; }

function parse(t){
  const o={title:'',body:[]};
  t.split(/\r?\n/).forEach(raw=>{ const l=raw.replace(/\s+$/,''); const m=l.match(/^\s*제목\s*[:：]\s*(.*)$/); if(m&&!o.body.length){ o.title=m[1].trim(); return; } if(l.trim()||o.body.length) o.body.push(l.replace(/\*\*/g,'')); });
  while(o.body.length&&!o.body[o.body.length-1].trim()) o.body.pop();
  return o;
}
function offline(){
  const name=v('mtName')||'○○ 회의'; const ag=v('mtAgenda').split(/\r?\n/).map(x=>x.replace(/^[-·•\d.)\s]+/,'').trim()).filter(Boolean);
  const notes=v('mtNotes').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  const b=['# 1. 회의 개요',`○ 일  시 : ${fmtWhen(v('mtDate'),v('mtTime'))||'○○'}`,`○ 장  소 : ${v('mtPlace')||'○○'}`,`○ 참  석 : ${v('mtWho')||'○○'}`,`○ 안  건 : ${ag.join(', ')||'○○'}`,'# 2. 안건별 논의 내용'];
  (ag.length?ag:['○○']).forEach((a,i)=>{ b.push(`□ ${a}`); notes.slice(i*2,i*2+2).forEach(n=>b.push(`○ ${n}`)); if(!notes.slice(i*2,i*2+2).length) b.push('○ (모델 연결 시 메모에서 요지 정리)'); });
  b.push('# 3. 결정 사항','○ ○○ (메모의 결정 내용을 여기에)','# 4. 후속 조치','○ ○○ — 담당 ○○ — 기한 ○○','# 5. 기타','○ 해당 없음');
  return {title:`${name} 결과`,body:b};
}
function lineHtml(raw){
  const s=raw.trim(); if(!s) return '<div class="rp-blank"></div>';
  if(/^#\s/.test(s)) return `<div class="rp-sec">${esc(s.replace(/^#\s*/,''))}</div>`;
  if(/^□/.test(s)) return `<div class="rp-sq">${esc(s)}</div>`;
  if(/^(○|❍)/.test(s)) return `<div class="rp-cir">${esc(s)}</div>`;
  if(/^-/.test(s)) return `<div class="rp-dash">${esc(s)}</div>`;
  if(/^※/.test(s)) return `<div class="rp-note">${esc(s)}</div>`;
  return `<div class="rp-cir">${esc(s)}</div>`;
}
function render(o){
  $('#minutesView').innerHTML=`<div class="rp"><div class="rp-title">${esc(o.title)}</div><div class="rp-dept">달성군 <span>[${esc(v('mtDept')||'행정국 정보통신과')}]</span></div><div class="rp-body">${o.body.map(lineHtml).join('')}</div></div>`;
  $('#minutesOut').hidden=false; $('#minutesOut').scrollIntoView({behavior:'smooth',block:'start'});
}
async function callModel(user){
  const S=window.S||{}; const payload=JSON.stringify({model:S.model||'claude-sonnet-4-5',max_tokens:3000,stream:true,system:SYS,messages:[{role:'user',content:user}]});
  const r=S.key
    ? await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'content-type':'application/json','x-api-key':S.key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},body:payload})
    : await fetch('/api/chat',{method:'POST',headers:{'content-type':'application/json','x-access-code':S.code||''},body:payload});
  if(!r.ok) throw new Error('모델 호출 실패 ('+r.status+')');
  const rd=r.body.getReader(), dec=new TextDecoder(); let buf='',text='';
  while(true){ const {value,done}=await rd.read(); if(done) break; buf+=dec.decode(value,{stream:true});
    const ls=buf.split('\n'); buf=ls.pop();
    for(const ln of ls){ if(!ln.startsWith('data:')) continue; try{ const j=JSON.parse(ln.slice(5)); if(j.type==='content_block_delta'&&j.delta?.text){ text+=j.delta.text; $('#mtMsg').textContent=`정리 중… ${text.length}자`; } }catch(e){} } }
  return text;
}
async function make(){
  if(M.busy) return;
  if(!v('mtName')){ $('#mtMsg').textContent='회의명은 입력해 주세요.'; return $('#mtName').focus(); }
  if(!v('mtNotes')){ $('#mtMsg').textContent='회의 메모·녹취 내용을 붙여넣어 주세요.'; return $('#mtNotes').focus(); }
  M.busy=true; $('#mtGo').disabled=true; $('#mtMsg').textContent='정리 중…';
  try{
    const S=window.S||{};
    if((S.key||S.server)&&!S.offline){
      const u=[`<회의 정보>`,`회의명: ${v('mtName')}`,`일시: ${fmtWhen(v('mtDate'),v('mtTime'))||'○○'}`,`장소: ${v('mtPlace')||'○○'}`,`참석: ${v('mtWho')||'○○'}`,`안건:\n${v('mtAgenda')||'(메모에서 파악)'}`,`</회의 정보>`,`<회의 메모·녹취>`,v('mtNotes'),`</회의 메모·녹취>`].join('\n');
      M.out=parse(await callModel(u)); if(!M.out.body.length) throw new Error('응답 형식을 읽지 못했습니다. 다시 생성해 주세요.');
      $('#mtMsg').textContent='정리 완료 — 결정사항·담당·기한은 참석자 확인 후 확정하세요.';
    }else{ await new Promise(r=>setTimeout(r,400)); M.out=offline(); $('#mtMsg').textContent='오프라인 시연 모드 — 모델 연결 시 메모를 읽어 안건별로 정리합니다.'; }
    render(M.out); if(window.S&&S.stats) S.stats.gen++;
  }catch(err){ $('#mtMsg').textContent='⚠ '+err.message; }
  finally{ M.busy=false; $('#mtGo').disabled=false; }
}
async function hwpx(){
  if(!M.out) return;
  try{
    const blob=await DalseongHwpx.build({kind:'free', title:M.out.title, sub:`달성군 [${v('mtDept')||'행정국 정보통신과'}]`, date:fmtWhen(v('mtDate'),''), answer:M.out.body.join('\n')});
    const nm=`${M.out.title.replace(/[\\/:*?"<>|]/g,'').slice(0,40)}_${(v('mtDate')||new Date().toISOString().slice(0,10)).replace(/-/g,'')}.hwpx`;
    DalseongHwpx.download(blob,nm); if(window.S&&S.stats) S.stats.hwpx++; toast?.('한글 파일 생성: '+nm);
  }catch(e){ toast?.('한글 파일 생성 실패: '+e.message); }
}
function init(){
  if($('#mtGo')._on) return; $('#mtGo')._on=1;
  if(!$('#mtDate').value) $('#mtDate').value=new Date().toISOString().slice(0,10);
  $('#mtGo').onclick=make; $('#mtAgain').onclick=make; $('#mtHwpx').onclick=hwpx;
  $('#mtCopy').onclick=()=>{ if(!M.out) return; navigator.clipboard.writeText(M.out.title+'\n\n'+M.out.body.join('\n')); toast?.('복사했습니다'); };
  $('#mtSample').onclick=()=>{
    $('#mtName').value='2026년 데이터기반행정 실태점검 대응 회의'; $('#mtTime').value='14:00'; $('#mtPlace').value='군청 3층 소회의실';
    $('#mtWho').value='정보통신과장, 정보통계팀장, 조호현 주무관, 기획예산실 ○○○, 민원과 ○○○'; $('#mtAgenda').value='실태점검 지표별 담당 배정\n공동 데이터 분석 과제 선정\n정보화교육 하반기 일정';
    $('#mtNotes').value='과장: 11월 말 제출이니 지표별 담당 이번 주 안에 정하자. 1-1 개방은 조호현, 2지표 품질은 정보통계팀장이 맡는 걸로.\n팀장: 2-3 조치 결과는 이미 12개 시스템 최종진단 끝났고 결재만 남음. 다음 주 월요일까지 상신.\n기획예산실: 공동분석 과제는 인구이동이랑 상권 데이터 두 개 후보인데 경북 쪽이랑 협의 필요. 12월 초까지 결정.\n조호현: 정보화교육 하반기는 수요조사 14일까지 받고 과목 확정. 강사 섭외는 11월 셋째 주.\n민원과: 키오스크 교육은 민원실 장비 쓰면 되니 장소 협조 가능.\n과장: 다음 회의는 11월 24일 같은 시간.';
    toast?.('예시를 채웠습니다 — 「회의록 정리하기」를 눌러보세요');
  };
  /* 녹음 파일 → 글 → 바로 정리 */
  $('#mtAudio').onchange=async e=>{
    const f=e.target.files[0]; if(!f) return; if(!window.DsSTT){ $('#mtMsg').textContent='음성인식 모듈을 불러오지 못했습니다.'; return; }
    if(!v('mtName')) $('#mtName').value=f.name.replace(/\.[^.]+$/,'');
    $('#mtSttWrap').hidden=false; $('#mtGo').disabled=true; $('#mtAudio').disabled=true;
    const prog=p=>{ $('#mtSttBar').style.width=(p.pct||0)+'%'; $('#mtSttMsg').textContent=p.msg||''; if(p.text) $('#mtNotes').value=p.text; };
    try{
      const text=await DsSTT.transcribe(f,prog);
      $('#mtNotes').value=text; $('#mtSttBar').style.width='100%'; $('#mtSttMsg').textContent='글로 바꾸기 완료 — 이어서 회의록을 정리합니다';
      $('#mtGo').disabled=false; await make();
    }catch(err){ $('#mtSttMsg').textContent='⚠ '+err.message; $('#mtGo').disabled=false; }
    finally{ $('#mtAudio').disabled=false; $('#mtAudio').value=''; }
  };
  $('#mtReset').onclick=()=>{ ['mtName','mtTime','mtPlace','mtWho','mtAgenda','mtNotes'].forEach(id=>$('#'+id).value=''); $('#minutesOut').hidden=true; $('#mtMsg').textContent=''; $('#mtSttWrap').hidden=true; $('#mtSttBar').style.width='0'; };
}
window.MINUTES={init};
})();
