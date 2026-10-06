import bcrypt from 'bcryptjs';

// Initial Seed Data with hashed passwords
const salt = bcrypt.genSaltSync(10);

export const db = {
  users: [
    {
      id: "usr_admin_owner",
      name: "Ruben Massuquetto (Admin)",
      email: "rubenmassuquetto1999@gmail.com",
      phone: "(11) 99999-8888",
      passwordHash: bcrypt.hashSync("admin123", salt),
      role: "ADMIN",
      emailVerified: true,
      phoneVerified: true,
      createdAt: new Date("2025-01-01T08:00:00Z").toISOString(),
      lgpdConsentAt: new Date("2025-01-01T08:00:00Z").toISOString()
    },
    {
      id: "usr_admin_1",
      name: "Rodrigo Almeida (Dono)",
      email: "admin@barbearia.com",
      phone: "(11) 99999-8888",
      passwordHash: bcrypt.hashSync("admin123", salt),
      role: "ADMIN",
      emailVerified: true,
      phoneVerified: true,
      createdAt: new Date("2025-01-01T08:00:00Z").toISOString(),
      lgpdConsentAt: new Date("2025-01-01T08:00:00Z").toISOString()
    },
    {
      id: "usr_sec_1",
      name: "Mariana Costa (Secretária)",
      email: "secretaria@barbearia.com",
      phone: "(11) 98888-2222",
      passwordHash: bcrypt.hashSync("sec123", salt),
      role: "SECRETARIA",
      emailVerified: true,
      phoneVerified: true,
      createdAt: new Date("2025-01-05T09:00:00Z").toISOString(),
      lgpdConsentAt: new Date("2025-01-05T09:00:00Z").toISOString()
    },
    {
      id: "usr_barb_1",
      name: "Rodrigo Barbeiro",
      email: "rodrigo@barbearia.com",
      phone: "(11) 99999-8888",
      passwordHash: bcrypt.hashSync("barbeiro123", salt),
      role: "BARBEIRO",
      emailVerified: true,
      phoneVerified: true,
      createdAt: new Date("2025-01-01T08:00:00Z").toISOString(),
      lgpdConsentAt: new Date("2025-01-01T08:00:00Z").toISOString()
    },
    {
      id: "usr_barb_2",
      name: "Melqui Barbeiro",
      email: "melqui@barbearia.com",
      phone: "(11) 99999-7777",
      passwordHash: bcrypt.hashSync("barbeiro123", salt),
      role: "BARBEIRO",
      emailVerified: true,
      phoneVerified: true,
      createdAt: new Date("2025-01-02T08:00:00Z").toISOString(),
      lgpdConsentAt: new Date("2025-01-02T08:00:00Z").toISOString()
    },
    {
      id: "usr_cli_1",
      name: "Carlos Eduardo Silva",
      email: "carlos@cliente.com",
      phone: "(11) 98877-6655",
      passwordHash: bcrypt.hashSync("cliente123", salt),
      role: "CLIENTE",
      emailVerified: true,
      phoneVerified: true,
      createdAt: new Date("2025-01-10T10:00:00Z").toISOString(),
      lgpdConsentAt: new Date("2025-01-10T10:00:00Z").toISOString()
    }
  ],

  barbeiros: [
    {
      id: "barb_1",
      userId: "usr_barb_1",
      name: "Rodrigo",
      phone: "5511999998888",
      specialty: "Corte Degradê, Barba Terapia, Alisamento Prime",
      comissaoPercentual: 50, // 50% de comissão
      avatar: "./Barbearia_files/barbeiro1.png",
      active: true,
      escala: {
        inicio: "09:00",
        fim: "19:00",
        diasSemana: [1, 2, 3, 4, 5, 6] // Seg a Sáb
      }
    },
    {
      id: "barb_2",
      userId: "usr_barb_2",
      name: "Melqui",
      phone: "5511999997777",
      specialty: "Navalhado, Luzes, Barba e Pigmentação",
      comissaoPercentual: 45, // 45% de comissão
      avatar: "./Barbearia_files/barbeiro2.png",
      active: true,
      escala: {
        inicio: "09:00",
        fim: "18:00",
        diasSemana: [1, 2, 3, 4, 5, 6]
      }
    }
  ],

  servicos: [
    { id: "svc_1", name: "Acabamento / Pezinho", category: "Corte", price: 20.00, durationMin: 20, active: true },
    { id: "svc_2", name: "Barba Completa", category: "Barba", price: 40.00, durationMin: 30, active: true },
    { id: "svc_3", name: "Corte Máquina e Tesoura", category: "Corte", price: 40.00, durationMin: 40, active: true },
    { id: "svc_4", name: "Corte Tesoura", category: "Corte", price: 50.00, durationMin: 45, active: true },
    { id: "svc_5", name: "Corte Infantil", category: "Corte", price: 50.00, durationMin: 40, active: true },
    { id: "svc_6", name: "Sobrancelha Navalhada", category: "Estética", price: 25.00, durationMin: 15, active: true },
    { id: "svc_7", name: "Alisamento Americano", category: "Química", price: 50.00, durationMin: 45, active: true },
    { id: "svc_8", name: "Luzes / Platinado", category: "Química", price: 100.00, durationMin: 60, active: true },
    { id: "svc_9", name: "Corte + Botox Prime", category: "Combo", price: 105.00, durationMin: 60, active: true },
    { id: "svc_10", name: "Corte + Barba + Alisamento Prime", category: "Combo", price: 150.00, durationMin: 90, active: true },
    { id: "svc_11", name: "Corte Sensorial (Adaptado)", category: "Especial", price: 50.00, durationMin: 45, active: true }
  ],

  clientes: [
    {
      id: "cli_1",
      userId: "usr_cli_1",
      name: "Carlos Eduardo Silva",
      phone: "(81) 98877-6655",
      type: "plano_jc",
      value: 120.00,
      payDay: 10,
      status: "ativo",
      createdAt: new Date("2025-01-10T10:00:00Z").toISOString()
    },
    {
      id: "cli_2",
      userId: null,
      name: "Lucas Ferreira",
      phone: "(81) 99123-4567",
      type: "cliente",
      value: 0,
      payDay: null,
      status: "ativo",
      createdAt: new Date("2025-01-15T14:30:00Z").toISOString()
    },
    {
      id: "cli_3",
      userId: null,
      name: "Gabriel Henrique",
      phone: "(81) 99456-7890",
      type: "plano_jc",
      value: 150.00,
      payDay: 5,
      status: "ativo",
      createdAt: new Date("2025-01-18T16:00:00Z").toISOString()
    }
  ],

  agendamentos: [
    {
      id: "ag_20261005_1000_rodrigo",
      clienteId: "cli_1",
      clienteNome: "Carlos Eduardo Silva",
      clienteTelefone: "(81) 98877-6655",
      barbeiroId: "barb_1",
      barbeiroNome: "Rodrigo",
      servicoId: "svc_3",
      servicoNome: "Corte Máquina e Tesoura",
      valor: 40.00,
      dataISO: "2026-10-05",
      horaInicio: "10:00",
      horaFim: "10:40",
      status: "CONCLUIDO",
      canalOrigem: "WEB_AUTONOMO",
      pagamentoForma: "PIX",
      comissaoBarbeiro: 20.00,
      lembreteEnviado: true,
      bloqueado: false,
      createdAt: new Date("2026-10-04T12:00:00Z").toISOString()
    },
    {
      id: "ag_20261005_1400_rodrigo",
      clienteId: "cli_2",
      clienteNome: "Lucas Ferreira",
      clienteTelefone: "(81) 99123-4567",
      barbeiroId: "barb_1",
      barbeiroNome: "Rodrigo",
      servicoId: "svc_10",
      servicoNome: "Corte + Barba + Alisamento Prime",
      valor: 150.00,
      dataISO: "2026-10-05",
      horaInicio: "14:00",
      horaFim: "15:30",
      status: "CONFIRMADO",
      canalOrigem: "WHATSAPP_MANUAL",
      pagamentoForma: "Cartão de Crédito",
      comissaoBarbeiro: 75.00,
      lembreteEnviado: true,
      bloqueado: false,
      createdAt: new Date("2026-10-04T15:00:00Z").toISOString()
    },
    {
      id: "ag_20261005_1600_melqui",
      clienteId: "cli_3",
      clienteNome: "Gabriel Henrique",
      clienteTelefone: "(81) 99456-7890",
      barbeiroId: "barb_2",
      barbeiroNome: "Melqui",
      servicoId: "svc_8",
      servicoNome: "Luzes / Platinado",
      valor: 100.00,
      dataISO: "2026-10-05",
      horaInicio: "16:00",
      horaFim: "17:00",
      status: "CONFIRMADO",
      canalOrigem: "WEB_AUTONOMO",
      pagamentoForma: "PIX",
      comissaoBarbeiro: 45.00,
      lembreteEnviado: true,
      bloqueado: false,
      createdAt: new Date("2026-10-05T09:00:00Z").toISOString()
    }
  ],

  pagamentos: [
    {
      id: "pay_1",
      agendamentoId: "ag_20261005_1000_rodrigo",
      clientId: "cli_1",
      clientName: "Carlos Eduardo Silva",
      barbeiroId: "barb_1",
      barbeiroNome: "Rodrigo",
      value: 120.00,
      comissao: 60.00,
      method: "PIX",
      date: new Date("2026-10-05T10:45:00Z").toISOString(),
      status: "PAGO"
    },
    {
      id: "pay_2",
      agendamentoId: null,
      clientId: "cli_3",
      clientName: "Gabriel Henrique",
      barbeiroId: "barb_2",
      barbeiroNome: "Melqui",
      value: 150.00,
      comissao: 67.50,
      method: "Cartão de Crédito",
      date: new Date("2026-10-03T16:20:00Z").toISOString(),
      status: "PAGO"
    }
  ],

  automacoes: [
    {
      id: "aut_1",
      agendamentoId: "ag_20261005_1400_rodrigo",
      clienteNome: "Lucas Ferreira",
      telefone: "(81) 99123-4567",
      mensagem: "Olá Lucas! Seu horário na Barbearia está confirmado para hoje às 14:00 com o barbeiro Rodrigo.",
      tipo: "LEMBRETE_2H",
      status: "ENVIADO",
      disparadoEm: new Date().toISOString()
    }
  ],

  lgpdSolicitacoes: []
};
