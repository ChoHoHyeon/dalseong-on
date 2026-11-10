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
반드시 아래 JSON만 출력한다(설명 금지):
{"visual":"English concrete visual motifs","keywords":["핵심 키워드1","핵심 키워드2"],"art":"edu","slides":[{"kind":"cover","head":"제목","body":["부제"]},{"kind":"body","head":"소제목","body":["문장","문장"]},{"kind":"end","head":"마무리 문구","body":["문의 ○○과 053)668-○○○○"]}],"caption":"…","tags":["#달성군","#대구달성"]}`;

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
function wrap(ctx,text,maxW){ const out=[]; let line=''; for(const ch of String(text)){ const t=line+ch; if(ctx.measureText(t).width>maxW&&line){ out.push(line); line=ch; } else line=t; } if(line) out.push(line); return out; }
function font(ctx,w,s){ ctx.font=`${w} ${s}px Pretendard,"Malgun Gothic",sans-serif`; }
async function getArt(){
  const key=v('cnArt')||C.data?.art||'admin';
  if(key==='none') return null;
  if(key==='ai'){ if(C.art) return C.art; const k=C.data?.art||'admin'; if(!C.artCache[k]) C.artCache[k]=await loadImg(`assets/cn/cn_${k}.jpg`); return C.artCache[k]; }   // AI 그림 (그리는 동안은 테마 일러스트)
  if(!C.artCache[key]) C.artCache[key]=await loadImg(`assets/cn/cn_${key}.jpg`);
  return C.artCache[key];
}
async function drawSlide(canvas,s,i,total){
  const [W,H]=SIZES[v('cnSize')]||SIZES.sq; const [,grad,fg,acc]=THEMES[v('cnTheme')]||THEMES.navy;
  canvas.width=W; canvas.height=H; const ctx=canvas.getContext('2d'); const pad=W*0.085;
  const g=ctx.createLinearGradient(0,0,W,H); g.addColorStop(0,grad[0]); g.addColorStop(1,grad[1]);
  const art=await getArt(); const cover=(im,x,y,w,h)=>{ const r=Math.max(w/im.width,h/im.height); const iw=im.width*r, ih=im.height*r; ctx.save(); ctx.beginPath(); ctx.rect(x,y,w,h); ctx.clip(); ctx.drawImage(im,x+(w-iw)/2,y+(h-ih)/2,iw,ih); ctx.restore(); };
  if(s.kind==='body'){ ctx.fillStyle='#ffffff'; ctx.fillRect(0,0,W,H); ctx.fillStyle=g; ctx.fillRect(0,0,W,H*0.045);
    if(art){ const aw=W*0.46, ah=aw; ctx.save(); ctx.globalAlpha=.95; ctx.beginPath(); ctx.roundRect(W-aw-pad*0.6,H-ah-pad*1.6,aw,ah,W*0.03); ctx.clip(); ctx.drawImage(art,W-aw-pad*0.6,H-ah-pad*1.6,aw,ah); ctx.restore(); } }
  else if(art){ cover(art,0,0,W,H); const og=ctx.createLinearGradient(0,0,0,H); og.addColorStop(0,grad[0]+'f2'); og.addColorStop(0.45,grad[0]+'b8'); og.addColorStop(1,grad[1]+'33'); ctx.fillStyle=og; ctx.fillRect(0,0,W,H); }
  else { ctx.fillStyle=g; ctx.fillRect(0,0,W,H); ctx.fillStyle='rgba(255,255,255,.08)'; ctx.beginPath(); ctx.arc(W*0.85,H*0.2,W*0.35,0,7); ctx.fill(); }
  const dark = s.kind==='body'; const tx = dark?'#1c2333':fg; const sub = dark?'#4b5563':'rgba(255,255,255,.88)';
  ctx.textBaseline='top'; ctx.textAlign='left';
  // 상단 라벨
  font(ctx,'700',Math.round(W*0.03)); ctx.fillStyle=dark?grad[0]:acc; ctx.fillText(s.kind==='cover'?'달성군 소식':s.kind==='end'?'함께해요 달성':`${i}/${total-1}`, pad, pad*0.9);
  let y;
  if(s.kind==='cover'){
    const hs=Math.round(W*0.11); font(ctx,'800',hs); ctx.fillStyle=tx; const hl=wrap(ctx,s.head,W-pad*2); y=Math.max(pad*0.9+W*0.03*2.2,(art?H*0.22:H*0.36)-hl.length*hs*0.6);   // 두 줄 제목이 위 라벨과 겹치지 않게 hl.forEach(l=>{ ctx.fillText(l,pad,y); y+=hs*1.18; });
    ctx.fillStyle=acc; ctx.fillRect(pad,y+hs*0.2,W*0.12,H*0.008); y+=hs*0.6;
    font(ctx,'500',Math.round(W*0.045)); ctx.fillStyle=sub; (s.body||[]).forEach(b=>wrap(ctx,b,W-pad*2).forEach(l=>{ ctx.fillText(l,pad,y); y+=W*0.065; }));
  }else{
    const hs=Math.round(W*(s.kind==='end'?0.075:0.07)); font(ctx,'800',hs); ctx.fillStyle=tx; y=H*0.2; wrap(ctx,s.head,W-pad*2).forEach(l=>{ ctx.fillText(l,pad,y); y+=hs*1.2; });
    ctx.fillStyle=dark?grad[1]:acc; ctx.fillRect(pad,y+hs*0.15,W*0.09,H*0.006); y+=hs*0.7;
    const bs=Math.round(W*0.046); font(ctx,'500',bs); ctx.fillStyle=dark?'#2b3445':sub;
    (s.body||[]).forEach(b=>{ const ls=wrap(ctx,b,W-pad*2-W*0.05); ctx.fillStyle=dark?grad[0]:acc; ctx.fillRect(pad,y+bs*0.42,W*0.012,W*0.012); ctx.fillStyle=dark?'#2b3445':sub; ls.forEach(l=>{ ctx.fillText(l,pad+W*0.04,y); y+=bs*1.5; }); y+=bs*0.5; });
  }
  // 하단 CI
  const logo=C.logo||(C.logo=await loadImg('assets/dalseong_ci.png'));
  if(logo){ const lh=H*0.05, lw=logo.width*lh/logo.height; if(!dark){ ctx.fillStyle='rgba(255,255,255,.95)'; ctx.beginPath(); ctx.roundRect(pad-lh*0.25,H-pad-lh-lh*0.2,lw+lh*0.5,lh+lh*0.4,lh*0.2); ctx.fill(); } ctx.drawImage(logo,pad,H-pad-lh,lw,lh); }
  if(s.kind!=='cover'){ ctx.textAlign='right'; font(ctx,'600',Math.round(W*0.028)); ctx.fillStyle=dark?'#9aa3b2':'rgba(255,255,255,.7)'; ctx.fillText('대구광역시 달성군',W-pad,H-pad-W*0.03); }
}
async function renderAll(){
  const d=C.data; const wrapEl=$('#cnSlides'); wrapEl.innerHTML='';
  for(let i=0;i<d.slides.length;i++){ const c=document.createElement('canvas'); c.className='cn-thumb'+(i===C.cur?' on':''); c.title=`${i+1}장`; c.onclick=()=>{ C.cur=i; renderAll(); }; wrapEl.appendChild(c); await drawSlide(c,d.slides[i],i,d.slides.length); }
  await drawSlide($('#cnMain'),d.slides[C.cur],C.cur,d.slides.length);
  const s=d.slides[C.cur]; $('#cnEditHead').value=s.head; $('#cnEditBody').value=(s.body||[]).join('\n'); $('#cnCurNo').textContent=`${C.cur+1} / ${d.slides.length}장`;
  $('#cnCaption').value=`${d.caption||''}\n\n${(d.tags||[]).join(' ')}`;
  $('#cnOut').hidden=false;
}
async function make(){
  if(C.busy) return; if(!v('cnSrc')){ $('#cnMsg').textContent='알릴 내용(보도자료·공고문)을 붙여넣어 주세요.'; return $('#cnSrc').focus(); }
  C.busy=true; $('#cnGo').disabled=true; $('#cnMsg').textContent='작성 중…';
  try{
    const S=window.S||{};
    if((S.key||S.server)&&!S.offline){ C.data=await callModel(`장수: ${v('cnCount')||6}장(표지·마무리 포함)\n제목(참고): ${v('cnTitle')||'원문에서 뽑기'}\n문의처: ${v('cnContact')||'원문에 있으면 사용, 없으면 ○○'}\n원문:\n${v('cnSrc')}`); $('#cnMsg').textContent='카드 문구를 만들었습니다 — AI가 그림을 그리는 동안 카드를 넘겨 보세요.'; }
    else { await new Promise(r=>setTimeout(r,300)); C.data=offline(); $('#cnMsg').textContent='오프라인 모드 — 모델 연결 시 원문을 읽어 장별 문구를 씁니다.'; }
    C.cur=0; C.art=null; $('#cnArt').value='ai'; await renderAll(); if(S.key||S.server) aiArt(false); window.dsSave&&dsSave('card',C.data.slides[0]?.head||'카드뉴스',C.data.slides.map((x,i)=>`[${i+1}장] ${x.head}\n${(x.body||[]).join('\n')}`).join('\n\n')+'\n\n'+(C.data.caption||'')+'\n'+(C.data.tags||[]).join(' ')); $('#cnOut').scrollIntoView({behavior:'smooth',block:'start'}); if(window.S&&S.stats) S.stats.gen++,window.dsHit&&dsHit('gen');
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
  C.aiBusy=true; cnLoad(); const btn=$('#cnAi'); if(btn) btn.disabled=true;
  try{
    const r=await fetch('/api/card',{method:'POST',headers:{'content-type':'application/json','x-access-code':code},body:JSON.stringify({action:'start',prompt,size,expect:[]})});
    const j=await r.json(); if(!r.ok||!j.id) throw new Error(j.error||'접수 실패');
    let job=null; const t0=Date.now(); while(Date.now()-t0<180000){ await new Promise(res=>setTimeout(res,1500)); job=await (await fetch('/api/card?id='+j.id,{headers:{'x-access-code':code}})).json(); if(job.status==='done'||job.status==='error') break; }
    if(!job||job.status!=='done') throw new Error(job?.error||'시간 초과');
    const im=await loadImg(job.image); if(!im) throw new Error('그림을 열지 못했습니다'); if(C.data!==d) return;
    C.art=im; C.aiBusy=false; cnLoad(false); if(v('cnArt')==='ai') await renderAll();
    const mg=$('#cnMsg'); if(/그리는 동안/.test(mg.textContent)) mg.textContent='그림이 완성됐습니다 — 장을 눌러 문구를 고칠 수 있습니다.';
  }catch(e){ C.aiBusy=false; cnLoad('⚠️ AI 그림을 만들지 못했습니다 — '+String(e.message||'').slice(0,60)+' · 기본 그림으로 계속됩니다'); }
  finally{ C.aiBusy=false; if(btn) btn.disabled=false; }
}
function dl(canvas,name){ const a=document.createElement('a'); a.download=name; a.href=canvas.toDataURL('image/png'); a.click(); }
function init(){
  if($('#cnGo')._on) return; $('#cnGo')._on=1;
  $('#cnSize').innerHTML=Object.entries(SIZES).map(([k,[,,l]])=>`<option value="${k}">${l}</option>`).join('');
  $('#cnTheme').innerHTML=Object.entries(THEMES).map(([k,[l]])=>`<option value="${k}">${l}</option>`).join('');
  $('#cnArt').innerHTML='<option value="ai">🎨 AI 그림 (추천)</option><optgroup label="기본 그림">'+Object.entries(ART).map(([k,l])=>`<option value="${k}">${l}</option>`).join('')+'</optgroup><option value="none">그림 없이</option>';
  $('#cnArt').onchange=()=>{ if(C.data){ renderAll(); if(v('cnArt')==='ai'&&!C.art&&!C.aiBusy) aiArt(false); } };
  $('#cnAi').onclick=()=>aiArt(true);
  /* 파일 추가: 보도자료와 같은 읽기(pressRead · app.js)로 글을 뽑아 「알릴 내용」에 채운다 (여러 번·여러 개 가능) */
  $('#cnFile').onchange=async e=>{ const fs=[...e.target.files]; e.target.value=''; const L=$('#cnFileList'); const done=[];
    for(const f of fs){ L.textContent=`「${f.name}」 읽는 중…`;
      try{ if(typeof window.pressRead!=='function') throw new Error('읽기 기능을 불러오지 못했습니다'); const r=await window.pressRead(f); if(!r.text) throw new Error('글자를 찾지 못했습니다(그림 파일은 내용으로 쓰지 않습니다)');
        const t=r.text.replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim().slice(0,8000); const src=$('#cnSrc');
        src.value=src.value.trim()?src.value.trim()+`\n\n[${f.name}]\n`+t:t;
        if(!v('cnTitle')){ const first=t.split('\n').map(x=>x.replace(/^[◎○□▸\-\s]+/,'').trim()).find(x=>x.length>=4); if(first) $('#cnTitle').value=first.slice(0,40); }
        done.push(`📄 ${f.name} (${t.length.toLocaleString()}자)`); }
      catch(err){ done.push(`⚠ ${f.name} — ${err.message}`); } }
    L.textContent=done.join(' · ')+' — 아래 「카드뉴스 만들기」를 누르세요'; };
  $('#cnGo').onclick=make; $('#cnAgain').onclick=make;
  ['cnSize','cnTheme'].forEach(id=>$('#'+id).onchange=()=>{ if(C.data) renderAll(); });
  $('#cnSize').addEventListener('change',()=>{ if(C.data&&v('cnArt')==='ai'&&C.art){ C.art=null; aiArt(false); } });   // 비율이 바뀌면 그 비율로 다시 그린다
  $('#cnApply').onclick=()=>{ if(!C.data) return; const s=C.data.slides[C.cur]; s.head=v('cnEditHead'); s.body=$('#cnEditBody').value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean); renderAll(); };
  $('#cnPrev').onclick=()=>{ if(C.data){ C.cur=(C.cur-1+C.data.slides.length)%C.data.slides.length; renderAll(); } };
  $('#cnNext').onclick=()=>{ if(C.data){ C.cur=(C.cur+1)%C.data.slides.length; renderAll(); } };
  $('#cnPng').onclick=()=>{ if(C.data) dl($('#cnMain'),`카드뉴스_${C.cur+1}.png`); };
  $('#cnAll').onclick=async()=>{ if(!C.data) return; const t=document.createElement('canvas'); for(let i=0;i<C.data.slides.length;i++){ await drawSlide(t,C.data.slides[i],i,C.data.slides.length); dl(t,`카드뉴스_${String(i+1).padStart(2,'0')}.png`); await new Promise(r=>setTimeout(r,350)); } toast?.(`${C.data.slides.length}장을 내려받았습니다`); };
  $('#cnCopy').onclick=()=>{ navigator.clipboard.writeText($('#cnCaption').value); toast?.('게시글 문구를 복사했습니다'); };
  $('#cnSample').onclick=()=>{ $('#cnTitle').value='하반기 정보화교육 수강생 모집'; $('#cnCount').value='6'; $('#cnContact').value='문의 정보통신과 053)668-2454';
    $('#cnSrc').value='달성군은 디지털 취약계층의 정보 격차 해소를 위해 2026년 하반기 주민 정보화교육 수강생을 모집한다.\n교육은 11월 17일부터 12월 19일까지 8주간 군청 정보화교육장과 읍·면 주민자치센터에서 운영된다.\n과정은 스마트폰 활용(사진·카카오톡·모바일 신분증), 키오스크 실습(무인주문·민원발급), 생성형 AI 기초(검색·문서 작성) 3개로, 과정별 주 2회 2시간씩 진행된다.\n모집 인원은 과정별 20명, 총 120명이며 달성군민이면 누구나 신청할 수 있다. 수강료는 무료다.\n신청은 11월 14일까지 읍·면 행정복지센터 방문 또는 전화로 하면 된다.\n군 관계자는 "어르신도 키오스크와 스마트폰을 어렵지 않게 쓸 수 있도록 실습 위주로 운영하겠다"고 말했다.';
    toast?.('예시를 채웠습니다 — 「카드뉴스 만들기」를 눌러보세요'); };
  $('#cnReset').onclick=()=>{ ['cnTitle','cnContact','cnSrc'].forEach(id=>$('#'+id).value=''); $('#cnFileList').textContent='파일을 올리면 내용을 읽어 위 칸에 채웁니다 (한글 hwpx·워드·PDF·텍스트) · 직접 붙여넣어도 됩니다'; C.data=null; C.art=null; cnLoad(false); $('#cnOut').hidden=true; $('#cnMsg').textContent=''; };
}
window.CARDNEWS={init};
})();
