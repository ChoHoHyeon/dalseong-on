// 달성On — 관리자 코드 확인 (Netlify Functions 2.0)
//  POST /api/admin {code} → {ok:true|false}
// 코드는 Netlify 환경변수 ADMIN_CODE(없으면 VIDEO_ADMIN_CODE)에만 있다. 화면·GitHub에는 없다.
export const config = { path: "/api/admin" };
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json", "cache-control": "no-store" } });
export default async (req) => {
  if (req.method !== "POST") return json({ error: "Method Not Allowed" }, 405);
  let b; try { b = await req.json(); } catch { return json({ ok: false }, 400); }
  const code = process.env.ADMIN_CODE || process.env.VIDEO_ADMIN_CODE;
  if (!code) return json({ ok: false, error: "서버에 관리자 코드가 설정되지 않았습니다" });
  await new Promise(r => setTimeout(r, 400));                       // 마구 넣어 보기 방지
  return json({ ok: String(b.code || "") === code });
};
