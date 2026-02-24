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
    total?: number;
};

type FunnelStageConfig = {
    name: string;
    description: string;
};

type SettingsResponse = {
    settings?: Record<string, unknown>;
};

type FunnelCacheSnapshot = {
    savedAt: number;
    leads: Lead[];
};

type FunnelStageCounts = Record<LeadStatus, number>;

const DEFAULT_FUNNEL_STAGES: FunnelStageConfig[] = [
    { name: 'Novo', description: 'Lead rec\u00E9m cadastrado' },
    { name: 'Em Andamento', description: 'Em negocia\u00E7\u00E3o' },
    { name: 'Conclu\u00EDdo', description: 'Venda realizada' },
    { name: 'Perdido', description: 'N\u00E3o converteu' }
];
const FUNNEL_STAGES_STORAGE_KEY = 'zapvender_funnel_stages';
const FUNNEL_FETCH_BATCH_SIZE = 1000;
const FUNNEL_FETCH_MAX_PAGES = 1000;
const FUNNEL_CACHE_TTL_MS = 10 * 60 * 1000;
const FUNNEL_CACHE_MIN_REVALIDATE_INTERVAL_MS = FUNNEL_CACHE_TTL_MS;
const FUNNEL_CACHE_PREFIX = 'zapvender_funnel_cache_v1';
const FUNNEL_CACHE_WRITE_DEBOUNCE_MS = 1200;
const VALID_LEAD_STATUS = new Set<LeadStatus>([1, 2, 3, 4]);
const EMPTY_STAGE_HTML = `<div class="text-center text-muted py-4">Nenhum lead</div>`;
const TEXT_MOJIBAKE_REPLACEMENTS: Array<[RegExp, string]> = [
    [/\u00C3\u0080/g, '\u00C0'],
    [/\u00C3\u0081/g, '\u00C1'],
    [/\u00C3\u0082/g, '\u00C2'],
    [/\u00C3\u0083/g, '\u00C3'],
    [/\u00C3\u0087/g, '\u00C7'],
    [/\u00C3\u0089/g, '\u00C9'],
    [/\u00C3\u008A/g, '\u00CA'],
    [/\u00C3\u008D/g, '\u00CD'],
    [/\u00C3\u0093/g, '\u00D3'],
    [/\u00C3\u0094/g, '\u00D4'],
    [/\u00C3\u0095/g, '\u00D5'],
    [/\u00C3\u009A/g, '\u00DA'],
    [/\u00C3\u00A0/g, '\u00E0'],
    [/\u00C3\u00A1/g, '\u00E1'],
    [/\u00C3\u00A2/g, '\u00E2'],
    [/\u00C3\u00A3/g, '\u00E3'],
    [/\u00C3\u00A7/g, '\u00E7'],
    [/\u00C3\u00A9/g, '\u00E9'],
    [/\u00C3\u00AA/g, '\u00EA'],
    [/\u00C3\u00AD/g, '\u00ED'],
    [/\u00C3\u00B3/g, '\u00F3'],
    [/\u00C3\u00B4/g, '\u00F4'],
    [/\u00C3\u00B5/g, '\u00F5'],
    [/\u00C3\u00BA/g, '\u00FA']
];

let leads: Lead[] = [];
let currentView: 'kanban' | 'funnel' = 'kanban';
let currentLead: Lead | null = null;
let funnelStages: FunnelStageConfig[] = DEFAULT_FUNNEL_STAGES.map((stage) => ({ ...stage }));
let funnelRuntimeCache: FunnelCacheSnapshot | null = null;
let funnelStageCounts: FunnelStageCounts = { 1: 0, 2: 0, 3: 0, 4: 0 };
let funnelCacheWriteTimer: ReturnType<typeof window.setTimeout> | null = null;
let funnelCacheWriteDirty = false;
const pendingLeadStatusUpdates = new Set<number>();

function onReady(callback: () => void) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', callback);
    } else {
        callback();
    }
}


function repairMojibakeText(value: string) {
    let normalized = value;
    for (const [pattern, replacement] of TEXT_MOJIBAKE_REPLACEMENTS) {
        normalized = normalized.replace(pattern, replacement);
    }
    return normalized;
}

function normalizeLead(input: unknown): Lead | null {
    if (!input || typeof input !== 'object') return null;

    const raw = input as Record<string, unknown>;
    const id = Number(raw.id);
    const statusNumber = Number(raw.status);
    const status: LeadStatus = VALID_LEAD_STATUS.has(statusNumber as LeadStatus) ? (statusNumber as LeadStatus) : 1;
    const createdAtValue = String(raw.created_at || '').trim();

    if (!Number.isFinite(id) || id <= 0) return null;

    return {
        id,
        name: typeof raw.name === 'string' ? raw.name : undefined,
        phone: typeof raw.phone === 'string' ? raw.phone : undefined,
        vehicle: typeof raw.vehicle === 'string' ? raw.vehicle : undefined,
        plate: typeof raw.plate === 'string' ? raw.plate : undefined,
        status,
        created_at: createdAtValue || new Date().toISOString()
    };
}

function normalizeLeadList(input: unknown) {
    if (!Array.isArray(input)) return [];
    const normalized: Lead[] = [];
    for (const item of input) {
        const lead = normalizeLead(item);
        if (lead) normalized.push(lead);
    }
    return normalized;
}

function getFunnelTokenSuffix() {
    const token = String(sessionStorage.getItem('selfDashboardToken') || '').trim();
    return token ? token.slice(-12) : 'anon';
}

function getFunnelCacheKey() {
    return `${FUNNEL_CACHE_PREFIX}:${getFunnelTokenSuffix()}`;
}

function readFunnelCache() {
    try {
        const raw = sessionStorage.getItem(getFunnelCacheKey());
        if (!raw) return null;
        const parsed = JSON.parse(raw) as { savedAt?: number; leads?: unknown };
        const savedAt = Number(parsed?.savedAt || 0);
        if (!Number.isFinite(savedAt) || savedAt <= 0) return null;
        if (Date.now() - savedAt > FUNNEL_CACHE_TTL_MS) return null;
        return {
            savedAt,
            leads: normalizeLeadList(parsed?.leads)
        };
    } catch (_) {
        return null;
    }
}

function writeFunnelCache(nextLeads: Lead[]) {
    try {
        const list = normalizeLeadList(nextLeads);
        sessionStorage.setItem(
            getFunnelCacheKey(),
            JSON.stringify({
                savedAt: Date.now(),
                leads: list
            })
        );
    } catch (_) {
        // ignore storage failure
    }
}

function setRuntimeCacheFromLeads() {
    funnelRuntimeCache = {
        savedAt: Date.now(),
        leads: [...leads]
    };
}

function flushFunnelCacheWrite() {
    if (!funnelCacheWriteDirty || !funnelRuntimeCache) return;
    funnelCacheWriteDirty = false;
    writeFunnelCache(funnelRuntimeCache.leads);
}

function scheduleFunnelCacheWrite() {
    funnelCacheWriteDirty = true;
    if (funnelCacheWriteTimer !== null) return;
    funnelCacheWriteTimer = window.setTimeout(() => {
        funnelCacheWriteTimer = null;
        flushFunnelCacheWrite();
    }, FUNNEL_CACHE_WRITE_DEBOUNCE_MS);
}

function clearFunnelCache() {
    if (funnelCacheWriteTimer !== null) {
        window.clearTimeout(funnelCacheWriteTimer);
        funnelCacheWriteTimer = null;
    }
    funnelCacheWriteDirty = false;
    try {
        sessionStorage.removeItem(getFunnelCacheKey());
    } catch (_) {
        // ignore storage failure
    }
    funnelRuntimeCache = null;
}

function buildStageCounts(nextLeads: Lead[]) {
    const counts: FunnelStageCounts = { 1: 0, 2: 0, 3: 0, 4: 0 };
    for (const lead of nextLeads) {
        counts[lead.status] += 1;
    }
    return counts;
}

function applyFunnelSnapshot(nextLeads: Lead[]) {
    leads = normalizeLeadList(nextLeads);
    funnelStageCounts = buildStageCounts(leads);
    updateFunnelStats();
    renderKanban();
}
function getContatosUrl(stage: number | string) {
    return `#/contatos?status=${stage}`;
}

function normalizeFunnelStageName(value: unknown, fallback: string) {
    const normalized = repairMojibakeText(String(value || '').replace(/\s+/g, ' ').trim());
    return normalized || fallback;
}

function normalizeFunnelStageDescription(value: unknown, fallback: string) {
    const normalized = repairMojibakeText(String(value || '').replace(/\s+/g, ' ').trim());
    return normalized || fallback;
}

function normalizeFunnelStagesInput(value: unknown) {
    const source = Array.isArray(value) ? value : [];
    return DEFAULT_FUNNEL_STAGES.map((defaultStage, index) => {
        const item = source[index] || {};
        return {
            name: normalizeFunnelStageName((item as { name?: unknown }).name, defaultStage.name),
            description: normalizeFunnelStageDescription((item as { description?: unknown }).description, defaultStage.description)
        };
    });
}

function setTextContentById(id: string, value: string) {
    const element = document.getElementById(id) as HTMLElement | null;
    if (element) element.textContent = value;
}

function setInputValueById(id: string, value: string) {
    const input = document.getElementById(id) as HTMLInputElement | null;
    if (input) input.value = value;
}

function setKanbanBodyEmptyState(body: HTMLElement) {
    body.innerHTML = EMPTY_STAGE_HTML;
}

function removeKanbanBodyEmptyState(body: HTMLElement) {
    const empty = body.querySelector('.text-center.text-muted.py-4');
    if (empty) empty.remove();
}

function renderLeadCard(lead: Lead) {
    return `
        <div class="kanban-card" draggable="true" data-id="${lead.id}" onclick="viewLead(${lead.id})">
            <div class="kanban-card-header">
                <div class="avatar avatar-sm" style="background: ${getAvatarColor(lead.name)}">${getInitials(lead.name)}</div>
                <div>
                    <div class="kanban-card-name">${lead.name || 'Sem nome'}</div>
                    <div class="kanban-card-phone">${formatPhone(lead.phone)}</div>
                </div>
            </div>
            ${lead.vehicle ? `<div class="kanban-card-vehicle"><span class="icon icon-car icon-sm"></span> ${lead.vehicle}</div>` : ''}
            <div class="kanban-card-footer">
                <span class="kanban-card-date">${timeAgo(lead.created_at)}</span>
                <button class="btn btn-sm btn-whatsapp btn-icon" onclick="event.stopPropagation(); quickWhatsApp('${lead.phone}')"><span class="icon icon-message icon-sm"></span></button>
            </div>
        </div>
    `;
}

function renderKanbanStage(stage: LeadStatus) {
    const stageLeads = leads.filter((lead) => lead.status === stage);
    const body = document.getElementById(`kanban${stage}Body`) as HTMLElement | null;
    if (!body) return;

    if (stageLeads.length === 0) {
        setKanbanBodyEmptyState(body);
        return;
    }

    body.innerHTML = stageLeads.map(renderLeadCard).join('');
}

function moveLeadCardToStage(leadId: number, newStage: LeadStatus) {
    const card = document.querySelector(`.kanban-card[data-id="${leadId}"]`) as HTMLElement | null;
    if (!card) return false;

    const targetBody = document.getElementById(`kanban${newStage}Body`) as HTMLElement | null;
    const sourceBody = card.parentElement as HTMLElement | null;
    if (!targetBody || !sourceBody) return false;

    if (sourceBody === targetBody) return true;

    removeKanbanBodyEmptyState(targetBody);
    targetBody.prepend(card);

    if (!sourceBody.querySelector('.kanban-card')) {
        setKanbanBodyEmptyState(sourceBody);
    }

    return true;
}

function applyFunnelStagesToUi() {
    for (let index = 0; index < DEFAULT_FUNNEL_STAGES.length; index += 1) {
        const stage = funnelStages[index] || DEFAULT_FUNNEL_STAGES[index];
        const stageNumber = index + 1;
        setTextContentById(`stage${stageNumber}Label`, stage.name);
        setTextContentById(`kanbanStage${stageNumber}Label`, stage.name);
        setInputValueById(`stage${stageNumber}Name`, stage.name);
        setInputValueById(`stage${stageNumber}Desc`, stage.description);
    }
}

function readLocalFunnelStages() {
    try {
        const raw = localStorage.getItem(FUNNEL_STAGES_STORAGE_KEY);
        if (!raw) return null;
        return normalizeFunnelStagesInput(JSON.parse(raw));
    } catch (_) {
        return null;
    }
}

function writeLocalFunnelStages(stages: FunnelStageConfig[]) {
    try {
        localStorage.setItem(FUNNEL_STAGES_STORAGE_KEY, JSON.stringify(stages));
    } catch (_) {
        // ignore storage failure
    }
}

async function loadFunnelStageConfig() {
    const localStages = readLocalFunnelStages();
    if (localStages) {
        funnelStages = localStages;
        applyFunnelStagesToUi();
    } else {
        applyFunnelStagesToUi();
    }

    try {
        const response: SettingsResponse = await api.get('/api/settings');
        const settings = response?.settings || {};
        const fromServer = Object.prototype.hasOwnProperty.call(settings, 'funnel_stages')
            ? settings.funnel_stages
            : settings.funnel;
        if (fromServer) {
            funnelStages = normalizeFunnelStagesInput(fromServer);
            writeLocalFunnelStages(funnelStages);
            applyFunnelStagesToUi();
        }
    } catch (_) {
        // keep local/default values when server config is unavailable
    }
}

function initFunil() {
    void loadFunnelStageConfig();
    loadFunnel();
    initDragAndDrop();
}

onReady(initFunil);

async function loadFunnel(options: { forceRefresh?: boolean; silent?: boolean } = {}) {
    const forceRefresh = options.forceRefresh === true;
    const runtimeCached = forceRefresh ? null : funnelRuntimeCache;
    const cached = runtimeCached || (forceRefresh ? null : readFunnelCache());
    const cacheAgeMs = cached ? Math.max(0, Date.now() - cached.savedAt) : Number.POSITIVE_INFINITY;
    const shouldSkipRefresh = !forceRefresh && !!cached && cacheAgeMs <= FUNNEL_CACHE_MIN_REVALIDATE_INTERVAL_MS;

    if (cached) {
        applyFunnelSnapshot(cached.leads || []);
        if (!runtimeCached) {
            funnelRuntimeCache = {
                savedAt: cached.savedAt,
                leads: [...cached.leads]
            };
        }
    }

    if (shouldSkipRefresh) {
        return;
    }

    try {
        if (!cached) {
            showLoading('Carregando funil...');
        }

        const fetchedLeads = await fetchAllFunnelLeads();
        const normalizedLeads = normalizeLeadList(fetchedLeads);
        funnelRuntimeCache = {
            savedAt: Date.now(),
            leads: normalizedLeads
        };
        writeFunnelCache(fetchedLeads);
        applyFunnelSnapshot(normalizedLeads);

        if (!cached) {
            hideLoading();
        }
    } catch (error) {
        if (!cached) {
            hideLoading();
            showToast('error', 'Erro', 'N\u00E3o foi poss\u00EDvel carregar o funil');
        } else if (!options.silent) {
            console.warn('Falha ao revalidar funil:', error);
        }
    }
}

async function fetchAllFunnelLeads() {
    const allLeads: Lead[] = [];
    let offset = 0;
    let page = 0;
    let totalExpected: number | null = null;

    while (page < FUNNEL_FETCH_MAX_PAGES) {
        const params = new URLSearchParams();
        params.set('limit', String(FUNNEL_FETCH_BATCH_SIZE));
        params.set('offset', String(offset));

        let response: LeadsResponse;
        try {
            response = await api.get(`/api/leads?${params.toString()}`);
        } catch (error) {
            if (allLeads.length > 0) {
                console.warn('Interrompendo carregamento parcial do funil por erro de pagina:', error);
                break;
            }
            throw error;
        }

        const batch = normalizeLeadList(response?.leads);
        const reportedTotal = Number(response?.total);

        if (Number.isFinite(reportedTotal) && reportedTotal >= 0) {
            totalExpected = reportedTotal;
        }

        allLeads.push(...batch);
        page += 1;
        offset += batch.length;

        if (batch.length < FUNNEL_FETCH_BATCH_SIZE) break;
        if (totalExpected !== null && allLeads.length >= totalExpected) break;
    }

    if (page >= FUNNEL_FETCH_MAX_PAGES) {
        console.warn('Limite maximo de paginas atingido ao carregar o funil.');
    }

    return allLeads;
}

function updateFunnelStats() {
    const stage1 = funnelStageCounts[1];
    const stage2 = funnelStageCounts[2];
    const stage3 = funnelStageCounts[3];
    const stage4 = funnelStageCounts[4];
    const total = stage1 + stage2 + stage3 + stage4;

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
    } else {
        if (stage2Percent) stage2Percent.textContent = '0%';
        if (stage3Percent) stage3Percent.textContent = '0%';
        if (stage4Percent) stage4Percent.textContent = '0%';
    }

    if (kanban1Count) kanban1Count.textContent = String(stage1);
    if (kanban2Count) kanban2Count.textContent = String(stage2);
    if (kanban3Count) kanban3Count.textContent = String(stage3);
    if (kanban4Count) kanban4Count.textContent = String(stage4);
}

function renderKanban() {
    for (let stage = 1; stage <= 4; stage++) {
        renderKanbanStage(stage as LeadStatus);
    }
}

function clearKanbanDropActiveState() {
    document.querySelectorAll('.kanban-column.drop-active').forEach((column) => {
        column.classList.remove('drop-active');
    });
}

function initDragAndDrop() {
    document.addEventListener('dragstart', (e) => {
        const target = e.target as HTMLElement | null;
        if (target?.classList.contains('kanban-card')) {
            target.classList.add('dragging');
            if (e.dataTransfer) {
                e.dataTransfer.setData('text/plain', target.dataset.id || '');
                e.dataTransfer.dropEffect = 'move';
            }
            clearKanbanDropActiveState();
        }
    });

    document.addEventListener('dragend', (e) => {
        const target = e.target as HTMLElement | null;
        if (target?.classList.contains('kanban-card')) {
            target.classList.remove('dragging');
        }
        clearKanbanDropActiveState();
    });

    document.querySelectorAll('.kanban-column').forEach((column) => {
        const columnElement = column as HTMLElement;
        columnElement.addEventListener('dragover', (e) => {
            e.preventDefault();
            if (e.dataTransfer) {
                e.dataTransfer.dropEffect = 'move';
            }
            if (!columnElement.classList.contains('drop-active')) {
                clearKanbanDropActiveState();
                columnElement.classList.add('drop-active');
            }
        });

        columnElement.addEventListener('dragleave', (e) => {
            const relatedTarget = e.relatedTarget as Node | null;
            if (relatedTarget && columnElement.contains(relatedTarget)) return;
            columnElement.classList.remove('drop-active');
        });

        columnElement.addEventListener('drop', (e) => {
            e.preventDefault();
            clearKanbanDropActiveState();
            
            const leadId = parseInt(e.dataTransfer?.getData('text/plain') || '0', 10);
            const newStage = parseInt(columnElement.dataset.stage || '0', 10);
            
            if (leadId && newStage) {
                void updateLeadStage(leadId, newStage as LeadStatus);
            }
        });
    });
}

async function updateLeadStage(leadId: number, newStage: LeadStatus) {
    const lead = leads.find((item) => item.id === leadId);
    const previousStage = lead?.status;

    if (!lead) {
        showToast('error', 'Erro', 'Lead n\u00E3o encontrado');
        return;
    }

    if (pendingLeadStatusUpdates.has(leadId)) {
        return;
    }

    if (previousStage === newStage) {
        return;
    }

    pendingLeadStatusUpdates.add(leadId);
    lead.status = newStage;
    if (previousStage) {
        funnelStageCounts[previousStage] = Math.max(0, funnelStageCounts[previousStage] - 1);
    }
    funnelStageCounts[newStage] += 1;
    updateFunnelStats();
    const movedInDom = moveLeadCardToStage(leadId, newStage);
    if (!movedInDom && previousStage) {
        renderKanbanStage(previousStage);
        renderKanbanStage(newStage);
    }
    setRuntimeCacheFromLeads();

    try {
        await api.put(`/api/leads/${leadId}`, { status: newStage });
        setRuntimeCacheFromLeads();
        scheduleFunnelCacheWrite();
    } catch (error) {
        if (previousStage !== undefined) {
            lead.status = previousStage;
            funnelStageCounts[newStage] = Math.max(0, funnelStageCounts[newStage] - 1);
            funnelStageCounts[previousStage] += 1;
        }
        updateFunnelStats();
        const revertedInDom = previousStage ? moveLeadCardToStage(leadId, previousStage) : false;
        if (!revertedInDom && previousStage) {
            renderKanbanStage(previousStage);
            renderKanbanStage(newStage);
        }
        setRuntimeCacheFromLeads();
        scheduleFunnelCacheWrite();
        showToast('error', 'Erro', 'N\u00E3o foi poss\u00EDvel mover o lead');
    } finally {
        pendingLeadStatusUpdates.delete(leadId);
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
                <label class="form-label">Ve\u00EDculo</label>
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
                <option value="3" ${currentLead.status === 3 ? 'selected' : ''}>Conclu\u00EDdo</option>
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

async function saveStagesConfig() {
    const nextStages = DEFAULT_FUNNEL_STAGES.map((defaultStage, index) => {
        const stageNumber = index + 1;
        const nameInput = document.getElementById(`stage${stageNumber}Name`) as HTMLInputElement | null;
        const descInput = document.getElementById(`stage${stageNumber}Desc`) as HTMLInputElement | null;
        return {
            name: normalizeFunnelStageName(nameInput?.value, defaultStage.name),
            description: normalizeFunnelStageDescription(descInput?.value, defaultStage.description)
        };
    });

    funnelStages = nextStages;
    applyFunnelStagesToUi();
    writeLocalFunnelStages(nextStages);

    try {
        await api.put('/api/settings', {
            funnel_stages: nextStages
        });
        showToast('success', 'Sucesso', 'Configurações salvas!');
    } catch (_) {
        showToast('warning', 'Aviso', 'Salvo localmente, mas não foi possível sincronizar no servidor');
    }

    closeModal('configModal');
}

const windowAny = window as Window & {
    initFunil?: () => void;
    loadFunnel?: (options?: { forceRefresh?: boolean; silent?: boolean }) => void;
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
