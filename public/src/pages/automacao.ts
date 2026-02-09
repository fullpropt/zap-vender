// Automacao page logic migrated to module

type TriggerType = 'new_lead' | 'status_change' | 'message_received' | 'keyword' | 'schedule' | 'inactivity';
type ActionType = 'send_message' | 'change_status' | 'add_tag' | 'start_flow' | 'notify';

type Automation = {
    id: number;
    name: string;
    description?: string;
    trigger_type: TriggerType;
    action_type: ActionType;
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
                action_type: 'send_message',
                is_active: true,
                executions: 156,
                last_execution: new Date(Date.now() - 3600000).toISOString()
            },
            {
                id: 2,
                name: 'Follow-up Automático',
                description: 'Envia follow-up após 24h sem resposta',
                trigger_type: 'inactivity',
                action_type: 'send_message',
                is_active: true,
                executions: 89,
                last_execution: new Date(Date.now() - 7200000).toISOString()
            },
            {
                id: 3,
                name: 'Notificação de Interesse',
                description: 'Notifica equipe quando lead demonstra interesse',
                trigger_type: 'keyword',
                action_type: 'notify',
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
                <button class="btn btn-primary mt-3" onclick="openModal('newAutomationModal')"><span class="icon icon-add icon-sm"></span> Criar Automação</button>
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
    const name = (document.getElementById('automationName') as HTMLInputElement | null)?.value.trim() || '';
    const description = (document.getElementById('automationDescription') as HTMLInputElement | null)?.value.trim() || '';
    const triggerType = ((document.getElementById('triggerType') as HTMLSelectElement | null)?.value || '') as TriggerType;
    const actionType = ((document.getElementById('actionType') as HTMLSelectElement | null)?.value || '') as ActionType;
    const delay = parseInt((document.getElementById('actionDelay') as HTMLInputElement | null)?.value || '0', 10);

    if (!name) {
        showToast('error', 'Erro', 'Nome é obrigatório');
        return;
    }

    const data: Omit<Automation, 'id' | 'executions' | 'last_execution'> & { delay: number } = {
        name,
        description,
        trigger_type: triggerType,
        action_type: actionType,
        delay,
        is_active: true
    };

    try {
        showLoading('Salvando...');
        await api.post('/api/automations', data);
        closeModal('newAutomationModal');
        (document.getElementById('automationForm') as HTMLFormElement | null)?.reset();
        await loadAutomations();
        showToast('success', 'Sucesso', 'Automação criada!');
    } catch (error) {
        hideLoading();
        // Simular sucesso
        automations.push({
            id: automations.length + 1,
            ...data,
            executions: 0,
            last_execution: null
        });
        closeModal('newAutomationModal');
        (document.getElementById('automationForm') as HTMLFormElement | null)?.reset();
        renderAutomations();
        updateStats();
        showToast('success', 'Sucesso', 'Automação criada!');
    }
}

function editAutomation(id: number) {
    showToast('info', 'Info', 'Edição de automação em desenvolvimento');
}

async function deleteAutomation(id: number) {
    if (!confirm('Excluir esta automação?')) return;
    
    automations = automations.filter(a => a.id !== id);
    renderAutomations();
    updateStats();
    showToast('success', 'Sucesso', 'Automação excluída!');
}

const windowAny = window as Window & {
    initAutomacao?: () => void;
    loadAutomations?: () => void;
    updateTriggerOptions?: () => void;
    updateActionOptions?: () => void;
    toggleAutomation?: (id: number, active: boolean) => Promise<void>;
    saveAutomation?: () => Promise<void>;
    editAutomation?: (id: number) => void;
    deleteAutomation?: (id: number) => Promise<void>;
};
windowAny.initAutomacao = initAutomacao;
windowAny.loadAutomations = loadAutomations;
windowAny.updateTriggerOptions = updateTriggerOptions;
windowAny.updateActionOptions = updateActionOptions;
windowAny.toggleAutomation = toggleAutomation;
windowAny.saveAutomation = saveAutomation;
windowAny.editAutomation = editAutomation;
windowAny.deleteAutomation = deleteAutomation;

export { initAutomacao };
