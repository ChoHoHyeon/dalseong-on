// 달성On — 오류 신고·건의 접수함 (Netlify Functions 2.0 + Netlify Blobs)
//  POST /api/bugs  : 한 건 접수
//  GET  /api/bugs  : 접수된 목록 (누구나 조회)
// 개인정보는 담지 않는다 — 연락처 칸은 선택이며 「부서·이름·내선」 정도만 적도록 안내한다.
import { getStore } from "@netlify/blobs";

export const config = { path: "/api/bugs" };

const KEY = "list";
const MAX = 300;                       // 오래된 것부터 밀어낸다
const cut = (v, n) => String(v ?? "").replace(/\s+$/, "").slice(0, n);
const json = (o, status = 200) =>
  new Response(JSON.stringify(o), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

export default async (req) => {
  const store = getStore({ name: "bugs", consistency: "strong" });

  if (req.method === "GET") {
    const list = (await store.get(KEY, { type: "json" })) || [];
    return json({ ok: true, list });
  }

  if (req.method === "POST") {
    let b;
    try { b = await req.json(); } catch { return json({ error: "형식이 올바르지 않습니다" }, 400); }

    const text = cut(b.text, 1000).trim();
    if (!text) return json({ error: "내용을 적어 주세요" }, 400);

    const item = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      at: new Date().toISOString(),
      where: cut(b.where, 60),
      kind: cut(b.kind, 20),
      text,
      who: cut(b.who, 60),
      w: Number(b.w) || 0,
    };

    const list = (await store.get(KEY, { type: "json" })) || [];
    list.unshift(item);
    await store.setJSON(KEY, list.slice(0, MAX));
    return json({ ok: true, item, n: Math.min(list.length, MAX) });
  }

  return new Response("Method Not Allowed", { status: 405 });
};
