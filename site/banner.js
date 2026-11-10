/* ============================================================
   달성On — 홍보 현수막 제작하기 (banner.js)
   · 행사명·기간·장소만 넣으면 현수막 문구 3안(메인+서브)을 만들고, 규격 비율 그대로 시안을 그려 보여 준다.
   · 배경은 AI가 행사에 맞게 그린 그림(기본, /api/card · 글자 없는 배경만)·군 보유 사진(assets/hero.jpg)·단색·내 사진. 군 CI(assets/dalseong_ci.png)는 원본 그대로 비율만 맞춰 올린다.
   · 결과 : 시안 PNG(가로 2400px) + 업체 전달용 사양(문구·규격·수량·배경·연락처) 복사
   · 현수막은 결국 업체가 제작하므로 "문구 확정 + 시안 + 사양서"까지가 이 화면의 역할이다.
   ============================================================ */
(function(){
"use strict";
const $=s=>document.querySelector(s);
const B={busy:false,alts:[],pick:0,img:null,custom:null,logo:null,ai:null,aiKey:'',aiBusy:false};
const PRESETS=[[500,90,'가로 500×90'],[400,70,'가로 400×70'],[90,300,'세로 90×300']];   // 단위 cm
const BGS={ ai:['🎨 AI 배경 (행사 맞춤)',null], photo:['군 보유 사진(비슬산)',null], navy:['남색 단색','#0b2a6b'], green:['진녹색 단색','#145a32'], orange:['주황 단색','#d35400'], white:['흰 바탕(남색 글자)','#ffffff'], custom:['내 사진 올리기',null] };
const num=id=>{ const x=parseFloat(String($('#'+id).value).replace(',','.')); return x>0?x:0; };
const dims=()=>{ const w=num('bnW')||500, h=num('bnH')||90; return [w,h]; };   // cm
const $$p=s=>[...document.querySelectorAll(s)];
const v=id=>($('#'+id).value||'').trim();

const SYS=`당신은 대구광역시 달성군 홍보 담당자입니다. 행사·사업 현수막 문구를 만듭니다.
· 메인 문구는 12자 이내(공백 포함), 멀리서 한눈에 읽히게. 서브 문구는 24자 이내로 일시·장소·대상 중 핵심만.
· 홍보성 과장·느낌표 남발 금지. 군민 대상이면 "함께" "여러분" 같은 친근한 어조, 공고성이면 격식.
· 모르는 날짜·장소는 입력된 값만 쓰고 지어내지 않는다.
반드시 아래 JSON만 출력한다(설명 금지):
{"alts":[{"main":"…","sub":"…","why":"이 안을 고른 이유 한 줄"},{"main":"…","sub":"…","why":"…"},{"main":"…","sub":"…","why":"…"}]}`;

function offline(){
  const n=v('bnName')||'○○ 행사', w=v('bnWhen'), p=v('bnPlace');
  const sub=[w,p].filter(Boolean).join(' · ')||'일시 · 장소';
  return [{main:n,sub,why:'행사명 그대로(기본안)'},{main:`함께해요, ${n.replace(/^\d{4}년\s*/,'').slice(0,8)}`,sub,why:'친근형'},{main:`${n.replace(/^\d{4}년\s*/,'').slice(0,9)} 개최`,sub,why:'공고형'}];
}
async function callModel(user){
  const S=window.S||{}; const payload=JSON.stringify({model:S.model||'claude-sonnet-4-5',max_tokens:600,stream:false,system:SYS,messages:[{role:'user',content:user}]});
  const r=S.key
    ? await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'content-type':'application/json','x-api-key':S.key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},body:payload})
    : await fetch('/api/chat',{method:'POST',headers:{'content-type':'application/json','x-access-code':S.code||''},body:JSON.stringify({...JSON.parse(payload),stream:true})});
  if(!r.ok) throw new Error('모델 호출 실패 ('+r.status+')');
  const ct=r.headers.get('content-type')||''; let text='';
  if(ct.includes('text/event-stream')){ const rd=r.body.getReader(), dec=new TextDecoder(); let buf=''; while(true){ const {value,done}=await rd.read(); if(done) break; buf+=dec.decode(value,{stream:true}); const ls=buf.split('\n'); buf=ls.pop(); for(const ln of ls){ if(!ln.startsWith('data:')) continue; try{ const j=JSON.parse(ln.slice(5)); if(j.type==='content_block_delta'&&j.delta?.text) text+=j.delta.text; }catch(e){} } } }
  else { const j=await r.json(); text=(j.content||[]).map(c=>c.text||'').join(''); }
  const m=text.match(/\{[\s\S]*\}/); if(!m) throw new Error('응답 형식을 읽지 못했습니다');
  return JSON.parse(m[0]).alts;
}

/* ── 그리기 ── */
function loadImg(src){ return new Promise((ok,no)=>{ const i=new Image(); i.onload=()=>ok(i); i.onerror=()=>ok(null); i.src=src; }); }
/* 글씨체: 모두 무료(OFL) 웹글꼴 — 인쇄물에도 쓸 수 있다. w:[메인,서브·주최] 굵기 (한 굵기만 있는 글꼴은 400) */
const FONTS={ pre:['기본 고딕','Pretendard',[800,600]], bhs:['굵은 제목체','Black Han Sans',[400,400]], gd:['고운돋움','Gowun Dodum',[400,400]], sf:['해바라기','Sunflower',[700,500]], jua:['주아체','Jua',[400,400]] };
B.font='pre';
const FF=f=>FONTS[f||B.font]||FONTS.pre;
const fstr=(role,px,f)=>{ const [, fam, w]=FF(f); const wt=role==='main'?w[0]:w[1]; return `${wt} ${px}px "${fam}",Pretendard,"Malgun Gothic",sans-serif`; };
async function fontReady(){ const keys=new Set([B.font]); if(B.L) ['main','sub','host'].forEach(k=>B.L[k].font&&keys.add(B.L[k].font)); try{ await Promise.all([...keys].flatMap(k=>{ const [, fam, w]=FF(k); return [document.fonts.load(`${w[0]} 40px "${fam}"`,'가나다'),document.fonts.load(`${w[1]} 40px "${fam}"`,'가나다')]; })); }catch(e){} }
function fit(ctx,text,maxW,start,min,weight){ let s=start; for(;s>=min;s-=4){ ctx.font=fstr(weight==='800'?'main':'sub',s); if(ctx.measureText(text).width<=maxW) break; } return s; }
/* 로고: 종류(군 CI·슬로건·둘 다·내 로고·없음) · 위치(네 귀퉁이) · 크기(3단계). 원본 비율 그대로, 변형 없이 */
const LOGOS={ci:'군 CI',slogan:'슬로건',both:'CI + 슬로건',none:'없음'};
const LPOS={br:'오른쪽 아래',bl:'왼쪽 아래',tr:'오른쪽 위',tl:'왼쪽 위'}, LSZ={s:'작게',m:'보통',l:'크게'};
B.lg={kind:'ci',pos:'br',sz:'m',img:{}};

/* ── 레이어 방식: 메인·서브·주최(글상자)와 로고(그림)를 각각 하나의 레이어로 둔다 ──
   · 각 레이어 = 중심 위치(cx,cy · 캔버스 px) + 크기(글자 px / 로고 높이 px). 처음 배치만 자동(layout), 그다음은 사용자가 옮기고 키운다.
   · 캔버스에는 결과만 그리고, 선택 테두리·모서리 손잡이는 캔버스 위 HTML 상자(.bn-ov)로 그려서 PNG에는 들어가지 않는다. */
B.L=null; B.sel=null; B.dirty=false; B.extra=[];   // 추가 로고(다른 기관 등): {id,img,name}
const XK=()=>B.extra.map(x=>x.id);
const isImg=ly=>ly&&ly.type!=='text';
/* 추가 로고 배치: 기본 로고 왼쪽에 차례로 (사용자가 옮기고 키운다) */
function placeExtra(L,x,i){ const h=L.logo.base||logoBaseH(L.W,L.H,L.vert); const w=x.img.width*h/x.img.height; const ref=L.logo.bb&&B.lg.kind!=='none'?L.logo.bb:[L.W*0.97,L.H-h*1.5-L.H*0.03,0,h*1.5];
  L[x.id]={type:'img',img:x.img,name:x.name,h,base:h,w,cx:L.vert?L.W/2:ref[0]-h*0.6-w/2-i*(w+h*0.8),cy:L.vert?ref[1]-h*(1.2+i*1.7):ref[1]+ref[3]/2}; }
const mctx=document.createElement('canvas').getContext('2d');
const canvasWH=()=>{ const [W0,H0]=dims(); const vert=H0>W0; const W=vert?900:2400; return [W,Math.round(W*H0/W0),vert]; };
function fitPx(text,role,maxW,start,min){ let s=Math.max(min,Math.round(start)); for(;s>min;s-=2){ mctx.font=fstr(role,s); if(Math.max(...String(text).split('\n').map(l=>mctx.measureText(l).width))<=maxW) break; } return s; }
function textW(text,role,size,f){ mctx.font=fstr(role,size,f); return Math.max(...String(text).split('\n').map(l=>mctx.measureText(l).width)); }
async function logoImgs(){ const k=B.lg.kind, I=B.lg.img;
  const need=k==='both'?['ci','slogan']:k==='none'?[]:[k];
  for(const n of need) if(!I[n]) I[n]=await loadImg(n==='ci'?'assets/dalseong_ci.png':'assets/slogan.png');
  return need.map(n=>I[n]).filter(Boolean); }
function logoBaseH(W,H,vert){ return (vert?W*0.16:Math.min(H*0.2,W*0.05))*({s:.72,m:1,l:1.35}[B.lg.sz]||1); }
function logoCorner(L,W,H,vert){ const lg=L.logo; const pos=B.lg.pos, top=pos[0]==='t', left=pos[1]==='l';
  const w=lg.w||lg.h*2, pad=lg.h*0.25, mx=vert?W*0.5-w/2-pad:W*0.025, my=vert?H*0.03:Math.min(H*0.1,W*0.025);
  lg.cx=vert?W/2:(left?mx+pad+w/2:W-mx-pad-w/2); lg.cy=top?my+pad+lg.h/2:H-my-pad-lg.h/2; }
/* 처음 배치(자동): 폭을 넘지 않게 글자 크기를 정하고, 정사각형에 가까우면 메인을 두 줄로 */
function layout(){
  const [W,H,vert]=canvasWH(); const a=B.alts[B.pick]||{main:v('bnName')||'행사명',sub:''};
  const L={W,H,vert,main:{type:'text',role:'main'},sub:{type:'text',role:'sub'},host:{type:'text',role:'sub'},logo:{type:'logo'}};
  L.logo.h=logoBaseH(W,H,vert);
  if(!vert){
    const topLogo=B.lg.pos[0]==='t'&&B.lg.kind!=='none'&&W/H>2.2, maxW=W*(topLogo?0.58:0.86);
    let mt=a.main, ms=fitPx(mt,'main',maxW,Math.min(H*0.42,W*0.16),10);
    const ws=a.main.split(' ');
    if(ws.length>1&&W/H<3.4){ let best=null; for(let i=1;i<ws.length;i++){ const t=[ws.slice(0,i).join(' '),ws.slice(i).join(' ')]; const d=Math.abs(t[0].length-t[1].length); if(!best||d<best.d) best={t,d}; }
      const two=best.t.join('\n'), s2=fitPx(two,'main',W*0.86,Math.min(H*0.3,W*0.16),10); if(s2>ms*1.15){ mt=two; ms=s2; } }
    const ss=a.sub?fitPx(a.sub,'sub',W*0.86,Math.min(H*0.15,W*0.05),8):0;
    const n=mt.split('\n').length, lh=ms*1.12, blockH=n*lh+(a.sub?ss*1.7:0), y0=H*0.46-blockH/2;
    Object.assign(L.main,{text:mt,size:ms,cx:W/2,cy:y0+n*lh/2});
    Object.assign(L.sub,{text:a.sub||'',size:ss||Math.round(H*0.1),cx:W/2,cy:y0+n*lh+ss*0.85});
    const hs=Math.round(Math.min(H*0.075,W*0.022)), ht=v('bnHost')||'달성군', hw=textW(ht,'sub',hs);
    const hostLeft=B.lg.kind==='none'||B.lg.pos[0]==='t'||B.lg.pos[1]==='r';
    Object.assign(L.host,{text:ht,size:hs,cx:hostLeft?W*0.03+hw/2:W*0.97-hw/2,cy:H-Math.min(H*0.1,W*0.03)});
  }else{
    const mt=a.main.split(/\s+/).join('\n'), ms=fitPx(mt,'main',W*0.84,W*0.22,10);
    const st=(a.sub||'').split(/\s·\s|\s+/).join('\n'), ss=a.sub?fitPx(st,'sub',W*0.86,W*0.075,8):0;
    const top=B.lg.pos[0]==='t'&&B.lg.kind!=='none', y0=H*0.08+(top?L.logo.h*1.5+H*0.03:0), n=mt.split('\n').length;
    Object.assign(L.main,{text:mt,size:ms,cx:W/2,cy:y0+n*ms*1.12/2});
    const sn=st.split('\n').length;
    Object.assign(L.sub,{text:st,size:ss||Math.round(W*0.06),cx:W/2,cy:y0+n*ms*1.12+ss*0.8+sn*ss*1.25/2});
    Object.assign(L.host,{text:v('bnHost')||'달성군',size:Math.round(W*0.06),cx:W/2,cy:top||B.lg.kind==='none'?H*0.93:H*0.94-L.logo.h*1.5-W*0.08});
  }
  ['main','sub','host'].forEach(k=>L[k].base=L[k].size); L.logo.base=L.logo.h;
  B.L=L; B.dirty=false; B._placeExtra=true;
}
const LH=1.15;
function paintText(ctx,ly,fg){ const lines=String(ly.text||'').split('\n'); if(!ly.text) { ly.bb=null; return; }
  ctx.font=fstr(ly.role,ly.size,ly.font); ctx.fillStyle=fg; ctx.textAlign='center'; ctx.textBaseline='middle';
  const lh=ly.size*LH, h=lines.length*lh; let y=ly.cy-h/2+lh/2; let w=0;
  lines.forEach(l=>{ ctx.fillText(l,ly.cx,y); w=Math.max(w,ctx.measureText(l).width); y+=lh; });
  ly.bb=[ly.cx-w/2,ly.cy-h/2,w,h]; }
function paintLogo(ctx,ly,imgs,light){ if(!imgs.length){ ly.bb=null; return; }
  const lh=ly.h, gap=lh*0.35; const ws=imgs.map(im=>im.width*lh/im.height); const tw=ws.reduce((a,b)=>a+b,0)+gap*(imgs.length-1); ly.w=tw;
  const pad=lh*0.25; let x=ly.cx-tw/2, y=ly.cy-lh/2;
  if(!light){ ctx.fillStyle='rgba(255,255,255,.95)'; roundRect(ctx,x-pad,y-pad,tw+pad*2,lh+pad*2,lh*0.2); ctx.fill(); }
  imgs.forEach((im,i)=>{ ctx.drawImage(im,x,y,ws[i],lh); x+=ws[i]+gap; });
  ly.bb=[ly.cx-tw/2-pad,ly.cy-lh/2-pad,tw+pad*2,lh+pad*2]; }
let _imgs=[], _bgImg=null;
/* 그리기 준비(글꼴·그림 불러오기) 후 paint() — 끄는 동안에는 paint()만 바로 다시 부른다 */
async function draw(){
  const [W,H]=canvasWH(); if(!B.L||B.L.W!==W||B.L.H!==H) layout();
  await fontReady(); _imgs=await logoImgs();
  const bg=v('bnBg'); _bgImg = bg==='photo' ? (B.img||(B.img=await loadImg('assets/hero.jpg'))) : bg==='custom' ? B.custom : bg==='ai' ? B.ai : null;
  if(bg==='ai'&&!B.ai){ aiLoad(B.aiBusy?null:'AI 배경을 아직 그리지 않았습니다'); }
  // 처음 그릴 때 로고 폭을 알아야 귀퉁이에 맞출 수 있다
  if(!B.L.logo.w&&_imgs.length){ const lh=B.L.logo.h; B.L.logo.w=_imgs.map(im=>im.width*lh/im.height).reduce((a,b)=>a+b,0)+lh*0.35*(_imgs.length-1); const cap=B.L.vert?W*0.8:W*0.32; if(B.L.logo.w>cap){ B.L.logo.h*=cap/B.L.logo.w; B.L.logo.w=cap; } logoCorner(B.L,W,H,B.L.vert);
    const kp=B.L.logo.keep; if(kp){ const lg=B.L.logo, hw=lg.w/2+lg.h*0.25, hh=lg.h*0.75; lg.cx=Math.min(W-hw,Math.max(hw,kp[0])); lg.cy=Math.min(H-hh,Math.max(hh,kp[1])); lg.keep=null; } }   // 종류만 바꾸면 사용자가 옮긴 자리는 그대로
  paint(); $('#bnOut').hidden=false;
}
function paint(){
  const L=B.L; if(!L) return; const {W,H,vert}=L; const c=$('#bnCanvas'); if(c.width!==W) c.width=W; if(c.height!==H) c.height=H; const ctx=c.getContext('2d');
  const bg=v('bnBg'); const [,col]=BGS[bg]||BGS.navy;
  if(_bgImg){ const r=Math.max(W/_bgImg.width,H/_bgImg.height); const w=_bgImg.width*r,h=_bgImg.height*r; ctx.drawImage(_bgImg,(W-w)/2,(H-h)/2,w,h); ctx.fillStyle=bg==='ai'?'rgba(8,20,60,.38)':'rgba(8,20,60,.52)'; ctx.fillRect(0,0,W,H); }
  else { ctx.fillStyle=col||'#0b2a6b'; ctx.fillRect(0,0,W,H); }
  const light=bg==='white', fg=light?'#0b2a6b':'#ffffff';
  ctx.fillStyle=light?'#0b2a6b':'rgba(255,255,255,.9)'; ctx.fillRect(0,0,vert?W:18,vert?18:H);   // 포인트 띠
  paintText(ctx,L.main,fg); ctx.globalAlpha=.94; paintText(ctx,L.sub,fg); ctx.globalAlpha=1; paintText(ctx,L.host,fg);
  if(B.lg.kind!=='none') paintLogo(ctx,L.logo,_imgs,light); else L.logo.bb=null;
  if(B._placeExtra){ B._placeExtra=false; B.extra.forEach((x,i)=>placeExtra(L,x,i)); }
  B.extra.forEach(x=>{ if(!L[x.id]) placeExtra(L,x,B.extra.indexOf(x)); paintLogo(ctx,L[x.id],[x.img],light); });
  overlay();
}
const LNAME={main:'메인 문구',sub:'서브 문구',host:'주최·주관',logo:'로고'};
const lname=k=>LNAME[k]||'추가 로고';
function overlay(){   // 상자는 지우지 않고 위치·선택만 고친다 (끄는 중·두 번 누르기가 끊기지 않게)
  const ov=$('#bnOv'), L=B.L; if(!ov||!L) return; const p=n=>(n*100).toFixed(3)+'%';
  ov.querySelectorAll('.bn-ly').forEach(el=>{ if(!L[el.dataset.k]) el.remove(); });
  ['logo',...XK(),'host','sub','main'].forEach(k=>{ let el=ov.querySelector(`.bn-ly[data-k="${k}"]`);
    if(!L[k]||!L[k].bb){ if(el) el.remove(); return; }
    if(!el){ el=document.createElement('div'); el.className='bn-ly'; el.dataset.k=k; el.innerHTML=`<span class="bn-tag">${lname(k)}</span><i class="hd nw"></i><i class="hd ne"></i><i class="hd sw"></i><i class="hd se"></i>`; ov.appendChild(el); }
    const [x,y,w,h]=L[k].bb; Object.assign(el.style,{left:p(x/L.W),top:p(y/L.H),width:p(w/L.W),height:p(h/L.H)}); el.classList.toggle('on',B.sel===k); });
}
function roundRect(ctx,x,y,w,h,r){ ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }
function renderAlts(){
  $('#bnAlts').innerHTML=B.alts.map((a,i)=>`<button class="alt${i===B.pick?' on':''}" data-i="${i}"><b>${a.main}</b><span>${a.sub||''}</span><small>${a.why||''}</small></button>`).join('');
  $('#bnAlts').querySelectorAll('.alt').forEach(b=>b.onclick=()=>{ B.pick=+b.dataset.i; renderAlts(); pickAlt(); });
}
/* 다른 안을 고르면: 아직 손대지 않았으면 새로 배치, 손댔으면 위치·크기는 두고 글만 바꾼다 */
function shrinkFit(){ const L=B.L; ['main','sub','host'].forEach(k=>{ const ly=L[k]; if(!ly.text) return; const w=textW(ly.text,ly.role,ly.size,ly.font), max=L.W*0.92; if(w>max) ly.size=Math.floor(ly.size*max/w); const n=ly.text.split('\n').length, hmax=L.H*(k==='main'?0.62:0.3); if(n*ly.size*LH>hmax) ly.size=Math.floor(hmax/(n*LH)); }); }   // 글이 길어져 폭·높이를 넘으면 그만큼만 줄인다
function pickAlt(){ if(!B.L||!B.dirty){ B.L=null; return draw(); } const a=B.alts[B.pick]; B.L.main.text=B.L.vert?a.main.split(/\s+/).join('\n'):a.main; B.L.sub.text=a.sub||''; if(!B.L.sub.size) B.L.sub.size=Math.round(B.L.H*0.1); shrinkFit(); draw(); }
/* ── AI 배경: 행사 분위기에 맞는 글자 없는 배경 그림 (gpt-image, 서버 /api/card) ── */
function aiPrompt(vert){
  return `A ${vert?'tall vertical':'wide horizontal'} background artwork for an outdoor public event banner of Dalseong-gun, Daegu, South Korea.
Event: "${v('bnName')}". Place: "${v('bnPlace')||'Dalseong-gun'}". Mood keywords: "${v('bnPoint')||''}".
Show scenery and symbols that match the event theme (Korean landscape, seasonal nature, local atmosphere) in a clean, bright, modern poster illustration style.
IMPORTANT: absolutely no text, no letters, no numbers, no logos, no signs, no watermarks. Keep the ${vert?'upper and middle':'center'} area calm and simple with low detail so large text can be overlaid later. No people's faces in close-up.`;
}
let _aiT=null;
function aiLoad(msg){ const L=$('#bnAiLoad'); if(!L) return; clearInterval(_aiT); if(msg===false){ L.hidden=true; return; } L.hidden=false;
  if(msg){ L.innerHTML=`<b>${msg}</b><button type="button" id="bnAiGo2">🎨 AI 배경 그리기</button>`; $('#bnAiGo2').onclick=()=>aiBg(true); return; }
  const t0=Date.now(); const f=()=>{ L.innerHTML=`<div class="spin"></div><b>🎨 AI가 배경을 그리는 중… ${Math.round((Date.now()-t0)/1000)}초</b><small>보통 30~60초\n그동안 문구 3안을 골라 보세요\n완성되면 시안 배경이 바뀝니다</small>`; }; f(); _aiT=setInterval(f,1000); }
async function aiBg(force){
  if(B.aiBusy) return; const [w,h]=dims(); const vert=h>w; const key=[v('bnName'),v('bnPlace'),v('bnPoint'),vert].join('|');
  if(B.ai&&B.aiKey===key&&!force){ aiLoad(false); return draw(); }
  const S=window.S||{}; B.aiBusy=true; aiLoad(); const btn=$('#bnAiRedo'); if(btn) btn.disabled=true;
  try{
    const r=await fetch('/api/card',{method:'POST',headers:{'content-type':'application/json','x-access-code':S.code||''},body:JSON.stringify({action:'start',prompt:aiPrompt(vert),photo:null,size:vert?'1024x1536':'1536x1024',expect:[]})});
    const j=await r.json(); if(!r.ok||!j.id) throw new Error(j.error||('오류 '+r.status));
    const t0=Date.now(); let job=null;
    while(Date.now()-t0<180000){ await new Promise(res=>setTimeout(res,1500)); const q=await fetch('/api/card?id='+j.id,{headers:{'x-access-code':S.code||''}}); job=await q.json(); if(job.status==='done'||job.status==='error') break; }
    if(!job||job.status!=='done') throw new Error((job&&job.error)||'시간 초과');
    B.ai=await loadImg(job.image); B.aiKey=key; if(!B.ai) throw new Error('그림을 열지 못했습니다');
    B.aiBusy=false; aiLoad(false); if(B.alts.length) draw();
  }catch(e){ B.aiBusy=false; aiLoad('⚠️ AI 배경을 만들지 못했습니다 — '+String(e.message||'').slice(0,60)); }
  finally{ B.aiBusy=false; if(btn) btn.disabled=false; }
}
async function make(){
  if(B.busy) return; if(!v('bnName')){ $('#bnMsg').textContent='행사·사업명은 입력해 주세요.'; return $('#bnName').focus(); }
  B.busy=true; $('#bnGo').disabled=true; $('#bnMsg').textContent='문구 작성 중…';
  try{
    const S=window.S||{};
    if((S.key||S.server)&&!S.offline){
      B.alts=await callModel(`행사·사업명: ${v('bnName')}\n기간·일시: ${v('bnWhen')||'미정'}\n장소: ${v('bnPlace')||'미정'}\n주최·주관: ${v('bnHost')||'달성군'}\n어조: ${v('bnTone')}\n강조할 점: ${v('bnPoint')||'없음'}`);
      $('#bnMsg').textContent='문구 3안 — 마음에 드는 안을 고르면 시안이 바뀝니다.';
    }else{ await new Promise(r=>setTimeout(r,300)); B.alts=offline(); $('#bnMsg').textContent='오프라인 모드 — 모델 연결 시 문구 3안을 새로 씁니다.'; }
    B.pick=0; B.L=null; B.sel=null; window.propShow&&propShow(null); renderAlts(); await draw(); if(v('bnBg')==='ai') aiBg(false); window.dsSave&&dsSave('banner',v('bnName'),B.alts.map((a,i)=>`${i+1}안) ${a.main} / ${a.sub||''}`).join('\n')+`\n\n크기 : ${dims().join('cm × ')}cm`); $('#bnOut').scrollIntoView({behavior:'smooth',block:'start'}); if(window.S&&S.stats) S.stats.gen++,window.dsHit&&dsHit('gen');
  }catch(e){ $('#bnMsg').textContent='⚠ '+e.message; }
  finally{ B.busy=false; $('#bnGo').disabled=false; }
}
function init(){
  if($('#bnGo')._on) return; $('#bnGo')._on=1;
  $('#bnPresets').innerHTML=PRESETS.map(([w,h,l])=>`<button type="button" data-w="${w}" data-h="${h}">${l}</button>`).join('');
  const syncP=()=>{ const [w,h]=dims(); $$p('#bnPresets button').forEach(b=>b.classList.toggle('on',+b.dataset.w===w&&+b.dataset.h===h)); }; syncP();
  $$p('#bnPresets button').forEach(b=>b.onclick=()=>{ $('#bnW').value=b.dataset.w; $('#bnH').value=b.dataset.h; syncP(); B.L=null; if(B.alts.length){ draw(); if(v('bnBg')==='ai'&&B.ai) aiBg(false); } });
  ['bnW','bnH'].forEach(id=>$('#'+id).addEventListener('input',()=>{ syncP(); B.L=null; if(B.alts.length) draw(); }));
  $('#bnBg').innerHTML=Object.entries(BGS).map(([k,[l]])=>`<option value="${k}">${l}</option>`).join('');
  $('#bnGo').onclick=make;
  $('#bnHost').addEventListener('change',()=>{ if(B.L){ B.L.host.text=v('bnHost')||'달성군'; } });
  ['bnBg','bnHost'].forEach(id=>$('#'+id).onchange=()=>{ if(B.alts.length){ draw(); if(id==='bnBg'&&v('bnBg')==='ai') aiBg(false); } if(id==='bnBg'&&v('bnBg')!=='ai') aiLoad(false); $('#bnAiRedo').hidden=v('bnBg')!=='ai'; });
  $('#bnAiRedo').onclick=()=>aiBg(true);
  $('#bnBg').addEventListener('change',()=>{ $('#bnFileWrap').hidden=$('#bnBg').value!=='custom'; });
  const setBg=k=>{ $('#bnBg').value=k; $('#bnBg').dispatchEvent(new Event('change')); syncBg(); };
  const syncBg=()=>{ const k=v('bnBg'); $$p('#bnBgs .bn-bg').forEach(b=>b.classList.toggle('on',b.dataset.bg===k)); };
  $$p('#bnBgs .bn-bg').forEach(b=>b.onclick=()=>setBg(b.dataset.bg)); syncBg();
  $('#bnFonts').innerHTML=Object.entries(FONTS).map(([k,[l,fam]])=>`<button type="button" data-v="${k}" style="font-family:'${fam}',Pretendard,sans-serif">${l}</button>`).join('');
  const syncF=()=>$$p('#bnFonts button').forEach(b=>b.classList.toggle('on',b.dataset.v===B.font)); syncF();
  $$p('#bnFonts button').forEach(b=>b.onclick=()=>{ B.font=b.dataset.v; syncF(); if(B.L) ['main','sub','host'].forEach(k=>delete B.L[k].font); if(B.alts.length) draw().then(()=>B.sel&&propShow(B.sel)); });
  const chips=(id,M,key)=>{ $('#'+id).innerHTML=Object.entries(M).map(([k,l])=>`<button type="button" data-v="${k}">${l}</button>`).join(''); const sync=()=>$$p('#'+id+' button').forEach(b=>b.classList.toggle('on',b.dataset.v===B.lg[key])); sync();
    $$p('#'+id+' button').forEach(b=>b.onclick=async ()=>{ B.lg[key]=b.dataset.v; sync(); if(!B.L){ if(B.alts.length) draw(); return; }
      const [W,H,vert]=canvasWH(); if(key==='sz'){ const lg=B.L.logo, r=logoBaseH(W,H,vert)/lg.h; lg.h*=r; if(lg.w) lg.w*=r; }
      if(key==='kind'){ _imgs=await logoImgs(); if(B.dirty&&B.L.logo.w){ B.L.logo.keep=[B.L.logo.cx,B.L.logo.cy,B.L.logo.h]; } B.L.logo.w=0; B.L.logo.h=B.dirty&&B.L.logo.keep?B.L.logo.keep[2]:logoBaseH(W,H,vert); }
      if(key==='pos'||key==='kind'){ B.L.logo.w=0; }   // 폭을 다시 재고 귀퉁이에 맞춘다
      if(key==='pos'){ B.L.logo.h=B.L.logo.h||logoBaseH(W,H,vert); }
      draw(); }); };
  chips('bnLogo',LOGOS,'kind');   // 위치·크기는 시안에서 직접 (처음엔 오른쪽 아래·보통)

  $('#bnFile').onchange=async e=>{ const f=e.target.files[0]; if(!f) return; B.custom=await loadImg(URL.createObjectURL(f)); if(B.alts.length) draw(); };
  /* 선택한 글상자 편집 패널: 그 글상자의 글 · 글씨체 · 크기만 (로고는 위치·크기만 → 안내만) */
  const prop=$('#bnProp');
  window.propShow=k=>{ if(!B.L||!k){ prop.hidden=true; return; } prop.hidden=false; const ly=B.L[k];
    if(ly.type==='img'){ prop.innerHTML=`<div class="bp-h"><b>추가 로고</b><span>끌어서 옮기고, 모서리 ●로 크기 조절</span><button type="button" class="bp-del">🗑 이 로고 빼기</button><button type="button" class="bp-x" title="선택 해제">✕</button></div>`;
      prop.querySelector('.bp-del').onclick=()=>removeExtra(k); prop.querySelector('.bp-x').onclick=()=>{ B.sel=null; overlay(); prop.hidden=true; }; return; }
    if(k==='logo'){ prop.innerHTML=`<div class="bp-h"><b>로고</b><span>끌어서 옮기고, 모서리 ●로 크기 조절</span></div>`; return; }
    const cur=ly.font||B.font;
    prop.innerHTML=`<div class="bp-h"><b>${LNAME[k]}</b><span>줄바꿈 Shift+Enter</span><button type="button" class="bp-x" title="선택 해제">✕</button></div>
      <div class="bp-body"><textarea id="bpText" rows="1" maxlength="80"></textarea>
        <div class="bp-row"><em>글씨체</em><div class="bn-chips" id="bpFont">${Object.entries(FONTS).map(([f,[l,fam]])=>`<button type="button" data-v="${f}" class="${f===cur?'on':''}" style="font-family:'${fam}',Pretendard,sans-serif">${l}</button>`).join('')}</div></div>
        <div class="bp-row"><em>크기</em><span class="bn-fs"><button type="button" data-d="-1" title="작게">가<sup>−</sup></button><b id="bpPct"></b><button type="button" data-d="1" title="크게">가<sup>+</sup></button></span><button type="button" class="bp-reset" title="처음 크기로">↺ 처음 크기</button></div></div>`;
    const t=$('#bpText'); t.value=ly.text; const grow=()=>{ t.style.height='auto'; t.style.height=t.scrollHeight+2+'px'; }; grow();
    const pct=()=>{ $('#bpPct').textContent=Math.round(ly.size/(ly.base||ly.size)*100)+'%'; }; pct();
    t.oninput=()=>{ ly.text=t.value; grow(); B.dirty=true; syncAlt(k); paint(); };
    t.onkeydown=e=>{ if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){ e.preventDefault(); t.blur(); } };
    t.onblur=()=>{ ly.text=t.value.split('\n').map(x=>x.trim()).filter(Boolean).join('\n')||ly.text; shrinkFit(); paint(); renderAlts(); };
    $$p('#bpFont button').forEach(b=>b.onclick=async ()=>{ ly.font=b.dataset.v; $$p('#bpFont button').forEach(x=>x.classList.toggle('on',x===b)); B.dirty=true; await fontReady(); shrinkFit(); paint(); });
    prop.querySelectorAll('.bn-fs button').forEach(b=>b.onclick=()=>{ const base=ly.base||ly.size, r=Math.round((ly.size/base+(+b.dataset.d)*0.1)*10)/10; ly.size=base*Math.max(.3,Math.min(3,r)); B.dirty=true; pct(); paint(); });
    prop.querySelector('.bp-reset').onclick=()=>{ ly.size=ly.base||ly.size; pct(); paint(); };
    prop.querySelector('.bp-x').onclick=()=>{ B.sel=null; overlay(); prop.hidden=true; };
  };
  const esc2=t=>String(t||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const removeExtra=k=>{ B.extra=B.extra.filter(x=>x.id!==k); if(B.L) delete B.L[k]; B.sel=null; propShow(null); paint(); renderExtraList(); };
  $('#bnAddLogo').onchange=async e=>{ const fs=[...e.target.files]; e.target.value=''; for(const f of fs){ const img=await loadImg(URL.createObjectURL(f)); if(!img) continue; const x={id:'x'+Date.now()+Math.random().toString(36).slice(2,5),img,name:f.name}; B.extra.push(x); if(B.L){ placeExtra(B.L,x,B.extra.length-1); B.dirty=true; } }
    if(B.L){ paint(); const last=B.extra[B.extra.length-1]; if(last){ B.sel=last.id; overlay(); propShow(last.id); } } else if(window.toast) toast('로고를 넣었습니다 — 시안을 만들면 함께 올라갑니다'); renderExtraList(); };
  window.renderExtraList=()=>{ const el=$('#bnExtraList'); if(el) el.textContent=B.extra.length?`· ${B.extra.length}개 추가됨`:''; };
  const syncAlt=k=>{ const a=B.alts[B.pick]; if(!a) return; if(k==='main') a.main=B.L.main.text.split('\n').join(' '); if(k==='sub') a.sub=B.L.sub.text.split('\n').join(' '); if(k==='host') $('#bnHost').value=B.L.host.text.split('\n').join(' '); };
  const openEdit=k=>{ propShow(k); const t=$('#bpText'); if(t){ t.focus(); t.select(); } };
  /* 레이어 상자: 누르면 선택 · 끌면 이동 · 모서리 손잡이로 크기 · 글상자 두 번 누르면 고치기 · 방향키로 미세 이동 */
  const ov=$('#bnOv'); let act=null, raf=0, lastTap={};
  const toCanvas=e=>{ const r=ov.getBoundingClientRect(); return [(e.clientX-r.left)*B.L.W/r.width,(e.clientY-r.top)*B.L.H/r.height]; };
  const sz=k=>isImg(B.L[k])?B.L[k].h:B.L[k].size;
  const setSz=(k,n)=>{ if(isImg(B.L[k])){ const r=n/B.L[k].h; B.L[k].h=n; if(B.L[k].w) B.L[k].w*=r; } else B.L[k].size=n; };
  const sched=()=>{ if(!raf) raf=requestAnimationFrame(()=>{ raf=0; paint(); }); };
  ov.addEventListener('pointerdown',e=>{ e._bnOv=true; const box=e.target.closest('.bn-ly'); if(!box){ B.sel=null; overlay(); propShow(null); return; }
    const k=box.dataset.k, p=toCanvas(e), ly=B.L[k]; if(B.sel!==k) propShow(k); B.sel=k; e.preventDefault(); ov.setPointerCapture(e.pointerId);
    if(e.target.classList.contains('hd')){ act={mode:'size',k,s0:sz(k),d0:Math.max(8,Math.hypot(p[0]-ly.cx,p[1]-ly.cy))}; }
    else { const now=Date.now(); if(B.L[k].type==='text'&&lastTap.k===k&&now-lastTap.t<400){ lastTap={}; act=null; overlay(); return openEdit(k); } lastTap={k,t:now}; act={mode:'move',k,p0:p,c0:[ly.cx,ly.cy],moved:false}; }
    overlay(); });
  ov.addEventListener('pointermove',e=>{ if(!act) return; const p=toCanvas(e), ly=B.L[act.k];
    if(act.mode==='move'){ const dx=p[0]-act.p0[0], dy=p[1]-act.p0[1]; if(Math.abs(dx)+Math.abs(dy)>B.L.W*0.003){ act.moved=true; lastTap={}; } if(!act.moved) return; ly.cx=act.c0[0]+dx; ly.cy=act.c0[1]+dy; }
    else { const d=Math.hypot(p[0]-ly.cx,p[1]-ly.cy); setSz(act.k,Math.max(B.L.H*0.02,Math.min(B.L.H*1.2,act.s0*d/act.d0))); }
    B.dirty=true; sched(); if(act.mode==='size'){ const pp=$('#bpPct'); if(pp&&B.L[act.k].type==='text') pp.textContent=Math.round(B.L[act.k].size/(B.L[act.k].base||1)*100)+'%'; } });
  const end=()=>{ act=null; };
  ov.addEventListener('pointerup',end); ov.addEventListener('pointercancel',end);
  document.addEventListener('keydown',e=>{ if(!B.sel||!B.L||$('#bnOut').hidden||/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return; if((e.key==='Delete'||e.key==='Backspace')&&B.L[B.sel]&&B.L[B.sel].type==='img'){ e.preventDefault(); return removeExtra(B.sel); } const st=B.L.W*(e.shiftKey?0.01:0.002); const m={ArrowLeft:[-st,0],ArrowRight:[st,0],ArrowUp:[0,-st],ArrowDown:[0,st]}[e.key]; if(!m) return; e.preventDefault(); B.L[B.sel].cx+=m[0]; B.L[B.sel].cy+=m[1]; B.dirty=true; paint(); });
  document.addEventListener('pointerdown',e=>{ if(B.sel&&!e._bnOv&&!e.target.closest('#bnOv')&&!e.target.closest('#bnProp')&&!e.target.closest('.bn-cwrap')){ B.sel=null; overlay(); propShow(null); } });
  $('#bnResetPos').onclick=()=>{ B.L=null; B.sel=null; propShow(null); if(B.alts.length) draw(); };
  $('#bnPng').onclick=()=>{ const a=document.createElement('a'); a.download=`현수막시안_${v('bnName').replace(/[\\/:*?"<>|]/g,'').slice(0,20)}_${(()=>{ const [w,h]=dims(); return (h>w?'세로':'가로')+w+'x'+h+'cm'; })()}.png`; a.href=$('#bnCanvas').toDataURL('image/png'); a.click(); };
  $('#bnSample').onclick=()=>{ $('#bnName').value='2026 비슬산 참꽃문화제'; $('#bnWhen').value='2026. 4. 18.(토) ~ 4. 26.(일)'; $('#bnPlace').value='비슬산 자연휴양림 일원'; $('#bnHost').value='달성군 · 달성문화재단'; $('#bnPoint').value='30년 만의 참꽃 만개, 가족 나들이'; $('#bnTone').value='친근'; toast?.('예시를 채웠습니다 — 「문구·시안 만들기」를 눌러보세요'); };
  $('#bnReset').onclick=()=>{ ['bnName','bnWhen','bnPlace','bnHost','bnPoint'].forEach(id=>$('#'+id).value=''); B.alts=[]; B.L=null; $('#bnOut').hidden=true; $('#bnMsg').textContent=''; };
}
window.BANNER={init};
})();
