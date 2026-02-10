// Automacao page logic migrated to module

type TriggerType = 'new_lead' | 'status_change' | 'message_received' | 'keyword' | 'schedule' | 'inactivity';
type ActionType = 'send_message' | 'change_status' | 'add_tag' | 'start_flow' | 'notify';

type Automation = {
    id: number;
    name: string;
    description?: string;
    trigger_type: TriggerType;
    trigger_value?: string;
    action_type: ActionType;
    action_value?: string;
    delay?: number;
    is_active: boolean;
    executions?: number;
    last_execution?: string | null;
};

type AutomationsResponse = { automations?: Automation[] };

let automations: Automation[] = [];

function onReady(callback: () => void) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', callback);
    } else {
        callback();
    }
}

function setAutomationModalTitle(mode: 'new' | 'edit') {
    const modalTitle = document.querySelector('#newAutomationModal .modal-title') as HTMLElement | null;
    if (!modalTitle) return;

    if (mode === 'edit') {
        modalTitle.innerHTML = '<span class="icon icon-edit icon-sm"></span> Editar Automação';
    } else {
        modalTitle.innerHTML = '<span class="icon icon-add icon-sm"></span> Nova Automação';
    }
}

function resetAutomationForm() {
    const form = document.getElementById('automationForm') as HTMLFormElement | null;
    form?.reset();
    const idInput = document.getElementById('automationId') as HTMLInputElement | null;
    if (idInput) idInput.value = '';
    updateTriggerOptions();
    updateActionOptions();
    setAutomationModalTitle('new');
}

function openAutomationModal() {
    resetAutomationForm();
    const win = window as Window & { openModal?: (id: string) => void };
    win.openModal?.('newAutomationModal');
}

function getAutomationId() {
    const idValue = (document.getElementById('automationId') as HTMLInputElement | null)?.value || '';
    const parsed = parseInt(idValue, 10);
    return Number.isFinite(parsed) ? parsed : null;
}

function getTriggerValue(type: TriggerType): string {
    switch (type) {
        case 'status_change': {
            const fromStatus = (document.getElementById('triggerFromStatus') as HTMLSelectElement | null)?.value || '';
            const toStatus = (document.getElementById('triggerToStatus') as HTMLSelectElement | null)?.value || '';
            if (!fromStatus && !toStatus) return '';
            return JSON.stringify({ from: fromStatus, to: toStatus });
        }
        case 'keyword':
            return (document.getElementById('triggerKeywords') as HTMLInputElement | null)?.value.trim() || '';
        case 'schedule': {
            const time = (document.getElementById('triggerTime') as HTMLInputElement | null)?.value || '';
            const days = Array.from(document.querySelectorAll('#triggerOptionsContainer input[type=\"checkbox\"]:checked'))
                .map(input => (input as HTMLInputElement).value);
            if (!time && days.length === 0) return '';
            return JSON.stringify({ time, days });
        }
        case 'inactivity':
            return (document.getElementById('triggerInactivity') as HTMLSelectElement | null)?.value || '';
        default:
            return '';
    }
}

function applyTriggerValue(type: TriggerType, value?: string | null) {
    if (!value) return;
    try {
        if (type === 'status_change') {
            const parsed = JSON.parse(value);
            const fromStatus = (document.getElementById('triggerFromStatus') as HTMLSelectElement | null);
            const toStatus = (document.getElementById('triggerToStatus') as HTMLSelectElement | null);
            if (fromStatus && parsed?.from !== undefined) fromStatus.value = String(parsed.from);
            if (toStatus && parsed?.to !== undefined) toStatus.value = String(parsed.to);
            return;
        }
        if (type === 'schedule') {
            const parsed = JSON.parse(value);
            const timeInput = document.getElementById('triggerTime') as HTMLInputElement | null;
            if (timeInput && parsed?.time) timeInput.value = parsed.time;
            if (Array.isArray(parsed?.days)) {
                document.querySelectorAll('#triggerOptionsContainer input[type=\"checkbox\"]').forEach(input => {
                    const checkbox = input as HTMLInputElement;
                    checkbox.checked = parsed.days.includes(checkbox.value);
                });
            }
            return;
        }
    } catch (error) {
        // ignore parse errors
    }

    if (type === 'keyword') {
        const keywordInput = document.getElementById('triggerKeywords') as HTMLInputElement | null;
        if (keywordInput) keywordInput.value = value;
    }
    if (type === 'inactivity') {
        const inactivitySelect = document.getElementById('triggerInactivity') as HTMLSelectElement | null;
        if (inactivitySelect) inactivitySelect.value = value;
    }
}

function getActionValue(type: ActionType): string {
    switch (type) {
        case 'send_message':
            return (document.getElementById('actionMessage') as HTMLTextAreaElement | null)?.value.trim() || '';
        case 'change_status':
            return (document.getElementById('actionStatus') as HTMLSelectElement | null)?.value || '';
        case 'add_tag':
            return (document.getElementById('actionTag') as HTMLInputElement | null)?.value.trim() || '';
        case 'start_flow':
            return (document.getElementById('actionFlow') as HTMLSelectElement | null)?.value || '';
        case 'notify':
            return (document.getElementById('actionNotification') as HTMLTextAreaElement | null)?.value.trim() || '';
        default:
            return '';
    }
}

function applyActionValue(type: ActionType, value?: string | null) {
    if (value === undefined || value === null) return;
    if (type === 'send_message') {
        const messageInput = document.getElementById('actionMessage') as HTMLTextAreaElement | null;
        if (messageInput) messageInput.value = value;
        return;
    }
    if (type === 'change_status') {
        const statusSelect = document.getElementById('actionStatus') as HTMLSelectElement | null;
        if (statusSelect) statusSelect.value = value;
        return;
    }
    if (type === 'add_tag') {
        const tagInput = document.getElementById('actionTag') as HTMLInputElement | null;
        if (tagInput) tagInput.value = value;
        return;
    }
    if (type === 'start_flow') {
        const flowSelect = document.getElementById('actionFlow') as HTMLSelectElement | null;
        if (flowSelect) flowSelect.value = value;
        return;
    }
    if (type === 'notify') {
        const notifyInput = document.getElementById('actionNotification') as HTMLTextAreaElement | null;
        if (notifyInput) notifyInput.value = value;
    }
}

function initAutomacao() {
    loadAutomations();
    updateTriggerOptions();
    updateActionOptions();
}

onReady(initAutomacao);

async function loadAutomations() {
    try {
        showLoading('Carregando automações...');
        const response: AutomationsResponse = await api.get('/api/automations');
        automations = response.automations || [];
        updateStats();
        renderAutomations();
        hideLoading();
    } catch (error) {
        hideLoading();
        // Automações de exemplo
        automations = [
            {
                id: 1,
                name: 'Boas-vindas',
                description: 'Envia mensagem de boas-vindas para novos leads',
                trigger_type: 'new_lead',
                trigger_value: '',
                action_type: 'send_message',
                action_value: 'Olá {{nome}}! Seja bem-vindo à ZapVender.',
                delay: 0,
                is_active: true,
                executions: 156,
                last_execution: new Date(Date.now() - 3600000).toISOString()
            },
            {
                id: 2,
                name: 'Follow-up Automático',
                description: 'Envia follow-up após 24h sem resposta',
                trigger_type: 'inactivity',
                trigger_value: '86400',
                action_type: 'send_message',
                action_value: 'Oi {{nome}}, ainda posso te ajudar?',
                delay: 0,
                is_active: true,
                executions: 89,
                last_execution: new Date(Date.now() - 7200000).toISOString()
            },
            {
                id: 3,
                name: 'Notificação de Interesse',
                description: 'Notifica equipe quando lead demonstra interesse',
                trigger_type: 'keyword',
                trigger_value: 'interesse, preço',
                action_type: 'notify',
                action_value: 'Lead interessado: {{nome}}',
                delay: 0,
                is_active: false,
                executions: 45,
                last_execution: new Date(Date.now() - 86400000).toISOString()
            }
        ];
        updateStats();
        renderAutomations();
    }
}

function updateStats() {
    const totalAutomations = document.getElementById('totalAutomations') as HTMLElement | null;
    const activeAutomations = document.getElementById('activeAutomations') as HTMLElement | null;
    const totalExecutions = document.getElementById('totalExecutions') as HTMLElement | null;
    const lastExecution = document.getElementById('lastExecution') as HTMLElement | null;

    if (totalAutomations) totalAutomations.textContent = String(automations.length);
    if (activeAutomations) {
        activeAutomations.textContent = String(automations.filter(a => a.is_active).length);
    }
    if (totalExecutions) {
        totalExecutions.textContent = formatNumber(automations.reduce((sum, a) => sum + (a.executions || 0), 0));
    }
    
    const lastExec = automations
        .filter(a => a.last_execution)
        .sort((a, b) => new Date(b.last_execution as string).getTime() - new Date(a.last_execution as string).getTime())[0];
    if (lastExecution) {
        lastExecution.textContent = lastExec?.last_execution ? timeAgo(lastExec.last_execution) : '-';
    }
}

function renderAutomations() {
    const container = document.getElementById('automationsList') as HTMLElement | null;
    if (!container) return;
    
    if (automations.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1;">
                <div class="empty-state-icon icon icon-empty icon-lg"></div>
                <p>Nenhuma automação criada</p>
                <button class="btn btn-primary mt-3" onclick="openAutomationModal()"><span class="icon icon-add icon-sm"></span> Criar Automação</button>
            </div>
        `;
        return;
    }

    container.innerHTML = automations.map(a => `
        <div class="automation-card">
            <div class="automation-header">
                <h3 class="automation-title">${a.name}</h3>
                <label class="toggle-switch">
                    <input type="checkbox" ${a.is_active ? 'checked' : ''} onchange="toggleAutomation(${a.id}, this.checked)">
                    <span class="toggle-slider"></span>
                </label>
            </div>
            <div class="automation-body">
                <p style="color: var(--gray-600); margin-bottom: 15px; font-size: 13px;">${a.description || 'Sem descrição'}</p>
                
                <div class="automation-trigger">
                    <div class="automation-trigger-icon trigger"><span class="icon icon-bolt icon-sm"></span></div>
                    <div>
                        <div style="font-weight: 600; font-size: 13px;">Gatilho</div>
                        <div style="font-size: 12px; color: var(--gray-500);">${getTriggerLabel(a.trigger_type)}</div>
                    </div>
                </div>
                
                <div class="automation-arrow">↓</div>
                
                <div class="automation-trigger">
                    <div class="automation-trigger-icon action"><span class="icon icon-target icon-sm"></span></div>
                    <div>
                        <div style="font-weight: 600; font-size: 13px;">Ação</div>
                        <div style="font-size: 12px; color: var(--gray-500);">${getActionLabel(a.action_type)}</div>
                    </div>
                </div>
            </div>
            <div class="automation-footer">
                <div style="font-size: 12px; color: var(--gray-500);">
                    <strong>${formatNumber(a.executions || 0)}</strong> execuções
                    ${a.last_execution ? `• Última: ${timeAgo(a.last_execution)}` : ''}
                </div>
                <div style="display: flex; gap: 10px;">
                    <button class="btn btn-sm btn-outline" onclick="editAutomation(${a.id})"><span class="icon icon-edit icon-sm"></span></button>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteAutomation(${a.id})"><span class="icon icon-delete icon-sm"></span></button>
                </div>
            </div>
        </div>
    `).join('');
}

function getTriggerLabel(type: TriggerType | string) {
    const labels = {
        'new_lead': 'Novo lead cadastrado',
        'status_change': 'Mudança de status',
        'message_received': 'Mensagem recebida',
        'keyword': 'Palavra-chave detectada',
        'schedule': 'Agendamento',
        'inactivity': 'Inatividade do lead'
    };
    return labels[type] || type;
}

function getActionLabel(type: ActionType | string) {
    const labels = {
        'send_message': 'Enviar mensagem',
        'change_status': 'Alterar status',
        'add_tag': 'Adicionar tag',
        'start_flow': 'Iniciar fluxo',
        'notify': 'Notificar equipe'
    };
    return labels[type] || type;
}

function updateTriggerOptions() {
    const type = (document.getElementById('triggerType') as HTMLSelectElement | null)?.value || '';
    const container = document.getElementById('triggerOptionsContainer') as HTMLElement | null;
    if (!container) return;
    
    let html = '';
    
    switch (type) {
        case 'status_change':
            html = `
                <label class="form-label">De status</label>
                <select class="form-select" id="triggerFromStatus">
                    <option value="">Qualquer</option>
                    <option value="1">Novo</option>
                    <option value="2">Em Andamento</option>
                    <option value="3">Concluído</option>
                </select>
                <label class="form-label mt-3">Para status</label>
                <select class="form-select" id="triggerToStatus">
                    <option value="">Qualquer</option>
                    <option value="1">Novo</option>
                    <option value="2">Em Andamento</option>
                    <option value="3">Concluído</option>
                </select>
            `;
            break;
        case 'keyword':
            html = `
                <label class="form-label">Palavras-chave (separadas por vírgula)</label>
                <input type="text" class="form-input" id="triggerKeywords" placeholder="interesse, preço, quanto custa">
            `;
            break;
        case 'schedule':
            html = `
                <label class="form-label">Horário de execução</label>
                <input type="time" class="form-input" id="triggerTime">
                <label class="form-label mt-3">Dias da semana</label>
                <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                    <label class="checkbox-wrapper"><input type="checkbox" value="1"><span class="checkbox-custom"></span>Seg</label>
                    <label class="checkbox-wrapper"><input type="checkbox" value="2"><span class="checkbox-custom"></span>Ter</label>
                    <label class="checkbox-wrapper"><input type="checkbox" value="3"><span class="checkbox-custom"></span>Qua</label>
                    <label class="checkbox-wrapper"><input type="checkbox" value="4"><span class="checkbox-custom"></span>Qui</label>
                    <label class="checkbox-wrapper"><input type="checkbox" value="5"><span class="checkbox-custom"></span>Sex</label>
                    <label class="checkbox-wrapper"><input type="checkbox" value="6"><span class="checkbox-custom"></span>Sáb</label>
                    <label class="checkbox-wrapper"><input type="checkbox" value="0"><span class="checkbox-custom"></span>Dom</label>
                </div>
            `;
            break;
        case 'inactivity':
            html = `
                <label class="form-label">Tempo de inatividade</label>
                <select class="form-select" id="triggerInactivity">
                    <option value="3600">1 hora</option>
                    <option value="7200">2 horas</option>
                    <option value="14400">4 horas</option>
                    <option value="28800">8 horas</option>
                    <option value="43200">12 horas</option>
                    <option value="86400">24 horas</option>
                    <option value="172800">48 horas</option>
                    <option value="604800">7 dias</option>
                </select>
            `;
            break;
    }
    
    container.innerHTML = html;
}

function updateActionOptions() {
    const type = (document.getElementById('actionType') as HTMLSelectElement | null)?.value || '';
    const container = document.getElementById('actionOptionsContainer') as HTMLElement | null;
    if (!container) return;
    
    let html = '';
    
    switch (type) {
        case 'send_message':
            html = `
                <label class="form-label">Mensagem</label>
                <textarea class="form-textarea" id="actionMessage" rows="4" placeholder="Olá {{nome}}! Seja bem-vindo...

Variáveis: {{nome}}, {{veiculo}}, {{placa}}"></textarea>
            `;
            break;
        case 'change_status':
            html = `
                <label class="form-label">Novo status</label>
                <select class="form-select" id="actionStatus">
                    <option value="1">Novo</option>
                    <option value="2">Em Andamento</option>
                    <option value="3">Concluído</option>
                    <option value="4">Perdido</option>
                </select>
            `;
            break;
        case 'add_tag':
            html = `
                <label class="form-label">Tag</label>
                <input type="text" class="form-input" id="actionTag" placeholder="Nome da tag">
            `;
            break;
        case 'start_flow':
            html = `
                <label class="form-label">Fluxo</label>
                <select class="form-select" id="actionFlow">
                    <option value="">Selecione um fluxo...</option>
                </select>
            `;
            break;
        case 'notify':
            html = `
                <label class="form-label">Mensagem de notificação</label>
                <textarea class="form-textarea" id="actionNotification" rows="2" placeholder="Novo lead interessado: {{nome}}"></textarea>
            `;
            break;
    }
    
    container.innerHTML = html;
}

async function toggleAutomation(id: number, active: boolean) {
    try {
        await api.put(`/api/automations/${id}`, { is_active: active });
        const automation = automations.find(a => a.id === id);
        if (automation) automation.is_active = active;
        updateStats();
        showToast('success', 'Sucesso', `Automação ${active ? 'ativada' : 'desativada'}!`);
    } catch (error) {
        const automation = automations.find(a => a.id === id);
        if (automation) automation.is_active = active;
        updateStats();
        showToast('success', 'Sucesso', `Automação ${active ? 'ativada' : 'desativada'}!`);
    }
}

async function saveAutomation() {
    const automationId = getAutomationId();
    const name = (document.getElementById('automationName') as HTMLInputElement | null)?.value.trim() || '';
    const description = (document.getElementById('automationDescription') as HTMLInputElement | null)?.value.trim() || '';
    const triggerType = ((document.getElementById('triggerType') as HTMLSelectElement | null)?.value || '') as TriggerType;
    const actionType = ((document.getElementById('actionType') as HTMLSelectElement | null)?.value || '') as ActionType;
    const delay = parseInt((document.getElementById('actionDelay') as HTMLInputElement | null)?.value || '0', 10);

    if (!name) {
        showToast('error', 'Erro', 'Nome ? obrigat?rio');
        return;
    }

    const triggerValue = getTriggerValue(triggerType);
    const actionValue = getActionValue(actionType);
    const existing = automationId ? automations.find(a => a.id === automationId) : null;

    const data: Omit<Automation, 'id' | 'executions' | 'last_execution'> = {
        name,
        description,
        trigger_type: triggerType,
        trigger_value: triggerValue,
        action_type: actionType,
        action_value: actionValue,
        delay,
        is_active: existing ? existing.is_active : true
    };

    try {
        showLoading('Salvando...');
        if (automationId) {
            await api.put(`/api/automations/${automationId}`, data);
        } else {
            await api.post('/api/automations', data);
        }
        closeModal('newAutomationModal');
        resetAutomationForm();
        await loadAutomations();
        showToast('success', 'Sucesso', automationId ? 'Automa??o atualizada!' : 'Automa??o criada!');
    } catch (error) {
        hideLoading();
        if (automationId) {
            const index = automations.findIndex(a => a.id === automationId);
            if (index >= 0) {
                automations[index] = {
                    ...automations[index],
                    ...data
                };
            }
            showToast('success', 'Sucesso', 'Automa??o atualizada!');
        } else {
            // Simular sucesso
            automations.push({
                id: automations.length + 1,
                ...data,
                executions: 0,
                last_execution: null
            });
            showToast('success', 'Sucesso', 'Automa??o criada!');
        }
        closeModal('newAutomationModal');
        resetAutomationForm();
        renderAutomations();
        updateStats();
    }
}

function editAutomation(id: number) {
    const automation = automations.find(a => a.id === id);
    if (!automation) return;

    const idInput = document.getElementById('automationId') as HTMLInputElement | null;
    if (idInput) idInput.value = String(automation.id);

    const nameInput = document.getElementById('automationName') as HTMLInputElement | null;
    if (nameInput) nameInput.value = automation.name || '';

    const descriptionInput = document.getElementById('automationDescription') as HTMLInputElement | null;
    if (descriptionInput) descriptionInput.value = automation.description || '';

    const triggerSelect = document.getElementById('triggerType') as HTMLSelectElement | null;
    if (triggerSelect) triggerSelect.value = automation.trigger_type;
    updateTriggerOptions();
    applyTriggerValue(automation.trigger_type, automation.trigger_value);

    const actionSelect = document.getElementById('actionType') as HTMLSelectElement | null;
    if (actionSelect) actionSelect.value = automation.action_type;
    updateActionOptions();
    applyActionValue(automation.action_type, automation.action_value);

    const delaySelect = document.getElementById('actionDelay') as HTMLSelectElement | null;
    if (delaySelect) delaySelect.value = String(automation.delay || 0);

    setAutomationModalTitle('edit');

    const win = window as Window & { openModal?: (id: string) => void };
    win.openModal?.('newAutomationModal');
}

async function deleteAutomation(id: number) {
    if (!confirm('Excluir esta automa??o?')) return;

    try {
        await api.delete(`/api/automations/${id}`);
    } catch (error) {
        // fallback local
    }

    automations = automations.filter(a => a.id !== id);
    renderAutomations();
    updateStats();
    showToast('success', 'Sucesso', 'Automa??o exclu?da!');
}

const windowAny = window as Window & {
    initAutomacao?: () => void;
    loadAutomations?: () => void;
    openAutomationModal?: () => void;
    updateTriggerOptions?: () => void;
    updateActionOptions?: () => void;
    toggleAutomation?: (id: number, active: boolean) => Promise<void>;
    saveAutomation?: () => Promise<void>;
    editAutomation?: (id: number) => void;
    deleteAutomation?: (id: number) => Promise<void>;
};
windowAny.initAutomacao = initAutomacao;
windowAny.loadAutomations = loadAutomations;
windowAny.openAutomationModal = openAutomationModal;
windowAny.updateTriggerOptions = updateTriggerOptions;
windowAny.updateActionOptions = updateActionOptions;
windowAny.toggleAutomation = toggleAutomation;
windowAny.saveAutomation = saveAutomation;
windowAny.editAutomation = editAutomation;
windowAny.deleteAutomation = deleteAutomation;

export { initAutomacao };
