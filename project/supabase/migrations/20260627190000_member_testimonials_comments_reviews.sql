-- Member testimonials, public comments, and verified review extensions.
-- Adds the new social-proof features requested after the initial SkillBridge build.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS social_links jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS profile_completed boolean DEFAULT false;

ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS service_id uuid REFERENCES public.services(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS verified_purchase boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'approved' CHECK (status IN ('pending','approved','hidden','rejected'));

CREATE INDEX IF NOT EXISTS idx_reviews_product ON public.reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_service ON public.reviews(service_id);
CREATE INDEX IF NOT EXISTS idx_reviews_job ON public.reviews(job_id);
CREATE INDEX IF NOT EXISTS idx_reviews_status ON public.reviews(status);

CREATE TABLE IF NOT EXISTS public.comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  service_id uuid REFERENCES public.services(id) ON DELETE CASCADE,
  job_id uuid REFERENCES public.jobs(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.comments(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(trim(body)) BETWEEN 2 AND 2000),
  status text DEFAULT 'visible' CHECK (status IN ('visible','hidden','flagged','deleted')),
  created_at timestamptz DEFAULT now(),
  CHECK (num_nonnulls(product_id, service_id, job_id) = 1)
);
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_visible_comments" ON public.comments;
CREATE POLICY "read_visible_comments" ON public.comments FOR SELECT TO anon, authenticated USING (status = 'visible');
DROP POLICY IF EXISTS "insert_own_comments" ON public.comments;
CREATE POLICY "insert_own_comments" ON public.comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_comments" ON public.comments;
CREATE POLICY "update_own_comments" ON public.comments FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_comments_product ON public.comments(product_id, created_at);
CREATE INDEX IF NOT EXISTS idx_comments_service ON public.comments(service_id, created_at);
CREATE INDEX IF NOT EXISTS idx_comments_job ON public.comments(job_id, created_at);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON public.comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_comments_status ON public.comments(status);

CREATE TABLE IF NOT EXISTS public.testimonials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  message text NOT NULL CHECK (char_length(trim(message)) BETWEEN 10 AND 1000),
  rating int CHECK (rating BETWEEN 1 AND 5),
  show_profile_image boolean DEFAULT true,
  show_display_name boolean DEFAULT true,
  consent_public boolean NOT NULL DEFAULT false,
  status text DEFAULT 'pending' CHECK (status IN ('pending','approved','hidden','rejected')),
  admin_note text,
  approved_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_approved_testimonials" ON public.testimonials;
CREATE POLICY "read_approved_testimonials" ON public.testimonials FOR SELECT TO anon, authenticated USING (status = 'approved' AND consent_public = true);
DROP POLICY IF EXISTS "insert_own_testimonials" ON public.testimonials;
CREATE POLICY "insert_own_testimonials" ON public.testimonials FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_pending_testimonials" ON public.testimonials;
CREATE POLICY "update_own_pending_testimonials" ON public.testimonials FOR UPDATE TO authenticated USING (auth.uid() = user_id AND status IN ('pending','rejected')) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_testimonials_status ON public.testimonials(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_testimonials_user ON public.testimonials(user_id);


-- Admin moderation access for the new social-proof tables.
DROP POLICY IF EXISTS "admin_manage_testimonials" ON public.testimonials;
CREATE POLICY "admin_manage_testimonials" ON public.testimonials FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "admin_manage_comments" ON public.comments;
CREATE POLICY "admin_manage_comments" ON public.comments FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "admin_manage_reviews" ON public.reviews;
CREATE POLICY "admin_manage_reviews" ON public.reviews FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
