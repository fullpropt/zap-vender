/**
 * DASHBOARD - SELF PROTEÇÃO VEICULAR
 * Lógica principal do dashboard
 */

// Estado global
let leads = [];
let templates = [];
let currentContact = null;

// ============================================
// INICIALIZAÇÃO
// ============================================
document.addEventListener('DOMContentLoaded', function() {
    // Carregar dados
    loadLeads();
    loadTemplates();
    
    // Inicializar WhatsApp
    initWhatsApp();
    
    // Configurar busca
    setupSearch();
    
    // Atualizar estatísticas
    updateStats();
});

// ============================================
// WHATSAPP
// ============================================
function initWhatsApp() {
    WhatsApp.init({
        onConnect: function(data) {
            updateConnectionStatus(true, data.user);
            showToast('success', 'WhatsApp conectado!');
        },
        onDisconnect: function() {
            updateConnectionStatus(false);
        },
        onMessageSent: function(data) {
            showToast('success', 'Mensagem enviada com sucesso!');
            closeModal('send-modal');
            resetSendButton();
        },
        onError: function(data) {
            showToast('error', 'Erro: ' + (data.message || 'Falha na operação'));
            resetSendButton();
        }
    });
}

function updateConnectionStatus(connected, user) {
    const badge = document.getElementById('connection-status');
    const text = document.getElementById('connection-text');
    
    if (connected) {
        badge.classList.remove('disconnected');
        badge.classList.add('connected');
        text.textContent = user && user.name ? 'WhatsApp: ' + user.name : 'WhatsApp Conectado';
    } else {
        badge.classList.remove('connected');
        badge.classList.add('disconnected');
        text.textContent = 'WhatsApp Desconectado';
    }
    
    // Atualizar botões
    document.querySelectorAll('.btn-whatsapp').forEach(function(btn) {
        btn.disabled = !connected;
    });
    
    // Renderizar tabela novamente para atualizar indicadores
    renderLeads();
}

// ============================================
// LEADS
// ============================================
function loadLeads() {
    const stored = localStorage.getItem(CONFIG.STORAGE_KEYS.LEADS);
    if (stored) {
        leads = JSON.parse(stored);
    } else {
        leads = INITIAL_LEADS;
        saveLeads();
    }
    renderLeads();
}

function saveLeads() {
    localStorage.setItem(CONFIG.STORAGE_KEYS.LEADS, JSON.stringify(leads));
}

function renderLeads() {
    const tbody = document.getElementById('leads-table');
    const isConnected = WhatsApp.isWhatsAppConnected();
    
    if (leads.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 40px; color: var(--gray);">Nenhum lead cadastrado</td></tr>';
        return;
    }
    
    tbody.innerHTML = leads.map(function(lead) {
        return `
            <tr>
                <td>${lead.data}</td>
                <td><strong>${lead.nome}</strong></td>
                <td>${Utils.formatPhoneDisplay(lead.telefone)}</td>
                <td>${lead.placa || '-'}</td>
                <td>${lead.veiculo || '-'}</td>
                <td>
                    <span class="status-badge etapa-${lead.status}">
                        Etapa ${lead.status}
                    </span>
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-action btn-whatsapp" 
                                onclick="openSendModal(${lead.id})"
                                title="Enviar WhatsApp"
                                ${!isConnected ? 'disabled' : ''}>
                            <span class="icon icon-whatsapp icon-sm"></span>
                        </button>
                        <button class="btn-action btn-edit" 
                                onclick="editLead(${lead.id})"
                                title="Editar">
                            <span class="icon icon-edit icon-sm"></span>
                        </button>
                        <button class="btn-action btn-delete" 
                                onclick="deleteLead(${lead.id})"
                                title="Excluir">
                            <span class="icon icon-delete icon-sm"></span>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function updateStats() {
    const total = leads.length;
    const etapa1 = leads.filter(function(l) { return l.status === 1; }).length;
    const etapa2 = leads.filter(function(l) { return l.status === 2; }).length;
    const etapa3 = leads.filter(function(l) { return l.status === 3; }).length;
    
    document.getElementById('stat-total').textContent = total;
    document.getElementById('stat-etapa1').textContent = etapa1;
    document.getElementById('stat-etapa2').textContent = etapa2;
    document.getElementById('stat-etapa3').textContent = etapa3;
}

function openAddLeadModal() {
    document.getElementById('lead-nome').value = '';
    document.getElementById('lead-telefone').value = '';
    document.getElementById('lead-placa').value = '';
    document.getElementById('lead-veiculo').value = '';
    document.getElementById('lead-status').value = '1';
    openModal('add-lead-modal');
}

function saveLead() {
    const nome = document.getElementById('lead-nome').value.trim();
    const telefone = document.getElementById('lead-telefone').value.trim();
    const placa = document.getElementById('lead-placa').value.trim();
    const veiculo = document.getElementById('lead-veiculo').value.trim();
    const status = parseInt(document.getElementById('lead-status').value);
    
    if (!nome || !telefone) {
        showToast('warning', 'Nome e telefone são obrigatórios');
        return;
    }
    
    if (!Utils.validatePhone(telefone)) {
        showToast('warning', 'Número de telefone inválido');
        return;
    }
    
    const newLead = {
        id: Utils.generateId(),
        data: Utils.formatDateTime(),
        nome: nome,
        telefone: telefone.replace(/[^0-9]/g, ''),
        placa: placa || '-',
        veiculo: veiculo || '-',
        status: status
    };
    
    leads.unshift(newLead);
    saveLeads();
    renderLeads();
    updateStats();
    closeModal('add-lead-modal');
    showToast('success', 'Lead adicionado com sucesso!');
}

function editLead(id) {
    const lead = leads.find(function(l) { return l.id === id; });
    if (!lead) return;
    
    document.getElementById('lead-nome').value = lead.nome;
    document.getElementById('lead-telefone').value = lead.telefone;
    document.getElementById('lead-placa').value = lead.placa === '-' ? '' : lead.placa;
    document.getElementById('lead-veiculo').value = lead.veiculo === '-' ? '' : lead.veiculo;
    document.getElementById('lead-status').value = lead.status;
    
    // Alterar função do botão salvar
    const modal = document.getElementById('add-lead-modal');
    modal.querySelector('.modal-header h2').textContent = 'Editar Lead';
    
    const saveBtn = modal.querySelector('.modal-footer .btn-primary');
    saveBtn.onclick = function() {
        updateLead(id);
    };
    
    openModal('add-lead-modal');
}

function updateLead(id) {
    const index = leads.findIndex(function(l) { return l.id === id; });
    if (index === -1) return;
    
    const nome = document.getElementById('lead-nome').value.trim();
    const telefone = document.getElementById('lead-telefone').value.trim();
    const placa = document.getElementById('lead-placa').value.trim();
    const veiculo = document.getElementById('lead-veiculo').value.trim();
    const status = parseInt(document.getElementById('lead-status').value);
    
    if (!nome || !telefone) {
        showToast('warning', 'Nome e telefone são obrigatórios');
        return;
    }
    
    leads[index] = {
        ...leads[index],
        nome: nome,
        telefone: telefone.replace(/[^0-9]/g, ''),
        placa: placa || '-',
        veiculo: veiculo || '-',
        status: status
    };
    
    saveLeads();
    renderLeads();
    updateStats();
    closeModal('add-lead-modal');
    
    // Restaurar modal
    const modal = document.getElementById('add-lead-modal');
    modal.querySelector('.modal-header h2').textContent = 'Novo Lead';
    modal.querySelector('.modal-footer .btn-primary').onclick = saveLead;
    
    showToast('success', 'Lead atualizado com sucesso!');
}

function deleteLead(id) {
    if (!confirm('Tem certeza que deseja excluir este lead?')) return;
    
    leads = leads.filter(function(l) { return l.id !== id; });
    saveLeads();
    renderLeads();
    updateStats();
    showToast('success', 'Lead excluído com sucesso!');
}

// ============================================
// TEMPLATES
// ============================================
function loadTemplates() {
    const stored = localStorage.getItem(CONFIG.STORAGE_KEYS.TEMPLATES);
    if (stored) {
        templates = JSON.parse(stored);
    } else {
        templates = INITIAL_TEMPLATES;
        saveTemplates();
    }
    renderTemplates();
}

function saveTemplates() {
    localStorage.setItem(CONFIG.STORAGE_KEYS.TEMPLATES, JSON.stringify(templates));
}

function renderTemplates() {
    const grid = document.getElementById('templates-grid');
    const select = document.getElementById('template-select');
    
    grid.innerHTML = templates.map(function(template) {
        return `
            <div class="template-card" onclick="selectTemplate(${template.id})">
                <h4>${template.nome}</h4>
                <p>${template.mensagem.substring(0, 100)}...</p>
            </div>
        `;
    }).join('');
    
    select.innerHTML = '<option value="">-- Mensagem personalizada --</option>' +
        templates.map(function(template) {
            return `<option value="${template.id}">${template.nome}</option>`;
        }).join('');
}

function openNewTemplateModal() {
    document.getElementById('template-name').value = '';
    document.getElementById('template-message').value = '';
    openModal('template-modal');
}

function saveTemplate() {
    const nome = document.getElementById('template-name').value.trim();
    const mensagem = document.getElementById('template-message').value.trim();
    
    if (!nome || !mensagem) {
        showToast('warning', 'Preencha todos os campos');
        return;
    }
    
    const newTemplate = {
        id: Utils.generateId(),
        nome: nome,
        mensagem: mensagem
    };
    
    templates.push(newTemplate);
    saveTemplates();
    renderTemplates();
    closeModal('template-modal');
    showToast('success', 'Template salvo com sucesso!');
}

function selectTemplate(id) {
    document.getElementById('template-select').value = id;
    applyTemplate();
}

function applyTemplate() {
    const select = document.getElementById('template-select');
    const textarea = document.getElementById('message-input');
    
    if (!select.value) {
        textarea.value = '';
        return;
    }
    
    const template = templates.find(function(t) { return t.id == select.value; });
    if (template && currentContact) {
        let message = template.mensagem;
        message = message.replace(/\{\{nome\}\}/g, currentContact.nome);
        textarea.value = message;
    }
}

// ============================================
// ENVIO DE MENSAGEM
// ============================================
function openSendModal(leadId) {
    if (!WhatsApp.isWhatsAppConnected()) {
        showToast('warning', 'WhatsApp não está conectado. Acesse a página WhatsApp para conectar.');
        return;
    }
    
    const lead = leads.find(function(l) { return l.id === leadId; });
    if (!lead) return;
    
    currentContact = lead;
    
    // Preencher informações do contato
    document.getElementById('modal-avatar').textContent = lead.nome.charAt(0).toUpperCase();
    document.getElementById('modal-name').textContent = lead.nome;
    document.getElementById('modal-phone').textContent = '+55 ' + Utils.formatPhoneDisplay(lead.telefone);
    document.getElementById('modal-vehicle').textContent = lead.veiculo;
    
    // Limpar campos
    document.getElementById('template-select').value = '';
    document.getElementById('message-input').value = '';
    
    openModal('send-modal');
}

function sendMessage() {
    if (!currentContact || !WhatsApp.isWhatsAppConnected()) {
        showToast('error', 'Não foi possível enviar a mensagem');
        return;
    }
    
    const message = document.getElementById('message-input').value.trim();
    
    if (!message) {
        showToast('warning', 'Digite uma mensagem');
        return;
    }
    
    const sendBtn = document.getElementById('send-btn');
    sendBtn.disabled = true;
    sendBtn.innerHTML = '<span class="spinner"></span> Enviando...';
    
    WhatsApp.sendMessage(currentContact.telefone, message)
        .then(function(result) {
            // Sucesso tratado no callback onMessageSent
        })
        .catch(function(error) {
            showToast('error', 'Erro ao enviar: ' + error.message);
            resetSendButton();
        });
}

function resetSendButton() {
    const sendBtn = document.getElementById('send-btn');
    if (sendBtn) {
        sendBtn.disabled = false;
    sendBtn.innerHTML = '<span class="icon icon-send icon-sm"></span> Enviar WhatsApp';
    }
}

// ============================================
// BUSCA
// ============================================
function setupSearch() {
    const searchInput = document.getElementById('search-input');
    searchInput.addEventListener('input', function(e) {
        const search = e.target.value.toLowerCase();
        
        const filtered = leads.filter(function(lead) {
            return lead.nome.toLowerCase().includes(search) ||
                   lead.telefone.includes(search) ||
                   (lead.placa && lead.placa.toLowerCase().includes(search)) ||
                   (lead.veiculo && lead.veiculo.toLowerCase().includes(search));
        });
        
        renderFilteredLeads(filtered);
    });
}

function renderFilteredLeads(filteredLeads) {
    const tbody = document.getElementById('leads-table');
    const isConnected = WhatsApp.isWhatsAppConnected();
    
    if (filteredLeads.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 40px; color: var(--gray);">Nenhum lead encontrado</td></tr>';
        return;
    }
    
    tbody.innerHTML = filteredLeads.map(function(lead) {
        return `
            <tr>
                <td>${lead.data}</td>
                <td><strong>${lead.nome}</strong></td>
                <td>${Utils.formatPhoneDisplay(lead.telefone)}</td>
                <td>${lead.placa || '-'}</td>
                <td>${lead.veiculo || '-'}</td>
                <td>
                    <span class="status-badge etapa-${lead.status}">
                        Etapa ${lead.status}
                    </span>
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-action btn-whatsapp" 
                                onclick="openSendModal(${lead.id})"
                                title="Enviar WhatsApp"
                                ${!isConnected ? 'disabled' : ''}>
                            <span class="icon icon-whatsapp icon-sm"></span>
                        </button>
                        <button class="btn-action btn-edit" 
                                onclick="editLead(${lead.id})"
                                title="Editar">
                            <span class="icon icon-edit icon-sm"></span>
                        </button>
                        <button class="btn-action btn-delete" 
                                onclick="deleteLead(${lead.id})"
                                title="Excluir">
                            <span class="icon icon-delete icon-sm"></span>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// ============================================
// MODAIS
// ============================================
function openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
    currentContact = null;
}

// Fechar modal com ESC
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay.active').forEach(function(modal) {
            modal.classList.remove('active');
        });
        currentContact = null;
    }
});

// Fechar modal clicando fora
document.querySelectorAll('.modal-overlay').forEach(function(overlay) {
    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) {
            overlay.classList.remove('active');
            currentContact = null;
        }
    });
});

// ============================================
// SIDEBAR MOBILE
// ============================================
function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('active');
    document.querySelector('.sidebar-overlay').classList.toggle('active');
}

// ============================================
// TOAST NOTIFICATIONS
// ============================================
function showToast(type, message) {
    const container = document.getElementById('toast-container');
    
    const icons = {
        success: 'OK',
        error: 'ERRO',
        warning: 'AVISO',
        info: 'INFO'
    };
    
    const toast = document.createElement('div');
    toast.className = 'toast ' + type;
    toast.innerHTML = `
        <span class="toast-icon">${icons[type]}</span>
        <span class="toast-message">${message}</span>
        <button class="toast-close" onclick="this.parentElement.remove()"></button>
    `;
    
    container.appendChild(toast);
    
    // Auto-remove após 5 segundos
    setTimeout(function() {
        if (toast.parentElement) {
            toast.remove();
        }
    }, 5000);
}

// ============================================
// LOGOUT
// ============================================
function logout() {
    if (confirm('Tem certeza que deseja sair?')) {
        localStorage.clear();
        window.location.reload();
    }
}
