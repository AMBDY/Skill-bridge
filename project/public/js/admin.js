document.addEventListener('DOMContentLoaded', async () => {
  if (!Auth.isLoggedIn()) { location.href = '/signin.html'; return; }
  const user = Auth.user();
  if (user.role !== 'admin') {
    document.getElementById('adminMain').innerHTML = '<p>Admin access required. Contact the platform owner.</p>';
    return;
  }

  const sections = [
  { id: 'overview', label: 'Overview' },
  { id: 'slides', label: 'Homepage Slides' },
  { id: 'siteContent', label: 'Site Content' },
  { id: 'featured', label: 'Featured Items' },
  { id: 'categories', label: 'Categories' },
  { id: 'users', label: 'Users' },
  { id: 'kyc', label: 'KYC Review' },
  { id: 'jobs', label: 'Job Moderation' },
  { id: 'testimonials', label: 'Testimonials' },
  { id: 'comments', label: 'Comments' },
  { id: 'reviews', label: 'Reviews' },
  { id: 'disputes', label: 'Disputes' },
  { id: 'payments', label: 'Payments' },
  { id: 'revenue', label: 'Revenue' },
  { id: 'audit', label: 'Audit Logs' },
  { id: 'subs', label: 'Subscriptions' },
  { id: 'ai', label: 'AI Ranking Control' },
  { id: 'ads', label: 'Content & Ads' },
  { id: 'export', label: 'Google Sheets Export' },
  { id: 'fraud', label: 'Fraud Monitoring' },
  { id: 'finance', label: 'Finance' },
  { id: 'settings', label: 'Settings' }
];
  const nav = document.getElementById('adminNav');
  nav.innerHTML = sections.map(s => `<a href="#" data-sec="${s.id}" class="${s.id === 'overview' ? 'active' : ''}">${s.label}</a>`).join('');
  nav.querySelectorAll('a').forEach(a => a.addEventListener('click', (e) => {
    e.preventDefault();
    nav.querySelectorAll('a').forEach(x => x.classList.remove('active'));
    a.classList.add('active');
    load(a.dataset.sec);
  }));

  async function load(sec) {
    const main = document.getElementById('adminMain');
    main.innerHTML = '<div class="skeleton" style="height:200px"></div>';
    try {
      if (sec === 'overview') return await loadOverview();
      if (sec === 'slides') return await loadSlides();
      if (sec === 'siteContent') return await loadSiteContent();
      if (sec === 'featured') return await loadFeatured();
      if (sec === 'categories') return await loadCategoriesAdmin();
      if (sec === 'users') return await loadUsers();
      if (sec === 'kyc') return await loadKyc();
      if (sec === 'jobs') return await loadJobs();
      if (sec === 'testimonials') return await loadTestimonials();
      if (sec === 'comments') return await loadComments();
      if (sec === 'reviews') return await loadReviews();
      if (sec === 'disputes') return await loadDisputes();
      if (sec === 'payments') return await loadPayments();
      if (sec === 'revenue') return await loadRevenue();
      if (sec === 'audit') return await loadAudit();
      if (sec === 'subs') return await loadSubs();
      if (sec === 'ai') return await loadAI();
      if (sec === 'ads') return await loadAds();
      if (sec === 'export') return await loadExport();
      if (sec === 'fraud') return await loadFraud();
      if (sec === 'finance') return await loadFinanceApprovals();
      if (sec === 'settings') return await loadSettings();
    } catch (e) { main.innerHTML = `<p>Error: ${e.message}</p>`; }
  }

  async function loadSlides() {
  const slides = await API.get('/admin/slides');

  document.getElementById('adminMain').innerHTML = `
    <h1 class="section-title">Homepage Slides</h1>

    <div class="card" style="margin:24px 0">
      <div class="card-body">
        <h3>Add Slide</h3>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Title</label>
            <input class="form-input" id="slideTitle">
          </div>

          <div class="form-group">
            <label class="form-label">Sort Order</label>
            <input class="form-input" type="number" id="slideSort" value="0">
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Subtitle</label>
          <textarea class="form-textarea" id="slideSubtitle"></textarea>
        </div>

        <div class="form-group">
          <label class="form-label">Image URL</label>
          <input class="form-input" id="slideImage">
          ${adminImageUploadField('slideImage', 'slideImageFile', 'slideImagePreview', 'admin-slides')}
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">CTA Label</label>
            <input class="form-input" id="slideCtaLabel">
          </div>

          <div class="form-group">
            <label class="form-label">CTA URL</label>
            <input class="form-input" id="slideCtaUrl">
          </div>
        </div>

        <button class="btn btn-gold" onclick="createSlide()">Create Slide</button>
      </div>
    </div>

    <div class="grid grid-3">
      ${slides.map(s => `
        <div class="card">
          <div class="card-img">
            <img src="${s.image_url}" alt="${s.title || 'Slide'}">
          </div>

          <div class="card-body">
            <h3>${s.title || 'Untitled slide'}</h3>
            <p style="color:var(--text-soft);font-size:0.9rem">${s.subtitle || ''}</p>
            <div class="card-meta">
              <span>${s.status}</span>
              <span>Order: ${s.sort_order}</span>
            </div>

            <div style="display:flex;gap:8px;margin-top:12px">
              <button class="btn btn-outline btn-sm" onclick="toggleSlide('${s.id}', '${s.status === 'active' ? 'paused' : 'active'}')">
                ${s.status === 'active' ? 'Pause' : 'Activate'}
              </button>

              <button class="btn btn-outline btn-sm" onclick="deleteSlide('${s.id}')">
                Delete
              </button>
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

window.createSlide = async () => {
  try {
    await API.post('/admin/slides', {
      title: document.getElementById('slideTitle').value,
      subtitle: document.getElementById('slideSubtitle').value,
      image_url: document.getElementById('slideImage').value,
      cta_label: document.getElementById('slideCtaLabel').value,
      cta_url: document.getElementById('slideCtaUrl').value,
      sort_order: Number(document.getElementById('slideSort').value || 0),
      status: 'active'
    });

    Toast.show('Slide created');
    load('slides');
  } catch (e) {
    Toast.show(e.message);
  }
};

window.toggleSlide = async (id, status) => {
  await API.put(`/admin/slides/${id}`, { status });
  Toast.show('Slide updated');
  load('slides');
};

window.deleteSlide = async (id) => {
  await API.del(`/admin/slides/${id}`);
  Toast.show('Slide deleted');
  load('slides');
  bindAdminImageUpload('slideImage', 'slideImageFile', 'slideImagePreview', 'admin-slides');
};

  async function loadSiteContent() {
  const items = await API.get('/admin/site-content');

  document.getElementById('adminMain').innerHTML = `
    <h1 class="section-title">Site Content</h1>

    <div class="card" style="margin:24px 0">
      <div class="card-body">
        <h3>Add Content Block</h3>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Content Key</label>
            <input class="form-input" id="contentKey" placeholder="homepage_mission">
          </div>

          <div class="form-group">
            <label class="form-label">Target Page</label>
            <input class="form-input" id="contentPage" value="homepage">
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Title</label>
          <input class="form-input" id="contentTitle">
        </div>

        <div class="form-group">
          <label class="form-label">Body</label>
          <textarea class="form-textarea" id="contentBody"></textarea>
        </div>

        <div class="form-group">
          <label class="form-label">Media URL</label>
          <input class="form-input" id="contentMedia">
          ${adminImageUploadField('contentMedia', 'contentMediaFile', 'contentMediaPreview', 'admin-content')}
        </div>

          <div class="form-group">
            <label class="form-label">Link URL</label>
            <input class="form-input" id="contentLink">
          </div>
        </div>

        <button class="btn btn-gold" onclick="createContentBlock()">Create Content</button>
      </div>
    </div>

    ${items.map(item => `
      <div class="card" style="margin-top:12px">
        <div class="card-body">
          <strong>${item.content_key}</strong>
          <h3>${item.title || ''}</h3>
          <p style="color:var(--text-soft)">${item.body || ''}</p>
          <span class="badge badge-kyc">${item.status}</span>

          <div style="display:flex;gap:8px;margin-top:12px">
            <button class="btn btn-outline btn-sm" onclick="toggleContent('${item.id}', '${item.status === 'active' ? 'paused' : 'active'}')">
              ${item.status === 'active' ? 'Pause' : 'Activate'}
            </button>

            <button class="btn btn-outline btn-sm" onclick="deleteContent('${item.id}')">
              Delete
            </button>
          </div>
        </div>
      </div>
    `).join('')}
  `;
}

window.createContentBlock = async () => {
  await API.post('/admin/site-content', {
    content_key: document.getElementById('contentKey').value,
    title: document.getElementById('contentTitle').value,
    body: document.getElementById('contentBody').value,
    media_url: document.getElementById('contentMedia').value,
    link_url: document.getElementById('contentLink').value,
    target_page: document.getElementById('contentPage').value,
    status: 'active'
  });

  Toast.show('Content created');
  load('siteContent');
};

window.toggleContent = async (id, status) => {
  await API.put(`/admin/site-content/${id}`, { status });
  Toast.show('Content updated');
  load('siteContent');
};

window.deleteContent = async (id) => {
  await API.del(`/admin/site-content/${id}`);
  Toast.show('Content deleted');
  load('siteContent');
  bindAdminImageUpload('contentMedia', 'contentMediaFile', 'contentMediaPreview', 'admin-content');
};

  async function loadCategoriesAdmin() {
  const cats = await API.get('/marketplace/categories');

  document.getElementById('adminMain').innerHTML = `
    <h1 class="section-title">Categories</h1>

    <div class="card" style="margin:24px 0">
      <div class="card-body">
        <h3>Add Category</h3>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Name</label>
            <input class="form-input" id="catName">
          </div>

          <div class="form-group">
            <label class="form-label">Slug</label>
            <input class="form-input" id="catSlug">
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Ecosystem</label>
            <select class="form-select" id="catEco">
              <option value="hire">Hire Talent</option>
              <option value="shop">Shop Products</option>
              <option value="jobs">Find Jobs</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Sort Order</label>
            <input class="form-input" type="number" id="catSort" value="0">
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Description</label>
          <textarea class="form-textarea" id="catDesc"></textarea>
        </div>

        <button class="btn btn-gold" onclick="createCategory()">Create Category</button>
      </div>
    </div>

    <table class="table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Slug</th>
          <th>Ecosystem</th>
          <th>Sort</th>
          <th>Actions</th>
        </tr>
      </thead>

      <tbody>
        ${cats.map(c => `
          <tr>
            <td>${c.name}</td>
            <td>${c.slug}</td>
            <td>${c.ecosystem}</td>
            <td>${c.sort_order}</td>
            <td>
              <button class="btn btn-outline btn-sm" onclick="deleteCategory('${c.id}')">Delete</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

window.createCategory = async () => {
  await API.post('/admin/categories', {
    name: document.getElementById('catName').value,
    slug: document.getElementById('catSlug').value,
    ecosystem: document.getElementById('catEco').value,
    description: document.getElementById('catDesc').value,
    sort_order: Number(document.getElementById('catSort').value || 0)
  });

  Toast.show('Category created');
  load('categories');
};

window.deleteCategory = async (id) => {
  await API.del(`/admin/categories/${id}`);
  Toast.show('Category deleted');
  load('categories');
};

  function adminImageUploadField(inputId, fileId, previewId, folder = 'admin-media') {
  return `
    <div style="display:flex;gap:8px;align-items:center;margin-top:8px;flex-wrap:wrap">
      <input type="file" id="${fileId}" accept="image/*" style="display:none">
      <button type="button" class="btn btn-outline btn-sm" onclick="document.getElementById('${fileId}').click()">
        Upload Image
      </button>
      <span style="color:var(--text-muted);font-size:0.82rem">or paste image URL above</span>
    </div>
    <div id="${previewId}" style="margin-top:10px"></div>
  `;
}

window.bindAdminImageUpload = function (inputId, fileId, previewId, folder = 'admin-media') {
  const fileInput = document.getElementById(fileId);
  const urlInput = document.getElementById(inputId);
  const preview = document.getElementById(previewId);

  if (!fileInput || !urlInput) return;

  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];

    if (!file) return;

    if (!file.type.startsWith('image/')) {
      Toast.show('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      Toast.show('Image must be under 5MB');
      return;
    }

    try {
      Toast.show('Uploading image...');
      const url = await uploadImage(file, folder);
      urlInput.value = url;

      if (preview) {
        preview.innerHTML = `
          <img src="${url}" style="width:160px;height:100px;object-fit:cover;border-radius:8px;border:1px solid var(--border)">
        `;
      }

      Toast.show('Image uploaded');
    } catch (err) {
      Toast.show('Upload failed: ' + err.message);
    } finally {
      fileInput.value = '';
    }
  });
};

  async function loadFeatured() {
  const items = await API.get('/admin/featured-items');

  document.getElementById('adminMain').innerHTML = `
    <h1 class="section-title">Featured Items</h1>

    <div class="card" style="margin:24px 0">
      <div class="card-body">
        <h3>Add Featured Item</h3>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Item Type</label>
            <select class="form-select" id="featType">
              <option value="service">Service</option>
              <option value="product">Product</option>
              <option value="job">Job</option>
              <option value="seller">Seller</option>
              <option value="freelancer">Freelancer</option>
              <option value="category">Category</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Placement</label>
            <input class="form-input" id="featPlacement" value="homepage">
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Title</label>
            <input class="form-input" id="featTitle">
          </div>

          <div class="form-group">
            <label class="form-label">Sort Order</label>
            <input class="form-input" type="number" id="featSort" value="0">
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Subtitle</label>
          <textarea class="form-textarea" id="featSubtitle"></textarea>
        </div>

        <div class="form-group">
          <label class="form-label">Image URL</label>
          <input class="form-input" id="featImage">
          ${adminImageUploadField('featImage', 'featImageFile', 'featImagePreview', 'admin-featured')}
        </div>

          <div class="form-group">
            <label class="form-label">Link URL</label>
            <input class="form-input" id="featLink">
          </div>
        </div>

        <button class="btn btn-gold" onclick="createFeatured()">Create Featured Item</button>
      </div>
    </div>

    <div class="grid grid-3">
      ${items.map(item => `
        <div class="card">
          ${item.image_url ? `<div class="card-img"><img src="${item.image_url}"></div>` : ''}
          <div class="card-body">
            <span class="badge badge-kyc">${item.item_type}</span>
            <h3>${item.title || 'Untitled'}</h3>
            <p style="color:var(--text-soft)">${item.subtitle || ''}</p>

            <div style="display:flex;gap:8px;margin-top:12px">
              <button class="btn btn-outline btn-sm" onclick="toggleFeatured('${item.id}', '${item.status === 'active' ? 'paused' : 'active'}')">
                ${item.status === 'active' ? 'Pause' : 'Activate'}
              </button>

              <button class="btn btn-outline btn-sm" onclick="deleteFeatured('${item.id}')">
                Delete
              </button>
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

window.createFeatured = async () => {
  await API.post('/admin/featured-items', {
    item_type: document.getElementById('featType').value,
    title: document.getElementById('featTitle').value,
    subtitle: document.getElementById('featSubtitle').value,
    image_url: document.getElementById('featImage').value,
    link_url: document.getElementById('featLink').value,
    placement: document.getElementById('featPlacement').value,
    sort_order: Number(document.getElementById('featSort').value || 0),
    status: 'active'
  });

  Toast.show('Featured item created');
  load('featured');
};

window.toggleFeatured = async (id, status) => {
  await API.put(`/admin/featured-items/${id}`, { status });
  Toast.show('Featured item updated');
  load('featured');
};

window.deleteFeatured = async (id) => {
  await API.del(`/admin/featured-items/${id}`);
  Toast.show('Featured item deleted');
  load('featured');
  bindAdminImageUpload('featImage', 'featImageFile', 'featImagePreview', 'admin-featured');
};


  async function loadOverview() {
    const s = await API.get('/admin/overview');
    document.getElementById('adminMain').innerHTML = `
      <h1 class="section-title">Overview</h1>
      <div class="grid grid-4" style="margin:24px 0">
        <div class="stat-card"><div class="stat-num">${s.users}</div><div class="stat-label">Users</div></div>
        <div class="stat-card"><div class="stat-num">${s.jobs}</div><div class="stat-label">Jobs</div></div>
        <div class="stat-card"><div class="stat-num">${fmtPrice(s.revenue)}</div><div class="stat-label">Revenue (fees)</div></div>
        <div class="stat-card"><div class="stat-num">${s.disputes}</div><div class="stat-label">Disputes</div></div>
        <div class="stat-card"><div class="stat-num">${s.kycPending}</div><div class="stat-label">KYC Pending</div></div>
        <div class="stat-card"><div class="stat-num">${s.subsPending}</div><div class="stat-label">Subs Pending</div></div>
      </div>`;
  }

  async function loadUsers() {
    const users = await API.get('/admin/users');
    document.getElementById('adminMain').innerHTML = `
      <h1 class="section-title">Users</h1>
      <table class="table" style="margin-top:24px"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>KYC</th><th>Tier</th><th>Actions</th></tr></thead><tbody>
      ${users.map(u => `<tr><td>${u.display_name}</td><td>${u.email || ''}</td><td>${u.role}</td><td>L${u.kyc_level}</td><td>${u.subscription_tier}</td>
        <td><button class="btn btn-outline btn-sm" onclick="toggleAdmin('${u.user_id}')">Make Admin</button></td></tr>`).join('')}
      </tbody></table>`;
  }
  window.toggleAdmin = async (id) => { await API.put(`/admin/users/${id}`, { role: 'admin' }); Toast.show('User promoted to admin'); load('users'); };

  async function loadKyc() {
    const items = await API.get('/admin/kyc');
    document.getElementById('adminMain').innerHTML = `
      <h1 class="section-title">KYC Review</h1>
      ${items.length ? items.map(k => `
        <div class="card" style="margin-top:16px"><div class="card-body">
          <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:12px">
            <div><strong>${k.user?.display_name}</strong> (${k.user?.email})<br><span style="font-size:0.85rem;color:var(--text-muted)">${k.full_name} • ${timeAgo(k.created_at)}</span></div>
            <div><img src="${k.selfie_url}" style="max-width:200px;border-radius:8px"></div>
          </div>
          <div style="display:flex;gap:8px;margin-top:12px">
            <button class="btn btn-gold btn-sm" onclick="reviewKyc('${k.id}','approved')">Approve</button>
            <button class="btn btn-outline btn-sm" onclick="reviewKyc('${k.id}','rejected')">Reject</button>
          </div>
        </div></div>`).join('') : '<p style="color:var(--text-muted);margin-top:24px">No pending KYC submissions.</p>'}`;
  }
  window.reviewKyc = async (id, status) => { await API.put(`/admin/kyc/${id}`, { status }); Toast.show('KYC ' + status); load('kyc'); };

  async function loadJobs() {
    const jobs = await API.get('/admin/jobs');
    document.getElementById('adminMain').innerHTML = `
      <h1 class="section-title">Job Moderation</h1>
      <table class="table" style="margin-top:24px"><thead><tr><th>Title</th><th>Client</th><th>Status</th><th>Actions</th></tr></thead><tbody>
      ${jobs.map(j => `<tr><td>${j.title}</td><td>${j.profiles?.display_name || ''}</td><td><span class="badge badge-kyc">${j.status}</span></td>
        <td><button class="btn btn-gold btn-sm" onclick="setJobStatus('${j.id}','approved')">Approve</button> <button class="btn btn-outline btn-sm" onclick="setJobStatus('${j.id}','cancelled')">Reject</button></td></tr>`).join('')}
      </tbody></table>`;
  }
  window.setJobStatus = async (id, status) => { await API.put(`/admin/jobs/${id}/status`, { status }); Toast.show('Job ' + status); load('jobs'); };


  async function loadTestimonials() {
    const items = await API.get('/admin/testimonials');
    document.getElementById('adminMain').innerHTML = '<h1 class="section-title">Testimonials</h1>' + (items.length ? items.map(function (t) { var u = t.profiles || {}; return '<div class="card" style="margin-top:16px"><div class="card-body"><div style="display:flex;gap:12px;justify-content:space-between;flex-wrap:wrap"><div><strong>' + (u.display_name || 'Member') + '</strong> <span class="badge badge-kyc">' + t.status + '</span><p style="color:var(--text-soft);margin-top:8px">' + t.message + '</p><div class="stars">' + stars(t.rating || 0) + '</div></div><div style="display:flex;gap:8px;align-items:start"><button class="btn btn-gold btn-sm" onclick="moderateTestimonial(\'' + t.id + '\',\'approved\')">Approve</button><button class="btn btn-outline btn-sm" onclick="moderateTestimonial(\'' + t.id + '\',\'hidden\')">Hide</button><button class="btn btn-outline btn-sm" onclick="moderateTestimonial(\'' + t.id + '\',\'rejected\')">Reject</button></div></div></div></div>'; }).join('') : '<p style="color:var(--text-muted);margin-top:24px">No testimonials.</p>');
  }
  window.moderateTestimonial = async function (id, status) { await API.put('/admin/testimonials/' + id, { status: status }); Toast.show('Testimonial ' + status); load('testimonials'); };

  async function loadComments() {
    const items = await API.get('/admin/comments');
    document.getElementById('adminMain').innerHTML = '<h1 class="section-title">Comments</h1>' + (items.length ? items.map(function (c) { var u = c.profiles || {}; return '<div class="card" style="margin-top:16px"><div class="card-body"><strong>' + (u.display_name || 'Member') + '</strong> <span class="badge badge-kyc">' + c.status + '</span><p style="color:var(--text-soft);margin:8px 0">' + c.body + '</p><div style="display:flex;gap:8px"><button class="btn btn-gold btn-sm" onclick="moderateComment(\'' + c.id + '\',\'visible\')">Show</button><button class="btn btn-outline btn-sm" onclick="moderateComment(\'' + c.id + '\',\'hidden\')">Hide</button><button class="btn btn-outline btn-sm" onclick="moderateComment(\'' + c.id + '\',\'deleted\')">Delete</button></div></div></div>'; }).join('') : '<p style="color:var(--text-muted);margin-top:24px">No comments.</p>');
  }
  window.moderateComment = async function (id, status) { await API.put('/admin/comments/' + id, { status: status }); Toast.show('Comment ' + status); load('comments'); };

  async function loadReviews() {
    const items = await API.get('/admin/reviews');
    document.getElementById('adminMain').innerHTML = '<h1 class="section-title">Reviews</h1>' + (items.length ? items.map(function (r) { var from = r.reviewer || {}; var to = r.reviewee || {}; return '<div class="card" style="margin-top:16px"><div class="card-body"><div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap"><div><strong>' + (from.display_name || 'Reviewer') + '</strong> to <strong>' + (to.display_name || 'Member') + '</strong> <span class="badge badge-kyc">' + r.status + '</span><div class="stars">' + stars(r.stars) + '</div><p style="color:var(--text-soft);margin-top:8px">' + (r.comment || '') + '</p>' + (r.verified_purchase ? '<span class="badge badge-verified">Verified</span>' : '') + '</div><div style="display:flex;gap:8px;align-items:start"><button class="btn btn-gold btn-sm" onclick="moderateReview(\'' + r.id + '\',\'approved\')">Approve</button><button class="btn btn-outline btn-sm" onclick="moderateReview(\'' + r.id + '\',\'hidden\')">Hide</button><button class="btn btn-outline btn-sm" onclick="moderateReview(\'' + r.id + '\',\'rejected\')">Reject</button></div></div></div></div>'; }).join('') : '<p style="color:var(--text-muted);margin-top:24px">No reviews.</p>');
  }
  window.moderateReview = async function (id, status) { await API.put('/admin/reviews/' + id, { status: status }); Toast.show('Review ' + status); load('reviews'); };

  async function loadDisputes() {
    const d = await API.get('/admin/disputes');
    document.getElementById('adminMain').innerHTML = `
      <h1 class="section-title">Disputes</h1>
      ${d.length ? d.map(x => `<div class="card" style="margin-top:16px"><div class="card-body">
        <strong>${x.reason}</strong><br><span style="font-size:0.85rem;color:var(--text-muted)">${x.status} • ${timeAgo(x.created_at)}</span>
        <div style="margin-top:12px;display:flex;gap:8px"><button class="btn btn-gold btn-sm" onclick="resolveDispute('${x.id}','resolved')">Resolve</button><button class="btn btn-outline btn-sm" onclick="resolveDispute('${x.id}','dismissed')">Dismiss</button></div>
      </div></div>`).join('') : '<p style="color:var(--text-muted);margin-top:24px">No disputes.</p>'}`;
  }
  window.resolveDispute = async (id, status) => { await API.put(`/admin/disputes/${id}`, { status }); Toast.show('Dispute ' + status); load('disputes'); };

  async function loadPayments() {
    const p = await API.get('/admin/payments');
    document.getElementById('adminMain').innerHTML = `
      <h1 class="section-title">Payments</h1>
      <table class="table" style="margin-top:24px"><thead><tr><th>Client</th><th>Worker</th><th>Amount</th><th>Fee</th><th>Status</th><th>Actions</th></tr></thead><tbody>
      ${p.map(x => `<tr><td>${x.client?.display_name || ''}</td><td>${x.worker?.display_name || ''}</td><td>${fmtPrice(x.amount)}</td><td>${fmtPrice(x.service_fee)}</td><td>${x.status}</td>
        <td>${x.status === 'in_escrow' ? `<button class="btn btn-gold btn-sm" onclick="releasePay('${x.id}')">Release</button>` : ''}</td></tr>`).join('')}
      </tbody></table>`;
  }
  window.releasePay = async (id) => { await API.put(`/admin/payments/${id}/release`); Toast.show('Payment released to worker'); load('payments'); };

  async function loadRevenue() {
    const p = await API.get('/admin/payments');
    const released = p.filter(x => x.status === 'released');
    const total = released.reduce((s, x) => s + Number(x.service_fee || 0), 0);
    document.getElementById('adminMain').innerHTML = `
      <h1 class="section-title">Revenue</h1>
      <div class="stat-card" style="margin-top:24px"><div class="stat-num">${fmtPrice(total)}</div><div class="stat-label">Total platform fees collected</div></div>
      <p style="margin-top:16px;color:var(--text-soft)">${released.length} completed transactions.</p>`;
  }

  async function loadAudit() {
    const a = await API.get('/admin/audit');
    document.getElementById('adminMain').innerHTML = `
      <h1 class="section-title">Audit Logs</h1>
      <table class="table" style="margin-top:24px"><thead><tr><th>Actor</th><th>Action</th><th>Target</th><th>Time</th></tr></thead><tbody>
      ${a.map(x => `<tr><td>${x.actor?.display_name || 'system'}</td><td>${x.action}</td><td>${x.target_type || ''}</td><td>${timeAgo(x.created_at)}</td></tr>`).join('') || '<tr><td colspan="4">No logs.</td></tr>'}
      </tbody></table>`;
  }

  async function loadSubs() {
    const s = await API.get('/admin/subscriptions');
    document.getElementById('adminMain').innerHTML = `
      <h1 class="section-title">Subscription Approvals</h1>
      ${s.length ? s.map(x => `<div class="card" style="margin-top:16px"><div class="card-body" style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:12px">
        <div><strong>${x.user?.display_name}</strong> wants <span class="badge badge-gold">${x.tier}</span> (${fmtPrice(x.amount)})<br><span style="font-size:0.85rem;color:var(--text-muted)">${timeAgo(x.created_at)}</span></div>
        <div style="display:flex;gap:8px"><button class="btn btn-gold btn-sm" onclick="reviewSub('${x.id}','approved')">Approve</button><button class="btn btn-outline btn-sm" onclick="reviewSub('${x.id}','rejected')">Reject</button><button class="btn btn-outline btn-sm" onclick="reviewSub('${x.id}','refunded')">Refund</button></div>
      </div></div>`).join('') : '<p style="color:var(--text-muted);margin-top:24px">No pending subscriptions.</p>'}`;
  }
  window.reviewSub = async (id, status) => { await API.put(`/admin/subscriptions/${id}`, { status }); Toast.show('Subscription ' + status); load('subs'); };

  async function loadAI() {
    document.getElementById('adminMain').innerHTML = `
      <h1 class="section-title">AI Ranking Control</h1>
      <p class="section-sub">Configure AI ranking weights for smart search and recommendations.</p>
      <div class="card" style="margin-top:24px"><div class="card-body">
        <h3>Ranking weights</h3>
        <div class="form-group"><label class="form-label">Subscription tier weight</label><input class="form-input" type="number" value="30" id="w_tier"></div>
        <div class="form-group"><label class="form-label">Rating weight</label><input class="form-input" type="number" value="25" id="w_rating"></div>
        <div class="form-group"><label class="form-label">Completion rate weight</label><input class="form-input" type="number" value="15" id="w_completion"></div>
        <div class="form-group"><label class="form-label">Reviews weight</label><input class="form-input" type="number" value="10" id="w_reviews"></div>
        <div class="form-group"><label class="form-label">Response speed weight</label><input class="form-input" type="number" value="10" id="w_response"></div>
        <div class="form-group"><label class="form-label">Location relevance weight</label><input class="form-input" type="number" value="10" id="w_location"></div>
        <button class="btn btn-gold" onclick="Toast.show('AI weights saved (placeholder)')">Save Weights</button>
      </div></div>`;
  }

  async function loadAds() {
    const ads = await API.get('/admin/ads');
    document.getElementById('adminMain').innerHTML = `
      <h1 class="section-title">Content & Ads Management</h1>
      <div class="card" style="margin:24px 0"><div class="card-body">
        <h3>Create Ad / Post</h3>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Title</label><input class="form-input" id="adTitle"></div>
          <div class="form-group"><label class="form-label">Media URL</label><input class="form-input" id="adMedia">${adminImageUploadField('adMedia', 'adMediaFile', 'adMediaPreview', 'admin-ads')}</div>
        </div>
        <div class="form-group"><label class="form-label">Description</label><textarea class="form-textarea" id="adDesc"></textarea></div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Link URL (optional)</label><input class="form-input" id="adLink"></div>
          <div class="form-group"><label class="form-label">Link behavior</label><select class="form-select" id="adTab"><option value="true">Open new tab</option><option value="false">Same tab</option></select></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Ad type</label><select class="form-select" id="adType"><option>banner</option><option>sidebar</option><option>popup</option><option>feed</option><option>hero</option></select></div>
          <div class="form-group"><label class="form-label">Target page</label><select class="form-select" id="adPage"><option>all</option><option>landing</option><option>homepage</option><option>market</option><option>category</option><option>chat</option><option>payment</option><option>jobs</option></select></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Schedule (datetime)</label><input class="form-input" type="datetime-local" id="adSchedule"></div>
          <div class="form-group"><label class="form-label">Expiry (datetime)</label><input class="form-input" type="datetime-local" id="adExpiry"></div>
        </div>
        <button class="btn btn-gold" onclick="createAd()">Create Ad</button>
      </div></div>
      <h3>Existing Ads</h3>
      ${ads.length ? ads.map(a => `<div class="card" style="margin-top:12px"><div class="card-body" style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:12px">
        <div><strong>${a.title}</strong> <span class="badge badge-kyc">${a.ad_type} • ${a.target_page}</span><br><span style="font-size:0.85rem;color:var(--text-muted)">${a.status} • ${timeAgo(a.created_at)}</span></div>
        <button class="btn btn-outline btn-sm" onclick="deleteAd('${a.id}')">Delete</button>
      </div></div>`).join('') : '<p style="color:var(--text-muted)">No ads yet.</p>'}`;
    bindAdminImageUpload('adMedia', 'adMediaFile', 'adMediaPreview', 'admin-ads');
  }
  window.createAd = async () => {
    try {
      await API.post('/admin/ads', {
        title: document.getElementById('adTitle').value,
        description: document.getElementById('adDesc').value,
        media_url: document.getElementById('adMedia').value,
        link_url: document.getElementById('adLink').value,
        link_new_tab: document.getElementById('adTab').value === 'true',
        ad_type: document.getElementById('adType').value,
        target_page: document.getElementById('adPage').value,
        schedule_at: document.getElementById('adSchedule').value || new Date().toISOString(),
        expires_at: document.getElementById('adExpiry').value || null
      });
      Toast.show('Ad created'); load('ads');
    } catch (e) { Toast.show(e.message); }
  };
  window.deleteAd = async (id) => { await API.del(`/admin/ads/${id}`); Toast.show('Ad deleted'); load('ads'); };

  async function loadExport() {
    document.getElementById('adminMain').innerHTML = `
      <h1 class="section-title">Google Sheets Export</h1>
      <p class="section-sub">Export transaction data (placeholder — wire to Google Sheets API in production).</p>
      <div style="display:flex;gap:12px;margin:24px 0"><button class="btn btn-gold" onclick="exportSheet('processing')">Export Processing Jobs</button><button class="btn btn-gold" onclick="exportSheet('completed')">Export Completed Jobs</button></div>
      <div id="exportResult"></div>`;
  }
  window.exportSheet = async (sheet) => {
    const r = await API.get(`/admin/export/${sheet}`);
    document.getElementById('exportResult').innerHTML = `<div class="card"><div class="card-body"><strong>${r.sheet}</strong> — ${r.rows.length} rows<br><span style="font-size:0.85rem;color:var(--text-muted)">Exported at ${new Date(r.exportedAt).toLocaleString('en-NG', { timeZone: 'Africa/Lagos' })} (WAT)</span></div></div>`;
    Toast.show(`${r.rows.length} rows ready for Sheets`);
  };

  async function loadFraud() {
    document.getElementById('adminMain').innerHTML = `
      <h1 class="section-title">Fraud Monitoring</h1>
      <p class="section-sub">AI-powered fraud detection (placeholder).</p>
      <div class="card" style="margin-top:24px"><div class="card-body">
        <h3>Run fraud check</h3>
        <div class="form-group"><label class="form-label">Check type</label><select class="form-select" id="fraudType"><option value="payment_proof">Payment proof</option><option value="kyc">KYC</option><option value="scam">Scam patterns</option><option value="spam">Spam</option></select></div>
        <button class="btn btn-gold" onclick="runFraud()">Run Check</button>
        <div id="fraudResult" style="margin-top:16px"></div>
      </div></div>`;
  }
  window.runFraud = async () => {
    const r = await API.post('/ai/fraud-check', { type: document.getElementById('fraudType').value, data: {} });
    document.getElementById('fraudResult').innerHTML = `<span class="badge ${r.risk === 'high' ? 'badge-kyc' : r.risk === 'medium' ? 'badge-gold' : 'badge-verified'}">${r.risk} risk</span> ${r.flags?.join(', ') || ''}`;
  };

  async function loadFinanceApprovals() {
  const main = document.getElementById('adminMain');

  main.innerHTML = `
    <div class="section-head">
      <div>
        <span class="eyebrow">Finance Control</span>
        <h1 class="section-title" style="font-size:2rem">Withdrawals & Refunds</h1>
        <p class="section-sub">Approve, hold, cancel, or reject money-out requests after review.</p>
      </div>
    </div>

    <div class="grid grid-2" style="align-items:start">
      <div>
        <h2 style="font-size:1.4rem;margin-bottom:14px">Withdrawal Requests</h2>
        <div id="adminWithdrawals">
          <div class="skeleton" style="height:120px"></div>
        </div>
      </div>

      <div>
        <h2 style="font-size:1.4rem;margin-bottom:14px">Refund Requests</h2>
        <div id="adminRefunds">
          <div class="skeleton" style="height:120px"></div>
        </div>
      </div>
    </div>
  `;

  const [withdrawals, refunds] = await Promise.all([
    API.get('/admin/withdrawals').catch(() => []),
    API.get('/admin/refunds').catch(() => [])
  ]);

  document.getElementById('adminWithdrawals').innerHTML = withdrawals.length
    ? withdrawals.map(withdrawalCard).join('')
    : '<p style="color:var(--text-muted)">No withdrawal requests yet.</p>';

  document.getElementById('adminRefunds').innerHTML = refunds.length
    ? refunds.map(refundCard).join('')
    : '<p style="color:var(--text-muted)">No refund requests yet.</p>';
}

function approvalDelaySelect(id) {
  return `
    <label class="form-label" style="font-size:0.8rem;margin-bottom:4px">Delay</label>
    <select class="form-select" id="approvalDelayMinutes_${id}" style="max-width:180px">
      <option value="5">5 minutes</option>
      <option value="10">10 minutes</option>
      <option value="30">30 minutes</option>
      <option value="60">1 hour</option>
      <option value="1440">24 hours</option>
      <option value="10080">7 days</option>
    </select>
  `;
}

function withdrawalCard(w) {
  return `
    <div class="card" style="margin-bottom:12px">
      <div class="card-body">
        <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap">
          <div>
            <strong>${fmtPrice(w.amount)}</strong>
            <div class="card-meta">
              <span>${w.bank_name || 'No bank'}</span>
              <span>|</span>
              <span>${w.account_number || 'No account'}</span>
              <span>|</span>
              <span>${w.account_holder_name || 'No account name'}</span>
            </div>
          </div>

          <div style="text-align:right">
            <span class="badge badge-kyc">${w.status || 'pending'}</span>
            <div style="font-size:0.78rem;color:var(--text-muted);margin-top:6px">
              ${w.execution_status || 'not_scheduled'}
            </div>
          </div>
        </div>

        <div style="margin-top:10px;color:var(--text-muted);font-size:0.85rem">
          Risk: ${w.ai_risk?.risk || 'unknown'}
          ${w.ai_risk?.score !== undefined ? ` | Score: ${w.ai_risk.score}` : ''}
        </div>

        ${w.scheduled_for ? `
          <div style="margin-top:6px;color:var(--text-muted);font-size:0.85rem">
            Scheduled for: ${new Date(w.scheduled_for).toLocaleString()}
          </div>
        ` : ''}

        ${w.admin_note ? `
          <div style="margin-top:8px;color:var(--text-soft);font-size:0.85rem">
            Admin note: ${w.admin_note}
          </div>
        ` : ''}

        <textarea
          class="form-textarea"
          id="withdrawalNote_${w.id}"
          placeholder="Admin note"
          style="margin-top:10px"
        ></textarea>

        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;align-items:end">
          <div>${approvalDelaySelect(w.id)}</div>

          <button class="btn btn-gold btn-sm" onclick="approveWithdrawal('${w.id}')">
            Approve
          </button>

          <button class="btn btn-outline btn-sm" onclick="holdWithdrawal('${w.id}')">
            Hold
          </button>

          <button class="btn btn-ghost btn-sm" onclick="cancelWithdrawal('${w.id}')">
            Cancel
          </button>

          <button class="btn btn-outline btn-sm" onclick="rejectWithdrawal('${w.id}')">
            Reject
          </button>
        </div>
      </div>
    </div>
  `;
}

function refundCard(r) {
  return `
    <div class="card" style="margin-bottom:12px">
      <div class="card-body">
        <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap">
          <div>
            <strong>Refund Request</strong>
            <div class="card-meta">
              <span>Reason: ${r.reason || 'Not stated'}</span>
              <span>|</span>
              <span>Escrow: ${r.escrow_id || 'N/A'}</span>
            </div>
          </div>

          <div style="text-align:right">
            <span class="badge badge-kyc">${r.status || 'pending'}</span>
            <div style="font-size:0.78rem;color:var(--text-muted);margin-top:6px">
              ${r.execution_status || 'not_scheduled'}
            </div>
          </div>
        </div>

        ${r.notes ? `
          <p style="color:var(--text-soft);margin-top:8px;font-size:0.9rem">${r.notes}</p>
        ` : ''}

        <div style="margin-top:10px;color:var(--text-muted);font-size:0.85rem">
          Risk: ${r.ai_risk?.risk || 'unknown'}
          ${r.ai_risk?.score !== undefined ? ` | Score: ${r.ai_risk.score}` : ''}
        </div>

        ${r.evidence_urls && r.evidence_urls.length ? `
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
            ${r.evidence_urls.map(url => `
              <a href="${url}" target="_blank" class="btn btn-outline btn-sm">Evidence</a>
            `).join('')}
          </div>
        ` : ''}

        ${r.scheduled_for ? `
          <div style="margin-top:6px;color:var(--text-muted);font-size:0.85rem">
            Scheduled for: ${new Date(r.scheduled_for).toLocaleString()}
          </div>
        ` : ''}

        ${r.admin_note ? `
          <div style="margin-top:8px;color:var(--text-soft);font-size:0.85rem">
            Admin note: ${r.admin_note}
          </div>
        ` : ''}

        <textarea
          class="form-textarea"
          id="refundNote_${r.id}"
          placeholder="Admin note"
          style="margin-top:10px"
        ></textarea>

        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;align-items:end">
          <div>${approvalDelaySelect(r.id)}</div>

          <button class="btn btn-gold btn-sm" onclick="approveRefund('${r.id}')">
            Approve
          </button>

          <button class="btn btn-outline btn-sm" onclick="holdRefund('${r.id}')">
            Hold
          </button>

          <button class="btn btn-ghost btn-sm" onclick="cancelRefund('${r.id}')">
            Cancel
          </button>

          <button class="btn btn-outline btn-sm" onclick="rejectRefund('${r.id}')">
            Reject
          </button>
        </div>
      </div>
    </div>
  `;
}

function getApprovalDelay(id) {
  const el = document.getElementById(`approvalDelayMinutes_${id}`);
  return Number(el?.value || 5);
}

function getAdminNote(prefix, id) {
  const el = document.getElementById(`${prefix}_${id}`);
  return el?.value || '';
}

window.approveWithdrawal = async function (id) {
  try {
    await API.put(`/admin/withdrawals/${id}`, {
      status: 'approved',
      admin_note: getAdminNote('withdrawalNote', id),
      approval_delay_minutes: getApprovalDelay(id)
    });

    Toast.show('Withdrawal approved and scheduled');
    await loadFinanceApprovals();
  } catch (err) {
    Toast.show(err.message);
  }
};

window.holdWithdrawal = async function (id) {
  try {
    await API.put(`/admin/withdrawals/${id}`, {
      status: 'held',
      admin_note: getAdminNote('withdrawalNote', id)
    });

    Toast.show('Withdrawal placed on hold');
    await loadFinanceApprovals();
  } catch (err) {
    Toast.show(err.message);
  }
};

window.cancelWithdrawal = async function (id) {
  try {
    await API.put(`/admin/withdrawals/${id}`, {
      status: 'cancelled',
      admin_note: getAdminNote('withdrawalNote', id)
    });

    Toast.show('Withdrawal cancelled');
    await loadFinanceApprovals();
  } catch (err) {
    Toast.show(err.message);
  }
};

window.rejectWithdrawal = async function (id) {
  try {
    await API.put(`/admin/withdrawals/${id}`, {
      status: 'rejected',
      admin_note: getAdminNote('withdrawalNote', id)
    });

    Toast.show('Withdrawal rejected');
    await loadFinanceApprovals();
  } catch (err) {
    Toast.show(err.message);
  }
};

window.approveRefund = async function (id) {
  try {
    await API.put(`/admin/refunds/${id}`, {
      status: 'approved',
      admin_note: getAdminNote('refundNote', id),
      approval_delay_minutes: getApprovalDelay(id)
    });

    Toast.show('Refund approved and scheduled');
    await loadFinanceApprovals();
  } catch (err) {
    Toast.show(err.message);
  }
};

window.holdRefund = async function (id) {
  try {
    await API.put(`/admin/refunds/${id}`, {
      status: 'held',
      admin_note: getAdminNote('refundNote', id)
    });

    Toast.show('Refund placed on hold');
    await loadFinanceApprovals();
  } catch (err) {
    Toast.show(err.message);
  }
};

window.cancelRefund = async function (id) {
  try {
    await API.put(`/admin/refunds/${id}`, {
      status: 'cancelled',
      admin_note: getAdminNote('refundNote', id)
    });

    Toast.show('Refund cancelled');
    await loadFinanceApprovals();
  } catch (err) {
    Toast.show(err.message);
  }
};

window.rejectRefund = async function (id) {
  try {
    await API.put(`/admin/refunds/${id}`, {
      status: 'rejected',
      admin_note: getAdminNote('refundNote', id)
    });

    Toast.show('Refund rejected');
    await loadFinanceApprovals();
  } catch (err) {
    Toast.show(err.message);
  }
};

  async function loadSettings() {
    const s = await API.get('/admin/settings');
    document.getElementById('adminMain').innerHTML = `
      <h1 class="section-title">Platform Settings</h1>
      <div class="card" style="margin-top:24px;max-width:480px"><div class="card-body">
        <div class="form-group"><label class="form-label">Service fee (%)</label><input class="form-input" type="number" value="${s?.service_fee_percent || 10}" id="setFee"></div>
        <div class="form-group"><label class="form-label">Escrow hold (hours before Received)</label><input class="form-input" type="number" value="${s?.escrow_hold_hours || 1}" id="setHold"></div>
        <button class="btn btn-gold" onclick="saveSettings()">Save</button>
      </div></div>`;
  }
  window.saveSettings = async () => {
    await API.put('/admin/settings', { service_fee_percent: +document.getElementById('setFee').value, escrow_hold_hours: +document.getElementById('setHold').value });
    Toast.show('Settings saved');
  };

  load('overview');
});
