/* ============================================================
   달성On — 홍보 현수막 제작하기 (banner.js)
   · 행사명·기간·장소만 넣으면 현수막 문구 3안(메인+서브)을 만들고, 규격 비율 그대로 시안을 그려 보여 준다.
   · 배경은 군 보유 사진(assets/hero.jpg)·단색·내 사진. 군 CI(assets/dalseong_ci.png)는 원본 그대로 비율만 맞춰 올린다.
   · 결과 : 시안 PNG(가로 2400px) + 업체 전달용 사양(문구·규격·수량·배경·연락처) 복사
   · 현수막은 결국 업체가 제작하므로 "문구 확정 + 시안 + 사양서"까지가 이 화면의 역할이다.
   ============================================================ */
(function(){
"use strict";
const $=s=>document.querySelector(s);
const B={busy:false,alts:[],pick:0,img:null,custom:null,logo:null};
const SIZES={ '5x0.9':[5,0.9,'표준 가로 5m×0.9m(지정게시대)'], '6x0.9':[6,0.9,'가로 6m×0.9m'], '4x0.7':[4,0.7,'가로 4m×0.7m(소형)'], '0.9x3':[0.9,3,'세로 0.9m×3m(건물 부착)'] };
const BGS={ photo:['군 보유 사진(비슬산)',null], navy:['남색','#0b2a6b'], green:['진녹색','#145a32'], orange:['주황','#d35400'], white:['흰 바탕(남색 글자)','#ffffff'], custom:['내 사진 올리기',null] };
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
function fit(ctx,text,maxW,start,min,weight){ let s=start; for(;s>=min;s-=4){ ctx.font=`${weight} ${s}px Pretendard,"Malgun Gothic",sans-serif`; if(ctx.measureText(text).width<=maxW) break; } return s; }
async function draw(){
  const [W0,H0]=SIZES[v('bnSize')]||SIZES['5x0.9']; const vert=H0>W0;
  const W=vert?900:2400, H=Math.round(W*H0/W0);
  const c=$('#bnCanvas'); c.width=W; c.height=H; const ctx=c.getContext('2d');
  const bg=v('bnBg'); const [,col]=BGS[bg]||BGS.navy;
  const img = bg==='photo' ? (B.img||(B.img=await loadImg('assets/hero.jpg'))) : bg==='custom' ? B.custom : null;
  if(img){ const r=Math.max(W/img.width,H/img.height); const w=img.width*r,h=img.height*r; ctx.drawImage(img,(W-w)/2,(H-h)/2,w,h); ctx.fillStyle='rgba(8,20,60,.52)'; ctx.fillRect(0,0,W,H); }
  else { ctx.fillStyle=col||'#0b2a6b'; ctx.fillRect(0,0,W,H); }
  const light = bg==='white'; const fg = light?'#0b2a6b':'#ffffff';
  // 왼쪽 띠(포인트)
  ctx.fillStyle = light?'#0b2a6b':'rgba(255,255,255,.9)'; ctx.fillRect(0,0,vert?W:18,vert?18:H);
  const a=B.alts[B.pick]||{main:v('bnName')||'행사명',sub:''};
  ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillStyle=fg;
  if(!vert){
    const mainS=fit(ctx,a.main,W*0.78,Math.round(H*0.42),Math.round(H*0.2),'800'); ctx.fillText(a.main,W/2,H*0.42);
    if(a.sub){ fit(ctx,a.sub,W*0.8,Math.round(H*0.15),Math.round(H*0.08),'500'); ctx.globalAlpha=.92; ctx.fillText(a.sub,W/2,H*0.42+mainS*0.62+H*0.09); ctx.globalAlpha=1; }
    // 주최 (좌하) · CI (우하)
    ctx.textAlign='left'; ctx.font=`600 ${Math.round(H*0.075)}px Pretendard,"Malgun Gothic",sans-serif`; ctx.fillText((v('bnHost')||'달성군'), W*0.03, H*0.9);
    const logo=B.logo||(B.logo=await loadImg('assets/dalseong_ci.png'));
    if(logo){ const lh=H*0.2, lw=logo.width*lh/logo.height; if(light){ ctx.drawImage(logo,W-lw-W*0.025,H-lh-H*0.1,lw,lh); } else { ctx.fillStyle='rgba(255,255,255,.95)'; roundRect(ctx,W-lw-W*0.025-lh*0.25,H-lh-H*0.1-lh*0.2,lw+lh*0.5,lh+lh*0.4,lh*0.2); ctx.fill(); ctx.drawImage(logo,W-lw-W*0.025,H-lh-H*0.1,lw,lh); } }
  }else{
    // 세로형: 글자를 한 줄씩 세로로
    const lines=a.main.split(/\s+/); let y=H*0.14; const s=fit(ctx,lines.reduce((p,q)=>p.length>q.length?p:q,''),W*0.8,Math.round(W*0.22),Math.round(W*0.1),'800');
    lines.forEach(l=>{ ctx.fillText(l,W/2,y); y+=s*1.25; });
    if(a.sub){ const ss=fit(ctx,a.sub,W*0.86,Math.round(W*0.075),Math.round(W*0.045),'500'); y+=ss; const parts=a.sub.split(/\s·\s|\s+/); parts.forEach(pt=>{ ctx.fillText(pt,W/2,y); y+=ss*1.35; }); }
    ctx.font=`600 ${Math.round(W*0.06)}px Pretendard,"Malgun Gothic",sans-serif`; ctx.fillText((v('bnHost')||'달성군'),W/2,H*0.9);
    const logo=B.logo||(B.logo=await loadImg('assets/dalseong_ci.png'));
    if(logo){ const lw=W*0.5, lh=logo.height*lw/logo.width; ctx.fillStyle='rgba(255,255,255,.95)'; roundRect(ctx,(W-lw)/2-lh*0.25,H*0.94-lh,lw+lh*0.5,lh+lh*0.3,lh*0.2); ctx.fill(); ctx.drawImage(logo,(W-lw)/2,H*0.94-lh+lh*0.15,lw,lh); }
  }
  $('#bnOut').hidden=false;
}
function roundRect(ctx,x,y,w,h,r){ ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }
function renderAlts(){
  $('#bnAlts').innerHTML=B.alts.map((a,i)=>`<button class="alt${i===B.pick?' on':''}" data-i="${i}"><b>${a.main}</b><span>${a.sub||''}</span><small>${a.why||''}</small></button>`).join('');
  $('#bnAlts').querySelectorAll('.alt').forEach(b=>b.onclick=()=>{ B.pick=+b.dataset.i; renderAlts(); draw(); });
}
function spec(){
  const a=B.alts[B.pick]||{}; const [w,h,label]=SIZES[v('bnSize')]||SIZES['5x0.9']; const [bgl]=BGS[v('bnBg')]||BGS.navy;
  return `[현수막 제작 의뢰]\n· 행사명 : ${v('bnName')}\n· 메인 문구 : ${a.main||''}\n· 서브 문구 : ${a.sub||''}\n· 주최·주관 : ${v('bnHost')||'달성군'}\n· 규격 : ${label} (${w}m × ${h}m)\n· 수량 : ${v('bnQty')||'○'}장\n· 배경 : ${bgl}${v('bnBg')==='custom'?' (첨부 사진)':''} / 글자 ${v('bnBg')==='white'?'남색':'흰색'} 고딕 굵게\n· 군 CI : 우측 하단(원본 사용, 변형 금지)\n· 게시 기간·장소 : ${v('bnWhen')||'○○'} / ${v('bnPlace')||'○○'}\n· 납품 희망일 : ○○\n· 담당 : ${v('bnPic')||'○○과 ○○○ ☎ 053)668-○○○○'}\n※ 시안 PNG 첨부. 지정게시대 게시는 「달성군 옥외광고물 관리 조례」에 따라 별도 신청.`;
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
    B.pick=0; renderAlts(); await draw(); window.dsSave&&dsSave('banner',v('bnName'),B.alts.map((a,i)=>`${i+1}안) ${a.main} / ${a.sub||''}`).join('\n')+'\n\n'+spec()); $('#bnOut').scrollIntoView({behavior:'smooth',block:'start'}); if(window.S&&S.stats) S.stats.gen++,window.dsHit&&dsHit('gen');
  }catch(e){ $('#bnMsg').textContent='⚠ '+e.message; }
  finally{ B.busy=false; $('#bnGo').disabled=false; }
}
function init(){
  if($('#bnGo')._on) return; $('#bnGo')._on=1;
  $('#bnSize').innerHTML=Object.entries(SIZES).map(([k,[,,l]])=>`<option value="${k}">${l}</option>`).join('');
  $('#bnBg').innerHTML=Object.entries(BGS).map(([k,[l]])=>`<option value="${k}">${l}</option>`).join('');
  $('#bnGo').onclick=make; $('#bnAgain').onclick=make;
  ['bnSize','bnBg','bnHost'].forEach(id=>$('#'+id).onchange=()=>{ if(B.alts.length) draw(); });
  $('#bnBg').addEventListener('change',()=>{ $('#bnFileWrap').hidden=$('#bnBg').value!=='custom'; });
  $('#bnFile').onchange=async e=>{ const f=e.target.files[0]; if(!f) return; B.custom=await loadImg(URL.createObjectURL(f)); if(B.alts.length) draw(); };
  $('#bnEdit').onclick=()=>{ const a=B.alts[B.pick]; if(!a) return; const m=prompt('메인 문구',a.main); if(m===null) return; const s=prompt('서브 문구',a.sub||''); a.main=m; a.sub=s??a.sub; renderAlts(); draw(); };
  $('#bnPng').onclick=()=>{ const a=document.createElement('a'); a.download=`현수막시안_${v('bnName').replace(/[\\/:*?"<>|]/g,'').slice(0,20)}.png`; a.href=$('#bnCanvas').toDataURL('image/png'); a.click(); };
  $('#bnSpec').onclick=()=>{ navigator.clipboard.writeText(spec()); toast?.('업체 전달용 사양을 복사했습니다'); };
  $('#bnSample').onclick=()=>{ $('#bnName').value='2026 비슬산 참꽃문화제'; $('#bnWhen').value='2026. 4. 18.(토) ~ 4. 26.(일)'; $('#bnPlace').value='비슬산 자연휴양림 일원'; $('#bnHost').value='달성군 · 달성문화재단'; $('#bnPoint').value='30년 만의 참꽃 만개, 가족 나들이'; $('#bnTone').value='친근'; $('#bnQty').value='20'; toast?.('예시를 채웠습니다 — 「문구·시안 만들기」를 눌러보세요'); };
  $('#bnReset').onclick=()=>{ ['bnName','bnWhen','bnPlace','bnHost','bnPoint','bnQty','bnPic'].forEach(id=>$('#'+id).value=''); B.alts=[]; $('#bnOut').hidden=true; $('#bnMsg').textContent=''; };
}
window.BANNER={init};
})();
