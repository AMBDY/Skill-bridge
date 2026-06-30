const router = require('express').Router();
const { supabase, createAuthedClient } = require('../utils/db');
const { authMiddleware } = require('../middleware/auth');

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || '';
const PAYSTACK_CALLBACK_URL = process.env.PAYSTACK_CALLBACK_URL || '';
const PAYSTACK_CURRENCY = process.env.PAYSTACK_CURRENCY || 'NGN';

function authedClient(req) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  return createAuthedClient(token);
}

function amountToKobo(amount) {
  return Math.round(Number(amount || 0) * 100);
}

function cleanAmount(amount) {
  const n = Number(amount || 0);
  if (!Number.isFinite(n) || n <= 0) throw new Error('Invalid amount');
  return n;
}

async function paystack(path, options = {}) {
  if (!PAYSTACK_SECRET_KEY) throw new Error('Paystack secret key is not configured');

  const res = await fetch(`https://api.paystack.co${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.status === false) {
    throw new Error(data.message || 'Paystack request failed');
  }

  return data;
}

async function ensureWallet(userId) {
  const { data: existing } = await supabase
    .from('wallets')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (existing) return existing;

  const { data, error } = await supabase
    .from('wallets')
    .insert({ user_id: userId })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

async function recordWalletTransaction({ user_id, type, amount, direction, status, reference_type, reference_id, metadata }) {
  const wallet = await ensureWallet(user_id);

  const { error } = await supabase.from('wallet_transactions').insert({
    wallet_id: wallet.id,
    user_id,
    type,
    amount,
    direction,
    status: status || 'pending',
    reference_type,
    reference_id,
    metadata: metadata || {}
  });

  if (error) throw new Error(error.message);
}

router.post('/initialize', authMiddleware, async (req, res) => {
  try {
    const c = authedClient(req);
    const {
      amount,
      receiver_id,
      job_id,
      product_id,
      service_id,
      business_type,
      email
    } = req.body;

    const clean = cleanAmount(amount);
    const reference = `SB-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    const { data: settings } = await supabase
      .from('platform_settings')
      .select('service_fee_percent')
      .limit(1)
      .maybeSingle();

    const feePercent = Number(settings?.service_fee_percent || 10);
    const serviceFee = +(clean * feePercent / 100).toFixed(2);

    const init = await paystack('/transaction/initialize', {
      method: 'POST',
      body: JSON.stringify({
        email: email || req.user.email,
        amount: amountToKobo(clean),
        currency: PAYSTACK_CURRENCY,
        reference,
        callback_url: PAYSTACK_CALLBACK_URL || undefined,
        metadata: {
          payer_id: req.user.id,
          receiver_id,
          job_id,
          product_id,
          service_id,
          business_type
        }
      })
    });

    const { data: payment, error } = await c.from('payments').insert({
      client_id: req.user.id,
      receiver_id,
      worker_id: receiver_id || null,
      job_id: job_id || null,
      product_id: product_id || null,
      service_id: service_id || null,
      business_type: business_type || 'job',
      amount: clean,
      service_fee: serviceFee,
      payment_method: 'fiat_naira',
      status: 'pending',
      admin_decision: 'pending',
      paystack_reference: reference,
      paystack_access_code: init.data.access_code,
      paystack_authorization_url: init.data.authorization_url
    }).select().single();

    if (error) return res.status(400).json({ error: error.message });

    res.json({
      payment,
      authorization_url: init.data.authorization_url,
      access_code: init.data.access_code,
      reference
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/verify/:reference', authMiddleware, async (req, res) => {
  try {
    const reference = req.params.reference;

    const { data: payment } = await supabase
      .from('payments')
      .select('*')
      .eq('paystack_reference', reference)
      .maybeSingle();

    if (!payment) return res.status(404).json({ error: 'Payment not found' });
    if (payment.client_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not allowed' });
    }

    const verification = await paystack(`/transaction/verify/${encodeURIComponent(reference)}`);

    if (verification.data.status !== 'success') {
      return res.status(400).json({ error: 'Payment was not successful', verification: verification.data });
    }

    if (payment.escrow_id) {
      return res.json({ payment, verification: verification.data });
    }

    const receiverId = payment.receiver_id || payment.worker_id;
    if (!receiverId) return res.status(400).json({ error: 'Receiver is required for escrow' });

    await ensureWallet(payment.client_id);
    const receiverWallet = await ensureWallet(receiverId);

    const { data: escrow, error: escrowErr } = await supabase.from('escrows').insert({
      payer_id: payment.client_id,
      receiver_id: receiverId,
      payment_id: payment.id,
      job_id: payment.job_id,
      product_id: payment.product_id,
      service_id: payment.service_id,
      amount: payment.amount,
      service_fee: payment.service_fee || 0,
      status: 'funded'
    }).select().single();

    if (escrowErr) return res.status(400).json({ error: escrowErr.message });

    await supabase
      .from('wallets')
      .update({
        escrow_balance: Number(receiverWallet.escrow_balance || 0) + Number(payment.amount || 0),
        updated_at: new Date().toISOString()
      })
      .eq('user_id', receiverId);

    await recordWalletTransaction({
      user_id: receiverId,
      type: 'escrow_funding',
      amount: payment.amount,
      direction: 'credit',
      status: 'approved',
      reference_type: 'escrow',
      reference_id: escrow.id,
      metadata: { paystack_reference: reference }
    });

    const { data: updated, error: updateErr } = await supabase.from('payments').update({
      status: 'in_escrow',
      paystack_verified_at: new Date().toISOString(),
      escrow_id: escrow.id
    }).eq('id', payment.id).select().single();

    if (updateErr) return res.status(400).json({ error: updateErr.message });

    res.json({ payment: updated, escrow, verification: verification.data });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/wallet', authMiddleware, async (req, res) => {
  try {
    const wallet = await ensureWallet(req.user.id);

    const { data: transactions } = await supabase
      .from('wallet_transactions')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(100);

    res.json({ wallet, transactions: transactions || [] });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/escrows', authMiddleware, async (req, res) => {
  const { data, error } = await supabase
    .from('escrows')
    .select('*')
    .or(`payer_id.eq.${req.user.id},receiver_id.eq.${req.user.id}`)
    .order('created_at', { ascending: false });

  if (error) return res.status(400).json({ error: error.message });
  res.json(data || []);
});

router.post('/escrows/:id/deliver', authMiddleware, async (req, res) => {
  const { delivery_proof_url, delivery_note } = req.body;

  const { data: escrow } = await supabase
    .from('escrows')
    .select('*')
    .eq('id', req.params.id)
    .maybeSingle();

  if (!escrow) return res.status(404).json({ error: 'Escrow not found' });
  if (escrow.receiver_id !== req.user.id) return res.status(403).json({ error: 'Only receiver can mark delivered' });

  const { data, error } = await supabase.from('escrows').update({
    status: 'delivered',
    delivery_proof_url,
    delivery_note,
    updated_at: new Date().toISOString()
  }).eq('id', req.params.id).select().single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

router.post('/escrows/:id/accept', authMiddleware, async (req, res) => {
  const { data: escrow } = await supabase
    .from('escrows')
    .select('*')
    .eq('id', req.params.id)
    .maybeSingle();

  if (!escrow) return res.status(404).json({ error: 'Escrow not found' });
  if (escrow.payer_id !== req.user.id) return res.status(403).json({ error: 'Only payer can accept delivery' });

  const wallet = await ensureWallet(escrow.receiver_id);
  const amount = Number(escrow.amount || 0);

  await supabase.from('wallets').update({
    escrow_balance: Math.max(0, Number(wallet.escrow_balance || 0) - amount),
    pending_balance: Number(wallet.pending_balance || 0) + amount,
    updated_at: new Date().toISOString()
  }).eq('user_id', escrow.receiver_id);

  await recordWalletTransaction({
    user_id: escrow.receiver_id,
    type: 'escrow_release',
    amount,
    direction: 'credit',
    status: 'pending',
    reference_type: 'escrow',
    reference_id: escrow.id,
    metadata: { note: 'Moved from escrow to pending balance. External payout still requires admin approval.' }
  });

  const { data, error } = await supabase.from('escrows').update({
    status: 'completed',
    updated_at: new Date().toISOString()
  }).eq('id', escrow.id).select().single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

router.post('/withdrawals', authMiddleware, async (req, res) => {
  const c = authedClient(req);
  const { amount, bank_name, account_number, account_holder_name } = req.body;
  const clean = cleanAmount(amount);

  const wallet = await ensureWallet(req.user.id);
  if (Number(wallet.available_balance || 0) < clean) {
    return res.status(400).json({ error: 'Insufficient available balance' });
  }

  const risk = await fetch(`${req.protocol}://${req.get('host')}/api/ai/fraud-check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: req.headers.authorization },
    body: JSON.stringify({ type: 'withdrawal', amount: clean, user_id: req.user.id })
  }).then(r => r.json()).catch(() => ({ risk: 'unknown' }));

  const { data, error } = await c.from('withdrawal_requests').insert({
    user_id: req.user.id,
    amount: clean,
    bank_name,
    account_number,
    account_holder_name,
    ai_risk: risk,
    status: 'pending'
  }).select().single();

  if (error) return res.status(400).json({ error: error.message });

  await recordWalletTransaction({
    user_id: req.user.id,
    type: 'withdrawal_request',
    amount: clean,
    direction: 'debit',
    status: 'pending',
    reference_type: 'withdrawal_request',
    reference_id: data.id,
    metadata: { ai_risk: risk }
  });

  res.json(data);
});

router.post('/refunds', authMiddleware, async (req, res) => {
  const c = authedClient(req);
  const { escrow_id, reason, notes, evidence_urls } = req.body;

  const { data: escrow } = await supabase
    .from('escrows')
    .select('*')
    .eq('id', escrow_id)
    .maybeSingle();

  if (!escrow) return res.status(404).json({ error: 'Escrow not found' });
  if (escrow.payer_id !== req.user.id) return res.status(403).json({ error: 'Only payer can request refund' });

  const risk = await fetch(`${req.protocol}://${req.get('host')}/api/ai/fraud-check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: req.headers.authorization },
    body: JSON.stringify({ type: 'refund', escrow_id, reason, notes, user_id: req.user.id })
  }).then(r => r.json()).catch(() => ({ risk: 'unknown' }));

  const { data, error } = await c.from('refund_requests').insert({
    escrow_id,
    requested_by: req.user.id,
    reason,
    notes,
    evidence_urls: Array.isArray(evidence_urls) ? evidence_urls : [],
    ai_risk: risk,
    status: 'pending'
  }).select().single();

  if (error) return res.status(400).json({ error: error.message });

  await supabase.from('escrows').update({
    status: 'disputed',
    updated_at: new Date().toISOString()
  }).eq('id', escrow_id);

  res.json(data);
});

module.exports = router;
