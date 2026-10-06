import express from 'express';
import { db } from '../db/database.js';
import { authenticateToken, optionalAuth, requireRole } from '../middleware/auth.js';
import { checkScheduleConflict, getAvailableSlots, calculateEndTime } from '../services/scheduleConflict.js';
import { sanitizeString, validateDateFormat, validateTimeFormat } from '../utils/sanitize.js';
import { sendAutomatedWhatsAppReminder } from '../services/whatsappService.js';

const router = express.Router();

/**
 * GET /api/agendamentos/disponibilidade
 * Query params: barbeiroId, dataISO, durationMin
 * Returns available free time slots with real-time conflict checking
 */
router.get('/disponibilidade', (req, res) => {
  const { barbeiroId, dataISO, durationMin } = req.query;

  if (!barbeiroId || !dataISO) {
    return res.status(400).json({ error: 'Parâmetros barbeiroId e dataISO são obrigatórios.' });
  }

  if (!validateDateFormat(dataISO)) {
    return res.status(400).json({ error: 'Formato de data inválido. Use YYYY-MM-DD.' });
  }

  const duration = Number(durationMin) || 30;
  const slots = getAvailableSlots({
    barbeiroId,
    dataISO,
    durationMin: duration
  });

  return res.json({
    barbeiroId,
    dataISO,
    durationMin: duration,
    slots
  });
});

/**
 * GET /api/agendamentos
 * List appointments filtered by user role:
 * - CLIENTE: only sees their own appointments
 * - BARBEIRO: sees appointments assigned to them
 * - ADMIN / SECRETARIA: sees all appointments
 */
router.get('/', optionalAuth, (req, res) => {
  const { dataISO, barbeiroId, status } = req.query;

  let list = [...db.agendamentos];

  // RBAC Filter
  if (req.user) {
    if (req.user.role === 'CLIENTE') {
      list = list.filter(a =>
        a.clienteTelefone === req.user.phone ||
        a.clienteId === req.user.id ||
        (a.clienteNome && a.clienteNome.toLowerCase() === req.user.name.toLowerCase())
      );
    } else if (req.user.role === 'BARBEIRO') {
      const barbeiro = db.barbeiros.find(b => b.userId === req.user.id || b.name.toLowerCase().includes(req.user.name.toLowerCase()));
      if (barbeiro) {
        list = list.filter(a => a.barbeiroId === barbeiro.id);
      }
    }
  }

  if (dataISO) {
    list = list.filter(a => a.dataISO === dataISO);
  }

  if (barbeiroId) {
    list = list.filter(a => a.barbeiroId === barbeiroId);
  }

  if (status) {
    list = list.filter(a => a.status === status);
  }

  // Sort by date and start time
  list.sort((a, b) => (a.dataISO + a.horaInicio).localeCompare(b.dataISO + b.horaInicio));

  return res.json({ agendamentos: list });
});

/**
 * POST /api/agendamentos
 * Create an appointment with atomic collision detection
 */
router.post('/', optionalAuth, (req, res) => {
  try {
    const {
      clienteNome,
      clienteTelefone,
      barbeiroId,
      servicoId,
      dataISO,
      horaInicio,
      canalOrigem = 'WEB_AUTONOMO',
      pagamentoForma = 'A combinar'
    } = req.body;

    const cleanNome = sanitizeString(clienteNome || (req.user ? req.user.name : ''));
    const cleanTelefone = sanitizeString(clienteTelefone || (req.user ? req.user.phone : ''));

    if (!cleanNome || !cleanTelefone) {
      return res.status(400).json({ error: 'Nome e telefone do cliente são obrigatórios.' });
    }

    if (!validateDateFormat(dataISO)) {
      return res.status(400).json({ error: 'Data inválida (formato esperado: YYYY-MM-DD).' });
    }

    if (!validateTimeFormat(horaInicio)) {
      return res.status(400).json({ error: 'Horário de início inválido (formato esperado: HH:MM).' });
    }

    const barbeiro = db.barbeiros.find(b => b.id === barbeiroId);
    if (!barbeiro) {
      return res.status(404).json({ error: 'Barbeiro selecionado não encontrado.' });
    }

    const servico = db.servicos.find(s => s.id === servicoId);
    if (!servico) {
      return res.status(404).json({ error: 'Serviço selecionado não encontrado.' });
    }

    const durationMin = servico.durationMin || 30;

    // 🔒 Real-time anti-conflict check
    const conflictCheck = checkScheduleConflict({
      barbeiroId,
      dataISO,
      horaInicio,
      durationMin
    });

    if (conflictCheck.hasConflict) {
      return res.status(409).json({
        error: conflictCheck.reason || 'O horário selecionado não está mais disponível.',
        hasConflict: true
      });
    }

    const horaFim = calculateEndTime(horaInicio, durationMin);
    const comissaoValor = Number(((servico.price * (barbeiro.comissaoPercentual || 50)) / 100).toFixed(2));

    const newAgendamento = {
      id: 'ag_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      clienteId: req.user ? req.user.id : ('cli_' + Date.now()),
      clienteNome: cleanNome,
      clienteTelefone: cleanTelefone,
      barbeiroId: barbeiro.id,
      barbeiroNome: barbeiro.name,
      servicoId: servico.id,
      servicoNome: servico.name,
      valor: servico.price,
      dataISO,
      horaInicio,
      horaFim,
      status: 'CONFIRMADO',
      canalOrigem,
      pagamentoForma,
      comissaoBarbeiro: comissaoValor,
      lembreteEnviado: false,
      bloqueado: false,
      createdAt: new Date().toISOString()
    };

    db.agendamentos.push(newAgendamento);

    // Auto-create client record if missing
    const existingCliente = db.clientes.find(c => c.phone === cleanTelefone);
    if (!existingCliente) {
      db.clientes.push({
        id: 'cli_' + Date.now(),
        userId: req.user ? req.user.id : null,
        name: cleanNome,
        phone: cleanTelefone,
        type: 'cliente',
        value: 0,
        payDay: null,
        status: 'ativo',
        createdAt: new Date().toISOString()
      });
    }

    // Trigger WhatsApp confirmation notice
    try {
      sendAutomatedWhatsAppReminder({
        agendamentoId: newAgendamento.id,
        tipo: 'CONFIRMACAO'
      });
    } catch { }

    return res.status(201).json({
      message: 'Agendamento confirmado com sucesso!',
      agendamento: newAgendamento
    });
  } catch (err) {
    console.error('[agendamentos:create]', err);
    return res.status(500).json({ error: 'Erro ao criar agendamento.' });
  }
});

/**
 * PATCH /api/agendamentos/:id/status
 * Update appointment status (CONFIRMADO, CONCLUIDO, CANCELADO, NAO_COMPARECEU)
 */
router.patch('/:id/status', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { status, pagamentoForma } = req.body;

  const validStatuses = ['PENDENTE', 'CONFIRMADO', 'CONCLUIDO', 'CANCELADO', 'NAO_COMPARECEU'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Status de agendamento inválido.' });
  }

  const apt = db.agendamentos.find(a => a.id === id);
  if (!apt) {
    return res.status(404).json({ error: 'Agendamento não encontrado.' });
  }

  // Security check: Clients can only cancel their own appointment
  if (req.user.role === 'CLIENTE') {
    if (apt.clienteTelefone !== req.user.phone && apt.clienteId !== req.user.id) {
      return res.status(403).json({ error: 'Você não tem permissão para alterar este agendamento.' });
    }
    if (status !== 'CANCELADO') {
      return res.status(403).json({ error: 'Clientes só podem cancelar agendamentos.' });
    }
  }

  apt.status = status;
  if (pagamentoForma) apt.pagamentoForma = pagamentoForma;

  // If marked as CONCLUIDO, automatically record in finance ledger if not exists
  if (status === 'CONCLUIDO') {
    const existingPayment = db.pagamentos.find(p => p.agendamentoId === apt.id);
    if (!existingPayment) {
      const barbeiro = db.barbeiros.find(b => b.id === apt.barbeiroId);
      const comissao = barbeiro ? Number(((apt.valor * (barbeiro.comissaoPercentual || 50)) / 100).toFixed(2)) : 0;

      db.pagamentos.unshift({
        id: 'pay_' + Date.now(),
        agendamentoId: apt.id,
        clientId: apt.clienteId,
        clientName: apt.clienteNome,
        barbeiroId: apt.barbeiroId,
        barbeiroNome: apt.barbeiroNome,
        value: apt.valor,
        comissao,
        method: apt.pagamentoForma || 'PIX',
        date: new Date().toISOString(),
        status: 'PAGO'
      });
    }
  }

  return res.json({ message: 'Status atualizado com sucesso!', agendamento: apt });
});

/**
 * DELETE /api/agendamentos/:id
 * Delete or cancel appointment
 */
router.delete('/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const idx = db.agendamentos.findIndex(a => a.id === id);

  if (idx === -1) {
    return res.status(404).json({ error: 'Agendamento não encontrado.' });
  }

  const apt = db.agendamentos[idx];

  if (req.user.role === 'CLIENTE' && apt.clienteTelefone !== req.user.phone && apt.clienteId !== req.user.id) {
    return res.status(403).json({ error: 'Acesso negado.' });
  }

  db.agendamentos.splice(idx, 1);
  return res.json({ message: 'Agendamento removido com sucesso.' });
});

export default router;
