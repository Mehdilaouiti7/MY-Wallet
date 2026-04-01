const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_SUPABASE_URL = 'https://mqfyuprpztiyfpleannt.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1xZnl1cHJwenRpeWZwbGVhbm50Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzMjg3MjUsImV4cCI6MjA4OTkwNDcyNX0.4Fvc-fNlwhVp0HvOEL-Z92i9W4YvVSAgen0ihBzlGOk';

function getDateYmd(date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOW_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

async function supabaseRest(path, sbUrl, sbKey) {
  const response = await fetch(`${sbUrl}/rest/v1/${path}`, {
    headers: {
      apikey: sbKey,
      Authorization: `Bearer ${sbKey}`,
      Accept: 'application/json'
    }
  });

  const raw = await response.text();
  let data = null;

  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = raw;
  }

  if (!response.ok) {
    throw new Error(
      `Supabase REST error (${response.status}): ${typeof data === 'string' ? data : JSON.stringify(data)}`
    );
  }

  return data;
}

async function sendWithResend({ apiKey, from, to, subject, html, text }) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      html,
      text
    })
  });

  const raw = await response.text();
  let data = null;

  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = raw;
  }

  if (!response.ok) {
    throw new Error(`Resend error (${response.status}): ${typeof data === 'string' ? data : JSON.stringify(data)}`);
  }

  return data;
}

module.exports = async (req, res) => {
  setCors(res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (!['GET', 'POST'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST, OPTIONS');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const sbUrl = process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL;
    const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;
    const resendApiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.REMINDER_FROM_EMAIL;

    if (!resendApiKey || !fromEmail) {
      return res.status(500).json({
        ok: false,
        error: 'Missing env vars. Required: RESEND_API_KEY, REMINDER_FROM_EMAIL. Optional overrides: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY.'
      });
    }

    const cfg = await supabaseRest('app_config?key=eq.email_rappel&select=value&limit=1', sbUrl, sbKey);
    const savedRecipient = Array.isArray(cfg) && cfg[0] ? String(cfg[0].value || '').trim() : '';
    const recipient = (process.env.REMINDER_TO_EMAIL || savedRecipient || '').trim();

    if (!recipient) {
      return res.status(400).json({ ok: false, error: 'No recipient email configured' });
    }

    const now = new Date();
    const today = getDateYmd(now);
    const in7 = getDateYmd(new Date(now.getTime() + 7 * DAY_MS));

    const query = [
      'archive=eq.false',
      `due=gte.${today}`,
      `due=lte.${in7}`,
      'select=id,marchand,due,source,total_inst,pays,versement,notes,acheteur,partage',
      'order=due.asc'
    ].join('&');

    const rows = await supabaseRest(`echeances?${query}`, sbUrl, sbKey);
    const pending = (Array.isArray(rows) ? rows : []).filter((r) => Number(r.pays || 0) < Number(r.total_inst || 0));

    if (!pending.length) {
      return res.status(200).json({ ok: true, sent: 0, echeances: 0, recipient });
    }

    const subject = `MY Wallet - ${pending.length} rappel(s) echeance`;

    const textLines = pending.map((r) => {
      const montant = Number(r.versement || 0).toFixed(2);
      return `- ${r.marchand} | ${r.due} | ${montant} EUR`;
    });

    const htmlRows = pending
      .map((r) => {
        const montant = Number(r.versement || 0).toFixed(2);
        const notes = r.notes ? `<div style="color:#6b7280;font-size:12px">${String(r.notes)}</div>` : '';
        return `<li style="margin:0 0 10px"><strong>${String(r.marchand)}</strong> - ${String(r.due)} - ${montant} EUR${notes}</li>`;
      })
      .join('');

    const html = [
      '<div style="font-family:Arial,sans-serif;color:#111827">',
      `<h2 style="margin:0 0 12px">MY Wallet - ${pending.length} rappel(s)</h2>`,
      '<p style="margin:0 0 12px">Voici les echeances a venir dans les 7 prochains jours.</p>',
      `<ul style="padding-left:20px">${htmlRows}</ul>`,
      '</div>'
    ].join('');

    const text = [
      `MY Wallet - ${pending.length} rappel(s)`,
      'Echeances a venir dans les 7 prochains jours:',
      ...textLines
    ].join('\n');

    const mailResult = await sendWithResend({
      apiKey: resendApiKey,
      from: fromEmail,
      to: recipient,
      subject,
      html,
      text
    });

    return res.status(200).json({
      ok: true,
      sent: 1,
      echeances: pending.length,
      recipient,
      emailId: mailResult && mailResult.id ? mailResult.id : null
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
};