function analyzeCV({ job = {}, documents = [] }) {
  const required = (job.required_skills || []).map(s => String(s).toLowerCase());
  const docText = documents.map(d => `${d.document_type || ''} ${d.file_type || ''}`).join(' ').toLowerCase();

  const matched = required.filter(skill => docText.includes(skill));
  const skillsScore = required.length ? Math.round((matched.length / required.length) * 100) : 50;
  const experienceScore = Number(job.experience_required || 0) <= 0 ? 70 : 55;
  const educationScore = job.education_requirement ? 60 : 70;
  const certificationScore = documents.some(d => String(d.document_type).toLowerCase().includes('certification')) ? 90 : 50;

  return {
    skillsScore,
    experienceScore,
    educationScore,
    certificationScore,
    strengths: matched.length ? [`Matched skills: ${matched.join(', ')}`] : ['Application submitted successfully'],
    weaknesses: matched.length < required.length ? ['Some required skills were not detected in uploaded document labels'] : []
  };
}

module.exports = { analyzeCV };
