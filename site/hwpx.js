/* 달성On — 브라우저에서 한글(hwpx) 파일 생성
 * 원리: 달성군 표준 서식 hwpx의 header.xml(스타일)·설정 파일을 그대로 쓰고,
 *       본문(section0.xml)만 답변 내용으로 다시 써서 zip(hwpx)으로 묶는다.  */
window.DalseongHwpx = (function(){
  let TPL=null;
  async function load(){ if(!TPL){ TPL = await (await fetch('hwpx_tpl.json')).json(); } return TPL; }
  const esc = s => String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const P = (k,t) => TPL.para[k].replace('@@TEXT@@', esc(t));
  const b64 = s => { const b=atob(s), u=new Uint8Array(b.length); for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i); return u; };

  /* 답변(마크다운 유사 텍스트) → 서식 단락 배열 [{k,t}] */
  function toParas(text){
    const out=[];
    text.split(/\r?\n/).forEach(raw=>{
      let l=raw.replace(/\[(\d+)\]/g,'').replace(/\*\*(.+?)\*\*/g,'$1').replace(/`/g,'').trimEnd();
      const s=l.trim();
      if(!s||/오프라인 모드/.test(s)) return;
      if(/^#{1,3}\s/.test(s))            out.push({k:'sec',  t:s.replace(/^#+\s*/,'')});
      else if(/^(■|□)\s?/.test(s))      out.push({k:'sq',   t:s.replace(/^(■|□)\s?/,'')});
      else if(/^(❍|○|◦|•|\*|-|·)\s/.test(s) && /^\s{2,}/.test(l)) out.push({k:'dash', t:s.replace(/^(❍|○|◦|•|\*|-|·)\s/,'')});
      else if(/^(❍|○|•|\*|-)\s/.test(s)) out.push({k:'cir',  t:s.replace(/^(❍|○|•|\*|-)\s/,'')});
      else if(/^(·|◦)\s/.test(s))        out.push({k:'dot',  t:s.replace(/^(·|◦)\s/,'')});
      else if(/^(※|주\))/.test(s))       out.push({k:'note', t:s.replace(/^(※|주\))\s*/,'')});
      else if(/^(→|⇒)/.test(s))          out.push({k:'arrow',t:s.replace(/^(→|⇒)\s*/,'')});
      else if(/^\d+\.\s/.test(s))        out.push({k:'cir',  t:s});
      else                               out.push({k:'cir',  t:s});
    });
    return out;
  }


  /* ── 보도자료 서식 ──────────────────────────────────────────────
     달성군이 실제로 쓰는 보도자료 한글 파일(press_tpl.hwpx)을 원본 그대로 열어
     본문(section0.xml)만 바꿔 다시 저장한다. 나머지 파일은 손대지 않으므로
     표·로고·머리말·글꼴·여백·선이 원본과 완전히 동일하다.                    */
  let PTPL=null, PZIP=null;
  async function loadPress(){
    if(!PTPL) PTPL = await (await fetch('press_tpl.json')).json();
    if(!PZIP){ const buf = await (await fetch('press_tpl.hwpx')).arrayBuffer(); PZIP = await JSZip.loadAsync(buf); }
    return PTPL;
  }
  const fill=(tpl,map)=>{ let x=tpl; for(const k in map){ x=x.split(k).join(esc(map[k]==null?'':map[k])); } return x; };

  async function buildPress(o){
    await loadPress();
    const H=o.head||{};
    const head = fill(PTPL.pHead,{'@@DATE@@':' '+(H.date||''),'@@DEPT@@':' '+(H.dept||''),
                                 '@@LEAD@@':' '+(H.lead||''),'@@PIC@@':' '+(H.pic||''),'@@TEL@@':' '+(H.tel||'')});
    const subs=(o.subs||[]).slice(0,3);
    const lines=(o.titleLines&&o.titleLines.length)?o.titleLines:[String(o.title||'').replace(/\s*\/\s*/g,' ').trim()];
    const block=lines.map(l=>fill(PTPL.titlePara,{'@@TITLE@@':l})).join('');
    const title= fill(PTPL.pTitle,{'@@SUB1@@':subs[0]?'▸ '+subs[0]:'', '@@SUB2@@':subs[1]?'▸ '+subs[1]:'', '@@SUB3@@':subs[2]?'▸ '+subs[2]:''})
                 .split('@@TITLE_BLOCK@@').join(block);
    const body = (o.paras||[]).map((t,i)=>(i?PTPL.pGap:'')+fill(PTPL.pBody,{'@@TEXT@@':' '+t})).join('');
    const section = PTPL.head + head + PTPL.pBlank + title + PTPL.pGap + body + PTPL.tail;

    /* 원본 zip 을 순서 그대로 새로 쓴다 (mimetype 은 반드시 첫 항목·무압축) */
    const out = new JSZip();
    const names = PTPL.order || Object.keys(PZIP.files);
    for(const k of names){
      const f = PZIP.file(k); if(!f) continue;
      if(k==='mimetype'){ out.file(k, await f.async('uint8array'), {compression:'STORE', createFolders:false}); continue; }
      let data;
      if(k==='Contents/section0.xml') data = new TextEncoder().encode(section);
      else if(k==='Contents/content.hpf'){
        const x=(await f.async('string')).replace(/<opf:title>[\s\S]*?<\/opf:title>/,'<opf:title>'+esc(o.title||'보도자료')+'</opf:title>');
        data = new TextEncoder().encode(x);
      }
      else if(k==='Preview/PrvText.txt') data = new TextEncoder().encode((o.title||'')+'\n'+(o.paras||[]).join('\n').slice(0,800));
      else data = await f.async('uint8array');
      out.file(k, data, {compression:'DEFLATE', createFolders:false});
    }
    return await out.generateAsync({type:'blob', mimeType:'application/hwp+zip', platform:'DOS'});
  }

  /* opts: {title, sub, date, kind, question, answer, cites:[{title,source}], includeCites} */
  async function build(opts){
    await load();
    const kind = opts.kind||'review';
    if(kind==='press') return await buildPress(opts);
    const paras=[];
    if(kind==='law'){
      /* 조례안 전용 서식: 문단·글자 모양을 header.xml에 새로 추가해 쓴다
         · 양쪽 정렬, 한글 단어 단위 줄바꿈(KEEP_WORD) → 글자 사이가 벌어지거나 낱말이 쪼개지지 않게
         · 항(①)·호(1.)·목(가.)은 내어쓰기로 둘째 줄을 번호 뒤에 맞춤
         · 줄 배치 정보(linesegarray)는 넣지 않음 → 한글이 열 때 직접 계산(예전 서식의 줄 정보가 남아 자간이 눌리던 문제 해결) */
      const hdr0=new TextDecoder().decode(b64(TPL.files['Contents/header.xml']));
      const ids=k=>Math.max(...[...hdr0.matchAll(new RegExp('<hh:'+k+' id="(\\d+)"','g'))].map(m=>+m[1]))+1;
      const cBase=(hdr0.match(/<hh:charPr id="25"[\s\S]*?<\/hh:charPr>/)||[])[0];
      const pBase=(hdr0.match(/<hh:paraPr id="24"[\s\S]*?<\/hh:paraPr>/)||[])[0];
      const c0=ids('charPr'), p0=ids('paraPr');
      const mkC=(id,h,bold)=>cBase.replace(/id="25"/,`id="${id}"`).replace(/height="\d+"/,`height="${h}"`).replace(/<hh:spacing [^>]*\/>/,'<hh:spacing hangul="0" latin="0" hanja="0" japanese="0" other="0" symbol="0" user="0"/>').replace(/<hh:bold\/>/g,'').replace(/(<hh:relSz [^>]*\/><hh:offset [^>]*\/>)/,bold?'$1<hh:bold/>':'$1');
      const mkP=(id,align,left,ind,prev)=>pBase.replace(/id="24"/,`id="${id}"`).replace(/horizontal="[A-Z]+"/,`horizontal="${align}"`)
        .replace(/breakNonLatinWord="[A-Z_]+"/,'breakNonLatinWord="KEEP_WORD"').replace(/widowOrphan="0"/,'widowOrphan="1"')
        .replace(/<hp:switch>[\s\S]*?<\/hp:switch>/,`<hp:switch><hp:case hp:required-namespace="http://www.hancom.co.kr/hwpml/2016/HwpUnitChar"><hh:margin><hc:intent value="${ind}" unit="HWPUNIT"/><hc:left value="${left}" unit="HWPUNIT"/><hc:right value="0" unit="HWPUNIT"/><hc:prev value="${prev}" unit="HWPUNIT"/><hc:next value="0" unit="HWPUNIT"/></hh:margin><hh:lineSpacing type="PERCENT" value="160" unit="HWPUNIT"/></hp:case><hp:default><hh:margin><hc:intent value="${ind*2}" unit="HWPUNIT"/><hc:left value="${left*2}" unit="HWPUNIT"/><hc:right value="0" unit="HWPUNIT"/><hc:prev value="${prev*2}" unit="HWPUNIT"/><hc:next value="0" unit="HWPUNIT"/></hh:margin><hh:lineSpacing type="PERCENT" value="160" unit="HWPUNIT"/></hp:default></hp:switch>`);
      const C={n:c0,b:c0+1,t:c0+2}, W=1400;            // 본문 14pt, 한 글자 폭 ≈ 1400
      const PP={title:p0,body:p0+1,art:p0+2,hang:p0+3,ho:p0+4,mok:p0+5,center:p0+6};
      const addC=mkC(C.n,1400,0)+mkC(C.b,1400,1)+mkC(C.t,1800,1);
      const addP=mkP(PP.title,'CENTER',0,0,0)+mkP(PP.body,'JUSTIFY',0,0,0)+mkP(PP.art,'JUSTIFY',0,0,600)
        +mkP(PP.hang,'JUSTIFY',W*2,-W,0)+mkP(PP.ho,'JUSTIFY',W*3+700,-(W+700),0)+mkP(PP.mok,'JUSTIFY',W*5,-(W+700),0)+mkP(PP.center,'CENTER',0,0,1200);
      opts.__hdr=hdr0.replace(/<hh:charProperties itemCnt="(\d+)">/,(m,n)=>`<hh:charProperties itemCnt="${+n+3}">`).replace('</hh:charProperties>',addC+'</hh:charProperties>')
                     .replace(/<hh:paraProperties itemCnt="(\d+)">/,(m,n)=>`<hh:paraProperties itemCnt="${+n+7}">`).replace('</hh:paraProperties>',addP+'</hh:paraProperties>');
      const NS='xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph"';
      const para=(pp,runs)=>`<hp:p ${NS} id="2147483648" paraPrIDRef="${pp}" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">${runs}</hp:p>`;
      const run=(c,t)=>`<hp:run charPrIDRef="${c}"><hp:t>${esc(t)}</hp:t></hp:run>`;
      const L=[para(PP.title,run(C.t,opts.title)),para(PP.body,run(C.n,''))];
      (opts.lines||[]).forEach(raw=>{ const t=String(raw).trim(); let m;
        if(!t){ return; }
        if(/^부\s*칙/.test(t)&&t.replace(/\s/g,'')==='부칙'){ L.push(para(PP.center,run(C.b,'부      칙'))); return; }
        if(/^제\d+장\s/.test(t)){ L.push(para(PP.center,run(C.b,t))); return; }
        if((m=t.match(/^(제\d+조(?:의\d+)?\([^)]*\))\s*(.*)$/))){ L.push(para(PP.art,run(C.b,m[1])+run(C.n,m[2]?' '+m[2]:''))); return; }
        if(/^[①-⑳]/.test(t)){ L.push(para(PP.hang,run(C.n,t))); return; }
        if(/^\d+(의\d+)?\.\s/.test(t)){ L.push(para(PP.ho,run(C.n,t))); return; }
        if(/^[가-하]\.\s/.test(t)){ L.push(para(PP.mok,run(C.n,t))); return; }
        L.push(para(PP.art,run(C.n,t)));
      });
      const secP=P('title',opts.title).replace(/<hp:pic[\s\S]*?<\/hp:pic>/g,'').replace(/<hp:t>\s{10,}<\/hp:t>/g,'<hp:t></hp:t>');   // 제목 문단(쪽 설정 secPr 포함) — 머리말의 군 로고 그림만 뺌
      L.splice(0,1,secP); const headNoLogo=TPL.head;
      opts.__law=L.join(''); opts.__head=headNoLogo; opts.answer=(opts.lines||[]).join('\n');
    }
    if(!opts.__law){
    paras.push({k:'title',t:opts.title}); paras.push({k:'sub',t:opts.sub||''}); paras.push({k:'date',t:opts.date||''});
    if(kind==='free'){
      /* 조례·회의록 등: 제목·부제·날짜 뒤에 본문(# → 파란 제목 박스, □ ○ - · ※)만 */
    }else if(kind==='pumui'){
      paras.push({k:'sec',t:'품의 개요'});
      paras.push({k:'sq',t:'건명 : '+opts.title});
      paras.push({k:'cir',t:'검토 요청 사항 : '+opts.question});
      paras.push({k:'blank'});
      paras.push({k:'sec',t:'검토 내용'});
    }else if(kind==='memo'){
      paras.push({k:'sec',t:'업무 연락'});
      paras.push({k:'sq',t:'문의 : '+opts.question});
      paras.push({k:'blank'});
      paras.push({k:'sec',t:'회신 내용'});
    }else{
      paras.push({k:'sec',t:'검토 배경'});
      paras.push({k:'sq',t:opts.question});
      paras.push({k:'blank'});
      paras.push({k:'sec',t:'검토 내용'});
    }
    toParas(opts.answer).forEach(p=>paras.push(p));
    if(opts.includeCites && opts.cites?.length){
      paras.push({k:'blank'}); paras.push({k:'sec',t:'근거 자료'});
      opts.cites.forEach((c,i)=>paras.push({k:'cir',t:`[${i+1}] ${c.title}${c.source&&!c.title.startsWith(c.source)?' — '+c.source:''}`}));
    }
    paras.push({k:'blank'}); paras.push({k:'note',t:'본 문서는 달성군 AI 업무비서(달성On)가 초안을 생성한 것으로, 담당자 검토 후 사용합니다.'});
    }

    const body = opts.__law || paras.map(p=>P(p.k,p.t||'')).join('');
    const section = (opts.__head||TPL.head) + body + TPL.tail;

    const zip = new JSZip();  // 폴더 항목 없이 파일만 (한글은 zip 내 디렉터리 항목이 있으면 손상 문서로 판단할 수 있음)
    zip.file('mimetype', b64(TPL.files['mimetype']), {compression:'STORE', createFolders:false});
    for(const [k,v] of Object.entries(TPL.files)){
      if(k==='mimetype') continue;
      let data=(k==='Contents/header.xml'&&opts.__hdr)?new TextEncoder().encode(opts.__hdr):b64(v);
      if(k==='Contents/content.hpf'){
        let s=new TextDecoder().decode(data).replace(/<opf:title>.*?<\/opf:title>/,'<opf:title>'+esc(opts.title)+'</opf:title>');
        data=new TextEncoder().encode(s);
      }
      zip.file(k,data,{compression:'DEFLATE',createFolders:false});
    }
    zip.file('Contents/section0.xml', new TextEncoder().encode(section), {compression:'DEFLATE',createFolders:false});
    zip.file('Preview/PrvText.txt', new TextEncoder().encode(opts.title+'\n'+String(opts.answer||'').slice(0,800)), {compression:'DEFLATE',createFolders:false});
    const blob = await zip.generateAsync({type:'blob', mimeType:'application/hwp+zip', platform:'DOS'});
    return blob;
  }
  function download(blob,name){
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; document.body.appendChild(a); a.click();
    setTimeout(()=>{URL.revokeObjectURL(a.href); a.remove();},2000);
  }
  return {build, download, load};
})();
