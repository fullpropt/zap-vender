// Conversas V2 page logic migrated to module

// ============================================
// CONFIGURAÇÃO
// ============================================
declare const io:
    | undefined
    | ((url?: string, options?: Record<string, unknown>) => {
          on: (event: string, handler: (data?: any) => void) => void;
          emit: (event: string, payload?: any) => void;
      });

type Contact = {
    jid: string;
    number: string;
    name?: string;
    lastMessage?: string;
    lastMessageTime?: number;
    unreadCount?: number;
    botActive?: boolean;
    leadId?: number;
    conversationId?: string | number;
};

type Message = {
    id: string | number;
    messageId?: string;
    text?: string;
    content?: string;
    isFromMe?: boolean;
    is_from_me?: boolean;
    sender_type?: string;
    timestamp?: number;
    sent_at?: string;
    created_at?: string;
    status?: string;
    media_type?: string;
    media_url?: string;
};

type SocketMessage = Message & {
    from?: string;
    fromNumber?: string;
    pushName?: string;
    mediaType?: string;
};

type NotificationPreferences = {
    notifyNewLead: boolean;
    notifyNewMessage: boolean;
    notifySound: boolean;
};

const DEFAULT_SESSION_ID = 'default_whatsapp_session';
let socket: null | { on: (event: string, handler: (data?: any) => void) => void; emit: (event: string, payload?: any) => void } = null;
let currentContact: Contact | null = null;
let contacts: Contact[] = [];
let messages: Record<string, Message[]> = {};
let typingContacts = new Set<string>();
let isConnected = false;

const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
    notifyNewLead: true,
    notifyNewMessage: true,
    notifySound: true
};

function parseNotificationFlag(value: unknown, fallback: boolean) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value > 0;
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
        if (['false', '0', 'no', 'off'].includes(normalized)) return false;
    }
    return fallback;
}

function getNotificationPreferences(): NotificationPreferences {
    try {
        const raw = localStorage.getItem('selfSettings');
        if (!raw) return { ...DEFAULT_NOTIFICATION_PREFERENCES };
        const parsed = JSON.parse(raw);
        const notifications = (parsed && typeof parsed === 'object')
            ? (parsed.notifications || {})
            : {};
        return {
            notifyNewLead: parseNotificationFlag(notifications.notifyNewLead, DEFAULT_NOTIFICATION_PREFERENCES.notifyNewLead),
            notifyNewMessage: parseNotificationFlag(notifications.notifyNewMessage, DEFAULT_NOTIFICATION_PREFERENCES.notifyNewMessage),
            notifySound: parseNotificationFlag(notifications.notifySound, DEFAULT_NOTIFICATION_PREFERENCES.notifySound)
        };
    } catch (_) {
        return { ...DEFAULT_NOTIFICATION_PREFERENCES };
    }
}

function getSessionId() {
    const appSessionId = String((window as any).APP?.sessionId || '').trim();
    if (appSessionId) return appSessionId;

    const storedSessionId = String(localStorage.getItem('zapvender_active_whatsapp_session') || '').trim();
    if (storedSessionId) return storedSessionId;

    return DEFAULT_SESSION_ID;
}

// ============================================
// INICIALIZAÇÃO
// ============================================
function onReady(callback: () => void) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', callback);
    } else {
        callback();
    }
}


function getFunilUrl(leadId: string | number) {
    return `#/funil?lead=${leadId}`;
}

// ============================================
// INICIALIZAÇÃO
// ============================================
function initConversasV2() {
    initSocket();
    setupEventListeners();
    loadContacts();
}

onReady(initConversasV2);

// ============================================
// SOCKET.IO
// ============================================
function initSocket() {
    const serverUrl = window.location.origin;
    if (!io) {
        console.warn('Socket.IO não carregado');
        return;
    }
    socket = io(serverUrl, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 10
    });
    
    socket.on('connect', () => {
        console.log('Socket conectado');
        socket.emit('check-session', { sessionId: getSessionId() });
    });
    
    socket.on('disconnect', () => {
        console.log('Socket desconectado');
        updateConnectionStatus(false);
    });
    
    socket.on('session-status', (data) => {
        if (data.status === 'connected') {
            updateConnectionStatus(true, data.user);
            loadContacts();
        } else {
            updateConnectionStatus(false);
        }
    });
    
    socket.on('connected', (data) => {
        const wasConnected = isConnected;
        updateConnectionStatus(true, data.user);
        if (!wasConnected) {
            showToast('success', 'WhatsApp Conectado', `Conectado como ${data.user?.name || 'Usuário'}`);
        }
    });
    
    socket.on('disconnected', () => {
        updateConnectionStatus(false);
        showToast('warning', 'WhatsApp Desconectado', 'Conexão perdida');
    });
    
    socket.on('new-message', (message: SocketMessage) => {
        handleNewMessage(message);
    });
    
    socket.on('message-status', (data) => {
        updateMessageStatus(data.messageId, data.status);
    });
    
    socket.on('typing-status', (data) => {
        handleTypingStatus(data);
    });
    
    socket.on('contacts-list', (data) => {
        contacts = data.contacts || [];
        renderContacts();
    });
    
    socket.on('messages-list', (data) => {
        if (data.leadId === currentContact?.leadId || data.contactJid === currentContact?.jid) {
            if (currentContact) {
                messages[currentContact.jid] = data.messages || [];
            }
            renderMessages();
        }
    });
    
    socket.on('message-sent', (data) => {
        showToast('success', 'Mensagem enviada', 'Sua mensagem foi enviada com sucesso');
    });
    
    socket.on('error', (data) => {
        showToast('error', 'Erro', data.message || 'Ocorreu um erro');
    });
}

// ============================================
// EVENT LISTENERS
// ============================================
function setupEventListeners() {
    // Busca de contatos
    const searchContacts = document.getElementById('searchContacts') as HTMLInputElement | null;
    searchContacts?.addEventListener('input', (e) => {
        filterContacts((e.target as HTMLInputElement).value);
    });
    
    // Tabs de filtro
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            filterContacts((searchContacts?.value || ''), btn.dataset.filter);
        });
    });
    
    // Input de mensagem
    const messageInput = document.getElementById('messageInput') as HTMLTextAreaElement | null;
    const btnSend = document.getElementById('btnSend') as HTMLButtonElement | null;
    messageInput?.addEventListener('input', () => {
        if (btnSend && messageInput) {
            btnSend.disabled = !messageInput.value.trim();
        }
        autoResizeTextarea(messageInput);
    });
    
    messageInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    // Botão de enviar
    btnSend?.addEventListener('click', sendMessage);
    
    // Quick replies
    document.querySelectorAll('.quick-reply-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (messageInput) {
                messageInput.value = (btn as HTMLElement).dataset.message || '';
                if (btnSend) btnSend.disabled = false;
                messageInput.focus();
            }
        });
    });
    
    // Botão de anexo
    document.getElementById('btnAttach')?.addEventListener('click', () => {
        document.getElementById('attachModal')?.classList.add('active');
    });
    
    // File input
    const fileInput = document.getElementById('fileInput') as HTMLInputElement | null;
    fileInput?.addEventListener('change', (e) => {
        const target = e.target as HTMLInputElement;
        previewFile(target.files?.[0] || null);
    });
    
    // Botão de toggle bot
    document.getElementById('btnToggleBot')?.addEventListener('click', toggleBot);
    
    // Botão de abrir WhatsApp
    document.getElementById('btnOpenWhatsApp')?.addEventListener('click', () => {
        if (currentContact) {
            window.open(`https://wa.me/${currentContact.number}`, '_blank');
        }
    });
    
    // Botão de ver lead
    document.getElementById('btnViewLead')?.addEventListener('click', () => {
        if (currentContact?.leadId) {
            window.location.href = getFunilUrl(currentContact.leadId);
        }
    });
}

// ============================================
// CONTATOS
// ============================================
function loadContacts() {
    socket?.emit('get-contacts', { sessionId: getSessionId() });
}

function renderContacts(filteredContacts: Contact[] | null = null) {
    const container = document.getElementById('contactsList') as HTMLElement | null;
    if (!container) return;
    const list = filteredContacts || contacts;
    
    if (list.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="padding: 40px 20px;">
            <div class="icon icon-empty icon-lg"></div>
                <h3>Nenhum contato</h3>
                <p>Seus contatos aparecerão aqui</p>
            </div>
        `;
        return;
    }
    
    // Ordenar por última mensagem
    list.sort((a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0));
    
    container.innerHTML = list.map(contact => {
        const initial = (contact.name || contact.number || '?')[0].toUpperCase();
        const isActive = currentContact?.jid === contact.jid;
        const isTyping = typingContacts.has(contact.jid);
        const time = contact.lastMessageTime ? formatTime(contact.lastMessageTime) : '';
        
        return `
            <div class="contact-item ${isActive ? 'active' : ''}" 
                 onclick="selectContact('${contact.jid}')"
                 data-jid="${contact.jid}">
                <div class="contact-avatar">${initial}</div>
                <div class="contact-info">
                    <div class="contact-name">${contact.name || contact.number}</div>
                    <div class="contact-preview">
                        ${isTyping ? `
                            <span class="typing-indicator">
                                <span class="dots">
                                    <span class="dot"></span>
                                    <span class="dot"></span>
                                    <span class="dot"></span>
                                </span>
                                Digitando...
                            </span>
                        ` : (contact.lastMessage || 'Clique para iniciar conversa')}
                    </div>
                </div>
                <div class="contact-meta">
                    <div class="contact-time">${time}</div>
                    ${contact.unreadCount > 0 ? `<span class="contact-badge">${contact.unreadCount}</span>` : ''}
                </div>
            </div>
        `;
    }).join('');
}

function filterContacts(search: string, filter = 'all') {
    let filtered = contacts;
    
    if (search) {
        const term = search.toLowerCase();
        filtered = filtered.filter(c => 
            (c.name || '').toLowerCase().includes(term) ||
            (c.number || '').includes(term)
        );
    }
    
    if (filter === 'unread') {
        filtered = filtered.filter(c => c.unreadCount > 0);
    } else if (filter === 'bot') {
        filtered = filtered.filter(c => c.botActive);
    }
    
    renderContacts(filtered);
}

function selectContact(jid: string) {
    const contact = contacts.find(c => c.jid === jid);
    if (!contact) return;
    
    currentContact = contact;
    
    // Atualizar UI
    const emptyState = document.getElementById('emptyState') as HTMLElement | null;
    const chatHeader = document.getElementById('chatHeader') as HTMLElement | null;
    const messagesContainer = document.getElementById('messagesContainer') as HTMLElement | null;
    const chatInputArea = document.getElementById('chatInputArea') as HTMLElement | null;
    if (emptyState) emptyState.style.display = 'none';
    if (chatHeader) chatHeader.style.display = 'flex';
    if (messagesContainer) messagesContainer.style.display = 'flex';
    if (chatInputArea) chatInputArea.style.display = 'block';
    
    // Atualizar header
    const initial = (contact.name || contact.number || '?')[0].toUpperCase();
    const chatAvatar = document.getElementById('chatAvatar') as HTMLElement | null;
    const chatName = document.getElementById('chatName') as HTMLElement | null;
    const chatStatus = document.getElementById('chatStatus') as HTMLElement | null;
    if (chatAvatar) chatAvatar.textContent = initial;
    if (chatName) chatName.textContent = contact.name || contact.number;
    if (chatStatus) {
        chatStatus.textContent = typingContacts.has(jid) ? 'Digitando...' : 'Online';
        chatStatus.className = 'chat-header-status' + (typingContacts.has(jid) ? ' typing' : ' online');
    }
    
    // Atualizar lista
    renderContacts();
    
    // Carregar mensagens
    loadMessages(contact);
    
    // Marcar como lido
    socket?.emit('mark-read', { sessionId: getSessionId(), contactJid: jid });
}

// ============================================
// MENSAGENS
// ============================================
function loadMessages(contact: Contact) {
    socket?.emit('get-messages', { 
        sessionId: getSessionId(), 
        contactJid: contact.jid,
        leadId: contact.leadId
    });
}

function renderMessages() {
    const container = document.getElementById('messagesContainer') as HTMLElement | null;
    if (!container) return;
    const messageList = messages[currentContact?.jid] || [];
    
    if (messageList.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
            <div class="icon icon-empty icon-lg"></div>
                <h3>Inicie a conversa</h3>
                <p>Envie uma mensagem para ${currentContact?.name || currentContact?.number}</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = messageList.map(msg => {
        const isFromMe = msg.isFromMe || msg.is_from_me || msg.sender_type === 'agent';
        const text = msg.text || msg.content || '';
        const time = formatTime(msg.timestamp || msg.sent_at || msg.created_at);
        const status = msg.status || 'sent';
        
        const statusIcon = {
            'pending': '"',
            'sent': '',
            'delivered': '',
            'read': ''
        }[status] || '';
        
        const statusClass = status === 'read' ? 'read' : (status === 'delivered' ? 'delivered' : 'sent');
        
        return `
            <div class="message ${isFromMe ? 'sent' : 'received'}">
                <div class="message-bubble">
                    ${msg.media_type && msg.media_type !== 'text' ? `
                        <div class="message-media ${msg.media_type}">
                            ${msg.media_type === 'image' ? `<img src="${msg.media_url}" alt="Imagem">` : ''}
                            ${msg.media_type === 'document' ? `
                                <div class="doc-icon"><span class="icon icon-attachment icon-sm"></span></div>
                                <span>Documento</span>
                            ` : ''}
                            ${msg.media_type === 'audio' ? `
                                <audio controls src="${msg.media_url}"></audio>
                            ` : ''}
                        </div>
                    ` : ''}
                    <div class="message-text">${escapeHtml(text)}</div>
                    <div class="message-meta">
                        <span class="message-time">${time}</span>
                        ${isFromMe ? `<span class="message-status ${statusClass}">${statusIcon}</span>` : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    // Scroll para o final
    container.scrollTop = container.scrollHeight;
}

function handleNewMessage(message: SocketMessage) {
    // Atualizar contato na lista
    const contactIndex = contacts.findIndex(c => c.jid === message.from || c.number === message.fromNumber);
    
    if (contactIndex >= 0) {
        contacts[contactIndex].lastMessage = message.text?.substring(0, 50) || 'Nova mensagem';
        contacts[contactIndex].lastMessageTime = message.timestamp || Date.now();
        
        if (!message.isFromMe && currentContact?.jid !== message.from) {
            contacts[contactIndex].unreadCount = (contacts[contactIndex].unreadCount || 0) + 1;
        }
    } else {
        // Novo contato
        contacts.unshift({
            jid: message.from,
            number: message.fromNumber,
            name: message.pushName || message.fromNumber,
            lastMessage: message.text?.substring(0, 50) || 'Nova mensagem',
            lastMessageTime: message.timestamp || Date.now(),
            unreadCount: message.isFromMe ? 0 : 1,
            leadId: message.leadId
        });
    }
    
    renderContacts();
    
    // Se é a conversa atual, adicionar mensagem
    if (currentContact && (currentContact.jid === message.from || currentContact.number === message.fromNumber)) {
        if (!messages[currentContact.jid]) {
            messages[currentContact.jid] = [];
        }
        
        messages[currentContact.jid].push({
            id: message.id,
            messageId: message.messageId,
            text: message.text,
            isFromMe: message.isFromMe,
            timestamp: message.timestamp,
            status: message.status || 'received',
            media_type: message.mediaType
        });
        
        renderMessages();
        
        // Marcar como lido
        socket?.emit('mark-read', { sessionId: getSessionId(), contactJid: currentContact.jid });
    }
    
    const notificationPreferences = getNotificationPreferences();

    // Notificacao de novo lead
    if (!message.isFromMe && contactIndex < 0 && notificationPreferences.notifyNewLead) {
        const leadLabel = String(message.pushName || message.fromNumber || message.from || 'Contato').trim();
        showToast('info', 'Novo lead', `${leadLabel} enviou uma mensagem`);
    }

    // Notificacao sonora
    if (!message.isFromMe) {
        if (notificationPreferences.notifyNewMessage && notificationPreferences.notifySound) {
            playNotificationSound();
        }
    }
}

function updateMessageStatus(messageId: string, status: string) {
    if (!currentContact || !messages[currentContact.jid]) return;
    
    const msg = messages[currentContact.jid].find(m => m.messageId === messageId);
    if (msg) {
        msg.status = status;
        renderMessages();
    }
}

function sendMessage() {
    const input = document.getElementById('messageInput') as HTMLTextAreaElement | null;
    const text = input?.value.trim() || '';
    
    if (!text || !currentContact || !isConnected) return;
    
    socket?.emit('send-message', {
        sessionId: getSessionId(),
        to: currentContact.number,
        message: text,
        type: 'text'
    });
    
    // Adicionar mensagem localmente
    if (!messages[currentContact.jid]) {
        messages[currentContact.jid] = [];
    }
    
    messages[currentContact.jid].push({
        id: Date.now(),
        text,
        isFromMe: true,
        timestamp: Date.now(),
        status: 'pending'
    });
    
    renderMessages();
    
    // Limpar input
    if (input) {
        input.value = '';
        const btnSend = document.getElementById('btnSend') as HTMLButtonElement | null;
        if (btnSend) btnSend.disabled = true;
        autoResizeTextarea(input);
    }
}

// ============================================
// TYPING STATUS
// ============================================
function handleTypingStatus(data: { jid: string; isTyping: boolean }) {
    if (data.isTyping) {
        typingContacts.add(data.jid);
    } else {
        typingContacts.delete(data.jid);
    }
    
    // Atualizar lista de contatos
    renderContacts();
    
    // Atualizar header se for o contato atual
    if (currentContact?.jid === data.jid) {
        const statusEl = document.getElementById('chatStatus') as HTMLElement | null;
        if (statusEl) {
            statusEl.textContent = data.isTyping ? 'Digitando...' : 'Online';
            statusEl.className = 'chat-header-status' + (data.isTyping ? ' typing' : ' online');
        }
    }
}

// ============================================
// BOT TOGGLE
// ============================================
function toggleBot() {
    if (!currentContact?.conversationId) return;
    
    const newState = !currentContact.botActive;
    
    socket?.emit('toggle-bot', {
        conversationId: currentContact.conversationId,
        active: newState
    });
    
    currentContact.botActive = newState;
    
    showToast(
        newState ? 'success' : 'info',
        newState ? 'Bot Ativado' : 'Bot Desativado',
        newState ? 'O bot responderá automaticamente' : 'Apenas respostas manuais'
    );
}

// ============================================
// ARQUIVOS
// ============================================
function previewFile(file: File | null) {
    if (!file) return;
    
    const preview = document.getElementById('filePreview') as HTMLElement | null;
    if (!preview) return;
    
    if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
            preview.innerHTML = `<img src="${e.target.result}" style="max-width: 100%; max-height: 200px; border-radius: 8px;">`;
        };
        reader.readAsDataURL(file);
    } else {
        preview.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px; padding: 15px; background: var(--gray-100); border-radius: 8px;">
                <span class="icon icon-attachment icon-md"></span>
                <div>
                    <div style="font-weight: 600;">${file.name}</div>
                    <div style="font-size: 12px; color: var(--gray-500);">${formatFileSize(file.size)}</div>
                </div>
            </div>
        `;
    }
}

async function sendFile() {
    const fileInput = document.getElementById('fileInput') as HTMLInputElement | null;
    const caption = (document.getElementById('fileCaption') as HTMLInputElement | null)?.value || '';
    const file = fileInput?.files?.[0];
    
    if (!file || !currentContact) return;
    
    // Upload do arquivo
    const formData = new FormData();
    formData.append('file', file);
    
    try {
        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (result.success) {
            const type = file.type.startsWith('image/') ? 'image' : 'document';
            
            socket?.emit('send-message', {
                sessionId: getSessionId(),
                to: currentContact.number,
                message: result.file.url,
                type,
                options: {
                    url: result.file.url,
                    caption,
                    fileName: file.name,
                    mimetype: file.type
                }
            });
            
            closeAttachModal();
            showToast('success', 'Arquivo enviado', 'O arquivo foi enviado com sucesso');
        } else {
            showToast('error', 'Erro', 'Falha ao enviar arquivo');
        }
    } catch (error) {
        showToast('error', 'Erro', 'Falha ao enviar arquivo');
    }
}

function closeAttachModal() {
    document.getElementById('attachModal')?.classList.remove('active');
    const fileInput = document.getElementById('fileInput') as HTMLInputElement | null;
    const fileCaption = document.getElementById('fileCaption') as HTMLInputElement | null;
    const filePreview = document.getElementById('filePreview') as HTMLElement | null;
    if (fileInput) fileInput.value = '';
    if (fileCaption) fileCaption.value = '';
    if (filePreview) filePreview.innerHTML = '';
}

// ============================================
// UTILITÁRIOS
// ============================================
function updateConnectionStatus(connected: boolean, user: { name?: string } | null = null) {
    isConnected = connected;
    const badge = document.getElementById('connectionStatus') as HTMLElement | null;
    if (!badge) return;
    
    if (connected) {
        badge.className = 'connection-badge connected';
        badge.innerHTML = `
            <span class="dot"></span>
            <span class="text">Conectado${user?.name ? ` - ${user.name}` : ''}</span>
        `;
    } else {
        badge.className = 'connection-badge disconnected';
        badge.innerHTML = `
            <span class="dot"></span>
            <span class="text">Desconectado</span>
        `;
    }
}

function formatTime(timestamp: number | string) {
    if (!timestamp) return '';
    
    const date = new Date(typeof timestamp === 'number' ? timestamp : Date.parse(timestamp));
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
        return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } else {
        return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    }
}

function formatFileSize(bytes: number) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function escapeHtml(text: string) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function autoResizeTextarea(textarea: HTMLTextAreaElement | null) {
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
}

function playNotificationSound() {
    try {
        const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleQoAHIvO7bqVNQAAEYHJ8cSqRwAABnfE9M6zVQAAA3HB9tO4XQAAAGy+99e8YwAAAGi8+Nm/ZwAAAGW6+du/aQAAAGO5+ty/agAAAGK4+t2/awAAAGG3+96/bAAAAGC2++C/bQAAAF+1++G/bgAAAF60++K/bwAAAF2z++O/cAAAAFyy++S/cQAAAFux++W/cgAAAFqw++a/cwAAAFmv++e/dAAAAFiu++i/dQAAAFet++m/dgAAAFas++q/dwAAAFWr++u/eAAAAFSq++y/eQAAAFOp++2/egAAAFKo++6/ewAAAFGn+++/fAAAAFCm+/C/fQAAAE+l+/G/fgAAAE6k+/K/fwAAAE2j+/O/gAAAAEyi+/S/gQAAAEuh+/W/ggAAAEqg+/a/gwAAAEmf+/e/hAAAAEie+/i/hQAAAEed+/m/hgAAAEac+/q/hwAAAEWb+/u/iAAAAESa+/y/iQAAAEOZ+/2/igAAAEKY+/6/iwAAAEGX+/+/jAAAAECW/AC/jQAAAD+V/AG/jgAAAD6U/AK/jwAAAD2T/AO/kAAAADyS/AS/kQAAADuR/AW/kgAAADqQ/Aa/kwAAADmP/Ae/lAAAADiO/Ai/lQAAADeN/Am/lgAAADaM/Aq/lwAAADWL/Au/mAAAADSK/Ay/mQAAADOJ/A2/mgAAADKI/A6/mwAAADGH/A+/nAAAADCG/BC/nQAAAC+F/BG/ngAAAC6E/BK/nwAAAC2D/BO/oAAAACyC/BS/oQAAAC');
        audio.volume = 0.3;
        audio.play().catch(() => {});
    } catch (e) {}
}

function showToast(type: 'success' | 'error' | 'warning' | 'info', title: string, message: string) {
    const container = document.getElementById('toastContainer') as HTMLElement | null;
    if (!container) return;
    
    const icons = {
        success: 'OK',
        error: 'ERRO',
        warning: 'AVISO',
        info: 'INFO'
    };
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <span class="toast-icon">${icons[type]}</span>
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            <div class="toast-message">${message}</div>
        </div>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'toastSlideIn 0.3s ease-out reverse';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

const windowAny = window as Window & {
    initConversasV2?: () => void;
    selectContact?: (jid: string) => void;
    sendMessage?: () => void;
    closeAttachModal?: () => void;
    sendFile?: () => Promise<void>;
    toggleBot?: () => void;
};
windowAny.initConversasV2 = initConversasV2;
windowAny.selectContact = selectContact;
windowAny.sendMessage = sendMessage;
windowAny.closeAttachModal = closeAttachModal;
windowAny.sendFile = sendFile;
windowAny.toggleBot = toggleBot;

export { initConversasV2 };
