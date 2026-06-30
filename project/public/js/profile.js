document.addEventListener('DOMContentLoaded', async () => {
  const viewer = Auth.user();
  const id = new URLSearchParams(location.search).get('id') || viewer?.user_id;
  const main = document.getElementById('profileMain');

  if (!id) {
    main.innerHTML = '<p class="container" style="padding:32px">No profile specified.</p>';
    return;
  }

  main.innerHTML = '<div class="container" style="padding:32px"><div class="skeleton" style="height:300px"></div></div>';

  const [profile, reviews] = await Promise.all([
    API.get(`/marketplace/profile/${id}`).catch(() => null),
    API.get(`/marketplace/reviews/${id}`).catch(() => [])
  ]);

  if (!profile) {
    main.innerHTML = '<p class="container" style="padding:32px">Profile not found.</p>';
    return;
  }

  const isOwnProfile = viewer && viewer.user_id === profile.user_id;
  const tierBadge = { elite: 'badge-elite', featured: 'badge-gold', pro: 'badge-gold', free: 'badge-kyc' }[profile.subscription_tier || 'free'];
  const kycLabels = ['Unverified', 'Phone verified', 'ID verified', 'KYC verified', 'Elite verified'];

  main.innerHTML = `
    <div style="background:var(--navy);height:200px;position:relative">
      ${profile.cover_image ? `<img src="${safeAttr(profile.cover_image)}" style="width:100%;height:100%;object-fit:cover;opacity:0.6">` : ''}
    </div>

    <div class="container" style="margin-top:-60px;position:relative;z-index:2;padding-bottom:64px">
      <div style="display:flex;gap:20px;align-items:flex-end;flex-wrap:wrap">
        <img
          src="${safeAttr(profile.profile_image || 'https://images.pexels.com/photos/3777943/pexels-photo-3777943.jpeg')}"
          style="width:120px;height:120px;border-radius:50%;border:4px solid var(--bg-elev);object-fit:cover"
          alt="${safeAttr(profile.display_name || 'Profile image')}"
        >

        <div style="flex:1">
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
            <h1 style="color:var(--text);font-size:2rem">${safeText(profile.display_name || 'User')}</h1>
            <span class="badge ${tierBadge}">${safeText(profile.subscription_tier || 'free')}</span>
            <span class="badge badge-kyc">L${profile.kyc_level || 0} ${safeText(kycLabels[profile.kyc_level || 0] || 'Unverified')}</span>
          </div>

          <div class="card-meta">
            <span class="stars">${stars(profile.rating)}</span>
            <span>${profile.review_count || 0} reviews</span>
            <span>|</span>
            <span>${safeText(profile.role || '')}</span>
          </div>

          ${profile.headline ? `<p style="color:var(--text-soft);margin-top:8px">${safeText(profile.headline)}</p>` : ''}
        </div>

        ${isOwnProfile ? `
          <button class="btn btn-gold" onclick="openEditProfile()">Edit Profile</button>
        ` : `
          <a href="/chat.html?to=${profile.user_id}" class="btn btn-gold">Message</a>
        `}
      </div>

      <div class="grid grid-4" style="margin:24px 0">
        <div class="stat-card"><div class="stat-num">${profile.rating || 0}</div><div class="stat-label">Rating</div></div>
        <div class="stat-card"><div class="stat-num">${profile.completion_rate || 100}%</div><div class="stat-label">Completion</div></div>
        <div class="stat-card"><div class="stat-num">${profile.response_time_hours || 24}h</div><div class="stat-label">Response time</div></div>
        <div class="stat-card"><div class="stat-num">${profile.availability ? 'Available' : 'Busy'}</div><div class="stat-label">Status</div></div>
      </div>

      <div class="grid grid-2" style="gap:32px">
        <div>
          <h2 style="font-size:1.5rem;margin-bottom:12px">About</h2>
          <p style="color:var(--text-soft)">${safeText(profile.about || 'No about section yet.')}</p>

          ${profile.cover_letter ? `
            <h3 style="margin-top:20px;font-size:1.2rem">Cover Letter</h3>
            <p style="color:var(--text-soft)">${safeText(profile.cover_letter)}</p>
          ` : ''}

          ${profile.skills && profile.skills.length ? `
            <h3 style="margin-top:20px;font-size:1.2rem">Skills</h3>
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
              ${profile.skills.map(skill => `<span class="badge badge-kyc">${safeText(skill)}</span>`).join('')}
            </div>
          ` : ''}

          ${profile.role === 'seller' ? sellerStoreSection(profile) : ''}

          <div style="margin-top:20px;font-size:0.9rem;color:var(--text-muted)">
            ${profile.city || profile.state || profile.country ? `
              <div>${safeText([profile.city, profile.state, profile.country].filter(Boolean).join(', '))}</div>
            ` : ''}
            <div>Member since ${profile.created_at ? new Date(profile.created_at).getFullYear() : 'recently'}</div>
          </div>
        </div>

        <div>
          <h2 style="font-size:1.5rem;margin-bottom:12px">Reviews (${reviews.length})</h2>
          <div style="max-height:500px;overflow-y:auto">
            ${reviews.length ? reviews.map(r => `
              <div class="card" style="margin-bottom:10px">
                <div class="card-body">
                  <div style="display:flex;justify-content:space-between;gap:12px">
                    <strong>${safeText(r.reviewer?.display_name || 'Anonymous')}</strong>
                    <span class="stars">${stars(r.stars)}</span>
                  </div>
                  <p style="color:var(--text-soft);margin-top:6px;font-size:0.9rem">${safeText(r.comment || '')}</p>
                  <div style="font-size:0.78rem;color:var(--text-muted);margin-top:6px">
                    ${timeAgo(r.created_at)}${r.hire_again ? ' | Would hire again' : ''}
                  </div>
                </div>
              </div>
            `).join('') : '<p style="color:var(--text-muted)">No reviews yet.</p>'}
          </div>
        </div>
      </div>

      ${isOwnProfile ? editProfileBox(profile) : ''}
    </div>
  `;

  bindEditProfile(profile);
});

function sellerStoreSection(profile) {
  return `
    <h3 style="margin-top:20px;font-size:1.2rem">Seller Store</h3>
    <div class="card" style="margin-top:10px">
      <div class="card-body">
        ${profile.seller_store_banner ? `
          <img src="${safeAttr(profile.seller_store_banner)}" style="width:100%;height:140px;object-fit:cover;border-radius:8px;margin-bottom:12px">
        ` : ''}
        <strong>${safeText(profile.seller_store_name || 'Store name not added')}</strong>
        <p style="color:var(--text-soft);margin-top:6px">${safeText(profile.seller_store_description || 'No store description yet.')}</p>
      </div>
    </div>
  `;
}

function editProfileBox(profile) {
  return `
    <div id="editProfileBox" class="card" style="display:none;margin-top:28px">
      <div class="card-body">
        <h2 style="font-size:1.4rem;margin-bottom:14px">Edit Profile</h2>

        <form id="editProfileForm">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Profile Picture</label>
              <input class="form-input" id="profileImageUrl" name="profile_image" value="${safeAttr(profile.profile_image || '')}" placeholder="Image URL">
              <input type="file" id="profileImageFile" accept="image/*" style="margin-top:8px">
            </div>

            <div class="form-group">
              <label class="form-label">Cover Image</label>
              <input class="form-input" id="coverImageUrl" name="cover_image" value="${safeAttr(profile.cover_image || '')}" placeholder="Cover image URL">
              <input type="file" id="coverImageFile" accept="image/*" style="margin-top:8px">
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Display Name</label>
            <input class="form-input" name="display_name" value="${safeAttr(profile.display_name || '')}" required>
          </div>

          <div class="form-group">
            <label class="form-label">Headline</label>
            <input class="form-input" name="headline" value="${safeAttr(profile.headline || '')}" placeholder="Example: Expert tailor and fashion designer">
          </div>

          <div class="form-group">
            <label class="form-label">About</label>
            <textarea class="form-textarea" name="about">${safeText(profile.about || '')}</textarea>
          </div>

          <div class="form-group">
            <label class="form-label">Skills</label>
            <input class="form-input" name="skills" value="${safeAttr((profile.skills || []).join(', '))}" placeholder="Tailoring, Web design, Plumbing">
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Hourly Rate</label>
              <input class="form-input" type="number" name="hourly_rate" value="${safeAttr(profile.hourly_rate || '')}">
            </div>

            <div class="form-group">
              <label class="form-label">Service Area</label>
              <input class="form-input" name="service_area" value="${safeAttr(profile.service_area || '')}" placeholder="Lagos, Abuja, Remote">
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">State</label>
              <input class="form-input" name="state" value="${safeAttr(profile.state || '')}">
            </div>

            <div class="form-group">
              <label class="form-label">City</label>
              <input class="form-input" name="city" value="${safeAttr(profile.city || '')}">
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Address</label>
            <input class="form-input" name="address" value="${safeAttr(profile.address || '')}">
          </div>

          ${profile.role === 'seller' ? `
            <h3 style="font-size:1.2rem;margin:22px 0 12px">Seller Store Details</h3>

            <div class="form-group">
              <label class="form-label">Store Name</label>
              <input class="form-input" name="seller_store_name" value="${safeAttr(profile.seller_store_name || '')}">
            </div>

            <div class="form-group">
              <label class="form-label">Store Description</label>
              <textarea class="form-textarea" name="seller_store_description">${safeText(profile.seller_store_description || '')}</textarea>
            </div>

            <div class="form-group">
              <label class="form-label">Store Banner</label>
              <input class="form-input" id="sellerBannerUrl" name="seller_store_banner" value="${safeAttr(profile.seller_store_banner || '')}" placeholder="Banner image URL">
              <input type="file" id="sellerBannerFile" accept="image/*" style="margin-top:8px">
            </div>
          ` : ''}

          <h3 style="font-size:1.2rem;margin:22px 0 12px">Social Links</h3>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Facebook</label>
              <input class="form-input" name="social_facebook" value="${safeAttr(profile.socials?.facebook || '')}">
            </div>

            <div class="form-group">
              <label class="form-label">Instagram</label>
              <input class="form-input" name="social_instagram" value="${safeAttr(profile.socials?.instagram || '')}">
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">LinkedIn</label>
              <input class="form-input" name="social_linkedin" value="${safeAttr(profile.socials?.linkedin || '')}">
            </div>

            <div class="form-group">
              <label class="form-label">Website</label>
              <input class="form-input" name="social_website" value="${safeAttr(profile.socials?.website || '')}">
            </div>
          </div>

          <button class="btn btn-gold btn-block" type="submit" id="saveProfileBtn">Save Profile</button>
        </form>
      </div>
    </div>
  `;
}

function bindEditProfile(profile) {
  const form = document.getElementById('editProfileForm');
  if (!form) return;

  bindImageUpload('profileImageFile', 'profileImageUrl', 'profile-images');
  bindImageUpload('coverImageFile', 'coverImageUrl', 'cover-images');
  bindImageUpload('sellerBannerFile', 'sellerBannerUrl', 'seller-banners');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const btn = document.getElementById('saveProfileBtn');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Saving...';
    }

    const raw = Object.fromEntries(new FormData(form));

    const data = {
      display_name: raw.display_name,
      headline: raw.headline || null,
      about: raw.about || null,
      profile_image: raw.profile_image || null,
      cover_image: raw.cover_image || null,
      skills: raw.skills ? raw.skills.split(',').map(s => s.trim()).filter(Boolean) : [],
      hourly_rate: raw.hourly_rate ? Number(raw.hourly_rate) : null,
      service_area: raw.service_area || null,
      state: raw.state || null,
      city: raw.city || null,
      address: raw.address || null,
      socials: {
        facebook: raw.social_facebook || '',
        instagram: raw.social_instagram || '',
        linkedin: raw.social_linkedin || '',
        website: raw.social_website || ''
      }
    };

    if (profile.role === 'seller') {
      data.seller_store_name = raw.seller_store_name || null;
      data.seller_store_description = raw.seller_store_description || null;
      data.seller_store_banner = raw.seller_store_banner || null;
    }

    try {
      const updated = await API.put('/marketplace/profile', data);

      const localUser = Auth.user();
      if (localUser && localUser.user_id === updated.user_id) {
        localStorage.setItem('sb_user', JSON.stringify({ ...localUser, ...updated }));
      }

      Toast.show('Profile updated');
      setTimeout(() => location.reload(), 800);
    } catch (err) {
      Toast.show(err.message);
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Save Profile';
      }
    }
  });
}

function bindImageUpload(fileInputId, urlInputId, folder) {
  const fileInput = document.getElementById(fileInputId);
  const urlInput = document.getElementById(urlInputId);

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
      Toast.show('Image uploaded');
    } catch (err) {
      Toast.show('Upload failed: ' + err.message);
    } finally {
      fileInput.value = '';
    }
  });
}

window.openEditProfile = function () {
  const box = document.getElementById('editProfileBox');
  if (!box) return;
  box.style.display = box.style.display === 'none' ? 'block' : 'none';
};

function safeText(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function safeAttr(value) {
  return safeText(value);
}
