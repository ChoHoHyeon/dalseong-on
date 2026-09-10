// 접속자 IP 확인 (Netlify Functions 2.0)
// 실제 구축 시에는 새올 SSO에서 받은 사용자 정보로 대체
export const config = { path: "/api/whoami" };

export default async (req, context) => {
  const h = req.headers;
  const ip =
    h.get("x-nf-client-connection-ip") ||
    (h.get("x-forwarded-for") || "").split(",")[0].trim() ||
    context?.ip ||
    "";
  return new Response(JSON.stringify({ ip }), {
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
};
