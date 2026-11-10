/* ============================================================
   달성On — 홍보영상 만들기 (movie.js)
   SNS 세로 9:16 · 30초 고정. 사용자는 내용만 넣고(용도는 선택) 「영상 만들기」.
   ① 대본: Claude가 용도별 장면 흐름(훅 → 장면 4 → 마무리)으로 자막·장면 설명을 쓴다
   ② 장면 그림 4장: /api/card (gpt-image) — 같은 화풍·같은 등장인물
   ③ 움직이는 영상 4개: /api/video (fal.ai Wan 2.2 Turbo 그림→영상, 하루 한도) — 원문은 보내지 않는다
   ④ 합치기: 캔버스에 영상 + 글자 모션 + 군 CI 마무리를 그리며 MediaRecorder로 mp4 녹화
   한도 초과·키 없음·실패 시 ③ 대신 그림에 움직임(확대·이동)을 넣어 끝까지 만든다.
   ============================================================ */
(function(){
"use strict";
const $=s=>document.querySelector(s);
const W=720,H=1280, T_HOOK=3, T_SC=5, T_END=4;          // 3 + 5×4 + 4 = 27초
const USER_LIMIT=2;                                     // 이 브라우저 하루 AI 영상 편수
const V={busy:false,data:null,imgs:[],clips:[],blob:null,ext:'mp4',logo:null,purpose:'auto'};
const PUR={ recruit:['📣','모집·신청'], event:['🎉','행사·축제'], policy:['📋','정책·사업 안내'], news:['🏆','성과·소식'], campaign:['🦺','생활정보·캠페인'] };
const TONE={ bright:'밝고 경쾌', calm:'차분·신뢰' }, STYLE={ illust:'일러스트', photo:'실사풍' };
const PAL={ navy:['#0b2a6b','#1b4db3','#ffd166'], green:['#145a32','#27ae60','#f9e79f'], orange:['#c0392b','#e67e22','#fff3c4'], mint:['#0f6b78','#2bb3a3','#fdfefe'], purple:['#3b2a7a','#6c4cd1','#ffd6f0'] };
const v=id=>($('#'+id).value||'').trim();
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const code=()=>(window.S||{}).code||'';

const SYS=`당신은 대구광역시 달성군 SNS 홍보영상(릴스·쇼츠, 세로 9:16, 약 27초) 연출가입니다. 제공된 문서를 읽고 영상 대본을 씁니다.
구성은 고정: 훅(3초) → 장면 4개(각 5초, AI가 그린 그림이 실제로 움직이는 영상) → 마무리(4초, 군 CI).
용도(purpose)별 장면 흐름:
· recruit(모집·신청): 질문 훅 → 무엇을 → 누가·얼마나 → 언제·어디서 → 신청 방법
· event(행사·축제): 분위기 훅 → 행사명·일시 → 볼거리1 → 볼거리2 → 놀러 오세요
· policy(정책·사업 안내): 무엇이 바뀌나 → 누가 → 혜택 → 방법 → 문의
· news(성과·소식): 큰 결과 → 의미 → 과정 → 함께한 사람들 → 앞으로
· campaign(생활정보·캠페인): 경각심 훅 → 상황 → 행동수칙1 → 행동수칙2 → 함께해요
규칙
· 자막은 군민에게 말하듯 짧고 쉬운 존댓말. head 12자 이내, sub 22자 이내. 숫자·날짜·장소·연락처는 문서에 있는 것만(없으면 쓰지 않는다). 과장 금지.
· big: 그 장면에서 크게 강조할 숫자·날짜(예 "320명" "무료" "11.14까지"). 없으면 "".
· tone: bright(밝고 경쾌) 또는 calm(차분·신뢰). style: illust(따뜻한 2D 애니메이션 일러스트) 또는 photo(실사풍). 용도와 대상에 맞게 고른다(어르신 대상·안전·성과는 대체로 calm).
· palette: navy/green/orange/mint/purple 중 내용에 어울리는 것.
· character: 장면마다 반복해 나올 주인공 묘사(영어, 예 "a cheerful Korean grandmother in her 70s with short gray hair and a lavender cardigan"). 사람이 어울리지 않으면 "".
· visual: 그 장면 그림 묘사(영어, 구체적으로 — 장소·인물·행동·소품, 한국 지방 도시 배경). motion: 5초 동안의 움직임(영어 — 인물 동작 + 카메라 움직임 한 가지, 예 "she taps the phone screen and smiles; slow push-in").
반드시 아래 JSON만 출력:
{"purpose":"recruit","tone":"bright","style":"illust","palette":"navy","character":"…","title":"영상 제목","hook":{"head":"…","sub":"…"},"scenes":[{"head":"…","sub":"…","big":"","visual":"…","motion":"…"},{…},{…},{…}],"end":{"head":"…","sub":"…"}}`;

/* ── 공통 ── */
function loadImg(src){ return new Promise(ok=>{ const i=new Image(); i.onload=()=>ok(i); i.onerror=()=>ok(null); i.src=src; }); }
const ease=t=>t<=0?0:t>=1?1:1-Math.pow(1-t,3);
const back=t=>{ if(t<=0) return 0; if(t>=1) return 1; const c=1.70158; return 1+(c+1)*Math.pow(t-1,3)+c*Math.pow(t-1,2); };
function wrap(ctx,text,maxW){ const out=[]; let line=''; for(const w of String(text||'').split(/(\s+)/)){ const t=line+w; if(ctx.measureText(t).width>maxW&&line.trim()){ out.push(line.trim()); line=w.trimStart(); } else line=t; } if(line.trim()) out.push(line.trim());
  return out.flatMap(l=>{ if(ctx.measureText(l).width<=maxW) return [l]; const r=[]; let s=''; for(const ch of l){ if(ctx.measureText(s+ch).width>maxW&&s){ r.push(s); s=ch; } else s+=ch; } if(s) r.push(s); return r; }); }
const F=(w,s,bold)=>`${w} ${s}px ${bold&&V.data?.tone==='bright'?'"Black Han Sans",':''}Pretendard,"Malgun Gothic",sans-serif`;
function quotaLocal(){ try{ const o=JSON.parse(localStorage.getItem('dsMvQuota')||'{}'); const d=new Date().toISOString().slice(0,10); return o.d===d?o.n:0; }catch(e){ return 0; } }
function quotaUse(){ try{ const d=new Date().toISOString().slice(0,10); localStorage.setItem('dsMvQuota',JSON.stringify({d,n:quotaLocal()+1})); }catch(e){} }

/* ── 진행 표시 (미리보기 칸 위) ── */
const STEPS=['대본 쓰기','장면 그림 4장','움직이는 영상 4개','자막·편집 합치기'];
function prog(step,detail,t0){ const P=$('#mvProg'); if(step<0){ P.hidden=true; clearInterval(V._pt); return; } P.hidden=false;
  const f=()=>{ const sec=t0?Math.round((Date.now()-t0)/1000):0; P.innerHTML=`<div class="spin"></div><b>🎬 AI가 영상을 만드는 중… ${sec}초</b><ol>${STEPS.map((s,i)=>`<li class="${i<step?'ok':i===step?'now':''}">${i<step?'✔':i===step?'●':'○'} ${s}${i===step&&detail?` <em>${detail}</em>`:''}</li>`).join('')}</ol><small>보통 2~4분 걸립니다\n그동안 다른 메뉴를 쓰셔도 됩니다</small>`; };
  f(); clearInterval(V._pt); V._pt=setInterval(f,1000); }

/* ── ① 대본 ── */
async function script(){
  const pur=V.purpose!=='auto'?`용도: ${V.purpose} (${PUR[V.purpose][1]}) — 이 흐름을 따른다\n`:'용도: 문서를 읽고 가장 알맞은 것을 고른다\n';
  const txt=await dsLLM(SYS,`${pur}문서:\n${v('mvSrc').slice(0,7000)}`,{max:2200});
  const m=txt.match(/\{[\s\S]*\}/); if(!m) throw new Error('대본 형식을 읽지 못했습니다'); const j=JSON.parse(m[0]);
  if(!Array.isArray(j.scenes)||j.scenes.length<4) throw new Error('장면이 부족합니다'); j.scenes=j.scenes.slice(0,4);
  if(!PUR[j.purpose]) j.purpose=V.purpose!=='auto'?V.purpose:'recruit'; if(V.purpose!=='auto') j.purpose=V.purpose;
  if(!TONE[j.tone]) j.tone='bright'; if(!STYLE[j.style]) j.style='illust'; if(!PAL[j.palette]) j.palette='navy';
  j.hook=j.hook||{head:j.title||'달성군 소식',sub:''}; j.end=j.end||{head:'자세한 내용은',sub:'달성군 누리집'}; return j;
}
function offline(){ const ls=v('mvSrc').split(/\n+/).map(x=>x.replace(/^[\d.\s①-⑳○□▣-]+/,'').trim()).filter(x=>x.length>4);
  const sc=[0,1,2,3].map(i=>({head:(ls[i+1]||'달성군 소식').slice(0,12),sub:(ls[i+1]||'').slice(12,34),big:'',visual:'',motion:''}));
  return {purpose:V.purpose!=='auto'?V.purpose:'recruit',tone:'bright',style:'illust',palette:'navy',character:'',title:(ls[0]||'달성군 소식').slice(0,20),hook:{head:(ls[0]||'달성군 소식').slice(0,14),sub:''},scenes:sc,end:{head:'자세한 내용은',sub:'달성군 누리집'}}; }

/* ── ② 장면 그림 ── */
function imgPrompt(d,s){
  const style=d.style==='photo'?'Photorealistic cinematic still photo, natural soft light, shallow depth of field, Korean people in a small city of South Korea'
    :'Warm high-quality 2D animation film style illustration (modern Korean public-service animation look), soft lighting, clean shapes, gentle colors';
  return `${style}. Vertical 9:16 frame for a smartphone short video.
SCENE: ${s.visual||s.head}
${d.character?`RECURRING MAIN CHARACTER (keep identical across all scenes): ${d.character}\n`:''}Setting: Dalseong-gun, Daegu, South Korea. Mood: ${d.tone==='calm'?'calm, trustworthy, warm':'bright, cheerful, lively'}.
Composition: main subject in the middle, keep the bottom third simple (subtitles go there). IMPORTANT: absolutely no text, no letters, no numbers, no logos, no signs, no watermarks.`;
}
async function cardJob(prompt){
  const r=await fetch('/api/card',{method:'POST',headers:{'content-type':'application/json','x-access-code':code()},body:JSON.stringify({action:'start',prompt,size:'1024x1536',expect:[]})});
  const j=await r.json(); if(!r.ok||!j.id) throw new Error(j.error||'그림 접수 실패');
  const t0=Date.now(); while(Date.now()-t0<200000){ await sleep(1800); const k=await (await fetch('/api/card?id='+j.id,{headers:{'x-access-code':code()}})).json(); if(k.status==='done') return k.image; if(k.status==='error') throw new Error(k.error||'그림 실패'); }
  throw new Error('그림 시간 초과'); }

/* ── ③ 움직이는 영상 ── */
async function clipJob(ticket,image,prompt){
  const r=await fetch('/api/video',{method:'POST',headers:{'content-type':'application/json','x-access-code':code()},body:JSON.stringify({action:'clip',ticket,image,prompt})});
  const j=await r.json(); if(!r.ok||!j.rid) throw new Error(j.error||'영상 접수 실패');
  const t0=Date.now(); while(Date.now()-t0<420000){ await sleep(4000); const k=await (await fetch('/api/video?rid='+encodeURIComponent(j.rid),{headers:{'x-access-code':code()}})).json(); if(k.status==='done') return k.url; if(k.status==='error') throw new Error(k.error||'영상 실패'); }
  throw new Error('영상 시간 초과'); }
async function videoEl(url){   // 캔버스에 그리려면 같은 출처여야 하므로 blob으로 받아 둔다 (직접 → 안 되면 서버 중계)
  let b=null; try{ const r=await fetch(url); if(r.ok) b=await r.blob(); }catch(e){}
  if(!b){ const r=await fetch('/api/video?file='+encodeURIComponent(url),{headers:{'x-access-code':code()}}); if(!r.ok) throw new Error('영상 파일을 받지 못했습니다'); b=await r.blob(); }
  const el=document.createElement('video'); el.muted=true; el.playsInline=true; el.preload='auto'; el.src=URL.createObjectURL(b);
  await new Promise((ok,no)=>{ el.onloadeddata=ok; el.onerror=()=>no(new Error('영상 열기 실패')); setTimeout(ok,8000); }); return el; }

/* ── ④ 그리기 ── */
function cover(ctx,src,sw,sh,z=1,dx=0,dy=0){ const r=Math.max(W/sw,H/sh)*z; const w=sw*r,h=sh*r; ctx.drawImage(src,(W-w)/2+dx,(H-h)/2+dy,w,h); }
function bgGrad(ctx,p){ const g=ctx.createLinearGradient(0,0,W,H); g.addColorStop(0,p[0]); g.addColorStop(1,p[1]); ctx.fillStyle=g; ctx.fillRect(0,0,W,H); }
function shade(ctx,from=0.45){ const g=ctx.createLinearGradient(0,H*from,0,H); g.addColorStop(0,'rgba(0,0,0,0)'); g.addColorStop(1,'rgba(5,12,35,.82)'); ctx.fillStyle=g; ctx.fillRect(0,H*from,W,H*(1-from)); }
function tag(ctx,text,p,a){ ctx.save(); ctx.globalAlpha=a; ctx.font=F(700,24); const w=ctx.measureText(text).width+36; ctx.fillStyle=p[2]; ctx.beginPath(); ctx.roundRect(48,70,w,46,23); ctx.fill(); ctx.fillStyle=p[0]; ctx.textBaseline='middle'; ctx.textAlign='left'; ctx.fillText(text,66,94); ctx.restore(); }
function logoCorner(ctx,a=1){ if(!V.logo) return; const lh=44, lw=V.logo.width*lh/V.logo.height; ctx.save(); ctx.globalAlpha=a; ctx.fillStyle='rgba(255,255,255,.95)'; ctx.beginPath(); ctx.roundRect(W-48-lw-16,62,lw+16,lh+16,10); ctx.fill(); ctx.drawImage(V.logo,W-48-lw-8,70,lw,lh); ctx.restore(); }
/* 자막: 큰 글씨는 튀어나오고(back), 작은 글씨는 아래에서 올라온다 */
function caption(ctx,s,t,p,dur){ const out=Math.min(1,(dur-t)/0.35); ctx.save(); ctx.textAlign='center'; ctx.textBaseline='alphabetic';
  let y=H-150;
  if(s.sub){ const a=ease((t-0.55)/0.45)*out; ctx.globalAlpha=a; ctx.font=F(600,34); ctx.fillStyle='rgba(255,255,255,.95)'; const ls=wrap(ctx,s.sub,W-120); ls.reverse().forEach(l=>{ ctx.fillText(l,W/2,y+(1-a)*30); y-=48; }); y-=14; }
  const hs=s.head.length>9?60:70; ctx.font=F(800,hs,true); const hl=wrap(ctx,s.head,W-100); const k=back((t-0.15)/0.5)*out;
  ctx.globalAlpha=Math.min(1,k); hl.reverse().forEach(l=>{ ctx.save(); ctx.translate(W/2,y); ctx.scale(0.85+0.15*k,0.85+0.15*k); ctx.lineWidth=10; ctx.strokeStyle='rgba(5,12,35,.55)'; ctx.lineJoin='round'; ctx.strokeText(l,0,0); ctx.fillStyle='#fff'; ctx.fillText(l,0,0); ctx.restore(); y-=hs*1.15; });
  if(s.big){ const kb=back((t-0.05)/0.45)*out; ctx.globalAlpha=Math.min(1,kb); ctx.font=F(900,s.big.length>6?84:110,true); ctx.save(); ctx.translate(W/2,y-12); ctx.scale(0.6+0.4*kb,0.6+0.4*kb); ctx.lineWidth=12; ctx.strokeStyle='rgba(5,12,35,.5)'; ctx.strokeText(s.big,0,0); ctx.fillStyle=p[2]; ctx.fillText(s.big,0,0); ctx.restore(); }
  ctx.restore(); }
function drawHook(ctx,t,d,p){ const im=V.imgs[0]; if(im){ ctx.save(); ctx.filter='blur(6px) brightness(.55)'; cover(ctx,im,im.width,im.height,1.15+0.05*t/T_HOOK); ctx.restore(); } else bgGrad(ctx,p);
  ctx.fillStyle=p[0]+'99'; ctx.fillRect(0,0,W,H);
  ctx.save(); ctx.textAlign='center'; ctx.textBaseline='middle';
  const words=String(d.hook.head||'').split(/\s+/).filter(Boolean); ctx.font=F(900,82,true); const lines=wrap(ctx,d.hook.head,W-110); let wi=0; const lh=96, y0=H*0.42-(lines.length-1)*lh/2;
  lines.forEach((l,li)=>{ const k=back((t-0.15-li*0.28)/0.5); ctx.save(); ctx.globalAlpha=Math.min(1,Math.max(0,k)); ctx.translate(W/2,y0+li*lh+(1-Math.min(1,k))*40); ctx.fillStyle='#fff'; ctx.fillText(l,0,0); ctx.restore(); wi++; });
  const a=ease((t-0.9)/0.5); ctx.globalAlpha=a; ctx.fillStyle=p[2]; ctx.fillRect(W/2-50,y0+lines.length*lh-30,100,7); ctx.font=F(600,36); ctx.fillStyle='rgba(255,255,255,.92)'; wrap(ctx,d.hook.sub||'',W-140).forEach((l,i)=>ctx.fillText(l,W/2,y0+lines.length*lh+30+i*50));
  ctx.restore(); tag(ctx,`${PUR[d.purpose][0]} ${PUR[d.purpose][1]}`,p,ease(t/0.4)); logoCorner(ctx,ease(t/0.4)); }
function drawScene(ctx,i,t,d,p){ const c=V.clips[i], im=V.imgs[i];
  if(c&&c.readyState>=2){ cover(ctx,c,c.videoWidth||720,c.videoHeight||1280); }
  else if(im){ const z=1.04+0.10*(t/T_SC), dx=(i%2?-1:1)*18*(t/T_SC); cover(ctx,im,im.width,im.height,z,dx,-10*(t/T_SC)); }   // 움직이는 영상이 없을 때: 천천히 확대·이동
  else bgGrad(ctx,p);
  if(t<0.25){ ctx.fillStyle=`rgba(255,255,255,${0.35*(1-t/0.25)})`; ctx.fillRect(0,0,W,H); }   // 장면 전환 플래시
  shade(ctx,0.42); caption(ctx,d.scenes[i],t,p,T_SC); tag(ctx,`${i+1} / 4`,p,1); logoCorner(ctx,1); }
function drawEnd(ctx,t,d,p){ bgGrad(ctx,p); ctx.save(); ctx.globalAlpha=.08; ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(W*0.85,H*0.18+Math.sin(t)*14,260,0,7); ctx.fill(); ctx.beginPath(); ctx.arc(W*0.1,H*0.85,200,0,7); ctx.fill(); ctx.restore();
  ctx.save(); ctx.textAlign='center'; ctx.textBaseline='middle';
  const k=back((t-0.1)/0.55); ctx.globalAlpha=Math.min(1,k); ctx.font=F(900,74,true); ctx.fillStyle='#fff'; const hl=wrap(ctx,d.end.head,W-110); hl.forEach((l,i)=>{ ctx.save(); ctx.translate(W/2,H*0.36+i*90); ctx.scale(0.8+0.2*Math.min(1,k),0.8+0.2*Math.min(1,k)); ctx.fillText(l,0,0); ctx.restore(); });
  const a=ease((t-0.6)/0.5); ctx.globalAlpha=a; ctx.fillStyle=p[2]; ctx.fillRect(W/2-50,H*0.36+hl.length*90-20,100,7); ctx.font=F(600,38); ctx.fillStyle='#fff'; wrap(ctx,d.end.sub||'',W-140).forEach((l,i)=>ctx.fillText(l,W/2,H*0.36+hl.length*90+44+i*54));
  if(V.logo){ const b=back((t-1.0)/0.6); ctx.globalAlpha=Math.min(1,Math.max(0,b)); const lh=96, lw=V.logo.width*lh/V.logo.height; ctx.fillStyle='rgba(255,255,255,.96)'; ctx.beginPath(); ctx.roundRect(W/2-lw/2-26,H*0.72-26,lw+52,lh+52,22); ctx.fill(); ctx.drawImage(V.logo,W/2-lw/2,H*0.72,lw,lh); }
  ctx.globalAlpha=ease((t-1.3)/0.5); ctx.font=F(700,30); ctx.fillStyle='rgba(255,255,255,.85)'; ctx.fillText('대구광역시 달성군',W/2,H*0.72+150);
  ctx.restore(); }
function frameAt(ctx,el){ const d=V.data, p=PAL[d.palette]||PAL.navy; ctx.clearRect(0,0,W,H);
  if(el<T_HOOK) return drawHook(ctx,el,d,p);
  const s=el-T_HOOK; if(s<T_SC*4){ return drawScene(ctx,Math.floor(s/T_SC),s%T_SC,d,p); }
  drawEnd(ctx,s-T_SC*4,d,p); }
const TOTAL=T_HOOK+T_SC*4+T_END;

/* 실시간으로 그리며 녹화 (장면이 바뀔 때 그 장면 영상을 처음부터 재생) */
async function compose(){
  const c=$('#mvCanvas'); c.width=W; c.height=H; const ctx=c.getContext('2d'); $('#mvVideo').hidden=true; c.hidden=false;
  try{ await Promise.all(['Black Han Sans','Pretendard'].flatMap(f=>[document.fonts.load(`800 40px "${f}"`,'가나다'),document.fonts.load(`400 40px "${f}"`,'가나다')])); }catch(e){}
  const mime=['video/mp4;codecs=avc1','video/mp4','video/webm;codecs=vp9','video/webm'].find(m=>window.MediaRecorder&&MediaRecorder.isTypeSupported(m)); V.ext=mime&&mime.startsWith('video/mp4')?'mp4':'webm';
  const stream=c.captureStream(30); const rec=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:8_000_000}); const chunks=[]; rec.ondataavailable=e=>{ if(e.data.size) chunks.push(e.data); };
  const stopped=new Promise(ok=>rec.onstop=ok); rec.start(250);
  V.clips.forEach(x=>{ if(x){ x.pause(); x.currentTime=0; } }); let cur=-1; const t0=performance.now();
  await new Promise(res=>{ const tick=()=>{ const el=(performance.now()-t0)/1000; if(el>=TOTAL) return res();
      const s=el-T_HOOK, idx=s>=0&&s<T_SC*4?Math.floor(s/T_SC):-1;
      if(idx!==cur){ if(cur>=0&&V.clips[cur]) V.clips[cur].pause(); cur=idx; if(idx>=0&&V.clips[idx]){ V.clips[idx].currentTime=0; V.clips[idx].play().catch(()=>{}); } }
      frameAt(ctx,el); if(!$('#mvProg').hidden) prog(-1); $('#mvMsg').textContent=`🎬 장면을 이어 붙이는 중… ${Math.round(el)} / ${TOTAL}초 (실제 길이만큼 재생하며 녹화합니다)`;   /* 합치는 동안은 진행 상자를 걷고 미리보기를 그대로 보여 준다 */ requestAnimationFrame(tick); }; tick(); });
  rec.stop(); await stopped; V.clips.forEach(x=>x&&x.pause());
  V.blob=new Blob(chunks,{type:(mime||'video/webm').split(';')[0]}); const vid=$('#mvVideo'); vid.src=URL.createObjectURL(V.blob); vid.hidden=false; c.hidden=true; vid.play().catch(()=>{});
  $('#mvDlSub').textContent=`${V.ext} · 세로 9:16 · ${TOTAL}초 · ${(V.blob.size/1048576).toFixed(1)}MB`;
}

/* ── 화면 ── */
function renderSide(){ const d=V.data; const p=PAL[d.palette]||PAL.navy;
  const item=(l,val,sw)=>`<div class="sv"><em>${l}</em><b>${sw||''}${val}</b></div>`;
  $('#mvSum').innerHTML=`<div class="sh"><span>✨</span><b>AI가 고른 구성</b></div><div class="sg">${item('용도',PUR[d.purpose][1]+(V.purpose!=='auto'?'':''))}${item('분위기',TONE[d.tone])}${item('화풍',STYLE[d.style])}${item('색',['남색','녹색','주황','민트','보라'][Object.keys(PAL).indexOf(d.palette)]||'남색',`<i class="sw" style="background:linear-gradient(135deg,${p[0]},${p[1]})"></i>`)}</div>`;
  const rows=[['훅',d.hook,'hook'],...d.scenes.map((s,i)=>[`장면 ${i+1}`,s,i]),['마무리',d.end,'end']];
  $('#mvScenes').innerHTML=rows.map(([l,s,k])=>`<div class="mv-row" data-k="${k}"><span class="mv-no">${l}</span><input class="mv-h" value="${(s.head||'').replace(/"/g,'&quot;')}" maxlength="16" placeholder="큰 자막">${k!=='hook'&&k!=='end'?`<input class="mv-big" value="${(s.big||'').replace(/"/g,'&quot;')}" placeholder="강조 숫자" maxlength="10">`:''}<input class="mv-s" value="${(s.sub||'').replace(/"/g,'&quot;')}" maxlength="34" placeholder="작은 자막"></div>`).join('');
  $('#mvScenes').querySelectorAll('.mv-row').forEach(el=>{ const k=el.dataset.k, s=k==='hook'?d.hook:k==='end'?d.end:d.scenes[+k];
    el.querySelector('.mv-h').oninput=e=>{ s.head=e.target.value; }; el.querySelector('.mv-s').oninput=e=>{ s.sub=e.target.value; }; const b=el.querySelector('.mv-big'); if(b) b.oninput=e=>{ s.big=e.target.value; };
    el.onclick=()=>{ const t=k==='hook'?1.5:k==='end'?T_HOOK+T_SC*4+2:T_HOOK+(+k)*T_SC+2.5; const c=$('#mvCanvas'); c.hidden=false; $('#mvVideo').hidden=true; $('#mvVideo').pause(); frameAt(c.getContext('2d'),t); }; });
  $('#mvTotal').textContent=`세로 9:16 · ${TOTAL}초 · AI 장면 4개`; }

async function make(){
  if(V.busy) return; if(!v('mvSrc')){ $('#mvMsg').textContent='알릴 내용을 붙여넣거나 파일을 올려 주세요.'; return $('#mvSrc').focus(); }
  const S=window.S||{}; V.busy=true; $('#mvGo').disabled=true; $('#mvRemix').disabled=true; V._t0=Date.now(); V.imgs=[]; V.clips=[]; V.blob=null;
  $('#mvOut').hidden=false; $('#mvVideo').hidden=true; $('#mvCanvas').hidden=false; const ctx=$('#mvCanvas').getContext('2d'); ctx.fillStyle='#0b1a3a'; ctx.fillRect(0,0,W,H);
  $('#mvSum').innerHTML='<div class="sh"><span>✨</span><b>AI가 고른 구성</b></div><div class="mv-wait">대본을 쓰고 있습니다…</div>'; $('#mvScenes').innerHTML=''; $('#mvOut').scrollIntoView({behavior:'smooth',block:'start'});
  let note='';
  try{
    V.logo=V.logo||await loadImg('assets/dalseong_ci.png');
    const online=(S.key||S.server)&&!S.offline;
    prog(0,'',V._t0); $('#mvMsg').textContent='AI가 영상을 만들고 있습니다 — 보통 2~4분 걸립니다.';
    V.data=online?await script():offline(); renderSide();
    // ② 장면 그림 4장 (동시에)
    let n=0; prog(1,'0/4',V._t0);
    const imgs=online?await Promise.all(V.data.scenes.map(async s=>{ try{ const u=await cardJob(imgPrompt(V.data,s)); prog(1,`${++n}/4`,V._t0); return u; }catch(e){ prog(1,`${++n}/4`,V._t0); return null; } })):[null,null,null,null];
    V.imgs=await Promise.all(imgs.map(u=>u?loadImg(u):loadImg('assets/hero.jpg')));
    if(imgs.some(u=>!u)) note='일부 장면 그림을 만들지 못해 기본 사진으로 대신했습니다. ';
    // ③ 움직이는 영상 4개 (하루 한도 안에서)
    let ticket=null;
    if(online&&quotaLocal()>=USER_LIMIT) note+=`이 브라우저의 오늘 AI 영상 ${USER_LIMIT}편을 다 써서 그림에 움직임을 넣어 만들었습니다. `;
    else if(online){ try{ const r=await fetch('/api/video',{method:'POST',headers:{'content-type':'application/json','x-access-code':code()},body:JSON.stringify({action:'start'})}); const j=await r.json();
        if(r.ok&&j.ticket){ ticket=j.ticket; quotaUse(); } else if(j.error==='limit') note+=`오늘 AI 영상 한도(전체 ${j.limit}편)를 다 써서 그림에 움직임을 넣어 만들었습니다. `; else if(j.error==='nokey') note+='움직이는 영상 기능이 아직 연결되지 않아 그림에 움직임을 넣어 만들었습니다. '; else note+='움직이는 영상을 접수하지 못해 그림에 움직임을 넣어 만들었습니다. '; }catch(e){ note+='움직이는 영상을 접수하지 못했습니다. '; } }
    if(ticket){ let m=0; prog(2,'0/4',V._t0);
      V.clips=await Promise.all(imgs.map(async (u,i)=>{ if(!u){ prog(2,`${++m}/4`,V._t0); return null; } try{ const s=V.data.scenes[i]; const url=await clipJob(ticket,u,`${s.motion||'gentle natural movement'}. ${V.data.style==='photo'?'Cinematic realistic motion':'Smooth 2D animation motion'}, consistent character, no text.`); const el=await videoEl(url); prog(2,`${++m}/4`,V._t0); return el; }catch(e){ console.warn(e); prog(2,`${++m}/4`,V._t0); return null; } }));
      const ok=V.clips.filter(Boolean).length; if(ok<4) note+=`움직이는 영상 ${4-ok}개를 만들지 못해 그 장면은 그림에 움직임을 넣었습니다. `; }
    // ④ 합치기
    prog(3,'',V._t0); await compose(); prog(-1);
    $('#mvMsg').textContent=(note||'완성됐습니다 — ')+'오른쪽에서 자막을 고치고 다시 합치거나 영상으로 저장하세요.';
    window.dsSave&&dsSave('movie',V.data.title||'홍보영상',[`[훅] ${V.data.hook.head} ${V.data.hook.sub||''}`,...V.data.scenes.map((x,i)=>`[장면${i+1}] ${x.big?x.big+' · ':''}${x.head} — ${x.sub||''}`),`[마무리] ${V.data.end.head} ${V.data.end.sub||''}`].join('\n'));
    if(S.stats) S.stats.gen++, window.dsHit&&dsHit('gen');
  }catch(e){ prog(-1); $('#mvMsg').textContent='⚠ '+e.message; if(!V.data) $('#mvOut').hidden=true; }
  finally{ V.busy=false; $('#mvGo').disabled=false; $('#mvRemix').disabled=false; }
}
async function remix(){ if(!V.data||V.busy) return; V.busy=true; $('#mvRemix').disabled=true; V._t0=Date.now(); try{ prog(3,'',V._t0); await compose(); $('#mvMsg').textContent='고친 자막으로 다시 합쳤습니다.'; }catch(e){ $('#mvMsg').textContent='⚠ '+e.message; } finally{ prog(-1); V.busy=false; $('#mvRemix').disabled=false; } }

function init(){
  if($('#mvGo')._on) return; $('#mvGo')._on=1;
  $('#mvGo').onclick=make; $('#mvRemix').onclick=remix;
  $('#mvPurpose').onclick=e=>{ const b=e.target.closest('button'); if(!b) return; V.purpose=b.dataset.v; $('#mvPurpose').querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b)); };
  const readFiles=async fs=>{ const L=$('#mvFileList'); const done=[];
    for(const f of fs){ L.textContent=`「${f.name}」 읽는 중…`;
      try{ if(typeof window.pressRead!=='function') throw new Error('읽기 기능을 불러오지 못했습니다'); const r=await window.pressRead(f); if(!r.text) throw new Error('글자를 찾지 못했습니다');
        const t=r.text.replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim().slice(0,8000); const src=$('#mvSrc'); src.value=src.value.trim()?src.value.trim()+`\n\n[${f.name}]\n`+t:t; done.push(`📄 ${f.name} (${t.length.toLocaleString()}자)`); }
      catch(err){ done.push(`⚠ ${f.name} — ${err.message}`); } }
    L.textContent=done.join(' · ')+' — 아래 「영상 만들기」를 누르세요'; };
  $('#mvFile').onchange=e=>{ const fs=[...e.target.files]; e.target.value=''; readFiles(fs); };
  let _sb=null; const preload=()=>{ if(!_sb) _sb=fetch('assets/sample_edu_plan.pdf').then(r=>r.blob()).catch(()=>null);
    if(!window.pdfjsLib&&!document.querySelector('script[src="vendor/pdf.min.js"]')){ const sc=document.createElement('script'); sc.src='vendor/pdf.min.js'; sc.onload=()=>{ try{ pdfjsLib.GlobalWorkerOptions.workerSrc='vendor/pdf.worker.min.js'; }catch(e){} }; document.head.appendChild(sc); } };
  setTimeout(preload,800);
  $('#mvSampleFile').onclick=async()=>{ const btn=$('#mvSampleFile'); if(btn.disabled) return; btn.disabled=true; const t0=btn.textContent; btn.textContent='⏳ 샘플 계획서 읽는 중…';
    try{ preload(); const b=await _sb; if(!b) throw 0; $('#mvSrc').value=''; await readFiles([new File([b],'2026년 군민 정보화교육 추진 계획(샘플).pdf',{type:'application/pdf'})]); }catch(e){ $('#mvFileList').textContent='⚠ 샘플 파일을 불러오지 못했습니다'; _sb=null; } finally{ btn.disabled=false; btn.textContent=t0; } };
  $('#mvDl').onclick=()=>{ if(!V.blob) return; const a=document.createElement('a'); a.href=URL.createObjectURL(V.blob); a.download=`달성군_홍보영상_${(V.data?.title||'영상').replace(/[\\/:*?"<>|]/g,'').slice(0,24)}.${V.ext}`; a.click(); };
  $('#mvReset').onclick=()=>{ if(V.busy) return; $('#mvSrc').value=''; $('#mvFileList').textContent='파일을 올리면 내용을 읽어 위 칸에 채웁니다 (한글 hwpx·워드·PDF·텍스트) · 직접 붙여넣어도 됩니다'; V.data=null; V.blob=null; $('#mvOut').hidden=true; $('#mvMsg').textContent=''; };
}
window.MOVIE={init};
})();
