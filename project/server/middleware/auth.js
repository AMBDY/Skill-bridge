const { supabase } = require('../utils/db');

async function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data?.user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    const userId = data.user.id;

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, email, display_name')
      .eq('user_id', userId)
      .maybeSingle();

    if (profileError) {
      return res.status(401).json({ error: profileError.message });
    }

    req.user = {
      id: userId,
      email: profile?.email || data.user.email || '',
      role: profile?.role || '',
      display_name: profile?.display_name || ''
    };

    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function adminOnly(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  next();
}

module.exports = { authMiddleware, adminOnly };
