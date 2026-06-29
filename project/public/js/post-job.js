document.addEventListener('DOMContentLoaded', async () => {
  let uploadedReferenceImages = [];

const referenceDropZone = document.getElementById('referenceDropZone');
const referenceFileInput = document.getElementById('referenceFileInput');
const referencePreview = document.getElementById('referencePreview');
const addMoreReferencesBtn = document.getElementById('addMoreReferencesBtn');
const referencePlaceholder = document.getElementById('referencePlaceholder');

function renderReferencePreview() {
  if (!referencePreview) return;

  referencePreview.innerHTML = '';

  uploadedReferenceImages.forEach((url, index) => {
    const item = document.createElement('div');
    item.className = 'reference-preview-item';
    item.style.position = 'relative';
    item.style.width = '92px';
    item.style.height = '92px';
    item.style.borderRadius = '10px';
    item.style.overflow = 'hidden';
    item.style.border = '1px solid var(--border)';
    item.style.background = 'var(--bg-soft)';

    const img = document.createElement('img');
    img.src = url;
    img.alt = 'Reference image';
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'cover';

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.innerHTML = '×';
    removeBtn.title = 'Remove image';
    removeBtn.style.position = 'absolute';
    removeBtn.style.top = '4px';
    removeBtn.style.right = '4px';
    removeBtn.style.width = '24px';
    removeBtn.style.height = '24px';
    removeBtn.style.borderRadius = '50%';
    removeBtn.style.background = 'rgba(0,0,0,0.65)';
    removeBtn.style.color = '#fff';
    removeBtn.style.fontSize = '18px';
    removeBtn.style.lineHeight = '1';
    removeBtn.style.display = 'flex';
    removeBtn.style.alignItems = 'center';
    removeBtn.style.justifyContent = 'center';

    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      uploadedReferenceImages.splice(index, 1);
      renderReferencePreview();
    });

    item.appendChild(img);
    item.appendChild(removeBtn);
    referencePreview.appendChild(item);
  });

  if (uploadedReferenceImages.length > 0) {
    addMoreReferencesBtn.style.display = 'inline-flex';
    referencePlaceholder.innerHTML = `
      <p style="color:var(--success);font-size:0.9rem">
        ${uploadedReferenceImages.length} image${uploadedReferenceImages.length > 1 ? 's' : ''} uploaded.
      </p>
      <p style="color:var(--text-muted);font-size:0.8rem">
        Click here or use “Add more images” to upload more.
      </p>
    `;
  } else {
    addMoreReferencesBtn.style.display = 'none';
    referencePlaceholder.innerHTML = `
      <div style="font-size:1.8rem;margin-bottom:6px">🖼️</div>
      <p style="color:var(--text-soft);font-size:0.9rem">Click to upload reference images</p>
      <p style="color:var(--text-muted);font-size:0.8rem">You can upload multiple images, delete any one, and add more</p>
    `;
  }
}

async function uploadReferenceFiles(files) {
  const list = Array.from(files || []);

  if (!list.length) return;

  for (const file of list) {
    if (!file.type.startsWith('image/')) {
      Toast.show(file.name + ' is not an image');
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
      renderReferencePreview();
    } catch (err) {
      Toast.show('Upload failed: ' + err.message);
    }
  }

  if (referenceFileInput) {
    referenceFileInput.value = '';
  }
}

if (referenceDropZone && referenceFileInput) {
  referenceDropZone.addEventListener('click', () => {
    referenceFileInput.click();
  });

  referenceDropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    referenceDropZone.style.borderColor = 'var(--gold)';
  });

  referenceDropZone.addEventListener('dragleave', () => {
    referenceDropZone.style.borderColor = 'var(--border)';
  });

  referenceDropZone.addEventListener('drop', async (e) => {
    e.preventDefault();
    referenceDropZone.style.borderColor = 'var(--border)';
    await uploadReferenceFiles(e.dataTransfer.files);
  });

  referenceFileInput.addEventListener('change', async (e) => {
    await uploadReferenceFiles(e.target.files);
  });
}

if (addMoreReferencesBtn && referenceFileInput) {
  addMoreReferencesBtn.addEventListener('click', () => {
    referenceFileInput.click();
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
