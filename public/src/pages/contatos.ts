// Contatos page logic migrated to module

type LeadStatus = 1 | 2 | 3 | 4;

type Contact = {
    id: number;
    name?: string;
    phone?: string;
    vehicle?: string;
    plate?: string;
    email?: string;
    status: LeadStatus;
    tags?: string;
    last_message_at?: string;
    created_at: string;
    notes?: string;
};

type Tag = { id: number; name: string };
type Template = { id: number; name: string; content: string };

type LeadsResponse = { leads?: Contact[] };
type TagsResponse = { tags?: Tag[] };
type TemplatesResponse = { templates?: Template[] };

let allContacts: Contact[] = [];
let filteredContacts: Contact[] = [];
let selectedContacts: number[] = [];
let currentPage = 1;
const perPage = 20;
let tags: Tag[] = [];

function onReady(callback: () => void) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', callback);
    } else {
        callback();
    }
}

function initContacts() {
    loadContacts();
    loadTags();
    loadTemplates();
}

onReady(initContacts);

async function loadContacts() {
    try {
        showLoading('Carregando contatos...');
        const response: LeadsResponse = await api.get('/api/leads');
        allContacts = response.leads || [];
        filteredContacts = [...allContacts];
        updateStats();
        renderContacts();
        hideLoading();
    } catch (error) {
        hideLoading();
        showToast('error', 'Erro', 'Não foi possível carregar os contatos');
    }
}

async function loadTags() {
    try {
        const response: TagsResponse = await api.get('/api/tags');
        tags = response.tags || [];
        const select = document.getElementById('filterTag') as HTMLSelectElement | null;
        if (!select) return;
        tags.forEach(tag => {
            select.innerHTML += `<option value="${tag.id}">${tag.name}</option>`;
        });
    } catch (e) {}
}

async function loadTemplates() {
    try {
        const response: TemplatesResponse = await api.get('/api/templates');
        const templates = response.templates || [];
        const select = document.getElementById('bulkTemplate') as HTMLSelectElement | null;
        if (!select) return;
        templates.forEach(t => {
            select.innerHTML += `<option value="${t.id}" data-content="${encodeURIComponent(t.content)}">${t.name}</option>`;
        });
    } catch (e) {}
}

function loadTemplate() {
    const select = document.getElementById('bulkTemplate') as HTMLSelectElement | null;
    if (!select) return;
    const option = select.options[select.selectedIndex];
    if (option?.dataset?.content) {
        const bulkMessage = document.getElementById('bulkMessage') as HTMLTextAreaElement | null;
        if (bulkMessage) {
            bulkMessage.value = decodeURIComponent(option.dataset.content);
        }
    }
}

function updateStats() {
    const totalContacts = document.getElementById('totalContacts') as HTMLElement | null;
    const activeContacts = document.getElementById('activeContacts') as HTMLElement | null;
    const newContacts = document.getElementById('newContacts') as HTMLElement | null;
    const withWhatsapp = document.getElementById('withWhatsapp') as HTMLElement | null;

    if (totalContacts) totalContacts.textContent = formatNumber(allContacts.length);
    if (activeContacts) {
        activeContacts.textContent = formatNumber(allContacts.filter(c => c.status !== 4).length);
    }
    
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    if (newContacts) {
        newContacts.textContent = formatNumber(
            allContacts.filter(c => new Date(c.created_at) > weekAgo).length
        );
    }
    if (withWhatsapp) {
        withWhatsapp.textContent = formatNumber(
            allContacts.filter(c => c.phone).length
        );
    }
}

function renderContacts() {
    const tbody = document.getElementById('contactsTableBody') as HTMLElement | null;
    if (!tbody) return;
    const start = (currentPage - 1) * perPage;
    const end = start + perPage;
    const pageContacts = filteredContacts.slice(start, end);

    if (pageContacts.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" class="table-empty"><div class="table-empty-icon icon icon-empty icon-lg"></div><p>Nenhum contato encontrado</p></td></tr>`;
    } else {
        tbody.innerHTML = pageContacts.map(c => `
            <tr data-id="${c.id}">
                <td><label class="checkbox-wrapper"><input type="checkbox" class="contact-checkbox" value="${c.id}" onchange="updateSelection()"><span class="checkbox-custom"></span></label></td>
                <td>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <div class="avatar" style="background: ${getAvatarColor(c.name)}">${getInitials(c.name)}</div>
                        <div>
                            <div style="font-weight: 600;">${c.name || 'Sem nome'}</div>
                            <div style="font-size: 12px; color: var(--gray-500);">${c.email || ''}</div>
                        </div>
                    </div>
                </td>
                <td><a href="https://wa.me/55${c.phone}" target="_blank" style="color: var(--whatsapp);">${formatPhone(c.phone)}</a></td>
                <td style="max-width: 150px; overflow: hidden; text-overflow: ellipsis;">${c.vehicle || '-'}</td>
                <td>${c.plate || '-'}</td>
                <td>${getStatusBadge(c.status)}</td>
                <td>${c.tags || '-'}</td>
                <td>${c.last_message_at ? timeAgo(c.last_message_at) : '-'}</td>
                <td>
                    <div style="display: flex; gap: 5px;">
                        <button class="btn btn-sm btn-whatsapp btn-icon" onclick="quickMessage(${c.id})" title="Mensagem"><span class="icon icon-message icon-sm"></span></button>
                        <button class="btn btn-sm btn-outline btn-icon" onclick="editContact(${c.id})" title="Editar"><span class="icon icon-edit icon-sm"></span></button>
                        <button class="btn btn-sm btn-outline-danger btn-icon" onclick="deleteContact(${c.id})" title="Excluir"><span class="icon icon-delete icon-sm"></span></button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    // Paginação
    const total = filteredContacts.length;
    const totalPages = Math.ceil(total / perPage);
    const paginationInfo = document.getElementById('paginationInfo') as HTMLElement | null;
    const prevPage = document.getElementById('prevPage') as HTMLButtonElement | null;
    const nextPage = document.getElementById('nextPage') as HTMLButtonElement | null;
    if (paginationInfo) {
        paginationInfo.textContent = `Mostrando ${start + 1}-${Math.min(end, total)} de ${total} contatos`;
    }
    if (prevPage) prevPage.disabled = currentPage === 1;
    if (nextPage) nextPage.disabled = currentPage >= totalPages;
}

function changePage(delta: number) {
    currentPage += delta;
    renderContacts();
}

function filterContacts() {
    const search = (document.getElementById('searchContacts') as HTMLInputElement | null)?.value.toLowerCase() || '';
    const status = (document.getElementById('filterStatus') as HTMLSelectElement | null)?.value || '';
    const tag = (document.getElementById('filterTag') as HTMLSelectElement | null)?.value || '';

    filteredContacts = allContacts.filter(c => {
        const matchSearch = !search || 
            (c.name && c.name.toLowerCase().includes(search)) ||
            (c.phone && c.phone.includes(search)) ||
            (c.vehicle && c.vehicle.toLowerCase().includes(search)) ||
            (c.plate && c.plate.toLowerCase().includes(search));
        const matchStatus = !status || c.status == (parseInt(status, 10) as LeadStatus);
        const matchTag = !tag || (c.tags && c.tags.includes(tag));
        return matchSearch && matchStatus && matchTag;
    });

    currentPage = 1;
    renderContacts();
}

function toggleSelectAll() {
    const checked = (document.getElementById('selectAll') as HTMLInputElement | null)?.checked || false;
    document.querySelectorAll('.contact-checkbox').forEach(cb => {
        (cb as HTMLInputElement).checked = checked;
    });
    updateSelection();
}

function updateSelection() {
    selectedContacts = Array.from(document.querySelectorAll('.contact-checkbox:checked'))
        .map(cb => parseInt((cb as HTMLInputElement).value, 10));
    const bulkActions = document.getElementById('bulkActions') as HTMLElement | null;
    const selectedCount = document.getElementById('selectedCount') as HTMLElement | null;
    if (bulkActions) bulkActions.style.display = selectedContacts.length > 0 ? 'block' : 'none';
    if (selectedCount) selectedCount.textContent = String(selectedContacts.length);
}

function clearSelection() {
    const selectAll = document.getElementById('selectAll') as HTMLInputElement | null;
    if (selectAll) selectAll.checked = false;
    document.querySelectorAll('.contact-checkbox').forEach(cb => {
        (cb as HTMLInputElement).checked = false;
    });
    updateSelection();
}

async function saveContact() {
    const data = {
        name: (document.getElementById('contactName') as HTMLInputElement | null)?.value.trim() || '',
        phone: (document.getElementById('contactPhone') as HTMLInputElement | null)?.value.replace(/\D/g, '') || '',
        vehicle: (document.getElementById('contactVehicle') as HTMLInputElement | null)?.value.trim() || '',
        plate: (document.getElementById('contactPlate') as HTMLInputElement | null)?.value.trim().toUpperCase() || '',
        email: (document.getElementById('contactEmail') as HTMLInputElement | null)?.value.trim() || '',
        status: parseInt((document.getElementById('contactStatus') as HTMLSelectElement | null)?.value || '1', 10) as LeadStatus,
        source: (document.getElementById('contactSource') as HTMLSelectElement | null)?.value || ''
    };

    if (!data.name || !data.phone) {
        showToast('error', 'Erro', 'Nome e telefone são obrigatórios');
        return;
    }

    try {
        showLoading('Salvando...');
        await api.post('/api/leads', data);
        closeModal('addContactModal');
        (document.getElementById('addContactForm') as HTMLFormElement | null)?.reset();
        await loadContacts();
        showToast('success', 'Sucesso', 'Contato adicionado!');
    } catch (error) {
        hideLoading();
        showToast('error', 'Erro', error instanceof Error ? error.message : 'Erro ao salvar');
    }
}

function editContact(id: number) {
    const contact = allContacts.find(c => c.id === id);
    if (!contact) return;

    const editContactId = document.getElementById('editContactId') as HTMLInputElement | null;
    const editContactName = document.getElementById('editContactName') as HTMLInputElement | null;
    const editContactPhone = document.getElementById('editContactPhone') as HTMLInputElement | null;
    const editContactVehicle = document.getElementById('editContactVehicle') as HTMLInputElement | null;
    const editContactPlate = document.getElementById('editContactPlate') as HTMLInputElement | null;
    const editContactEmail = document.getElementById('editContactEmail') as HTMLInputElement | null;
    const editContactStatus = document.getElementById('editContactStatus') as HTMLSelectElement | null;
    const editContactNotes = document.getElementById('editContactNotes') as HTMLTextAreaElement | null;

    if (editContactId) editContactId.value = String(contact.id);
    if (editContactName) editContactName.value = contact.name || '';
    if (editContactPhone) editContactPhone.value = contact.phone || '';
    if (editContactVehicle) editContactVehicle.value = contact.vehicle || '';
    if (editContactPlate) editContactPlate.value = contact.plate || '';
    if (editContactEmail) editContactEmail.value = contact.email || '';
    if (editContactStatus) editContactStatus.value = String(contact.status || 1);
    if (editContactNotes) editContactNotes.value = contact.notes || '';

    openModal('editContactModal');
}

async function updateContact() {
    const id = (document.getElementById('editContactId') as HTMLInputElement | null)?.value || '';
    const data = {
        name: (document.getElementById('editContactName') as HTMLInputElement | null)?.value.trim() || '',
        phone: (document.getElementById('editContactPhone') as HTMLInputElement | null)?.value.replace(/\D/g, '') || '',
        vehicle: (document.getElementById('editContactVehicle') as HTMLInputElement | null)?.value.trim() || '',
        plate: (document.getElementById('editContactPlate') as HTMLInputElement | null)?.value.trim().toUpperCase() || '',
        email: (document.getElementById('editContactEmail') as HTMLInputElement | null)?.value.trim() || '',
        status: parseInt((document.getElementById('editContactStatus') as HTMLSelectElement | null)?.value || '1', 10) as LeadStatus
    };

    try {
        showLoading('Salvando...');
        await api.put(`/api/leads/${id}`, data);
        closeModal('editContactModal');
        await loadContacts();
        showToast('success', 'Sucesso', 'Contato atualizado!');
    } catch (error) {
        hideLoading();
        showToast('error', 'Erro', error instanceof Error ? error.message : 'Erro ao salvar');
    }
}

async function deleteContact(id: number) {
    if (!confirm('Excluir este contato?')) return;
    try {
        showLoading('Excluindo...');
        await api.delete(`/api/leads/${id}`);
        await loadContacts();
        showToast('success', 'Sucesso', 'Contato excluído!');
    } catch (error) {
        hideLoading();
        showToast('error', 'Erro', error instanceof Error ? error.message : 'Erro ao excluir');
    }
}

function quickMessage(id: number) {
    const contact = allContacts.find(c => c.id === id);
    if (contact) {
        window.open(`https://wa.me/55${contact.phone}`, '_blank');
    }
}

function openWhatsApp() {
    const phone = (document.getElementById('editContactPhone') as HTMLInputElement | null)?.value.replace(/\D/g, '') || '';
    if (phone) {
        window.open(`https://wa.me/55${phone}`, '_blank');
    }
}

function bulkSendMessage() {
    const bulkRecipients = document.getElementById('bulkRecipients') as HTMLElement | null;
    if (bulkRecipients) bulkRecipients.textContent = String(selectedContacts.length);
    openModal('bulkMessageModal');
}

async function sendBulkMessage() {
    const message = (document.getElementById('bulkMessage') as HTMLTextAreaElement | null)?.value.trim() || '';
    const delay = parseInt((document.getElementById('bulkDelay') as HTMLInputElement | null)?.value || '0', 10);

    if (!message) {
        showToast('error', 'Erro', 'Digite uma mensagem');
        return;
    }

    if (APP.whatsappStatus !== 'connected') {
        showToast('error', 'Erro', 'WhatsApp não está conectado');
        return;
    }

    try {
        showLoading('Adicionando à fila...');
        
        const contacts = allContacts.filter(c => selectedContacts.includes(c.id));
        
        await api.post('/api/queue/bulk', {
            leadIds: selectedContacts,
            content: message,
            delay: delay
        });

        closeModal('bulkMessageModal');
        clearSelection();
        showToast('success', 'Sucesso', `${contacts.length} mensagens adicionadas à fila!`);
        hideLoading();
    } catch (error) {
        hideLoading();
        showToast('error', 'Erro', error instanceof Error ? error.message : 'Erro ao enviar');
    }
}

async function bulkDelete() {
    if (!confirm(`Excluir ${selectedContacts.length} contatos?`)) return;
    
    try {
        showLoading('Excluindo...');
        for (const id of selectedContacts) {
            await api.delete(`/api/leads/${id}`);
        }
        clearSelection();
        await loadContacts();
        showToast('success', 'Sucesso', 'Contatos excluídos!');
    } catch (error) {
        hideLoading();
        showToast('error', 'Erro', error instanceof Error ? error.message : 'Erro ao excluir');
    }
}

function bulkChangeStatus() {
    const status = prompt('Novo status (1=Novo, 2=Em Andamento, 3=Concluído, 4=Perdido):');
    if (!status || ![1,2,3,4].includes(parseInt(status))) return;
    
    // Implementar mudança em lote
    showToast('info', 'Info', 'Função em desenvolvimento');
}

function bulkAddTag() {
    showToast('info', 'Info', 'Função em desenvolvimento');
}

async function importContacts() {
    const fileInput = document.getElementById('importFile') as HTMLInputElement | null;
    const textInput = (document.getElementById('importText') as HTMLTextAreaElement | null)?.value.trim() || '';
    const status = parseInt((document.getElementById('importStatus') as HTMLSelectElement | null)?.value || '1', 10) as LeadStatus;

    let data: Array<Record<string, string>> = [];
    if (fileInput?.files && fileInput.files.length > 0) {
        const text = await fileInput.files[0].text();
        data = parseCSV(text);
    } else if (textInput) {
        data = parseCSV(textInput);
    }

    if (data.length === 0) {
        showToast('error', 'Erro', 'Nenhum dado válido');
        return;
    }

    try {
        showLoading(`Importando ${data.length} contatos...`);
        let imported = 0;
        
        for (const row of data) {
            const phone = (row.telefone || row.phone || '').replace(/\D/g, '');
            if (!phone) continue;
            
            try {
                await api.post('/api/leads', {
                    name: row.nome || row.name || 'Sem nome',
                    phone,
                    vehicle: row.veiculo || row.vehicle || '',
                    plate: row.placa || row.plate || '',
                    email: row.email || '',
                    status
                });
                imported++;
            } catch (e) {}
        }

        closeModal('importModal');
        await loadContacts();
        showToast('success', 'Sucesso', `${imported} contatos importados!`);
    } catch (error) {
        hideLoading();
        showToast('error', 'Erro', 'Falha na importação');
    }
}

function exportContacts() {
    const data = filteredContacts.map(c => ({
        nome: c.name,
        telefone: c.phone,
        veiculo: c.vehicle,
        placa: c.plate,
        email: c.email,
        status: getStatusLabel(c.status)
    }));
    exportToCSV(data, `contatos_${formatDate(new Date(), 'short').replace(/\//g, '-')}.csv`);
    showToast('success', 'Sucesso', 'Contatos exportados!');
}

function switchTab(tab: string) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelector(`.tab[onclick="switchTab('${tab}')"]`)?.classList.add('active');
    document.getElementById(`tab-${tab}`)?.classList.add('active');
}

function getStatusLabel(status: number) {
    return LEAD_STATUS[status]?.label || 'Desconhecido';
}

const windowAny = window as Window & {
    initContacts?: () => void;
    changePage?: (delta: number) => void;
    filterContacts?: () => void;
    toggleSelectAll?: () => void;
    updateSelection?: () => void;
    clearSelection?: () => void;
    saveContact?: () => Promise<void>;
    editContact?: (id: number) => void;
    updateContact?: () => Promise<void>;
    deleteContact?: (id: number) => Promise<void>;
    quickMessage?: (id: number) => void;
    openWhatsApp?: () => void;
    bulkSendMessage?: () => void;
    sendBulkMessage?: () => Promise<void>;
    bulkDelete?: () => Promise<void>;
    bulkChangeStatus?: () => void;
    bulkAddTag?: () => void;
    importContacts?: () => Promise<void>;
    exportContacts?: () => void;
    switchTab?: (tab: string) => void;
    loadTemplate?: () => void;
};
windowAny.initContacts = initContacts;
windowAny.changePage = changePage;
windowAny.filterContacts = filterContacts;
windowAny.toggleSelectAll = toggleSelectAll;
windowAny.updateSelection = updateSelection;
windowAny.clearSelection = clearSelection;
windowAny.saveContact = saveContact;
windowAny.editContact = editContact;
windowAny.updateContact = updateContact;
windowAny.deleteContact = deleteContact;
windowAny.quickMessage = quickMessage;
windowAny.openWhatsApp = openWhatsApp;
windowAny.bulkSendMessage = bulkSendMessage;
windowAny.sendBulkMessage = sendBulkMessage;
windowAny.bulkDelete = bulkDelete;
windowAny.bulkChangeStatus = bulkChangeStatus;
windowAny.bulkAddTag = bulkAddTag;
windowAny.importContacts = importContacts;
windowAny.exportContacts = exportContacts;
windowAny.switchTab = switchTab;
windowAny.loadTemplate = loadTemplate;

export { initContacts };
