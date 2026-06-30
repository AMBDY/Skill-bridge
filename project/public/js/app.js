// SkillBridge shared client logic
const SUPABASE_URL = window.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || '';

let sb = null;
let sbInitPromise = null;

function initSb() {
  if (sb) return Promise.resolve(sb);
  if (sbInitPromise) return sbInitPromise;
  sbInitPromise = new Promise((resolve) => {
    const getSupabaseFactory = () => window.supabase;
    const factory = getSupabaseFactory();
    if (factory && SUPABASE_URL && SUPABASE_ANON_KEY) {
      sb = factory.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      return resolve(sb);
    }
    const check = setInterval(() => {
      const factory = getSupabaseFactory();
      if (factory && SUPABASE_URL && SUPABASE_ANON_KEY) {
        clearInterval(check);
        sb = factory.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        resolve(sb);
      }
    }, 100);
    setTimeout(() => { clearInterval(check); resolve(null); }, 10000);
  });
  return sbInitPromise;
}

const API = (function () {
  const base = '/api';
  async function req(path, opts = {}) {
    const token = Auth.getToken();
    const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(base + path, { ...opts, headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
  }
  return {
    get: (p) => req(p),
    post: (p, body) => req(p, { method: 'POST', body: JSON.stringify(body) }),
    put: (p, body) => req(p, { method: 'PUT', body: JSON.stringify(body) }),
    del: (p) => req(p, { method: 'DELETE' }),
  };
})();

const Auth = (function () {
  function getToken() { return localStorage.getItem('sb_token'); }
  function setSession(token, refreshToken, user) {
    localStorage.setItem('sb_token', token);
    localStorage.setItem('sb_refresh', refreshToken);
    localStorage.setItem('sb_user', JSON.stringify(user));
  }
  function clear() { localStorage.removeItem('sb_token'); localStorage.removeItem('sb_refresh'); localStorage.removeItem('sb_user'); }
  function user() { try { return JSON.parse(localStorage.getItem('sb_user')); } catch { return null; } }
  function isLoggedIn() { return !!getToken(); }

  async function signup(payload) {
  const client = await initSb();

  if (!client) {
    throw new Error('Supabase not initialized');
  }

  // 1. Create auth user.
  // The database trigger will create the public.profiles row automatically.
  const { data: authData, error: authErr } = await client.auth.signUp({
    email: payload.email,
    password: payload.password,
    options: {
      data: {
        role: payload.role,
        first_name: payload.first_name,
        middle_name: payload.middle_name,
        last_name: payload.last_name,
        display_name: payload.display_name,
        phone: payload.phone,
        country: payload.country || 'Nigeria',
        state: payload.state,
        city: payload.city,
        address: payload.address,
        bank_name: payload.bank_name,
        account_number: payload.account_number,
        account_holder_name: payload.account_holder_name,
        profile_image: payload.profile_image || null
      }
    }
  });

  if (authErr) {
    throw new Error(authErr.message);
  }

  const userId = authData.user?.id;

  if (!userId) {
    throw new Error('Failed to create auth user');
  }

  // 2. Wait for trigger-created profile.
  let profile = null;

  for (let i = 0; i < 10; i++) {
    const { data } = await client
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (data) {
      profile = data;
      break;
    }

    await new Promise(resolve => setTimeout(resolve, 500));
  }

  if (!profile) {
    throw new Error('Account created, but profile was not ready. Please sign in again.');
  }

  // 3. Submit KYC if selfie was uploaded.
  // This now happens AFTER the profile exists.
  if (payload.kyc_selfie) {
    const { error: kycErr } = await client.from('kyc_submissions').insert({
      user_id: userId,
      selfie_url: payload.kyc_selfie,
      full_name: `${payload.first_name || ''} ${payload.last_name || ''}`.trim(),
      status: 'pending'
    });

    if (kycErr) {
      throw new Error(kycErr.message);
    }

    // Optional: mark the profile as Level 1 while waiting for admin KYC approval.
    const { data: updatedProfile, error: updateErr } = await client
      .from('profiles')
      .update({ kyc_level: 1 })
      .eq('user_id', userId)
      .select()
      .single();

    if (!updateErr && updatedProfile) {
      profile = updatedProfile;
    }
  }

  // 4. Get active auth session.
  const { data: sessionData } = await client.auth.getSession();

  const token = sessionData?.session?.access_token || '';
  const refreshToken = sessionData?.session?.refresh_token || '';

  // 5. Save frontend session.
  setSession(token, refreshToken, profile);

  return {
    user: profile,
    token,
    refreshToken
  };
}

  async function signin(email, password) {
    const client = await initSb();
    if (!client) throw new Error('Supabase not initialized');

    const { data: authData, error: authErr } = await client.auth.signInWithPassword({ email, password });
    if (authErr) throw new Error(authErr.message);
    const userId = authData.user?.id;

    const { data: profile } = await client.from('profiles').select('*').eq('user_id', userId).maybeSingle();
    if (!profile) throw new Error('Profile not found. Contact support.');

    const token = authData.session?.access_token || '';
    const refreshToken = authData.session?.refresh_token || '';
    setSession(token, refreshToken, profile);
    return { user: profile, token, refreshToken };
  }

  async function me() {
    const client = await initSb();
    if (!client) return { user: null };
    const { data: { session } } = await client.auth.getSession();
    if (!session) return { user: null };
    const { data: profile } = await client.from('profiles').select('*').eq('user_id', session.user.id).maybeSingle();
    return { user: profile };
  }

   async function resetPassword(email) {
    const client = await initSb();

    if (!client) {
      throw new Error('Supabase not initialized');
    }

    const redirectTo = `${window.location.origin}/signin.html`;

    const { error } = await client.auth.resetPasswordForEmail(email, {
      redirectTo
    });

    if (error) {
      throw new Error(error.message);
    }

    return true;
  }

  function logout() {
    clear();
    initSb().then(c => c?.auth.signOut().catch(() => {}));
    window.location.href = '/';
  }

  return {
    getToken,
    setSession,
    clear,
    user,
    isLoggedIn,
    me,
    signin,
    signup,
    logout,
    resetPassword
  };
})();

// Upload image to Supabase Storage
async function uploadImage(file, folder = 'kyc') {
  const client = await initSb();
  if (!client) throw new Error('Storage not configured');
  const ext = file.name.split('.').pop();
  const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { data, error } = await client.storage.from('kyc').upload(fileName, file, { cacheControl: '3600', upsert: false });
  if (error) throw error;
  const { data: pub } = client.storage.from('kyc').getPublicUrl(fileName);
  return pub.publicUrl;
}

const Theme = (function () {
  function get() { return localStorage.getItem('sb_theme') || 'light'; }
  function set(t) { localStorage.setItem('sb_theme', t); document.documentElement.setAttribute('data-theme', t); updateToggle(); }
  function toggle() { set(get() === 'light' ? 'dark' : 'light'); }
  function updateToggle() {
    const btn = document.getElementById('themeToggle');
    if (btn) btn.textContent = get() === 'light' ? '🌙' : '☀️';
  }
  function init() { set(get()); }
  return { get, set, toggle, init, updateToggle };
})();

const Toast = (function () {
  function ensure() {
    let w = document.querySelector('.toast-wrap');
    if (!w) { w = document.createElement('div'); w.className = 'toast-wrap'; document.body.appendChild(w); }
    return w;
  }
  function show(msg, ms = 3500) {
    const w = ensure();
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    w.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, ms);
  }
  return { show };
})();

const Skeleton = (function () {
  function grid(count, container) {
    container.innerHTML = '';
    for (let i = 0; i < count; i++) {
      const el = document.createElement('div');
      el.className = 'card';
      el.innerHTML = `<div class="skeleton card-img"></div><div class="card-body"><div class="skeleton" style="height:18px;width:80%;margin-bottom:8px"></div><div class="skeleton" style="height:14px;width:50%"></div></div>`;
      container.appendChild(el);
    }
  }
  return { grid };
})();

function fmtPrice(n) {
  return '₦' + Number(n || 0).toLocaleString('en-NG', { maximumFractionDigits: 0 });
}
function stars(n) {
  const full = Math.round(n || 0);
  return '★'.repeat(full) + '☆'.repeat(5 - full);
}
function timeAgo(date) {
  const d = new Date(date); const s = (Date.now() - d.getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  return Math.floor(s / 86400) + 'd ago';
}

function renderNav() {
  const nav = document.getElementById('navbar');

  if (!nav) return;

  const logged = Auth.isLoggedIn();
  const user = Auth.user();

  nav.innerHTML = `
    <div class="container nav-inner">
      <a href="/" class="logo">Skill<span>Bridge</span></a>

      <div class="nav-search">
        <input type="text" placeholder="Search services, products, jobs..." id="navSearchInput">
      </div>

      <div class="nav-actions">
        <button class="icon-btn" id="themeToggle" title="Toggle theme">🌙</button>

        <button class="icon-btn" id="notifBtn" title="Notifications">
          🔔${logged ? '<span class="badge">0</span>' : ''}
        </button>

        ${logged ? `
          <a href="/chat.html" class="icon-btn" title="Messages">💬</a>
          <a href="/recruitment-jobs.html" class="btn btn-outline btn-sm">Job Recruitment</a>
          <a href="/dashboard.html" class="btn btn-outline btn-sm">Dashboard</a>
          ${user && user.role === 'admin' ? '<a href="/admin.html" class="btn btn-gold btn-sm">Admin</a>' : ''}
          <button class="btn btn-primary btn-sm" id="logoutBtn">Sign out</button>
        ` : `
          <a href="/signin.html" class="btn btn-ghost btn-sm">Sign in</a>
          <a href="/signup.html" class="btn btn-gold btn-sm">Sign up</a>
        `}

        <button class="icon-btn hamburger" id="hamburger">☰</button>
      </div>
    </div>
  `;

  Theme.updateToggle();

  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', Theme.toggle);
  }

  const searchInput = document.getElementById('navSearchInput');
  if (searchInput) {
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        window.location.href = `/search.html?q=${encodeURIComponent(searchInput.value)}`;
      }
    });
  }

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      Auth.logout();
      Toast.show('Signed out');
    });
  }

  const hamburger = document.getElementById('hamburger');
  if (hamburger) {
    hamburger.addEventListener('click', () => {
      document.body.classList.toggle('nav-open');
    });
  }

  if (logged) {
    loadNotifications();
  }
}

async function loadNotifications() {
  try {
    const notifications = await API.get('/marketplace/notifications');
    const unread = notifications.filter(n => !n.read).length;

    const notifBtn = document.getElementById('notifBtn');

    if (!notifBtn) return;

    notifBtn.innerHTML = `🔔${unread ? `<span class="badge">${unread}</span>` : ''}`;

    notifBtn.addEventListener('click', () => {
      const existing = document.getElementById('notifPanel');

      if (existing) {
        existing.remove();
        return;
      }

      const panel = document.createElement('div');

      panel.id = 'notifPanel';
      panel.style.cssText = `
        position:fixed;
        top:72px;
        right:20px;
        width:min(360px, calc(100vw - 40px));
        max-height:420px;
        overflow:auto;
        background:var(--bg-elev);
        border:1px solid var(--border);
        border-radius:12px;
        box-shadow:var(--shadow);
        z-index:9999;
        padding:12px;
      `;

      panel.innerHTML = notifications.length
        ? notifications.map(n => `
          <a href="${n.link || '#'}" style="display:block;padding:10px;border-bottom:1px solid var(--border)">
            <strong>${n.title || 'Notification'}</strong>
            <div style="color:var(--text-soft);font-size:0.88rem">${n.body || ''}</div>
            <div style="color:var(--text-muted);font-size:0.78rem">
              ${n.created_at ? timeAgo(n.created_at) : ''}
            </div>
          </a>
        `).join('')
        : '<p style="color:var(--text-muted);padding:12px">No notifications yet.</p>';

      document.body.appendChild(panel);
    });
  } catch (err) {
    console.warn('Notification load failed:', err.message);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.mobile-nav-link').forEach(link => {
    link.addEventListener('click', () => {
      document.body.classList.remove('mobile-nav-open');
    });
  });
});

function renderFooter() {
  const f = document.getElementById('footer');
  if (!f) return;
  f.innerHTML = `
    <div class="container">
      <div class="footer-grid">
        <div>
          <div class="logo" style="color:#fff;margin-bottom:12px">Skill<span style="color:var(--gold)">Bridge</span></div>
          <p style="color:#b8b4ac;font-size:0.9rem;max-width:320px">Africa's premium marketplace for talent, products, and jobs. Built for trust, designed for growth.</p>
          <div class="social-row" style="margin-top:16px">
            <a href="#" title="Twitter">𝕏</a><a href="#" title="Instagram">📷</a><a href="#" title="LinkedIn">in</a><a href="#" title="Facebook">f</a>
          </div>
        </div>
        <div><h4>Ecosystems</h4><a href="/hire.html">Hire Talent</a><a href="/shop.html">Shop Products</a><a href="/jobs.html">Find Jobs</a></div>
        <div><h4>Company</h4><a href="/about.html">About</a><a href="/about.html#mission">Mission</a><a href="/signup.html">Sign up</a><a href="/signin.html">Sign in</a></div>
        <div><h4>Support</h4><a href="#">Help Center</a><a href="#">Contact</a><a href="#">Terms</a><a href="#">Privacy</a></div>
      </div>
      <div class="footer-bottom">
        <span>© ${new Date().getFullYear()} SkillBridge. All rights reserved.</span>
        <span>Made with care in Nigeria 🇳🇬</span>
      </div>
    </div>`;
}

document.addEventListener('DOMContentLoaded', () => { Theme.init(); renderNav(); renderFooter(); });
