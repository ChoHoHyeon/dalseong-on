/* 달성On 시연판 — 앱 로직
 * 구조: [자료 색인 index.json] → [브라우저 내 BM25 검색] → [답변 모델(Anthropic API) 또는 오프라인 구성] → [근거 카드·한글 생성]
 * 실제 구축 시 검색·모델 호출은 업무망 서버로 이동하며 브라우저에는 키를 두지 않는다. */
(function(){
'use strict';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const S={ mode:'staff', docs:[], meta:null, idx:null, layers:{1:true,2:true}, key:'', model:'claude-sonnet-4-5', offline:false,
          hist:[], lastAnswer:null, lastCites:[], lastQ:'', stats:{q:0,cite:0,gen:0,hwpx:0,hits:{}} , busy:false, khist:[] };

/* ───────── 1. 검색 색인 (BM25, 어절 + 문자 2-gram) ───────── */
const JOSA=/(으로부터|에서는|에게는|으로는|으로써|에서|에게|까지|부터|이나|이라|이며|으로|은|는|이|가|을|를|의|에|와|과|도|로|만|요)$/;
function tok(s){
  const out=[]; const clean=String(s||'').toLowerCase().replace(/[「」『』()\[\]〔〕<>《》,.;:!?·\-–—~/\\'"“”‘’…※□■❍○●▶◆ㆍ]/g,' ');
  for(let w of clean.split(/\s+/)){ if(!w) continue;
    if(w.length>=3&&/[가-힣]$/.test(w)){ const st=w.replace(JOSA,''); if(st.length>=2) w=st; }
    out.push('W:'+w);                                      // 어절(조사 제거) — 가중치 높음
    if(w.length>=2){ for(let i=0;i<w.length-1;i++) out.push(w.slice(i,i+2)); }   // 문자 2-gram — 부분 일치용
  }
  return out;
}
function buildIndex(docs){
  const N=docs.length, df=new Map(), tf=[], len=[]; let total=0;
  docs.forEach((d,i)=>{ const t=tok(d.title+' '+d.text); const m=new Map(); t.forEach(x=>m.set(x,(m.get(x)||0)+1)); tf[i]=m; len[i]=t.length; total+=t.length; for(const k of m.keys()) df.set(k,(df.get(k)||0)+1); });
  return {N,df,tf,len,avg:total/N};
}
const STOP=new Set(['대구광역시','달성군','조례','규칙','일부개정조례','일부개정규칙','관리','운영','관한','지원','사무의','대한','등의','일부','개정']);
function srcBoost(q){ // 질문에 조례 고유 명칭(파크골프장, 거리공연 …)이 있으면 해당 자치법규 우선
  const hit=new Set(); for(const src of S.meta.law_sources){ for(const w of src.split(/[\s·]+/)){ if(w.length>=3&&!STOP.has(w)&&q.includes(w.slice(0,3))) hit.add(src); } } return hit;
}
function search(q,{filter,k=6}={}){
  const {N,df,tf,len,avg}=S.idx, qt=[...new Set(tok(q))], K1=1.0,B=0.35, sc=new Float32Array(N), boost=srcBoost(q);
  for(const t of qt){ const n=df.get(t); if(!n) continue; const idf=Math.log(1+(N-n+.5)/(n+.5)); const w=t.startsWith('W:')?2.2:1;
    for(let i=0;i<N;i++){ const f=tf[i].get(t); if(!f) continue; sc[i]+=w*idf*(f*(K1+1))/(f+K1*(1-B+B*len[i]/avg)); } }
  const res=[]; for(let i=0;i<N;i++){ if(sc[i]>0 && (!filter||filter(S.docs[i]))){ let v=sc[i]; if(S.docs[i].title.endsWith('(개정문)')) v*=0.45; if(boost.size&&S.docs[i].type==='law') v*=boost.has(S.docs[i].source)?1.8:0.6; res.push([v,i]); } }
  res.sort((a,b)=>b[0]-a[0]);
  // 같은 데이터셋 행이 상위를 독식하지 않도록 출처별 최대 3건
  const per={}, out=[]; for(const [s,i] of res){ const d=S.docs[i]; const key=d.type==='data'?d.source:d.id; per[key]=(per[key]||0)+1; if(per[key]>3) continue; out.push({doc:d,score:s}); if(out.length>=k) break; }
  return out;
}
/* 질의 의도에 따라 근거 순서 조정: 조례·규칙 질문은 자치법규 우선, 가격·수수료 질문은 해당 데이터 우선 */
function rerank(q,hits){
  const top3=hits.slice(0,4); let pick=null;
  if(/(조례|규칙|근거|감면|규정|조문|별표|훈령)/.test(q)) pick=top3.find(h=>h.doc.type==='law');
  if(!pick&&/(가격|수수료|얼마|요금)/.test(q)) pick=top3.find(h=>h.doc.type==='data'&&/(가격|수수료)/.test(h.doc.source));
  if(pick&&hits[0]!==pick){ hits=[pick,...hits.filter(h=>h!==pick)]; }
  return hits;
}
const EUP=['화원읍','논공읍','다사읍','유가읍','옥포읍','현풍읍','가창면','하빈면','구지면'];
/* 읍면 + 시설 개소 수 질의는 색인 통계로 정확히 계산 */
function countIntent(q){
  const e=EUP.find(x=>q.includes(x)); const ds=[['경로당','경로당 현황'],['판매소','종량제봉투 판매소'],['봉투 파는','종량제봉투 판매소'],['도서관','도서관']].find(([w])=>q.includes(w));
  if(!ds||!/(몇|개소|몇개|몇 개|갯수|개수|얼마나|현황)/.test(q)) return null;
  const rows=S.docs.filter(d=>d.type==='data'&&d.source===ds[1]&&!d.title.endsWith('읍면별 집계'));
  const sub=e?rows.filter(d=>d.eup===e):rows; return {eup:e,ds:ds[1],n:sub.length,total:rows.length,sample:sub.slice(0,5)};
}

/* ───────── 2. 화면 초기화 ───────── */
async function init(){
  const j=await (await fetch('data/index.json')).json(); S.docs=j.docs; S.meta=j.meta; S.idx=buildIndex(S.docs);
  const c=S.meta.counts; $('#docTotal').textContent=(c.law+c.minwon+c.data+c.internal).toLocaleString()+'건';
  $('#c1').textContent=(c.law+c.minwon+c.data).toLocaleString(); $('#c2').textContent=c.internal;
  renderSources(); renderChips(); renderAdminSrc(); resetChat(); resetKakao(); DalseongHwpx.load().catch(()=>{});
  $('#hDate').value=`${new Date().getFullYear()}. ${new Date().getMonth()+1}. ${new Date().getDate()}. / 정보통신과`;
}
function renderSources(){
  const el=$('#srcList'); el.innerHTML='';
  const add=(type,t,n)=>{ const d=document.createElement('div'); d.className='src type-'+type; d.innerHTML=`<span class="t" title="${t}">${t}</span><span class="n">${n}</span>`; el.appendChild(d); };
  S.meta.law_sources.forEach(s=>add('law',s.replace('대구광역시 달성군 ',''),S.docs.filter(d=>d.source===s).length+'조'));
  add('minwon','민원 안내(예시)',S.meta.counts.minwon+'건');
  S.meta.datasets.forEach(d=>add('data',d.name,d.rows.toLocaleString()+'행'));
  const inSrc=[...new Set(S.docs.filter(d=>d.type==='internal').map(d=>d.source))]; inSrc.forEach(s=>{const d=document.createElement('div'); d.className='src type-internal staff-only'; d.innerHTML=`<span class="t">${s}</span><span class="n">직원</span>`; el.appendChild(d);});
}
const CHIPS={staff:['거리공연 지원사업 내용과 조례 근거는?','다사읍 경로당은 몇 개소야?','체육시설 사용료 감면 대상과 감면율은?','연가 2일 신청하면 결재선이 어떻게 돼?','수의계약 1인 견적 가능 한도는?','급식시설 환경개선 지원 대상과 내용은?','악성민원 조례에서 민원상담 권장 시간 규정은?','국민체육센터 위치와 주요 시설은?','소파 카우치 대형폐기물 수수료는?','생성형 AI에 개인정보 넣어도 돼?'],
             citizen:['대형폐기물은 어떻게 버려요?','전입신고 필요한 서류가 뭐예요?','다사읍 도서관 운영시간 알려주세요','출산지원금 신청 방법','종량제봉투 20L 가격은?','현풍읍 경로당 위치 알려줘','불법주차 신고는 어디서 하나요?','체육시설 대관은 어떻게 신청하죠?']};
function renderChips(){ const el=$('#chips'); el.innerHTML=''; CHIPS[S.mode].forEach(t=>{const b=document.createElement('button'); b.className='chip'; b.textContent=t; b.onclick=()=>{ if(S.mode==='staff'){$('#q').value=t; $('#form').requestSubmit();} else {$('#kq').value=t; $('#kform').requestSubmit();} }; el.appendChild(b);}); }
function renderAdminSrc(){
  const t=$('#adminSrc'); t.innerHTML='';
  const rows=[...S.meta.law_sources.map(s=>['자치법규',s.replace('대구광역시 달성군 ',''),'2026.7.10 공포']),['민원안내','민원 안내 10건(예시)','2026.9.9'],...S.meta.datasets.map(d=>['공공데이터',d.name+' '+d.rows.toLocaleString()+'행','2026.9.8 기준']),['내부지침','복무·계약·보안·문서·공공데이터 5건(예시)','직원 전용']];
  rows.forEach(([a,b,c])=>{ const tr=document.createElement('tr'); tr.innerHTML=`<td><small>${a}</small><br>${b}</td><td>${c}<button data-up>갱신</button></td>`; t.appendChild(tr); });
  t.onclick=e=>{ if(e.target.dataset.up!==undefined){ e.target.textContent='반영됨 ✓'; e.target.disabled=true; toast('자료 갱신 완료 — 전 직원 화면에 즉시 반영됩니다 (시연)'); } };
}
function toast(m){ let t=$('#toast'); if(!t){ t=document.createElement('div'); t.id='toast'; t.style.cssText='position:fixed;bottom:26px;left:50%;transform:translateX(-50%);background:#1c2a47;border:1px solid rgba(124,196,255,.4);color:#e8eefc;padding:10px 16px;border-radius:12px;font-size:13px;z-index:99;box-shadow:0 10px 30px rgba(0,0,0,.5)'; document.body.appendChild(t);} t.textContent=m; t.hidden=false; clearTimeout(t._t); t._t=setTimeout(()=>t.hidden=true,2600); }

/* ───────── 3. 모드 전환 ───────── */
function setMode(m){ S.mode=m; document.body.dataset.mode=m; $$('.seg-b').forEach(b=>b.classList.toggle('on',b.dataset.mode===m)); renderChips(); renderEv(S.mode==='staff'?S.lastCites:S.kLastCites||[]); }
$$('.seg-b').forEach(b=>b.onclick=()=>setMode(b.dataset.mode));
$('#layers').onclick=e=>{ const li=e.target.closest('li'); if(!li||li.classList.contains('lock')) return; const n=li.dataset.layer; S.layers[n]=!S.layers[n]; li.classList.toggle('on',S.layers[n]); };

/* ───────── 4. 답변 모델 호출 ───────── */
function sysPrompt(mode){
  const base=`당신은 대구광역시 달성군의 AI 업무비서 "달성On"입니다. 오늘은 ${new Date().toLocaleDateString('ko-KR')}입니다.
아래 <자료>는 달성군 자치법규·민원안내·공공데이터·내부지침에서 검색된 근거입니다. 규칙:
1. 자료에 근거가 있으면 반드시 해당 문장 끝에 [번호]로 인용하고, 조례는 「조례명」 제N조 형태로 명시합니다.
2. 자료에 없는 내용은 첫 줄에 "※ 달성군 자료에 없는 내용으로 일반 지식으로 답변합니다."라고 밝힌 뒤 답하고, 없는 근거를 만들지 않습니다.
3. 숫자·수수료·개소 수는 자료의 값을 그대로 쓰고 추정하지 않습니다.
4. 한국어, 간결하게. 핵심 결론을 먼저 쓰고 필요한 경우만 ■(항목) ❍(내용) -(설명) 기호로 구조화합니다. 마크다운 표·헤더(#)는 쓰지 않습니다.`;
  if(mode==='citizen') return base+`
5. 지금은 군민용 카카오톡 채널입니다. 존댓말로 친절하고 짧게(6줄 이내) 답하고, 신청·접수가 필요한 민원은 "정부24 또는 국민신문고에서 접수" 문장을 끝에 붙입니다. 내부지침·직원용 정보는 언급하지 않습니다. 개인정보를 요구하지 않습니다.`;
  return base+`
5. 지금은 직원용 업무망 화면입니다. 담당 직원이 바로 공문·품의에 옮겨 쓸 수 있는 문장으로 답하고, 관련 절차·결재선·유의사항을 덧붙입니다.`;
}
function ctxBlock(hits){ return '<자료>\n'+hits.map((h,i)=>`[${i+1}] (${typeName(h.doc.type)}) ${h.doc.title}\n${h.doc.text.slice(0,1400)}`).join('\n\n')+'\n</자료>'; }
function typeName(t){ return {law:'자치법규',minwon:'민원안내',data:'공공데이터',internal:'내부지침'}[t]||t; }

async function callModel(mode,hits,q,hist,onDelta){
  const msgs=[...hist.slice(-6), {role:'user',content:ctxBlock(hits)+'\n\n질문: '+q}];
  const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'content-type':'application/json','x-api-key':S.key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
    body:JSON.stringify({model:S.model,max_tokens:1200,stream:true,system:sysPrompt(mode),messages:msgs})});
  if(!r.ok){ const e=await r.text(); throw new Error(`모델 호출 실패 (${r.status}) ${e.slice(0,200)}`); }
  const rd=r.body.getReader(), dec=new TextDecoder(); let buf='', full='';
  while(true){ const {value,done}=await rd.read(); if(done) break; buf+=dec.decode(value,{stream:true}); const lines=buf.split('\n'); buf=lines.pop();
    for(const ln of lines){ if(!ln.startsWith('data:')) continue; try{ const j=JSON.parse(ln.slice(5)); if(j.type==='content_block_delta'&&j.delta?.text){ full+=j.delta.text; onDelta(full); } if(j.type==='error') throw new Error(j.error?.message||'stream error'); }catch(e){ if(e.message&&!/JSON/.test(e.message)) throw e; } } }
  return full;
}
/* 키가 없을 때: 검색 결과만으로 답변 구성(폐쇄망·오프라인 시연) */
function offlineAnswer(mode,hits,q){
  const ci=countIntent(q);
  if(ci){ const where=ci.eup?`${ci.eup} `:'달성군 전체 '; const nm=ci.ds.replace(' 현황',''); let a=`${where}${nm}${/[당관]$/.test(nm)?'은':'는'} ${ci.n.toLocaleString()}개소입니다 [1].`; if(ci.eup) a+=` (군 전체 ${ci.total.toLocaleString()}개소)`; if(ci.sample.length) a+='\n'+ci.sample.map(d=>'❍ '+d.text.split(' — ')[0].replace(/^(경로당|종량제봉투 판매소|도서관) /,'')+' — '+(d.text.split(' — ')[1]||'').split(',')[0]).join('\n'); a+=`\n※ 공공데이터 기준일 2026-09-08`; return a; }
  if(!hits.length) return mode==='citizen'?'죄송합니다, 해당 내용은 안내 자료에 없습니다. 아래 버튼의 민원을 안내해 드릴 수 있어요.':'※ 달성군 자료에 없는 내용입니다. 시연판은 연결된 자료(조례 7건·민원안내·공공데이터 6종·내부지침) 범위 안에서 답하며, 실제 구축 시에는 자료 밖 질문도 AI가 직접 답변합니다.\n@@SUGGEST@@';
  const top=hits[0].doc; let a='';
  if(top.type==='law'){ const art=top.title.replace(top.source,'').trim(); a=`■ 「${top.source.replace('대구광역시 ','')}」 ${art} [1]\n`; let lines=top.text.split('\n').map(l=>l.trim()).filter(Boolean); if(art.startsWith('[별표')) lines=lines.slice(1).filter(l=>l.length>8||/:/.test(l)); a+=lines.slice(0,art.startsWith('[별표')?14:7).map(l=>(/^(①|②|③|④|⑤|\d+\.)/.test(l)?'❍ ':'- ')+l).join('\n'); if(lines.length>8&&!art.startsWith('[별표')) a+='\n- (이하 생략 — 근거 카드에서 전문 확인)'; const l2=hits.slice(1,3).filter(h=>h.doc.type==='law'); l2.forEach((h,i)=>a+=`\n- 관련: ${h.doc.title.replace('대구광역시 달성군 ','')} [${i+2}]`); }
  else if(top.type==='minwon'){ const f=Object.fromEntries(top.text.split('\n').slice(1).map(l=>{const i=l.indexOf(': '); return [l.slice(0,i),l.slice(i+2)];})); a=`■ ${top.title} [1]\n❍ 신청 방법: ${f['신청 방법']}\n❍ 필요 서류: ${f['필요 서류']}\n❍ 수수료: ${f['수수료']} / 처리: ${f['처리 기간']}\n❍ 담당: ${f['담당']}`; if(mode==='citizen') a+='\n신청·접수는 정부24 또는 국민신문고에서 하실 수 있습니다.'; }
  else if(top.type==='data'){ const same=hits.filter(h=>h.doc.type==='data'&&h.doc.source===top.source).slice(0,4); a=`■ ${top.source} (공공데이터, 기준일 2026-09-08)\n`+same.map(h=>`❍ ${h.doc.text.replace(/^(경로당|종량제봉투 판매소|도서관|대형폐기물 수수료:) /,'')} [${hits.indexOf(h)+1}]`).join('\n'); }
  else { a=`■ ${top.title} (${top.source}) [1]\n`+top.text.split('\n').slice(1,6).join('\n'); }
  if(mode==='staff') a+='\n※ 오프라인 시연 모드 — 모델 연결 시 위 근거를 바탕으로 자연어 답변으로 정리됩니다.';
  return a;
}

/* ───────── 5. 직원용 채팅 ───────── */
function chipsHtml(list,n){ return `<div class="chips inbub">${list.slice(0,n).map(t=>`<button class="chip" data-q="${t.replace(/"/g,'&quot;')}">${t}</button>`).join('')}</div>`; }
document.addEventListener('click',e=>{ const c=e.target.closest('.bub .chip, .k-bub .chip'); if(!c) return; if(S.mode==='staff'){ $('#q').value=c.dataset.q; $('#form').requestSubmit(); } else { $('#kq').value=c.dataset.q; $('#kform').requestSubmit(); } });
function resetChat(){ S.hist=[]; S.lastAnswer=null; S.lastCites=[]; $('#msgs').innerHTML=''; addMsg('ai',`안녕하세요, 달성군 AI 업무비서 <b>달성On</b>입니다.\n지금 연결된 자료: 자치법규 ${S.meta.law_sources.length}건(${S.meta.counts.law}조문) · 민원안내 ${S.meta.counts.minwon}건 · 공공데이터 ${S.meta.datasets.length}종 ${S.meta.counts.data.toLocaleString()}행 · 내부지침 ${S.meta.counts.internal}건(직원 전용)\n<b>시연판이라 위 자료 범위 안의 질문에 답합니다.</b> 아래 예시를 눌러 보세요.\n`+chipsHtml(CHIPS.staff,6)+`\n<small>답변을 <b>달성군 서식 한글 파일</b>로 바로 만들 수 있습니다 ★</small>`,{html:true}); $('#btnHwpx').disabled=true; renderEv([]); }
function addMsg(role,text,{html=false,tag=null}={}){
  const m=document.createElement('div'); m.className='msg '+(role==='user'?'user':'ai');
  m.innerHTML=`<div class="av">${role==='user'?'나':'On'}</div><div class="bub"></div>`; const b=m.querySelector('.bub');
  if(html) b.innerHTML=text; else b.textContent=text;
  $('#msgs').appendChild(m); $('#msgs').scrollTop=1e9; return b;
}
function fmt(text){ // 인용 [n] → 클릭 가능 배지, ■ 강조
  return text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/\[(\d+)\]/g,'<span class="cite" data-n="$1">$1</span>').replace(/^(■.*)$/gm,'<b>$1</b>');
}
$('#form').onsubmit=async e=>{ e.preventDefault(); const q=$('#q').value.trim(); if(!q||S.busy) return; $('#q').value=''; await ask(q); };
$('#q').onkeydown=e=>{ if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); $('#form').requestSubmit(); } };
$('#btnClear').onclick=resetChat;
async function ask(q){
  S.busy=true; $('#btnSend').disabled=true; addMsg('user',q); S.stats.q++;
  const filter=d=>{ if(d.type==='internal') return S.layers[2]; return S.layers[1]; };
  let hits=rerank(q,search(q,{filter,k:8})); const ci=countIntent(q); if(hits.length&&hits[0].score<12&&!ci) hits=[]; if(ci){ const agg=S.docs.find(d=>d.source===ci.ds&&d.title.endsWith('읍면별 집계')); if(agg&&!hits.some(h=>h.doc===agg)) hits.unshift({doc:agg,score:99}); }
  renderEv(hits); S.lastCites=hits; S.lastQ=q; hits.forEach(h=>{S.stats.hits[h.doc.title]=(S.stats.hits[h.doc.title]||0)+1;});
  const b=addMsg('ai','<span class="typing"><i></i><i></i><i></i></span>',{html:true}); let text='';
  try{
    if(S.key&&!S.offline){ text=await callModel('staff',hits,q,S.hist,t=>{ b.innerHTML=fmt(t); $('#msgs').scrollTop=1e9; }); }
    else { await new Promise(r=>setTimeout(r,650)); text=offlineAnswer('staff',hits,q); }
  }catch(err){ text='⚠ '+err.message+'\n설정(⚙)에서 API 키·모델을 확인하세요. 키가 없으면 오프라인 시연 모드로 동작합니다.'; }
  const rag=/\[\d+\]/.test(text)&&!/자료에 없는 내용/.test(text); S.stats[rag?'cite':'gen']++;
  const sug=text.includes('@@SUGGEST@@'); text=text.replace('\n@@SUGGEST@@',''); b.innerHTML=`<span class="tag ${rag?'rag':'gen'}">${rag?'📎 달성군 자료 근거':'🤖 AI 일반 답변'}</span>\n`+fmt(text)+(sug?'\n<small>이런 질문은 지금 바로 가능합니다:</small>'+chipsHtml(CHIPS.staff.filter(()=>true).sort(()=>Math.random()-.5),4):'')+`<div class="actions"><button data-act="hwpx">📄 한글 파일로</button><button data-act="copy">복사</button></div>`;
  b.onclick=ev=>{ const c=ev.target.closest('.cite'); if(c){ hlEv(+c.dataset.n); return; } const a=ev.target.dataset.act; if(a==='copy'){ navigator.clipboard.writeText(text); toast('복사했습니다'); } if(a==='hwpx') openHwpx(); };
  S.hist.push({role:'user',content:q},{role:'assistant',content:text}); S.lastAnswer=text; $('#btnHwpx').disabled=false; $('#hwpxNote').textContent='마지막 답변: "'+q.slice(0,28)+(q.length>28?'…':'')+'"';
  S.busy=false; $('#btnSend').disabled=false; $('#msgs').scrollTop=1e9;
}

/* ───────── 6. 근거 카드 ───────── */
function renderEv(hits){
  const el=$('#ev'); el.innerHTML=''; $('#evNote').textContent=hits.length?`${hits.length}건 검색됨 · 번호를 누르면 원문`:'질문하면 검색된 근거가 표시됩니다';
  if(!hits.length){ el.innerHTML='<div class="ev-empty">아직 검색된 근거가 없습니다</div>'; return; }
  hits.forEach((h,i)=>{ const d=h.doc, c=document.createElement('div'); c.className='evc'; c.dataset.n=i+1;
    c.innerHTML=`<div class="h"><span class="num">${i+1}</span><span class="ty ${d.type}">${typeName(d.type)}${d.access==='staff'?' · 직원 전용':''}</span><span class="sc">관련도 ${h.score.toFixed(1)}</span></div><b>${d.title}</b><p>${d.text.replace(/</g,'&lt;')}</p>`;
    c.onclick=()=>c.classList.toggle('open'); el.appendChild(c); });
}
function hlEv(n){ $$('.evc').forEach(c=>c.classList.toggle('hl',+c.dataset.n===n)); const c=$(`.evc[data-n="${n}"]`); if(c){ c.classList.add('open'); c.scrollIntoView({behavior:'smooth',block:'center'}); } }

/* ───────── 7. 군민용 카카오 채널 ───────── */
const KQUICK=['대형폐기물 배출','전입신고','출산지원금','종량제봉투 가격','경로당 찾기','도서관 시간','신고·접수'];
function resetKakao(){ S.khist=[]; S.kLastCites=[]; $('#kmsgs').innerHTML=''; kmsg('bot','안녕하세요! 달성군 민원안내 챗봇입니다 😊\n민원 절차·필요 서류·수수료, 경로당·도서관·종량제봉투 판매소 위치를 안내해 드려요.\n\n아래 버튼을 누르거나 궁금한 점을 입력해 주세요.'); const el=$('#kquick'); el.innerHTML=''; KQUICK.forEach(t=>{const b=document.createElement('button'); b.textContent=t; b.onclick=()=>{$('#kq').value=t; $('#kform').requestSubmit();}; el.appendChild(b);}); }
function kmsg(who,text,{card=null,link=null}={}){
  const r=document.createElement('div'); r.className='k-row '+(who==='me'?'me':''); const now=new Date(); const tm=`${now.getHours()<12?'오전':'오후'} ${now.getHours()%12||12}:${String(now.getMinutes()).padStart(2,'0')}`;
  if(who==='me') r.innerHTML=`<div class="k-bub"></div><span class="k-time">${tm}</span>`;
  else r.innerHTML=`<div class="k-av">달성</div><div><div class="k-name">달성군 민원안내</div><div class="k-bub"></div></div><span class="k-time">${tm}</span>`;
  const b=r.querySelector('.k-bub'); b.textContent=text;
  if(card) b.insertAdjacentHTML('beforeend',`<div class="k-card"><b>📎 근거</b>${card}</div>`);
  if(link) b.insertAdjacentHTML('beforeend',`<a class="k-link" href="${link.href}" target="_blank" rel="noopener">${link.label}</a>`);
  $('#kmsgs').appendChild(r); $('#kmsgs').scrollTop=1e9; return b;
}
$('#kform').onsubmit=async e=>{ e.preventDefault(); const q=$('#kq').value.trim(); if(!q||S.busy) return; $('#kq').value=''; await kask(q); };
async function kask(q){
  S.busy=true; kmsg('me',q); S.stats.q++;
  let hits=rerank(q,search(q,{filter:d=>d.access==='public',k:6})); const ci=countIntent(q); if(hits.length&&hits[0].score<12&&!ci) hits=[]; if(ci){ const agg=S.docs.find(d=>d.source===ci.ds&&d.title.endsWith('읍면별 집계')); if(agg&&!hits.some(h=>h.doc===agg)) hits.unshift({doc:agg,score:99}); }
  renderEv(hits); S.kLastCites=hits; hits.forEach(h=>{S.stats.hits[h.doc.title]=(S.stats.hits[h.doc.title]||0)+1;});
  const b=kmsg('bot',''); b.innerHTML='<span class="k-typing"><i></i><i></i><i></i></span>'; let text='';
  try{ if(S.key&&!S.offline) text=await callModel('citizen',hits,q,S.khist,t=>{ b.textContent=t.replace(/\[\d+\]/g,''); }); else { await new Promise(r=>setTimeout(r,700)); text=offlineAnswer('citizen',hits,q).replace(/※ 오프라인.*$/m,'').trim(); } }
  catch(err){ text='죄송합니다, 잠시 후 다시 시도해 주세요. ('+err.message.slice(0,60)+')'; }
  const rag=/\[\d+\]/.test(text); S.stats[rag?'cite':'gen']++;
  const shown=text.replace(/\[\d+\]/g,'').replace(/\n{3,}/g,'\n\n');
  const top=hits[0]?.doc; const card=hits.filter((h,i)=>i===0||h.score>=hits[0].score*.9).slice(0,2).map(h=>`<div>${h.doc.title.replace('대구광역시 달성군 ','')}</div>`).join('');
  let link=null; if(top?.type==='minwon') link={href:top.link||'https://www.gov.kr',label:'정부24·국민신문고에서 접수하기'}; else if(top?.type==='data'&&/(경로당|판매소|도서관)/.test(top.source)&&!top.title.endsWith('읍면별 집계')) link={href:'https://map.kakao.com/?q='+encodeURIComponent('달성군 '+(top.title||'')),label:'카카오맵에서 위치 보기'};
  b.textContent=shown; if(!hits.length||!rag) b.insertAdjacentHTML('beforeend',chipsHtml(CHIPS.citizen,4)); if(rag&&card) b.insertAdjacentHTML('beforeend',`<div class="k-card"><b>📎 근거</b>${card}</div>`); if(link) b.insertAdjacentHTML('beforeend',`<a class="k-link" href="${link.href}" target="_blank" rel="noopener">${link.label}</a>`);
  S.khist.push({role:'user',content:q},{role:'assistant',content:text}); S.busy=false; $('#kmsgs').scrollTop=1e9;
}

/* ───────── 8. 한글(hwpx) 생성 ───────── */
function openHwpx(){ if(!S.lastAnswer) return; const q=S.lastQ; $('#hTitle').value=q.replace(/[?？.]/g,'').replace(/(은|는|이|가|을|를|요|야|뭐야|어떻게 돼|알려줘)$/,'').trim().slice(0,40)+' 검토'; $('#hSub').value='달성군 AI 업무비서(달성On) 생성 초안'; $('#mHwpx').hidden=false; }
$('#btnHwpx').onclick=openHwpx;
$('#btnHwpxGo').onclick=async()=>{
  const kind=$('#docKind').value; const btn=$('#btnHwpxGo'); btn.disabled=true; btn.textContent='생성 중…';
  try{ const blob=await DalseongHwpx.build({title:$('#hTitle').value,sub:$('#hSub').value,date:$('#hDate').value,kind,question:S.lastQ,answer:S.lastAnswer,cites:S.lastCites.map(h=>({title:h.doc.title,source:h.doc.source})),includeCites:$('#hCite').checked});
    const name=`달성On_${{review:'검토보고',pumui:'품의서',memo:'업무연락'}[kind]}_${new Date().toISOString().slice(0,10).replace(/-/g,'')}.hwpx`; DalseongHwpx.download(blob,name); S.stats.hwpx++; $('#mHwpx').hidden=true; toast('한글 파일이 생성되었습니다: '+name); }
  catch(e){ toast('생성 실패: '+e.message); }
  btn.disabled=false; btn.textContent='생성 · 다운로드';
};

/* ───────── 9. 설정·관리자·모달 ───────── */
$('#btnSet').onclick=()=>$('#mSet').hidden=false;
$('#btnTheme').onclick=()=>{ const l=document.body.dataset.theme!=='light'; document.body.dataset.theme=l?'light':'dark'; $('#btnTheme').textContent=l?'🌙':'☀️'; try{localStorage.setItem('dOnTheme',l?'light':'dark');}catch(e){} };
try{ const th=localStorage.getItem('dOnTheme'); if(th){ document.body.dataset.theme=th; $('#btnTheme').textContent=th==='light'?'🌙':'☀️'; } }catch(e){}
$('#btnAdmin').onclick=()=>{ $('#kQ').textContent=S.stats.q; $('#kCite').textContent=S.stats.cite; $('#kGen').textContent=S.stats.gen; $('#kHwpx').textContent=S.stats.hwpx; $('#adminModel').textContent=(S.key&&!S.offline)?S.model+' (Anthropic API, 브라우저 직접 호출 — 시연)':'오프라인 시연 모드(검색 결과 기반)';
  const top=Object.entries(S.stats.hits).sort((a,b)=>b[1]-a[1]).slice(0,8); $('#topDocs').innerHTML=top.length?top.map(([t,n])=>`<li>${t.replace('대구광역시 달성군 ','')} <small>(${n})</small></li>`).join(''):'<li class="muted">아직 질의가 없습니다</li>'; $('#mAdmin').hidden=false; };
$$('[data-close]').forEach(b=>b.onclick=()=>b.closest('.modal').hidden=true);
$$('.modal').forEach(m=>m.onclick=e=>{ if(e.target===m&&m.id!=='mIntro') m.hidden=true; });
function updPill(){ const on=S.key&&!S.offline; $('#pillModel').classList.toggle('on',!!on); $('#pillTxt').textContent=on?`모델 연결: ${S.model}`:'오프라인 시연 모드'; }
$('#apiKey').oninput=e=>{ S.key=e.target.value.trim(); updPill(); };
$('#model').oninput=e=>{ S.model=e.target.value.trim()||'claude-sonnet-4-5'; updPill(); };
$('#offline').onchange=e=>{ S.offline=e.target.checked; updPill(); };

init().catch(e=>{ addMsg('ai','자료 색인을 불러오지 못했습니다: '+e.message); });
})();
