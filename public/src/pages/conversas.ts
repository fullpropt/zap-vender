// Conversas page logic migrated to module

// Estado
declare const io:
    | undefined
    | ((url: string, options?: Record<string, unknown>) => {
          on: (event: string, handler: (data?: any) => void) => void;
          emit: (event: string, payload?: any) => void;
      });

type Config = {
    SOCKET_URL: string;
    SESSION_ID: string;
    STORAGE_KEYS: { LEADS: string };
};

type LeadStored = {
    telefone: string;
    nome: string;
    data: string;
    status?: number;
    veiculo?: string;
    placa?: string;
};

type Conversation = {
    jid: string;
    number: string;
    name: string;
    lastMessage: string;
    lastMessageTime: number;
    unreadCount: number;
    status?: number;
    veiculo?: string;
    placa?: string;
};

type ChatMessage = {
    id: string;
    text: string;
    isFromMe: boolean;
    timestamp: number;
    status?: string;
};

type SocketMessage = Partial<ChatMessage> & {
    from?: string;
};

declare const CONFIG: Config;
declare const INITIAL_LEADS: LeadStored[];

let socket: null | { on: (event: string, handler: (data?: any) => void) => void; emit: (event: string, payload?: any) => void } = null;
let isConnected = false;
let currentContact: Conversation | null = null;
let conversations: Conversation[] = [];
let messages: Record<string, ChatMessage[]> = {};
let currentFilter = 'all';

// Inicialização
function onReady(callback: () => void) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', callback);
    } else {
        callback();
    }
}


function getLoginUrl() {
    return '#/login';
}

function getQueryParams() {
    if (window.location.search) {
        return new URLSearchParams(window.location.search);
    }
    const hash = window.location.hash;
    const queryIndex = hash.indexOf('?');
    const query = queryIndex >= 0 ? hash.slice(queryIndex + 1) : '';
    return new URLSearchParams(query);
}

// Inicializa??o
function initConversas() {
    initSocket();
    loadConversations();
    
    // Verificar parâmetros da URL
    const params = getQueryParams();
    const phone = params.get('phone');
    const name = params.get('name');
    
    if (phone) {
        setTimeout(() => {
            selectConversation({
                number: phone,
                name: name || phone,
                jid: formatJid(phone)
            });
        }, 500);
    }
}

onReady(initConversas);

// Inicializar Socket
function initSocket() {
    if (!io) {
        console.warn('Socket.IO não carregado');
        return;
    }
    socket = io(CONFIG.SOCKET_URL, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000
    });
    
    socket.on('connect', function() {
        console.log('Conectado ao servidor');
        socket.emit('check-session', { sessionId: CONFIG.SESSION_ID });
    });
    
    socket.on('session-status', function(data) {
        isConnected = data.status === 'connected';
        updateConnectionWarning();
        
        if (isConnected) {
            socket.emit('get-contacts', { sessionId: CONFIG.SESSION_ID });
        }
    });
    
    socket.on('connected', function(data) {
        isConnected = true;
        updateConnectionWarning();
        socket.emit('get-contacts', { sessionId: CONFIG.SESSION_ID });
    });
    
    socket.on('disconnected', function() {
        isConnected = false;
        updateConnectionWarning();
    });
    
    socket.on('contacts-list', function(data) {
        if (data.contacts && data.contacts.length > 0) {
            mergeContacts(data.contacts);
            renderConversations();
        }
    });
    
    socket.on('messages-list', function(data) {
        if (data.contactJid && data.messages) {
            messages[data.contactJid] = data.messages;
            if (currentContact && currentContact.jid === data.contactJid) {
                renderMessages(data.messages);
            }
        }
    });
    
    socket.on('new-message', function(data: SocketMessage) {
        // Adicionar mensagem ao chat
        if (data.from) {
            if (!messages[data.from]) {
                messages[data.from] = [];
            }
            
            // Evitar duplicatas
            const exists = messages[data.from].find(m => m.id === data.id);
            if (!exists) {
                messages[data.from].push(data as ChatMessage);
                
                // Atualizar UI se for o chat atual
                if (currentContact && currentContact.jid === data.from) {
                    renderMessages(messages[data.from]);
                    scrollToBottom();
                }
                
                // Atualizar lista de conversas
                updateConversationPreview(data.from, data);
            }
        }
    });
    
    socket.on('message-sent', function(data) {
        showToast('success', 'Mensagem enviada!');
    });
    
    socket.on('message-status', function(data) {
        // Atualizar status da mensagem
        updateMessageStatus(data.messageId, data.status);
    });
    
    socket.on('error', function(data) {
        showToast('error', data.message || 'Erro na operação');
    });
}

// Atualizar aviso de conexão
function updateConnectionWarning() {
    const warning = document.getElementById('connection-warning') as HTMLElement | null;
    if (warning) warning.style.display = isConnected ? 'none' : 'flex';
}

// Carregar conversas
function loadConversations() {
    // Carregar leads do localStorage
    const stored = localStorage.getItem(CONFIG.STORAGE_KEYS.LEADS);
    let leads: LeadStored[] = stored ? JSON.parse(stored) : INITIAL_LEADS;
    
    // Converter leads para formato de conversa
    conversations = leads.map(lead => ({
        jid: formatJid(lead.telefone),
        number: lead.telefone,
        name: lead.nome,
        lastMessage: 'Clique para iniciar conversa',
        lastMessageTime: new Date(lead.data).getTime() || Date.now(),
        unreadCount: 0,
        status: lead.status,
        veiculo: lead.veiculo,
        placa: lead.placa
    }));
    
    renderConversations();
}

// Mesclar contatos do WhatsApp
function mergeContacts(whatsappContacts: Array<Partial<Conversation>>) {
    whatsappContacts.forEach(contact => {
        const existing = conversations.find(c => c.jid === contact.jid || c.number === contact.number);
        if (existing) {
            existing.lastMessage = contact.lastMessage || existing.lastMessage;
            existing.lastMessageTime = contact.lastMessageTime || existing.lastMessageTime;
            existing.unreadCount = contact.unreadCount || 0;
        } else {
            conversations.push({
                jid: contact.jid || formatJid(contact.number || ''),
                number: contact.number || '',
                name: contact.name || contact.number || '',
                lastMessage: contact.lastMessage || 'Nova conversa',
                lastMessageTime: contact.lastMessageTime || Date.now(),
                unreadCount: contact.unreadCount || 0
            });
        }
    });
    
    // Ordenar por última mensagem
    conversations.sort((a, b) => b.lastMessageTime - a.lastMessageTime);
}

// Renderizar conversas
function renderConversations() {
    const container = document.getElementById('conversations-list') as HTMLElement | null;
    if (!container) return;
    let filtered = conversations;
    
    // Aplicar filtro
    if (currentFilter === 'unread') {
        filtered = conversations.filter(c => c.unreadCount > 0);
    }
    
    // Aplicar busca
    const searchTerm = (document.getElementById('search-input') as HTMLInputElement | null)?.value.toLowerCase() || '';
    if (searchTerm) {
        filtered = filtered.filter(c => 
            c.name.toLowerCase().includes(searchTerm) ||
            c.number.includes(searchTerm)
        );
    }
    
    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="conversations-empty">
                <span class="icon icon-empty icon-lg"></span>
                <h3>Nenhuma conversa</h3>
                <p>Não há conversas para exibir no momento</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = filtered.map(conv => `
        <div class="conversation-item ${conv.unreadCount > 0 ? 'unread' : ''} ${currentContact?.jid === conv.jid ? 'active' : ''}" 
             onclick="selectConversation(${JSON.stringify(conv).replace(/"/g, '&quot;')})">
            <div class="conversation-avatar">
                ${conv.name ? conv.name.charAt(0).toUpperCase() : '<span class="icon icon-user icon-sm"></span>'}
            </div>
            <div class="conversation-info">
                <div class="conversation-name">${conv.name}</div>
                <div class="conversation-preview">
                    ${conv.lastMessage}
                </div>
            </div>
            <div class="conversation-meta">
                <span class="conversation-time">${formatTime(conv.lastMessageTime)}</span>
                ${conv.unreadCount > 0 ? `<span class="unread-badge">${conv.unreadCount}</span>` : ''}
            </div>
        </div>
    `).join('');
}

// Selecionar conversa
function selectConversation(contact: Conversation) {
    currentContact = contact;
    
    // Atualizar UI
    const chatHeader = document.getElementById('chat-header') as HTMLElement | null;
    const chatEmpty = document.getElementById('chat-empty') as HTMLElement | null;
    const chatInput = document.getElementById('chat-input-container') as HTMLElement | null;
    const quickTemplates = document.getElementById('quick-templates') as HTMLElement | null;
    if (chatHeader) chatHeader.style.display = 'flex';
    if (chatEmpty) chatEmpty.style.display = 'none';
    if (chatInput) chatInput.style.display = 'block';
    if (quickTemplates) quickTemplates.style.display = 'flex';
    
    const chatAvatar = document.getElementById('chat-avatar') as HTMLElement | null;
    const chatName = document.getElementById('chat-name') as HTMLElement | null;
    const chatPhone = document.getElementById('chat-phone') as HTMLElement | null;
    if (chatAvatar) {
        chatAvatar.innerHTML = contact.name ? contact.name.charAt(0).toUpperCase() : '<span class="icon icon-user icon-sm"></span>';
    }
    if (chatName) chatName.textContent = contact.name;
    if (chatPhone) chatPhone.textContent = formatPhone(contact.number);
    
    // Marcar como lido
    const conv = conversations.find(c => c.jid === contact.jid);
    if (conv) {
        conv.unreadCount = 0;
    }
    
    // Atualizar lista
    renderConversations();
    
    // Carregar mensagens
    if (isConnected) {
        socket?.emit('get-messages', { 
            sessionId: CONFIG.SESSION_ID, 
            contactJid: contact.jid 
        });
        socket?.emit('mark-read', {
            sessionId: CONFIG.SESSION_ID,
            contactJid: contact.jid
        });
    }
    
    // Mostrar mensagens em cache
    if (messages[contact.jid]) {
        renderMessages(messages[contact.jid]);
    } else {
        const chatMessages = document.getElementById('chat-messages') as HTMLElement | null;
        if (chatMessages) {
            chatMessages.innerHTML = `
            <div class="chat-empty">
                <span class="icon icon-empty icon-lg"></span>
                <h3>Inicie a conversa</h3>
                <p>Envie uma mensagem para ${contact.name}</p>
            </div>
        `;
        }
    }
    
    // Mobile: esconder lista
    if (window.innerWidth <= 900) {
        document.getElementById('inbox-sidebar')?.classList.add('hidden');
        document.getElementById('chat-area')?.classList.remove('hidden');
    }
}

// Renderizar mensagens
function renderMessages(msgs: ChatMessage[]) {
    const container = document.getElementById('chat-messages') as HTMLElement | null;
    if (!container) return;
    
    if (!msgs || msgs.length === 0) {
        container.innerHTML = `
            <div class="chat-empty">
                <span class="icon icon-empty icon-lg"></span>
                <h3>Inicie a conversa</h3>
                <p>Envie uma mensagem para começar</p>
            </div>
        `;
        return;
    }
    
    // Agrupar por data
    const grouped = groupMessagesByDate(msgs);
    
    let html = '';
    for (const [date, dayMessages] of Object.entries(grouped)) {
        html += `<div class="chat-date-divider"><span>${date}</span></div>`;
        
        dayMessages.forEach(msg => {
            const statusIcon = getStatusIcon(msg.status);
            html += `
                <div class="chat-message ${msg.isFromMe ? 'sent' : 'received'}" data-id="${msg.id}">
                    <div class="message-text">${escapeHtml(msg.text)}</div>
                    <div class="message-footer">
                        <span>${formatMessageTime(msg.timestamp)}</span>
                        ${msg.isFromMe ? `<span class="status-icon ${msg.status === 'read' ? 'read' : ''}">${statusIcon}</span>` : ''}
                    </div>
                </div>
            `;
        });
    }
    
    container.innerHTML = html;
    scrollToBottom();
}

// Agrupar mensagens por data
function groupMessagesByDate(msgs: ChatMessage[]) {
    const groups: Record<string, ChatMessage[]> = {};
    
    msgs.forEach(msg => {
        const date = new Date(msg.timestamp);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        let dateKey;
        if (date.toDateString() === today.toDateString()) {
            dateKey = 'Hoje';
        } else if (date.toDateString() === yesterday.toDateString()) {
            dateKey = 'Ontem';
        } else {
            dateKey = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        }
        
        if (!groups[dateKey]) {
            groups[dateKey] = [];
        }
        groups[dateKey].push(msg);
    });
    
    return groups;
}

// Enviar mensagem
function sendMessage() {
    const input = document.getElementById('message-input') as HTMLTextAreaElement | null;
    const message = input?.value.trim() || '';
    
    if (!message || !currentContact) return;
    
    if (!isConnected) {
        showToast('warning', 'WhatsApp não está conectado');
        return;
    }
    
    // Enviar via socket
    socket?.emit('send-message', {
        sessionId: CONFIG.SESSION_ID,
        to: currentContact.number,
        message: message,
        type: 'text'
    });
    
    // Adicionar mensagem localmente
    const newMessage: ChatMessage = {
        id: 'temp_' + Date.now(),
        text: message,
        isFromMe: true,
        timestamp: Date.now(),
        status: 'pending'
    };
    
    if (!messages[currentContact.jid]) {
        messages[currentContact.jid] = [];
    }
    messages[currentContact.jid].push(newMessage);
    
    // Atualizar UI
    renderMessages(messages[currentContact.jid]);
    
    // Limpar input
    if (input) {
        input.value = '';
        input.style.height = 'auto';
    }
    
    // Atualizar preview da conversa
    updateConversationPreview(currentContact.jid, newMessage);
}

// Atualizar preview da conversa
function updateConversationPreview(jid: string, message: ChatMessage) {
    const conv = conversations.find(c => c.jid === jid);
    if (conv) {
        conv.lastMessage = message.text.substring(0, 50) + (message.text.length > 50 ? '...' : '');
        conv.lastMessageTime = message.timestamp;
        
        // Reordenar
        conversations.sort((a, b) => b.lastMessageTime - a.lastMessageTime);
        renderConversations();
    }
}

// Atualizar status da mensagem
function updateMessageStatus(messageId: string, status: string) {
    const msgEl = document.querySelector(`[data-id="${messageId}"]`) as HTMLElement | null;
    if (msgEl) {
        const statusEl = msgEl.querySelector('.status-icon') as HTMLElement | null;
        if (statusEl) {
            statusEl.textContent = getStatusIcon(status);
            if (status === 'read') {
                statusEl.classList.add('read');
            }
        }
    }
}

// Usar template
function useTemplate(text: string) {
    const input = document.getElementById('message-input') as HTMLTextAreaElement | null;
    if (!input) return;
    input.value = text;
    input.focus();
}

// Filtrar conversas
function filterConversations(filter: string) {
    currentFilter = filter;
    
    // Atualizar botões
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    const target = (window as any).event?.target as HTMLElement | undefined;
    target?.classList.add('active');
    
    renderConversations();
}

// Buscar conversas
function searchConversations() {
    renderConversations();
}

// Voltar para lista (mobile)
function showConversationsList() {
    document.getElementById('inbox-sidebar')?.classList.remove('hidden');
    document.getElementById('chat-area')?.classList.add('hidden');
}

// Abrir WhatsApp Web
function openWhatsAppWeb() {
    if (currentContact) {
        const phone = currentContact.number.replace(/[^0-9]/g, '');
        window.open(`https://wa.me/55${phone}`, '_blank');
    }
}

// Ver detalhes do lead
function viewLeadDetails() {
    if (currentContact) {
        showToast('info', `Lead: ${currentContact.name}`);
    }
}

// Helpers
function formatJid(phone) {
    let cleaned = phone.replace(/[^0-9]/g, '');
    if (!cleaned.startsWith('55') && cleaned.length <= 11) {
        cleaned = '55' + cleaned;
    }
    return cleaned + '@s.whatsapp.net';
}

function formatPhone(phone: string) {
    if (!phone) return '';
    const cleaned = phone.replace(/[^0-9]/g, '');
    if (cleaned.length === 11) {
        return `(${cleaned.slice(0,2)}) ${cleaned.slice(2,7)}-${cleaned.slice(7)}`;
    } else if (cleaned.length === 10) {
        return `(${cleaned.slice(0,2)}) ${cleaned.slice(2,6)}-${cleaned.slice(6)}`;
    }
    return phone;
}

function formatTime(timestamp: number) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    
    if (date.toDateString() === now.toDateString()) {
        return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }
    
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
        return 'Ontem';
    }
    
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function formatMessageTime(timestamp: number) {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function getStatusIcon(status: string) {
    switch (status) {
        case 'pending': return '•';
        case 'sent': return '✓';
        case 'delivered': return '✓✓';
        case 'read': return '✓✓';
        default: return '✓';
    }
}

function escapeHtml(text: string) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function scrollToBottom() {
    const container = document.getElementById('chat-messages') as HTMLElement | null;
    if (container) container.scrollTop = container.scrollHeight;
}

function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
}

function autoResize(textarea: HTMLTextAreaElement) {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
}

function showToast(type: 'success' | 'error' | 'warning' | 'info', message: string) {
    const container = document.getElementById('toast-container') as HTMLElement | null;
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = { success: 'OK', error: 'ERRO', warning: 'AVISO', info: 'INFO' };
    toast.innerHTML = `
        <span class="toast-icon">${icons[type] || 'INFO'}</span>
        <span class="toast-message">${message}</span>
    `;
    
    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

function toggleSidebar() {
    document.getElementById('sidebar')?.classList.toggle('active');
    document.querySelector('.sidebar-overlay')?.classList.toggle('active');
}

function logout() {
    localStorage.removeItem('isLoggedIn');
    sessionStorage.removeItem('selfDashboardToken');
    sessionStorage.removeItem('selfDashboardExpiry');
    sessionStorage.removeItem('selfDashboardUser');
    sessionStorage.removeItem('selfDashboardRefreshToken');
    sessionStorage.removeItem('selfDashboardUserId');
    sessionStorage.removeItem('selfDashboardUserEmail');
    sessionStorage.removeItem('selfDashboardIdentity');
    window.location.href = getLoginUrl();
}

const windowAny = window as Window & {
    initConversas?: () => void;
    selectConversation?: (contact: Conversation) => void;
    sendMessage?: () => void;
    handleKeyDown?: (event: KeyboardEvent) => void;
    autoResize?: (textarea: HTMLTextAreaElement) => void;
    useTemplate?: (text: string) => void;
    filterConversations?: (filter: string) => void;
    searchConversations?: () => void;
    showConversationsList?: () => void;
    openWhatsAppWeb?: () => void;
    viewLeadDetails?: () => void;
    toggleSidebar?: () => void;
    logout?: () => void;
};
windowAny.initConversas = initConversas;
windowAny.selectConversation = selectConversation;
windowAny.sendMessage = sendMessage;
windowAny.handleKeyDown = handleKeyDown;
windowAny.autoResize = autoResize;
windowAny.useTemplate = useTemplate;
windowAny.filterConversations = filterConversations;
windowAny.searchConversations = searchConversations;
windowAny.showConversationsList = showConversationsList;
windowAny.openWhatsAppWeb = openWhatsAppWeb;
windowAny.viewLeadDetails = viewLeadDetails;
windowAny.toggleSidebar = toggleSidebar;
windowAny.logout = logout;

export { initConversas };
