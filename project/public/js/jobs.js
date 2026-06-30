const JobsPage = (function () {
  const CAT_ICONS = {
    'graphics-design': '🎨',
    'web-design': '💻',
    'tailoring': '🧵',
    'shoe-construction': '👟',
    'bag-construction': '👜',
    'plumbing': '🔧',
    'furniture-construction': '🪑',
    'event-planning': '🎉',
    'interior-decoration': '🏠',
    'painting': '🖌',
    'catering': '🍳'
  };

  async function init() {
    const user = Auth.user();
    const actions = document.getElementById('jobPageActions');

    if (actions) {
      if (user && ['client', 'admin'].includes(user.role)) {
        actions.innerHTML = `
          <a href="/post-job.html" class="btn btn-gold">+ Post a Job</a>
          <a href="/dashboard.html#clientJobs" class="btn btn-outline">My Jobs</a>
        `;
      } else if (user && ['worker', 'freelancer'].includes(user.role)) {
        actions.innerHTML = `
          <a href="/dashboard.html#applicationsSection" class="btn btn-outline">Jobs Applied</a>
          <a href="/dashboard.html#availableJobsSection" class="btn btn-gold">Available Jobs</a>
        `;
      } else {
        actions.innerHTML = `
          <a href="/signin.html" class="btn btn-gold">Sign in to apply</a>
        `;
      }
    }

    const cats = await API.get('/marketplace/categories?ecosystem=hire').catch(() => []);
    document.getElementById('catGrid').innerHTML = cats.map(c => `
      <a href="/category.html?ecosystem=jobs&slug=${c.slug}" class="cat-tile">
        <span class="cat-icon">${CAT_ICONS[c.slug] || '💼'}</span>
        <span class="cat-name">${c.name}</span>
      </a>
    `).join('');

    const list = document.getElementById('jobList');
    list.innerHTML = '<div class="skeleton" style="height:120px;margin-bottom:12px"></div><div class="skeleton" style="height:120px"></div>';

    const jobs = await API.get('/jobs').catch(() => []);

    if (!jobs.length) {
      list.innerHTML = `
        <div style="text-align:center;padding:48px;color:var(--text-muted)">
          No jobs posted yet.
        </div>
      `;
      return;
    }

    list.innerHTML = jobs.map(j => {
      const canApply = user && ['worker', 'freelancer'].includes(user.role);
      const isClient = user && ['client', 'admin'].includes(user.role);

      return `
        <div class="card" style="margin-bottom:12px">
          <div class="card-body" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px">
            <div>
              <div class="card-title" style="font-size:1.2rem">
                <a href="/job.html?id=${j.id}">${j.title}</a>
              </div>

              <div class="card-meta">
                <span>${j.categories?.name || 'General'}</span>
                <span>|</span>
                <span>${j.job_type || 'remote'}</span>
                <span>|</span>
                <span>${j.location || j.state || 'Nigeria'}</span>
                <span>|</span>
                <span>${j.duration || 'Flexible'}</span>
                ${j.profiles?.kyc_level >= 3 ? '<span class="badge badge-verified">Verified client</span>' : ''}
              </div>
            </div>

            <div style="text-align:right">
              <div class="card-price">${fmtPrice(j.budget || j.price_max || 0)}</div>
              <a href="/job.html?id=${j.id}" class="btn btn-gold btn-sm" style="margin-top:8px">
                ${canApply ? 'View & Apply' : isClient ? 'View Job' : 'Sign in to Apply'}
              </a>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  return { init };
})();
