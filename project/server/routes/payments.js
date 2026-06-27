const router = require('express').Router();
const { supabase, createAuthedClient } = require('../utils/db');
const { authMiddleware } = require('../middleware/auth');

function authedClient(req) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  return createAuthedClient(token);
}

// Create payment (client pays into escrow)
router.post('/', authMiddleware, async (req, res) => {
  const c = authedClient(req);
  const { job_id, agreement_id, worker_id, amount, payment_method, proof_url, proof_meta } = req.body;
  const { data: settings } = await supabase.from('platform_settings').select('service_fee_percent').limit(1).maybeSingle();
  const feePercent = settings?.service_fee_percent || 10;
  const fee = +(amount * feePercent / 100).toFixed(2);
  const { data, error } = await c.from('payments').insert({
    job_id, agreement_id, client_id: req.user.id, worker_id, amount,
    service_fee: fee, payment_method, proof_url, proof_meta, status: 'in_escrow'
  }).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// List my payments
router.get('/', authMiddleware, async (req, res) => {
  const c = authedClient(req);
  const { data, error } = await c.from('payments').select('*, job:jobs(title), agreement:agreements(*)')
    .or(`client_id.eq.${req.user.id},worker_id.eq.${req.user.id}`)
    .order('created_at', { ascending: false });
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// Client marks received (only 1hr after acceptance)
router.put('/:id/received', authMiddleware, async (req, res) => {
  const c = authedClient(req);
  const { data: payment } = await c.from('payments').select('*').eq('id', req.params.id).maybeSingle();
  if (!payment) return res.status(404).json({ error: 'Not found' });
  if (payment.client_id !== req.user.id) return res.status(403).json({ error: 'Only client can mark received' });
  const acceptedAt = payment.received_at || payment.created_at;
  const elapsed = (Date.now() - new Date(acceptedAt).getTime()) / 3600000;
  if (elapsed < 1) return res.status(400).json({ error: 'Received button activates 1 hour after acceptance' });
  const { data, error } = await c.from('payments').update({ received_at: new Date().toISOString(), status: 'released' }).eq('id', req.params.id).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// Upload proof
router.put('/:id/proof', authMiddleware, async (req, res) => {
  const c = authedClient(req);
  const { proof_url, proof_meta } = req.body;
  const { data, error } = await c.from('payments').update({ proof_url, proof_meta }).eq('id', req.params.id).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

module.exports = router;
