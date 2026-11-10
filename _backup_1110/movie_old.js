/* ============================================================
   달성On — 홍보영상 만들기 (movie.js)
   · 계획서·보도자료 PDF(또는 텍스트)를 올리면 내용을 읽어 SNS 홍보용 짧은 영상 대본(장면별 제목·문장)을 쓰고,
     가로/세로·길이에 맞춰 브라우저 안에서 바로 영상으로 그린다(캔버스 애니메이션 → MediaRecorder).
   · 배경 : 군 보유 사진 / 내 사진 여러 장(장면마다 번갈아) / 색 테마. 군 CI 원본 그대로.
   · 결과 : mp4(지원 브라우저) 또는 webm 내려받기 + 게시글 문구. 나레이션·BGM은 2단계(내부 음성서버·무료 음원 확보 후).
   ============================================================ */
(function(){
"use strict";
const $=s=>document.querySelector(s);
const V={busy:false,data:null,logo:null,hero:null,photos:[],blob:null,ext:'webm'};
const SIZES={ v:[1080,1920,'세로 9:16 (릴스·쇼츠·스토리)'], h:[1920,1080,'가로 16:9 (유튜브·홈페이지)'], s:[1080,1080,'정사각 1:1 (인스타 피드)'] };
const THEMES={ navy:['남색',['#0b2a6b','#1b4db3'],'#ffd166'], green:['녹색',['#145a32','#27ae60'],'#f9e79f'], orange:['주황',['#c0392b','#e67e22'],'#fff3c4'], mint:['민트',['#117a8b','#48c9b0'],'#ffffff'] };
const v=id=>($('#'+id).value||'').trim();

const SYS=`당신은 대구광역시 달성군 SNS 홍보영상 작가입니다. 제공된 문서를 읽고 짧은 홍보영상 대본을 씁니다.
· 장면(scene)마다 큰 제목(head, 10자 이내)과 자막 문장(body, 1~2줄, 줄당 18자 이내)을 쓴다. 첫 장면은 시선을 끄는 한 줄, 마지막 장면은 참여 방법·문의처.
· 군민에게 말하듯 쉬운 존댓말("~해요" "~하세요"). 숫자·날짜·장소는 문서에 있는 것만 쓴다. 홍보 과장 금지.
· 장면 수와 길이는 요청된 총 길이에 맞춘다(장면당 4~6초).
반드시 아래 JSON만 출력한다(설명 금지):
{"title":"영상 제목","scenes":[{"head":"…","body":["…","…"],"sec":5}],"caption":"게시글 문구 2~3문장","tags":["#달성군","#대구달성"]}`;

/* 문서 읽기 */
async function readFile(f){
  const n=f.name.toLowerCase();
  if(n.endsWith('.pdf')){
    if(!window.pdfjsLib){ await new Promise((ok,no)=>{ const s=document.createElement('script'); s.src='vendor/pdf.min.js'; s.onload=ok; s.onerror=no; document.head.appendChild(s); }); pdfjsLib.GlobalWorkerOptions.workerSrc='vendor/pdf.worker.min.js'; }
    const pdf=await pdfjsLib.getDocument({data:await f.arrayBuffer()}).promise; let out='';
    for(let i=1;i<=Math.min(pdf.numPages,12);i++){ const pg=await pdf.getPage(i); const tc=await pg.getTextContent(); out+=tc.items.map(x=>x.str).join(' ')+'\n'; }
    if(out.replace(/\s/g,'').length<30) throw new Error('이 PDF는 글자가 아닌 이미지(스캔본)라 읽지 못했습니다. 내용을 텍스트로 붙여넣어 주세요.');
    return out;
  }
  return await f.text();
}
function offline(){
  const src=v('mvSrc'); const paras=src.split(/\n\s*\n|\r?\n/).map(x=>x.trim()).filter(x=>x.length>6); const total=+v('mvLen')||30; const n=Math.max(3,Math.round(total/5));
  const title=(paras[0]||'달성군 소식').slice(0,14); const sc=[{head:title,body:[(paras[0]||'').slice(0,18)],sec:5}];
  paras.slice(1,n-1).forEach((p,i)=>sc.push({head:`포인트 ${i+1}`,body:p.replace(/\s+/g,' ').match(/.{1,18}/g).slice(0,2),sec:5}));
  while(sc.length<n-1) sc.push({head:`포인트 ${sc.length}`,body:['(모델 연결 시 문서에서 문장을 뽑아 채웁니다)'],sec:5});
  sc.push({head:'자세한 내용은',body:[v('mvContact')||'달성군 누리집 · 문의 053)668-○○○○'],sec:5});
  return {title,scenes:sc,caption:`${title} 소식을 영상으로 전해드려요.`,tags:['#달성군','#대구달성']};
}
async function callModel(user){
  const S=window.S||{}; const body={model:S.model||'claude-sonnet-4-5',max_tokens:1500,stream:true,system:SYS,messages:[{role:'user',content:user}]};
  const r=S.key
    ? await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'content-type':'application/json','x-api-key':S.key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},body:JSON.stringify(body)})
    : await fetch('/api/chat',{method:'POST',headers:{'content-type':'application/json','x-access-code':S.code||''},body:JSON.stringify(body)});
  if(!r.ok) throw new Error('모델 호출 실패 ('+r.status+')');
  const rd=r.body.getReader(), dec=new TextDecoder(); let buf='',text='';
  while(true){ const {value,done}=await rd.read(); if(done) break; buf+=dec.decode(value,{stream:true}); const ls=buf.split('\n'); buf=ls.pop();
    for(const ln of ls){ if(!ln.startsWith('data:')) continue; try{ const j=JSON.parse(ln.slice(5)); if(j.type==='content_block_delta'&&j.delta?.text){ text+=j.delta.text; $('#mvMsg').textContent=`대본 작성 중… ${text.length}자`; } }catch(e){} } }
  const m=text.match(/\{[\s\S]*\}/); if(!m) throw new Error('응답 형식을 읽지 못했습니다'); const j=JSON.parse(m[0]); if(!j.scenes?.length) throw new Error('장면이 비었습니다'); return j;
}

/* ── 그리기 ── */
function loadImg(src){ return new Promise(ok=>{ const i=new Image(); i.onload=()=>ok(i); i.onerror=()=>ok(null); i.src=src; }); }
function wrap(ctx,text,maxW){ const out=[]; let line=''; for(const ch of String(text)){ const t=line+ch; if(ctx.measureText(t).width>maxW&&line){ out.push(line); line=ch; } else line=t; } if(line) out.push(line); return out; }
const ease=t=>t<0?0:t>1?1:1-Math.pow(1-t,3);
function frame(ctx,W,H,sc,i,n,t,dur){
  const [,grad,acc]=THEMES[v('mvTheme')]||THEMES.navy; const bgMode=v('mvBg');
  const img = bgMode==='photo'?V.hero : bgMode==='custom'&&V.photos.length ? V.photos[i%V.photos.length] : null;
  if(img){ const z=1+0.06*(t/dur); const r=Math.max(W/img.width,H/img.height)*z; const w=img.width*r,h=img.height*r; ctx.drawImage(img,(W-w)/2,(H-h)/2,w,h); const g=ctx.createLinearGradient(0,0,0,H); g.addColorStop(0,'rgba(5,15,45,.25)'); g.addColorStop(1,'rgba(5,15,45,.78)'); ctx.fillStyle=g; ctx.fillRect(0,0,W,H); }
  else { const g=ctx.createLinearGradient(0,0,W,H); g.addColorStop(0,grad[0]); g.addColorStop(1,grad[1]); ctx.fillStyle=g; ctx.fillRect(0,0,W,H); ctx.fillStyle='rgba(255,255,255,.07)'; ctx.beginPath(); ctx.arc(W*0.8+Math.sin(t)*20,H*0.25,W*0.35,0,7); ctx.fill(); }
  // 들어오기/나가기
  const a=Math.min(ease(t/0.5), ease((dur-t)/0.5)); const slide=(1-ease(t/0.6))*40;
  const vert=H>W; const pad=W*0.08; const hs=Math.round(W*(vert?0.095:0.07)); const bs=Math.round(W*(vert?0.05:0.036));
  ctx.textBaseline='top'; ctx.textAlign='left'; ctx.globalAlpha=a;
  ctx.font=`700 ${Math.round(W*0.028)}px Pretendard,"Malgun Gothic",sans-serif`; ctx.fillStyle=acc; ctx.fillText(i===0?'달성군 소식':`${i+1} / ${n}`, pad, H*0.1+slide);
  ctx.font=`800 ${hs}px Pretendard,"Malgun Gothic",sans-serif`; ctx.fillStyle='#fff'; let y=(vert?H*0.36:H*0.3)+slide; wrap(ctx,sc.head,W-pad*2).forEach(l=>{ ctx.fillText(l,pad,y); y+=hs*1.2; });
  ctx.fillStyle=acc; ctx.fillRect(pad,y+hs*0.15,W*0.12,H*0.006); y+=hs*0.7;
  ctx.font=`500 ${bs}px Pretendard,"Malgun Gothic",sans-serif`; ctx.fillStyle='rgba(255,255,255,.92)'; (sc.body||[]).forEach(b=>wrap(ctx,b,W-pad*2).forEach(l=>{ ctx.fillText(l,pad,y+slide*0.5); y+=bs*1.55; }));
  ctx.globalAlpha=1;
  // 진행 바 · CI
  ctx.fillStyle='rgba(255,255,255,.25)'; ctx.fillRect(0,H-6,W,6); ctx.fillStyle=acc; ctx.fillRect(0,H-6,W*((i+Math.min(1,t/dur))/n),6);
  if(V.logo){ const lh=H*0.045, lw=V.logo.width*lh/V.logo.height; ctx.fillStyle='rgba(255,255,255,.95)'; ctx.beginPath(); ctx.roundRect(pad-lh*0.25,H-pad*0.9-lh-lh*0.2,lw+lh*0.5,lh+lh*0.4,lh*0.2); ctx.fill(); ctx.drawImage(V.logo,pad,H-pad*0.9-lh,lw,lh); }
  ctx.textAlign='right'; ctx.font=`600 ${Math.round(W*0.024)}px Pretendard,"Malgun Gothic",sans-serif`; ctx.fillStyle='rgba(255,255,255,.75)'; ctx.fillText('대구광역시 달성군',W-pad,H-pad*0.9-W*0.02);
}
async function preview(i){ const [W,H]=SIZES[v('mvSize')]||SIZES.v; const c=$('#mvCanvas'); c.width=W; c.height=H; const sc=V.data.scenes[i]; frame(c.getContext('2d'),W,H,sc,i,V.data.scenes.length,1.2,sc.sec||5); }
function renderScenes(){
  $('#mvScenes').innerHTML=V.data.scenes.map((s,i)=>`<div class="mv-scene" data-i="${i}"><b>${i+1}</b><input class="mv-h" value="${s.head.replace(/"/g,'&quot;')}"><input class="mv-b" value="${(s.body||[]).join(' / ').replace(/"/g,'&quot;')}"><span>${s.sec||5}초</span></div>`).join('');
  $('#mvScenes').querySelectorAll('.mv-scene').forEach(el=>{ const i=+el.dataset.i; el.onclick=()=>preview(i); el.querySelector('.mv-h').onchange=e=>{ V.data.scenes[i].head=e.target.value; preview(i); }; el.querySelector('.mv-b').onchange=e=>{ V.data.scenes[i].body=e.target.value.split('/').map(x=>x.trim()).filter(Boolean); preview(i); }; });
  $('#mvCaption').value=`${V.data.caption||''}\n\n${(V.data.tags||[]).join(' ')}`;
  const total=V.data.scenes.reduce((s,x)=>s+(x.sec||5),0); $('#mvTotal').textContent=`${V.data.scenes.length}장면 · 약 ${total}초`;
}
async function make(){
  if(V.busy) return; if(!v('mvSrc')){ $('#mvMsg').textContent='문서를 올리거나 내용을 붙여넣어 주세요.'; return $('#mvSrc').focus(); }
  V.busy=true; $('#mvGo').disabled=true; $('#mvMsg').textContent='대본 작성 중…';
  try{
    V.logo=V.logo||await loadImg('assets/dalseong_ci.png'); V.hero=V.hero||await loadImg('assets/hero.jpg');
    const S=window.S||{};
    if((S.key||S.server)&&!S.offline){ V.data=await callModel(`총 길이: ${v('mvLen')||30}초\n화면: ${SIZES[v('mvSize')][2]}\n문의처: ${v('mvContact')||'문서에 있으면 사용'}\n문서 내용:\n${v('mvSrc').slice(0,6000)}`); $('#mvMsg').textContent='대본 완성 — 장면 문구를 고친 뒤 「영상 만들기」를 누르세요.'; }
    else { await new Promise(r=>setTimeout(r,300)); V.data=offline(); $('#mvMsg').textContent='오프라인 모드 — 모델 연결 시 문서를 읽어 대본을 씁니다.'; }
    renderScenes(); await preview(0); window.dsSave&&dsSave('movie',V.data.title||'홍보영상 대본',V.data.scenes.map((x,i)=>`[장면${i+1}] ${x.head} — ${(x.body||[]).join(' ')}`).join('\n')+'\n\n'+(V.data.caption||'')); $('#mvOut').hidden=false; $('#mvVideoWrap').hidden=true; $('#mvOut').scrollIntoView({behavior:'smooth',block:'start'}); if(window.S&&S.stats) S.stats.gen++,window.dsHit&&dsHit('gen');
  }catch(e){ $('#mvMsg').textContent='⚠ '+e.message; }
  finally{ V.busy=false; $('#mvGo').disabled=false; }
}
/* 영상 녹화: 캔버스 애니메이션을 실시간으로 그리며 MediaRecorder로 담는다 */
async function record(){
  if(!V.data||V.busy) return; V.busy=true; $('#mvRec').disabled=true;
  const [W,H]=SIZES[v('mvSize')]||SIZES.v; const c=$('#mvCanvas'); c.width=W; c.height=H; const ctx=c.getContext('2d');
  const mime=['video/mp4;codecs=avc1','video/mp4','video/webm;codecs=vp9','video/webm'].find(m=>MediaRecorder.isTypeSupported(m)); V.ext=mime.startsWith('video/mp4')?'mp4':'webm';
  const stream=c.captureStream(30); const rec=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:6_000_000}); const chunks=[]; rec.ondataavailable=e=>{ if(e.data.size) chunks.push(e.data); };
  const done=new Promise(ok=>rec.onstop=ok); rec.start(250);
  const scenes=V.data.scenes, n=scenes.length, total=scenes.reduce((s,x)=>s+(x.sec||5),0); const t0=performance.now();
  await new Promise(resolve=>{
    const tick=()=>{ const el=(performance.now()-t0)/1000; let acc=0,i=0; while(i<n&&el>=acc+(scenes[i].sec||5)){ acc+=scenes[i].sec||5; i++; }
      if(i>=n){ return resolve(); } frame(ctx,W,H,scenes[i],i,n,el-acc,scenes[i].sec||5); $('#mvMsg').textContent=`영상 만드는 중… ${Math.round(el)} / ${total}초`; requestAnimationFrame(tick); };
    tick();
  });
  rec.stop(); await done;
  V.blob=new Blob(chunks,{type:mime.split(';')[0]}); const url=URL.createObjectURL(V.blob); const vid=$('#mvVideo'); vid.src=url; $('#mvVideoWrap').hidden=false; vid.play().catch(()=>{});
  $('#mvMsg').textContent=`완성 — ${V.ext.toUpperCase()} ${(V.blob.size/1048576).toFixed(1)}MB`+(V.ext==='webm'?' (이 브라우저는 mp4 저장을 지원하지 않아 webm으로 저장됩니다)':'');
  V.busy=false; $('#mvRec').disabled=false; if(window.S&&S.stats) S.stats.gen++,window.dsHit&&dsHit('gen');
}
function init(){
  if($('#mvGo')._on) return; $('#mvGo')._on=1;
  $('#mvSize').innerHTML=Object.entries(SIZES).map(([k,[,,l]])=>`<option value="${k}">${l}</option>`).join('');
  $('#mvTheme').innerHTML=Object.entries(THEMES).map(([k,[l]])=>`<option value="${k}">${l}</option>`).join('');
  $('#mvGo').onclick=make; $('#mvAgain').onclick=make; $('#mvRec').onclick=record;
  ['mvSize','mvTheme','mvBg'].forEach(id=>$('#'+id).onchange=()=>{ if(V.data) preview(0); $('#mvPhotoWrap').hidden=$('#mvBg').value!=='custom'; });
  $('#mvFile').onchange=async e=>{ const f=e.target.files[0]; if(!f) return; $('#mvMsg').textContent='문서 읽는 중…'; try{ $('#mvSrc').value=await readFile(f); $('#mvMsg').textContent=`「${f.name}」 내용을 읽었습니다 — 「대본 만들기」를 누르세요.`; }catch(err){ $('#mvMsg').textContent='⚠ '+err.message; } e.target.value=''; };
  $('#mvPhotos').onchange=async e=>{ V.photos=[]; for(const f of [...e.target.files].slice(0,8)) V.photos.push(await loadImg(URL.createObjectURL(f))); V.photos=V.photos.filter(Boolean); $('#mvPhotoMsg').textContent=`${V.photos.length}장 — 장면마다 번갈아 씁니다`; if(V.data) preview(0); };
  $('#mvDl').onclick=()=>{ if(!V.blob) return; const a=document.createElement('a'); a.href=URL.createObjectURL(V.blob); a.download=`달성군_홍보영상_${(V.data.title||'영상').replace(/[\\/:*?"<>|]/g,'').slice(0,20)}.${V.ext}`; a.click(); };
  $('#mvCopy').onclick=()=>{ navigator.clipboard.writeText($('#mvCaption').value); toast?.('게시글 문구를 복사했습니다'); };
  $('#mvSample').onclick=()=>{ $('#mvLen').value='30'; $('#mvContact').value='문의 정보통신과 053)668-2454';
    $('#mvSrc').value='2026년 하반기 주민 정보화교육 운영 계획\n1. 목적: 디지털 취약계층(고령층)의 정보 격차 해소 및 생활 밀착형 디지털 역량 강화\n2. 기간: 2026. 11. 17. ~ 12. 19. (8주, 과정별 주 2회 2시간)\n3. 장소: 군청 정보화교육장, 읍·면 주민자치센터(순회)\n4. 대상: 달성군민 누구나, 과정별 20명 총 120명, 수강료 무료\n5. 과정: ① 스마트폰 활용(사진·카카오톡·모바일 신분증) ② 키오스크 실습(무인주문·민원발급) ③ 생성형 AI 기초(검색·문서 작성)\n6. 신청: 11. 14.까지 읍·면 행정복지센터 방문 또는 전화\n7. 기대효과: 어르신의 일상 디지털 서비스 이용 불편 해소, 교육 수료자 만족도 90% 이상 목표';
    toast?.('예시를 채웠습니다 — 「대본 만들기」를 눌러보세요'); };
  $('#mvReset').onclick=()=>{ ['mvSrc','mvContact'].forEach(id=>$('#'+id).value=''); V.data=null; V.blob=null; $('#mvOut').hidden=true; $('#mvMsg').textContent=''; };
}
window.MOVIE={init};
})();
