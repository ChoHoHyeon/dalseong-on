// 달성On — 경조사 카드 AI 생성 백그라운드 작업 (Netlify Background Function, 최대 15분)
//  1) OpenAI Images API로 카드 생성 (사진 있으면 edits, 없으면 generations)
//  2) 생성된 카드의 글자를 비전 모델로 다시 읽어 입력 문안과 대조 (계좌·날짜 오류 방지)
//  3) 결과를 Blobs job:<id> 에 저장 → /api/card?id= 로 조회
import { getStore } from "@netlify/blobs";

export const config = { path: "/api/card-run", background: true };

const norm = s => String(s || "").replace(/[\s ]/g, "").replace(/[()\[\]{}·.,:;·\-–—~_/'"“”‘’]/g, "").toLowerCase();

export default async (req) => {
  let id = ""; try { id = (await req.json()).id || ""; } catch {}
  if (!/^[a-z0-9-]{8,40}$/.test(id)) return;
  const store = getStore({ name: "cards", consistency: "strong" });
  const job = await store.get("req:" + id, { type: "json" });
  if (!job) return;
  const key = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";
  const vmodel = process.env.OPENAI_VERIFY_MODEL || "gpt-4.1-mini";
  await store.setJSON("job:" + id, { status: "running", t: Date.now() });

  try {
    // ── 1. 생성 ──
    let r;
    if (job.photo) {
      const m = job.photo.match(/^data:(image\/[a-z]+);base64,(.+)$/);
      const bin = Buffer.from(m[2], "base64");
      const fd = new FormData();
      fd.append("model", model);
      fd.append("prompt", job.prompt);
      fd.append("size", job.size);
      fd.append("quality", job.quality || "medium");
      fd.append("input_fidelity", "high");
      fd.append("output_format", "jpeg");
      fd.append("image", new Blob([bin], { type: m[1] }), "photo." + (m[1].split("/")[1] || "jpg"));
      r = await fetch("https://api.openai.com/v1/images/edits", { method: "POST", headers: { authorization: "Bearer " + key }, body: fd });
    } else {
      r = await fetch("https://api.openai.com/v1/images/generations", { method: "POST", headers: { authorization: "Bearer " + key, "content-type": "application/json" },
        body: JSON.stringify({ model, prompt: job.prompt, size: job.size, quality: job.quality || "medium", output_format: "jpeg", n: 1 }) });
    }
    if (!r.ok) { const t = await r.text(); await store.setJSON("job:" + id, { status: "error", error: "이미지 생성 실패 " + r.status + ": " + t.slice(0, 400) }); return; }
    const out = await r.json();
    const b64 = out?.data?.[0]?.b64_json;
    if (!b64) { await store.setJSON("job:" + id, { status: "error", error: "이미지 응답이 비었습니다" }); return; }
    const image = "data:image/jpeg;base64," + b64;

    // ── 2. 글자 검증 (실패해도 카드는 내준다) ──
    let verify = null;
    if (job.expect && job.expect.length) {
      try {
        const vr = await fetch("https://api.openai.com/v1/chat/completions", { method: "POST", headers: { authorization: "Bearer " + key, "content-type": "application/json" },
          body: JSON.stringify({ model: vmodel, max_tokens: 800, temperature: 0,
            messages: [{ role: "user", content: [
              { type: "text", text: "이 이미지에 적힌 모든 글자를 있는 그대로, 줄 단위로 빠짐없이 옮겨 적어 주세요. 해석하지 말고 보이는 대로만 적습니다. 숫자·기호도 정확히." },
              { type: "image_url", image_url: { url: image, detail: "high" } } ] }] }) });
        if (vr.ok) {
          const vj = await vr.json();
          const ocr = vj?.choices?.[0]?.message?.content || "";
          const hay = norm(ocr);
          const missing = job.expect.filter(line => { const n = norm(line); return n.length >= 2 && !hay.includes(n); });
          verify = { ok: missing.length === 0, missing, ocr: ocr.slice(0, 2000) };
        } else { verify = { ok: null, note: "검증 모델 호출 실패 " + vr.status }; }
      } catch (e) { verify = { ok: null, note: "검증 실패: " + e.message }; }
    }
    await store.setJSON("job:" + id, { status: "done", image, verify, model, usage: out.usage || null, t: Date.now() });
  } catch (e) {
    await store.setJSON("job:" + id, { status: "error", error: String(e.message || e) });
  }
};
