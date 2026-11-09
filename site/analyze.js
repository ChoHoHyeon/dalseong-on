/* ============================================================
   달성On — 데이터 분석하기 (analyze.js)
   · 엑셀(xlsx·xls)·csv를 올리면 브라우저 안에서 읽어 열별 요약을 보여 주고,
     질문 한 줄("읍면별 합계", "월별 추이")을 넣으면 모델이 집계 방법(기준 열·값 열·합계/평균/건수·차트)만 정해 준다.
   · 실제 계산·차트는 브라우저가 한다. 모델에는 열 이름·자료형·샘플 5행·요약만 보내고, 원본 파일은 PC 밖으로 나가지 않는다.
   · 결과 : 표 + 막대/선/원 차트 + 해석 한 문장 → 차트 PNG · 표 복사 · 보고서용 문장 복사
   ============================================================ */
(function(){
"use strict";
const $=s=>document.querySelector(s);
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const A={rows:[],cols:[],types:{},name:'',busy:false,res:null};
const PAL=['#1d5fd6','#12a15f','#f08c00','#d6336c','#7048e8','#0ca678','#e8590c','#1098ad','#5c7cfa','#74b816'];

function loadXlsx(){ return window.XLSX?Promise.resolve():new Promise((ok,no)=>{ const s=document.createElement('script'); s.src='vendor/xlsx.full.min.js'; s.onload=ok; s.onerror=()=>no(new Error('엑셀 모듈을 불러오지 못했습니다')); document.head.appendChild(s); }); }
const num=x=>{ if(typeof x==='number') return x; const t=String(x??'').replace(/[,\s원건명%]/g,''); return t!==''&&!isNaN(+t)?+t:null; };
function typeOf(vals){ const ne=vals.filter(x=>x!==''&&x!=null); if(!ne.length) return 'empty'; const n=ne.filter(x=>num(x)!==null).length; if(n/ne.length>0.9) return 'num'; const d=ne.filter(x=>x instanceof Date||/^\d{4}[-./]\d{1,2}([-./]\d{1,2})?/.test(String(x))).length; if(d/ne.length>0.8) return 'date'; return 'text'; }

async function readFile(f){
  await loadXlsx();
  const wb=XLSX.read(await f.arrayBuffer(),{type:'array',cellDates:true});
  const ws=wb.Sheets[wb.SheetNames[0]]; const arr=XLSX.utils.sheet_to_json(ws,{header:1,defval:'',raw:true});
  let h=arr.findIndex(r=>r.filter(x=>String(x).trim()).length>=Math.max(2,Math.ceil((arr[0]||[]).length*0.5))); if(h<0) h=0;
  A.cols=arr[h].map((c,i)=>String(c||'열'+(i+1)).trim());
  A.rows=arr.slice(h+1).filter(r=>r.some(x=>String(x).trim())).map(r=>Object.fromEntries(A.cols.map((c,i)=>[c,r[i]instanceof Date?r[i].toISOString().slice(0,10):r[i]])));
  A.types=Object.fromEntries(A.cols.map(c=>[c,typeOf(A.rows.map(r=>r[c]))])); A.name=f.name;
}
function summary(){
  const T={num:'숫자',text:'글자',date:'날짜',empty:'빈 열'};
  $('#anSum').innerHTML=`<div class="an-meta"><b>${esc(A.name)}</b> · ${A.rows.length.toLocaleString()}행 · ${A.cols.length}열 <span class="an-safe">이 PC 안에서 읽음</span></div>
  <div class="an-cols">${A.cols.map(c=>{ const vals=A.rows.map(r=>r[c]); const blank=vals.filter(x=>x===''||x==null).length; const t=A.types[c]; let extra='';
    if(t==='num'){ const ns=vals.map(num).filter(x=>x!==null); extra=`합 ${ns.reduce((a,b)=>a+b,0).toLocaleString()} · 평균 ${(ns.reduce((a,b)=>a+b,0)/ns.length||0).toLocaleString(undefined,{maximumFractionDigits:1})}`; }
    else { const u=new Set(vals.filter(x=>x!=='')).size; extra=`종류 ${u.toLocaleString()}개`; }
    return `<div class="an-col"><b>${esc(c)}</b><span class="t-${t}">${T[t]}</span><small>${extra}${blank?` · 빈칸 ${blank}`:''}</small></div>`; }).join('')}</div>`;
  $('#anAsk').hidden=false; suggest();
}
function sample(){ return A.rows.slice(0,5).map(r=>A.cols.map(c=>String(r[c]??'').slice(0,20)).join(' | ')).join('\n'); }
const SYS=`당신은 지방자치단체 데이터 분석 도우미입니다. 표의 열 정보와 질문을 보고 집계 방법만 정합니다. 계산은 하지 않습니다.
반드시 아래 JSON만 출력합니다:
{"group":"기준 열 이름(정확히)","value":"값 열 이름 또는 null(건수일 때)","agg":"sum|avg|count|max|min","period":"none|month|year (기준 열이 날짜일 때)","chart":"bar|line|pie","sort":"desc|asc|none","top":숫자(0이면 전부),"title":"차트 제목(한글 20자 이내)"}`;
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
function suggest(){
  const g=A.cols.find(c=>A.types[c]==='text'&&new Set(A.rows.map(r=>r[c])).size<=40), d=A.cols.find(c=>A.types[c]==='date'), n=A.cols.find(c=>A.types[c]==='num');
  const q=[]; if(g) q.push(n?`${g}별 ${n} 합계`:`${g}별 건수`); if(d) q.push(n?`월별 ${n} 추이`:'월별 건수 추이'); if(g&&n) q.push(`${n}이(가) 큰 ${g} 상위 5개`);
  if(!q.length) q.push('열별 건수');
  $('#anChips').innerHTML=q.map(x=>`<button>${esc(x)}</button>`).join(''); $('#anChips').querySelectorAll('button').forEach(b=>b.onclick=()=>{ $('#anQ').value=b.textContent; run(); });
}
function guess(q){
  const has=c=>q.includes(c); const g=A.cols.find(c=>has(c)&&A.types[c]!=='num')||A.cols.find(c=>A.types[c]==='text'); const v=A.cols.find(c=>has(c)&&A.types[c]==='num')||null;
  const d=/월별|추이|연도별|년별/.test(q)?A.cols.find(c=>A.types[c]==='date'):null;
  return {group:d||g,value:v,agg:/평균/.test(q)?'avg':v?'sum':'count',period:d?(/연도|년별/.test(q)?'year':'month'):'none',chart:d?'line':'bar',sort:d?'none':'desc',top:+(q.match(/상위\s*(\d+)/)||[])[1]||0,title:q.slice(0,20)};
}
function compute(p){
  const m=new Map();
  A.rows.forEach(r=>{ let k=r[p.group]; if(k===''||k==null) k='(빈칸)'; k=String(k); if(p.period==='month') k=k.slice(0,7).replace(/[./]/g,'-'); if(p.period==='year') k=k.slice(0,4);
    const x=p.value?num(r[p.value]):1; if(p.value&&x===null) return; const o=m.get(k)||{s:0,n:0,mx:-Infinity,mn:Infinity}; o.s+=x; o.n++; o.mx=Math.max(o.mx,x); o.mn=Math.min(o.mn,x); m.set(k,o); });
  let out=[...m].map(([k,o])=>[k,{sum:o.s,avg:o.s/o.n,count:o.n,max:o.mx,min:o.mn}[p.agg]??o.s]);
  if(p.period!=='none'||p.sort==='none') out.sort((a,b)=>String(a[0]).localeCompare(String(b[0]),'ko',{numeric:true}));
  else out.sort((a,b)=>p.sort==='asc'?a[1]-b[1]:b[1]-a[1]);
  if(p.top>0) out=out.slice(0,p.top); else if(out.length>30&&p.period==='none') out=out.slice(0,30);
  return out;
}
const AGG={sum:'합계',avg:'평균',count:'건수',max:'최댓값',min:'최솟값'};
function draw(p,data){
  const c=$('#anChart'), W=1200, H=640; c.width=W; c.height=H; const x=c.getContext('2d'); x.fillStyle='#fff'; x.fillRect(0,0,W,H);
  x.fillStyle='#17223b'; x.font='800 30px Pretendard,"Malgun Gothic",sans-serif'; x.fillText(p.title||'',40,56);
  x.font='500 17px Pretendard,"Malgun Gothic",sans-serif'; x.fillStyle='#6b7690'; x.fillText(`${p.group} 기준 · ${p.value?p.value+' ':''}${AGG[p.agg]} · 자료: ${A.name}`,40,86);
  const fmt=v=>Math.abs(v)>=1e4?Math.round(v).toLocaleString():(+v.toFixed(1)).toLocaleString();
  if(p.chart==='pie'){
    const tot=data.reduce((s,d)=>s+Math.max(0,d[1]),0)||1; let a=-Math.PI/2; const cx=360,cy=370,R=220;
    data.forEach((d,i)=>{ const f=Math.max(0,d[1])/tot; x.beginPath(); x.moveTo(cx,cy); x.arc(cx,cy,R,a,a+f*Math.PI*2); x.closePath(); x.fillStyle=PAL[i%PAL.length]; x.fill(); a+=f*Math.PI*2; });
    x.beginPath(); x.arc(cx,cy,R*0.55,0,7); x.fillStyle='#fff'; x.fill();
    x.font='600 18px Pretendard,"Malgun Gothic",sans-serif'; data.slice(0,12).forEach((d,i)=>{ const y=150+i*38; x.fillStyle=PAL[i%PAL.length]; x.fillRect(680,y-14,16,16); x.fillStyle='#17223b'; x.fillText(`${d[0]}  ${fmt(d[1])} (${(d[1]/tot*100).toFixed(1)}%)`,706,y); });
    return;
  }
  const L=110,R=W-40,T=120,B=H-90; const mx=Math.max(...data.map(d=>d[1]),0)*1.1||1; const mn=Math.min(0,...data.map(d=>d[1]));
  const Y=v=>B-(v-mn)/(mx-mn)*(B-T);
  x.strokeStyle='#e3e8f2'; x.lineWidth=1; x.font='500 15px Pretendard,"Malgun Gothic",sans-serif'; x.fillStyle='#8a94a6'; x.textAlign='right';
  for(let i=0;i<=4;i++){ const v=mn+(mx-mn)*i/4; const y=Y(v); x.beginPath(); x.moveTo(L,y); x.lineTo(R,y); x.stroke(); x.fillText(fmt(v),L-10,y+5); }
  const n=data.length, bw=(R-L)/n; x.textAlign='center';
  if(p.chart==='line'){ x.strokeStyle=PAL[0]; x.lineWidth=4; x.beginPath(); data.forEach((d,i)=>{ const px=L+bw*(i+.5), py=Y(d[1]); i?x.lineTo(px,py):x.moveTo(px,py); }); x.stroke();
    data.forEach((d,i)=>{ const px=L+bw*(i+.5), py=Y(d[1]); x.beginPath(); x.arc(px,py,6,0,7); x.fillStyle='#fff'; x.fill(); x.lineWidth=3; x.stroke(); }); }
  else data.forEach((d,i)=>{ const px=L+bw*i+bw*0.18, w=bw*0.64, py=Y(Math.max(0,d[1])); x.fillStyle=i===0&&p.sort==='desc'?PAL[0]:'#7da4f0'; x.beginPath(); x.roundRect(px,py,w,Y(0)-py,[6,6,0,0]); x.fill(); });
  x.fillStyle='#17223b'; x.font=`600 ${n>16?12:15}px Pretendard,"Malgun Gothic",sans-serif`;
  data.forEach((d,i)=>{ const px=L+bw*(i+.5); x.save(); x.translate(px,B+22); if(n>10) x.rotate(-Math.PI/5); x.fillText(String(d[0]).slice(0,10),0,0); x.restore(); if(n<=16){ x.fillStyle='#1d4fb0'; x.fillText(fmt(d[1]),px,Y(d[1])-10); x.fillStyle='#17223b'; } });
}
async function run(){
  if(A.busy||!A.rows.length) return; const q=($('#anQ').value||'').trim(); if(!q){ $('#anMsg').textContent='무엇을 보고 싶은지 한 줄 적어 주세요.'; return; }
  A.busy=true; $('#anGo').disabled=true; $('#anMsg').textContent='분석 방법 정하는 중…';
  try{
    const S=window.S||{}; let p;
    if((S.key||S.server)&&!S.offline){ const t=await callModel(SYS,`열: ${colInfo()}\n샘플 5행:\n${sample()}\n질문: ${q}`); const m=t.match(/\{[\s\S]*\}/); p=m?JSON.parse(m[0]):guess(q); if(!A.cols.includes(p.group)) p=guess(q); if(p.value&&!A.cols.includes(p.value)) p.value=null; }
    else p=guess(q);
    const data=compute(p); if(!data.length) throw new Error('집계할 값이 없습니다. 질문을 바꿔 보세요.');
    A.res={p,data}; draw(p,data);
    $('#anTable').innerHTML=`<table class="an-tbl"><thead><tr><th>${esc(p.group)}</th><th>${esc((p.value||'')+' '+AGG[p.agg])}</th><th>비중</th></tr></thead><tbody>${(()=>{ const tot=data.reduce((s,d)=>s+d[1],0)||1; return data.map(d=>`<tr><td>${esc(d[0])}</td><td>${(+d[1].toFixed(2)).toLocaleString()}</td><td>${(d[1]/tot*100).toFixed(1)}%</td></tr>`).join(''); })()}</tbody></table>`;
    $('#anOut').hidden=false; $('#anOut').scrollIntoView({behavior:'smooth',block:'start'});
    $('#anInsight').textContent='해석 문장 작성 중…';
    if((S.key||S.server)&&!S.offline){ const t=await callModel('지방자치단체 보고서용으로, 주어진 집계표를 근거로 해석 문장 2문장을 개조식이 아닌 평서문으로 씁니다. 숫자는 표에 있는 것만. 추측·원인 단정 금지.',`제목: ${p.title}\n집계(${p.group} / ${AGG[p.agg]}):\n${data.slice(0,30).map(d=>d[0]+': '+(+d[1].toFixed(2))).join('\n')}`,300); $('#anInsight').textContent=t.trim(); }
    else { const top=[...data].sort((a,b)=>b[1]-a[1])[0]; $('#anInsight').textContent=`${p.group} 기준 ${AGG[p.agg]}은(는) 「${top[0]}」이(가) ${(+top[1].toFixed(1)).toLocaleString()}(으)로 가장 큽니다. (오프라인 시연 — 모델 연결 시 해석 문장을 씁니다)`; }
    $('#anMsg').textContent='완료 — 질문을 바꿔 다시 볼 수 있습니다.'; window.dsSave&&dsSave('analyze',p.title,`${p.title} (${A.name})\n\n`+data.map(d=>d[0]+'\t'+(+d[1].toFixed(2))).join('\n')+'\n\n'+$('#anInsight').textContent); if(window.S&&S.stats) S.stats.gen++,window.dsHit&&dsHit('gen');
  }catch(e){ $('#anMsg').textContent='⚠ '+e.message; }
  finally{ A.busy=false; $('#anGo').disabled=false; }
}
function init(){
  if($('#anGo')._on) return; $('#anGo')._on=1;
  $('#anFile').onchange=async e=>{ const f=e.target.files[0]; if(!f) return; $('#anMsg').textContent='파일 읽는 중…'; try{ await readFile(f); summary(); $('#anMsg').textContent=''; $('#anOut').hidden=true; }catch(err){ $('#anMsg').textContent='⚠ '+err.message; } e.target.value=''; };
  $('#anGo').onclick=run; $('#anQ').onkeydown=e=>{ if(e.key==='Enter') run(); };
  $('#anSample').onclick=async()=>{ const b=await (await fetch('assets/sample_data.csv')).blob(); await readFile(new File([b],'예시_읍면별_민원접수현황.csv')); summary(); $('#anQ').value='읍면별 접수건수 합계'; toast?.('예시 데이터를 불러왔습니다 — 질문 칩을 눌러 보세요'); };
  $('#anPng').onclick=()=>{ const a=document.createElement('a'); a.download=`분석차트_${(A.res?.p.title||'').replace(/[\\/:*?"<>|]/g,'')}.png`; a.href=$('#anChart').toDataURL('image/png'); a.click(); };
  $('#anCopyT').onclick=()=>{ if(!A.res) return; navigator.clipboard.writeText([[A.res.p.group,AGG[A.res.p.agg]].join('\t'),...A.res.data.map(d=>d[0]+'\t'+(+d[1].toFixed(2)))].join('\n')); toast?.('표를 복사했습니다 — 엑셀·한글에 붙여넣기'); };
  $('#anCopyS').onclick=()=>{ navigator.clipboard.writeText($('#anInsight').textContent); toast?.('해석 문장을 복사했습니다'); };
  $('#anType').onchange=()=>{ if(A.res){ A.res.p.chart=$('#anType').value; draw(A.res.p,A.res.data); } };
}
window.ANALYZE={init};
})();
