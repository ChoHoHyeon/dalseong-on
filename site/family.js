/* ═══════════════════════════════════════════════════════════════════
   달성On — 경조사 카드 만들기 (family.js)
   결혼 · 부고 · 감사 인사 3종. 입력 하나 → ① 게시글 제목 ② 본문 텍스트 ③ 카드 이미지
   · 「만들기」= 사진·내용으로 레이아웃·테마 자동 선택  · 「다르게」= 재조합  · 「직접 고르기」= 전부 펼침
   · 사진·계좌는 브라우저 안에서만 처리(서버 전송 없음). 카드는 SVG foreignObject → canvas → PNG
   · 결혼 레이아웃 4 × 테마 6 / 부고 텍스트 + 이미지 2 / 감사 조문 2 · 결혼 2  (시안: 09_경조사 카드 폴더)
   ═══════════════════════════════════════════════════════════════════ */
(function(){
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const F={kind:'wed', photo:null, pw:0, ph:0, layout:null, theme:null, hist:[], img:'', showImg:true};
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
const REL_WED=['장녀','장남','차녀','차남','딸','아들','본인'];
const REL_OBIT=['부친','모친','시부','시모','장인','장모','빙부','빙모','조부','조모','배우자','본인'];
function formHtml(kind){
  const common=`<div class="g3">
    <label><b>소속</b><input id="f_dept" placeholder="정보통신과"></label>
    <label><b>이름</b><input id="f_name" placeholder="김달성"></label>
    <label><b>직위</b><input id="f_title" placeholder="주무관 · 前 ○○과장"></label></div>`;
  const sender=`<div class="grp"><b>발신 명의</b><div class="g2"><label><b>부서장</b><input id="f_sender" placeholder="정보통신과장 김정보"></label><label class="wself" hidden><b>배우자 쪽 부서장</b><input id="f_sender2" placeholder="수성구 ○○동장 ○○○"></label></div>
    <p class="hint">소속·이름·직위·부서장은 이 PC에 기억해 두었다가 다음에 채워 줍니다 · <a href="#" id="f_forget">기억 지우기</a></p></div>`;
  if(kind==='wed') return `${common}
   <div class="g3" style="margin-top:10px">
    <label><b>관계</b><select id="f_rel">${REL_WED.map(r=>`<option>${r}</option>`).join('')}</select></label>
    <label class="wchild"><b>신부 이름</b><input id="f_bride" placeholder="김하늘"></label>
    <label class="wchild"><b>신랑 이름</b><input id="f_groom" placeholder="박비슬"></label>
    <label class="wself" hidden><b>배우자 이름 <small>공무원일 때만</small></b><input id="f_spouse" placeholder="비우면 이름 없이 알림"></label>
    <label class="wself" hidden><b>배우자 소속 · 직위</b><div class="row" style="margin:0;gap:6px"><input id="f_spouseDept" placeholder="수성구 ○○동" style="flex:2"><input id="f_spouseTitle" placeholder="주무관" style="flex:1"></div></label></div>
   <div class="grp"><b>일시 · 장소</b><div class="g2">
    <label><b>일시</b><input id="f_when" type="datetime-local"></label>
    <label><b>예식장</b><input id="f_place" placeholder="노비아갈라 동촌 포레야홀"></label>
    <label><b>주소</b><input id="f_addr" placeholder="대구광역시 동구 동촌로 87"></label>
    <label><b>연락처</b><input id="f_tel" placeholder="010-0000-0000"></label></div>
    <label style="margin-top:10px"><b>마음 전하실 곳 <span class="chk inl"><input type="checkbox" id="f_bankImg" checked> 카드에도 넣기</span></b><input id="f_bank" placeholder="iM뱅크 000-00-000000 (김달성)"></label></div>
   ${sender}
   <div class="grp"><b>사진 · 방향</b>
    <div class="row rw"><label class="filebtn">📷 사진 올리기<input type="file" id="f_photo" accept="image/*"></label><button class="ghost sm" id="f_sample" type="button">샘플 사진</button><button class="ghost sm" id="f_clear" type="button" hidden>사진 빼기</button><span class="hint" id="f_photoNote">전송 안 함</span><span style="flex:1"></span><div class="seg2" id="f_orient"><button type="button" data-v="any" class="on">자동</button><button type="button" data-v="portrait">세로</button><button type="button" data-v="landscape">가로</button></div></div>
    <label class="chk" style="margin-top:8px"><input type="checkbox" id="f_illust"> <span>사진 대신 일러스트로 <span class="hint">· 시연판은 샘플로 대체</span></span></label></div>`;
  if(kind==='obit') return `${common}
   <div class="g3" style="margin-top:10px">
    <label><b>관계</b><select id="f_rel">${REL_OBIT.map(r=>`<option>${r}</option>`).join('')}</select></label>
    <label><b>별세일</b><input id="f_ddate" type="date"></label>
    <label class="chk" style="align-self:end;margin-bottom:12px"><input type="checkbox" id="f_noVisit"> 가족장 · 조문 사양</label></div>
   <div class="grp"><b>빈소 · 발인 · 장지</b><div class="g2">
    <label><b>빈소</b><input id="f_place" placeholder="대구전문장례식장 특1호실"></label>
    <label><b>주소</b><input id="f_addr" placeholder="대구 동구 금호강변로 71"></label>
    <label><b>발인</b><input id="f_balin" type="datetime-local"></label>
    <label><b>장지</b><input id="f_jangji" placeholder="대구명복공원"></label>
    <label><b>연락처</b><input id="f_tel" placeholder="김달성 (010-0000-0000)"></label>
    <label><b>마음 전하실 곳</b><input id="f_bank" placeholder="iM뱅크 000-00-000000 (김달성)"></label></div></div>
   ${sender}
   <div class="grp"><b>이미지</b><label class="chk"><input type="checkbox" id="f_obitImg"> <span>텍스트에 더해 <b>이미지 카드도</b> 만들기 <span class="hint">· 부고는 게시판 관행대로 텍스트가 기본</span></span></label></div>`;
  return `<div class="seg2" id="f_tkind" style="margin-bottom:12px;display:inline-flex"><button class="on" data-v="wed" type="button">결혼 감사</button><button data-v="fun" type="button">조문 감사</button></div>
   ${common}
   <div class="g3" style="margin-top:10px">
    <label><b>행사일</b><input id="f_edate" type="date"></label>
    <label><b>관계 <small>딸 하늘이 / 부친상</small></b><input id="f_rel2" placeholder="딸 하늘이"></label>
    <label><b>맺음말</b><select id="f_close"><option>올림</option><option>배상</option><option>드림</option></select></label></div>
   <p class="hint" style="margin-top:8px">소속·이름·직위는 이 PC에 기억해 두었다가 다음에 채워 줍니다 · <a href="#" id="f_forget">기억 지우기</a></p>`;
}

const v=id=>{ const e=document.getElementById(id); return e?e.value.trim():''; };
const ck=id=>{ const e=document.getElementById(id); return !!(e&&e.checked); };

/* ── 데이터 수집 ── */
function collect(){
  const k=F.kind, d={kind:k, dept:v('f_dept')||'○○과', name:v('f_name')||'○○○', title:v('f_title'), sender:v('f_sender')||'○○과장 ○○○', wdate:v('f_wdate')};
  d.wdateS = today();
  if(k==='wed'){ Object.assign(d,{rel:v('f_rel'),bride:v('f_bride')||'○○○',groom:v('f_groom')||'○○○',when:v('f_when'),place:v('f_place')||'○○○홀',addr:v('f_addr'),tel:v('f_tel'),bank:v('f_bank'),bankImg:ck('f_bankImg'),illust:ck('f_illust'),spouse:v('f_spouse'),spouseDept:v('f_spouseDept'),spouseTitle:v('f_spouseTitle')||(v('f_spouse')?'주무관':''),sender2:v('f_sender2'),orient:$('#f_orient .on')?.dataset.v||'any'}); }
  if(k==='obit'){ Object.assign(d,{rel:v('f_rel'),ddate:v('f_ddate'),noVisit:ck('f_noVisit'),place:v('f_place')||'○○장례식장',addr:v('f_addr'),balin:v('f_balin'),jangji:v('f_jangji'),tel:v('f_tel'),bank:v('f_bank'),obitImg:ck('f_obitImg')}); }
  if(k==='thanks'){ Object.assign(d,{tkind:$('#f_tkind .on')?.dataset.v||'wed',edate:v('f_edate'),rel2:v('f_rel2'),close:v('f_close')||'올림'}); }
  return d;
}
const who=d=> d.title? `${d.dept} ${d.name} ${d.title}` : `${d.dept} ${d.name}`;

/* ── 게시글 제목 · 본문 ── */
function postTitle(d){
  if(d.kind==='wed'){ if(d.rel==='본인'&&d.spouse) return `${d.name}♥${d.spouse}[${fShort(d.when)}, ♥결혼♥, ${d.dept}${d.spouseDept?'/'+d.spouseDept:''}]`; return `${d.name}[${fShort(d.when)}, ${d.rel==='본인'?'♥결혼♥':'자녀혼사'}, ${d.dept}${d.title?' '+d.title:''}]`; }
  if(d.kind==='obit') return `${d.name}[${fShort(d.ddate)}, ${d.rel}상, ${d.dept}]`;
  return `감사의 인사를 드립니다(${d.dept} ${d.name})`;
}
function line(k,val){ return val?`○ ${k} : ${val}\n`:''; }
function postBody(d){
  if(d.kind==='wed'){
    const subj = d.rel==='본인' ? (d.spouse ? `${who(d)}과 ${d.spouseDept?d.spouseDept+' ':''}${d.spouse}${d.spouseTitle?' '+d.spouseTitle:''}의 결혼식을` : `${who(d)}의 결혼식을`) : `${who(d)}의 ${d.rel} ${d.bride} 양과 ${d.groom} 군의 결혼식을`;
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
  .dc .lead{font-family:${FONT_SERIF};font-size:21px;line-height:1.75}
  .dc .lead b{font-weight:700}
  .dc .info{margin-top:22px;border-top:1px solid ${t.line};border-bottom:1px solid ${t.line};padding:18px 0;font-size:17px;line-height:1.9}
  .dc .info .k{display:inline-block;width:150px;color:${t.sub};letter-spacing:2px;white-space:nowrap}
  .dc .info small{color:${t.sub};font-size:14px}
  .dc .sender{margin-top:26px;font-family:${FONT_SERIF};font-size:20px;letter-spacing:2px}
  .dc .orn{color:${t.accent};font-size:18px;letter-spacing:6px;margin:8px 0}`;
  const subj = d.rel==='본인' ? (d.spouse ? `<b>${esc(who(d))}</b>과<br><b>${esc((d.spouseDept?d.spouseDept+' ':'')+d.spouse+(d.spouseTitle?' '+d.spouseTitle:''))}</b>의 결혼식을 알려드리오니` : `<b>${esc(who(d))}</b>의 결혼식을 알려드리오니`) : `<b>${esc(who(d))}</b>의 ${esc(d.rel)}<br><b>${esc(d.bride)}</b> 양과 <b>${esc(d.groom)}</b> 군의 결혼식을 알려드리오니`;
  const body=`<div class="lead">${subj}<br>두 사람의 앞날을 축복해 주시면 감사하겠습니다.</div>
  <div class="info"><div><span class="k">일 시</span>${esc(fDateTime(d.when))}</div><div><span class="k">장 소</span>${esc(d.place)}${d.addr?` <small>(${esc(d.addr)})</small>`:''}</div>${d.tel?`<div><span class="k">연락처</span>${esc(d.tel)}</div>`:''}${d.bank&&d.bankImg?`<div><span class="k">마음 전하실 곳</span>${esc(d.bank)}</div>`:''}</div>
  <div class="sender">${esc(d.sender)}${d.sender2?'<br/>'+esc(d.sender2):''}</div>`;
  const pic = illust||photo;
  let W,H,inner;
  if(layout==='L1'){ W=1200;H=800; inner=`${deco(theme,'tr')}${deco(theme,'bl')}<div class="paper" style="position:relative;z-index:2;height:100%;display:flex;gap:44px;padding:36px;margin:44px">
   <div style="flex:0 0 470px;border-radius:6px;overflow:hidden"><img src="${pic}" style="width:100%;height:100%;object-fit:cover;display:block"/></div>
   <div style="flex:1;display:flex;flex-direction:column;justify-content:center"><div class="eng" style="font-size:44px;line-height:1.1">Wedding<br/>Invitation</div><div class="kt" style="margin:10px 0 22px">결혼식 안내</div>${body}</div></div>`;
   inner=inner.replace('height:100%;display:flex;gap:44px;padding:36px;margin:44px','height:712px;display:flex;gap:44px;padding:36px;margin:44px'); }
  else if(layout==='L2'){ W=800;H=1150; inner=`${deco(theme,'tl')}${deco(theme,'br')}<div class="paper" style="position:relative;z-index:2;height:1070px;margin:40px;padding:34px 46px;text-align:center">
   <div style="height:520px;border-radius:6px;overflow:hidden;margin-bottom:26px"><img src="${pic}" style="width:100%;height:100%;object-fit:cover;object-position:50% 20%;display:block"/></div>
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
function build(){
  const root=$('#famApp'); if(!root||root.dataset.built) return; root.dataset.built=1;
  root.innerHTML=`
  <div class="fam2-head"><div class="fam2-tabs" id="famKinds"><button class="on" data-k="wed">💐 결혼</button><button data-k="obit">🕊 부고</button><button data-k="thanks">🙏 감사 인사</button></div><span class="hint">적는 대로 오른쪽 카드가 바뀝니다 · 사진·계좌는 브라우저 안에서만 처리</span></div>
  <div class="fam2-cols">
   <div class="card fam2-form">
    <div id="famForm"></div>
    <div class="fam2-actions">
     <div class="row"><button class="primary big" id="famAI">🤖 AI로 카드 만들기 <small>30~60초</small></button><span class="hint" id="famAiNote"></span></div>
     <input id="f_mood" placeholder="원하는 느낌 (선택) — 화사하게 · 참꽃 넣어줘 · 차분한 골드">
     <label class="chk"><input type="checkbox" id="f_aiConsent"> <span>사진·문안을 외부 AI(OpenAI)로 보내는 데 동의 <span class="hint">· 생성 후 저장 안 함</span></span></label></div>
   </div>
   <div class="fam2-right">
    <div class="card fam2-title"><span class="hint">게시글 제목</span><input id="famTitle" readonly><button class="ghost sm" data-copy="famTitle">복사</button></div>
    <div class="card fam2-card">
     <div id="famOut"><div id="famImgWrap"><div class="fam-preview" id="famPreview"></div></div></div>
     <div id="famTextWrap" hidden><div class="fam-copy col"><textarea id="famBody" rows="16" readonly></textarea><button class="ghost sm" data-copy="famBody">복사</button></div></div>
     <div class="row rw fam2-bar"><button class="primary" id="famDl">⬇ 카드 내려받기</button><button class="ghost" id="famAgain">🎲 다르게</button><button class="ghost" id="famPick">🗂 직접 고르기</button><span style="flex:1"></span><span class="hint" id="famNote"></span><span class="hint" id="famImgNote"></span><a href="#" class="hint" id="famShowTxt" hidden>「글로 올릴 본문」 보기</a></div>
     <div id="famGrid" class="fam-grid" hidden></div>
     <p class="hint" style="margin-top:8px">※ 이름·날짜·계좌는 반드시 확인 후 올려 주세요. 잘못 올린 글은 정보통신과(☎2454)에서 수정할 수 있습니다.</p></div>
   </div></div>`;
  $$('#famKinds button').forEach(b=>b.onclick=()=>{ $$('#famKinds button').forEach(x=>x.classList.toggle('on',x===b)); F.kind=b.dataset.k; renderForm(); });
  $('#famShowTxt').onclick=e=>{ e.preventDefault(); const w=$('#famTextWrap'); w.hidden=!w.hidden; e.target.textContent=w.hidden?'「글로 올릴 본문」 보기':'본문 닫기'; };
  $('#famAI').onclick=()=>makeAI(0); $('#famAgain').onclick=()=>{ if(F.lastMode==='ai') makeAI((F.aiSeed||0)+1); else make((F.hist.length||0)+1); }; $('#famPick').onclick=togglePick; $('#famDl').onclick=download;
  $('#famPreview').onclick=()=>{ if(!F.img) return; let m=$('#mCard'); if(!m){ m=document.createElement('div'); m.className='modal'; m.id='mCard'; m.innerHTML='<div class="box cardbox"><div class="box-h"><b>카드 미리보기</b><button class="x" data-close>✕</button></div><img></div>'; document.body.appendChild(m); m.onclick=e=>{ if(e.target===m||e.target.closest('[data-close]')) m.hidden=true; }; } m.querySelector('img').src=F.img; m.hidden=false; };
  probeAI();
  root.addEventListener('click',e=>{ const b=e.target.closest('[data-copy]'); if(!b) return; const el=document.getElementById(b.dataset.copy); const txt=el.value; (navigator.clipboard?navigator.clipboard.writeText(txt):Promise.reject()).then(()=>toastF('복사했습니다'),()=>{ el.select(); document.execCommand('copy'); toastF('복사했습니다'); }); });
  renderForm();
}
function setMode(img){ $('#famOut').hidden=!img; $('#famTextWrap').hidden=img; $('#famShowTxt').hidden=!img; $('#famDl').hidden=!img; if(img){ $('#famShowTxt').textContent='「글로 올릴 본문」 보기'; } }
function toastF(m){ if(window.toast) toast(m); else alert(m); }
function updateText(){ const d=collect(); $('#famTitle').value=postTitle(d); $('#famBody').value=postBody(d); }
function renderForm(){
  const f=$('#famForm'); f.innerHTML=formHtml(F.kind); f.oninput=liveUpdate; f.onchange=liveUpdate; F.photo=null; F.hist=[]; F.layout=null; F.theme=null; F.lastMode='tpl'; $('#famGrid').hidden=true; F.img=''; $('#famNote').textContent=''; const fv=$('#famVerify'); if(fv) fv.remove();
  const ph=$('#f_photo'); if(ph){ ph.onchange=()=>{ const file=ph.files[0]; if(!file) return; const r=new FileReader(); r.onload=()=>setPhoto(r.result, file.name); r.readAsDataURL(file); };
    $('#f_sample').onclick=()=>fetch('assets/family_sample.jpg').then(r=>r.blob()).then(b=>{ const r=new FileReader(); r.onload=()=>setPhoto(r.result,'샘플 사진'); r.readAsDataURL(b); });
    $('#f_clear').onclick=()=>{ F.photo=null; $('#f_clear').hidden=true; $('#f_photoNote').textContent='전송 안 함'; F.layout=null; refresh(); }; }
  // 기억한 값 채우기
  try{ const m=JSON.parse(localStorage.getItem('dOnFam')||'{}'); ['f_dept','f_name','f_title','f_sender'].forEach(id=>{ const e=document.getElementById(id); if(e&&m[id]&&!e.value) e.value=m[id]; }); }catch(e){}
  const fg=$('#f_forget'); if(fg) fg.onclick=e=>{ e.preventDefault(); localStorage.removeItem('dOnFam'); ['f_dept','f_name','f_title','f_sender'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; }); toastF('기억한 값을 지웠습니다'); };
  const rel=$('#f_rel'); if(rel&&F.kind==='wed'){ const sync=()=>{ const self=rel.value==='본인'; $$('#famForm .wchild').forEach(x=>x.hidden=self); $$('#famForm .wself').forEach(x=>x.hidden=!self); }; rel.onchange=()=>{ sync(); liveUpdate(); }; sync(); }
  const ori=$('#f_orient'); if(ori){ $$('#f_orient button').forEach(b=>b.onclick=()=>{ $$('#f_orient button').forEach(x=>x.classList.toggle('on',x===b)); F.layout=null; refresh(); }); }
  const tk=$('#f_tkind'); if(tk){ $$('#f_tkind button').forEach(b=>b.onclick=()=>{ $$('#f_tkind button').forEach(x=>x.classList.toggle('on',x===b)); $('#f_rel2').placeholder = b.dataset.v==='wed'?'딸 하늘이':'부친상'; F.theme=null; refresh(); }); }
  $$('#famForm input[type=checkbox]').forEach(c=>c.addEventListener('change',()=>{ F.layout=null; refresh(); }));
  updateText(); refresh();
}
/* 실시간 미리보기: 적는 대로(0.5초 뒤) 같은 레이아웃·테마로 다시 그린다. AI 카드가 떠 있을 땐 텍스트만 갱신 */
let _lt=null;
function liveUpdate(){ updateText(); if(F.lastMode==='ai') return; clearTimeout(_lt); _lt=setTimeout(refresh,500); }
async function refresh(){
  if(F.lastMode==='ai') return;
  const d=collect(); F.data=d; let card=null, note='';
  if(d.kind==='wed'){
    if(d.illust) F.illust=await illustData();
    if(!F.layout||!F.theme){ const a=autoWed(d, F.hist.length); F.layout=a.layout; F.theme=a.theme; if(!F.hist.length) F.hist.push(a); }
    const lay = d.illust?'L3' : (!F.photo?'L4' : (F.layout==='L3'||F.layout==='L4')?'L1':F.layout);
    card=wedCard(d,lay,F.theme,F.photo||F.illust||'',d.illust?F.illust:null); note=`${WED_LAYOUTS[lay]} · ${WED_THEMES[F.theme].name}`;
  } else if(d.kind==='obit'){
    if(d.obitImg){ if(!F.theme||!OBIT_THEMES[F.theme]) F.theme='gray'; card=obitCard(d,F.theme); note=OBIT_THEMES[F.theme]; } else note='텍스트로 올립니다 (이미지도 원하면 「이미지 카드도 만들기」)';
  } else {
    const ks=Object.keys(TH_THEMES[d.tkind]); if(!F.theme||!ks.includes(F.theme)) F.theme=ks[0]; card=thanksCard(d,F.theme); note=TH_THEMES[d.tkind][F.theme];
  }
  $('#famNote').textContent=note; setMode(!!card); $('#famAgain').disabled=!card; $('#famPick').disabled=!card;
  if(card) await showCard(card);
}
function setPhoto(dataUrl,name){ F.photo=dataUrl; F.tone=null; photoTone(dataUrl); $('#f_clear').hidden=false; $('#f_photoNote').textContent=`${name} — 올려졌습니다 (전송 안 함)`; }
let ILLUST=null;
async function illustData(){ if(ILLUST) return ILLUST; const b=await fetch('assets/family_sample_illust.jpg').then(r=>r.blob()); ILLUST=await new Promise(res=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.readAsDataURL(b); }); return ILLUST; }

async function make(seed){
  const d=collect(); F.data=d; F.lastMode='tpl'; const fv=$('#famVerify'); if(fv) fv.remove();
  try{ localStorage.setItem('dOnFam',JSON.stringify({f_dept:v('f_dept'),f_name:v('f_name'),f_title:v('f_title'),f_sender:v('f_sender')})); }catch(e){}
  updateText(); $('#famGrid').hidden=true;
  let card=null, note='';
  if(d.kind==='wed'){
    if(d.illust) F.illust=await illustData();
    let a=autoWed(d, seed); const last=F.hist[F.hist.length-1]; for(let i=1;i<12&&last&&a.layout===last.layout&&a.theme===last.theme;i++) a=autoWed(d, seed+i*7); F.layout=a.layout; F.theme=a.theme; F.hist.push(a);
    card=wedCard(d,a.layout,a.theme,F.photo||F.illust||'',d.illust?F.illust:null);
    note=`${WED_LAYOUTS[a.layout]} · ${WED_THEMES[a.theme].name}`;
    $('#famAgain').disabled=false; $('#famPick').disabled=false;
  } else if(d.kind==='obit'){
    if(d.obitImg){ const th=F.hist.length%2?'hanji':'gray'; F.hist.push({t:th}); F.theme=th; card=obitCard(d,th); note=OBIT_THEMES[th]; $('#famAgain').disabled=false; $('#famPick').disabled=false; }
    else { note='부고는 텍스트가 기본입니다 — 필요하면 위에서 「이미지 카드도 만들기」를 켜 주세요'; $('#famAgain').disabled=true; $('#famPick').disabled=true; }
  } else {
    const ks=Object.keys(TH_THEMES[d.tkind]); const th=ks[F.hist.length%ks.length]; F.hist.push({t:th}); F.theme=th; card=thanksCard(d,th); note=TH_THEMES[d.tkind][th]; $('#famAgain').disabled=false; $('#famPick').disabled=false;
  }
  $('#famNote').textContent = note||'';
  setMode(!!card); if(!card) return;
  await showCard(card);
}
async function showCard(card){
  const wrap=$('#famImgWrap'), pv=$('#famPreview');
  if(!card){ wrap.hidden=true; F.img=''; return; }
  wrap.hidden=false; if(!pv.querySelector('img')) pv.innerHTML='<div class="hint" style="padding:30px;text-align:center">카드를 그리는 중…</div>';
  try{ F.img=await renderPng(card,2); pv.innerHTML=`<img src="${F.img}" alt="카드 미리보기">`; $('#famImgNote').textContent=`${card.W}×${card.H} · 게시판 첨부용`; }
  catch(e){ pv.innerHTML=`<div class="fam-live" style="width:${card.W}px;height:${card.H}px">${card.html}</div>`; $('#famImgNote').textContent='미리보기(내려받기는 브라우저 지원 필요)'; F.img=''; }
}
function download(){ if(!F.img){ toastF('먼저 카드를 만들어 주세요'); return; } const a=document.createElement('a'); const d=F.data||{}; a.download=`${d.kind==='wed'?'결혼':d.kind==='obit'?'부고':'감사인사'}_${(d.name||'카드')}.png`; a.href=F.img; a.click(); }

/* 직접 고르기 — 전 조합 펼침 */
async function togglePick(){
  const g=$('#famGrid'); if(!g.hidden){ g.hidden=true; return; }
  const d=F.data||collect(); g.hidden=false; g.innerHTML='<div class="hint">그리는 중…</div>';
  let combos=[];
  if(d.kind==='wed'){ const lays = d.illust?['L3'] : (F.photo?['L1','L2','L4']:['L4']); for(const l of lays) for(const t of Object.keys(WED_THEMES)) combos.push({l,t,label:`${WED_LAYOUTS[l]} · ${WED_THEMES[t].name}`, card:wedCard(d,l,t,F.photo||F.illust||'',d.illust?F.illust:null)}); }
  else if(d.kind==='obit'){ for(const t of Object.keys(OBIT_THEMES)) combos.push({t,label:OBIT_THEMES[t],card:obitCard(d,t)}); }
  else { for(const t of Object.keys(TH_THEMES[d.tkind])) combos.push({t,label:TH_THEMES[d.tkind][t],card:thanksCard(d,t)}); }
  g.innerHTML='';
  for(const c of combos){ const el=document.createElement('button'); el.className='fam-thumb'; el.innerHTML=`<span class="fam-th"></span><small>${c.label}</small>`; g.appendChild(el);
    renderPng(c.card,0.35).then(u=>{ el.querySelector('.fam-th').innerHTML=`<img src="${u}">`; }).catch(()=>{ el.querySelector('.fam-th').textContent='미리보기 불가'; });
    el.onclick=async()=>{ if(c.l){ F.layout=c.l; } F.theme=c.t; $('#famNote').textContent=`선택: ${c.label}`; setMode(true); await showCard(c.card); }; }
}
/* ═══ AI 생성 (OpenAI gpt-image · 서버 프록시 /api/card → 백그라운드 card-run) ═══ */
const code=()=>{ try{ return localStorage.getItem('dOnCode')||''; }catch(e){ return ''; } };
function probeAI(){ fetch('/api/card',{method:'POST',headers:{'content-type':'application/json','x-access-code':code()},body:'{"ping":1}'}).then(r=>r.json()).then(j=>{ F.ai=!!(j&&j.ok&&j.hasKey&&j.codeOk); F.aiModel=j&&j.model; const n=$('#famAiNote'); if(!F.ai){ $('#famAI').disabled=true; n.textContent = j&&j.ok&&!j.hasKey ? 'AI 생성은 서버에 키를 넣으면 켜집니다 (관리자)' : j&&j.ok&&!j.codeOk ? '접속 코드가 맞지 않습니다 (관리자 › 모델 설정)' : 'AI 생성 서버가 없습니다'; } else n.textContent='모델 '+F.aiModel; }).catch(()=>{ F.ai=false; $('#famAI').disabled=true; $('#famAiNote').textContent='AI 생성 서버에 연결되지 않습니다'; }); }
const STYLES=['soft watercolor Korean azalea (진달래·참꽃) blossoms in pink and eucalyptus leaves, warm cream paper','green botanical eucalyptus and white flowers, airy white paper, thin sage lines','blush pink watercolor roses and peonies, romantic, soft','ivory paper with thin gold line frame and gold flourishes, classic and elegant','black and white minimal, generous white space, thin hairline frame, modern serif','light pastel confetti and tiny hearts, bright and cheerful, sky blue accents'];
function aiPrompt(d, seed){
  const mood=v('f_mood'); const st=STYLES[(seed+(d.name||'').length)%STYLES.length];
  const lines=[]; let head='';
  if(d.kind==='wed'){
    head=`Design a complete Korean wedding invitation card${F.photo?' using the attached couple photo (keep their faces exactly as in the photo)':''}. Style: ${st}. `;
    lines.push('Wedding Invitation');
    if(d.rel==='본인') lines.push(d.spouse ? `${who(d)}과 ${d.spouseDept?d.spouseDept+' ':''}${d.spouse}${d.spouseTitle?' '+d.spouseTitle:''}의 결혼식을 알려드리오니` : `${who(d)}의 결혼식을 알려드리오니`);
    else lines.push(`${who(d)}의 ${d.rel}`, `${d.bride} 양과 ${d.groom} 군의 결혼식을 알려드리오니`);
    lines.push('두 사람의 앞날을 축복해 주시면 감사하겠습니다.', `일 시 : ${fDateTime(d.when)}`, `장 소 : ${d.place}${d.addr?` (${d.addr})`:''}`);
    if(d.tel) lines.push(`연락처 : ${d.tel}`); if(d.bank&&d.bankImg) lines.push(`마음 전하실 곳 : ${d.bank}`); lines.push(d.sender); if(d.sender2) lines.push(d.sender2);
  } else if(d.kind==='thanks'){
    head=`Design a complete Korean thank-you card (${d.tkind==='fun'?'after a funeral: quiet, respectful, white chrysanthemums, muted tones':'after a wedding: warm, flowers, soft pastel'}). Style: ${st}. No people. `;
    postBody(d).split('\n').filter(l=>l.trim()).forEach(l=>lines.push(l));
  } else {
    head=`Design a Korean funeral notice card, solemn and respectful, white chrysanthemums, grey/ivory tones, no people. `;
    postBody(d).split('\n').filter(l=>l.trim()).forEach(l=>lines.push(l));
  }
  const prompt = head + (mood?`Requested mood from the user: "${mood}". `:'') +
    `The card must contain exactly the following Korean text, every character rendered accurately and legibly, in this order, with clean typography (Korean serif for body). Do not add any other words. Do not translate.\n\n` + lines.join('\n') +
    `\n\nHigh quality, print-ready layout, balanced margins, nothing cut off at the edges.`;
  const expect = lines.filter(l=>/[0-9]/.test(l) || l===d.sender || (d.name&&l.includes(d.name)));
  return {prompt, expect};
}
async function makeAI(seed){
  if(!F.ai){ toastF('AI 생성 서버가 준비되지 않았습니다'); return; }
  if(!ck('f_aiConsent')){ toastF('외부 AI 전송 동의에 체크해 주세요'); $('#f_aiConsent').focus(); return; }
  const d=collect(); F.data=d; F.aiSeed=seed; F.lastMode='ai';
  try{ localStorage.setItem('dOnFam',JSON.stringify({f_dept:v('f_dept'),f_name:v('f_name'),f_title:v('f_title'),f_sender:v('f_sender')})); }catch(e){}
  updateText(); $('#famGrid').hidden=true; setMode(true);
  const {prompt,expect}=aiPrompt(d,seed);
  const size = d.orient==='landscape'?'1536x1024': d.orient==='portrait'?'1024x1536': (F.photo&&F.pw>F.ph?'1536x1024':'1024x1536');
  const pv=$('#famPreview'); pv.innerHTML='<div class="fam-wait"><div class="spin"></div><b>AI가 카드를 그리는 중…</b><small>보통 30~60초 걸립니다. 이 화면을 그대로 두세요.</small></div>';
  $('#famImgNote').textContent=''; $('#famAI').disabled=true; $('#famAgain').disabled=true; $('#famPick').disabled=true; F.img=''; const fv=$('#famVerify'); if(fv) fv.remove();
  try{
    const r=await fetch('/api/card',{method:'POST',headers:{'content-type':'application/json','x-access-code':code()},body:JSON.stringify({action:'start',prompt,photo:F.photo||null,size,expect})});
    const j=await r.json(); if(!r.ok||!j.id) throw new Error(j.error||('오류 '+r.status));
    const t0=Date.now(); let job=null;
    while(Date.now()-t0<180000){ await new Promise(res=>setTimeout(res,3000)); const q=await fetch('/api/card?id='+j.id,{headers:{'x-access-code':code()}}); job=await q.json(); if(job.status==='done'||job.status==='error') break; const w=pv.querySelector('small'); if(w) w.textContent=`${Math.round((Date.now()-t0)/1000)}초 경과 · 보통 30~60초 걸립니다`; }
    if(!job||job.status!=='done') throw new Error((job&&job.error)||'시간 초과 — 다시 시도해 주세요');
    F.img=job.image; pv.innerHTML=`<img src="${job.image}" alt="AI 카드" title="누르면 크게 봅니다">`;
    let note=`AI 생성 · ${job.model||''}`; if(job.verify){ if(job.verify.ok===true) note+=' · 글자 검증 통과 ✓'; else if(job.verify.ok===false) note+=' · ⚠ 확인 필요'; }
    $('#famImgNote').textContent=note; $('#famNote').innerHTML='AI 생성 · <a href="#" id="famBackTpl">기본 카드로 돌아가기</a>'; $('#famBackTpl').onclick=e=>{ e.preventDefault(); F.lastMode='tpl'; const fv=$('#famVerify'); if(fv) fv.remove(); refresh(); };
    const warn=document.createElement('div'); warn.id='famVerify'; warn.className='fam-verify'; $('#famImgWrap').appendChild(warn);
    if(job.verify&&job.verify.ok===false) warn.innerHTML=`<b>⚠ 카드에서 다음 문구가 정확히 읽히지 않았습니다. 눈으로 꼭 확인하세요.</b><ul>${job.verify.missing.map(m=>`<li>${esc(m)}</li>`).join('')}</ul><span class="hint">틀렸으면 「다르게」로 다시 만들거나 「기본 카드」를 쓰세요.</span>`;
    else if(job.verify&&job.verify.ok===true) warn.innerHTML='<span class="hint ok">✓ 날짜·장소·연락처·계좌·이름이 카드에 그대로 들어간 것을 확인했습니다. 그래도 올리기 전에 한 번 더 보세요.</span>';
    else warn.innerHTML='<span class="hint">글자 자동 검증을 하지 못했습니다. 날짜·계좌를 눈으로 확인하세요.</span>';
  }catch(e){ pv.innerHTML=`<div class="hint" style="padding:30px;text-align:center">AI 생성 실패: ${esc(e.message)}<br><br>「기본 카드로 만들기」는 바로 됩니다.</div>`; $('#famImgNote').textContent=''; }
  $('#famAI').disabled=false; $('#famAgain').disabled=false; $('#famPick').disabled=(d.kind==='obit'&&!d.obitImg);
}
window.FAMILY={init:build};
})();
