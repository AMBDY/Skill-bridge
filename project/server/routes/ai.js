const router = require('express').Router();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

async function callOpenAI(messages, fallback) {
  if (!OPENAI_API_KEY) return fallback;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages,
      temperature: 0.2
    })
  });

  if (!response.ok) return fallback;

  const data = await response.json();
  return data.choices?.[0]?.message?.content || fallback;
}

function deterministicRiskScore(payload) {
  let score = 0;
  const amount = Number(payload.amount || payload.data?.amount || 0);

  if (amount >= 1000000) score += 35;
  else if (amount >= 500000) score += 20;
  else if (amount >= 100000) score += 10;

  const reason = String(payload.reason || payload.data?.reason || '').toLowerCase();
  if (reason.includes('scam')) score += 20;
  if (reason.includes('fake')) score += 15;
  if (reason.includes('urgent')) score += 10;

  if (payload.user_kyc_level !== undefined && Number(payload.user_kyc_level) < 2) score += 20;

  const risk = score >= 60 ? 'high' : score >= 30 ? 'medium' : 'low';
  return { risk, score, flags: [] };
}

router.post('/search/rank', (req, res) => {
  const { candidates, location } = req.body;
  const tierWeight = { elite: 4, featured: 3, pro: 2, free: 1 };

  const ranked = (candidates || []).map(c => {
    const tierScore = tierWeight[c.subscription_tier] || 1;
    const ratingScore = (c.rating || 0) / 5;
    const completionScore = (c.completion_rate || 100) / 100;
    const reviewScore = Math.min((c.review_count || 0) / 50, 1);
    const responseScore = 1 - Math.min((c.response_time_hours || 24) / 48, 1);
    const locationScore = location && c.state && c.state.toLowerCase() === location.toLowerCase() ? 1 : 0.5;
    const score = (tierScore * 0.3) + (ratingScore * 0.25) + (completionScore * 0.15) + (reviewScore * 0.1) + (responseScore * 0.1) + (locationScore * 0.1);
    return { ...c, ai_score: +score.toFixed(3) };
  }).sort((a, b) => b.ai_score - a.ai_score);

  res.json({ ranked });
});

router.post('/fraud-check', async (req, res) => {
  const fallback = deterministicRiskScore(req.body);

  const aiText = await callOpenAI([
    {
      role: 'system',
      content: 'You are a strict fraud risk analyst for an escrow marketplace. Return compact JSON only with risk, score, and flags.'
    },
    {
      role: 'user',
      content: JSON.stringify(req.body)
    }
  ], JSON.stringify(fallback));

  try {
    res.json(JSON.parse(aiText));
  } catch {
    res.json(fallback);
  }
});

router.post('/profile-suggestions', async (req, res) => {
  const { profile } = req.body;

  const fallback = {
    suggestions: [
      !profile?.headline ? 'Add a clear professional headline.' : null,
      !profile?.about ? 'Add an about section that explains your experience.' : null,
      !profile?.skills?.length ? 'Add at least 5 skills.' : null,
      !profile?.profile_image ? 'Upload a profile picture.' : null
    ].filter(Boolean)
  };

  const aiText = await callOpenAI([
    { role: 'system', content: 'Return compact JSON only: {"suggestions":["..."]}' },
    { role: 'user', content: JSON.stringify(profile || {}) }
  ], JSON.stringify(fallback));

  try {
    res.json(JSON.parse(aiText));
  } catch {
    res.json(fallback);
  }
});

router.post('/price-suggest', async (req, res) => {
  const { category, description } = req.body;
  const fallbackAmount = category === 'jobs' ? 50000 : category === 'shop' ? 15000 : 25000;

  const fallback = {
    suggestedPrice: fallbackAmount,
    range: {
      min: fallbackAmount * 0.7,
      max: fallbackAmount * 1.3
    }
  };

  const aiText = await callOpenAI([
    { role: 'system', content: 'Return compact JSON only with suggestedPrice and range {min,max}. Currency is NGN.' },
    { role: 'user', content: JSON.stringify({ category, description }) }
  ], JSON.stringify(fallback));

  try {
    res.json(JSON.parse(aiText));
  } catch {
    res.json(fallback);
  }
});

router.post('/improve-message', async (req, res) => {
  const { text } = req.body;

  const improved = await callOpenAI([
    { role: 'system', content: 'Improve this marketplace message. Keep it concise and professional.' },
    { role: 'user', content: text || '' }
  ], text || '');

  res.json({ improved });
});

module.exports = router;
