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


  /* ── 보도자료 서식 ────────────────────────────────────────────────
     달성군 보도자료 원본(hwp) 분석값을 그대로 적용
     용지 A4 / 여백(mm) 위7 아래15 좌20 우20 머리말20 꼬리말5
     표제 궁서 20pt·30pt · 표항목 휴먼명조 15pt · 제목 HY헤드라인M 22pt 진하게
     부제 한컴바탕확장 15pt 진하게 · 본문 한컴바탕확장 15pt / 줄간격 160%          */
  const MM = m => Math.round(m/25.4*7200);           // mm → HWPUNIT
  const PRESS_MARGIN = {top:MM(7),bottom:MM(15),left:MM(20),right:MM(20),header:MM(20),footer:MM(5)};

  function pressHeader(headXml){
    let h = headXml;
    /* 1) 글꼴 추가 : 궁서 · 한컴바탕확장 */
    const need=['궁서','한컴바탕확장'];
    const ids={};
    h = h.replace(/<hh:fontface lang="HANGUL" fontCnt="(\d+)">([\s\S]*?)<\/hh:fontface>/, (m,cnt,inner)=>{
      let n=parseInt(cnt,10), add='';
      need.forEach(face=>{
        const ex=inner.match(new RegExp('<hh:font id="(\\d+)" face="'+face+'"'));
        if(ex){ ids[face]=ex[1]; return; }
        ids[face]=String(n);
        add+=`<hh:font id="${n}" face="${face}" type="TTF" isEmbedded="0"><hh:typeInfo familyType="FCAT_MYUNGJO" weight="6" proportion="4" contrast="0" strokeVariation="1" armStyle="1" letterform="1" midline="1" xHeight="1"/></hh:font>`;
        n++;
      });
      return `<hh:fontface lang="HANGUL" fontCnt="${n}">${inner}${add}</hh:fontface>`;
    });
    const F={gung:ids['궁서']||'2', hcb:ids['한컴바탕확장']||'3', hy:'7', hm:'6'};
    /* 2) 글자모양 추가 */
    let cBase=0;
    h = h.replace(/<hh:charProperties itemCnt="(\d+)">/, (m,c)=>{ cBase=parseInt(c,10); return m; });
    const CP=(id,face,height,bold)=>
      `<hh:charPr id="${id}" height="${height}" textColor="#000000" shadeColor="none" useFontSpace="0" useKerning="0" symMark="NONE" borderFillIDRef="1">`+
      `<hh:fontRef hangul="${face}" latin="${face}" hanja="${face}" japanese="${face}" other="${face}" symbol="${face}" user="${face}"/>`+
      `<hh:ratio hangul="100" latin="100" hanja="100" japanese="100" other="100" symbol="100" user="100"/>`+
      `<hh:spacing hangul="0" latin="0" hanja="0" japanese="0" other="0" symbol="0" user="0"/>`+
      `<hh:relSz hangul="100" latin="100" hanja="100" japanese="100" other="100" symbol="100" user="100"/>`+
      `<hh:offset hangul="0" latin="0" hanja="0" japanese="0" other="0" symbol="0" user="0"/>`+
      (bold?'<hh:bold/>':'')+
      `<hh:underline type="NONE" shape="SOLID" color="#000000"/><hh:strikeout shape="NONE" color="#000000"/>`+
      `<hh:outline type="NONE"/><hh:shadow type="NONE" color="#B2B2B2" offsetX="10" offsetY="10"/></hh:charPr>`;
    const C={title:cBase, sub:cBase+1, body:cBase+2, org:cBase+3, big:cBase+4, tblK:cBase+5, tblV:cBase+6};
    const cAdd = CP(C.title,F.hy,2200,1)+CP(C.sub,F.hcb,1500,1)+CP(C.body,F.hcb,1500,0)
               + CP(C.org,F.gung,2000,0)+CP(C.big,F.gung,3000,0)+CP(C.tblK,F.hm,1500,1)+CP(C.tblV,F.hm,1500,0);
    h = h.replace(/(<hh:charProperties itemCnt=")(\d+)(">)/, (m,a,c,b)=>a+(parseInt(c,10)+7)+b)
         .replace('</hh:charProperties>', cAdd+'</hh:charProperties>');
    /* 3) 문단모양 추가 */
    let pBase=0;
    h = h.replace(/<hh:paraProperties itemCnt="(\d+)">/, (m,c)=>{ pBase=parseInt(c,10); return m; });
    const PP=(id,align,lineH,indent,next)=>
      `<hh:paraPr id="${id}" tabPrIDRef="0" condense="0" fontLineHeight="0" snapToGrid="1" suppressLineNumbers="0" checked="0">`+
      `<hh:align horizontal="${align}" vertical="BASELINE"/><hh:heading type="NONE" idRef="0" level="0"/>`+
      `<hh:breakSetting breakLatinWord="KEEP_WORD" breakNonLatinWord="BREAK_WORD" widowOrphan="0" keepWithNext="0" keepLines="0" pageBreakBefore="0" lineWrap="BREAK"/>`+
      `<hh:autoSpacing eAsianEng="0" eAsianNum="0"/>`+
      `<hh:margin><hc:intent value="${indent||0}" unit="HWPUNIT"/><hc:left value="0" unit="HWPUNIT"/><hc:right value="0" unit="HWPUNIT"/><hc:prev value="0" unit="HWPUNIT"/><hc:next value="${next||0}" unit="HWPUNIT"/></hh:margin>`+
      `<hh:lineSpacing type="PERCENT" value="${lineH}" unit="HWPUNIT"/>`+
      `<hh:border borderFillIDRef="2" offsetLeft="0" offsetRight="0" offsetTop="0" offsetBottom="0" connect="0" ignoreMargin="0"/></hh:paraPr>`;
    const PR={title:pBase, sub:pBase+1, body:pBase+2, ctr:pBase+3};
    const pAdd = PP(PR.title,'CENTER',160,0,300)+PP(PR.sub,'LEFT',130,0,0)+PP(PR.body,'JUSTIFY',160,200,200)+PP(PR.ctr,'CENTER',130,0,0);
    h = h.replace(/(<hh:paraProperties itemCnt=")(\d+)(">)/, (m,a,c,b)=>a+(parseInt(c,10)+4)+b)
         .replace('</hh:paraProperties>', pAdd+'</hh:paraProperties>');
    return {header:h, C, PR};
  }

  function pressSection(o, C, PR){
    const t=s=>`<hp:t>${esc(s)}</hp:t>`;
    const line=(prid,crid,txt)=>`<hp:p id="0" paraPrIDRef="${prid}" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0"><hp:run charPrIDRef="${crid}">${t(txt)}</hp:run></hp:p>`;
    /* 첫 문단에 용지·여백 설정(secPr)을 싣는다 */
    let sec = TPL.para.title.slice(TPL.para.title.indexOf('<hp:secPr'), TPL.para.title.indexOf('</hp:secPr>')+11);
    sec = sec.replace(/<hp:margin[^>]*\/>/, `<hp:margin header="${PRESS_MARGIN.header}" footer="${PRESS_MARGIN.footer}" gutter="0" left="${PRESS_MARGIN.left}" right="${PRESS_MARGIN.right}" top="${PRESS_MARGIN.top}" bottom="${PRESS_MARGIN.bottom}"/>`);
    sec = sec.replace(/<hp:header id[\s\S]*?<\/hp:header>/g,'').replace(/<hp:footer id[\s\S]*?<\/hp:footer>/g,'');
    const H=o.head||{};
    const first = `<hp:p id="0" paraPrIDRef="${PR.ctr}" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0"><hp:run charPrIDRef="${C.org}">${sec}${t('대구광역시 달성군')}</hp:run></hp:p>`;
    const out=[first,
      line(PR.ctr,C.big,'보 도 자 료'),
      line(PR.sub,C.tblV,''),
      line(PR.sub,C.tblK,`제공일자   ${H.date||''}`),
      line(PR.sub,C.tblK,`담당부서   ${H.dept||''}`),
      line(PR.sub,C.tblK,`팀    장   ${H.lead||''}`),
      line(PR.sub,C.tblK,`담 당 자   ${H.pic||''}`),
      line(PR.sub,C.tblK,`전    화   ${H.tel||''}`),
      line(PR.sub,C.tblV,'')];
    String(o.title||'').split('/').map(x=>x.trim()).filter(Boolean).forEach(x=>out.push(line(PR.title,C.title,x)));
    (o.subs||[]).forEach(x=>out.push(line(PR.sub,C.sub,'▸ '+x)));
    out.push(line(PR.sub,C.body,''));
    (o.paras||[]).forEach(x=>out.push(line(PR.body,C.body,' '+x)));
    return out.join('');
  }

  /* opts: {title, sub, date, kind, question, answer, cites:[{title,source}], includeCites} */
  async function build(opts){
    await load();
    const kind = opts.kind||'review';
    if(kind==='press'){
      const hdr = pressHeader(new TextDecoder().decode(b64(TPL.files['Contents/header.xml'])));
      const section = TPL.head + pressSection(opts, hdr.C, hdr.PR) + TPL.tail;
      const zip = new JSZip();
      zip.file('mimetype', b64(TPL.files['mimetype']), {compression:'STORE', createFolders:false});
      for(const [k,v] of Object.entries(TPL.files)){
        if(k==='mimetype') continue;
        let data=b64(v);
        if(k==='Contents/header.xml') data=new TextEncoder().encode(hdr.header);
        if(k==='Contents/content.hpf'){
          let x=new TextDecoder().decode(data).replace(/<opf:title>.*?<\/opf:title>/,'<opf:title>'+esc(opts.title)+'</opf:title>');
          data=new TextEncoder().encode(x);
        }
        zip.file(k,data,{compression:'DEFLATE',createFolders:false});
      }
      zip.file('Contents/section0.xml', new TextEncoder().encode(section), {compression:'DEFLATE',createFolders:false});
      zip.file('Preview/PrvText.txt', new TextEncoder().encode(opts.title+'\n'+(opts.paras||[]).join('\n').slice(0,800)), {compression:'DEFLATE',createFolders:false});
      return await zip.generateAsync({type:'blob', mimeType:'application/hwp+zip', platform:'DOS'});
    }
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
