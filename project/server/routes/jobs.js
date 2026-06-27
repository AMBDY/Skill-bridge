const router = require('express').Router();
const { supabase, createAuthedClient } = require('../utils/db');
const { authMiddleware } = require('../middleware/auth');

function authedClient(req) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  return createAuthedClient(token);
}

async function attachProfiles(items, fk) {
  if (!items || !items.length) return [];
  const ids = [...new Set(items.map(i => i[fk]).filter(Boolean))];
  if (!ids.length) return items;
  const { data: profiles } = await supabase.from('profiles').select('user_id, display_name, profile_image, rating, kyc_level, subscription_tier, is_online').in('user_id', ids);
  const map = new Map((profiles || []).map(p => [p.user_id, p]));
  return items.map(i => ({ ...i, profiles: map.get(i[fk]) || null }));
}

async function attachCategories(items, fk) {
  if (!items || !items.length) return [];
  const ids = [...new Set(items.map(i => i[fk]).filter(Boolean))];
  if (!ids.length) return items;
  const { data: cats } = await supabase.from('categories').select('id, name, slug, ecosystem').in('id', ids);
  const map = new Map((cats || []).map(c => [c.id, c]));
  return items.map(i => ({ ...i, categories: map.get(i[fk]) || null }));
}

// List jobs
router.get('/', async (req, res) => {
  const { category_id, status, search } = req.query;
  let q = supabase.from('jobs').select('*');
  if (category_id) q = q.eq('category_id', category_id);
  if (status) q = q.eq('status', status);
  else q = q.in('status', ['approved', 'open', 'assigned', 'completed']);
  if (search) q = q.ilike('title', `%${search}%`);
  q = q.order('created_at', { ascending: false });
  const { data, error } = await q.limit(50);
  if (error) return res.status(400).json({ error: error.message });
  let enriched = await attachProfiles(data, 'user_id');
  enriched = await attachCategories(enriched, 'category_id');
  res.json(enriched);
});

// Single job
router.get('/:id', async (req, res) => {
  const { data, error } = await supabase.from('jobs').select('*').eq('id', req.params.id).maybeSingle();
  if (error) return res.status(400).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Not found' });
  const [withProfile] = await attachProfiles([data], 'user_id');
  const [withCat] = await attachCategories([withProfile], 'category_id');
  const { data: bids } = await supabase.from('job_bids').select('*').eq('job_id', req.params.id);
  const bidUserIds = (bids || []).map(b => b.user_id).filter(Boolean);
  let bidsEnriched = bids || [];
  if (bidUserIds.length) {
    const { data: bidProfiles } = await supabase.from('profiles').select('user_id, display_name, profile_image, rating').in('user_id', bidUserIds);
    const pmap = new Map((bidProfiles || []).map(p => [p.user_id, p]));
    bidsEnriched = bids.map(b => ({ ...b, user: pmap.get(b.user_id) || null }));
  }
  res.json({ ...withCat, bids: bidsEnriched });
});

// Create job
router.post('/', authMiddleware, async (req, res) => {
  const c = authedClient(req);
  const { data, error } = await c.from('jobs').insert({
    user_id: req.user.id, ...req.body, status: 'pending'
  }).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// Update job
router.put('/:id', authMiddleware, async (req, res) => {
  const c = authedClient(req);
  const { data, error } = await c.from('jobs').update(req.body).eq('id', req.params.id).eq('user_id', req.user.id).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// Bids
router.post('/:id/bids', authMiddleware, async (req, res) => {
  const c = authedClient(req);
  const { amount, message, duration } = req.body;
  const { data, error } = await c.from('job_bids').insert({
    job_id: req.params.id, user_id: req.user.id, amount, message, duration
  }).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// Agreements
router.post('/agreements', authMiddleware, async (req, res) => {
  const c = authedClient(req);
  const { job_id, worker_id, details, price, timeline } = req.body;
  const { data: settings } = await supabase.from('platform_settings').select('service_fee_percent').limit(1).maybeSingle();
  const fee = settings?.service_fee_percent || 10;
  const { data, error } = await c.from('agreements').insert({
    job_id, client_id: req.user.id, worker_id, details, price, timeline, service_fee_percent: fee
  }).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

router.put('/agreements/:id', authMiddleware, async (req, res) => {
  const c = authedClient(req);
  const { client_agreed, worker_agreed, locked, sealed } = req.body;
  const { data, error } = await c.from('agreements').update({
    client_agreed, worker_agreed, locked, sealed
  }).eq('id', req.params.id).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

module.exports = router;
