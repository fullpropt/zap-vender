// @ts-nocheck
// Dashboard page logic migrated to module

// Dados dos leads
let allLeads = [];
let selectedLeads = [];

let statsChartInstance = null;

// Carregar dados ao iniciar
document.addEventListener('DOMContentLoaded', () => {
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    document.getElementById('statsStartDate').value = weekAgo.toISOString().slice(0, 10);
    document.getElementById('statsEndDate').value = today.toISOString().slice(0, 10);
    initStatsChart();
    loadDashboardData();
});

// Carregar dados do dashboard
async function loadDashboardData() {
    try {
        showLoading('Carregando dados...');
        
        const response = await api.get('/api/leads');
        allLeads = response.leads || [];
        
        updateStats();
        updateFunnel();
        renderLeadsTable();
        
        hideLoading();
    } catch (error) {
        hideLoading();
        showToast('error', 'Erro', 'Não foi possível carregar os dados');
        console.error(error);
    }
}

function initStatsChart() {
    const ctx = document.getElementById('statsChart');
    if (!ctx || typeof Chart === 'undefined') return;
    const labels = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        labels.push(d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }));
    }
    statsChartInstance = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets: [{ label: 'Novos Contatos', data: [0, 0, 0, 0, 0, 0, 0], borderColor: '#667eea', backgroundColor: 'rgba(102, 126, 234, 0.1)', fill: true, tension: 0.3 }] },
        options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
    });
}

// Atualizar estatísticas
function updateStats() {
    const total = allLeads.length;
    const completed = allLeads.filter(l => l.status === 3).length;
    const pending = allLeads.filter(l => l.status === 1 || l.status === 2).length;
    const conversion = total > 0 ? (completed / total * 100) : 0;

    document.getElementById('totalLeads').textContent = formatNumber(total);
    document.getElementById('completedLeads').textContent = formatNumber(completed);
    document.getElementById('pendingLeads').textContent = formatNumber(pending);
    document.getElementById('conversionRate').textContent = formatPercent(conversion);

    document.getElementById('statsContacts').textContent = formatNumber(total);
    document.getElementById('statsMessages').textContent = formatNumber(total * 2);
    document.getElementById('statsInteractionsPer').textContent = total > 0 ? (total * 2 / total).toFixed(1) : '0';
}

// Atualizar funil
function updateFunnel() {
    const total = allLeads.length;
    const stage1 = allLeads.filter(l => l.status === 1).length;
    const stage2 = allLeads.filter(l => l.status === 2).length;
    const stage3 = allLeads.filter(l => l.status === 3).length;
    const stage4 = allLeads.filter(l => l.status === 4).length;

    document.getElementById('funnel1').textContent = formatNumber(stage1 + stage2 + stage3);
    document.getElementById('funnel2').textContent = formatNumber(stage2 + stage3);
    document.getElementById('funnel3').textContent = formatNumber(stage3);
    document.getElementById('funnel4').textContent = formatNumber(stage3);

    if (total > 0) {
        document.getElementById('funnel2Percent').textContent = formatPercent((stage2 + stage3) / total * 100);
        document.getElementById('funnel3Percent').textContent = formatPercent(stage3 / total * 100);
        document.getElementById('funnel4Percent').textContent = formatPercent(stage3 / total * 100);
    }
}

// Renderizar tabela de leads
function renderLeadsTable(leads = null) {
    const tbody = document.getElementById('leadsTableBody');
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
    const search = document.getElementById('searchLeads').value.toLowerCase();
    const status = document.getElementById('filterStatus').value;

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
        filtered = filtered.filter(l => l.status == status);
    }

    renderLeadsTable(filtered);
}

// Selecionar todos
function toggleSelectAll() {
    const selectAll = document.getElementById('selectAll').checked;
    const checkboxes = document.querySelectorAll('.lead-checkbox');
    checkboxes.forEach(cb => cb.checked = selectAll);
    updateSelection();
}

// Atualizar seleção
function updateSelection() {
    const checkboxes = document.querySelectorAll('.lead-checkbox:checked');
    selectedLeads = Array.from(checkboxes).map(cb => parseInt(cb.value));
}

// Salvar novo lead
async function saveLead() {
    const name = document.getElementById('leadName').value.trim();
    const phone = document.getElementById('leadPhone').value.replace(/\D/g, '');
    const vehicle = document.getElementById('leadVehicle').value.trim();
    const plate = document.getElementById('leadPlate').value.trim().toUpperCase();
    const email = document.getElementById('leadEmail').value.trim();
    const status = parseInt(document.getElementById('leadStatus').value);

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
        document.getElementById('addLeadForm').reset();
        
        await loadDashboardData();
        showToast('success', 'Sucesso', 'Lead adicionado com sucesso!');
    } catch (error) {
        hideLoading();
        showToast('error', 'Erro', error.message || 'Não foi possível salvar o lead');
    }
}

// Editar lead
function editLead(id) {
    const lead = allLeads.find(l => l.id === id);
    if (!lead) return;

    document.getElementById('editLeadId').value = lead.id;
    document.getElementById('editLeadName').value = lead.name || '';
    document.getElementById('editLeadPhone').value = lead.phone || '';
    document.getElementById('editLeadVehicle').value = lead.vehicle || '';
    document.getElementById('editLeadPlate').value = lead.plate || '';
    document.getElementById('editLeadEmail').value = lead.email || '';
    document.getElementById('editLeadStatus').value = lead.status || 1;

    openModal('editLeadModal');
}

// Atualizar lead
async function updateLead() {
    const id = document.getElementById('editLeadId').value;
    const name = document.getElementById('editLeadName').value.trim();
    const phone = document.getElementById('editLeadPhone').value.replace(/\D/g, '');
    const vehicle = document.getElementById('editLeadVehicle').value.trim();
    const plate = document.getElementById('editLeadPlate').value.trim().toUpperCase();
    const email = document.getElementById('editLeadEmail').value.trim();
    const status = parseInt(document.getElementById('editLeadStatus').value);

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
        showToast('error', 'Erro', error.message || 'Não foi possível atualizar o lead');
    }
}

// Excluir lead
async function deleteLead(id) {
    if (!confirm('Tem certeza que deseja excluir este lead?')) return;

    try {
        showLoading('Excluindo...');
        await api.delete(`/api/leads/${id}`);
        await loadDashboardData();
        showToast('success', 'Sucesso', 'Lead excluído com sucesso!');
    } catch (error) {
        hideLoading();
        showToast('error', 'Erro', error.message || 'Não foi possível excluir o lead');
    }
}

// Enviar WhatsApp
function sendWhatsApp(phone) {
    const cleanPhone = phone.replace(/\D/g, '');
    window.open(`https://wa.me/55${cleanPhone}`, '_blank');
}

// Importar leads
async function importLeads() {
    const fileInput = document.getElementById('importFile');
    const textInput = document.getElementById('importText').value.trim();

    let data = [];

    if (fileInput.files.length > 0) {
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
                    status: 1
                });
                imported++;
            } catch (e) {
                console.error('Erro ao importar:', e);
            }
        }

        closeModal('importModal');
        document.getElementById('importFile').value = '';
        document.getElementById('importText').value = '';
        
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

const windowAny = window as any;
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

export {};
