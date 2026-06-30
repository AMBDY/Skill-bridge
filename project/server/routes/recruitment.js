const router = require('express').Router();
const { supabase, createAuthedClient } = require('../utils/db');
const { authMiddleware } = require('../middleware/auth');
const { generateQuestions } = require('../services/ai/question-generator');
const { analyzeCV } = require('../services/ai/cv-analysis');
const { analyzeVideo } = require('../services/ai/video-analysis');
const { detectFraud } = require('../services/ai/fraud');
const { weightedCandidateScore, labelForScore, recommendationForScore } = require('../services/ai/scoring');

function authedClient(req) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  return createAuthedClient(token);
}

function parseList(value) {
  if (Array.isArray(value)) return value.map(String).map(s => s.trim()).filter(Boolean);
  if (!value) return [];
  return String(value).split(',').map(s => s.trim()).filter(Boolean);
}

function isRecruiter(role) {
  return ['client', 'admin'].includes(role);
}

function isAdmin(role) {
  return role === 'admin';
}

router.get('/jobs', async (req, res) => {
  const { mine } = req.query;
  let q = supabase.from('recruitment_jobs').select('*').order('created_at', { ascending: false });

  if (mine === '1') {
    return res.status(401).json({ error: 'Use authenticated recruiter dashboard route.' });
  }

  q = q.eq('approval_status', 'approved');

  const { data, error } = await q.limit(80);
  if (error) return res.status(400).json({ error: error.message });
  res.json(data || []);
});

router.get('/jobs/:id', async (req, res) => {
  const { data: job, error } = await supabase
    .from('recruitment_jobs')
    .select('*')
    .eq('id', req.params.id)
    .maybeSingle();

  if (error) return res.status(400).json({ error: error.message });
  if (!job) return res.status(404).json({ error: 'Job not found' });
  if (job.approval_status !== 'approved') return res.status(404).json({ error: 'Job not found' });

  const [{ data: documents }, { data: questions }] = await Promise.all([
    supabase.from('job_required_documents').select('*').eq('job_id', job.id),
    supabase.from('job_questions').select('*').eq('job_id', job.id)
  ]);

  res.json({ ...job, documents: documents || [], questions: questions || [] });
});

router.post('/jobs', authMiddleware, async (req, res) => {
  if (!isRecruiter(req.user.role)) {
    return res.status(403).json({ error: 'Only recruiters/clients can create recruitment jobs.' });
  }

  const c = authedClient(req);
  const payload = req.body || {};

  if (!payload.title || !payload.company_name || !payload.description) {
    return res.status(400).json({ error: 'Title, company name, and description are required.' });
  }

  const jobInsert = {
    recruiter_id: req.user.id,
    title: payload.title,
    company_name: payload.company_name,
    description: payload.description,
    responsibilities: parseList(payload.responsibilities),
    required_skills: parseList(payload.required_skills),
    experience_required: Number(payload.experience_required || 0),
    education_requirement: payload.education_requirement || null,
    salary: payload.salary || null,
    location: payload.location || null,
    deadline: payload.deadline || null,
    ai_plan: payload.ai_plan || 'basic',
    approval_status: 'pending',
    video_enabled: payload.video_enabled || 'disabled',
    question_mode: payload.question_mode || 'manual'
  };

  const { data: job, error } = await c.from('recruitment_jobs').insert(jobInsert).select().single();
  if (error) return res.status(400).json({ error: error.message });

  const docs = Array.isArray(payload.documents) ? payload.documents : [];
  if (docs.length) {
    await c.from('job_required_documents').insert(docs.map(d => ({
      job_id: job.id,
      document_type: d.document_type,
      required: !!d.required
    })));
  }

  let questions = Array.isArray(payload.questions) ? payload.questions : [];
  if (job.question_mode === 'ai_generated') questions = generateQuestions(job);

  if (questions.length) {
    await c.from('job_questions').insert(questions.map(q => ({
      job_id: job.id,
      question: q.question,
      duration_limit: Number(q.duration_limit || 120),
      attempts_allowed: Number(q.attempts_allowed || 1)
    })));
  }

  res.json(job);
});

router.get('/recruiter/jobs', authMiddleware, async (req, res) => {
  if (!isRecruiter(req.user.role)) return res.status(403).json({ error: 'Recruiter access required.' });

  const c = authedClient(req);
  const { data, error } = await c
    .from('recruitment_jobs')
    .select('*')
    .eq('recruiter_id', req.user.id)
    .order('created_at', { ascending: false });

  if (error) return res.status(400).json({ error: error.message });
  res.json(data || []);
});

router.get('/recruiter/applicants', authMiddleware, async (req, res) => {
  if (!isRecruiter(req.user.role)) return res.status(403).json({ error: 'Recruiter access required.' });

  const c = authedClient(req);
  const { job_id } = req.query;

  let q = c
    .from('job_applications')
    .select('*, recruitment_jobs!inner(*), ai_screening_results(*)')
    .eq('recruitment_jobs.recruiter_id', req.user.id)
    .order('created_at', { ascending: false });

  if (job_id) q = q.eq('job_id', job_id);

  const { data, error } = await q;
  if (error) return res.status(400).json({ error: error.message });
  res.json(data || []);
});

router.post('/apply/:jobId', authMiddleware, async (req, res) => {
  const c = authedClient(req);
  const { data: job } = await supabase
    .from('recruitment_jobs')
    .select('*')
    .eq('id', req.params.jobId)
    .eq('approval_status', 'approved')
    .maybeSingle();

  if (!job) return res.status(404).json({ error: 'Approved job not found.' });

  const payload = req.body || {};
  const { data: application, error } = await c.from('job_applications').insert({
    job_id: job.id,
    applicant_id: req.user.id,
    full_name: payload.full_name,
    email: payload.email,
    phone: payload.phone,
    cover_note: payload.cover_note
  }).select().single();

  if (error) return res.status(400).json({ error: error.message });

  const documents = Array.isArray(payload.documents) ? payload.documents : [];
  if (documents.length) {
    await c.from('application_documents').insert(documents.map(d => ({
      application_id: application.id,
      file_url: d.file_url,
      file_type: d.file_type,
      document_type: d.document_type
    })));
  }

  let videoRecord = null;
  if (payload.video_url) {
    const { data } = await c.from('application_videos').insert({
      application_id: application.id,
      video_url: payload.video_url,
      transcript: payload.transcript || null
    }).select().single();
    videoRecord = data;
  }

  const cv = analyzeCV({ job, documents });
  const video = analyzeVideo({ video: videoRecord });
  const fraud = detectFraud({ documents, application, job });

  const score = weightedCandidateScore({
    skills: cv.skillsScore,
    experience: cv.experienceScore,
    education: cv.educationScore,
    certification: cv.certificationScore,
    video: video.videoScore
  });

  await supabase.from('ai_screening_results').insert({
    application_id: application.id,
    score,
    risk_score: fraud.riskScore,
    ranking_label: labelForScore(score),
    strengths: cv.strengths,
    weaknesses: [...cv.weaknesses, ...fraud.flags],
    recommendation: recommendationForScore(score, fraud.riskScore),
    provider_used: 'fallback'
  });

  res.json({ application });
});

router.get('/applications/mine', authMiddleware, async (req, res) => {
  const c = authedClient(req);
  const { data, error } = await c
    .from('job_applications')
    .select('*, recruitment_jobs(*)')
    .eq('applicant_id', req.user.id)
    .order('created_at', { ascending: false });

  if (error) return res.status(400).json({ error: error.message });
  res.json(data || []);
});

router.put('/applications/:id/status', authMiddleware, async (req, res) => {
  if (!isRecruiter(req.user.role)) return res.status(403).json({ error: 'Recruiter access required.' });

  const c = authedClient(req);
  const { status } = req.body;

  if (!['reviewing', 'shortlisted', 'rejected', 'hired'].includes(status)) {
    return res.status(400).json({ error: 'Invalid application status.' });
  }

  const { data, error } = await c.from('job_applications').update({ status }).eq('id', req.params.id).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

router.get('/admin/jobs', authMiddleware, async (req, res) => {
  if (!isAdmin(req.user.role)) return res.status(403).json({ error: 'Admin access required.' });

  const c = authedClient(req);
  const { data, error } = await c.from('recruitment_jobs').select('*').order('created_at', { ascending: false });
  if (error) return res.status(400).json({ error: error.message });
  res.json(data || []);
});

router.put('/admin/jobs/:id/status', authMiddleware, async (req, res) => {
  if (!isAdmin(req.user.role)) return res.status(403).json({ error: 'Admin access required.' });

  const c = authedClient(req);
  const { approval_status } = req.body;

  if (!['approved', 'rejected', 'suspended'].includes(approval_status)) {
    return res.status(400).json({ error: 'Invalid approval status.' });
  }

  const { data, error } = await c
    .from('recruitment_jobs')
    .update({ approval_status })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

module.exports = router;
