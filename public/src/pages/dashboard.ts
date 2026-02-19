// Dashboard page logic migrated to module

// Dados dos leads
declare const Chart:
    | undefined
    | (new (ctx: HTMLCanvasElement | CanvasRenderingContext2D, config: Record<string, unknown>) => {
          destroy?: () => void;
      });

type LeadStatus = 1 | 2 | 3 | 4;

type Lead = {
    id: number;
    name?: string;
    phone?: string;
    vehicle?: string;
    plate?: string;
    email?: string;
    status: LeadStatus;
    created_at: string;
};

type LeadsResponse = { leads?: Lead[] };
type StatsMetric = 'novos_contatos' | 'mensagens' | 'interacoes';
type StatsChartType = 'line' | 'bar';
type StatsPeriodResponse = {
    labels?: string[];
    data?: number[];
};

let allLeads: Lead[] = [];
let selectedLeads: number[] = [];

let statsChartInstance: { destroy?: () => void } | null = null;
let statsChartType: StatsChartType = 'line';
let statsChartRequestSeq = 0;

const STATS_METRIC_LABELS: Record<StatsMetric, string> = {
    novos_contatos: 'Novos Contatos',
    mensagens: 'Mensagens',
    interacoes: 'Interações'
};

function normalizeDateInputValue(value: string | null | undefined) {
    const normalized = String(value || '').trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : '';
}

function getDefaultStatsRange() {
    const end = new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - 7);
    return {
        startDate: start.toISOString().slice(0, 10),
        endDate: end.toISOString().slice(0, 10)
    };
}

function normalizeRangeDates(startValue: string, endValue: string) {
    if (!startValue || !endValue) return { startDate: startValue, endDate: endValue };
    if (startValue <= endValue) {
        return { startDate: startValue, endDate: endValue };
    }
    return { startDate: endValue, endDate: startValue };
}

function buildStatsChartFallback(startDate: string, endDate: string) {
    const normalized = normalizeRangeDates(startDate, endDate);
    const start = new Date(`${normalized.startDate}T00:00:00.000Z`);
    const end = new Date(`${normalized.endDate}T00:00:00.000Z`);
    const labels: string[] = [];
    const data: number[] = [];
    const cursor = new Date(start);

    while (cursor <= end) {
        labels.push(cursor.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' }));
        data.push(0);
        cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    return { labels, data };
}

function getSelectedStatsMetric(): StatsMetric {
    const metricRaw = (document.getElementById('statsMetric') as HTMLSelectElement | null)?.value || 'novos_contatos';
    if (metricRaw === 'mensagens' || metricRaw === 'interacoes' || metricRaw === 'novos_contatos') {
        return metricRaw;
    }
    return 'novos_contatos';
}

function getStatsRangeFromControls() {
    const defaults = getDefaultStatsRange();
    const statsStart = document.getElementById('statsStartDate') as HTMLInputElement | null;
    const statsEnd = document.getElementById('statsEndDate') as HTMLInputElement | null;
    const startDate = normalizeDateInputValue(statsStart?.value) || defaults.startDate;
    const endDate = normalizeDateInputValue(statsEnd?.value) || defaults.endDate;
    return normalizeRangeDates(startDate, endDate);
}

function getStatsMetricColors(metric: StatsMetric) {
    if (metric === 'mensagens') {
        return {
            borderColor: '#22c55e',
            backgroundColor: 'rgba(34, 197, 94, 0.16)'
        };
    }
    if (metric === 'interacoes') {
        return {
            borderColor: '#38bdf8',
            backgroundColor: 'rgba(56, 189, 248, 0.16)'
        };
    }
    return {
        borderColor: '#667eea',
        backgroundColor: 'rgba(102, 126, 234, 0.16)'
    };
}

function updateChartTypeButtonsState() {
    const chartButtons = document.querySelectorAll('.chart-type-toggle .chart-btn');
    chartButtons.forEach((button) => {
        const type = (button as HTMLButtonElement).dataset.chartType === 'bar' ? 'bar' : 'line';
        button.classList.toggle('active', type === statsChartType);
    });
}

function renderStatsChart(labels: string[], values: number[], metric: StatsMetric) {
    const ctx = document.getElementById('statsChart') as HTMLCanvasElement | null;
    if (!ctx || typeof Chart === 'undefined') return;

    const chartLib = Chart as unknown as {
        getChart?: (canvas: HTMLCanvasElement) => { destroy: () => void } | undefined;
    };
    const existing = chartLib.getChart?.(ctx);
    if (existing) {
        existing.destroy();
    } else if (statsChartInstance?.destroy) {
        statsChartInstance.destroy();
    }

    const palette = getStatsMetricColors(metric);
    const dataset = {
        label: STATS_METRIC_LABELS[metric],
        data: values,
        borderColor: palette.borderColor,
        backgroundColor: palette.backgroundColor,
        borderWidth: 2,
        fill: statsChartType === 'line',
        tension: statsChartType === 'line' ? 0.3 : 0,
        pointRadius: statsChartType === 'line' ? 3 : 0,
        pointHoverRadius: statsChartType === 'line' ? 5 : 0
    };

    statsChartInstance = new Chart(ctx, {
        type: statsChartType,
        data: { labels, datasets: [dataset] },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        precision: 0
                    }
                }
            }
        }
    });
}

async function updateStatsPeriodChart(options: { silent?: boolean } = {}) {
    const metric = getSelectedStatsMetric();
    const range = getStatsRangeFromControls();
    const fallback = buildStatsChartFallback(range.startDate, range.endDate);
    const requestId = ++statsChartRequestSeq;

    try {
        const params = new URLSearchParams({
            startDate: range.startDate,
            endDate: range.endDate,
            metric
        });
        const response: StatsPeriodResponse = await api.get(`/api/dashboard/stats-period?${params.toString()}`);
        if (requestId !== statsChartRequestSeq) return;

        const labels = Array.isArray(response.labels) && response.labels.length > 0
            ? response.labels
            : fallback.labels;
        const values = labels.map((_, index) => {
            const source = Array.isArray(response.data) ? response.data[index] : 0;
            const parsed = Number(source);
            return Number.isFinite(parsed) ? parsed : 0;
        });

        renderStatsChart(labels, values, metric);
    } catch (error) {
        if (requestId !== statsChartRequestSeq) return;
        renderStatsChart(fallback.labels, fallback.data, metric);
        if (!options.silent) {
            showToast('warning', 'Aviso', 'Não foi possível atualizar o gráfico por período');
        }
        console.error(error);
    }
}

function bindStatsPeriodControls() {
    const statsStart = document.getElementById('statsStartDate') as HTMLInputElement | null;
    const statsEnd = document.getElementById('statsEndDate') as HTMLInputElement | null;
    const statsMetric = document.getElementById('statsMetric') as HTMLSelectElement | null;

    if (statsStart) {
        statsStart.onchange = () => {
            updateStatsPeriodChart();
        };
    }

    if (statsEnd) {
        statsEnd.onchange = () => {
            updateStatsPeriodChart();
        };
    }

    if (statsMetric) {
        statsMetric.onchange = () => {
            updateStatsPeriodChart();
        };
    }

    const chartButtons = document.querySelectorAll('.chart-type-toggle .chart-btn');
    chartButtons.forEach((button) => {
        (button as HTMLButtonElement).onclick = () => {
            const nextType = (button as HTMLButtonElement).dataset.chartType === 'bar' ? 'bar' : 'line';
            if (nextType === statsChartType) return;
            statsChartType = nextType;
            updateChartTypeButtonsState();
            updateStatsPeriodChart();
        };
    });

    updateChartTypeButtonsState();
}

function onReady(callback: () => void) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', callback);
    } else {
        callback();
    }
}

// Carregar dados ao iniciar
function initDashboard() {
    const defaults = getDefaultStatsRange();
    const statsStart = document.getElementById('statsStartDate') as HTMLInputElement | null;
    const statsEnd = document.getElementById('statsEndDate') as HTMLInputElement | null;
    if (statsStart && !normalizeDateInputValue(statsStart.value)) statsStart.value = defaults.startDate;
    if (statsEnd && !normalizeDateInputValue(statsEnd.value)) statsEnd.value = defaults.endDate;
    bindStatsPeriodControls();
    initStatsChart();
    loadDashboardData();
}

onReady(initDashboard);

// Carregar dados do dashboard
async function loadDashboardData() {
    try {
        showLoading('Carregando dados...');
        
        const response: LeadsResponse = await api.get('/api/leads');
        allLeads = response.leads || [];
        
        updateStats();
        updateFunnel();
        renderLeadsTable();
        await updateStatsPeriodChart({ silent: true });
        
        hideLoading();
    } catch (error) {
        hideLoading();
        showToast('error', 'Erro', 'Não foi possível carregar os dados');
        console.error(error);
    }
}

function initStatsChart() {
    const range = getStatsRangeFromControls();
    const fallback = buildStatsChartFallback(range.startDate, range.endDate);
    renderStatsChart(fallback.labels, fallback.data, getSelectedStatsMetric());
}

// Atualizar estatísticas
function updateStats() {
    const total = allLeads.length;
    const completed = allLeads.filter(l => l.status === 3).length;
    const pending = allLeads.filter(l => l.status === 1 || l.status === 2).length;
    const conversion = total > 0 ? (completed / total * 100) : 0;

    const totalLeads = document.getElementById('totalLeads') as HTMLElement | null;
    const completedLeads = document.getElementById('completedLeads') as HTMLElement | null;
    const pendingLeads = document.getElementById('pendingLeads') as HTMLElement | null;
    const conversionRate = document.getElementById('conversionRate') as HTMLElement | null;

    if (totalLeads) totalLeads.textContent = formatNumber(total);
    if (completedLeads) completedLeads.textContent = formatNumber(completed);
    if (pendingLeads) pendingLeads.textContent = formatNumber(pending);
    if (conversionRate) conversionRate.textContent = formatPercent(conversion);

    const statsContacts = document.getElementById('statsContacts') as HTMLElement | null;
    const statsMessages = document.getElementById('statsMessages') as HTMLElement | null;
    const statsInteractions = document.getElementById('statsInteractionsPer') as HTMLElement | null;
    if (statsContacts) statsContacts.textContent = formatNumber(total);
    if (statsMessages) statsMessages.textContent = formatNumber(total * 2);
    if (statsInteractions) statsInteractions.textContent = total > 0 ? (total * 2 / total).toFixed(1) : '0';
}

// Atualizar funil
function updateFunnel() {
    const total = allLeads.length;
    const stage1 = allLeads.filter(l => l.status === 1).length;
    const stage2 = allLeads.filter(l => l.status === 2).length;
    const stage3 = allLeads.filter(l => l.status === 3).length;
    const stage4 = allLeads.filter(l => l.status === 4).length;

    const funnel1 = document.getElementById('funnel1') as HTMLElement | null;
    const funnel2 = document.getElementById('funnel2') as HTMLElement | null;
    const funnel3 = document.getElementById('funnel3') as HTMLElement | null;
    const funnel4 = document.getElementById('funnel4') as HTMLElement | null;
    const funnel2Percent = document.getElementById('funnel2Percent') as HTMLElement | null;
    const funnel3Percent = document.getElementById('funnel3Percent') as HTMLElement | null;
    const funnel4Percent = document.getElementById('funnel4Percent') as HTMLElement | null;

    if (funnel1) funnel1.textContent = formatNumber(stage1 + stage2 + stage3);
    if (funnel2) funnel2.textContent = formatNumber(stage2 + stage3);
    if (funnel3) funnel3.textContent = formatNumber(stage3);
    if (funnel4) funnel4.textContent = formatNumber(stage3);

    if (total > 0) {
        if (funnel2Percent) funnel2Percent.textContent = formatPercent((stage2 + stage3) / total * 100);
        if (funnel3Percent) funnel3Percent.textContent = formatPercent(stage3 / total * 100);
        if (funnel4Percent) funnel4Percent.textContent = formatPercent(stage3 / total * 100);
    }
}

// Renderizar tabela de leads
function renderLeadsTable(leads: Lead[] | null = null) {
    const tbody = document.getElementById('leadsTableBody') as HTMLElement | null;
    if (!tbody) return;
    const data = leads || allLeads;

    if (data.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="table-empty">
                    <div class="table-empty-icon icon icon-empty icon-lg"></div>
                    <p>Nenhum lead encontrado</p>
                    <button class="btn btn-primary mt-3" onclick="openModal('addLeadModal')">Adicionar Lead</button>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = data.map(lead => `
        <tr data-id="${lead.id}">
            <td>
                <label class="checkbox-wrapper">
                    <input type="checkbox" class="lead-checkbox" value="${lead.id}" onchange="updateSelection()">
                    <span class="checkbox-custom"></span>
                </label>
            </td>
            <td>${formatDate(lead.created_at, 'datetime')}</td>
            <td>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div class="avatar" style="background: ${getAvatarColor(lead.name)}">
                        ${getInitials(lead.name)}
                    </div>
                    <span>${lead.name || 'Sem nome'}</span>
                </div>
            </td>
            <td>
                <a href="https://wa.me/55${lead.phone}" target="_blank" style="color: var(--whatsapp); text-decoration: none;">
                    ${formatPhone(lead.phone)}
                </a>
            </td>
            <td>${lead.plate || '-'}</td>
            <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${lead.vehicle || ''}">
                ${lead.vehicle || '-'}
            </td>
            <td>${getStatusBadge(lead.status)}</td>
            <td>
                <div style="display: flex; gap: 5px;">
                    <button class="btn btn-sm btn-whatsapp btn-icon" onclick="sendWhatsApp('${lead.phone}')" title="Enviar WhatsApp">
                        <span class="icon icon-message icon-sm"></span>
                    </button>
                    <button class="btn btn-sm btn-outline btn-icon" onclick="editLead(${lead.id})" title="Editar">
                        <span class="icon icon-edit icon-sm"></span>
                    </button>
                    <button class="btn btn-sm btn-outline-danger btn-icon" onclick="deleteLead(${lead.id})" title="Excluir">
                        <span class="icon icon-delete icon-sm"></span>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

// Filtrar leads
function filterLeads() {
    const search = (document.getElementById('searchLeads') as HTMLInputElement | null)?.value.toLowerCase() || '';
    const status = (document.getElementById('filterStatus') as HTMLSelectElement | null)?.value || '';

    let filtered = allLeads;

    if (search) {
        filtered = filtered.filter(l => 
            (l.name && l.name.toLowerCase().includes(search)) ||
            (l.phone && l.phone.includes(search)) ||
            (l.vehicle && l.vehicle.toLowerCase().includes(search)) ||
            (l.plate && l.plate.toLowerCase().includes(search))
        );
    }

    if (status) {
        filtered = filtered.filter(l => l.status == (parseInt(status, 10) as LeadStatus));
    }

    renderLeadsTable(filtered);
}

// Selecionar todos
function toggleSelectAll() {
    const selectAll = (document.getElementById('selectAll') as HTMLInputElement | null)?.checked || false;
    const checkboxes = document.querySelectorAll('.lead-checkbox');
    checkboxes.forEach(cb => {
        (cb as HTMLInputElement).checked = selectAll;
    });
    updateSelection();
}

// Atualizar seleção
function updateSelection() {
    const checkboxes = document.querySelectorAll('.lead-checkbox:checked');
    selectedLeads = Array.from(checkboxes).map(cb => parseInt((cb as HTMLInputElement).value, 10));
}

// Salvar novo lead
async function saveLead() {
    const name = (document.getElementById('leadName') as HTMLInputElement | null)?.value.trim() || '';
    const phone = (document.getElementById('leadPhone') as HTMLInputElement | null)?.value.replace(/\D/g, '') || '';
    const vehicle = (document.getElementById('leadVehicle') as HTMLInputElement | null)?.value.trim() || '';
    const plate = (document.getElementById('leadPlate') as HTMLInputElement | null)?.value.trim().toUpperCase() || '';
    const email = (document.getElementById('leadEmail') as HTMLInputElement | null)?.value.trim() || '';
    const status = parseInt((document.getElementById('leadStatus') as HTMLSelectElement | null)?.value || '1', 10) as LeadStatus;

    if (!name || !phone) {
        showToast('error', 'Erro', 'Nome e telefone são obrigatórios');
        return;
    }

    if (!validatePhone(phone)) {
        showToast('error', 'Erro', 'Telefone inválido');
        return;
    }

    try {
        showLoading('Salvando...');
        
        await api.post('/api/leads', {
            name, phone, vehicle, plate, email, status
        });

        closeModal('addLeadModal');
        (document.getElementById('addLeadForm') as HTMLFormElement | null)?.reset();
        
        await loadDashboardData();
        showToast('success', 'Sucesso', 'Lead adicionado com sucesso!');
    } catch (error) {
        hideLoading();
        showToast('error', 'Erro', error instanceof Error ? error.message : 'Não foi possível salvar o lead');
    }
}

// Editar lead
function editLead(id: number) {
    const lead = allLeads.find(l => l.id === id);
    if (!lead) return;

    const editLeadId = document.getElementById('editLeadId') as HTMLInputElement | null;
    const editLeadName = document.getElementById('editLeadName') as HTMLInputElement | null;
    const editLeadPhone = document.getElementById('editLeadPhone') as HTMLInputElement | null;
    const editLeadVehicle = document.getElementById('editLeadVehicle') as HTMLInputElement | null;
    const editLeadPlate = document.getElementById('editLeadPlate') as HTMLInputElement | null;
    const editLeadEmail = document.getElementById('editLeadEmail') as HTMLInputElement | null;
    const editLeadStatus = document.getElementById('editLeadStatus') as HTMLSelectElement | null;

    if (editLeadId) editLeadId.value = String(lead.id);
    if (editLeadName) editLeadName.value = lead.name || '';
    if (editLeadPhone) editLeadPhone.value = lead.phone || '';
    if (editLeadVehicle) editLeadVehicle.value = lead.vehicle || '';
    if (editLeadPlate) editLeadPlate.value = lead.plate || '';
    if (editLeadEmail) editLeadEmail.value = lead.email || '';
    if (editLeadStatus) editLeadStatus.value = String(lead.status || 1);

    openModal('editLeadModal');
}

// Atualizar lead
async function updateLead() {
    const id = (document.getElementById('editLeadId') as HTMLInputElement | null)?.value || '';
    const name = (document.getElementById('editLeadName') as HTMLInputElement | null)?.value.trim() || '';
    const phone = (document.getElementById('editLeadPhone') as HTMLInputElement | null)?.value.replace(/\D/g, '') || '';
    const vehicle = (document.getElementById('editLeadVehicle') as HTMLInputElement | null)?.value.trim() || '';
    const plate = (document.getElementById('editLeadPlate') as HTMLInputElement | null)?.value.trim().toUpperCase() || '';
    const email = (document.getElementById('editLeadEmail') as HTMLInputElement | null)?.value.trim() || '';
    const status = parseInt((document.getElementById('editLeadStatus') as HTMLSelectElement | null)?.value || '1', 10) as LeadStatus;

    if (!name || !phone) {
        showToast('error', 'Erro', 'Nome e telefone são obrigatórios');
        return;
    }

    try {
        showLoading('Salvando...');
        
        await api.put(`/api/leads/${id}`, {
            name, phone, vehicle, plate, email, status
        });

        closeModal('editLeadModal');
        await loadDashboardData();
        showToast('success', 'Sucesso', 'Lead atualizado com sucesso!');
    } catch (error) {
        hideLoading();
        showToast('error', 'Erro', error instanceof Error ? error.message : 'Não foi possível atualizar o lead');
    }
}

// Excluir lead
async function deleteLead(id: number) {
    if (!confirm('Tem certeza que deseja excluir este lead?')) return;

    try {
        showLoading('Excluindo...');
        await api.delete(`/api/leads/${id}`);
        await loadDashboardData();
        showToast('success', 'Sucesso', 'Lead excluído com sucesso!');
    } catch (error) {
        hideLoading();
        showToast('error', 'Erro', error instanceof Error ? error.message : 'Não foi possível excluir o lead');
    }
}

// Enviar WhatsApp
function sendWhatsApp(phone: string) {
    const cleanPhone = phone.replace(/\D/g, '');
    window.open(`https://wa.me/55${cleanPhone}`, '_blank');
}

// Importar leads
async function importLeads() {
    const fileInput = document.getElementById('importFile') as HTMLInputElement | null;
    const textInput = (document.getElementById('importText') as HTMLTextAreaElement | null)?.value.trim() || '';
    const importTagRaw = (document.getElementById('importTag') as HTMLInputElement | null)?.value.trim() || '';
    const importTags = importTagRaw
        .split(/[,;|]/)
        .map(t => t.trim())
        .filter(Boolean);

    let data: Array<Record<string, string>> = [];

    if (fileInput?.files && fileInput.files.length > 0) {
        const file = fileInput.files[0];
        const text = await file.text();
        data = parseCSV(text);
    } else if (textInput) {
        data = parseCSV(textInput);
    } else {
        showToast('error', 'Erro', 'Selecione um arquivo ou cole os dados');
        return;
    }

    if (data.length === 0) {
        showToast('error', 'Erro', 'Nenhum dado válido encontrado');
        return;
    }

    try {
        showLoading(`Importando ${data.length} leads...`);
        
        let imported = 0;
        for (const row of data) {
            const phone = (row.telefone || row.phone || row.whatsapp || '').replace(/\D/g, '');
            if (!phone) continue;

            try {
                await api.post('/api/leads', {
                    name: row.nome || row.name || 'Sem nome',
                    phone: phone,
                    vehicle: row.veiculo || row.vehicle || '',
                    plate: row.placa || row.plate || '',
                    status: 1,
                    tags: importTags,
                    source: 'import'
                });
                imported++;
            } catch (e) {
                console.error('Erro ao importar:', e);
            }
        }

        closeModal('importModal');
        if (fileInput) fileInput.value = '';
        const importText = document.getElementById('importText') as HTMLTextAreaElement | null;
        if (importText) importText.value = '';
        const importTag = document.getElementById('importTag') as HTMLInputElement | null;
        if (importTag) importTag.value = '';
        
        await loadDashboardData();
        showToast('success', 'Sucesso', `${imported} leads importados com sucesso!`);
    } catch (error) {
        hideLoading();
        showToast('error', 'Erro', 'Falha na importação');
    }
}

// Exportar leads
function exportLeads() {
    if (allLeads.length === 0) {
        showToast('warning', 'Aviso', 'Nenhum lead para exportar');
        return;
    }

    const data = allLeads.map(l => ({
        nome: l.name,
        telefone: l.phone,
        veiculo: l.vehicle,
        placa: l.plate,
        email: l.email,
        status: getStatusLabel(l.status),
        data: formatDate(l.created_at, 'datetime')
    }));

    exportToCSV(data, `leads_self_${formatDate(new Date(), 'short').replace(/\//g, '-')}.csv`);
    showToast('success', 'Sucesso', 'Leads exportados com sucesso!');
}

// Confirmar reset
function confirmReset() {
    if (!confirm('ATENÇÃO: Esta ação irá excluir TODOS os leads. Deseja continuar?')) return;
    if (!confirm('Tem certeza absoluta? Esta ação não pode ser desfeita!')) return;
    
    showToast('info', 'Info', 'Função de reset desabilitada por segurança');
}

const windowAny = window as Window & {
    initDashboard?: () => void;
    loadDashboardData?: () => Promise<void>;
    updateStats?: () => void;
    updateFunnel?: () => void;
    renderLeadsTable?: (leads?: Lead[] | null) => void;
    filterLeads?: () => void;
    toggleSelectAll?: () => void;
    updateSelection?: () => void;
    saveLead?: () => Promise<void>;
    editLead?: (id: number) => void;
    updateLead?: () => Promise<void>;
    deleteLead?: (id: number) => Promise<void>;
    sendWhatsApp?: (phone: string) => void;
    importLeads?: () => Promise<void>;
    exportLeads?: () => void;
    confirmReset?: () => void;
};
windowAny.initDashboard = initDashboard;
windowAny.loadDashboardData = loadDashboardData;
windowAny.updateStats = updateStats;
windowAny.updateFunnel = updateFunnel;
windowAny.renderLeadsTable = renderLeadsTable;
windowAny.filterLeads = filterLeads;
windowAny.toggleSelectAll = toggleSelectAll;
windowAny.updateSelection = updateSelection;
windowAny.saveLead = saveLead;
windowAny.editLead = editLead;
windowAny.updateLead = updateLead;
windowAny.deleteLead = deleteLead;
windowAny.sendWhatsApp = sendWhatsApp;
windowAny.importLeads = importLeads;
windowAny.exportLeads = exportLeads;
windowAny.confirmReset = confirmReset;

export { initDashboard };
