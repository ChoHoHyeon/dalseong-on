/* ============================================================
   달성On — 공문 초안 작성하기 (draft.js)
   · 요지만 적으면 「행정업무의 운영 및 혁신에 관한 규정」 시행규칙의 문서 작성 기준(항목 기호 1. 가. 1) 가), 끝. 표시,
     붙임 표기, 날짜·시간 표기)에 맞춘 시행문 초안을 만든다.
   · 모델 연결 시 달성On이 본문을 작성하고, 없으면 오프라인 시연 모드로 틀만 채운다.
   · 결과는 화면 미리보기 → 복사 / 달성군 서식 한글(hwpx) 파일.
   ============================================================ */
(function(){
"use strict";
const $=s=>document.querySelector(s);
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const D={busy:false,out:null};
const LS='dsOn.draft.head';

const KINDS={
  notice:['안내','~을(를) 다음과 같이 안내하오니 ~하여 주시기 바랍니다.'],
  coop:['협조 요청','~을(를) 위하여 다음 사항에 협조하여 주시기 바랍니다.'],
  submit:['제출 요청','~을(를) 작성하여 기한 내 제출하여 주시기 바랍니다.'],
  report:['보고·통보','~을(를) 다음과 같이 보고(통보)합니다.'],
  reply:['회신','귀 기관(부서)에서 요청하신 ~에 대하여 다음과 같이 회신합니다.'],
  plan:['계획 알림','~ 추진계획을 다음과 같이 알려드리니 업무에 참고하시기 바랍니다.'],
  internal:['내부결재(품의)','~을(를) 다음과 같이 추진하고자 합니다.']
};

const RULE=`[공문 작성 기준 — 「행정 효율과 협업 촉진에 관한 규정 시행규칙」 제2조·별표 및 달성군 관행]
· 구성: 1. 관련(근거 공문·규정이 있으면) → 2. 목적·배경 한 문장 → 3. 주요 내용(세부는 하위 항목) → 4. 요청·협조 사항(기한·제출처·담당자) → 붙임 → "끝."
· 항목 기호는 1. → 가. → 1) → 가) → (1) → (가) 순서로 쓰고, 하위 항목은 상위 항목 첫 글자에서 2타(공백 두 칸) 들여쓴다.
· 첫째 항목이 하나뿐이면 번호 없이 문장으로만 쓴다. 항목이 둘 이상일 때만 번호를 붙인다.
· 문장은 "~하여 주시기 바랍니다." "~합니다." "~임." 처럼 공문 어투로 쓰고, 한 항목은 두 줄을 넘기지 않는다.
· 날짜는 "2026. 11. 9." (연·월·일 뒤에 마침표, 한 칸 띄움), 시간은 "14:00", 기간은 "2026. 11. 9. ~ 11. 13." 으로 쓴다.
· 금액은 "1,200천원" 또는 "12,000,000원", 숫자는 아라비아 숫자. 법령·공문 제목은 「 」로 감싼다.
· 붙임이 있으면 본문 끝 다음 줄에 "붙임  1. ○○○ 1부." 형식, 여러 개면 번호를 매기고 마지막 항목 뒤에 두 칸 띄우고 "끝." 을 붙인다. 붙임이 없으면 본문 마지막 글자 뒤에 두 칸 띄우고 "끝." 을 붙인다.
· 홍보성 수식어·추측·개인정보는 쓰지 않는다. 모르는 날짜·장소·수치는 "○○"로 비워 둔다(지어내지 않는다).`;

function sys(){
  return `당신은 대구광역시 달성군의 행정문서 담당자입니다. 아래 기준을 그대로 따라 시행문(공문) 초안을 작성합니다.
${RULE}

반드시 아래 형식으로만 출력합니다. 설명·마크다운·따옴표는 쓰지 않습니다.
제목: (한 줄. "○○ 안내" "○○ 협조 요청" "○○ 제출" 식으로 명사형)
수신: (입력된 수신자. 없으면 "수신자 참조")
본문:
(여기에 본문. 항목 기호와 들여쓰기 포함. 마지막에 "끝." 또는 붙임 뒤 "끝.")`;
}

function head(){
  const v=id=>($('#'+id).value||'').trim();
  const d=v('dfDate')||new Date().toISOString().slice(0,10); const dt=new Date(d+'T00:00:00');
  return {date:`${dt.getFullYear()}. ${dt.getMonth()+1}. ${dt.getDate()}.`, dept:v('dfDept')||'정보통신과', pic:v('dfPic')||'○○○', tel:v('dfTel')||'053)668-○○○○',
          to:v('dfTo')||'수신자 참조', via:v('dfVia'), sign:v('dfSign')||'달성군수', ref:v('dfRef'), att:v('dfAtt').split(/\r?\n/).map(x=>x.trim()).filter(Boolean)};
}
function saveHead(){ try{ const o={}; ['dfDept','dfPic','dfTel','dfSign'].forEach(id=>o[id]=$('#'+id).value); localStorage.setItem(LS,JSON.stringify(o)); }catch(e){} }
function loadHead(){ try{ const o=JSON.parse(localStorage.getItem(LS)||'{}'); Object.keys(o).forEach(id=>{ if($('#'+id)&&!$('#'+id).value) $('#'+id).value=o[id]; }); }catch(e){} }

/* 모델 응답(제목/수신/본문) 파싱 */
function parse(t){
  const o={title:'',to:'',body:[]}; let mode='';
  t.split(/\r?\n/).forEach(raw=>{
    const l=raw.replace(/\s+$/,'');
    if(/^\s*제목\s*[:：]/.test(l)){ o.title=l.replace(/^\s*제목\s*[:：]\s*/,'').trim(); return; }
    if(/^\s*수신\s*[:：]/.test(l)){ o.to=l.replace(/^\s*수신\s*[:：]\s*/,'').trim(); return; }
    if(/^\s*본문\s*[:：]?\s*$/.test(l)){ mode='b'; return; }
    if(mode==='b'||o.title) { if(l.trim()||o.body.length) o.body.push(l); }
  });
  while(o.body.length&&!o.body[o.body.length-1].trim()) o.body.pop();
  return o;
}

/* 오프라인 시연: 입력값으로 틀만 */
function offline(){
  const H=head(); const kind=$('#dfKind').value; const [kname,sent]=KINDS[kind]||KINDS.notice;
  const subj=($('#dfSubject').value||'').trim()||(($('#dfGist').value||'').split(/\r?\n/)[0]||'○○').replace(/[.。]$/,'').slice(0,40);
  const pts=($('#dfGist').value||'').split(/\r?\n/).map(x=>x.replace(/^[-·•\d.)\s]+/,'').trim()).filter(Boolean);
  const body=[]; let n=1;
  if(H.ref) body.push(`${n++}. 관련: ${H.ref}`);
  body.push(`${n++}. ${sent.replace('~',subj)}`);
  if(pts.length){ body.push(`${n++}. 주요 내용`); pts.slice(0,6).forEach((p,i)=>body.push(`  ${'가나다라마바'[i]}. ${p}`)); }
  if($('#dfDue').value) body.push(`${n++}. 제출(회신) 기한: ${$('#dfDue').value.replace(/-/g,'. ')}. 까지 (담당: ${H.dept} ${H.pic}, ☎ ${H.tel})`);
  const title={notice:`${subj} 안내`,coop:`${subj} 협조 요청`,submit:`${subj} 제출 요청`,report:`${subj} 결과 보고`,reply:`${subj} 회신`,plan:`${subj} 추진계획 알림`,internal:`${subj} 추진 계획`}[kind]||`${subj} 안내`;
  return {title,to:H.to,body};
}

function withEnd(o){
  const H=head(); const lines=o.body.slice();
  const hasEnd=lines.some(l=>/끝\.\s*$/.test(l)); const hasAtt=lines.some(l=>/^\s*붙임/.test(l));
  if(H.att.length&&!hasAtt){
    if(hasEnd){ const i=lines.findIndex(l=>/끝\.\s*$/.test(l)); lines[i]=lines[i].replace(/\s*끝\.\s*$/,''); }
    lines.push(''); H.att.forEach((a,i)=>lines.push(`${i?'      ':'붙임  '}${H.att.length>1?(i+1)+'. ':''}${a}${/부\.?$/.test(a)?'':' 1부.'}${i===H.att.length-1?'  끝.':''}`));
  }else if(!hasEnd&&lines.length){ lines[lines.length-1]=lines[lines.length-1].replace(/\s*$/,'')+'  끝.'; }
  return {...o,body:lines,to:o.to||H.to};
}

function render(o){
  const H=head();
  $('#draftView').innerHTML=`
    <div class="gm">
      <div class="gm-org">대 구 광 역 시  달 성 군</div>
      <div class="gm-meta"><span>수신  ${esc(o.to)}</span>${H.via?`<span>(경유)  ${esc(H.via)}</span>`:'<span>(경유)</span>'}</div>
      <div class="gm-title">제목  ${esc(o.title)}</div>
      <pre class="gm-body">${esc(o.body.join('\n'))}</pre>
      <div class="gm-sign">${esc(H.sign)}</div>
      <div class="gm-foot"><span>담당 ${esc(H.dept)} ${esc(H.pic)} ☎ ${esc(H.tel)}</span><span>시행일 ${esc(H.date)}</span></div>
    </div>`;
  $('#draftOut').hidden=false; $('#draftOut').scrollIntoView({behavior:'smooth',block:'start'});
}
function plain(o){ const H=head(); return `수신  ${o.to}\n(경유)${H.via?'  '+H.via:''}\n제목  ${o.title}\n\n${o.body.join('\n')}\n\n${H.sign}`; }

async function callModel(user){
  const S=window.S||{}; const payload=JSON.stringify({model:S.model||'claude-sonnet-4-5',max_tokens:1400,stream:true,system:sys(),messages:[{role:'user',content:user}]});
  const r=S.key
    ? await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'content-type':'application/json','x-api-key':S.key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},body:payload})
    : await fetch('/api/chat',{method:'POST',headers:{'content-type':'application/json','x-access-code':S.code||''},body:payload});
  if(!r.ok) throw new Error('모델 호출 실패 ('+r.status+')');
  const rd=r.body.getReader(), dec=new TextDecoder(); let buf='',text='';
  while(true){ const {value,done}=await rd.read(); if(done) break; buf+=dec.decode(value,{stream:true});
    const ls=buf.split('\n'); buf=ls.pop();
    for(const ln of ls){ if(!ln.startsWith('data:')) continue; try{ const j=JSON.parse(ln.slice(5)); if(j.type==='content_block_delta'&&j.delta?.text) text+=j.delta.text; }catch(e){} } }
  return text;
}

async function make(){
  if(D.busy) return;
  const gist=($('#dfGist').value||'').trim();
  if(!gist){ $('#dfMsg').textContent='보내려는 내용(요지)은 입력해 주세요.'; $('#dfGist').focus(); return; }
  D.busy=true; $('#dfGo').disabled=true; $('#dfMsg').textContent='작성 중…'; saveHead();
  try{
    const S=window.S||{}; const H=head(); const [kname]=KINDS[$('#dfKind').value]||KINDS.notice;
    if((S.key||S.server)&&!S.offline){
      const u=[`<작성 요청>`,`문서 유형: ${kname}`,`수신: ${H.to}`,H.via?`경유: ${H.via}`:'',`발신 명의: ${H.sign}`,`시행일: ${H.date}`,
        ($('#dfSubject').value||'').trim()?`제목(참고): ${$('#dfSubject').value.trim()}`:'제목: 요지에 맞게 명사형으로 작성',
        H.ref?`관련 근거: ${H.ref}`:'관련 근거: 없음(1. 관련 항목 생략)',
        $('#dfDue').value?`기한: ${$('#dfDue').value.replace(/-/g,'. ')}.`:'',
        `담당: ${H.dept} ${H.pic} (☎ ${H.tel})`,
        H.att.length?`붙임(본문 끝에 표기): ${H.att.join(' / ')}`:'붙임: 없음',
        `요지:\n${gist}`,`</작성 요청>`].filter(Boolean).join('\n');
      const text=await callModel(u); D.out=withEnd(parse(text));
      if(!D.out.title||!D.out.body.length) throw new Error('응답 형식을 읽지 못했습니다. 다시 생성해 주세요.');
      $('#dfMsg').textContent='작성 완료 — 사실관계·날짜·수신자를 확인하세요.';
    }else{
      await new Promise(r=>setTimeout(r,400)); D.out=withEnd(offline());
      $('#dfMsg').textContent='오프라인 시연 모드 — 모델 연결 시 본문을 공문 어투로 작성합니다.';
    }
    render(D.out); if(window.S&&S.stats) S.stats.gen++;
  }catch(err){ $('#dfMsg').textContent='⚠ '+err.message; }
  finally{ D.busy=false; $('#dfGo').disabled=false; }
}

async function hwpx(){
  if(!D.out) return; const H=head();
  try{
    const blob=await DalseongHwpx.build({kind:'gongmun', title:D.out.title, to:D.out.to, via:H.via, sign:H.sign, date:H.date, dept:H.dept, pic:H.pic, tel:H.tel, body:D.out.body, answer:D.out.body.join('\n')});
    const nm=`달성군_공문초안_${D.out.title.replace(/[\\/:*?"<>|]/g,'').slice(0,30)}_${new Date().toISOString().slice(0,10).replace(/-/g,'')}.hwpx`;
    DalseongHwpx.download(blob,nm); if(window.S&&S.stats) S.stats.hwpx++; if(window.toast) toast('한글 파일 생성: '+nm);
  }catch(e){ if(window.toast) toast('한글 파일 생성 실패: '+e.message); }
}

function init(){
  if($('#dfGo')._on) return; $('#dfGo')._on=1;
  loadHead(); if(!$('#dfDate').value) $('#dfDate').value=new Date().toISOString().slice(0,10);
  $('#dfKind').onchange=()=>{ const [,s]=KINDS[$('#dfKind').value]; $('#dfKindHint').textContent='예) '+s; }; $('#dfKind').onchange();
  $('#dfGo').onclick=make; $('#dfAgain').onclick=make;
  $('#dfCopy').onclick=()=>{ if(!D.out) return; navigator.clipboard.writeText(plain(D.out)); if(window.toast) toast('복사했습니다'); };
  $('#dfHwpx').onclick=hwpx;
  $('#dfSample').onclick=()=>{
    $('#dfKind').value='submit'; $('#dfKind').onchange();
    $('#dfTo').value='각 실·과·소·읍·면장'; $('#dfSubject').value='2026년 하반기 정보화교육 수요조사 제출';
    $('#dfRef').value='정보통신과-12345(2026. 10. 20.) 「2026년 주민 정보화교육 운영 계획」';
    $('#dfGist').value='하반기 정보화교육(스마트폰 활용·키오스크·AI 기초) 과목별 수요를 조사함\n대상: 부서 직원 및 읍면 주민자치센터 수강 희망자\n과목·희망 인원·희망 시기(11~12월)를 붙임 서식에 작성\n제출 기한 11. 14.(금)까지 정보통신과 조호현에게 온나라 문서로 제출\n문의는 668-2454';
    $('#dfDue').value='2026-11-14'; $('#dfAtt').value='2026년 하반기 정보화교육 수요조사서(서식) 1부';
    if(window.toast) toast('예시를 채웠습니다 — 「공문 초안 만들기」를 눌러보세요');
  };
  $('#dfReset').onclick=()=>{ ['dfTo','dfVia','dfSubject','dfRef','dfGist','dfDue','dfAtt'].forEach(id=>$('#'+id).value=''); $('#draftOut').hidden=true; $('#dfMsg').textContent=''; };
}
window.DRAFT={init};
})();
