// Transmissao page logic migrated to module

type LeadStatus = 1 | 2 | 3 | 4;

type Contact = {
    id: number;
    name?: string;
    phone?: string;
    status: LeadStatus;
};

type Template = { id: number; name: string; content: string };
type LeadsResponse = { leads?: Contact[] };
type TemplatesResponse = { templates?: Template[] };
type WhatsappSessionItem = {
    session_id: string;
    status?: string;
    connected?: boolean;
};
type QueueItem = {
    id: number;
    status: 'pending' | 'processing' | 'sent' | 'failed';
    lead_name?: string;
    lead_phone?: string;
    processed_at?: string;
};
type QueueResponse = { queue?: QueueItem[] };

let allContacts: Contact[] = [];
let filteredContacts: Contact[] = [];
let selectedContacts = new Set<number>();
let templates: Template[] = [];
let queueInterval: number | null = null;

function appConfirm(message: string, title = 'Confirmacao') {
    const win = window as Window & { showAppConfirm?: (message: string, title?: string) => Promise<boolean> };
    if (typeof win.showAppConfirm === 'function') {
        return win.showAppConfirm(message, title);
    }
    return Promise.resolve(window.confirm(message));
}

function onReady(callback: () => void) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', callback);
    } else {
        callback();
    }
}

function initTransmissao() {
    loadContacts();
    loadTemplates();
    loadQueueStatus();
    
    const startTime = document.getElementById('startTime') as HTMLSelectElement | null;
    const scheduledTimeGroup = document.getElementById('scheduledTimeGroup') as HTMLElement | null;
    startTime?.addEventListener('change', (e) => {
        if (!scheduledTimeGroup) return;
        scheduledTimeGroup.style.display = 
            (e.target as HTMLSelectElement).value === 'scheduled' ? 'block' : 'none';
    });

    // Atualizar fila a cada 5 segundos
    if (queueInterval === null) {
        queueInterval = window.setInterval(loadQueueStatus, 5000);
    }
}

onReady(initTransmissao);

async function loadContacts() {
    try {
        const response: LeadsResponse = await api.get('/api/leads');
        allContacts = response.leads || [];
        filteredContacts = [...allContacts];
        renderRecipients();
        const totalCount = document.getElementById('totalCount') as HTMLElement | null;
        if (totalCount) totalCount.textContent = String(allContacts.length);
    } catch (error) {
        showToast('error', 'Erro', 'Não foi possível carregar os contatos');
    }
}

async function loadTemplates() {
    try {
        const response: TemplatesResponse = await api.get('/api/templates');
        templates = response.templates || [];
        const select = document.getElementById('templateSelect') as HTMLSelectElement | null;
        if (!select) return;
        templates.forEach(t => {
            select.innerHTML += `<option value="${t.id}">${t.name}</option>`;
        });
    } catch (e) {}
}

function loadTemplate() {
    const id = (document.getElementById('templateSelect') as HTMLSelectElement | null)?.value || '';
    const template = templates.find(t => String(t.id) === id);
    if (template) {
        const messageContent = document.getElementById('messageContent') as HTMLTextAreaElement | null;
        if (messageContent) messageContent.value = template.content;
        updatePreview();
    }
}

function renderRecipients() {
    const list = document.getElementById('recipientList') as HTMLElement | null;
    if (!list) return;
    
    if (filteredContacts.length === 0) {
        list.innerHTML = `<div class="empty-state"><div class="empty-state-icon icon icon-empty icon-lg"></div><p>Nenhum contato encontrado</p></div>`;
        return;
    }

    list.innerHTML = filteredContacts.map(c => `
        <div class="recipient-item ${selectedContacts.has(c.id) ? 'selected' : ''}" onclick="toggleRecipient(${c.id})">
            <label class="checkbox-wrapper" onclick="event.stopPropagation()">
                <input type="checkbox" ${selectedContacts.has(c.id) ? 'checked' : ''} onchange="toggleRecipient(${c.id})">
                <span class="checkbox-custom"></span>
            </label>
            <div class="avatar avatar-sm" style="background: ${getAvatarColor(c.name)}">${getInitials(c.name)}</div>
            <div class="recipient-info">
                <div class="recipient-name">${c.name || 'Sem nome'}</div>
                <div class="recipient-phone">${formatPhone(c.phone)}</div>
            </div>
            ${getStatusBadge(c.status)}
        </div>
    `).join('');
}

function toggleRecipient(id: number) {
    if (selectedContacts.has(id)) {
        selectedContacts.delete(id);
    } else {
        selectedContacts.add(id);
    }
    updateSelectedCount();
    renderRecipients();
}

function selectAll() {
    filteredContacts.forEach(c => selectedContacts.add(c.id));
    updateSelectedCount();
    renderRecipients();
}

function deselectAll() {
    selectedContacts.clear();
    updateSelectedCount();
    renderRecipients();
}

function updateSelectedCount() {
    const selectedCount = document.getElementById('selectedCount') as HTMLElement | null;
    if (selectedCount) selectedCount.textContent = String(selectedContacts.size);
}

function filterRecipients() {
    const search = (document.getElementById('searchRecipients') as HTMLInputElement | null)?.value.toLowerCase() || '';
    const status = (document.getElementById('filterStatus') as HTMLSelectElement | null)?.value || '';

    filteredContacts = allContacts.filter(c => {
        const matchSearch = !search || 
            (c.name && c.name.toLowerCase().includes(search)) ||
            (c.phone && c.phone.includes(search));
        const matchStatus = !status || c.status == (parseInt(status, 10) as LeadStatus);
        return matchSearch && matchStatus;
    });

    renderRecipients();
}

function updatePreview() {
    const content = (document.getElementById('messageContent') as HTMLTextAreaElement | null)?.value || '';
    const preview = document.getElementById('messagePreview') as HTMLElement | null;
    if (!preview) return;
    
    if (!content) {
        preview.textContent = 'A mensagem aparecerá aqui...';
        return;
    }

    // Simular com dados de exemplo
    let previewText = content
        .replace(/\{\{nome\}\}/g, 'João Silva')
        .replace(/\{\{veiculo\}\}/g, 'Honda Civic 2020')
        .replace(/\{\{placa\}\}/g, 'ABC1234');
    
    preview.textContent = previewText;
}

function getDelayRangeMs() {
    const minInput = parseInt((document.getElementById('messageDelayMin') as HTMLInputElement | null)?.value || '0', 10);
    const maxInput = parseInt((document.getElementById('messageDelayMax') as HTMLInputElement | null)?.value || '0', 10);
    const singleDelay = parseInt((document.getElementById('messageDelay') as HTMLSelectElement | null)?.value || '0', 10);

    const baseMin = Number.isFinite(minInput) && minInput > 0 ? minInput : singleDelay;
    const baseMax = Number.isFinite(maxInput) && maxInput > 0 ? maxInput : baseMin;

    const minMs = Number.isFinite(baseMin) && baseMin > 0 ? baseMin : 5000;
    const maxMs = Number.isFinite(baseMax) && baseMax > 0 ? baseMax : minMs;

    return {
        minMs: Math.min(minMs, maxMs),
        maxMs: Math.max(minMs, maxMs)
    };
}

function isBroadcastSessionConnected(session: WhatsappSessionItem) {
    return Boolean(session.connected) || String(session.status || '').toLowerCase() === 'connected';
}

async function hasConnectedSessionForBroadcast() {
    try {
        const response = await api.get('/api/whatsapp/sessions?includeDisabled=true');
        const sessions = Array.isArray(response?.sessions) ? response.sessions : [];
        return sessions.some((session) => isBroadcastSessionConnected(session));
    } catch (_) {
        // Avoid false warnings when status endpoint is temporarily unavailable.
        return true;
    }
}

async function startBroadcast() {
    const message = (document.getElementById('messageContent') as HTMLTextAreaElement | null)?.value.trim() || '';
    const { minMs: delayMinMs, maxMs: delayMaxMs } = getDelayRangeMs();
    const startTime = (document.getElementById('startTime') as HTMLSelectElement | null)?.value || '';

    if (selectedContacts.size === 0) {
        showToast('error', 'Erro', 'Selecione pelo menos um contato');
        return;
    }

    if (!message) {
        showToast('error', 'Erro', 'Digite uma mensagem');
        return;
    }

    const hasConnectedSession = await hasConnectedSessionForBroadcast();
    if (!hasConnectedSession) {
        showToast('warning', 'Aviso', 'Nenhuma conta WhatsApp conectada. As mensagens serao enfileiradas.');
    }

    const btn = document.getElementById('startBtn') as HTMLButtonElement | null;
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="icon icon-clock icon-sm"></span> Processando...';
    }

    try {
        const leadIds = Array.from(selectedContacts);
        
        // Randomizar se necessário
        if ((document.getElementById('randomizeOrder') as HTMLInputElement | null)?.checked) {
            leadIds.sort(() => Math.random() - 0.5);
        }

        const response = await api.post('/api/queue/bulk', {
            leadIds,
            content: message,
            options: {
                delayMinMs,
                delayMaxMs
            }
        });

        showToast('success', 'Sucesso', `${leadIds.length} mensagens adicionadas à fila!`);
        
        // Mostrar progresso
        const queueProgress = document.getElementById('queueProgress') as HTMLElement | null;
        if (queueProgress) queueProgress.style.display = 'block';
        loadQueueStatus();
        
        // Limpar seleção
        deselectAll();
        
    } catch (error) {
        showToast('error', 'Erro', error instanceof Error ? error.message : 'Falha ao iniciar transmissão');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<span class="icon icon-play icon-sm"></span> Iniciar Transmissão';
        }
    }
}

async function loadQueueStatus() {
    try {
        const response: QueueResponse = await api.get('/api/queue/status');
        const queue = response.queue || [];
        
        const pending = queue.filter(q => q.status === 'pending').length;
        const processing = queue.filter(q => q.status === 'processing').length;
        const sent = queue.filter(q => q.status === 'sent').length;
        const failed = queue.filter(q => q.status === 'failed').length;
        const total = queue.length;

        // Atualizar progresso
        if (total > 0) {
            const queueProgress = document.getElementById('queueProgress') as HTMLElement | null;
            if (queueProgress) queueProgress.style.display = 'block';
            const progress = ((sent + failed) / total) * 100;
            const progressBar = document.getElementById('progressBar') as HTMLElement | null;
            const sentCount = document.getElementById('sentCount') as HTMLElement | null;
            const pendingCount = document.getElementById('pendingCount') as HTMLElement | null;
            const failedCount = document.getElementById('failedCount') as HTMLElement | null;
            if (progressBar) progressBar.style.width = `${progress}%`;
            if (sentCount) sentCount.textContent = String(sent);
            if (pendingCount) pendingCount.textContent = String(pending + processing);
            if (failedCount) failedCount.textContent = String(failed);
            
            // Calcular ETA
            const { minMs, maxMs } = getDelayRangeMs();
            const averageDelay = Math.round((minMs + maxMs) / 2);
            const remaining = pending + processing;
            const etaSeconds = Math.ceil((remaining * averageDelay) / 1000);
            const etaMinutes = Math.floor(etaSeconds / 60);
            const etaSecs = etaSeconds % 60;
            const etaTime = document.getElementById('etaTime') as HTMLElement | null;
            if (etaTime) etaTime.textContent = `${etaMinutes}:${etaSecs.toString().padStart(2, '0')}`;
        } else {
            const queueProgress = document.getElementById('queueProgress') as HTMLElement | null;
            if (queueProgress) queueProgress.style.display = 'none';
        }

        // Renderizar lista
        renderQueueList(queue);
        
    } catch (error) {
        console.error('Erro ao carregar fila:', error);
    }
}

function renderQueueList(queue: QueueItem[]) {
    const list = document.getElementById('queueList') as HTMLElement | null;
    if (!list) return;
    
    if (queue.length === 0) {
        list.innerHTML = `<div class="empty-state"><div class="empty-state-icon icon icon-empty icon-lg"></div><p>Nenhuma mensagem na fila</p></div>`;
        return;
    }

    list.innerHTML = queue.slice(0, 50).map(q => `
        <div class="queue-item">
            <div class="queue-status ${q.status}"></div>
            <div style="flex: 1;">
                <div style="font-weight: 600;">${q.lead_name || 'Contato'}</div>
                <div style="font-size: 12px; color: var(--gray-500);">${formatPhone(q.lead_phone || '')}</div>
            </div>
            <div style="text-align: right;">
                <span class="badge badge-${q.status === 'sent' ? 'success' : q.status === 'failed' ? 'danger' : q.status === 'processing' ? 'info' : 'warning'}">
                    ${q.status === 'sent' ? 'Enviada' : q.status === 'failed' ? 'Falha' : q.status === 'processing' ? 'Enviando' : 'Aguardando'}
                </span>
                <div style="font-size: 11px; color: var(--gray-400); margin-top: 4px;">
                    ${q.processed_at ? timeAgo(q.processed_at) : ''}
                </div>
            </div>
            ${q.status === 'pending' ? `<button class="btn btn-sm btn-outline-danger btn-icon" onclick="cancelQueueItem(${q.id})" title="Cancelar"><span class="icon icon-close icon-sm"></span></button>` : ''}
        </div>
    `).join('');
}

async function cancelQueueItem(id: number) {
    try {
        await api.delete(`/api/queue/${id}`);
        loadQueueStatus();
        showToast('success', 'Sucesso', 'Mensagem cancelada');
    } catch (error) {
        showToast('error', 'Erro', 'Não foi possível cancelar');
    }
}

async function clearQueue() {
    if (!await appConfirm('Limpar todas as mensagens pendentes da fila?', 'Limpar fila')) return;
    
    try {
        await api.delete('/api/queue');
        loadQueueStatus();
        showToast('success', 'Sucesso', 'Fila limpa');
    } catch (error) {
        showToast('error', 'Erro', 'Não foi possível limpar a fila');
    }
}

function pauseQueue() {
    showToast('info', 'Info', 'Função de pausa em desenvolvimento');
}

// Limpar intervalo ao sair da página
window.addEventListener('beforeunload', () => {
    if (queueInterval) clearInterval(queueInterval);
});

const windowAny = window as Window & {
    initTransmissao?: () => void;
    loadTemplate?: () => void;
    toggleRecipient?: (id: number) => void;
    selectAll?: () => void;
    deselectAll?: () => void;
    filterRecipients?: () => void;
    updatePreview?: () => void;
    startBroadcast?: () => Promise<void>;
    loadQueueStatus?: () => Promise<void>;
    cancelQueueItem?: (id: number) => Promise<void>;
    clearQueue?: () => Promise<void>;
    pauseQueue?: () => void;
};
windowAny.initTransmissao = initTransmissao;
windowAny.loadTemplate = loadTemplate;
windowAny.toggleRecipient = toggleRecipient;
windowAny.selectAll = selectAll;
windowAny.deselectAll = deselectAll;
windowAny.filterRecipients = filterRecipients;
windowAny.updatePreview = updatePreview;
windowAny.startBroadcast = startBroadcast;
windowAny.loadQueueStatus = loadQueueStatus;
windowAny.cancelQueueItem = cancelQueueItem;
windowAny.clearQueue = clearQueue;
windowAny.pauseQueue = pauseQueue;

export { initTransmissao };
