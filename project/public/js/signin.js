document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('signinForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const form = e.target;
    const data = Object.fromEntries(new FormData(form));
    const btn = document.getElementById('signinBtn');

    btn.disabled = true;
    btn.textContent = 'Signing in...';

    try {
      await Auth.signin(data.email, data.password);
      Toast.show('Signed in!');
      setTimeout(() => window.location.href = '/dashboard.html', 600);
    } catch (err) {
      Toast.show(err.message);
      btn.disabled = false;
      btn.textContent = 'Sign In';
    }
  });

  const forgot = document.getElementById('forgotPasswordLink');

  if (forgot) {
    forgot.addEventListener('click', async (e) => {
      e.preventDefault();

      const email = document.querySelector('input[name="email"]').value.trim();

      if (!email) {
        Toast.show('Enter your email first, then click forgot password.');
        return;
      }

      try {
        await Auth.resetPassword(email);
        Toast.show('Password reset link sent. Check your email.');
      } catch (err) {
        Toast.show(err.message);
      }
    });
  }
});
