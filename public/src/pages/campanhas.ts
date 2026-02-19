// Campanhas page logic migrated to module

type CampaignStatus = 'active' | 'paused' | 'completed' | 'draft';
type CampaignType = 'trigger' | 'broadcast' | 'drip';

type Campaign = {
    id: number;
    name: string;
    description?: string;
    type: CampaignType;
    status: CampaignStatus;
    sent?: number;
    delivered?: number;
    read?: number;
    replied?: number;
    created_at: string;
    segment?: string;
    tag_filter?: string;
    message?: string;
    delay?: number;
    delay_min?: number;
    delay_max?: number;
    start_at?: string;
};

type CampaignResponse = {
    campaigns?: Campaign[];
};

type CampaignRecipient = {
    id: number;
    name?: string;
    phone?: string;
    status?: number;
    tags?: string;
    vehicle?: string;
    plate?: string;
};

type CampaignRecipientsResponse = {
    recipients?: CampaignRecipient[];
    total?: number;
    segment?: string;
    tag_filter?: string;
};

let campaigns: Campaign[] = [];
const DEFAULT_DELAY_MIN_SECONDS = 6;
const DEFAULT_DELAY_MAX_SECONDS = 24;

function getCampaignStatusLabel(status: CampaignStatus) {
    if (status === 'active') return 'Ativa';
    if (status === 'paused') return 'Pausada';
    if (status === 'completed') return 'Concluída';
    return 'Rascunho';
}

function getCampaignTypeLabel(type: CampaignType) {
    if (type === 'broadcast') return 'Transmissão';
    if (type === 'drip') return 'Sequência';
    return 'Gatilho';
}

function getLeadStatusLabel(status?: number) {
    if (status === 1) return 'Novo';
    if (status === 2) return 'Em andamento';
    if (status === 3) return 'Concluído';
    if (status === 4) return 'Perdido';
    return '-';
}

function getFunnelStageName(stage: number, fallback: string) {
    try {
        const rawSettings = localStorage.getItem('selfSettings');
        if (!rawSettings) return fallback;
        const parsed = JSON.parse(rawSettings);
        const funnel = Array.isArray(parsed?.funnel) ? parsed.funnel : [];
        const stageConfig = funnel[stage - 1];
        const name = String(stageConfig?.name || '').trim();
        return name || fallback;
    } catch {
        return fallback;
    }
}

function parseTagsForDisplay(rawTags: unknown) {
    if (Array.isArray(rawTags)) {
        return rawTags.map(tag => String(tag || '').trim()).filter(Boolean);
    }

    const raw = String(rawTags || '').trim();
    if (!raw) return [];

    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
            return parsed.map(tag => String(tag || '').trim()).filter(Boolean);
        }
    } catch (error) {
        // fallback para formato legado
    }

    return raw.split(',').map(tag => tag.trim()).filter(Boolean);
}

function formatCampaignPhone(phone?: string) {
    const digits = String(phone || '').replace(/\D/g, '');
    if (!digits) return '-';
    return formatPhone(digits);
}

function getCampaignSegmentLabel(segment?: string) {
    const normalized = String(segment || 'all').toLowerCase();
    if (normalized === 'new' || normalized === 'status_1' || normalized === '1') {
        return `${getFunnelStageName(1, 'Novo')} (Etapa 1)`;
    }
    if (normalized === 'progress' || normalized === 'status_2' || normalized === '2') {
        return `${getFunnelStageName(2, 'Em andamento')} (Etapa 2)`;
    }
    if (normalized === 'concluded' || normalized === 'status_3' || normalized === '3') {
        return `${getFunnelStageName(3, 'Concluído')} (Etapa 3)`;
    }
    if (normalized === 'lost' || normalized === 'status_4' || normalized === '4') {
        return `${getFunnelStageName(4, 'Perdido')} (Etapa 4)`;
    }
    return 'Todos os contatos';
}

function getCampaignSegmentOptions() {
    return [
        { value: 'all', label: 'Todos os Contatos' },
        { value: 'new', label: `${getFunnelStageName(1, 'Novo')} (Etapa 1)` },
        { value: 'progress', label: `${getFunnelStageName(2, 'Em Andamento')} (Etapa 2)` },
        { value: 'concluded', label: `${getFunnelStageName(3, 'Concluído')} (Etapa 3)` },
        { value: 'lost', label: `${getFunnelStageName(4, 'Perdido')} (Etapa 4)` }
    ];
}

function syncCampaignSegmentOptions() {
    const segmentSelect = document.getElementById('campaignSegment') as HTMLSelectElement | null;
    if (!segmentSelect) return;

    const currentValue = segmentSelect.value || 'all';
    segmentSelect.innerHTML = getCampaignSegmentOptions()
        .map((option) => `<option value="${escapeCampaignText(option.value)}">${escapeCampaignText(option.label)}</option>`)
        .join('');
    setSelectValue(segmentSelect, currentValue);
}

function splitCampaignMessageSteps(campaign: Campaign) {
    const rawMessage = String(campaign.message || '').trim();
    if (!rawMessage) return [];
    if (campaign.type !== 'drip') return [rawMessage];
    return rawMessage
        .split(/\n\s*---+\s*\n/g)
        .map(step => step.trim())
        .filter(Boolean);
}

function escapeCampaignText(value: unknown) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function renderCampaignMessages(campaign: Campaign) {
    const campaignMessages = document.getElementById('campaignMessages') as HTMLElement | null;
    if (!campaignMessages) return;

    const steps = splitCampaignMessageSteps(campaign);
    if (!steps.length) {
        campaignMessages.innerHTML = '<p style="color: var(--gray-500);">Nenhuma mensagem configurada.</p>';
        return;
    }

    campaignMessages.innerHTML = steps.map((step, index) => `
        <div class="copy-card" style="margin-bottom: 12px;">
            <div style="font-weight: 600; margin-bottom: 8px;">
                ${campaign.type === 'drip' ? `Etapa ${index + 1}` : 'Mensagem'}
            </div>
            <pre style="white-space: pre-wrap; margin: 0; font-family: inherit;">${escapeCampaignText(step)}</pre>
        </div>
    `).join('');
}

async function loadCampaignRecipients(campaign: Campaign) {
    const campaignRecipients = document.getElementById('campaignRecipients') as HTMLElement | null;
    if (!campaignRecipients) return;

    campaignRecipients.innerHTML = '<p style="color: var(--gray-500);">Carregando destinatários...</p>';

    try {
        const response: CampaignRecipientsResponse = await api.get(`/api/campaigns/${campaign.id}/recipients?limit=200`);
        const recipients = response.recipients || [];
        const total = Number(response.total || recipients.length);
        const segmentLabel = getCampaignSegmentLabel(response.segment || campaign.segment);
        const tagLabel = String(response.tag_filter || campaign.tag_filter || 'Todas');

        if (!recipients.length) {
            campaignRecipients.innerHTML = `
                <p style="margin-bottom: 8px;"><strong>Segmentação:</strong> ${escapeCampaignText(segmentLabel)}</p>
                <p style="margin-bottom: 8px;"><strong>Tag:</strong> ${escapeCampaignText(tagLabel)}</p>
                <p style="color: var(--gray-500);">Nenhum contato encontrado com esses filtros.</p>
            `;
            return;
        }

        const rows = recipients.map((lead) => {
            const tags = parseTagsForDisplay(lead.tags).join(', ') || '-';
            return `
                <tr>
                    <td>${escapeCampaignText(lead.name || 'Sem nome')}</td>
                    <td>${escapeCampaignText(formatCampaignPhone(lead.phone))}</td>
                    <td>${escapeCampaignText(getLeadStatusLabel(Number(lead.status || 0)))}</td>
                    <td>${escapeCampaignText(tags)}</td>
                </tr>
            `;
        }).join('');

        campaignRecipients.innerHTML = `
            <p style="margin-bottom: 8px;"><strong>Segmentação:</strong> ${escapeCampaignText(segmentLabel)}</p>
            <p style="margin-bottom: 8px;"><strong>Tag:</strong> ${escapeCampaignText(tagLabel)}</p>
            <p style="margin-bottom: 12px;"><strong>Total filtrado:</strong> ${formatNumber(total)}</p>
            <div style="overflow-x: auto;">
                <table class="table" style="min-width: 560px;">
                    <thead>
                        <tr>
                            <th>Nome</th>
                            <th>WhatsApp</th>
                            <th>Status</th>
                            <th>Tags</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
            ${total > recipients.length ? `<p style="color: var(--gray-500); margin-top: 8px;">Mostrando ${formatNumber(recipients.length)} de ${formatNumber(total)} contatos.</p>` : ''}
        `;
    } catch (error) {
        campaignRecipients.innerHTML = '<p style="color: var(--danger);">Não foi possível carregar os destinatários.</p>';
    }
}

function onReady(callback: () => void) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', callback);
    } else {
        callback();
    }
}

function setCampaignModalTitle(mode: 'new' | 'edit') {
    const modalTitle = document.querySelector('#newCampaignModal .modal-title') as HTMLElement | null;
    if (!modalTitle) return;

    if (mode === 'edit') {
        modalTitle.innerHTML = '<span class="icon icon-edit icon-sm"></span> Editar Campanha';
    } else {
        modalTitle.innerHTML = '<span class="icon icon-add icon-sm"></span> Nova Campanha';
    }
}

function resetCampaignForm() {
    const form = document.getElementById('campaignForm') as HTMLFormElement | null;
    form?.reset();
    const idInput = document.getElementById('campaignId') as HTMLInputElement | null;
    if (idInput) idInput.value = '';
    syncCampaignSegmentOptions();
    setDelayRangeInputs(DEFAULT_DELAY_MIN_SECONDS, DEFAULT_DELAY_MAX_SECONDS);
    setCampaignModalTitle('new');
}

function openCampaignModal() {
    resetCampaignForm();
    const win = window as Window & { openModal?: (id: string) => void };
    win.openModal?.('newCampaignModal');
}

function getCampaignId() {
    const idValue = (document.getElementById('campaignId') as HTMLInputElement | null)?.value || '';
    const parsed = parseInt(idValue, 10);
    return Number.isFinite(parsed) ? parsed : null;
}

function formatInputDateTime(value?: string) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const pad = (num: number) => String(num).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function setSelectValue(select: HTMLSelectElement | null, value: string) {
    if (!select) return;
    const hasOption = Array.from(select.options).some(option => option.value === value);
    if (hasOption) {
        select.value = value;
    } else if (select.options.length > 0) {
        select.value = select.options[0].value;
    }
}

function setDelayRangeInputs(minSeconds = DEFAULT_DELAY_MIN_SECONDS, maxSeconds = DEFAULT_DELAY_MAX_SECONDS) {
    const minInput = document.getElementById('campaignDelayMin') as HTMLInputElement | null;
    const maxInput = document.getElementById('campaignDelayMax') as HTMLInputElement | null;
    if (minInput) minInput.value = String(minSeconds);
    if (maxInput) maxInput.value = String(maxSeconds);
}

function resolveCampaignDelayRangeMs(campaign?: Partial<Campaign>) {
    const fallbackMin = DEFAULT_DELAY_MIN_SECONDS * 1000;
    const fallbackMax = DEFAULT_DELAY_MAX_SECONDS * 1000;

    const minCandidate = Number(campaign?.delay_min ?? campaign?.delay ?? fallbackMin);
    const maxCandidate = Number(campaign?.delay_max ?? campaign?.delay ?? minCandidate ?? fallbackMax);

    let minMs = Number.isFinite(minCandidate) && minCandidate > 0 ? minCandidate : fallbackMin;
    let maxMs = Number.isFinite(maxCandidate) && maxCandidate > 0 ? maxCandidate : minMs;

    if (maxMs < minMs) {
        const swap = minMs;
        minMs = maxMs;
        maxMs = swap;
    }

    return { minMs, maxMs };
}

function openBroadcastModal() {
    openCampaignModal();

    setSelectValue(document.getElementById('campaignType') as HTMLSelectElement | null, 'broadcast');
    setSelectValue(document.getElementById('campaignSegment') as HTMLSelectElement | null, 'all');
    setDelayRangeInputs(DEFAULT_DELAY_MIN_SECONDS, DEFAULT_DELAY_MAX_SECONDS);
}

function initCampanhas() {
    syncCampaignSegmentOptions();
    loadCampaigns();
}

onReady(initCampanhas);

async function loadCampaigns() {
    try {
        showLoading('Carregando campanhas...');
        const response: CampaignResponse = await api.get('/api/campaigns');
        campaigns = response.campaigns || [];
        updateStats();
        renderCampaigns();
        hideLoading();
    } catch (error) {
        hideLoading();
        // Se nÃ£o houver endpoint, mostrar campanhas de exemplo
        campaigns = [
            {
                id: 1,
                name: 'Boas-vindas',
                description: 'Mensagem de boas-vindas para novos leads',
                type: 'trigger',
                status: 'active',
                segment: 'new',
                message: 'OlÃ¡ {{nome}}! Seja bem-vindo Ã  ZapVender.',
                delay: 5000,
                delay_min: 5000,
                delay_max: 5000,
                start_at: new Date().toISOString(),
                sent: 156,
                delivered: 150,
                read: 120,
                replied: 45,
                created_at: new Date().toISOString()
            },
            {
                id: 2,
                name: 'PromoÃ§Ã£o Janeiro',
                description: 'Campanha promocional de janeiro',
                type: 'broadcast',
                status: 'completed',
                segment: 'all',
                message: 'PromoÃ§Ã£o especial para vocÃª!',
                delay: 5000,
                delay_min: 5000,
                delay_max: 5000,
                start_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
                sent: 500,
                delivered: 485,
                read: 320,
                replied: 89,
                created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
            }
        ];
        updateStats();
        renderCampaigns();
    }
}

function updateStats() {
    const totalCampaigns = document.getElementById('totalCampaigns') as HTMLElement | null;
    const activeCampaigns = document.getElementById('activeCampaigns') as HTMLElement | null;
    const totalSentEl = document.getElementById('totalSent') as HTMLElement | null;
    const avgResponseEl = document.getElementById('avgResponse') as HTMLElement | null;

    if (totalCampaigns) totalCampaigns.textContent = String(campaigns.length);
    if (activeCampaigns) {
        activeCampaigns.textContent = String(campaigns.filter(c => c.status === 'active').length);
    }
    
    const totalSent = campaigns.reduce((sum, c) => sum + (c.sent || 0), 0);
    if (totalSentEl) totalSentEl.textContent = formatNumber(totalSent);
    
    const totalReplied = campaigns.reduce((sum, c) => sum + (c.replied || 0), 0);
    const avgResponse = totalSent > 0 ? (totalReplied / totalSent * 100) : 0;
    if (avgResponseEl) avgResponseEl.textContent = formatPercent(avgResponse);
}

function renderCampaigns() {
    const container = document.getElementById('campaignsList') as HTMLElement | null;
    if (!container) return;
    
    if (campaigns.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1;">
                <div class="empty-state-icon icon icon-empty icon-lg"></div>
                <p>Nenhuma campanha criada</p>
                <button class="btn btn-primary mt-3" onclick="openCampaignModal()"><span class="icon icon-add icon-sm"></span> Criar Campanha</button>
            </div>
        `;
        return;
    }

    container.innerHTML = campaigns.map(c => {
        const deliveryRate = c.sent > 0 ? (c.delivered / c.sent * 100) : 0;
        const readRate = c.delivered > 0 ? (c.read / c.delivered * 100) : 0;
        const replyRate = c.read > 0 ? (c.replied / c.read * 100) : 0;

        return `
            <div class="campaign-card">
                <div class="campaign-header">
                    <div>
                        <h3 class="campaign-title">${c.name}</h3>
                        <div class="campaign-date">Criada em ${formatDate(c.created_at, 'short')}</div>
                    </div>
                    <span class="badge badge-${c.status === 'active' ? 'success' : c.status === 'paused' ? 'warning' : c.status === 'completed' ? 'info' : 'secondary'}">
                        ${getCampaignStatusLabel(c.status)}
                    </span>
                </div>
                <div class="campaign-body">
                    <p style="color: var(--gray-600); margin-bottom: 15px;">${c.description || 'Sem descrição'}</p>
                    <div class="campaign-stats">
                        <div class="campaign-stat">
                            <div class="campaign-stat-value">${formatNumber(c.sent || 0)}</div>
                            <div class="campaign-stat-label">Enviadas</div>
                        </div>
                        <div class="campaign-stat">
                            <div class="campaign-stat-value">${formatPercent(deliveryRate)}</div>
                            <div class="campaign-stat-label">Entregues</div>
                        </div>
                        <div class="campaign-stat">
                            <div class="campaign-stat-value">${formatPercent(readRate)}</div>
                            <div class="campaign-stat-label">Lidas</div>
                        </div>
                        <div class="campaign-stat">
                            <div class="campaign-stat-value">${formatPercent(replyRate)}</div>
                            <div class="campaign-stat-label">Respostas</div>
                        </div>
                    </div>
                    <div class="campaign-progress">
                        <div class="progress" style="height: 8px;">
                            <div class="progress-bar" style="width: ${deliveryRate}%; background: var(--success);"></div>
                        </div>
                    </div>
                </div>
                <div class="campaign-footer">
                    <span class="badge badge-secondary">${getCampaignTypeLabel(c.type)}</span>
                    <div class="campaign-actions">
                        <button class="btn btn-sm btn-outline" onclick="viewCampaign(${c.id})"><span class="icon icon-eye icon-sm"></span> Ver</button>
                        <button class="btn btn-sm btn-outline" onclick="editCampaign(${c.id})"><span class="icon icon-edit icon-sm"></span> Editar</button>
                        ${c.status === 'active' ? 
                            `<button class="btn btn-sm btn-warning" onclick="pauseCampaign(${c.id})"><span class="icon icon-pause icon-sm"></span> Pausar</button>` :
                            c.status === 'paused' || c.status === 'draft' ?
                            `<button class="btn btn-sm btn-success" onclick="startCampaign(${c.id})"><span class="icon icon-play icon-sm"></span> Iniciar</button>` : ''
                        }
                        <button class="btn btn-sm btn-outline-danger" onclick="deleteCampaign(${c.id})"><span class="icon icon-delete icon-sm"></span></button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

async function saveCampaign(statusOverride?: CampaignStatus) {
    const campaignId = getCampaignId();
    const statusFromSelect = ((document.getElementById('campaignStatus') as HTMLSelectElement | null)?.value || '') as CampaignStatus;
    const status = campaignId ? (statusFromSelect || statusOverride || 'draft') : (statusOverride || statusFromSelect || 'draft');
    const minSeconds = parseInt((document.getElementById('campaignDelayMin') as HTMLInputElement | null)?.value || String(DEFAULT_DELAY_MIN_SECONDS), 10);
    const maxSeconds = parseInt((document.getElementById('campaignDelayMax') as HTMLInputElement | null)?.value || String(DEFAULT_DELAY_MAX_SECONDS), 10);

    const normalizedMinSeconds = Number.isFinite(minSeconds) && minSeconds > 0 ? minSeconds : DEFAULT_DELAY_MIN_SECONDS;
    const normalizedMaxSeconds = Number.isFinite(maxSeconds) && maxSeconds > 0 ? maxSeconds : normalizedMinSeconds;
    const delayMinMs = Math.min(normalizedMinSeconds, normalizedMaxSeconds) * 1000;
    const delayMaxMs = Math.max(normalizedMinSeconds, normalizedMaxSeconds) * 1000;

    const data = {
        name: (document.getElementById('campaignName') as HTMLInputElement | null)?.value.trim() || '',
        description: (document.getElementById('campaignDescription') as HTMLInputElement | null)?.value.trim() || '',
        type: ((document.getElementById('campaignType') as HTMLSelectElement | null)?.value || 'trigger') as CampaignType,
        status,
        segment: (document.getElementById('campaignSegment') as HTMLSelectElement | null)?.value || '',
        tag_filter: (document.getElementById('campaignTagFilter') as HTMLInputElement | null)?.value.trim() || '',
        message: (document.getElementById('campaignMessage') as HTMLTextAreaElement | null)?.value.trim() || '',
        delay: delayMinMs,
        delay_min: delayMinMs,
        delay_max: delayMaxMs,
        start_at: (document.getElementById('campaignStart') as HTMLInputElement | null)?.value || ''
    };

    if (!data.name || !data.message) {
        showToast('error', 'Erro', 'Nome e mensagem são obrigatórios');
        return;
    }

    try {
        showLoading('Salvando campanha...');
        if (campaignId) {
            await api.put(`/api/campaigns/${campaignId}`, data);
        } else {
            await api.post('/api/campaigns', data);
        }
        closeModal('newCampaignModal');
        resetCampaignForm();
        await loadCampaigns();
        showToast('success', 'Sucesso', campaignId ? 'Campanha atualizada com sucesso!' : 'Campanha criada com sucesso!');
    } catch (error) {
        hideLoading();
        if (campaignId) {
            const index = campaigns.findIndex(c => c.id === campaignId);
            if (index >= 0) {
                campaigns[index] = {
                    ...campaigns[index],
                    ...data,
                    status
                };
            }
            showToast('success', 'Sucesso', 'Campanha atualizada com sucesso!');
        } else {
            // Simular sucesso para demonstra??o
            campaigns.push({
                id: campaigns.length + 1,
                ...data,
                sent: 0,
                delivered: 0,
                read: 0,
                replied: 0,
                created_at: new Date().toISOString()
            });
            showToast('success', 'Sucesso', 'Campanha criada com sucesso!');
        }
        closeModal('newCampaignModal');
        resetCampaignForm();
        renderCampaigns();
        updateStats();
    }
}

function viewCampaign(id: number) {
    const campaign = campaigns.find(c => c.id === id);
    if (!campaign) return;

    const detailsTitle = document.getElementById('detailsTitle') as HTMLElement | null;
    const campaignOverview = document.getElementById('campaignOverview') as HTMLElement | null;
    if (detailsTitle) {
        detailsTitle.innerHTML = `<span class="icon icon-campaigns icon-sm"></span> ${campaign.name}`;
    }
    
    if (campaignOverview) {
        campaignOverview.innerHTML = `
        <div class="stats-grid" style="margin-bottom: 20px;">
            <div class="stat-card">
                <div class="stat-content">
                    <div class="stat-value">${formatNumber(campaign.sent || 0)}</div>
                    <div class="stat-label">Enviadas</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-content">
                    <div class="stat-value">${formatNumber(campaign.delivered || 0)}</div>
                    <div class="stat-label">Entregues</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-content">
                    <div class="stat-value">${formatNumber(campaign.read || 0)}</div>
                    <div class="stat-label">Lidas</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-content">
                    <div class="stat-value">${formatNumber(campaign.replied || 0)}</div>
                    <div class="stat-label">Respostas</div>
                </div>
            </div>
        </div>
        <p><strong>Descrição:</strong> ${campaign.description || 'Sem descrição'}</p>
        <p><strong>Tipo:</strong> ${getCampaignTypeLabel(campaign.type)}</p>
        <p><strong>Status:</strong> ${getCampaignStatusLabel(campaign.status)}</p>
        <p><strong>Tag:</strong> ${campaign.tag_filter || 'Todas'}</p>
        <p><strong>Criada em:</strong> ${formatDate(campaign.created_at, 'datetime')}</p>
    `;
    }

    renderCampaignMessages(campaign);
    void loadCampaignRecipients(campaign);

    openModal('campaignDetailsModal');
    switchCampaignTab('overview');
}

function editCampaign(id: number) {
    const campaign = campaigns.find(c => c.id === id);
    if (!campaign) return;
    syncCampaignSegmentOptions();

    const idInput = document.getElementById('campaignId') as HTMLInputElement | null;
    if (idInput) idInput.value = String(campaign.id);

    const nameInput = document.getElementById('campaignName') as HTMLInputElement | null;
    if (nameInput) nameInput.value = campaign.name || '';

    const descriptionInput = document.getElementById('campaignDescription') as HTMLInputElement | null;
    if (descriptionInput) descriptionInput.value = campaign.description || '';

    setSelectValue(document.getElementById('campaignType') as HTMLSelectElement | null, campaign.type || 'broadcast');
    setSelectValue(document.getElementById('campaignStatus') as HTMLSelectElement | null, campaign.status || 'draft');
    setSelectValue(document.getElementById('campaignSegment') as HTMLSelectElement | null, campaign.segment || 'all');
    const tagFilterInput = document.getElementById('campaignTagFilter') as HTMLInputElement | null;
    if (tagFilterInput) tagFilterInput.value = campaign.tag_filter || '';

    const messageInput = document.getElementById('campaignMessage') as HTMLTextAreaElement | null;
    if (messageInput) messageInput.value = campaign.message || '';

    const { minMs, maxMs } = resolveCampaignDelayRangeMs(campaign);
    setDelayRangeInputs(Math.round(minMs / 1000), Math.round(maxMs / 1000));

    const startInput = document.getElementById('campaignStart') as HTMLInputElement | null;
    if (startInput) startInput.value = formatInputDateTime(campaign.start_at);

    setCampaignModalTitle('edit');

    const win = window as Window & { openModal?: (id: string) => void };
    win.openModal?.('newCampaignModal');
}

async function startCampaign(id: number) {
    if (!confirm('Iniciar esta campanha?')) return;
    try {
        await api.put(`/api/campaigns/${id}`, { status: 'active' });
    } catch (error) {
        // fallback local
    }
    const campaign = campaigns.find(c => c.id === id);
    if (campaign) campaign.status = 'active';
    renderCampaigns();
    updateStats();
    showToast('success', 'Sucesso', 'Campanha iniciada!');
}

async function pauseCampaign(id: number) {
    if (!confirm('Pausar esta campanha?')) return;
    try {
        await api.put(`/api/campaigns/${id}`, { status: 'paused' });
    } catch (error) {
        // fallback local
    }
    const campaign = campaigns.find(c => c.id === id);
    if (campaign) campaign.status = 'paused';
    renderCampaigns();
    updateStats();
    showToast('success', 'Sucesso', 'Campanha pausada!');
}

async function deleteCampaign(id: number) {
    if (!confirm('Excluir esta campanha?')) return;
    try {
        await api.delete(`/api/campaigns/${id}`);
    } catch (error) {
        // fallback local
    }
    campaigns = campaigns.filter(c => c.id !== id);
    renderCampaigns();
    updateStats();
    showToast('success', 'Sucesso', 'Campanha excluída!');
}

function switchCampaignTab(tab: string) {
    const tabOrder = ['overview', 'messages', 'recipients'];
    const resolvedTab = tabOrder.includes(tab) ? tab : 'overview';
    const activeIndex = tabOrder.indexOf(resolvedTab);

    const tabs = Array.from(document.querySelectorAll('#campaignDetailsModal .tab'));
    tabs.forEach((button, index) => {
        if (index === activeIndex) {
            button.classList.add('active');
        } else {
            button.classList.remove('active');
        }
    });

    document.querySelectorAll('#campaignDetailsModal .tab-content').forEach(c => c.classList.remove('active'));
    const activeContent = document.getElementById(`tab-${resolvedTab}`);
    const fallbackContent = document.getElementById('tab-overview');
    activeContent?.classList.add('active');
    if (!activeContent) {
        fallbackContent?.classList.add('active');
    }
}

const windowAny = window as Window & {
    initCampanhas?: () => void;
    loadCampaigns?: () => void;
    openCampaignModal?: () => void;
    openBroadcastModal?: () => void;
    saveCampaign?: (status?: CampaignStatus) => Promise<void>;
    viewCampaign?: (id: number) => void;
    editCampaign?: (id: number) => void;
    startCampaign?: (id: number) => Promise<void>;
    pauseCampaign?: (id: number) => Promise<void>;
    deleteCampaign?: (id: number) => Promise<void>;
    switchCampaignTab?: (tab: string) => void;
};
windowAny.initCampanhas = initCampanhas;
windowAny.loadCampaigns = loadCampaigns;
windowAny.openCampaignModal = openCampaignModal;
windowAny.openBroadcastModal = openBroadcastModal;
windowAny.saveCampaign = saveCampaign;
windowAny.viewCampaign = viewCampaign;
windowAny.editCampaign = editCampaign;
windowAny.startCampaign = startCampaign;
windowAny.pauseCampaign = pauseCampaign;
windowAny.deleteCampaign = deleteCampaign;
windowAny.switchCampaignTab = switchCampaignTab;

export { initCampanhas };


