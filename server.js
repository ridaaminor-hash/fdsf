import express from 'express';
import compression from 'compression';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Simple in-memory store (replace with real DB)
const LEADS_DB = new Map();

// Decide offer expiry on boot unless provided by env
const defaultExpiryMs = 48 * 60 * 60 * 1000; // 48h
const offerExpireAt = process.env.OFFER_EXPIRE_AT || new Date(Date.now() + defaultExpiryMs).toISOString();

app.disable('x-powered-by');
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Health
app.get('/health', (req, res) => res.json({ ok: true }));

// Public static
app.use(express.static('public', { extensions: ['html'] }));

// Config endpoint for server-driven values
app.get('/api/config', (req, res) => {
  res.json({ offerExpireAt });
});

// GA4 Measurement Protocol helper
async function sendGA4Event({ name, params }) {
  const measurementId = process.env.GA4_MEASUREMENT_ID;
  const apiSecret = process.env.GA4_API_SECRET;
  if (!measurementId || !apiSecret) return false;

  const body = {
    client_id: params.client_id || params.lead_id || crypto.randomUUID(),
    events: [
      { name, params: { ...params, engagement_time_msec: 1 } }
    ]
  };

  try {
    const url = `https://www.google-analytics.com/mp/collect?measurement_id=${measurementId}&api_secret=${apiSecret}`;
    const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return resp.ok;
  } catch (err) {
    console.warn('GA4 MP failed', err);
    return false;
  }
}

// LinkedIn Conversions API skeleton
async function sendLinkedInConversion({ lead_id, action = 'lead' }) {
  const accessToken = process.env.LINKEDIN_ACCESS_TOKEN;
  const partnerId = process.env.LINKEDIN_PARTNER_ID;
  if (!accessToken || !partnerId) return false;

  const payload = {
    event: {
      action,
      clientEventId: lead_id,
      partnerId
      // TODO: Add industry-required identifiers; consult LinkedIn documentation
    }
  };

  try {
    const resp = await fetch('https://api.linkedin.com/v2/conversions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    return resp.ok;
  } catch (err) {
    console.warn('LinkedIn CAPI failed', err);
    return false;
  }
}

// Leads capture
app.post('/api/leads', async (req, res) => {
  try {
    const { name, email, org, role, consent, utm, referrer, page } = req.body || {};
    if (!email || !consent) return res.status(400).json({ error: 'Email and consent required' });

    const lead_id = crypto.randomUUID();
    const lead = {
      lead_id,
      name: name || null,
      email: String(email).trim().toLowerCase(),
      org: org || null,
      role: role || null,
      consent: Boolean(consent),
      utm: utm || {},
      referrer: referrer || null,
      page: page || null,
      ip: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress,
      user_agent: req.headers['user-agent'] || null,
      created_at: new Date().toISOString()
    };

    LEADS_DB.set(lead_id, lead);

    // Optional: GA4 lead_form_submit via Measurement Protocol
    sendGA4Event({ name: 'lead_form_submit', params: { lead_id, email_domain: lead.email.split('@')[1] } }).catch(()=>{});

    // Optional: LinkedIn CAPI skeleton (dedupe with client by clientEventId)
    sendLinkedInConversion({ lead_id, action: 'lead' }).catch(()=>{});

    return res.json({ lead_id });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server_error' });
  }
});

// Outbound tracking (non-blocking beacon)
app.post('/api/track-outbound', (req, res) => {
  // Swallow and accept; add storage/logging if needed
  res.status(204).end();
});

// Podia webhook skeleton: expects purchase notifications
app.post('/webhooks/podia', express.json(), async (req, res) => {
  // TODO: verify signature when available from Podia
  const event = req.body || {};
  // Example mapping
  const transactionId = event.order_id || event.transaction_id || null;
  const value = Number(event.amount) || null;
  const currency = (event.currency || 'EUR').toUpperCase();
  const clientId = event.client_id || event.lead_id || crypto.randomUUID();

  if (transactionId) {
    await sendGA4Event({
      name: 'purchase',
      params: {
        client_id: clientId,
        transaction_id: String(transactionId),
        value: value || undefined,
        currency,
        items: [{ item_id: 'masterclass_2025', item_name: 'Prompt Engineering — Doctors' }]
      }
    }).catch(()=>{});

    // Optionally notify LinkedIn as a purchase conversion
    sendLinkedInConversion({ lead_id: String(transactionId), action: 'purchase' }).catch(()=>{});
  }

  res.status(200).json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});