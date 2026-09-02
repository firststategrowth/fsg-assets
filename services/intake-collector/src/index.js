// Receives partner intake submissions, stores them in KV, and emails a
// readable summary to the team.
//
// KV is the durable record. Email is best-effort: if the mail provider is
// unconfigured or fails, the submission is still saved and the respondent
// still sees success. Never fail a submission because email failed.
//
// Read submissions from the CLI:
//   wrangler kv key list --namespace-id=<id> --remote
//   wrangler kv key get "sub:<id>" --namespace-id=<id> --remote
//
// To enable email, set two secrets (no redeploy needed):
//   wrangler secret put RESEND_API_KEY
//   wrangler secret put NOTIFY_TO

const MAX_BYTES = 128 * 1024;
const FROM = "First State Growth Intake <onboarding@resend.dev>";

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

// Readable labels for the form fields, grouped as the form is.
const SECTIONS = [
  ["The firm", [
    ["firm_name", "Firm name"],
    ["city", "City"],
    ["country", "Country"],
    ["founded", "Started in"],
    ["team", "Consultants on staff"],
    ["website", "Website"],
    ["contact_name", "Contact"],
    ["contact_role", "Role"],
    ["contact_email", "Email"],
    ["contact_phone", "Phone / WhatsApp"],
  ]],
  ["Capability", [
    ["standards", "Standards delivered"],
    ["standards_other", "Other standards"],
    ["strongest_standard", "Strongest in"],
    ["volume", "Clients certified, last 2 years"],
  ]],
  ["Qualifications", [
    ["lead_auditor", "Lead Auditor / Implementer"],
    ["issuer", "Issued by"],
    ["sec_certs", "Security qualifications"],
    ["own_certification", "Firm's own certification"],
    ["can_share_certs", "Will share certificates"],
  ]],
  ["Certification bodies", [
    ["cbs", "Bodies worked with"],
    ["cbs_other", "Other bodies"],
    ["pass_rate", "Pass first time (out of 10)"],
  ]],
  ["International readiness", [
    ["intl_experience", "Worked outside India"],
    ["intl_countries", "Countries"],
    ["us_hours", "Can work US hours"],
    ["delivery_mode", "Delivery style"],
    ["nda", "Will sign NDA"],
    ["security", "Document security"],
  ]],
  ["Pricing", [
    ["fee_model", "Charging model"],
    ["typical_fee_small", "Typical fee, small client"],
    ["day_rate", "Day rate"],
  ]],
  ["Partnership", [
    ["interest", "Wants referred work"],
    ["arrangement", "Preferred arrangement"],
    ["referral_share", "Fair referral share"],
    ["references", "Can give references"],
    ["capacity", "Availability"],
  ]],
  ["Other", [
    ["notes", "Notes"],
    ["consent", "Consented to anonymised use"],
  ]],
];

const ENG_FIELDS = [
  ["standard", "Standard"],
  ["country", "Client country"],
  ["employees", "Client staff"],
  ["sites", "Sites"],
  ["audit_days", "Audit days"],
  ["cb_fee", "Certification body fee"],
  ["our_fee", "Their fee"],
  ["duration", "Duration"],
];

const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const val = (v) => (Array.isArray(v) ? v.join(", ") : String(v ?? "").trim());

function buildEmail(record) {
  const a = record.answers || {};
  const lines = [];
  const html = [];

  html.push(
    `<div style="font:15px/1.6 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#14161a;max-width:680px">`,
    `<p style="margin:0 0 4px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#1c4f8a;font-weight:700">Partner intake</p>`,
    `<h2 style="margin:0 0 2px;font-size:22px">${esc(val(a.firm_name) || "Unnamed firm")}</h2>`,
    `<p style="margin:0 0 22px;color:#5f6672;font-size:13.5px">Received ${esc(record.received_at)}${
      record.ip_country ? ` · submitted from ${esc(record.ip_country)}` : ""
    }</p>`
  );

  for (const [title, fields] of SECTIONS) {
    const rows = fields
      .map(([k, label]) => [label, val(a[k])])
      .filter(([, v]) => v !== "");
    if (!rows.length) continue;

    lines.push(`\n== ${title} ==`);
    html.push(
      `<h3 style="margin:24px 0 8px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#5f6672">${esc(
        title
      )}</h3>`,
      `<table style="width:100%;border-collapse:collapse">`
    );
    for (const [label, v] of rows) {
      lines.push(`${label}: ${v}`);
      html.push(
        `<tr>` +
          `<td style="padding:6px 12px 6px 0;color:#5f6672;font-size:14px;vertical-align:top;width:42%;border-bottom:1px solid #e0e2e6">${esc(
            label
          )}</td>` +
          `<td style="padding:6px 0;font-size:14px;vertical-align:top;border-bottom:1px solid #e0e2e6"><strong>${esc(
            v
          )}</strong></td>` +
          `</tr>`
      );
    }
    html.push(`</table>`);
  }

  // Project pricing blocks — the reason this form exists.
  const blocks = Number(a._engagement_blocks || 0) || 6;
  const projects = [];
  for (let i = 1; i <= blocks; i++) {
    const rows = ENG_FIELDS.map(([suffix, label]) => [label, val(a[`eng${i}_${suffix}`])]).filter(
      ([, v]) => v !== ""
    );
    if (rows.length) projects.push([i, rows]);
  }

  if (projects.length) {
    lines.push(`\n== Real projects (${projects.length}) ==`);
    html.push(
      `<h3 style="margin:26px 0 8px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#5f6672">Real projects (${projects.length})</h3>`
    );
    for (const [i, rows] of projects) {
      lines.push(`-- Project ${i} --`);
      html.push(
        `<div style="border:1px solid #e0e2e6;border-radius:8px;padding:12px 14px;margin-bottom:10px;background:#f6f6f4">`,
        `<p style="margin:0 0 8px;font-size:12px;text-transform:uppercase;letter-spacing:.07em;color:#5f6672">Project ${i}</p>`,
        `<table style="width:100%;border-collapse:collapse">`
      );
      for (const [label, v] of rows) {
        lines.push(`${label}: ${v}`);
        html.push(
          `<tr><td style="padding:3px 12px 3px 0;color:#5f6672;font-size:13.5px;width:42%">${esc(
            label
          )}</td><td style="padding:3px 0;font-size:13.5px"><strong>${esc(v)}</strong></td></tr>`
        );
      }
      html.push(`</table></div>`);
    }
  } else {
    lines.push(`\n== Real projects ==\nNone provided.`);
    html.push(
      `<p style="margin:22px 0 0;padding:12px 14px;background:#fdecea;color:#8c1d18;border-radius:8px;font-size:14px">No project pricing was provided — worth following up, that section is the point of the form.</p>`
    );
  }

  html.push(
    `<p style="margin:26px 0 0;padding-top:14px;border-top:1px solid #e0e2e6;color:#8b93a0;font-size:12.5px">Record <code>${esc(
      record.id
    )}</code> · stored in Cloudflare KV</p></div>`
  );

  return {
    subject: `Partner intake: ${val(a.firm_name) || "unnamed firm"}`,
    text: lines.join("\n").trim(),
    html: html.join(""),
  };
}

// Two providers supported. Brevo needs only single-sender verification (click a
// link in the inbox), so it can send as admin@firststate-growth.com with no DNS
// changes. Resend needs a verified domain. Whichever key is set wins.
async function notify(env, record) {
  const to = String(env.NOTIFY_TO || "").trim();
  if (!to) return "not_configured";

  const mail = buildEmail(record);
  const replyTo = record.answers?.contact_email || undefined;
  const recipients = to.split(",").map((s) => s.trim()).filter(Boolean);

  try {
    if (env.BREVO_API_KEY) {
      const fromEmail = env.NOTIFY_FROM || "admin@firststate-growth.com";
      const r = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "api-key": env.BREVO_API_KEY,
          "Content-Type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({
          sender: { email: fromEmail, name: "First State Growth Intake" },
          to: recipients.map((email) => ({ email })),
          replyTo: replyTo ? { email: replyTo } : undefined,
          subject: mail.subject,
          textContent: mail.text,
          htmlContent: mail.html,
        }),
      });
      return r.ok ? "sent_brevo" : `brevo_failed_${r.status}`;
    }

    if (env.RESEND_API_KEY) {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: env.NOTIFY_FROM || FROM,
          to: recipients,
          reply_to: replyTo,
          subject: mail.subject,
          text: mail.text,
          html: mail.html,
        }),
      });
      return r.ok ? "sent_resend" : `resend_failed_${r.status}`;
    }

    return "not_configured";
  } catch {
    return "failed_exception";
  }
}

export default {
  async fetch(request, env, ctx) {
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

    // Store first: KV is the record of truth, email is a convenience.
    await env.PARTNER_INTAKE.put(`sub:${id}`, JSON.stringify(record));

    // Do not make the respondent wait on the mail provider.
    ctx.waitUntil(notify(env, record));

    return json({ ok: true, id });
  },
};
