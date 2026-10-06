import express from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db/database.js';
import { generateToken, authenticateToken } from '../middleware/auth.js';
import { sanitizeString, validateEmail, validatePhone } from '../utils/sanitize.js';

const router = express.Router();

/**
 * POST /api/auth/register
 * Register a new user (default role: CLIENTE)
 */
router.post('/register', async (req, res) => {
  try {
    const { name, email, phone, password, lgpdConsent } = req.body;

    const cleanName = sanitizeString(name);
    const cleanEmail = (email || '').toLowerCase().trim();
    const cleanPhone = sanitizeString(phone);

    if (!cleanName || cleanName.length < 3) {
      return res.status(400).json({ error: 'Nome completo é obrigatório (mínimo 3 caracteres).' });
    }

    if (!validateEmail(cleanEmail)) {
      return res.status(400).json({ error: 'E-mail inválido.' });
    }

    if (!validatePhone(cleanPhone)) {
      return res.status(400).json({ error: 'Telefone inválido (mínimo 10 dígitos).' });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Senha deve possuir no mínimo 6 caracteres.' });
    }

    if (!lgpdConsent) {
      return res.status(400).json({ error: 'É necessário concordar com os Termos de Privacidade e LGPD.' });
    }

    // Check if user already exists
    const existingUser = db.users.find(u => u.email === cleanEmail);
    if (existingUser) {
      return res.status(409).json({ error: 'Já existe uma conta com este e-mail.' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const newUser = {
      id: 'usr_' + Date.now(),
      name: cleanName,
      email: cleanEmail,
      phone: cleanPhone,
      passwordHash,
      role: 'CLIENTE',
      emailVerified: true, // Auto-verify in demo mode
      phoneVerified: true,
      createdAt: new Date().toISOString(),
      lgpdConsentAt: new Date().toISOString()
    };

    db.users.push(newUser);

    // Also register in clientes table if not already present
    let cliente = db.clientes.find(c => c.phone === cleanPhone || c.userId === newUser.id);
    if (!cliente) {
      cliente = {
        id: 'cli_' + Date.now(),
        userId: newUser.id,
        name: newUser.name,
        phone: newUser.phone,
        type: 'cliente',
        value: 0,
        payDay: null,
        status: 'ativo',
        createdAt: new Date().toISOString()
      };
      db.clientes.push(cliente);
    }

    const token = generateToken(newUser);

    return res.status(201).json({
      message: 'Cadastro realizado com sucesso!',
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        phone: newUser.phone,
        role: newUser.role
      },
      token
    });
  } catch (err) {
    console.error('[auth:register]', err);
    return res.status(500).json({ error: 'Erro interno ao processar cadastro.' });
  }
});

/**
 * POST /api/auth/login
 * User login with bcrypt validation and JWT generation
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const cleanEmail = (email || '').toLowerCase().trim();

    if (!cleanEmail || !password) {
      return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
    }

    const user = db.users.find(u => u.email === cleanEmail);
    if (!user) {
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }

    const token = generateToken(user);

    return res.json({
      message: 'Login realizado com sucesso!',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role
      },
      token
    });
  } catch (err) {
    console.error('[auth:login]', err);
    return res.status(500).json({ error: 'Erro interno ao realizar login.' });
  }
});

/**
 * GET /api/auth/me
 * Get current authenticated user profile
 */
router.get('/me', authenticateToken, (req, res) => {
  const user = db.users.find(u => u.id === req.user.id);
  if (!user) {
    return res.status(404).json({ error: 'Usuário não encontrado.' });
  }

  return res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      emailVerified: user.emailVerified,
      phoneVerified: user.phoneVerified,
      createdAt: user.createdAt,
      lgpdConsentAt: user.lgpdConsentAt
    }
  });
});

export default router;
