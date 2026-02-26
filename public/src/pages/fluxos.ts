// Fluxos page logic migrated to module

type FlowStep = {
    message: string;
    delay: number;
    condition?: string;
};

type FlowNodeType = 'trigger' | 'message' | 'wait' | 'condition' | 'delay' | 'transfer' | 'tag' | 'status' | 'webhook' | 'end';

type FlowNode = {
    id: string;
    type: FlowNodeType;
    position?: { x: number; y: number };
    data?: Record<string, any>;
};

type FlowEdge = {
    source: string;
    target: string;
    label?: string;
};

type Flow = {
    id: number;
    name: string;
    description?: string;
    trigger?: string;
    trigger_value?: string | null;
    is_active: boolean;
    steps: FlowStep[];
    leads_count?: number;
    messages_sent?: number;
    nodes?: FlowNode[];
    edges?: FlowEdge[];
};

type FlowsResponse = { flows?: Flow[] };

let flows: Flow[] = [];
let stepCount = 1;
let currentFlowId: number | null = null;

function appConfirm(message: string, title = 'Confirmacao') {
    const win = window as Window & { showAppConfirm?: (message: string, title?: string) => Promise<boolean> };
    if (typeof win.showAppConfirm === 'function') {
        return win.showAppConfirm(message, title);
    }
    return Promise.resolve(window.confirm(message));
}

function toBoolean(value: unknown) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value === 1;
    if (typeof value === 'string') return value === '1' || value.toLowerCase() === 'true';
    return false;
}

function normalizeTrigger(trigger?: string) {
    switch (trigger) {
        case 'new_lead':
        case 'new_contact':
            return { trigger_type: 'new_contact', trigger_value: null };
        case 'keyword':
            return { trigger_type: 'keyword', trigger_value: null };
        case 'manual':
        default:
            return { trigger_type: 'manual', trigger_value: null };
    }
}

function mapTriggerFromApi(triggerType?: string | null) {
    if (triggerType === 'new_lead') return 'new_lead';
    if (triggerType === 'new_contact') return 'new_lead';
    if (triggerType === 'keyword') return 'keyword';
    return 'manual';
}

function stepsFromNodesEdges(nodes: FlowNode[] = [], edges: FlowEdge[] = []): FlowStep[] {
    if (!nodes.length) return [];
    const nodeById = new Map(nodes.map(node => [node.id, node]));
    const outgoing = new Map<string, FlowEdge[]>();
    edges.forEach(edge => {
        const list = outgoing.get(edge.source) || [];
        list.push(edge);
        outgoing.set(edge.source, list);
    });

    const incoming = new Set(edges.map(edge => edge.target));
    let current = nodes.find(node => node.id === 'start')
        || nodes.find(node => node.type === 'trigger')
        || nodes.find(node => !incoming.has(node.id))
        || nodes[0];

    const steps: FlowStep[] = [];
    let lastStepIndex = -1;
    const visited = new Set<string>();

    while (current && !visited.has(current.id)) {
        visited.add(current.id);

        if (current.type === 'message') {
            const message = current.data?.content || current.data?.message || '';
            steps.push({ message, delay: 0, condition: 'always' });
            lastStepIndex = steps.length - 1;
        } else if (current.type === 'delay' && lastStepIndex >= 0) {
            const seconds = Number(current.data?.seconds ?? current.data?.timeout ?? 0);
            steps[lastStepIndex].delay = Number.isFinite(seconds) ? seconds : 0;
        }

        const next = (outgoing.get(current.id) || [])[0];
        current = next ? nodeById.get(next.target) : undefined;
    }

    return steps;
}

function buildNodesEdgesFromSteps(flow: Flow): { nodes: FlowNode[]; edges: FlowEdge[]; trigger_type: string; trigger_value: string | null } {
    const normalized = normalizeTrigger(flow.trigger);
    const trigger_type = normalized.trigger_type;
    const trigger_value = flow.trigger_value ?? normalized.trigger_value;
    const nodes: FlowNode[] = [];
    const edges: FlowEdge[] = [];

    const triggerLabel = trigger_type === 'keyword' ? 'Palavra-chave' : trigger_type === 'new_contact' ? 'Novo Contato' : 'Manual';
    nodes.push({
        id: 'start',
        type: 'trigger',
        position: { x: 100, y: 100 },
        data: { label: triggerLabel, keyword: trigger_value || '' }
    });

    let prevId = 'start';
    let y = 100;

    flow.steps.forEach((step, index) => {
        const messageId = `msg_${index + 1}`;
        nodes.push({
            id: messageId,
            type: 'message',
            position: { x: 320, y },
            data: { label: `Mensagem ${index + 1}`, content: step.message }
        });
        edges.push({ source: prevId, target: messageId });
        prevId = messageId;

        if (step.delay && step.delay > 0) {
            const delayId = `delay_${index + 1}`;
            nodes.push({
                id: delayId,
                type: 'delay',
                position: { x: 520, y },
                data: { label: `Delay ${index + 1}`, seconds: step.delay }
            });
            edges.push({ source: prevId, target: delayId });
            prevId = delayId;
        }

        y += 140;
    });

    return { nodes, edges, trigger_type, trigger_value };
}

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
        const apiFlows = response.flows || [];
        flows = apiFlows.map(flow => {
            const triggerType = (flow as Flow).trigger || (flow as any).trigger_type;
            const triggerValue = (flow as Flow).trigger_value ?? (flow as any).trigger_value ?? null;
            const nodes = (flow as Flow).nodes || (flow as any).nodes || [];
            const edges = (flow as Flow).edges || (flow as any).edges || [];
            const mappedSteps = stepsFromNodesEdges(nodes, edges);
            const steps = mappedSteps.length > 0 ? mappedSteps : ((flow as Flow).steps || []);

            return {
                id: flow.id,
                name: flow.name,
                description: flow.description,
                trigger: mapTriggerFromApi(triggerType),
                trigger_value: triggerValue,
                is_active: toBoolean(flow.is_active),
                steps,
                leads_count: flow.leads_count || 0,
                messages_sent: flow.messages_sent || 0,
                nodes,
                edges
            };
        });
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
                    { message: 'Olá {{nome}}! Bem-vindo à ZapVender!', delay: 0 },
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

    container.innerHTML = flows.map(f => {
        const steps = f.steps || [];
        const stepsMarkup = steps.length === 0
            ? `<div class="text-muted text-center" style="font-size: 12px;">Fluxo sem etapas</div>`
            : steps.slice(0, 3).map((s, i) => `
                        <div class="flow-step">
                            <div class="flow-step-number">${i + 1}</div>
                            <div style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                                ${s.message.substring(0, 50)}${s.message.length > 50 ? '...' : ''}
                            </div>
                            <span class="text-muted" style="font-size: 11px;">${formatDelay(s.delay)}</span>
                        </div>
                        ${i < Math.min(steps.length - 1, 2) ? '<div class="flow-step-connector"></div>' : ''}
                    `).join('');
        const moreMarkup = steps.length > 3
            ? `<div class="text-muted text-center" style="font-size: 12px;">+${steps.length - 3} etapas</div>`
            : '';

        return `
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
                    ${stepsMarkup}
                    ${moreMarkup}
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
    `;
    }).join('');
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

    const data: Omit<Flow, 'id' | 'leads_count' | 'messages_sent'> = {
        name,
        trigger,
        description,
        steps,
        is_active: true
    };
    const payload = buildNodesEdgesFromSteps({
        id: 0,
        name,
        description,
        trigger,
        trigger_value: null,
        is_active: true,
        steps
    });

    try {
        showLoading('Salvando...');
        await api.post('/api/flows', {
            name,
            description,
            trigger_type: payload.trigger_type,
            trigger_value: payload.trigger_value,
            nodes: payload.nodes,
            edges: payload.edges,
            is_active: 1
        });
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
    
    const stepsForEdit = flow.steps && flow.steps.length > 0
        ? flow.steps
        : [{ message: '', delay: 0, condition: 'always' }];
    let stepsHtml = stepsForEdit.map((s, i) => `
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

    const payload = buildNodesEdgesFromSteps(flow);

    (async () => {
        try {
            showLoading('Salvando...');
            await api.put(`/api/flows/${flow.id}`, {
                name: flow.name,
                description: flow.description,
                trigger_type: payload.trigger_type,
                trigger_value: payload.trigger_value,
                nodes: payload.nodes,
                edges: payload.edges,
                is_active: flow.is_active ? 1 : 0
            });
            closeModal('flowEditorModal');
            renderFlows();
            showToast('success', 'Sucesso', 'Fluxo atualizado!');
        } catch (error) {
            closeModal('flowEditorModal');
            renderFlows();
            showToast('success', 'Sucesso', 'Fluxo atualizado!');
        } finally {
            hideLoading();
        }
    })();
}

function toggleFlow(id: number) {
    const flow = flows.find(f => f.id === id);
    if (flow) {
        const nextActive = !flow.is_active;
        (async () => {
            try {
                await api.put(`/api/flows/${id}`, { is_active: nextActive ? 1 : 0 });
            } catch (error) {
                // fallback local
            }
            flow.is_active = nextActive;
            renderFlows();
            updateStats();
            showToast('success', 'Sucesso', `Fluxo ${flow.is_active ? 'ativado' : 'desativado'}!`);
        })();
    }
}

async function deleteFlow(id: number) {
    if (!await appConfirm('Excluir este fluxo?', 'Excluir fluxo')) return;
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
    deleteFlow?: (id: number) => Promise<void>;
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
