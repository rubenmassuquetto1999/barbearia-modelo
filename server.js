import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import rateLimit from 'express-rate-limit';

import authRoutes from './src/routes/authRoutes.js';
import agendamentoRoutes from './src/routes/agendamentoRoutes.js';
import barbeiroRoutes from './src/routes/barbeiroRoutes.js';
import servicoRoutes from './src/routes/servicoRoutes.js';
import clienteRoutes from './src/routes/clienteRoutes.js';
import financeiroRoutes from './src/routes/financeiroRoutes.js';
import automacaoRoutes from './src/routes/automacaoRoutes.js';
import lgpdRoutes from './src/routes/lgpdRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

// Security: Enable CORS and JSON body parser with size limiter
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// DevSecOps: Rate Limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit each IP to 30 auth requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas tentativas de autenticação. Tente novamente em 15 minutos.' }
});

const bookingLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas requisições de agendamento. Aguarde alguns instantes.' }
});

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 180,
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/api/', apiLimiter);
app.use('/api/auth/', authLimiter);
app.use('/api/agendamentos/', bookingLimiter);

// Register API Routes
app.use('/api/auth', authRoutes);
app.use('/api/agendamentos', agendamentoRoutes);
app.use('/api/barbeiros', barbeiroRoutes);
app.use('/api/servicos', servicoRoutes);
app.use('/api/clientes', clienteRoutes);
app.use('/api/financeiro', financeiroRoutes);
app.use('/api/automacao', automacaoRoutes);
app.use('/api/lgpd', lgpdRoutes);

// Health check route
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve static assets
app.use(express.static(__dirname, {
  extensions: ['html', 'htm']
}));

// Route Shortcuts
app.get('/vitrine', (req, res) => {
  res.sendFile(path.join(__dirname, 'Barbearia.html'));
});

app.get('/agendamento', (req, res) => {
  res.sendFile(path.join(__dirname, 'Barbearia.html'));
});

app.get('/painel', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Fallback to index.html for SPA/Panel navigation
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'Endpoint não encontrado.' });
  }
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Unhandled Error]', err);
  res.status(500).json({ error: 'Erro interno do servidor.' });
});

app.listen(PORT, HOST, () => {
  console.log(`[Barbearia DevSecOps Platform] Running at http://${HOST}:${PORT}`);
});
