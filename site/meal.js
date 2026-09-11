/* ============================================================
   달성On — 특근매식비(급량비) 정산
   근거: 「지방자치단체 회계관리에 관한 훈령」(행안부훈령 제416호, 2026.1.2. 시행)
        [별표2] 201-01 사무관리비 › 마. 급량비   (규정 확인일 2026.9.11.)
   ============================================================ */
(function(){
"use strict";
const $=(s,r)=>(r||document).querySelector(s);
const pad=n=>String(n).padStart(2,'0');
const won=n=>n.toLocaleString('ko-KR');
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const toMin=t=>{const m=/^(\d{1,2}):(\d{2})$/.exec(String(t).trim());return m?(+m[1])*60+(+m[2]):NaN;};
const hhmm=m=>pad(Math.floor(m/60)%24)+':'+pad(m%60);

const HOLI_2026=['2026-01-01','2026-02-16','2026-02-17','2026-02-18','2026-03-01','2026-03-02',
 '2026-05-05','2026-05-24','2026-05-25','2026-06-03','2026-06-06','2026-08-15','2026-08-17',
 '2026-09-24','2026-09-25','2026-09-26','2026-09-28','2026-10-03','2026-10-05','2026-10-09','2026-12-25'];
const SHOPS=['이삭토스트','맘스터치','한솥','대복성','부산진국밥','왕손','오늘도통통','돈구이','한옥집','강림추어탕'];

let S={all:[],rows:[],days:[],names:[],depts:[],dept:'',cells:{},shop:{},cfg:{},chk:[],pdfText:'',built:false,placed:false};

/* ---------- 설정 저장 (이 브라우저에만 보관) ---------- */
let PROF='';                                  // 현재 부서 프로필
const LSP='dsOn.meal.prof';
const LS='dsOn.meal.cfg.v1';
const K=b=>b+(PROF?'::'+PROF:'');             // 부서별 저장 키
function useProfile(name,silent){
  name=String(name||'').trim();
  if(name===PROF) return false;
  PROF=name;
  try{ localStorage.setItem(LSP,PROF); }catch(e){}
  loadCfg();                                  // 그 부서가 쓰던 설정을 불러온다
  return true;
}
const CFGF=[];   // 사람이 타이핑해야 하는 값은 없다
const LSS='dsOn.meal.shift.v1';
const shiftGet=()=>{ try{ return JSON.parse(localStorage.getItem(K(LSS))||'[]'); }catch(e){ return []; } };
const shiftSet=v=>{ try{ localStorage.setItem(K(LSS),JSON.stringify([...new Set(v)])); }catch(e){} };


function saveCfg(){
  try{ const o={}; CFGF.forEach(k=>{const el=$('#'+k); if(el) o[k]=el.value;});
       localStorage.setItem(K(LS),JSON.stringify(o)); flash(); }catch(e){}
}
function loadCfg(){
  try{ const o=JSON.parse(localStorage.getItem(K(LS))||'{}');
       CFGF.forEach(k=>{const el=$('#'+k); if(el&&o[k]!=null) el.value=o[k];}); }catch(e){}
}
let fTimer=null;
function flash(){
  const el=$('#mlSaved'); if(!el) return;
  el.textContent='설정이 이 브라우저에 저장되었습니다'; el.classList.add('on');
  clearTimeout(fTimer); fTimer=setTimeout(()=>el.classList.remove('on'),1800);
}

/* ---------- 군 공통 기준파일 (data/meal_config.json) ---------- */
let CFG=null, priceTouched=false;
async function loadBase(){
  try{ CFG=await (await fetch('data/meal_config.json',{cache:'no-store'})).json(); }catch(e){ CFG=null; }
}
function priceFor(ym){
  if(!CFG||!Array.isArray(CFG['단가이력'])) return 9000;
  const d=ym+'-01';
  const hit=CFG['단가이력'].filter(x=>x['시행일']<=d).sort((a,b)=>b['시행일'].localeCompare(a['시행일']))[0];
  return hit?hit['단가']:9000;
}
function priceNote(ym){
  if(!CFG||!Array.isArray(CFG['단가이력'])) return '';
  const d=ym+'-01';
  const hit=CFG['단가이력'].filter(x=>x['시행일']<=d).sort((a,b)=>b['시행일'].localeCompare(a['시행일']))[0];
  return hit?(hit['시행일'].replace(/-/g,'. ')+'. 시행 · '+(hit['근거']||'')):'';
}
function holiFor(y){ return (CFG&&CFG['공휴일']&&CFG['공휴일'][y]&&CFG['공휴일'][y].length)?CFG['공휴일'][y]:null; }

/* 가맹업소 사용 이력 — 자주 쓰는 곳을 위로 올리고 목록을 스스로 채운다 */
const LSH='dsOn.meal.shop.v1';
function histGet(){ try{ return JSON.parse(localStorage.getItem(K(LSH))||'{}'); }catch(e){ return {}; } }
function histAdd(name,ym,n){
  if(!name) return;
  try{ const h=histGet(); h[name]=h[name]||{n:0,last:''};
       h[name].n+=(n||1); if(ym>h[name].last) h[name].last=ym;
       localStorage.setItem(K(LSH),JSON.stringify(h)); }catch(e){}
}
function shopList(){
  const h=histGet();
  return Object.keys(h).sort((a,b)=>(h[b].n||0)-(h[a].n||0)||a.localeCompare(b,'ko'));
}
function topShop(){ const l=shopList(); return l[0]||''; }

/* ---------- 파싱 ---------- */
function norm(s){ for(let i=0;i<6;i++) s=s.replace(/(?<=[0-9:\-])[ ]+(?=[0-9:\-])/g,''); return s; }
/* 직급 칸은 두 줄로 쪼개지거나 괄호가 섞여 나오므로, 성명은 「출퇴근 시각 바로 앞의 한글」로 잡는다 */
const ROW=/(\d+?)(20\d\d-\d\d-\d\d)\s+(\S+)\s+([^\d]*?)([가-힣]{2,4})\s+(\d\d:\d\d)(\d\d:\d\d)(\d{1,3})(?!\d)/;
function parse(text){
  const L=text.split(/\r?\n/).map(norm), out=[];
  const START=/^\s*\d{1,3}\s*20\d\d-\d\d-\d\d/;   // 「순번+근무일자」로 시작하면 한 건의 시작
  for(let i=0;i<L.length;i++){
    let m=ROW.exec(L[i]), used=0;
    if(!m && START.test(L[i])){
      // 직급이 두 줄인 경우 성명·출퇴근이 아래 줄로 밀린다 — 최대 4줄까지 이어붙여 본다
      let buf=L[i];
      for(let j=1;j<=4 && i+j<L.length; j++){
        if(START.test(L[i+j])) break;                 // 다음 건이 시작되면 중단
        buf+=' '+L[i+j];
        m=ROW.exec(buf);
        if(m){ used=j; break; }
      }
    }
    if(!m) continue;
    let rd=null, rt=null;
    for(let j=i-1;j>=Math.max(0,i-3);j--){ const d=L[j].match(/20\d\d-\d\d-\d\d/g); if(d){ rd=d[d.length-1]; break; } }
    for(let j=i+used+1;j<=Math.min(L.length-1,i+used+3);j++){ const t=L[j].match(/\b\d\d:\d\d\b/); if(t){ rt=t[0]; break; } }
    out.push({date:m[2], dept:m[3], rank:(m[4]||'').trim(), name:m[5],
              inn:m[6], out:m[7], pay:+m[8], regd:rd, regt:rt});
    i+=used;
  }
  return out;
}

/* ---------- 판정 ---------- */
function cfgRead(){
  const list=s=>String(s||'').split(/[\s,]+/).map(x=>x.trim()).filter(Boolean);
  return { ym:$('#mlYm').value.trim(), price:+$('#mlPrice').value||0,
    ws:toMin($('#mlWs').value)||540, we:toMin($('#mlWe').value)||1080,
    early:$('#mlEarly').value==='1',
    holi:new Set(list($('#mlHoli').value)),
    shift:new Set(shiftGet()), trip:parseTrip($('#mlTrip').value) };
}

/* 출장(여비 식비 수령) 내역 파싱 — 「8/12 조호현」 「조호현 2026-08-12, 8-13」 등 자유 형식 */
function parseTrip(raw){
  const map={}, ym=($('#mlYm')&&$('#mlYm').value.trim())||'';
  const y=ym.slice(0,4)||String(new Date().getFullYear()), mm=ym.slice(5,7);
  for(const line of String(raw||'').split(/\r?\n/)){
    if(!line.trim()) continue;
    const names=line.match(/[가-힣]{2,4}/g)||[];
    const nm=names.filter(n=>!/월|일|출장|식비|관내|관외/.test(n));
    if(!nm.length) continue;
    const ds=new Set();
    (line.match(/20\d\d[-.\/]\d{1,2}[-.\/]\d{1,2}/g)||[]).forEach(d=>{
      const a=d.split(/[-.\/]/); ds.add(a[0]+'-'+pad(+a[1])+'-'+pad(+a[2]));
    });
    const rest=line.replace(/20\d\d[-.\/]\d{1,2}[-.\/]\d{1,2}/g,'');
    (rest.match(/\b(\d{1,2})[-.\/](\d{1,2})\b/g)||[]).forEach(d=>{
      const a=d.split(/[-.\/]/); ds.add(y+'-'+pad(+a[0])+'-'+pad(+a[1]));
    });
    if(!ds.size&&mm) (rest.match(/(?:^|[^\d])(\d{1,2})\s*일/g)||[]).forEach(d=>{
      ds.add(y+'-'+mm+'-'+pad(+d.replace(/\D/g,'')));
    });
    nm.forEach(n=>{ map[n]=map[n]||new Set(); ds.forEach(d=>map[n].add(d)); });
  }
  return map;
}
const isHol=(d,c)=>{const w=new Date(d+'T00:00:00').getDay();return w===0||w===6||c.holi.has(d);};
function regOK(r,c){                       // 조기출근 사전등록 : 근무일 이전 or 당일 정규개시 전
  if(!r.regd||!r.regt) return null;        // 등록일시를 읽지 못함
  if(r.regd<r.date) return true;
  if(r.regd>r.date) return false;
  return toMin(r.regt)<=c.ws;
}
function judge(r,c){
  const inn=toMin(r.inn); let out=toMin(r.out); if(out<inn) out+=1440;
  const hol=isHol(r.date,c);
  if(hol){ const w=out-inn;
    return {ok:w>=60,hol,why:'휴일 근무 '+w+'분',calc:Math.min(w,240),est:inn+r.pay}; }
  const late=Math.max(0,out-c.we), early=Math.max(0,c.ws-inn), rk=regOK(r,c);
  const okLate=late>=60, okEarly=c.early&&early>=60&&rk!==false;
  const why=[];
  if(okLate) why.push('근무종료 후 '+late+'분');
  if(okEarly) why.push('개시 전 '+early+'분'+(rk===null?'(등록일시 확인 불가)':''));
  if(c.early&&early>=60&&rk===false) why.push('개시 전 '+early+'분이나 등록이 '+r.regd+' '+r.regt+'로 지연');
  if(!why.length) why.push('근무종료 후 '+late+'분 · 개시 전 '+early+'분 — 1시간 미달');
  return {ok:okLate||okEarly,hol,why:why.join(' / '),
          calc:Math.min(Math.max(0,early+late-60),240), est:c.we+Math.max(0,r.pay+60-early)};
}

/* ---------- 실행 ---------- */
function run(text){
  const all=parse(text);
  if(!all.length) return false;   // 실패 안내는 드롭존이 맡는다
  const ym0=($('#mlYm').value||'').trim()||all[0].date.slice(0,7);
  const d0=[...new Set(all.filter(r=>r.date.startsWith(ym0)).map(r=>r.dept))];
  if(d0.length===1) useProfile(d0[0]);   // 확인서의 과로 저장 칸을 나눈다
  const c=cfgRead(); S.cfg=c;
  const ym=c.ym||ym0; $('#mlYm').value=ym; c.ym=ym;
  autoBase(ym); c.price=+$('#mlPrice').value||c.price; c.holi=new Set(
    String($('#mlHoli').value||'').split(/[\s,]+/).map(x=>x.trim()).filter(Boolean));
  S.all=all.filter(r=>r.date.startsWith(ym));
  S.depts=[...new Set(S.all.map(r=>r.dept))];
  if(S.dept&&S.depts.indexOf(S.dept)<0) S.dept='';
  apply(); }

function apply(){
  const c=S.cfg;
  S.rows=S.dept?S.all.filter(r=>r.dept===S.dept):S.all.slice();
  S.names=[...new Set(S.rows.map(r=>r.name))];     // 확인서에 실린 사람이 곧 대상자
  const ym=c.ym, [y,mm]=ym.split('-').map(Number), last=new Date(y,mm,0).getDate();
  S.days=[]; for(let d=1;d<=last;d++) S.days.push(ym+'-'+pad(d));
  const cells={}, chk=[];
  for(const r of S.rows){
    const k=r.date+'|'+r.name, j=judge(r,c), p=cells[k];
    if(!p||(j.ok&&!p.ok)){
      let auto='';
      if(c.shift.has(r.name)) auto='항상 제외 — 교대근무자·야간/휴일근무수당 지급대상자';
      else if(c.trip[r.name]&&c.trip[r.name].has(r.date)) auto='출장 식비 수령(여비 규정)';
      cells[k]={...j, on:j.ok&&!auto, auto:auto};
    }
    const diff=j.calc-r.pay;
    if(Math.abs(diff)>=1) chk.push({r,j,diff});
  }
  S.cells=cells; S.chk=chk; S.shop={};
  draw();
}

function draw(){
  const c=S.cfg;
  let cnt=0,hol=0,off=0,aut=0;
  for(const k in S.cells){const x=S.cells[k];
    if(x.on){cnt++; if(x.hol)hol++;} else if(x.ok){ if(x.auto) aut++; else off++; }}
  $('#mlStats').innerHTML='<div class="mlsum">'+
    '<b>'+S.names.length+'</b>명 · 지급 <b>'+cnt+'</b>식'+
    (hol?' <span class="mlmut">(휴일 '+hol+')</span>':'')+
    (aut?' · 자동 제외 <b>'+aut+'</b>식':'')+(off?' · 직접 해제 <b>'+off+'</b>식':'')+
    '</div>';
  const dbox=$('#mlDeptBox');
  if(dbox){
    if(S.depts.length>1){
      dbox.hidden=false;
      dbox.innerHTML='<span>확인서에 부서가 '+S.depts.length+'곳 있습니다 — 처리할 부서</span>'+
        '<select id="mlDept"><option value="">전체</option>'+
        S.depts.map(d=>'<option'+(S.dept===d?' selected':'')+'>'+esc(d)+'</option>').join('')+'</select>';
      $('#mlDept').onchange=e=>{S.dept=e.target.value;S.shop={};apply();};
    } else dbox.hidden=true;
  }

  const SH=new Set(shiftGet());
  let h='<thead><tr><th>일자</th>'+S.names.map(n=>
    '<th class="nm'+(SH.has(n)?' off':'')+'" data-nm="'+esc(n)+'" title="교대근무자라면 눌러서 항상 제외로 지정할 수 있습니다">'+
    esc(n)+(SH.has(n)?' <span class="nmx">항상 제외</span>':'')+'</th>').join('')+'<th>식수</th></tr></thead><tbody>';
  for(const d of S.days){
    const w='일월화수목금토'[new Date(d+'T00:00:00').getDay()], H=isHol(d,c);
    let n=0;
    const tds=S.names.map(nm=>{
      const x=S.cells[d+'|'+nm];
      if(!x) return '<td></td>';
      if(!x.ok) return '<td><span class="mlc x" title="'+esc(x.why)+'">·</span></td>';
      if(x.on) n++;
      const cls=x.on?'y':(x.auto?'a':'n');
      const tip=x.auto?('자동 제외 — '+x.auto+' / '+x.why):x.why;
      return '<td><span class="mlc '+cls+'" data-k="'+d+'|'+nm+'" title="'+esc(tip)+'">'+(x.on?'1':(x.auto?'제':'–'))+'</span></td>';
    }).join('');
    h+='<tr'+(H?' class="hol"':'')+'><td class="day">'+(+d.slice(8))+'일 ('+w+')'+(H?' 휴':'')+'</td>'+tds+'<td>'+(n||'')+'</td></tr>';
  }
  $('#mlGrid').innerHTML=h+'</tbody>';
  S.placed=false; S.shop={};      // 판정이 바뀌면 배치는 다시 눌러야 한다
  drawChk(); drawPay(); drawLedger(); drawTeamSet();
  const fc=document.querySelector('.view[data-view="meal"] .flowcard'); if(fc) fc.hidden=true;
  const up=document.querySelector('.view[data-view="meal"] .mlcard');   if(up) up.classList.add('slim');
  $('#mlOut').hidden=false;
}
const st=(k,v,u)=>'<div class="mlstat"><div class="k">'+k+'</div><div class="v">'+v+'<small>'+u+'</small></div></div>';

/* ---------- 대상 연월에 맞는 기준 자동 적용 ---------- */
function autoBase(ym){
  const y=ym.slice(0,4), note=$('#mlBaseNote'); let msg=[];
  if(!priceTouched){
    const p=priceFor(ym);
    if(+$('#mlPrice').value!==p) $('#mlPrice').value=p;
    msg.push('단가 <b>'+won(p)+'원</b> 자동 적용 <span class="mlmut">('+priceNote(ym)+')</span>');
  } else {
    msg.push('단가 <b>'+won(+$('#mlPrice').value)+'원</b> <span class="mlred">수동 지정</span> '+
             '<span class="mlmut">(규정 기준 '+won(priceFor(ym))+'원)</span>');
  }
  const hs=holiFor(y);
  if(hs){ $('#mlHoli').value=hs.join(', '); msg.push(y+'년 공휴일 <b>'+hs.length+'일</b> 자동 적용'); }
  else   msg.push('<span class="mlred">'+y+'년 공휴일이 기준파일에 없습니다 — 아래에 직접 입력하세요</span>');
  if(CFG&&CFG['규정']&&CFG['규정']['확인일']){
    const days=Math.floor((Date.now()-new Date(CFG['규정']['확인일']+'T00:00:00'))/864e5);
    if(days>180) msg.push('<span class="mlred">규정 확인일로부터 '+days+'일 경과 — 현행 [별표2] 재확인 권장</span>');
  }
  if(note) note.innerHTML='⚙ '+msg.join(' · ');
}

function chips(box,arr,cls,empty){
  const el=$(box); if(!el) return;
  el.innerHTML = arr.length
    ? arr.map(n=>'<span class="mlchip">'+esc(n)+'<button class="'+cls+'" data-n="'+esc(n)+'" title="빼기">✕</button></span>').join('')
    : '<span class="mlchipnote">'+empty+'</span>';
}
function drawTeamSet(){
  chips('#mlShiftSet', shiftGet(), 'mlsdel', '없음 — 우리 팀에 해당자가 없으면 비워 두는 것이 정상입니다.');
  chips('#mlShopSet', shopList(), 'mlhdel', '결제 후 상호를 적으면 여기에 쌓입니다.');
}

/* 이름을 누르면 「왜 빼는지」를 고르게 한다 — 사유가 다르면 다음 달 동작도 다르다 */
let POP=null;
function closePop(){ if(POP){ POP.remove(); POP=null; } }
document.addEventListener('click',e=>{ if(POP&&!e.target.closest('.mlpop')&&!e.target.closest('th.nm')&&!e.target.closest('.lname')) closePop(); });
function cellMenu(anchor,d,n){
  closePop();
  const x=S.cells[d+'|'+n]; if(!x) return;
  const shift=shiftGet().indexOf(n)>=0;
  const p=document.createElement('div'); p.className='mlpop';
  p.innerHTML='<div class="mlpoph"><b>'+esc(n)+'</b> · '+(+d.slice(5,7))+'월 '+(+d.slice(8))+'일'+
      '<small>'+esc(x.why||'')+'</small></div>'+
    (x.ok
      ? (x.on ? '<button data-a="off">이 날 제외 <small>이 날짜만 빼기</small></button>'
              : '<button data-a="on">이 날 지급 <small>다시 포함</small></button>')
      : '<button data-a="on">이 날 지급 <small class="w">시간 요건에 못 미치지만 강제로 포함합니다</small></button>')+
    (shift ? '<button data-a="unshift">「항상 제외」 해제</button>'
           : '<button data-a="shift">'+esc(n)+'님 항상 제외 <small>교대근무자·야간/휴일근무수당 지급대상자</small></button>')+
    '<button data-a="cancel" class="c">취소</button>';
  document.body.appendChild(p);
  const r=anchor.getBoundingClientRect();
  p.style.top=(window.scrollY+r.bottom+6)+'px';
  p.style.left=Math.min(window.scrollX+r.left, window.scrollX+document.documentElement.clientWidth-300)+'px';
  p.addEventListener('click',ev=>{
    const b2=ev.target.closest('button'); if(!b2) return;
    const a2=b2.dataset.a; closePop();
    if(a2==='on')  { x.on=true;  draw(); }
    if(a2==='off') { x.on=false; draw(); }
    if(a2==='shift')   { shiftSet([...shiftGet(),n]); refresh(); }
    if(a2==='unshift') { shiftSet(shiftGet().filter(z=>z!==n)); refresh(); }
  });
  POP=p;
}

function nameMenu(anchor,n){
  closePop();
  const on=shiftGet().indexOf(n)>=0;
  const p=document.createElement('div'); p.className='mlpop';
  p.innerHTML='<div class="mlpoph"><b>'+esc(n)+'</b></div>'+
    (on
      ? '<button data-a="unshift">항상 제외 해제 <small>다시 지급 대상으로</small></button>'
      : '<button data-a="shift">교대근무자 — 항상 제외 <small>야간·휴일근무수당을 상시 받는 직종. 해당자가 없는 부서가 대부분입니다</small></button>')+
    '<button data-a="cancel" class="c">취소</button>';
  document.body.appendChild(p);
  const r=anchor.getBoundingClientRect();
  p.style.top=(window.scrollY+r.bottom+6)+'px';
  p.style.left=Math.min(window.scrollX+r.left, window.scrollX+document.documentElement.clientWidth-300)+'px';
  p.addEventListener('click',ev=>{
    const b2=ev.target.closest('button'); if(!b2) return;
    const a2=b2.dataset.a; closePop();
    if(a2==='shift')   shiftSet([...shiftGet(),n]);
    if(a2==='unshift') shiftSet(shiftGet().filter(x=>x!==n));
    if(a2!=='cancel') refresh();
  });
  POP=p;
}

function refresh(){ if(S.all&&S.all.length){ S.cfg=cfgRead(); apply(); } else drawTeamSet(); }

/* ---------- 검산 ---------- */
function drawChk(){
  const box=$('#mlChk');
  if(!S.chk.length){ box.innerHTML='<div class="mlok">✓ 검산 이상 없음 — '+S.rows.length+'건 모두 확인서의 수당시간과 출퇴근 시각 계산이 일치합니다.</div>'; return; }
  const cap=S.chk.filter(x=>x.diff>0), bad=S.chk.filter(x=>x.diff<0);
  let h='<div class="mlwarn"><b>검산 결과 '+S.chk.length+'건</b> — 확인서의 「수당시간(분)」과 출퇴근 시각으로 계산한 값이 다릅니다.</div>';
  h+='<table class="mltbl"><thead><tr><th>근무일</th><th>성명</th><th>출퇴근</th><th>확인서</th><th>계산</th><th>차이</th><th>인정 종료(추정)</th><th>해석</th></tr></thead><tbody>';
  for(const x of S.chk.sort((a,b)=>a.r.date.localeCompare(b.r.date))){
    const why = x.diff>0
      ? '초과근무 <b>신청시간까지만</b> 인정된 것으로 보임 (신청 종료 후 추가 근무)'
      : '<b>확인 필요</b> — 계산값보다 확인서 수당이 큽니다 (판독 오류 가능)';
    h+='<tr class="'+(x.diff>0?'':'bad')+'"><td>'+x.r.date.slice(5)+'</td><td>'+esc(x.r.name)+'</td>'+
       '<td>'+x.r.inn+'~'+x.r.out+'</td><td>'+x.r.pay+'분</td><td>'+x.j.calc+'분</td>'+
       '<td>'+(x.diff>0?'+':'')+x.diff+'분</td><td>'+hhmm(x.j.est)+'</td><td class="l">'+why+'</td></tr>';
  }
  h+='</tbody></table><p class="mlnote">'+(cap.length?'신청시간 초과 근무 '+cap.length+'건 · ':'')+
     '확인 필요 '+bad.length+'건</p>';
  box.innerHTML=h;
}

/* ---------- 업체 · 집행대장 ---------- */
const MAXPAY=5;
let PAY=[{shop:'',amt:null}];
function totalCnt(){ let n=0; for(const k in S.cells) if(S.cells[k].on) n++; return n; }
function payTotal(){ return totalCnt()*(S.cfg.price||0); }
function paySum(){ return PAY.reduce((a,r)=>a+(+r.amt||0),0); }
function payMsg(cls,html){ const m=$('#mlPayMsg'); if(m){ m.className='paymsg '+cls; m.innerHTML=html; } }
function drawPay(){
  const c=S.cfg, cnt=totalCnt(), tot=cnt*c.price;
  $('#mlPayBox').innerHTML=
    '<div class="paysum"><span class="k">결제할 금액</span>'+
    '<span class="v">'+won(tot)+'<small>원</small></span>'+
    '<span class="f">1인 1식 '+won(c.price)+'원 × '+cnt+'식<br>'+
    '<em>가맹업소는 어디든 무방합니다 — 이 금액만 맞추면 됩니다</em></span></div>';
  $('#mlShopList').innerHTML=shopList().map(x=>'<option value="'+esc(x)+'">').join('');

  let h='<thead><tr><th class="l">결제할 가맹업소</th><th style="width:190px">금액(원)</th>'+
        '<th style="width:56px">식수</th><th style="width:74px"></th></tr></thead><tbody>';
  PAY.forEach((r,i)=>{
    h+='<tr data-r="'+i+'">'+
       '<td class="l"><input class="payshop" list="mlShopList" data-i="'+i+'" value="'+esc(r.shop)+'"'+
         ' placeholder="식당 이름"></td>'+
       '<td class="amtcell"><div class="amtwrap">'+
         '<button class="amtstep dn" data-i="'+i+'" title="'+won(c.price)+'원 내리기">−</button>'+
         '<input class="payamt r" type="number" step="'+c.price+'" min="0" data-i="'+i+'"'+
           ' value="'+(r.amt==null?'':r.amt)+'" placeholder="0">'+
         '<button class="amtstep up" data-i="'+i+'" title="'+won(c.price)+'원 올리기">＋</button>'+
       '</div></td>'+
       '<td class="c" data-n="'+i+'"></td>'+
       '<td>'+(i===0
           ? '<button class="payadd" title="줄 추가">추가</button>'
           : '<button class="paydel" data-i="'+i+'" title="이 줄 지우기">삭제</button>')+'</td></tr>';
  });
  h+='<tr class="gapr" id="mlPayGap"><th class="l">차액</th><th class="r" id="mlPayGapV"></th><th colspan="2"></th></tr>'+
     '<tr class="sum"><th class="l">합계</th><th class="r" id="mlPaySum"></th>'+
     '<th class="c" id="mlPaySumN"></th><th></th></tr>';
  $('#mlPayTbl').innerHTML=h+'</tbody>';
  drawPayStatus();
}

/* 입력칸은 건드리지 않고 식수·합계·안내만 새로 쓴다 (타이핑 중 커서가 튀지 않도록) */
function drawPayStatus(keep){
  const c=S.cfg, sum=paySum(), tbl=$('#mlPayTbl');
  PAY.forEach((r,i)=>{
    const td=tbl.querySelector('[data-n="'+i+'"]');
    const n=(+r.amt||0)/c.price, bad=(+r.amt>0)&&(n!==Math.floor(n));
    if(td) td.innerHTML = bad ? '<span class="warn">?</span>' : (n?n+'식':'');
    const tr=tbl.querySelector('[data-r="'+i+'"]'); if(tr) tr.className = bad?'bad':'';
  });
  const sv=$('#mlPaySum'), sn=$('#mlPaySumN');
  if(sv) sv.textContent=won(sum);
  if(sn) sn.textContent=(sum%c.price?'':Math.round(sum/c.price)+'식');

  const gap=payTotal()-sum, gr=$('#mlPayGap'), gv=$('#mlPayGapV');
  if(gr&&gv){
    gr.className = 'gapr '+(gap===0?'zero':(gap>0?'less':'over'));
    gv.textContent = gap===0 ? '0' : (gap>0 ? '+'+won(gap) : '−'+won(-gap));
  }

  const ab=tbl.querySelector('.payadd');
  if(ab){ ab.disabled = PAY.length>=MAXPAY;
    ab.title = PAY.length>=MAXPAY ? '가맹업소는 '+MAXPAY+'곳까지 적을 수 있습니다' : '업소 추가'; }

  if(keep) return;                                  // 배치 결과 문구는 덮어쓰지 않는다
  if(!PAY.some(r=>+r.amt>0)){
    payMsg('hint','식당 이름을 적고 <b>금액 자동계산</b>을 누르면 금액이 나뉩니다. 직접 적어도 됩니다.');
    return;
  }
  const L=payProblems();
  if(L.length){ payMsg('bad',L.join('<br>')); return; }
  if(!PAY.every(r=>(r.shop||'').trim()||!(+r.amt>0)))
    payMsg('hint','금액은 맞습니다 — 식당 이름을 적고 <b>가맹업소명 배치하기</b>를 누르세요.');
  else payMsg('hint','금액이 맞습니다 — <b>가맹업소명 배치하기</b>를 누르세요.');
}

const rowName=(r,i)=>(r.shop||'').trim()?esc(r.shop.trim()):(i+1)+'번째 줄';

/* 눌러서 바로 넣는 금액 단추 */
function fixChip(i,v){ return '<button class="fixamt" data-i="'+i+'" data-v="'+v+'">'+won(v)+'원으로 맞추기</button>'; }

/* 이 줄을 얼마로 적어야 합계가 딱 맞는가 (다른 줄은 그대로 둔 채) */
function needFor(i){
  const tot=payTotal();
  return tot - PAY.reduce((a,r,j)=>a+(j===i?0:(+r.amt||0)),0);
}

/* 9,000원 단위가 아닌 금액 → 바로 위·아래의 가능한 금액을 추천한다 */
function badAmtMsg(r,i){
  const p=S.cfg.price, v=+r.amt;
  const up=Math.ceil(v/p)*p, dn=Math.floor(v/p)*p, pick=[];
  if(up>0) pick.push(fixChip(i,up)+'<em>+'+won(up-v)+'</em>');
  if(dn>0) pick.push(fixChip(i,dn)+'<em>−'+won(v-dn)+'</em>');
  return '⚠ '+esc(r.shop||'이 줄')+' <b>'+won(v)+'원</b>은 '+won(p)+'원 단위가 아닙니다 — '+pick.join(' 또는 ');
}

/* 지금 무엇이 잘못됐는지 — 고칠 곳이 한 군데면 그 금액을 딱 집어 준다 */
function payProblems(){
  const c=S.cfg, p=c.price, tot=payTotal(), gap=tot-paySum(), L=[];
  const bad=PAY.map((r,i)=>({r,i})).filter(x=>(+x.r.amt>0)&&((+x.r.amt)%p));

  /* ① 단위가 틀린 줄이 하나뿐이고, 그 줄만 고치면 합계까지 맞는 경우 */
  if(bad.length===1){
    const {r,i}=bad[0], need=needFor(i);
    if(need>0 && need%p===0)
      return ['⚠ '+rowName(r,i)+' <b>'+won(+r.amt)+'원</b>은 '+won(p)+'원 단위가 아닙니다. '+
              '합계까지 맞추려면 <b>'+won(need)+'원</b> 하나뿐입니다 — '+fixChip(i,need)];
  }
  /* ② 단위는 다 맞는데 합계만 어긋난 경우 → 마지막 줄을 고치면 된다 */
  if(!bad.length && gap!==0){
    let i=-1; for(let j=PAY.length-1;j>=0;j--) if(+PAY[j].amt>0){ i=j; break; }
    const need=(i>=0)?needFor(i):0;
    const head=gap<0
      ? '⚠ 합계가 결제할 금액 <b>'+won(tot)+'원</b>보다 <b>'+won(-gap)+'원</b> 많습니다'
      : '⚠ 합계가 결제할 금액 <b>'+won(tot)+'원</b>에 <b>'+won(gap)+'원</b> 모자랍니다';
    if(i>=0 && need>0 && need%p===0)
      return [head+' — 마지막 줄을 '+fixChip(i,need)+' 하면 맞습니다.'];
    return [head+(gap>0?' — 업소를 추가해 남은 금액을 적으세요.':' — 금액을 줄여 주세요.')];
  }
  /* ③ 그 밖에는 문제를 모두 나열한다 (총액이 먼저) */
  if(gap<0) L.push('⚠ 합계가 결제할 금액 <b>'+won(tot)+'원</b>보다 <b>'+won(-gap)+'원</b> 많습니다 — 금액을 줄여 주세요.');
  else if(gap>0) L.push('⚠ 합계가 결제할 금액 <b>'+won(tot)+'원</b>에 <b>'+won(gap)+'원</b> 모자랍니다 — 금액을 늘리거나 업소를 추가하세요.');
  bad.forEach(x=>L.push(badAmtMsg(x.r,x.i)));
  return L;
}

/* 배치 결과를 지운다 — 금액이나 업소명이 바뀌면 다시 눌러야 한다 */
function unplace(){
  if(!S.placed) return;
  S.placed=false; S.shop={}; drawLedger();
}

function packDays(days,caps){
  const left=caps.slice(), out=new Array(days.length);
  let steps=0;
  function go(i,prev){
    if(++steps>300000) return false;
    if(i===days.length) return left.every(x=>x===0);
    const n=days[i].n;
    const order=[]; if(prev>=0) order.push(prev);          // 같은 업소를 이어 쓰면 대장이 깔끔하다
    for(let s=0;s<left.length;s++) if(s!==prev) order.push(s);
    for(const s of order){
      if(left[s]<n) continue;
      left[s]-=n; out[i]=s;
      if(go(i+1,s)) return true;
      left[s]+=n;
    }
    return false;
  }
  return go(0,-1)?out.slice():null;
}

/* 나눌 수 없는 금액일 때, 가장 가까운 가능한 금액을 찾아 알려 준다 */
function nearFix(days,caps,price){
  for(let d=1;d<=8;d++){
    for(let i=0;i<caps.length;i++) for(let j=0;j<caps.length;j++){
      if(i===j) continue;
      const t=caps.slice(); t[i]+=d; t[j]-=d;
      if(t[j]<=0) continue;
      if(packDays(days,t)) return t.map(x=>x*price);
    }
  }
  return null;
}

function payDayList(){
  return payDays().map(d=>({d, n:S.names.filter(x=>{const y=S.cells[d+'|'+x];return y&&y.on;}).length}))
                  .filter(x=>x.n>0);
}

/* 적힌 줄 수에 맞춰 총액을 알아서 나눈다 — 날짜를 순서대로 묶으므로 배치가 반드시 된다 */
function autoSplit(){
  const c=S.cfg, days=payDayList(), n=PAY.length;
  const T=days.reduce((a,x)=>a+x.n,0);
  if(!T){ payMsg('bad','⚠ 지급 대상이 없습니다.'); return false; }
  if(T<n){ payMsg('bad','⚠ 지급 일수가 '+T+'식뿐이라 '+n+'곳으로 나눌 수 없습니다 — 줄을 줄여 주세요.'); return false; }
  const caps=new Array(n).fill(0);
  let acc=0;
  for(const d of days){ caps[Math.min(n-1,Math.floor(acc*n/T))]+=d.n; acc+=d.n; }
  PAY.forEach((r,i)=>{ r.amt=caps[i]*c.price; });
  return true;
}

/* 「배치하기」 — 여기서만 집행대장의 가맹업소명 칸이 채워진다 */
function placeShops(){
  const c=S.cfg, price=c.price;
  const rows=PAY.filter(r=>(r.shop||'').trim() && +r.amt>0);
  if(!rows.length){ payMsg('bad','⚠ 식당 이름과 금액을 먼저 적어 주세요.'); return; }

  const probs=payProblems();
  if(probs.length){ payMsg('bad',probs.join('<br>')); return; }

  const days=payDayList(), caps=rows.map(r=>Math.round((+r.amt)/price));
  const res=packDays(days,caps);
  if(!res){
    const fix=nearFix(days,caps,price);
    payMsg('bad','⚠ 이 금액으로는 <b>날짜가 나뉘지 않습니다.</b> 하루치가 '+won(price)+'원·'+won(price*2)+'원처럼 떨어지기 때문입니다.'+
      (fix?'<br>예를 들어 <b>'+fix.map(won).join('원 · ')+'원</b>이면 배치됩니다.':'<br>금액을 '+won(price)+'원씩 옮겨 보세요.'));
    return;
  }
  S.shop={}; res.forEach((si,i)=>{ S.shop[days[i].d]=rows[si].shop; });
  S.placed=true;
  rows.forEach(r=>histAdd(r.shop.trim(),c.ym,1));
  drawLedger();
  payMsg('ok','✓ 배치했습니다 — 위 집행대장의 <b>가맹업소명</b> 칸을 확인하세요.');
  const L=$('#mlLedger'); if(L) L.scrollIntoView({behavior:'smooth',block:'start'});
}

const payDays=()=>S.days.filter(d=>S.names.some(n=>{const x=S.cells[d+'|'+n];return x&&x.on;}));
function ledgerRows(){
  const c=S.cfg;
  return S.days.filter(d=>S.names.some(n=>S.cells[d+'|'+n])).map(d=>{
    const ns=[];
    S.names.forEach(n=>{ const x=S.cells[d+'|'+n]; if(!x) return;
      ns.push({n, on:!!x.on, why: x.on ? (x.hol?'휴일 근무':'') + (x.why?' · '+x.why:'')
                                       : (x.auto || (x.ok ? '담당자가 직접 해제' : x.why)) }); });
    const cnt=ns.filter(z=>z.on).length;
    return {d, ns, cnt, shop:S.shop[d]||'', amt:cnt*c.price};
  });
}

/* ─────────────────────────────────────────────────────────────
   결재용 집행대장 — 엑셀 「특근매식비집행대장」 시트를 그대로 옮긴 인쇄물
   원본 치수 : HY견명조 제목 28pt·본문 14pt / 행높이 55·33·21·45pt
               열너비 B~M 20.8·10.8·15.0·17.3·80.0·37.4·25.6·19.4·29.8·21.5·16.9·16.9mm
               A4 가로 · 여백 10/6/19/6mm · 축소 76% · 한 쪽 12건
   → 아래 CSS 는 76% 를 미리 곱한 실제 인쇄 치수(mm)로 적어 둔다
   ───────────────────────────────────────────────────────────── */
const PG_ROWS=12;                                   // 한 쪽에 들어가는 건수
function drawPrintDoc(){
  const box=$('#mlPrintDoc'); if(!box) return;
  const c=S.cfg, rs=ledgerRows().filter(r=>r.cnt);  // 지급분만 (제외자·0명 제외)
  if(!rs.length){ box.innerHTML=''; return; }
  const tot=rs.reduce((a,r)=>a+r.amt,0), cnt=rs.reduce((a,r)=>a+r.cnt,0);
  const pages=[]; for(let i=0;i<rs.length;i+=PG_ROWS) pages.push(rs.slice(i,i+PG_ROWS));

  const head =
    '<thead>'+
      '<tr class="hd1">'+
        '<th colspan="3" rowspan="2">특근일자</th>'+
        '<th rowspan="2">인원<br>(명)</th>'+
        '<th rowspan="2">특 근 자 명 단</th>'+
        '<th rowspan="2">가맹업소명</th>'+
        '<th colspan="3" rowspan="2">예산집행내역</th>'+
        '<th colspan="3">결 재</th></tr>'+
      '<tr class="hd2"><th>담당자</th><th>담 당</th><th>과 장</th></tr>'+
    '</thead>';
  const cols='<colgroup>'+['c-y','c-m','c-d','c-n','c-nm','c-sh','c-p','c-x','c-a','c-k1','c-k2','c-k3']
             .map(k=>'<col class="'+k+'">').join('')+'</colgroup>';

  let h='';
  pages.forEach((pg,pi)=>{
    h+='<section class="pg"><div class="pgt">특 근 매 식 비 집 행 대 장</div>'+
       '<table class="pgt2">'+cols+head+'<tbody>';
    pg.forEach(r=>{
      const [y,m,d]=r.d.split('-');
      h+='<tr>'+
         '<td class="y">'+y+'.</td><td class="m">'+m+'.</td><td class="d">'+d+'.</td>'+
         '<td class="n">'+r.cnt+'명</td>'+
         '<td class="nm">'+esc(r.ns.filter(z=>z.on).map(z=>z.n).join(', '))+'</td>'+
         '<td class="sh">'+esc(r.shop||'')+'</td>'+
         '<td class="p">'+won(c.price)+'원</td><td class="x">×'+r.cnt+'명=</td>'+
         '<td class="a">'+won(r.amt)+'원</td>'+
         '<td></td><td class="jg">전결</td><td></td></tr>';
    });
    if(pi===pages.length-1)
      h+='<tr class="tot"><td colspan="3"></td><td class="n">'+cnt+'명</td><td class="nm">합계</td>'+
         '<td></td><td colspan="3" class="tota">'+won(c.price)+'원 x '+cnt+'명 ='+won(tot)+'원</td>'+
         '<td></td><td></td><td></td></tr>';
    h+='</tbody></table></section>';
  });
  box.innerHTML=h;
}

function drawLedger(){
  const c=S.cfg, rs=ledgerRows(), [y,m]=c.ym.split('-');
  const tot=rs.reduce((a,r)=>a+r.amt,0), cnt=rs.reduce((a,r)=>a+r.cnt,0);
  const by={}; rs.forEach(r=>{ if(!r.shop)return; (by[r.shop]=by[r.shop]||{c:0,a:0}); by[r.shop].c+=r.cnt; by[r.shop].a+=r.amt; });
  const dept=PROF||'달성군 행정국';
  let h='<div class="mltitle">특 근 매 식 비 집 행 대 장</div>'+
    '<div class="mlhead"><div class="mlsub2">'+y+'년 '+(+m)+'월 &nbsp;·&nbsp; '+esc(dept)+'</div></div>'+
    '<div class="ldwrap"><table class="mltbl out"><thead><tr><th style="width:100px">특근일자</th><th style="width:56px">인원</th><th>특 근 자 명 단</th><th style="width:140px">가맹업소명</th><th style="width:150px">예산집행내역</th></tr></thead><tbody>';
  for(const r of rs){
    const names=r.ns.map(z=>'<span class="lname'+(z.on?'':' ex')+'" data-k="'+r.d+'|'+z.n+'"'+
      ' title="'+esc(z.on?('지급 대상'+(z.why?' — '+z.why:'')):('제외 — '+z.why))+'">'+esc(z.n)+'</span>').join('<i>,</i> ');
    const dt=new Date(r.d+'T00:00:00'), w='일월화수목금토'[dt.getDay()], H=isHol(r.d,c);
    const cls=[r.cnt?'':'zero', H?'hol':''].filter(Boolean).join(' ');
    h+='<tr'+(cls?' class="'+cls+'"':'')+'><td class="dt">'+(+m)+'. '+(+r.d.slice(8))+'.<em>('+w+')</em></td><td>'+(r.cnt||'')+'</td>'+
       '<td class="l nm">'+names+'</td>'+
       '<td class="sh">'+(r.shop?esc(r.shop):'')+'</td>'+
       '<td class="r">'+(r.cnt?won(c.price)+'×'+r.cnt+' = '+won(r.amt):'')+'</td></tr>';
  }
  h+='<tr class="sum"><th>합 계</th><th>'+cnt+'</th><th colspan="2"></th><th class="r">'+won(tot)+'원</th></tr></tbody></table></div>'+
     '<p class="mlnote noprint">이름을 누르면 그 날의 지급 여부를 바꿀 수 있습니다. '+
     '<span class="exdemo">회색 취소선</span>은 제외된 사람이며 <b>인쇄물에는 나오지 않습니다.</b></p>';
  if(Object.keys(by).length>1){                 // 나눠 결제한 경우에만 업소별 정산을 덧붙인다
    /* 화면에서는 아래 입력표와 겹치므로 인쇄물에만 낸다 */
    h+='<div class="shopsum"><div class="mlh5">가맹업소별 정산</div>'+
       '<table class="mltbl out"><thead><tr><th>가맹업소</th><th style="width:80px">식수</th><th style="width:140px">금액</th></tr></thead><tbody>';
    for(const k in by) h+='<tr><td class="l">'+esc(k)+'</td><td>'+by[k].c+'</td><td class="r">'+won(by[k].a)+'원</td></tr>';
    h+='</tbody></table></div>';
  }
  h+='<p class="mlnote">「지방자치단체 회계관리에 관한 훈령」[별표2] 201-01 사무관리비 마. 급량비 · 1인 1식 '+won(c.price)+'원</p>';
  $('#mlLedger').innerHTML=h;
  drawPrintDoc();
}

/* ---------- 과거 실적 대조 (검증) ---------- */
function verify(){
  const box=$('#mlVout'), raw=$('#mlVin').value||'';
  const want={}; let m;
  const re=/([가-힣]{2,4})\s*[:\s]\s*(\d{1,3})/g;
  while((m=re.exec(raw))) want[m[1]]=+m[2];
  if(!Object.keys(want).length){ box.innerHTML='<div class="mlwarn">이름과 식수를 읽지 못했습니다. <code>조호현 17</code> 형태로 적어 주세요.</div>'; return; }
  const got={}; S.names.forEach(n=>got[n]=0);
  for(const k in S.cells){ if(!S.cells[k].on) continue; const n=k.split('|')[1]; got[n]=(got[n]||0)+1; }
  const all=[...new Set([...Object.keys(want),...Object.keys(got)])].sort((a,b)=>a.localeCompare(b,'ko'));
  let same=0, diff=0, rows='';
  for(const n of all){
    const w=want[n], g=got[n], has=(w!=null&&g!=null);
    const d=has?(g-w):null;
    if(has&&d===0) same++; else diff++;
    rows+='<tr class="'+(has&&d===0?'':'bad')+'"><td class="l">'+esc(n)+'</td>'+
      '<td>'+(w==null?'<span class="mlmut">없음</span>':w+'식')+'</td>'+
      '<td>'+(g==null?'<span class="mlmut">없음</span>':g+'식')+'</td>'+
      '<td>'+(d==null?'—':(d===0?'일치':(d>0?'+':'')+d+'식'))+'</td>'+
      '<td class="l">'+(d===0?'':(w==null?'확인서에만 있음':g==null?'확인서에 없음':
        d<0?'우리 계산이 적음 — 요건 미달·공휴일 누락 확인':'우리 계산이 많음 — <b>제외 대상</b>(출장 식비·야간/휴일수당·교대)일 가능성'))+'</td></tr>';
  }
  const tw=Object.values(want).reduce((a,b)=>a+b,0), tg=Object.values(got).reduce((a,b)=>a+b,0);
  box.innerHTML=(diff===0
      ? '<div class="mlok">✓ <b>완전 일치</b> — '+all.length+'명 '+tg+'식 모두 기존 실적과 같습니다.</div>'
      : '<div class="mlwarn"><b>'+diff+'명 차이</b> (일치 '+same+'명) — 아래 사유를 확인하세요. 차이가 곧 오류는 아닙니다.</div>')
    +'<table class="mltbl"><thead><tr><th>성명</th><th style="width:88px">기존 실적</th>'
    +'<th style="width:88px">우리 계산</th><th style="width:78px">차이</th><th>해석</th></tr></thead><tbody>'+rows
    +'<tr class="sum"><th>합계</th><th>'+tw+'식</th><th>'+tg+'식</th><th>'+(tg-tw>0?'+':'')+(tg-tw)+'식</th>'
    +'<th class="l">금액차 '+won((tg-tw)*S.cfg.price)+'원</th></tr></tbody></table>';
}

/* ---------- PDF ---------- */
/* pdf.js 는 사이트에 내장한다 — 폐쇄망·차단 환경에서도 동작해야 하므로 외부 CDN에 의존하지 않는다 */
const PDFJS_SRC='vendor/pdf.min.js', PDFJS_WORKER='vendor/pdf.worker.min.js';
function loadPdfJs(){
  return new Promise((ok,ng)=>{
    if(window.pdfjsLib) return ok(window.pdfjsLib);
    const el=document.createElement('script');
    el.src=PDFJS_SRC;
    el.onload=()=>window.pdfjsLib?ok(window.pdfjsLib):ng(new Error('LIB'));
    el.onerror=()=>ng(new Error('LOAD'));
    document.head.appendChild(el);
  });
}
async function readPdf(f){
  const w=$('#mlPdfMsg'); w.textContent='';
  setDrop('mlDrop','busy','<b>⏳ '+esc(f.name)+'</b><small>파일을 여는 중…</small>'+bar(8));
  try{
    const lib=await loadPdfJs();
    lib.GlobalWorkerOptions.workerSrc=PDFJS_WORKER;
    setDrop('mlDrop','busy','<b>⏳ '+esc(f.name)+'</b><small>내용을 읽는 중…</small>'+bar(20));
    const pdf=await lib.getDocument({data:await f.arrayBuffer()}).promise;
    let txt='';
    for(let p=1;p<=pdf.numPages;p++){
      setDrop('mlDrop','busy','<b>⏳ '+esc(f.name)+'</b><small>읽는 중 &nbsp;'+p+' / '+pdf.numPages+' 쪽</small>'
        +bar(20+Math.round(70*p/pdf.numPages)));
      await new Promise(r=>setTimeout(r,0));              // 화면이 갱신될 틈을 준다
      const ct=await (await pdf.getPage(p)).getTextContent();
      let y=null,line='';
      for(const it of ct.items){
        const ny=Math.round(it.transform[5]);
        if(y!==null&&Math.abs(ny-y)>3){ txt+=line+'\n'; line=''; }
        y=ny; line+=it.str+' ';
      }
      txt+=line+'\n';
    }
    setDrop('mlDrop','busy','<b>⏳ '+esc(f.name)+'</b><small>지급 대상을 판정하는 중…</small>'+bar(96));
    await new Promise(r=>setTimeout(r,0));
    S.pdfText=txt;
    run(txt);
    const n=(S.rows||[]).length;
    if(n){
      setDrop('mlDrop','done','<b>✅ '+esc(f.name)+'</b>'+
        '<button class="mlx" id="mlClr" type="button" title="이 파일 빼기" aria-label="이 파일 빼기">✕</button>');
      const o=$('#mlOut'); if(o&&!o.hidden) setTimeout(()=>o.scrollIntoView({behavior:'smooth',block:'start'}),150);
    }else if(txt.replace(/\s/g,'').length<80){
      /* 글자가 한 톨도 없다 = 복합기로 스캔한 그림 PDF */
      setDrop('mlDrop','err','<b>⚠ 스캔한 PDF 파일입니다</b>'+
        '<em>새올에서 <b>인쇄 → PDF로 저장</b>한 파일을 올려 주세요</em>');
    }else{
      setDrop('mlDrop','err','<b>⚠ 근무기록을 찾지 못했습니다</b>'+
        '<small>'+esc(f.name)+' · 초과근무 확인서 형식이 아닌 것 같습니다</small>'+
        '<em>다른 파일로 다시 시도하려면 클릭하세요</em>');
    }
  }catch(e){
    const why = e && e.message==='LOAD' ? 'PDF 읽기 모듈을 불러오지 못했습니다'
              : e && e.message==='LIB'  ? 'PDF 읽기 모듈이 실행되지 않았습니다'
              : e && /password|encrypt/i.test(e.message||'') ? '암호가 걸린 PDF입니다'
              : 'PDF 내용을 읽지 못했습니다';
    setDrop('mlDrop','err','<b>⚠ '+esc(why)+'</b><small>'+esc(String((e&&e.message)||e||'')).slice(0,90)+
      '</small><em>다시 시도하려면 클릭하세요</em>');
  }
}

/* 올린 확인서를 빼고 계산 결과까지 처음 상태로 되돌린다 */
function clearMeal(){
  S.all=[]; S.rows=[]; S.days=[]; S.names=[]; S.depts=[]; S.dept='';
  S.cells={}; S.shop={}; S.chk=[]; S.pdfText=''; S.placed=false;
  PAY=[{shop:'',amt:null}];                 // 적어 둔 가맹업소도 함께 지운다
  const o=$('#mlOut'); if(o) o.hidden=true;
  const fi=$('#mlFile'); if(fi) fi.value='';
  const db=$('#mlDeptBox'); if(db){ db.hidden=true; db.innerHTML=''; }
  setDrop('mlDrop','');                     // 드롭존을 처음 문구로
  const card=$('#mlDrop').closest('.card'); // 파일 올리기 칸이 보이게
  if(card) card.scrollIntoView({behavior:'smooth',block:'center'});
}

/* 드롭존 상태 : 놓는 순간부터 끝날 때까지 큰 영역이 직접 말해 준다 */
const DROP_IDLE={
  mlDrop:'<b>초과근무 확인서 PDF</b><small>새올에서 출력한 파일을 끌어다 놓거나 클릭 · 올리면 <b>바로 판정</b></small>',
  mlTripDrop:'<b>출장 내역 PDF</b><small>여비로 식비를 받은 날은 <b>자동 제외</b>됩니다</small>'
};
function setDrop(id,state,html){
  const el=$('#'+id); if(!el) return;
  el.classList.remove('busy','done','err');
  if(state) el.classList.add(state);
  el.innerHTML = state ? html : DROP_IDLE[id];
}
const bar=pct=>'<div class="dbar"><i style="width:'+pct+'%"></i></div>';

/* 출장 내역 PDF → 이름·날짜만 뽑아 설정란 채우기 */
async function readTrip(f){
  const w=$('#mlTripMsg'); w.textContent='';
  setDrop('mlTripDrop','busy','<b>⏳ '+esc(f.name)+'</b><small>읽는 중…</small>'+bar(30));
  try{
    const lib=await loadPdfJs();
    lib.GlobalWorkerOptions.workerSrc=PDFJS_WORKER;
    const pdf=await lib.getDocument({data:await f.arrayBuffer()}).promise;
    let txt='';
    for(let p=1;p<=pdf.numPages;p++){
      const ct=await (await pdf.getPage(p)).getTextContent();
      let y=null,line='';
      for(const it of ct.items){
        const ny=Math.round(it.transform[5]);
        if(y!==null&&Math.abs(ny-y)>3){ txt+=line+'\n'; line=''; }
        y=ny; line+=it.str+' ';
      }
      txt+=line+'\n';
    }
    txt=txt.split(/\r?\n/).map(norm).join('\n');
    $('#mlTrip').value=txt;
    const map=parseTrip(txt), n=Object.keys(map).length;
    let cnt=0; for(const k in map) cnt+=map[k].size;
    setDrop('mlTripDrop','done','<b>✅ '+esc(f.name)+'</b>');
    w.innerHTML='<button class="mllink" id="mlTripClr">출장 내역 지우기</button>';
    if(S.all&&S.all.length){ S.cfg=cfgRead(); apply(); }
  }catch(e){
    setDrop('mlTripDrop','err','<b>⚠ 출장 내역을 읽지 못했습니다</b><small>'+
      esc(String((e&&e.message)||e||'')).slice(0,90)+'</small>');
  }
}

/* ---------- 화면 ---------- */
function build(){
  const root=$('#mealBody'); if(!root||S.built) return; S.built=true;
  root.innerHTML=`
  <div class="card mlcard">
    <h4>① 확인서 올리기 <small>PDF 한 개면 끝납니다</small></h4>
    <div class="mlup solo">
      <div class="mldrop" id="mlDrop"><b>초과근무 확인서 PDF</b>
        <small>새올에서 출력한 파일을 끌어다 놓거나 클릭 · 올리면 <b>바로 판정</b></small></div>
      <input type="file" id="mlFile" accept="application/pdf" hidden>
      <p class="mlnote" id="mlPdfMsg">이 파일 하나면 판정·인원·명단이 모두 정해집니다.</p>
    </div>
    <button class="mlmore" id="mlTripToggle">＋ 출장 다녀온 사람이 있나요?</button>
    <div id="mlTripWrap" hidden>
      <div class="mldrop alt" id="mlTripDrop"><b>출장 내역 PDF</b>
        <small>여비로 식비를 받은 날은 <b>자동 제외</b>됩니다</small></div>
      <input type="file" id="mlTripFile" accept="application/pdf" hidden>
      <p class="mlnote" id="mlTripMsg">없으면 넣지 않으셔도 됩니다.</p>
    </div>
    <textarea id="mlTrip" hidden></textarea>
  </div>

  <div id="mlOut" hidden>
    <div class="card mlcard paycard">
      <h4>② 계산 결과</h4>
      <div class="mlpay" id="mlPayBox"></div>
      <div class="mlsum2" id="mlStats"></div>
      <div class="mlteam" id="mlDeptBox" hidden></div>

      <div class="mlfoot">
        <h5 class="mlfh">결제할 가맹업소 적기</h5>
        <table class="mltbl pay" id="mlPayTbl"></table>
        <datalist id="mlShopList"></datalist>
        <p class="paymsg hint" id="mlPayMsg"></p>
      </div>

      <div class="mlbtns split">
        <span class="lft"><button class="btn pri" id="mlAuto">금액 자동계산</button>
          <button class="btn" id="mlPlace">가맹업소명 배치하기</button></span>
        <span class="rgt"><button class="btn" id="mlPrev">📄 인쇄 미리보기</button>
          <button class="btn pri" id="mlPrint">🖨 인쇄하기</button>
          <button class="btn" id="mlXls">엑셀 내려받기</button></span>
      </div>

      <div id="mlLedger"></div>
      <div id="mlPrintDoc"></div>


    </div>

    <details class="card mlcard foldcard sub" hidden>
      <summary><b>📅 일자별 판정 내역</b><small>사람·날짜별로 확인하고 고칠 수 있습니다</small></summary>
      <div class="foldbody">
        <p class="mlleg"><b>1</b> 지급 · <b>제</b> 규정상 자동 제외 · <b>–</b> 직접 해제 · <b>·</b> 시간 요건 미달
          <span class="mlmut">— 칸을 누르면 바뀌고, 이름을 누르면 교대근무자로 지정할 수 있습니다</span></p>
        <div class="mlscroll"><table class="mlgrid" id="mlGrid"></table></div>
      </div>
    </details>

    <details class="card mlcard foldcard sub" hidden>
      <summary><b>🔍 검산</b><small>확인서 수당시간 ↔ 출퇴근 시각 대조</small></summary>
      <div class="foldbody" id="mlChk"></div>
    </details>

    <details class="card mlcard foldcard sub" hidden>
      <summary><b>📋 과거 실적과 대조</b><small>검증용 — 이미 지급된 달로 확인</small></summary>
      <div class="foldbody">
        <p class="mlnote">기존 시트 맨 아래 <b>「계」 행</b>을 붙여넣거나 <code>조호현 17, 김원규 18</code>처럼 적으세요.</p>
        <textarea id="mlVin" class="mlraw" style="min-height:64px" placeholder="조호현 17  김원규 18  김경민 18  김규태 1"></textarea>
        <div class="mlbtns"><button class="btn pri" id="mlVrun">대조하기</button>
          <button class="btn" id="mlVclr">지우기</button></div>
        <div id="mlVout"></div>
      </div>
    </details>
  </div>

  <details class="card mlcard setcard" id="mlSet" hidden>
    <summary><b>⚙ 기억하는 것 · 적용 중인 기준</b><small>고칠 일은 거의 없습니다</small></summary>
    <div class="setbody">
      <p class="mlkeep">💾 <b>타이핑할 칸이 없습니다.</b> 확인서에 실린 사람이 곧 대상자이며, 모든 값은 올린 파일과
        군 공통 기준파일에서 나옵니다. 아래는 그동안 <b>이 브라우저가 익힌 것</b>입니다.
        <span class="mlkeep2">같은 자리·같은 브라우저에서만 유지되며, 2027년 본 구축에서 <b>계정 단위 서버 저장</b>으로 바뀝니다.</span></p>

      <div class="mlfull"><span class="mllab">항상 제외 <small class="mlmut">— 교대근무자·야간/휴일근무수당을 <b>상시</b> 받는 직종. 해당자가 없는 부서가 대부분입니다</small></span>
        <div id="mlShiftSet" class="mlchips"></div></div>

      <div class="mlfull"><span class="mllab">결제했던 상호 <small class="mlmut">— 자동완성으로 쓰입니다</small></span>
        <div id="mlShopSet" class="mlchips"></div></div>

      <p class="mlbase" id="mlBaseNote">⚙ 기준파일을 불러오는 중…</p>
      <p class="mlsaved" id="mlSaved"></p>

      <details class="mlfold"><summary>이번 계산에만 기준값 바꾸기 <span class="mlmut">(저장되지 않습니다)</span></summary>
        <div class="mlgrid">
          <label><span>대상 연월</span><input id="mlYm" value="2026-08" placeholder="YYYY-MM"></label>
          <label><span>1인 1식 단가(원)</span><input id="mlPrice" type="number" value="9000" step="500"></label>
          <label><span>정규근무 시작</span><input id="mlWs" value="09:00"></label>
          <label><span>정규근무 종료</span><input id="mlWe" value="18:00"></label>
        </div>
        <label class="mlfull"><span>조기출근 요건</span>
          <select id="mlEarly">
            <option value="1" selected>적용 — 출근 08:00 이전 + 당일 09:00 전 등록</option>
            <option value="0">미적용 — 퇴근 19:00 기준만</option>
          </select></label>
        <label class="mlfull"><span>공휴일·대체공휴일</span><textarea id="mlHoli">${HOLI_2026.join(', ')}</textarea></label>
      </details>

      <div class="mlbtns"><button class="btn" id="mlExport">기억 내보내기</button>
        <button class="btn" id="mlImport">기억 가져오기</button>
        <input type="file" id="mlImportFile" accept="application/json" hidden>
        <button class="btn danger" id="mlWipe">기억 지우기</button></div>
      <p class="mlnote">PC를 바꾸거나 담당자가 바뀔 때 <b>파일 하나로 인수인계</b>할 수 있습니다.
        가맹업소 <b>대표자 성명·계좌번호는 입력하지 마세요.</b></p>
    </div>
  </details>`;

  const dp=$('#mlDrop'), fi=$('#mlFile');
  dp.onclick=e=>{
    if(e.target.closest('#mlClr')){ e.stopPropagation(); clearMeal(); return; }
    fi.click();
  };
  fi.onchange=()=>{if(fi.files[0])readPdf(fi.files[0]);};

  /* ── 드래그앤드롭 : 화면 어디에 놓아도 받는다 ──────────────
     드롭존을 조금만 벗어나도 브라우저가 PDF를 그냥 열어버리므로,
     문서 전체에서 기본 동작을 막고 파일 이름으로 용도를 가려낸다. */
  const isMeal=()=>document.body.dataset.view==='meal';
  const hasFile=e=>{ const t=e.dataTransfer&&e.dataTransfer.types;
    return t && (Array.prototype.indexOf.call(t,'Files')>=0); };
  const ov=document.createElement('div');
  ov.className='mlover'; ov.innerHTML='<div class="mlovin"><b>여기에 놓으세요</b>'+
    '<small>초과근무 확인서 · 출장 내역 PDF — 여러 개를 한꺼번에 놓아도 됩니다</small></div>';
  document.body.appendChild(ov);
  let dragN=0;
  const hide=()=>{dragN=0;ov.classList.remove('on');dp.classList.remove('on');$('#mlTripDrop').classList.remove('on');};
  document.addEventListener('dragenter',e=>{
    if(!isMeal()||!hasFile(e)) return; e.preventDefault(); dragN++; ov.classList.add('on');
  });
  document.addEventListener('dragover',e=>{ if(isMeal()&&hasFile(e)) e.preventDefault(); });
  document.addEventListener('dragleave',e=>{ if(!isMeal()) return; if(--dragN<=0) hide(); });
  document.addEventListener('drop',e=>{
    if(!isMeal()||!hasFile(e)) return;
    e.preventDefault(); hide();
    const fs=[...e.dataTransfer.files].filter(f=>/\.pdf$/i.test(f.name)||f.type==='application/pdf');
    if(!fs.length){ alert('PDF 파일만 올릴 수 있습니다.'); return; }
    const onTrip = e.target.closest && e.target.closest('#mlTripDrop');
    const isTrip = f=>/출장|여비|trip/i.test(f.name);
    const openTrip=()=>{ const w=$('#mlTripWrap'); if(w&&w.hidden){ w.hidden=false;
      $('#mlTripToggle').textContent='－ 출장 내역 닫기'; } };
    if(fs.length===1){ if(onTrip||isTrip(fs[0])){ openTrip(); readTrip(fs[0]); } else readPdf(fs[0]); return; }
    openTrip();
    const t=fs.filter(isTrip), o=fs.filter(f=>!isTrip(f));
    if(o[0]) readPdf(o[0]);
    if(t[0]) readTrip(t[0]); else if(o[1]) readTrip(o[1]);
  });
  $('#mlTripMsg').addEventListener('click',e=>{
    if(!e.target.closest('#mlTripClr')) return;
    $('#mlTrip').value=''; $('#mlTripMsg').textContent='없으면 건너뛰어도 됩니다';
    if(S.all&&S.all.length){ S.cfg=cfgRead(); apply(); }
  });
  $('#mlTripToggle').onclick=()=>{
    const w=$('#mlTripWrap'), on=w.hidden;
    w.hidden=!on; $('#mlTripToggle').textContent = on ? '－ 출장 내역 닫기' : '＋ 출장 다녀온 사람이 있나요?';
  };
  const td=$('#mlTripDrop'), tf=$('#mlTripFile');
  td.onclick=()=>tf.click();
  tf.onchange=()=>{if(tf.files[0])readTrip(tf.files[0]);};
  [[dp,'mlDrop'],[td,'mlTripDrop']].forEach(([el])=>{
    el.addEventListener('dragover',e=>{ e.preventDefault(); el.classList.add('on'); });
    el.addEventListener('dragleave',()=>el.classList.remove('on'));
  });
  $('#mlSet').addEventListener('toggle',()=>drawTeamSet());
  document.addEventListener('click',e=>{
    const sd=e.target.closest('.mlsdel');
    if(sd){ shiftSet(shiftGet().filter(x=>x!==sd.dataset.n)); refresh(); }
    const hd=e.target.closest('.mlhdel');
    if(hd){ try{ const h=histGet(); delete h[hd.dataset.n];
      localStorage.setItem(K(LSH),JSON.stringify(h)); }catch(e2){} refresh(); }
  });
  $('#mlLedger').addEventListener('click',e=>{
    const el=e.target.closest('.lname[data-k]'); if(!el) return;
    const [d,n]=el.dataset.k.split('|'); cellMenu(el,d,n);
  });
  $('#mlGrid').addEventListener('click',e=>{
    const th=e.target.closest('th.nm[data-nm]');
    if(th){ nameMenu(th, th.dataset.nm); return; }
    const el=e.target.closest('.mlc[data-k]'); if(!el) return;
    S.cells[el.dataset.k].on=!S.cells[el.dataset.k].on; draw();
  });
  $('#mlPlace').onclick=()=>placeShops();
  $('#mlAuto').onclick=()=>{
    if(!autoSplit()) return;
    unplace(); drawPay();                    // 금액만 채운다 — 배치는 옆 버튼으로
  };
  $('#mlPayMsg').addEventListener('click',e=>{
    const b=e.target.closest('.fixamt'); if(!b) return;
    const i=+b.dataset.i; if(!PAY[i]) return;
    PAY[i].amt=+b.dataset.v;
    const el=$('#mlPayTbl').querySelector('.payamt[data-i="'+i+'"]');
    if(el) el.value=PAY[i].amt;
    unplace(); drawPayStatus();
  });
  const addPay=()=>{
    if(PAY.length>=MAXPAY) return;
    PAY.push({shop:'',amt:null});      // 금액은 이름을 적는 순간 채워진다
    unplace(); drawPay();
    const ins=$('#mlPayTbl').querySelectorAll('.payshop');
    if(ins.length) ins[ins.length-1].focus();
  };
  $('#mlPayTbl').addEventListener('input',e=>{
    const i=+e.target.dataset.i; if(!PAY[i]) return;
    if(e.target.classList.contains('payshop')) PAY[i].shop=e.target.value;
    else if(e.target.classList.contains('payamt')) PAY[i].amt=(e.target.value===''?null:+e.target.value);
    else return;
    unplace(); drawPayStatus();        // 입력칸은 그대로 둔다
  });
  /* 엔터 = 칸을 빠져나간 것으로 본다 */
  $('#mlPayTbl').addEventListener('keydown',e=>{
    if(e.key!=='Enter'||!e.target.classList.contains('payshop')) return;
    e.preventDefault(); e.target.blur();
  });
  /* 이름만 확정한다 — 금액은 「금액 자동계산」이 넣는다 */
  $('#mlPayTbl').addEventListener('change',e=>{
    if(!e.target.classList.contains('payshop')) return;
    const i=+e.target.dataset.i; if(!PAY[i]) return;
    PAY[i].shop=e.target.value;
    drawPayStatus();
  });
  $('#mlPayTbl').addEventListener('click',e=>{
    const st=e.target.closest('.amtstep');
    if(st){
      const i=+st.dataset.i, p=S.cfg.price; if(!PAY[i]) return;
      const v=+PAY[i].amt||0;
      let nv = st.classList.contains('up') ? Math.floor(v/p)*p+p : Math.ceil(v/p)*p-p;
      if(nv<0) nv=0;
      PAY[i].amt = nv||null;
      const el=$('#mlPayTbl').querySelector('.payamt[data-i="'+i+'"]');
      if(el) el.value = PAY[i].amt==null?'':PAY[i].amt;
      unplace(); drawPayStatus();
      return;
    }
    if(e.target.closest('.payadd')){ addPay(); return; }
    const b=e.target.closest('.paydel'); if(!b) return;
    PAY.splice(+b.dataset.i,1); if(!PAY.length) PAY=[{shop:'',amt:null}];
    unplace(); drawPay();
  });
  $('#mlPrice').addEventListener('input',()=>{priceTouched=true; if(S.cfg.ym) autoBase(S.cfg.ym);});
  $('#mlExport').onclick=()=>{
    const o={_shift:shiftGet(),_hist:histGet(),
             _saved:new Date().toISOString().slice(0,10)};
    const a=document.createElement('a');
    a.href=URL.createObjectURL(new Blob([JSON.stringify(o,null,2)],{type:'application/json'}));
    a.download='급량비_설정_'+(o._saved)+'.json'; a.click();
  };
  $('#mlImport').onclick=()=>$('#mlImportFile').click();
  $('#mlImportFile').onchange=async e=>{
    const f=e.target.files[0]; if(!f) return;
    try{ const o=JSON.parse(await f.text());
      CFGF.forEach(k=>{ if(o[k]!=null&&$('#'+k)) $('#'+k).value=o[k]; });
      if(o._hist) localStorage.setItem(K(LSH),JSON.stringify(o._hist));
      saveCfg(); alert('설정을 불러왔습니다.');
    }catch(err){ alert('설정 파일을 읽지 못했습니다.'); }
  };
  $('#mlVrun').onclick=verify;
  $('#mlVclr').onclick=()=>{$('#mlVin').value='';$('#mlVout').innerHTML='';};
  $('#mlWipe').onclick=()=>{
    if(!confirm('이 브라우저가 기억한 「항상 제외」와 상호를 모두 지웁니다.\n계산 결과와 규정 기준값에는 영향이 없습니다.\n\n지울까요?')) return;
    try{ [LS,LSH,LSS].forEach(b=>localStorage.removeItem(K(b))); }catch(e){}
    refresh();
    alert('지웠습니다. 다음 판정부터 처음 쓰는 것과 같아집니다.');
  };
  $('#mlPrint').onclick=()=>window.print();
  const preview=on=>{
    const v=document.querySelector('.view[data-view="meal"]'); if(!v) return;
    v.classList.toggle('preview',on);
    $('#mlPrev').textContent = on ? '✕ 미리보기 닫기' : '📄 인쇄 미리보기';
    $('#mlPrev').classList.toggle('pri',on);
    (on?$('#mlPrintDoc'):$('#mlLedger')).scrollIntoView({behavior:'smooth',block:'start'});
  };
  $('#mlPrev').onclick=()=>preview(!document.querySelector('.view[data-view="meal"]').classList.contains('preview'));
  document.addEventListener('keydown',e=>{        // Esc 로도 닫힌다
    if(e.key!=='Escape') return;
    const v=document.querySelector('.view[data-view="meal"]');
    if(v&&v.classList.contains('preview')) preview(false);
  });
  try{ PROF=localStorage.getItem(LSP)||''; }catch(e){ PROF=''; }
  loadCfg(); drawTeamSet();
  loadBase().then(()=>autoBase($('#mlYm').value.trim()||'2026-08'));
  $('#mlYm').addEventListener('change',()=>autoBase($('#mlYm').value.trim()));
  root.addEventListener('change',e=>{ if(CFGF.indexOf(e.target.id)>=0) saveCfg(); });
  root.addEventListener('input', e=>{ if(CFGF.indexOf(e.target.id)>=0) saveCfg(); });
  /* 엑셀 내려받기 — 엑셀이 읽는 HTML 표로 만든다 (열너비·글꼴·테두리·병합 그대로) */
  $('#mlXls').onclick=()=>{
    const c=S.cfg, rs=ledgerRows().filter(r=>r.cnt);
    if(!rs.length){ payMsg('bad','⚠ 내려받을 내용이 없습니다.'); return; }
    const cnt=rs.reduce((a,r)=>a+r.cnt,0), tot=rs.reduce((a,r)=>a+r.amt,0);
    const W=[10.50,5.12,7.38,8.62,42.50,19.50,13.12,9.75,15.38,10.88,8.43,8.43];  // 원본 열너비(문자)
    const px=w=>Math.round(w*7+5);
    const F='mso-number-format:"\\@";font-family:HY견명조;font-size:14pt;'+
            'text-align:center;vertical-align:middle;border:.5pt solid black;';
    let h='<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8">'+
      '<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>'+
      '<x:Name>특근매식비집행대장</x:Name><x:WorksheetOptions><x:Print>'+
      '<x:ValidPrinterInfo/><x:PaperSizeIndex>9</x:PaperSizeIndex><x:Scale>76</x:Scale>'+
      '<x:HorizontalResolution>600</x:HorizontalResolution></x:Print>'+
      '</x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->'+
      '</head><body><table border="1" style="border-collapse:collapse">'+
      '<colgroup>'+W.map(w=>'<col width="'+px(w)+'">').join('')+'</colgroup>';
    h+='<tr height="73"><td colspan="12" style="'+F+'font-size:28pt;font-weight:bold;border:none">'+
       '특 근 매 식 비 집 행 대 장</td></tr>';
    h+='<tr height="44">'+
       '<td colspan="3" rowspan="2" style="'+F+'background:#F7F7F7">특근일자</td>'+
       '<td rowspan="2" style="'+F+'background:#F7F7F7">인원(명)</td>'+
       '<td rowspan="2" style="'+F+'background:#F7F7F7">특 근 자 명 단</td>'+
       '<td rowspan="2" style="'+F+'background:#F7F7F7">가맹업소명</td>'+
       '<td colspan="3" rowspan="2" style="'+F+'background:#F7F7F7">예산집행내역</td>'+
       '<td colspan="3" style="'+F+'background:#F7F7F7">결 재</td></tr>'+
       '<tr height="28"><td style="'+F+'background:#F7F7F7">담당자</td>'+
       '<td style="'+F+'background:#F7F7F7">담 당</td><td style="'+F+'background:#F7F7F7">과 장</td></tr>';
    rs.forEach(r=>{
      const [y,m,d]=r.d.split('-');
      h+='<tr height="60"><td style="'+F+'">'+y+'</td><td style="'+F+'">'+(+m)+'</td><td style="'+F+'">'+(+d)+'</td>'+
         '<td style="'+F+'">'+r.cnt+'</td>'+
         '<td style="'+F+'">'+esc(r.ns.filter(z=>z.on).map(z=>z.n).join(', '))+'</td>'+
         '<td style="'+F+'">'+esc(r.shop||'')+'</td>'+
         '<td style="'+F+'text-align:right">'+c.price+'</td>'+
         '<td style="'+F+'text-align:left">×'+r.cnt+'명=</td>'+
         '<td style="'+F+'text-align:right">'+r.amt+'</td>'+
         '<td style="'+F+'"></td><td style="'+F+'">전결</td><td style="'+F+'"></td></tr>';
    });
    h+='<tr height="60"><td colspan="3" style="'+F+'"></td>'+
       '<td style="'+F+'font-weight:bold;background:#FFFF00">'+cnt+'명</td>'+
       '<td style="'+F+'font-weight:bold">합계</td><td style="'+F+'"></td>'+
       '<td colspan="3" style="'+F+'font-weight:bold">'+won(c.price)+'원 x '+cnt+'명 ='+won(tot)+'원</td>'+
       '<td style="'+F+'"></td><td style="'+F+'"></td><td style="'+F+'"></td></tr>';
    h+='</table></body></html>';
    const a=document.createElement('a');
    a.href=URL.createObjectURL(new Blob(['﻿'+h],{type:'application/vnd.ms-excel'}));
    a.download='특근매식비 집행대장 '+c.ym.replace('-','.')+'월.xls'; a.click();
  };
}

const DEMO=`1 2026-08-04 정보통신과 주사보 조호현 09:00 20:04 64
2 2026-08-05 정보통신과 주사보 조호현 07:56 20:14 138
3 2026-08-06 정보통신과 주사보 조호현 07:55 20:15 140
4 2026-08-07 정보통신과 주사보 조호현 09:00 20:00 60
5 2026-08-10 정보통신과 주사보 조호현 09:00 20:37 97
6 2026-08-11 정보통신과 주사보 조호현 09:00 21:00 120
7 2026-08-14 정보통신과 주사보 조호현 09:00 20:31 91
8 2026-08-15 정보통신과 주사보 조호현 08:54 13:12 240
9 2026-08-16 정보통신과 주사보 조호현 09:54 13:55 240
10 2026-08-23 정보통신과 주사보 조호현 15:21 19:22 240
11 2026-08-24 정보통신과 주사보 조호현 09:00 21:29 149
12 2026-08-26 정보통신과 주사보 조호현 09:00 21:53 173
13 2026-08-27 정보통신과 주사보 조호현 09:00 21:01 121
14 2026-08-28 정보통신과 주사보 조호현 06:56 20:44 228
15 2026-08-29 정보통신과 주사보 조호현 16:15 20:02 225
16 2026-08-30 정보통신과 주사보 조호현 10:14 14:16 240
17 2026-08-31 정보통신과 주사보 조호현 07:35 20:19 164
18 2026-08-01 정보통신과 전산주사보 김원규 11:34 15:34 240
19 2026-08-02 정보통신과 전산주사보 김원규 09:30 13:31 240
20 2026-08-04 정보통신과 전산주사보 김원규 09:00 20:00 60
21 2026-08-05 정보통신과 전산주사보 김원규 09:00 20:00 60
22 2026-08-07 정보통신과 전산주사보 김원규 09:00 20:00 60
23 2026-08-08 정보통신과 전산주사보 김원규 10:37 12:58 141
24 2026-08-09 정보통신과 전산주사보 김원규 13:10 16:50 220
25 2026-08-11 정보통신과 전산주사보 김원규 09:00 20:00 60
26 2026-08-15 정보통신과 전산주사보 김원규 07:09 10:12 183
27 2026-08-16 정보통신과 전산주사보 김원규 10:14 14:14 240
28 2026-08-17 정보통신과 전산주사보 김원규 08:50 12:50 240
29 2026-08-23 정보통신과 전산주사보 김원규 07:36 11:36 240
30 2026-08-24 정보통신과 전산주사보 김원규 09:00 19:56 56
31 2026-08-27 정보통신과 전산주사보 김원규 09:00 21:02 122
32 2026-08-28 정보통신과 전산주사보 김원규 09:00 20:00 60
33 2026-08-29 정보통신과 전산주사보 김원규 14:21 18:21 240
34 2026-08-30 정보통신과 전산주사보 김원규 10:27 14:39 240
35 2026-08-31 정보통신과 전산주사보 김원규 09:00 21:00 120
36 2026-08-01 정보통신과 전산서기 김경민 16:45 20:45 240
37 2026-08-02 정보통신과 전산서기 김경민 11:19 15:28 240
38 2026-08-03 정보통신과 전산서기 김경민 09:00 21:00 120
39 2026-08-04 정보통신과 전산서기 김경민 09:00 21:00 120
40 2026-08-06 정보통신과 전산서기 김경민 09:00 21:10 130
41 2026-08-07 정보통신과 전산서기 김경민 09:00 20:00 60
42 2026-08-08 정보통신과 전산서기 김경민 14:32 18:32 240
43 2026-08-10 정보통신과 전산서기 김경민 09:00 21:20 140
44 2026-08-11 정보통신과 전산서기 김경민 09:00 21:00 120
45 2026-08-12 정보통신과 전산서기 김경민 09:00 21:30 150
46 2026-08-14 정보통신과 전산서기 김경민 09:00 20:31 91
47 2026-08-16 정보통신과 전산서기 김경민 16:45 20:45 240
48 2026-08-17 정보통신과 전산서기 김경민 16:10 20:10 240
49 2026-08-23 정보통신과 전산서기 김경민 15:21 19:21 240
50 2026-08-24 정보통신과 전산서기 김경민 09:00 21:30 150
51 2026-08-25 정보통신과 전산서기 김경민 09:00 21:00 120
52 2026-08-26 정보통신과 전산서기 김경민 09:00 22:32 212
53 2026-08-30 정보통신과 전산서기 김경민 19:16 22:45 209
54 2026-08-30 정보통신과 전산서기 김규태 11:18 15:30 240`;

window.MEAL={init:build, _demo:()=>{ S.pdfText=DEMO; run(DEMO); },
  _pay:rows=>{ PAY=rows.slice(); drawPay(); placeShops(); },
  _payMsg:()=>$('#mlPayMsg').innerHTML.replace(/<[^>]+>/g,''),
  _rows:()=>PAY, _live:rows=>{ PAY=rows.slice(); drawPay(); }};
})();
