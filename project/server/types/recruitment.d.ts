export type RecruitmentAiPlan = 'basic' | 'standard' | 'premium' | 'enterprise';
export type RecruitmentApprovalStatus = 'pending' | 'approved' | 'rejected' | 'suspended';
export type VideoMode = 'disabled' | 'optional' | 'mandatory';
export type QuestionMode = 'manual' | 'ai_generated';

export interface RecruitmentJob {
  id: string;
  recruiter_id: string;
  title: string;
  company_name: string;
  description: string;
  responsibilities: string[];
  required_skills: string[];
  experience_required: number;
  education_requirement?: string | null;
  salary?: string | null;
  location?: string | null;
  deadline?: string | null;
  ai_plan: RecruitmentAiPlan;
  approval_status: RecruitmentApprovalStatus;
  video_enabled: VideoMode;
  question_mode: QuestionMode;
  created_at: string;
}

export interface JobApplication {
  id: string;
  job_id: string;
  applicant_id: string;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  cover_note?: string | null;
  status: 'submitted' | 'reviewing' | 'shortlisted' | 'rejected' | 'hired';
  created_at: string;
}
