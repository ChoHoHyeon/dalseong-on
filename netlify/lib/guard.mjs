// 달성On — 서버 함수 공통 보호막
//  ① 출처 확인: 달성On 화면(ds-on.netlify.app · 배포 미리보기 · 내 PC 시험)에서 온 요청만 받는다 → 다른 사이트·스크립트가 키를 빌려 쓰지 못하게
//  ② 접속자(IP)별 하루 사용 한도: 같은 곳에서 한도를 넘게 부르면 429 → 비용 폭주·남용 방지 (IP 원문은 저장하지 않고 해시만)
import { getStore } from "@netlify/blobs";
const OK_HOST = /^(ds-on\.netlify\.app|[a-z0-9-]+--ds-on\.netlify\.app|localhost(:\d+)?|127\.0\.0\.1(:\d+)?)$/i;
const json = (o, s) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json", "cache-control": "no-store" } });
export function originOk(req) {
  const src = req.headers.get("origin") || req.headers.get("referer") || "";
  try { return OK_HOST.test(new URL(src).host); } catch { return false; }
}
async function hash(s) { const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("dson:" + s)); return [...new Uint8Array(d)].slice(0, 10).map(b => b.toString(16).padStart(2, "0")).join(""); }
/** 막아야 하면 Response를, 통과면 null을 돌려준다 */
export async function guard(req, name, perDay, context) {
  if (!originOk(req)) return json({ error: "달성On 화면에서만 사용할 수 있습니다" }, 403);
  if (!perDay) return null;
  const ip = req.headers.get("x-nf-client-connection-ip") || (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || context?.ip || "unknown";
  const day = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
  try {
    const st = getStore({ name: "guard", consistency: "strong" });
    const k = `${name}:${day}:${await hash(ip)}`;
    const n = (+(await st.get(k)) || 0) + 1;
    if (n > perDay) return json({ error: `오늘 사용 한도(${perDay}회)를 넘었습니다. 내일 다시 이용해 주세요.` }, 429);
    await st.set(k, String(n));
  } catch (e) { /* 저장소 오류 시에는 막지 않는다 */ }
  return null;
}
