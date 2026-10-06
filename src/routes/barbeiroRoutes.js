import express from 'express';
import { db } from '../db/database.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { sanitizeString } from '../utils/sanitize.js';

const router = express.Router();

// GET /api/barbeiros - Public / Authenticated
router.get('/', (req, res) => {
  const list = db.barbeiros.filter(b => b.active !== false);
  return res.json({ barbeiros: list });
});

// POST /api/barbeiros - ADMIN only
router.post('/', authenticateToken, requireRole(['ADMIN']), (req, res) => {
  const { name, phone, specialty, comissaoPercentual, inicio, fim, diasSemana } = req.body;
  const cleanName = sanitizeString(name);

  if (!cleanName) {
    return res.status(400).json({ error: 'Nome do barbeiro é obrigatório.' });
  }

  const newBarbeiro = {
    id: 'barb_' + Date.now(),
    name: cleanName,
    phone: sanitizeString(phone || ''),
    specialty: sanitizeString(specialty || 'Cortes em geral'),
    comissaoPercentual: Number(comissaoPercentual) || 40,
    avatar: './Barbearia_files/barbeiro1.png',
    active: true,
    escala: {
      inicio: inicio || '09:00',
      fim: fim || '19:00',
      diasSemana: diasSemana || [1, 2, 3, 4, 5, 6]
    }
  };

  db.barbeiros.push(newBarbeiro);
  return res.status(201).json({ message: 'Barbeiro cadastrado com sucesso!', barbeiro: newBarbeiro });
});

// PUT /api/barbeiros/:id - ADMIN only
router.put('/:id', authenticateToken, requireRole(['ADMIN']), (req, res) => {
  const { id } = req.params;
  const barbeiro = db.barbeiros.find(b => b.id === id);

  if (!barbeiro) {
    return res.status(404).json({ error: 'Barbeiro não encontrado.' });
  }

  const { name, phone, specialty, comissaoPercentual, escala, active } = req.body;
  if (name) barbeiro.name = sanitizeString(name);
  if (phone) barbeiro.phone = sanitizeString(phone);
  if (specialty) barbeiro.specialty = sanitizeString(specialty);
  if (comissaoPercentual !== undefined) barbeiro.comissaoPercentual = Number(comissaoPercentual);
  if (escala) barbeiro.escala = escala;
  if (active !== undefined) barbeiro.active = Boolean(active);

  return res.json({ message: 'Barbeiro atualizado!', barbeiro });
});

// DELETE /api/barbeiros/:id - ADMIN only
router.delete('/:id', authenticateToken, requireRole(['ADMIN']), (req, res) => {
  const { id } = req.params;
  const idx = db.barbeiros.findIndex(b => b.id === id);

  if (idx === -1) {
    return res.status(404).json({ error: 'Barbeiro não encontrado.' });
  }

  db.barbeiros.splice(idx, 1);
  return res.json({ message: 'Barbeiro removido com sucesso.' });
});

export default router;
