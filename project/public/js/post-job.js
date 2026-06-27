document.addEventListener('DOMContentLoaded', async () => {
  if (!Auth.isLoggedIn()) { Toast.show('Please sign in'); setTimeout(() => location.href = '/signin.html', 1000); return; }
  const cats = await API.get('/marketplace/categories').catch(() => []);
  document.getElementById('catSel').innerHTML = '<option value="">Select category</option>' + cats.map(c => `<option value="${c.id}">${c.name} (${c.ecosystem})</option>`).join('');

  document.getElementById('postJobForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    if (data.reference_images) data.reference_images = data.reference_images.split(',').map(s => s.trim()).filter(Boolean);
    else delete data.reference_images;
    try {
      await API.post('/jobs', data);
      Toast.show('Job submitted! Awaiting admin approval.');
      setTimeout(() => location.href = '/dashboard.html', 1200);
    } catch (err) { Toast.show(err.message); }
  });
});
