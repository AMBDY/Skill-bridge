// Landing page logic
const HERO_SLIDES = [
  'https://images.pexels.com/photos/3184465/pexels-photo-3184465.jpeg',
  'https://images.pexels.com/photos/4467687/pexels-photo-4467687.jpeg',
  'https://images.pexels.com/photos/3184360/pexels-photo-3184360.jpeg',
  'https://images.pexels.com/photos/3184339/pexels-photo-3184339.jpeg',
  'https://images.pexels.com/photos/5905798/pexels-photo-5905798.jpeg',
];

const WOTD = [
  { word: 'Bridge', def: 'A structure carrying a path over an obstacle — and a verb meaning to connect. At SkillBridge, we bridge talent and opportunity every day.' },
  { word: 'Trust', def: 'Firm belief in the reliability of someone. The foundation of every transaction on our platform.' },
  { word: 'Craft', def: 'Skill in making things by hand. Celebrated in every tailor, cobbler, and artisan on SkillBridge.' },
  { word: 'Trade', def: 'The exchange of goods and services. We make it safe, fast, and borderless.' },
];

const TESTIMONIALS = [
  { name: 'Amara Okafor', role: 'Client, Lagos', text: 'I hired a tailor through SkillBridge and the escrow system made me feel completely safe. The work was delivered on time and exceeded my expectations.', avatar: 'https://images.pexels.com/photos/3763188/pexels-photo-3763188.jpeg' },
  { name: 'Chinedu Eze', role: 'Freelancer, Abuja', text: 'SkillBridge changed my business. I went from local clients to international orders in three months. The AI recommendations help me rank higher.', avatar: 'https://images.pexels.com/photos/3777943/pexels-photo-3777943.jpeg' },
  { name: 'Fatima Bello', role: 'Seller, Kano', text: 'Selling my handmade bags on SkillBridge has been life-changing. The platform handles payments and chat so I can focus on my craft.', avatar: 'https://images.pexels.com/photos/3796217/pexels-photo-3796217.jpeg' },
];

const TOP_SELLERS = [
  { name: 'Grace Designs', cat: 'Graphics Design', rating: 4.9, img: 'https://images.pexels.com/photos/3184405/pexels-photo-3184405.jpeg', tier: 'elite' },
  { name: 'Tunde Tailors', cat: 'Tailoring', rating: 4.8, img: 'https://images.pexels.com/photos/5998392/pexels-photo-5998392.jpeg', tier: 'featured' },
  { name: 'Ngozi Crafts', cat: 'Bag Construction', rating: 5.0, img: 'https://images.pexels.com/photos/5998420/pexels-photo-5998420.jpeg', tier: 'elite' },
  { name: 'Emeka Plumbing', cat: 'Plumbing', rating: 4.7, img: 'https://images.pexels.com/photos/8961065/pexels-photo-8961065.jpeg', tier: 'pro' },
];

const RECENT_JOBS = [
  { title: 'Custom Wedding Gown', price: 85000, cat: 'Tailoring', img: 'https://images.pexels.com/photos/5998392/pexels-photo-5998392.jpeg' },
  { title: 'Logo & Brand Identity', price: 45000, cat: 'Graphics Design', img: 'https://images.pexels.com/photos/3184405/pexels-photo-3184405.jpeg' },
  { title: 'Living Room Interior', price: 320000, cat: 'Interior Decoration', img: 'https://images.pexels.com/photos/1571460/pexels-photo-1571460.jpeg' },
];

async function initHero() {
  const hero = document.getElementById('hero');
  const dots = document.getElementById('heroDots');
  if (!hero || !dots) return;

  let slides = [];

  try {
    const cmsSlides = await API.get('/marketplace/cms/slides');
    slides = (cmsSlides || [])
      .filter(s => s.image_url)
      .map(s => ({
        image: s.image_url,
        title: s.title || '',
        subtitle: s.subtitle || '',
        cta_label: s.cta_label || '',
        cta_url: s.cta_url || ''
      }));
  } catch {
    slides = [];
  }

  if (!slides.length) {
    slides = HERO_SLIDES.map(url => ({ image: url }));
  }

  dots.innerHTML = '';
  hero.querySelectorAll('.hero-slide').forEach(el => el.remove());

  slides.forEach((item, i) => {
    const slide = document.createElement('div');
    slide.className = 'hero-slide' + (i === 0 ? ' active' : '');
    slide.style.backgroundImage = `url("${item.image}")`;
    hero.insertBefore(slide, hero.firstChild);

    const dot = document.createElement('div');
    dot.className = 'hero-dot' + (i === 0 ? ' active' : '');
    dot.addEventListener('click', () => goTo(i));
    dots.appendChild(dot);
  });

  let cur = 0;

  function goTo(i) {
    document.querySelectorAll('.hero-slide').forEach((s, idx) => {
      s.classList.toggle('active', idx === i);
    });
    document.querySelectorAll('.hero-dot').forEach((d, idx) => {
      d.classList.toggle('active', idx === i);
    });
    cur = i;
  }

  if (slides.length > 1) {
    setInterval(() => goTo((cur + 1) % slides.length), 5000);
  }
}

function renderFeaturedCats() {
  const el = document.getElementById('featuredCats');
  const cats = [
    { icon: '🎨', name: 'Graphics Design', href: '/category.html?ecosystem=hire&slug=graphics-design' },
    { icon: '🧵', name: 'Tailoring', href: '/category.html?ecosystem=hire&slug=tailoring' },
    { icon: '👟', name: 'Shoes', href: '/category.html?ecosystem=shop&slug=shoes' },
    { icon: '👜', name: 'Bags', href: '/category.html?ecosystem=shop&slug=bags' },
    { icon: '📱', name: 'Gadgets', href: '/category.html?ecosystem=shop&slug=gadgets' },
    { icon: '🪑', name: 'Furniture', href: '/category.html?ecosystem=shop&slug=furniture' },
    { icon: '🔧', name: 'Plumbing', href: '/category.html?ecosystem=hire&slug=plumbing' },
    { icon: '🍳', name: 'Catering', href: '/category.html?ecosystem=hire&slug=catering' },
    { icon: '🚗', name: 'Cars', href: '/category.html?ecosystem=shop&slug=cars' },
    { icon: '💼', name: 'Remote Jobs', href: '/category.html?ecosystem=jobs&slug=remote-jobs' },
  ];
  el.innerHTML = cats.map(c => `<a href="${c.href}" class="cat-tile"><span class="cat-icon">${c.icon}</span><span class="cat-name">${c.name}</span></a>`).join('');
}

function renderTopSellers() {
  document.getElementById('topSellers').innerHTML = TOP_SELLERS.map(s => `
    <div class="card">
      <div class="card-img"><img src="${s.img}" alt="${s.name}"></div>
      <div class="card-body">
        <div style="display:flex;justify-content:space-between;align-items:start">
          <div><div class="card-title">${s.name}</div><div style="color:var(--text-muted);font-size:0.82rem">${s.cat}</div></div>
          <span class="badge badge-elite">${s.tier}</span>
        </div>
        <div class="card-meta"><span class="stars">${stars(s.rating)}</span><span>${s.rating}</span></div>
      </div>
    </div>`).join('');
}

function renderRecentJobs() {
  document.getElementById('recentJobs').innerHTML = RECENT_JOBS.map(j => `
    <div class="card">
      <div class="card-img"><img src="${j.img}" alt="${j.title}"></div>
      <div class="card-body">
        <div class="card-title">${j.title}</div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px">
          <span class="card-price">${fmtPrice(j.price)}</span>
          <span class="badge badge-verified">✓ Completed</span>
        </div>
        <div class="card-meta"><span>${j.cat}</span></div>
      </div>
    </div>`).join('');
}

async function renderTestimonials() {
  await Social.renderTestimonials('testimonials');
  var host = document.getElementById('testimonialFormHost');
  if (host) { host.innerHTML = Social.testimonialForm(); Social.bindTestimonialForm(); }
}

async function renderCmsFeaturedItems() {
  const target = document.getElementById('featuredItems');
  if (!target) return;

  const items = await API.get('/marketplace/cms/featured?placement=home').catch(() => []);

  if (!items.length) {
    target.innerHTML = '';
    return;
  }

  target.innerHTML = items.map(item => `
    <div class="card">
      ${item.image_url ? `
        <div class="card-img">
          <img src="${item.image_url}" alt="${item.title || 'Featured item'}">
        </div>
      ` : ''}

      <div class="card-body">
        <div class="card-title">${item.title || 'Featured Item'}</div>
        <p style="color:var(--text-soft);font-size:0.9rem">${item.subtitle || ''}</p>
        ${item.link_url ? `<a href="${item.link_url}" class="btn btn-outline btn-sm" style="margin-top:10px">Open</a>` : ''}
      </div>
    </div>
  `).join('');
}

function renderWOTD() {
  const w = WOTD[Math.floor(Date.now() / 86400000) % WOTD.length];
  document.getElementById('wotdWord').textContent = w.word;
  document.getElementById('wotdDef').textContent = w.def;
}

document.addEventListener('DOMContentLoaded', async () => {
  await initHero();
  renderFeaturedCats();
  renderTopSellers();
  renderRecentJobs();
  renderTestimonials();
  renderWOTD();
  renderCmsFeaturedItems();
  document.getElementById('submitSuggestion').addEventListener('click', () => {
    const v = document.getElementById('suggestionBox').value.trim();
    if (!v) return Toast.show('Please enter your feedback');
    Toast.show('Thank you! Your feedback has been received.');
    document.getElementById('suggestionBox').value = '';
  });
});
