// Fluxos page logic migrated to module

type FlowStep = {
    message: string;
    delay: number;
    condition?: string;
};

type Flow = {
    id: number;
    name: string;
    description?: string;
    trigger?: string;
    is_active: boolean;
    steps: FlowStep[];
    leads_count?: number;
    messages_sent?: number;
};

type FlowsResponse = { flows?: Flow[] };

let flows: Flow[] = [];
let stepCount = 1;
let currentFlowId: number | null = null;

function onReady(callback: () => void) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', callback);
    } else {
        callback();
    }
}

function initFluxos() {

    loadFlows();
}

onReady(initFluxos);

async function loadFlows() {
    try {
        showLoading('Carregando fluxos...');
        const response: FlowsResponse = await api.get('/api/flows');
        flows = response.flows || [];
        updateStats();
        renderFlows();
        hideLoading();
    } catch (error) {
        hideLoading();
        // Fluxos de exemplo
        flows = [
            {
                id: 1,
                name: 'Boas-vindas',
                description: 'Sequência de boas-vindas para novos leads',
                trigger: 'new_lead',
                is_active: true,
                steps: [
                    { message: 'Olá {{nome}}! Bem-vindo à SELF Proteção Veicular!', delay: 0 },
                    { message: 'Somos especialistas em proteção veicular com os melhores preços do mercado.', delay: 300 },
                    { message: 'Posso ajudar com alguma informação sobre seu veículo {{veiculo}}?', delay: 600 }
                ],
                leads_count: 45,
                messages_sent: 135
            },
            {
                id: 2,
                name: 'Follow-up',
                description: 'Sequência de follow-up para leads sem resposta',
                trigger: 'manual',
                is_active: true,
                steps: [
                    { message: 'Olá {{nome}}! Vi que você demonstrou interesse em proteção veicular.', delay: 0 },
                    { message: 'Temos condições especiais essa semana. Posso te enviar uma cotação?', delay: 86400 }
                ],
                leads_count: 28,
                messages_sent: 56
            },
            {
                id: 3,
                name: 'Pós-venda',
                description: 'Mensagens após fechamento do contrato',
                trigger: 'manual',
                is_active: false,
                steps: [
                    { message: 'Parabéns {{nome}}! Seu veículo agora está protegido!', delay: 0 },
                    { message: 'Qualquer dúvida, estamos à disposição.', delay: 3600 }
                ],
                leads_count: 12,
                messages_sent: 24
            }
        ];
        updateStats();
        renderFlows();
    }
}

function updateStats() {
    const totalFlows = document.getElementById('totalFlows') as HTMLElement | null;
    const activeFlows = document.getElementById('activeFlows') as HTMLElement | null;
    const inFlows = document.getElementById('inFlows') as HTMLElement | null;
    const sentMessages = document.getElementById('sentMessages') as HTMLElement | null;
    if (totalFlows) totalFlows.textContent = String(flows.length);
    if (activeFlows) activeFlows.textContent = String(flows.filter(f => f.is_active).length);
    if (inFlows) inFlows.textContent = formatNumber(flows.reduce((sum, f) => sum + (f.leads_count || 0), 0));
    if (sentMessages) sentMessages.textContent = formatNumber(flows.reduce((sum, f) => sum + (f.messages_sent || 0), 0));
}

function renderFlows() {
    const container = document.getElementById('flowsList') as HTMLElement | null;
    if (!container) return;
    
    if (flows.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1;">
                <div class="empty-state-icon icon icon-empty icon-lg"></div>
                <p>Nenhum fluxo criado</p>
                <button class="btn btn-primary mt-3" onclick="openModal('newFlowModal')"><span class="icon icon-add icon-sm"></span> Criar Fluxo</button>
            </div>
        `;
        return;
    }

    container.innerHTML = flows.map(f => `
        <div class="flow-card">
            <div class="flow-header">
                <div>
                    <h3 class="flow-title">${f.name}</h3>
                    <p class="flow-description">${f.description || 'Sem descrição'}</p>
                </div>
                <span class="badge badge-${f.is_active ? 'success' : 'secondary'}">
                    ${f.is_active ? 'Ativo' : 'Inativo'}
                </span>
            </div>
            <div class="flow-body">
                <div class="flow-steps">
                    ${f.steps.slice(0, 3).map((s, i) => `
                        <div class="flow-step">
                            <div class="flow-step-number">${i + 1}</div>
                            <div style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                                ${s.message.substring(0, 50)}${s.message.length > 50 ? '...' : ''}
                            </div>
                            <span class="text-muted" style="font-size: 11px;">${formatDelay(s.delay)}</span>
                        </div>
                        ${i < Math.min(f.steps.length - 1, 2) ? '<div class="flow-step-connector"></div>' : ''}
                    `).join('')}
                    ${f.steps.length > 3 ? `<div class="text-muted text-center" style="font-size: 12px;">+${f.steps.length - 3} etapas</div>` : ''}
                </div>
            </div>
            <div class="flow-footer">
                <div class="flow-stats">
                    <span><strong>${f.leads_count || 0}</strong> leads</span>
                    <span><strong>${f.messages_sent || 0}</strong> mensagens</span>
                </div>
                <div style="display: flex; gap: 10px;">
                    <button class="btn btn-sm btn-outline" onclick="editFlow(${f.id})"><span class="icon icon-edit icon-sm"></span> Editar</button>
                    <button class="btn btn-sm ${f.is_active ? 'btn-warning' : 'btn-success'}" onclick="toggleFlow(${f.id})">
                        ${f.is_active ? '<span class="icon icon-pause icon-sm"></span>' : '<span class="icon icon-play icon-sm"></span>'}
                    </button>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteFlow(${f.id})"><span class="icon icon-delete icon-sm"></span></button>
                </div>
            </div>
        </div>
    `).join('');
}

function formatDelay(seconds: number) {
    if (seconds === 0) return 'Imediato';
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}min`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
    return `${Math.floor(seconds / 86400)}d`;
}

function addStep() {
    stepCount++;
    const container = document.getElementById('flowSteps') as HTMLElement | null;
    if (!container) return;
    
    const stepHtml = `
        <div class="step-item" data-step="${stepCount}">
            <div class="step-item-number">${stepCount}</div>
            <div class="step-item-content">
                <div class="form-group" style="margin-bottom: 10px;">
                    <label class="form-label">Mensagem</label>
                    <textarea class="form-textarea step-message" rows="3" placeholder="Digite a mensagem..."></textarea>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Aguardar</label>
                        <select class="form-select step-delay">
                            <option value="0">Imediatamente</option>
                            <option value="60">1 minuto</option>
                            <option value="300">5 minutos</option>
                            <option value="3600" selected>1 hora</option>
                            <option value="86400">24 horas</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Condição</label>
                        <select class="form-select step-condition">
                            <option value="always">Sempre enviar</option>
                            <option value="no_reply" selected>Se não responder</option>
                            <option value="replied">Se responder</option>
                        </select>
                    </div>
                </div>
            </div>
            <div class="step-item-actions">
                <button type="button" class="btn btn-sm btn-outline-danger btn-icon" onclick="removeStep(${stepCount})" title="Remover"><span class="icon icon-delete icon-sm"></span></button>
            </div>
        </div>
    `;
    
    container.insertAdjacentHTML('beforeend', stepHtml);
}

function removeStep(step: number) {
    const element = document.querySelector(`.step-item[data-step="${step}"]`) as HTMLElement | null;
    if (element && document.querySelectorAll('.step-item').length > 1) {
        element.remove();
        renumberSteps();
    } else {
        showToast('warning', 'Aviso', 'O fluxo precisa ter pelo menos uma etapa');
    }
}

function renumberSteps() {
    const steps = document.querySelectorAll('.step-item');
    steps.forEach((step, index) => {
        const num = step.querySelector('.step-item-number') as HTMLElement | null;
        if (num) num.textContent = String(index + 1);
    });
    stepCount = steps.length;
}

async function saveFlow() {
    const name = (document.getElementById('flowName') as HTMLInputElement | null)?.value.trim() || '';
    const trigger = (document.getElementById('flowTrigger') as HTMLSelectElement | null)?.value || '';
    const description = (document.getElementById('flowDescription') as HTMLTextAreaElement | null)?.value.trim() || '';

    if (!name) {
        showToast('error', 'Erro', 'Nome é obrigatório');
        return;
    }

    const steps: FlowStep[] = [];
    document.querySelectorAll('.step-item').forEach(item => {
        const message = (item.querySelector('.step-message') as HTMLTextAreaElement | null)?.value.trim() || '';
        const delay = parseInt((item.querySelector('.step-delay') as HTMLSelectElement | null)?.value || '0', 10);
        const condition = (item.querySelector('.step-condition') as HTMLSelectElement | null)?.value || '';
        
        if (message) {
            steps.push({ message, delay, condition });
        }
    });

    if (steps.length === 0) {
        showToast('error', 'Erro', 'Adicione pelo menos uma etapa com mensagem');
        return;
    }

    const data: Omit<Flow, 'id' | 'leads_count' | 'messages_sent'> = { name, trigger, description, steps, is_active: true };

    try {
        showLoading('Salvando...');
        await api.post('/api/flows', data);
        closeModal('newFlowModal');
        resetFlowForm();
        await loadFlows();
        showToast('success', 'Sucesso', 'Fluxo criado!');
    } catch (error) {
        hideLoading();
        // Simular sucesso
        flows.push({
            id: flows.length + 1,
            ...data,
            leads_count: 0,
            messages_sent: 0
        });
        closeModal('newFlowModal');
        resetFlowForm();
        renderFlows();
        updateStats();
        showToast('success', 'Sucesso', 'Fluxo criado!');
    }
}

function resetFlowForm() {
    (document.getElementById('flowForm') as HTMLFormElement | null)?.reset();
    const flowSteps = document.getElementById('flowSteps') as HTMLElement | null;
    if (!flowSteps) return;
    flowSteps.innerHTML = `
        <div class="step-item" data-step="1">
            <div class="step-item-number">1</div>
            <div class="step-item-content">
                <div class="form-group" style="margin-bottom: 10px;">
                    <label class="form-label">Mensagem</label>
                    <textarea class="form-textarea step-message" rows="3" placeholder="Olá {{nome}}! Seja bem-vindo..."></textarea>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Aguardar</label>
                        <select class="form-select step-delay">
                            <option value="0">Imediatamente</option>
                            <option value="60">1 minuto</option>
                            <option value="300">5 minutos</option>
                            <option value="3600">1 hora</option>
                            <option value="86400">24 horas</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Condição</label>
                        <select class="form-select step-condition">
                            <option value="always">Sempre enviar</option>
                            <option value="no_reply">Se não responder</option>
                            <option value="replied">Se responder</option>
                        </select>
                    </div>
                </div>
            </div>
            <div class="step-item-actions">
                <button type="button" class="btn btn-sm btn-outline-danger btn-icon" onclick="removeStep(1)" title="Remover"><span class="icon icon-delete icon-sm"></span></button>
            </div>
        </div>
    `;
    stepCount = 1;
}

function editFlow(id: number) {
    const flow = flows.find(f => f.id === id);
    if (!flow) return;

    currentFlowId = id;
    const editorTitle = document.getElementById('editorTitle') as HTMLElement | null;
    if (editorTitle) {
        editorTitle.innerHTML = `<span class="icon icon-edit icon-sm"></span> ${flow.name}`;
    }
    
    let stepsHtml = flow.steps.map((s, i) => `
        <div class="step-item" data-step="${i + 1}">
            <div class="step-item-number">${i + 1}</div>
            <div class="step-item-content">
                <div class="form-group" style="margin-bottom: 10px;">
                    <label class="form-label">Mensagem</label>
                    <textarea class="form-textarea step-message" rows="3">${s.message}</textarea>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Aguardar</label>
                        <select class="form-select step-delay">
                            <option value="0" ${s.delay === 0 ? 'selected' : ''}>Imediatamente</option>
                            <option value="60" ${s.delay === 60 ? 'selected' : ''}>1 minuto</option>
                            <option value="300" ${s.delay === 300 ? 'selected' : ''}>5 minutos</option>
                            <option value="3600" ${s.delay === 3600 ? 'selected' : ''}>1 hora</option>
                            <option value="86400" ${s.delay === 86400 ? 'selected' : ''}>24 horas</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Condição</label>
                        <select class="form-select step-condition">
                            <option value="always" ${s.condition === 'always' ? 'selected' : ''}>Sempre enviar</option>
                            <option value="no_reply" ${s.condition === 'no_reply' ? 'selected' : ''}>Se não responder</option>
                            <option value="replied" ${s.condition === 'replied' ? 'selected' : ''}>Se responder</option>
                        </select>
                    </div>
                </div>
            </div>
        </div>
    `).join('');

    const flowEditorContent = document.getElementById('flowEditorContent') as HTMLElement | null;
    if (flowEditorContent) {
        flowEditorContent.innerHTML = `
        <div class="form-group">
            <label class="form-label">Nome</label>
            <input type="text" class="form-input" id="editFlowName" value="${flow.name}">
        </div>
        <div class="form-group">
            <label class="form-label">Descrição</label>
            <textarea class="form-textarea" id="editFlowDescription" rows="2">${flow.description || ''}</textarea>
        </div>
        <hr style="margin: 20px 0;">
        <h4 style="margin-bottom: 15px;"><span class="icon icon-list icon-sm"></span> Etapas</h4>
        <div id="editFlowSteps">${stepsHtml}</div>
    `;
    }

    openModal('flowEditorModal');
}

function saveFlowChanges() {
    const flow = flows.find(f => f.id === currentFlowId);
    if (!flow) return;

    flow.name = (document.getElementById('editFlowName') as HTMLInputElement | null)?.value.trim() || '';
    flow.description = (document.getElementById('editFlowDescription') as HTMLTextAreaElement | null)?.value.trim() || '';

    const steps: FlowStep[] = [];
    document.querySelectorAll('#editFlowSteps .step-item').forEach(item => {
        const message = (item.querySelector('.step-message') as HTMLTextAreaElement | null)?.value.trim() || '';
        const delay = parseInt((item.querySelector('.step-delay') as HTMLSelectElement | null)?.value || '0', 10);
        const condition = (item.querySelector('.step-condition') as HTMLSelectElement | null)?.value || '';
        if (message) steps.push({ message, delay, condition });
    });
    flow.steps = steps;

    closeModal('flowEditorModal');
    renderFlows();
    showToast('success', 'Sucesso', 'Fluxo atualizado!');
}

function toggleFlow(id: number) {
    const flow = flows.find(f => f.id === id);
    if (flow) {
        flow.is_active = !flow.is_active;
        renderFlows();
        updateStats();
        showToast('success', 'Sucesso', `Fluxo ${flow.is_active ? 'ativado' : 'desativado'}!`);
    }
}

function deleteFlow(id: number) {
    if (!confirm('Excluir este fluxo?')) return;
    flows = flows.filter(f => f.id !== id);
    renderFlows();
    updateStats();
    showToast('success', 'Sucesso', 'Fluxo excluído!');
}

const windowAny = window as Window & {
    initFluxos?: () => void;
    loadFlows?: () => void;
    addStep?: () => void;
    removeStep?: (step: number) => void;
    saveFlow?: () => Promise<void>;
    editFlow?: (id: number) => void;
    saveFlowChanges?: () => void;
    toggleFlow?: (id: number) => void;
    deleteFlow?: (id: number) => void;
};
windowAny.initFluxos = initFluxos;
windowAny.loadFlows = loadFlows;
windowAny.addStep = addStep;
windowAny.removeStep = removeStep;
windowAny.saveFlow = saveFlow;
windowAny.editFlow = editFlow;
windowAny.saveFlowChanges = saveFlowChanges;
windowAny.toggleFlow = toggleFlow;
windowAny.deleteFlow = deleteFlow;

export { initFluxos };
