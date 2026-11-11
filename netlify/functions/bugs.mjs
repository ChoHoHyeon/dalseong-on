// 달성On — 오류 신고·건의 접수함 (Netlify Functions 2.0 + Netlify Blobs)
//  POST /api/bugs  : 한 건 접수
//  GET  /api/bugs  : 접수된 목록 (누구나 조회)
// 개인정보는 담지 않는다 — 연락처 칸은 선택이며 「부서·이름·내선」 정도만 적도록 안내한다.
import { getStore } from "@netlify/blobs";
import { guard, originOk } from "../lib/guard.mjs";
// 공개 목록에서는 이름을 가린다(홍길동 → 홍*동). 관리자 코드가 맞으면 그대로.
const maskName = (w) => String(w || "").split(/\s+/).map(t => /^[가-힣]{2,4}$/.test(t) && !/(과|팀|실|읍|면|소|원|청|국|단|센터|담당|주무관|팀장|과장)$/.test(t) ? t[0] + "*".repeat(Math.max(1, t.length - 2)) + (t.length > 2 ? t.slice(-1) : "") : /^\d{3,4}$/.test(t) ? "****" : t).join(" ");   // 이름은 가운데 가리고, 내선번호도 가린다

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
    const code = process.env.ADMIN_CODE || process.env.VIDEO_ADMIN_CODE || process.env.ACCESS_CODE;
    const admin = !!code && req.headers.get("x-admin-code") === code;
    return json({ ok: true, admin, list: admin ? list : list.map(x => ({ ...x, who: maskName(x.who) })) });
  }

  if (req.method === "POST") {
    if (!originOk(req)) return json({ error: "달성On 화면에서만 사용할 수 있습니다" }, 403);
    let b;
    try { b = await req.json(); } catch { return json({ error: "형식이 올바르지 않습니다" }, 400); }

    // 공감 누르기/취소 — 공감 수(likes)만 따로 센다 (화면 폭 w 와 섞지 않음)
    if (b.action === "like") {
      const list = (await store.get(KEY, { type: "json" })) || [];
      const i = list.findIndex(x => x.id === b.id); if (i < 0) return json({ error: "없는 글입니다" }, 404);
      list[i].likes = Math.max(0, (list[i].likes || 0) + (b.on ? 1 : -1));
      await store.setJSON(KEY, list);
      return json({ ok: true, likes: list[i].likes });
    }

    { const g = await guard(req, "bugs", 40); if (g) return g; }   // 글 올리기: 같은 곳에서 하루 40건까지
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

  // 관리자: 상태 바꾸기(접수 → 검토 → 반영) · 지우기 — ADMIN_CODE(없으면 ACCESS_CODE) 환경변수와 같은 코드를 보낸 요청만
  if (req.method === "PATCH" || req.method === "DELETE") {
    const code = process.env.ADMIN_CODE || process.env.VIDEO_ADMIN_CODE || process.env.ACCESS_CODE;
    if (!code) return json({ error: "서버에 ADMIN_CODE 환경변수가 없습니다 (Netlify › Environment variables)" }, 500);
    if (req.headers.get("x-admin-code") !== code) return json({ error: "관리자 코드가 맞지 않습니다" }, 401);
    let b; try { b = await req.json(); } catch { return json({ error: "형식이 올바르지 않습니다" }, 400); }
    const list = (await store.get(KEY, { type: "json" })) || [];
    const i = list.findIndex(x => x.id === b.id); if (i < 0) return json({ error: "없는 글입니다" }, 404);
    if (req.method === "DELETE") list.splice(i, 1);
    else { const w = ["접수", "검토", "반영", "미반영"].includes(b.where) ? b.where : null; if (!w) return json({ error: "상태값" }, 400); list[i].st = w; if (["접수","검토","반영","미반영"].includes(list[i].where)) list[i].where = w; list[i].done = new Date().toISOString(); }
    await store.setJSON(KEY, list);
    return json({ ok: true });
  }

  return new Response("Method Not Allowed", { status: 405 });
};
