/* ============================================================
   달성On — 데이터 분석하기 (analyze.js)
   · 엑셀(xlsx·xls)·CSV·한글(hwpx)·워드(docx)·PDF·텍스트를 올리면
     - 표가 있으면 표를 그대로 읽고(한글·워드 안의 표 포함), 없으면 AI가 본문에서 통계표를 뽑는다.
   · AI가 볼 거리 3가지를 고르고(집계 방법만 정함) → 계산·차트는 브라우저가 원본에서 직접 한다.
   · 계산된 숫자만 근거로 AI가 「분석 결과 보고서」(Ⅰ 개요 · Ⅱ 결과 · Ⅲ 시사점)를 쓰고,
     표·차트까지 넣은 한글(hwpx) 파일로 내려받는다.
   · 모델에는 열 이름·자료형·샘플 5행·집계 결과만 보낸다(엑셀 원본 행 전체는 PC 밖으로 나가지 않음).
   ============================================================ */
(function(){
"use strict";
const $=s=>document.querySelector(s);
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const A={rows:[],cols:[],types:{},name:'',files:[],ctx:'',src:'',busy:false,rep:null,dropped:0};
const PAL=['#1d5fd6','#12a15f','#f08c00','#d6336c','#7048e8','#0ca678','#e8590c','#1098ad','#5c7cfa','#74b816'];
const ROMAN=['Ⅰ','Ⅱ','Ⅲ','Ⅳ','Ⅴ'];
const AGG={sum:'합계',avg:'평균',count:'건수',max:'최댓값',min:'최솟값'};
const COLS='__열비교__';
const TOTAL=/^\s*(총\s*합\s*계|합\s*계|총\s*계|소\s*계|계|전\s*체|total|sum)\s*$/i;

function loadXlsx(){ return window.XLSX?Promise.resolve():new Promise((ok,no)=>{ const s=document.createElement('script'); s.src='vendor/xlsx.full.min.js'; s.onload=ok; s.onerror=()=>no(new Error('엑셀 모듈을 불러오지 못했습니다')); document.head.appendChild(s); }); }
const num=x=>{ if(typeof x==='number') return x; const t=String(x??'').replace(/[,\s원건명개소회%천백만억]/g,'').replace(/^\((.*)\)$/,'-$1'); return t!==''&&t!=='-'&&!isNaN(+t)?+t:null; };
function typeOf(vals){ const ne=vals.filter(x=>x!==''&&x!=null); if(!ne.length) return 'empty'; const n=ne.filter(x=>num(x)!==null).length; if(n/ne.length>0.9) return 'num'; const d=ne.filter(x=>x instanceof Date||/^\d{4}[-./]\s?\d{1,2}([-./]\s?\d{1,2})?/.test(String(x))).length; if(d/ne.length>0.8) return 'date'; return 'text'; }
const fmt=v=>v==null||isNaN(v)?'-':Math.abs(v)>=1e4?Math.round(v).toLocaleString():(+(+v).toFixed(1)).toLocaleString();

/* 열 이름 줄 찾기 — 1행이 아니어도 된다(위에 제목·작성일·빈 줄이 있는 서식) */
function findHeader(arr){ const ne=x=>String(x??'').trim()!==''; const W=Math.max(1,...arr.slice(0,40).map(r=>r.filter(ne).length));
  const isTxt=x=>!(x instanceof Date)&&isNaN(+String(x).replace(/[,\s]/g,''))&&!/^\d{4}[-./]\d/.test(String(x));
  let fb=-1; for(let i=0;i<Math.min(15,arr.length);i++){ const c=(arr[i]||[]).filter(ne); if(c.length<Math.max(2,Math.ceil(W*0.6))) continue; if(fb<0) fb=i; if(c.filter(isTxt).length/c.length>=0.7) return i; }
  return fb<0?0:fb; }
function dropEmptyCols(head,rows){ const n=Math.max(head.length,...rows.map(r=>r.length)); const keep=[]; for(let j=0;j<n;j++){ if(String(head[j]??'').trim()||rows.some(r=>String(r[j]??'').trim())) keep.push(j); } return [keep.map(j=>head[j]??''),rows.map(r=>keep.map(j=>r[j]??''))]; }

const ymd=d=>{ const t=new Date(d.getTime()+600000); return `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`; };   // 엑셀 날짜는 현지 시각 기준 + 엑셀 모듈의 수십 초 오차 보정(자정 직전으로 읽혀 하루 밀리는 문제)
/* 2차원 배열 → A.rows (합계·소계 줄은 계산에서 뺀다 — 이중 집계 방지) */
function setTable(arr,name,src){
  const h=findHeader(arr); const [hd,body]=dropEmptyCols(arr[h]||[],arr.slice(h+1));
  const seen={}; A.cols=hd.map((c,i)=>{ let k=String(c||'').replace(/\s+/g,' ').trim()||'열'+(i+1); if(seen[k]) k+=`_${++seen[k]}`; else seen[k]=1; return k; });
  let rows=body.filter(r=>r.some(x=>String(x).trim())).map(r=>Object.fromEntries(A.cols.map((c,i)=>[c,r[i]instanceof Date?ymd(r[i]):r[i]])));
  const before=rows.length; rows=rows.filter(r=>!A.cols.slice(0,2).some(c=>TOTAL.test(String(r[c]??'')))); A.dropped=before-rows.length;
  A.rows=rows; A.headRow=h+1; A.types=Object.fromEntries(A.cols.map(c=>[c,typeOf(A.rows.map(r=>r[c]))])); A.name=name; A.src=src;
}
const decode=s=>{ const d=document.createElement('textarea'); d.innerHTML=s; return d.value; };
/* 한글(hwpx)·워드(docx) 안의 표 꺼내기 — 가장 큰 표(3줄 이상·2열 이상) */
async function docTables(f){
  const n=f.name.toLowerCase(), z=await JSZip.loadAsync(await f.arrayBuffer());
  const names=Object.keys(z.files).filter(k=>n.endsWith('.docx')?k==='word/document.xml':/^Contents\/section\d+\.xml$/i.test(k));
  const D=n.endsWith('.docx'); const out=[];
  for(const k of names){ const x=await z.file(k).async('string');
    const TB=D?/<w:tbl>[\s\S]*?<\/w:tbl>/g:/<hp:tbl [\s\S]*?<\/hp:tbl>/g, TR=D?/<w:tr[ >][\s\S]*?<\/w:tr>/g:/<hp:tr>[\s\S]*?<\/hp:tr>/g, TC=D?/<w:tc>[\s\S]*?<\/w:tc>/g:/<hp:tc [\s\S]*?<\/hp:tc>/g, T=D?/<w:t[^>]*>([^<]*)<\/w:t>/g:/<hp:t[^>]*>([^<]*)<\/hp:t>/g;
    for(const tb of x.match(TB)||[]){ if(/<hp:tbl [\s\S]*<hp:tbl /.test(tb)) continue;   // 표 안의 표(서식 틀)는 건너뜀
      const rows=(tb.match(TR)||[]).map(tr=>{ const r=[]; for(const tc of tr.match(TC)||[]){ let t='',m; T.lastIndex=0; while((m=T.exec(tc))) t+=m[1]; const sp=+((tc.match(/colSpan="(\d+)"/)||tc.match(/w:gridSpan w:val="(\d+)"/)||[])[1]||1); r.push(decode(t).trim()); for(let i=1;i<sp;i++) r.push(''); } return r; });
      if(rows.length>=3&&Math.max(...rows.map(r=>r.length))>=2) out.push(rows); } }
  out.sort((a,b)=>b.length*Math.max(...b.map(r=>r.length))-a.length*Math.max(...a.map(r=>r.length)));
  return out;
}
async function readSheet(f){
  await loadXlsx(); const wb=XLSX.read(await f.arrayBuffer(),{type:'array',cellDates:true});
  let best=null; for(const sn of wb.SheetNames){ const arr=XLSX.utils.sheet_to_json(wb.Sheets[sn],{header:1,defval:'',raw:true}); const n=arr.filter(r=>r.some(x=>String(x).trim())).length; if(!best||n>best.n) best={arr,n,sn}; }
  return best;
}
/* 파일 여러 개 — 표 1개(가장 쓸모 있는 것)를 분석 대상으로, 나머지 문서 글은 배경 자료(ctx)로 */
async function readFiles(list){
  A.files=list.map(f=>f.name); A.ctx=''; A.finfo=list.map(f=>({name:f.name,size:f.size,role:'배경 자료',detail:''})); let table=null, texts=[];
  const info=n=>A.finfo.find(x=>x.name===n);
  for(const f of list){ const n=f.name.toLowerCase();
    try{
      if(/\.(xlsx|xls|csv)$/.test(n)){ const b=await readSheet(f); if(b&&(!table||b.n>table.n)) table={arr:b.arr,n:b.n,name:f.name+(b.sn&&!/\.csv$/.test(n)?` (${b.sn} 시트)`:''),src:'file',file:f.name}; else info(f.name).role='쓰지 않음'; continue; }
      if(/\.(hwpx|docx)$/.test(n)){ const ts=await docTables(f); if(ts[0]&&(!table||(table.src!=='file'&&ts[0].length>table.n))) table={arr:ts[0],n:ts[0].length,name:f.name+' (문서 안 표)',src:'doc',file:f.name}; }
      if(window.pressRead){ const r=await pressRead(f); if(r.text) texts.push(`[${f.name}]\n`+r.text); }
    }catch(e){ info(f.name).role='읽기 실패'; info(f.name).detail=e.message; }
  }
  A.ctx=safe(texts.join('\n\n').slice(0,14000));   // 배경 문서 글도 개인정보를 가린 뒤 보관·전송
  if(table){ setTable(table.arr,table.name,table.src); const fi=info(table.file); fi.role='분석할 표'; fi.detail=`${A.rows.length.toLocaleString()}행 · ${A.cols.length}열`; return; }
  if(!A.ctx.replace(/\s/g,'')) throw new Error('파일에서 표나 글자를 찾지 못했습니다');
  if(!aiOn()) throw new Error('표가 없는 문서는 AI 연결이 필요합니다 (오프라인 모드)');
  $('#anMsg').textContent='문서에 표가 없어 AI가 본문에서 숫자 표를 뽑는 중…';
  const t=await callModel(`문서 본문에서 분석할 수 있는 핵심 통계표 1개를 그대로 옮깁니다. 문서에 실제로 적힌 숫자만 쓰고 계산·추정·창작 금지.
반드시 JSON만: {"title":"표 제목","cols":["구분","열2",...],"rows":[["항목",숫자,...],...]}  (최대 30행, 합계 행 제외, 숫자는 단위·쉼표 없이)
숫자 표로 만들 내용이 없으면 {"cols":[],"rows":[]}`,A.ctx.slice(0,12000),2500);
  const m=t.match(/\{[\s\S]*\}/); let j=null; try{ j=m&&JSON.parse(m[0]); }catch(e){}
  if(!j||!j.cols?.length||!j.rows?.length) throw new Error('문서에서 숫자 표를 찾지 못했습니다 — 엑셀·CSV로 올려 주세요');
  setTable([j.cols,...j.rows],(list[0]?.name||'문서')+' (AI가 본문에서 뽑은 표)','ai'); A.aiTitle=j.title||''; if(A.finfo[0]){ A.finfo[0].role='분석할 표'; A.finfo[0].detail='AI가 본문에서 옮긴 표'; }
}

const ICON=n=>/\.(xlsx|xls)$/i.test(n)?['📗','엑셀']:/\.csv$/i.test(n)?['📗','CSV']:/\.hwpx$/i.test(n)?['📘','한글']:/\.docx$/i.test(n)?['📘','워드']:/\.pdf$/i.test(n)?['📕','PDF']:['📄','텍스트'];
const KB=b=>b>=1048576?(b/1048576).toFixed(1)+'MB':Math.max(1,Math.round(b/1024))+'KB';
function summary(){
  const T={num:'숫자',text:'글자',date:'날짜',empty:'빈 열'};
  /* 왼쪽: 올린 파일 목록(무엇을 어디에 쓰는지) */
  $('#anSum').innerHTML=`<ul class="an-files">${(A.finfo||[]).map(f=>{ const [ic,k]=ICON(f.name); const cls=f.role==='분석할 표'?'f-main':f.role==='읽기 실패'?'f-bad':f.role==='쓰지 않음'?'f-off':'f-bg';
    return `<li class="${cls}"><span class="ic">${ic}</span><span class="nm"><b>${esc(f.name)}</b><small>${k} · ${KB(f.size||0)}${f.detail?' · '+esc(f.detail):''}</small></span><em>${f.role}</em></li>`; }).join('')}</ul>`;
  /* 오른쪽: AI가 읽은 자료(표 구조) */
  const cols=A.cols.map(c=>{ const vals=A.rows.map(r=>r[c]); const t=A.types[c]; let extra='';
    if(t==='num'){ const ns=vals.map(num).filter(x=>x!==null); const s=ns.reduce((a,b)=>a+b,0); extra=RATE.test(c)?`평균 ${fmt(s/ns.length||0)}`:`합 ${fmt(s)}`; }
    else if(t==='date'){ const ds=vals.map(String).filter(Boolean).sort(); extra=ds.length?`${ds[0].slice(0,10)} ~ ${ds[ds.length-1].slice(0,10)}`:''; }
    else extra=`${new Set(vals.filter(x=>x!=='')).size.toLocaleString()}종류`;
    return `<li><b>${esc(c)}</b><span class="t-${t}">${T[t]}</span><small>${extra}</small></li>`; }).join('');
  $('#anRightLg').textContent='AI가 읽은 자료'; $('#anRight .an-ex').hidden=true;
  $('#anRead').hidden=false; $('#anRead').innerHTML=`<div class="an-rd-h"><b>${esc(A.name)}</b>
      <div class="an-rd-n"><span><i>${A.rows.length.toLocaleString()}</i>행</span><span><i>${A.cols.length}</i>열</span>${A.dropped?`<span class="x">합계 줄 ${A.dropped}개 제외</span>`:''}</div>
      ${A.src==='ai'?'<span class="an-safe an-warn">AI가 문서에서 옮긴 표 — 원문 대조 필요</span>':'<span class="an-safe">숫자는 이 PC 안에서 계산</span>'}</div>
    <ul class="an-rd-cols">${cols}</ul>
    ${A.ctx&&A.src!=='ai'?`<p class="an-rd-ctx">📝 함께 올린 문서는 분석 방향·시사점을 쓸 때 참고합니다</p>`:''}`;
  $('#anAsk').hidden=false; suggest(); $('#anFileList').textContent='새로 올리면 기존 파일 대신 새 파일로 분석합니다 (여러 개는 한 번에 같이 선택)';
}
/* AI로 보내기 전 개인정보 자동 가림 — 개인정보로 보이는 열은 값 대신 ***, 나머지 글은 「개인정보 가리기」와 같은 규칙(주민번호·휴대폰·이메일·계좌·주소·이름 등) */
const PII_COL=/성명|이름|민원인|신청인|대표자|보호자|연락처|전화|휴대|핸드폰|주민|생년|주소|거주|이메일|메일|계좌|차량|번호판/;
const safe=t=>{ try{ return window.MASK?._t?.maskText?MASK._t.maskText(String(t)).text:String(t); }catch(e){ return String(t); } };
function sample(){ return safe(A.rows.slice(0,5).map(r=>A.cols.map(c=>PII_COL.test(c)?'***':String(r[c]??'').slice(0,20)).join(' | ')).join('\n')); }
const aiOn=()=>{ const S=window.S||{}; return !!((S.key||S.server)&&!S.offline); };
async function callModel(system,user,max){
  const S=window.S||{}; const body={model:S.model||'claude-sonnet-4-5',max_tokens:max||400,stream:true,system,messages:[{role:'user',content:user}]};
  const r=S.key ? await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'content-type':'application/json','x-api-key':S.key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},body:JSON.stringify(body)})
               : await fetch('/api/chat',{method:'POST',headers:{'content-type':'application/json','x-access-code':S.code||''},body:JSON.stringify(body)});
  if(!r.ok) throw new Error('모델 호출 실패 ('+r.status+')');
  const rd=r.body.getReader(), dec=new TextDecoder(); let buf='',text='';
  while(true){ const {value,done}=await rd.read(); if(done) break; buf+=dec.decode(value,{stream:true}); const ls=buf.split('\n'); buf=ls.pop(); for(const ln of ls){ if(!ln.startsWith('data:')) continue; try{ const j=JSON.parse(ln.slice(5)); if(j.type==='content_block_delta'&&j.delta?.text) text+=j.delta.text; }catch(e){} } }
  return text;
}
function colInfo(){ return A.cols.map(c=>`${c}(${A.types[c]})`).join(', '); }
const numCols=()=>A.cols.filter(c=>A.types[c]==='num');
const RATE=/비중|비율|율$|률$|%|퍼센트|순위|번호|연번|코드/;   // 더하면 안 되는 열(비율·순번 등)
const sumT=(n,agg)=>agg==='sum'?(/(합계|계|총)$/.test(n)?n:n+' 합계'):agg==='avg'?n+' 평균':n;
/* 열 고르기 도우미 */
const nU=c=>new Set(A.rows.map(r=>String(r[c]??'').trim()).filter(Boolean)).size;
function autoPlans(){
  const ns=numCols().filter(c=>!RATE.test(c)), n=ns[0];
  const txt=A.cols.filter(c=>A.types[c]==='text'&&nU(c)>=2&&nU(c)<=40), d=A.cols.find(c=>A.types[c]==='date');
  const g=txt[0]||A.cols.find(c=>A.types[c]==='text');
  const small=txt.filter(c=>c!==g&&nU(c)<=6).sort((a,b)=>nU(a)-nU(b))[0];       // 구성(누적막대)에 쓸 2~6종류 열
  const mid=txt.find(c=>c!==g&&c!==small&&nU(c)<=15);                           // 히트맵 행에 쓸 열
  const V=n||null, AG=n?'sum':'count', VN=n||'건수';
  const P=[];
  if(d) P.push({group:d,value:V,agg:AG,period:'month',chart:'line',sort:'none',top:0,title:`월별 ${VN} 추이`});
  if(g&&small) P.push({group:g,split:small,value:V,agg:AG,period:'none',chart:'stack',sort:'desc',top:12,title:`${g}별 ${small} 구성`});
  else if(g) P.push({group:g,value:V,agg:AG,period:'none',chart:nU(g)>8?'hbar':'bar',sort:'desc',top:0,title:`${g}별 ${n?sumT(n,'sum'):'건수'}`});
  if(d&&(mid||g)) P.push({group:mid||g,split:d,value:V,agg:AG,period:'none',chart:'heat',sort:'desc',top:12,title:`${mid||g}×월 ${VN} 분포`});
  else if(mid) P.push({group:mid,value:V,agg:AG,period:'none',chart:'pie',sort:'desc',top:8,title:`${mid}별 ${VN} 비중`});
  if(g&&P.length<3&&!P.some(p=>p.group===g&&!p.split)) P.push({group:g,value:V,agg:AG,period:'none',chart:nU(g)>8?'hbar':'bar',sort:'desc',top:0,title:`${g}별 ${n?sumT(n,'sum'):'건수'}`});
  if(ns.length>=2&&P.length<3) P.push({group:COLS,value:null,agg:'sum',period:'none',chart:'bar',sort:'none',top:0,title:'항목(열)별 합계 비교'});
  if(g&&ns[1]&&P.length<3) P.push({group:g,value:ns[1],agg:'avg',period:'none',chart:'hbar',sort:'desc',top:10,title:`${g}별 ${ns[1]} 평균`});
  if(!P.length) P.push({group:A.cols[0],value:null,agg:'count',period:'none',chart:'hbar',sort:'desc',top:15,title:`${A.cols[0]}별 건수`});
  return P.slice(0,3);
}
function suggest(){
  const q=autoPlans().map(p=>p.title);
  $('#anChips').innerHTML=q.map(x=>`<button type="button">${esc(x)}</button>`).join(''); $('#anChips').querySelectorAll('button').forEach(b=>b.onclick=()=>{ $('#anQ').value=b.textContent; run(); });
}
const CHARTS=['bar','hbar','line','pie','stack','heat'];
function valid(p){
  if(!p||typeof p!=='object') return null;
  if(p.group!==COLS&&!A.cols.includes(p.group)) return null;
  if(p.value&&!A.cols.includes(p.value)) p.value=null;
  if(p.value&&A.types[p.value]!=='num') p.value=null;
  if(!AGG[p.agg]) p.agg=p.value?'sum':'count'; if(!p.value&&p.agg!=='count'&&p.group!==COLS) p.agg='count';
  if(!CHARTS.includes(p.chart)) p.chart='bar'; if(!['none','month','year'].includes(p.period)) p.period='none';
  if(p.period!=='none'&&A.types[p.group]!=='date') p.period='none';
  if(p.split&&(!A.cols.includes(p.split)||p.split===p.group||p.group===COLS||A.types[p.split]==='num')) p.split=null;
  if(p.split&&!['stack','heat'].includes(p.chart)) p.chart=A.types[p.split]==='date'?'heat':'stack';
  if(!p.split&&['stack','heat'].includes(p.chart)) p.chart='bar';
  if(p.chart==='pie'&&(p.period!=='none'||p.agg==='avg')) p.chart='bar';
  p.top=Math.max(0,Math.min(30,+p.top||0)); p.title=String(p.title||'').slice(0,30)||`${p.group}별 ${AGG[p.agg]}`;
  return p;
}
const keyOf=(v,per)=>{ let k=v===''||v==null?'(빈칸)':String(v).trim(); if(per==='month') k=k.replace(/[./]\s?/g,'-').slice(0,7); if(per==='year') k=k.slice(0,4); return k; };
const kSort=(a,b)=>String(a).localeCompare(String(b),'ko',{numeric:true});
function compute(p){
  if(p.group===COLS){ return numCols().filter(c=>!RATE.test(c)).map(c=>{ const ns=A.rows.map(r=>num(r[c])).filter(x=>x!==null); const s=ns.reduce((a,b)=>a+b,0); return [c,p.agg==='avg'?s/(ns.length||1):s]; }); }
  const sper=p.split&&A.types[p.split]==='date'?'month':'none';
  const m=new Map(), cell=new Map(), sTot=new Map();
  A.rows.forEach(r=>{ const k=keyOf(r[p.group],p.period); const x=p.value?num(r[p.value]):1; if(p.value&&x===null) return;
    const o=m.get(k)||{s:0,n:0,mx:-Infinity,mn:Infinity}; o.s+=x; o.n++; o.mx=Math.max(o.mx,x); o.mn=Math.min(o.mn,x); m.set(k,o);
    if(p.split){ const s=keyOf(r[p.split],sper); const ck=k+'\u0000'+s; const c=cell.get(ck)||{s:0,n:0}; c.s+=x; c.n++; cell.set(ck,c); sTot.set(s,(sTot.get(s)||0)+x); } });
  const val=o=>({sum:o.s,avg:o.s/o.n,count:o.n,max:o.mx,min:o.mn}[p.agg]??o.s);
  let out=[...m].map(([k,o])=>[k,val(o)]);
  if(p.period!=='none'||p.sort==='none'||p.chart==='line') out.sort((a,b)=>kSort(a[0],b[0]));
  else out.sort((a,b)=>p.sort==='asc'?a[1]-b[1]:b[1]-a[1]);
  if(p.top>0) out=out.slice(0,p.top); else if(out.length>20&&p.period==='none') out=out.slice(0,20);
  if(p.split){
    let cols=[...sTot.keys()]; if(sper==='month') cols.sort(kSort); else cols.sort((a,b)=>sTot.get(b)-sTot.get(a));
    const MAXC=sper==='month'?24:p.chart==='heat'?12:6; let other=null;
    if(cols.length>MAXC){ other=new Set(cols.slice(MAXC-1)); cols=[...cols.slice(0,MAXC-1),'기타']; }
    const get=(k,s)=>{ if(s==='기타'&&other){ let t=0,n=0; other.forEach(o=>{ const c=cell.get(k+'\u0000'+o); if(c){ t+=c.s; n+=c.n; } }); return p.agg==='avg'?(n?t/n:0):p.agg==='count'?n:t; }
      const c=cell.get(k+'\u0000'+s); if(!c) return 0; return p.agg==='avg'?c.s/c.n:p.agg==='count'?c.n:c.s; };
    out.m={cols,get};
  }
  return out;
}
/* 해석에 쓸 숫자(사실)는 브라우저가 미리 계산해 AI에 준다 — AI는 이 숫자만 인용 */
function facts(p,data){
  const tot=data.reduce((s,d)=>s+d[1],0), f=[]; const share=v=>tot?(v/tot*100).toFixed(1)+'%':'-';
  if(data.m){ const {cols,get}=data.m;
    if(p.agg!=='avg'){ const cs=cols.map(c=>[c,data.reduce((s,d)=>s+get(d[0],c),0)]); const ct=cs.reduce((s,c)=>s+c[1],0)||1;
      f.push(`${p.split} 구성: `+[...cs].sort((a,b)=>b[1]-a[1]).slice(0,4).map(c=>`${c[0]} ${(c[1]/ct*100).toFixed(1)}%`).join(', ')); }
    let best=null; data.forEach(d=>cols.forEach(c=>{ const v=get(d[0],c); if(!best||v>best[2]) best=[d[0],c,v]; })); if(best) f.push(`가장 큰 칸: ${best[0]} × ${best[1]} ${fmt(best[2])}`);
    if(p.chart==='stack'&&p.agg!=='avg'&&cols.length>=2){ const c0=cols[0]; const r=data.map(d=>[d[0],d[1]?get(d[0],c0)/d[1]*100:0]).sort((a,b)=>b[1]-a[1]);
      f.push(`「${c0}」 비율 최고 ${r[0][0]} ${r[0][1].toFixed(1)}% · 최저 ${r[r.length-1][0]} ${r[r.length-1][1].toFixed(1)}%`); }
    if(p.chart==='heat'){ const colT=cols.map(c=>[c,data.reduce((s,d)=>s+get(d[0],c),0)]).sort((a,b)=>b[1]-a[1]); f.push(`${p.split} 기준 가장 많은 구간 ${colT[0][0]} ${fmt(colT[0][1])}, 가장 적은 구간 ${colT[colT.length-1][0]} ${fmt(colT[colT.length-1][1])}`); }
  }
  if(p.chart==='line'||p.period!=='none'){
    const a=data[0], b=data[data.length-1], mx=[...data].sort((x,y)=>y[1]-x[1])[0], mn=[...data].sort((x,y)=>x[1]-y[1])[0];
    f.push(`기간 ${a[0]}~${b[0]} (${data.length}개 구간)`, `처음 ${a[0]} ${fmt(a[1])} → 마지막 ${b[0]} ${fmt(b[1])}${a[1]?` (${((b[1]-a[1])/Math.abs(a[1])*100).toFixed(1)}% ${b[1]>=a[1]?'증가':'감소'})`:''}`, `최고 ${mx[0]} ${fmt(mx[1])} · 최저 ${mn[0]} ${fmt(mn[1])}`);
    if(p.agg!=='avg') f.push(`구간 평균 ${fmt(tot/data.length)}`);
  }else{
    const s=[...data].sort((x,y)=>y[1]-x[1]);
    if(p.agg!=='avg'&&p.agg!=='max'&&p.agg!=='min') f.push(`전체 ${fmt(tot)} (${data.length}개 항목)`);
    f.push(`1위 ${s[0][0]} ${fmt(s[0][1])}${p.agg==='sum'||p.agg==='count'?` (${share(s[0][1])})`:''}`);
    if(s[1]) f.push(`2위 ${s[1][0]} ${fmt(s[1][1])}${p.agg==='sum'||p.agg==='count'?` (${share(s[1][1])})`:''}`);
    if(s.length>=3&&(p.agg==='sum'||p.agg==='count')) f.push(`상위 3개 합 비중 ${share(s[0][1]+s[1][1]+s[2][1])}`);
    if(s.length>=3) f.push(`최하위 ${s[s.length-1][0]} ${fmt(s[s.length-1][1])}`);
    if(s.length>=2&&s[s.length-1][1]>0) f.push(`최상위/최하위 ${(s[0][1]/s[s.length-1][1]).toFixed(1)}배`);
  }
  return f;
}
/* ── 차트 그리기 (1200×640) — 막대·가로막대·선(면적)·도넛·누적막대·히트맵 ── */
const SPAL=['#1d5fd6','#2fb487','#f2a33a','#e0577a','#7a5af0','#22a6c4'];
function niceMax(v){ v=v||1; const raw=v/4, mag=Math.pow(10,Math.floor(Math.log10(raw))); return [1,1.25,1.5,2,2.5,3,4,5,6,8,10].map(k=>k*mag).find(s=>s>=raw)*4; }
function draw(c,p,data){
  const W=1200, H=640; c.width=W; c.height=H; const x=c.getContext('2d'); x.fillStyle='#fff'; x.fillRect(0,0,W,H);
  const F=(w,s)=>`${w} ${s}px Pretendard,"Malgun Gothic",sans-serif`;
  x.fillStyle='#003087'; x.fillRect(40,34,6,32);
  x.fillStyle='#17223b'; x.font=F(800,30); x.textAlign='left'; x.fillText(p.title||'',58,60);
  x.font=F(500,16); x.fillStyle='#6b7690'; x.fillText(p.group===COLS?`숫자 열별 ${AGG[p.agg]}`:`${p.group}${p.split?' × '+p.split:''} 기준 · ${p.value?p.value+' ':''}${AGG[p.agg]}`,58,88);
  if(!data.length) return;
  const rr=(X,Y,w,h,r)=>{ x.beginPath(); x.roundRect?x.roundRect(X,Y,w,h,r):x.rect(X,Y,w,h); };
  const grad=(x0,y0,x1,y1,a,b)=>{ const g=x.createLinearGradient(x0,y0,x1,y1); g.addColorStop(0,a); g.addColorStop(1,b); return g; };
  if(p.chart==='pie'){
    const tot=data.reduce((s,d)=>s+Math.max(0,d[1]),0)||1; let a=-Math.PI/2; const cx=330,cy=380,R=210;
    x.save(); x.shadowColor='rgba(20,40,90,.18)'; x.shadowBlur=24; x.shadowOffsetY=8; x.beginPath(); x.arc(cx,cy,R,0,7); x.fillStyle='#fff'; x.fill(); x.restore();
    data.forEach((d,i)=>{ const f=Math.max(0,d[1])/tot; x.beginPath(); x.moveTo(cx,cy); x.arc(cx,cy,R,a,a+f*Math.PI*2); x.closePath(); x.fillStyle=PAL[i%PAL.length]; x.fill(); x.strokeStyle='#fff'; x.lineWidth=3; x.stroke();
      if(f>0.06){ const m=a+f*Math.PI; x.fillStyle='#fff'; x.font=F(800,17); x.textAlign='center'; x.fillText((f*100).toFixed(0)+'%',cx+Math.cos(m)*R*0.78,cy+Math.sin(m)*R*0.78+6); } a+=f*Math.PI*2; });
    x.beginPath(); x.arc(cx,cy,R*0.56,0,7); x.fillStyle='#fff'; x.fill();
    x.fillStyle='#17223b'; x.font=F(800,30); x.textAlign='center'; x.fillText(fmt(tot),cx,cy+6); x.font=F(500,15); x.fillStyle='#6b7690'; x.fillText('전체',cx,cy+32); x.textAlign='left';
    x.font=F(600,19); data.slice(0,10).forEach((d,i)=>{ const y=160+i*42; x.fillStyle=PAL[i%PAL.length]; rr(640,y-16,20,20,5); x.fill(); x.fillStyle='#17223b'; x.fillText(String(d[0]).slice(0,14),672,y); x.textAlign='right'; x.fillStyle='#1d4fb0'; x.fillText(`${fmt(d[1])}  (${(d[1]/tot*100).toFixed(1)}%)`,1150,y); x.textAlign='left'; });
    return;
  }
  if(p.chart==='hbar'){
    const n=Math.min(data.length,14), D=data.slice(0,n), L=230, R=W-150, T=120, rowH=Math.min(36,(H-150)/n), mx=niceMax(Math.max(...D.map(d=>d[1]),0));
    D.forEach((d,i)=>{ const y=T+i*rowH, w=Math.max(2,(R-L)*Math.max(0,d[1])/mx), h=rowH*0.66;
      x.fillStyle='#f1f4fa'; rr(L,y,R-L,h,h/2); x.fill();
      x.fillStyle=i===0?grad(L,0,L+w,0,'#1d5fd6','#4f8af0'):grad(L,0,L+w,0,'#8fb0f2','#b9cff8'); rr(L,y,w,h,h/2); x.fill();
      x.fillStyle='#17223b'; x.font=F(i<3?800:600,17); x.textAlign='right'; x.fillText(String(d[0]).slice(0,12),L-14,y+h*0.72);
      if(i<3){ x.fillStyle=['#f2a33a','#9aa6b8','#c98a4b'][i]; x.font=F(800,13); x.textAlign='left'; x.fillText(['1위','2위','3위'][i],40,y+h*0.72); }
      x.fillStyle='#1d4fb0'; x.font=F(700,17); x.textAlign='left'; x.fillText(fmt(d[1]),Math.min(R+10,L+w+10),y+h*0.72); });
    return;
  }
  if(p.chart==='heat'&&data.m){
    const {cols,get}=data.m, D=data.slice(0,12), L=200, T=130, R=W-40, B=H-60, cw=(R-L)/cols.length, ch=Math.min(58,(B-T)/D.length);
    let mxv=-Infinity, mnv=Infinity; D.forEach(d=>cols.forEach(c=>{ const v=get(d[0],c); mxv=Math.max(mxv,v); mnv=Math.min(mnv,v); })); const rng=(mxv-mnv)||1;
    const col=t=>{ const a=[238,244,255], b=[13,63,170]; return `rgb(${a.map((v,i)=>Math.round(v+(b[i]-v)*t)).join(',')})`; };
    x.font=F(600,14); x.textAlign='center'; x.fillStyle='#6b7690'; cols.forEach((c,j)=>x.fillText(String(c).replace(/^\d{4}-0?/,'').replace(/^(\d+)$/,'$1월').slice(0,8),L+cw*(j+.5),T-12));
    D.forEach((d,i)=>{ const y=T+i*ch; x.fillStyle='#17223b'; x.font=F(700,16); x.textAlign='right'; x.fillText(String(d[0]).slice(0,10),L-12,y+ch*0.62);
      cols.forEach((c,j)=>{ const v=get(d[0],c), t=0.06+0.94*Math.pow((v-mnv)/rng,0.9); x.fillStyle=col(t); rr(L+cw*j+2,y+2,cw-4,ch-4,6); x.fill();
        if(cw>52){ x.fillStyle=t>0.55?'#fff':'#28406e'; x.font=F(600,cw>80?14:12); x.textAlign='center'; x.fillText(fmt(v),L+cw*(j+.5),y+ch*0.62); } }); });
    const gx=W-260, gy=H-34; const g=x.createLinearGradient(gx,0,gx+160,0); g.addColorStop(0,col(0)); g.addColorStop(1,col(1)); x.fillStyle=g; rr(gx,gy-10,160,12,6); x.fill();
    x.fillStyle='#6b7690'; x.font=F(500,13); x.textAlign='right'; x.fillText('적음',gx-8,gy); x.textAlign='left'; x.fillText('많음',gx+168,gy);
    return;
  }
  const stack=p.chart==='stack'&&data.m;
  const L=110,R=W-40,T=stack?150:120,B=H-90; const mn=Math.min(0,...data.map(d=>d[1]));
  const mx=mn+niceMax(Math.max(...data.map(d=>d[1]),0)-mn); const Y=v=>B-(v-mn)/(mx-mn)*(B-T);
  x.strokeStyle='#e8ecf4'; x.lineWidth=1; x.font=F(500,14); x.fillStyle='#8a94a6'; x.textAlign='right'; x.setLineDash([4,4]);
  for(let i=0;i<=4;i++){ const v=mn+(mx-mn)*i/4; const y=Y(v); x.beginPath(); x.moveTo(L,y); x.lineTo(R,y); x.stroke(); x.fillText(fmt(v),L-10,y+5); } x.setLineDash([]);
  const n=data.length, bw=(R-L)/n; x.textAlign='center';
  if(p.chart==='line'){
    const pts=data.map((d,i)=>[L+bw*(i+.5),Y(d[1])]);
    const path=()=>{ x.beginPath(); pts.forEach(([px,py],i)=>{ if(!i) return x.moveTo(px,py); const [qx,qy]=pts[i-1], mx2=(qx+px)/2; x.bezierCurveTo(mx2,qy,mx2,py,px,py); }); };
    path(); x.lineTo(pts[pts.length-1][0],B); x.lineTo(pts[0][0],B); x.closePath(); x.fillStyle=grad(0,T,0,B,'rgba(29,95,214,.28)','rgba(29,95,214,0)'); x.fill();
    path(); x.strokeStyle=PAL[0]; x.lineWidth=4; x.stroke();
    const imx=data.reduce((b,d,i)=>d[1]>data[b][1]?i:b,0);
    pts.forEach(([px,py],i)=>{ x.beginPath(); x.arc(px,py,i===imx?8:5,0,7); x.fillStyle=i===imx?PAL[0]:'#fff'; x.fill(); x.lineWidth=3; x.strokeStyle=PAL[0]; x.stroke(); });
    const [bx,by]=pts[imx]; x.font=F(800,15); const lab=`최고 ${fmt(data[imx][1])}`, tw=x.measureText(lab).width+18; const lx=Math.min(R-tw/2,Math.max(L+tw/2,bx));
    x.fillStyle='#17223b'; rr(lx-tw/2,by-46,tw,28,8); x.fill(); x.fillStyle='#fff'; x.fillText(lab,lx,by-27);
  }else if(stack){
    const {cols,get}=data.m;
    data.forEach((d,i)=>{ let acc=0; const px=L+bw*i+bw*0.16, w=bw*0.68;
      cols.forEach((c,j)=>{ const v=get(d[0],c); if(v<=0) return; const y1=Y(acc+v), y0=Y(acc); x.fillStyle=SPAL[j%SPAL.length]; x.fillRect(px,y1,w,y0-y1);
        if(y0-y1>20&&w>34&&d[1]){ x.fillStyle='#fff'; x.font=F(700,12); x.fillText((v/d[1]*100).toFixed(0)+'%',px+w/2,y1+(y0-y1)/2+4); } acc+=v; });
      if(n<=16){ x.fillStyle='#1d4fb0'; x.font=F(700,14); x.fillText(fmt(d[1]),px+w/2,Y(acc)-8); } });
    let lx=W-40; x.font=F(600,15); x.textAlign='left'; [...cols].reverse().forEach((c,jj)=>{ const j=cols.length-1-jj; const t=String(c).slice(0,8), tw=x.measureText(t).width; lx-=tw+34; x.fillStyle=SPAL[j%SPAL.length]; rr(lx,108,16,16,4); x.fill(); x.fillStyle='#17223b'; x.fillText(t,lx+22,122); }); x.textAlign='center';
  }else{
    const best=Math.max(...data.map(d=>d[1]));
    data.forEach((d,i)=>{ const px=L+bw*i+bw*0.18, w=bw*0.64, py=Y(Math.max(0,d[1])), y0=Y(Math.min(0,d[1]));
      x.fillStyle=d[1]===best?grad(0,py,0,y0,'#1d5fd6','#5b92f2'):grad(0,py,0,y0,'#9dbaf4','#c9daf9'); rr(px,py,w,Math.max(1,y0-py),[8,8,0,0]); x.fill();
      if(n<=16){ x.fillStyle=d[1]===best?'#1d4fb0':'#5b6b8c'; x.font=F(d[1]===best?800:600,15); x.fillText(fmt(d[1]),px+w/2,py-10); } });
  }
  x.fillStyle='#17223b'; x.font=F(600,n>16?12:15);
  data.forEach((d,i)=>{ const px=L+bw*(i+.5); x.save(); x.translate(px,B+24); if(n>8) x.rotate(-Math.PI/6); x.fillText(String(d[0]).slice(0,10),0,0); x.restore(); });
}
const toHead=p=>[p.group===COLS?'항목':p.period==='month'?'월':p.period==='year'?'연도':p.group, p.group===COLS?AGG[p.agg]:((p.value?p.value+' ':'')+AGG[p.agg])];
function tableOf(p,data){
  if(data.m){ const {cols,get}=data.m; const show=data.slice(0,12); const pct=p.agg!=='avg';
    const lab=c=>p.split&&A.types[p.split]==='date'?String(c).replace(/^\d{4}-0?/,'')+'월':String(c);
    if(cols.length>7){   // 열이 많으면(월 12개 등) 행·열을 바꾸지 않고 상위 항목만 요약 표로
      const head=[p.group,'합계','가장 많은 '+(A.types[p.split]==='date'?'월':p.split)];
      return {head,rows:show.map(d=>{ const b=cols.reduce((m,c)=>get(d[0],c)>get(d[0],m)?c:m,cols[0]); return [String(d[0]),fmt(d[1]),`${lab(b)} (${fmt(get(d[0],b))})`]; })}; }
    const head=[p.group,...cols.map(lab),'합계'];
    const rows=show.map(d=>[String(d[0]),...cols.map(c=>{ const v=get(d[0],c); return pct&&p.chart==='stack'&&d[1]?`${fmt(v)} (${(v/d[1]*100).toFixed(0)}%)`:fmt(v); }),fmt(d[1])]);
    if(pct){ const ct=cols.map(c=>data.reduce((s,d)=>s+get(d[0],c),0)); rows.push(['합계',...ct.map(fmt),fmt(ct.reduce((a,b)=>a+b,0))]); }
    return {head,rows,widths:[1.4,...cols.map(()=>1),1]};
  }
  const tot=data.reduce((s,d)=>s+d[1],0), pct=(p.agg==='sum'||p.agg==='count')&&p.chart!=='line'&&p.period==='none';
  const head=[...toHead(p),...(pct?['비중']:[])];
  const lim=p.period!=='none'||p.chart==='line'?24:12; const show=data.length>lim?data.slice(0,lim):data;
  const rows=show.map(d=>[String(d[0]),fmt(d[1]),...(pct?[(tot?d[1]/tot*100:0).toFixed(1)+'%']:[])]);
  if(data.length>lim) rows.push([`그 외 ${data.length-lim}개`,fmt(data.slice(lim).reduce((s,d)=>s+d[1],0)),...(pct?[(tot?data.slice(lim).reduce((s,d)=>s+d[1],0)/tot*100:0).toFixed(1)+'%']:[])]);
  if(pct) rows.push(['합계',fmt(tot),'100.0%']);
  return {head,rows};
}
const SYS_PLAN=`당신은 지방자치단체 데이터 분석관입니다. 표의 열 정보(와 배경 문서)를 보고 행정 보고서에 넣을 핵심 분석 3가지를 고릅니다. 계산은 하지 않고 집계 방법과 차트만 정합니다.
규칙: 서로 다른 관점 3개. 질문이 있으면 첫 번째는 질문에 맞춘다. 날짜 열이 있으면 추이 1개 포함. 가능하면 두 기준을 교차하는 분석(stack 또는 heat)을 1개 이상 넣어 보고서가 풍부해지게 한다.
차트 고르기: line=시간 추이 / bar=항목 8개 이하 비교 / hbar=항목이 많거나 이름이 긴 순위 비교 / pie=구성비(항목 8개 이하, 합계·건수일 때만) / stack=항목별로 다른 기준(2~6종류)의 구성 비교(split 필요) / heat=항목×월 같은 표 형태 패턴(split 필요, split이 날짜 열이면 월별로 나뉨).
연도·분기 등이 열로 펼쳐진 표(숫자 열 여러 개)는 group에 "${COLS}"를 쓰면 숫자 열끼리 합계를 비교한다.
반드시 JSON만 출력:
{"title":"보고서 제목(○○ 분석 결과, 25자 이내)","purpose":"분석 목적 한 문장","analyses":[{"group":"기준 열 이름(정확히) 또는 ${COLS}","split":"두 번째 기준 열 이름 또는 null","value":"값 열 이름 또는 null(건수)","agg":"sum|avg|count|max|min","period":"none|month|year","chart":"bar|hbar|line|pie|stack|heat","sort":"desc|asc|none","top":숫자(0이면 전부),"title":"분석 제목(한글 20자 이내)"}, ...3개]}`;
const SYS_REP=`당신은 대구 달성군 공무원으로, 데이터 분석 결과 보고서를 개조식으로 씁니다.
규칙:
- 숫자는 [사실]에 있는 것만 그대로 인용. 새로 계산·추정한 숫자 금지. 원인을 단정하지 않고 "~로 보임", "~ 확인 필요" 수준으로.
- 행정 개조식 명사형 종결(예: "화원읍이 276건(23.0%)으로 가장 많음", "상위 3개 읍 집중 현상 확인"). 마크다운·이모지 금지. 한 항목 70자 이내.
반드시 JSON만 출력:
{"title":"보고서 제목","summary":"핵심 한 줄 요약(60자 이내)","purpose":"분석 목적 한 줄","results":[{"points":["해석1","해석2"]}, ...분석 수만큼],"implications":["시사점1","시사점2"],"actions":["향후 조치1","향후 조치2"]}`;

async function run(){
  if(A.busy) return; if(!A.rows.length){ $('#anMsg').textContent='파일을 먼저 올려 주세요.'; return; }
  const q=($('#anQ').value||'').trim();
  A.busy=true; $('#anGo').disabled=true; $('#anMsg').textContent='AI가 볼 거리를 고르는 중…';
  try{
    let plans=[], title='', purpose='';
    if(aiOn()){
      const t=await callModel(SYS_PLAN,`자료: ${A.name}\n열: ${colInfo()}\n샘플 5행:\n${sample()}\n${A.ctx&&A.src!=='ai'?`배경 문서(일부):\n${A.ctx.slice(0,2500)}\n`:''}${A.aiTitle?`표 제목: ${A.aiTitle}\n`:''}질문: ${q||'(없음 — 알아서 3가지)'}`,900);
      try{ const j=JSON.parse((t.match(/\{[\s\S]*\}/)||['{}'])[0]); plans=(j.analyses||[]).map(valid).filter(Boolean); title=j.title||''; purpose=j.purpose||''; }catch(e){}
    }
    const auto=autoPlans();
    if(q&&!plans.length){ const hit=auto.find(p=>p.title===q); if(hit) plans.push({...hit}); }
    for(const p of auto){ if(plans.length>=3) break; if(!plans.some(x=>x.group===p.group&&x.value===p.value&&x.agg===p.agg&&x.period===p.period&&x.chart===p.chart&&x.split==p.split)) plans.push({...p}); }
    plans=plans.slice(0,3);
    const res=plans.map(p=>{ const data=compute(p); return {p,data,facts:data.length?facts(p,data):[],tbl:tableOf(p,data)}; }).filter(r=>r.data.length);
    if(!res.length) throw new Error('집계할 값이 없습니다. 다른 파일이나 질문으로 다시 해 보세요.');
    A.rep={title:title||(A.aiTitle?A.aiTitle+' 분석 결과':`${A.name.replace(/\.[^.]+$/,'').replace(/\s*\(.*\)$/,'')} 분석 결과`),purpose,res,text:null,date:new Date()};
    render(); $('#anOut').hidden=false; $('#anOut').scrollIntoView({behavior:'smooth',block:'start'});
    $('#anMsg').textContent='보고서 문장 쓰는 중…';
    let R=null;
    if(aiOn()){
      const u=`자료: ${A.name} (${A.rows.length}행)${A.src==='ai'?' — 문서 본문에서 옮긴 표':''}\n${q?`질문: ${q}\n`:''}${A.ctx&&A.src!=='ai'?`배경 문서(일부):\n${A.ctx.slice(0,2000)}\n`:''}\n`+res.map((r,i)=>`[분석 ${i+1}] ${r.p.title}\n[사실] ${r.facts.join(' / ')}\n[표] ${safe(PII_COL.test(r.p.group)?'(개인정보 열 — 항목명 생략)':r.tbl.rows.slice(0,13).map(x=>x.join(' ')).join(' | '))}`).join('\n\n');
      const t=await callModel(SYS_REP,u,1800);
      try{ R=JSON.parse((t.match(/\{[\s\S]*\}/)||['{}'])[0]); }catch(e){}
    }
    if(!R||!Array.isArray(R.results)) R=offlineRep(res);
    A.rep.text=R; if(R.title) A.rep.title=String(R.title).slice(0,40); if(R.purpose) A.rep.purpose=R.purpose;
    render();
    $('#anMsg').textContent='완료 — 「한글 파일로 내려받기」로 보고서를 저장하세요.';
    window.dsSave&&dsSave('analyze',A.rep.title,plainText()); setTimeout(()=>saveHwpx(true),300); if(window.S&&S.stats) S.stats.gen++,window.dsHit&&dsHit('gen');
  }catch(e){ $('#anMsg').textContent='⚠ '+e.message; }
  finally{ A.busy=false; $('#anGo').disabled=false; }
}
function offlineRep(res){
  return {summary:'',purpose:`${A.name} 자료의 주요 현황 파악`,results:res.map(r=>({points:r.facts.slice(0,3)})),
    implications:['상위 항목 집중 여부와 추이 변화를 정기적으로 점검할 필요'],actions:['분기별 동일 기준 재분석 및 관련 부서 공유'],offline:1};
}
function purposeOf(){ return A.rep.purpose||`${A.name} 자료의 현황과 특징 파악`; }
function dateStr(d){ return `${d.getFullYear()}. ${d.getMonth()+1}. ${d.getDate()}.`; }
function dataLine(){ return `${A.name} · ${A.rows.length.toLocaleString()}건(행) · ${A.cols.length}개 항목${A.dropped?` (합계 줄 ${A.dropped}개 제외)`:''}`; }
function plainText(){
  const R=A.rep, T=R.text||{}; const L=[R.title,'',`${ROMAN[0]}. 분석 개요`,`□ 분석 목적`,`  ○ ${purposeOf()}`,`□ 분석 자료`,`  ○ ${dataLine()}`];
  if(T.summary) L.push(`□ 요약`,`  ○ ${T.summary}`);
  L.push('',`${ROMAN[1]}. 분석 결과`); R.res.forEach((r,i)=>{ L.push(`□ ${i+1}. ${r.p.title}`); r.tbl.rows.forEach(x=>L.push('    '+x.join('\t'))); (T.results?.[i]?.points||r.facts).forEach(t=>L.push(`  ○ ${t}`)); });
  L.push('',`${ROMAN[2]}. 시사점 및 향후 조치`,'□ 시사점',...(T.implications||[]).map(t=>`  ○ ${t}`),'□ 향후 조치',...(T.actions||[]).map(t=>`  ○ ${t}`),'끝.');
  return L.join('\n');
}
function render(){
  const R=A.rep, T=R.text; const wait='<p class="ad-wait">문장 작성 중…</p>';
  $('#anDoc').innerHTML=`<div class="ad-page">
    <h3 class="ad-title">${esc(R.title)}</h3><div class="ad-rule"></div>
    <div class="ad-date">${dateStr(R.date)} · 달성On 데이터 분석</div>
    ${T?.summary?`<div class="ad-box">${esc(T.summary)}</div>`:''}
    <div class="ad-sec"><i>${ROMAN[0]}</i>분석 개요</div>
    <p class="ad-sq">□ 분석 목적</p><p class="ad-ci">○ ${esc(purposeOf())}</p>
    <p class="ad-sq">□ 분석 자료</p><p class="ad-ci">○ ${esc(dataLine())}</p>
    ${A.src==='ai'?'<p class="ad-note">※ 문서 본문의 숫자를 AI가 표로 옮긴 것으로, 원문과 대조 후 사용</p>':''}
    <div class="ad-sec"><i>${ROMAN[1]}</i>분석 결과</div>
    ${R.res.map((r,i)=>`<p class="ad-sq">□ ${i+1}. ${esc(r.p.title)}</p>
      <div class="ad-fig"><canvas data-i="${i}"></canvas><button type="button" class="ad-png" data-i="${i}" title="차트 그림 저장">🖼 그림 저장</button></div>
      <table class="ad-tbl"><thead><tr>${r.tbl.head.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${r.tbl.rows.map(x=>`<tr${x[0]==='합계'?' class="sum"':''}>${x.map((v,j)=>`<td${j?' class="n"':''}>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>
      ${T?(T.results?.[i]?.points||r.facts).map(t=>`<p class="ad-ci">○ ${esc(t)}</p>`).join(''):wait}`).join('')}
    <div class="ad-sec"><i>${ROMAN[2]}</i>시사점 및 향후 조치</div>
    ${T?`<p class="ad-sq">□ 시사점</p>${(T.implications||[]).map(t=>`<p class="ad-ci">○ ${esc(t)}</p>`).join('')}
    <p class="ad-sq">□ 향후 조치</p>${(T.actions||[]).map(t=>`<p class="ad-ci">○ ${esc(t)}</p>`).join('')}<p class="ad-end">끝.</p>
    ${T.offline?'<p class="ad-note">※ 오프라인 모드 — 계산된 사실만 적었습니다. 모델 연결 시 해석·시사점 문장을 씁니다.</p>':''}`:wait}
  </div>`;
  $('#anDoc').querySelectorAll('canvas').forEach(c=>{ const r=R.res[+c.dataset.i]; draw(c,r.p,r.data); });
  $('#anDoc').querySelectorAll('.ad-png').forEach(b=>b.onclick=()=>{ const r=R.res[+b.dataset.i]; const a=document.createElement('a'); a.download=`차트_${r.p.title.replace(/[\\/:*?"<>|]/g,'')}.png`; a.href=$(`#anDoc canvas[data-i="${b.dataset.i}"]`).toDataURL('image/png'); a.click(); });
  $('#anTotal').textContent=`분석 ${R.res.length}가지 · 표·차트 ${R.res.length}개`;
  $('#anHwpx').disabled=!T; $('#anCopyR').disabled=!T;
}
async function saveHwpx(silent){
  const R=A.rep; if(!R?.text||!window.DalseongHwpx) return; const T=R.text; const b=$('#anHwpx'); if(silent!==true) b.disabled=true;
  try{
    const imgs=await Promise.all([...$('#anDoc').querySelectorAll('canvas')].map(c=>new Promise(ok=>c.toBlob(async bl=>ok({data:new Uint8Array(await bl.arrayBuffer()),w:c.width,h:c.height}),'image/png'))));
    const B=[];
    B.push({k:'sec',t:`${ROMAN[0]}. 분석 개요`},{k:'sq',t:'분석 목적'},{k:'cir',t:purposeOf()},{k:'sq',t:'분석 자료'},{k:'cir',t:dataLine()});
    if(T.summary) B.push({k:'sq',t:'핵심 요약'},{k:'cir',t:T.summary});
    if(A.src==='ai') B.push({k:'note',t:'문서 본문의 숫자를 AI가 표로 옮긴 것으로, 원문과 대조 후 사용'});
    B.push({k:'blank'},{k:'sec',t:`${ROMAN[1]}. 분석 결과`});
    R.res.forEach((r,i)=>{ B.push({k:'sq',t:`${i+1}. ${r.p.title}`},{img:imgs[i]},{tbl:r.tbl}); (T.results?.[i]?.points||r.facts).forEach(t=>B.push({k:'cir',t})); B.push({k:'blank'}); });
    B.push({k:'sec',t:`${ROMAN[2]}. 시사점 및 향후 조치`},{k:'sq',t:'시사점'},...(T.implications||[]).map(t=>({k:'cir',t})),{k:'sq',t:'향후 조치'},...(T.actions||[]).map(t=>({k:'cir',t})),{k:'cir',t:'끝.'});
    B.push({k:'blank'},{k:'note',t:'본 보고서의 숫자는 원본 자료를 브라우저에서 직접 계산한 값이며, 문장은 달성On(AI)이 작성한 초안으로 담당자 검토 후 사용합니다.'});
    const blob=await DalseongHwpx.build({kind:'free',title:R.title,sub:'',date:dateStr(R.date),blocks:B,answer:plainText()});
    const nm=`${R.title.replace(/[\\/:*?"<>|]/g,'')}.hwpx`;
    if(silent===true){ window.dsArt&&dsArt('analyze',R.title,[{name:nm,blob},...imgs.map((m,i)=>({name:`차트${i+1}_${R.res[i].p.title.replace(/[\\/:*?"<>|]/g,'')}.png`,blob:new Blob([m.data],{type:'image/png'})}))]); return; }
    DalseongHwpx.download(blob,nm);
    window.toast&&toast('한글 파일을 내려받았습니다');
  }catch(e){ if(silent!==true) $('#anMsg').textContent='⚠ 한글 파일 만들기 실패: '+e.message; }
  finally{ if(silent!==true) b.disabled=false; }
}
async function load(list,msg){
  $('#anMsg').textContent='파일 읽는 중…';
  try{ A.aiTitle=''; await readFiles(list); $('#anQ').value=''; summary(); $('#anMsg').textContent=msg||'준비 완료 — 「분석하기」를 누르면 보고서까지 만듭니다.'; $('#anOut').hidden=true; }
  catch(err){ $('#anMsg').textContent='⚠ '+err.message; }
}
function init(){
  if($('#anGo')._on) return; $('#anGo')._on=1;
  $('#anFile').onchange=async e=>{ const fs=[...e.target.files]; if(fs.length) await load(fs); e.target.value=''; };
  $('#anGo').onclick=run; $('#anQ').onkeydown=e=>{ if(e.key==='Enter') run(); };
  $('#anSample').onclick=async()=>{ const get=async(u,n)=>new File([await (await fetch(u)).blob()],n);
    const fs=await Promise.all([get('assets/sample_minwon_2026.xlsx','예시_2026년 읍면별 민원 접수·처리 현황(1~10월).xlsx'),get('assets/sample_minwon_plan.hwpx','예시_2026년 하반기 민원서비스 개선 추진계획.hwpx')]);
    await load(fs,'샘플 파일 2개(엑셀 자료 + 한글 계획서)를 올렸습니다 — 「분석하기」를 누르세요.'); };
  $('#anReset').onclick=()=>{ if(A.busy) return; Object.assign(A,{rows:[],cols:[],rep:null,ctx:'',files:[],name:''}); $('#anSum').innerHTML=''; $('#anRead').hidden=true; $('#anRead').innerHTML=''; $('#anRight .an-ex').hidden=false; $('#anRightLg').textContent='이런 결과가 나와요'; $('#anAsk').hidden=true; $('#anOut').hidden=true; $('#anQ').value=''; $('#anMsg').textContent=''; $('#anFileList').textContent='파일을 올리거나 이 상자에 끌어다 놓으세요 (여러 개 가능)'; };
  $('#anHwpx').onclick=saveHwpx;
  $('#anCopyR').onclick=()=>{ if(!A.rep) return; navigator.clipboard.writeText(plainText()); window.toast&&toast('보고서 내용을 복사했습니다'); };
}
window.ANALYZE={init,loadFile:async f=>{ init(); await load([f],'개인정보를 가린 파일을 불러왔습니다 — 「분석하기」를 누르세요.'); }};
})();
