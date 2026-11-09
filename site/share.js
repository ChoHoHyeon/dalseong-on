/* ============================================================
   달성On — 제안·활용사례 나눔터 (share.js)
   · 직원이 "이런 기능 넣어 주세요 / 이건 이렇게 고치면 좋겠어요 / 나는 이렇게 써서 해결했어요"를 올리는 곳.
   · 저장은 오류신고함과 같은 /api/bugs(Netlify Blobs) 사용, kind ∈ idea | improve | usecase 로 구분.
   · 개인정보는 받지 않는다(부서명만 선택). 공감(👍)은 이 브라우저에만 기억(서버 부하·악용 방지).
   ============================================================ */
(function(){
"use strict";
const $=s=>document.querySelector(s);
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const KIND={idea:['💡 기능 제안','#1d5fd6','#eaf1ff'],improve:['🔧 개선 의견','#b45309','#fff4e0'],usecase:['🙌 활용 사례','#0b8a5c','#e6f6ec']};
const LS='dsOn.share.like'; let LIKES={}; try{ LIKES=JSON.parse(localStorage.getItem(LS)||'{}'); }catch(e){}
const ST={list:[],filter:'all',busy:false};

async function load(){
  $('#shList').innerHTML='<li class="sh-empty">불러오는 중…</li>';
  try{ const r=await fetch('/api/bugs',{cache:'no-store'}); const j=await r.json(); ST.list=(j.list||[]).filter(x=>KIND[x.kind]); }
  catch(e){ ST.list=[]; }
  render();
}
function render(){
  const rows=ST.list.filter(x=>ST.filter==='all'||x.kind===ST.filter);
  $('#shCount').textContent=`${rows.length}건`;
  if(!rows.length){ $('#shList').innerHTML='<li class="sh-empty">아직 올라온 글이 없습니다. 첫 제안을 남겨 주세요 🙂</li>'; return; }
  $('#shList').innerHTML=rows.map(x=>{ const [t,bd]=(x.text||'').split('\n',2); const body=(x.text||'').slice(t.length+1); const [kn,kc,kb]=KIND[x.kind]; const liked=!!LIKES[x.id]; const n=(x.w||0)+(liked?1:0);
    return `<li class="sh-item"><div class="sh-top"><span class="sh-kind" style="color:${kc};background:${kb}">${kn}</span><b>${esc(t)}</b><span class="sh-meta">${esc(x.who||'익명')} · ${new Date(x.at).toLocaleDateString('ko-KR')}</span></div>
      ${body?`<p class="sh-body">${esc(body)}</p>`:''}
      <div class="sh-act"><button class="sh-like${liked?' on':''}" data-id="${x.id}">👍 공감 ${n}</button><span class="sh-state">${x.where==='반영'?'✅ 반영됨':x.where==='검토'?'🔍 검토 중':'📨 접수'}</span></div></li>`; }).join('');
  $('#shList').querySelectorAll('.sh-like').forEach(b=>b.onclick=()=>{ const id=b.dataset.id; LIKES[id]=!LIKES[id]; try{ localStorage.setItem(LS,JSON.stringify(LIKES)); }catch(e){} render(); });
}
async function submit(){
  if(ST.busy) return; const kind=$('#shKind').value, title=($('#shTitle').value||'').trim(), body=($('#shBody').value||'').trim(), who=($('#shWho').value||'').trim();
  if(!title){ $('#shMsg').textContent='제목을 적어 주세요.'; return $('#shTitle').focus(); }
  if(/\d{6}-\d{7}|01\d-?\d{3,4}-?\d{4}/.test(title+body)){ $('#shMsg').textContent='주민등록번호·휴대전화번호로 보이는 내용은 올릴 수 없습니다.'; return; }
  ST.busy=true; $('#shSend').disabled=true; $('#shMsg').textContent='올리는 중…';
  try{
    const r=await fetch('/api/bugs',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({kind,where:'접수',text:title+'\n'+body,who,w:0})});
    if(!r.ok) throw new Error(await r.text());
    $('#shTitle').value=''; $('#shBody').value=''; $('#shMsg').textContent='✓ 올라갔습니다 — 고맙습니다! 검토 후 반영 여부를 표시합니다.'; await load();
  }catch(e){ $('#shMsg').textContent='⚠ 올리지 못했습니다: '+e.message; }
  finally{ ST.busy=false; $('#shSend').disabled=false; }
}
function init(){
  if($('#shSend')._on) return; $('#shSend')._on=1;
  $('#shSend').onclick=submit;
  $('#shTabs').querySelectorAll('button').forEach(b=>b.onclick=()=>{ ST.filter=b.dataset.k; $('#shTabs').querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b)); render(); });
  $('#shKind').onchange=()=>{ const ph={idea:'예) 공문 받으면 요약해서 할 일만 뽑아 주는 기능',improve:'예) 급량비 계산 결과를 바로 복사할 수 있게',usecase:'예) 보도자료 초안을 10분 만에 뽑아서 과장님 검토까지 당일 끝냄'}; $('#shTitle').placeholder=ph[$('#shKind').value]; }; $('#shKind').onchange();
  load();
}
window.SHARE={init};
})();
