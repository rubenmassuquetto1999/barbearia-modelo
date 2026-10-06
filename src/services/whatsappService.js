import { db } from '../db/database.js';

/**
 * Formats a direct WhatsApp link for Quick Booking (Caminho A)
 */
export function formatWhatsAppBookingUrl({
  phone = process.env.WHATSAPP_RECEPTION_NUMBER || '5511999998888',
  clienteNome,
  barbeiroNome,
  servicoNome,
  servicoPreco,
  dataBR,
  hora,
  produtos = [],
  raclubStatus = 'nao'
}) {
  const precoStr = Number(servicoPreco || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const servicoTxt = servicoNome ? `💈 *Serviço*: ${servicoNome} (${precoStr})` : '';

  let produtosTxt = '';
  if (produtos && produtos.length > 0) {
    const list = produtos.map(p => `${p.nome} (R$ ${Number(p.preco || 0).toFixed(2)})`).join(', ');
    const total = produtos.reduce((s, p) => s + Number(p.preco || 0), 0);
    produtosTxt = `\n🧴 *Produtos*: ${list} | Total: R$ ${total.toFixed(2)}`;
  }

  let raclubTxt = '';
  if (raclubStatus === 'membro') raclubTxt = '\n👑 *RA Club*: Sou Membro Assinante';
  else if (raclubStatus === 'assinar') raclubTxt = '\n⭐ *RA Club*: Tenho interesse em assinar';

  const mensagem = `Olá! Gostaria de agendar um horário na Barbearia.
👤 *Cliente*: ${clienteNome || 'Cliente'}
✂️ *Barbeiro*: ${barbeiroNome || 'Qualquer Barbeiro'}
📅 *Data pretendida*: ${dataBR || 'A combinar'} às ${hora || 'Horário flexível'}
${servicoTxt}${produtosTxt}${raclubTxt}

Aguardo a confirmação da recepção!`;

  const cleanPhone = phone.replace(/\D/g, '');
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(mensagem)}`;
}

/**
 * Simulates / dispatches an automated reminder via WhatsApp API (Evolution API / Z-API / Twilio)
 */
export function sendAutomatedWhatsAppReminder({
  agendamentoId,
  tipo = 'LEMBRETE_2H'
}) {
  const apt = db.agendamentos.find(a => a.id === agendamentoId);
  if (!apt) {
    throw new Error('Agendamento não encontrado para envio de lembrete.');
  }

  const cleanPhone = (apt.clienteTelefone || '').replace(/\D/g, '');
  const dataBR = new Date(`${apt.dataISO}T00:00:00`).toLocaleDateString('pt-BR');

  let mensagem = '';
  if (tipo === 'CONFIRMACAO') {
    mensagem = `💈 *Barbearia*: Olá, ${apt.clienteNome}! Seu agendamento foi *confirmado com sucesso*!\n✂️ Barbeiro: ${apt.barbeiroNome}\n📅 Data: ${dataBR} às ${apt.horaInicio}\n💈 Serviço: ${apt.servicoNome}\nNos vemos em breve!`;
  } else if (tipo === 'LEMBRETE_24H') {
    mensagem = `⏰ *Lembrete de Agendamento*: Olá, ${apt.clienteNome}! Lembramos do seu horário amanhã, dia ${dataBR} às ${apt.horaInicio}, com ${apt.barbeiroNome}.`;
  } else {
    mensagem = `⏰ *Lembrete em breve*: Olá, ${apt.clienteNome}! Seu horário na Barbearia é hoje às ${apt.horaInicio} com ${apt.barbeiroNome}. Estamos te aguardando!`;
  }

  const autRegistro = {
    id: 'aut_' + Date.now(),
    agendamentoId: apt.id,
    clienteNome: apt.clienteNome,
    telefone: apt.clienteTelefone,
    mensagem,
    tipo,
    status: 'ENVIADO',
    disparadoEm: new Date().toISOString()
  };

  db.automacoes.unshift(autRegistro);
  apt.lembreteEnviado = true;

  return autRegistro;
}
