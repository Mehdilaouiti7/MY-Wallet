function mask(value, keepStart = 3, keepEnd = 2) {
  if (!value) return '';
  const s = String(value);
  if (s.length <= keepStart + keepEnd) return '*'.repeat(s.length);
  return `${s.slice(0, keepStart)}${'*'.repeat(s.length - keepStart - keepEnd)}${s.slice(-keepEnd)}`;
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOW_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

module.exports = async (req, res) => {
  setCors(res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const hasSupabaseUrl = Boolean(process.env.SUPABASE_URL);
  const hasSupabaseKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY);
  const hasResendKey = Boolean(process.env.RESEND_API_KEY);
  const hasFromEmail = Boolean(process.env.REMINDER_FROM_EMAIL);

  const healthy = hasSupabaseUrl && hasSupabaseKey && hasResendKey && hasFromEmail;

  return res.status(healthy ? 200 : 500).json({
    ok: healthy,
    checks: {
      SUPABASE_URL: hasSupabaseUrl,
      SUPABASE_KEY: hasSupabaseKey,
      RESEND_API_KEY: hasResendKey,
      REMINDER_FROM_EMAIL: hasFromEmail
    },
    values: {
      SUPABASE_URL: process.env.SUPABASE_URL || '',
      REMINDER_FROM_EMAIL: process.env.REMINDER_FROM_EMAIL || '',
      REMINDER_TO_EMAIL: process.env.REMINDER_TO_EMAIL || '',
      RESEND_API_KEY_MASKED: mask(process.env.RESEND_API_KEY || '')
    },
    now: new Date().toISOString()
  });
};
