// Cloudflare Worker: chuyển tiếp dữ liệu thị trường kèm tiêu đề CORS cho ứng dụng Wyckoff VN trên iPhone.
// Dùng: GET https://<worker>.workers.dev/?u=<URL đã mã hóa>
const ALLOW = new Set([
  "dchart-api.vndirect.com.vn", "api-finfo.vndirect.com.vn", "finfo-api.vndirect.com.vn",
  "histdatafeed.vps.com.vn", "bgapidatafeed.vps.com.vn", "apipubaws.tcbs.com.vn",
]);
const REF = {
  "dchart-api.vndirect.com.vn": "https://dchart.vndirect.com.vn/",
  "api-finfo.vndirect.com.vn": "https://dstock.vndirect.com.vn/",
  "finfo-api.vndirect.com.vn": "https://dstock.vndirect.com.vn/",
  "histdatafeed.vps.com.vn": "https://bgapidatafeed.vps.com.vn/",
  "bgapidatafeed.vps.com.vn": "https://banggia.vps.com.vn/",
  "apipubaws.tcbs.com.vn": "https://tcinvest.tcbs.com.vn/",
};
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET,OPTIONS", "Access-Control-Allow-Headers": "*" };
export default {
  async fetch(req) {
    if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
    const u = new URL(req.url).searchParams.get("u");
    if (!u) return new Response("Wyckoff proxy OK", { headers: CORS });
    let t; try { t = new URL(u); } catch { return new Response("bad url", { status: 400, headers: CORS }); }
    if (t.protocol !== "https:" || !ALLOW.has(t.hostname)) return new Response("host not allowed", { status: 403, headers: CORS });
    const ref = REF[t.hostname];
    const r = await fetch(t.toString(), { headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      "Accept": "*/*", "Accept-Language": "vi-VN,vi;q=0.9", "Referer": ref, "Origin": ref.replace(/\/$/, "") } });
    const h = new Headers(CORS); h.set("Content-Type", r.headers.get("Content-Type") || "application/json");
    h.set("Cache-Control", "no-store");
    return new Response(r.body, { status: r.status, headers: h });
  },
};
