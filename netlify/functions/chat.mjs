// 달성On — Anthropic API 프록시 (Netlify Functions 2.0, 스트리밍)
// 키는 Netlify 환경변수 ANTHROPIC_API_KEY 에만 존재. 브라우저·GitHub에는 절대 노출되지 않음.
// 선택: ACCESS_CODE 환경변수를 두면 같은 코드를 보낸 요청만 허용 (시연용 간단 잠금)
import { guard } from "../lib/guard.mjs";
export const config = { path: "/api/chat" };
const MODELS = ["claude-sonnet-4-5", "claude-haiku-4-5"];   // 비싼 모델은 서버에서 막는다

export default async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return new Response(JSON.stringify({ error: "서버에 ANTHROPIC_API_KEY 환경변수가 없습니다 (Netlify › Site configuration › Environment variables)" }), { status: 500, headers: { "content-type": "application/json" } });
  const gate = process.env.ACCESS_CODE;
  const codeOk = !gate || req.headers.get("x-access-code") === gate;
  let probe = null; try { probe = await req.clone().json(); } catch {}
  if (probe && probe.ping) return new Response(JSON.stringify({ ok: true, gate: !!gate, codeOk }), { headers: { "content-type": "application/json" } });
  if (!codeOk) return new Response(JSON.stringify({ error: "접속 코드가 맞지 않습니다 (관리자 › 모델 설정)" }), { status: 401, headers: { "content-type": "application/json" } });
  const g = await guard(req, "chat", 400); if (g) return g;

  let body;
  try { body = await req.json(); } catch { return new Response("Bad Request", { status: 400 }); }
  const payload = {
    model: MODELS.includes(body.model) ? body.model : "claude-sonnet-4-5",
    max_tokens: Math.min(body.max_tokens || 1200, 8000),
    stream: true,
    system: String(body.system || "").slice(0, 8000),
    messages: (body.messages || []).slice(-8),
  };
  // 도구는 법령 웹검색만 허용 (law.go.kr · elis.go.kr 도메인 한정, 최대 6회)
  if (Array.isArray(body.tools)) {
    const ws = body.tools.find((t) => t && t.type === "web_search_20250305");
    if (ws) payload.tools = [{ type: "web_search_20250305", name: "web_search", max_uses: Math.min(+ws.max_uses || 4, 6), allowed_domains: ["law.go.kr", "elis.go.kr"] }];
  }
  const up = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify(payload),
  });
  if (!up.ok) { const t = await up.text(); return new Response(t, { status: up.status, headers: { "content-type": "application/json" } }); }
  return new Response(up.body, { status: 200, headers: { "content-type": "text/event-stream", "cache-control": "no-cache" } });
};
