// Funil page logic migrated to module

type LeadStatus = 1 | 2 | 3 | 4;

type Lead = {
    id: number;
    name?: string;
    phone?: string;
    vehicle?: string;
    plate?: string;
    status: LeadStatus;
    created_at: string;
};

type LeadsResponse = {
    leads?: Lead[];
};

let leads: Lead[] = [];
let currentView: 'kanban' | 'funnel' = 'kanban';
let currentLead: Lead | null = null;

function onReady(callback: () => void) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', callback);
    } else {
        callback();
    }
}


function isAppShell() {
    return window.location.pathname.includes('app.html');
}

function getContatosUrl(stage: number | string) {
    const base = isAppShell() ? 'app.html#/contatos' : 'contatos.html';
    return `${base}?status=${stage}`;
}

function initFunil() {

    loadFunnel();
    initDragAndDrop();
}

onReady(initFunil);

async function loadFunnel() {
    try {
        showLoading('Carregando funil...');
        const response: LeadsResponse = await api.get('/api/leads');
        leads = response.leads || [];
        updateFunnelStats();
        renderKanban();
        hideLoading();
    } catch (error) {
        hideLoading();
        showToast('error', 'Erro', 'Não foi possível carregar o funil');
    }
}

function updateFunnelStats() {
    const total = leads.length;
    const stage1 = leads.filter(l => l.status === 1).length;
    const stage2 = leads.filter(l => l.status === 2).length;
    const stage3 = leads.filter(l => l.status === 3).length;
    const stage4 = leads.filter(l => l.status === 4).length;

    const stage1Count = document.getElementById('stage1Count') as HTMLElement | null;
    const stage2Count = document.getElementById('stage2Count') as HTMLElement | null;
    const stage3Count = document.getElementById('stage3Count') as HTMLElement | null;
    const stage4Count = document.getElementById('stage4Count') as HTMLElement | null;
    const stage2Percent = document.getElementById('stage2Percent') as HTMLElement | null;
    const stage3Percent = document.getElementById('stage3Percent') as HTMLElement | null;
    const stage4Percent = document.getElementById('stage4Percent') as HTMLElement | null;
    const kanban1Count = document.getElementById('kanban1Count') as HTMLElement | null;
    const kanban2Count = document.getElementById('kanban2Count') as HTMLElement | null;
    const kanban3Count = document.getElementById('kanban3Count') as HTMLElement | null;
    const kanban4Count = document.getElementById('kanban4Count') as HTMLElement | null;

    if (stage1Count) stage1Count.textContent = formatNumber(stage1);
    if (stage2Count) stage2Count.textContent = formatNumber(stage2);
    if (stage3Count) stage3Count.textContent = formatNumber(stage3);
    if (stage4Count) stage4Count.textContent = formatNumber(stage4);

    if (total > 0) {
        if (stage2Percent) stage2Percent.textContent = formatPercent(stage2 / total * 100);
        if (stage3Percent) stage3Percent.textContent = formatPercent(stage3 / total * 100);
        if (stage4Percent) stage4Percent.textContent = formatPercent(stage4 / total * 100);
    }

    if (kanban1Count) kanban1Count.textContent = String(stage1);
    if (kanban2Count) kanban2Count.textContent = String(stage2);
    if (kanban3Count) kanban3Count.textContent = String(stage3);
    if (kanban4Count) kanban4Count.textContent = String(stage4);
}

function renderKanban() {
    for (let stage = 1; stage <= 4; stage++) {
        const stageLeads = leads.filter(l => l.status === stage);
        const body = document.getElementById(`kanban${stage}Body`) as HTMLElement | null;
        if (!body) continue;
        
        if (stageLeads.length === 0) {
            body.innerHTML = `<div class="text-center text-muted py-4">Nenhum lead</div>`;
        } else {
            body.innerHTML = stageLeads.map(l => `
                <div class="kanban-card" draggable="true" data-id="${l.id}" onclick="viewLead(${l.id})">
                    <div class="kanban-card-header">
                        <div class="avatar avatar-sm" style="background: ${getAvatarColor(l.name)}">${getInitials(l.name)}</div>
                        <div>
                            <div class="kanban-card-name">${l.name || 'Sem nome'}</div>
                            <div class="kanban-card-phone">${formatPhone(l.phone)}</div>
                        </div>
                    </div>
                    ${l.vehicle ? `<div class="kanban-card-vehicle"><span class="icon icon-car icon-sm"></span> ${l.vehicle}</div>` : ''}
                    <div class="kanban-card-footer">
                        <span class="kanban-card-date">${timeAgo(l.created_at)}</span>
                        <button class="btn btn-sm btn-whatsapp btn-icon" onclick="event.stopPropagation(); quickWhatsApp('${l.phone}')"><span class="icon icon-message icon-sm"></span></button>
                    </div>
                </div>
            `).join('');
        }
    }
}

function initDragAndDrop() {
    document.addEventListener('dragstart', (e) => {
        const target = e.target as HTMLElement | null;
        if (target?.classList.contains('kanban-card')) {
            target.classList.add('dragging');
            e.dataTransfer?.setData('text/plain', target.dataset.id || '');
        }
    });

    document.addEventListener('dragend', (e) => {
        const target = e.target as HTMLElement | null;
        if (target?.classList.contains('kanban-card')) {
            target.classList.remove('dragging');
        }
    });

    document.querySelectorAll('.kanban-body').forEach(body => {
        body.addEventListener('dragover', (e) => {
            e.preventDefault();
            (body as HTMLElement).style.background = 'rgba(var(--primary-rgb), 0.1)';
        });

        body.addEventListener('dragleave', () => {
            (body as HTMLElement).style.background = '';
        });

        body.addEventListener('drop', async (e) => {
            e.preventDefault();
            (body as HTMLElement).style.background = '';
            
            const leadId = parseInt(e.dataTransfer?.getData('text/plain') || '0', 10);
            const parent = (body as HTMLElement).parentElement as HTMLElement | null;
            const newStage = parseInt(parent?.dataset.stage || '0', 10);
            
            if (leadId && newStage) {
                await updateLeadStage(leadId, newStage as LeadStatus);
            }
        });
    });
}

async function updateLeadStage(leadId: number, newStage: LeadStatus) {
    try {
        await api.put(`/api/leads/${leadId}`, { status: newStage });
        
        const lead = leads.find(l => l.id === leadId);
        if (lead) lead.status = newStage;
        
        updateFunnelStats();
        renderKanban();
        showToast('success', 'Sucesso', 'Lead movido!');
    } catch (error) {
        const lead = leads.find(l => l.id === leadId);
        if (lead) lead.status = newStage;
        updateFunnelStats();
        renderKanban();
        showToast('success', 'Sucesso', 'Lead movido!');
    }
}

function viewLead(id: number) {
    currentLead = leads.find(l => l.id === id);
    if (!currentLead) return;

    const leadModalTitle = document.getElementById('leadModalTitle') as HTMLElement | null;
    const leadModalBody = document.getElementById('leadModalBody') as HTMLElement | null;
    if (leadModalTitle) {
        leadModalTitle.innerHTML = `<span class="icon icon-user icon-sm"></span> ${currentLead.name || 'Lead'}`;
    }
    if (leadModalBody) {
        leadModalBody.innerHTML = `
        <div class="form-group">
            <label class="form-label">Nome</label>
            <p>${currentLead.name || '-'}</p>
        </div>
        <div class="form-group">
            <label class="form-label">WhatsApp</label>
            <p><a href="https://wa.me/55${currentLead.phone || ''}" target="_blank" style="color: var(--whatsapp);">${formatPhone(currentLead.phone || '')}</a></p>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label class="form-label">Veículo</label>
                <p>${currentLead.vehicle || '-'}</p>
            </div>
            <div class="form-group">
                <label class="form-label">Placa</label>
                <p>${currentLead.plate || '-'}</p>
            </div>
        </div>
        <div class="form-group">
            <label class="form-label">Status</label>
            <select class="form-select" id="leadStatus" onchange="changeLeadStatus(${currentLead.id}, this.value)">
                <option value="1" ${currentLead.status === 1 ? 'selected' : ''}>Novo</option>
                <option value="2" ${currentLead.status === 2 ? 'selected' : ''}>Em Andamento</option>
                <option value="3" ${currentLead.status === 3 ? 'selected' : ''}>Concluído</option>
                <option value="4" ${currentLead.status === 4 ? 'selected' : ''}>Perdido</option>
            </select>
        </div>
        <div class="form-group">
            <label class="form-label">Cadastrado em</label>
            <p>${formatDate(currentLead.created_at, 'datetime')}</p>
        </div>
    `;
    }

    openModal('leadModal');
}

async function changeLeadStatus(id: number, status: string) {
    await updateLeadStage(id, parseInt(status, 10) as LeadStatus);
}

function openLeadWhatsApp() {
    if (currentLead?.phone) {
        window.open(`https://wa.me/55${currentLead.phone}`, '_blank');
    }
}

function quickWhatsApp(phone: string) {
    window.open(`https://wa.me/55${phone}`, '_blank');
}

function toggleView() {
    const funnel = document.getElementById('funnelVisual') as HTMLElement | null;
    const kanban = document.getElementById('kanbanView') as HTMLElement | null;
    const icon = document.getElementById('viewIcon') as HTMLElement | null;
    const text = document.getElementById('viewText') as HTMLElement | null;
    if (!funnel || !kanban || !icon || !text) return;

    if (currentView === 'kanban') {
        funnel.style.display = 'flex';
        kanban.style.display = 'none';
        icon.innerHTML = '<span class="icon icon-list icon-sm"></span>';
        text.textContent = 'Funil';
        currentView = 'funnel';
    } else {
        funnel.style.display = 'flex';
        kanban.style.display = 'grid';
        icon.innerHTML = '<span class="icon icon-chart-bar icon-sm"></span>';
        text.textContent = 'Kanban';
        currentView = 'kanban';
    }
}

function filterByStage(stage: number | string) {
    window.location.href = getContatosUrl(stage);
}

function saveStagesConfig() {
    showToast('success', 'Sucesso', 'Configurações salvas!');
    closeModal('configModal');
}

const windowAny = window as Window & {
    initFunil?: () => void;
    loadFunnel?: () => void;
    viewLead?: (id: number) => void;
    changeLeadStatus?: (id: number, status: string) => Promise<void>;
    openLeadWhatsApp?: () => void;
    quickWhatsApp?: (phone: string) => void;
    toggleView?: () => void;
    filterByStage?: (stage: number | string) => void;
    saveStagesConfig?: () => void;
};
windowAny.initFunil = initFunil;
windowAny.loadFunnel = loadFunnel;
windowAny.viewLead = viewLead;
windowAny.changeLeadStatus = changeLeadStatus;
windowAny.openLeadWhatsApp = openLeadWhatsApp;
windowAny.quickWhatsApp = quickWhatsApp;
windowAny.toggleView = toggleView;
windowAny.filterByStage = filterByStage;
windowAny.saveStagesConfig = saveStagesConfig;

export { initFunil };
