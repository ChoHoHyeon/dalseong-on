# -*- coding: utf-8 -*-
"""
달성On — 카카오 i 오픈빌더 스킬 서버 (선택, Render/사내서버 배포용)
 - 오픈빌더 '스킬' URL로 이 서버의 /skill 을 등록하면 카카오톡 채널에서 실제로 동작
 - 검색 로직은 site/app.js 와 같은 색인(site/data/index.json)을 사용 (공개자료만)
 - 답변 모델 키는 환경변수 ANTHROPIC_API_KEY 로만 주입 (코드에 넣지 않음). 없으면 검색 결과로 답변 구성
실행: pip install flask requests && python app.py   (포트 8000)
"""
import os, re, json, math, collections
from flask import Flask, request, jsonify
import requests

HERE=os.path.dirname(os.path.abspath(__file__))
IDX=json.load(open(os.path.join(HERE,'..','site','data','index.json'),encoding='utf-8'))
DOCS=[d for d in IDX['docs'] if d.get('access')=='public']
JOSA=re.compile(r'(으로부터|에서는|에게는|으로는|에서|에게|까지|부터|이나|으로|은|는|이|가|을|를|의|에|와|과|도|로|만|요)$')
def tok(s):
    out=[]; s=re.sub(r'[「」『』()\[\]〔〕<>《》,.;:!?·\-–—~/\\\'"“”‘’…※□■❍○●▶◆ㆍ]',' ',str(s or '').lower())
    for w in s.split():
        if len(w)>=3 and re.search(r'[가-힣]$',w):
            st=JOSA.sub('',w); w=st if len(st)>=2 else w
        out.append('W:'+w); out+= [w[i:i+2] for i in range(len(w)-1)] if len(w)>=2 else []
    return out
TF=[collections.Counter(tok(d['title']+' '+d['text'])) for d in DOCS]
DF=collections.Counter(); [DF.update(t.keys()) for t in TF]
N=len(DOCS); AVG=sum(sum(t.values()) for t in TF)/N
def search(q,k=5):
    qt=set(tok(q)); sc=[0.0]*N
    for t in qt:
        n=DF.get(t)
        if not n: continue
        idf=math.log(1+(N-n+.5)/(n+.5)); w=2.2 if t.startswith('W:') else 1
        for i,tf in enumerate(TF):
            f=tf.get(t)
            if f: L=sum(tf.values()); sc[i]+=w*idf*(f*2.0)/(f+1.0*(1-.35+.35*L/AVG))
    order=sorted(range(N),key=lambda i:-sc[i]); out=[]; per=collections.Counter()
    for i in order:
        if sc[i]<=0: break
        d=DOCS[i]; key=d['source'] if d['type']=='data' else d['id']; per[key]+=1
        if per[key]>3: continue
        out.append(d)
        if len(out)>=k: break
    return out
def answer(q,hits):
    key=os.environ.get('ANTHROPIC_API_KEY')
    if key and hits:
        ctx='\n\n'.join(f"[{i+1}] {h['title']}\n{h['text'][:1200]}" for i,h in enumerate(hits))
        sys=("당신은 달성군 민원안내 챗봇입니다. 아래 자료에 근거해 존댓말로 6줄 이내로 답하고, 자료에 없으면 그렇게 말합니다. "
             "신청·접수가 필요한 민원은 '정부24 또는 국민신문고에서 접수하실 수 있습니다'를 덧붙입니다. 개인정보를 요구하지 않습니다.")
        r=requests.post('https://api.anthropic.com/v1/messages',headers={'x-api-key':key,'anthropic-version':'2023-06-01','content-type':'application/json'},
            json={'model':os.environ.get('MODEL','claude-haiku-4-5'),'max_tokens':500,'system':sys,'messages':[{'role':'user','content':f'<자료>\n{ctx}\n</자료>\n\n질문: {q}'}]},timeout=30)
        if r.ok: return re.sub(r'\[\d+\]','',r.json()['content'][0]['text']).strip()
    if not hits: return '죄송합니다, 해당 내용은 안내 자료에 없습니다. 달성군 홈페이지 또는 국민신문고를 이용해 주세요.'
    t=hits[0]
    if t['type']=='minwon': return t['text'].split('\n',1)[1][:700]+'\n\n신청·접수는 정부24 또는 국민신문고에서 하실 수 있습니다.'
    return '\n'.join(h['text'][:200] for h in hits[:3])

app=Flask(__name__)
@app.post('/skill')
def skill():
    body=request.get_json(force=True) or {}
    q=(body.get('userRequest',{}).get('utterance') or '').strip()
    hits=search(q); text=answer(q,hits)
    quick=[{'label':l,'action':'message','messageText':l} for l in ['대형폐기물 배출','전입신고','종량제봉투 가격','경로당 찾기']]
    return jsonify({'version':'2.0','template':{'outputs':[{'simpleText':{'text':text[:1000]}}],'quickReplies':quick}})
@app.get('/')
def ok(): return '달성On kakao skill OK'
if __name__=='__main__': app.run(host='0.0.0.0',port=int(os.environ.get('PORT',8000)))
