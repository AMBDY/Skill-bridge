require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const authRoutes = require('./routes/auth');
const marketplaceRoutes = require('./routes/marketplace');
const jobRoutes = require('./routes/jobs');
const chatRoutes = require('./routes/chat');
const paymentRoutes = require('./routes/payments');
const adminRoutes = require('./routes/admin');
const aiRoutes = require('./routes/ai');
const { initChatSockets } = require('./sockets/chat');
const { supabase, hasSupabaseConfig } = require('./utils/db');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

app.locals.supabase = supabase;
app.locals.io = io;
app.set('trust proxy', 1);

// Supabase config snippet injected into all HTML pages
const SB_CONFIG = `<script>window.SUPABASE_URL="${SUPABASE_URL}";window.SUPABASE_ANON_KEY="${ANON_KEY}";</script><script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase-js.min.js"></script>`;

const PUBLIC_DIR = path.join(__dirname, '..', 'public');

// Serve static non-HTML assets directly (skip .html so we can inject config)
app.use((req, res, next) => {
  if (path.extname(req.path).toLowerCase() === '.html') return next();
  express.static(PUBLIC_DIR)(req, res, next);
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/marketplace', marketplaceRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/ai', aiRoutes);
app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'skillbridge', supabaseConfigured: hasSupabaseConfig }));

// Serve HTML files with Supabase config injected
function serveHtml(filename, res) {
  const file = path.join(PUBLIC_DIR, filename);
  fs.readFile(file, 'utf8', (err, data) => {
    if (err) return res.status(404).send('Not found');
    const injected = data.includes('sb-config.js')
      ? data
      : data.replace('<script src="/js/app.js">', SB_CONFIG + '<script src="/js/app.js">');
    res.type('html').send(injected);
  });
}

app.get('/', (req, res) => serveHtml('index.html', res));
app.get('*.html', (req, res) => serveHtml(path.basename(req.path), res));

// SPA fallback
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
  serveHtml('index.html', res);
});

initChatSockets(io, supabase);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  if (!hasSupabaseConfig) console.warn('SkillBridge started without Supabase configuration. Add SUPABASE_URL and SUPABASE_ANON_KEY before production use.');
  console.log(`SkillBridge running on port ${PORT}`);
});

module.exports = app;
