const router = require('express').Router();
const { supabase, createAuthedClient } = require('../utils/db');
const { authMiddleware } = require('../middleware/auth');

function authedClient(req) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  return createAuthedClient(token);
}

function cleanNumber(value, fallback = 0) {
  if (value === '' || value === undefined || value === null) return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function cleanArray(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return String(value).split(',').map(s => s.trim()).filter(Boolean);
}

async function attachProfiles(items, fk, outputKey = 'profiles') {
  if (!items || !items.length) return [];

  const ids = [...new Set(items.map(i => i[fk]).filter(Boolean))];
  if (!ids.length) return items;

  const { data: profiles } = await supabase
    .from('profiles')
    .select('user_id, display_name, email, profile_image, rating, subscription_tier, kyc_level, is_online, state, role')
    .in('user_id', ids);

  const map = new Map((profiles || []).map(p => [p.user_id, p]));

  return items.map(item => ({
    ...item,
    [outputKey]: map.get(item[fk]) || null
  }));
}

async function attachCategories(items, fk) {
  if (!items || !items.length) return [];

  const ids = [...new Set(items.map(i => i[fk]).filter(Boolean))];
  if (!ids.length) return items;

  const { data: cats } = await supabase
    .from('categories')
    .select('id, name, slug, ecosystem')
    .in('id', ids);

  const map = new Map((cats || []).map(c => [c.id, c]));

  return items.map(item => ({
    ...item,
    categories: map.get(item[fk]) || null
  }));
}

function targetFilter(query) {
  const { type, id, product_id, service_id, job_id, target_type, target_id } = query;

  if (product_id) return { column: 'product_id', id: product_id, target_type: 'product' };
  if (service_id) return { column: 'service_id', id: service_id, target_type: 'service' };
  if (job_id) return { column: 'job_id', id: job_id, target_type: 'job' };

  if (target_type && target_id) {
    if (target_type === 'product') return { column: 'product_id', id: target_id, target_type };
    if (target_type === 'service') return { column: 'service_id', id: target_id, target_type };
    if (target_type === 'job') return { column: 'job_id', id: target_id, target_type };
  }

  if (type && id) {
    if (type === 'product') return { column: 'product_id', id, target_type: 'product' };
    if (type === 'service') return { column: 'service_id', id, target_type: 'service' };
    if (type === 'job') return { column: 'job_id', id, target_type: 'job' };
  }

  return null;
}

// Categories
router.get('/categories', async (req, res) => {
  const { ecosystem } = req.query;

  let q = supabase
    .from('categories')
    .select('*')
    .order('sort_order', { ascending: true });

  if (ecosystem) q = q.eq('ecosystem', ecosystem);

  const { data, error } = await q;

  if (error) return res.status(400).json({ error: error.message });
  res.json(data || []);
});

// Search all marketplace sections
router.get('/search', async (req, res) => {
  const term = String(req.query.q || '').trim();

  if (!term) {
    return res.json({
      categories: [],
      products: [],
      services: [],
      jobs: []
    });
  }

  const like = `%${term}%`;

  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .or(`name.ilike.${like},slug.ilike.${like},description.ilike.${like}`)
    .limit(20);

  const categoryIds = (categories || []).map(c => c.id);

  let productQuery = supabase
    .from('products')
    .select('*')
    .eq('status', 'active');

  productQuery = categoryIds.length
    ? productQuery.or(`title.ilike.${like},description.ilike.${like},category_id.in.(${categoryIds.join(',')})`)
    : productQuery.or(`title.ilike.${like},description.ilike.${like}`);

  let serviceQuery = supabase
    .from('services')
    .select('*')
    .eq('status', 'active');

  serviceQuery = categoryIds.length
    ? serviceQuery.or(`title.ilike.${like},description.ilike.${like},category_id.in.(${categoryIds.join(',')})`)
    : serviceQuery.or(`title.ilike.${like},description.ilike.${like}`);

  let jobQuery = supabase
    .from('jobs')
    .select('*')
    .in('status', ['approved', 'open', 'assigned', 'completed']);

  jobQuery = categoryIds.length
    ? jobQuery.or(`title.ilike.${like},description.ilike.${like},location.ilike.${like},state.ilike.${like},category_id.in.(${categoryIds.join(',')})`)
    : jobQuery.or(`title.ilike.${like},description.ilike.${like},location.ilike.${like},state.ilike.${like}`);

  const [productsRes, servicesRes, jobsRes] = await Promise.all([
    productQuery.order('created_at', { ascending: false }).limit(30),
    serviceQuery.order('created_at', { ascending: false }).limit(30),
    jobQuery.order('created_at', { ascending: false }).limit(30)
  ]);

  let products = productsRes.data || [];
  let services = servicesRes.data || [];
  let jobs = jobsRes.data || [];

  products = await attachProfiles(products, 'user_id');
  products = await attachCategories(products, 'category_id');

  services = await attachProfiles(services, 'user_id');
  services = await attachCategories(services, 'category_id');

  jobs = await attachProfiles(jobs, 'user_id');
  jobs = await attachCategories(jobs, 'category_id');

  res.json({
    categories: categories || [],
    products,
    services,
    jobs
  });
});

// Services
router.get('/services', async (req, res) => {
  const { category_id, search, sort } = req.query;

  let q = supabase
    .from('services')
    .select('*')
    .eq('status', 'active');

  if (category_id) q = q.eq('category_id', category_id);

  if (search) {
    q = q.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
  }

  if (sort === 'price_low') q = q.order('price', { ascending: true });
  else if (sort === 'price_high') q = q.order('price', { ascending: false });
  else if (sort === 'rating') q = q.order('rating', { ascending: false });
  else q = q.order('created_at', { ascending: false });

  const { data, error } = await q.limit(50);

  if (error) return res.status(400).json({ error: error.message });

  let enriched = await attachProfiles(data || [], 'user_id');
  enriched = await attachCategories(enriched, 'category_id');

  res.json(enriched);
});

router.post('/services', authMiddleware, async (req, res) => {
  if (!['freelancer', 'worker', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Only freelancers and workers can create service listings.' });
  }

  const c = authedClient(req);
  const {
    category_id,
    title,
    description,
    price,
    delivery_days,
    images,
    video_url
  } = req.body;

  if (!title || !category_id) {
    return res.status(400).json({ error: 'Service title and category are required.' });
  }

  const { data, error } = await c.from('services').insert({
    user_id: req.user.id,
    category_id,
    title,
    description: description || null,
    price: cleanNumber(price, 0),
    delivery_days: cleanNumber(delivery_days, 7),
    images: cleanArray(images),
    video_url: video_url || null,
    status: 'active'
  }).select().single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// Products
router.get('/products', async (req, res) => {
  const { category_id, search, sort } = req.query;

  let q = supabase
    .from('products')
    .select('*')
    .eq('status', 'active');

  if (category_id) q = q.eq('category_id', category_id);

  if (search) {
    q = q.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
  }

  if (sort === 'price_low') q = q.order('price', { ascending: true });
  else if (sort === 'price_high') q = q.order('price', { ascending: false });
  else if (sort === 'rating') q = q.order('rating', { ascending: false });
  else q = q.order('created_at', { ascending: false });

  const { data, error } = await q.limit(50);

  if (error) return res.status(400).json({ error: error.message });

  let enriched = await attachProfiles(data || [], 'user_id');
  enriched = await attachCategories(enriched, 'category_id');

  res.json(enriched);
});

router.post('/products', authMiddleware, async (req, res) => {
  if (!['seller', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Only sellers can upload products.' });
  }

  const c = authedClient(req);
  const {
    category_id,
    title,
    description,
    price,
    size,
    color,
    gender,
    images,
    video_url,
    stock
  } = req.body;

  if (!title || !category_id) {
    return res.status(400).json({ error: 'Product title and category are required.' });
  }

  const { data, error } = await c.from('products').insert({
    user_id: req.user.id,
    category_id,
    title,
    description: description || null,
    price: cleanNumber(price, 0),
    size: size || null,
    color: color || null,
    gender: gender || null,
    images: cleanArray(images),
    video_url: video_url || null,
    stock: cleanNumber(stock, 1),
    status: 'paused'
  }).select().single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// Single service/product
router.get('/listing/:type/:id', async (req, res) => {
  const { type, id } = req.params;
  const table = type === 'service' ? 'services' : 'products';

  if (!['service', 'product'].includes(type)) {
    return res.status(400).json({ error: 'Invalid listing type.' });
  }

  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) return res.status(400).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Not found' });

  const [withProfile] = await attachProfiles([data], 'user_id');
  const [withCat] = await attachCategories([withProfile], 'category_id');

  res.json(withCat);
});

// Public CMS content
router.get('/cms/slides', async (req, res) => {
  const { data, error } = await supabase
    .from('homepage_slides')
    .select('*')
    .eq('status', 'active')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });

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

  const { data, error } = await q.order('created_at', { ascending: false });

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

  const { data, error } = await q
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) return res.status(400).json({ error: error.message });
  res.json(data || []);
});

// Testimonials
router.get('/testimonials', async (req, res) => {
  const { data, error } = await supabase
    .from('testimonials')
    .select('*')
    .in('status', ['approved', 'visible'])
    .order('created_at', { ascending: false })
    .limit(12);

  if (error) return res.status(400).json({ error: error.message });

  const enriched = await attachProfiles(data || [], 'user_id');

  res.json(enriched);
});

router.post('/testimonials', authMiddleware, async (req, res) => {
  const c = authedClient(req);
  const { name, role, text, message, image_url, rating } = req.body;

  const finalText = String(text || message || '').trim();

  if (!finalText) {
    return res.status(400).json({ error: 'Testimonial text is required.' });
  }

  const row = {
    user_id: req.user.id,
    name: name || req.user.display_name || 'Member',
    role: role || req.user.role || 'Member',
    text: finalText,
    message: finalText,
    image_url: image_url || null,
    rating: cleanNumber(rating, 5),
    status: 'pending'
  };

  const { data, error } = await c
    .from('testimonials')
    .insert(row)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });

  res.json(data);
});

// Comments
router.get('/comments', async (req, res) => {
  const target = targetFilter(req.query);

  let q = supabase
    .from('comments')
    .select('*')
    .in('status', ['visible', 'approved']);

  if (target) {
    q = q.eq(target.column, target.id);
  }

  const { data, error } = await q
    .order('created_at', { ascending: true })
    .limit(100);

  if (error) return res.status(400).json({ error: error.message });

  const enriched = await attachProfiles(data || [], 'user_id');

  res.json(enriched);
});

router.post('/comments', authMiddleware, async (req, res) => {
  const c = authedClient(req);
  const {
    body,
    product_id,
    service_id,
    job_id,
    parent_id,
    target_type,
    target_id
  } = req.body;

  const finalBody = String(body || '').trim();

  if (finalBody.length < 2) {
    return res.status(400).json({ error: 'Comment is too short.' });
  }

  const target = targetFilter({
    product_id,
    service_id,
    job_id,
    target_type,
    target_id
  });

  const row = {
    user_id: req.user.id,
    body: finalBody,
    product_id: target?.target_type === 'product' ? target.id : null,
    service_id: target?.target_type === 'service' ? target.id : null,
    job_id: target?.target_type === 'job' ? target.id : null,
    parent_id: parent_id || null,
    target_type: target?.target_type || target_type || 'suggestion',
    target_id: target?.id || target_id || null,
    status: 'pending'
  };

  const { data, error } = await c
    .from('comments')
    .insert(row)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });

  res.json(data);
});

// Reviews
async function ensureVerifiedReview(req, payload) {
  if (payload.payment_id) {
    const { data: payment } = await supabase
      .from('payments')
      .select('*')
      .eq('id', payload.payment_id)
      .maybeSingle();

    if (payment && payment.client_id === req.user.id && payment.status === 'released') {
      return {
        verified: true,
        reviewee_id: payload.reviewee_id || payment.worker_id || payment.receiver_id,
        job_id: payload.job_id || payment.job_id
      };
    }
  }

  if (payload.job_id) {
    const { data: job } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', payload.job_id)
      .maybeSingle();

    if (job && job.status === 'completed' && job.user_id === req.user.id) {
      return {
        verified: true,
        reviewee_id: payload.reviewee_id || job.assigned_to,
        job_id: job.id
      };
    }
  }

  return {
    verified: false,
    reviewee_id: payload.reviewee_id,
    job_id: payload.job_id
  };
}

router.get('/reviews', async (req, res) => {
  const target = targetFilter(req.query);

  if (!target && !req.query.reviewee_id) {
    return res.status(400).json({ error: 'Provide reviewee_id or a review target.' });
  }

  let q = supabase
    .from('reviews')
    .select('*')
    .in('status', ['approved', 'visible']);

  if (target) q = q.eq(target.column, target.id);
  if (req.query.reviewee_id) q = q.eq('reviewee_id', req.query.reviewee_id);

  const { data, error } = await q
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return res.status(400).json({ error: error.message });

  const enriched = await attachProfiles(data || [], 'reviewer_id', 'reviewer');

  res.json(enriched);
});

router.get('/reviews/:userId', async (req, res) => {
  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('reviewee_id', req.params.userId)
    .in('status', ['approved', 'visible'])
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return res.status(400).json({ error: error.message });

  const enriched = await attachProfiles(data || [], 'reviewer_id', 'reviewer');

  res.json(enriched);
});

router.post('/reviews', authMiddleware, async (req, res) => {
  const c = authedClient(req);
  const payload = req.body || {};
  const stars = Number(payload.stars);

  if (!stars || stars < 1 || stars > 5) {
    return res.status(400).json({ error: 'Stars must be between 1 and 5.' });
  }

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
    comment: String(payload.comment || '').trim(),
    hire_again: payload.hire_again !== false,
    verified_purchase: verification.verified,
    status: verification.verified ? 'approved' : 'pending'
  };

  const { data, error } = await c
    .from('reviews')
    .insert(row)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });

  res.json(data);
});

// Profile
router.get('/profile/:userId', async (req, res) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', req.params.userId)
    .maybeSingle();

  if (error) return res.status(400).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Profile not found' });

  res.json(data);
});

router.put('/profile', authMiddleware, async (req, res) => {
  const c = authedClient(req);

  const allowed = [
    'display_name',
    'first_name',
    'middle_name',
    'last_name',
    'phone',
    'country',
    'state',
    'city',
    'address',
    'bank_name',
    'account_number',
    'account_holder_name',
    'profile_image',
    'cover_image',
    'about',
    'cover_letter',
    'availability',
    'response_time_hours',
    'headline',
    'skills',
    'hourly_rate',
    'service_area',
    'portfolio_links',
    'socials',
    'seller_store_name',
    'seller_store_description',
    'seller_store_banner'
  ];

  const update = {};
  allowed.forEach(key => {
    if (Object.prototype.hasOwnProperty.call(req.body, key)) {
      update[key] = req.body[key];
    }
  });

  const { data, error } = await c
    .from('profiles')
    .update(update)
    .eq('user_id', req.user.id)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });

  res.json(data);
});

// Subscription request
router.post('/subscriptions', authMiddleware, async (req, res) => {
  const c = authedClient(req);
  const { tier, amount, proof_url } = req.body;

  const { data, error } = await c.from('subscriptions').insert({
    user_id: req.user.id,
    tier,
    amount: cleanNumber(amount, 0),
    proof_url: proof_url || null
  }).select().single();

  if (error) return res.status(400).json({ error: error.message });

  res.json(data);
});

// Notifications
router.get('/notifications', authMiddleware, async (req, res) => {
  const c = authedClient(req);

  const { data, error } = await c
    .from('notifications')
    .select('*')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false })
    .limit(30);

  if (error) return res.status(400).json({ error: error.message });

  res.json(data || []);
});

module.exports = router;
