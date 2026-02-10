// Configuracoes page logic migrated to module

type Settings = {
    company?: { name?: string; cnpj?: string; phone?: string; email?: string };
    funnel?: Array<{ name?: string; color?: string; description?: string }>;
    whatsapp?: { interval?: string; messagesPerHour?: string; workStart?: string; workEnd?: string };
};

type TemplateItem = {
    id: number;
    name: string;
    category?: string;
    content: string;
    variables?: string[];
    media_type?: string;
    media_url?: string;
};

let templatesCache: TemplateItem[] = [];

function onReady(callback: () => void) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', callback);
    } else {
        callback();
    }
}


function getPanelFromLocation() {
    const hash = window.location.hash || '';
    if (!hash) return null;

    if (hash.startsWith('#/')) {
        const queryIndex = hash.indexOf('?');
        if (queryIndex >= 0) {
            const params = new URLSearchParams(hash.slice(queryIndex + 1));
            return params.get('panel');
        }
        return null;
    }

    return hash.startsWith('#') ? hash.slice(1) : hash;
}

function initConfiguracoes() {
    loadSettings();
    loadTemplates();
    checkWhatsAppStatus();
    updateNewTemplateForm();
    const typeSelect = document.getElementById('newTemplateType') as HTMLSelectElement | null;
    if (typeSelect) {
        typeSelect.addEventListener('change', updateNewTemplateForm);
    }
    const panelFromUrl = getPanelFromLocation();
    if (panelFromUrl) {
        const panel = document.getElementById(`panel-${panelFromUrl}`);
        if (panel) {
            document.querySelectorAll('.settings-nav-item').forEach(i => i.classList.remove('active'));
            document.querySelector(`[onclick="showPanel('${panelFromUrl}')"]`)?.classList.add('active');
            document.querySelectorAll('.settings-panel').forEach(p => p.classList.remove('active'));
            panel.classList.add('active');
        }
    }
}

onReady(initConfiguracoes);

function showPanel(panelId: string) {
    document.querySelectorAll('.settings-nav-item').forEach(item => item.classList.remove('active'));
    const target = (window as any).event?.target as HTMLElement | undefined;
    target?.closest('.settings-nav-item')?.classList.add('active');
    document.querySelectorAll('.settings-panel').forEach(panel => panel.classList.remove('active'));
    document.getElementById(`panel-${panelId}`).classList.add('active');
}

function loadSettings() {
    const settings: Settings = JSON.parse(localStorage.getItem('selfSettings') || '{}');
    if (settings.company) {
        const companyName = document.getElementById('companyName') as HTMLInputElement | null;
        const companyCnpj = document.getElementById('companyCnpj') as HTMLInputElement | null;
        const companyPhone = document.getElementById('companyPhone') as HTMLInputElement | null;
        const companyEmail = document.getElementById('companyEmail') as HTMLInputElement | null;
        if (companyName) companyName.value = settings.company.name || '';
        if (companyCnpj) companyCnpj.value = settings.company.cnpj || '';
        if (companyPhone) companyPhone.value = settings.company.phone || '';
        if (companyEmail) companyEmail.value = settings.company.email || '';
    }
}

function saveGeneralSettings() {
    const settings: Settings = JSON.parse(localStorage.getItem('selfSettings') || '{}');
    settings.company = {
        name: (document.getElementById('companyName') as HTMLInputElement | null)?.value || '',
        cnpj: (document.getElementById('companyCnpj') as HTMLInputElement | null)?.value || '',
        phone: (document.getElementById('companyPhone') as HTMLInputElement | null)?.value || '',
        email: (document.getElementById('companyEmail') as HTMLInputElement | null)?.value || ''
    };
    localStorage.setItem('selfSettings', JSON.stringify(settings));
    showToast('success', 'Sucesso', 'Configurações salvas!');
}

function saveFunnelSettings() {
    const settings: Settings = JSON.parse(localStorage.getItem('selfSettings') || '{}');
    settings.funnel = [];
    for (let i = 1; i <= 4; i++) {
        settings.funnel.push({
            name: (document.getElementById(`funnel${i}Name`) as HTMLInputElement | null)?.value || '',
            color: (document.getElementById(`funnel${i}Color`) as HTMLInputElement | null)?.value || '',
            description: (document.getElementById(`funnel${i}Desc`) as HTMLInputElement | null)?.value || ''
        });
    }
    localStorage.setItem('selfSettings', JSON.stringify(settings));
    showToast('success', 'Sucesso', 'Funil salvo!');
}

async function loadTemplates() {
    try {
        const response = await api.get('/api/templates');
        templatesCache = response.templates || [];
        renderTemplatesList();
    } catch (error) {
        templatesCache = [];
        renderTemplatesList();
    }
}

function updateNewTemplateForm() {
    const typeSelect = document.getElementById('newTemplateType') as HTMLSelectElement | null;
    const textGroup = document.getElementById('newTemplateTextGroup') as HTMLElement | null;
    const audioGroup = document.getElementById('newTemplateAudioGroup') as HTMLElement | null;
    if (!typeSelect || !textGroup || !audioGroup) return;
    const type = typeSelect.value || 'text';
    if (type === 'audio') {
        textGroup.style.display = 'none';
        audioGroup.style.display = 'block';
    } else {
        textGroup.style.display = 'block';
        audioGroup.style.display = 'none';
    }
}

function normalizeName(value: string) {
    return String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
}

function escapeHtml(value: string) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}


function renderTemplatesList() {
    const container = document.getElementById('templatesList');
    const empty = document.getElementById('templatesEmpty');
    if (!container) return;

    if (!templatesCache.length) {
        container.innerHTML = '';
        if (empty) empty.style.display = 'block';
        return;
    }

    if (empty) empty.style.display = 'none';
    container.innerHTML = templatesCache.map(renderTemplateCard).join('');
}

function getMediaUrl(url?: string | null) {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    const base = (window as any).APP?.socketUrl || '';
    return `${base}${url}`;
}

function renderTemplateCard(template: TemplateItem) {
    const safeName = escapeHtml(template.name || '');
    const mediaType = template.media_type || 'text';
    const safeContent = escapeHtml(template.content || '');
    const audioUrl = mediaType === 'audio' && template.media_url ? getMediaUrl(template.media_url) : '';
    const mediaUrlAttr = template.media_url ? escapeHtml(template.media_url) : '';

    const body = mediaType === 'audio'
        ? `
            <div class="template-audio">
                ${audioUrl ? `<audio controls preload="metadata" src="${audioUrl}"></audio>` : `<p class="text-muted">Nenhum audio enviado.</p>`}
                <input type="file" class="form-input template-audio-input" accept="audio/*" onchange="replaceTemplateAudio(${template.id}, event)" />
                <small class="text-muted">Envie um novo audio para substituir o atual.</small>
            </div>
        `
        : `
            <textarea class="form-textarea template-content" rows="4">${safeContent}</textarea>
        `;

    return `
        <div class="copy-card template-card" data-template-id="${template.id}" data-media-type="${mediaType}" data-media-url="${mediaUrlAttr}">
            <div class="copy-card-header" style="display: flex; gap: 12px; align-items: center; justify-content: space-between;">
                <input class="form-input template-name" value="${safeName}" />
                <div style="display: flex; gap: 8px;">
                    <button class="btn btn-sm btn-outline" onclick="saveTemplate(${template.id})">Salvar</button>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteTemplate(${template.id})">Excluir</button>
                </div>
            </div>
            ${body}
        </div>
    `;
}

async function saveTemplateInternal(card: HTMLElement, showToastMessage = true) {
    const id = card.dataset.templateId;
    const mediaType = card.dataset.mediaType || 'text';
    const mediaUrl = card.dataset.mediaUrl || '';
    const nameInput = card.querySelector('.template-name') as HTMLInputElement | null;
    const contentInput = card.querySelector('.template-content') as HTMLTextAreaElement | null;
    const name = nameInput?.value.trim() || '';

    if (!id || !name) {
        if (showToastMessage) showToast('warning', 'Aviso', 'Preencha o nome do template');
        return;
    }

    const payload: Record<string, any> = {
        name,
        category: 'custom'
    };

    if (mediaType === 'audio') {
        if (!mediaUrl) {
            if (showToastMessage) showToast('warning', 'Aviso', 'Envie um audio para o template');
            return;
        }
        payload.media_type = 'audio';
        payload.media_url = mediaUrl;
    } else {
        const content = contentInput?.value.trim() || '';
        if (!content) {
            if (showToastMessage) showToast('warning', 'Aviso', 'Preencha a mensagem do template');
            return;
        }
        payload.content = content;
    }

    await api.put(`/api/templates/${id}`, payload);
    if (showToastMessage) {
        showToast('success', 'Sucesso', 'Template atualizado!');
    }
}

async function saveTemplate(id: number) {
    const card = document.querySelector(`.template-card[data-template-id="${id}"]`) as HTMLElement | null;
    if (!card) return;
    try {
        await saveTemplateInternal(card, true);
    } catch (error) {
        showToast('error', 'Erro', 'Nao foi possivel salvar');
    }
}

async function saveCopysSettings() {
    const cards = Array.from(document.querySelectorAll('.template-card')) as HTMLElement[];
    if (!cards.length) {
        showToast('info', 'Info', 'Nenhum template para salvar');
        return;
    }

    try {
        for (const card of cards) {
            await saveTemplateInternal(card, false);
        }
        await loadTemplates();
        showToast('success', 'Sucesso', 'Templates salvos!');
    } catch (error) {
        showToast('error', 'Erro', 'Nao foi possivel salvar os templates');
    }
}

async function deleteTemplate(id: number) {
    if (!confirm('Excluir este template?')) return;
    try {
        await api.delete(`/api/templates/${id}`);
        await loadTemplates();
        showToast('success', 'Sucesso', 'Template removido!');
    } catch (error) {
        showToast('error', 'Erro', 'Nao foi possivel remover');
    }
}

async function replaceTemplateAudio(id: number, event: Event) {
    const target = event.target as HTMLInputElement | null;
    const file = target?.files?.[0];
    if (!file) return;

    try {
        showLoading('Enviando audio...');
        const uploaded = await uploadFile(file);
        hideLoading();

        const card = document.querySelector(`.template-card[data-template-id="${id}"]`) as HTMLElement | null;
        const nameInput = card?.querySelector('.template-name') as HTMLInputElement | null;
        const name = nameInput?.value.trim() || '';

        await api.put(`/api/templates/${id}`, {
            name: name || `Template ${id}`,
            category: 'custom',
            media_type: 'audio',
            media_url: uploaded.url,
            content: ''
        });
        await loadTemplates();
        showToast('success', 'Sucesso', 'Audio atualizado!');
    } catch (error) {
        hideLoading();
        showToast('error', 'Erro', 'Nao foi possivel atualizar o audio');
    } finally {
        if (target) target.value = '';
    }
}

async function uploadFile(file: File) {
    const baseUrl = (window as any).APP?.socketUrl || '';
    const token = sessionStorage.getItem('selfDashboardToken');
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${baseUrl}/api/upload`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error || 'Falha no upload');
    }

    return data.file;
}

function insertVariable(variable: string) {
    const focused = document.activeElement as HTMLTextAreaElement | null;
    if (focused && focused.tagName === 'TEXTAREA') {
        const start = focused.selectionStart || 0;
        const end = focused.selectionEnd || 0;
        const text = focused.value || '';
        focused.value = text.substring(0, start) + variable + text.substring(end);
        focused.selectionStart = focused.selectionEnd = start + variable.length;
        focused.focus();
    }
}

async function saveNewTemplate() {
    const name = (document.getElementById('newTemplateName') as HTMLInputElement | null)?.value.trim() || '';
    const type = (document.getElementById('newTemplateType') as HTMLSelectElement | null)?.value || 'text';
    const message = (document.getElementById('newTemplateMessage') as HTMLTextAreaElement | null)?.value.trim() || '';
    const audioInput = document.getElementById('newTemplateAudio') as HTMLInputElement | null;
    const audioFile = audioInput?.files?.[0];
    if (!name) { showToast('error', 'Erro', 'Preencha o nome do template'); return; }
    try {
        if (type === 'audio') {
            if (!audioFile) {
                showToast('error', 'Erro', 'Selecione um arquivo de audio');
                return;
            }
            showLoading('Enviando audio...');
            const uploaded = await uploadFile(audioFile);
            hideLoading();
            await api.post('/api/templates', {
                name,
                category: 'custom',
                content: '',
                media_type: 'audio',
                media_url: uploaded.url
            });
        } else {
            if (!message) { showToast('error', 'Erro', 'Preencha a mensagem'); return; }
            await api.post('/api/templates', {
                name,
                category: 'custom',
                content: message,
                variables: ['nome', 'telefone', 'veiculo', 'placa', 'empresa']
            });
        }
        closeModal('addTemplateModal');
        const newTemplateName = document.getElementById('newTemplateName') as HTMLInputElement | null;
        const newTemplateMessage = document.getElementById('newTemplateMessage') as HTMLTextAreaElement | null;
        const newTemplateType = document.getElementById('newTemplateType') as HTMLSelectElement | null;
        if (newTemplateName) newTemplateName.value = '';
        if (newTemplateMessage) newTemplateMessage.value = '';
        if (audioInput) audioInput.value = '';
        if (newTemplateType) newTemplateType.value = 'text';
        updateNewTemplateForm();
        await loadTemplates();
        showToast('success', 'Sucesso', 'Template adicionado!');
    } catch (error) {
        hideLoading();
        showToast('error', 'Erro', 'Nao foi possivel adicionar o template');
    }
}

async function checkWhatsAppStatus() {
    try {
        const response = await api.get('/api/whatsapp/status');
        const txt = document.getElementById('whatsappStatusText');
        if (txt) txt.textContent = response.connected ? 'Conectado' : 'Desconectado';
        const success = document.getElementById('connectionSuccess');
        const disc = document.getElementById('connectionDisconnected');
        const phoneEl = document.getElementById('connectedPhone');
        if (success && disc) {
            if (response.connected) {
                success.style.display = 'block';
                disc.style.display = 'none';
                if (phoneEl) phoneEl.textContent = response.phone || '+55...';
            } else {
                success.style.display = 'none';
                disc.style.display = 'block';
            }
        }
    } catch (error) {
        const txt = document.getElementById('whatsappStatusText');
        if (txt) txt.textContent = 'Desconectado';
        const success = document.getElementById('connectionSuccess');
        const disc = document.getElementById('connectionDisconnected');
        if (success && disc) { success.style.display = 'none'; disc.style.display = 'block'; }
    }
}

async function connectWhatsApp() {
    try {
        showLoading('Gerando QR Code...');
        const response = await api.get('/api/whatsapp/qr');
        hideLoading();
        if (response.qr) {
            const qrContainer = document.getElementById('qrCodeContainer') as HTMLElement | null;
            const qrCode = document.getElementById('qrCode') as HTMLElement | null;
            if (qrContainer) qrContainer.style.display = 'block';
            if (qrCode) qrCode.innerHTML = `<img src="${response.qr}" alt="QR Code" style="max-width: 250px;">`;
        }
    } catch (error) { hideLoading(); showToast('error', 'Erro', 'Não foi possível gerar o QR Code'); }
}

async function disconnectWhatsApp() {
    if (!confirm('Deseja realmente desconectar o WhatsApp?')) return;
    try { await api.post('/api/whatsapp/disconnect'); checkWhatsAppStatus(); showToast('success', 'Sucesso', 'WhatsApp desconectado!'); } catch (error) { showToast('error', 'Erro', 'Não foi possível desconectar'); }
}

function saveWhatsAppSettings() {
    const settings: Settings = JSON.parse(localStorage.getItem('selfSettings') || '{}');
    settings.whatsapp = {
        interval: (document.getElementById('messageInterval') as HTMLInputElement | null)?.value || '',
        messagesPerHour: (document.getElementById('messagesPerHour') as HTMLInputElement | null)?.value || '',
        workStart: (document.getElementById('workStart') as HTMLInputElement | null)?.value || '',
        workEnd: (document.getElementById('workEnd') as HTMLInputElement | null)?.value || ''
    };
    localStorage.setItem('selfSettings', JSON.stringify(settings));
    showToast('success', 'Sucesso', 'Configurações salvas!');
}

function saveNotificationSettings() { showToast('success', 'Sucesso', 'Notificações salvas!'); }

function addUser() {
    const name = (document.getElementById('newUserName') as HTMLInputElement | null)?.value.trim() || '';
    const email = (document.getElementById('newUserEmail') as HTMLInputElement | null)?.value.trim() || '';
    const password = (document.getElementById('newUserPassword') as HTMLInputElement | null)?.value || '';
    const role = (document.getElementById('newUserRole') as HTMLSelectElement | null)?.value || '';
    if (!name || !email || !password) { showToast('error', 'Erro', 'Preencha todos os campos'); return; }
    const tbody = document.getElementById('usersTableBody') as HTMLElement | null;
    if (!tbody) return;
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${name}</td><td>${email}</td><td><span class="badge badge-${role === 'admin' ? 'primary' : 'secondary'}">${role === 'admin' ? 'Administrador' : 'Usuário'}</span></td><td><span class="badge badge-success">Ativo</span></td><td><button class="btn btn-sm btn-outline"><span class="icon icon-edit icon-sm"></span></button><button class="btn btn-sm btn-outline-danger" onclick="this.closest('tr').remove()"><span class="icon icon-delete icon-sm"></span></button></td>`;
    tbody.appendChild(tr);
    closeModal('addUserModal');
    showToast('success', 'Sucesso', 'Usuário adicionado!');
}

function changePassword() {
    const current = (document.getElementById('currentPassword') as HTMLInputElement | null)?.value || '';
    const newPass = (document.getElementById('newPassword') as HTMLInputElement | null)?.value || '';
    const confirm = (document.getElementById('confirmPassword') as HTMLInputElement | null)?.value || '';
    if (!current || !newPass || !confirm) { showToast('error', 'Erro', 'Preencha todos os campos'); return; }
    if (newPass !== confirm) { showToast('error', 'Erro', 'As senhas não conferem'); return; }
    if (newPass.length < 6) { showToast('error', 'Erro', 'A senha deve ter pelo menos 6 caracteres'); return; }
    showToast('success', 'Sucesso', 'Senha alterada!');
    const currentPassword = document.getElementById('currentPassword') as HTMLInputElement | null;
    const newPassword = document.getElementById('newPassword') as HTMLInputElement | null;
    const confirmPassword = document.getElementById('confirmPassword') as HTMLInputElement | null;
    if (currentPassword) currentPassword.value = '';
    if (newPassword) newPassword.value = '';
    if (confirmPassword) confirmPassword.value = '';
}

function copyApiKey() {
    const apiKey = (document.getElementById('apiKey') as HTMLInputElement | null)?.value || '';
    navigator.clipboard.writeText(apiKey);
    showToast('success', 'Copiado', 'API Key copiada!');
}
function regenerateApiKey() {
    if (!confirm('Regenerar a API Key?')) return;
    const apiKey = document.getElementById('apiKey') as HTMLInputElement | null;
    if (apiKey) apiKey.value = 'sk_live_' + Math.random().toString(36).substring(2, 15);
    showToast('success', 'Sucesso', 'Nova API Key gerada!');
}
function testWebhook() { showToast('info', 'Testando', 'Enviando requisição de teste...'); setTimeout(() => { showToast('success', 'Sucesso', 'Webhook respondeu corretamente!'); }, 1500); }
function saveApiSettings() { showToast('success', 'Sucesso', 'Configurações de API salvas!'); }

const windowAny = window as Window & {
    initConfiguracoes?: () => void;
    showPanel?: (panelId: string) => void;
    saveGeneralSettings?: () => void;
    saveFunnelSettings?: () => void;
    saveCopysSettings?: () => void;
    insertVariable?: (variable: string) => void;
    saveNewTemplate?: () => void;
    saveTemplate?: (id: number) => void;
    deleteTemplate?: (id: number) => void;
    replaceTemplateAudio?: (id: number, event: Event) => void;
    updateNewTemplateForm?: () => void;
    connectWhatsApp?: () => Promise<void>;
    disconnectWhatsApp?: () => Promise<void>;
    saveWhatsAppSettings?: () => void;
    saveNotificationSettings?: () => void;
    addUser?: () => void;
    changePassword?: () => void;
    copyApiKey?: () => void;
    regenerateApiKey?: () => void;
    testWebhook?: () => void;
    saveApiSettings?: () => void;
};
windowAny.initConfiguracoes = initConfiguracoes;
windowAny.showPanel = showPanel;
windowAny.saveGeneralSettings = saveGeneralSettings;
windowAny.saveFunnelSettings = saveFunnelSettings;
windowAny.saveCopysSettings = saveCopysSettings;
windowAny.insertVariable = insertVariable;
windowAny.saveNewTemplate = saveNewTemplate;
windowAny.saveTemplate = saveTemplate;
windowAny.deleteTemplate = deleteTemplate;
windowAny.replaceTemplateAudio = replaceTemplateAudio;
windowAny.updateNewTemplateForm = updateNewTemplateForm;
windowAny.connectWhatsApp = connectWhatsApp;
windowAny.disconnectWhatsApp = disconnectWhatsApp;
windowAny.saveWhatsAppSettings = saveWhatsAppSettings;
windowAny.saveNotificationSettings = saveNotificationSettings;
windowAny.addUser = addUser;
windowAny.changePassword = changePassword;
windowAny.copyApiKey = copyApiKey;
windowAny.regenerateApiKey = regenerateApiKey;
windowAny.testWebhook = testWebhook;
windowAny.saveApiSettings = saveApiSettings;

export { initConfiguracoes };
