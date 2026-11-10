// 달성On — 홍보영상 AI 장면 영상 (fal.ai · Wan 2.2 Turbo 그림→영상) · 하루 생성 한도 (Netlify Functions 2.0 + Blobs)
//  POST /api/video {ping:1}                         → {hasKey, model, limit, used}
//  POST /api/video {action:'start'}                 → 오늘 한도 확인 후 1편 접수 → {ticket, used, limit}  (한도 초과 시 429)
//  POST /api/video {action:'clip', ticket, image, prompt} → fal 대기열에 장면 1개 접수 → {rid}
//  GET  /api/video?rid=...                          → {status:'queued'|'running'|'done'|'error', url?}
//  GET  /api/video?file=<fal 영상 주소>              → 영상 파일 중계(브라우저가 직접 못 받을 때만)
// 키는 Netlify 환경변수 FAL_KEY 에만 존재(브라우저·GitHub 노출 없음). 원본 문서는 보내지 않는다 — AI가 그린 그림 1장 + 움직임 설명 한 줄만.
// 선택: FAL_VIDEO_MODEL(기본 Wan 2.2 Turbo i2v) · VIDEO_DAY_LIMIT(사이트 전체 하루 상한 — 기본 없음) · VIDEO_ADMIN_CODE(한도 없는 관리자 코드) · ACCESS_CODE
import { getStore } from "@netlify/blobs";
import { originOk, guard } from "../lib/guard.mjs";

export const config = { path: "/api/video" };
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const kst = () => new Date(Date.now() + 9 * 3600e3);
const today = () => kst().toISOString().slice(0, 10);
const CLIPS = 4;                                        // 영상 1편 = AI 장면 4개
const FILE_OK = /^https:\/\/([a-z0-9-]+\.)*(fal\.media|fal\.run|fal\.ai)\/|^https:\/\/storage\.googleapis\.com\/falserverless\//i;

export default async (req) => {
  const key = process.env.FAL_KEY || process.env.Fal_Key || process.env.fal_key;   // 환경변수 이름 대소문자 차이 허용
  const model = process.env.FAL_VIDEO_MODEL || "fal-ai/wan/v2.2-a14b/image-to-video/turbo";
  const limit = process.env.VIDEO_DAY_LIMIT ? Math.max(0, +process.env.VIDEO_DAY_LIMIT) : Infinity;   // 사이트 전체 한도는 두지 않는다(잔액 소진 시 충전). 필요하면 환경변수로만 켠다
  const adminCode = process.env.ADMIN_CODE || process.env.VIDEO_ADMIN_CODE;                // 관리자(시험용) 코드 — 관리자 › 모델 설정 「접속 코드」에 넣으면 하루 한도 없이 만든다
  const isAdmin = !!adminCode && (req.headers.get("x-admin-code") === adminCode || req.headers.get("x-access-code") === adminCode);
  const gate = process.env.ACCESS_CODE;
  const codeOk = !gate || req.headers.get("x-access-code") === gate || (!!process.env.VIDEO_ADMIN_CODE && req.headers.get("x-access-code") === process.env.VIDEO_ADMIN_CODE);
  const st = getStore({ name: "video", consistency: "strong" });
  const auth = { authorization: "Key " + key };
  const url = new URL(req.url);

  if (req.method === "GET") {
    const file = url.searchParams.get("file");
    if (file) {                                         // 영상 파일 중계 (fal 저장소 주소만)
      if (!FILE_OK.test(file)) return json({ error: "file" }, 400);
      const r = await fetch(file);
      if (!r.ok) return json({ error: "fetch " + r.status }, 502);
      return new Response(r.body, { headers: { "content-type": r.headers.get("content-type") || "video/mp4", "cache-control": "no-store" } });
    }
    const rid = url.searchParams.get("rid") || "";
    if (!/^[a-z0-9-]{8,64}$/i.test(rid)) return json({ error: "rid" }, 400);
    if (!key) return json({ status: "error", error: "FAL_KEY 없음" });
    const j = await st.get("r:" + rid, { type: "json" });
    if (!j) return json({ status: "error", error: "접수 기록 없음" }, 404);
    try {
      const s = await fetch(j.status_url, { headers: auth });
      const sj = await s.json().catch(() => ({}));
      if (sj.status === "COMPLETED") {
        const o = await (await fetch(j.response_url, { headers: auth })).json().catch(() => ({}));
        const v = o?.video?.url;
        if (!v) return json({ status: "error", error: String(JSON.stringify(o?.detail || o).slice(0, 300)) });
        st.delete("r:" + rid).catch(() => {});
        return json({ status: "done", url: v });
      }
      if (sj.status === "IN_QUEUE") return json({ status: "queued", pos: sj.queue_position ?? null });
      if (sj.status === "IN_PROGRESS") return json({ status: "running" });
      return json({ status: "error", error: String(JSON.stringify(sj).slice(0, 300)) });
    } catch (e) { return json({ status: "running", note: String(e.message || e) }); }
  }

  if (req.method !== "POST") return json({ error: "Method Not Allowed" }, 405);
  if (!originOk(req)) return json({ error: "달성On 화면에서만 사용할 수 있습니다" }, 403);
  let b; try { b = await req.json(); } catch { return json({ error: "Bad Request" }, 400); }
  const day = await st.get("d:" + today(), { type: "json" }) || { n: 0 };
  if (b.ping) return json({ ok: true, hasKey: !!key, model, limit: Number.isFinite(limit) ? limit : null, used: day.n, codeOk, admin: isAdmin });
  if (!codeOk) return json({ error: "접속 코드가 맞지 않습니다" }, 401);
  if (!key) return json({ error: "nokey" }, 503);

  if (b.action === "start") {
    if (!isAdmin) {
      { const g = await guard(req, "video", 5); if (g) return json({ error: "mine", limit: 5 }, 429); }   // 1인(같은 접속 위치) 하루 5편 — 서버에서 센다
      if (day.n >= limit) return json({ error: "limit", limit, used: day.n }, 429);
      day.n += 1; await st.setJSON("d:" + today(), day);
    }
    const ticket = (globalThis.crypto?.randomUUID?.() || String(Date.now()) + Math.random().toString(36).slice(2)).replace(/[^a-z0-9-]/gi, "").toLowerCase();
    await st.setJSON("t:" + ticket, { left: CLIPS, day: today(), t: Date.now() });
    return json({ ok: true, ticket, used: day.n, limit });
  }

  if (b.action === "clip") {
    const ticket = String(b.ticket || "");
    if (!/^[a-z0-9-]{8,64}$/.test(ticket)) return json({ error: "ticket" }, 400);
    const t = await st.get("t:" + ticket, { type: "json" });
    if (!t || t.left <= 0) return json({ error: "이 영상의 장면 수를 모두 썼습니다" }, 429);
    const image = typeof b.image === "string" && b.image.startsWith("data:image/") && b.image.length < 6_000_000 ? b.image : null;
    if (!image) return json({ error: "image" }, 400);
    const prompt = String(b.prompt || "").slice(0, 1200) || "Smooth natural motion, gentle camera movement.";
    const r = await fetch("https://queue.fal.run/" + model, {
      method: "POST", headers: { ...auth, "content-type": "application/json" },
      body: JSON.stringify({ image_url: image, prompt, resolution: "580p", aspect_ratio: "9:16", enable_safety_checker: true, enable_prompt_expansion: false, acceleration: "regular", video_quality: "high" })
    });
    const txt = await r.text(); let j = {}; try { j = JSON.parse(txt); } catch {}
    if (!r.ok || !j.request_id) return json({ error: "영상 접수 실패 " + r.status + ": " + txt.slice(0, 300) }, 502);
    t.left -= 1; await st.setJSON("t:" + ticket, t);
    await st.setJSON("r:" + j.request_id, { status_url: j.status_url, response_url: j.response_url, t: Date.now() });
    return json({ ok: true, rid: j.request_id });
  }
  return json({ error: "action" }, 400);
};
