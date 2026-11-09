/* 달성On 시연판 — 앱 로직 v2
 * 구조: [자료 색인 index.json] → [브라우저 내 BM25 검색] → [답변 모델(Anthropic API) 또는 오프라인 구성] → [근거 카드·한글 생성]
 * 화면: 상단 대분류 탭 → 좌측 기능 메뉴 → 메인(기능 화면) + 우측 AI 대화. 기능 추가는 NAV 배열 + <section class="view"> 추가.
 * 실제 구축 시 검색·모델 호출은 업무망 서버로 이동하며 브라우저에는 키를 두지 않는다. */
(function(){
'use strict';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const S={ mode:'home', view:'home', ds:0, docs:[], meta:null, idx:null, layers:{1:true,2:true}, key:'', code:(localStorage.getItem('dOnCode')||''), model:'claude-sonnet-4-5', offline:false, server:false,
          hist:[], lastAnswer:null, lastCites:[], lastQ:'', stats:{q:0,cite:0,gen:0,hwpx:0,hits:{}}, busy:false, khist:[] };
window.S=S;  // 분리 모듈(meal/trip/family 등)에서 모델 연결 상태를 읽을 수 있게
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
function relevant(q,hits){
  if(!hits.length) return false;
  const N=S.idx.N, df=S.idx.df;
  const qw=[...new Set(tok(q))].filter(t=>t.startsWith('W:')&&!GEN.has(t.slice(2)));
  // 변별력 있는 말 : 한글 3자(영문 4자) 이상 + 전체 문서의 2% 미만에만 등장
  const RARE=Math.max(3,Math.round(N*0.02));
  const key=qw.filter(t=>{ const w=t.slice(2); const n=df.get(t);
    return n && n<=RARE && (/[가-힣]/.test(w)? w.length>=3 : w.length>=4); });
  if(!key.length) return false;                 // 질문에 우리 자료의 고유 용어가 없음 → 자료 밖 질문
  const tf=S.idx.tf[S.docs.indexOf(hits[0].doc)];
  return key.some(t=>tf.has(t));                // 그 고유 용어가 최상위 근거에 실제로 들어 있어야 인정
}
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
  if(!hits.length) return '※ 달성군 자료에 없는 내용입니다. 시연판은 연결된 자료(자치법규 644건·민원안내·공공데이터 6종·내부지침) 범위 안에서 답하며, 실제 구축 시에는 자료 밖 질문도 AI가 직접 답변합니다.\n@@SUGGEST@@';
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
    {id:'bugs',  icon:'🐞', label:'오류 신고함', sub:'접수된 신고 · 건의'},
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
  // ── 핵심
  {mode:'staff',view:'on',     icon:'✦',  label:'달성On\n사용하기', cls:'on-item', ready:1},
  // ── 문서 만들기
  // (제외) 공문 초안·보고서 작성 — 내부 행정문서를 외부 LLM으로 작성하는 것은 보안상 부적절(지능정보화 담당 협의) → 범정부 AI 공통기반·내부망 모델 전환 시 재검토
  {mode:'staff',view:'rule',   icon:'⚖️', label:'조례·지침\n초안 만들기', cls:'sep', ready:1},
  {mode:'staff',view:'minutes',icon:'🎙', label:'회의록\n정리하기', ready:1},
  // ── 직원 생활 (개인 업무·경조사)
  {mode:'staff',view:'meal',   icon:'🍚', label:'급량비\n계산하기', cls:'sep', ready:1},
  {mode:'staff',view:'trip',   icon:'🚗', label:'출장비(관내여비)\n계산하기', ready:1},
  {mode:'staff',view:'family', icon:'💐', label:'경조사 카드\n만들기', ready:1},
  // ── 알리기 · 홍보물 만들기
  {mode:'staff',view:'press',  icon:'📰', label:'보도자료\n작성하기', cls:'sep', ready:1},
  {mode:'staff',view:'banner', icon:'🎏', label:'홍보 현수막\n제작하기', ready:1},
  // (제외) 인포그래픽 제작하기 — 메뉴 삭제
  {mode:'staff',view:'card',   icon:'📱', label:'카드뉴스\n제작하기', ready:1},
  {mode:'staff',view:'movie',  icon:'🎬', label:'홍보영상\n만들기', ready:1},
  // (제외) 안내방송 만들기 — 메뉴 삭제
  // ── 찾아보기 · 나눔
  {mode:'staff',view:'analyze',icon:'📊', label:'데이터\n분석하기', cls:'sep'},
  {mode:'staff',view:'past',   icon:'🔎', label:'지난 사례\n찾아보기'},
  {mode:'staff',view:'share',  icon:'💡', label:'활용사례\n나눔터'},
];
const MINOR=[
  {mode:'home', view:'guide',icon:'📖', label:'이용 안내', cls:'minor'},
  {mode:'admin',view:'stats',icon:'🛠', label:'관리자', cls:'minor admin'},
];
const ON_VIEWS=['on','doc'];   // 이 화면들에서는 달성On 전용 메뉴
const ALIAS={qa:'on',flow:'guide',news:'guide',contact:'guide',update:'stats',model:'stats',bugs:'stats'};
const COMPOSITE={guide:['guide','flow','news','contact'],stats:['stats','update','model','bugs']};
function renderTabs(){}
function loadRecent(){ try{ return JSON.parse(localStorage.getItem('dOnRecent')||'[]'); }catch(e){ return []; } }
function pushRecent(q){ const r=loadRecent().filter(x=>x!==q); r.unshift(q); localStorage.setItem('dOnRecent',JSON.stringify(r.slice(0,12))); }
function renderNav(){
  const inOn=S.mode==='staff'&&ON_VIEWS.includes(S.view);
  const item=n=>{ const on=n.mode==='admin'?S.mode==='admin':(S.mode===n.mode&&S.view===n.view); return `<li data-mode="${n.mode}" data-view="${n.view}" class="${n.cls||''} ${n.ready?'rdy':''} ${on?'on':''}"><i>${n.icon}</i><b>${n.label.replace(/\n/g,'<br>')}</b>${n.ready?'<em class="dot" title="지금 쓸 수 있습니다"></em>':''}</li>`; };
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
function go(v){ const target=ALIAS[v]; const top=target||v; S.view=top; document.body.dataset.view=top; const show=COMPOSITE[top]||[top]; $$('.view').forEach(s=>s.classList.toggle('on',show.includes(s.dataset.view))); $('#main').classList.toggle('composite',!!COMPOSITE[top]); renderNav(); if(top==='data') renderData(); if(top==='home') renderHome(); if(top==='guide'){ $('#guideChips').innerHTML=chipsHtml(CHIPS.staff,8); renderNews(); renderVideoList(); } show.forEach(mountGuideBtn); if(top==='stats'){ renderStats(); updPill(); loadBugs(); } if(top==='doc') renderPaper(); if(top==='press') initPress(); if(top==='rule'&&window.RULEDRAFT) RULEDRAFT.init(); if(top==='minutes'&&window.MINUTES) MINUTES.init(); if(top==='banner'&&window.BANNER) BANNER.init(); if(top==='card'&&window.CARDNEWS) CARDNEWS.init(); if(top==='movie'&&window.MOVIE) MOVIE.init(); if(top==='meal'&&window.MEAL) MEAL.init(); if(top==='trip') loadTrip(); if(top==='family'&&window.FAMILY) FAMILY.init(); if(top==='on'){ $('#qaChips').innerHTML=chipsHtml(CHIPS.staff,3); setTimeout(()=>$('#q').focus(),50); } const el=target?document.querySelector(`.view[data-view="${v}"]`):null; if(el) setTimeout(()=>el.scrollIntoView({behavior:'smooth',block:'start'}),30); else $('#main').scrollTop=0; }

/* ── 홈 대시보드 ── */
document.addEventListener('click',e=>{ const g=e.target.closest('[data-go]'); if(!g) return; const [m,v]=g.dataset.go.split(':'); setMode(m); go(v); });
const PAL=['#2f6fed','#0fa876','#d98a00','#a04ccf'];
function renderHome(){
  $('#heroDate').textContent=new Date().toLocaleDateString('ko-KR',{year:'numeric',month:'long',day:'numeric',weekday:'long'})+' · 정보통신과 시연판';
  const cls={'공지':'notice','자료':'data','기능':''};
  $('#boardList').innerHTML=NEWS.slice(0,5).map(([d,t,s,body],i)=>`<li class="${i<2?'new':''}"><span class="t ${cls[t]||''}">${t}</span><b>${s}</b><span class="d">${d}</span><div class="body">${body||s}</div></li>`).join('');
  $$('#boardList li').forEach(li=>li.onclick=()=>li.classList.toggle('open'));
  drawVideo(0);
  renderUsage();
  $('#diffGrid').innerHTML=[['① 문서 산출','답변을 달성군 서식 한글(hwpx)로 즉시 생성 — 타 도구는 텍스트만'],['② 운영 환경','업무망 자체 서버 · 내부자료 활용 (구글 개인 도구·인터넷망 ✗)'],['③ 지속성','개인 계정이 아닌 군 정보시스템 — 인사이동에도 유지'],['④ 자료 규모','제한 없음 (NotebookLM 50개 · Gem 10개 ✗) · 창구 하나'],['⑤ 범용 AI','자료 밖 질문도 일반 생성형 AI처럼 답변 · 개인 유료 구독 불필요']].map(([b,s])=>`<div class="dg"><b>${b}</b><small>${s}</small></div>`).join('');
}
/* 안내 영상 재생기 — 여러 편을 넘겨 본다 */
let VIDX=0;
function drawVideo(i){
  const P=$('#player'); const HV=HOME_VIDEOS(); if(!P||!HV.length) return;
  VIDX=(i+HV.length)%HV.length;
  const v=HV[VIDX], n=HV.length;
  const media = v.file
    ? `<video src="${v.file}"${v.poster?` poster="${v.poster}"`:''} controls playsinline preload="none" controlsList="nodownload noplaybackrate" disablePictureInPicture></video>`
    : `<iframe src="https://www.youtube-nocookie.com/embed/${v.yt}?rel=0" title="${v.title}" referrerpolicy="strict-origin-when-cross-origin" allow="accelerometer; autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`;
  P.innerHTML = media + (n>1 ? `
    <button class="vnav prev" aria-label="이전 영상">‹</button>
    <button class="vnav next" aria-label="다음 영상">›</button>` : '');
  const note=$('#videoNote'); if(note) note.textContent=v.len+(v.yt?' · 유튜브':'');
  const cap=$('#videoCap');
  if(cap) cap.innerHTML=`<b>${v.title}</b> — ${v.sub}` + (n>1?` <span class="vidx">${VIDX+1} / ${n}</span>`:'');
  if(n>1){
    P.querySelector('.prev').onclick=()=>drawVideo(VIDX-1);
    P.querySelector('.next').onclick=()=>drawVideo(VIDX+1);
  }
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
  const parts=[['자치법규',c.law,S.meta.law_sources.length+'건 조례·규칙'],['공공데이터',c.data,S.meta.datasets.length+'종 데이터셋'],['민원안내',c.minwon,'예시 안내'],['내부지침',c.internal,'직원 전용']]; const psum=parts.reduce((p,x)=>p+x[1],0); let acc=0; const R=54,cx=70,cy=70,circ=2*Math.PI*R;
  let d=`<svg viewBox="0 0 140 140" role="img" aria-label="자료 출처 구성">`; parts.forEach(([n,v],k)=>{ const f=v/psum; d+=`<circle r="${R}" cx="${cx}" cy="${cy}" fill="none" stroke="${PAL[k]}" stroke-width="18" stroke-dasharray="${Math.max(0,f*circ-2)} ${circ}" stroke-dashoffset="${-acc*circ}" transform="rotate(-90 ${cx} ${cy})"><title>${n} ${v}건</title></circle>`; acc+=f; });
  d+=`<text x="${cx}" y="${cy-2}" text-anchor="middle" font-size="15" font-weight="700" fill="currentColor">${psum.toLocaleString()}</text><text x="${cx}" y="${cy+14}" text-anchor="middle" font-size="10" fill="currentColor" opacity=".6">색인 문서</text></svg>`;
  $('#chartDonut').innerHTML=`<div class="donut-wrap">${d}<ul>${parts.map(([n,v,s],k)=>`<li><span><i style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${PAL[k]};margin-right:6px"></i>${n}<br><small style="margin-left:16px">${s}</small></span><b>${v.toLocaleString()}건</b></li>`).join('')}</ul></div>`;
  // 최근 자치법규
  $('#lawList').innerHTML=(S.meta.law_recent||[]).map(L=>`<li><i></i><div>${shortNm(L.n)}<small>${L.d?L.d+' · ':''}${L.c}개 조문 색인 · 시행 ${dstr(L.e)}</small></div></li>`).join('');
}

/* ── 안내 영상 목록 ──────────────────────────────────────────
   영상이 늘어나면 이 배열에 한 줄만 더하면 된다. 넘김 단추는 개수에 맞춰 저절로 생긴다.
   file 대신 yt(유튜브 ID)를 적어도 된다. */
const VIDEOS=[
  {title:'달성On 소개',        sub:'무엇을 해 주는지 29초로',   len:'29초',   home:true,
   file:'assets/intro.mp4',  poster:'assets/intro_poster.jpg'},
  {title:'급량비 계산하기',     sub:'확인서 PDF 하나로 집행대장까지', len:'1분 13초', view:'meal',
   file:'assets/meal_guide.mp4', poster:'assets/meal_guide_poster.jpg'}
];
/* home:true 인 영상만 홈 화면에 나온다(무거워지지 않게 1편만).
   view:'meal' 처럼 기능 화면 id를 적으면 그 화면 제목 옆에 「▶ 이용 안내」 단추가 저절로 붙고,
   「이용 안내」 페이지의 영상 모음에도 함께 나온다. 파일은 누르기 전엔 내려받지 않는다(preload=none). */
const HOME_VIDEOS=()=>VIDEOS.filter(v=>v.home);
function openVideo(v){
  const m=$('#mVideo'); if(!m) return;
  $('#mVideoTitle').textContent=v.title; $('#mVideoSub').textContent=v.sub+' · '+v.len;
  $('#mVideoBody').innerHTML = v.file
    ? `<video src="${v.file}"${v.poster?` poster="${v.poster}"`:''} controls autoplay playsinline preload="none" controlsList="nodownload noplaybackrate" disablePictureInPicture></video>`
    : `<iframe src="https://www.youtube-nocookie.com/embed/${v.yt}?rel=0&autoplay=1" title="${v.title}" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`;
  m.hidden=false;
}
function closeVideo(){ const m=$('#mVideo'); if(!m) return; $('#mVideoBody').innerHTML=''; m.hidden=true; }
/* 기능 화면 제목 옆 「▶ 이용 안내」 공통 단추 */
function mountGuideBtn(view){
  const v=VIDEOS.find(x=>x.view===view); if(!v) return;
  const h2=document.querySelector(`.view[data-view="${view}"] .vh h2`); if(!h2||h2.querySelector('.vguide')) return;
  const b=document.createElement('button'); b.className='vguide'; b.type='button';
  b.innerHTML=`<span>▶</span> 이용 안내 <small>${v.len}</small>`; b.title='이 기능 안내 영상 보기';
  b.onclick=()=>openVideo(v); h2.appendChild(b);
}
/* 이용 안내 › 안내 영상 모음 */
function renderVideoList(){
  const el=$('#videoList'); if(!el) return;
  el.innerHTML=VIDEOS.map((v,i)=>`<button class="vitem" data-i="${i}" type="button">
    <span class="vthumb"${v.poster?` style="background-image:url('${v.poster}')"`:''}><i>▶</i></span>
    <b>${v.title}</b><small>${v.sub} · ${v.len}</small></button>`).join('');
  $$('#videoList .vitem').forEach(b=>b.onclick=()=>openVideo(VIDEOS[+b.dataset.i]));
}
const VIDEO_FILE='assets/intro.mp4';  // (옛 설정 — VIDEOS 를 씁니다)
const VIDEO_ID='OVZoYQeUFIQ';  // 유튜브 영상 ID를 넣으면 안내 영상이 재생됨, 비우면 포스터 표시
const NEWS=[['2026.09.11','기능','🍚 <b>급량비 계산하기</b> — 오늘부터 사용할 수 있습니다','좌측 메뉴 「급량비 계산하기」에서 <b>새올 초과근무 확인서 PDF 하나만 올리면</b> 됩니다.<br><br>· 「지방자치단체 회계관리에 관한 훈령」(제416호) <b>급량비 기준에 따라 지급 대상을 판정</b>합니다 — 휴일·대체공휴일, 조기출근 사전신청까지 대조합니다<br>· 식당 이름만 적고 <b>「금액 자동계산」 → 「가맹업소명 배치하기」</b>를 누르면 일자별로 나뉘어 들어갑니다. 금액은 <b>9,000원 단위로 딱 떨어지게</b> 맞춰 줍니다<br>· <b>기존 집행대장 서식 그대로</b> 인쇄됩니다 (A4 가로 · 한 쪽 12건 · 결재란 포함). 엑셀 파일로도 내려받을 수 있습니다<br>· 2026년 8월 정보통신과 <b>54식 486,000원</b>으로 검증했고 기존 수기 집계와 일치했습니다<br><br><b>※ 확인서는 스캔하지 마시고</b> 새올 화면에서 「인쇄 → PDF로 저장」한 파일을 올려 주세요. 스캔본은 그림이라 내용을 읽을 수 없습니다.<br>※ 올린 파일은 <b>브라우저 안에서만 처리</b>되며 외부로 전송되지 않습니다.<br>※ 제외 대상은 자동 판단되지만 <b>결재 전 최종 확인은 담당자</b>가 합니다 — 규정상 「실제 근무 여부를 객관적 사실로 확인한 후 집행」해야 합니다.<br><br>시범 단계입니다. <b>처음 쓰실 때는 이미 지급이 끝난 지난 달로 한 번 돌려보시고</b> 기존 집계와 맞는지 확인해 주세요. 문의: 정보통신과 053-668-2454'],['2026.09.10','기능','📰 <b>보도자료 작성하기</b> — 오늘부터 사용할 수 있습니다','좌측 메뉴 「보도자료 작성하기」에서 <b>바로 쓰실 수 있습니다.</b><br><br>· <b>행사·사업명</b>과 <b>주요 내용</b>만 적으면 보도자료 초안이 만들어집니다 (계획서·기안문을 그대로 붙여넣거나 파일로 올려도 됩니다)<br>· 달성군이 실제로 발행한 <b>보도자료 600건</b>의 문체·구성을 따라 씁니다<br>· <b>홍보협력과 제출 서식 그대로</b> 한글 파일로 내려받습니다 — 표·글꼴·여백까지 동일<br>· 일시·장소·담당자를 비워 두면 <b>○○월 ○○일</b>처럼 빨간색으로 표시되니 나중에 채워 넣으시면 됩니다<br><br>※ 초안은 참고용입니다. <b>사실관계·수치·인용문은 반드시 확인 후</b> 배포해 주세요.'],['2026.09.10','자료','달성군 자치법규 <b>전량 색인</b> — 조례·규칙·훈령·예규 644건','법제처 「국가법령정보 공동활용」 API와 자치법규정보시스템(ELIS)을 통해 <b>대구광역시 달성군 자치법규 644건(9,739개 조문)</b>을 전부 색인했습니다.<br>· 조례 479건 · 규칙 95건 · <b>훈령 52건</b> · <b>예규 18건</b><br>· 이전: 7건 24개 조문(예시) → 현재: <b>644건 9,739개 조문(전량)</b><br>· 법규별 <b>소관부서</b>(60개 부서)와 시행일자를 함께 저장하여 「담당 부서 찾기」 근거로 사용합니다<br>· 위임전결 규정, 계약심사 업무처리 규정 등 <b>내부 훈령·예규까지 조문 단위로 검색</b>됩니다<br>· 모두 공개 자료이며, 조문 원문을 근거로 인용합니다'],['2026.09.10','공지','부군수 보고 결과 — 직원용 우선 도입 확정','① 우선 <b>직원용</b>으로 도입하여 전 직원이 자유롭게 사용할 수 있도록 구축<br>② 2027년 사업비 <b>20백만원</b> 범위에서 추진<br>③ 도입 후 <b>이용 활성화 상황을 지켜본 뒤</b>, 향후 <b>군민 대상(민원 안내) 서비스로 확장</b>할 수 있는 구조로 설계<br>※ 군민용 챗봇은 이번 단계에서 제외하되, 확장 가능한 구조는 유지합니다.'],['2026.09.10','공지','부군수 보고 일정 안내','2026. 9. 9.(수) 부군수님께서 <b>행정용 생성형 AI 도입에 관한 검토</b>를 지시하셨습니다.<br>하루 뒤인 <b>2026. 9. 10.(목) 17:00</b> 부군수님께 검토 결과를 보고하는 일정이 잡혔습니다.<br>보고 결과는 위 <b>「부군수 보고 결과 — 직원용 우선 도입 확정」</b> 공지를 봐 주세요.'],['2026.09.09','공지','달성On 시연판 이용 안내','시연판은 달성군 자치법규 전량과 공공데이터 6종, 예시 자료(민원안내 10건·내부지침 5건)를 포함합니다. 답변은 참고용이며 최종 판단은 담당자가 합니다. 문의: 정보통신과 053-668-2454'],['2026.09.09','기능','「달성군」 홈 대시보드 · 이용 안내 · 공지 화면 추가'],['2026.09.09','기능','달성On/직원용/관리자 3개 탭 구조로 개편, 우측 AI 대화 패널'],['2026.09.09','기능','한글 문서 생성 화면(문서 종류 · 서식 미리보기) 신설'],['2026.09.09','자료','민원안내 10건(예시) · 내부지침 5건(예시) 등록'],['2026.09.08','자료','2026.7.10 공포 조례·규칙 7건 색인(24개 조문·별표)'],['2026.09.08','자료','공공데이터 6종 1,107행 연결 (경로당·판매소·도서관·대형폐기물·봉투가격·무료급식소)'],['2026.09.08','기능','달성On 시연판 최초 공개']];
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
  b.classList.remove('rag','gen'); b.classList.add(rag?'rag':'gen');
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

const lawCnt=n=>(S.meta.law_counts&&S.meta.law_counts[n])||S.docs.filter(x=>x.source===n).length;
const shortNm=n=>n.replace('대구광역시 달성군 ','');
const dstr=d=>{d=String(d||'');return d.length===8?`${d.slice(0,4)}.${+d.slice(4,6)}.${+d.slice(6,8)}`:d;};


/* ══════════ 보도자료 작성하기 ══════════
   달성군 보도자료 원본(hwp) 서식 분석 결과를 그대로 적용한다.
   용지 A4 · 여백 위7/아래15/좌20/우20/머리말20/꼬리말5(mm)
   제목 HY헤드라인M 22pt 진하게 · 부제 한컴바탕확장 15pt 진하게
   본문 한컴바탕확장 15pt(줄간격 160%) · 표제 궁서 20/30pt · 표 항목 휴먼명조 15pt        */
const PRESS_RULE = `[달성군 보도자료 작성 규칙 — 실제 발행본 600건에서 추출]
· 제목: 「대구 달성군, ○○○ 개최」처럼 주체+무엇을+동사로 끝낸다. 20자 안팎. 마침표 없음.
  24자를 넘으면 의미가 끊기지 않는 자리에서 / 로 나눠 두 줄로 준다(예: "근로자 안전이 최우선! / 달성군, 산업안전 우수기업 5곳 선정").
  두 줄 길이는 비슷하게 맞추고, 조사(을·를·의·로) 바로 뒤나 「」 안에서는 끊지 않는다.
  같은 낱말(예: 달성군)을 제목 안에서 두 번 쓰지 않는다.
· 부제: ▸ 로 시작하는 2~3줄. **각 줄 32자 이내**로 끊어 쓴다(길면 두 줄로 넘어가 서식이 흐트러진다). 한 줄에 한 가지만 담고, 문장을 중간에 자르지 않는다. 제목에 없는 알맹이(대상·규모·금액·기간)를 담는다.
· 본문 첫 문단(리드): "달성군(군수 최재훈)은 지난 O일 △△에서 ~을 개최했다고 밝혔다." 형태로
  누가·언제·어디서·무엇을 한 문장에 담는다. 기관명 뒤에는 괄호로 대표자를 적는다.
· 둘째 문단: 배경·목적. "이번 ~은 ~하기 위해 마련됐다."
· 셋째~넷째 문단: 세부 내용(프로그램·규모·대상·예산 등 구체적 수치).
· 마지막 문단: 인용. "최재훈 달성군수는 "~"고 말했다." 또는 "~며 밝혔다."
· 문장은 과거형 종결(~했다/~밝혔다/~전했다). 문단마다 앞에 공백 한 칸을 둔다.
· 4~6개 문단, 전체 700~1,100자. 보도자료 1건은 A4 1쪽을 넘지 않는다.
· 홍보성 수식어("최고의","획기적")는 쓰지 않고 사실과 수치로 쓴다.
· 주민등록번호·개인 연락처 등 개인정보는 넣지 않는다.`;

function pressSys(){
  return `당신은 대구광역시 달성군 홍보 담당자입니다. 아래 규칙과 실제 발행 사례를 그대로 따라 보도자료 초안을 작성합니다.
${PRESS_RULE}

반드시 아래 형식으로만 출력합니다. 다른 말·설명·마크다운은 절대 쓰지 않습니다.
제목: (한 줄. 두 줄이면 / 로 구분)
부제: ▸ 첫째 줄
부제: ▸ 둘째 줄
부제: ▸ 셋째 줄 (없으면 생략)
본문:
(문단들. 빈 줄로 문단 구분)`;
}

const PS={busy:false,files:[],out:null};

function initPress(){
  if($('#pfGo')._on) return; $('#pfGo')._on=1;
  const n=(S.meta&&S.meta.counts&&S.meta.counts.press)||0;
  $('#pfLearn').textContent = n? `달성군 실제 보도자료 ${n.toLocaleString()}건의 문체·구성을 참고합니다` : '달성군 보도자료 서식 기준';
  const t=new Date(); $('#pfDate').value=t.toISOString().slice(0,10);
  $('#pfFile').onchange=async e=>{
    PS.files=[];
    const fs=[...e.target.files];
    for(const f of fs){
      let txt='';
      if(/\.(txt|md|csv|json|htm|html)$/i.test(f.name)){
        try{ txt=(await f.text()).slice(0,8000); if(/\.html?$/i.test(f.name)){ const d=new DOMParser().parseFromString(txt,'text/html'); txt=(d.body.innerText||'').slice(0,8000);} }catch(err){}
      }
      PS.files.push({name:f.name,size:f.size,text:txt});
    }
    $('#pfFileList').textContent = PS.files.length
      ? PS.files.map(f=>f.name+(f.text?' (본문 읽음)':' (파일명만)')).join(' · ')
      : '계획서·기안문을 올리면 내용을 읽어 반영합니다';
  };
  $('#pfSample').onclick=()=>{
    $('#pfName').value='달성군 AI 업무비서 「달성On」 시범 운영';
    $('#pfWhen').value='2026. 9. 10.(목) 14:00';
    $('#pfWhere').value='달성군청 군민소통관';
    $('#pfDept').value='정보통신과'; $('#pfLead').value='김화연'; $('#pfPic').value='조호현'; $('#pfTel').value='053)668-2454';
    $('#pfBody').value='전 직원 대상 AI 업무비서 「달성On」 시범 운영 개시\n달성군 자치법규 644건(조례·규칙·훈령·예규)과 공공데이터를 근거로 답변\n질문하면 근거 조문을 인용하고, 답변을 군 서식 한글 파일로 바로 생성\n공문 초안·보고서·보도자료 작성 기능 순차 제공 예정\n목적: 반복 문서 작성 시간 단축, 규정 확인에 드는 시간 절감';
    $('#pfQuote').value='';
    toast('예시를 채웠습니다 — 「보도자료 초안 만들기」를 눌러보세요');
  };
  $('#pfReset').onclick=()=>{ ['pfName','pfWhen','pfWhere','pfDept','pfLead','pfPic','pfTel','pfBody','pfQuote'].forEach(id=>$('#'+id).value=''); PS.files=[]; $('#pfFile').value=''; $('#pfFileList').textContent='계획서·기안문을 올리면 내용을 읽어 반영합니다'; $('#pressOut').hidden=true; };
  $('#pfGo').onclick=()=>makePress();
  $('#pfAgain').onclick=()=>makePress();
  $('#pfCopy').onclick=()=>{ if(!PS.out) return; navigator.clipboard.writeText(pressPlain(PS.out)); toast('복사했습니다'); };
  $('#pfHwpx').onclick=()=>pressHwpx();
}

function pressExamples(q){
  try{
    const hits=search(q,{filter:d=>d.type==='press',k:3});
    return hits.map((h,i)=>`[사례 ${i+1}] ${h.doc.title}\n${h.doc.text.slice(0,900)}`).join('\n\n');
  }catch(e){ return ''; }
}

function pressParse(t){
  const o={title:'',subs:[],body:[]};
  const lines=String(t||'').split(/\r?\n/);
  let inBody=false, buf=[];
  for(const raw of lines){
    const l=raw.trim();
    if(/^본문\s*:?\s*$/.test(l)){ inBody=true; continue; }
    if(!inBody && /^제목\s*:/.test(l)){ o.title=l.replace(/^제목\s*:\s*/,'').trim(); continue; }
    if(!inBody && /^부제\s*:/.test(l)){ const v=l.replace(/^부제\s*:\s*/,'').replace(/^▸\s*/,'').trim(); if(v) o.subs.push(v); continue; }
    if(!inBody && /^▸/.test(l)){ o.subs.push(l.replace(/^▸\s*/,'').trim()); continue; }
    if(inBody) buf.push(raw);
  }
  o.body=buf.join('\n').split(/\n\s*\n/).map(x=>x.replace(/\s+/g,' ').trim()).filter(Boolean);
  if(!o.title){ const m=String(t).match(/^\s*(.+)$/m); o.title=m?m[1].slice(0,60):''; }
  return o;
}

function pressPlain(o){
  const H=pressHead();
  return [`대구광역시 달성군  보도자료`,`제공일자 ${H.date}`,`담당부서 ${H.dept}`,`팀    장 ${H.lead}`,`담 당 자 ${H.pic}`,`전    화 ${H.tel}`,'',
    o.title,'',...o.subs.map(s=>'▸ '+s),'',...o.body.map(p=>' '+p)].join('\n');
}
const PH={when:'○○월 ○○일',where:'○○○○',dept:'○○○○',lead:'○○○',pic:'○○○',tel:'053)668-○○○○'};
function pressHead(){
  const d=$('#pfDate').value||new Date().toISOString().slice(0,10);
  const dt=new Date(d+'T00:00:00');
  const W='일월화수목금토'[dt.getDay()];
  const v=(id,ph)=>{ const x=$('#'+id).value.trim(); return x?{t:x,miss:false}:{t:ph,miss:true}; };
  return {date:`${dt.getFullYear()}. ${dt.getMonth()+1}. ${dt.getDate()}.(${W})`, dateMiss:false,
          deptO:v('pfDept',PH.dept), leadO:v('pfLead',PH.lead), picO:v('pfPic',PH.pic), telO:v('pfTel',PH.tel),
          dept:v('pfDept',PH.dept).t, lead:v('pfLead',PH.lead).t, pic:v('pfPic',PH.pic).t, tel:v('pfTel',PH.tel).t};
}

/* 제목 줄나눔 — 한 줄이 길면 의미 단위에서 자연스럽게 두 줄로 */
function splitTitle(raw){
  let t=String(raw||'').trim();
  if(t.includes('/')){                                   // 모델이 직접 나눈 경우 그대로
    const a=t.split('/').map(x=>x.trim()).filter(Boolean);
    if(a.length>=2) return [a[0],a.slice(1).join(' ')];
    t=a[0]||t;
  }
  const L=s=>[...s].reduce((n,c)=>n+(/[\x00-\x7F]/.test(c)?0.5:1),0);   // 한글 1, 영문·숫자 0.5칸
  if(L(t)<=24) return [t];
  // 나눌 수 있는 자리 : 공백 위치 (「」·()·"" 안쪽은 제외)
  const open='「『（("\u2018\u201C', close='」』）)"\u2019\u201D';
  let depth=0; const cand=[];
  for(let i=0;i<t.length;i++){
    const c=t[i];
    if(open.includes(c)) depth++;
    else if(close.includes(c)) depth=Math.max(0,depth-1);
    else if(c===' '&&depth===0) cand.push(i);
  }
  if(!cand.length) return [t];
  const total=L(t), mid=total/2;
  let best=null,bestScore=1e9;
  for(const i of cand){
    const a=t.slice(0,i).trim(), b=t.slice(i+1).trim();
    if(!a||!b) continue;
    const la=L(a), lb=L(b);
    if(la>30||lb>30) continue;                            // 한 줄 30칸 넘으면 제외
    let sc=Math.abs(la-mid)*2;                            // 가운데에 가까울수록 좋음
    if(/[,·]$/.test(a)) sc-=6;                            // 쉼표 뒤에서 끊으면 자연스러움
    if(/[을를이가은는와과의로]$/.test(a)) sc+=8;             // 조사 뒤 끊기는 어색
    if(/^(및|등|또는|그리고)/.test(b)) sc+=6;               // 접속어로 줄 시작 어색
    if(la<8||lb<8) sc+=10;                                // 한쪽만 너무 짧으면 감점
    if(sc<bestScore){ bestScore=sc; best=i; }
  }
  if(best===null) return [t];
  return [t.slice(0,best).trim(), t.slice(best+1).trim()];
}
function pressRender(o){
  const H=pressHead();
  const V=x=>`<span${x&&x.miss?' class="miss"':''}>${esc0(x&&x.t!==undefined?x.t:x)}</span>`;
  /* 표는 한글 파일에만 들어간다. 미리보기는 내용에 집중하도록 한 줄 요약만 표시 */
  const meta=`<div class="pvmeta">제공일자 ${V({t:H.date,miss:false})}<i>·</i>담당부서 ${V(H.deptO)}`+
             `<i>·</i>팀장 ${V(H.leadO)}<i>·</i>담당자 ${V(H.picO)}<i>·</i>전화 ${V(H.telO)}</div>`;
  $('#pressView').innerHTML = meta +
    `<div class="ttlbox"><h3>${splitTitle(o.title).map(x=>esc0(x)).join('<br>')}</h3>
       ${o.subs.map(s=>`<div class="psub">▸ ${esc0(s)}</div>`).join('')}</div>
     <div class="pbody">${o.body.map(p=>`<p>${esc0(p)}</p>`).join('')}</div>`;
  $('#pressOut').hidden=false;
  $('#pressOut').scrollIntoView({behavior:'smooth',block:'start'});
}

const esc0=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

function pressOffline(){
  const name=$('#pfName').value.trim(), when=$('#pfWhen').value.trim(), where=$('#pfWhere').value.trim();
  const pts=$('#pfBody').value.split(/\r?\n/).map(x=>x.replace(/^[-·•\s]+/,'').trim()).filter(Boolean);
  const day=(when.match(/(\d{1,2})일/)||when.match(/\.\s*(\d{1,2})\.?\s*\(/)||[])[1]||'';
  const o={title:`대구 달성군, ${name} 개최`,
    subs:[`▸ ${name} 개최`.replace('▸ ',''), pts[0]||'', pts[1]||''].filter(Boolean).slice(0,3),
    body:[`달성군(군수 최재훈)은 ${day?`지난 ${day}일 `:(when?'':PH.when+' ')}${where||PH.where}에서 ${name}을(를) 개최했다고 밝혔다.`,
          pts.length>2?`이번 ${name}은 ${pts[2]}`:`이번 ${name}은 관련 시책을 추진하기 위해 마련됐다.`,
          ...pts.slice(3,5),
          $('#pfQuote').value.trim()||`최재훈 달성군수는 "앞으로도 군민이 체감할 수 있는 시책을 지속적으로 추진하겠다"고 말했다.`]
      .filter(Boolean)};
  return o;
}

async function makePress(){
  if(PS.busy) return;
  const name=$('#pfName').value.trim(), body=$('#pfBody').value.trim();
  if(!name||!body){ $('#pfMsg').textContent='행사·사업명과 주요 내용은 입력해 주세요.'; $('#pfName').focus(); return; }
  PS.busy=true; $('#pfGo').disabled=true; $('#pfMsg').textContent='작성 중…';
  try{
    let text='';
    if((S.key||S.server)&&!S.offline){
      const H=pressHead();
      const ex=pressExamples(name+' '+body.slice(0,80));
      const u=[`<실제 발행 사례 — 문체와 구성을 이대로 따르세요>\n${ex}\n</실제 발행 사례>`,
        `<작성 요청>`,
        `행사·사업명: ${name}`,
        $('#pfWhen').value?`일시: ${$('#pfWhen').value}`:'',
        $('#pfWhere').value?`장소: ${$('#pfWhere').value}`:'',
        H.dept?`담당부서: ${H.dept}`:'',
        `제공일자: ${H.date}`,
        `주요 내용:\n${body}`,
        $('#pfQuote').value.trim()?`인용문(그대로 사용): ${$('#pfQuote').value.trim()}`:'인용문: 문맥에 맞게 군수 말씀을 생성',
        PS.files.filter(f=>f.text).map(f=>`첨부 「${f.name}」 내용:\n${f.text.slice(0,3000)}`).join('\n\n'),
        PS.files.filter(f=>!f.text).length?`첨부 파일명: ${PS.files.filter(f=>!f.text).map(f=>f.name).join(', ')}`:'',
        `</작성 요청>`].filter(Boolean).join('\n');
      const payload=JSON.stringify({model:S.model,max_tokens:1600,stream:true,system:pressSys(),messages:[{role:'user',content:u}]});
      const r=S.key
        ? await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'content-type':'application/json','x-api-key':S.key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},body:payload})
        : await fetch('/api/chat',{method:'POST',headers:{'content-type':'application/json','x-access-code':S.code||''},body:payload});
      if(!r.ok) throw new Error('모델 호출 실패 ('+r.status+')');
      const rd=r.body.getReader(), dec=new TextDecoder(); let buf='';
      while(true){ const {value,done}=await rd.read(); if(done) break; buf+=dec.decode(value,{stream:true});
        const ls=buf.split('\n'); buf=ls.pop();
        for(const ln of ls){ if(!ln.startsWith('data:')) continue;
          try{ const j=JSON.parse(ln.slice(5)); if(j.type==='content_block_delta'&&j.delta?.text) text+=j.delta.text; }catch(e){} } }
      PS.out=pressParse(text); 
      $('#pfMsg').textContent='작성 완료 — 내용을 확인하고 수정해 주세요.';
    }else{
      await new Promise(r=>setTimeout(r,500));
      PS.out=pressOffline(); 
      $('#pfMsg').textContent='오프라인 시연 모드 — 모델 연결 시 실제 문체로 작성됩니다.';
    }
    pressRender(PS.out);
    S.stats.gen++;
  }catch(err){ $('#pfMsg').textContent='⚠ '+err.message; }
  finally{ PS.busy=false; $('#pfGo').disabled=false; }
}

async function pressHwpx(){
  if(!PS.out) return;
  const H=pressHead();
  try{
    const blob=await DalseongHwpx.build({kind:'press', title:PS.out.title.replace(/\s*\/\s*/g,' '), titleLines:splitTitle(PS.out.title), sub:PS.out.subs.join(' / '),
      date:H.date, head:H, subs:PS.out.subs, paras:PS.out.body,
      question:'', answer:PS.out.body.join('\n\n'), cites:[], includeCites:false});
    const nm=`달성군_보도자료_${($('#pfName').value||'초안').replace(/[\\/:*?"<>|]/g,'')}_${new Date().toISOString().slice(0,10).replace(/-/g,'')}.hwpx`;
    DalseongHwpx.download(blob,nm); S.stats.hwpx++; toast('한글 파일 생성: '+nm);
  }catch(e){ toast('한글 파일 생성 실패: '+e.message); }
}

/* ── 자료함 ── */
function renderLib(){
  const t=$('#libTbl'); const rows=[];
  (S.meta.laws||[]).slice().sort((a,b)=>b.c-a.c).slice(0,40).forEach(L=>rows.push(['law',shortNm(L.n),L.c+'조문',(L.d||'')+(L.e?' · 시행 '+dstr(L.e):''),'공개']));
  if((S.meta.laws||[]).length>40) rows.push(['law','… 그 외 자치법규 '+((S.meta.laws.length)-40)+'건',(S.meta.counts.law).toLocaleString()+'조문 전체 색인','법제처 국가법령정보 공동활용','공개']);
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
function renderAdminSrc(){ const t=$('#adminSrc'); const rows=[['자치법규','조례 '+((S.meta.law_kinds||{})['조례']||0)+'건 · 규칙 '+((S.meta.law_kinds||{})['규칙']||0)+'건 (전문 '+(S.meta.counts.law).toLocaleString()+'조문)','법제처 API · '+S.meta.built],...(S.meta.law_recent||[]).slice(0,8).map(L=>['자치법규',shortNm(L.n)+' <small>('+(L.d||'')+')</small>','시행 '+dstr(L.e)]),['민원안내','민원 안내 10건(예시)','2026.9.9'],...S.meta.datasets.map(d=>['공공데이터',d.name+' '+d.rows.toLocaleString()+'행','2026.9.8 기준']),['내부지침','복무·계약·보안·문서·공공데이터 5건(예시)','직원 전용']];
  t.innerHTML='<tr><th>구분</th><th>자료</th><th class="r">기준 · 갱신</th></tr>'+rows.map(([a,b,c])=>`<tr><td><span class="ty-badge">${a}</span></td><td>${b}</td><td class="r">${c}<button data-up>갱신</button></td></tr>`).join('');
  t.onclick=e=>{ if(e.target.dataset.up!==undefined){ e.target.textContent='반영됨 ✓'; e.target.disabled=true; toast('자료 갱신 완료 — 전 직원 화면에 즉시 반영됩니다 (시연)'); } }; }
function updPill(){ const on=(S.key||S.server)&&!S.offline; $('#pillModel').classList.toggle('on',!!on); $('#pillTxt').textContent=on?(S.key?`모델 연결(브라우저 직접): ${S.model}`:`모델 연결(서버 프록시): ${S.model}`):(S.serverGate&&!S.server?'서버 연결됨 · 접속 코드 필요(관리자 › 모델 설정)':'오프라인 시연 모드'); if($('#adminModel')) $('#adminModel').textContent=$('#pillTxt').textContent; }
$('#accessCode').value=S.code; $('#accessCode').onchange=e=>{ S.code=e.target.value.trim(); localStorage.setItem('dOnCode',S.code); probeServer();
/* 접속 IP 표시 — 서버 함수(/api/whoami)에서 받아옴. 로컬·오프라인이면 '-' */
fetch('/api/whoami').then(r=>r.ok?r.json():null).then(j=>{ if(j&&j.ip) $('#userIp').textContent=j.ip; }).catch(()=>{}); };
/* 서버 프록시(Netlify Function) 사용 가능 여부 확인 — 키가 서버에 있으면 화면에서 키 입력 불필요 */
function probeServer(){ fetch('/api/chat',{method:'POST',headers:{'content-type':'application/json','x-access-code':S.code||''},body:'{"ping":1}'}).then(r=>r.ok?r.json():null).then(j=>{ S.server=!!(j&&j.ok&&j.codeOk); S.serverGate=!!(j&&j.gate); updPill(); }).catch(()=>{ S.server=false; updPill(); }); }
probeServer();
$('#apiKey').oninput=e=>{ S.key=e.target.value.trim(); updPill(); }; $('#model').oninput=e=>{ S.model=e.target.value.trim()||'claude-sonnet-4-5'; updPill(); }; $('#offline').onchange=e=>{ S.offline=e.target.checked; updPill(); };

/* ── 기타 ── */
$('.brand').onclick=()=>{ setMode('home'); go('home'); };
/* ── 오류 신고 · 건의 ─────────────────────────────────────────
   서버가 없는 시범 화면이라 「복사해서 보내기」 방식이 가장 확실하다.
   2027년 본 구축에서는 이 자리에서 바로 접수되도록 바꾼다. */
(function bugReport(){
  const box=$('#mBug'); if(!box) return;
  const cur=()=>{
    const v=document.body.dataset.view||'';
    const m=HOME_MENU.find(x=>x.view===v);
    return m ? m.label.replace(/\n/g,' ') : '';
  };
  $('#bugWhere').innerHTML='<option value="">— 고르지 않아도 됩니다 —</option>'+
    HOME_MENU.filter(m=>m.view).map(m=>'<option>'+m.label.replace(/\n/g,' ')+'</option>').join('')+
    '<option>화면과 상관없는 이야기</option>';
  $('#btnBug').onclick=()=>{
    const c=cur(); if(c) $('#bugWhere').value=c;     // 보고 있던 화면을 미리 골라 둔다
    $('#bugOk').hidden=true; $('#bugCopy').hidden=true;
    $('#bugSend').disabled=false; $('#bugSend').textContent='📮 제출하기';
    box.hidden=false;
    setTimeout(()=>$('#bugText').focus(),80);
  };
  box.addEventListener('click',e=>{
    const k=e.target.closest('.bk');
    if(k){ box.querySelectorAll('.bk').forEach(b=>b.classList.remove('on')); k.classList.add('on'); return; }
  });

  const gather=()=>({
    where : $('#bugWhere').value||'',
    kind  : (((box.querySelector('.bk.on')||{}).dataset)||{}).k||'',
    text  : ($('#bugText').value||'').trim(),
    who   : ($('#bugWho').value||'').trim(),
    w     : window.innerWidth
  });
  const asText=b=>{
    const n=new Date(), p=x=>String(x).padStart(2,'0');
    return '[달성On 오류신고·건의]\n'+
      '화면 : '+(b.where||'—')+'\n'+
      '종류 : '+(b.kind||'—')+'\n'+
      '내용 : '+b.text+'\n'+
      '연락처 : '+(b.who||'—')+'\n'+
      '— 보낸 때 '+n.getFullYear()+'.'+p(n.getMonth()+1)+'.'+p(n.getDate())+' '+
        p(n.getHours())+':'+p(n.getMinutes())+' · 화면폭 '+b.w+'px\n'+
      '— 받는 곳 정보통신과 053-668-2454';
  };
  const say=(m,bad)=>{ const el=$('#bugOk'); el.textContent=m; el.classList.toggle('bad',!!bad); el.hidden=false; };

  // 제출 — 서버(/api/bugs)에 접수한다. 실패하면 복사하기로 물러난다.
  $('#bugSend').onclick=async()=>{
    const b=gather();
    if(!b.text){ $('#bugText').focus(); say('내용을 적어 주세요',true); return; }
    const btn=$('#bugSend'); btn.disabled=true; btn.textContent='보내는 중…';
    try{
      const r=await fetch('/api/bugs',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(b)});
      if(!r.ok) throw new Error(await r.text());
      say('✓ 접수되었습니다 — 관리자 › 오류 신고함에서 볼 수 있습니다');
      $('#bugText').value=''; btn.textContent='📮 제출하기';
      if(S.view==='stats') loadBugs();
      setTimeout(()=>{ box.hidden=true; },1600);
    }catch(e){
      say('접수가 안 됩니다 — 복사해서 보내 주세요',true);
      btn.disabled=false; btn.textContent='📮 다시 보내기';
      $('#bugCopy').hidden=false;
    }
  };
  // 물러날 자리 — 서버가 막혔을 때 메신저·메일로 보내도록
  $('#bugCopy').onclick=async()=>{
    const txt=asText(gather());
    try{ await navigator.clipboard.writeText(txt); }
    catch(e){ const ta=$('#bugText'); ta.value=txt; ta.select(); document.execCommand('copy'); }
    say('✓ 복사했습니다 — 053-668-2454 로 보내 주세요');
  };
})();

/* ── 관리자 · 오류 신고함 ── */
const BUGKIND={'오류':'오류','결과이상':'결과 이상','불편':'불편','건의':'건의'};
function bugWhen(iso){
  const d=new Date(iso), p=x=>String(x).padStart(2,'0');
  return d.getFullYear()+'.'+p(d.getMonth()+1)+'.'+p(d.getDate())+' '+p(d.getHours())+':'+p(d.getMinutes());
}
async function loadBugs(){
  const wrap=$('#bugList'), meta=$('#bugMeta'); if(!wrap) return;
  wrap.innerHTML='<p class="hint">불러오는 중…</p>'; meta.textContent='';
  try{
    const r=await fetch('/api/bugs',{cache:'no-store'});
    if(!r.ok) throw new Error(r.status);
    const {list=[]}=await r.json();
    if(!list.length){ wrap.innerHTML='<p class="hint">아직 접수된 내용이 없습니다.</p>'; meta.textContent='0건'; return; }
    meta.textContent=list.length+'건 · 최근 '+bugWhen(list[0].at);
    wrap.innerHTML=list.map(b=>
      '<div class="bugitem">'+
        '<div class="bh">'+
          '<span class="kd k'+(b.kind||'')+'">'+(BUGKIND[b.kind]||'기타')+'</span>'+
          '<b>'+esc(b.where||'화면 미지정')+'</b>'+
          '<span class="at">'+bugWhen(b.at)+'</span>'+
        '</div>'+
        '<p class="bt">'+esc(b.text).replace(/\n/g,'<br>')+'</p>'+
        (b.who?'<p class="bw">보낸 사람 · '+esc(b.who)+'</p>':'')+
      '</div>').join('');
  }catch(e){
    wrap.innerHTML='<p class="hint">목록을 불러오지 못했습니다. 잠시 뒤 다시 눌러 주세요.</p>';
    meta.textContent='';
  }
}
if($('#bugReload')) $('#bugReload').onclick=loadBugs;

$('#btnNoti').onclick=()=>{ $('#notiN').hidden=true; S.mode='home'; document.body.dataset.mode='home'; go('news'); }; $('#goModel').onclick=()=>{ $('#mSet').hidden=true; setMode('admin'); go('model'); };
$$('[data-close]').forEach(b=>b.onclick=()=>b.closest('.modal').hidden=true); $$('.modal').forEach(m=>m.onclick=e=>{ if(e.target===m&&m.id!=='mIntro'){ m.hidden=true; if(m.id==='mVideo') closeVideo(); } });
$$('#mVideo [data-close]').forEach(b=>b.onclick=closeVideo);
$('#btnTheme').onclick=()=>{ const l=document.body.dataset.theme!=='light'; document.body.dataset.theme=l?'light':'dark'; $('#btnTheme').textContent=l?'🌙':'☀️'; try{localStorage.setItem('dOnTheme',l?'light':'dark');}catch(e){} };
try{ const th=localStorage.getItem('dOnTheme'); if(th){ document.body.dataset.theme=th; $('#btnTheme').textContent=th==='light'?'🌙':'☀️'; } }catch(e){}

init().catch(e=>{ addMsg('ai','자료 색인을 불러오지 못했습니다: '+e.message); });
})();

// 사이트를 열 때 AI 생성 함수를 미리 깨워 둔다 (Netlify 콜드스타트 → 경조사 카드에서 바로 눌러도 지연 없이)
try{ fetch("/api/card",{method:"POST",headers:{"content-type":"application/json"},body:"{\"ping\":1}"}).catch(()=>{}); fetch("/api/card-run",{method:"POST",headers:{"content-type":"application/json"},body:"{\"id\":\"warm\"}"}).catch(()=>{}); }catch(e){}


/* ---------- 출장비(관내여비) 계산하기: 필요한 라이브러리(약 3.6MB)는 메뉴를 처음 열 때만 읽는다 ---------- */
let TRIP_LOADED=null;
function loadTrip(){
  if(TRIP_LOADED) return TRIP_LOADED;
  const files=['vendor/xlsx.full.min.js','vendor/pdf.min.js','vendor/exceljs.min.js','vendor/html2canvas.min.js','vendor/jspdf.umd.min.js','trip.js'];
  const one=src=>new Promise((ok,no)=>{ const el=document.createElement('script'); el.src=src; el.onload=ok; el.onerror=()=>no(new Error(src)); document.head.appendChild(el); });
  const msg=document.querySelector('#trip #readMsg'); if(msg) msg.innerHTML='<div class="msg">출장비 계산 모듈을 불러오는 중…</div>';
  TRIP_LOADED=files.reduce((p,f)=>p.then(()=>(f==='trip.js'&&window.pdfjsLib&&(window.pdfjsLib.GlobalWorkerOptions.workerSrc='vendor/pdf.worker.min.js'),one(f))),Promise.resolve()).then(()=>{ if(msg) msg.innerHTML=''; }).catch(e=>{ TRIP_LOADED=null; if(msg) msg.innerHTML='<div class="msg err">모듈을 불러오지 못했습니다: '+e.message+'</div>'; });
  return TRIP_LOADED;
}
