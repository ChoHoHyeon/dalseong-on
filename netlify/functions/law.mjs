// 달성On — 국가법령정보센터(law.go.kr) Open API 중계 (Netlify Functions 2.0)
// · 자치법규정보시스템(ELIS)의 자치법규도 law.go.kr Open API(target=ordin)로 같이 제공된다.
// · 인증키(OC)는 Netlify 환경변수 LAW_OC 에만 둔다. (open.law.go.kr 에서 신청 · 도메인 ds-on.netlify.app 등록)
// 사용:
//   GET /api/law?target=law&q=공공데이터        → 법령 검색
//   GET /api/law?target=ordin&q=공공데이터       → 자치법규(조례·규칙) 검색  (org=달성군 처럼 기관명 필터 가능)
//   GET /api/law?target=ordin&mst=1234567      → 본문(조문 텍스트)
export const config = { path: "/api/law" };

const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

// JSON 어디에 있든 배열/객체를 찾아 항목 목록으로
function items(j) {
  const out = [];
  const walk = (v) => {
    if (Array.isArray(v)) { v.forEach(walk); return; }
    if (v && typeof v === "object") {
      if (v["법령명한글"] || v["자치법규명"]) { out.push(v); return; }
      Object.values(v).forEach(walk);
    }
  };
  walk(j);
  return out;
}
// 본문: "조문" 부분만 골라(개정문·부칙·제개정이유 제외) "…내용" 문자열을 순서대로 모으고 항·호를 줄바꿈
function findKey(v, key) {
  if (!v || typeof v !== "object") return null;
  if (!Array.isArray(v) && key in v) return v[key];
  for (const x of Object.values(v)) { const r = findKey(x, key); if (r) return r; }
  return null;
}
function bodyText(j) {
  const root = findKey(j, "조문") || j;
  const L = [];
  const walk = (v, k = "") => {
    if (typeof v === "string") { if (/내용$/.test(k) && v.trim()) L.push(v.replace(/<[^>]+>/g, "").trim()); return; }
    if (Array.isArray(v)) { v.forEach((x) => walk(x, k)); return; }
    if (v && typeof v === "object") Object.entries(v).forEach(([kk, vv]) => walk(vv, kk));
  };
  walk(root);
  return L.join("\n")
    .replace(/([^\n\s)])\s*(?=[①-⑳])/g, "$1\n")
    .replace(/([^\d\n])(?=\d{1,2}(?:의\d+)?\.\s)/g, "$1\n  ")
    .replace(/([^\n])(?=[가-하]\.\s)/g, (s, a) => (/[다.]$/.test(a) ? a + "\n    " : s));
}

export default async (req) => {
  const oc = process.env.LAW_OC;
  if (!oc) return J({ error: "LAW_OC 환경변수가 없습니다 (Netlify › Environment variables)" }, 503);
  const u = new URL(req.url);
  const target = u.searchParams.get("target") === "ordin" ? "ordin" : "law";
  const q = (u.searchParams.get("q") || "").slice(0, 60);
  const mst = (u.searchParams.get("mst") || "").replace(/\D/g, "");
  const org = (u.searchParams.get("org") || "").trim();
  const n = Math.min(+u.searchParams.get("n") || 8, 20);
  const base = "https://www.law.go.kr/DRF/";
  const H = { headers: { Referer: "https://ds-on.netlify.app/", "User-Agent": "Mozilla/5.0 (dalseong-on)" } };  // 신청 시 등록한 도메인
  try {
    if (mst) {
      const r = await fetch(`${base}lawService.do?OC=${encodeURIComponent(oc)}&target=${target}&MST=${mst}&type=JSON`, H);
      const t = await r.text(); let j; try { j = JSON.parse(t); } catch { return J({ error: "본문 응답을 읽지 못했습니다", raw: t.slice(0, 200) }, 502); }
      if (j.result && /실패/.test(j.result)) return J({ error: j.result + " " + (j.msg || "") }, 401);
      return J({ text: bodyText(j).slice(0, 20000) });
    }
    if (!q) return J({ error: "검색어(q)가 없습니다" }, 400);
    const r = await fetch(`${base}lawSearch.do?OC=${encodeURIComponent(oc)}&target=${target}&type=JSON&display=${org ? 50 : n}&query=${encodeURIComponent(q)}`, H);
    const t = await r.text(); let j; try { j = JSON.parse(t); } catch { return J({ error: "검색 응답을 읽지 못했습니다", raw: t.slice(0, 200) }, 502); }
    if (j.result && /실패/.test(j.result)) return J({ error: j.result + " " + (j.msg || "") }, 401);
    let list = items(j).map((x) => target === "law"
      ? { name: x["법령명한글"], mst: x["법령일련번호"], kind: x["법령구분명"] || "", org: x["소관부처명"] || "", date: x["시행일자"] || "" }
      : { name: x["자치법규명"], mst: x["자치법규일련번호"], kind: x["자치법규종류"] || "", org: x["지자체기관명"] || "", date: x["시행일자"] || "" });
    if (org) list = list.filter((x) => (x.org + x.name).includes(org));
    list = list.filter((x) => x.name && x.mst).slice(0, n)
      .map((x) => ({ ...x, url: `https://www.law.go.kr/${target === "law" ? "법령" : "자치법규"}/${encodeURIComponent(x.name)}` }));
    return J({ list });
  } catch (e) {
    return J({ error: "law.go.kr 연결 실패: " + e.message }, 502);
  }
};
