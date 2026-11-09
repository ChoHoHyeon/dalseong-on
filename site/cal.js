/* ============================================================
   달성On — 홈 달력 (cal.js)
   · 날짜를 누르면 일정 추가, 일정을 누르면 수정·삭제. 이 PC 브라우저(localStorage)에 저장 → 새로고침해도 유지.
   · 서버로 보내지 않는다(개인 일정). 공휴일은 2026~2027 고정 목록으로 빨간 표시.
   ============================================================ */
(function(){
"use strict";
const $=s=>document.querySelector(s);
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const KEY='dsOn.cal';
const COLORS=['#e03131','#f08c00','#ca8a04','#12a15f','#0ea5e9','#1d5fd6','#7048e8'];   // 빨강·주황·노랑·초록·하늘·파랑·보라
const DEF='#1d5fd6';
const HOL={'2026-01-01':'신정','2026-02-16':'설날','2026-02-17':'설날','2026-02-18':'설날','2026-03-01':'삼일절','2026-03-02':'대체공휴일','2026-05-05':'어린이날','2026-05-24':'부처님오신날','2026-05-25':'대체공휴일','2026-06-03':'지방선거','2026-06-06':'현충일','2026-08-15':'광복절','2026-08-17':'대체공휴일','2026-09-24':'추석','2026-09-25':'추석','2026-09-26':'추석','2026-10-03':'개천절','2026-10-05':'대체공휴일','2026-10-09':'한글날','2026-12-25':'성탄절',
  '2027-01-01':'신정','2027-02-06':'설날','2027-02-07':'설날','2027-02-08':'설날','2027-02-09':'대체공휴일','2027-03-01':'삼일절','2027-05-05':'어린이날','2027-05-13':'부처님오신날','2027-06-06':'현충일','2027-08-15':'광복절','2027-08-16':'대체공휴일','2027-09-14':'추석','2027-09-15':'추석','2027-09-16':'추석','2027-10-03':'개천절','2027-10-04':'대체공휴일','2027-10-09':'한글날','2027-10-11':'대체공휴일','2027-12-25':'성탄절'};
const C={y:0,m:0,edit:null,day:null};
const load=()=>{ try{ return JSON.parse(localStorage.getItem(KEY)||'[]'); }catch(e){ return []; } };
const save=L=>{ try{ localStorage.setItem(KEY,JSON.stringify(L)); }catch(e){ toast?.('이 브라우저는 저장을 막고 있어요'); } };
const ymd=(y,m,d)=>`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
const todayStr=()=>{ const t=new Date(); return ymd(t.getFullYear(),t.getMonth(),t.getDate()); };

function render(){ try{ window.dispatchEvent(new Event('dscal')); }catch(e){}
  const L=load(), y=C.y, m=C.m, first=new Date(y,m,1).getDay(), last=new Date(y,m+1,0).getDate(), td=todayStr();
  $('#calTitle').textContent=`${y}년 ${m+1}월`;
  let h='';
  for(let i=0;i<first;i++) h+='<div class="cd empty"></div>';
  for(let d=1;d<=last;d++){
    const k=ymd(y,m,d), ev=L.filter(e=>e.d===k).sort((a,b)=>(a.t||'99').localeCompare(b.t||'99')), dow=(first+d-1)%7;
    const cls=['cd',k===td?'today':'',dow===0||HOL[k]?'sun':'',dow===6?'sat':'',ev.length?'has':''].join(' ');
    h+=`<div class="${cls}" data-d="${k}" tabindex="0"><span class="n">${d}</span>${HOL[k]?`<span class="hol">${HOL[k]}</span>`:''}
      ${ev.slice(0,2).map(e=>`<span class="ev" data-id="${e.id}" style="--c:${e.c||DEF}">${e.t?`<em>${e.t}</em>`:''}${esc(e.title)}</span>`).join('')}${ev.length>2?`<span class="more">+${ev.length-2}</span>`:''}</div>`;
  }
  $('#calGrid').innerHTML=h;
  $('#calGrid').querySelectorAll('.cd[data-d]').forEach(el=>{
    el.onclick=e=>{ const ev=e.target.closest('.ev'); if(ev) openEdit(ev.dataset.id); else openDay(el.dataset.d); };
    el.onkeydown=e=>{ if(e.key==='Enter') openDay(el.dataset.d); };
  });
}
function openDay(d){ C.edit=null; C.day=d; fill({title:'',t:'',memo:'',c:DEF}); $('#calDel').hidden=true; $('#calPopTitle').textContent=label(d)+' 일정 추가'; show(); }
function openEdit(id){ const e=load().find(x=>x.id===id); if(!e) return; C.edit=id; C.day=e.d; fill(e); $('#calDel').hidden=false; $('#calPopTitle').textContent=label(e.d)+' 일정'; show(); }
const label=d=>{ const x=new Date(d+'T00:00:00'); return `${x.getMonth()+1}월 ${x.getDate()}일(${'일월화수목금토'[x.getDay()]})`; };
function fill(e){ $('#calIn').value=e.title||''; $('#calTime').value=e.t||''; $('#calMemo').value=e.memo||''; $('#calDate').value=C.day; C.c=e.c||DEF; $('#calColors').querySelectorAll('button').forEach(b=>b.classList.toggle('on',b.dataset.c===C.c)); }
function show(){ $('#calPop').hidden=false; setTimeout(()=>$('#calIn').focus(),30); }
function hide(){ $('#calPop').hidden=true; }
function commit(){
  const title=($('#calIn').value||'').trim(); if(!title){ $('#calIn').focus(); return; }
  const L=load(), o={id:C.edit||Date.now().toString(36),d:$('#calDate').value||C.day,t:$('#calTime').value,title:title.slice(0,40),memo:($('#calMemo').value||'').slice(0,200),c:C.c};
  const i=L.findIndex(x=>x.id===o.id); if(i>=0) L[i]=o; else L.push(o); save(L); hide();
  const nd=new Date(o.d+'T00:00:00'); C.y=nd.getFullYear(); C.m=nd.getMonth(); render(); toast?.(i>=0?'일정을 고쳤어요':'일정을 넣었어요');
}
function del(){ if(!C.edit) return; save(load().filter(x=>x.id!==C.edit)); hide(); render(); toast?.('일정을 지웠어요'); }
function init(){
  if(!$('#calGrid')||!$('#calColors')) return; const t=new Date(); if(!C.y){ C.y=t.getFullYear(); C.m=t.getMonth(); }
  if(!$('#calGrid')._on){ $('#calGrid')._on=1;
    $('#calPrev').onclick=()=>{ if(--C.m<0){ C.m=11; C.y--; } render(); };
    $('#calNext').onclick=()=>{ if(++C.m>11){ C.m=0; C.y++; } render(); };
    $('#calToday').onclick=()=>{ const n=new Date(); C.y=n.getFullYear(); C.m=n.getMonth(); render(); };
    $('#calColors').innerHTML=COLORS.map(c=>`<button data-c="${c}" style="--c:${c}" aria-label="색"></button>`).join('');
    $('#calColors').querySelectorAll('button').forEach(b=>b.onclick=()=>{ C.c=b.dataset.c; $('#calColors').querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b)); });
    $('#calSave').onclick=commit; $('#calDel').onclick=del; $('#calCancel').onclick=hide;
    $('#calIn').onkeydown=e=>{ if(e.key==='Enter') commit(); if(e.key==='Escape') hide(); };
    $('#calPop').onclick=e=>{ if(e.target.id==='calPop') hide(); };
  }
  render();
}
function upcoming(days){ const td=todayStr(), lim=new Date(Date.now()+days*864e5); const end=ymd(lim.getFullYear(),lim.getMonth(),lim.getDate());
  return load().filter(e=>e.d>=td&&e.d<=end).sort((a,b)=>(a.d+(a.t||'')).localeCompare(b.d+(b.t||''))).map(e=>({...e,diff:Math.round((new Date(e.d+'T00:00:00')-new Date(td+'T00:00:00'))/864e5)})); }
/* 이번 주(월~일) 남은 일정 — 오늘부터 이번 주 일요일까지 */
function thisWeek(){ const now=new Date(), toSun=(7-now.getDay())%7; return upcoming(toSun); }
window.HOMECAL={init,upcoming,thisWeek,open:id=>openEdit(id)};
})();
