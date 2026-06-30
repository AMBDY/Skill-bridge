document.addEventListener('DOMContentLoaded', async () => {
  if (!Auth.isLoggedIn()) {
    location.href = '/signin.html';
    return;
  }

  const main = document.getElementById('dashMain');
  const user = Auth.user();

  main.innerHTML = '<div class="skeleton" style="height:160px"></div>';

  const summary = await API.get('/marketplace/me/summary').catch(() => ({
    role: user?.role,
    jobsCreated: [],
    bids: [],
    products: [],
    services: [],
    ordersAsSeller: [],
    ordersAsBuyer: [],
    withdrawals: [],
    notifications: [],
    reviews: [],
    availableJobs: []
  }));

  const role = user?.role || summary.role || 'client';

  if (role === 'client') return renderClient(main, user, summary);
  if (role === 'freelancer') return renderFreelancer(main, user, summary);
  if (role === 'worker') return renderWorker(main, user, summary);
  if (role === 'seller') return renderSeller(main, user, summary);
  if (role === 'admin') return renderAdmin(main, user, summary);

  renderClient(main, user, summary);
});

function dashboardHeader(user, title) {
  return `
    <h1 class="section-title">${title}</h1>
    <p class="section-sub">
      ${user?.display_name || 'User'} | ${user?.role || ''}
      | Tier: ${user?.subscription_tier || 'free'} | KYC: L${user?.kyc_level || 0}
    </p>
  `;
}

function statCard(label, value, href) {
  const content = `<div class="stat-num">${value}</div><div class="stat-label">${label}</div>`;
  return href
    ? `<a href="${href}" class="stat-card">${content}</a>`
    : `<div class="stat-card">${content}</div>`;
}

function rows(items, emptyText, mapper) {
  if (!items || !items.length) return `<p style="color:var(--text-muted)">${emptyText}</p>`;
  return items.map(mapper).join('');
}

function jobRow(j) {
  return `
    <div class="card" style="margin-bottom:10px">
      <div class="card-body" style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap">
        <div>
          <a href="/job.html?id=${j.id}" style="font-weight:600">${j.title}</a>
          <div class="card-meta">
            <span>${j.status}</span><span>|</span>
            <span>${j.job_type || 'remote'}</span><span>|</span>
            <span>${j.location || j.state || 'Nigeria'}</span>
          </div>
        </div>
        <div style="text-align:right">
          <div class="card-price">${fmtPrice(j.budget || j.price_max || 0)}</div>
          <a href="/job.html?id=${j.id}" class="btn btn-outline btn-sm">View</a>
        </div>
      </div>
    </div>
  `;
}

function bidRow(b) {
  return `
    <div class="card" style="margin-bottom:10px">
      <div class="card-body" style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap">
        <div>
          <div style="font-weight:600">Job Application</div>
          <div class="card-meta">
            <span>${b.status}</span><span>|</span><span>${b.duration || 'Flexible'}</span>
          </div>
        </div>
        <div class="card-price">${fmtPrice(b.amount || 0)}</div>
      </div>
    </div>
  `;
}

function productRow(p) {
  return `
    <div class="card" style="margin-bottom:10px">
      <div class="card-body" style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap">
        <div>
          <a href="/listing.html?type=product&id=${p.id}" style="font-weight:600">${p.title}</a>
          <div class="card-meta">
            <span>${p.status}</span><span>|</span><span>Stock: ${p.stock || 0}</span>
          </div>
        </div>
        <div class="card-price">${fmtPrice(p.price || 0)}</div>
      </div>
    </div>
  `;
}

function serviceRow(s) {
  return `
    <div class="card" style="margin-bottom:10px">
      <div class="card-body" style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap">
        <div>
          <a href="/listing.html?type=service&id=${s.id}" style="font-weight:600">${s.title}</a>
          <div class="card-meta">
            <span>${s.status}</span><span>|</span><span>${s.delivery_days || 7} days</span>
          </div>
        </div>
        <div class="card-price">${fmtPrice(s.price || 0)}</div>
      </div>
    </div>
  `;
}

function withdrawalRows(items) {
  return rows(items, 'No withdrawals yet.', w => `
    <div class="card" style="margin-bottom:10px">
      <div class="card-body" style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap">
        <div>
          <strong>${fmtPrice(w.amount)}</strong>
          <div class="card-meta">${w.bank_name || ''} ${w.account_number || ''}</div>
        </div>
        <span class="badge badge-kyc">${w.status}</span>
      </div>
    </div>
  `);
}

function renderClient(main, user, summary) {
  main.innerHTML = `
    ${dashboardHeader(user, 'Client Dashboard')}

    <div class="grid grid-4" style="margin:24px 0">
      ${statCard('Post a Job', '+', '/post-job.html')}
      ${statCard('My Jobs', summary.jobsCreated.length)}
      ${statCard('Messages', summary.notifications.filter(n => !n.read).length, '/chat.html')}
      ${statCard('My Profile', 'Edit', `/profile.html?id=${user?.user_id}`)}
    </div>

    <h2 style="font-size:1.4rem;margin:24px 0 14px">My Posted Jobs</h2>
    ${rows(summary.jobsCreated, 'No jobs posted yet.', jobRow)}

    <h2 style="font-size:1.4rem;margin:24px 0 14px">Orders And Purchases</h2>
    ${rows(summary.ordersAsBuyer, 'No purchases yet.', o => `
      <div class="card" style="margin-bottom:10px">
        <div class="card-body">${fmtPrice(o.amount)} - ${o.status}</div>
      </div>
    `)}
  `;
}

function renderFreelancer(main, user, summary) {
  main.innerHTML = `
    ${dashboardHeader(user, 'Freelancer Dashboard')}

    <div class="grid grid-4" style="margin:24px 0">
      ${statCard('New Jobs', summary.availableJobs.length, '#availableJobsSection')}
      ${statCard('Jobs Applied', summary.bids.length, '#applicationsSection')}
      ${statCard('Unread Messages', summary.notifications.filter(n => !n.read).length, '/chat.html')}
      ${statCard('Edit Profile', 'Edit', `/profile.html?id=${user?.user_id}`)}
    </div>

    <div class="grid grid-2">
      <div id="availableJobsSection">
        <h2 style="font-size:1.4rem;margin:0 0 14px">Recommended Jobs</h2>
        ${rows(summary.availableJobs, 'No new jobs available.', jobRow)}
      </div>

      <div id="applicationsSection">
        <h2 style="font-size:1.4rem;margin:0 0 14px">Jobs Applied</h2>
        ${rows(summary.bids, 'No applications yet.', bidRow)}

        <h2 style="font-size:1.4rem;margin:24px 0 14px">Withdrawals</h2>
        ${withdrawalRows(summary.withdrawals)}
      </div>
    </div>
  `;
}
function renderWorker(main, user, summary) {
  main.innerHTML = `
    ${dashboardHeader(user, 'Worker Dashboard')}

    <div class="grid grid-4" style="margin:24px 0">
      ${statCard('Available Jobs', summary.availableJobs.length, '#availableJobsSection')}
      ${statCard('Jobs Applied', summary.bids.length, '#applicationsSection')}
      ${statCard('My Services', summary.services.length, '#servicesSection')}
      ${statCard('Edit Profile', 'Edit', `/profile.html?id=${user?.user_id}`)}
    </div>

    <div class="grid grid-2">
      <div id="availableJobsSection">
        <h2 style="font-size:1.4rem;margin:0 0 14px">Available Jobs</h2>
        ${rows(summary.availableJobs, 'No jobs available.', jobRow)}
      </div>

      <div>
        <div id="applicationsSection">
          <h2 style="font-size:1.4rem;margin:0 0 14px">Jobs Applied</h2>
          ${rows(summary.bids, 'No applications yet.', bidRow)}
        </div>

        <div id="servicesSection">
          <h2 style="font-size:1.4rem;margin:24px 0 14px">My Services</h2>
          ${rows(summary.services, 'No services listed yet.', serviceRow)}
        </div>

        <h2 style="font-size:1.4rem;margin:24px 0 14px">Withdrawals</h2>
        ${withdrawalRows(summary.withdrawals)}
      </div>
    </div>
  `;
}
function renderSeller(main, user, summary) {
  main.innerHTML = `
    ${dashboardHeader(user, 'Seller Dashboard')}

    <div class="grid grid-4" style="margin:24px 0">
      ${statCard('Products', summary.products.length)}
      ${statCard('Orders', summary.ordersAsSeller.length)}
      ${statCard('Pending Withdrawals', summary.withdrawals.filter(w => w.status === 'pending').length)}
      ${statCard('Store Profile', 'Edit', `/profile.html?id=${user?.user_id}`)}
    </div>

    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:24px">
  <button class="btn btn-gold" onclick="openProductForm()">+ Upload Product</button>
  <a href="/profile.html?id=${user?.user_id}&edit=1" class="btn btn-outline">Edit Store Profile</a>
</div>

<div id="sellerProductForm" style="display:none;margin-bottom:24px">
  <div class="card">
    <div class="card-body">
      <h2 style="font-size:1.3rem;margin-bottom:14px">Upload Product</h2>

      <form id="productUploadForm">
        <div class="form-group">
          <label class="form-label">Product Category</label>
          <select class="form-select" name="category_id" id="sellerProductCategory" required></select>
        </div>

        <div class="form-group">
          <label class="form-label">Product Title</label>
          <input class="form-input" name="title" required>
        </div>

        <div class="form-group">
          <label class="form-label">Description</label>
          <textarea class="form-textarea" name="description" required></textarea>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Price</label>
            <input class="form-input" type="number" name="price" required>
          </div>

          <div class="form-group">
            <label class="form-label">Stock</label>
            <input class="form-input" type="number" name="stock" value="1">
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Size</label>
            <input class="form-input" name="size">
          </div>

          <div class="form-group">
            <label class="form-label">Color</label>
            <input class="form-input" name="color">
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Product Images</label>
          <input type="file" id="productImageInput" accept="image/*" multiple>
          <div id="productImagePreview" style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px"></div>
        </div>

        <button class="btn btn-gold btn-block" type="submit">Submit Product For Approval</button>
      </form>
    </div>
  </div>
</div>

    <div class="grid grid-2">
      <div>
        <h2 style="font-size:1.4rem;margin:0 0 14px">My Products</h2>
        ${rows(summary.products, 'No products listed yet.', productRow)}
      </div>

      <div>
        <h2 style="font-size:1.4rem;margin:0 0 14px">Orders</h2>
        ${rows(summary.ordersAsSeller, 'No orders yet.', o => `
          <div class="card" style="margin-bottom:10px">
            <div class="card-body">${fmtPrice(o.amount)} - ${o.status}</div>
          </div>
        `)}

        <h2 style="font-size:1.4rem;margin:24px 0 14px">Withdrawals</h2>
        ${withdrawalRows(summary.withdrawals)}
      </div>
    </div>
  `;
}

function renderAdmin(main, user, summary) {
  main.innerHTML = `
    ${dashboardHeader(user, 'Superadmin Dashboard')}

    <div class="grid grid-4" style="margin:24px 0">
      ${statCard('Admin Control', 'Open', '/admin.html')}
      ${statCard('Posted Jobs', summary.jobsCreated.length)}
      ${statCard('Messages', summary.notifications.filter(n => !n.read).length, '/chat.html')}
      ${statCard('Profile', 'Edit', `/profile.html?id=${user?.user_id}`)}
    </div>
  `;
}

let sellerProductImages = [];

window.openProductForm = async function () {
  const formWrap = document.getElementById('sellerProductForm');
  formWrap.style.display = formWrap.style.display === 'none' ? 'block' : 'none';

  const catSel = document.getElementById('sellerProductCategory');
  if (catSel && !catSel.dataset.loaded) {
    const cats = await API.get('/marketplace/categories?ecosystem=shop').catch(() => []);
    catSel.innerHTML =
      '<option value="">Select product category</option>' +
      cats.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    catSel.dataset.loaded = '1';
  }

  bindProductUploadForm();
};

function bindProductUploadForm() {
  const fileInput = document.getElementById('productImageInput');
  const preview = document.getElementById('productImagePreview');
  const form = document.getElementById('productUploadForm');

  if (!fileInput || fileInput.dataset.bound) return;
  fileInput.dataset.bound = '1';

  fileInput.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files || []);

    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        Toast.show('Only image files are allowed');
        continue;
      }

      if (file.size > 5 * 1024 * 1024) {
        Toast.show('Each image must be under 5MB');
        continue;
      }

      const url = await uploadImage(file, 'seller-products');
      sellerProductImages.push(url);
    }

    preview.innerHTML = sellerProductImages.map((url, index) => `
      <div style="width:110px;position:relative;border:1px solid var(--border);border-radius:8px;overflow:hidden">
        <img src="${url}" style="width:110px;height:90px;object-fit:cover">
        <button type="button" onclick="removeSellerProductImage(${index})"
          style="position:absolute;top:4px;right:4px;background:#111;color:#fff;border:0;border-radius:999px;width:24px;height:24px;cursor:pointer">×</button>
      </div>
    `).join('');

    e.target.value = '';
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const data = Object.fromEntries(new FormData(e.target));

    data.price = data.price ? Number(data.price) : 0;
    data.stock = data.stock ? Number(data.stock) : 1;
    data.images = sellerProductImages;

    if (!data.size) delete data.size;
    if (!data.color) delete data.color;

    try {
      await API.post('/marketplace/products', data);
      Toast.show('Product submitted for approval');
      setTimeout(() => location.reload(), 1000);
    } catch (err) {
      Toast.show(err.message);
    }
  });
}

window.removeSellerProductImage = function (index) {
  sellerProductImages.splice(index, 1);
  const preview = document.getElementById('productImagePreview');

  preview.innerHTML = sellerProductImages.map((url, i) => `
    <div style="width:110px;position:relative;border:1px solid var(--border);border-radius:8px;overflow:hidden">
      <img src="${url}" style="width:110px;height:90px;object-fit:cover">
      <button type="button" onclick="removeSellerProductImage(${i})"
        style="position:absolute;top:4px;right:4px;background:#111;color:#fff;border:0;border-radius:999px;width:24px;height:24px;cursor:pointer">×</button>
    </div>
  `).join('');
};
