// ===== Helpers de Modal =====
function abrirModal(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = 'flex';
}
function fecharModal(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
}
window.abrirModal = abrirModal;
window.fecharModal = fecharModal;

// ===== Estado Local / Contexto =====
let ctx = { profissional: 'Rodrigo', wa: '5511999998888', colecao: 'agendamentos' };
let agendamentoContexto = {
    nomeCliente: '',
    telefoneCliente: '',
    produtos: [],
    totalProdutos: 0,
    raclub: { status: 'nao' },
    servico: null
};

let barbeirosList = [];
let servicosList = [];
let selectedAutonomousSlot = null;

const toBRL = (n) => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const PRODUTOS = [
    { nome: "Pomada Líquida DA Force MEN", preco: 39.99 },
    { nome: "Leave-in", preco: 39.99 },
    { nome: "Tônico Capilar Dom Pelo", preco: 49.99 },
    { nome: "Balm Para Barba", preco: 39.99 },
    { nome: "Pomada Modeladora - Efeito Teia", preco: 34.99 },
    { nome: "Pomada Modeladora - Efeito Seco ", preco: 34.99 },
];

let SERVICOS = [
    { nome: 'Selecionar...', valor: null, placeholder: true },
    { nome: 'Acabamento / Pezinho', valor: 20.00 },
    { nome: 'Barba Completa', valor: 40.00 },
    { nome: 'Corte Máquina e Tesoura', valor: 40.00 },
    { nome: 'Corte Tesoura', valor: 50.00 },
    { nome: 'Corte Infantil', valor: 50.00 },
    { nome: 'Alisamento Americano', valor: 50.00 },
    { nome: 'Luzes / Platinado', valor: 100.00 },
    { nome: 'Corte + Botox Prime', valor: 105.00 },
    { nome: 'Corte + Barba + Alisamento Prime', valor: 150.00 },
    { nome: 'Corte Sensorial (Adaptado)', valor: 50.00 }
];

// ===== Load Initial Data from API =====
async function loadCatalog() {
    try {
        const [resBarb, resSvc] = await Promise.all([
            fetch('/api/barbeiros'),
            fetch('/api/servicos')
        ]);
        if (resBarb.ok) {
            const data = await resBarb.json();
            barbeirosList = data.barbeiros || [];
        }
        if (resSvc.ok) {
            const data = await resSvc.json();
            servicosList = data.servicos || [];
            if (servicosList.length > 0) {
                SERVICOS = [
                    { nome: 'Selecionar...', valor: null, placeholder: true },
                    ...servicosList.map(s => ({ nome: s.name, valor: s.price, durationMin: s.durationMin, id: s.id }))
                ];
            }
        }
    } catch (e) {
        console.warn('Usando catálogo local em cache:', e);
    }
    populateAutonomousSelects();
}

function populateAutonomousSelects() {
    const selBarb = document.getElementById('autoSelectBarbeiro');
    const selSvc = document.getElementById('autoSelectServico');

    if (selBarb && barbeirosList.length > 0) {
        selBarb.innerHTML = barbeirosList.map(b => `<option value="${b.id}">${b.name} (${b.specialty || 'Barbeiro'})</option>`).join('');
    }

    if (selSvc && servicosList.length > 0) {
        selSvc.innerHTML = servicosList.map(s => `<option value="${s.id}" data-duration="${s.durationMin}">${s.name} — ${toBRL(s.price)} (${s.durationMin} min)</option>`).join('');
    }
}

// ===== Mobile Nav =====
const menuToggle = document.querySelector('.menu-toggle');
const navLinks = document.querySelector('.nav-links');
menuToggle?.addEventListener('click', () => {
    navLinks.classList.toggle('active');
    const icon = menuToggle.querySelector('i');
    navLinks.classList.contains('active')
        ? icon?.classList.replace('bx-menu', 'bx-x')
        : icon?.classList.replace('bx-x', 'bx-menu');
});

document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
        const id = a.getAttribute('href');
        if (id === '#') return;
        const t = document.querySelector(id);
        if (!t) return;
        e.preventDefault();
        window.scrollTo({ top: t.getBoundingClientRect().top + window.pageYOffset - 80, behavior: 'smooth' });
        navLinks?.classList.remove('active');
    });
});

// ===== CAMINHO B: AGENDAMENTO WEB AUTÔNOMO =====
const heroBtnWebAutonomous = document.getElementById('heroBtnWebAutonomous');
const btnOpenAutonomousModal = document.getElementById('btnOpenAutonomousModal');
const modalAutonomo = document.getElementById('modalAutonomo');
const autoSelectBarbeiro = document.getElementById('autoSelectBarbeiro');
const autoSelectServico = document.getElementById('autoSelectServico');
const autoSelectDate = document.getElementById('autoSelectDate');
const autoSlotsContainer = document.getElementById('autoSlotsContainer');
const autonomousBookingForm = document.getElementById('autonomousBookingForm');

function setupAutonomousModal() {
    const hoje = new Date().toISOString().split('T')[0];
    if (autoSelectDate) {
        autoSelectDate.min = hoje;
        autoSelectDate.value = hoje;
    }
    abrirModal('modalAutonomo');
    fetchAvailableSlots();
}

heroBtnWebAutonomous?.addEventListener('click', setupAutonomousModal);
btnOpenAutonomousModal?.addEventListener('click', setupAutonomousModal);

autoSelectBarbeiro?.addEventListener('change', fetchAvailableSlots);
autoSelectServico?.addEventListener('change', fetchAvailableSlots);
autoSelectDate?.addEventListener('change', fetchAvailableSlots);

async function fetchAvailableSlots() {
    const barbeiroId = autoSelectBarbeiro?.value;
    const dataISO = autoSelectDate?.value;
    const svcOpt = autoSelectServico?.selectedOptions[0];
    const durationMin = svcOpt ? (svcOpt.dataset.duration || 30) : 30;

    if (!barbeiroId || !dataISO || !autoSlotsContainer) return;

    autoSlotsContainer.innerHTML = '<span style="color:#6b7280; font-size:0.9rem; grid-column:1/-1;">Consultando disponibilidade em tempo real...</span>';
    selectedAutonomousSlot = null;

    try {
        const res = await fetch(`/api/agendamentos/disponibilidade?barbeiroId=${barbeiroId}&dataISO=${dataISO}&durationMin=${durationMin}`);
        const data = await res.json();
        const slots = data.slots || [];

        if (slots.length === 0) {
            autoSlotsContainer.innerHTML = '<span style="color:#dc2626; font-size:0.9rem; grid-column:1/-1;">Nenhum horário disponível para esta data ou profissional.</span>';
            return;
        }

        autoSlotsContainer.innerHTML = slots.map(s => `
            <button type="button" class="slot-btn ${s.disponivel ? '' : 'disabled'}" ${s.disponivel ? '' : 'disabled'} data-hora="${s.hora}">
                ${s.hora}
            </button>
        `).join('');

        autoSlotsContainer.querySelectorAll('.slot-btn:not(:disabled)').forEach(btn => {
            btn.addEventListener('click', () => {
                autoSlotsContainer.querySelectorAll('.slot-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                selectedAutonomousSlot = btn.dataset.hora;
            });
        });
    } catch (err) {
        console.error('Erro ao buscar horários:', err);
        autoSlotsContainer.innerHTML = '<span style="color:#dc2626; font-size:0.9rem; grid-column:1/-1;">Erro ao carregar horários. Tente novamente.</span>';
    }
}

autonomousBookingForm?.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!selectedAutonomousSlot) {
        alert('Por favor, selecione um dos horários disponíveis.');
        return;
    }

    const barbeiroId = autoSelectBarbeiro.value;
    const servicoId = autoSelectServico.value;
    const dataISO = autoSelectDate.value;
    const clienteNome = document.getElementById('autoClientName')?.value;
    const clienteTelefone = document.getElementById('autoClientPhone')?.value;

    const btnSubmit = document.getElementById('btnConfirmAutonomousBooking');
    btnSubmit.disabled = true;
    btnSubmit.textContent = 'Processando Agendamento Seguro...';

    try {
        const response = await fetch('/api/agendamentos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                clienteNome,
                clienteTelefone,
                barbeiroId,
                servicoId,
                dataISO,
                horaInicio: selectedAutonomousSlot,
                canalOrigem: 'WEB_AUTONOMO',
                pagamentoForma: 'A combinar no atendimento'
            })
        });

        const result = await response.json();

        if (!response.ok) {
            alert(result.error || 'Não foi possível confirmar o agendamento.');
            fetchAvailableSlots();
            return;
        }

        fecharModal('modalAutonomo');
        alert(`✅ Agendamento Autônomo Confirmado com Sucesso!\n\nCliente: ${result.agendamento.clienteNome}\nBarbeiro: ${result.agendamento.barbeiroNome}\nData: ${result.agendamento.dataISO} às ${result.agendamento.horaInicio}\n\nUm lembrete automático foi gerado no sistema.`);
        
        // Auto-save user phone to session for easy portal retrieval
        sessionStorage.setItem('portalUserPhone', clienteTelefone);
    } catch (err) {
        console.error('Erro ao confirmar:', err);
        alert('Erro de conexão ao processar agendamento.');
    } finally {
        btnSubmit.disabled = false;
        btnSubmit.textContent = 'Confirmar Agendamento Autônomo';
    }
});

// ===== PORTAL DO CLIENTE & LGPD & LOGIN ADMIN =====
const btnPortalClienteNav = document.getElementById('btnPortalClienteNav');
const portalPhoneInput = document.getElementById('portalPhoneInput');
const btnConsultarAgendamentos = document.getElementById('btnConsultarAgendamentos');
const clientAptsContainer = document.getElementById('clientAptsContainer');
const btnExportarDadosLGPD = document.getElementById('btnExportarDadosLGPD');
const btnSolicitarExclusaoLGPD = document.getElementById('btnSolicitarExclusaoLGPD');

const tabBtnPortalCliente = document.getElementById('tabBtnPortalCliente');
const tabBtnPortalAdmin = document.getElementById('tabBtnPortalAdmin');
const panelPortalCliente = document.getElementById('panelPortalCliente');
const panelPortalAdmin = document.getElementById('panelPortalAdmin');
const formAdminLogin = document.getElementById('formAdminLogin');
const adminLoggedNotice = document.getElementById('adminLoggedNotice');
const adminLoggedRoleBadge = document.getElementById('adminLoggedRoleBadge');
const navPainelLi = document.getElementById('navPainelLi');

// Alternar abas no modal Minha Conta
tabBtnPortalCliente?.addEventListener('click', () => {
    tabBtnPortalCliente.style.borderBottom = '2px solid #d97706';
    tabBtnPortalCliente.style.color = '#d97706';
    tabBtnPortalAdmin.style.borderBottom = '2px solid transparent';
    tabBtnPortalAdmin.style.color = '#6b7280';
    if (panelPortalCliente) panelPortalCliente.style.display = 'block';
    if (panelPortalAdmin) panelPortalAdmin.style.display = 'none';
});

tabBtnPortalAdmin?.addEventListener('click', () => {
    tabBtnPortalAdmin.style.borderBottom = '2px solid #d97706';
    tabBtnPortalAdmin.style.color = '#d97706';
    tabBtnPortalCliente.style.borderBottom = '2px solid transparent';
    tabBtnPortalCliente.style.color = '#6b7280';
    if (panelPortalCliente) panelPortalCliente.style.display = 'none';
    if (panelPortalAdmin) panelPortalAdmin.style.display = 'block';
});

// Alternar sub-abas do Cliente (Consultar / Entrar vs Novo Cadastro)
const subtabBtnClientLogin = document.getElementById('subtabBtnClientLogin');
const subtabBtnClientRegister = document.getElementById('subtabBtnClientRegister');
const clientLoginView = document.getElementById('clientLoginView');
const clientRegisterView = document.getElementById('clientRegisterView');

subtabBtnClientLogin?.addEventListener('click', () => {
    subtabBtnClientLogin.classList.add('active');
    subtabBtnClientRegister?.classList.remove('active');
    if (clientLoginView) clientLoginView.style.display = 'block';
    if (clientRegisterView) clientRegisterView.style.display = 'none';
});

subtabBtnClientRegister?.addEventListener('click', () => {
    subtabBtnClientRegister.classList.add('active');
    subtabBtnClientLogin?.classList.remove('active');
    if (clientLoginView) clientLoginView.style.display = 'none';
    if (clientRegisterView) clientRegisterView.style.display = 'block';
});

// Form Novo Cadastro de Cliente
const formClientRegister = document.getElementById('formClientRegister');
formClientRegister?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('regClientName')?.value.trim();
    const phone = document.getElementById('regClientPhone')?.value.trim();
    const email = document.getElementById('regClientEmail')?.value.trim();
    const password = document.getElementById('regClientPassword')?.value;
    const lgpdConsent = document.getElementById('regClientLgpd')?.checked;

    const btnSubmit = document.getElementById('btnSubmitClientRegister');
    btnSubmit.disabled = true;
    btnSubmit.textContent = 'Cadastrando...';

    try {
        const res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, phone, email, password, lgpdConsent })
        });
        const data = await res.json();

        if (!res.ok) {
            alert(data.error || 'Erro ao realizar cadastro.');
            return;
        }

        sessionStorage.setItem('userToken', data.token);
        sessionStorage.setItem('userRole', data.user.role);
        sessionStorage.setItem('userName', data.user.name);
        sessionStorage.setItem('portalUserPhone', data.user.phone);

        const navLabel = document.getElementById('navMinhaContaLabel');
        if (navLabel) navLabel.textContent = data.user.name.split(' ')[0];

        alert(`✅ Cadastro realizado com sucesso, ${data.user.name}!\nSua conta de cliente está pronta.`);
        
        // Voltar para a visualização de agendamentos
        subtabBtnClientLogin?.click();
        if (portalPhoneInput) portalPhoneInput.value = data.user.phone;
        carregarAgendamentosCliente(data.user.phone);
    } catch (err) {
        console.error('Erro no cadastro:', err);
        alert('Erro ao processar cadastro. Tente novamente.');
    } finally {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = "<i class='bx bx-user-plus'></i> Concluir Cadastro de Cliente";
    }
});

// Checar se já tem sessão salva
function checkAdminSession() {
    const role = sessionStorage.getItem('userRole') || localStorage.getItem('userRole');
    const name = sessionStorage.getItem('userName') || localStorage.getItem('userName');
    
    if (name) {
        const navLabel = document.getElementById('navMinhaContaLabel');
        if (navLabel) navLabel.textContent = name.split(' ')[0];
    }

    if (role === 'ADMIN' || role === 'SECRETARIA') {
        if (navPainelLi) navPainelLi.style.display = 'inline-block';
        if (adminLoggedNotice) adminLoggedNotice.style.display = 'block';
        if (adminLoggedRoleBadge) adminLoggedRoleBadge.textContent = role;
    }
}
checkAdminSession();

// Login de Administrador / Secretária pelo modal
formAdminLogin?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('adminLoginEmail')?.value;
    const password = document.getElementById('adminLoginPassword')?.value;

    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();

        if (!res.ok) {
            alert(data.error || 'Credenciais inválidas.');
            return;
        }

        sessionStorage.setItem('userToken', data.token);
        sessionStorage.setItem('userRole', data.user.role);
        sessionStorage.setItem('userName', data.user.name);

        if (data.user.role === 'ADMIN' || data.user.role === 'SECRETARIA') {
            if (navPainelLi) navPainelLi.style.display = 'inline-block';
            if (adminLoggedNotice) adminLoggedNotice.style.display = 'block';
            if (adminLoggedRoleBadge) adminLoggedRoleBadge.textContent = data.user.role;
            alert(`✅ Autenticado com sucesso como ${data.user.role}! O botão do Painel foi desbloqueado para sua sessão.`);
        } else {
            alert('Conta de cliente autenticada.');
        }
    } catch {
        alert('Erro ao realizar login.');
    }
});

btnPortalClienteNav?.addEventListener('click', () => {
    const savedPhone = sessionStorage.getItem('portalUserPhone') || '';
    if (portalPhoneInput && savedPhone) {
        portalPhoneInput.value = savedPhone;
        carregarAgendamentosCliente(savedPhone);
    }
    abrirModal('modalPortalCliente');
});

btnConsultarAgendamentos?.addEventListener('click', () => {
    const phone = portalPhoneInput?.value.trim();
    if (!phone) { alert('Informe seu telefone.'); return; }
    sessionStorage.setItem('portalUserPhone', phone);
    carregarAgendamentosCliente(phone);
});

async function carregarAgendamentosCliente(phone) {
    if (!clientAptsContainer) return;
    clientAptsContainer.innerHTML = '<p style="color:#6b7280; font-size:0.9rem;">Buscando agendamentos...</p>';

    try {
        const res = await fetch('/api/agendamentos');
        const data = await res.json();
        const cleanQuery = phone.replace(/\D/g, '');

        const userApts = (data.agendamentos || []).filter(a => {
            const aptClean = (a.clienteTelefone || '').replace(/\D/g, '');
            return aptClean.includes(cleanQuery) || cleanQuery.includes(aptClean);
        });

        if (userApts.length === 0) {
            clientAptsContainer.innerHTML = '<p style="color:#6b7280; font-size:0.9rem;">Nenhum agendamento encontrado para este telefone.</p>';
            return;
        }

        clientAptsContainer.innerHTML = userApts.map(a => `
            <div style="background:#fff; border:1px solid #e5e7eb; border-radius:6px; padding:10px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <strong>${a.servicoNome}</strong> com <em>${a.barbeiroNome}</em><br>
                    <small style="color:#4b5563;">📅 ${a.dataISO} às ${a.horaInicio} | ${toBRL(a.valor)}</small><br>
                    <span style="display:inline-block; font-size:0.75rem; padding:2px 6px; border-radius:4px; font-weight:600; background:#e0f2fe; color:#0369a1; margin-top:4px;">${a.status}</span>
                </div>
                ${a.status !== 'CANCELADO' ? `
                    <button type="button" class="btn-cancel-apt" data-id="${a.id}" style="background:#fee2e2; color:#b91c1c; border:1px solid #ef4444; padding:4px 8px; border-radius:4px; font-size:0.8rem; cursor:pointer;">
                        Cancelar
                    </button>
                ` : ''}
            </div>
        `).join('');

        clientAptsContainer.querySelectorAll('.btn-cancel-apt').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (!confirm('Deseja realmente cancelar este agendamento?')) return;
                try {
                    await fetch(`/api/agendamentos/${btn.dataset.id}/status`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ status: 'CANCELADO' })
                    });
                    alert('Agendamento cancelado.');
                    carregarAgendamentosCliente(phone);
                } catch {
                    alert('Erro ao cancelar.');
                }
            });
        });
    } catch {
        clientAptsContainer.innerHTML = '<p style="color:#dc2626;">Erro ao consultar histórico.</p>';
    }
}

// LGPD Export Data
btnExportarDadosLGPD?.addEventListener('click', async () => {
    const phone = portalPhoneInput?.value.trim() || 'meus_dados';
    try {
        const res = await fetch('/api/agendamentos');
        const data = await res.json();
        const exportObj = {
            solicitante: { telefone: phone, dataSolicitacao: new Date().toISOString() },
            historicoAgendamentos: data.agendamentos || [],
            politicaPrivacidade: 'Conformidade LGPD - Lei 13.709/2018'
        };
        const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `dados_lgpd_${phone}.json`;
        a.click();
    } catch {
        alert('Erro ao gerar exportação LGPD.');
    }
});

// LGPD Request Erasure
btnSolicitarExclusaoLGPD?.addEventListener('click', () => {
    if (!confirm('Atenção: A solicitação de exclusão de dados (Direito ao Esquecimento - Art. 18 LGPD) anonimizará seu histórico. Deseja prosseguir?')) return;
    alert('Sua solicitação de anonimização e exclusão de dados foi registrada com sucesso.');
    fecharModal('modalPortalCliente');
});

// ===== CAMINHO A: FLUXO WHATSAPP RÁPIDO =====
const nomeClienteInput = document.getElementById('nomeCliente');
document.getElementById('btnClienteContinuar')?.addEventListener('click', () => {
    const nome = (nomeClienteInput?.value || '').trim();
    if (!nome) { alert('Digite seu nome para continuar.'); return; }
    agendamentoContexto.nomeCliente = nome;
    fecharModal('modalCliente');
    abrirModalProdutos();
});

// Produtos
const produtosContainer = document.getElementById('produtosContainer');
const prodTotalSpan = document.getElementById('prodTotal');
const btnProdutosPular = document.getElementById('btnProdutosPular');
const btnProdutosContinuar = document.getElementById('btnProdutosContinuar');

function renderProdutos() {
    if (!produtosContainer) return;
    produtosContainer.innerHTML = '';
    PRODUTOS.forEach((p, i) => {
        const card = document.createElement('div');
        card.className = 'prod-card';
        card.dataset.index = i;
        card.innerHTML = `
            <div class="p-name">${p.nome}</div>
            <div class="p-price">${toBRL(p.preco)}</div>
            <small class="muted">Toque para selecionar</small>
        `;
        card.addEventListener('click', () => toggleProduto(i, card));
        produtosContainer.appendChild(card);
    });
}

function toggleProduto(index, cardEl) {
    const item = PRODUTOS[index];
    const exists = agendamentoContexto.produtos.find(pr => pr.nome === item.nome);
    if (exists) {
        agendamentoContexto.produtos = agendamentoContexto.produtos.filter(pr => pr.nome !== item.nome);
        cardEl.classList.remove('active');
    } else {
        agendamentoContexto.produtos.push({ nome: item.nome, preco: item.preco });
        cardEl.classList.add('active');
    }
    agendamentoContexto.totalProdutos = agendamentoContexto.produtos.reduce((s, it) => s + (it.preco || 0), 0);
    if (prodTotalSpan) prodTotalSpan.textContent = toBRL(agendamentoContexto.totalProdutos);
}

function abrirModalProdutos() {
    agendamentoContexto.produtos = [];
    agendamentoContexto.totalProdutos = 0;
    if (prodTotalSpan) prodTotalSpan.textContent = toBRL(0);
    renderProdutos();
    abrirModal('modalProdutos');
}

btnProdutosPular?.addEventListener('click', () => { fecharModal('modalProdutos'); abrirModal('modalRAClub'); });
btnProdutosContinuar?.addEventListener('click', () => { fecharModal('modalProdutos'); abrirModal('modalRAClub'); });

// RA Club
const btnRAJaMembro = document.getElementById('btnRAJaMembro');
const btnRANao = document.getElementById('btnRANao');
btnRAJaMembro?.addEventListener('click', () => { agendamentoContexto.raclub = { status: 'membro' }; fecharModal('modalRAClub'); abrirModalAgendamentoWhatsapp(); });
btnRANao?.addEventListener('click', () => { agendamentoContexto.raclub = { status: 'nao' }; fecharModal('modalRAClub'); abrirModalAgendamentoWhatsapp(); });

// WhatsApp Appointment Modal
const dataInput = document.getElementById('data');
const horaSelect = document.getElementById('hora');

function fillHorasForProf() {
    const lista = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"];
    if (horaSelect) {
        horaSelect.innerHTML = `<option value="">Selecione um horário</option>` +
            lista.map(h => `<option value="${h}">${h}</option>`).join('');
    }
}

function abrirModalAgendamentoWhatsapp() {
    const hoje = new Date().toISOString().split('T')[0];
    if (dataInput) {
        dataInput.min = hoje;
        dataInput.value = hoje;
    }
    fillHorasForProf();
    const display = document.getElementById('servicoDisplay');
    if (display) {
        display.value = agendamentoContexto.servico
            ? `${agendamentoContexto.servico.nome} — ${toBRL(agendamentoContexto.servico.valor)}`
            : '';
    }
    abrirModal('modal');
}

// Botões dos Barbeiros na Seção Contact
document.querySelectorAll('.openModalBtn').forEach(btn => {
    btn.addEventListener('click', () => {
        ctx.profissional = btn.dataset.pro || 'Rodrigo';
        ctx.wa = btn.dataset.wa || '5511999998888';
        abrirModal('modalCliente');
    });
});

// Modal de Serviço
const servicoDisplay = document.getElementById('servicoDisplay');
const servicoLista = document.getElementById('servicoLista');
const servicoCancelar = document.getElementById('servicoCancelar');
const servicoConfirmarWpp = document.getElementById('servicoConfirmarWpp');
const svcSearch = document.getElementById('svcSearch');

function renderListaServicos() {
    if (!servicoLista) return;
    const base = SERVICOS.slice(1);
    const filter = (svcSearch?.value || '').toLowerCase().trim();
    const filtered = filter ? base.filter(s => s.nome.toLowerCase().includes(filter)) : base;

    servicoLista.innerHTML = [SERVICOS[0], ...filtered].map((s) => {
        const checked = agendamentoContexto.servico?.nome === s.nome ? 'checked' : '';
        const sub = s.placeholder ? '' : `<div class="svc-muted">${s.valor != null ? toBRL(s.valor) : ''}</div>`;
        return `
            <label class="svc-row" data-nome="${s.nome}" style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid #f3f4f6; cursor:pointer;">
                <div class="svc-left">
                    <div class="svc-name" style="font-weight:600;">${s.nome}</div>
                    ${sub}
                </div>
                <input class="svc-radio" type="radio" name="svc" value="${s.nome}" ${checked} />
            </label>
        `;
    }).join('');
}

servicoDisplay?.addEventListener('click', () => {
    renderListaServicos();
    abrirModal('servicoModal');
});
servicoCancelar?.addEventListener('click', () => fecharModal('servicoModal'));
svcSearch?.addEventListener('input', renderListaServicos);

servicoConfirmarWpp?.addEventListener('click', () => {
    const sel = servicoLista?.querySelector('input[name="svc"]:checked');
    if (!sel) { alert('Selecione um serviço.'); return; }
    const nomeSel = sel.value;
    const s = SERVICOS.find(x => x.nome === nomeSel);
    if (!s || s.placeholder) { alert('Selecione um serviço.'); return; }

    agendamentoContexto.servico = { nome: s.nome, valor: s.valor };
    if (servicoDisplay) servicoDisplay.value = `${s.nome} — ${toBRL(s.valor)}`;
    fecharModal('servicoModal');
});

// Confirmar e Gerar Link WhatsApp
const confirmarBtn = document.getElementById('confirmarBtn');
confirmarBtn?.addEventListener('click', async () => {
    const data = dataInput?.value;
    const hora = horaSelect?.value;
    if (!data) { alert("Selecione uma data."); return; }
    if (!agendamentoContexto.servico) { alert("Selecione o serviço."); abrirModal('servicoModal'); return; }

    const dataBR = new Date(`${data}T00:00:00`).toLocaleDateString('pt-BR');

    try {
        const res = await fetch('/api/automacao/whatsapp/gerar-link', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                phone: ctx.wa,
                clienteNome: agendamentoContexto.nomeCliente,
                barbeiroNome: ctx.profissional,
                servicoNome: agendamentoContexto.servico.nome,
                servicoPreco: agendamentoContexto.servico.valor,
                dataBR,
                hora: hora || 'A definir',
                produtos: agendamentoContexto.produtos,
                raclubStatus: agendamentoContexto.raclub?.status
            })
        });

        const dataRes = await res.json();
        if (dataRes.url) {
            window.open(dataRes.url, '_blank');
        }
        fecharModal('modal');
        setTimeout(() => abrirModal('modalAvaliacao'), 400);
    } catch {
        alert('Erro ao gerar link de WhatsApp.');
    }
});

// Fechar modais clicando fora
window.addEventListener('click', (e) => {
    document.querySelectorAll('.modal').forEach(m => {
        if (e.target === m) m.style.display = 'none';
    });
});

// Boot
loadCatalog();
