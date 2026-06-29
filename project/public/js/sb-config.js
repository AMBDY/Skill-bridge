// Inject Supabase config and load the client library
window.SUPABASE_URL = 'https://jyjqgrjqtvkuznpdgjct.supabase.co';
window.SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5anFncmpxdHZrdXpucGRnamN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2OTgwODYsImV4cCI6MjA5ODI3NDA4Nn0.SoPB5dmiX-l5tpSJUlww2abqjvd_FyNF6ce7IeqosqE';

// Load supabase-js from CDN (UMD build exposes window.supabaseJs)
(function () {
  if (window.supabase) return;

  const s = document.createElement('script');
  s.src = 'https://unpkg.com/@supabase/supabase-js@2';
  s.onload = () => console.log('Supabase loaded');
  document.head.appendChild(s);
})();
