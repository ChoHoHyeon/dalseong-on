/* ═══════════════════════════════════════════════════════════════════
   달성On — 경조사 카드 만들기 (family.js v2 · "카드 먼저, 글은 나중")
   ① 사진(원본 / AI 일러스트) → ② 틀 고르기(기본 틀 즉시 · AI 틀은 누를 때마다 추가) → ③ 내용 입력(적는 대로 즉시 반영) → 내려받기
   · AI는 글자를 그리지 않는다: 사진 합성·장식·빈 자리까지만(틀). 글자는 브라우저가 얹는다 → 글자 오류 없음, 수정 무료
   · 사진·계좌는 브라우저 안에서만 처리. AI 틀·일러스트를 고를 때만(동의 후) 사진이 OpenAI로 전송
   · 서버: /api/card(접수·조회) + card-run(백그라운드 생성) · 시안·기획: 09_경조사 카드 폴더
   ═══════════════════════════════════════════════════════════════════ */
(function(){
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const F={kind:'wed', step:0, photo:null, pw:0, ph:0, illusts:[], pic:null, picKind:'photo', frames:[], frame:null, img:'', orient:'auto', tkind:'wed', theme:null, hist:[]};
const DOW=['일','월','화','수','목','금','토'];
const esc=s=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

/* ── 날짜 서식 ── */
function pd(v){ if(!v) return null; const d=new Date(v); return isNaN(d)?null:d; }
function fDate(v){ const d=pd(v); return d?`${d.getFullYear()}. ${d.getMonth()+1}. ${d.getDate()}.(${DOW[d.getDay()]})`:'○○○○. ○. ○.(○)'; }
function fDateTime(v){ const d=pd(v); if(!d) return '○○○○. ○. ○.(○) ○○:○○'; const h=d.getHours(), m=d.getMinutes(); const ap=h<12?'오전':'오후'; const hh=h%12||12; return `${d.getFullYear()}. ${d.getMonth()+1}. ${d.getDate()}.(${DOW[d.getDay()]}) ${ap} ${hh}시${m?` ${m}분`:''}`; }
function fTime24(v){ const d=pd(v); return d?`${d.getFullYear()}. ${d.getMonth()+1}. ${d.getDate()}.(${DOW[d.getDay()]}) ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`:'○○○○. ○. ○.(○) ○○:○○'; }
function fShort(v){ const d=pd(v); return d?`${d.getMonth()+1}/${d.getDate()}(${DOW[d.getDay()]})`:'○/○(○)'; }
function today(){ const d=new Date(); return `${d.getFullYear()}. ${d.getMonth()+1}. ${d.getDate()}.`; }

/* ── 입력 폼 ── */
const REL_WED=['장녀','장남','차녀','차남','딸','아들','본인(신랑)','본인(신부)'];
/* 본인 결혼: 배우자 표기 — 공무원이면 소속·직위로, 아니면 이름 + 군/양(본인 성별의 반대) */
function spouseTxt(d,html){ const e=html?esc:(x=>x); if(!d.spouse) return ''; if(d.spouseDept) return `${e(d.spouseDept)} ${e(d.spouse)}${d.spouseTitle?' '+e(d.spouseTitle):''}`; return `${e(d.spouse)} ${d.sh}`; }
const isDaughter=r=>/녀|딸/.test(r||'');
const REL_OBIT=['부친','모친','시부','시모','장인','장모','빙부','빙모','조부','조모','배우자','본인'];
const v=id=>{ const e=document.getElementById(id); return e?e.value.trim():''; };
const ck=id=>{ const e=document.getElementById(id); return !!(e&&e.checked); };

/* ── 데이터 수집 ── */
const who=d=> d.title? `${d.dept} ${d.name} ${d.title}` : `${d.dept} ${d.name}`;

/* ── 게시글 제목 · 본문 ── */
function postTitle(d){
  if(d.kind==='wed'){ if(d.rel==='본인'&&d.spouse&&d.spouseDept) return `${d.name}♥${d.spouse}[${fShort(d.when)}, ♥결혼♥, ${d.dept}/${d.spouseDept}]`; return `${d.name}[${fShort(d.when)}, ${d.rel==='본인'?'♥결혼♥':'자녀혼사'}, ${d.dept}${d.title?' '+d.title:''}]`; }
  if(d.kind==='obit') return `${d.name}[${fShort(d.ddate)}, ${d.rel}상, ${d.dept}]`;
  return `감사의 인사를 드립니다(${d.dept} ${d.name})`;
}
function line(k,val){ return val?`○ ${k} : ${val}\n`:''; }
function postBody(d){
  if(d.kind==='wed'){
    const subj = d.rel==='본인' ? (d.spouse ? `${who(d)}과 ${spouseTxt(d)}의 결혼식을` : `${who(d)}의 결혼식을`) : `${who(d)}의 ${d.rel} ${d.child} ${d.ch}과 ${d.partner} ${d.ph}의 결혼식을`;
    return `${subj} 아래와 같이 알려드리오니\n두 사람의 앞날을 축복해 주시면 감사하겠습니다.\n\n`
      + line('일 시',fDateTime(d.when)) + line('장 소',d.place+(d.addr?` (${d.addr})`:'')) + line('연락처',d.tel) + line('마음 전하실 곳',d.bank)
      + `\n${d.wdateS}\n${d.sender}${d.sender2?'\n'+d.sender2:''}`;
  }
  if(d.kind==='obit'){
    const subj = d.rel==='본인' ? `${who(d)}께서` : `${who(d)}의 ${d.rel}께서`;
    let t=`삼가 알려드립니다.\n\n${subj}\n${fDate(d.ddate)} 별세하셨음을 알려드립니다.\n\n`;
    t+= line('빈   소',d.place+(d.addr?` (${d.addr})`:'')) + line('발   인',d.balin?fTime24(d.balin):'') + line('장   지',d.jangji) + line('연락처',d.tel) + line('마음 전하실 곳',d.bank);
    if(d.noVisit) t+=`\n※ 가족장으로 조문과 조의는 정중히 사양하오니 양해 부탁드립니다.\n`;
    return t+`\n${d.wdateS}\n${d.sender}`;
  }
  const dd=pd(d.edate); const ds=dd?`${dd.getMonth()+1}월 ${dd.getDate()}일`:'○월 ○일';
  if(d.tkind==='wed') return `감사의 인사를 올립니다.\n\n지난 ${ds} 저희 ${d.rel2||'○○'}의 결혼식에\n귀한 걸음 해 주시고 축복과 격려를 보내주셔서\n진심으로 감사드립니다.\n\n직접 찾아뵙고 인사드리는 것이 도리이오나\n감사의 마음을 글로 대신함을\n너그러이 이해하여 주시기 바랍니다.\n\n앞으로 귀댁의 대소사에 꼭 연락 주시어\n감사함에 보답할 수 있는 기회를 주시기 바랍니다.\n\n늘 건강하시고 행복하시기를 기원합니다.\n\n${d.wdateS}\n${d.dept} ${d.name} ${d.close}`;
  return `삼가 감사의 인사를 드립니다.\n\n이번 저희 ${d.rel2||'○○상'}에 바쁘신 가운데에도\n따뜻한 위로와 조의를 보내주신 모든 분들께\n진심으로 감사드립니다.\n\n보내주신 위로와 격려 덕분에\n큰 슬픔 속에서도 무사히 장례를 마칠 수 있었습니다.\n\n마땅히 찾아뵙고 인사드리는 것이 도리이나\n경황이 없어 서면으로 감사의 말씀을 전해드림을\n너그러이 이해해 주시기 바랍니다.\n\n항상 가정에 건강과 평안이 함께하시기를 기원합니다.\n\n${d.wdateS}\n${d.dept} ${d.name} ${d.close==='올림'?'배상':d.close}`;
}

/* ═══ 카드 부품 ═══ */
const WED_THEMES={
  green: {name:'그린 보태니컬', bg:'#f8f6ef', paper:'#fffdf7', ink:'#2f3a2f', sub:'#6b7a68', accent:'#5f7d5b', line:'#b9c6b4'},
  flower:{name:'참꽃',         bg:'#fbf3f4', paper:'#fffafa', ink:'#3a2a30', sub:'#7c5a66', accent:'#c9407a', line:'#e6b8c8'},
  mono:  {name:'흑백 미니멀',   bg:'#f2f2f2', paper:'#ffffff', ink:'#1a1a1a', sub:'#707070', accent:'#1a1a1a', line:'#d0d0d0'},
  gold:  {name:'골드 클래식',   bg:'#f4efe4', paper:'#fffcf5', ink:'#3b3225', sub:'#8a7a5c', accent:'#b8933f', line:'#d9c48f'},
  pastel:{name:'파스텔 팝',     bg:'#eef4ff', paper:'#ffffff', ink:'#2b3557', sub:'#6f7aa6', accent:'#5b7cf0', line:'#c9d6ff'},
  rose:  {name:'로즈 수채',     bg:'#fdf4f2', paper:'#fffbfa', ink:'#4a2f33', sub:'#8c6a70', accent:'#c86b7c', line:'#efc9cf'},
};
const WED_LAYOUTS={L1:'가로 · 사진 왼쪽', L2:'세로 · 사진 위', L3:'세로 · 일러스트', L4:'사진 없이 · 꽃 프레임'};
const OBIT_THEMES={gray:'회색 국화 프레임', hanji:'한지 흰 국화'};
const TH_THEMES={wed:{arch:'플로럴 아치', wreath:'미니멀 리스'}, fun:{dark:'국화 다크', light:'국화 라이트'}};

/* SVG 장식 */
function euca(color,flip){ let l=''; for(let i=0;i<7;i++){ const y=30+i*32,s=1-i*.06; l+=`<ellipse cx="${22+i*28}" cy="${y}" rx="${18*s}" ry="${11*s}" transform="rotate(-35 ${22+i*28} ${y})" fill="${color}" opacity="${.85-i*.05}"/><ellipse cx="${40+i*28}" cy="${y-22}" rx="${16*s}" ry="${10*s}" transform="rotate(25 ${40+i*28} ${y-22})" fill="${color}" opacity="${.7-i*.05}"/>`; }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="260" height="260" viewBox="0 0 260 260"><g transform="${flip?'scale(-1,1) translate(-260,0)':''}"><path d="M10 40 Q120 70 240 220" stroke="${color}" stroke-width="2.5" fill="none" opacity=".8"/>${l}</g></svg>`; }
function rnd(seed){ let s=seed*9301+49297; return ()=>{ s=(s*9301+49297)%233280; return s/233280; }; }
function azalea(seed){ const r=rnd(seed); let o=''; for(let k=0;k<5;k++){ const cx=40+Math.floor(r()*150),cy=40+Math.floor(r()*150),R=22+Math.floor(r()*14),rot=Math.floor(r()*72); let p=''; for(let i=0;i<5;i++) p+=`<ellipse cx="0" cy="-${R*.7}" rx="${R*.55}" ry="${R*.9}" transform="rotate(${rot+i*72})" fill="#e9739f" opacity=".88"/>`; let st=''; for(let i=0;i<6;i++){ const a=(rot+200+i*22)*Math.PI/180; st+=`<line x1="0" y1="0" x2="${(Math.cos(a)*R*.6).toFixed(1)}" y2="${(Math.sin(a)*R*.6).toFixed(1)}" stroke="#a8325f" stroke-width="1.2"/><circle cx="${(Math.cos(a)*R*.6).toFixed(1)}" cy="${(Math.sin(a)*R*.6).toFixed(1)}" r="2" fill="#a8325f"/>`; } o+=`<g transform="translate(${cx},${cy})">${p}<circle r="${R*.18}" fill="#a8325f" opacity=".9"/>${st}</g>`; }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240"><path d="M20 230 Q90 150 200 60" stroke="#a8325f" stroke-width="2" fill="none" opacity=".5"/>${o}</svg>`; }
function monoCorner(){ return `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><path d="M40 150 V40 H150" stroke="#1a1a1a" stroke-width="1.5" fill="none"/><path d="M52 150 V52 H150" stroke="#1a1a1a" stroke-width=".6" fill="none" opacity=".5"/><path d="M44 38 v12 M38 44 h12" stroke="#1a1a1a" stroke-width="1.2"/></svg>`; }
function goldFlourish(){ const g='#b8933f'; return `<svg xmlns="http://www.w3.org/2000/svg" width="260" height="260" viewBox="0 0 260 260" fill="none" stroke="${g}" stroke-width="2" stroke-linecap="round"><path d="M30 200 C30 120 80 90 130 80 C170 72 200 90 200 110 C200 130 180 135 170 125 C160 115 175 100 190 108"/><path d="M30 200 C60 180 90 200 100 230" opacity=".8"/><path d="M130 80 C150 60 190 50 220 40" opacity=".9"/><path d="M60 150 C80 140 95 150 100 165" opacity=".7"/><circle cx="220" cy="40" r="3" fill="${g}"/><circle cx="100" cy="230" r="3" fill="${g}"/><circle cx="190" cy="108" r="2.5" fill="${g}"/><path d="M40 60 v-14 M33 53 h14" opacity=".7"/><path d="M230 210 v-10 M225 205 h10" opacity=".7"/></svg>`; }
function confetti(seed){ const r=rnd(seed), cols=['#ffb3c7','#a5c8ff','#ffe08a','#b8f0d6','#d9c6ff']; let o=''; for(let i=0;i<22;i++){ const x=10+Math.floor(r()*240),y=10+Math.floor(r()*240),c=cols[Math.floor(r()*5)]; o+= r()<.25? `<path transform="translate(${x},${y}) scale(${(.5+r()*.4).toFixed(2)})" d="M0 6 C-8 -2 -8 -10 0 -6 C8 -10 8 -2 0 6Z" fill="${c}"/>` : `<circle cx="${x}" cy="${y}" r="${4+Math.floor(r()*8)}" fill="${c}" opacity=".9"/>`; } return `<svg xmlns="http://www.w3.org/2000/svg" width="260" height="260" viewBox="0 0 260 260">${o}</svg>`; }
function roseBloom(seed){ const r=rnd(seed); let o=''; for(let k=0;k<3;k++){ const cx=60+Math.floor(r()*120),cy=60+Math.floor(r()*120),R=34+Math.floor(r()*14); for(let ring=4;ring>=1;ring--){ const rr=R*ring/4,col=['#f4c6cc','#efadb6','#e5919e','#d97a89'][ring-1]; for(let i=0;i<6;i++){ const a=i*60+ring*17,ra=a*Math.PI/180; o+=`<ellipse cx="${(cx+Math.cos(ra)*rr*.35).toFixed(1)}" cy="${(cy+Math.sin(ra)*rr*.35).toFixed(1)}" rx="${(rr*.6).toFixed(1)}" ry="${(rr*.42).toFixed(1)}" transform="rotate(${a} ${cx} ${cy})" fill="${col}" opacity=".75"/>`; } } o+=`<circle cx="${cx}" cy="${cy}" r="${(R*.12).toFixed(1)}" fill="#c96a7a" opacity=".8"/>`; for(let j=0;j<2;j++){ const a=Math.floor(r()*360),ra=a*Math.PI/180,lx=(cx+Math.cos(ra)*R*1.1).toFixed(1),ly=(cy+Math.sin(ra)*R*1.1).toFixed(1); o+=`<ellipse cx="${lx}" cy="${ly}" rx="${(R*.55).toFixed(1)}" ry="${(R*.25).toFixed(1)}" transform="rotate(${a} ${lx} ${ly})" fill="#9bb894" opacity=".7"/>`; } } return `<svg xmlns="http://www.w3.org/2000/svg" width="260" height="260" viewBox="0 0 260 260">${o}</svg>`; }
function mum(cx,cy,R,fill,stroke,rings){ let o=''; for(let ring=(rings||3);ring>=1;ring--){ const rr=R*(.55+.15*ring),off=ring*7; for(let i=0;i<18;i++){ const a=i*20+off,ra=a*Math.PI/180,x=(cx+Math.cos(ra)*rr*.5).toFixed(1),y=(cy+Math.sin(ra)*rr*.5).toFixed(1); o+=`<ellipse cx="${x}" cy="${y}" rx="${(rr*.52).toFixed(1)}" ry="${(rr*.11).toFixed(1)}" transform="rotate(${a} ${x} ${y})" fill="${fill}" stroke="${stroke}" stroke-width=".8" opacity=".97"/>`; } } return o+`<circle cx="${cx}" cy="${cy}" r="${(R*.16).toFixed(1)}" fill="#e9dfb0"/>`; }
function leaf(cx,cy,a,L,col){ return `<ellipse cx="${cx}" cy="${cy}" rx="${L}" ry="${(L*.36).toFixed(1)}" transform="rotate(${a} ${cx} ${cy})" fill="${col}" opacity=".85"/>`; }
function mums(w,fill,stroke,lc){ fill=fill||'#fffdf6'; stroke=stroke||'#d9d4c3'; lc=lc||'#6f8a6a'; return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${w}" viewBox="0 0 300 300">${leaf(120,150,-40,60,lc)}${leaf(200,120,30,55,lc)}${leaf(90,90,-80,45,lc)}${mum(110,110,44,fill,stroke)}${mum(190,150,52,fill,stroke)}${mum(120,200,36,fill,stroke,2)}</svg>`; }
function wreath(w){ let o=''; for(let i=0;i<28;i++){ const a=i*360/28,ra=a*Math.PI/180,cx=(180+Math.cos(ra)*120).toFixed(1),cy=(180+Math.sin(ra)*120).toFixed(1); o+=`<ellipse cx="${cx}" cy="${cy}" rx="22" ry="9" transform="rotate(${a+90} ${cx} ${cy})" fill="#9db08f" opacity="${.6+.4*(i%2)}"/>`; if(i%4===0) o+=`<circle cx="${cx}" cy="${cy}" r="7" fill="#f2b8c6"/>`; } return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${w}" viewBox="0 0 360 360">${o}</svg>`; }
function arch(w){ const r=rnd(7), cols=['#f6c1cc','#f3a9b9','#fde0c8','#ffffff']; let o=''; for(let i=0;i<16;i++){ const a=200+i*10,ra=a*Math.PI/180,cx=(160+Math.cos(ra)*135).toFixed(1),cy=(190+Math.sin(ra)*135).toFixed(1); o+=leaf(cx,cy,a+90,26,'#9fb79a')+`<circle cx="${cx}" cy="${cy}" r="${7+Math.floor(r()*6)}" fill="${cols[Math.floor(r()*4)]}" stroke="#e8a6b6" stroke-width=".6"/>`; } return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${w}" viewBox="0 0 320 320">${o}</svg>`; }
function ribbon(){ return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 80 80"><path d="M40 10 c-16 0 -22 14 -14 26 l-14 34 h10 l12 -26 6 4 6 -4 12 26 h10 l-14 -34 c8 -12 2 -26 -14 -26z" fill="#1a1a1a"/><circle cx="40" cy="24" r="7" fill="#fff" opacity=".9"/></svg>`; }

function deco(theme, corner, big){
  const sd={tl:1,tr:2,bl:3,br:4}[corner]; let s;
  if(theme==='green') s=euca(WED_THEMES.green.accent, corner==='tr'||corner==='br');
  else if(theme==='flower') s=azalea(sd); else if(theme==='mono') s=monoCorner(); else if(theme==='gold') s=goldFlourish();
  else if(theme==='pastel') s=confetti(sd); else s=roseBloom(sd);
  if(big) s=s.replace('width="260" height="260"','width="380" height="380"').replace('width="240" height="240"','width="360" height="360"').replace('width="200" height="200"','width="300" height="300"');
  let off = (theme==='mono'||theme==='gold') ? (big?'10px':'6px') : (big?'-70px':'-46px');
  const pos={tl:`top:${off};left:${off}`, tr:`top:${off};right:${off};transform:scaleX(-1)`, bl:`bottom:${off};left:${off};transform:scaleY(-1)`, br:`bottom:${off};right:${off};transform:scale(-1,-1)`}[corner];
  return `<div style="position:absolute;z-index:3;${pos}">${s}</div>`;
}
const FONT_SANS="'Malgun Gothic','맑은 고딕','Noto Sans CJK KR','Noto Sans KR',sans-serif";
const FONT_SERIF="'Batang','바탕','Noto Serif CJK KR','Noto Serif KR',serif";
const FONT_GUNGSUH="'Gungsuh','궁서','Batang','Noto Serif CJK KR',serif";
const FONT_ENG="'Georgia','Lora','Times New Roman',serif";

/* ── 결혼 카드 ── */
function wedCard(d, layout, theme, photo, illust){
  const t=WED_THEMES[theme];
  const css=`.dc{font-family:${FONT_SANS};color:${t.ink};position:relative;overflow:hidden;background:${t.bg}}
  .dc *{box-sizing:border-box;margin:0;padding:0}
  .dc .paper{background:${t.paper};box-shadow:0 2px 24px rgba(0,0,0,.06)}
  .dc .eng{font-family:${FONT_ENG};font-style:italic;color:${t.accent};letter-spacing:.5px}
  .dc .kt{font-family:${FONT_SERIF};color:${t.accent};letter-spacing:6px;font-size:15px}
  .dc .lead{font-family:${FONT_SERIF};font-size:24px;line-height:1.7;word-break:keep-all}
  .dc .lead b{font-weight:700}
  .dc .info{margin-top:22px;border-top:1px solid ${t.line};border-bottom:1px solid ${t.line};padding:18px 0;font-size:19.5px;line-height:1.85}
  .dc .info .k{display:inline-block;width:150px;color:${t.sub};letter-spacing:2px;white-space:nowrap}
  .dc .info small{color:${t.sub};font-size:15px}.dc .addr{margin-top:-6px;line-height:1.5}
  .dc .sender{margin-top:26px;font-family:${FONT_SERIF};font-size:22px;letter-spacing:2px}
  .dc .orn{color:${t.accent};font-size:18px;letter-spacing:6px;margin:8px 0}`;
  const subj = d.rel==='본인' ? (d.spouse ? `<b>${esc(who(d))}</b>과<br><b>${spouseTxt(d,1)}</b>의 결혼식을 알려드리오니` : `<b>${esc(who(d))}</b>의 결혼식을 알려드리오니`) : `<b>${esc(who(d))}</b>의 ${esc(d.rel)}<br><b>${esc(d.child)}</b> ${d.ch}과 <b>${esc(d.partner)}</b> ${d.ph}의 결혼식을 알려드리오니`;
  const body=`<div class="lead">${subj}<br>두 사람의 앞날을 축복해 주시면 감사하겠습니다.</div>
  <div class="info"><div><span class="k">일 시</span>${esc(fDateTime(d.when))}</div><div><span class="k">장 소</span>${esc(d.place)}</div>${d.addr?`<div class="addr"><span class="k"></span><small>${esc(d.addr)}</small></div>`:''}${d.tel?`<div><span class="k">연락처</span>${esc(d.tel)}</div>`:''}${d.bank&&d.bankImg?`<div><span class="k">마음 전하실 곳</span>${esc(d.bank)}</div>`:''}</div>
  <div class="sender">${esc(d.sender)}${d.sender2?'<br/>'+esc(d.sender2):''}</div>`;
  const pic = illust||photo;
  let W,H,inner;
  if(layout==='L1'){ W=1200;H=800; inner=`${deco(theme,'tr')}${deco(theme,'bl')}<div class="paper" style="position:relative;z-index:2;height:100%;display:flex;gap:44px;padding:36px;margin:44px">
   <div style="flex:0 0 470px;border-radius:6px;overflow:hidden"><img src="${pic}" style="width:100%;height:100%;object-fit:cover;display:block"/></div>
   <div style="flex:1;display:flex;flex-direction:column;justify-content:center"><div class="eng" style="font-size:44px;line-height:1.1">Wedding<br/>Invitation</div><div class="kt" style="margin:10px 0 22px">결혼식 안내</div>${body}</div></div>`;
   inner=inner.replace('height:100%;display:flex;gap:44px;padding:36px;margin:44px','height:712px;display:flex;gap:44px;padding:36px;margin:44px'); }
  else if(layout==='L2'){ W=800;H=1150; inner=`${deco(theme,'tl')}${deco(theme,'br')}<div class="paper" style="position:relative;z-index:2;height:1070px;margin:40px;padding:34px 46px;text-align:center">
   <div style="height:465px;border-radius:6px;overflow:hidden;margin-bottom:20px"><img src="${pic}" style="width:100%;height:100%;object-fit:cover;object-position:50% 20%;display:block"/></div>
   <div class="eng" style="font-size:38px">Wedding Invitation</div><div class="orn">❦</div><div style="text-align:left;margin-top:6px">${body}</div></div>`; }
  else if(layout==='L3'){ W=800;H=1150; inner=`${deco(theme,'tl')}${deco(theme,'br')}<div class="paper" style="position:relative;z-index:2;height:1070px;margin:40px;padding:40px 50px;text-align:center;border:1px solid ${t.line};outline:1px solid ${t.line};outline-offset:-8px">
   <div class="eng" style="font-size:44px">Wedding Invitation</div><div class="kt" style="margin:8px 0 14px">우리의 특별한 날</div>
   <img src="${pic}" style="height:430px;object-fit:contain;mix-blend-mode:multiply;display:inline-block"/><div style="text-align:left;margin-top:8px">${body}</div></div>`; }
  else { W=800;H=1150; inner=`${deco(theme,'tl',1)}${deco(theme,'br',1)}<div style="position:absolute;left:38px;top:38px;right:38px;bottom:38px;border:1.5px solid ${t.line};z-index:1"></div><div style="position:absolute;left:48px;top:48px;right:48px;bottom:48px;border:1px solid ${t.line};z-index:1"></div>
   <div style="position:relative;z-index:2;height:100%;padding:0 110px;text-align:center;display:flex;flex-direction:column;justify-content:center"><div class="eng" style="font-size:60px;line-height:1.1">Wedding<br/>Invitation</div><div class="orn" style="margin:22px 0 34px">— ❦ —</div><div style="text-align:left">${body}</div></div>`; }
  return {W,H,html:`<div class="dc" style="width:${W}px;height:${H}px;${layout==='L4'?`background:${t.paper}`:''}"><style>${css}</style>${inner}</div>`};
}

/* ── 부고 카드 ── */
function obitCard(d, theme){
  const W=1000,H=720;
  const css=`.dc{position:relative;overflow:hidden;font-family:${FONT_SANS};color:#222}.dc *{box-sizing:border-box;margin:0;padding:0}.dc .s{font-family:${FONT_GUNGSUH}}.dc pre{font-family:${FONT_GUNGSUH};white-space:pre-wrap;line-height:1.95;font-size:17.5px;margin:26px auto 0;width:560px}`;
  const subj = d.rel==='본인' ? `${esc(who(d))}께서` : `${esc(who(d))}의 ${esc(d.rel)}께서`;
  const items = [['빈   소', d.place+(d.addr?`\n             (${d.addr})`:'')],['발   인', d.balin?fTime24(d.balin):''],['장   지', d.jangji],['연락처', d.tel],['마음 전하실 곳', d.bank]].filter(x=>x[1]).map(x=>`○ ${esc(x[0])} : ${esc(x[1])}`).join('\n');
  const body=`<div class="s" style="text-align:center;font-size:36px;font-weight:700;letter-spacing:6px">삼가 알려드립니다.</div>
  <div class="s" style="text-align:center;font-size:20px;line-height:1.8;margin-top:18px">${subj}<br/>${esc(fDate(d.ddate))} 별세하셨음을 알려드립니다.</div>
  <pre>${items}${d.noVisit?'\n\n※ 가족장으로 조문과 조의는 정중히 사양하오니 양해 부탁드립니다.':''}</pre>
  <div class="s" style="text-align:center;margin-top:26px;font-size:17px">${esc(d.wdateS)}</div><div class="s" style="text-align:center;margin-top:4px;font-size:27px;font-weight:700;letter-spacing:7px">${esc(d.sender)}</div>`;
  let inner;
  if(theme==='gray') inner=`<div style="position:absolute;left:34px;top:34px;right:34px;bottom:34px;z-index:2;background:#fbfaf6;border:8px double #cfcbc0;padding:40px 60px">${body}</div><div style="position:absolute;left:8px;top:6px;z-index:3">${mums(230)}</div><div style="position:absolute;right:8px;bottom:6px;z-index:3;transform:scale(-1,-1)">${mums(230)}</div>`;
  else inner=`<div style="position:absolute;left:0;top:0;right:0;bottom:0;background:radial-gradient(ellipse at 20% 30%,rgba(255,255,255,.7),transparent 50%),radial-gradient(ellipse at 80% 70%,rgba(255,255,255,.6),transparent 50%)"></div><div style="position:absolute;left:26px;top:26px;right:26px;bottom:26px;border:1px solid #b9b2a2"></div><div style="position:absolute;left:34px;top:34px;right:34px;bottom:34px;border:1px solid #d6cfbf"></div><div style="position:absolute;left:-20px;bottom:-30px;z-index:3">${mums(300,'#ffffff','#dcd6c4','#7a8f74')}</div><div style="position:absolute;right:30px;top:24px;z-index:3">${ribbon()}</div><div style="position:relative;z-index:2;height:100%;padding:56px 60px 0 300px">${body}</div>`;
  return {W,H,html:`<div class="dc" style="width:${W}px;height:${H}px;background:${theme==='gray'?'linear-gradient(160deg,#6e7075,#4a4c52)':'#f5f1e8'}"><style>${css}</style>${inner}</div>`};
}

/* ── 감사 인사 카드 ── */
function thanksCard(d, theme){
  const W=800,H=1000, text=postBody(d).split('\n'); const head=text[0]; const rest=text.slice(1);
  const para=rest.map(l=>l?esc(l):'<div style="height:12px"></div>').join('<br/>').replace(/<div style="height:12px"><\/div><br\/>/g,'<div style="height:12px"></div>');
  const css=`.dc{position:relative;overflow:hidden;font-family:${FONT_SANS}}.dc *{box-sizing:border-box;margin:0;padding:0}.dc .s{font-family:${FONT_SERIF}}`;
  let inner,bg;
  if(theme==='dark'){ bg='#2b2d31'; inner=`<div style="position:absolute;left:-60px;top:-60px">${mums(240,'#fbfaf3','#c9c4b4','#5f6e5c')}</div><div style="position:absolute;right:-30px;bottom:-20px;transform:scale(-1,-1)">${mums(240,'#fbfaf3','#c9c4b4','#5f6e5c')}</div><div style="position:relative;z-index:2;text-align:center;padding:110px 70px 0"><div class="s" style="font-size:36px;font-weight:700;letter-spacing:3px;color:#fff">${esc(head)}</div><div style="width:60px;height:1px;background:#b9b3a0;margin:26px auto"></div><div class="s" style="font-size:19px;line-height:1.9;color:#e9e6dc">${para}</div></div>`; }
  else if(theme==='light'){ bg='#fbfaf6'; inner=`<div style="position:absolute;left:24px;top:24px;right:24px;bottom:24px;border:1px solid #cfc9b8"></div><div style="position:absolute;left:32px;top:32px;right:32px;bottom:32px;border:1px solid #e3ded0"></div><div style="position:absolute;right:-30px;top:-10px">${mums(260,'#ffffff','#d5cfbd','#8b9a83')}</div><div style="position:absolute;left:-40px;bottom:-30px">${mums(260,'#ffffff','#d5cfbd','#8b9a83')}</div><div style="position:relative;z-index:2;text-align:center;padding:120px 70px 0"><div class="s" style="font-size:36px;font-weight:700;letter-spacing:3px;color:#2f2f2f">${esc(head)}</div><div style="width:60px;height:1px;background:#a9a390;margin:26px auto"></div><div class="s" style="font-size:19px;line-height:1.9;color:#3a3a3a">${para}</div></div>`; }
  else if(theme==='arch'){ bg='#fff7f5'; inner=`<div style="position:absolute;left:200px;top:-10px">${arch(400)}</div><div style="position:relative;z-index:2;text-align:center;padding:275px 70px 0"><div class="s" style="font-size:34px;font-weight:700;letter-spacing:2px;color:#7a3a48">${esc(head)}</div><div style="color:#d38a9a;margin:14px 0 22px;letter-spacing:8px">❦</div><div class="s" style="font-size:18.5px;line-height:1.9;color:#4a3236">${para}</div></div>`; }
  else { bg='#ffffff'; inner=`<div style="position:absolute;left:30px;top:30px;right:30px;bottom:30px;border:1px solid #dfe5da"></div><div style="position:absolute;left:285px;top:44px">${wreath(230)}</div><div style="position:relative;z-index:2;text-align:center;padding:60px 70px 0"><div style="font-family:${FONT_ENG};font-style:italic;font-size:26px;color:#6d8467;height:150px;display:flex;align-items:center;justify-content:center">Thank you</div><div class="s" style="font-size:30px;font-weight:700;letter-spacing:2px;color:#2f3a2f;margin-top:20px">${esc(head)}</div><div style="width:50px;height:1px;background:#9db08f;margin:22px auto"></div><div class="s" style="font-size:18px;line-height:1.9;color:#3f4a3f">${para}</div></div>`; }
  return {W,H,html:`<div class="dc" style="width:${W}px;height:${H}px;background:${bg}"><style>${css}</style>${inner}</div>`};
}

/* ── 렌더: HTML → SVG foreignObject → canvas → PNG ── */
function toXhtml(html){ const box=document.createElement('div'); box.innerHTML=html; const node=box.firstElementChild; node.setAttribute('xmlns','http://www.w3.org/1999/xhtml'); return new XMLSerializer().serializeToString(node); }
function renderPng(card, scale){
  return new Promise((res,rej)=>{
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${card.W}" height="${card.H}"><foreignObject width="100%" height="100%">${toXhtml(card.html)}</foreignObject></svg>`;
    const img=new Image(); img.onload=()=>{ const c=document.createElement('canvas'); c.width=card.W*scale; c.height=card.H*scale; const g=c.getContext('2d'); g.scale(scale,scale); g.drawImage(img,0,0); try{ res(c.toDataURL('image/png')); }catch(e){ rej(e); } };
    img.onerror=()=>rej(new Error('render')); img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
  });
}

/* ── 자동 선택 ── */
function pick(arr,seed){ return arr[Math.floor(rnd(seed)()*arr.length)%arr.length]; }
function autoWed(d, seed){
  const hasPic=!!(F.photo||d.illust);
  let layouts = d.illust ? ['L3'] : hasPic ? (F.pw>=F.ph ? ['L2','L1'] : ['L1','L2','L1']) : ['L4'];
  if(hasPic && !d.illust && d.orient==='portrait') layouts=['L2']; if(hasPic && !d.illust && d.orient==='landscape') layouts=['L1'];
  let themes=Object.keys(WED_THEMES);
  if(F.photo&&F.tone){ const t=F.tone; themes = t==='pink'?['rose','flower','rose','pastel']: t==='green'?['green','green','gold']: t==='dark'?['mono','gold','mono']: t==='blue'?['pastel','mono','green']: t==='warm'?['gold','green','rose']: themes; }
  return {layout:pick(layouts,seed), theme:pick(themes,seed+11)};
}
function photoTone(dataUrl){ const im=new Image(); im.onload=()=>{ const c=document.createElement('canvas'); c.width=c.height=24; const g=c.getContext('2d'); g.drawImage(im,0,0,24,24); const px=g.getImageData(0,0,24,24).data; let r=0,gg=0,b=0,n=0; for(let i=0;i<px.length;i+=4){ r+=px[i];gg+=px[i+1];b+=px[i+2];n++; } r/=n;gg/=n;b/=n; const mx=Math.max(r,gg,b),mn=Math.min(r,gg,b),sat=mx?(mx-mn)/mx:0,lum=(r+gg+b)/3; F.tone = sat<.12 ? (lum<110?'dark':'neutral') : (r>gg&&r>b ? (gg>b*1.1?'warm':'pink') : gg>=r&&gg>=b ? 'green':'blue'); F.pw=im.naturalWidth; F.ph=im.naturalHeight; }; im.src=dataUrl; }

/* ── 화면 ── */
/* ═══ 화면 ═══ */
const STEPS={wed:[['photo','사진'],['text','내용 입력']], obit:[['text','내용 입력']], thanks:[['text','내용 입력']]};
const consentStored=()=>true; /* 시연판: 동의 절차 없음 (본 구축 시 추가) */
function toastF(m){ if(window.toast) toast(m); else { const st=$('#famAiStatus')||$('#famNote'); if(st){ st.hidden=false; st.textContent=m; } else console.log(m); } }
let _ldT=null;
function loading(on, title, sub){ const L=$('#famLoad'); if(!L) return; clearInterval(_ldT); if(!on){ L.hidden=true; return; } L.hidden=false; const t0=Date.now(); const T=$('#famLoadT'), S=$('#famLoadS'); T.textContent=title; S.textContent=sub; _ldT=setInterval(()=>{ T.textContent=`${title} ${Math.round((Date.now()-t0)/1000)}초`; },1000); }
function build(){
  const root=$('#famApp'); if(!root||root.dataset.built) return; root.dataset.built=1;
  root.innerHTML=`
  <div class="fam3-head"><div class="fam2-tabs" id="famKinds"><button class="on" data-k="wed">💐 결혼</button><button data-k="obit">🕊 부고</button><button data-k="thanks">🙏 감사 인사</button></div>
   <span class="hint" style="opacity:.7"><a href="#" id="famFill">샘플 채우기</a> · <a href="#" id="famEmpty">비우기</a></span></div>
  <div class="fam3-steps"><span id="famSteps" class="row" style="gap:8px;margin:0"></span><span id="famOrientWrap" style="margin-left:18px;padding-left:18px;border-left:1px solid var(--line)">${orientSeg('카드 방향')}</span></div>
  <div class="fam3-cols">
   <div class="fam3-left">
    <div class="card fam3-main" id="famMain"></div></div>
   <div class="fam3-side">
    <div class="card fam2-card"><div class="fam-pvwrap"><div class="fam-preview" id="famPreview"></div><div class="fam-load" id="famLoad" hidden><div class="spin"></div><b id="famLoadT">AI가 그리는 중…</b><small id="famLoadS">기다리는 동안 내용을 입력해 주세요</small></div></div>
     <div class="row rw fam2-bar"><span class="hint" id="famNote"></span><span class="row" id="famAiChips" style="gap:4px;margin:0"></span><span style="flex:1"></span><a href="#" id="famPickTgl" hidden style="display:none">기본 디자인</a><a href="#" id="famShowTxt" hidden style="display:none">게시글</a></div>
     <div class="fam3-frames strip" id="f_frames" hidden></div>
     <div id="famTextWrap" hidden><div class="fam-post"><b>📋 새올 게시글</b><span class="hint">제목은 게시판 관례 서식으로 자동 · 카드는 내려받아 첨부</span></div>
      <div class="fam-copy" style="margin-top:6px"><span class="hint" style="white-space:nowrap">제목</span><input id="famTitle" readonly><button class="ghost sm" data-copy="famTitle">복사</button></div>
      <div class="fam-copy col" style="margin-top:6px"><span class="hint" style="white-space:nowrap;padding-top:8px">본문</span><textarea id="famBody" rows="9" readonly></textarea><button class="ghost sm" data-copy="famBody">복사</button></div></div>
     </div>
   </div></div>`;
  $$('#famKinds button').forEach(b=>b.onclick=()=>{ $$('#famKinds button').forEach(x=>x.classList.toggle('on',x===b)); F.kind=b.dataset.k; resetKind(); });
  $('#famShowTxt').onclick=e=>{ e.preventDefault(); showPost(!$('#famTextWrap').hidden?false:true); };
  bindOrient(); $('#famPickTgl').onclick=e=>{ e.preventDefault(); const b=$('#f_frames'); b.hidden=!b.hidden; if(!b.hidden) renderFrames(); };
  $('#famPreview').onclick=()=>{ if(!F.img) return; let m=$('#mCard'); if(!m){ m=document.createElement('div'); m.className='modal'; m.id='mCard'; m.innerHTML='<div class="box cardbox"><div class="box-h"><b>카드 미리보기</b><button class="x" data-close>✕</button></div><img></div>'; document.body.appendChild(m); m.onclick=e=>{ if(e.target===m||e.target.closest('[data-close]')) m.hidden=true; }; } m.querySelector('img').src=F.img; m.hidden=false; };
  $('#famFill').onclick=e=>{ e.preventDefault(); F.noSample=false; F.data=null; if(F.kind==='wed'&&!F.photo) loadSamplePhoto(); goStep(F.kind==='wed'?0:0); };
  $('#famEmpty').onclick=e=>{ e.preventDefault(); F.noSample=true; F.data=null; resetKind(); };
  root.addEventListener('click',e=>{ const b=e.target.closest('[data-copy]'); if(!b) return; const el=document.getElementById(b.dataset.copy); (navigator.clipboard?navigator.clipboard.writeText(el.value):Promise.reject()).then(()=>toastF('복사했습니다'),()=>{ el.select(); document.execCommand('copy'); toastF('복사했습니다'); }); });
  probeAI(); resetKind();
}
function resetKind(){ F.consent=consentStored(); F.aiStarted=null; F.autoAI=false; F.photo=null; F.illusts=[]; F.pic=null; F.picKind='photo'; F.frames=[]; F.frame=null; F.img=''; F.theme=null; F.data=null; F.form=null; goStep(0); }
function goStep(i){
  F.step=i; const steps=STEPS[F.kind];
  $('#famSteps').innerHTML=steps.map(([id,label],k)=>`<button class="fam3-step ${k===i?'cur':k<i?'done':''}" data-i="${k}"><i>${k<i?'✓':k+1}</i><b>${label}</b></button>`).join('<span class="fam3-arrow">›</span>');
  $$('#famSteps .fam3-step').forEach(b=>b.onclick=()=>{ const k=+b.dataset.i; if(k===F.step) return; if(k<=maxStep()){ if($('#famForm')) F.form=snapshot(); goStep(k); } });
  const id=steps[i][0]; if(id==='photo') panelPhoto(); else panelText();
  refresh();
}
function maxStep(){ if(F.kind==='wed') return (F.pic||F.noPhoto)?1:0; return 0; }

/* 방향 선택 (사진 단계·내용 단계 공용) — 바꾸면 AI 틀을 새 방향으로 다시 그린다 */
function orientSeg(lbl){ return `<span class="row rw" style="gap:8px;margin:0"><span class="hint">${lbl||'방향'}</span><div class="seg2" id="f_orient"><button type="button" data-v="auto" class="${F.orient==='auto'?'on':''}">자동</button><button type="button" data-v="portrait" class="${F.orient==='portrait'?'on':''}">세로</button><button type="button" data-v="landscape" class="${F.orient==='landscape'?'on':''}">가로</button></div></span>`; }
/* 방향을 바꿔도 AI를 바로 돌리지 않는다 — 기본 디자인만 새 방향으로 다시 그리고, AI는 「AI 한 장 더」를 누를 때 그 방향으로 */
function bindOrient(){ const ori=$('#f_orient'); if(!ori) return; $$('#f_orient button').forEach(b=>b.onclick=()=>{ if(F.orient===b.dataset.v) return; F.orient=b.dataset.v; $$('#f_orient button').forEach(x=>x.classList.toggle('on',x===b)); if(F.step>0||F.kind!=='wed'){ const cur=F.frames[F.frame]; const ai=F.frames.filter(f=>f.kind==='ai'); F.frames=tplFrames().concat(ai); if(cur&&cur.kind==='ai') F.frame=F.frames.indexOf(cur); renderFrames(); } refresh(); }); }

/* ── ① 사진 ── */
function panelPhoto(){
  const m=$('#famMain');
  m.innerHTML=`<h4>① 사진 <small>없어도 됩니다 — 없으면 꽃 배경 디자인으로 만듭니다</small></h4>
   <div class="row rw"><label class="filebtn">📷 사진 올리기<input type="file" id="f_photo" accept="image/*"></label><button class="ghost" id="f_sample" type="button">샘플 사진</button><span class="hint" id="f_photoNote">${F.photo?'':'브라우저 안에서만 처리됩니다 · 끌어다 놓아도 됩니다'}</span></div>
   <div class="fam3-body" id="f_drop">
    <div class="fam3-pics" id="f_pics"></div>
    <div class="fam3-empty" ${F.photo?'hidden':''}><div class="fam3-drop-ico">📷</div><small>사진을 올리면 여기에 보입니다</small></div>
   </div>
   <div id="f_picBox" class="fam-ai" style="margin-top:12px"><div class="row rw"><b>🎨 사진을 일러스트로 바꾸기</b><span class="hint">AI · 30~40초 · 선택</span><span class="hint" id="famAiNote"></span></div>
    <div class="row rw" style="margin-top:8px"><button class="ghost" data-ill="water">수채 일러스트</button><button class="ghost" data-ill="chic">화보풍 (길고 날씬하게)</button><button class="ghost" data-ill="line">라인 드로잉</button></div></div>
   <div class="row rw fam3-foot" id="f_nextRow" style="justify-content:flex-end"><span class="row rw" style="gap:8px"><button class="primary big" id="f_nextPlain" style="background:var(--panel,#fff);color:var(--tx);border:1.5px solid var(--line);box-shadow:none">AI 없이 내용 입력 ›</button><button class="primary big" id="f_next">🤖 AI 디자인 만들기 ›</button></span></div>`;
  const onFile=f=>{ if(!f||!f.type.startsWith('image/')) return; const r=new FileReader(); r.onload=()=>setPhoto(r.result,f.name); r.readAsDataURL(f); };
  $('#f_photo').onchange=e=>onFile(e.target.files[0]);
  const t2=$('#f_picTools label'); if(t2) t2.onclick=()=>$('#f_photo').click();
  const dz=$('#f_drop'); dz.ondragover=e=>{ e.preventDefault(); dz.classList.add('over'); }; dz.ondragleave=()=>dz.classList.remove('over'); dz.ondrop=e=>{ e.preventDefault(); dz.classList.remove('over'); onFile(e.dataTransfer.files[0]); };
  $('#f_sample').onclick=loadSamplePhoto;
  const needPhoto=()=>{ if(F.photo) return false; const n=$('#f_photoNote'); n.textContent='먼저 사진을 올려 주세요'; n.classList.add('warn'); $('#f_drop .fam3-empty')?.classList.add('shake'); setTimeout(()=>{ n.classList.remove('warn'); $('#f_drop .fam3-empty')?.classList.remove('shake'); },1600); return true; };
  $('#f_next').onclick=()=>{ if(!F.photo){ F.noPhoto=true; F.pic=null; } F.autoAI=true; goStep(1); }; $('#f_nextPlain').onclick=()=>{ if(!F.photo){ F.noPhoto=true; F.pic=null; } F.autoAI=false; goStep(1); };
  $$('#famMain [data-ill]').forEach(b=>b.onclick=()=>{ if(needPhoto()) return; makeIllust(b.dataset.ill); });
  renderPics(); probeAI();
}
function loadSamplePhoto(){ fetch('assets/family_sample.jpg').then(r=>r.blob()).then(b=>{ const r=new FileReader(); r.onload=()=>setPhoto(r.result,'샘플 사진'); r.readAsDataURL(b); }); }
function setPhoto(dataUrl,name){ F.photo=dataUrl; F.pic=dataUrl; F.picKind='photo'; F.noPhoto=false; F.illusts=[]; F.frames=[]; F.frame=null; F.aiStarted=null; photoTone(dataUrl); const n=$('#f_photoNote'); if(n){ n.textContent=''; n.classList.remove('warn'); } const b=$('#f_picBox'); if(b) b.hidden=false; const e=$('#f_drop .fam3-empty'); if(e) e.hidden=true; const r=$('#f_nextRow'); if(r) r.hidden=false; renderPics(); setTimeout(refresh,250); }
function renderPics(){
  const box=$('#f_pics'); if(!box) return;
  const items=[{src:F.photo,label:'원본 사진',key:'photo'}].concat(F.illusts.map((u,i)=>({src:u.src,label:u.label,key:'ill'+i,pending:u.pending})));
  box.innerHTML=items.filter(x=>x.src||x.pending).map(x=>`<button class="fam3-pic ${F.pic===x.src?'on':''}" data-key="${x.key}">${x.pending?'<div class="fam-wait small"><div class="spin"></div><small>그리는 중…</small></div>':`<img src="${x.src}">`}<small>${x.label}</small></button>`).join('');
  $$('#f_pics .fam3-pic').forEach(b=>b.onclick=()=>{ const k=b.dataset.key; const it=items.find(x=>x.key===k); if(!it||!it.src) return; F.pic=it.src; F.picKind=k==='photo'?'photo':'illust'; F.frames=[]; F.frame=null; renderPics(); refresh(); });
}
const ILL_PROMPT={
  water:'Convert this photo into a warm hand-drawn illustration: soft watercolor and ink line style. Keep the same pose, composition, clothing, hairstyles and facial features so the people are clearly recognizable. Gentle pastel colors, clean plain white background, no text.',
  chic:'Turn this photo into an elegant fashion-illustration artwork. Keep the faces, hairstyles and expressions faithful so friends instantly recognize them, but idealize the figures: slightly elongated, tall and slender proportions like a fashion sketch, graceful posture. Refined ink lines with soft watercolor washes and a touch of gold, luminous mood, clean white background, no text.',
  line:'Convert this photo into a minimal single-line ink drawing with a few soft blush accents. Keep the pose and facial features recognizable. Clean white background, no text.'};
async function makeIllust(style){
  if(!F.ai){ toastF('AI 생성 서버가 준비되지 않았습니다'); return; }
  const label={water:'수채',chic:'화보풍',line:'라인'}[style]+' 일러스트'; const slot={src:'',label,pending:true}; F.illusts.push(slot); renderPics();
  loading(true,`🎨 ${label} 그리는 중…`,'보통 30~40초 · 완성되면 왼쪽 후보에 추가되고 오른쪽에 크게 보입니다');
  try{ const img=await aiJob({prompt:ILL_PROMPT[style], photo:F.photo, size:'auto'}); slot.src=img; slot.pending=false; F.pic=img; F.picKind='illust'; F.frames=[]; F.frame=null; F.aiStarted=null; renderPics(); refresh(); }
  catch(e){ F.illusts=F.illusts.filter(x=>x!==slot); renderPics(); const n=$('#famAiNote'); if(n) n.textContent='일러스트 실패: '+e.message.slice(0,160); }
  finally{ loading(false); }
}

/* ── ② 틀 고르기 ── */
const FRAME_STYLES=['soft watercolor Korean azalea (진달래·참꽃) blossoms in pink with eucalyptus leaves on warm cream paper','green botanical eucalyptus and small white flowers on airy white paper with thin sage lines','blush pink watercolor roses and peonies, romantic and soft','ivory paper with a thin gold line frame and delicate gold flourishes, classic','black and white minimal with generous white space and a hairline frame','light pastel confetti and tiny hearts, bright and cheerful with sky-blue accents'];
function orient(){ if(F.orient!=='auto') return F.orient; if(F.kind!=='wed'||!F.pic) return 'portrait'; return F.pw>F.ph?'landscape':'portrait'; }
function tplFrames(){
  const d=F.data||collect(); const o=orient(); const out=[];
  if(F.kind==='wed'){ const lay=F.pic?(o==='landscape'?'L1':'L2'):'L4'; for(const t of Object.keys(WED_THEMES)) out.push({id:'tpl-'+t,kind:'tpl',label:WED_THEMES[t].name,render:dd=>wedCard(dd,lay,t,F.pic||'',F.picKind==='illust'?F.pic:null)}); }
  else if(F.kind==='obit'){ out.push({id:'txt',kind:'txt',label:'텍스트만 (기본)',render:null}); for(const t of Object.keys(OBIT_THEMES)) out.push({id:'tpl-'+t,kind:'tpl',label:OBIT_THEMES[t],render:dd=>obitCard(dd,t)}); }
  else { const ks=TH_THEMES[F.tkind]; for(const t of Object.keys(ks)) out.push({id:'tpl-'+t,kind:'tpl',label:ks[t],render:dd=>thanksCard(Object.assign({},dd,{tkind:F.tkind}),t)}); }
  return out;
}
/* 틀 자동 준비: 기본 틀은 사진 색감·방향으로 자동 선택, AI 틀은 동의 시 뒤에서 1장 */
function ensureFrames(){
  const ai=F.frames.filter(f=>f.kind==='ai'); F.frames=tplFrames().concat(ai);
  if(F.frame==null||F.frame>=F.frames.length){
    if(F.kind==='wed'){ const a=autoWed(F.data||collect(),0); const keys=Object.keys(WED_THEMES); F.frame=Math.max(0,keys.indexOf(a.theme)); }
    else if(F.kind==='obit') F.frame=0; else F.frame=0;
  }
  const key=(F.pic||'')+'|'+orient()+'|'+F.kind+'|'+F.tkind;
  if(F.autoAI&&F.ai&&F.aiStarted!==key&&F.kind==='wed'){ F.aiStarted=key; makeFrame(true); }
}
/* 만들어 둔 AI 디자인들을 카드 아래에서 바로 고르게 하는 작은 선택 칩 */
function renderAiChips(){ const c=$('#famAiChips'); if(!c) return; const ais=F.frames.map((f,i)=>({f,i})).filter(x=>x.f.kind==='ai'&&!x.f.pending); if(ais.length<2){ c.innerHTML=''; return; }
  const fr=F.frames[F.frame]; if(fr&&fr.kind==='ai') $('#famNote').textContent='';
  c.innerHTML='<span class="hint" style="margin-right:2px">🤖 AI 디자인</span>'+ais.map((x,n)=>`<button type="button" class="ghost sm ${F.frame===x.i?'on':''}" data-i="${x.i}" style="min-width:30px;padding:2px 8px;${F.frame===x.i?'background:var(--acc);color:#fff;border-color:var(--acc)':''}">${n+1}</button>`).join('');
  $$('#famAiChips button').forEach(b=>b.onclick=()=>{ F.frame=+b.dataset.i; renderFrames(); refresh(); }); }
function renderFrames(){
  const box=$('#f_frames'); if(!box) return; const d=F.data||collect();
  box.innerHTML=F.frames.map((f,i)=>`<button class="fam3-frame ${F.frame===i?'on':''} ${f.kind}" data-i="${i}"><span class="fam-th">${f.pending?'<div class="fam-wait small"><div class="spin"></div><small id="fw'+i+'">그리는 중…</small></div>':f.kind==='txt'?'<div class="fam3-txt">가<br><small>텍스트</small></div>':''}</span><small>${f.kind==='ai'?'🤖 ':''}${f.label}</small></button>`).join('');
  F.frames.forEach((f,i)=>{ if(f.pending||f.kind==='txt') return; const th=box.querySelector(`[data-i="${i}"] .fam-th`); if(f.thumb){ th.innerHTML=`<img src="${f.thumb}">`; return; } const card=f.render(d); renderPng(card,0.32).then(u=>{ f.thumb=u; th.innerHTML=`<img src="${u}">`; }).catch(()=>{ th.textContent='미리보기 불가'; }); });
  $$('#f_frames .fam3-frame').forEach(b=>b.onclick=()=>{ const i=+b.dataset.i; if(F.frames[i].pending) return; F.frame=i; $$('#f_frames .fam3-frame').forEach(x=>x.classList.toggle('on',+x.dataset.i===i)); refresh(); });
}
function framePrompt(){
  const o=orient(); const st=FRAME_STYLES[(F.frames.filter(f=>f.kind==='ai').length+(F.data?.name||'').length)%FRAME_STYLES.length]; const mood=F.mood?` The user asks for: "${F.mood}".`:'';
  if(F.kind==='wed'&&F.pic){
    const where = o==='landscape' ? 'Place the couple photo on the LEFT half of the card (about 45% width, full height, softly framed). Leave the ENTIRE RIGHT half as a clean, plain, light paper area with NO objects there' : 'Place the couple photo in the TOP part of the card (about the upper 50%). Leave the ENTIRE BOTTOM 45% as a clean, plain, light paper area with NO objects there';
    return `Design a wedding invitation card BACKGROUND (a template, not a finished card) using the attached ${F.picKind==='illust'?'illustration':'photo'} of the couple. Keep their faces exactly. Style: ${st}.${mood} ${where} — that empty area is reserved for text that will be added later. Decorations (flowers, leaves, lines) may sit only near the corners and around the photo. ABSOLUTELY NO TEXT, NO LETTERS, NO WORDS, NO NUMBERS anywhere in the image. High quality, print-ready, balanced margins.`;
  }
  if(F.kind==='wed') return `Design a wedding invitation card BACKGROUND (template, no photo, no people). Style: ${st}.${mood} Decorations only near the edges and corners; the whole center must stay a clean, plain, light paper area for text to be added later. ABSOLUTELY NO TEXT, NO LETTERS, NO WORDS anywhere. High quality, print-ready.`;
  if(F.kind==='obit') return `Design a Korean funeral notice card BACKGROUND (template). Solemn and respectful: white chrysanthemums, grey/ivory paper, thin frame line.${mood} Decorations only near the corners; the whole center must stay a clean, plain, light area for text to be added later. No people. ABSOLUTELY NO TEXT, NO LETTERS, NO WORDS anywhere.`;
  return `Design a Korean thank-you card BACKGROUND (template) ${F.tkind==='fun'?'after a funeral: quiet, respectful, white chrysanthemums, muted ivory/grey tones':'after a wedding: warm, soft flowers, gentle pastel tones'}.${mood} Decorations only near the edges; the whole center must stay a clean, plain, light area for text to be added later. No people. ABSOLUTELY NO TEXT, NO LETTERS, NO WORDS anywhere.`;
}
/* 생성 횟수 제한(카드당·하루)은 테스트 기간 동안 두지 않는다 — 정식 전환 시 서버(계정 기준)에서 건다 */
async function makeFrame(auto){
  if(!F.ai){ toastF('AI 생성 서버가 준비되지 않았습니다'); return; }
  const o=orient(); const size=o==='landscape'?'1536x1024':'1024x1536'; const n=F.frames.filter(f=>f.kind==='ai').length+1;
  const slot={id:'ai'+Date.now(),kind:'ai',label:'AI 디자인 '+n,pending:true}; F.frames.push(slot); renderFrames();
  const idx=F.frames.indexOf(slot); const t0=Date.now(); const st=$('#famAiStatus'); const tick=setInterval(()=>{ const sec=Math.round((Date.now()-t0)/1000); const e=document.getElementById('fw'+idx); if(e) e.textContent=sec+'초 · 보통 30~60초'; },1000);
  if(st) st.hidden=true; loading(true,'🤖 AI 디자인을 그리는 중…','보통 30~60초 · 기다리는 동안 내용을 입력해 주세요 — 완성되면 카드가 바뀝니다');
  try{
    const img=await aiJob({prompt:framePrompt(), photo:(F.kind==='wed'&&F.pic)?F.pic:null, size});
    const W=o==='landscape'?1536:1024, H=o==='landscape'?1024:1536;
    const area = (F.kind==='wed'&&F.pic) ? (o==='landscape'?{x:.50,y:.10,w:.46,h:.80}:{x:.09,y:.56,w:.82,h:.40}) : {x:.12,y:.14,w:.76,h:.72};
    const ink=await regionInk(img,W,H,area);
    slot.img=img; slot.W=W; slot.H=H; slot.area=area; slot.ink=ink; slot.pending=false; slot.render=dd=>overlayCard(slot,dd);
    F.frame=idx; renderFrames(); await refresh();
    if(st) st.hidden=true;
  }catch(e){ F.frames=F.frames.filter(x=>x!==slot); renderFrames(); if(st){ st.hidden=false; st.textContent='AI 디자인 생성 실패: '+e.message+' — 기본 디자인으로 계속 진행됩니다'; } if(!auto) toastF('AI 디자인 실패: '+e.message); }
  finally{ clearInterval(tick); loading(false); }
}
function regionInk(src,W,H,a){ return new Promise(res=>{ const im=new Image(); im.onload=()=>{ try{ const c=document.createElement('canvas'); c.width=24;c.height=24; const g=c.getContext('2d'); g.drawImage(im, a.x*im.naturalWidth, a.y*im.naturalHeight, a.w*im.naturalWidth, a.h*im.naturalHeight, 0,0,24,24); const px=g.getImageData(0,0,24,24).data; let l=0,n=0; for(let i=0;i<px.length;i+=4){ l+=(px[i]*.3+px[i+1]*.59+px[i+2]*.11); n++; } res(l/n<120?'light':'dark'); }catch(e){ res('dark'); } }; im.onerror=()=>res('dark'); im.src=src; }); }
/* AI 틀 위에 글자 얹기 */
function overlayCard(fr,d){
  const W=fr.W,H=fr.H,a=fr.area; const dark=fr.ink==='dark';
  // 글자 크기: 카드 짧은 변 800px 기준으로 비례 확대 (AI 틀 1024·1536 → 1.28배) — 사용자가 크기를 고르지 않으므로 넉넉하게
  const k=Math.min(W,H)/800; const px=n=>Math.round(n*k*10)/10+'px'; const low=a.h<0.5; /* 세로+사진(글자 영역이 낮음)은 영문 제목을 한 줄로 */ const ink=dark?'#2b2b2b':'#ffffff', sub=dark?'#6b6b6b':'rgba(255,255,255,.8)', line=dark?'rgba(0,0,0,.18)':'rgba(255,255,255,.4)', acc=dark?'#8a6a4a':'#fff';
  const css=`.dc{position:relative;overflow:hidden;font-family:${FONT_SANS};color:${ink}}.dc *{box-sizing:border-box;margin:0;padding:0}.dc .eng{font-family:${FONT_ENG};font-style:italic;color:${acc}}.dc .s{font-family:${FONT_SERIF};word-break:keep-all}.dc .info div{word-break:keep-all}.dc .k{display:inline-block;width:${px(150)};color:${sub};letter-spacing:2px;white-space:nowrap}.dc .info{border-top:1px solid ${line};border-bottom:1px solid ${line};padding:${px(16)} 0;margin-top:${px(18)};line-height:1.85}.dc .info small{color:${sub};font-size:${px(15)}}.dc .addr{margin-top:${px(-6)};line-height:1.5}`;
  let body='';
  if(d.kind==='wed'){
    const subj = d.rel==='본인' ? (d.spouse ? `<b>${esc(who(d))}</b>과<br/><b>${spouseTxt(d,1)}</b>의 결혼식을 알려드리오니` : `<b>${esc(who(d))}</b>의 결혼식을 알려드리오니`) : `<b>${esc(who(d))}</b>의 ${esc(d.rel)}<br/><b>${esc(d.child)}</b> ${d.ch}과 <b>${esc(d.partner)}</b> ${d.ph}의 결혼식을 알려드리오니`;
    body=`<div class="eng" style="font-size:${px(low?40:48)};line-height:1.1">Wedding${low?' ':'<br/>'}Invitation</div>
    <div class="s" style="font-size:${px(24)};line-height:1.7;margin-top:${px(22)}">${subj}<br/>두 사람의 앞날을 축복해 주시면 감사하겠습니다.</div>
    <div class="info" style="font-size:${px(19.5)}"><div><span class="k">일 시</span>${esc(fDateTime(d.when))}</div><div><span class="k">장 소</span>${esc(d.place)}</div>${d.addr?`<div class="addr"><span class="k"></span><small>${esc(d.addr)}</small></div>`:''}${d.tel?`<div><span class="k">연락처</span>${esc(d.tel)}</div>`:''}${d.bank&&d.bankImg?`<div><span class="k">마음 전하실 곳</span>${esc(d.bank)}</div>`:''}</div>
    <div class="s" style="font-size:${px(22)};letter-spacing:2px;margin-top:${px(22)}">${esc(d.sender)}${d.sender2?'<br/>'+esc(d.sender2):''}</div>`;
  } else {
    const lines=postBody(d).split('\n'); const head=lines[0]; const rest=lines.slice(1);
    const para=rest.map(l=>l?esc(l):'<div style="height:10px"></div>').join('<br/>').replace(/<div style="height:10px"><\/div><br\/>/g,'<div style="height:10px"></div>');
    body=`<div class="s" style="font-size:${px(36)};font-weight:700;letter-spacing:4px;text-align:center">${esc(head)}</div><div style="width:60px;height:1px;background:${line};margin:${px(22)} auto"></div><div class="s" style="font-size:${px(d.kind==='obit'?19.5:19)};line-height:1.9;text-align:center">${para}</div>`;
  }
  const html=`<div class="dc" style="width:${W}px;height:${H}px"><style>${css}</style><img src="${fr.img}" style="position:absolute;left:0;top:0;width:${W}px;height:${H}px;display:block"/><div style="position:absolute;left:${Math.round(a.x*W)}px;top:${Math.round(a.y*H)}px;width:${Math.round(a.w*W)}px;height:${Math.round(a.h*H)}px;display:flex;flex-direction:column;justify-content:center">${body}</div></div>`;
  return {W,H,html};
}

/* ── ③ 내용 입력 ── */
function panelText(){
  const m=$('#famMain'); const wed=F.kind==='wed';
  m.innerHTML=`<h4>${wed?'②':'①'} 내용 입력 <small>적는 대로 오른쪽 카드에 바로 적용됩니다</small></h4>
   <div class="row rw" style="margin-bottom:10px">
    ${F.kind==='thanks'?`<div class="seg2" id="f_tkind"><button data-v="wed" class="${F.tkind==='wed'?'on':''}">결혼 감사</button><button data-v="fun" class="${F.tkind==='fun'?'on':''}">조문 감사</button></div>`:''}
    ${F.kind==='obit'?`<label class="chk"><input type="checkbox" id="f_obitImg" ${F.frame&&F.frame>0?'checked':''}> <span>텍스트에 더해 <b>이미지 카드도</b> 만들기 <span class="hint">· 부고는 텍스트가 기본</span></span></label>`:''}
    <span class="hint" id="famAiStatus" hidden></span></div>
   <div id="famForm"></div>
   <div class="row rw fam3-foot" style="justify-content:space-between"><span></span><span class="row rw" style="gap:8px"><button class="primary big" id="famMore" type="button" hidden style="background:var(--panel,#fff);color:var(--tx);border:1.5px solid var(--line);box-shadow:none" title="AI가 다른 분위기의 디자인을 한 장 더 그립니다">✨ 다른 분위기로 한 장 더</button><button class="primary big" id="f_done">완료 카드 내려받기 ⬇</button></span></div>`;
  $('#famMore').onclick=()=>makeFrame();
  const tk=$('#f_tkind'); if(tk) $$('#f_tkind button').forEach(b=>b.onclick=()=>{ F.tkind=b.dataset.v; F.frame=null; F.frames=F.frames.filter(f=>f.kind!=='ai'); $$('#f_tkind button').forEach(x=>x.classList.toggle('on',x===b)); ensureFrames(); refresh(); });
  const ob=$('#f_obitImg'); if(ob) ob.onchange=()=>{ F.frame=ob.checked?1:0; ensureFrames(); refresh(); };
  const f=$('#famForm'); f.innerHTML=formHtml(F.kind); f.oninput=liveUpdate; f.onchange=liveUpdate;
  try{ const mem=JSON.parse(localStorage.getItem('dOnFam')||'{}'); ['f_dept','f_name','f_title','f_sender'].forEach(id=>{ const e=document.getElementById(id); if(e&&mem[id]&&!e.value) e.value=mem[id]; }); }catch(e){}
  if(F.form) Object.entries(F.form).forEach(([id,val])=>{ const e=document.getElementById(id); if(e) e.value=val; });
  const fg=$('#f_forget'); if(fg) fg.onclick=e=>{ e.preventDefault(); localStorage.removeItem('dOnFam'); ['f_dept','f_name','f_title','f_sender'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; }); toastF('기억한 값을 지웠습니다'); liveUpdate(); };
  // 관계에 따라 이름 칸 라벨을 바꾼다 — 「신부/신랑」으로 두면 아들 결혼에 아들 이름을 신부 칸에 적는 실수가 잦다
  const rel=$('#f_rel'); if(rel&&wed){ const sync=()=>{ const self=rel.value.startsWith('본인'); const sl=$('#f_spouseLbl'); if(sl) sl.innerHTML=rel.value.includes('신부')?'신랑 이름 <small>배우자</small>':'신부 이름 <small>배우자</small>'; $$('#famForm .wchild').forEach(x=>x.hidden=self); $$('#famForm .wself').forEach(x=>x.hidden=!self); const so=$('#f_spouseOff'); $$('#famForm .wselfOff').forEach(x=>x.hidden=!(self&&so&&so.value==='y'));
    const dau=isDaughter(rel.value); const cl=$('#f_childLbl'), pl=$('#f_partnerLbl'); if(cl) cl.innerHTML=dau?'딸 이름 <small>신부</small>':'아들 이름 <small>신랑</small>'; if(pl) pl.innerHTML=dau?'신랑 이름 <small>상대측</small>':'신부 이름 <small>상대측</small>';
    const ci=$('#f_child'), pi=$('#f_partner'); if(ci) ci.placeholder=dau?'김하늘':'박비슬'; if(pi) pi.placeholder=dau?'박비슬':'김하늘'; }; rel.addEventListener('change',sync); const so=$('#f_spouseOff'); if(so) so.addEventListener('change',sync); sync(); }
  if(!F.noSample&&!F.form) fillSample();
  $('#f_done').onclick=()=>{ F.form=snapshot(); try{ localStorage.setItem('dOnFam',JSON.stringify({f_dept:v('f_dept'),f_name:v('f_name'),f_title:v('f_title'),f_sender:v('f_sender')})); }catch(e){} download(); if(F.img){ showPost(true); const t=$('#famTitle').value; (navigator.clipboard?navigator.clipboard.writeText(t):Promise.reject()).then(()=>toastF('카드를 저장했습니다 · 게시글 제목도 복사해 두었습니다 — 새올 제목란에 붙여넣기(Ctrl+V)'),()=>toastF('카드를 저장했습니다 · 아래 제목을 복사해 새올에 올려 주세요')); } };
  ensureFrames(); liveUpdate();
}
function snapshot(){ const o={}; $$('#famForm input,#famForm select').forEach(e=>{ if(e.type==='checkbox') o[e.id]=e.checked; else if(e.id) o[e.id]=e.value; }); return o; }
const SAMPLE={
  wed:{f_dept:'정보통신과',f_name:'김달성',f_title:'주무관',f_rel:'장녀',f_child:'김하늘',f_partner:'박비슬',f_when:'2026-11-07T13:00',f_place:'노비아갈라 동촌 포레야홀',f_addr:'대구광역시 동구 동촌로 87',f_tel:'010-0000-0000',f_bank:'iM뱅크 000-00-000000 (김달성)',f_sender:'정보통신과장 김정보'},
  obit:{f_dept:'정보통신과',f_name:'김달성',f_title:'주무관',f_rel:'부친',f_ddate:'2026-11-03',f_place:'대구전문장례식장 특1호실',f_addr:'대구 동구 금호강변로 71',f_balin:'2026-11-05T08:00',f_jangji:'대구명복공원',f_tel:'김달성 (010-0000-0000)',f_bank:'iM뱅크 000-00-000000 (김달성)',f_sender:'정보통신과장 김정보'},
  thanks:{f_dept:'정보통신과',f_name:'김달성',f_title:'주무관',f_edate:'2026-11-07',f_rel2:'딸 하늘이',f_close:'올림'}};
function fillSample(){ const m=SAMPLE[F.kind]||{}; Object.entries(m).forEach(([id,val])=>{ const e=document.getElementById(id); if(e) e.value=val; }); const rel=$('#f_rel'); if(rel) rel.dispatchEvent(new Event('change')); }
function formHtml(kind){
  const common=`<div class="g3"><label><b>소속</b><input id="f_dept" placeholder="정보통신과"></label><label><b>이름</b><input id="f_name" placeholder="김달성"></label><label><b>직위</b><input id="f_title" placeholder="주무관 · 前 ○○과장"></label></div>`;
  const sender=`<div class="grp"><b>발신 명의</b><div class="g2"><label><b>부서장</b><input id="f_sender" placeholder="정보통신과장 김정보"></label></div><p class="hint">소속·이름·직위·부서장은 이 PC에 기억해 두었다가 다음에 채워 줍니다 · <a href="#" id="f_forget">기억 지우기</a></p></div>`;
  if(kind==='wed') return `${common}<div class="g3" style="margin-top:10px"><label><b>관계</b><select id="f_rel">${REL_WED.map(r=>`<option>${r}</option>`).join('')}</select></label><label class="wchild"><b id="f_childLbl">자녀 이름</b><input id="f_child" placeholder="김하늘"></label><label class="wchild"><b id="f_partnerLbl">배우자 이름</b><input id="f_partner" placeholder="박비슬"></label><label class="wself" hidden><b id="f_spouseLbl">배우자 이름</b><input id="f_spouse" placeholder="박비슬"></label><label class="wself" hidden><b>배우자도 공무원인가요?</b><select id="f_spouseOff"><option value="">아니요</option><option value="y">예</option></select></label></div>
   <div class="g3 wselfOff" hidden style="margin-top:10px"><label><b>배우자 소속</b><input id="f_spouseDept" placeholder="수성구 범어동"></label><label><b>배우자 직위</b><input id="f_spouseTitle" placeholder="주무관"></label><label><b>배우자 쪽 부서장</b><input id="f_sender2" placeholder="수성구 범어동장 ○○○"></label></div>
   <div class="grp"><b>일시 · 장소</b><div class="g2"><label><b>일시</b><input id="f_when" type="datetime-local"></label><label><b>예식장</b><input id="f_place" placeholder="노비아갈라 동촌 포레야홀"></label><label><b>주소</b><input id="f_addr" placeholder="대구광역시 동구 동촌로 87"></label><label><b>연락처</b><input id="f_tel" placeholder="010-0000-0000"></label></div>
   <label style="margin-top:10px"><b>마음 전하실 곳 <span class="chk inl"><input type="checkbox" id="f_bankImg" checked> 카드에도 넣기</span></b><input id="f_bank" placeholder="iM뱅크 000-00-000000 (김달성)"></label></div>${sender}`;
  if(kind==='obit') return `${common}<div class="g3" style="margin-top:10px"><label><b>관계</b><select id="f_rel">${REL_OBIT.map(r=>`<option>${r}</option>`).join('')}</select></label><label><b>별세일</b><input id="f_ddate" type="date"></label><label class="chk" style="align-self:end;margin-bottom:12px"><input type="checkbox" id="f_noVisit"> 가족장 · 조문 사양</label></div>
   <div class="grp"><b>빈소 · 발인 · 장지</b><div class="g2"><label><b>빈소</b><input id="f_place" placeholder="대구전문장례식장 특1호실"></label><label><b>주소</b><input id="f_addr" placeholder="대구 동구 금호강변로 71"></label><label><b>발인</b><input id="f_balin" type="datetime-local"></label><label><b>장지</b><input id="f_jangji" placeholder="대구명복공원"></label><label><b>연락처</b><input id="f_tel" placeholder="김달성 (010-0000-0000)"></label><label><b>마음 전하실 곳</b><input id="f_bank" placeholder="iM뱅크 000-00-000000 (김달성)"></label></div></div>${sender}`;
  return `${common}<div class="g3" style="margin-top:10px"><label><b>행사일</b><input id="f_edate" type="date"></label><label><b>관계 <small>딸 하늘이 / 부친상</small></b><input id="f_rel2" placeholder="딸 하늘이"></label><label><b>맺음말</b><select id="f_close"><option>올림</option><option>배상</option><option>드림</option></select></label></div><p class="hint" style="margin-top:8px">소속·이름·직위는 이 PC에 기억해 두었다가 다음에 채워 줍니다 · <a href="#" id="f_forget">기억 지우기</a></p>`;
}
/* 값 수집: 폼이 화면에 없으면(①②단계) 저장본 또는 샘플로 */
function collect(){
  const k=F.kind; const g=id=>{ const e=document.getElementById(id); if(e) return e.type==='checkbox'?e.checked:e.value.trim(); if(F.form&&id in F.form) return F.form[id]; if(!F.noSample&&SAMPLE[k]&&id in SAMPLE[k]) return SAMPLE[k][id]; return id==='f_bankImg'?true:''; };
  const d={kind:k, dept:g('f_dept')||'○○과', name:g('f_name')||'○○○', title:g('f_title'), sender:g('f_sender')||'○○과장 ○○○', wdateS:today()};
  if(k==='wed'){ const rv=g('f_rel')||'장녀'; Object.assign(d,{rel:rv.startsWith('본인')?'본인':rv,sh:rv.includes('신부')?'군':'양',child:g('f_child')||'○○○',partner:g('f_partner')||'○○○',ch:isDaughter(rv)?'양':'군',ph:isDaughter(rv)?'군':'양',when:g('f_when'),place:g('f_place')||'○○○홀',addr:g('f_addr'),tel:g('f_tel'),bank:g('f_bank'),bankImg:!!g('f_bankImg'),spouse:g('f_spouse'),spouseDept:g('f_spouseOff')==='y'?(g('f_spouseDept')||'○○○'):'',spouseTitle:g('f_spouseOff')==='y'?(g('f_spouseTitle')||'주무관'):'',sender2:g('f_spouseOff')==='y'?g('f_sender2'):''}) }
  if(k==='obit') Object.assign(d,{rel:g('f_rel')||'부친',ddate:g('f_ddate'),noVisit:!!g('f_noVisit'),place:g('f_place')||'○○장례식장',addr:g('f_addr'),balin:g('f_balin'),jangji:g('f_jangji'),tel:g('f_tel'),bank:g('f_bank')});
  if(k==='thanks') Object.assign(d,{tkind:F.tkind,edate:g('f_edate'),rel2:g('f_rel2'),close:g('f_close')||'올림'});
  return d;
}

/* ── 미리보기 · 내려받기 ── */
let _lt=null;
function liveUpdate(){ updateText(); clearTimeout(_lt); _lt=setTimeout(refresh,450); }
function updateText(){ const d=collect(); F.data=d; $('#famTitle').value=postTitle(d); $('#famBody').value=postBody(d); }
async function refresh(){
  const d=collect(); F.data=d; const pv=$('#famPreview'); const stepId=STEPS[F.kind][F.step][0];
  updateText();
   $('#famOrientWrap').hidden=F.kind!=='wed';
  if(stepId==='photo'){ F.img=''; $('#famPickTgl').hidden=true; $('#f_frames').hidden=true; $('#famAiChips').innerHTML=''; $('#famTextWrap').hidden=true; $('#famShowTxt').hidden=true; pv.innerHTML = F.pic ? `<img src="${F.pic}" style="height:100%;max-height:720px;width:auto;max-width:100%;object-fit:contain;margin:auto;display:block">` : '<div class="fam-wait"><div class="fam-cardph">💐</div><b>완성된 카드가 여기에 보입니다</b><small>사진을 올리거나 · 없으면 바로 「AI 디자인 만들기」</small></div>'; $('#famNote').textContent=F.pic?(F.picKind==='illust'?'일러스트 선택됨':'원본 사진 선택됨'):''; return; }
  const fr=F.frames[F.frame]; 
  if(!fr||fr.kind==='txt'||fr.pending){ F.img=''; $('#famTextWrap').hidden=false; $('#famShowTxt').hidden=true; pv.innerHTML=''; $('#famNote').textContent=fr&&fr.kind==='txt'?'텍스트로 올립니다':'';  const mo=$('#famMore'); if(mo) mo.hidden=true; $('#famAiChips').innerHTML=''; return; }
  $('#famTextWrap').hidden=true;  const waiting=F.frames.some(f=>f.pending); $('#famNote').textContent=(fr.kind==='ai'?'🤖 ':'')+fr.label+(waiting&&fr.kind!=='ai'?' — 기본 디자인으로 먼저 보여드리는 중 · AI 디자인이 완성되면 교체됩니다':'');  const mo=$('#famMore'); if(mo) mo.hidden=!(F.ai&&F.consent&&F.kind!=='obit'); renderAiChips();
  const card=fr.render(d);
  if(!pv.querySelector('img')) pv.innerHTML='<div class="hint" style="padding:30px;text-align:center">카드를 그리는 중…</div>';
  try{ F.img=await renderPng(card, card.W>=1400?1:2); pv.innerHTML=`<img src="${F.img}" alt="카드 미리보기" title="누르면 크게 봅니다">`; }
  catch(e){ pv.innerHTML=`<div class="hint" style="padding:30px;text-align:center">미리보기 실패: ${esc(e.message)}</div>`; F.img=''; }
}
function showPost(on){ const w=$('#famTextWrap'); if(w) w.hidden=!on; }
function download(){ if(!F.img){ toastF('먼저 틀을 고르고 내용을 적어 주세요'); return; } const a=document.createElement('a'); const d=F.data||{}; a.download=`${d.kind==='wed'?'결혼':d.kind==='obit'?'부고':'감사인사'}_${(d.name||'카드')}.png`; a.href=F.img; a.click(); }

/* ═══ AI 서버 ═══ */
const code=()=>{ try{ return localStorage.getItem('dOnCode')||''; }catch(e){ return ''; } };
function probeAI(){ fetch('/api/card',{method:'POST',headers:{'content-type':'application/json','x-access-code':code()},body:'{"ping":1}'}).then(r=>r.json()).then(j=>{ F.ai=!!(j&&j.ok&&j.hasKey&&j.codeOk); F.aiModel=j&&j.model; const n=$('#famAiNote'); if(!n) return; if(!F.ai){ n.textContent = j&&j.ok&&!j.hasKey ? 'AI 생성은 서버에 키를 넣으면 켜집니다 (관리자)' : j&&j.ok&&!j.codeOk ? '접속 코드가 맞지 않습니다 (관리자 › 모델 설정)' : 'AI 생성 서버가 없습니다'; $$('#famMain [data-ill]').forEach(b=>b.disabled=true); } else n.textContent='모델 '+F.aiModel; }).catch(()=>{ F.ai=false; const n=$('#famAiNote'); if(n) n.textContent='AI 생성 서버에 연결되지 않습니다'; $$('#famMain [data-ill]').forEach(b=>b.disabled=true); }); }
async function aiJob({prompt,photo,size}){
  const r=await fetch('/api/card',{method:'POST',headers:{'content-type':'application/json','x-access-code':code()},body:JSON.stringify({action:'start',prompt,photo:photo||null,size,expect:[]})});
  const j=await r.json(); if(!r.ok||!j.id) throw new Error(j.error||('오류 '+r.status));
  const t0=Date.now(); let job=null;
  while(Date.now()-t0<180000){ await new Promise(res=>setTimeout(res,3000)); const q=await fetch('/api/card?id='+j.id,{headers:{'x-access-code':code()}}); job=await q.json(); if(job.status==='done'||job.status==='error') break; }
  if(!job||job.status!=='done') throw new Error((job&&job.error)||'시간 초과 — 다시 시도해 주세요');
  return job.image;
}
window.FAMILY={init:build};
})();
