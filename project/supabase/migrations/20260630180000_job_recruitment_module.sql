CREATE TABLE IF NOT EXISTS public.recruitment_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recruiter_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  company_name text NOT NULL,
  description text NOT NULL,
  responsibilities text[] DEFAULT '{}',
  required_skills text[] DEFAULT '{}',
  experience_required integer DEFAULT 0,
  education_requirement text,
  salary text,
  location text,
  deadline timestamptz,
  ai_plan text NOT NULL DEFAULT 'basic' CHECK (ai_plan IN ('basic','standard','premium','enterprise')),
  approval_status text NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending','approved','rejected','suspended')),
  video_enabled text NOT NULL DEFAULT 'disabled' CHECK (video_enabled IN ('disabled','optional','mandatory')),
  question_mode text NOT NULL DEFAULT 'manual' CHECK (question_mode IN ('manual','ai_generated')),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.job_required_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.recruitment_jobs(id) ON DELETE CASCADE,
  document_type text NOT NULL,
  required boolean DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.job_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.recruitment_jobs(id) ON DELETE CASCADE,
  question text NOT NULL,
  duration_limit integer DEFAULT 120,
  attempts_allowed integer DEFAULT 1
);

CREATE TABLE IF NOT EXISTS public.job_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.recruitment_jobs(id) ON DELETE CASCADE,
  applicant_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  email text,
  phone text,
  cover_note text,
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','reviewing','shortlisted','rejected','hired')),
  created_at timestamptz DEFAULT now(),
  UNIQUE (job_id, applicant_id)
);

CREATE TABLE IF NOT EXISTS public.application_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.job_applications(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  file_type text,
  document_type text
);

CREATE TABLE IF NOT EXISTS public.application_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.job_applications(id) ON DELETE CASCADE,
  video_url text NOT NULL,
  transcript text
);

CREATE TABLE IF NOT EXISTS public.ai_screening_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL UNIQUE REFERENCES public.job_applications(id) ON DELETE CASCADE,
  score numeric(5,2) DEFAULT 0,
  risk_score numeric(5,2) DEFAULT 0,
  ranking_label text,
  strengths text[] DEFAULT '{}',
  weaknesses text[] DEFAULT '{}',
  recommendation text,
  provider_used text DEFAULT 'fallback',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recruitment_jobs_status ON public.recruitment_jobs(approval_status);
CREATE INDEX IF NOT EXISTS idx_recruitment_jobs_recruiter ON public.recruitment_jobs(recruiter_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_job ON public.job_applications(job_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_applicant ON public.job_applications(applicant_id);
CREATE INDEX IF NOT EXISTS idx_ai_screening_application ON public.ai_screening_results(application_id);

ALTER TABLE public.recruitment_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_required_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_screening_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_approved_recruitment_jobs" ON public.recruitment_jobs;
CREATE POLICY "public_read_approved_recruitment_jobs"
ON public.recruitment_jobs FOR SELECT TO anon, authenticated
USING (approval_status = 'approved' OR recruiter_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "recruiters_create_jobs" ON public.recruitment_jobs;
CREATE POLICY "recruiters_create_jobs"
ON public.recruitment_jobs FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = recruiter_id
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
    AND p.role IN ('client','admin')
  )
);

DROP POLICY IF EXISTS "recruiters_update_own_jobs" ON public.recruitment_jobs;
CREATE POLICY "recruiters_update_own_jobs"
ON public.recruitment_jobs FOR UPDATE TO authenticated
USING (auth.uid() = recruiter_id OR public.is_admin())
WITH CHECK (auth.uid() = recruiter_id OR public.is_admin());

CREATE POLICY "read_job_documents"
ON public.job_required_documents FOR SELECT TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.recruitment_jobs j
    WHERE j.id = job_required_documents.job_id
    AND (j.approval_status = 'approved' OR j.recruiter_id = auth.uid() OR public.is_admin())
  )
);

CREATE POLICY "manage_job_documents"
ON public.job_required_documents FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.recruitment_jobs j
    WHERE j.id = job_required_documents.job_id
    AND (j.recruiter_id = auth.uid() OR public.is_admin())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.recruitment_jobs j
    WHERE j.id = job_required_documents.job_id
    AND (j.recruiter_id = auth.uid() OR public.is_admin())
  )
);

CREATE POLICY "read_job_questions"
ON public.job_questions FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.recruitment_jobs j
    WHERE j.id = job_questions.job_id
    AND (j.approval_status = 'approved' OR j.recruiter_id = auth.uid() OR public.is_admin())
  )
);

CREATE POLICY "manage_job_questions"
ON public.job_questions FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.recruitment_jobs j
    WHERE j.id = job_questions.job_id
    AND (j.recruiter_id = auth.uid() OR public.is_admin())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.recruitment_jobs j
    WHERE j.id = job_questions.job_id
    AND (j.recruiter_id = auth.uid() OR public.is_admin())
  )
);

CREATE POLICY "applicants_create_applications"
ON public.job_applications FOR INSERT TO authenticated
WITH CHECK (auth.uid() = applicant_id);

CREATE POLICY "applications_visibility"
ON public.job_applications FOR SELECT TO authenticated
USING (
  auth.uid() = applicant_id
  OR public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.recruitment_jobs j
    WHERE j.id = job_applications.job_id
    AND j.recruiter_id = auth.uid()
  )
);

CREATE POLICY "recruiter_admin_update_application_status"
ON public.job_applications FOR UPDATE TO authenticated
USING (
  public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.recruitment_jobs j
    WHERE j.id = job_applications.job_id
    AND j.recruiter_id = auth.uid()
  )
)
WITH CHECK (
  public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.recruitment_jobs j
    WHERE j.id = job_applications.job_id
    AND j.recruiter_id = auth.uid()
  )
);

CREATE POLICY "application_documents_visibility"
ON public.application_documents FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.job_applications a
    LEFT JOIN public.recruitment_jobs j ON j.id = a.job_id
    WHERE a.id = application_documents.application_id
    AND (a.applicant_id = auth.uid() OR j.recruiter_id = auth.uid() OR public.is_admin())
  )
);

CREATE POLICY "application_documents_insert"
ON public.application_documents FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.job_applications a
    WHERE a.id = application_documents.application_id
    AND a.applicant_id = auth.uid()
  )
);

CREATE POLICY "application_videos_visibility"
ON public.application_videos FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.job_applications a
    LEFT JOIN public.recruitment_jobs j ON j.id = a.job_id
    WHERE a.id = application_videos.application_id
    AND (a.applicant_id = auth.uid() OR j.recruiter_id = auth.uid() OR public.is_admin())
  )
);

CREATE POLICY "application_videos_insert"
ON public.application_videos FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.job_applications a
    WHERE a.id = application_videos.application_id
    AND a.applicant_id = auth.uid()
  )
);

CREATE POLICY "ai_results_recruiter_admin_only"
ON public.ai_screening_results FOR SELECT TO authenticated
USING (
  public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.job_applications a
    JOIN public.recruitment_jobs j ON j.id = a.job_id
    WHERE a.id = ai_screening_results.application_id
    AND j.recruiter_id = auth.uid()
  )
);

CREATE POLICY "ai_results_admin_service_insert"
ON public.ai_screening_results FOR INSERT TO authenticated
WITH CHECK (public.is_admin());

INSERT INTO storage.buckets (id, name, public)
VALUES ('recruitment', 'recruitment', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "recruitment_public_read" ON storage.objects;
CREATE POLICY "recruitment_public_read"
ON storage.objects FOR SELECT TO anon, authenticated
USING (bucket_id = 'recruitment');

DROP POLICY IF EXISTS "recruitment_authenticated_upload" ON storage.objects;
CREATE POLICY "recruitment_authenticated_upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'recruitment');

GRANT SELECT, INSERT, UPDATE, DELETE ON public.recruitment_jobs TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_required_documents TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_questions TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_applications TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.application_documents TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.application_videos TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_screening_results TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
