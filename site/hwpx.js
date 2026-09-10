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
      if(!s||/오프라인 시연 모드/.test(s)) return;
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
    paras.push({k:'title',t:opts.title}); paras.push({k:'sub',t:opts.sub||''}); paras.push({k:'date',t:opts.date||''});
    if(kind==='pumui'){
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

    const body = paras.map(p=>P(p.k,p.t||'')).join('');
    const section = TPL.head + body + TPL.tail;

    const zip = new JSZip();  // 폴더 항목 없이 파일만 (한글은 zip 내 디렉터리 항목이 있으면 손상 문서로 판단할 수 있음)
    zip.file('mimetype', b64(TPL.files['mimetype']), {compression:'STORE', createFolders:false});
    for(const [k,v] of Object.entries(TPL.files)){
      if(k==='mimetype') continue;
      let data=b64(v);
      if(k==='Contents/content.hpf'){
        let s=new TextDecoder().decode(data).replace(/<opf:title>.*?<\/opf:title>/,'<opf:title>'+esc(opts.title)+'</opf:title>');
        data=new TextEncoder().encode(s);
      }
      zip.file(k,data,{compression:'DEFLATE',createFolders:false});
    }
    zip.file('Contents/section0.xml', new TextEncoder().encode(section), {compression:'DEFLATE',createFolders:false});
    zip.file('Preview/PrvText.txt', new TextEncoder().encode(opts.title+'\n'+opts.answer.slice(0,800)), {compression:'DEFLATE',createFolders:false});
    const blob = await zip.generateAsync({type:'blob', mimeType:'application/hwp+zip', platform:'DOS'});
    return blob;
  }
  function download(blob,name){
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; document.body.appendChild(a); a.click();
    setTimeout(()=>{URL.revokeObjectURL(a.href); a.remove();},2000);
  }
  return {build, download, load};
})();
