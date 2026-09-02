// Receives partner intake submissions and stores them in KV.
// Read them back from the CLI:
//   wrangler kv key list   --binding=PARTNER_INTAKE --remote
//   wrangler kv key get "<key>" --binding=PARTNER_INTAKE --remote
// There is deliberately no read endpoint — submissions contain commercial
// pricing data and should not be reachable over HTTP.

const MAX_BYTES = 128 * 1024;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);

    const raw = await request.text();
    if (raw.length > MAX_BYTES) return json({ error: "too_large" }, 413);

    let payload;
    try {
      payload = JSON.parse(raw);
    } catch {
      return json({ error: "invalid_json" }, 400);
    }

    // Honeypot: real respondents never fill this hidden field.
    if (payload.website_url) return json({ ok: true, id: "skipped" });

    const firm = String(payload.firm_name || "").trim();
    if (!firm) return json({ error: "firm_name_required" }, 400);

    const id = `${new Date().toISOString().replace(/[:.]/g, "-")}-${crypto
      .randomUUID()
      .slice(0, 8)}`;

    const record = {
      id,
      received_at: new Date().toISOString(),
      ip_country: request.headers.get("cf-ipcountry") || null,
      answers: payload,
    };

    await env.PARTNER_INTAKE.put(`sub:${id}`, JSON.stringify(record));
    return json({ ok: true, id });
  },
};
