import express from 'express';
import { db } from '../db/database.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { sanitizeString, formatPhoneNumber } from '../utils/sanitize.js';

const router = express.Router();

// GET /api/clientes - ADMIN and SECRETARIA
router.get('/', authenticateToken, requireRole(['ADMIN', 'SECRETARIA']), (req, res) => {
  return res.json({ clientes: db.clientes });
});

// POST /api/clientes - ADMIN and SECRETARIA
router.post('/', authenticateToken, requireRole(['ADMIN', 'SECRETARIA']), (req, res) => {
  const { name, phone, type, value, payDay, status } = req.body;
  const cleanName = sanitizeString(name);

  if (!cleanName) {
    return res.status(400).json({ error: 'Nome do cliente é obrigatório.' });
  }

  const newCliente = {
    id: 'cli_' + Date.now(),
    userId: null,
    name: cleanName,
    phone: sanitizeString(phone || ''),
    type: type === 'plano_jc' ? 'plano_jc' : 'cliente',
    value: type === 'plano_jc' ? (Number(value) || 0) : 0,
    payDay: type === 'plano_jc' ? (Number(payDay) || null) : null,
    status: status || 'ativo',
    createdAt: new Date().toISOString()
  };

  db.clientes.unshift(newCliente);
  return res.status(201).json({ message: 'Cliente cadastrado com sucesso!', cliente: newCliente });
});

// PUT /api/clientes/:id - ADMIN and SECRETARIA
router.put('/:id', authenticateToken, requireRole(['ADMIN', 'SECRETARIA']), (req, res) => {
  const { id } = req.params;
  const cliente = db.clientes.find(c => c.id === id);

  if (!cliente) {
    return res.status(404).json({ error: 'Cliente não encontrado.' });
  }

  const { name, phone, type, value, payDay, status } = req.body;
  if (name) cliente.name = sanitizeString(name);
  if (phone) cliente.phone = sanitizeString(phone);
  if (type) cliente.type = type;
  if (value !== undefined) cliente.value = Number(value);
  if (payDay !== undefined) cliente.payDay = Number(payDay);
  if (status) cliente.status = status;

  return res.json({ message: 'Cliente atualizado com sucesso!', cliente });
});

// DELETE /api/clientes/:id - ADMIN only
router.delete('/:id', authenticateToken, requireRole(['ADMIN']), (req, res) => {
  const { id } = req.params;
  const idx = db.clientes.findIndex(c => c.id === id);

  if (idx === -1) {
    return res.status(404).json({ error: 'Cliente não encontrado.' });
  }

  db.clientes.splice(idx, 1);
  return res.json({ message: 'Cliente excluído com sucesso.' });
});

export default router;
