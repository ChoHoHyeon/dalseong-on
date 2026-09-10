# -*- coding: utf-8 -*-
import json,io,os,re,collections
BASE=os.path.dirname(os.path.abspath(__file__))
REF=os.path.join(BASE,'..','..','05_참고자료','자치법규')
SITE=os.path.join(BASE,'site','data')

old=json.load(io.open(os.path.join(SITE,'index.json'),encoding='utf-8'))
ordin=json.load(io.open(os.path.join(REF,'dalseong_ordin_574.json'),encoding='utf-8'))
elis=json.load(io.open(os.path.join(REF,'dalseong_elis_648.json'),encoding='utf-8'))
hun=json.load(io.open(os.path.join(REF,'dalseong_hunryeong_70.json'),encoding='utf-8'))
pressf=os.path.join(REF,'..','dalseong_press_600.json')
press=json.load(io.open(pressf,encoding='utf-8')) if os.path.exists(pressf) else {'docs':[]}

# ELIS: 법규명 -> 편, 소관부서
E={}
for r in elis['rows']:
    nm=r['nm'].strip()
    E[nm]={'p':re.sub(r'제\s*(\d+)\s*편\s*','',r['p']).strip(),'dept':r['dept'].strip(),'dt':r['dt'].strip()}

def one(v):
    while isinstance(v,(list,tuple)): v=v[0] if v else ''
    return v if isinstance(v,str) else ('' if v is None else str(v))

def jo(no):
    no=one(no).strip()
    if not no.isdigit() or len(no)<5: return no
    a=int(no[:4]); b=int(no[4:])
    return '제%d조'%a + ('의%d'%b if b else '')

KIND={'C0001':'조례','C0002':'규칙'}
docs=[]; n=0
srcs=[]; cnt=collections.Counter(); dept_map={}
for d in ordin['docs']:
    src=d['src'].strip()
    meta=E.get(src,{})
    dept=(d.get('dept') or meta.get('dept') or '').strip()
    kind=KIND.get(d.get('kind'),d.get('kind') or '')
    txt=re.sub(r'\s+',' ',one(d['txt'])).strip()[:2000]
    if len(txt)<8: continue
    label=jo(d['no']) if d['no']!='부칙' else '부칙'
    ttl=one(d.get('ttl')).strip()
    title='%s %s%s'%(src,label,'(%s)'%ttl if ttl and label!='부칙' else '')
    docs.append({'id':'law-%d'%n,'type':'law','source':src,'title':title,'text':txt,
                 'access':'public','dept':dept,'kind':kind,'field':meta.get('p','')})
    n+=1; cnt[src]+=1
    if dept: dept_map[src]=dept

# 훈령·예규 (ELIS)
for d in hun['docs']:
    src=d['src'].strip(); meta=E.get(src,{})
    txt=re.sub(r'\s+',' ',one(d['txt'])).strip()[:2000]
    if len(txt)<10: continue
    label=one(d.get('no')) or ''
    ttl=one(d.get('ttl')).strip()
    title='%s %s%s'%(src,label,'(%s)'%ttl if ttl else '') if label else '%s %s'%(src,ttl or '본문')
    docs.append({'id':'law-%d'%n,'type':'law','source':src,'title':title.strip(),'text':txt,
                 'access':'public','dept':(d.get('dept') or meta.get('dept') or '').strip(),
                 'kind':d.get('kind','훈령'),'field':meta.get('p','')})
    n+=1; cnt[src]+=1

# 보도자료 (달성군 홈페이지 공개 게시판)
pn=0
for d in press.get('docs',[]):
    txt=re.sub(r'[ \t]+',' ',one(d.get('text'))).strip()
    if len(txt)<80: continue
    ttl=one(d.get('title')).strip()
    ttl=re.sub(r'^\d{4}년\s*\d{1,2}월\s*\d{1,2}일[_\s]*','',ttl)
    docs.append({'id':'pr-%d'%pn,'type':'press','source':'보도자료 '+one(d.get('date')),
                 'title':ttl,'text':txt[:4000],'access':'public',
                 'dept':one(d.get('dept')).strip(),'date':one(d.get('date')).strip()})
    pn+=1

for d in old['docs']:
    if d['type']!='law': docs.append(d)

# (훈령·예규 포함 후 재계산)
law_sources=sorted(cnt.keys())
laws=[]
for L in ordin['laws']:
    nm=L['name'].strip(); m=E.get(nm,{})
    laws.append({'n':nm,'k':KIND.get(L['kind'],L['kind']),'d':(L.get('dept') or m.get('dept') or ''),
                 'e':L.get('eff',''),'f':m.get('p',''),'c':cnt.get(nm,0)})
for L in hun['laws']:
    nm=L['name'].strip(); m=E.get(nm,{})
    laws.append({'n':nm,'k':L.get('kind','훈령'),'d':(L.get('dept') or m.get('dept') or ''),
                 'e':L.get('eff',''),'f':L.get('field') or m.get('p',''),'c':cnt.get(nm,0)})

TODAY='20260910'
_ok=[x for x in laws if x['e'] and x['e'].isdigit() and len(x['e'])==8 and x['e']<=TODAY]
laws_recent=sorted(_ok,key=lambda x:x['e'],reverse=True)[:12]

meta=dict(old['meta'])
meta['built']='2026-09-10'
meta['press_n']=pn
meta['counts']={'press':pn,'law':cnt.total() if hasattr(cnt,'total') else sum(cnt.values()),
                'minwon':sum(1 for d in docs if d['type']=='minwon'),
                'data':sum(1 for d in docs if d['type']=='data'),
                'internal':sum(1 for d in docs if d['type']=='internal')}
meta['law_sources']=law_sources
meta['law_counts']={k:v for k,v in cnt.items()}
meta['laws']=laws
meta['law_recent']=laws_recent
meta['law_src']='법제처 국가법령정보 공동활용 · 자치법규정보시스템(ELIS)'
meta['depts']=sorted(set(x['d'] for x in laws if x['d']))
meta['law_kinds']=dict(collections.Counter(x['k'] for x in laws))

out={'meta':meta,'docs':docs}
p=os.path.join(SITE,'index.json')
io.open(p,'w',encoding='utf-8').write(json.dumps(out,ensure_ascii=False,separators=(',',':')))
print('법규 %d건 / 조문 %d건 / 전체문서 %d건 / 부서 %d개'%(len(laws),meta['counts']['law'],len(docs),len(meta['depts'])))
print('종류',meta['law_kinds'])
print('크기 %.2f MB'%(os.path.getsize(p)/1048576))
