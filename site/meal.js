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

let S={all:[],rows:[],days:[],names:[],depts:[],dept:'',cells:{},shop:{},cfg:{},chk:[],pdfText:'',built:false};

/* ---------- 설정 저장 (이 브라우저에만 보관) ---------- */
const LS='dsOn.meal.cfg.v1';
const CFGF=['mlPrice','mlWs','mlWe','mlEarly','mlHoli','mlShops'];
function saveCfg(){
  try{ const o={}; CFGF.forEach(k=>{const el=$('#'+k); if(el) o[k]=el.value;});
       localStorage.setItem(LS,JSON.stringify(o)); flash(); }catch(e){}
}
function loadCfg(){
  try{ const o=JSON.parse(localStorage.getItem(LS)||'{}');
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
function histGet(){ try{ return JSON.parse(localStorage.getItem(LSH)||'{}'); }catch(e){ return {}; } }
function histAdd(name,ym,n){
  if(!name) return;
  try{ const h=histGet(); h[name]=h[name]||{n:0,last:''};
       h[name].n+=(n||1); if(ym>h[name].last) h[name].last=ym;
       localStorage.setItem(LSH,JSON.stringify(h)); }catch(e){}
}
function shopList(){
  const h=histGet(), typed=S.cfg.shops||[];
  const all=[...new Set([...Object.keys(h),...typed])];
  return all.sort((a,b)=>((h[b]&&h[b].n)||0)-((h[a]&&h[a].n)||0)||a.localeCompare(b,'ko'));
}
function topShop(){ const l=shopList(); return l[0]||''; }

/* ---------- 파싱 ---------- */
function norm(s){ for(let i=0;i<6;i++) s=s.replace(/(?<=[0-9:\-])[ ]+(?=[0-9:\-])/g,''); return s; }
const ROW=/(\d+?)(20\d\d-\d\d-\d\d)\s+(\S+)\s+(?:(\S+)\s+)?([가-힣]{2,4})\s+(\d\d:\d\d)(\d\d:\d\d)(\d{1,3})(?!\d)/;
function parse(text){
  const L=text.split(/\r?\n/).map(norm), out=[];
  for(let i=0;i<L.length;i++){
    const m=ROW.exec(L[i]); if(!m) continue;
    let rd=null, rt=null;
    for(let j=i-1;j>=Math.max(0,i-3);j--){ const d=L[j].match(/20\d\d-\d\d-\d\d/g); if(d){rd=d[d.length-1];break;} }
    for(let j=i+1;j<=Math.min(L.length-1,i+3);j++){ const t=L[j].match(/\b\d\d:\d\d\b/); if(t){rt=t[0];break;} }
    out.push({date:m[2],dept:m[3],rank:m[4]||'',name:m[5],inn:m[6],out:m[7],pay:+m[8],regd:rd,regt:rt});
  }
  return out;
}

/* ---------- 판정 ---------- */
function cfgRead(){
  const list=s=>String(s||'').split(/[\s,]+/).map(x=>x.trim()).filter(Boolean);
  return { ym:$('#mlYm').value.trim(), price:+$('#mlPrice').value||0,
    ws:toMin($('#mlWs').value)||540, we:toMin($('#mlWe').value)||1080,
    early:$('#mlEarly').value==='1',
    holi:new Set(list($('#mlHoli').value)), shops:list($('#mlShops').value) };
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
  const c=cfgRead(); S.cfg=c;
  const all=parse(text);
  if(!all.length){ alert('초과근무 확인서 형식을 읽지 못했습니다.\n[텍스트 붙여넣기]로 다시 시도해 보세요.'); return; }
  const ym=c.ym||all[0].date.slice(0,7); $('#mlYm').value=ym; c.ym=ym;
  autoBase(ym); c.price=+$('#mlPrice').value||c.price; c.holi=new Set(
    String($('#mlHoli').value||'').split(/[\s,]+/).map(x=>x.trim()).filter(Boolean));
  S.all=all.filter(r=>r.date.startsWith(ym));
  S.depts=[...new Set(S.all.map(r=>r.dept))];
  if(S.dept&&S.depts.indexOf(S.dept)<0) S.dept='';
  apply(); }

function apply(){
  const c=S.cfg;
  S.rows=S.dept?S.all.filter(r=>r.dept===S.dept):S.all.slice();
  S.names=[...new Set(S.rows.map(r=>r.name))];
  const [y,mm]=ym.split('-').map(Number), last=new Date(y,mm,0).getDate();
  S.days=[]; for(let d=1;d<=last;d++) S.days.push(ym+'-'+pad(d));
  const cells={}, chk=[];
  for(const r of S.rows){
    const k=r.date+'|'+r.name, j=judge(r,c), p=cells[k];
    if(!p||(j.ok&&!p.ok)) cells[k]={...j,on:j.ok};
    const diff=j.calc-r.pay;
    if(Math.abs(diff)>=1) chk.push({r,j,diff});
  }
  S.cells=cells; S.chk=chk; S.shop={};
  draw();
}

function draw(){
  const c=S.cfg;
  let cnt=0,hol=0,off=0;
  for(const k in S.cells){const x=S.cells[k]; if(x.on){cnt++; if(x.hol)hol++;} else if(x.ok) off++;}
  $('#mlStats').innerHTML=
    st('지급 식수',cnt,'식')+st('지급 총액',won(cnt*c.price),'원')+
    st('대상 인원',S.names.length,'명')+st('휴일 근무분',hol,'식')+st('담당자 제외',off,'식');
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

  let h='<thead><tr><th>일자</th>'+S.names.map(n=>'<th>'+esc(n)+'</th>').join('')+'<th>식수</th></tr></thead><tbody>';
  for(const d of S.days){
    const w='일월화수목금토'[new Date(d+'T00:00:00').getDay()], H=isHol(d,c);
    let n=0;
    const tds=S.names.map(nm=>{
      const x=S.cells[d+'|'+nm];
      if(!x) return '<td></td>';
      if(!x.ok) return '<td><span class="mlc x" title="'+esc(x.why)+'">·</span></td>';
      if(x.on) n++;
      return '<td><span class="mlc '+(x.on?'y':'n')+'" data-k="'+d+'|'+nm+'" title="'+esc(x.why)+'">'+(x.on?'1':'–')+'</span></td>';
    }).join('');
    h+='<tr'+(H?' class="hol"':'')+'><td class="day">'+(+d.slice(8))+'일 ('+w+')'+(H?' 휴':'')+'</td>'+tds+'<td>'+(n||'')+'</td></tr>';
  }
  $('#mlGrid').innerHTML=h+'</tbody>';
  drawChk(); drawShops(); drawLedger();
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
  h+='</tbody></table><p class="mlnote">※ 검산은 <b>지급 판정에 영향을 주지 않습니다.</b> '+
     '판정은 출퇴근 시각으로만 하며, 수당시간은 참고값입니다. '+
     (cap.length?'신청시간 초과 근무 '+cap.length+'건, ':'')+(bad.length?'확인 필요 '+bad.length+'건':'확인 필요 0건')+'</p>';
  box.innerHTML=h;
}

/* ---------- 업체 · 집행대장 ---------- */
function commitHist(){
  const seen={}; ledgerRows().forEach(r=>{ if(r.shop) seen[r.shop]=(seen[r.shop]||0)+1; });
  for(const k in seen) histAdd(k,S.cfg.ym,seen[k]);
}
const payDays=()=>S.days.filter(d=>S.names.some(n=>{const x=S.cells[d+'|'+n];return x&&x.on;}));
function drawShops(){
  const c=S.cfg, ds=payDays(), L=shopList(), h=histGet();
  $('#mlBulk').innerHTML=L.map(s=>'<option>'+esc(s)+(h[s]&&h[s].n?' ('+h[s].n+'회)':'')+'</option>').join('');
  const t=topShop(), tb=$('#mlTop');
  if(tb) tb.textContent=t?('자주 쓰는 '+t+'로 전부 채우기'):'자주 쓰는 곳으로 전부 채우기';
  let h='<thead><tr><th style="width:110px">특근일자</th><th style="width:60px">인원</th><th>특근자 명단</th><th style="width:170px">가맹업소명</th><th style="width:110px">금액</th></tr></thead><tbody>';
  for(const d of ds){
    const ns=S.names.filter(n=>{const x=S.cells[d+'|'+n];return x&&x.on;});
    h+='<tr><td>'+d.slice(5).replace('-','. ')+'.</td><td>'+ns.length+'</td><td class="l">'+esc(ns.join(', '))+'</td>'+
       '<td><select data-d="'+d+'" class="mlsel"><option value=""> — 선택 — </option>'+
       L.map(s=>'<option'+(S.shop[d]===s?' selected':'')+'>'+esc(s)+'</option>').join('')+'</select></td>'+
       '<td class="r">'+won(ns.length*c.price)+'</td></tr>';
  }
  $('#mlShopTbl').innerHTML=h+'</tbody>';
}
function ledgerRows(){
  const c=S.cfg;
  return payDays().map(d=>{
    const ns=S.names.filter(n=>{const x=S.cells[d+'|'+n];return x&&x.on;});
    return {d,ns,cnt:ns.length,shop:S.shop[d]||'',amt:ns.length*c.price};
  });
}
function drawLedger(){
  const c=S.cfg, rs=ledgerRows(), [y,m]=c.ym.split('-');
  const tot=rs.reduce((a,r)=>a+r.amt,0), cnt=rs.reduce((a,r)=>a+r.cnt,0);
  const by={}; rs.forEach(r=>{ if(!r.shop)return; (by[r.shop]=by[r.shop]||{c:0,a:0}); by[r.shop].c+=r.cnt; by[r.shop].a+=r.amt; });
  let h='<div class="mltitle">특 근 매 식 비 집 행 대 장</div><div class="mlsub">'+y+'년 '+(+m)+'월 · 달성군 행정국 정보통신과</div>'+
    '<table class="mltbl out"><thead><tr><th style="width:100px">특근일자</th><th style="width:56px">인원</th><th>특 근 자 명 단</th><th style="width:140px">가맹업소명</th><th style="width:180px">예산집행내역</th></tr></thead><tbody>';
  for(const r of rs)
    h+='<tr><td>'+(+m)+'. '+(+r.d.slice(8))+'.</td><td>'+r.cnt+'</td><td class="l">'+esc(r.ns.join(', '))+'</td>'+
       '<td>'+(r.shop?esc(r.shop):'<span class="mlmut">미지정</span>')+'</td>'+
       '<td class="r">'+won(c.price)+' × '+r.cnt+'명 = '+won(r.amt)+'원</td></tr>';
  h+='<tr class="sum"><th>합 계</th><th>'+cnt+'</th><th colspan="2"></th><th class="r">'+won(tot)+'원</th></tr></tbody></table>';
  if(Object.keys(by).length){
    h+='<div class="mlh5">가맹업소별 정산</div><table class="mltbl out"><thead><tr><th>가맹업소</th><th style="width:80px">식수</th><th style="width:140px">금액</th></tr></thead><tbody>';
    for(const k in by) h+='<tr><td class="l">'+esc(k)+'</td><td>'+by[k].c+'</td><td class="r">'+won(by[k].a)+'원</td></tr>';
    h+='</tbody></table>';
  }
  h+='<p class="mlnote">※ 근거 「지방자치단체 회계관리에 관한 훈령」(행정안전부훈령 제416호, 2026. 1. 2. 시행) [별표2] 201-01 사무관리비 마. 급량비 — 1인 1식 '+won(c.price)+'원</p>';
  $('#mlLedger').innerHTML=h;
}

/* ---------- PDF ---------- */
function loadPdfJs(){
  return new Promise((ok,ng)=>{
    if(window.pdfjsLib) return ok(window.pdfjsLib);
    const s=document.createElement('script');
    s.src='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    s.onload=()=>ok(window.pdfjsLib); s.onerror=ng; document.head.appendChild(s);
  });
}
async function readPdf(f){
  const w=$('#mlPdfMsg'); w.textContent='읽는 중…';
  try{
    const lib=await loadPdfJs();
    lib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
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
    S.pdfText=txt;
    w.innerHTML='<b>'+esc(f.name)+'</b> · '+pdf.numPages+'쪽 읽기 완료 — 바로 판정했습니다.';
    run(txt);
    const o=$('#mlOut'); if(o&&!o.hidden) setTimeout(()=>o.scrollIntoView({behavior:'smooth',block:'start'}),120);
  }catch(e){
    w.innerHTML='<span class="mlred">PDF를 읽지 못했습니다(폐쇄망일 수 있습니다). <b>텍스트 붙여넣기</b> 탭을 사용하세요.</span>';
  }
}

/* ---------- 화면 ---------- */
function build(){
  const root=$('#mealBody'); if(!root||S.built) return; S.built=true;
  root.innerHTML=`
  <div class="card mlcard">
    <h4>① 설정 <small>한 번만 맞춰 두면 다음 달부터는 PDF만 올리면 됩니다</small></h4>
    <p class="mlbase" id="mlBaseNote">⚙ 기준파일을 불러오는 중…</p>
    <p class="mlsaved" id="mlSaved"></p>
    <div class="mlgrid">
      <label><span>대상 연월</span><input id="mlYm" value="2026-08" placeholder="YYYY-MM"></label>
      <label><span>1인 1식 단가(원)</span><input id="mlPrice" type="number" value="9000" step="500"></label>
      <label><span>정규근무 시작</span><input id="mlWs" value="09:00"></label>
      <label><span>정규근무 종료</span><input id="mlWe" value="18:00"></label>
    </div>
    <label class="mlfull"><span>조기출근 요건</span>
      <select id="mlEarly">
        <option value="1" selected>적용 — 출근 08:00 이전 + 당일 09:00 전 등록 시 지급</option>
        <option value="0">미적용 — 퇴근 19:00 기준만 사용</option>
      </select></label>
    <label class="mlfull"><span>공휴일·대체공휴일</span>
      <textarea id="mlHoli">${HOLI_2026.join(', ')}</textarea></label>
    <p class="mlnote">2026년 관공서 공휴일(대체공휴일 포함)입니다. <b>해마다 갱신하세요.</b> 6/3은 제9회 전국동시지방선거일입니다.</p>
    <label class="mlfull"><span>가맹업소 목록</span><textarea id="mlShops">${SHOPS.join(', ')}</textarea></label>
    <p class="mlnote">업소명만 사용합니다. <b>대표자 성명·계좌번호는 입력하지 마세요.</b></p>
    <div class="mlbtns"><button class="btn" id="mlExport">설정 내보내기</button>
      <button class="btn" id="mlImport">설정 가져오기</button>
      <input type="file" id="mlImportFile" accept="application/json" hidden></div>
    <p class="mlnote">PC를 바꾸거나 담당자가 바뀔 때 <b>설정 파일 하나로 인수인계</b>할 수 있습니다.
      단가·공휴일은 <code>data/meal_config.json</code>(군 공통 기준)에서 자동으로 적용됩니다.</p>
  </div>

  <div class="card mlcard">
    <h4>② 초과근무 확인서 불러오기 <small>새올에서 출력한 파일</small></h4>
    <div class="mltabs"><button id="mlTabP" class="on">PDF 파일</button><button id="mlTabT">텍스트 붙여넣기</button></div>
    <div id="mlPaneP">
      <div class="mldrop" id="mlDrop"><b>초과근무 확인서 PDF</b>를 끌어다 놓거나 클릭<br><small class="mlbig">올리면 <b>바로 판정</b>합니다 — 버튼을 누르지 않아도 됩니다</small><br>
        <small>파일은 이 컴퓨터 안에서만 처리되며 어디로도 전송되지 않습니다.</small></div>
      <input type="file" id="mlFile" accept="application/pdf" hidden>
      <p class="mlnote" id="mlPdfMsg"></p>
    </div>
    <div id="mlPaneT" hidden>
      <textarea id="mlRaw" class="mlraw" placeholder="확인서 PDF를 열어 Ctrl+A → Ctrl+C 한 뒤 여기에 붙여넣으세요."></textarea>
    </div>
    <div class="mlbtns"><button class="btn pri" id="mlRun">다시 판정하기</button>
      <button class="btn" id="mlDemo">8월 예시로 시험</button></div>
  </div>

  <div id="mlOut" hidden>
    <div class="card mlcard">
      <h4>③ 판정 결과 <small>초록 칸을 누르면 제외됩니다</small></h4>
      <div class="mlstats" id="mlStats"></div>
      <div class="mldept" id="mlDeptBox" hidden></div>
      <p class="mlnote">제외 대상(교대근무자 · 야간/휴일근무수당 수령자 · 출장 식비 수령자)은 자동 판단이 불가하므로 담당자가 직접 해제합니다.
        점선 칸은 근무기록은 있으나 시간 요건에 못 미치는 날입니다.</p>
      <div class="mlscroll"><table class="mlgrid" id="mlGrid"></table></div>
    </div>
    <div class="card mlcard"><h4>④ 검산 <small>확인서 수당시간 ↔ 출퇴근 시각 대조</small></h4>
      <div id="mlChk"></div></div>
    <div class="card mlcard"><h4>⑤ 가맹업소 지정</h4>
      <div class="mlbtns" style="margin:0 0 10px">
        <button class="btn pri" id="mlTop">자주 쓰는 곳으로 전부 채우기</button>
        <select id="mlBulk"></select>
        <button class="btn" id="mlBulkAll">선택한 곳으로 전부</button>
        <button class="btn" id="mlBulkEmpty">빈 날만</button></div>
      <p class="mlnote">드롭다운은 <b>많이 쓰신 순서</b>로 정렬되며, 지정할 때마다 이 브라우저에 기억됩니다.
        다음 달부터는 버튼 한 번이면 채워집니다.</p>
      <div class="mlscroll"><table class="mltbl" id="mlShopTbl"></table></div></div>
    <div class="card mlcard"><h4>⑥ 집행대장</h4>
      <div id="mlLedger"></div>
      <div class="mlbtns"><button class="btn pri" id="mlPrint">인쇄 / PDF 저장</button>
        <button class="btn" id="mlCsv">CSV 내려받기</button></div>
      <p class="mlnote">지출결의 첨부 : 영수증 · 초과근무 정산결과(새올) · 집행대장(사본에 「원본대조필」) · 관련 공문</p></div>
  </div>`;

  $('#mlTabP').onclick=()=>{$('#mlTabP').classList.add('on');$('#mlTabT').classList.remove('on');$('#mlPaneP').hidden=false;$('#mlPaneT').hidden=true;};
  $('#mlTabT').onclick=()=>{$('#mlTabT').classList.add('on');$('#mlTabP').classList.remove('on');$('#mlPaneT').hidden=false;$('#mlPaneP').hidden=true;};
  const dp=$('#mlDrop'), fi=$('#mlFile');
  dp.onclick=()=>fi.click();
  dp.ondragover=e=>{e.preventDefault();dp.classList.add('on');};
  dp.ondragleave=()=>dp.classList.remove('on');
  dp.ondrop=e=>{e.preventDefault();dp.classList.remove('on');if(e.dataTransfer.files[0])readPdf(e.dataTransfer.files[0]);};
  fi.onchange=()=>{if(fi.files[0])readPdf(fi.files[0]);};
  $('#mlRun').onclick=()=>{
    const t=$('#mlPaneT').hidden?S.pdfText:$('#mlRaw').value;
    if(!String(t).trim()){alert('먼저 PDF를 불러오거나 텍스트를 붙여넣어 주세요.');return;}
    run(t);
  };
  $('#mlRaw').addEventListener('paste',e=>{
    setTimeout(()=>{ const v=$('#mlRaw').value; if(v.trim().length>80){ run(v);
      const o=$('#mlOut'); if(o&&!o.hidden) setTimeout(()=>o.scrollIntoView({behavior:'smooth',block:'start'}),120);} },60);
  });
  $('#mlDemo').onclick=()=>{$('#mlTabT').click();$('#mlRaw').value=DEMO;$('#mlYm').value='2026-08';run(DEMO);};
  $('#mlGrid').addEventListener('click',e=>{
    const el=e.target.closest('.mlc[data-k]'); if(!el) return;
    S.cells[el.dataset.k].on=!S.cells[el.dataset.k].on; draw();
  });
  $('#mlShopTbl').addEventListener('change',e=>{
    if(!e.target.classList.contains('mlsel')) return;
    S.shop[e.target.dataset.d]=e.target.value; commitHist(); drawShops(); drawLedger();
  });
  $('#mlTop').onclick=()=>{const v=topShop(); if(!v){alert('아직 사용 이력이 없습니다. 업소를 한 번 지정해 주세요.');return;}
    payDays().forEach(d=>S.shop[d]=v); commitHist(); drawShops(); drawLedger();};
  $('#mlBulkAll').onclick=()=>{const v=$('#mlBulk').value;payDays().forEach(d=>S.shop[d]=v);drawShops();drawLedger();};
  $('#mlBulkEmpty').onclick=()=>{const v=$('#mlBulk').value;payDays().forEach(d=>{if(!S.shop[d])S.shop[d]=v;});drawShops();drawLedger();};
  $('#mlPrice').addEventListener('input',()=>{priceTouched=true; if(S.cfg.ym) autoBase(S.cfg.ym);});
  $('#mlExport').onclick=()=>{
    const o={}; CFGF.forEach(k=>{const el=$('#'+k); if(el) o[k]=el.value;});
    o._hist=histGet(); o._saved=new Date().toISOString().slice(0,10);
    const a=document.createElement('a');
    a.href=URL.createObjectURL(new Blob([JSON.stringify(o,null,2)],{type:'application/json'}));
    a.download='급량비_설정_'+(o._saved)+'.json'; a.click();
  };
  $('#mlImport').onclick=()=>$('#mlImportFile').click();
  $('#mlImportFile').onchange=async e=>{
    const f=e.target.files[0]; if(!f) return;
    try{ const o=JSON.parse(await f.text());
      CFGF.forEach(k=>{ if(o[k]!=null&&$('#'+k)) $('#'+k).value=o[k]; });
      if(o._hist) localStorage.setItem(LSH,JSON.stringify(o._hist));
      saveCfg(); alert('설정을 불러왔습니다.');
    }catch(err){ alert('설정 파일을 읽지 못했습니다.'); }
  };
  $('#mlPrint').onclick=()=>window.print();
  loadCfg();
  loadBase().then(()=>autoBase($('#mlYm').value.trim()||'2026-08'));
  $('#mlYm').addEventListener('change',()=>autoBase($('#mlYm').value.trim()));
  root.addEventListener('change',e=>{ if(CFGF.indexOf(e.target.id)>=0) saveCfg(); });
  root.addEventListener('input', e=>{ if(CFGF.indexOf(e.target.id)>=0) saveCfg(); });
  $('#mlCsv').onclick=()=>{
    const c=S.cfg, L=[['특근일자','인원','특근자명단','가맹업소명','단가','금액']];
    ledgerRows().forEach(r=>L.push([r.d,r.cnt,r.ns.join(' '),r.shop,c.price,r.amt]));
    const csv='\uFEFF'+L.map(a=>a.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\r\n');
    const a=document.createElement('a');
    a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
    a.download='특근매식비_집행대장_'+c.ym+'.csv'; a.click();
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

window.MEAL={init:build};
})();
