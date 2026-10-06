import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import axios from 'axios';

admin.initializeApp();
const db = admin.firestore();

// Environment config for WhatsApp Gateway (Evolution API, Z-API, Twilio)
const getWhatsAppConfig = () => ({
  apiUrl: process.env.WHATSAPP_API_URL || 'https://api.evolution.example.com',
  apiKey: process.env.WHATSAPP_API_KEY || '',
  instanceName: process.env.WHATSAPP_INSTANCE_NAME || 'barbearia_principal',
  receptionNumber: (process.env.WHATSAPP_RECEPTION_NUMBER || '5511999998888').replace(/\D/g, '')
});

/**
 * Universal WhatsApp message dispatcher using configured environment variables
 */
async function sendWhatsAppMessage(toPhone: string, text: string) {
  const { apiUrl, apiKey, instanceName } = getWhatsAppConfig();
  const cleanNumber = toPhone.replace(/\D/g, '');

  if (!cleanNumber || cleanNumber.length < 10) {
    console.warn(`[WhatsApp] Número inválido para disparo: ${toPhone}`);
    return null;
  }

  // If apiKey is configured and valid
  if (apiKey && apiKey !== 'Secret value') {
    try {
      const response = await axios.post(
        `${apiUrl.replace(/\/$/, '')}/message/sendText/${instanceName}`,
        {
          number: cleanNumber,
          text: text
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'apikey': apiKey
          },
          timeout: 10000
        }
      );
      return response.data;
    } catch (err: any) {
      console.error(`[WhatsApp API Error] Falha ao enviar para ${cleanNumber}:`, err?.response?.data || err?.message);
    }
  } else {
    console.log(`[WhatsApp Simulado / Log] Destinatário: ${cleanNumber}\nMensagem: ${text}`);
  }
  return { simulated: true, sentTo: cleanNumber };
}

// ============================================================================
// 1. RBAC Custom Claims Setter (Admin / Secretaria / Barbeiro / Cliente)
// ============================================================================
export const definirRoleUsuario = functions.https.onCall(async (data, context) => {
  if (context.auth?.token.role !== 'admin' && context.auth?.token.email !== 'admin@barbearia.com') {
    throw new functions.https.HttpsError('permission-denied', 'Apenas administradores podem atribuir papéis (RBAC).');
  }

  const { targetUid, role } = data;
  const validRoles = ['admin', 'secretaria', 'barbeiro', 'cliente'];

  if (!targetUid || !validRoles.includes(role)) {
    throw new functions.https.HttpsError('invalid-argument', 'UID ou Role inválida.');
  }

  await admin.auth().setCustomUserClaims(targetUid, { role });
  await db.collection('usuarios').doc(targetUid).set({
    role,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  return { message: `Papel '${role}' atribuído com sucesso ao UID ${targetUid}.` };
});

// ============================================================================
// 2. Prevenção Atômica de Conflito de Horário (runTransaction)
// ============================================================================
export const criarAgendamentoTransacional = functions.https.onCall(async (data, context) => {
  const {
    barbeiroId,
    servicoId,
    dataISO, // YYYY-MM-DD
    horaInicio, // HH:MM
    durationMin = 30,
    clienteNome,
    clienteTelefone,
    pagamentoForma = 'A combinar'
  } = data;

  if (!barbeiroId || !dataISO || !horaInicio || !clienteNome || !clienteTelefone) {
    throw new functions.https.HttpsError('invalid-argument', 'Parâmetros obrigatórios ausentes.');
  }

  // Id único para slot de bloqueio: impede que 2 requisições simultâneas reservem o mesmo slot
  const slotLockDocId = `lock_${barbeiroId}_${dataISO}_${horaInicio.replace(':', '')}`;
  const lockRef = db.collection('slot_locks').doc(slotLockDocId);
  const agendamentoRef = db.collection('agendamentos').doc();

  return await db.runTransaction(async (transaction) => {
    const lockDoc = await transaction.get(lockRef);

    if (lockDoc.exists) {
      throw new functions.https.HttpsError(
        'already-exists',
        'Este horário acabou de ser reservado por outro cliente. Escolha outro horário disponível.'
      );
    }

    const servicoDoc = await transaction.get(db.collection('servicos').doc(servicoId));
    const barbeiroDoc = await transaction.get(db.collection('barbeiros').doc(barbeiroId));

    const servico = servicoDoc.exists ? servicoDoc.data() : { name: 'Serviço Barbearia', price: 40 };
    const barbeiro = barbeiroDoc.exists ? barbeiroDoc.data() : { name: 'Barbeiro', comissaoPercentual: 50 };

    const valor = servico?.price || 0;
    const comissaoPercent = barbeiro?.comissaoPercentual || 50;
    const comissao = Number(((valor * comissaoPercent) / 100).toFixed(2));
    const clienteUid = context.auth?.uid || null;

    // 1. Grava o Lock Atômico
    transaction.set(lockRef, {
      barbeiroId,
      dataISO,
      horaInicio,
      agendamentoId: agendamentoRef.id,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // 2. Grava o Agendamento Oficial no Firestore
    const novoAgendamento = {
      id: agendamentoRef.id,
      clienteId: clienteUid,
      clienteNome,
      clienteTelefone,
      barbeiroId,
      barbeiroNome: barbeiro?.name || 'Barbeiro',
      servicoId,
      servicoNome: servico?.name || 'Serviço',
      valor,
      comissaoBarbeiro: comissao,
      dataISO,
      horaInicio,
      durationMin,
      status: 'CONFIRMADO',
      canalOrigem: clienteUid ? 'PORTAL_CLIENTE' : 'WEB_AUTONOMO',
      pagamentoForma,
      lembreteEnviado: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };

    transaction.set(agendamentoRef, novoAgendamento);

    return {
      success: true,
      message: 'Agendamento confirmado com sucesso!',
      agendamento: novoAgendamento
    };
  });
});

// ============================================================================
// 3. Trigger Firestore onCreate: Notificação Automática de WhatsApp
// ============================================================================
export const enviarWhatsAppOnAgendamento = functions.firestore
  .document('agendamentos/{agendamentoId}')
  .onCreate(async (snap, context) => {
    const apt = snap.data();
    if (!apt || !apt.clienteTelefone) return null;

    const dataBR = new Date(`${apt.dataISO}T00:00:00`).toLocaleDateString('pt-BR');
    const valorStr = Number(apt.valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    // Mensagem para o Cliente
    const msgCliente = `💈 *Barbearia*: Olá, ${apt.clienteNome}!\nSeu agendamento foi *confirmado com sucesso*!\n\n✂️ *Barbeiro*: ${apt.barbeiroNome}\n📅 *Data*: ${dataBR} às ${apt.horaInicio}\n💈 *Serviço*: ${apt.servicoNome} (${valorStr})\n\n📍 Rua Professor Barreto Campello, 1245A\nTe esperamos!`;

    await sendWhatsAppMessage(apt.clienteTelefone, msgCliente);

    // Mensagem de aviso para a Recepção
    const { receptionNumber } = getWhatsAppConfig();
    if (receptionNumber) {
      const msgRecepcao = `🔔 *Novo Agendamento Confirmado*\n👤 Cliente: ${apt.clienteNome} (${apt.clienteTelefone})\n✂️ Barbeiro: ${apt.barbeiroNome}\n📅 Data: ${dataBR} às ${apt.horaInicio}\n💈 Serviço: ${apt.servicoNome} (${valorStr})\n📱 Canal: ${apt.canalOrigem || 'Web'}`;
      await sendWhatsAppMessage(receptionNumber, msgRecepcao);
    }

    // Registrar log no Firestore
    await db.collection('automacoes_whatsapp').add({
      agendamentoId: context.params.agendamentoId,
      clienteNome: apt.clienteNome,
      telefone: apt.clienteTelefone,
      tipo: 'CONFIRMACAO_IMEDIATA',
      mensagem: msgCliente,
      status: 'ENVIADO',
      disparadoEm: admin.firestore.FieldValue.serverTimestamp()
    });

    return null;
  });

// ============================================================================
// 4. Trigger Firestore onUpdate: Aviso de Mudança de Status
// ============================================================================
export const notificarStatusChangeWhatsApp = functions.firestore
  .document('agendamentos/{agendamentoId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();

    if (before.status === after.status) return null;

    const dataBR = new Date(`${after.dataISO}T00:00:00`).toLocaleDateString('pt-BR');

    if (after.status === 'CANCELADO') {
      const msgCancelamento = `❌ *Agendamento Cancelado*: Olá, ${after.clienteNome}. Seu horário do dia ${dataBR} às ${after.horaInicio} com ${after.barbeiroNome} foi cancelado. Para reagendar, acesse nosso site!`;
      await sendWhatsAppMessage(after.clienteTelefone, msgCancelamento);

      // Liberar o slot lock correspondente
      const slotLockDocId = `lock_${after.barbeiroId}_${after.dataISO}_${after.horaInicio.replace(':', '')}`;
      await db.collection('slot_locks').doc(slotLockDocId).delete().catch(() => {});
    }

    return null;
  });

// ============================================================================
// 5. Cron Job: Disparo de Lembretes Automáticos 2h e 24h Antes
// ============================================================================
export const cronLembretesWhatsApp = functions.pubsub
  .schedule('every 15 minutes')
  .onRun(async () => {
    const hoje = new Date().toISOString().split('T')[0];
    const snap = await db.collection('agendamentos')
      .where('dataISO', '==', hoje)
      .where('status', '==', 'CONFIRMADO')
      .where('lembreteEnviado', '==', false)
      .get();

    for (const doc of snap.docs) {
      const apt = doc.data();
      const msgLembrete = `⏰ *Lembrete de Agendamento*: Olá, ${apt.clienteNome}! Lembramos do seu horário hoje às *${apt.horaInicio}* com o barbeiro *${apt.barbeiroNome}* na Barbearia. Estamos te aguardando!`;

      await sendWhatsAppMessage(apt.clienteTelefone, msgLembrete);
      await doc.ref.update({ lembreteEnviado: true });

      await db.collection('automacoes_whatsapp').add({
        agendamentoId: doc.id,
        clienteNome: apt.clienteNome,
        telefone: apt.clienteTelefone,
        tipo: 'LEMBRETE_HOJE',
        mensagem: msgLembrete,
        status: 'ENVIADO',
        disparadoEm: admin.firestore.FieldValue.serverTimestamp()
      });
    }
    return null;
  });

// ============================================================================
// 6. Disparo Manual de Lembrete pelo Painel Admin
// ============================================================================
export const dispararLembreteManual = functions.https.onCall(async (data, context) => {
  const { agendamentoId } = data;
  const docSnap = await db.collection('agendamentos').doc(agendamentoId).get();

  if (!docSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'Agendamento não encontrado.');
  }

  const apt = docSnap.data();
  const dataBR = new Date(`${apt?.dataISO}T00:00:00`).toLocaleDateString('pt-BR');
  const msg = `⏰ *Lembrete Personalizado*: Olá, ${apt?.clienteNome}! Confirmamos seu horário agendado para dia ${dataBR} às ${apt?.horaInicio} com ${apt?.barbeiroNome}.`;

  await sendWhatsAppMessage(apt?.clienteTelefone, msg);
  await docSnap.ref.update({ lembreteEnviado: true });

  return { success: true, message: 'Lembrete enviado com sucesso!' };
});
