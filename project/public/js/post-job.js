document.addEventListener('DOMContentLoaded', async () => {
  if (!Auth.isLoggedIn()) {
    Toast.show('Please sign in');
    setTimeout(() => location.href = '/signin.html', 1000);
    return;
  }

  const user = Auth.user();

  if (!['client', 'admin'].includes(user?.role)) {
    Toast.show('Only clients can post jobs');
    setTimeout(() => location.href = '/dashboard.html', 1000);
    return;
  }

  const catSel = document.getElementById('catSel');
  const cats = await API.get('/marketplace/categories?ecosystem=hire').catch(() => []);

  catSel.innerHTML =
    '<option value="">Select work category</option>' +
    cats.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

  let uploadedReferenceImages = [];

  const referenceImagesInput = document.getElementById('referenceImagesInput');
  const referenceDropZone = document.getElementById('referenceDropZone');
  const referenceFileInput = document.getElementById('referenceFileInput');
  const referencePreview = document.getElementById('referencePreview');
  const addMoreReferencesBtn = document.getElementById('addMoreReferencesBtn');

  function renderReferencePreview() {
    if (!uploadedReferenceImages.length) {
      referencePreview.innerHTML = '';
      addMoreReferencesBtn.style.display = 'none';
      return;
    }

    addMoreReferencesBtn.style.display = 'inline-flex';

    referencePreview.innerHTML = uploadedReferenceImages.map((url, index) => `
      <div style="width:120px;position:relative;border:1px solid var(--border);border-radius:8px;overflow:hidden">
        <img
          src="${url}"
          alt="Reference image ${index + 1}"
          style="width:120px;height:90px;object-fit:cover;display:block"
        >
        <button
          type="button"
          data-remove-reference="${index}"
          style="position:absolute;top:4px;right:4px;background:#111;color:#fff;border:0;border-radius:999px;width:24px;height:24px;cursor:pointer"
        >
          ×
        </button>
      </div>
    `).join('');

    referencePreview.querySelectorAll('[data-remove-reference]').forEach(btn => {
      btn.addEventListener('click', () => {
        uploadedReferenceImages.splice(Number(btn.dataset.removeReference), 1);
        renderReferencePreview();
      });
    });
  }

  async function uploadReferenceFiles(files) {
    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        Toast.show('Only image files are allowed');
        continue;
      }

      if (file.size > 5 * 1024 * 1024) {
        Toast.show('Each image must be under 5MB');
        continue;
      }

      const url = await uploadImage(file, 'job-references');
      uploadedReferenceImages.push(url);
    }

    renderReferencePreview();
  }

  referenceDropZone.addEventListener('click', () => {
    referenceFileInput.click();
  });

  addMoreReferencesBtn.addEventListener('click', () => {
    referenceFileInput.click();
  });

  referenceFileInput.addEventListener('change', async (e) => {
    try {
      const files = Array.from(e.target.files || []);
      await uploadReferenceFiles(files);
      e.target.value = '';
    } catch (err) {
      Toast.show('Image upload failed: ' + err.message);
    }
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

    try {
      const files = Array.from(e.dataTransfer.files || []);
      await uploadReferenceFiles(files);
    } catch (err) {
      Toast.show('Image upload failed: ' + err.message);
    }
  });

  document.getElementById('postJobForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const data = Object.fromEntries(new FormData(e.target));

    const pastedUrls = referenceImagesInput.value
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    data.reference_images = [...pastedUrls, ...uploadedReferenceImages];

    if (!data.reference_images.length) {
      delete data.reference_images;
    }

    try {
      await API.post('/jobs', data);
      Toast.show('Job submitted! Awaiting admin approval.');
      setTimeout(() => location.href = '/dashboard.html', 1200);
    } catch (err) {
      Toast.show(err.message);
    }
  });
});
