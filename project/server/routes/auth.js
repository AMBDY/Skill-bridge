const router = require('express').Router();
const { supabase } = require('../utils/db');
const { authMiddleware } = require('../middleware/auth');

// Sign up is now handled client-side (frontend calls supabase.auth.signUp directly).
// This endpoint is kept for backwards compatibility but delegates to the same flow.
router.post('/signup', async (req, res) => {
  res.status(400).json({ error: 'Signup is handled client-side. Use the signup page.' });
});

// Sign in is also handled client-side.
router.post('/signin', async (req, res) => {
  res.status(400).json({ error: 'Signin is handled client-side. Use the signin page.' });
});

// Get current user profile — validates the Supabase JWT and looks up the profile
router.get('/me', authMiddleware, async (req, res) => {
  const { data: profile } = await supabase.from('profiles').select('*').eq('user_id', req.user.id).maybeSingle();
  if (!profile) return res.status(404).json({ error: 'Profile not found' });
  res.json({ user: profile });
});

// KYC submission
router.post('/kyc', authMiddleware, async (req, res) => {
  const { selfie_url, full_name } = req.body;
  const { data, error } = await supabase.from('kyc_submissions').insert({
    user_id: req.user.id, selfie_url, full_name
  }).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// Refresh token (client-side Supabase handles this, but keep for API clients)
router.post('/refresh', (req, res) => {
  res.status(400).json({ error: 'Token refresh is handled client-side by Supabase auth.' });
});

module.exports = router;
