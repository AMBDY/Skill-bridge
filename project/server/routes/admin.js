const router = require('express').Router();
const { supabase, createAuthedClient } = require('../utils/db');
const { authMiddleware, adminOnly } = require('../middleware/auth');

router.use(authMiddleware, adminOnly);

function authedClient(req) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  return createAuthedClient(token);
}

async function profilesByIds(client, ids) {
  if (!ids || !ids.length) return new Map();

  const { data } = await client
    .from('profiles')
    .select('user_id, display_name, email, profile_image, rating, kyc_level, subscription_tier, role')
    .in('user_id', ids);

  return new Map((data || []).map(p => [p.user_id, p]));
}

async function attachProfilesByUserId(client, rows, key = 'user_id', outputKey = 'profiles') {
  if (!rows || !rows.length) return rows || [];

  const ids = [...new Set(rows.map(r => r[key]).filter(Boolean))];
  if (!ids.length) return rows;

  const pmap = await profilesByIds(client, ids);

  return rows.map(row => ({
    ...row,
    [outputKey]: pmap.get(row[key]) || null
  }));
}

async function notifyUser(client, userId, type, title, body, link) {
  if (!userId) return;

  await client.from('notifications').insert({
    user_id: userId,
    type,
    title,
    body,
    link,
    read: false
  });
}

/* Overview */
router.get('/overview', async (req, res) => {
  const c = authedClient(req);

  const [users, jobs, payments, disputes, kyc, subs] = await Promise.all([
    c.from('profiles').select('id', { count: 'exact', head: true }),
    c.from('jobs').select('id', { count: 'exact', head: true }),
    c.from('payments').select('amount, service_fee, status'),
    c.from('disputes').select('id', { count: 'exact', head: true }),
    c.from('kyc_submissions').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    c.from('subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'pending')
  ]);

  const revenue = payments.data
    ?.filter(p => p.status === 'released')
    .reduce((sum, p) => sum + Number(p.service_fee || 0), 0) || 0;

  res.json({
    users: users.count || 0,
    jobs: jobs.count || 0,
    revenue,
    disputes: disputes.count || 0,
    kycPending: kyc.count || 0,
    subsPending: subs.count || 0
  });
});

/* Users */
router.get('/users', async (req, res) => {
  const c = authedClient(req);

  const { data, error } = await c
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) return res.status(400).json({ error: error.message });
  res.json(data || []);
});

router.put('/users/:id', async (req, res) => {
  const c = authedClient(req);

  const { data, error } = await c
    .from('profiles')
    .update(req.body)
    .eq('user_id', req.params.id)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

/* Categories */
router.get('/categories', async (req, res) => {
  const c = authedClient(req);

  const { data, error } = await c
    .from('categories')
    .select('*')
    .order('ecosystem')
    .order('sort_order');

  if (error) return res.status(400).json({ error: error.message });
  res.json(data || []);
});

router.post('/categories', async (req, res) => {
  const c = authedClient(req);
  const { name, slug, ecosystem, icon, description, sort_order } = req.body;

  if (!name || !slug || !ecosystem) {
    return res.status(400).json({ error: 'Name, slug, and ecosystem are required.' });
  }

  const { data, error } = await c.from('categories').insert({
    name,
    slug,
    ecosystem,
    icon: icon || null,
    description: description || null,
    sort_order: sort_order === '' || sort_order === undefined ? 0 : Number(sort_order)
  }).select().single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

router.put('/categories/:id', async (req, res) => {
  const c = authedClient(req);

  const { data, error } = await c
    .from('categories')
    .update(req.body)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

router.delete('/categories/:id', async (req, res) => {
  const c = authedClient(req);

  const { error } = await c
    .from('categories')
    .delete()
    .eq('id', req.params.id);

  if (error) return res.status(400).json({ error: error.message });
  res.json({ ok: true });
});

/* Homepage Slides */
router.get('/slides', async (req, res) => {
  const c = authedClient(req);

  const { data, error } = await c
    .from('homepage_slides')
    .select('*')
    .order('sort_order')
    .order('created_at', { ascending: false });

  if (error) return res.status(400).json({ error: error.message });
  res.json(data || []);
});

router.post('/slides', async (req, res) => {
  const c = authedClient(req);
  const { title, subtitle, image_url, cta_label, cta_url, sort_order, status } = req.body;

  if (!image_url) return res.status(400).json({ error: 'Slide image is required.' });

  const { data, error } = await c.from('homepage_slides').insert({
    title: title || null,
    subtitle: subtitle || null,
    image_url,
    cta_label: cta_label || null,
    cta_url: cta_url || null,
    sort_order: sort_order === '' || sort_order === undefined ? 0 : Number(sort_order),
    status: status || 'active'
  }).select().single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

router.put('/slides/:id', async (req, res) => {
  const c = authedClient(req);

  const { data, error } = await c
    .from('homepage_slides')
    .update({ ...req.body, updated_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

router.delete('/slides/:id', async (req, res) => {
  const c = authedClient(req);

  const { error } = await c
    .from('homepage_slides')
    .delete()
    .eq('id', req.params.id);

  if (error) return res.status(400).json({ error: error.message });
  res.json({ ok: true });
});

/* Site Content */
router.get('/site-content', async (req, res) => {
  const c = authedClient(req);

  const { data, error } = await c
    .from('site_content')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return res.status(400).json({ error: error.message });
  res.json(data || []);
});

router.post('/site-content', async (req, res) => {
  const c = authedClient(req);

  const { data, error } = await c
    .from('site_content')
    .insert(req.body)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

router.put('/site-content/:id', async (req, res) => {
  const c = authedClient(req);

  const { data, error } = await c
    .from('site_content')
    .update({ ...req.body, updated_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

router.delete('/site-content/:id', async (req, res) => {
  const c = authedClient(req);

  const { error } = await c
    .from('site_content')
    .delete()
    .eq('id', req.params.id);

  if (error) return res.status(400).json({ error: error.message });
  res.json({ ok: true });
});

/* Featured Items */
router.get('/featured-items', async (req, res) => {
  const c = authedClient(req);

  const { data, error } = await c
    .from('featured_items')
    .select('*')
    .order('sort_order')
    .order('created_at', { ascending: false });

  if (error) return res.status(400).json({ error: error.message });
  res.json(data || []);
});

router.post('/featured-items', async (req, res) => {
  const c = authedClient(req);

  const { data, error } = await c
    .from('featured_items')
    .insert(req.body)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

router.put('/featured-items/:id', async (req, res) => {
  const c = authedClient(req);

  const { data, error } = await c
    .from('featured_items')
    .update(req.body)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

router.delete('/featured-items/:id', async (req, res) => {
  const c = authedClient(req);

  const { error } = await c
    .from('featured_items')
    .delete()
    .eq('id', req.params.id);

  if (error) return res.status(400).json({ error: error.message });
  res.json({ ok: true });
});

/* KYC */
router.get('/kyc', async (req, res) => {
  const c = authedClient(req);

  const { data, error } = await c
    .from('kyc_submissions')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) return res.status(400).json({ error: error.message });

  const ids = (data || []).map(k => k.user_id).filter(Boolean);
  const pmap = await profilesByIds(c, ids);

  res.json((data || []).map(k => ({
    ...k,
    user: pmap.get(k.user_id) || null
  })));
});

router.put('/kyc/:id', async (req, res) => {
  const c = authedClient(req);
  const { status, reviewer_note } = req.body;

  const { data: kyc, error } = await c
    .from('kyc_submissions')
    .update({ status, reviewer_note })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });

  if (kyc && status === 'approved') {
    await c.from('profiles').update({ kyc_level: 3 }).eq('user_id', kyc.user_id);
  }

  res.json(kyc);
});

/* Job Moderation */
router.get('/jobs', async (req, res) => {
  const c = authedClient(req);

  const { data, error } = await c
    .from('jobs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) return res.status(400).json({ error: error.message });

  const ids = (data || []).map(j => j.user_id).filter(Boolean);
  const pmap = await profilesByIds(c, ids);

  res.json((data || []).map(j => ({
    ...j,
    profiles: pmap.get(j.user_id) || null
  })));
});

router.put('/jobs/:id/status', async (req, res) => {
  const c = authedClient(req);
  const { status } = req.body;

  if (!['pending', 'approved', 'open', 'assigned', 'completed', 'cancelled', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Invalid job status.' });
  }

  const { data, error } = await c
    .from('jobs')
    .update({ status })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });

  await notifyUser(
    c,
    data.user_id,
    'job_moderation',
    `Job ${status}`,
    `Your job "${data.title}" was ${status}.`,
    `/job.html?id=${data.id}`
  );

  res.json(data);
});

router.delete('/jobs/:id', async (req, res) => {
  const c = authedClient(req);

  const { error } = await c
    .from('jobs')
    .delete()
    .eq('id', req.params.id);

  if (error) return res.status(400).json({ error: error.message });
  res.json({ ok: true });
});

router.post('/jobs/:id/ai-verify', async (req, res) => {
  const c = authedClient(req);

  const { data: job, error } = await c
    .from('jobs')
    .select('*')
    .eq('id', req.params.id)
    .maybeSingle();

  if (error) return res.status(400).json({ error: error.message });
  if (!job) return res.status(404).json({ error: 'Job not found' });

  const result = await fetch(`${req.protocol}://${req.get('host')}/api/ai/fraud-check`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: req.headers.authorization
    },
    body: JSON.stringify({
      type: 'job_moderation',
      data: job
    })
  }).then(r => r.json()).catch(() => ({
    risk: 'unknown',
    flags: ['AI check failed']
  }));

  res.json(result);
});

/* Disputes */
router.get('/disputes', async (req, res) => {
  const c = authedClient(req);

  const { data, error } = await c
    .from('disputes')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return res.status(400).json({ error: error.message });
  res.json(data || []);
});

router.put('/disputes/:id', async (req, res) => {
  const c = authedClient(req);
  const { status, resolution } = req.body;

  const { data, error } = await c
    .from('disputes')
    .update({ status, resolution })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

/* Payments */
router.get('/payments', async (req, res) => {
  const c = authedClient(req);

  const { data, error } = await c
    .from('payments')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) return res.status(400).json({ error: error.message });

  const ids = [...new Set((data || []).flatMap(p => [p.client_id, p.worker_id, p.receiver_id]).filter(Boolean))];
  const pmap = await profilesByIds(c, ids);

  res.json((data || []).map(p => ({
    ...p,
    client: pmap.get(p.client_id) || null,
    worker: pmap.get(p.worker_id || p.receiver_id) || null
  })));
});

router.put('/payments/:id/release', async (req, res) => {
  const c = authedClient(req);

  const { data, error } = await c
    .from('payments')
    .update({
      status: 'released',
      released_at: new Date().toISOString()
    })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

/* Subscriptions */
router.get('/subscriptions', async (req, res) => {
  const c = authedClient(req);

  const { data, error } = await c
    .from('subscriptions')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) return res.status(400).json({ error: error.message });

  const ids = (data || []).map(s => s.user_id).filter(Boolean);
  const pmap = await profilesByIds(c, ids);

  res.json((data || []).map(s => ({
    ...s,
    user: pmap.get(s.user_id) || null
  })));
});

router.put('/subscriptions/:id', async (req, res) => {
  const c = authedClient(req);
  const { status } = req.body;

  const { data: sub, error } = await c
    .from('subscriptions')
    .update({ status })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });

  if (sub && status === 'approved') {
    await c.from('profiles').update({ subscription_tier: sub.tier }).eq('user_id', sub.user_id);
  }

  res.json(sub);
});

/* Ads */
router.get('/ads', async (req, res) => {
  const c = authedClient(req);

  const { data, error } = await c
    .from('ads')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return res.status(400).json({ error: error.message });
  res.json(data || []);
});

router.post('/ads', async (req, res) => {
  const c = authedClient(req);

  const { data, error } = await c
    .from('ads')
    .insert(req.body)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

router.put('/ads/:id', async (req, res) => {
  const c = authedClient(req);

  const { data, error } = await c
    .from('ads')
    .update(req.body)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

router.delete('/ads/:id', async (req, res) => {
  const c = authedClient(req);

  const { error } = await c
    .from('ads')
    .delete()
    .eq('id', req.params.id);

  if (error) return res.status(400).json({ error: error.message });
  res.json({ ok: true });
});

/* Social Moderation */
router.get('/testimonials', async (req, res) => {
  const c = authedClient(req);
  const { status } = req.query;

  let q = c
    .from('testimonials')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);

  if (status) q = q.eq('status', status);

  const { data, error } = await q;
  if (error) return res.status(400).json({ error: error.message });

  const withProfiles = await attachProfilesByUserId(c, data || [], 'user_id', 'profiles');
  res.json(withProfiles);
});

router.put('/testimonials/:id', async (req, res) => {
  const c = authedClient(req);
  const { status } = req.body;

  const { data, error } = await c
    .from('testimonials')
    .update({ status })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

router.get('/comments', async (req, res) => {
  const c = authedClient(req);
  const { status } = req.query;

  let q = c
    .from('comments')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);

  if (status) q = q.eq('status', status);

  const { data, error } = await q;
  if (error) return res.status(400).json({ error: error.message });

  const withProfiles = await attachProfilesByUserId(c, data || [], 'user_id', 'profiles');
  res.json(withProfiles);
});

router.put('/comments/:id', async (req, res) => {
  const c = authedClient(req);
  const { status } = req.body;

  const { data, error } = await c
    .from('comments')
    .update({ status })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

router.get('/reviews', async (req, res) => {
  const c = authedClient(req);
  const { status } = req.query;

  let q = c
    .from('reviews')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);

  if (status) q = q.eq('status', status);

  const { data, error } = await q;
  if (error) return res.status(400).json({ error: error.message });

  const ids = [...new Set((data || []).flatMap(r => [r.reviewer_id, r.reviewee_id]).filter(Boolean))];
  const pmap = await profilesByIds(c, ids);

  res.json((data || []).map(r => ({
    ...r,
    reviewer: pmap.get(r.reviewer_id) || null,
    reviewee: pmap.get(r.reviewee_id) || null
  })));
});

/* Settings */
router.get('/settings', async (req, res) => {
  const c = authedClient(req);

  const { data, error } = await c
    .from('platform_settings')
    .select('*')
    .limit(1)
    .maybeSingle();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data || {});
});

router.put('/settings', async (req, res) => {
  const c = authedClient(req);

  const { data: existing, error: findError } = await c
    .from('platform_settings')
    .select('id')
    .limit(1)
    .maybeSingle();

  if (findError) return res.status(400).json({ error: findError.message });

  if (!existing) {
    const { data, error } = await c
      .from('platform_settings')
      .insert(req.body)
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    return res.json(data);
  }

  const { data, error } = await c
    .from('platform_settings')
    .update(req.body)
    .eq('id', existing.id)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

/* Withdrawals */
router.get('/withdrawals', async (req, res) => {
  const c = authedClient(req);

  const { data, error } = await c
    .from('withdrawal_requests')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return res.status(400).json({ error: error.message });
  res.json(data || []);
});

router.put('/withdrawals/:id', async (req, res) => {
  const c = authedClient(req);
  const { status, admin_note, approval_delay_minutes } = req.body;

  if (!['approved', 'rejected', 'paid', 'held', 'cancelled'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  const delayMinutes =
    approval_delay_minutes === undefined || approval_delay_minutes === null || approval_delay_minutes === ''
      ? 5
      : Number(approval_delay_minutes);

  const update = {
    status,
    admin_note,
    reviewed_by: req.user.id,
    reviewed_at: new Date().toISOString()
  };

  if (status === 'approved') {
    update.approval_delay_minutes = delayMinutes;
    update.approved_at = new Date().toISOString();
    update.scheduled_for = new Date(Date.now() + delayMinutes * 60 * 1000).toISOString();
    update.execution_status = 'scheduled';
  }

  if (status === 'rejected' || status === 'cancelled') update.execution_status = 'cancelled';
  if (status === 'held') update.execution_status = 'held';
  if (status === 'paid') update.execution_status = 'paid';

  const { data, error } = await c
    .from('withdrawal_requests')
    .update(update)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });

  res.json(data);
});

/* Refunds */
router.get('/refunds', async (req, res) => {
  const c = authedClient(req);

  const { data, error } = await c
    .from('refund_requests')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return res.status(400).json({ error: error.message });
  res.json(data || []);
});

router.put('/refunds/:id', async (req, res) => {
  const c = authedClient(req);
  const { status, admin_note, approval_delay_minutes } = req.body;

  if (!['approved', 'rejected', 'paid', 'held', 'cancelled'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  const delayMinutes =
    approval_delay_minutes === undefined || approval_delay_minutes === null || approval_delay_minutes === ''
      ? 5
      : Number(approval_delay_minutes);

  const update = {
    status,
    admin_note,
    reviewed_by: req.user.id,
    reviewed_at: new Date().toISOString()
  };

  if (status === 'approved') {
    update.approval_delay_minutes = delayMinutes;
    update.approved_at = new Date().toISOString();
    update.scheduled_for = new Date(Date.now() + delayMinutes * 60 * 1000).toISOString();
    update.execution_status = 'scheduled';
  }

  if (status === 'rejected' || status === 'cancelled') update.execution_status = 'cancelled';
  if (status === 'held') update.execution_status = 'held';
  if (status === 'paid') update.execution_status = 'paid';

  const { data, error } = await c
    .from('refund_requests')
    .update(update)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });

  res.json(data);
});

/* Export */
router.get('/export/:sheet', async (req, res) => {
  const c = authedClient(req);
  const sheet = req.params.sheet;
  let rows = [];

  if (sheet === 'processing') {
    const { data } = await c.from('payments').select('*').in('status', ['pending', 'in_escrow']);
    rows = data || [];
  }

  if (sheet === 'completed') {
    const { data } = await c.from('payments').select('*').eq('status', 'released');
    rows = data || [];
  }

  res.json({
    sheet,
    rows,
    exportedAt: new Date().toISOString()
  });
});

/* Audit Logs */
router.get('/audit', async (req, res) => {
  const c = authedClient(req);

  const { data, error } = await c
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) return res.status(400).json({ error: error.message });
  res.json(data || []);
});

module.exports = router;
