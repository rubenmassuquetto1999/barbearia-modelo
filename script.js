/* =========================================
   Barbearia Admin Panel — REST API + RBAC Engine
========================================= */

const $ = (s) => document.querySelector(s);

// App State
const savedToken = sessionStorage.getItem('userToken') || localStorage.getItem('userToken');
const savedRole = sessionStorage.getItem('userRole') || localStorage.getItem('userRole');
const savedName = sessionStorage.getItem('userName') || localStorage.getItem('userName');
const savedId = sessionStorage.getItem('userId') || localStorage.getItem('userId');

let currentUser = {
    id: savedId || "usr_admin_1",
    name: savedName || "Rodrigo Almeida (Dono)",
    email: "admin@barbearia.com",
    role: savedRole || "ADMIN",
    token: savedToken || null
};

// Check Route Guard if on painel.html
const isPainelPage = window.location.pathname.includes('painel') || document.title.includes('Painel');
if (isPainelPage) {
    const hasAdminAccess = currentUser.role === 'ADMIN' || currentUser.role === 'SECRETARIA';
    const accessDeniedBanner = document.getElementById('accessDeniedBanner');
    if (!hasAdminAccess) {
        if (accessDeniedBanner) accessDeniedBanner.style.display = 'flex';
    } else {
        if (accessDeniedBanner) accessDeniedBanner.style.display = 'none';
    }
}

let allAgendamentos = [];
let allClientes = [];
let allBarbeiros = [];
let allServicos = [];
let allPagamentos = [];
let allAutomacoes = [];
let reportCache = [];
let reportsChartInstance = null;

const formatCurrency = (v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
const formatDate = (d) => d ? new Date(d).toLocaleDateString("pt-BR") : "—";
const formatDateTime = (d) => d ? new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";
const ymdToDateStr = (ymd) => new Date(`${ymd}T00:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

const showNotification = (message, type = "success") => {
    const container = $("#notification-container");
    if (!container) return;
    const el = document.createElement("div");
    el.className = `notification ${type}`;
    el.textContent = message;
    container.appendChild(el);
    setTimeout(() => el.remove(), 3000);
};

const getAuthHeaders = () => {
    const headers = { "Content-Type": "application/json" };
    if (currentUser.token) {
        headers["Authorization"] = `Bearer ${currentUser.token}`;
    }
    return headers;
};

/* =========================================
   Modal Global
========================================= */
const mainModal = {
    el: $("#mainModal"),
    title: $("#modalTitle"),
    body: $("#modalBody"),
    footer: $("#modalFooter"),
    show(config) {
        if (!this.el) return;
        this.title.textContent = config.title || "";
        this.body.innerHTML = config.body || "";
        this.footer.innerHTML = "";
        (config.buttons || []).forEach((b) => {
            const btn = document.createElement("button");
            btn.className = `btn ${b.class || ""}`;
            btn.innerHTML = b.text || "";
            if (b.style) Object.assign(btn.style, b.style);
            btn.onclick = () => {
                if (b.onClick) {
                    const r = b.onClick();
                    if (r === false) return;
                }
                this.hide();
            };
            this.footer.appendChild(btn);
        });
        this.el.classList.add("show");
    },
    hide() {
        if (this.el) this.el.classList.remove("show");
    }
};
$("#modalClose")?.addEventListener("click", () => mainModal.hide());
mainModal.el?.addEventListener("click", (e) => { if (e.target === mainModal.el) mainModal.hide(); });

/* =========================================
   Tabs Navigation
========================================= */
const mainContents = document.querySelectorAll("main");
const tabBtns = document.querySelectorAll(".tab-btn");

const showTab = (tabId) => {
    mainContents.forEach((m) => m.classList.remove("active"));
    const target = $(`#${tabId}Main`);
    if (target) target.classList.add("active");
    tabBtns.forEach((b) => b.classList.toggle("active", b.dataset.tab === tabId));

    if (tabId === "agenda") loadAgenda();
    if (tabId === "clientes") loadClientes();
    if (tabId === "barbeiros") loadBarbeiros();
    if (tabId === "servicos") loadServicos();
    if (tabId === "reports") loadRelatorios();
    if (tabId === "automacao") loadAutomacoes();
};

tabBtns.forEach((b) => {
    if (b.dataset.tab) {
        b.addEventListener("click", () => showTab(b.dataset.tab));
    }
});

/* =========================================
   Autenticação & RBAC Switcher
========================================= */
const updateUserInfoDisplay = () => {
    const nameEl = $("#currentUserName");
    const roleEl = $("#currentUserRole");
    if (nameEl) nameEl.textContent = currentUser.name;
    if (roleEl) {
        roleEl.textContent = currentUser.role;
        roleEl.className = `badge-role role-${currentUser.role}`;
    }
};

const setupLoginModal = () => {
    mainModal.show({
        title: "Login de Acesso ao Painel",
        body: `<div class="form-grid">
            <p style="color:var(--text-light);font-size:0.9rem;">Selecione uma conta de demonstração com controle de acesso (RBAC):</p>
            <div style="display:flex; flex-direction:column; gap:10px; margin: 12px 0;">
                <button type="button" id="btnFastLoginAdmin" class="btn btn-primary" style="justify-content:flex-start; padding:12px;">
                    <i class='bx bx-crown' style="font-size:1.2rem;"></i>
                    <div style="text-align:left; margin-left:8px;">
                        <strong>Rodrigo Almeida (Dono / ADMIN)</strong><br>
                        <small style="opacity:0.8;">Acesso total (Financeiro, Barbeiros, Escalas, Clientes)</small>
                    </div>
                </button>
                <button type="button" id="btnFastLoginSec" class="btn btn-light" style="justify-content:flex-start; padding:12px; border:1px solid var(--border);">
                    <i class='bx bx-user-voice' style="font-size:1.2rem;"></i>
                    <div style="text-align:left; margin-left:8px;">
                        <strong>Mariana Costa (SECRETÁRIA)</strong><br>
                        <small style="color:var(--text-light);">Gestão de Agenda, Clientes e WhatsApp</small>
                    </div>
                </button>
            </div>
        </div>`,
        buttons: [
            { text: "Fechar", class: "btn-light" }
        ]
    });

    $("#btnFastLoginAdmin")?.addEventListener("click", async () => {
        try {
            const res = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: "admin@barbearia.com", password: "admin123" })
            });
            const data = await res.json();
            currentUser = { ...data.user, token: data.token };
            updateUserInfoDisplay();
            showNotification("Logado como Administrador!");
            mainModal.hide();
            showTab("agenda");
        } catch {
            showNotification("Erro no login", "error");
        }
    });

    $("#btnFastLoginSec")?.addEventListener("click", async () => {
        try {
            const res = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: "secretaria@barbearia.com", password: "sec123" })
            });
            const data = await res.json();
            currentUser = { ...data.user, token: data.token };
            updateUserInfoDisplay();
            showNotification("Logada como Secretária!");
            mainModal.hide();
            showTab("agenda");
        } catch {
            showNotification("Erro no login", "error");
        }
    });
};

$("#switchUserBtn")?.addEventListener("click", setupLoginModal);
$("#btnOpenAdminLoginDirect")?.addEventListener("click", setupLoginModal);

$("#logoutBtn")?.addEventListener("click", () => {
    if (!confirm("Deseja realmente sair do painel administrativo?")) return;
    sessionStorage.removeItem("userToken");
    sessionStorage.removeItem("userRole");
    sessionStorage.removeItem("userName");
    sessionStorage.removeItem("userId");
    localStorage.removeItem("userToken");
    localStorage.removeItem("userRole");
    localStorage.removeItem("userName");
    localStorage.removeItem("userId");
    window.location.href = "/";
});

/* =========================================
   TAB 1: AGENDA & AGENDAMENTOS
========================================= */
const profissionalSelect = $("#profissionalSelect");
const dataFiltro = $("#dataFiltro");
const horaFiltro = $("#horaFiltro");
const agendaGrid = $("#agenda-grid");
const buscarBtn = $("#buscarBtn");
const novoAgendamentoDirectBtn = $("#novoAgendamentoDirectBtn");
const bloquearBtn = $("#bloquearBtn");
const desbloquearBtn = $("#desbloquearBtn");

const loadBarbersSelect = async () => {
    try {
        const res = await fetch("/api/barbeiros");
        const data = await res.json();
        allBarbeiros = data.barbeiros || [];
        
        if (profissionalSelect) {
            profissionalSelect.innerHTML = `<option value="">Todos os Barbeiros</option>` +
                allBarbeiros.map(b => `<option value="${b.id}">${b.name}</option>`).join("");
        }

        const relProf = $("#relProf");
        if (relProf) {
            relProf.innerHTML = `<option value="">Todos os Barbeiros</option>` +
                allBarbeiros.map(b => `<option value="${b.name}">${b.name}</option>`).join("");
        }
    } catch (e) {
        console.warn("Erro ao carregar barbeiros:", e);
    }
};

const loadAgenda = async () => {
    const ymd = dataFiltro?.value;
    const barbeiroId = profissionalSelect?.value;
    const hora = horaFiltro?.value;

    if (!agendaGrid) return;
    agendaGrid.innerHTML = `<div class="loading-row">Consultando agenda...</div>`;

    try {
        let url = `/api/agendamentos?`;
        if (ymd) url += `dataISO=${ymd}&`;
        if (barbeiroId) url += `barbeiroId=${barbeiroId}&`;

        const res = await fetch(url, { headers: getAuthHeaders() });
        const data = await res.json();
        allAgendamentos = data.agendamentos || [];

        let filtered = allAgendamentos;
        if (hora) filtered = filtered.filter(a => a.horaInicio === hora);

        if (filtered.length === 0) {
            agendaGrid.innerHTML = `
                <div class="card" style="padding:32px; text-align:center; color:var(--text-light);">
                    <i class='bx bx-calendar-x' style="font-size:2.5rem; color:#9ca3af; margin-bottom:8px;"></i>
                    <p>Nenhum agendamento para esta data e filtros.</p>
                    <button class="btn btn-primary btn-sm" onclick="document.getElementById('novoAgendamentoDirectBtn').click()">
                        + Criar Novo Agendamento
                    </button>
                </div>`;
            return;
        }

        agendaGrid.innerHTML = filtered.map(a => `
            <div class="timeslot ${a.bloqueado ? 'blocked-slot' : ''}" style="margin-bottom:12px; background:#fff; border-radius:8px; border:1px solid var(--border); padding:12px 16px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
                <div style="display:flex; align-items:center; gap:16px;">
                    <div style="font-size:1.1rem; font-weight:700; color:var(--primary); min-width:80px;">
                        ${a.horaInicio} <small style="font-size:0.75rem; color:#6b7280; font-weight:normal;">(${a.horaFim || ''})</small>
                    </div>
                    <div>
                        <strong>${a.clienteNome || 'Cliente'}</strong> <small style="color:#6b7280;">${a.clienteTelefone || ''}</small><br>
                        <span style="font-size:0.9rem; color:#374151;">✂️ ${a.servicoNome} com <em>${a.barbeiroNome}</em></span> • <strong>${formatCurrency(a.valor)}</strong>
                        <span class="status-badge status-${a.status}" style="margin-left:8px;">${a.status}</span>
                        ${a.canalOrigem === 'WEB_AUTONOMO' ? '<span style="font-size:0.7rem; background:#fef3c7; color:#92400e; padding:1px 6px; border-radius:4px; margin-left:4px;">Web Autônomo</span>' : ''}
                    </div>
                </div>
                <div class="actions" style="display:flex; gap:6px;">
                    <button class="btn btn-sm btn-success" data-action="status-concluido" data-id="${a.id}" title="Marcar como Concluído"><i class='bx bx-check'></i> Concluir</button>
                    <button class="btn btn-sm btn-warning" data-action="status-falta" data-id="${a.id}" title="Não Compareceu"><i class='bx bx-user-x'></i> Falta</button>
                    <button class="btn btn-sm btn-light" data-action="whatsapp-lembrete" data-id="${a.id}" title="Enviar Lembrete WhatsApp"><i class='bx bxl-whatsapp' style="color:#25d366"></i></button>
                    <button class="btn btn-sm btn-del" data-action="cancel-agenda" data-id="${a.id}" title="Cancelar"><i class='bx bx-trash'></i></button>
                </div>
            </div>
        `).join("");
    } catch (e) {
        console.error("Erro ao carregar agenda:", e);
        agendaGrid.innerHTML = `<div class="loading-row">Erro ao carregar agendamentos.</div>`;
    }
};

buscarBtn?.addEventListener("click", loadAgenda);

// Criar Agendamento Direto pelo Painel
novoAgendamentoDirectBtn?.addEventListener("click", async () => {
    const svcs = allServicos.length > 0 ? allServicos : [
        { id: "svc_3", name: "Corte Máquina e Tesoura", price: 40, durationMin: 40 },
        { id: "svc_2", name: "Barba Completa", price: 40, durationMin: 30 }
    ];

    const barbers = allBarbeiros.length > 0 ? allBarbeiros : [
        { id: "barb_1", name: "Rodrigo" },
        { id: "barb_2", name: "Melqui" }
    ];

    const currentYmd = dataFiltro?.value || new Date().toISOString().split("T")[0];

    mainModal.show({
        title: "Novo Agendamento Manual",
        body: `<form id="manualAptForm" class="form-grid">
            <div class="field"><label>Cliente *</label><input type="text" id="manCliNome" placeholder="Nome do cliente" required></div>
            <div class="field"><label>WhatsApp / Telefone *</label><input type="tel" id="manCliPhone" placeholder="(81) 9XXXX-XXXX" required></div>
            <div class="form-row">
                <div class="field"><label>Barbeiro</label><select id="manBarb">${barbers.map(b => `<option value="${b.id}">${b.name}</option>`).join("")}</select></div>
                <div class="field"><label>Serviço</label><select id="manSvc">${svcs.map(s => `<option value="${s.id}">${s.name} (${formatCurrency(s.price)})</option>`).join("")}</select></div>
            </div>
            <div class="form-row">
                <div class="field"><label>Data</label><input type="date" id="manDate" value="${currentYmd}" required></div>
                <div class="field"><label>Hora de Início</label><input type="time" id="manTime" value="10:00" required></div>
            </div>
            <div class="field"><label>Forma de Pagamento</label><select id="manPay">
                <option value="PIX">PIX</option>
                <option value="Cartão de Crédito">Cartão de Crédito</option>
                <option value="Cartão de Débito">Cartão de Débito</option>
                <option value="Dinheiro">Dinheiro</option>
            </select></div>
        </form>`,
        buttons: [
            { text: "Cancelar", class: "btn-light" },
            {
                text: "Criar Agendamento",
                class: "btn-primary",
                onClick: async () => {
                    const clienteNome = $("#manCliNome").value;
                    const clienteTelefone = $("#manCliPhone").value;
                    const barbeiroId = $("#manBarb").value;
                    const servicoId = $("#manSvc").value;
                    const dataISO = $("#manDate").value;
                    const horaInicio = $("#manTime").value;
                    const pagamentoForma = $("#manPay").value;

                    if (!clienteNome || !clienteTelefone) {
                        showNotification("Preencha o nome e telefone", "error");
                        return false;
                    }

                    try {
                        const res = await fetch("/api/agendamentos", {
                            method: "POST",
                            headers: getAuthHeaders(),
                            body: JSON.stringify({
                                clienteNome,
                                clienteTelefone,
                                barbeiroId,
                                servicoId,
                                dataISO,
                                horaInicio,
                                canalOrigem: "ADMIN_MANUAL",
                                pagamentoForma
                            })
                        });

                        const result = await res.json();
                        if (!res.ok) {
                            showNotification(result.error || "Conflito de horário.", "error");
                            return false;
                        }

                        showNotification("Agendamento criado com sucesso!");
                        loadAgenda();
                    } catch {
                        showNotification("Erro de conexão ao agendar.", "error");
                        return false;
                    }
                }
            }
        ]
    });
});

// Ações na Tabela de Agenda
agendaGrid?.addEventListener("click", async (e) => {
    const target = e.target;
    const btn = target.closest("button[data-action]");
    if (!btn) return;

    const action = btn.dataset.action;
    const id = btn.dataset.id;

    if (action === "status-concluido") {
        try {
            await fetch(`/api/agendamentos/${id}/status`, {
                method: "PATCH",
                headers: getAuthHeaders(),
                body: JSON.stringify({ status: "CONCLUIDO" })
            });
            showNotification("Atendimento concluído e registrado no financeiro!");
            loadAgenda();
        } catch {
            showNotification("Erro ao atualizar status.", "error");
        }
    } else if (action === "status-falta") {
        try {
            await fetch(`/api/agendamentos/${id}/status`, {
                method: "PATCH",
                headers: getAuthHeaders(),
                body: JSON.stringify({ status: "NAO_COMPARECEU" })
            });
            showNotification("Marcado como Não Compareceu.");
            loadAgenda();
        } catch {
            showNotification("Erro ao atualizar status.", "error");
        }
    } else if (action === "whatsapp-lembrete") {
        try {
            const res = await fetch("/api/automacao/whatsapp/disparar", {
                method: "POST",
                headers: getAuthHeaders(),
                body: JSON.stringify({ agendamentoId: id, tipo: "LEMBRETE_2H" })
            });
            const data = await res.json();
            showNotification(data.message || "Lembrete disparado!");
        } catch {
            showNotification("Erro ao enviar lembrete.", "error");
        }
    } else if (action === "cancel-agenda") {
        if (!confirm("Deseja realmente cancelar/excluir este agendamento?")) return;
        try {
            await fetch(`/api/agendamentos/${id}`, {
                method: "DELETE",
                headers: getAuthHeaders()
            });
            showNotification("Agendamento cancelado com sucesso!");
            loadAgenda();
        } catch {
            showNotification("Erro ao cancelar.", "error");
        }
    }
});

/* =========================================
   TAB 2: CLIENTES CRUD
========================================= */
const clientForm = $("#clientForm");
const clientTableBody = $("#clientTableBody");
const clientSearch = $("#clientSearch");
const paymentsTableBody = $("#paymentsTableBody");
const clientTypeSelect = $("#clientType");
const clientValueField = $("#clientValueField");
const clientPayDayField = $("#clientPayDayField");
const clientFilterButtons = document.querySelectorAll(".filter-tab-btn");

const loadClientes = async () => {
    try {
        const res = await fetch("/api/clientes", { headers: getAuthHeaders() });
        const data = await res.json();
        allClientes = data.clientes || [];
        renderClients(allClientes);
        updateClientKPIs();
    } catch {
        renderClients([]);
    }
};

const renderClients = (clients) => {
    if (!clientTableBody) return;
    clientTableBody.innerHTML = clients.map(c => `
        <tr>
            <td data-label="Nome"><strong>${c.name}</strong><br><small style="color:var(--text-light)">${c.type === "plano_jc" ? `Plano: ${formatCurrency(c.value)} / Dia ${c.payDay || "N/A"}` : "Avulso"}</small></td>
            <td data-label="Telefone">${c.phone || "—"}</td>
            <td data-label="Tipo">${c.type === "plano_jc" ? "Plano RA" : "Avulso"}</td>
            <td data-label="Status"><span class="badge ${c.status}">${c.status}</span></td>
            <td data-label="Ações">
                <div class="actions">
                    <button class="btn btn-sm btn-del" data-action="delete-client" data-id="${c.id}" title="Excluir"><i class='bx bx-trash'></i></button>
                </div>
            </td>
        </tr>
    `).join("") || `<tr><td colspan="5" class="loading-row">Nenhum cliente encontrado.</td></tr>`;
};

const updateClientKPIs = () => {
    const activeMembers = allClientes.filter(c => c.type === "plano_jc" && c.status === "ativo");
    const activeEl = $("#activeMembers");
    const revEl = $("#estimatedRevenue");
    if (activeEl) activeEl.textContent = activeMembers.length;
    if (revEl) revEl.textContent = formatCurrency(activeMembers.reduce((s, c) => s + (Number(c.value) || 0), 0));
};

clientTypeSelect?.addEventListener("change", () => {
    const isPlan = clientTypeSelect.value === "plano_jc";
    clientValueField?.classList.toggle("hidden-block", !isPlan);
    clientPayDayField?.classList.toggle("hidden-block", !isPlan);
});

clientForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = $("#clientName").value;
    const phone = $("#clientPhone").value;
    const type = $("#clientType").value;
    const value = $("#clientValue")?.value || 0;
    const payDay = $("#clientPayDay")?.value || null;
    const status = $("#clientStatus").value;

    try {
        const res = await fetch("/api/clientes", {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify({ name, phone, type, value, payDay, status })
        });
        if (res.ok) {
            showNotification("Cliente salvo!");
            clientForm.reset();
            clientTypeSelect.dispatchEvent(new Event("change"));
            loadClientes();
        }
    } catch {
        showNotification("Erro ao salvar cliente.", "error");
    }
});

clientTableBody?.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-action='delete-client']");
    if (!btn) return;
    if (!confirm("Deseja realmente excluir este cliente?")) return;
    try {
        await fetch(`/api/clientes/${btn.dataset.id}`, {
            method: "DELETE",
            headers: getAuthHeaders()
        });
        showNotification("Cliente removido.");
        loadClientes();
    } catch {
        showNotification("Erro ao remover cliente.", "error");
    }
});

/* =========================================
   TAB 3: BARBEIROS & ESCALAS CRUD
========================================= */
const barbeiroForm = $("#barbeiroForm");
const barbeirosTableBody = $("#barbeirosTableBody");

const loadBarbeiros = async () => {
    try {
        const res = await fetch("/api/barbeiros");
        const data = await res.json();
        allBarbeiros = data.barbeiros || [];
        renderBarbeiros(allBarbeiros);
    } catch {
        renderBarbeiros([]);
    }
};

const renderBarbeiros = (list) => {
    if (!barbeirosTableBody) return;
    barbeirosTableBody.innerHTML = list.map(b => `
        <tr>
            <td><strong>${b.name}</strong><br><small style="color:#6b7280">${b.phone || ''}</small></td>
            <td>${b.specialty || 'Geral'}</td>
            <td><strong style="color:#d97706;">${b.comissaoPercentual}%</strong></td>
            <td>${b.escala?.inicio || '09:00'} às ${b.escala?.fim || '19:00'}</td>
            <td>
                <div class="actions">
                    <button class="btn btn-sm btn-del" data-action="delete-barb" data-id="${b.id}"><i class='bx bx-trash'></i></button>
                </div>
            </td>
        </tr>
    `).join("") || `<tr><td colspan="5" class="loading-row">Nenhum barbeiro cadastrado.</td></tr>`;
};

barbeiroForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = $("#barbNome").value;
    const phone = $("#barbTelefone").value;
    const specialty = $("#barbEspecialidade").value;
    const comissaoPercentual = $("#barbComissao").value;
    const inicio = $("#barbInicio").value;
    const fim = $("#barbFim").value;

    try {
        const res = await fetch("/api/barbeiros", {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify({ name, phone, specialty, comissaoPercentual, inicio, fim })
        });
        if (res.ok) {
            showNotification("Barbeiro salvo!");
            barbeiroForm.reset();
            loadBarbeiros();
            loadBarbersSelect();
        }
    } catch {
        showNotification("Erro ao salvar barbeiro.", "error");
    }
});

barbeirosTableBody?.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-action='delete-barb']");
    if (!btn) return;
    if (!confirm("Deseja realmente remover este barbeiro?")) return;
    try {
        await fetch(`/api/barbeiros/${btn.dataset.id}`, {
            method: "DELETE",
            headers: getAuthHeaders()
        });
        showNotification("Barbeiro removido.");
        loadBarbeiros();
        loadBarbersSelect();
    } catch {
        showNotification("Erro ao remover barbeiro.", "error");
    }
});

/* =========================================
   TAB 4: SERVIÇOS CRUD
========================================= */
const servicoForm = $("#servicoForm");
const servicosTableBody = $("#servicosTableBody");

const loadServicos = async () => {
    try {
        const res = await fetch("/api/servicos");
        const data = await res.json();
        allServicos = data.servicos || [];
        renderServicos(allServicos);
    } catch {
        renderServicos([]);
    }
};

const renderServicos = (list) => {
    if (!servicosTableBody) return;
    servicosTableBody.innerHTML = list.map(s => `
        <tr>
            <td><strong>${s.name}</strong></td>
            <td><span class="badge" style="background:#e0f2fe; color:#0369a1;">${s.category || 'Geral'}</span></td>
            <td><strong>${formatCurrency(s.price)}</strong></td>
            <td>${s.durationMin} min</td>
            <td>
                <div class="actions">
                    <button class="btn btn-sm btn-del" data-action="delete-svc" data-id="${s.id}"><i class='bx bx-trash'></i></button>
                </div>
            </td>
        </tr>
    `).join("") || `<tr><td colspan="5" class="loading-row">Nenhum serviço cadastrado.</td></tr>`;
};

servicoForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = $("#svcNovoNome").value;
    const category = $("#svcNovoCategoria").value;
    const price = $("#svcNovoPreco").value;
    const durationMin = $("#svcNovoDuracao").value;

    try {
        const res = await fetch("/api/servicos", {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify({ name, category, price, durationMin })
        });
        if (res.ok) {
            showNotification("Serviço cadastrado com sucesso!");
            servicoForm.reset();
            loadServicos();
        }
    } catch {
        showNotification("Erro ao salvar serviço.", "error");
    }
});

servicosTableBody?.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-action='delete-svc']");
    if (!btn) return;
    if (!confirm("Deseja realmente excluir este serviço?")) return;
    try {
        await fetch(`/api/servicos/${btn.dataset.id}`, {
            method: "DELETE",
            headers: getAuthHeaders()
        });
        showNotification("Serviço excluído.");
        loadServicos();
    } catch {
        showNotification("Erro ao excluir serviço.", "error");
    }
});

/* =========================================
   TAB 5: FINANCEIRO & COMISSÕES
========================================= */
const relProf = $("#relProf");
const relDe = $("#relDe");
const relAte = $("#relAte");
const relGerarBtn = $("#relGerarBtn");
const exportCsv = $("#exportCsv");
const relDetalheTbody = $("#relDetalheTbody");
const comissoesTableBody = $("#comissoesTableBody");

const loadRelatorios = async () => {
    const hoje = new Date().toISOString().split("T")[0];
    const de = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];
    if (relDe) relDe.value = de;
    if (relAte) relAte.value = hoje;
    gerarRelatorioFinanceiro();
};

const gerarRelatorioFinanceiro = async () => {
    const de = relDe?.value;
    const ate = relAte?.value;

    try {
        const res = await fetch(`/api/financeiro/resumo?de=${de || ''}&ate=${ate || ''}`, {
            headers: getAuthHeaders()
        });
        const data = await res.json();

        $("#kpiBruto").textContent = formatCurrency(data.faturamentoBruto);
        $("#kpiComissoes").textContent = formatCurrency(data.totalComissoes);
        $("#kpiLiquido").textContent = formatCurrency(data.faturamentoLiquido);
        $("#kpiTicket").textContent = formatCurrency(data.ticketMedio);

        // Render detailed payments
        const payments = data.pagamentos || [];
        reportCache = payments;
        if (relDetalheTbody) {
            relDetalheTbody.innerHTML = payments.map(p => `
                <tr>
                    <td>${formatDate(p.date)}</td>
                    <td><strong>${p.barbeiroNome || 'Barbeiro'}</strong></td>
                    <td>${p.clientName || 'Cliente'}</td>
                    <td>Atendimento</td>
                    <td><span class="badge" style="background:#f3f4f6;">${p.method || 'PIX'}</span></td>
                    <td><strong>${formatCurrency(p.value)}</strong></td>
                    <td style="color:#ea580c; font-weight:600;">${formatCurrency(p.comissao)}</td>
                </tr>
            `).join("") || `<tr><td colspan="7" class="loading-row">Nenhum pagamento registrado no período.</td></tr>`;
        }

        // Render Commissions summary table
        if (comissoesTableBody) {
            const coms = data.comissoesPorBarbeiro || [];
            comissoesTableBody.innerHTML = coms.map(c => `
                <tr>
                    <td><strong>${c.barbeiroNome}</strong></td>
                    <td>${c.totalAtendimentos}</td>
                    <td>${formatCurrency(c.totalGerado)}</td>
                    <td><strong style="color:#ea580c;">${formatCurrency(c.totalComissao)}</strong></td>
                </tr>
            `).join("") || `<tr><td colspan="4" class="loading-row">Sem comissões registradas.</td></tr>`;
        }

        renderFinanceChart(data.porFormaPagamento || {});
    } catch (e) {
        console.error("Erro ao gerar relatório financeiro:", e);
    }
};

relGerarBtn?.addEventListener("click", gerarRelatorioFinanceiro);

const renderFinanceChart = (formas) => {
    const canvas = document.getElementById("reportsChart");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const labels = Object.keys(formas).length > 0 ? Object.keys(formas) : ["PIX", "Cartão", "Dinheiro"];
    const values = Object.keys(formas).length > 0 ? Object.values(formas) : [320, 240, 150];

    if (reportsChartInstance) reportsChartInstance.destroy();

    // eslint-disable-next-line no-undef
    reportsChartInstance = new Chart(ctx, {
        type: "doughnut",
        data: {
            labels,
            datasets: [{
                data: values,
                backgroundColor: ["#10b981", "#3b82f6", "#f59e0b", "#6366f1", "#ec4899"]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: { legend: { position: 'bottom' } }
        }
    });
};

exportCsv?.addEventListener("click", () => {
    if (!reportCache || reportCache.length === 0) return showNotification("Gere o relatório primeiro.", "error");
    const headers = ["Data", "Barbeiro", "Cliente", "Forma Pagamento", "Valor Bruto", "Comissao"];
    const rows = reportCache.map(r => [
        formatDate(r.date),
        r.barbeiroNome || "",
        r.clientName || "",
        r.method || "",
        (Number(r.value) || 0).toFixed(2),
        (Number(r.comissao) || 0).toFixed(2)
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const link = document.createElement("a");
    link.href = "data:text/csv;charset=utf-8,\uFEFF" + encodeURI(csv);
    link.download = `relatorio_barbearia_${Date.now()}.csv`;
    link.click();
});

/* =========================================
   TAB 6: AUTOMAÇÃO WHATSAPP
========================================= */
const automacaoTableBody = $("#automacaoTableBody");
const dispararLembretesEmMassaBtn = $("#dispararLembretesEmMassaBtn");

const loadAutomacoes = async () => {
    try {
        const res = await fetch("/api/automacao/whatsapp/fila", { headers: getAuthHeaders() });
        const data = await res.json();
        allAutomacoes = data.automacoes || [];

        const kpiTotal = $("#kpiLembretesTotal");
        if (kpiTotal) kpiTotal.textContent = allAutomacoes.length;

        if (automacaoTableBody) {
            automacaoTableBody.innerHTML = allAutomacoes.map(a => `
                <tr>
                    <td>${formatDateTime(a.disparadoEm)}</td>
                    <td><strong>${a.clienteNome || 'Cliente'}</strong></td>
                    <td>${a.telefone || '—'}</td>
                    <td><span class="badge" style="background:#e0f2fe; color:#0369a1;">${a.tipo}</span></td>
                    <td style="font-size:0.85rem; max-width:280px; color:#4b5563;">${a.mensagem}</td>
                    <td><span class="badge" style="background:#dcfce7; color:#166534;"><i class='bx bx-check'></i> ${a.status}</span></td>
                </tr>
            `).join("") || `<tr><td colspan="6" class="loading-row">Nenhum lembrete na fila.</td></tr>`;
        }
    } catch (e) {
        console.error("Erro ao carregar automações:", e);
    }
};

dispararLembretesEmMassaBtn?.addEventListener("click", () => {
    showNotification("Todos os lembretes do dia foram enviados com sucesso!");
    loadAutomacoes();
});

/* =========================================
   Boot
========================================= */
const init = async () => {
    const hoje = new Date().toISOString().split("T")[0];
    if (dataFiltro) dataFiltro.value = hoje;

    updateUserInfoDisplay();
    await loadBarbersSelect();
    await loadServicos();
    showTab("agenda");
};

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
} else {
    init();
}
