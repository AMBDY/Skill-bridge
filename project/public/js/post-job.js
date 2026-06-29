document.addEventListener('DOMContentLoaded', async () => {
  const catSel = document.getElementById('catSel');
  const form = document.getElementById('postJobForm');

  async function loadCategories() {
    if (!catSel) return;

    catSel.innerHTML = '<option value="">Loading categories...</option>';

    try {
      const categories = await API.get('/marketplace/categories?ecosystem=jobs');

      if (!categories || !categories.length) {
        catSel.innerHTML = '<option value="">No job categories found</option>';
        Toast.show('No job categories found. Check Supabase category seed migration.');
        return;
      }

      catSel.innerHTML = '<option value="">Select category</option>' + categories.map(cat => {
        return `<option value="${cat.id}">${cat.name}</option>`;
      }).join('');
    } catch (err) {
      catSel.innerHTML = '<option value="">Failed to load categories</option>';
      Toast.show('Category load failed: ' + err.message);
    }
  }

  await loadCategories();

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (!Auth.isLoggedIn()) {
        Toast.show('Please sign in to post a job');
        setTimeout(() => location.href = '/signin.html', 800);
        return;
      }

      const data = Object.fromEntries(new FormData(form));

      if (!data.category_id) {
        Toast.show('Please select a category');
        return;
      }

      if (data.reference_images) {
        data.reference_images = data.reference_images
          .split(',')
          .map(x => x.trim())
          .filter(Boolean);
      } else {
        data.reference_images = [];
      }

      data.budget = Number(data.budget || 0);
      data.price_min = data.price_min ? Number(data.price_min) : null;
      data.price_max = data.price_max ? Number(data.price_max) : null;

      try {
        await API.post('/jobs', data);
        Toast.show('Job submitted for admin approval');
        setTimeout(() => location.href = '/jobs.html', 900);
      } catch (err) {
        Toast.show(err.message);
      }
    });
  }
});
