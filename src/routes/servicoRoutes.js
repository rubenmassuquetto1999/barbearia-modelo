import express from 'express';
import { db } from '../db/database.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { sanitizeString } from '../utils/sanitize.js';

const router = express.Router();

// GET /api/servicos - Public
router.get('/', (req, res) => {
  const list = db.servicos.filter(s => s.active !== false);
  return res.json({ servicos: list });
});

// POST /api/servicos - ADMIN and SECRETARIA
router.post('/', authenticateToken, requireRole(['ADMIN', 'SECRETARIA']), (req, res) => {
  const { name, category, price, durationMin } = req.body;
  const cleanName = sanitizeString(name);

  if (!cleanName) {
    return res.status(400).json({ error: 'Nome do serviço é obrigatório.' });
  }

  const newSvc = {
    id: 'svc_' + Date.now(),
    name: cleanName,
    category: sanitizeString(category || 'Geral'),
    price: Number(price) || 0,
    durationMin: Number(durationMin) || 30,
    active: true
  };

  db.servicos.push(newSvc);
  return res.status(201).json({ message: 'Serviço cadastrado!', servico: newSvc });
});

// PUT /api/servicos/:id - ADMIN and SECRETARIA
router.put('/:id', authenticateToken, requireRole(['ADMIN', 'SECRETARIA']), (req, res) => {
  const { id } = req.params;
  const svc = db.servicos.find(s => s.id === id);

  if (!svc) {
    return res.status(404).json({ error: 'Serviço não encontrado.' });
  }

  const { name, category, price, durationMin, active } = req.body;
  if (name) svc.name = sanitizeString(name);
  if (category) svc.category = sanitizeString(category);
  if (price !== undefined) svc.price = Number(price);
  if (durationMin !== undefined) svc.durationMin = Number(durationMin);
  if (active !== undefined) svc.active = Boolean(active);

  return res.json({ message: 'Serviço atualizado!', servico: svc });
});

// DELETE /api/servicos/:id - ADMIN
router.delete('/:id', authenticateToken, requireRole(['ADMIN']), (req, res) => {
  const { id } = req.params;
  const idx = db.servicos.findIndex(s => s.id === id);

  if (idx === -1) {
    return res.status(404).json({ error: 'Serviço não encontrado.' });
  }

  db.servicos.splice(idx, 1);
  return res.json({ message: 'Serviço removido com sucesso.' });
});

export default router;
