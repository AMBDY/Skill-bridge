document.addEventListener('DOMContentLoaded', async () => {
  let uploadedReferenceImages = [];

const referenceDropZone = document.getElementById('referenceDropZone');
const referenceFileInput = document.getElementById('referenceFileInput');
const referencePreview = document.getElementById('referencePreview');

if (referenceDropZone && referenceFileInput) {
  referenceDropZone.addEventListener('click', () => referenceFileInput.click());

  referenceFileInput.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files || []);

    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        Toast.show('Only image files are allowed');
        continue;
      }

      if (file.size > 5 * 1024 * 1024) {
        Toast.show(file.name + ' is larger than 5MB');
        continue;
      }

      try {
        Toast.show('Uploading ' + file.name + '...');
        const url = await uploadImage(file, 'job-references');
        uploadedReferenceImages.push(url);

        const img = document.createElement('img');
        img.src = url;
        img.style.width = '84px';
        img.style.height = '84px';
        img.style.objectFit = 'cover';
        img.style.borderRadius = '8px';
        img.style.border = '1px solid var(--border)';
        referencePreview.appendChild(img);
      } catch (err) {
        Toast.show('Upload failed: ' + err.message);
      }
    }
  });
}
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

      const typedReferenceImages = data.reference_images
        ? data.reference_images.split(',').map(x => x.trim()).filter(Boolean)
        : [];

      data.reference_images = [
        ...typedReferenceImages,
        ...uploadedReferenceImages
      ];

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
