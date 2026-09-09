# -*- coding: utf-8 -*-
"""
달성On 프로토타입 — 자료 색인 생성 스크립트
 data/law/*.txt      : 자치법규 원문(hwpx→txt 변환본)  → 조(條) 단위 청크
 data/minwon.json    : 민원 안내(수기 작성)               → 항목 단위
 data/*.csv          : 공공데이터                          → 행 단위 + 읍면 집계
 결과: site/data/index.json  (브라우저에서 로드)
"""
import csv, json, os, re, glob, io

ROOT=os.path.dirname(os.path.abspath(__file__))
D=os.path.join(ROOT,'data'); OUT=os.path.join(ROOT,'site','data'); os.makedirs(OUT,exist_ok=True)
docs=[]

# ---------- 1) 자치법규 ----------
def strip_preamble(txt,name):
    """공포문·날짜·군수·조례번호·제목 줄 제거 → 본문만"""
    lines=txt.split('\n'); start=0
    for i,l in enumerate(lines[:8]):
        if l.strip().replace(' ','')==name.replace(' ','').replace('.','·').replace('․','·') or (l.strip().startswith('대구광역시 달성군') and ('조례' in l or '규칙' in l) and not l.startswith('대구광역시 달성군의회')):
            start=i+1
    return '\n'.join(lines[start:]).strip()
for fp in sorted(glob.glob(os.path.join(D,'law','*.txt'))):
    name=os.path.basename(fp)[:-4].replace('.','·').replace('․','·')
    txt=strip_preamble(open(fp,encoding='utf-8').read(),name)
    # 별표 분리
    chunks=re.split(r'\n(?=\[별표\s*\d+\])',txt)
    body=chunks[0]
    parts=re.split(r'(?:^|\n)(?=제\d+조(?:의\d+)?\s*\()',body)
    if len(parts)>1:
        for p in parts[1:]:
            m=re.match(r'(제\d+조(?:의\d+)?)\s*\(([^)]*)\)',p)
            art=m.group(1) if m else ''; title=m.group(2) if m else ''
            docs.append({'id':f'law-{len(docs)}','type':'law','source':name,'title':f'{name} {art}({title})','text':p.strip(),'access':'public'})
    else:
        docs.append({'id':f'law-{len(docs)}','type':'law','source':name,'title':f'{name} (개정문)','text':body.strip()[:1500],'access':'public'})
    def tidy(c):  # 별표: 셀 단위로 줄바꿈된 값(감면율·금액)을 앞 항목에 붙여 읽기 쉽게
        out=[]
        for l in c.split('\n'):
            l=l.strip()
            if not l: continue
            if out and re.fullmatch(r'(\d+%( 이내)?|전액면제|무료|[\d,]+원?|-)',l): out[-1]+=' : '+l
            else: out.append(l)
        return '\n'.join(out)
    for c in chunks[1:]:
        c=tidy(c)
        m=re.match(r'\[별표\s*(\d+)\]\s*\n?([^\n]*?\))',c) or re.match(r'\[별표\s*(\d+)\]\s*\n?([^\n]*)',c)
        docs.append({'id':f'law-{len(docs)}','type':'law','source':name,'title':f"{name} [별표 {m.group(1)}] {m.group(2).strip()}",'text':c.strip()[:2500],'access':'public'})

# ---------- 2) 민원 안내 ----------
minwon=json.load(open(os.path.join(D,'minwon.json'),encoding='utf-8'))
for m in minwon:
    text=f"[{m['title']}]\n대상: {m['who']}\n신청 방법: {m['how']}\n필요 서류: {m['docs']}\n수수료: {m['fee']}\n처리 기간: {m['days']}\n담당: {m['dept']}\n비고: {m.get('note','')}"
    docs.append({'id':f'mw-{len(docs)}','type':'minwon','source':'민원 안내(달성군 홈페이지·정부24 기준 예시)','title':m['title'],'text':text,'access':'public',
                 'link':m.get('link','')})

# ---------- 3) 공공데이터 ----------
def rd(fn):
    with open(os.path.join(D,fn),encoding='utf-8-sig') as f: return list(csv.DictReader(f))
EUP=['화원읍','논공읍','다사읍','유가읍','옥포읍','현풍읍','가창면','하빈면','구지면']
def eup_of(s):
    for e in EUP:
        if e in (s or ''): return e
    return '기타'
datasets=[]
def add_rows(fn,dsname,rowfmt,addr_key=None,name_key=None):
    rows=rd(fn); by={}
    for r in rows:
        t=rowfmt(r); e=eup_of(r.get(addr_key,'')) if addr_key else None
        docs.append({'id':f'ds-{len(docs)}','type':'data','source':dsname,'title':(r.get(name_key) if name_key else dsname) or dsname,'text':t,'access':'public','eup':e})
        if e: by[e]=by.get(e,0)+1
    if by:
        summ='읍·면별 개소 수: '+', '.join(f'{k} {v}개소' for k,v in sorted(by.items(),key=lambda x:-x[1]))+f' (총 {len(rows)}개소, 기준일 2026-09-08)'
        docs.append({'id':f'ds-{len(docs)}','type':'data','source':dsname,'title':f'{dsname} 읍면별 집계','text':f'[{dsname} 집계] {summ}','access':'public','eup':None})
    datasets.append({'name':dsname,'rows':len(rows)})

add_rows('senior_center.csv','경로당 현황',lambda r:f"경로당 {r['명칭']} — 주소 {r['소재지주소']}, 전화 {r['전화번호'] or '없음'}",'소재지주소','명칭')
add_rows('bag_shops.csv','종량제봉투 판매소',lambda r:f"종량제봉투 판매소 {r['판매소명']} — {r['소재지도로명주소'] or r['소재지지번주소']}, 대형폐기물 스티커 판매 {'가능' if r['대형폐기물스티커판매여부']=='Y' else '불가'}, 영업상태 {r['영업상태명']}",'소재지도로명주소','판매소명')
add_rows('library.csv','도서관',lambda r:f"도서관 {r['도서관명']}({r['도서관유형']}) — {r['소재지도로명주소']}, 평일 {r['평일운영시작시각']}~{r['평일운영종료시각']}, 토요일 {r['토요일운영시작시각']}~{r['토요일운영종료시각']}, 휴관일 {r['휴관일']}, 전화 {r['도서관전화번호']}, 대출 {r['대출가능권수']}권/{r['대출가능일수']}일, 좌석 {r['열람좌석수']}석",'소재지도로명주소','도서관명')
add_rows('free_meal.csv','무료급식소',lambda r:' / '.join(f'{k} {v}' for k,v in r.items() if v and k not in('시도명','시군구명','데이터기준일자')),None,None)
# 대형폐기물 수수료: 품목 단위
rows=rd('bulk_waste_fee.csv')
for r in rows:
    docs.append({'id':f'ds-{len(docs)}','type':'data','source':'대형폐기물 수거수수료','title':f"{r['대형폐기물명']} {r['대형폐기물규격']}",
                 'text':f"대형폐기물 수수료: {r['대형폐기물구분명']} > {r['대형폐기물명']} ({r['대형폐기물규격']}) — {int(r['수수료']):,}원 ({r['유무료여부']}), 관리 {r['관리기관명']}",'access':'public'})
datasets.append({'name':'대형폐기물 수거수수료','rows':len(rows)})
rows=rd('bag_price.csv')
for r in rows:
    prices=', '.join(f"{k.replace('가격','')} {int(v):,}원" for k,v in r.items() if k.endswith('가격') and v and v!='0')
    docs.append({'id':f'ds-{len(docs)}','type':'data','source':'종량제봉투 가격','title':f"{r['종량제봉투용도']} {r['종량제봉투사용대상']}",
                 'text':f"종량제봉투 가격({r['종량제봉투종류']}·{r['종량제봉투처리방식']}·{r['종량제봉투용도']}·{r['종량제봉투사용대상']}): {prices} — 관리부서 {r['관리부서명']} {r['관리부서전화번호']}",'access':'public'})
datasets.append({'name':'종량제봉투 가격','rows':len(rows)})

# ---------- 4) 내부 지침(예시, 직원 전용) ----------
internal=json.load(open(os.path.join(D,'internal.json'),encoding='utf-8'))
for m in internal:
    docs.append({'id':f'in-{len(docs)}','type':'internal','source':m['source'],'title':m['title'],'text':m['text'],'access':'staff'})

meta={'built':'2026-09-09','counts':{
    'law':sum(1 for d in docs if d['type']=='law'),'minwon':sum(1 for d in docs if d['type']=='minwon'),
    'data':sum(1 for d in docs if d['type']=='data'),'internal':sum(1 for d in docs if d['type']=='internal')},
    'law_sources':sorted({d['source'] for d in docs if d['type']=='law'}),'datasets':datasets}
json.dump({'meta':meta,'docs':docs},open(os.path.join(OUT,'index.json'),'w',encoding='utf-8'),ensure_ascii=False)
print(json.dumps(meta,ensure_ascii=False,indent=1), len(docs),'docs', os.path.getsize(os.path.join(OUT,'index.json'))//1024,'KB')
