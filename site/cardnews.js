/* ============================================================
   달성On — 카드뉴스 제작하기 (cardnews.js)
   · 보도자료·공고문을 붙여넣으면 표지–본문–마무리 5~8장으로 나눠 카드 문구를 만들고, 정해진 틀에 배치해 바로 그린다.
   · 규격 1:1(1080) / 4:5 / 9:16 · 색 테마 4종 · 군 CI 원본 그대로.  장별 문구는 바로 고쳐 다시 그릴 수 있다.
   · 그림 : 만들기와 동시에 AI가 내용의 핵심 키워드로 그림을 그린다(현수막과 같은 방식). 그리는 동안은 테마 일러스트 12종 중 맞는 것을 임시로 쓴다.
   · 결과 : 장별 PNG(또는 전체 저장) + 게시글 문구·해시태그 복사
   ============================================================ */
(function(){
"use strict";
const $=s=>document.querySelector(s);
const C={busy:false,data:null,logo:null,cur:0,art:null,artKey:'',artCache:{},aiBusy:false};
/* 달성군 테마 일러스트 라이브러리(assets/cn/*.jpg, 1080×1080, 한 스타일) — 모델이 내용에 맞는 키를 고른다 */
const ART={ edu:'정보화·교육·배움', festival:'축제·꽃·관광', safety:'안전·재난·치안', welfare:'복지·돌봄·어르신', env:'환경·청소·재활용', farm:'농업·농촌·특산물', traffic:'교통·버스·도로', youth:'청년·일자리·창업', health:'보건·건강·예방접종', admin:'민원·행정·군정', culture:'문화·체육·행사', data:'데이터·AI·디지털' };
const THEMES={ navy:['남색',['#0b2a6b','#1b4db3'],'#ffffff','#ffd166'], green:['녹색',['#145a32','#27ae60'],'#ffffff','#f9e79f'], orange:['주황',['#c0392b','#e67e22'],'#ffffff','#fff3c4'], mint:['민트',['#117a8b','#48c9b0'],'#ffffff','#fdfefe'] };
const SIZES={ sq:[1080,1080,'인스타 정사각 1:1'], p45:[1080,1350,'인스타 세로 4:5'], story:[1080,1920,'스토리 9:16'], blog:[1200,675,'블로그·밴드 가로 16:9'] };
const v=id=>($('#'+id).value||'').trim();

const SYS=`당신은 대구광역시 달성군 SNS 홍보 담당자입니다. 제공된 글을 카드뉴스로 재구성합니다.
· 1장은 표지(제목 12자 이내 + 부제 20자 이내), 마지막 장은 마무리(문의처·참여 방법), 가운데는 본문.
· 본문 장은 소제목 10자 이내 + 핵심 문장 1~3줄(각 22자 이내). 한 장에 한 가지 내용만.
· 문장은 짧고 쉬운 말, 군민 대상 존댓말("~해요" "~하세요"). 숫자·날짜·장소는 원문에 있는 것만 쓴다.
· 게시글 문구(caption)는 3~4문장, 해시태그 6~8개(#달성군 #대구달성 포함).
· visual: 카드 그림용. 원문에서 핵심 키워드를 뽑아, 그림에 꼭 나와야 할 구체적인 사물·장면을 영어 1~2문장으로 쓴다. (예: 어르신 스마트폰 교육 → "a friendly instructor helping seniors use smartphones and a kiosk in a bright classroom") 글자·간판·로고는 넣지 않는다.
· 내용에 가장 맞는 그림 주제(art)를 다음 중 하나로 고른다(AI 그림이 나오기 전 임시 그림): edu(정보화·교육) festival(축제·꽃·관광) safety(안전·재난) welfare(복지·돌봄) env(환경·청소) farm(농업·농촌) traffic(교통) youth(청년·일자리) health(보건·건강) admin(민원·행정) culture(문화·체육·행사) data(데이터·AI).
· design: 내용에 맞는 카드 디자인을 고른다.
  layout: left(글이 많은 공지·안내) / center(모집·캠페인·행사 홍보 — 깔끔하고 시원한 구성) / bottom(그림이 주인공인 축제·관광·현장·교육 현장)
  공지라고 무조건 left로 하지 말고, 군민이 보고 싶어지게 만드는 쪽을 고른다. 요청에 '지난번 틀'이 있으면 그것과 다른 틀을 우선 고려한다.
  theme: navy(행정·안내) / green(환경·농업·건강) / orange(축제·행사·청년) / mint(복지·교육·생활)
  font: pre(기본 고딕) / ng(나눔고딕·공문 느낌) / bhs(굵은 제목·강렬) / jua(둥근·친근) / gd(고운돋움·부드러움) / bagel(굵고 귀여움)
· 본문 장마다 구도를 정한다. type: list(항목 나열) / stat(숫자가 핵심 — big에 그 숫자) / steps(번호 목록 — 신청 절차처럼 순서가 있으면 flow:true로 단계 사이 화살표, 순서 없는 항목이면 flow 생략) / qa(자주 묻는 질문 — head는 질문, body는 답) / quote(한마디·인용 강조 — body[0]이 큰 문장)
  그림 위치·정렬은 모든 장이 같게 유지되므로 정하지 않는다. 장 모양만 내용에 맞게 고른다(억지로 섞지 말 것).
· 본문 장에서 숫자·핵심어가 중요하면 big에 짧게(8자 이내, 예: "120명" "무료" "11월 14일까지") 넣는다. 없으면 생략.
· 표지 head는 반드시 채운다.
반드시 아래 JSON만 출력한다(설명 금지):
{"design":{"layout":"left","theme":"navy","font":"pre"},"visual":"English concrete visual motifs","keywords":["핵심 키워드1","핵심 키워드2"],"art":"edu","slides":[{"kind":"cover","head":"제목","body":["부제"]},{"kind":"body","type":"list","flow":false,"head":"소제목","big":"120명","body":["문장","문장"]},{"kind":"end","head":"마무리 문구","body":["문의 ○○과 053)668-○○○○"]}],"caption":"…","tags":["#달성군","#대구달성"]}`;

function offline(){
  const src=v('cnSrc'); const paras=src.split(/\n\s*\n|\r?\n/).map(x=>x.trim()).filter(x=>x.length>8); const n=+v('cnCount')||6;
  const title=v('cnTitle')||(paras[0]||'달성군 소식').slice(0,14);
  const slides=[{kind:'cover',head:title,body:[(paras[0]||'').slice(0,22)]}];
  paras.slice(1,n-1).forEach((p,i)=>slides.push({kind:'body',head:`포인트 ${i+1}`,body:p.replace(/\s+/g,' ').match(/.{1,22}/g).slice(0,3)}));
  while(slides.length<n-1) slides.push({kind:'body',head:`포인트 ${slides.length}`,body:['(모델 연결 시 원문에서 핵심 문장을 뽑아 채웁니다)']});
  slides.push({kind:'end',head:'자세한 내용은 달성군 누리집에서',body:[v('cnContact')||'문의 ○○과 053)668-○○○○']});
  const art=/교육|정보화|스마트폰|키오스크/.test(src)?'edu':/축제|꽃|관광/.test(src)?'festival':/안전|재난|태풍|화재/.test(src)?'safety':/복지|돌봄|어르신|장애/.test(src)?'welfare':/환경|쓰레기|재활용/.test(src)?'env':/농업|농촌|농가/.test(src)?'farm':/버스|교통|도로/.test(src)?'traffic':/청년|일자리|창업/.test(src)?'youth':/보건|건강|접종/.test(src)?'health':/문화|체육|공연/.test(src)?'culture':/데이터|AI|디지털/.test(src)?'data':'admin';
  return {art,slides,caption:`${title} 소식을 전해드려요. 자세한 내용은 카드를 넘겨 확인해 주세요.`,tags:['#달성군','#대구달성','#달성군소식']};
}
async function callModel(user){
  const S=window.S||{}; const body={model:S.model||'claude-sonnet-4-5',max_tokens:1800,stream:true,system:SYS,messages:[{role:'user',content:user}]};
  const r=S.key
    ? await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'content-type':'application/json','x-api-key':S.key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},body:JSON.stringify(body)})
    : await fetch('/api/chat',{method:'POST',headers:{'content-type':'application/json','x-access-code':S.code||''},body:JSON.stringify(body)});
  if(!r.ok) throw new Error('모델 호출 실패 ('+r.status+')');
  const rd=r.body.getReader(), dec=new TextDecoder(); let buf='',text='';
  while(true){ const {value,done}=await rd.read(); if(done) break; buf+=dec.decode(value,{stream:true}); const ls=buf.split('\n'); buf=ls.pop();
    for(const ln of ls){ if(!ln.startsWith('data:')) continue; try{ const j=JSON.parse(ln.slice(5)); if(j.type==='content_block_delta'&&j.delta?.text){ text+=j.delta.text; $('#cnMsg').textContent=`작성 중… ${text.length}자`; } }catch(e){} } }
  const m=text.match(/\{[\s\S]*\}/); if(!m) throw new Error('응답 형식을 읽지 못했습니다');
  const j=JSON.parse(m[0]); if(!j.slides?.length) throw new Error('카드 내용이 비었습니다'); return j;
}

/* ── 그리기 ── */
function loadImg(src){ return new Promise(ok=>{ const i=new Image(); i.onload=()=>ok(i); i.onerror=()=>ok(null); i.src=src; }); }
function wrapChars(ctx,text,maxW){ const out=[]; let line=''; for(const ch of String(text)){ const t=line+ch; if(ctx.measureText(t).width>maxW&&line){ out.push(line); line=ch; } else line=t; } if(line) out.push(line); return out; }
/* 띄어쓰기 단위로 줄바꿈(단어가 중간에 잘리지 않게), 한 단어가 폭보다 길 때만 글자 단위 */
function wrap(ctx,text,maxW){ const out=[]; let line=''; for(const w of String(text).split(/\s+/).filter(Boolean)){ const t=line?line+' '+w:w; if(ctx.measureText(t).width<=maxW){ line=t; continue; } if(line) out.push(line); if(ctx.measureText(w).width>maxW){ const parts=wrapChars(ctx,w,maxW); line=parts.pop(); out.push(...parts); } else line=w; } if(line) out.push(line); return out; }
/* 글씨체: AI가 design.font로 고른다 (모두 무료 웹글꼴, index.html에서 불러옴). [이름, 굵게, 보통] */
const CFONTS={ pre:['Pretendard',800,500], ng:['Nanum Gothic',800,700], bhs:['Black Han Sans',400,400], jua:['Jua',400,400], gd:['Gowun Dodum',400,400], bagel:['Bagel Fat One',400,400] };
const LAYOUTS={ left:'왼쪽형', center:'가운데형', bottom:'하단 제목형' };
const curFont=()=>{ const u=v('cnFont'); return CFONTS[u&&u!=='auto'?u:C.data?.design?.font]||CFONTS.pre; };   /* 선택 입력 「글씨체」가 AI 추천이면 AI가 고른 글씨체 */
function font(ctx,w,s,body){ const [fam,b,r]=curFont(); const wt=body?r:(+w>=700?b:r); ctx.font=`${body?(fam==='Bagel Fat One'||fam==='Black Han Sans'?500:wt):wt} ${s}px ${body&&/Bagel|Black Han/.test(fam)?'Pretendard':`"${fam}",Pretendard`},"Malgun Gothic",sans-serif`; }   // 본문 긴 글은 굵은 장식체 대신 고딕
async function fontsReady(){ const [fam,b,r]=curFont(); try{ await Promise.all([document.fonts.load(`${b} 40px "${fam}"`,'가나다'),document.fonts.load(`${r} 40px "${fam}"`,'가나다')]); }catch(e){} }
const themeOf=()=>{ const u=v('cnTheme'); return THEMES[u&&u!=='auto'?u:C.data?.design?.theme]||THEMES.navy; };
const layoutOf=()=>{ const u=v('cnLayout'); return u&&u!=='auto'?u:(LAYOUTS[C.data?.design?.layout]?C.data.design.layout:'left'); };
async function getArt(){
  const key=v('cnArt')||C.data?.art||'admin';
  if(key==='none') return null;
  if(key==='ai'){ if(C.art) return C.art; if(!C.aiFailed) return null;   /* 그리는 중에는 그림 없이(임시 그림을 보여 주지 않음), 실패하면 기본 그림 */
    const k=C.data?.art||'admin'; if(!C.artCache[k]) C.artCache[k]=await loadImg(`assets/cn/cn_${k}.jpg`); return C.artCache[k]; }   // AI 그림 (그리는 동안은 테마 일러스트)
  if(!C.artCache[key]) C.artCache[key]=await loadImg(`assets/cn/cn_${key}.jpg`);
  return C.artCache[key];
}
async function drawSlide(canvas,s,i,total){
  const [W,H]=SIZES[v('cnSize')]||SIZES.sq; const [,grad,fg,acc]=themeOf(); const L=layoutOf();
  canvas.width=W; canvas.height=H; const U=Math.min(W,H*1.05);   /* 글자·여백·그림 크기 기준: 짧은 변 — 가로형(16:9)으로 바꿔도 넘치지 않게 */ const ctx=canvas.getContext('2d'); const pad=U*0.085;
  await fontsReady();
  const g=ctx.createLinearGradient(0,0,W,H); g.addColorStop(0,grad[0]); g.addColorStop(1,grad[1]);
  const art=(s.img&&v('cnArt')!=='none')?s.img:await getArt(); const cover=(im,x,y,w,h,fy=0.5)=>{ const r=Math.max(w/im.width,h/im.height); const iw=im.width*r, ih=im.height*r; ctx.save(); ctx.beginPath(); ctx.rect(x,y,w,h); ctx.clip(); ctx.drawImage(im,x+(w-iw)/2,y+(h-ih)*fy,iw,ih); ctx.restore(); };   /* fy: 위아래로 잘릴 때 남길 위치(그림 주인공은 아래쪽에 있음 — 위는 제목 자리로 비워 그리게 했으므로) */
  const head=(s.head||'').trim()||(s.kind==='cover'?(v('cnTitle')||(s.body||[])[0]||'달성군 소식'):'');   // 표지 제목이 비면 채운다
  const body=s.kind==='cover'&&!(s.head||'').trim()&&!v('cnTitle')?(s.body||[]).slice(1):(s.body||[]);
  const isBody=s.kind==='body';
  // ── 배경 ──
  let dark=isBody, artBox=null;
  // 본문 장 구도: AI가 장마다 고른 그림 위치(s.art)·정렬(s.align)·장 모양(s.type). 없으면 전체 틀(L)을 따른다
  const AP=isBody?(s.artUser&&['right','top','bottom','none'].includes(s.artUser)?s.artUser:(L==='bottom'?'top':L==='center'?'bottom':'right')):null;   /* 그림 위치·정렬은 모든 장 통일(전체 「디자인」) — 장마다 바뀌면 산만하므로 */
  const AL=isBody?(L==='center'?'center':'left'):null;
  if(isBody){
    ctx.fillStyle='#ffffff'; ctx.fillRect(0,0,W,H);
    if(AP==='top'&&art){ artBox=[0,0,W,H*0.34]; cover(art,0,0,W,H*0.34,0.72); ctx.fillStyle=g; ctx.fillRect(0,H*0.34,W,H*0.012); }
    else { ctx.fillStyle=g; ctx.fillRect(0,0,W,H*0.045);
      if(art&&AP==='right'){ const aw=U*0.4, ah=aw, ax=W-aw-pad*0.6, ay=H-ah-pad*1.6; artBox=[ax,ay,aw,ah]; ctx.save(); ctx.globalAlpha=.95; ctx.beginPath(); ctx.roundRect(ax,ay,aw,ah,U*0.03); ctx.clip(); ctx.drawImage(art,ax,ay,aw,ah); ctx.restore(); } }
  }else if(art){
    cover(art,0,0,W,H); const og=ctx.createLinearGradient(0,0,0,H);
    if(L==='bottom'){ og.addColorStop(0,grad[0]+'55'); og.addColorStop(0.45,grad[0]+'22'); og.addColorStop(0.7,grad[0]+'cc'); og.addColorStop(1,grad[0]+'f5'); }
    else if(L==='center'){ og.addColorStop(0,grad[0]+'e6'); og.addColorStop(0.55,grad[0]+'99'); og.addColorStop(1,grad[1]+'55'); }
    else { og.addColorStop(0,grad[0]+'f2'); og.addColorStop(0.45,grad[0]+'b8'); og.addColorStop(1,grad[1]+'33'); }
    ctx.fillStyle=og; ctx.fillRect(0,0,W,H);
  }else{ ctx.fillStyle=g; ctx.fillRect(0,0,W,H); ctx.fillStyle='rgba(255,255,255,.08)'; ctx.beginPath(); ctx.arc(U*0.85,H*0.2,U*0.35,0,7); ctx.fill(); }
  const tx=dark?'#1c2333':fg; const sub=dark?'#4b5563':'rgba(255,255,255,.9)';
  const C_=isBody?AL==='center':L==='center'; ctx.textBaseline='top'; ctx.textAlign=C_?'center':'left'; const X=C_?W/2:pad, MW=W-pad*2;
  // 위 라벨
  font(ctx,'700',Math.round(U*0.03)); ctx.fillStyle=dark?grad[0]:acc; const topTxt=($('#cnTop')?$('#cnTop').value.trim():'달성군 소식'); const lbl=s.kind==='body'?`${i}/${total-1}`:topTxt;   /* 머리글: 표지·마무리 공통(첫 장에서 고침) */
  ctx.fillText(lbl, X, isBody&&AP==='top'&&artBox?H*0.38:pad*0.9);
  const lines=(t,mw)=>wrap(ctx,t,mw);
  let y;
  if(s.kind==='cover'||s.kind==='end'){
    let hs=Math.round(W*(s.kind==='cover'?0.11:0.08)); font(ctx,'800',hs); let hl=lines(head,MW); while((hl.length>2||hl.some(l=>ctx.measureText(l).width>MW))&&hs>U*0.06){ hs-=2; font(ctx,'800',hs); hl=lines(head,MW); }
    const subS=Math.round(U*0.045); const blockH=hl.length*hs*1.18+hs*0.6+body.length*U*0.065;
    if(L==='bottom') y=H-pad*2.6-blockH; else if(C_) y=Math.max(pad*0.9+U*0.07,H*(art?0.3:0.38)-blockH/2); else y=Math.max(pad*0.9+U*0.03*2.2,(art?H*0.22:H*0.36)-hl.length*hs*0.6);
    ctx.fillStyle=tx; hl.forEach(l=>{ ctx.fillText(l,X,y); y+=hs*1.18; });
    ctx.fillStyle=acc; ctx.fillRect(C_?W/2-U*0.06:pad,y+hs*0.2,U*0.12,H*0.008); y+=hs*0.6;
    font(ctx,'500',subS,true); ctx.fillStyle=sub; body.forEach(b=>lines(b,MW).forEach(l=>{ ctx.fillText(l,X,y); y+=U*0.065; }));
  }else{
    // ── 본문 장: 장 모양(type)별로 그린다. 글자 크기는 로고 줄·그림과 겹치지 않게 맞춘다 ──
    const T=['list','stat','steps','qa','quote'].includes(s.type)?s.type:'list';
    const top0=AP==='top'&&artBox?H*0.43:H*0.15;
    const artBottomH=AP==='bottom'&&art?Math.min(U*0.3,H*0.28):0;
    const limit=H-pad-H*0.085-(artBottomH?artBottomH+U*0.03:0);
    const avoid=AP==='right'&&artBox&&art, mwAt=(yy,h0)=>(C_?MW:MW)-(avoid&&yy+h0>artBox[1]?artBox[2]+U*0.03:0);
    const accent=grad[1];
    // k: 글자 배율 — 넘치면 줄여 가며 다시 잰다(dry=true) → 맞는 크기로 실제로 그린다
    const run=(k,dry)=>{ let yy=top0; const P=(t,x,yv)=>{ if(!dry) ctx.fillText(t,x,yv); };
      const bar=()=>{ if(!dry){ ctx.fillStyle=accent; ctx.fillRect(C_?W/2-U*0.045:pad,yy,U*0.09,H*0.006); } yy+=H*0.006+U*0.035; };
      if(T==='stat'){
        const big=(s.big||((s.body||[]).join(' ').match(/[\d,.]+\s*[^\s,.]{0,3}/)||[head])[0]).trim();
        const bs=Math.round(U*0.2*k); font(ctx,'800',bs); while(ctx.measureText(big).width>MW&&bs>U*0.08){ font(ctx,'800',(bs-=4)); }
        ctx.fillStyle=accent; P(big,X,yy); yy+=bs*1.1;
        const hs=Math.round(U*0.062*k); font(ctx,'800',hs); ctx.fillStyle=tx; lines(head,mwAt(yy,hs)).forEach(l=>{ P(l,X,yy); yy+=hs*1.22; }); yy+=hs*0.2; bar();
        const ts=Math.round(U*0.044*k); font(ctx,'500',ts,true); ctx.fillStyle='#2b3445'; body.forEach(b=>{ lines(b,mwAt(yy,ts)).forEach(l=>{ P(l,X,yy); yy+=ts*1.5; }); });
      }else if(T==='steps'){
        const hs=Math.round(U*0.068*k); if(s.big){ const bs=Math.round(U*0.1*k); font(ctx,'800',bs); ctx.fillStyle=accent; P(s.big,X,yy); yy+=bs*1.12; }
        font(ctx,'800',hs); ctx.fillStyle=tx; lines(head,mwAt(yy,hs)).forEach(l=>{ P(l,X,yy); yy+=hs*1.22; }); yy+=hs*0.35;
        const ts=Math.round(U*0.042*k), r=ts*0.85;
        body.forEach((b,n)=>{ const bx=pad, mw=mwAt(yy,ts*2)-r*2.6; font(ctx,'500',ts,true); const ls=lines(b,mw); const bh=Math.max(r*2.2,ls.length*ts*1.45+ts*0.8);
          if(!dry){ ctx.fillStyle='#f2f5fb'; ctx.beginPath(); ctx.roundRect(bx,yy,mwAt(yy,ts*2),bh,U*0.02); ctx.fill();
            ctx.fillStyle=accent; ctx.beginPath(); ctx.arc(bx+r*1.4,yy+bh/2,r,0,7); ctx.fill(); ctx.fillStyle='#fff'; font(ctx,'800',Math.round(ts*0.95)); ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(String(n+1),bx+r*1.4,yy+bh/2+1); ctx.textBaseline='top'; ctx.textAlign='left';
            font(ctx,'500',ts,true); ctx.fillStyle='#1c2333'; let ty=yy+(bh-ls.length*ts*1.45)/2+ts*0.1; ls.forEach(l=>{ ctx.fillText(l,bx+r*2.8,ty); ty+=ts*1.45; }); }
          yy+=bh+(n<body.length-1?ts*0.25+U*0.012:0);
          if(!dry&&s.flow&&n<body.length-1){ ctx.fillStyle=accent; ctx.beginPath(); const cx=bx+r*1.4; ctx.moveTo(cx-r*0.35,yy-U*0.012-ts*0.15); ctx.lineTo(cx+r*0.35,yy-U*0.012-ts*0.15); ctx.lineTo(cx,yy-ts*0.02); ctx.fill(); } });
        ctx.textAlign=C_?'center':'left';
      }else if(T==='qa'){
        const hs=Math.round(U*0.06*k); font(ctx,'800',hs); const q='Q. '+head.replace(/^Q\.\s*/,''); ctx.fillStyle=accent; lines(q,mwAt(yy,hs)).forEach(l=>{ P(l,X,yy); yy+=hs*1.25; }); yy+=hs*0.3; bar();
        const ts=Math.round(U*0.046*k); font(ctx,'500',ts,true); ctx.fillStyle='#1c2333'; const ans='A. '+body.join(' ').replace(/^A\.\s*/,''); lines(ans,mwAt(yy,ts)).forEach(l=>{ P(l,X,yy); yy+=ts*1.55; });
      }else if(T==='quote'){
        const qs=Math.round(U*0.16*k); font(ctx,'800',qs); ctx.fillStyle=accent+'55'; P('“',X,yy-qs*0.15); yy+=qs*0.62;
        const ts=Math.round(U*0.064*k); font(ctx,'800',ts); ctx.fillStyle=tx; const main=(body[0]||head); lines(main,mwAt(yy,ts)).forEach(l=>{ P(l,X,yy); yy+=ts*1.35; }); yy+=ts*0.4; bar();
        const ss=Math.round(U*0.04*k); font(ctx,'500',ss,true); ctx.fillStyle='#4b5563'; [body[0]?head:'',...body.slice(1)].filter(Boolean).forEach(b=>lines(b,mwAt(yy,ss)).forEach(l=>{ P(l,X,yy); yy+=ss*1.5; }));
      }else{
        if(s.big){ const bs=Math.round(U*0.12*k); font(ctx,'800',bs); ctx.fillStyle=accent; P(lines(s.big,MW)[0],X,yy); yy+=bs*1.15; }
        const hs=Math.round(U*0.07*k); font(ctx,'800',hs); ctx.fillStyle=tx; lines(head,mwAt(yy,hs)).forEach(l=>{ P(l,X,yy); yy+=hs*1.2; }); yy+=hs*0.15; bar();
        const ts=Math.round(U*0.046*k); font(ctx,'500',ts,true);
        body.forEach(b=>{ const ls=lines(b,mwAt(yy,ts)-(C_?0:U*0.05)); if(!dry&&!C_){ ctx.fillStyle=grad[0]; ctx.fillRect(pad,yy+ts*0.42,U*0.012,U*0.012); } ctx.fillStyle='#2b3445'; ls.forEach(l=>{ P(l,C_?X:pad+U*0.04,yy); yy+=ts*1.5; }); yy+=ts*0.5; });
      }
      return yy; };
    let k=1; while(k>0.55&&run(k,true)>limit) k-=0.05; y=run(k,false);
    if(artBottomH&&art){ const ah=artBottomH, aw=Math.min(W-pad*2,ah*(art.width/art.height)), ax=(W-aw)/2, ay=H-pad-H*0.085-ah; ctx.save(); ctx.globalAlpha=.95; ctx.beginPath(); ctx.roundRect(ax,ay,aw,ah,U*0.03); ctx.clip(); const r=Math.max(aw/art.width,ah/art.height); ctx.drawImage(art,ax+(aw-art.width*r)/2,ay+(ah-art.height*r)*0.72,art.width*r,art.height*r); ctx.restore(); }
  }
  // 로고(선택 입력 「로고」): 모든 장 같은 자리(왼쪽 아래)·같은 크기, 원본 그대로
  const lk=v('cnLogo')||'ci'; C.logos=C.logos||{}; const need=lk==='both'?['ci','slogan']:lk==='none'?[]:[lk];
  for(const n of need) if(!C.logos[n]) C.logos[n]=await loadImg(n==='ci'?'assets/dalseong_ci.png':'assets/slogan.png');
  const ims=need.map(n=>C.logos[n]).filter(Boolean);
  if(ims.length){ const lh=H*0.05, gap=lh*0.35, ws=ims.map(im=>im.width*lh/im.height), tw=ws.reduce((a,b)=>a+b,0)+gap*(ims.length-1);
    if(!dark){ ctx.fillStyle='rgba(255,255,255,.95)'; ctx.beginPath(); ctx.roundRect(pad-lh*0.25,H-pad-lh-lh*0.2,tw+lh*0.5,lh+lh*0.4,lh*0.2); ctx.fill(); }
    let x=pad; ims.forEach((im,k)=>{ ctx.drawImage(im,x,H-pad-lh,ws[k],lh); x+=ws[k]+gap; }); }
  const foot=$('#cnFoot')?$('#cnFoot').value.trim():'대구광역시 달성군';
  if(s.kind!=='cover'&&foot){ ctx.textAlign='right'; font(ctx,'600',Math.round(U*0.028),true); ctx.fillStyle=dark?'#9aa3b2':'rgba(255,255,255,.7)'; ctx.fillText(foot,W-pad,H-pad-U*0.03); }
}
async function renderAll(){
  const d=C.data; const wrapEl=$('#cnSlides'); wrapEl.innerHTML=''; wrapEl.style.gridTemplateColumns=`repeat(${d.slides.length},minmax(0,1fr))`;   /* 카드 수에 맞춰 왼쪽 열 폭을 꽉 채운다 */
  { const dz=d.design||{}, LN={left:'왼쪽형',center:'가운데형',bottom:'하단 제목형'}, FN={pre:'기본 고딕',ng:'나눔고딕',bhs:'굵은 제목체',bagel:'베이글',gd:'고운돋움',jua:'주아체'};
    const it=(lbl,user,ai,map)=>{ const u=v(user); const byUser=u&&u!=='auto'; const k=byUser?u:ai; const name=map?(map[k]||k):((THEMES[k]||[])[0]||k); return `<span class="${byUser?'me':''}"><em>${lbl}</em>${name||'—'}${byUser?' <small>직접</small>':''}</span>`; };
    $('#cnSum').innerHTML=`<b>✨ AI가 고른 디자인</b><div>${it('틀','cnLayout',dz.layout||'left',LN)}${it('색','cnTheme',dz.theme||'navy')}${it('글씨체','cnFont',dz.font||'pre',FN)}<span><em>카드</em>${d.slides.length}장</span></div>`; }
  for(let i=0;i<d.slides.length;i++){ const c=document.createElement('canvas'); c.className='cn-thumb'+(i===C.cur?' on':''); c.title=`${i+1}번째 카드`; c.onclick=()=>{ C.cur=i; renderAll(); }; wrapEl.appendChild(c); await drawSlide(c,d.slides[i],i,d.slides.length); }
  await drawSlide($('#cnMain'),d.slides[C.cur],C.cur,d.slides.length);
  const s=d.slides[C.cur]; const fe=document.activeElement; if(fe!==$('#cnEditHead')) $('#cnEditHead').value=s.head; if(fe!==$('#cnEditBody')) $('#cnEditBody').value=(s.body||[]).join('\n'); if(fe!==$('#cnEditBig')) $('#cnEditBig').value=s.big||''; $('#cnBigWrap').hidden=s.kind!=='body';   /* 입력 중인 칸은 덮어쓰지 않는다 */ $('#cnCurNo').textContent=`${C.cur+1} / ${d.slides.length}`; { const first=C.cur===0; ['cnTop','cnFoot'].forEach(id=>{ $('#'+id).disabled=!first; }); ['cnLock1','cnLock2'].forEach(id=>$('#'+id).textContent=first?'· 모든 카드 공통':''); }
  $('#cnSvOne').textContent=`지금 보고 있는 ${C.cur+1}번째 카드 · 이미지 파일`; $('#cnSvAll').textContent=`카드 ${d.slides.length}장 모두 한 번에 · 이미지 파일`;
  $('#cnDots').innerHTML=d.slides.map((_,k)=>`<i class="${k===C.cur?'on':''}" data-k="${k}"></i>`).join(''); $('#cnArrL').hidden=C.cur===0; $('#cnArrR').hidden=C.cur===d.slides.length-1;
  $('#cnCaption').value=`${d.caption||''}\n\n${(d.tags||[]).join(' ')}`;
  $('#cnOut').hidden=false;
}
async function make(){
  if(C.busy) return; if(!v('cnSrc')){ $('#cnMsg').textContent='알릴 내용(보도자료·공고문)을 붙여넣어 주세요.'; return $('#cnSrc').focus(); }
  C.busy=true; $('#cnGo').disabled=true; $('#cnMsg').textContent='작성 중…';
  try{
    const S=window.S||{};
    if((S.key||S.server)&&!S.offline){ const prevD=C.data?.design; C.data=await callModel(`${prevD?`지난번 틀: ${prevD.layout}·${prevD.theme}·${prevD.font} — 이번에는 가능하면 다른 조합으로\n`:''}장수: ${v('cnCount')||6}장(표지·마무리 포함)\n제목(참고): ${v('cnTitle')||'원문에서 뽑기'}\n문의처: ${v('cnContact')||'원문에 있으면 사용, 없으면 ○○'}\n원문:\n${v('cnSrc')}`); $('#cnMsg').textContent='카드 문구를 만들었습니다 — AI가 그림을 그리는 동안 카드를 넘겨 보세요.'; }
    else { await new Promise(r=>setTimeout(r,300)); C.data=offline(); $('#cnMsg').textContent='오프라인 모드 — 모델 연결 시 원문을 읽어 장별 문구를 씁니다.'; }
    C.cur=0; C.art=null; C.aiFailed=!(S.key||S.server); $('#cnArt').value='ai'; await renderAll(); if(S.key||S.server) aiArt(false); window.dsSave&&dsSave('card',C.data.slides[0]?.head||'카드뉴스',C.data.slides.map((x,i)=>`[${i+1}장] ${x.head}\n${(x.body||[]).join('\n')}`).join('\n\n')+'\n\n'+(C.data.caption||'')+'\n'+(C.data.tags||[]).join(' ')); $('#cnOut').scrollIntoView({behavior:'smooth',block:'start'}); if(window.S&&S.stats) S.stats.gen++,window.dsHit&&dsHit('gen');
  }catch(e){ $('#cnMsg').textContent='⚠ '+e.message; }
  finally{ C.busy=false; $('#cnGo').disabled=false; }
}
/* ── AI 그림: 문구 작성 때 뽑은 핵심 장면(visual)을 주인공으로. 다시 그리기는 화풍·빛만 바꾼다 ── */
const AI_STYLE=['clean flat vector illustration with soft pastel colors','soft watercolor illustration','warm gouache poster painting','bright modern 3D-style illustration','gentle pastel illustration'];
const AI_TIME=['bright daytime','warm afternoon light','soft morning light'];
const pickR=a=>a[Math.floor(Math.random()*a.length)];
let _cnT=null;
function cnLoad(msg){ const L=$('#cnAiLoad'); if(!L) return; clearInterval(_cnT); if(msg===false){ L.hidden=true; return; } L.hidden=false;
  if(msg){ L.innerHTML=`<b>${msg}</b><button type="button" id="cnAiGo2">🎨 AI 그림 그리기</button>`; $('#cnAiGo2').onclick=()=>aiArt(true); return; }
  const t0=Date.now(); const f=()=>{ L.innerHTML=`<div class="spin"></div><b>🎨 AI가 그림을 그리는 중… ${Math.round((Date.now()-t0)/1000)}초</b><small>보통 30~60초\n그동안 카드를 넘겨 보며 문구를 고쳐 보세요\n완성되면 그림이 바뀝니다</small>`; }; f(); _cnT=setInterval(f,1000); }
async function aiArt(redo){
  if(!C.data||C.aiBusy) return; const S=window.S||{}, code=S.code||''; const d=C.data;
  const subj=d.visual||((d.slides[0]?.head||'')+' '+(d.slides[0]?.body||[]).join(' '));
  const [W,H]=SIZES[v('cnSize')]||SIZES.sq; const size=H>W*1.1?'1024x1536':W>H*1.1?'1536x1024':'1024x1024';
  const prompt=`Illustration for a Korean local government (Dalseong-gun, Daegu) public-service card news.
MAIN SUBJECT (must be clearly visible and dominant): ${subj}
${(d.keywords||[]).length?`Key themes: ${d.keywords.join(', ')}.\n`:''}Style: ${redo?pickR(AI_STYLE):'clean flat vector illustration with soft pastel colors and navy accents'}, ${redo?pickR(AI_TIME):'bright daytime'}.${d.visual?' The main subject must stay the same in every version — only the art style and lighting change.':''}
Keep the upper half simple with generous empty space for headline text. IMPORTANT: absolutely no text, no letters, no numbers, no logos, no signs. No close-up faces of real people.`;
  C.aiBusy=true; C.aiFailed=false; cnLoad(); const btn=$('#cnAi'); if(btn) btn.disabled=true;
  try{
    const r=await fetch('/api/card',{method:'POST',headers:{'content-type':'application/json','x-access-code':code},body:JSON.stringify({action:'start',prompt,size,expect:[]})});
    const j=await r.json(); if(!r.ok||!j.id) throw new Error(j.error||'접수 실패');
    let job=null; const t0=Date.now(); while(Date.now()-t0<180000){ await new Promise(res=>setTimeout(res,1500)); job=await (await fetch('/api/card?id='+j.id,{headers:{'x-access-code':code}})).json(); if(job.status==='done'||job.status==='error') break; }
    if(!job||job.status!=='done') throw new Error(job?.error||'시간 초과');
    const im=await loadImg(job.image); if(!im) throw new Error('그림을 열지 못했습니다'); if(C.data!==d) return;
    C.art=im; C.aiBusy=false; cnLoad(false); if(v('cnArt')==='ai') await renderAll();
    const mg=$('#cnMsg'); if(/그리는 동안/.test(mg.textContent)) mg.textContent='그림이 완성됐습니다 — 장을 눌러 문구를 고칠 수 있습니다.';
  }catch(e){ C.aiBusy=false; C.aiFailed=true; if(C.data===d&&v('cnArt')==='ai') renderAll(); cnLoad('⚠️ AI 그림을 만들지 못했습니다 — '+String(e.message||'').slice(0,60)+' · 기본 그림으로 바꿔 두었습니다'); }
  finally{ C.aiBusy=false; if(btn) btn.disabled=false; }
}
function dl(canvas,name){ const a=document.createElement('a'); a.download=name; a.href=canvas.toDataURL('image/png'); a.click(); }
function init(){
  if($('#cnGo')._on) return; $('#cnGo')._on=1;
  $('#cnSize').innerHTML=Object.entries(SIZES).map(([k,[,,l]])=>`<option value="${k}">${l}</option>`).join('');
  $('#cnTheme').innerHTML='<option value="auto">✨ AI 추천</option>'+Object.entries(THEMES).map(([k,[l]])=>`<option value="${k}">${l}</option>`).join('');
  $('#cnArt').innerHTML='<option value="ai">🎨 AI 그림 (추천)</option><optgroup label="기본 그림">'+Object.entries(ART).map(([k,l])=>`<option value="${k}">${l}</option>`).join('')+'</optgroup><option value="none">그림 없이</option>';
  $('#cnArt').onchange=()=>{ if(C.data){ renderAll(); if(v('cnArt')==='ai'&&!C.art&&!C.aiBusy) aiArt(false); } };
  $('#cnAi').onclick=()=>aiArt(true);
  /* 파일 추가: 보도자료와 같은 읽기(pressRead · app.js)로 글을 뽑아 「알릴 내용」에 채운다 (여러 번·여러 개 가능) */
  const readFiles=async fs=>{ const L=$('#cnFileList'); const done=[];
    for(const f of fs){ L.textContent=`「${f.name}」 읽는 중…`;
      try{ if(typeof window.pressRead!=='function') throw new Error('읽기 기능을 불러오지 못했습니다'); const r=await window.pressRead(f); if(!r.text) throw new Error('글자를 찾지 못했습니다(그림 파일은 내용으로 쓰지 않습니다)');
        const t=r.text.replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim().slice(0,8000); const src=$('#cnSrc');
        src.value=src.value.trim()?src.value.trim()+`\n\n[${f.name}]\n`+t:t;
        if(!v('cnTitle')){ const ls=t.split('\n').map(x=>x.replace(/^[◎○□▸\-\s]+|[\-\s]+$/g,'').trim()).filter(x=>x.length>=4&&!/^※/.test(x)); const first=ls.find(x=>/(계획|모집|안내|개최|운영|추진|공고)$/.test(x)&&x.length<=40)||ls[0]; /* 문서 제목처럼 생긴 줄을 먼저 */ if(first) $('#cnTitle').value=first.slice(0,40); }
        done.push(`📄 ${f.name} (${t.length.toLocaleString()}자)`); }
      catch(err){ done.push(`⚠ ${f.name} — ${err.message}`); } }
    L.textContent=done.join(' · ')+' — 아래 「카드뉴스 만들기」를 누르세요'; };
  $('#cnFile').onchange=e=>{ const fs=[...e.target.files]; e.target.value=''; readFiles(fs); };
  // 샘플 계획서(실명·결재·예산 정보를 뺀 시연용 PDF)를 실제 파일처럼 올린다
  // 메뉴에 들어오면 샘플 파일과 PDF 읽기 도구를 미리 받아 둔다 (처음 누를 때 멈춘 듯 보이지 않게)
  let _sampleBlob=null; const preload=()=>{ if(!_sampleBlob) _sampleBlob=fetch('assets/sample_edu_plan.pdf').then(r=>r.blob()).catch(()=>null);
    if(!window.pdfjsLib&&!document.querySelector('script[src="vendor/pdf.min.js"]')){ const sc=document.createElement('script'); sc.src='vendor/pdf.min.js'; sc.onload=()=>{ try{ pdfjsLib.GlobalWorkerOptions.workerSrc='vendor/pdf.worker.min.js'; }catch(e){} }; document.head.appendChild(sc); } };
  setTimeout(preload,800);
  $('#cnSampleFile').onclick=async()=>{ const btn=$('#cnSampleFile'); if(btn.disabled) return; btn.disabled=true; const t0=btn.textContent; btn.textContent='⏳ 샘플 계획서 읽는 중…'; $('#cnFileList').textContent='샘플 계획서를 올리고 내용을 읽고 있습니다…';
    await new Promise(r=>setTimeout(r,30));
    try{ preload(); const b=await _sampleBlob; if(!b) throw 0; $('#cnSrc').value=''; $('#cnTitle').value=''; await readFiles([new File([b],'2026년 군민 정보화교육 추진 계획(샘플).pdf',{type:'application/pdf'})]); if(!v('cnContact')) $('#cnContact').value='문의 정보통신과 053)668-0000'; }catch(e){ $('#cnFileList').textContent='⚠ 샘플 파일을 불러오지 못했습니다'; _sampleBlob=null; } finally{ btn.disabled=false; btn.textContent=t0; } };
  $('#cnGo').onclick=make;
  ['cnSize','cnTheme','cnLogo','cnLayout','cnFont'].forEach(id=>$('#'+id).onchange=()=>{ if(C.data) renderAll(); });
  $('#cnSize').addEventListener('change',()=>{ if(C.data&&v('cnArt')==='ai'&&C.art){ C.art=null; aiArt(false); } });   // 비율이 바뀌면 그 비율로 다시 그린다
  // 이 장 편집: 고치는 대로 바로 반영 (버튼 없이)
  let _ed=null; const applyEdit=()=>{ if(!C.data) return; const s=C.data.slides[C.cur]; s.head=v('cnEditHead'); s.body=$('#cnEditBody').value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean); if(s.kind==='body') s.big=v('cnEditBig'); renderAll(); };
  ['cnEditBig','cnEditHead','cnEditBody'].forEach(id=>$('#'+id).addEventListener('input',()=>{ clearTimeout(_ed); _ed=setTimeout(applyEdit,450); }));
  /* 이 장만 AI로 다시 만들기: 같은 자리(표지·본문·마무리)를 원문 기준으로 다른 표현·장 모양으로 다시 쓴다 */
  $('#cnRedo').onclick=async()=>{ if(!C.data||C.busy) return; const btn=$('#cnRedo'), d=C.data, k=C.cur, cur=d.slides[k]; const S=window.S||{};
    if(!(S.key||S.server)||S.offline){ toast?.('AI 연결 시 사용할 수 있습니다'); return; }
    btn.disabled=true; const t0=btn.textContent; btn.textContent='⏳ 현재 카드 문구를 다시 쓰는 중…';
    const sys=`당신은 대구광역시 달성군 SNS 카드뉴스 담당자입니다. 카드뉴스 중 한 장만 다시 씁니다.
· 같은 역할(${cur.kind==='cover'?'표지':cur.kind==='end'?'마무리':'본문'})을 유지하되 지금과 다른 표현으로, 더 눈에 띄고 쉽게.
· 본문 장이면 내용에 가장 맞는 type을 고른다: list / stat(big에 숫자) / steps / qa / quote. 지금 type(${cur.type||'list'})과 다르게 해도 좋다.
· 제목 12자 이내, 문장은 22자 이내, 숫자·날짜는 원문에 있는 것만.
· visual: 이 장 내용에 꼭 맞는 그림 장면을 영어 1문장으로(글자·로고 없이).
반드시 JSON 하나만 출력: {"kind":"${cur.kind}","type":"list","flow":false,"head":"…","big":"","body":["…"],"visual":"English scene for this card"}`;
    const others=d.slides.map((x,n)=>`${n+1}장${n===k?'(다시 쓸 장)':''}: ${x.head} / ${(x.body||[]).join(' · ')}`).join('\n');
    try{ const txt=await dsLLM(sys,`원문:\n${v('cnSrc').slice(0,6000)}\n\n지금 카드 구성:\n${others}`,{max:800});
      const m=txt.match(/\{[\s\S]*\}/); if(!m) throw new Error('응답을 읽지 못했습니다'); const j=JSON.parse(m[0]);
      if(!j.head&&!(j.body||[]).length) throw new Error('내용이 비었습니다');
      d.slides[k]={kind:cur.kind,type:j.type||cur.type,flow:!!j.flow,head:j.head||cur.head,big:j.big||'',body:Array.isArray(j.body)&&j.body.length?j.body:cur.body,img:cur.img||null};
      await renderAll(); toast?.(`${k+1}번째 카드 문구를 새로 만들었습니다 — 그림도 맞춰 그리는 중…`);
      // 이 장 그림도 새 내용에 맞게 다시 그린다 (이 장에만 적용)
      if(j.visual&&v('cnArt')!=='none'){ btn.textContent='🎨 현재 카드 그림 그리는 중…'; cnLoad(); const code=S.code||''; const [W,H]=SIZES[v('cnSize')]||SIZES.sq;
        const prompt=`Illustration for a Korean local government (Dalseong-gun) public-service card news.\nMAIN SUBJECT (must be clearly visible and dominant): ${j.visual}\nStyle: same as the other cards — ${C.data.visual?'consistent with: '+C.data.visual+'. ':''}clean flat vector illustration with soft pastel colors and navy accents, bright daytime.\nIMPORTANT: absolutely no text, no letters, no numbers, no logos, no signs. No close-up faces of real people.`;
        try{ const r=await fetch('/api/card',{method:'POST',headers:{'content-type':'application/json','x-access-code':code},body:JSON.stringify({action:'start',prompt,size:H>W*1.1?'1024x1536':W>H*1.1?'1536x1024':'1024x1024',expect:[]})});
          const jj=await r.json(); if(!r.ok||!jj.id) throw new Error(jj.error||'접수 실패'); let job=null; const t1=Date.now();
          while(Date.now()-t1<180000){ await new Promise(res=>setTimeout(res,1500)); job=await (await fetch('/api/card?id='+jj.id,{headers:{'x-access-code':code}})).json(); if(job.status==='done'||job.status==='error') break; }
          if(!job||job.status!=='done') throw new Error(job?.error||'시간 초과'); const im=await loadImg(job.image); if(im&&C.data===d){ d.slides[k].img=im; await renderAll(); toast?.(`${k+1}번째 카드 그림을 새로 그렸습니다`); } }
        catch(err){ toast?.('⚠ 현재 카드 그림은 그대로 둡니다 — '+err.message); }
        finally{ cnLoad(false); } } }
    catch(e){ toast?.('⚠ 다시 만들지 못했습니다 — '+e.message); }
    finally{ btn.disabled=false; btn.textContent=t0; } };
  { let _ft=null; $('#cnTop').addEventListener('input',()=>{ clearTimeout(_ft); _ft=setTimeout(()=>{ if(C.data) renderAll(); },400); }); $('#cnFoot').addEventListener('input',()=>{ clearTimeout(_ft); _ft=setTimeout(()=>{ if(C.data) renderAll(); },400); }); }
  $('#cnArrL').onclick=()=>$('#cnPrev').click(); $('#cnArrR').onclick=()=>$('#cnNext').click();
  $('#cnDots').onclick=e=>{ const k=e.target.dataset?.k; if(k!=null&&C.data){ C.cur=+k; renderAll(); } };
  $('#cnPrev').onclick=()=>{ if(C.data){ C.cur=(C.cur-1+C.data.slides.length)%C.data.slides.length; renderAll(); } };
  $('#cnNext').onclick=()=>{ if(C.data){ C.cur=(C.cur+1)%C.data.slides.length; renderAll(); } };
  $('#cnPng').onclick=()=>{ if(C.data) dl($('#cnMain'),`카드뉴스_${C.cur+1}.png`); };
  $('#cnAll').onclick=async()=>{ if(!C.data) return; const t=document.createElement('canvas'); for(let i=0;i<C.data.slides.length;i++){ await drawSlide(t,C.data.slides[i],i,C.data.slides.length); dl(t,`카드뉴스_${String(i+1).padStart(2,'0')}.png`); await new Promise(r=>setTimeout(r,350)); } toast?.(`카드 ${C.data.slides.length}장을 내려받았습니다`); };
  $('#cnCopy').onclick=()=>{ navigator.clipboard.writeText($('#cnCaption').value); toast?.('게시글 문구를 복사했습니다'); };
  if($('#cnSample')) $('#cnSample').onclick=()=>{ $('#cnTitle').value='하반기 정보화교육 수강생 모집'; $('#cnCount').value='6'; $('#cnContact').value='문의 정보통신과 053)668-2454';
    $('#cnSrc').value='달성군은 디지털 취약계층의 정보 격차 해소를 위해 2026년 하반기 주민 정보화교육 수강생을 모집한다.\n교육은 11월 17일부터 12월 19일까지 8주간 군청 정보화교육장과 읍·면 주민자치센터에서 운영된다.\n과정은 스마트폰 활용(사진·카카오톡·모바일 신분증), 키오스크 실습(무인주문·민원발급), 생성형 AI 기초(검색·문서 작성) 3개로, 과정별 주 2회 2시간씩 진행된다.\n모집 인원은 과정별 20명, 총 120명이며 달성군민이면 누구나 신청할 수 있다. 수강료는 무료다.\n신청은 11월 14일까지 읍·면 행정복지센터 방문 또는 전화로 하면 된다.\n군 관계자는 "어르신도 키오스크와 스마트폰을 어렵지 않게 쓸 수 있도록 실습 위주로 운영하겠다"고 말했다.';
    toast?.('예시를 채웠습니다 — 「카드뉴스 만들기」를 눌러보세요'); };
  $('#cnReset').onclick=()=>{ ['cnTitle','cnContact','cnSrc'].forEach(id=>$('#'+id).value=''); $('#cnFileList').textContent='파일을 올리면 내용을 읽어 위 칸에 채웁니다 (한글 hwpx·워드·PDF·텍스트) · 직접 붙여넣어도 됩니다'; C.data=null; C.art=null; cnLoad(false); $('#cnOut').hidden=true; $('#cnMsg').textContent=''; };
}
window.CARDNEWS={init};
})();
