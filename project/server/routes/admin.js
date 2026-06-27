const router = require('express').Router();
const { supabase, createAuthedClient } = require('../utils/db');
const { authMiddleware, adminOnly } = require('../middleware/auth');

// All admin routes require auth + admin role
router.use(authMiddleware, adminOnly);

// Helper: get an authenticated client for the current user
function authedClient(req) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  return createAuthedClient(token);
}

async function profilesByIds(client, ids) {
  if (!ids || !ids.length) return new Map();
  const { data } = await client.from('profiles').select('user_id, display_name, email, profile_image, rating, kyc_level, subscription_tier, role').in('user_id', ids);
  return new Map((data || []).map(p => [p.user_id, p]));
}

// Overview stats
router.get('/overview', async (req, res) => {
  const c = authedClient(req);
  const [users, jobs, payments, disputes, kyc, subs] = await Promise.all([
    c.from('profiles').select('id', { count: 'exact', head: true }),
    c.from('jobs').select('id', { count: 'exact', head: true }),
    c.from('payments').select('amount, service_fee, status'),
    c.from('disputes').select('id, status', { count: 'exact', head: true }),
    c.from('kyc_submissions').select('id', { count: 'exact', head: true }),
    c.from('subscriptions').select('id', { count: 'exact', head: true })
  ]);
  const revenue = payments.data?.filter(p => p.status === 'released').reduce((s, p) => s + Number(p.service_fee || 0), 0) || 0;
  res.json({ users: users.count || 0, jobs: jobs.count || 0, revenue, disputes: disputes.count || 0, kycPending: kyc.count || 0, subsPending: subs.count || 0 });
});

// Users
router.get('/users', async (req, res) => {
  const c = authedClient(req);
  const { data, error } = await c.from('profiles').select('*').order('created_at', { ascending: false }).limit(100);
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

router.put('/users/:id', async (req, res) => {
  const c = authedClient(req);
  const { data, error } = await c.from('profiles').update(req.body).eq('user_id', req.params.id).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// KYC review
router.get('/kyc', async (req, res) => {
  const c = authedClient(req);
  const { data, error } = await c.from('kyc_submissions').select('*').eq('status', 'pending').order('created_at', { ascending: false });
  if (error) return res.status(400).json({ error: error.message });
  const ids = (data || []).map(k => k.user_id).filter(Boolean);
  const pmap = await profilesByIds(c, ids);
  res.json((data || []).map(k => ({ ...k, user: pmap.get(k.user_id) || null })));
});

router.put('/kyc/:id', async (req, res) => {
  const c = authedClient(req);
  const { status, reviewer_note } = req.body;
  const { data: kyc } = await c.from('kyc_submissions').update({ status, reviewer_note }).eq('id', req.params.id).select().single();
  if (kyc && status === 'approved') await c.from('profiles').update({ kyc_level: 3 }).eq('user_id', kyc.user_id);
  res.json(kyc);
});

// Job moderation
router.get('/jobs', async (req, res) => {
  const c = authedClient(req);
  const { data, error } = await c.from('jobs').select('*').order('created_at', { ascending: false }).limit(100);
  if (error) return res.status(400).json({ error: error.message });
  const ids = (data || []).map(j => j.user_id).filter(Boolean);
  const pmap = await profilesByIds(c, ids);
  res.json((data || []).map(j => ({ ...j, profiles: pmap.get(j.user_id) || null })));
});

router.put('/jobs/:id/status', async (req, res) => {
  const c = authedClient(req);
  const { status } = req.body;
  const { data, error } = await c.from('jobs').update({ status }).eq('id', req.params.id).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// Disputes
router.get('/disputes', async (req, res) => {
  const c = authedClient(req);
  const { data, error } = await c.from('disputes').select('*').order('created_at', { ascending: false });
  if (error) return res.status(400).json({ error: error.message });
  res.json(data || []);
});

router.put('/disputes/:id', async (req, res) => {
  const c = authedClient(req);
  const { status, resolution } = req.body;
  const { data, error } = await c.from('disputes').update({ status, resolution }).eq('id', req.params.id).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// Payments
router.get('/payments', async (req, res) => {
  const c = authedClient(req);
  const { data, error } = await c.from('payments').select('*').order('created_at', { ascending: false }).limit(100);
  if (error) return res.status(400).json({ error: error.message });
  const ids = [...new Set((data || []).flatMap(p => [p.client_id, p.worker_id]).filter(Boolean))];
  const pmap = await profilesByIds(c, ids);
  res.json((data || []).map(p => ({ ...p, client: pmap.get(p.client_id) || null, worker: pmap.get(p.worker_id) || null })));
});

router.put('/payments/:id/release', async (req, res) => {
  const c = authedClient(req);
  const { data, error } = await c.from('payments').update({ status: 'released', released_at: new Date().toISOString() }).eq('id', req.params.id).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// Subscriptions
router.get('/subscriptions', async (req, res) => {
  const c = authedClient(req);
  const { data, error } = await c.from('subscriptions').select('*').eq('status', 'pending').order('created_at', { ascending: false });
  if (error) return res.status(400).json({ error: error.message });
  const ids = (data || []).map(s => s.user_id).filter(Boolean);
  const pmap = await profilesByIds(c, ids);
  res.json((data || []).map(s => ({ ...s, user: pmap.get(s.user_id) || null })));
});

router.put('/subscriptions/:id', async (req, res) => {
  const c = authedClient(req);
  const { status } = req.body;
  const { data: sub } = await c.from('subscriptions').update({ status }).eq('id', req.params.id).select().single();
  if (sub && status === 'approved') await c.from('profiles').update({ subscription_tier: sub.tier }).eq('user_id', sub.user_id);
  res.json(sub);
});

// Ads
router.get('/ads', async (req, res) => {
  const c = authedClient(req);
  const { data, error } = await c.from('ads').select('*').order('created_at', { ascending: false });
  if (error) return res.status(400).json({ error: error.message });
  res.json(data || []);
});

router.post('/ads', async (req, res) => {
  const c = authedClient(req);
  const { data, error } = await c.from('ads').insert(req.body).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

router.put('/ads/:id', async (req, res) => {
  const c = authedClient(req);
  const { data, error } = await c.from('ads').update(req.body).eq('id', req.params.id).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

router.delete('/ads/:id', async (req, res) => {
  const c = authedClient(req);
  const { error } = await c.from('ads').delete().eq('id', req.params.id);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ ok: true });
});


// Testimonials moderation
router.get('/testimonials', async (req, res) => {
  const c = authedClient(req);
  const { status } = req.query;
  let q = c.from('testimonials').select('*, profiles:user_id(display_name, email, profile_image, role)').order('created_at', { ascending: false }).limit(100);
  if (status) q = q.eq('status', status);
  const { data, error } = await q;
  if (error) return res.status(400).json({ error: error.message });
  res.json(data || []);
});

router.put('/testimonials/:id', async (req, res) => {
  const c = authedClient(req);
  const { status, admin_note } = req.body;
  const patch = { status, admin_note: admin_note || null };
  if (status === 'approved') patch.approved_at = new Date().toISOString();
  const { data, error } = await c.from('testimonials').update(patch).eq('id', req.params.id).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// Comments moderation
router.get('/comments', async (req, res) => {
  const c = authedClient(req);
  const { status } = req.query;
  let q = c.from('comments').select('*, profiles:user_id(display_name, email, profile_image, role)').order('created_at', { ascending: false }).limit(100);
  if (status) q = q.eq('status', status);
  const { data, error } = await q;
  if (error) return res.status(400).json({ error: error.message });
  res.json(data || []);
});

router.put('/comments/:id', async (req, res) => {
  const c = authedClient(req);
  const { status } = req.body;
  const { data, error } = await c.from('comments').update({ status }).eq('id', req.params.id).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// Reviews moderation
router.get('/reviews', async (req, res) => {
  const c = authedClient(req);
  const { status } = req.query;
  let q = c.from('reviews').select('*, reviewer:reviewer_id(display_name, email, profile_image), reviewee:reviewee_id(display_name, email, profile_image)').order('created_at', { ascending: false }).limit(100);
  if (status) q = q.eq('status', status);
  const { data, error } = await q;
  if (error) return res.status(400).json({ error: error.message });
  res.json(data || []);
});

router.put('/reviews/:id', async (req, res) => {
  const c = authedClient(req);
  const { status } = req.body;
  const { data, error } = await c.from('reviews').update({ status }).eq('id', req.params.id).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// Audit logs
router.get('/audit', async (req, res) => {
  const c = authedClient(req);
  const { data, error } = await c.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(100);
  if (error) return res.status(400).json({ error: error.message });
  res.json(data || []);
});

// Settings
router.get('/settings', async (req, res) => {
  const c = authedClient(req);
  const { data } = await c.from('platform_settings').select('*').limit(1).single();
  res.json(data);
});

router.put('/settings', async (req, res) => {
  const c = authedClient(req);
  const { data, error } = await c.from('platform_settings').update(req.body).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// Export
router.get('/export/:sheet', async (req, res) => {
  const c = authedClient(req);
  const sheet = req.params.sheet;
  let rows = [];
  if (sheet === 'processing') {
    const { data } = await c.from('payments').select('*').in('status', ['pending', 'in_escrow']);
    rows = data || [];
  } else if (sheet === 'completed') {
    const { data } = await c.from('payments').select('*').eq('status', 'released');
    rows = data || [];
  }
  res.json({ sheet, rows, exportedAt: new Date().toISOString() });
});

module.exports = router;
