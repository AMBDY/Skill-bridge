// Inject Supabase config and load the client library
window.SUPABASE_URL = 'https://jvxhtdbcowhsllnwrtut.supabase.co';
window.SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp2eGh0ZGJjb3doc2xsbndydHV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0NDY5OTYsImV4cCI6MjA5ODAyMjk5Nn0.jCpv_pgnJ5ZdU-brYh-g78xmXj2gEpvYDhOfE6T3fvo';

// Load supabase-js from CDN (UMD build exposes window.supabaseJs)
(function () {
  if (window.supabaseJs) return;
  const s = document.createElement('script');
  s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase-js.min.js';
  s.async = false;
  document.head.appendChild(s);
})();
