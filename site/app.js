/* 달성On 시연판 — 앱 로직 v2
 * 구조: [자료 색인 index.json] → [브라우저 내 BM25 검색] → [답변 모델(Anthropic API) 또는 오프라인 구성] → [근거 카드·한글 생성]
 * 화면: 상단 대분류 탭 → 좌측 기능 메뉴 → 메인(기능 화면) + 우측 AI 대화. 기능 추가는 NAV 배열 + <section class="view"> 추가.
 * 실제 구축 시 검색·모델 호출은 업무망 서버로 이동하며 브라우저에는 키를 두지 않는다. */
(function(){
'use strict';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const S={ mode:'home', view:'home', ds:0, docs:[], meta:null, idx:null, layers:{1:true,2:true}, key:'', code:(localStorage.getItem('dOnCode')||''), model:'claude-sonnet-4-5', offline:false, server:false,
          hist:[], lastAnswer:null, lastCites:[], lastQ:'', stats:{q:0,cite:0,gen:0,hwpx:0,hits:{}}, busy:false, khist:[] };
try{ const hh=JSON.parse(localStorage.getItem('dOnHits')||'{}'); if(hh&&typeof hh==='object') S.stats.hits=hh; }catch(e){}
function saveHits(){ try{ localStorage.setItem('dOnHits',JSON.stringify(S.stats.hits)); }catch(e){} }

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
  docs.forEach((d,i)=>{ const t=tok(d.title+' '+((d.type==='minwon'||d.type==='internal')?d.title+' ':'')+d.text); const m=new Map(); t.forEach(x=>m.set(x,(m.get(x)||0)+1)); tf[i]=m; len[i]=t.length; total+=t.length; for(const k of m.keys()) df.set(k,(df.get(k)||0)+1); });
  return {N,df,tf,len,avg:total/N};
}
const EUP=['화원읍','논공읍','다사읍','유가읍','옥포읍','현풍읍','가창면','하빈면','구지면'];
const STOP=new Set(['대구광역시','달성군','조례','규칙','일부개정조례','일부개정규칙','관리','운영','관한','지원','사무의','대한','등의','일부','개정']);
function srcBoost(q){ // 질문에 조례 고유 명칭(파크골프장, 거리공연 …)이 있으면 해당 자치법규 우선
  const hit=new Set(); for(const src of S.meta.law_sources){ for(const w of src.split(/[\s·]+/)){ if(w.length>=3&&!STOP.has(w)&&q.includes(w.slice(0,3))) hit.add(src); } } return hit;
}
function search(q,{filter,k=6}={}){
  const {N,df,tf,len,avg}=S.idx, qt=[...new Set(tok(q))], K1=1.0,B=0.35, sc=new Float32Array(N), boost=srcBoost(q), eup=EUP.find(x=>q.includes(x));
  for(const t of qt){ const n=df.get(t); if(!n) continue; const idf=Math.log(1+(N-n+.5)/(n+.5)); const w=t.startsWith('W:')?2.2:1;
    for(let i=0;i<N;i++){ const f=tf[i].get(t); if(!f) continue; sc[i]+=w*idf*(f*(K1+1))/(f+K1*(1-B+B*len[i]/avg)); } }
  const res=[]; for(let i=0;i<N;i++){ if(sc[i]>0 && (!filter||filter(S.docs[i]))){ let v=sc[i]; if(S.docs[i].title.endsWith('(개정문)')) v*=0.45; if(boost.size&&S.docs[i].type==='law') v*=boost.has(S.docs[i].source)?1.8:0.6; if(eup){ v*=(S.docs[i].type==='data'&&S.docs[i].eup===eup)?2.2:0.7; } res.push([v,i]); } }
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
/* 생활어 → 자료 용어 (군민 질문 대응) */
const SYN=[[/버려|버리|버릴|버림/g,'배출 버려'],[/사요|살 수|살수|삽니까|구입/g,'판매소 구입'],[/운영시간|몇 ?시/g,'운영 시각 시간'],[/얼마(예요|야|인가요)?/g,'가격 수수료 얼마'],[/신고는 어디|어디서 (하|신고)/g,'신고 접수']];
function expand(q){ let e=q; SYN.forEach(([r,t])=>{ if(r.test(q)) e+=' '+t; }); return e; }
const GEN=new Set(['어떻게','무엇','뭐','뭐야','뭐예요','알려','알려줘','알려주세요','방법','절차','필요','서류','가격','얼마','어디','어디서','누구','언제','해줘','해주세요','하나요','하죠','되나요','내용','대상','기준','규정','근거','있어','있나요','싶어','원해','좀','관련','달성군','대구광역시']);
/* 상위 결과가 질문의 핵심어를 실제로 담고 있는지 확인 — 없으면 '자료 없음'으로 처리 */
function relevant(q,hits){ if(!hits.length) return false; if(hits[0].score>=12) return true; const qw=tok(q).filter(t=>t.startsWith('W:')&&t.length>=4&&!GEN.has(t.slice(2))); if(!qw.length) return false; const tf=S.idx.tf[S.docs.indexOf(hits[0].doc)]; return qw.some(w=>tf.has(w)); }
/* 읍면 + 시설 개소 수 질의는 색인 통계로 정확히 계산 */
function countIntent(q){
  const e=EUP.find(x=>q.includes(x)); const ds=[['경로당','경로당 현황'],['판매소','종량제봉투 판매소'],['봉투 파는','종량제봉투 판매소'],['도서관','도서관']].find(([w])=>q.includes(w));
  if(!ds||!/(몇|개소|몇개|몇 개|갯수|개수|얼마나|현황)/.test(q)) return null;
  const rows=S.docs.filter(d=>d.type==='data'&&d.source===ds[1]&&!d.title.endsWith('읍면별 집계'));
  const sub=e?rows.filter(d=>d.eup===e):rows; return {eup:e,ds:ds[1],n:sub.length,total:rows.length,sample:sub.slice(0,5)};
}

/* ───────── 4. 답변 모델 호출 ───────── */
function sysPrompt(mode){
  const base=`당신은 대구광역시 달성군의 AI 업무비서 "달성On"입니다. 오늘은 ${new Date().toLocaleDateString('ko-KR')}입니다.
아래 <자료>는 달성군 자치법규·민원안내·공공데이터·내부지침에서 검색된 근거입니다. 규칙:
1. 자료에 근거가 있으면 반드시 해당 문장 끝에 [번호]로 인용하고, 조례는 「조례명」 제N조 형태로 명시합니다.
2. 자료에 없는 내용은 첫 줄에 "※ 달성군 자료에 없는 내용으로 일반 지식으로 답변합니다."라고 밝힌 뒤 답하고, 없는 근거를 만들지 않습니다.
3. 숫자·수수료·개소 수는 자료의 값을 그대로 쓰고 추정하지 않습니다.
4. 한국어, 간결하게. 핵심 결론을 먼저 쓰고 필요한 경우만 ■(항목) ❍(내용) -(설명) 기호로 구조화합니다. 마크다운 표·헤더(#)는 쓰지 않습니다.`;
  return base+`
5. 지금은 직원용 업무망 화면입니다. 담당 직원이 바로 공문·품의에 옮겨 쓸 수 있는 문장으로 답하고, 관련 절차·결재선·유의사항을 덧붙입니다.`;
}
function ctxBlock(hits){ return '<자료>\n'+hits.map((h,i)=>`[${i+1}] (${typeName(h.doc.type)}) ${h.doc.title}\n${h.doc.text.slice(0,1400)}`).join('\n\n')+'\n</자료>'; }

async function callModel(mode,hits,q,hist,onDelta){
  const msgs=[...hist.slice(-6), {role:'user',content:ctxBlock(hits)+'\n\n질문: '+q}];
  const payload=JSON.stringify({model:S.model,max_tokens:1200,stream:true,system:sysPrompt(mode),messages:msgs});
  const r=S.key
    ? await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'content-type':'application/json','x-api-key':S.key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},body:payload})
    : await fetch('/api/chat',{method:'POST',headers:{'content-type':'application/json','x-access-code':S.code||''},body:payload});
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
  if(!hits.length) return '※ 달성군 자료에 없는 내용입니다. 시연판은 연결된 자료(조례 7건·민원안내·공공데이터 6종·내부지침) 범위 안에서 답하며, 실제 구축 시에는 자료 밖 질문도 AI가 직접 답변합니다.\n@@SUGGEST@@';
  const top=hits[0].doc; let a='';
  if(top.type==='law'){ const art=top.title.replace(top.source,'').trim(); a=`■ 「${top.source.replace('대구광역시 ','')}」 ${art} [1]\n`; let lines=top.text.split('\n').map(l=>l.trim()).filter(Boolean); if(art.startsWith('[별표')) lines=lines.slice(1).filter(l=>l.length>8||/:/.test(l)); a+=lines.slice(0,art.startsWith('[별표')?14:7).map(l=>(/^(①|②|③|④|⑤|\d+\.)/.test(l)?'❍ ':'- ')+l).join('\n'); if(lines.length>8&&!art.startsWith('[별표')) a+='\n- (이하 생략 — 근거 카드에서 전문 확인)'; const l2=hits.slice(1,3).filter(h=>h.doc.type==='law'); l2.forEach((h,i)=>a+=`\n- 관련: ${h.doc.title.replace('대구광역시 달성군 ','')} [${i+2}]`); }
  else if(top.type==='minwon'){ const f=Object.fromEntries(top.text.split('\n').slice(1).map(l=>{const i=l.indexOf(': '); return [l.slice(0,i),l.slice(i+2)];})); a=`■ ${top.title} [1]\n❍ 신청 방법: ${f['신청 방법']}\n❍ 필요 서류: ${f['필요 서류']}\n❍ 수수료: ${f['수수료']} / 처리: ${f['처리 기간']}\n❍ 담당: ${f['담당']}`; }
  else if(top.type==='data'){ const same=hits.filter(h=>h.doc.type==='data'&&h.doc.source===top.source).slice(0,4); a=`■ ${top.source} (공공데이터, 기준일 2026-09-08)\n`+same.map(h=>`❍ ${h.doc.text.replace(/^(경로당|종량제봉투 판매소|도서관|대형폐기물 수수료:) /,'')} [${hits.indexOf(h)+1}]`).join('\n'); }
  else { a=`■ ${top.title} (${top.source}) [1]\n`+top.text.split('\n').slice(1,6).join('\n'); }
  if(mode==='staff') a+='\n※ 오프라인 시연 모드 — 모델 연결 시 위 근거를 바탕으로 자연어 답변으로 정리됩니다.';
  return a;
}

/* ═══════════════ 화면 구성 ═══════════════
 * 구조: 상단 대분류 탭(MODES) → 좌측 기능 메뉴(NAV) → 메인(view) + 우측 AI 대화
 * 기능 추가 = NAV 배열에 항목 추가 + index.html에 <section class="view" data-view="id"> 추가 + render 함수 등록 */
const MODES=[
  {id:'home',   icon:'🏠', label:'달성On', sub:'한눈에 보기', cls:''},
  {id:'staff',  icon:'🏛', label:'직원용 달성On', sub:'업무망 · 새올 배너', cls:''},
  {id:'admin',  icon:'🛠', label:'관리자', sub:'정보통신과', cls:'admin'},
];
const NAV={
  home:[
    {id:'home',   icon:'🏠', label:'대시보드', sub:'현황 · 바로가기'},
    {id:'flow',   icon:'🧭', label:'서비스 구성', sub:'구조 · 차별점'},
    {id:'guide',  icon:'📖', label:'이용 안내', sub:'3단계 시작하기'},
    {id:'news',   icon:'📢', label:'공지 · 업데이트', sub:'자료 갱신 이력'},
    {id:'contact',icon:'☎️', label:'문의 · 지원', sub:'정보통신과'},
  ],
  staff:[
    {id:'qa',   icon:'💬', label:'AI 질의응답', sub:'근거 조문과 함께 답변'},
    {id:'doc',  icon:'📄', label:'한글 문서 생성', sub:'군 서식 hwpx ★'},
    {id:'lib',  icon:'📚', label:'자료함', sub:'연결 자료 · 층 구조'},
    {id:'data', icon:'📊', label:'데이터 조회', sub:'읍·면별 집계'},
  ],
  admin:[
    {id:'stats', icon:'📈', label:'이용 통계', sub:'질의 · 인용 · 문서'},
    {id:'update',icon:'🔄', label:'자료 갱신', sub:'한 번 등록 → 전 직원'},
    {id:'model', icon:'🤖', label:'모델 설정', sub:'API 키 · 온AI 전환'},
  ],
};
const CHIPS={staff:['거리공연 지원사업 내용과 조례 근거는?','다사읍 경로당은 몇 개소야?','체육시설 사용료 감면 대상과 감면율은?','연가 2일 신청하면 결재선이 어떻게 돼?','수의계약 1인 견적 가능 한도는?','급식시설 환경개선 지원 대상과 내용은?','악성민원 조례에서 민원상담 권장 시간 규정은?','국민체육센터 위치와 주요 시설은?','소파 카우치 대형폐기물 수수료는?','생성형 AI에 개인정보 넣어도 돼?']};
const DATASETS=[['경로당 현황','경로당'],['종량제봉투 판매소','판매소'],['도서관','도서관'],['대형폐기물 수거수수료','대형폐기물'],['종량제봉투 가격','봉투 가격']];

function typeName(t){ return {law:'자치법규',minwon:'민원안내',data:'공공데이터',internal:'내부지침'}[t]||t; }
function toast(m){ let t=$('#toast'); if(!t){ t=document.createElement('div'); t.id='toast'; document.body.appendChild(t);} t.textContent=m; t.hidden=false; clearTimeout(t._t); t._t=setTimeout(()=>t.hidden=true,2600); }
function chipsHtml(list,n){ return `<div class="chips">${list.slice(0,n).map(t=>`<button class="chip" data-q="${t.replace(/"/g,'&quot;')}">${t}</button>`).join('')}</div>`; }
document.addEventListener('click',e=>{ const c=e.target.closest('.chip[data-q]'); if(!c) return; if(S.mode!=='staff'){ S.mode='staff'; document.body.dataset.mode='staff'; } go('on'); ask(c.dataset.q); });

/* ── 초기화 ── */
async function init(){
  const j=await (await fetch('data/index.json')).json(); S.docs=j.docs; S.meta=j.meta; S.idx=buildIndex(S.docs);
  const c=S.meta.counts; $('#navFoot').textContent=`자료 ${(c.law+c.minwon+c.data+c.internal).toLocaleString()}건 연결 · 기준 ${S.meta.built}`;
  $('#c1').textContent=(c.law+c.minwon+c.data).toLocaleString(); $('#c2').textContent=c.internal;
  renderTabs(); renderNav(); renderLib(); renderAdminSrc(); renderDataSeg(); resetChat(); updPill();
  $('#qaChips').innerHTML=chipsHtml(CHIPS.staff,8).replace('class="chips"','class="chips big"');
  $('#hDate').value=`${new Date().getFullYear()}. ${new Date().getMonth()+1}. ${new Date().getDate()}. / 정보통신과`;
  renderPaper(); go('home'); DalseongHwpx.load().catch(()=>{});
}
/* 좌측 메뉴: 「질문하기」 하나를 주인공으로, 나머지는 조용히. 서브탭 없음(이용 안내·관리자는 한 페이지 세로 구성) */
/* 좌측 메뉴는 두 벌로 완전히 분리
   HOME_MENU : 홈·이용 안내·관리자 등 일반 화면에서 보이는 메뉴 (여기에 항목을 추가해도 달성On 화면에는 나오지 않음)
   달성On 화면 : 달성On 항목 + 새 대화 + 최근 대화만 (고정)                                                       */
const HOME_MENU=[
  {mode:'staff',view:'on', icon:'✦', label:'달성On', cls:'on-item'},
  {mode:'staff',view:'data', icon:'📊', label:'임시메뉴1'},   // 데이터 조회 화면 (이름은 추후 확정)
  {mode:'staff',view:'lib',  icon:'📚', label:'임시메뉴2'},   // 자료함 화면 (이름은 추후 확정)
];
const MINOR=[
  {mode:'home', view:'guide',icon:'📖', label:'이용 안내', cls:'minor'},
  {mode:'admin',view:'stats',icon:'🛠', label:'관리자', cls:'minor admin'},
];
const ON_VIEWS=['on','doc'];   // 이 화면들에서는 달성On 전용 메뉴
const ALIAS={qa:'on',flow:'guide',news:'guide',contact:'guide',update:'stats',model:'stats'};
const COMPOSITE={guide:['guide','flow','news','contact'],stats:['stats','update','model']};
function renderTabs(){}
function loadRecent(){ try{ return JSON.parse(localStorage.getItem('dOnRecent')||'[]'); }catch(e){ return []; } }
function pushRecent(q){ const r=loadRecent().filter(x=>x!==q); r.unshift(q); localStorage.setItem('dOnRecent',JSON.stringify(r.slice(0,12))); }
function renderNav(){
  const inOn=S.mode==='staff'&&ON_VIEWS.includes(S.view);
  const item=n=>{ const on=n.mode==='admin'?S.mode==='admin':(S.mode===n.mode&&S.view===n.view); return `<li data-mode="${n.mode}" data-view="${n.view}" class="${n.cls||''} ${on?'on':''}"><i>${n.icon}</i><b>${n.label}</b></li>`; };
  let html='';
  if(inOn){
    const recent=loadRecent();
    html=item(HOME_MENU.find(n=>n.view==='on'))+`<li class="newchat" id="navNew">＋ 새 대화</li>`
      +(recent.length?`<li class="rh"><span>최근 대화</span><button class="rclear" id="navClear" title="전체 삭제">전체 삭제</button></li>`+recent.map(q=>`<li class="rc" data-q="${q.replace(/"/g,'&quot;')}" title="${q.replace(/"/g,'&quot;')}"><span>${q}</span><button class="rx" data-del="${q.replace(/"/g,'&quot;')}" title="삭제">✕</button></li>`).join(''):'');
  } else html=HOME_MENU.map(item).join('');
  html+=MINOR.map(item).join('');
  $('#nav').innerHTML=html;
  $$('#nav li[data-view]').forEach(li=>li.onclick=()=>{ if(S.mode!==li.dataset.mode){ S.mode=li.dataset.mode; document.body.dataset.mode=S.mode; } go(li.dataset.view); });
  const nn=$('#navNew'); if(nn) nn.onclick=()=>{ S.mode='staff'; document.body.dataset.mode='staff'; resetChat(); go('on'); };
  $$('#nav li.rc').forEach(li=>li.onclick=e=>{ if(e.target.closest('.rx')) return; S.mode='staff'; document.body.dataset.mode='staff'; resetChat(); go('on'); ask(li.dataset.q); });
  $$('#nav .rx').forEach(b=>b.onclick=e=>{ e.stopPropagation(); localStorage.setItem('dOnRecent',JSON.stringify(loadRecent().filter(x=>x!==b.dataset.del))); renderNav(); });
  const nc=$('#navClear'); if(nc) nc.onclick=()=>{ localStorage.removeItem('dOnRecent'); renderNav(); };
}
function setMode(m){ S.mode=m; document.body.dataset.mode=m; go(NAV[m][0].id); }
function go(v){ const target=ALIAS[v]; const top=target||v; S.view=top; document.body.dataset.view=top; const show=COMPOSITE[top]||[top]; $$('.view').forEach(s=>s.classList.toggle('on',show.includes(s.dataset.view))); $('#main').classList.toggle('composite',!!COMPOSITE[top]); renderNav(); if(top==='data') renderData(); if(top==='home') renderHome(); if(top==='guide'){ $('#guideChips').innerHTML=chipsHtml(CHIPS.staff,8); renderNews(); } if(top==='stats'){ renderStats(); updPill(); } if(top==='doc') renderPaper(); if(top==='on'){ $('#qaChips').innerHTML=chipsHtml(CHIPS.staff,3); setTimeout(()=>$('#q').focus(),50); } const el=target?document.querySelector(`.view[data-view="${v}"]`):null; if(el) setTimeout(()=>el.scrollIntoView({behavior:'smooth',block:'start'}),30); else $('#main').scrollTop=0; }

/* ── 홈 대시보드 ── */
document.addEventListener('click',e=>{ const g=e.target.closest('[data-go]'); if(!g) return; const [m,v]=g.dataset.go.split(':'); setMode(m); go(v); });
const PAL=['#2f6fed','#0fa876','#d98a00','#a04ccf'];
function renderHome(){
  $('#heroDate').textContent=new Date().toLocaleDateString('ko-KR',{year:'numeric',month:'long',day:'numeric',weekday:'long'})+' · 정보통신과 시연판';
  const cls={'공지':'notice','자료':'data','기능':''};
  $('#boardList').innerHTML=NEWS.slice(0,5).map(([d,t,s,body],i)=>`<li class="${i<2?'new':''}"><span class="t ${cls[t]||''}">${t}</span><b>${s}</b><span class="d">${d}</span><div class="body">${body||s}</div></li>`).join('');
  $$('#boardList li').forEach(li=>li.onclick=()=>li.classList.toggle('open'));
  const P=$('#player');
  if(VIDEO_FILE){ P.innerHTML=`<video src="${VIDEO_FILE}" poster="assets/intro_poster.jpg" controls playsinline preload="metadata" controlsList="nodownload noplaybackrate" disablePictureInPicture></video>`; $('#videoNote').textContent='29초'; }
  else if(VIDEO_ID){ P.innerHTML=`<iframe src="https://www.youtube-nocookie.com/embed/${VIDEO_ID}?rel=0" title="달성On 안내 영상" referrerpolicy="strict-origin-when-cross-origin" allow="accelerometer; autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`; $('#videoNote').textContent='29초 · 유튜브'; }
  renderUsage();
  $('#diffGrid').innerHTML=[['① 문서 산출','답변을 달성군 서식 한글(hwpx)로 즉시 생성 — 타 도구는 텍스트만'],['② 운영 환경','업무망 자체 서버 · 내부자료 활용 (구글 개인 도구·인터넷망 ✗)'],['③ 지속성','개인 계정이 아닌 군 정보시스템 — 인사이동에도 유지'],['④ 자료 규모','제한 없음 (NotebookLM 50개 · Gem 10개 ✗) · 창구 하나'],['⑤ 범용 AI','자료 밖 질문도 일반 생성형 AI처럼 답변 · 개인 유료 구독 불필요']].map(([b,s])=>`<div class="dg"><b>${b}</b><small>${s}</small></div>`).join('');
}
/* 관리자 › 이용 통계·자료 현황 (KPI · 참조 순위 · 자료 구성 · 자치법규) */
function renderUsage(){
  const c=S.meta.counts, total=c.law+c.minwon+c.data+c.internal;
  $('#homeKpis').innerHTML=[['연결 자료',total.toLocaleString()+'건','4개 유형 · 3층 구조'],['자치법규',S.meta.law_sources.length+'건',c.law+'개 조문·별표'],['공공데이터',S.meta.datasets.length+'종',c.data.toLocaleString()+'행'],['민원 안내',c.minwon+'건','예시 · 홈페이지 기준'],['이번 세션',S.stats.q+'건 질의',`근거 인용 ${S.stats.cite} · 한글 ${S.stats.hwpx}`]].map(([a,b,s])=>`<div class="kpi"><small>${a}</small><b>${b}</b><span class="sub">${s}</span></div>`).join('');
  // 많이 참조된 자료 (누적, 없으면 시연 예시)
  let top=Object.entries(S.stats.hits).sort((x,y)=>y[1]-x[1]).slice(0,8); let note='이용 누적 · 이 브라우저 기준';
  if(!top.length){ note='시연 예시 순위 (질문하면 실제 누적으로 바뀜)'; top=[['대구광역시 달성군 체육시설 관리·운영 조례 일부개정조례 [별표 5] 사용료의 감면(제14조 관련)',42],['연가 신청 및 승인 절차',37],['대형폐기물 배출 신고',31],['수의계약 한도 및 절차',28],['대구광역시 달성군 거리공연 활성화 및 지원 조례 제4조(지원사업)',22],['경로당 현황 읍면별 집계',19],['개인정보 파일 취급 및 외부 반출 금지',15],['종량제봉투 가격',12]]; }
  const mx=top[0][1]; $('#topNote').textContent=note;
  $('#topUsed').innerHTML=top.map(([t,n],i)=>{ const d=S.docs.find(x=>x.title===t); const ty=d?typeName(d.type):''; return `<li><span class="n">${i+1}</span><div><b title="${t}">${t.replace('대구광역시 달성군 ','')}</b><small>${ty}${d&&d.access==='staff'?' · 직원 전용':''}</small></div><span class="bar"><i style="width:${Math.max(24,Math.round(n/mx*90))}px"></i>${n}회</span></li>`; }).join('');
  // 자료 구성 도넛 (출처 기준)
  const parts=[['자치법규',S.meta.law_sources.length,c.law+'개 조문·별표'],['민원안내',c.minwon,'예시 안내'],['공공데이터',S.meta.datasets.length,c.data.toLocaleString()+'행'],['내부지침',c.internal,'직원 전용']]; const psum=parts.reduce((p,x)=>p+x[1],0); let acc=0; const R=54,cx=70,cy=70,circ=2*Math.PI*R;
  let d=`<svg viewBox="0 0 140 140" role="img" aria-label="자료 출처 구성">`; parts.forEach(([n,v],k)=>{ const f=v/psum; d+=`<circle r="${R}" cx="${cx}" cy="${cy}" fill="none" stroke="${PAL[k]}" stroke-width="18" stroke-dasharray="${Math.max(0,f*circ-2)} ${circ}" stroke-dashoffset="${-acc*circ}" transform="rotate(-90 ${cx} ${cy})"><title>${n} ${v}건</title></circle>`; acc+=f; });
  d+=`<text x="${cx}" y="${cy-2}" text-anchor="middle" font-size="18" font-weight="700" fill="currentColor">${psum}</text><text x="${cx}" y="${cy+14}" text-anchor="middle" font-size="10" fill="currentColor" opacity=".6">출처</text></svg>`;
  $('#chartDonut').innerHTML=`<div class="donut-wrap">${d}<ul>${parts.map(([n,v,s],k)=>`<li><span><i style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${PAL[k]};margin-right:6px"></i>${n}<br><small style="margin-left:16px">${s}</small></span><b>${v}건</b></li>`).join('')}</ul></div>`;
  // 최근 자치법규
  $('#lawList').innerHTML=S.meta.law_sources.map(s=>`<li><i></i><div>${s.replace('대구광역시 달성군 ','')}<small>${S.docs.filter(x=>x.source===s).length}개 조문·별표 색인</small></div></li>`).join('');
}

const VIDEO_FILE='assets/intro.mp4';  // 사이트에 직접 넣은 영상(유튜브 오버레이 없음). 비우면 VIDEO_ID 유튜브 사용
const VIDEO_ID='OVZoYQeUFIQ';  // 유튜브 영상 ID를 넣으면 안내 영상이 재생됨, 비우면 포스터 표시
const NEWS=[['2026.09.10','공지','부군수 보고 시연 안내','시연 순서: ① 달성On 홈 → ② 직원용 질의응답·한글 파일 생성 → ③ 관리자 통계. 시연 중 질문은 예시 질문 버튼을 우선 사용해 주세요.'],['2026.09.09','공지','달성On 시연판 이용 안내','시연판은 예시 자료(민원안내 10건·내부지침 5건)를 포함합니다. 답변은 참고용이며 최종 판단은 담당자가 합니다. 문의: 정보통신과 053-668-2454'],['2026.09.09','기능','「달성군」 홈 대시보드 · 이용 안내 · 공지 화면 추가'],['2026.09.09','기능','달성On/직원용/관리자 3개 탭 구조로 개편, 우측 AI 대화 패널'],['2026.09.09','기능','한글 문서 생성 화면(문서 종류 · 서식 미리보기) 신설'],['2026.09.09','자료','민원안내 10건(예시) · 내부지침 5건(예시) 등록'],['2026.09.08','자료','2026.7.10 공포 조례·규칙 7건 색인(24개 조문·별표)'],['2026.09.08','자료','공공데이터 6종 1,107행 연결 (경로당·판매소·도서관·대형폐기물·봉투가격·무료급식소)'],['2026.09.08','기능','달성On 시연판 최초 공개']];
function renderNews(){ $('#newsList').innerHTML=NEWS.map(([d,t,s])=>`<li><span class="d">${d}</span><span class="t">${t}</span>${s}</li>`).join(''); }

/* ── 우측 AI 대화 ── */
function resetChat(){ S.hist=[]; S.lastAnswer=null; S.lastCites=[]; S.lastQ=''; $('#msgs').innerHTML=''; $('#onCol').classList.add('empty'); return;  addMsg('ai',`안녕하세요, <b>달성On</b>입니다. 업무 질문을 입력하세요.\n자료에 있으면 근거 조문을 인용하고, 없으면 AI가 직접 답합니다.\n`+chipsHtml(CHIPS.staff,4),{html:true}); $('#qaRes').hidden=true; $('#qaEmpty').hidden=false; }
function addMsg(role,text,{html=false}={}){ const m=document.createElement('div'); m.className='msg '+(role==='user'?'user':'ai'); m.innerHTML=`<div class="av">${role==='user'?'나':'On'}</div><div class="bub"></div>`; const b=m.querySelector('.bub'); if(html) b.innerHTML=text; else b.textContent=text; $('#msgs').appendChild(m); $('#msgs').scrollTop=1e9; return b; }
function fmt(text){ return text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/\[(\d+)\]/g,'<span class="cite" data-n="$1">$1</span>').replace(/^(■.*)$/gm,'<b>$1</b>'); }
$('#form').onsubmit=async e=>{ e.preventDefault(); const q=$('#q').value.trim(); if(!q||S.busy) return; $('#q').value=''; await ask(q); };
$('#q').onkeydown=e=>{ if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); $('#form').requestSubmit(); } };
$('#btnClear').onclick=resetChat;
$('#btnFold').onclick=()=>{ document.body.dataset.chat='off'; $('#btnUnfold').hidden=false; };
$('#btnUnfold').onclick=()=>{ document.body.dataset.chat='on'; $('#btnUnfold').hidden=true; };
async function ask(q){
  S.busy=true; $('#btnSend').disabled=true; $('#onCol').classList.remove('empty'); addMsg('user',q); S.stats.q++;
  const filter=d=>{ if(d.type==='internal') return S.layers[2]; return S.layers[1]; };
  let hits=rerank(q,search(expand(q),{filter,k:8})); const ci=countIntent(q); if(!ci&&!relevant(q,hits)) hits=[];
  if(ci){ const agg=S.docs.find(d=>d.source===ci.ds&&d.title.endsWith('읍면별 집계')); if(agg&&!hits.some(h=>h.doc===agg)) hits.unshift({doc:agg,score:99}); }
  S.lastCites=hits; S.lastQ=q; hits.forEach(h=>{S.stats.hits[h.doc.title]=(S.stats.hits[h.doc.title]||0)+1;}); saveHits();
  if(S.mode!=='staff'){ S.mode='staff'; document.body.dataset.mode='staff'; } if(S.view!=='on') go('on'); $('#onCol').classList.remove('empty'); pushRecent(q); renderNav(); renderEv($('#ev'),hits); $('#qaEmpty').hidden=true; $('#qaRes').hidden=false; $('#qaQ').textContent=q; $('#evNote').textContent=hits.length?`${hits.length}건 · 카드를 누르면 전문`:'검색된 근거 없음';
  const b=addMsg('ai','<span class="typing"><i></i><i></i><i></i></span>',{html:true}); let text='';
  try{ if((S.key||S.server)&&!S.offline){ text=await callModel('staff',hits,q,S.hist,t=>{ b.innerHTML=fmt(t); $('#msgs').scrollTop=1e9; }); } else { await new Promise(r=>setTimeout(r,600)); text=offlineAnswer('staff',hits,q); } }
  catch(err){ text='⚠ '+err.message+'\n관리자 › 모델 설정에서 API 키·모델을 확인하세요.'; }
  const sug=text.includes('@@SUGGEST@@'); text=text.replace('\n@@SUGGEST@@','');
  const rag=/\[\d+\]/.test(text)&&!/자료에 없는 내용/.test(text); S.stats[rag?'cite':'gen']++;
  $('#qaTag').className='tag '+(rag?'rag':'gen'); $('#qaTag').textContent=rag?'📎 달성군 자료 근거':'🤖 AI 일반 답변';
  b.innerHTML=`<span class="tag ${rag?'rag':'gen'}">${rag?'📎 달성군 자료 근거':'🤖 AI 일반 답변'}</span>\n`+fmt(text)+(sug?'\n<small>이런 질문은 지금 바로 가능합니다:</small>'+chipsHtml([...CHIPS.staff].sort(()=>Math.random()-.5),4):'')+(hits.length?`<div class="src"><b>📎 근거 자료 ${hits.length}건</b>${hits.slice(0,3).map((h,i)=>`<div>[${i+1}] ${h.doc.title.replace('대구광역시 달성군 ','')}</div>`).join('')}${hits.length>3?`<div class="more">외 ${hits.length-3}건 — 근거 원문 보기</div>`:''}</div>`:'')+`<div class="actions"><button data-act="hwpx" class="p">📄 한글 파일로</button><button data-act="copy">복사</button>${hits.length?'<button data-act="ev">근거 원문 보기</button>':''}</div><div class="ev inline" hidden></div>`;
  const evBox=b.querySelector('.ev.inline'); if(hits.length) renderEv(evBox,hits);
  b.onclick=ev=>{ const c=ev.target.closest('.cite'); if(c){ evBox.hidden=false; $$('.evc',evBox).forEach(x=>x.classList.toggle('hl',+x.dataset.n===+c.dataset.n)); const t=evBox.querySelector(`.evc[data-n="${c.dataset.n}"]`); if(t){ t.classList.add('open'); t.scrollIntoView({behavior:'smooth',block:'center'}); } return; } const a=ev.target.dataset.act; if(a==='copy'){ navigator.clipboard.writeText(text); toast('복사했습니다'); } if(a==='hwpx'){ fillDoc(); go('doc'); } if(a==='ev'){ evBox.hidden=!evBox.hidden; } };
  S.hist.push({role:'user',content:q},{role:'assistant',content:text}); S.lastAnswer=text;
  S.busy=false; $('#btnSend').disabled=false; $('#msgs').scrollTop=1e9;
}
$('#qaToDoc').onclick=()=>{ fillDoc(); go('doc'); };
$('#qaCopy').onclick=()=>{ if(S.lastAnswer){ navigator.clipboard.writeText(S.lastAnswer); toast('복사했습니다'); } };

/* ── 근거 카드 ── */
function renderEv(el,hits){
  el.innerHTML=''; if(!hits.length){ el.innerHTML='<div class="ev-empty">검색된 근거가 없습니다 — 자료 밖 질문은 AI가 일반 지식으로 답합니다</div>'; return; }
  hits.forEach((h,i)=>{ const d=h.doc, c=document.createElement('div'); c.className='evc'; c.dataset.n=i+1;
    c.innerHTML=`<div class="h"><span class="num">${i+1}</span><span class="ty ${d.type}">${typeName(d.type)}${d.access==='staff'?' · 직원 전용':''}</span><span class="sc">관련도 ${h.score.toFixed(1)}</span></div><b>${d.title}</b><p>${d.text.replace(/</g,'&lt;')}</p>`;
    c.onclick=()=>c.classList.toggle('open'); el.appendChild(c); });
}
function hlEv(n){ $$('#ev .evc').forEach(c=>c.classList.toggle('hl',+c.dataset.n===n)); const c=$(`#ev .evc[data-n="${n}"]`); if(c){ c.classList.add('open'); c.scrollIntoView({behavior:'smooth',block:'center'}); } }

/* ── 한글 문서 생성 ── */
function fillDoc(){ if(!S.lastAnswer) return; $('#hQ').value=S.lastQ; $('#hTitle').value=S.lastQ.replace(/[?？.]/g,'').replace(/(은|는|이|가|을|를|요|야|뭐야|어떻게 돼|알려줘)$/,'').trim().slice(0,40)+' 검토'; $('#hBody').value=S.lastAnswer.split('\n').filter(l=>!/오프라인 시연 모드/.test(l)).join('\n'); renderPaper(); }
$('#hFill').onclick=()=>{ if(!S.lastAnswer) toast('아직 답변이 없습니다 — 오른쪽 대화창에 먼저 질문하세요'); fillDoc(); };
['#hTitle','#hSub','#hDate','#hQ','#hBody','#docKind','#hCite'].forEach(s=>{ $(s).addEventListener('input',renderPaper); $(s).addEventListener('change',renderPaper); });
function renderPaper(){
  const kind=$('#docKind').value, title=$('#hTitle').value||'(제목)', body=$('#hBody').value, q=$('#hQ').value;
  const head={review:['검토 배경','검토 내용'],pumui:['품의 개요','검토 내용'],memo:['업무 연락','회신 내용']}[kind];
  let h=`<div class="pt">${esc(title)}</div><div class="ps">${esc($('#hSub').value)}</div><div class="pd">${esc($('#hDate').value)}</div>`;
  h+=`<div class="sec">■ ${head[0]}</div><div class="sq">□ ${esc(q||'(검토 요청 사항)')}</div><div class="sec">■ ${head[1]}</div>`;
  body.split('\n').forEach(raw=>{ const s=raw.replace(/\[\d+\]/g,'').trim(); if(!s) return;
    if(/^(■|□)/.test(s)) h+=`<div class="sq">□ ${esc(s.replace(/^(■|□)\s?/,''))}</div>`;
    else if(/^(❍|○|•|\*|-)\s/.test(s)&&/^\s{2,}/.test(raw)) h+=`<div class="dash">- ${esc(s.replace(/^(❍|○|•|\*|-)\s/,''))}</div>`;
    else if(/^-\s/.test(s)) h+=`<div class="dash">- ${esc(s.slice(2))}</div>`;
    else if(/^(❍|○|•|\*)\s/.test(s)) h+=`<div class="cir">❍ ${esc(s.replace(/^(❍|○|•|\*)\s/,''))}</div>`;
    else if(/^(·|◦)\s/.test(s)) h+=`<div class="dot">· ${esc(s.slice(2))}</div>`;
    else if(/^※/.test(s)) h+=`<div class="note">${esc(s)}</div>`;
    else h+=`<div class="cir">❍ ${esc(s)}</div>`; });
  if($('#hCite').checked&&S.lastCites.length) h+=`<div class="sec">■ 근거 자료</div>`+S.lastCites.map((c,i)=>`<div class="cir">❍ [${i+1}] ${esc(c.doc.title)}</div>`).join('');
  h+=`<div class="note">※ 본 문서는 달성군 AI 업무비서(달성On)가 초안을 생성한 것으로, 담당자 검토 후 사용합니다.</div>`;
  $('#paper').innerHTML=h;
}
const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;');
$('#btnHwpxGo').onclick=async()=>{
  const btn=$('#btnHwpxGo'); if(!$('#hBody').value.trim()){ toast('본문이 비어 있습니다'); return; } btn.disabled=true; btn.textContent='생성 중…';
  try{ const kind=$('#docKind').value; const blob=await DalseongHwpx.build({title:$('#hTitle').value||'검토보고',sub:$('#hSub').value,date:$('#hDate').value,kind,question:$('#hQ').value,answer:$('#hBody').value,cites:S.lastCites.map(h=>({title:h.doc.title,source:h.doc.source})),includeCites:$('#hCite').checked});
    const name=`달성On_${{review:'검토보고',pumui:'품의서',memo:'업무연락'}[kind]}_${new Date().toISOString().slice(0,10).replace(/-/g,'')}.hwpx`; DalseongHwpx.download(blob,name); S.stats.hwpx++; toast('한글 파일 생성: '+name); }
  catch(e){ toast('생성 실패: '+e.message); }
  btn.disabled=false; btn.textContent='한글 파일 생성 · 다운로드';
};

/* ── 자료함 ── */
function renderLib(){
  const t=$('#libTbl'); const rows=[];
  S.meta.law_sources.forEach(s=>rows.push(['law',s.replace('대구광역시 달성군 ',''),S.docs.filter(d=>d.source===s).length+'조문','2026.7.10 공포','공개']));
  rows.push(['minwon','민원 안내(예시 10건)',S.meta.counts.minwon+'건','홈페이지·정부24 기준','공개']);
  S.meta.datasets.forEach(d=>rows.push(['data',d.name,d.rows.toLocaleString()+'행','2026.9.8 기준','공개']));
  [...new Set(S.docs.filter(d=>d.type==='internal').map(d=>d.source))].forEach(s=>rows.push(['internal',s,'1건','예시','직원 전용']));
  t.innerHTML='<tr><th>구분</th><th>자료</th><th class="r">규모</th><th>기준</th><th>공개</th></tr>'+rows.map(r=>`<tr><td><span class="ty-badge">${typeName(r[0])}</span></td><td>${r[1]}</td><td class="r">${r[2]}</td><td><small>${r[3]}</small></td><td><small>${r[4]}</small></td></tr>`).join('');
  $('#layers').onclick=e=>{ const li=e.target.closest('.lc'); if(!li||li.classList.contains('lock')) return; const n=li.dataset.layer; S.layers[n]=!S.layers[n]; li.classList.toggle('on',S.layers[n]); toast((S.layers[n]?'참조 포함: ':'참조 제외: ')+li.querySelector('b').textContent); };
}

/* ── 데이터 조회 ── */
function renderDataSeg(){ $('#dsSeg').innerHTML=DATASETS.map((d,i)=>`<button data-i="${i}" class="${i===S.ds?'on':''}">${d[1]}</button>`).join(''); $$('#dsSeg button').forEach(b=>b.onclick=()=>{ S.ds=+b.dataset.i; renderDataSeg(); renderData(); }); }
$('#dsSearch').oninput=()=>renderData();
function renderData(){
  const [src]=DATASETS[S.ds]; const q=$('#dsSearch').value.trim().toLowerCase();
  const rows=S.docs.filter(d=>d.type==='data'&&d.source===src&&!d.title.endsWith('읍면별 집계'));
  const by={}; rows.forEach(r=>{ if(r.eup) by[r.eup]=(by[r.eup]||0)+1; });
  const ent=Object.entries(by).sort((a,b)=>b[1]-a[1]); const mx=ent[0]?.[1]||1;
  $('#dsBars').innerHTML=ent.length?ent.map(([e,n])=>`<div class="bar"><span>${e}</span><i style="width:${Math.round(n/mx*100)}%"></i><span>${n}</span></div>`).join('')+`<div class="bar" style="margin-top:6px"><span><b>합계</b></span><i style="width:0;opacity:0"></i><span>${rows.length}</span></div>`:'<div class="ev-empty">읍·면 구분이 없는 자료입니다</div>';
  const list=rows.filter(r=>!q||(r.title+r.text).toLowerCase().includes(q)).slice(0,200);
  $('#dsListTitle').textContent=`${src} — ${list.length.toLocaleString()}건${rows.length>200&&!q?' (상위 200)':''}`;
  $('#dsTbl').innerHTML='<tr><th>명칭</th><th>내용</th></tr>'+list.map(r=>`<tr><td><b>${r.title}</b></td><td><small>${r.text.replace(/^[^—]*— /,'')}</small></td></tr>`).join('');
}

/* ── 관리자 ── */
function renderStats(){ $('#kQ').textContent=S.stats.q; $('#kCite').textContent=S.stats.cite; $('#kGen').textContent=S.stats.gen; $('#kHwpx').textContent=S.stats.hwpx; const top=Object.entries(S.stats.hits).sort((a,b)=>b[1]-a[1]).slice(0,8); $('#topDocs').innerHTML=top.length?top.map(([t,n])=>`<li>${t.replace('대구광역시 달성군 ','')} <small>(${n})</small></li>`).join(''):'<li class="muted">아직 질의가 없습니다</li>'; }
function renderAdminSrc(){ const t=$('#adminSrc'); const rows=[...S.meta.law_sources.map(s=>['자치법규',s.replace('대구광역시 달성군 ',''),'2026.7.10 공포']),['민원안내','민원 안내 10건(예시)','2026.9.9'],...S.meta.datasets.map(d=>['공공데이터',d.name+' '+d.rows.toLocaleString()+'행','2026.9.8 기준']),['내부지침','복무·계약·보안·문서·공공데이터 5건(예시)','직원 전용']];
  t.innerHTML='<tr><th>구분</th><th>자료</th><th class="r">기준 · 갱신</th></tr>'+rows.map(([a,b,c])=>`<tr><td><span class="ty-badge">${a}</span></td><td>${b}</td><td class="r">${c}<button data-up>갱신</button></td></tr>`).join('');
  t.onclick=e=>{ if(e.target.dataset.up!==undefined){ e.target.textContent='반영됨 ✓'; e.target.disabled=true; toast('자료 갱신 완료 — 전 직원 화면에 즉시 반영됩니다 (시연)'); } }; }
function updPill(){ const on=(S.key||S.server)&&!S.offline; $('#pillModel').classList.toggle('on',!!on); $('#pillTxt').textContent=on?(S.key?`모델 연결(브라우저 직접): ${S.model}`:`모델 연결(서버 프록시): ${S.model}`):(S.serverGate&&!S.server?'서버 연결됨 · 접속 코드 필요(관리자 › 모델 설정)':'오프라인 시연 모드'); if($('#adminModel')) $('#adminModel').textContent=$('#pillTxt').textContent; }
$('#accessCode').value=S.code; $('#accessCode').onchange=e=>{ S.code=e.target.value.trim(); localStorage.setItem('dOnCode',S.code); probeServer(); };
/* 서버 프록시(Netlify Function) 사용 가능 여부 확인 — 키가 서버에 있으면 화면에서 키 입력 불필요 */
function probeServer(){ fetch('/api/chat',{method:'POST',headers:{'content-type':'application/json','x-access-code':S.code||''},body:'{"ping":1}'}).then(r=>r.ok?r.json():null).then(j=>{ S.server=!!(j&&j.ok&&j.codeOk); S.serverGate=!!(j&&j.gate); updPill(); }).catch(()=>{ S.server=false; updPill(); }); }
probeServer();
$('#apiKey').oninput=e=>{ S.key=e.target.value.trim(); updPill(); }; $('#model').oninput=e=>{ S.model=e.target.value.trim()||'claude-sonnet-4-5'; updPill(); }; $('#offline').onchange=e=>{ S.offline=e.target.checked; updPill(); };

/* ── 기타 ── */
$('.brand').onclick=()=>{ setMode('home'); go('home'); }; $('.top-c.slogan').onclick=()=>{ setMode('home'); go('home'); };
$('#btnNoti').onclick=()=>{ $('#notiN').hidden=true; S.mode='home'; document.body.dataset.mode='home'; go('news'); }; $('#goModel').onclick=()=>{ $('#mSet').hidden=true; setMode('admin'); go('model'); };
$$('[data-close]').forEach(b=>b.onclick=()=>b.closest('.modal').hidden=true); $$('.modal').forEach(m=>m.onclick=e=>{ if(e.target===m&&m.id!=='mIntro') m.hidden=true; });
$('#btnTheme').onclick=()=>{ const l=document.body.dataset.theme!=='light'; document.body.dataset.theme=l?'light':'dark'; $('#btnTheme').textContent=l?'🌙':'☀️'; try{localStorage.setItem('dOnTheme',l?'light':'dark');}catch(e){} };
try{ const th=localStorage.getItem('dOnTheme'); if(th){ document.body.dataset.theme=th; $('#btnTheme').textContent=th==='light'?'🌙':'☀️'; } }catch(e){}

init().catch(e=>{ addMsg('ai','자료 색인을 불러오지 못했습니다: '+e.message); });
})();
