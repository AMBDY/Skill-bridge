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
      ${statCard('New Jobs', summary.availableJobs.length, '/jobs.html')}
      ${statCard('Jobs Applied', summary.bids.length)}
      ${statCard('Unread Messages', summary.notifications.filter(n => !n.read).length, '/chat.html')}
      ${statCard('Profile', 'Edit', `/profile.html?id=${user?.user_id}`)}
    </div>

    <div class="grid grid-2">
      <div>
        <h2 style="font-size:1.4rem;margin:0 0 14px">Recommended Jobs</h2>
        ${rows(summary.availableJobs, 'No new jobs available.', jobRow)}
      </div>

      <div>
        <h2 style="font-size:1.4rem;margin:0 0 14px">My Applications</h2>
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
      ${statCard('Available Jobs', summary.availableJobs.length, '/jobs.html')}
      ${statCard('Jobs Applied', summary.bids.length)}
      ${statCard('My Services', summary.services.length)}
      ${statCard('KYC Status', `L${user?.kyc_level || 0}`)}
    </div>

    <div class="grid grid-2">
      <div>
        <h2 style="font-size:1.4rem;margin:0 0 14px">Available Jobs</h2>
        ${rows(summary.availableJobs, 'No jobs available.', jobRow)}
      </div>

      <div>
        <h2 style="font-size:1.4rem;margin:0 0 14px">My Service Listings</h2>
        ${rows(summary.services, 'No services listed yet.', serviceRow)}

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
