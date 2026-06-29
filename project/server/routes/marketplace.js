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
  const { data: profiles } = await supabase.from('profiles').select('user_id, display_name, profile_image, rating, subscription_tier, kyc_level, is_online, state').in('user_id', ids);
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

// Categories
router.get('/categories', async (req, res) => {
  const { ecosystem } = req.query;
  let q = supabase.from('categories').select('*').order('sort_order');
  if (ecosystem) q = q.eq('ecosystem', ecosystem);
  const { data, error } = await q;
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// Services (hire talent)
router.get('/services', async (req, res) => {
  const { category_id, search, sort } = req.query;
  let q = supabase.from('services').select('*');
  if (category_id) q = q.eq('category_id', category_id);
  if (search) q = q.ilike('title', `%${search}%`);
  if (sort === 'price_low') q = q.order('price', { ascending: true });
  else if (sort === 'price_high') q = q.order('price', { ascending: false });
  else if (sort === 'rating') q = q.order('rating', { ascending: false });
  else q = q.order('created_at', { ascending: false });
  const { data, error } = await q.limit(50);
  if (error) return res.status(400).json({ error: error.message });
  const enriched = await attachProfiles(data, 'user_id');
  res.json(enriched);
});

router.post('/services', authMiddleware, async (req, res) => {
  const c = authedClient(req);
  const { category_id, title, description, price, delivery_days, images, video_url } = req.body;
  const { data, error } = await c.from('services').insert({
    user_id: req.user.id, category_id, title, description, price, delivery_days, images, video_url
  }).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// Products (shop)
router.get('/products', async (req, res) => {
  const { category_id, search, sort } = req.query;
  let q = supabase.from('products').select('*');
  if (category_id) q = q.eq('category_id', category_id);
  if (search) q = q.ilike('title', `%${search}%`);
  if (sort === 'price_low') q = q.order('price', { ascending: true });
  else if (sort === 'price_high') q = q.order('price', { ascending: false });
  else if (sort === 'rating') q = q.order('rating', { ascending: false });
  else q = q.order('created_at', { ascending: false });
  const { data, error } = await q.limit(50);
  if (error) return res.status(400).json({ error: error.message });
  const enriched = await attachProfiles(data, 'user_id');
  res.json(enriched);
});

router.post('/products', authMiddleware, async (req, res) => {
  const c = authedClient(req);
  const { category_id, title, description, price, size, color, gender, images, video_url, stock } = req.body;
  const { data, error } = await c.from('products').insert({
    user_id: req.user.id, category_id, title, description, price, size, color, gender, images, video_url, stock
  }).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// Single service/product
router.get('/listing/:type/:id', async (req, res) => {
  const { type, id } = req.params;
  const table = type === 'service' ? 'services' : 'products';
  const { data, error } = await supabase.from(table).select('*').eq('id', id).maybeSingle();
  if (error) return res.status(400).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Not found' });
  const [withProfile] = await attachProfiles([data], 'user_id');
  const [withCat] = await attachCategories([withProfile], 'category_id');
  res.json(withCat);
});


function targetFilter(query) {
  const { type, id, product_id, service_id, job_id } = query;
  if (product_id) return { column: 'product_id', id: product_id };
  if (service_id) return { column: 'service_id', id: service_id };
  if (job_id) return { column: 'job_id', id: job_id };
  if (type && id) {
    if (type === 'product') return { column: 'product_id', id };
    if (type === 'service') return { column: 'service_id', id };
    if (type === 'job') return { column: 'job_id', id };
  }
  return null;
}

async function ensureVerifiedReview(req, payload) {
  if (payload.payment_id) {
    const { data: payment } = await supabase.from('payments').select('*').eq('id', payload.payment_id).maybeSingle();
    if (payment && payment.client_id === req.user.id && payment.status === 'released') {
      return { verified: true, reviewee_id: payload.reviewee_id || payment.worker_id, job_id: payload.job_id || payment.job_id };
    }
  }
  if (payload.job_id) {
    const { data: job } = await supabase.from('jobs').select('*').eq('id', payload.job_id).maybeSingle();
    if (job && job.status === 'completed' && job.user_id === req.user.id) {
      return { verified: true, reviewee_id: payload.reviewee_id || job.assigned_to, job_id: job.id };
    }
  }
  return { verified: false, reviewee_id: payload.reviewee_id, job_id: payload.job_id };
}

// Approved homepage testimonials from registered members
router.get('/testimonials', async (req, res) => {
  const { data, error } = await supabase
    .from('testimonials')
    .select('*, profiles:user_id(display_name, profile_image, role, city, state, kyc_level)')
    .eq('status', 'approved')
    .eq('consent_public', true)
    .order('approved_at', { ascending: false })
    .limit(12);
  if (error) return res.status(400).json({ error: error.message });
  res.json(data || []);
});

router.post('/testimonials', authMiddleware, async (req, res) => {
  const c = authedClient(req);
  const { message, rating, show_profile_image, show_display_name, consent_public } = req.body;
  if (!message || message.trim().length < 10) return res.status(400).json({ error: 'Testimonial must be at least 10 characters.' });
  if (!consent_public) return res.status(400).json({ error: 'Public display consent is required.' });
  const { data, error } = await c.from('testimonials').insert({
    user_id: req.user.id,
    message: message.trim(),
    rating: rating || null,
    show_profile_image: show_profile_image !== false,
    show_display_name: show_display_name !== false,
    consent_public: true,
    status: 'pending'
  }).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// Public comments/questions under products, services, and posted jobs
router.get('/comments', async (req, res) => {
  const target = targetFilter(req.query);
  if (!target) return res.status(400).json({ error: 'Provide product_id, service_id, job_id, or type + id.' });
  const { data, error } = await supabase
    .from('comments')
    .select('*, profiles:user_id(display_name, profile_image, role, kyc_level)')
    .eq(target.column, target.id)
    .eq('status', 'visible')
    .order('created_at', { ascending: true })
    .limit(100);
  if (error) return res.status(400).json({ error: error.message });
  res.json(data || []);
});

router.post('/comments', authMiddleware, async (req, res) => {
  const c = authedClient(req);
  const { body, product_id, service_id, job_id, parent_id } = req.body;
  if (!body || body.trim().length < 2) return res.status(400).json({ error: 'Comment is too short.' });
  const targets = [product_id, service_id, job_id].filter(Boolean);
  if (targets.length !== 1) return res.status(400).json({ error: 'Comment must belong to one product, service, or job.' });
  const { data, error } = await c.from('comments').insert({
    user_id: req.user.id,
    body: body.trim(),
    product_id: product_id || null,
    service_id: service_id || null,
    job_id: job_id || null,
    parent_id: parent_id || null,
    status: 'visible'
  }).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// Reviews for a listing/job target
router.get('/reviews', async (req, res) => {
  const target = targetFilter(req.query);
  if (!target && !req.query.reviewee_id) return res.status(400).json({ error: 'Provide reviewee_id or a review target.' });
  let q = supabase.from('reviews').select('*, reviewer:reviewer_id(display_name, profile_image)').eq('status', 'approved');
  if (target) q = q.eq(target.column, target.id);
  if (req.query.reviewee_id) q = q.eq('reviewee_id', req.query.reviewee_id);
  const { data, error } = await q.order('created_at', { ascending: false }).limit(50);
  if (error) return res.status(400).json({ error: error.message });
  res.json(data || []);
});

// Reviews for a user profile
router.get('/reviews/:userId', async (req, res) => {
  const { data, error } = await supabase
    .from('reviews')
    .select('*, reviewer:reviewer_id(display_name, profile_image)')
    .eq('reviewee_id', req.params.userId)
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) return res.status(400).json({ error: error.message });
  res.json(data || []);
});

router.post('/reviews', authMiddleware, async (req, res) => {
  const c = authedClient(req);
  const payload = req.body;
  const stars = Number(payload.stars);
  if (!stars || stars < 1 || stars > 5) return res.status(400).json({ error: 'Stars must be between 1 and 5.' });
  const verification = await ensureVerifiedReview(req, payload);
  const revieweeId = verification.reviewee_id;
  if (!revieweeId) return res.status(400).json({ error: 'Reviewee is required.' });
  if (revieweeId === req.user.id) return res.status(400).json({ error: 'You cannot review yourself.' });
  const row = {
    reviewer_id: req.user.id,
    reviewee_id: revieweeId,
    job_id: verification.job_id || payload.job_id || null,
    product_id: payload.product_id || null,
    service_id: payload.service_id || null,
    payment_id: payload.payment_id || null,
    stars,
    comment: (payload.comment || '').trim(),
    hire_again: payload.hire_again !== false,
    verified_purchase: verification.verified,
    status: verification.verified ? 'approved' : 'pending'
  };
  const { data, error } = await c.from('reviews').insert(row).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// Profile
router.get('/profile/:userId', async (req, res) => {
  const { data, error } = await supabase.from('profiles').select('*').eq('user_id', req.params.userId).maybeSingle();
  if (error) return res.status(400).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Profile not found' });
  res.json(data);
});

router.put('/profile', authMiddleware, async (req, res) => {
  const c = authedClient(req);
  const { data, error } = await c.from('profiles').update(req.body).eq('user_id', req.user.id).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// Subscription request (user-facing)
router.post('/subscriptions', authMiddleware, async (req, res) => {
  const c = authedClient(req);
  const { tier, amount, proof_url } = req.body;
  const { data, error } = await c.from('subscriptions').insert({
    user_id: req.user.id, tier, amount, proof_url
  }).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// Notifications
router.get('/notifications', authMiddleware, async (req, res) => {
  const c = authedClient(req);
  const { data, error } = await c.from('notifications').select('*').eq('user_id', req.user.id).order('created_at', { ascending: false }).limit(30);
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// Public CMS content for homepage/site
router.get('/cms/slides', async (req, res) => {
  const { data, error } = await supabase
    .from('homepage_slides')
    .select('*')
    .eq('status', 'active')
    .order('sort_order', { ascending: true })
    .limit(20);

  if (error) return res.status(400).json({ error: error.message });
  res.json(data || []);
});

router.get('/cms/content', async (req, res) => {
  const { target_page } = req.query;

  let q = supabase
    .from('site_content')
    .select('*')
    .eq('status', 'active');

  if (target_page) q = q.eq('target_page', target_page);

  const { data, error } = await q.order('updated_at', { ascending: false });

  if (error) return res.status(400).json({ error: error.message });
  res.json(data || []);
});

router.get('/cms/featured', async (req, res) => {
  const { placement } = req.query;

  let q = supabase
    .from('featured_items')
    .select('*')
    .eq('status', 'active');

  if (placement) q = q.eq('placement', placement);

  const { data, error } = await q.order('sort_order', { ascending: true });

  if (error) return res.status(400).json({ error: error.message });
  res.json(data || []);
});

module.exports = router;
