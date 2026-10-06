import express from 'express';
import { db } from '../db/database.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { sanitizeString } from '../utils/sanitize.js';

const router = express.Router();

/**
 * GET /api/financeiro/resumo
 * Returns comprehensive financial analytics: cashflow, gross, net, barber commissions, and payment methods
 */
router.get('/resumo', authenticateToken, requireRole(['ADMIN', 'SECRETARIA']), (req, res) => {
  const { de, ate } = req.query;

  let filteredPayments = [...db.pagamentos];

  if (de) {
    filteredPayments = filteredPayments.filter(p => new Date(p.date) >= new Date(`${de}T00:00:00`));
  }
  if (ate) {
    filteredPayments = filteredPayments.filter(p => new Date(p.date) <= new Date(`${ate}T23:59:59`));
  }

  const faturamentoBruto = filteredPayments.reduce((acc, p) => acc + (Number(p.value) || 0), 0);
  const totalComissoes = filteredPayments.reduce((acc, p) => acc + (Number(p.comissao) || 0), 0);
  const faturamentoLiquido = faturamentoBruto - totalComissoes;
  const totalAtendimentos = filteredPayments.length;
  const ticketMedio = totalAtendimentos > 0 ? faturamentoBruto / totalAtendimentos : 0;

  // Breakdown by Barber
  const comissoesPorBarbeiro = {};
  db.barbeiros.forEach(b => {
    comissoesPorBarbeiro[b.name] = {
      barbeiroId: b.id,
      barbeiroNome: b.name,
      totalAtendimentos: 0,
      totalGerado: 0,
      totalComissao: 0
    };
  });

  filteredPayments.forEach(p => {
    const nome = p.barbeiroNome || 'Outro';
    if (!comissoesPorBarbeiro[nome]) {
      comissoesPorBarbeiro[nome] = {
        barbeiroId: p.barbeiroId || 'other',
        barbeiroNome: nome,
        totalAtendimentos: 0,
        totalGerado: 0,
        totalComissao: 0
      };
    }
    comissoesPorBarbeiro[nome].totalAtendimentos += 1;
    comissoesPorBarbeiro[nome].totalGerado += Number(p.value) || 0;
    comissoesPorBarbeiro[nome].totalComissao += Number(p.comissao) || 0;
  });

  // Breakdown by Payment Method
  const porFormaPagamento = {};
  filteredPayments.forEach(p => {
    const m = p.method || 'Outro';
    porFormaPagamento[m] = (porFormaPagamento[m] || 0) + (Number(p.value) || 0);
  });

  return res.json({
    faturamentoBruto,
    totalComissoes,
    faturamentoLiquido,
    totalAtendimentos,
    ticketMedio,
    comissoesPorBarbeiro: Object.values(comissoesPorBarbeiro),
    porFormaPagamento,
    pagamentos: filteredPayments
  });
});

/**
 * POST /api/financeiro/pagamentos
 * Record a payment manually
 */
router.post('/pagamentos', authenticateToken, requireRole(['ADMIN', 'SECRETARIA']), (req, res) => {
  const { clientId, clientName, barbeiroId, value, method } = req.body;

  const barbeiro = db.barbeiros.find(b => b.id === barbeiroId) || db.barbeiros[0];
  const valorNum = Number(value) || 0;
  const comissaoNum = barbeiro ? Number(((valorNum * (barbeiro.comissaoPercentual || 50)) / 100).toFixed(2)) : 0;

  const newPayment = {
    id: 'pay_' + Date.now(),
    agendamentoId: null,
    clientId: clientId || null,
    clientName: sanitizeString(clientName || 'Cliente Avulso'),
    barbeiroId: barbeiro?.id || null,
    barbeiroNome: barbeiro?.name || 'Barbeiro',
    value: valorNum,
    comissao: comissaoNum,
    method: sanitizeString(method || 'PIX'),
    date: new Date().toISOString(),
    status: 'PAGO'
  };

  db.pagamentos.unshift(newPayment);
  return res.status(201).json({ message: 'Pagamento registrado com sucesso!', pagamento: newPayment });
});

/**
 * DELETE /api/financeiro/pagamentos/:id
 */
router.delete('/pagamentos/:id', authenticateToken, requireRole(['ADMIN']), (req, res) => {
  const { id } = req.params;
  const idx = db.pagamentos.findIndex(p => p.id === id);

  if (idx === -1) {
    return res.status(404).json({ error: 'Pagamento não encontrado.' });
  }

  db.pagamentos.splice(idx, 1);
  return res.json({ message: 'Pagamento excluído com sucesso.' });
});

export default router;
