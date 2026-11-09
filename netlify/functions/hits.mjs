// 달성On — 전 직원 이용 집계 (Netlify Functions 2.0 + Netlify Blobs)
//  POST /api/hits {k:'use'|'gen'|'q', m:'meal'}  : 1건 더하기 (누가 썼는지는 저장하지 않음 — 날짜·메뉴·종류 숫자만)
//  GET  /api/hits                               : 이번 주(월~일) 합계 · 메뉴별 순위 · 오늘 · 누적
import { getStore } from "@netlify/blobs";
export const config = { path: "/api/hits" };
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const kst = (d = new Date()) => new Date(d.getTime() + 9 * 3600e3);              // 한국 시간
const day = d => kst(d).toISOString().slice(0, 10);
const K = new Set(["use", "gen", "q"]);
const M = /^[a-z]{2,12}$/;

export default async (req) => {
  const st = getStore({ name: "hits", consistency: "strong" });
  if (req.method === "POST") {
    let b; try { b = await req.json(); } catch { return json({ error: "bad" }, 400); }
    const k = K.has(b.k) ? b.k : null, m = M.test(b.m || "") ? b.m : "etc";
    if (!k) return json({ error: "k" }, 400);
    const key = "d:" + day();
    const d = (await st.get(key, { type: "json" })) || {};
    d[k] = (d[k] || 0) + 1; if (k === "use") d["m:" + m] = (d["m:" + m] || 0) + 1;
    await st.setJSON(key, d);
    const t = (await st.get("total", { type: "json" })) || {}; t[k] = (t[k] || 0) + 1; await st.setJSON("total", t);
    return json({ ok: true });
  }
  if (req.method === "GET") {
    const now = kst(); const dow = (now.getUTCDay() + 6) % 7;                    // 월=0
    const days = [...Array(dow + 1)].map((_, i) => new Date(Date.now() - (dow - i) * 864e5));
    const week = { use: 0, gen: 0, q: 0 }, menu = {}; let today = { use: 0, gen: 0, q: 0 };
    for (const d of days) {
      const o = (await st.get("d:" + day(d), { type: "json" })) || {};
      for (const k of K) week[k] += o[k] || 0;
      for (const [kk, v] of Object.entries(o)) if (kk.startsWith("m:")) menu[kk.slice(2)] = (menu[kk.slice(2)] || 0) + v;
      if (day(d) === day()) today = { use: o.use || 0, gen: o.gen || 0, q: o.q || 0 };
    }
    const total = (await st.get("total", { type: "json" })) || {};
    const top = Object.entries(menu).sort((a, b) => b[1] - a[1]).slice(0, 5);
    return json({ ok: true, week, today, total: { use: total.use || 0, gen: total.gen || 0, q: total.q || 0 }, top });
  }
  return json({ error: "Method Not Allowed" }, 405);
};
