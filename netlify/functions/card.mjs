// 달성On — 경조사 카드 AI 생성 (OpenAI gpt-image) · 접수/조회 (Netlify Functions 2.0 + Blobs)
//  POST /api/card {ping:1}                      → 서버 상태 (키 유무·모델)
//  POST /api/card {action:'start', ...}         → 작업 접수 → 백그라운드 함수(card-run) 호출 → {id}
//  GET  /api/card?id=...                        → {status:'queued'|'running'|'done'|'error', image?, verify?, error?}
// 키는 Netlify 환경변수 OPENAI_API_KEY 에만 존재. 브라우저·GitHub에 노출되지 않는다.
// 선택: OPENAI_IMAGE_MODEL(기본 gpt-image-2) · OPENAI_VERIFY_MODEL(기본 gpt-4.1-mini) · ACCESS_CODE(시연용 잠금)
import { getStore } from "@netlify/blobs";

export const config = { path: "/api/card" };
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

export default async (req) => {
  const key = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";
  const gate = process.env.ACCESS_CODE;
  const codeOk = !gate || req.headers.get("x-access-code") === gate;
  const store = getStore({ name: "cards", consistency: "strong" });

  if (req.method === "GET") {
    const id = new URL(req.url).searchParams.get("id") || "";
    if (!/^[a-z0-9-]{8,40}$/.test(id)) return json({ error: "id" }, 400);
    const job = await store.get("job:" + id, { type: "json" });
    if (!job) return json({ status: "none" }, 404);
    if (job.status === "done" || job.status === "error") {
      // 결과는 한 번 내주고 지운다 (사진·문안을 오래 보관하지 않는다)
      store.delete("job:" + id).catch(() => {});
      store.delete("req:" + id).catch(() => {});
    }
    return json(job);
  }

  if (req.method !== "POST") return json({ error: "Method Not Allowed" }, 405);
  let b; try { b = await req.json(); } catch { return json({ error: "Bad Request" }, 400); }
  if (b.ping) return json({ ok: true, hasKey: !!key, model, gate: !!gate, codeOk });
  if (!codeOk) return json({ error: "접속 코드가 맞지 않습니다 (관리자 › 모델 설정)" }, 401);
  if (!key) return json({ error: "서버에 OPENAI_API_KEY 환경변수가 없습니다 (Netlify › Site configuration › Environment variables)" }, 500);
  if (b.action !== "start") return json({ error: "action" }, 400);

  const prompt = String(b.prompt || "").slice(0, 6000);
  if (!prompt) return json({ error: "prompt" }, 400);
  const photo = typeof b.photo === "string" && b.photo.startsWith("data:image/") && b.photo.length < 6_000_000 ? b.photo : null;
  const size = ["1024x1536", "1536x1024", "1024x1024", "auto"].includes(b.size) ? b.size : "1024x1536";
  const expect = Array.isArray(b.expect) ? b.expect.map(x => String(x).slice(0, 200)).slice(0, 20) : [];
  const id = (globalThis.crypto?.randomUUID?.() || String(Date.now()) + Math.random().toString(36).slice(2)).replace(/[^a-z0-9-]/gi, "").toLowerCase();

  await store.setJSON("req:" + id, { prompt, photo, size, expect, quality: ["high", "low"].includes(b.quality) ? b.quality : "medium", t: Date.now() });
  await store.setJSON("job:" + id, { status: "queued", t: Date.now() });

  // 백그라운드 함수 호출 (202로 바로 돌아오고, 실제 생성은 최대 15분까지 이어서 진행)
  const origin = new URL(req.url).origin;
  try {
    const r = await fetch(origin + "/api/card-run", { method: "POST", headers: { "content-type": "application/json", "x-access-code": req.headers.get("x-access-code") || "" }, body: JSON.stringify({ id }) });
    if (r.status !== 202 && !r.ok) { await store.setJSON("job:" + id, { status: "error", error: "백그라운드 함수 호출 실패 " + r.status }); }
  } catch (e) { await store.setJSON("job:" + id, { status: "error", error: "백그라운드 함수 호출 실패: " + e.message }); }
  return json({ ok: true, id });
};
