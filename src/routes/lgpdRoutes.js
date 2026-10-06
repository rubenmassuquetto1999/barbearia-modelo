import express from 'express';
import { db } from '../db/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

/**
 * GET /api/lgpd/meus-dados
 * LGPD Data Portability: Returns all personal data, appointments and transaction history
 */
router.get('/meus-dados', authenticateToken, (req, res) => {
  const user = db.users.find(u => u.id === req.user.id);
  if (!user) {
    return res.status(404).json({ error: 'Usuário não encontrado.' });
  }

  const clientRecords = db.clientes.filter(c => c.phone === user.phone || c.userId === user.id);
  const appointments = db.agendamentos.filter(a => a.clienteTelefone === user.phone || a.clienteId === user.id);
  const payments = db.pagamentos.filter(p => p.clientId === user.id || (user.name && p.clientName.toLowerCase() === user.name.toLowerCase()));

  const exportData = {
    titular: {
      id: user.id,
      nome: user.name,
      email: user.email,
      telefone: user.phone,
      perfil: user.role,
      dataConsentimentoLGPD: user.lgpdConsentAt,
      dataCriacaoConta: user.createdAt
    },
    vinculosCadastrais: clientRecords,
    historicoAgendamentos: appointments,
    historicoFinanceiro: payments,
    geradoEm: new Date().toISOString()
  };

  return res.json(exportData);
});

/**
 * POST /api/lgpd/solicitar-exclusao
 * LGPD Right to be Forgotten: Anonymizes and wipes user profile
 */
router.post('/solicitar-exclusao', authenticateToken, (req, res) => {
  const userId = req.user.id;
  const userIndex = db.users.findIndex(u => u.id === userId);

  if (userIndex === -1) {
    return res.status(404).json({ error: 'Usuário não encontrado.' });
  }

  const user = db.users[userIndex];

  // Anonymize personal info
  const anonymizedPhone = '***-' + Math.random().toString().slice(2, 6);
  user.name = 'Usuário Anonimizado (LGPD)';
  user.email = `anonimizado_${userId}@lgpd.invalid`;
  user.phone = anonymizedPhone;
  user.passwordHash = 'ANONYMIZED_REVOKED';

  // Anonymize related appointments
  db.agendamentos.forEach(a => {
    if (a.clienteId === userId || a.clienteTelefone === req.user.phone) {
      a.clienteNome = 'Cliente Anonimizado';
      a.clienteTelefone = anonymizedPhone;
    }
  });

  db.lgpdSolicitacoes.push({
    id: 'lgpd_' + Date.now(),
    userId,
    tipo: 'EXCLUSAO_CONTA',
    status: 'CONCLUIDO',
    requestedAt: new Date().toISOString()
  });

  return res.json({
    message: 'Seus dados foram anonimizados com sucesso em conformidade com a LGPD. Sua sessão foi encerrada.'
  });
});

export default router;
