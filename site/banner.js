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
const PRESETS=[[5,0.9,'5×0.9'],[4,0.7,'4×0.7'],[0.9,3,'세로 0.9×3']];
const BGS={ ai:['🎨 AI 배경 (행사 맞춤)',null], photo:['군 보유 사진(비슬산)',null], navy:['남색 단색','#0b2a6b'], green:['진녹색 단색','#145a32'], orange:['주황 단색','#d35400'], white:['흰 바탕(남색 글자)','#ffffff'], custom:['내 사진 올리기',null] };
const num=id=>{ const x=parseFloat(String($('#'+id).value).replace(',','.')); return x>0?x:0; };
const dims=()=>{ const w=num('bnW')||5, h=num('bnH')||0.9; return [w,h]; };
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
const FONTS={ pre:['기본 고딕','Pretendard',[800,600]], bhs:['굵은 제목체','Black Han Sans',[400,400]], dh:['도현체','Do Hyeon',[400,400]], jua:['주아체','Jua',[400,400]], mj:['명조','Nanum Myeongjo',[800,700]] };
B.font='pre';
const FF=()=>FONTS[B.font]||FONTS.pre;
const fstr=(role,px)=>{ const [, fam, w]=FF(); const wt=role==='main'?w[0]:w[1]; return `${wt} ${px}px "${fam}",Pretendard,"Malgun Gothic",sans-serif`; };
async function fontReady(){ const [, fam, w]=FF(); try{ await Promise.all([document.fonts.load(`${w[0]} 40px "${fam}"`,'가나다'),document.fonts.load(`${w[1]} 40px "${fam}"`,'가나다')]); }catch(e){} }
function fit(ctx,text,maxW,start,min,weight){ let s=start; for(;s>=min;s-=4){ ctx.font=fstr(weight==='800'?'main':'sub',s); if(ctx.measureText(text).width<=maxW) break; } return s; }
/* 시안 위 요소(메인·서브·주최·로고)는 끌어서 옮길 수 있다 — 옮긴 거리는 B.off에, 누를 수 있는 영역은 B.hit에 */
B.off={}; B.hit=[]; B.offKey='';
const O=k=>B.off[k]||(B.off[k]={x:0,y:0});
function txt(ctx,k,t,x,y){ const o=O(k); x+=o.x; y+=o.y; ctx.fillText(t,x,y); const w=ctx.measureText(t).width, h=+((ctx.font.match(/(\d+)px/)||[0,20])[1]); const ax=ctx.textAlign==='center'?x-w/2:ctx.textAlign==='right'?x-w:x; return [ax,y-h/2,w,h]; }
function U(bb,b){ if(!bb) return b.slice(); const x=Math.min(bb[0],b[0]), y=Math.min(bb[1],b[1]); return [x,y,Math.max(bb[0]+bb[2],b[0]+b[2])-x,Math.max(bb[1]+bb[3],b[1]+b[3])-y]; }
const hit=(k,b)=>{ if(b) B.hit.push({k,x:b[0],y:b[1],w:b[2],h:b[3]}); };
async function draw(){
  const [W0,H0]=dims(); const vert=H0>W0;
  const W=vert?900:2400, H=Math.round(W*H0/W0);
  if(B.offKey!==W+'x'+H){ B.off={}; B.offKey=W+'x'+H; } B.hit=[];
  await fontReady();
  const c=$('#bnCanvas'); c.width=W; c.height=H; const ctx=c.getContext('2d');
  const bg=v('bnBg'); const [,col]=BGS[bg]||BGS.navy;
  const img = bg==='photo' ? (B.img||(B.img=await loadImg('assets/hero.jpg'))) : bg==='custom' ? B.custom : bg==='ai' ? B.ai : null;
  if(img){ const r=Math.max(W/img.width,H/img.height); const w=img.width*r,h=img.height*r; ctx.drawImage(img,(W-w)/2,(H-h)/2,w,h); ctx.fillStyle=bg==='ai'?'rgba(8,20,60,.38)':'rgba(8,20,60,.52)'; ctx.fillRect(0,0,W,H); }
  else { ctx.fillStyle=col||'#0b2a6b'; ctx.fillRect(0,0,W,H); }
  if(bg==='ai'&&!B.ai){ aiLoad(B.aiBusy?null:'AI 배경을 아직 그리지 않았습니다'); }
  const light = bg==='white'; const fg = light?'#0b2a6b':'#ffffff';
  ctx.fillStyle = light?'#0b2a6b':'rgba(255,255,255,.9)'; ctx.fillRect(0,0,vert?W:18,vert?18:H);   // 포인트 띠
  const a=B.alts[B.pick]||{main:v('bnName')||'행사명',sub:''};
  ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillStyle=fg;
  if(!vert){
    const mainS=fit(ctx,a.main,W*0.78,Math.round(H*0.42),Math.round(H*0.2),'800'); hit('main',txt(ctx,'main',a.main,W/2,H*0.42));
    if(a.sub){ fit(ctx,a.sub,W*0.8,Math.round(H*0.15),Math.round(H*0.08),'500'); ctx.globalAlpha=.92; hit('sub',txt(ctx,'sub',a.sub,W/2,H*0.42+mainS*0.62+H*0.09)); ctx.globalAlpha=1; }
    await drawLogo(ctx,W,H,false,light,fg);
  }else{
    const lg=await drawLogo(ctx,W,H,true,light,fg); ctx.fillStyle=fg; ctx.textAlign='center';
    const lines=a.main.split(/\s+/); let y=H*0.14+(lg.top?lg.h+H*0.03:0); const s=fit(ctx,lines.reduce((p,q)=>p.length>q.length?p:q,''),W*0.8,Math.round(W*0.22),Math.round(W*0.1),'800');
    let bb=null; lines.forEach(l=>{ bb=U(bb,txt(ctx,'main',l,W/2,y)); y+=s*1.25; }); hit('main',bb);
    if(a.sub){ const ss=fit(ctx,a.sub,W*0.86,Math.round(W*0.075),Math.round(W*0.045),'500'); y+=ss; let sb=null; a.sub.split(/\s·\s|\s+/).forEach(pt=>{ sb=U(sb,txt(ctx,'sub',pt,W/2,y)); y+=ss*1.35; }); hit('sub',sb); }
    ctx.font=fstr('sub',Math.round(W*0.06)); hit('host',txt(ctx,'host',(v('bnHost')||'달성군'),W/2,lg.top||!lg.on?H*0.93:H*0.94-lg.h-W*0.08));
  }
  $('#bnOut').hidden=false;
}
/* 로고: 종류(군 CI·슬로건·둘 다·내 로고·없음) · 위치(네 귀퉁이) · 크기(3단계). 원본 비율 그대로, 변형 없이 */
const LOGOS={ci:'군 CI',slogan:'슬로건',both:'CI + 슬로건',none:'없음'};
const LPOS={br:'오른쪽 아래',bl:'왼쪽 아래',tr:'오른쪽 위',tl:'왼쪽 위'}, LSZ={s:'작게',m:'보통',l:'크게'};
B.lg={kind:'ci',pos:'br',sz:'m',img:{}};
async function logoImgs(){ const k=B.lg.kind, I=B.lg.img;
  if(k==='custom') return B.lg.custom?[B.lg.custom]:[];
  const need=k==='both'?['ci','slogan']:k==='none'?[]:[k];
  for(const n of need) if(!I[n]) I[n]=await loadImg(n==='ci'?'assets/dalseong_ci.png':'assets/slogan.png');
  return need.map(n=>I[n]).filter(Boolean); }
async function drawLogo(ctx,W,H,vert,light,fg){
  const imgs=await logoImgs(); const pos=B.lg.pos, top=pos[0]==='t', left=pos[1]==='l';
  const f={s:.72,m:1,l:1.35}[B.lg.sz];
  // 주최 문구는 로고와 겹치지 않게 반대쪽 아래에 (끌어서 옮길 수 있음)
  if(!vert){ ctx.fillStyle=fg; ctx.font=fstr('sub',Math.round(H*0.075)); const hl=(!imgs.length||top)?true:!left; ctx.textAlign=hl?'left':'right'; hit('host',txt(ctx,'host',(v('bnHost')||'달성군'), hl?W*0.03:W*0.97, H*0.9)); }
  if(!imgs.length) return {on:false,top,h:0};
  let lh=vert?W*0.16*f:H*0.2*f; const gap=lh*0.35;
  let ws=imgs.map(im=>im.width*lh/im.height); let tw=ws.reduce((a,b)=>a+b,0)+gap*(imgs.length-1);
  if(vert&&tw>W*0.8){ const r=W*0.8/tw; lh*=r; ws=ws.map(w=>w*r); tw*=r; }
  const pad=lh*0.25, mx=vert?0:W*0.025, my=vert?H*0.03:H*0.1, o=O('logo');
  let x=(vert?(W-tw)/2:(left?mx+pad:W-mx-pad-tw))+o.x; let y=(top?my+pad:H-my-pad-lh)+o.y;
  if(!light){ ctx.fillStyle='rgba(255,255,255,.95)'; roundRect(ctx,x-pad,y-pad,tw+pad*2,lh+pad*2,lh*0.2); ctx.fill(); }
  hit('logo',[x-pad,y-pad,tw+pad*2,lh+pad*2]);
  imgs.forEach((im,i)=>{ ctx.drawImage(im,x,y,ws[i],lh); x+=ws[i]+gap; });
  ctx.fillStyle=fg; return {on:true,top,h:lh+pad*2};
}
function roundRect(ctx,x,y,w,h,r){ ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }
function renderAlts(){
  $('#bnAlts').innerHTML=B.alts.map((a,i)=>`<button class="alt${i===B.pick?' on':''}" data-i="${i}"><b>${a.main}</b><span>${a.sub||''}</span><small>${a.why||''}</small></button>`).join('');
  $('#bnAlts').querySelectorAll('.alt').forEach(b=>b.onclick=()=>{ B.pick=+b.dataset.i; renderAlts(); draw(); });
}
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
    B.pick=0; renderAlts(); await draw(); if(v('bnBg')==='ai') aiBg(false); window.dsSave&&dsSave('banner',v('bnName'),B.alts.map((a,i)=>`${i+1}안) ${a.main} / ${a.sub||''}`).join('\n')+`\n\n크기 : ${dims().join('m × ')}m`); $('#bnOut').scrollIntoView({behavior:'smooth',block:'start'}); if(window.S&&S.stats) S.stats.gen++,window.dsHit&&dsHit('gen');
  }catch(e){ $('#bnMsg').textContent='⚠ '+e.message; }
  finally{ B.busy=false; $('#bnGo').disabled=false; }
}
function init(){
  if($('#bnGo')._on) return; $('#bnGo')._on=1;
  $('#bnPresets').innerHTML=PRESETS.map(([w,h,l])=>`<button type="button" data-w="${w}" data-h="${h}">${l}</button>`).join('');
  const syncP=()=>{ const [w,h]=dims(); $$p('#bnPresets button').forEach(b=>b.classList.toggle('on',+b.dataset.w===w&&+b.dataset.h===h)); }; syncP();
  $$p('#bnPresets button').forEach(b=>b.onclick=()=>{ $('#bnW').value=b.dataset.w; $('#bnH').value=b.dataset.h; syncP(); if(B.alts.length){ draw(); if(v('bnBg')==='ai'&&B.ai) aiBg(false); } });
  ['bnW','bnH'].forEach(id=>$('#'+id).addEventListener('input',()=>{ syncP(); if(B.alts.length) draw(); }));
  $('#bnBg').innerHTML=Object.entries(BGS).map(([k,[l]])=>`<option value="${k}">${l}</option>`).join('');
  $('#bnGo').onclick=make;
  ['bnBg','bnHost'].forEach(id=>$('#'+id).onchange=()=>{ if(B.alts.length){ draw(); if(id==='bnBg'&&v('bnBg')==='ai') aiBg(false); } if(id==='bnBg'&&v('bnBg')!=='ai') aiLoad(false); $('#bnAiRedo').hidden=v('bnBg')!=='ai'; });
  $('#bnAiRedo').onclick=()=>aiBg(true);
  $('#bnBg').addEventListener('change',()=>{ $('#bnFileWrap').hidden=$('#bnBg').value!=='custom'; });
  const setBg=k=>{ $('#bnBg').value=k; $('#bnBg').dispatchEvent(new Event('change')); syncBg(); };
  const syncBg=()=>{ const k=v('bnBg'); $$p('#bnBgs .bn-bg').forEach(b=>b.classList.toggle('on',b.dataset.bg===k)); };
  $$p('#bnBgs .bn-bg').forEach(b=>b.onclick=()=>setBg(b.dataset.bg)); syncBg();
  $('#bnFonts').innerHTML=Object.entries(FONTS).map(([k,[l,fam]])=>`<button type="button" data-v="${k}" style="font-family:'${fam}',Pretendard,sans-serif">${l}</button>`).join('');
  const syncF=()=>$$p('#bnFonts button').forEach(b=>b.classList.toggle('on',b.dataset.v===B.font)); syncF();
  $$p('#bnFonts button').forEach(b=>b.onclick=()=>{ B.font=b.dataset.v; syncF(); if(B.alts.length) draw(); });
  const chips=(id,M,key)=>{ $('#'+id).innerHTML=Object.entries(M).map(([k,l])=>`<button type="button" data-v="${k}">${l}</button>`).join(''); const sync=()=>$$p('#'+id+' button').forEach(b=>b.classList.toggle('on',b.dataset.v===B.lg[key])); sync();
    $$p('#'+id+' button').forEach(b=>b.onclick=()=>{ B.lg[key]=b.dataset.v; sync(); if(key==='pos') delete B.off.logo; if(B.alts.length) draw(); }); };
  chips('bnLogo',LOGOS,'kind'); chips('bnLogoPos',LPOS,'pos'); chips('bnLogoSz',LSZ,'sz');

  $('#bnFile').onchange=async e=>{ const f=e.target.files[0]; if(!f) return; B.custom=await loadImg(URL.createObjectURL(f)); if(B.alts.length) draw(); };
  const openEdit=(focus)=>{ const a=B.alts[B.pick]; if(!a) return;
    let md=$('#bnEditPop');
    if(!md){ md=document.createElement('div'); md.id='bnEditPop'; md.className='modal'; md.hidden=true;
      md.innerHTML='<div class="box bn-editbox"><div class="box-h"><b>문구 직접 고치기</b><button class="x" data-x>✕</button></div>'
        +'<label>메인 문구<input id="bnEdM" maxlength="40"></label><label>서브 문구<input id="bnEdS" maxlength="60"></label><label>주최·주관<input id="bnEdH" maxlength="40"></label>'
        +'<div class="pact"><button class="p" data-ok>적용</button><button data-x>취소</button></div></div>';
      document.body.appendChild(md);
      const close=()=>{ md.hidden=true; };
      md.addEventListener('click',e=>{ if(e.target===md||e.target.closest('[data-x]')) close(); });
      md.addEventListener('keydown',e=>{ if(e.key==='Escape') close(); if(e.key==='Enter'){ e.preventDefault(); md.querySelector('[data-ok]').click(); } });
    }
    $('#bnEdM').value=a.main||''; $('#bnEdS').value=a.sub||''; $('#bnEdH').value=v('bnHost')||'달성군';
    md.querySelector('[data-ok]').onclick=()=>{ const m=$('#bnEdM').value.trim(); if(!m){ $('#bnEdM').focus(); return; } a.main=m; a.sub=$('#bnEdS').value.trim(); $('#bnHost').value=$('#bnEdH').value.trim(); md.hidden=true; renderAlts(); draw(); };
    md.hidden=false; setTimeout(()=>{ const i=$({sub:'#bnEdS',host:'#bnEdH'}[focus]||'#bnEdM'); i.focus(); i.select(); },30);
  };
  $('#bnEdit').onclick=()=>openEdit('main');
  // 시안에서 끌어서 옮기기 · 글자를 누르면 고치기
  const cv=$('#bnCanvas'); let drag=null, raf=0;
  const pt=e=>{ const r=cv.getBoundingClientRect(); return [(e.clientX-r.left)*cv.width/r.width,(e.clientY-r.top)*cv.height/r.height]; };
  const find=p=>{ const m=10*cv.width/(cv.getBoundingClientRect().width||1); for(let i=B.hit.length-1;i>=0;i--){ const h=B.hit[i]; if(p[0]>=h.x-m&&p[0]<=h.x+h.w+m&&p[1]>=h.y-m&&p[1]<=h.y+h.h+m) return h; } return null; };
  cv.addEventListener('pointerdown',e=>{ if(!B.alts.length) return; const p=pt(e), h=find(p); if(!h) return; drag={k:h.k,p0:p,o0:{...O(h.k)},moved:false}; cv.setPointerCapture(e.pointerId); e.preventDefault(); });
  cv.addEventListener('pointermove',e=>{ const p=pt(e); if(!drag){ const h=find(p); cv.style.cursor=h?(h.k==='logo'?'move':'grab'):'default'; cv.title=h?(h.k==='logo'?'끌어서 옮기기':'끌어서 옮기기 · 누르면 문구 고치기'):''; return; }
    const dx=p[0]-drag.p0[0], dy=p[1]-drag.p0[1]; if(Math.abs(dx)+Math.abs(dy)>cv.width*0.004) drag.moved=true; if(!drag.moved) return;
    const o=O(drag.k); o.x=drag.o0.x+dx; o.y=drag.o0.y+dy; cv.style.cursor='grabbing'; if(!raf) raf=requestAnimationFrame(()=>{ raf=0; draw(); }); });
  const up=()=>{ if(!drag) return; const d=drag; drag=null; cv.style.cursor='default'; if(!d.moved&&d.k!=='logo') openEdit(d.k); };
  cv.addEventListener('pointerup',up); cv.addEventListener('pointercancel',()=>{ drag=null; });
  $('#bnResetPos').onclick=()=>{ B.off={}; if(B.alts.length) draw(); };
  $('#bnPng').onclick=()=>{ const a=document.createElement('a'); a.download=`현수막시안_${v('bnName').replace(/[\\/:*?"<>|]/g,'').slice(0,20)}_${(()=>{ const [w,h]=dims(); return (h>w?'세로':'가로')+w+'x'+h+'m'; })()}.png`; a.href=$('#bnCanvas').toDataURL('image/png'); a.click(); };
  $('#bnSample').onclick=()=>{ $('#bnName').value='2026 비슬산 참꽃문화제'; $('#bnWhen').value='2026. 4. 18.(토) ~ 4. 26.(일)'; $('#bnPlace').value='비슬산 자연휴양림 일원'; $('#bnHost').value='달성군 · 달성문화재단'; $('#bnPoint').value='30년 만의 참꽃 만개, 가족 나들이'; $('#bnTone').value='친근'; toast?.('예시를 채웠습니다 — 「문구·시안 만들기」를 눌러보세요'); };
  $('#bnReset').onclick=()=>{ ['bnName','bnWhen','bnPlace','bnHost','bnPoint'].forEach(id=>$('#'+id).value=''); B.alts=[]; $('#bnOut').hidden=true; $('#bnMsg').textContent=''; };
}
window.BANNER={init};
})();
