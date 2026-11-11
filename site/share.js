/* ============================================================
   달성On — 질문·요청 소통하기 (share.js)
   · 직원이 "이런 기능 넣어 주세요 / 이건 이렇게 고치면 좋겠어요 / 나는 이렇게 써서 해결했어요"를 올리는 곳.
   · 저장은 오류신고함과 같은 /api/bugs(Netlify Blobs) 사용, kind ∈ idea | improve | usecase 로 구분.
   · 개인정보는 받지 않는다(부서명만 선택). 공감(👍)은 이 브라우저에만 기억(서버 부하·악용 방지).
   ============================================================ */
(function(){
"use strict";
const $=s=>document.querySelector(s);
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const KIND={idea:['💡 만들어 주세요','#1d5fd6','#eaf1ff'],ask:['❓ 질문·문의','#0e7490','#e6f7fb'],improve:['🔧 개선 의견','#b45309','#fff4e0'],usecase:['🙌 이렇게 썼어요','#0b8a5c','#e6f6ec'],made:['🛠️ 저도 만들었어요','#c2255c','#fff0f6'],voice:['💬 기타 한마디','#7048e8','#f1ecff'],bug:['🐞 오류·불편','#e03131','#fff0f0']};
const BUGK={'오류':1,'결과이상':1,'불편':1,'건의':1};   // 🐞 단추로 보낸 신고도 함께 보여 준다
const kindOf=x=>BUGK[x.kind]?'bug':x.kind;
const stOf=x=>x.st||(['접수','검토','반영'].includes(x.where)?x.where:'접수');
const LS='dsOn.share.like'; let LIKES={}; try{ LIKES=JSON.parse(localStorage.getItem(LS)||'{}'); }catch(e){}
const ST={list:[],filter:'all',busy:false,q:'',sort:'new',page:1,open:{}};
const PER=6;   // 한 번에 보여 줄 글 수 — 쌓여도 화면이 끝없이 길어지지 않게 (「더 보기」로 이어 보기)

async function load(){
  $('#shList').innerHTML='<li class="sh-empty">불러오는 중…</li>';
  try{ const r=await fetch('/api/bugs',{cache:'no-store'}); const j=await r.json(); ST.list=(j.list||[]).filter(x=>KIND[kindOf(x)]); }
  catch(e){ ST.list=[]; }
  render();
}
function render(){
  const all=ST.list;
  const cnt=k=>all.filter(x=>stOf(x)===k).length;
  $('#shStat').innerHTML=`<span class="s1"><i>📨</i>접수 <b>${cnt('접수')}</b></span><span class="s2"><i>🔍</i>검토 중 <b>${cnt('검토')}</b></span><span class="s3"><i>✅</i>반영됨 <b>${cnt('반영')}</b></span>`;
  const q=ST.q.trim().toLowerCase();
  let rows=all.filter(x=>(ST.filter==='all'||kindOf(x)===ST.filter)&&(!q||`${x.text||''} ${x.who||''}`.toLowerCase().includes(q)));
  rows=[...rows].sort((a,b)=>ST.sort==='like'?((b.likes||0)-(a.likes||0))||(b.at-a.at):(b.at-a.at));
  $('#shCount').textContent=`${rows.length}건${rows.length!==all.length?` / 전체 ${all.length}건`:''}`;
  $('#shTabs').querySelectorAll('button').forEach(b=>{ const k=b.dataset.k; const n=k==='all'?all.length:all.filter(x=>kindOf(x)===k).length; b.dataset.n=n; });
  if(!rows.length){ $('#shList').innerHTML=`<li class="sh-empty">${q?'찾는 글이 없습니다.':'아직 올라온 글이 없습니다. 첫 제안을 남겨 주세요 🙂'}</li>`; $('#shPager').innerHTML=''; return; }
  const show=rows.slice(0,ST.page*PER);
  $('#shList').innerHTML=show.map(x=>{ const t=(x.text||'').split('\n')[0]; const body=(x.text||'').slice(t.length+1).trim(); const [kn,kc,kb]=KIND[kindOf(x)]; const bugWhere=BUGK[x.kind]&&x.where&&!['접수','검토','반영'].includes(x.where)?` <small class="sh-where">· ${esc(x.where)} 화면</small>`:''; const liked=!!LIKES[x.id]; const n=x.likes||0; const st=stOf(x); const long=body.length>90; const op=!!ST.open[x.id];
    return `<li class="sh-item st-${st}"><div class="sh-top"><span class="sh-kind" style="color:${kc};background:${kb}">${kn}</span><b>${esc(t)}</b>${bugWhere}<span class="sh-meta">${esc(x.who||'익명')} · ${new Date(x.at).toLocaleDateString('ko-KR')}</span></div>
      ${body?`<p class="sh-body${long&&!op?' clamp':''}">${esc(body)}</p>${long?`<button class="sh-more" data-id="${x.id}">${op?'접기 ▲':'더 읽기 ▼'}</button>`:''}`:''}
      <div class="sh-act"><button class="sh-like${liked?' on':''}" data-id="${x.id}">👍 공감 ${n}</button><span class="sh-state s-${st}">${st==='반영'?'✅ 반영됨':st==='검토'?'🔍 검토 중':'📨 접수'}</span></div></li>`; }).join('');
  const left=rows.length-show.length;
  $('#shPager').innerHTML=left>0?`<button id="shMoreP">더 보기 <small>${left}건 남음</small></button>`:(rows.length>PER?'<span class="hint">마지막 글입니다</span>':'');
  if($('#shMoreP')) $('#shMoreP').onclick=()=>{ ST.page++; render(); };
  $('#shList').querySelectorAll('.sh-more').forEach(b=>b.onclick=()=>{ ST.open[b.dataset.id]=!ST.open[b.dataset.id]; render(); });
  $('#shList').querySelectorAll('.sh-like').forEach(b=>b.onclick=async()=>{ const id=b.dataset.id, on=!LIKES[id]; const x=ST.list.find(y=>y.id===id); if(!x) return;
    LIKES[id]=on; x.likes=Math.max(0,(x.likes||0)+(on?1:-1)); try{ localStorage.setItem(LS,JSON.stringify(LIKES)); }catch(e){} render();
    try{ const r=await fetch('/api/bugs',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'like',id,on})}); const j=await r.json(); if(j.ok){ x.likes=j.likes; render(); } }catch(e){} });
}
async function submit(){
  if(ST.busy) return; const kind=$('#shKind').value, title=($('#shTitle').value||'').trim(), body=($('#shBody').value||'').trim(), who=($('#shWho').value||'').trim();
  if(!title){ $('#shMsg').textContent='제목을 적어 주세요.'; return $('#shTitle').focus(); }
  if(/\d{6}-\d{7}|01\d-?\d{3,4}-?\d{4}/.test(title+body)){ $('#shMsg').textContent='주민등록번호·휴대전화번호로 보이는 내용은 올릴 수 없습니다.'; return; }
  ST.busy=true; $('#shSend').disabled=true; $('#shMsg').textContent='올리는 중…';
  try{
    const r=await fetch('/api/bugs',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({kind,where:'접수',text:title+'\n'+body,who})});
    if(!r.ok) throw new Error(await r.text());
    $('#shTitle').value=''; $('#shBody').value=''; $('#shMsg').textContent='✓ 올라갔습니다 — 고맙습니다! 검토 후 반영 여부를 표시합니다.'; await load();
  }catch(e){ $('#shMsg').textContent='⚠ 올리지 못했습니다: '+e.message; }
  finally{ ST.busy=false; $('#shSend').disabled=false; }
}
function init(){
  if($('#shSend')._on) return; $('#shSend')._on=1;
  $('#shSend').onclick=submit;
  $('#shTabs').querySelectorAll('button').forEach(b=>b.onclick=()=>{ ST.filter=b.dataset.k; ST.page=1; $('#shTabs').querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b)); render(); });
  $('#shQ').oninput=()=>{ ST.q=$('#shQ').value; ST.page=1; render(); };
  $('#shSort').onchange=()=>{ ST.sort=$('#shSort').value; ST.page=1; render(); };
  $('#shKinds').querySelectorAll('button').forEach(b=>b.onclick=()=>{ $('#shKind').value=b.dataset.v; $('#shKinds').querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b)); $('#shKind').onchange(); });
  $('#shKind').onchange=()=>{ const ph={idea:'예) 공문 받으면 요약해서 할 일만 뽑아 주는 기능',ask:'예) 회의록 녹음은 몇 분까지 올릴 수 있나요?',improve:'예) 급량비 계산 결과를 바로 복사할 수 있게',usecase:'예) 보도자료 초안을 10분 만에 뽑아서 과장님 검토까지 당일 끝냄',made:'예) 엑셀 출장비 자동 계산표 만들어 봤어요 (사용법은 내용에)',voice:'예) 회의록 기능 덕분에 오늘 일찍 퇴근했어요 🙂'}; $('#shTitle').placeholder=ph[$('#shKind').value]; }; $('#shKind').onchange();
  load();
}
window.SHARE={init};
})();
