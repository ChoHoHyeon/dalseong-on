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

/* 2차원 배열 → A.rows (합계·소계 줄은 계산에서 뺀다 — 이중 집계 방지) */
function setTable(arr,name,src){
  const h=findHeader(arr); const [hd,body]=dropEmptyCols(arr[h]||[],arr.slice(h+1));
  const seen={}; A.cols=hd.map((c,i)=>{ let k=String(c||'').replace(/\s+/g,' ').trim()||'열'+(i+1); if(seen[k]) k+=`_${++seen[k]}`; else seen[k]=1; return k; });
  let rows=body.filter(r=>r.some(x=>String(x).trim())).map(r=>Object.fromEntries(A.cols.map((c,i)=>[c,r[i]instanceof Date?r[i].toISOString().slice(0,10):r[i]])));
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
  A.files=list.map(f=>f.name); A.ctx=''; let table=null, texts=[];
  for(const f of list){ const n=f.name.toLowerCase();
    try{
      if(/\.(xlsx|xls|csv)$/.test(n)){ const b=await readSheet(f); if(b&&(!table||b.n>table.n)) table={arr:b.arr,n:b.n,name:f.name+(b.sn&&!/\.csv$/.test(n)?` (${b.sn} 시트)`:''),src:'file'}; continue; }
      if(/\.(hwpx|docx)$/.test(n)){ const ts=await docTables(f); if(ts[0]&&(!table||(table.src!=='file'&&ts[0].length>table.n))) table={arr:ts[0],n:ts[0].length,name:f.name+' (문서 안 표)',src:'doc'}; }
      if(window.pressRead){ const r=await pressRead(f); if(r.text) texts.push(`[${f.name}]\n`+r.text); }
    }catch(e){ texts.push(`[${f.name}] 읽기 실패: ${e.message}`); }
  }
  A.ctx=texts.join('\n\n').slice(0,14000);
  if(table){ setTable(table.arr,table.name,table.src); return; }
  if(!A.ctx.replace(/\s/g,'')) throw new Error('파일에서 표나 글자를 찾지 못했습니다');
  if(!aiOn()) throw new Error('표가 없는 문서는 AI 연결이 필요합니다 (오프라인 모드)');
  $('#anMsg').textContent='문서에 표가 없어 AI가 본문에서 숫자 표를 뽑는 중…';
  const t=await callModel(`문서 본문에서 분석할 수 있는 핵심 통계표 1개를 그대로 옮깁니다. 문서에 실제로 적힌 숫자만 쓰고 계산·추정·창작 금지.
반드시 JSON만: {"title":"표 제목","cols":["구분","열2",...],"rows":[["항목",숫자,...],...]}  (최대 30행, 합계 행 제외, 숫자는 단위·쉼표 없이)
숫자 표로 만들 내용이 없으면 {"cols":[],"rows":[]}`,A.ctx.slice(0,12000),2500);
  const m=t.match(/\{[\s\S]*\}/); let j=null; try{ j=m&&JSON.parse(m[0]); }catch(e){}
  if(!j||!j.cols?.length||!j.rows?.length) throw new Error('문서에서 숫자 표를 찾지 못했습니다 — 엑셀·CSV로 올려 주세요');
  setTable([j.cols,...j.rows],(list[0]?.name||'문서')+' (AI가 본문에서 뽑은 표)','ai'); A.aiTitle=j.title||'';
}

function summary(){
  const T={num:'숫자',text:'글자',date:'날짜',empty:'빈 열'};
  $('#anSum').innerHTML=`<div class="an-meta"><b>${esc(A.name)}</b> · ${A.rows.length.toLocaleString()}행 · ${A.cols.length}열${A.headRow>1&&A.src==='file'?` · 열 이름 ${A.headRow}행`:''}${A.dropped?` · 합계 줄 ${A.dropped}개 제외`:''}
    ${A.src==='ai'?'<span class="an-safe an-warn">AI가 문서에서 옮긴 표 — 원문 대조 필요</span>':'<span class="an-safe">숫자는 이 PC 안에서 계산</span>'}
    ${A.files.length>1?`<div class="an-also">함께 올린 파일 ${A.files.length-1}개는 배경 자료로 씁니다: ${esc(A.files.filter(n=>!A.name.startsWith(n)).join(', '))}</div>`:''}</div>
  <div class="an-cols">${A.cols.map(c=>{ const vals=A.rows.map(r=>r[c]); const blank=vals.filter(x=>x===''||x==null).length; const t=A.types[c]; let extra='';
    if(t==='num'){ const ns=vals.map(num).filter(x=>x!==null); const s=ns.reduce((a,b)=>a+b,0); extra=`합 ${fmt(s)} · 평균 ${fmt(s/ns.length||0)}`; }
    else { const u=new Set(vals.filter(x=>x!=='')).size; extra=`종류 ${u.toLocaleString()}개`; }
    return `<div class="an-col"><b>${esc(c)}</b><span class="t-${t}">${T[t]}</span><small>${extra}${blank?` · 빈칸 ${blank}`:''}</small></div>`; }).join('')}</div>`;
  $('#anAsk').hidden=false; suggest(); $('#anFileList').textContent='다른 파일을 올리면 바꿔서 분석합니다';
}
function sample(){ return A.rows.slice(0,5).map(r=>A.cols.map(c=>String(r[c]??'').slice(0,20)).join(' | ')).join('\n'); }
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
function autoPlans(){
  const ns=numCols().filter(c=>!RATE.test(c)), n=ns[0];
  const g=A.cols.find(c=>A.types[c]==='text'&&new Set(A.rows.map(r=>r[c])).size<=40)||A.cols.find(c=>A.types[c]==='text'), d=A.cols.find(c=>A.types[c]==='date');
  const g2=A.cols.find(c=>c!==g&&A.types[c]==='text'&&new Set(A.rows.map(r=>r[c])).size<=20);
  const P=[];
  if(g) P.push({group:g,value:n||null,agg:n?'sum':'count',period:'none',chart:'bar',sort:'desc',top:0,title:`${g}별 ${n?sumT(n,'sum'):'건수'}`});
  if(d) P.push({group:d,value:n||null,agg:n?'sum':'count',period:'month',chart:'line',sort:'none',top:0,title:`월별 ${n||'건수'} 추이`});
  if(g2) P.push({group:g2,value:n||null,agg:n?'sum':'count',period:'none',chart:'pie',sort:'desc',top:8,title:`${g2}별 ${n||'건수'} 비중`});
  if(g&&!g2&&n&&P.length<3&&new Set(A.rows.map(r=>r[g])).size<=10) P.push({group:g,value:n,agg:'sum',period:'none',chart:'pie',sort:'desc',top:0,title:`${g}별 ${n} 구성비`});
  if(ns.length>=2&&P.length<3) P.push({group:COLS,value:null,agg:'sum',period:'none',chart:'bar',sort:'none',top:0,title:'항목(열)별 합계 비교'});
  if(g&&ns[1]&&P.length<3) P.push({group:g,value:ns[1],agg:'avg',period:'none',chart:'bar',sort:'desc',top:10,title:`${g}별 ${ns[1]} 평균`});
  if(!P.length) P.push({group:A.cols[0],value:null,agg:'count',period:'none',chart:'bar',sort:'desc',top:15,title:`${A.cols[0]}별 건수`});
  return P.slice(0,3);
}
function suggest(){
  const q=autoPlans().map(p=>p.title);
  $('#anChips').innerHTML=q.map(x=>`<button type="button">${esc(x)}</button>`).join(''); $('#anChips').querySelectorAll('button').forEach(b=>b.onclick=()=>{ $('#anQ').value=b.textContent; run(); });
}
function valid(p){
  if(!p||typeof p!=='object') return null;
  if(p.group!==COLS&&!A.cols.includes(p.group)) return null;
  if(p.value&&!A.cols.includes(p.value)) p.value=null;
  if(p.value&&A.types[p.value]!=='num') p.value=null;
  if(!AGG[p.agg]) p.agg=p.value?'sum':'count'; if(!p.value&&p.agg!=='count'&&p.group!==COLS) p.agg='count';
  if(!['bar','line','pie'].includes(p.chart)) p.chart='bar'; if(!['none','month','year'].includes(p.period)) p.period='none';
  if(p.period!=='none'&&A.types[p.group]!=='date') p.period='none';
  p.top=Math.max(0,Math.min(30,+p.top||0)); p.title=String(p.title||'').slice(0,30)||`${p.group}별 ${AGG[p.agg]}`;
  return p;
}
function compute(p){
  if(p.group===COLS){ return numCols().filter(c=>!RATE.test(c)).map(c=>{ const ns=A.rows.map(r=>num(r[c])).filter(x=>x!==null); const s=ns.reduce((a,b)=>a+b,0); return [c,p.agg==='avg'?s/(ns.length||1):s]; }); }
  const m=new Map();
  A.rows.forEach(r=>{ let k=r[p.group]; if(k===''||k==null) k='(빈칸)'; k=String(k).trim(); if(p.period==='month') k=k.replace(/[./]\s?/g,'-').slice(0,7); if(p.period==='year') k=k.slice(0,4);
    const x=p.value?num(r[p.value]):1; if(p.value&&x===null) return; const o=m.get(k)||{s:0,n:0,mx:-Infinity,mn:Infinity}; o.s+=x; o.n++; o.mx=Math.max(o.mx,x); o.mn=Math.min(o.mn,x); m.set(k,o); });
  let out=[...m].map(([k,o])=>[k,{sum:o.s,avg:o.s/o.n,count:o.n,max:o.mx,min:o.mn}[p.agg]??o.s]);
  if(p.period!=='none'||p.sort==='none'||p.chart==='line') out.sort((a,b)=>String(a[0]).localeCompare(String(b[0]),'ko',{numeric:true}));
  else out.sort((a,b)=>p.sort==='asc'?a[1]-b[1]:b[1]-a[1]);
  if(p.top>0) out=out.slice(0,p.top); else if(out.length>20&&p.period==='none') out=out.slice(0,20);
  return out;
}
/* 해석에 쓸 숫자(사실)는 브라우저가 미리 계산해 AI에 준다 — AI는 이 숫자만 인용 */
function facts(p,data){
  const tot=data.reduce((s,d)=>s+d[1],0), f=[]; const share=v=>tot?(v/tot*100).toFixed(1)+'%':'-';
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
function draw(c,p,data){
  const W=1200, H=640; c.width=W; c.height=H; const x=c.getContext('2d'); x.fillStyle='#fff'; x.fillRect(0,0,W,H);
  const F=(w,s)=>`${w} ${s}px Pretendard,"Malgun Gothic",sans-serif`;
  x.fillStyle='#17223b'; x.font=F(800,30); x.textAlign='left'; x.fillText(p.title||'',40,56);
  x.font=F(500,17); x.fillStyle='#6b7690'; x.fillText(p.group===COLS?`숫자 열별 ${AGG[p.agg]}`:`${p.group} 기준 · ${p.value?p.value+' ':''}${AGG[p.agg]}`,40,86);
  if(!data.length) return;
  if(p.chart==='pie'){
    const tot=data.reduce((s,d)=>s+Math.max(0,d[1]),0)||1; let a=-Math.PI/2; const cx=330,cy=370,R=215;
    data.forEach((d,i)=>{ const f=Math.max(0,d[1])/tot; x.beginPath(); x.moveTo(cx,cy); x.arc(cx,cy,R,a,a+f*Math.PI*2); x.closePath(); x.fillStyle=PAL[i%PAL.length]; x.fill(); a+=f*Math.PI*2; });
    x.beginPath(); x.arc(cx,cy,R*0.55,0,7); x.fillStyle='#fff'; x.fill();
    x.fillStyle='#17223b'; x.font=F(800,26); x.textAlign='center'; x.fillText(fmt(tot),cx,cy+4); x.font=F(500,15); x.fillStyle='#6b7690'; x.fillText('전체',cx,cy+28); x.textAlign='left';
    x.font=F(600,19); data.slice(0,12).forEach((d,i)=>{ const y=150+i*38; x.fillStyle=PAL[i%PAL.length]; x.fillRect(640,y-15,18,18); x.fillStyle='#17223b'; x.fillText(`${String(d[0]).slice(0,14)}  ${fmt(d[1])} (${(d[1]/tot*100).toFixed(1)}%)`,668,y); });
    return;
  }
  const L=110,R=W-40,T=120,B=H-90; const mn=Math.min(0,...data.map(d=>d[1]));
  const raw=(Math.max(...data.map(d=>d[1]),0)-mn||1)/4, mag=Math.pow(10,Math.floor(Math.log10(raw))), step=[1,1.25,1.5,2,2.5,3,4,5,6,8,10].map(k=>k*mag).find(v=>v>=raw); const mx=mn+step*4;
  const Y=v=>B-(v-mn)/(mx-mn)*(B-T);
  x.strokeStyle='#e3e8f2'; x.lineWidth=1; x.font=F(500,15); x.fillStyle='#8a94a6'; x.textAlign='right';
  for(let i=0;i<=4;i++){ const v=mn+(mx-mn)*i/4; const y=Y(v); x.beginPath(); x.moveTo(L,y); x.lineTo(R,y); x.stroke(); x.fillText(fmt(v),L-10,y+5); }
  const n=data.length, bw=(R-L)/n; x.textAlign='center';
  if(p.chart==='line'){ x.strokeStyle=PAL[0]; x.lineWidth=4; x.beginPath(); data.forEach((d,i)=>{ const px=L+bw*(i+.5), py=Y(d[1]); i?x.lineTo(px,py):x.moveTo(px,py); }); x.stroke();
    data.forEach((d,i)=>{ const px=L+bw*(i+.5), py=Y(d[1]); x.beginPath(); x.arc(px,py,6,0,7); x.fillStyle='#fff'; x.fill(); x.lineWidth=3; x.stroke(); }); }
  else{ const best=Math.max(...data.map(d=>d[1])); data.forEach((d,i)=>{ const px=L+bw*i+bw*0.18, w=bw*0.64, py=Y(Math.max(0,d[1])), y0=Y(Math.min(0,d[1])); x.fillStyle=d[1]===best?PAL[0]:'#8fb0f2'; x.beginPath(); x.roundRect?x.roundRect(px,py,w,Math.max(1,y0-py),[6,6,0,0]):x.rect(px,py,w,Math.max(1,y0-py)); x.fill(); }); }
  x.fillStyle='#17223b'; x.font=F(600,n>16?12:15);
  data.forEach((d,i)=>{ const px=L+bw*(i+.5); x.save(); x.translate(px,B+22); if(n>8) x.rotate(-Math.PI/6); x.fillText(String(d[0]).slice(0,10),0,0); x.restore(); if(n<=16){ x.fillStyle='#1d4fb0'; x.fillText(fmt(d[1]),px,Y(d[1])-10); x.fillStyle='#17223b'; } });
}
const toHead=p=>[p.group===COLS?'항목':p.period==='month'?'월':p.period==='year'?'연도':p.group, p.group===COLS?AGG[p.agg]:((p.value?p.value+' ':'')+AGG[p.agg])];
function tableOf(p,data){
  const tot=data.reduce((s,d)=>s+d[1],0), pct=(p.agg==='sum'||p.agg==='count')&&p.chart!=='line'&&p.period==='none';
  const head=[...toHead(p),...(pct?['비중']:[])];
  const show=data.length>12?data.slice(0,12):data;
  const rows=show.map(d=>[String(d[0]),fmt(d[1]),...(pct?[(tot?d[1]/tot*100:0).toFixed(1)+'%']:[])]);
  if(data.length>12) rows.push([`그 외 ${data.length-12}개`,fmt(data.slice(12).reduce((s,d)=>s+d[1],0)),...(pct?[(tot?data.slice(12).reduce((s,d)=>s+d[1],0)/tot*100:0).toFixed(1)+'%']:[])]);
  if(pct) rows.push(['합계',fmt(tot),'100.0%']);
  return {head,rows};
}

const SYS_PLAN=`당신은 지방자치단체 데이터 분석관입니다. 표의 열 정보(와 배경 문서)를 보고 행정 보고서에 넣을 핵심 분석 3가지를 고릅니다. 계산은 하지 않고 집계 방법만 정합니다.
규칙: 서로 다른 관점 3개(예: 항목별 규모 비교 / 시간 추이 / 구성 비중). 날짜 열이 있으면 추이 1개 포함. 질문이 있으면 첫 번째는 질문에 맞춘다.
연도·분기 등이 열로 펼쳐진 표(숫자 열 여러 개)는 group에 "${COLS}"를 쓰면 숫자 열끼리 합계를 비교한다.
반드시 JSON만 출력:
{"title":"보고서 제목(○○ 분석 결과, 25자 이내)","purpose":"분석 목적 한 문장","analyses":[{"group":"기준 열 이름(정확히) 또는 ${COLS}","value":"값 열 이름 또는 null(건수)","agg":"sum|avg|count|max|min","period":"none|month|year","chart":"bar|line|pie","sort":"desc|asc|none","top":숫자(0이면 전부),"title":"분석 제목(한글 20자 이내)"}, ...3개]}`;
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
    for(const p of auto){ if(plans.length>=3) break; if(!plans.some(x=>x.group===p.group&&x.value===p.value&&x.agg===p.agg&&x.period===p.period&&x.chart===p.chart)) plans.push({...p}); }
    plans=plans.slice(0,3);
    const res=plans.map(p=>{ const data=compute(p); return {p,data,facts:data.length?facts(p,data):[],tbl:tableOf(p,data)}; }).filter(r=>r.data.length);
    if(!res.length) throw new Error('집계할 값이 없습니다. 다른 파일이나 질문으로 다시 해 보세요.');
    A.rep={title:title||(A.aiTitle?A.aiTitle+' 분석 결과':`${A.name.replace(/\.[^.]+$/,'').replace(/\s*\(.*\)$/,'')} 분석 결과`),purpose,res,text:null,date:new Date()};
    render(); $('#anOut').hidden=false; $('#anOut').scrollIntoView({behavior:'smooth',block:'start'});
    $('#anMsg').textContent='보고서 문장 쓰는 중…';
    let R=null;
    if(aiOn()){
      const u=`자료: ${A.name} (${A.rows.length}행)${A.src==='ai'?' — 문서 본문에서 옮긴 표':''}\n${q?`질문: ${q}\n`:''}${A.ctx&&A.src!=='ai'?`배경 문서(일부):\n${A.ctx.slice(0,2000)}\n`:''}\n`+res.map((r,i)=>`[분석 ${i+1}] ${r.p.title}\n[사실] ${r.facts.join(' / ')}\n[표] ${r.tbl.rows.slice(0,13).map(x=>x.join(' ')).join(' | ')}`).join('\n\n');
      const t=await callModel(SYS_REP,u,1800);
      try{ R=JSON.parse((t.match(/\{[\s\S]*\}/)||['{}'])[0]); }catch(e){}
    }
    if(!R||!Array.isArray(R.results)) R=offlineRep(res);
    A.rep.text=R; if(R.title) A.rep.title=String(R.title).slice(0,40); if(R.purpose) A.rep.purpose=R.purpose;
    render();
    $('#anMsg').textContent='완료 — 「한글 파일로 내려받기」로 보고서를 저장하세요.';
    window.dsSave&&dsSave('analyze',A.rep.title,plainText()); if(window.S&&S.stats) S.stats.gen++,window.dsHit&&dsHit('gen');
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
async function saveHwpx(){
  const R=A.rep; if(!R?.text||!window.DalseongHwpx) return; const T=R.text; const b=$('#anHwpx'); b.disabled=true;
  try{
    const imgs=await Promise.all([...$('#anDoc').querySelectorAll('canvas')].map(c=>new Promise(ok=>c.toBlob(async bl=>ok({data:new Uint8Array(await bl.arrayBuffer()),w:c.width,h:c.height}),'image/png'))));
    const B=[];
    B.push({k:'sec',t:`${ROMAN[0]}. 분석 개요`},{k:'sq',t:'분석 목적'},{k:'cir',t:purposeOf()},{k:'sq',t:'분석 자료'},{k:'cir',t:dataLine()});
    if(T.summary) B.push({k:'sq',t:'핵심 요약'},{k:'cir',t:T.summary});
    if(A.src==='ai') B.push({k:'note',t:'문서 본문의 숫자를 AI가 표로 옮긴 것으로, 원문과 대조 후 사용'});
    B.push({k:'blank'},{k:'sec',t:`${ROMAN[1]}. 분석 결과`});
    R.res.forEach((r,i)=>{ B.push({k:'sq',t:`${i+1}. ${r.p.title}`},{img:imgs[i]},{tbl:{head:r.tbl.head,rows:r.tbl.rows}}); (T.results?.[i]?.points||r.facts).forEach(t=>B.push({k:'cir',t})); B.push({k:'blank'}); });
    B.push({k:'sec',t:`${ROMAN[2]}. 시사점 및 향후 조치`},{k:'sq',t:'시사점'},...(T.implications||[]).map(t=>({k:'cir',t})),{k:'sq',t:'향후 조치'},...(T.actions||[]).map(t=>({k:'cir',t})),{k:'cir',t:'끝.'});
    B.push({k:'blank'},{k:'note',t:'본 보고서의 숫자는 원본 자료를 브라우저에서 직접 계산한 값이며, 문장은 달성On(AI)이 작성한 초안으로 담당자 검토 후 사용합니다.'});
    const blob=await DalseongHwpx.build({kind:'free',title:R.title,sub:'',date:dateStr(R.date),blocks:B,answer:plainText()});
    DalseongHwpx.download(blob,`${R.title.replace(/[\\/:*?"<>|]/g,'')}.hwpx`);
    window.toast&&toast('한글 파일을 내려받았습니다');
  }catch(e){ $('#anMsg').textContent='⚠ 한글 파일 만들기 실패: '+e.message; }
  finally{ b.disabled=false; }
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
  $('#anSample').onclick=async()=>{ const b=await (await fetch('assets/sample_data.csv')).blob(); await load([new File([b],'예시_읍면별_민원접수현황.csv')],'샘플 파일을 올렸습니다 — 「분석하기」를 누르세요.'); };
  $('#anReset').onclick=()=>{ if(A.busy) return; Object.assign(A,{rows:[],cols:[],rep:null,ctx:'',files:[],name:''}); $('#anSum').innerHTML=''; $('#anAsk').hidden=true; $('#anOut').hidden=true; $('#anQ').value=''; $('#anMsg').textContent=''; $('#anFileList').textContent='파일을 올리거나 이 상자에 끌어다 놓으세요 (여러 개 가능)'; };
  $('#anHwpx').onclick=saveHwpx;
  $('#anCopyR').onclick=()=>{ if(!A.rep) return; navigator.clipboard.writeText(plainText()); window.toast&&toast('보고서 내용을 복사했습니다'); };
}
window.ANALYZE={init,loadFile:async f=>{ init(); await load([f],'개인정보를 가린 파일을 불러왔습니다 — 「분석하기」를 누르세요.'); }};
})();
