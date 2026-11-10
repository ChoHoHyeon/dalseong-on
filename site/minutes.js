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

const SYS_TALK=`당신은 대구광역시 달성군의 회의록 작성 담당자입니다. 회의 녹취·메모를 바탕으로 문서 하나를 씁니다 — 앞부분은 "회의 결과 요약", 뒷부분은 발언 순서대로 적은 "회의록"입니다.
[앞부분 — 결과 요약]
· 발언을 그대로 옮기지 않고 안건별 요지를 개조식(명사형 종결)으로 정리한다.
· 결정이 안 난 사항은 「미결(추후 논의)」. 후속조치는 "할 일 — 담당 — 기한" 세 가지가 보이게, 없으면 "○○". 날짜는 "2026. 11. 9.(월) 14:00" 형식.
[뒷부분 — 회의록(발언 기록)]
· 회의록은 녹취 문장을 거의 그대로 옮긴다(가져다 붙이는 수준). 요약하거나 문어체("~하겠다")로 바꾸지 말고 말한 그대로의 존댓말·말투를 살린다. 빼는 것은 "어", "음", "네네", 말 더듬기, 같은 말 반복, 말하다 끊긴 토막뿐이고, 내용이 있는 문장은 빠뜨리지 않는다. 발언자가 바뀌는 지점마다 줄을 나눈다. 문장 순서는 녹취 순서를 지킨다. 녹음 인식이 틀린 것이 분명한 낱말(예: 결제→결재, 정보와 교육→정보화교육)만 바로잡는다.
· 녹취에는 발언자 표시가 없다. 직위·이름을 추정해 붙이지 말고, 처음 말한 순서대로 "참석자1", "참석자2", "참석자3"…으로 적는다. 같은 사람임이 분명하면 같은 번호. 발언이 바뀐 지점이 분명하지 않으면 한 사람의 발언으로 묶는다.
· 녹취·메모에 없는 내용은 앞뒤 어디에도 지어내지 않는다. 녹취에 나온 날짜에 요일을 새로 붙이지 않는다(요일이 틀리기 쉬움 — "11. 14.까지"처럼 날짜만). 회의 일시만 회의 정보의 요일을 쓴다.
반드시 아래 형식으로만 출력한다. 마크다운·표는 쓰지 않는다.
제목: (회의명) 결과
# 1. 회의 개요
○ 일  시 : 
○ 장  소 : 
○ 참  석 : 
○ 안  건 : 
# 2. 안건별 논의 요지
□ (안건 1)
○ (논의 요지)
  - (세부)
# 3. 결정 사항
○ ...
# 4. 후속 조치
○ (할 일) — 담당 ○○ — 기한 ○○
# 5. 기타
○ (다음 회의 일정 등, 없으면 "해당 없음")
# 6. 회의록
[안건 1] (안건명)
참석자1: (녹취 문장 그대로)
참석자2: (녹취 문장 그대로)
→ 결정: (이 안건에서 정해진 것, 없으면 줄 생략)
[안건 2] (안건명)
...`;
const kind=()=>($('#mtKind')&&$('#mtKind').value)||'talk';
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
/* 회의록 양식 미리보기: 개요 표 → 안건별 논의 → 결정사항 → 조치사항 표 → 기타 */
function sections(body){
  const out=[]; let cur=null;
  body.forEach(raw=>{ const s=raw.trim(); if(!s) return; const m=s.match(/^#\s*\d*\.?\s*(.+)$/); if(m){ cur={name:m[1].trim(),lines:[]}; out.push(cur); return; } if(!cur){ cur={name:'',lines:[]}; out.push(cur);} cur.lines.push(raw.replace(/\s+$/,'')); });
  return out;
}
function kv(lines){ const o={}; lines.forEach(l=>{ const m=l.trim().match(/^[○❍]?\s*([가-힣]\s*[가-힣])\s*[:：]\s*(.*)$/); if(m) o[m[1].replace(/\s+/g,'')]=(o[m[1].replace(/\s+/g,'')]?o[m[1].replace(/\s+/g,'')]+'\n':'')+m[2]; else if(Object.keys(o).length){ const k=Object.keys(o).pop(); o[k]+='\n'+l.trim(); } }); return o; }
function items(lines){ return lines.map(l=>{ const s=l.trim(); if(/^□/.test(s)) return `<div class="mt-sq">${esc(s.replace(/^□\s?/,''))}</div>`; if(/^[○❍]/.test(s)) return `<div class="mt-cir">${esc(s.replace(/^[○❍]\s?/,''))}</div>`; if(/^-/.test(s)) return `<div class="mt-dash">${esc(s.replace(/^-\s?/,''))}</div>`; return `<div class="mt-cir">${esc(s)}</div>`; }).join(''); }
function actionRows(lines){ return lines.map(l=>l.trim().replace(/^[○❍-]\s?/,'')).filter(Boolean).map(t=>{ const p=t.split(/\s[—–-]\s/); const task=p[0]||t; let who='',due=''; p.slice(1).forEach(x=>{ if(/담당/.test(x)) who=x.replace(/^담당\s*[:：]?\s*/,''); else if(/기한|까지/.test(x)) due=x.replace(/^기한\s*[:：]?\s*/,''); else if(!who) who=x; else due=x; }); return [task,who||'○○',due||'○○']; }); }
function talkTable(lines){
  const R=[]; lines.forEach(raw=>{ const s=raw.trim(); if(!s) return; let m;
    if((m=s.match(/^\[안건\s*(\d*)\]\s*(.*)$/))) R.push(`<tr class="ag"><td colspan="2">안건 ${esc(m[1])}${m[2]?'. '+esc(m[2]):''}</td></tr>`);
    else if((m=s.match(/^→\s*(?:결정\s*[:：]\s*)?(.*)$/))) R.push(`<tr class="dc"><th>결정</th><td>${esc(m[1])}</td></tr>`);
    else if((m=s.match(/^([^○□\-:：\s][^:：]{0,24})\s*[:：]\s*(.+)$/))) R.push(`<tr><th>${esc(m[1].trim())}</th><td>${esc(m[2])}</td></tr>`);
    else R.push(`<tr><th></th><td>${esc(s.replace(/^[○❍-]\s?/,''))}</td></tr>`); });
  return `<table class="mt-talk"><colgroup><col style="width:150px"><col></colgroup><tbody>${R.join('')}</tbody></table>`;
}
function render(o){
  const H={date:fmtWhen(v('mtDate'),v('mtTime')),place:v('mtPlace'),who:v('mtWho'),dept:v('mtDept')||'행정국 정보통신과'};
  const S=sections(o.body); const find=re=>S.find(x=>re.test(x.name)); 
  const ov=kv((find(/개요/)||{lines:[]}).lines); const talk=find(/^회의록|발언/), disc=S.find(x=>x!==talk&&/논의|요지|내용/.test(x.name)), dec=find(/결정/), act=find(/조치|후속/), etc=find(/기타/);
  const agenda=(ov['안건']||'').split(/\n|(?=[①②③④⑤⑥⑦⑧⑨])/).map(x=>x.trim()).filter(Boolean);
  $('#minutesView').innerHTML=`<div class="mt">
    <div class="mt-title">${esc(o.title.replace(/\s*(결과|회의록)$/,''))}<small>${talk?'회 의 결 과':'회 의 록'}</small></div>
    <table class="mt-ov"><tbody>
      <tr><th>일  시</th><td>${esc(H.date||ov['일시']||'○○')}</td><th>장  소</th><td>${esc(H.place||ov['장소']||'○○')}</td></tr>
      <tr><th>참석자</th><td colspan="3">${esc(H.who||ov['참석']||'○○')}</td></tr>
      <tr><th>안  건</th><td colspan="3">${agenda.length?agenda.map((a,i)=>`<div>${esc(a.replace(/^[①②③④⑤⑥⑦⑧⑨\d.\s]+/,''))}</div>`).join(''):'○○'}</td></tr>
    </tbody></table>
    ${disc?`<div class="mt-h">안건별 논의 요지</div><div class="mt-body">${items(disc.lines)}</div>`:''}
    ${dec?`<div class="mt-h">결정 사항</div><div class="mt-body mt-dec">${items(dec.lines)}</div>`:''}
    ${act?`<div class="mt-h">조치 사항</div><table class="mt-act"><thead><tr><th>조치 내용</th><th>담당</th><th>기한</th></tr></thead><tbody>${actionRows(act.lines).map(r=>`<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td><td>${esc(r[2])}</td></tr>`).join('')}</tbody></table>`:''}
    ${etc&&etc.lines.some(l=>!/해당 없음/.test(l))?`<div class="mt-h">기타</div><div class="mt-body">${items(etc.lines)}</div>`:''}
    ${talk?`<div class="mt-part"><span>회 의 록</span><small>발언 순서대로 기록 · 발언자는 참석자 번호로 표기</small></div>${talkTable(talk.lines)}`:''}
    <div class="mt-foot"><span>작성 : ${esc(H.dept)}</span><span>${esc(fmtWhen(new Date().toISOString().slice(0,10),''))}</span></div>
  </div>`;
  $('#minutesOut').hidden=false; window.dsSave&&dsSave('minutes',o.title,o.title+'\n\n'+o.body.join('\n')); $('#minutesOut').scrollIntoView({behavior:'smooth',block:'start'});
}
async function callModel(user){
  // 공통 호출(llm.js): 30초 서버 제한에 끊기면 이어 쓰기
  return await window.dsLLM(SYS_TALK,user,{max:8000,restartRe:/^\s*제목\s*[:：]/,onText:t=>{ $('#mtMsg').textContent=`정리 중… ${t.length}자`; }});
}
async function make(){
  if(M.busy) return;
  if(!v('mtName')){ $('#mtMsg').textContent='회의명은 입력해 주세요.'; return $('#mtName').focus(); }
  if(!v('mtNotes')){ $('#mtMsg').textContent='녹음 파일을 올리거나, 「녹음 대신 메모 붙여넣기」에 내용을 넣어 주세요.'; return $('#mtNotes').focus(); }
  M.busy=true; $('#mtGo').disabled=true; $('#mtMsg').textContent='정리 중…';
  try{
    const S=window.S||{};
    if((S.key||S.server)&&!S.offline){
      const u=[`<회의 정보>`,`회의명: ${v('mtName')}`,`일시: ${fmtWhen(v('mtDate'),v('mtTime'))||'○○'}`,`장소: ${v('mtPlace')||'○○'}`,`참석: ${v('mtWho')||'○○'}`,`안건:\n${v('mtAgenda')||'(메모에서 파악)'}`,`</회의 정보>`,`<회의 메모·녹취>`,v('mtNotes'),`</회의 메모·녹취>`].join('\n');
      M.out=parse(await callModel(u)); if(!M.out.body.length) throw new Error('응답 형식을 읽지 못했습니다. 다시 생성해 주세요.');
      $('#mtMsg').textContent='정리 완료 — 결정사항·담당·기한은 참석자 확인 후 확정하세요.';
    }else{ await new Promise(r=>setTimeout(r,400)); M.out=offline(); $('#mtMsg').textContent='오프라인 모드 — 모델 연결 시 메모를 읽어 안건별로 정리합니다.'; }
    render(M.out); mrail(5); if(window.S&&S.stats) S.stats.gen++,window.dsHit&&dsHit('gen');
  }catch(err){ $('#mtMsg').textContent='⚠ '+err.message; }
  finally{ M.busy=false; $('#mtGo').disabled=false; }
}
async function hwpx(){
  if(!M.out) return;
  try{
    const blob=await DalseongHwpx.build({kind:'free', title:M.out.title, sub:`달성군 [${v('mtDept')||'행정국 정보통신과'}]`, date:fmtWhen(v('mtDate'),''), answer:M.out.body.map(l=>{ const s=l.trim(); let m; if((m=s.match(/^\[안건\s*(\d*)\]\s*(.*)$/))) return `□ 안건 ${m[1]}. ${m[2]}`; if(/^→/.test(s)) return '  - '+s.replace(/^→\s*/,''); if(/^[^#○□\-:：\s][^:：]{0,24}[:：]\s/.test(s)) return '○ '+s; return l; }).join('\n')});
    const nm=`${M.out.title.replace(/[\\/:*?"<>|]/g,'').slice(0,40)}_${(v('mtDate')||new Date().toISOString().slice(0,10)).replace(/-/g,'')}.hwpx`;
    DalseongHwpx.download(blob,nm); if(window.S&&S.stats) S.stats.hwpx++; toast?.('한글 파일 생성: '+nm);
  }catch(e){ toast?.('한글 파일 생성 실패: '+e.message); }
}
function mrail(n){ document.querySelectorAll('#mtRail li').forEach(li=>{ const k=+li.dataset.s; li.className=k<n?'done':(k===n?'on':''); }); }
function init(){
  if($('#mtGo')._on) return; $('#mtGo')._on=1;
  document.querySelectorAll('#mtRail li').forEach(li=>li.onclick=()=>{ const el=$({1:'#mtS1',2:'#mtS2',3:'#mtS3',4:'#minutesOut'}[li.dataset.s]); if(el&&!el.hidden) el.scrollIntoView({behavior:'smooth',block:'start'}); });
  $('#mtName').addEventListener('input',()=>{ if($('#minutesOut').hidden) mrail(v('mtName')?2:1); });
  const dz=$('#mtDrop'); ['dragover','dragenter'].forEach(t=>dz.addEventListener(t,e=>{ e.preventDefault(); dz.classList.add('over'); })); ['dragleave','drop'].forEach(t=>dz.addEventListener(t,()=>dz.classList.remove('over')));
  dz.addEventListener('drop',e=>{ e.preventDefault(); const f=e.dataTransfer.files[0]; if(f) runAudio(f); });
  if(!$('#mtDate').value) $('#mtDate').value=new Date().toISOString().slice(0,10);
  document.querySelectorAll('.mt-k').forEach(b=>b.onclick=()=>{ $('#mtKind').value=b.dataset.k; document.querySelectorAll('.mt-k').forEach(x=>x.classList.toggle('on',x===b)); });
  $('#mtGo').onclick=make; $('#mtAgain').onclick=make; $('#mtHwpx').onclick=hwpx;
  $('#mtCopy').onclick=()=>{ if(!M.out) return; navigator.clipboard.writeText(M.out.title+'\n\n'+M.out.body.join('\n')); toast?.('복사했습니다'); };
  $('#mtSample').onclick=()=>{
    $('#mtName').value='2026년 데이터기반행정 실태점검 대응 회의'; $('#mtTime').value='14:00'; $('#mtPlace').value='군청 3층 소회의실';
    $('#mtWho').value='정보통신과장, 정보통계팀장, 김달성 주무관, 기획예산실 ○○○, 민원과 ○○○'; $('#mtAgenda').value='실태점검 지표별 담당 배정\n공동 데이터 분석 과제 선정\n정보화교육 하반기 일정';
    $('#mtNotes').value='과장: 11월 말 제출이니 지표별 담당 이번 주 안에 정하자. 1-1 개방은 김달성, 2지표 품질은 정보통계팀장이 맡는 걸로.\n팀장: 2-3 조치 결과는 이미 12개 시스템 최종진단 끝났고 결재만 남음. 다음 주 월요일까지 상신.\n기획예산실: 공동분석 과제는 인구이동이랑 상권 데이터 두 개 후보인데 경북 쪽이랑 협의 필요. 12월 초까지 결정.\n김달성: 정보화교육 하반기는 수요조사 14일까지 받고 과목 확정. 강사 섭외는 11월 셋째 주.\n민원과: 키오스크 교육은 민원실 장비 쓰면 되니 장소 협조 가능.\n과장: 다음 회의는 11월 24일 같은 시간.';
    toast?.('예시를 채웠습니다 — 「회의록 정리하기」를 눌러보세요');
  };
  /* 녹음 파일 → 글 → 바로 정리 */
  /* 진행 중 잠금 + 안내 */
  let runT=null;
  function busy(on,f){
    const sec=$('[data-view="minutes"]'); sec.classList.toggle('mt-busy',on);
    if(on){ const t0=Date.now(); $('#mtRun').hidden=false; $('#mtRun').className='mt-run'; $('#mtRunH').textContent='자동으로 정리하고 있어요';
      $('#mtRunS').textContent='녹음 → 글로 바꾸기 → 회의록 정리 순서로 끝까지 진행됩니다. 5분 녹음 기준 4~5분 걸려요. 끝날 때까지 이 화면에서 기다려 주세요.';
      clearInterval(runT); runT=setInterval(()=>{ const s=Math.round((Date.now()-t0)/1000); $('#mtRunT').textContent=`${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`; },1000);
      $('#mtFile').hidden=false; $('#mtDrop').hidden=true; $('#mtFileName').textContent=f.name; $('#mtFileInfo').textContent=`${(f.size/1048576).toFixed(1)}MB${f.dur?' · '+f.dur:''}`; $('#mtFileSt').textContent='올라감 ✓'; }
    else clearInterval(runT);
  }
  function finish(ok,msg){ busy(false); const r=$('#mtRun'); r.className='mt-run '+(ok?'ok':'err'); $('#mtRunH').textContent=ok?'✅ 회의록이 완성됐어요 — 아래 4단계에서 확인하세요':'⚠ 진행이 멈췄어요'; $('#mtRunS').textContent=ok?'다른 녹음을 올리려면 「다른 녹음 올리기」를 누르세요.':(msg||''); $('#mtFileSt').innerHTML='<button type="button" id="mtOther" class="ru-sub">다른 녹음 올리기</button>'; $('#mtOther').onclick=()=>{ $('#mtFile').hidden=true; $('#mtRun').hidden=true; $('#mtDrop').hidden=false; }; }
  async function runAudio(f){
    if(!f) return; if(!window.DsSTT){ $('#mtMsg').textContent='음성인식 모듈을 불러오지 못했습니다.'; return; }
    if(!v('mtName')) $('#mtName').value=f.name.replace(/\.[^.]+$/,'').replace(/^샘플_/,'');
    busy(true,f); $('#mtSttWrap').hidden=false; $('#mtGo').disabled=true; $('#mtAudio').disabled=true; mrail(3);
    const prog=p=>{ $('#mtSttBar').style.width=(p.pct||0)+'%'; $('#mtSttMsg').textContent=p.msg||''; if(p.text) $('#mtNotes').value=p.text; $('#mtFileSt').textContent=p.stage==='run'?'글로 바꾸는 중…':(p.stage==='model'?'준비 중…':'읽는 중…'); };
    try{
      const text=await DsSTT.transcribe(f,prog);
      $('#mtNotes').value=text; $('#mtSttBar').style.width='100%'; $('#mtSttMsg').textContent='글로 바꾸기 완료 — 이어서 회의록을 정리합니다'; $('#mtFileSt').textContent='회의록 정리 중…';
      $('#mtGo').disabled=false; await make(); finish(!/⚠/.test($('#mtMsg').textContent),$('#mtMsg').textContent);
    }catch(err){ $('#mtSttMsg').textContent='⚠ '+err.message; $('#mtGo').disabled=false; finish(false,err.message); }
    finally{ $('#mtAudio').disabled=false; $('#mtAudio').value=''; $('#mtSampleAudio').disabled=false; }
  }
  const fillInfo=()=>{ $('#mtName').value='2026년 데이터기반행정 실태점검 대응 회의'; $('#mtDate').value=new Date().toISOString().slice(0,10); $('#mtTime').value='14:00'; $('#mtPlace').value='군청 3층 소회의실'; $('#mtDept').value='행정국 정보통신과';
    $('#mtWho').value='정보통신과장, 정보통계팀장, 김달성 주무관, 기획예산실 담당, 민원과 담당'; mrail(2); };
  $('#mtFill').onclick=()=>{ fillInfo(); toast?.('회의 정보를 예시로 채웠습니다 — 2단계에서 녹음을 올리거나 샘플 녹음을 눌러 보세요'); };
  $('#mtAudio').onchange=e=>runAudio(e.target.files[0]);
  $('#mtSampleAudio').onclick=async()=>{
    $('#mtSampleAudio').disabled=true; $('#mtMsg').textContent='샘플 녹음을 불러오는 중…';
    try{ const b=await (await fetch('assets/sample_meeting.mp3')).blob(); if(!v('mtName')) fillInfo(); $('#mtMsg').textContent='';
      const f=new File([b],'샘플_회의녹음.mp3',{type:'audio/mpeg'}); f.dur='5분 40초'; await runAudio(f); }
    catch(e){ $('#mtMsg').textContent='⚠ 샘플을 불러오지 못했습니다: '+e.message; $('#mtSampleAudio').disabled=false; }
  };
  $('#mtReset').onclick=()=>{ ['mtName','mtTime','mtPlace','mtWho','mtAgenda','mtNotes'].forEach(id=>$('#'+id).value=''); $('#minutesOut').hidden=true; $('#mtMsg').textContent=''; $('#mtSttWrap').hidden=true; $('#mtSttBar').style.width='0'; mrail(1); };
}
window.MINUTES={init};
})();
