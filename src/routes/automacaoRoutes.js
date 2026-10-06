import express from 'express';
import { db } from '../db/database.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { sendAutomatedWhatsAppReminder, formatWhatsAppBookingUrl } from '../services/whatsappService.js';

const router = express.Router();

// GET /api/automacao/whatsapp/fila - ADMIN and SECRETARIA
router.get('/whatsapp/fila', authenticateToken, requireRole(['ADMIN', 'SECRETARIA']), (req, res) => {
  return res.json({ automacoes: db.automacoes });
});

// POST /api/automacao/whatsapp/disparar - ADMIN and SECRETARIA
router.post('/whatsapp/disparar', authenticateToken, requireRole(['ADMIN', 'SECRETARIA']), (req, res) => {
  const { agendamentoId, tipo } = req.body;

  try {
    const aut = sendAutomatedWhatsAppReminder({
      agendamentoId,
      tipo: tipo || 'LEMBRETE_2H'
    });

    return res.json({ message: 'Lembrete enviado com sucesso!', automacao: aut });
  } catch (err) {
    return res.status(400).json({ error: err.message || 'Erro ao disparar automação.' });
  }
});

// POST /api/automacao/whatsapp/gerar-link - Public (Caminho A)
router.post('/whatsapp/gerar-link', (req, res) => {
  const { phone, clienteNome, barbeiroNome, servicoNome, servicoPreco, dataBR, hora, produtos, raclubStatus } = req.body;

  const url = formatWhatsAppBookingUrl({
    phone,
    clienteNome,
    barbeiroNome,
    servicoNome,
    servicoPreco,
    dataBR,
    hora,
    produtos,
    raclubStatus
  });

  return res.json({ url });
});

export default router;
