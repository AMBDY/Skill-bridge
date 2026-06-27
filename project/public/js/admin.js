document.addEventListener('DOMContentLoaded', async () => {
  if (!Auth.isLoggedIn()) { location.href = '/signin.html'; return; }
  const user = Auth.user();
  if (user.role !== 'admin') {
    document.getElementById('adminMain').innerHTML = '<p>Admin access required. Contact the platform owner.</p>';
    return;
  }

  const sections = [
    { id: 'overview', label: 'Overview' },
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
    { id: 'settings', label: 'Settings' },
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
      if (sec === 'settings') return await loadSettings();
    } catch (e) { main.innerHTML = `<p>Error: ${e.message}</p>`; }
  }

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
          <div class="form-group"><label class="form-label">Media URL</label><input class="form-input" id="adMedia"></div>
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
