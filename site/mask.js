/* ============================================================
   달성On — 개인정보 가리기 (mask.js)
   · 엑셀(xlsx·xls)·csv를 올리면 브라우저 안에서만 읽어 열마다 개인정보 종류를 찾아내고,
     규칙대로 가린 파일을 다시 내려받게 한다. 외부(AI 모델 포함)로는 아무것도 보내지 않는다.
   · 열 판단 = 열 이름 힌트 + 값 패턴. 열마다 처리(가리기/그대로/열 삭제)를 직접 바꿀 수 있다.
   · 가림 규칙(개인정보 비식별 조치 가이드라인의 부분삭제·마스킹 방식)
       이름 홍*동 · 주민번호 900101-1****** · 휴대폰 010-****-5678 · 일반전화 053-***-4567
       이메일 ab***@도메인 · 계좌 ********1234 · 주소 읍·면·동(도로명)까지 · 차량 12가**** · 생년월일 1990-**-**
   ============================================================ */
(function(){
"use strict";
const $=s=>document.querySelector(s);
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const M={rows:[],cols:[],name:'',ext:'xlsx',plan:[],out:null};

const TYPES={
  name:  ['이름','👤'], rrn:['주민번호','🪪'], phone:['전화번호','📞'], email:['이메일','✉️'],
  acct:  ['계좌번호','🏦'], addr:['주소','🏠'], car:['차량번호','🚗'], birth:['생년월일','🎂'], text:['글 속 개인정보','📝'], none:['해당 없음','—']
};
const HINT=[
  ['rrn',/주민|resident|rrn/i], ['phone',/전화|연락처|휴대|핸드폰|폰|tel|phone|mobile/i], ['email',/메일|email|e-mail/i],
  ['acct',/계좌|account/i], ['addr',/주소|거주지|소재지|address/i], ['car',/차량|차번|car/i],
  ['birth',/생년|생일|birth/i], ['name',/성명|이름|민원인|신청인|대표자|담당자|name/i]
];
const RE={
  rrn:/(\d{6})\s?-?\s?([1-8])\d{6}/g,
  mobile:/(01[016789])[-.\s]?(\d{3,4})[-.\s]?(\d{4})/g,
  tel:/(0(?:2|[3-6][1-5]|70))[-.\s)]?(\d{3,4})[-.\s]?(\d{4})/g,
  email:/([A-Za-z0-9._%+-]{1,2})[A-Za-z0-9._%+-]*@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g,
  car:/(\d{2,3})\s?([가-힣])\s?(\d{4})/g
};
const isName=v=>/^[가-힣]{2,4}$/.test(String(v).trim());

/* ── 가리기 함수 ── */
function mName(v){ const s=String(v).trim(); if(!s) return s; if(s.length<=2) return s[0]+'*'; return s[0]+'*'.repeat(s.length-2)+s[s.length-1]; }
function mRrn(v){ return String(v).replace(RE.rrn,(_,a,b)=>`${a}-${b}******`); }
function mPhone(v){ return String(v).replace(RE.mobile,(_,a,b,c)=>`${a}-${'*'.repeat(b.length)}-${c}`).replace(RE.tel,(_,a,b,c)=>`${a}-${'*'.repeat(b.length)}-${c}`); }
function mEmail(v){ return String(v).replace(RE.email,(_,a,d)=>`${a}***@${d}`); }
function mAcct(v){ const s=String(v).trim(); const d=s.replace(/\D/g,''); if(d.length<6) return s; return '*'.repeat(Math.max(4,d.length-4))+d.slice(-4); }
function mCar(v){ return String(v).replace(RE.car,(_,a,b)=>`${a}${b}****`); }
function mBirth(v){ const s=String(v instanceof Date?v.toISOString().slice(0,10):v).trim(); const m=s.match(/^(\d{4}|\d{2})[-./년\s]*/); return m?m[1]+'-**-**':s.replace(/\d/g,'*'); }
function mAddr(v){
  const t=String(v).trim().split(/\s+/); if(t.length<=2) return t[0]?t[0]+' ***':'';
  // 읍·면·동·리 또는 도로명(로·길)까지 남기고 뒤(번지·동호수)는 가림
  let k=-1; for(let i=0;i<t.length;i++){ if(/(읍|면|동|리|가|로|길)$/.test(t[i])&&!/^\d/.test(t[i])) k=i; if(/\d/.test(t[i])&&k>=0) break; }
  if(k<1) k=Math.min(2,t.length-2);
  return t.slice(0,k+1).join(' ')+' ***';
}
function mText(v){ return mCar(mEmail(mPhone(mRrn(v)))); }
const FN={name:mName,rrn:mRrn,phone:mPhone,email:mEmail,acct:mAcct,addr:mAddr,car:mCar,birth:mBirth,text:mText};

/* ── 열 판단 ── */
function detect(ci){
  const h=String(M.cols[ci]); const vals=M.rows.map(r=>r[ci]).filter(v=>v!==''&&v!=null).slice(0,300).map(String);
  if(!vals.length) return {type:'none',hit:0};
  const cnt=re=>vals.filter(v=>{ re.lastIndex=0; return re.test(v); }).length;
  const hint=(HINT.find(([,re])=>re.test(h))||[])[0];
  const r={rrn:cnt(RE.rrn),phone:cnt(RE.mobile)+cnt(RE.tel),email:cnt(RE.email),car:cnt(RE.car),name:vals.filter(isName).length};
  const n=vals.length;
  if(hint){ return {type:hint,hit:hint==='name'?r.name||n:(r[hint]??n),why:'열 이름'}; }
  for(const k of ['rrn','phone','email','car']) if(r[k]/n>=.6) return {type:k,hit:r[k],why:'값 형태'};
  const any=r.rrn+r.phone+r.email+r.car; if(any) return {type:'text',hit:any,why:'글 속에서 발견'};
  return {type:'none',hit:0};
}

/* ── 파일 읽기 ── */
function loadXlsx(){ return window.XLSX?Promise.resolve():new Promise((ok,no)=>{ const s=document.createElement('script'); s.src='vendor/xlsx.full.min.js'; s.onload=ok; s.onerror=()=>no(new Error('엑셀 모듈을 불러오지 못했습니다')); document.head.appendChild(s); }); }
async function readFile(f){
  await loadXlsx();
  const csv=/\.csv$/i.test(f.name);
  const wb=XLSX.read(await f.arrayBuffer(),csv?{type:'array',raw:true}:{type:'array',cellDates:true,dateNF:'yyyy-mm-dd'});
  const ws=wb.Sheets[wb.SheetNames[0]]; const arr=XLSX.utils.sheet_to_json(ws,{header:1,defval:'',raw:false,dateNF:'yyyy-mm-dd'});
  if(arr.length<2) throw new Error('표 내용이 없습니다 (첫 줄은 열 이름이어야 합니다)');
  M.cols=arr[0].map((c,i)=>String(c||`열${i+1}`).trim()); M.rows=arr.slice(1).filter(r=>r.some(v=>v!==''));
  M.name=f.name.replace(/\.[^.]+$/,''); M.ext=/\.csv$/i.test(f.name)?'csv':'xlsx';
  M.plan=M.cols.map((_,i)=>{ const d=detect(i); return {...d,act:d.type==='none'?'keep':'mask'}; });
  M.out=null;
}

/* ── 화면 ── */
function renderPlan(){
  const sel=(i,p)=>`<select data-i="${i}" class="mk-type">${Object.entries(TYPES).map(([k,[l]])=>`<option value="${k}"${k===p.type?' selected':''}>${l}</option>`).join('')}</select>`;
  const act=(i,p)=>`<select data-a="${i}" class="mk-act"><option value="mask"${p.act==='mask'?' selected':''}>가리기</option><option value="keep"${p.act==='keep'?' selected':''}>그대로</option><option value="drop"${p.act==='drop'?' selected':''}>열 삭제</option></select>`;
  const ex=i=>{ const p0=M.plan[i]; const ch=r=>r[i]!==''&&p0.type!=='none'&&String(FN[p0.type](r[i]))!==String(r[i]); const v=(M.rows.find(ch)||M.rows.find(r=>r[i]!=='')||[])[i]; if(v==null||v==='') return '<span class="mut">(빈 열)</span>'; const p=M.plan[i]; const after=p.act==='drop'?'<s>삭제</s>':p.act==='keep'||p.type==='none'?esc(v):esc(FN[p.type](v)); return `<span class="mk-b">${esc(String(v).slice(0,30))}</span> → <b>${String(after).slice(0,60)}</b>`; };
  const found=M.plan.filter(p=>p.type!=='none').length;
  $('#mkPlan').innerHTML=`<div class="mk-sum"><b>${M.name}</b> · ${M.rows.length.toLocaleString()}행 ${M.cols.length}열 · 개인정보로 보이는 열 <b class="hl">${found}개</b></div>
  <div class="mk-tblwrap"><table class="mk-tbl"><thead><tr><th>열 이름</th><th>판단</th><th>처리</th><th>예시 (첫 값)</th></tr></thead><tbody>
  ${M.cols.map((c,i)=>{ const p=M.plan[i]; return `<tr class="${p.type!=='none'?'on':''}"><td><b>${esc(c)}</b>${p.why?`<small>${p.why}</small>`:''}</td><td>${TYPES[p.type][1]} ${sel(i,p)}</td><td>${act(i,p)}</td><td class="mk-ex">${ex(i)}</td></tr>`; }).join('')}
  </tbody></table></div>`;
  $('#mkPlan').querySelectorAll('.mk-type').forEach(s=>s.onchange=()=>{ const p=M.plan[s.dataset.i]; p.type=s.value; p.act=s.value==='none'?'keep':'mask'; p.why='직접 지정'; renderPlan(); });
  $('#mkPlan').querySelectorAll('.mk-act').forEach(s=>s.onchange=()=>{ M.plan[s.dataset.a].act=s.value; renderPlan(); });
  $('#mkStep').hidden=false; $('#mkEmpty').hidden=true; $('#mkOut').hidden=true;
}
function apply(){
  const keep=M.cols.map((_,i)=>M.plan[i].act!=='drop');
  const cnt={}; let cells=0;
  const rows=M.rows.map(r=>r.map((v,i)=>{ const p=M.plan[i]; if(p.act!=='mask'||p.type==='none'||v===''||v==null) return v; const nv=FN[p.type](v); if(String(nv)!==String(v)){ cells++; cnt[p.type]=(cnt[p.type]||0)+1; } return nv; }).filter((_,i)=>keep[i]));
  const cols=M.cols.filter((_,i)=>keep[i]);
  const dropped=M.cols.filter((_,i)=>!keep[i]);
  M.out={cols,rows,cnt,cells,dropped};
  $('#mkStat').innerHTML=Object.entries(cnt).map(([k,n])=>`<span class="mk-chip">${TYPES[k][1]} ${TYPES[k][0]} <b>${n.toLocaleString()}</b></span>`).join('')+(dropped.length?`<span class="mk-chip">🗑 삭제한 열 <b>${dropped.length}</b></span>`:'')+(cells||dropped.length?'':'<span class="mk-chip">가릴 값이 없었습니다</span>');
  $('#mkPrev').innerHTML=`<table class="mk-tbl sm"><thead><tr>${cols.map(c=>`<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${rows.slice(0,6).map(r=>`<tr>${r.map(v=>`<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  $('#mkOut').hidden=false; $('#mkOut').scrollIntoView({behavior:'smooth',block:'start'});
  window.dsSave&&dsSave('mask',`${M.name} 개인정보 가림`,`${M.name} · ${rows.length}행\n가린 칸 ${cells}개\n`+Object.entries(cnt).map(([k,n])=>`${TYPES[k][0]} ${n}`).join(', ')+(dropped.length?`\n삭제한 열: ${dropped.join(', ')}`:''));
  if(window.S&&S.stats) S.stats.gen++; window.dsHit&&dsHit('gen','mask');
}
function download(){
  const o=M.out; if(!o) return;
  const aoa=[o.cols,...o.rows]; const fn=`${M.name}_가림`;
  if(M.ext==='csv'){
    const csv=aoa.map(r=>r.map(v=>{ const s=String(v??''); return /[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s; }).join(',')).join('\r\n');
    const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob(['﻿'+csv],{type:'text/csv'})); a.download=fn+'.csv'; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),2000);
  }else{
    const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(aoa),'가림');
    const log=[['열 이름','판단','처리'],...M.cols.map((c,i)=>[c,TYPES[M.plan[i].type][0],{mask:'가리기',keep:'그대로',drop:'열 삭제'}[M.plan[i].act]])];
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(log),'가림내역'); XLSX.writeFile(wb,fn+'.xlsx');
  }
}
async function toAnalyze(){
  const o=M.out; if(!o||!window.ANALYZE?.loadFile) return;
  const csv=[o.cols,...o.rows].map(r=>r.map(v=>{ const s=String(v??''); return /[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s; }).join(',')).join('\n');
  await ANALYZE.loadFile(new File(['﻿'+csv],`${M.name}_가림.csv`,{type:'text/csv'}));
  if(window.go) go('analyze');
}
async function take(f){ $('#mkMsg').textContent='파일 읽는 중…'; try{ await readFile(f); renderPlan(); $('#mkMsg').textContent=''; }catch(e){ $('#mkMsg').textContent='⚠ '+e.message; } }
function init(){
  if($('#mkGo')._on) return; $('#mkGo')._on=1;
  $('#mkFile').onchange=e=>{ const f=e.target.files[0]; if(f) take(f); e.target.value=''; };
  $('#mkSample').onclick=async()=>{ const b=await (await fetch('assets/sample_personal.csv')).blob(); await take(new File([b],'예시_민원접수대장(가상).csv')); window.toast&&toast('가상 예시 파일을 불러왔습니다 — 판단 결과를 확인하고 [가리기]를 누르세요'); };
  const pv=$('#mkPrevCard'); if(pv){ pv.onclick=()=>$('#mkSample').click(); pv.onkeydown=e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); $('#mkSample').click(); } }; }
  $('#mkGo').onclick=apply; $('#mkDown').onclick=download; $('#mkAn').onclick=toAnalyze;
  const dz=$('#mkDrop'); if(dz){ ['dragover','dragenter'].forEach(t=>dz.addEventListener(t,e=>{ e.preventDefault(); dz.classList.add('over'); })); ['dragleave','drop'].forEach(t=>dz.addEventListener(t,()=>dz.classList.remove('over'))); dz.addEventListener('drop',e=>{ e.preventDefault(); const f=e.dataTransfer.files[0]; if(f) take(f); }); }
}
window.MASK={init,_t:{mName,mRrn,mPhone,mEmail,mAcct,mAddr,mCar,mBirth,mText}};
})();
