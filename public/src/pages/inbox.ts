// Inbox page logic migrated to module

declare const io:
    | undefined
    | ((url?: string, options?: Record<string, unknown>) => {
          on: (event: string, handler: (data?: any) => void) => void;
          emit: (event: string, payload?: any) => void;
      });

type LeadStatus = 1 | 2 | 3 | 4;

type Conversation = {
    id: number;
    leadId: number;
    name: string;
    phone: string;
    lastMessage?: string;
    lastMessageAt?: string;
    unread?: number;
    status?: LeadStatus;
};

type ChatMessage = {
    id: number | string;
    content: string;
    direction: 'outgoing' | 'incoming';
    status?: string;
    created_at: string;
    media_type?: string;
    media_url?: string;
};

type ConversationsResponse = { conversations?: Array<Record<string, any>> };
type MessagesResponse = { messages?: Array<Record<string, any>> };
type QuickRepliesResponse = { templates?: Array<Record<string, any>> };

type TemplateItem = {
    id: number;
    name: string;
    content: string;
    category?: string;
    media_type?: string;
    media_url?: string;
};

let conversations: Conversation[] = [];
let currentConversation: Conversation | null = null;
let messages: ChatMessage[] = [];
let quickReplies: TemplateItem[] = [];
let socket: null | { on: (event: string, handler: (data?: any) => void) => void; emit: (event: string, payload?: any) => void } = null;
let socketBound = false;
let refreshInterval: number | null = null;
let currentFilter: 'all' | 'unread' = 'all';
let quickReplyDismissBound = false;

function normalizeDirection(message: Record<string, any>): 'outgoing' | 'incoming' {
    const rawDirection = String(message.direction || '').trim().toLowerCase();
    if (['outgoing', 'sent', 'agent', 'bot', 'me', 'from_me'].includes(rawDirection)) return 'outgoing';
    if (['incoming', 'received', 'lead', 'contact', 'customer', 'from_them'].includes(rawDirection)) return 'incoming';

    const senderType = String(message.sender_type || '').trim().toLowerCase();
    if (['agent', 'bot', 'system'].includes(senderType)) return 'outgoing';
    if (['lead', 'contact', 'customer'].includes(senderType)) return 'incoming';

    const fromMe = message.is_from_me;
    if (fromMe === true || fromMe === 1 || fromMe === '1' || fromMe === 'true') return 'outgoing';
    if (fromMe === false || fromMe === 0 || fromMe === '0' || fromMe === 'false') return 'incoming';

    return 'incoming';
}

function escapeHtml(value: string) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function normalizeName(value: string) {
    return String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
}

function onReady(callback: () => void) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', callback);
    } else {
        callback();
    }
}


function getContatosUrl(id: string | number) {
    return `#/contatos?id=${id}`;
}

function initInbox() {
    bindQuickReplyDismiss();
    loadConversations();
    loadQuickReplies();
    initSocket();
    if (refreshInterval === null) {
        refreshInterval = window.setInterval(loadConversations, 10000);
    }
}

onReady(initInbox);

function bindQuickReplyDismiss() {
    if (quickReplyDismissBound) return;
    quickReplyDismissBound = true;

    document.addEventListener('click', (event) => {
        const target = event.target as HTMLElement | null;
        const picker = document.getElementById('quickReplyPicker') as HTMLElement | null;
        if (!picker || !picker.classList.contains('open')) return;
        if (target?.closest('.quick-reply-toolbar')) return;
        closeQuickReplyPicker();
    });
}

function initSocket() {
    try {
        const win = window as Window & { APP?: { socket?: any; socketUrl?: string } };
        const appSocket = win.APP?.socket;
        if (appSocket) {
            socket = appSocket;
        } else if (io) {
            const token = sessionStorage.getItem('selfDashboardToken');
            const socketOptions: {
                transports: string[];
                reconnection: boolean;
                reconnectionAttempts: number;
                reconnectionDelay: number;
                auth?: { token: string };
            } = {
                transports: ['websocket', 'polling'],
                reconnection: true,
                reconnectionAttempts: 10,
                reconnectionDelay: 2000
            };
            if (token) socketOptions.auth = { token };
            socket = io(win.APP?.socketUrl, socketOptions);
        } else {
            console.log('Socket não disponível');
            return;
        }

        if (!socket || socketBound) return;
        socketBound = true;
        
        socket.on('new-message', (data) => {
            const isCurrent =
                currentConversation &&
                (data.conversationId === currentConversation.id || data.leadId === currentConversation.leadId);
            if (isCurrent) {
                messages.push({
                    id: data.id || Date.now(),
                    content: data.text || '',
                    direction: data.isFromMe ? 'outgoing' : 'incoming',
                    status: data.status || (data.isFromMe ? 'sent' : 'received'),
                    created_at: new Date(data.timestamp || Date.now()).toISOString()
                });
                const chatMessages = document.getElementById('chatMessages') as HTMLElement | null;
                renderMessagesInto(chatMessages);
                scrollToBottom();
            }
            loadConversations();
        });

        socket.on('message-status', (data) => {
            // Atualizar status da mensagem
        });
    } catch (e) {
        console.log('Socket não disponível');
    }
}

async function loadConversations() {
    try {
        const response: ConversationsResponse = await api.get('/api/conversations');
        const items = response.conversations || [];
        conversations = items.map((c) => ({
            id: c.id,
            leadId: c.lead_id || c.leadId || c.id,
            name: c.name || c.lead_name || c.phone,
            phone: c.phone,
            lastMessage: c.lastMessage || c.last_message || 'Clique para iniciar conversa',
            lastMessageAt: c.lastMessageAt || c.last_message_at || c.updated_at || c.created_at,
            unread: c.unread || c.unread_count || 0,
            status: c.status
        }));

        renderConversations();
        updateUnreadBadge();
    } catch (error) {
        console.error(error);
        showToast('error', 'Erro', 'Não foi possível carregar as conversas');
    }
}

function renderConversations() {
    const list = document.getElementById('conversationsList') as HTMLElement | null;
    if (!list) return;
    
    if (conversations.length === 0) {
        list.innerHTML = `
            <div class="empty-state" style="padding: 40px;">
                <div class="empty-state-icon icon icon-empty icon-lg"></div>
                <p>Nenhuma conversa</p>
            </div>
        `;
        return;
    }

    list.innerHTML = conversations.map(c => `
        <div class="conversation-item ${c.unread > 0 ? 'unread' : ''} ${currentConversation?.id === c.id ? 'active' : ''}" 
             onclick="selectConversation(${c.id})">
            <div class="conversation-avatar" style="background: ${getAvatarColor(c.name)}">
                ${getInitials(c.name)}
            </div>
            <div class="conversation-info">
                <div class="conversation-name">${escapeHtml(c.name || 'Sem nome')}</div>
                <div class="conversation-preview">${escapeHtml(c.lastMessage || 'Sem mensagens')}</div>
            </div>
            <div class="conversation-meta">
                <div class="conversation-time">${c.lastMessageAt ? timeAgo(c.lastMessageAt) : ''}</div>
                ${c.unread > 0 ? `<div class="conversation-badge">${c.unread}</div>` : ''}
            </div>
        </div>
    `).join('');
}

function filterConversations(filter: 'all' | 'unread') {
    currentFilter = filter;
    document.querySelectorAll('.conversations-tabs button').forEach(b => b.classList.remove('active'));
    const target = (window as any).event?.target as HTMLElement | undefined;
    target?.classList.add('active');
    
    if (filter === 'unread') {
        const filtered = conversations.filter(c => c.unread > 0);
        renderFilteredConversations(filtered);
    } else {
        renderConversations();
    }
}

function renderFilteredConversations(filtered: Conversation[]) {
    const list = document.getElementById('conversationsList') as HTMLElement | null;
    if (!list) return;
    if (filtered.length === 0) {
        list.innerHTML = `<div class="empty-state" style="padding: 40px;"><p>Nenhuma conversa encontrada</p></div>`;
        return;
    }
    // Usar mesma lógica de renderConversations
    list.innerHTML = filtered.map(c => `
        <div class="conversation-item ${c.unread > 0 ? 'unread' : ''}" onclick="selectConversation(${c.id})">
            <div class="conversation-avatar" style="background: ${getAvatarColor(c.name)}">${getInitials(c.name)}</div>
            <div class="conversation-info">
                <div class="conversation-name">${escapeHtml(c.name || 'Sem nome')}</div>
                <div class="conversation-preview">${escapeHtml(c.lastMessage || '')}</div>
            </div>
            <div class="conversation-meta">
                <div class="conversation-time">${c.lastMessageAt ? timeAgo(c.lastMessageAt) : ''}</div>
                ${c.unread > 0 ? `<div class="conversation-badge">${c.unread}</div>` : ''}
            </div>
        </div>
    `).join('');
}

function searchConversations() {
    const search = (document.getElementById('searchConversations') as HTMLInputElement | null)?.value.toLowerCase() || '';
    const filtered = conversations.filter(c => 
        (c.name && c.name.toLowerCase().includes(search)) ||
        (c.phone && c.phone.includes(search))
    );
    renderFilteredConversations(filtered);
}

async function selectConversation(id: number) {
    currentConversation = conversations.find(c => c.id === id);
    if (!currentConversation) return;

    // Marcar localmente como lida para atualizar badge imediatamente
    if ((currentConversation.unread || 0) > 0) {
        currentConversation.unread = 0;
        conversations = conversations.map((c) => (c.id === id ? { ...c, unread: 0 } : c));
        if (currentFilter === 'unread') {
            renderFilteredConversations(conversations.filter((c) => (c.unread || 0) > 0));
        } else {
            renderConversations();
        }
        updateUnreadBadge();
    }

    // Marcar como ativo
    document.querySelectorAll('.conversation-item').forEach(i => i.classList.remove('active'));
    document.querySelector(`.conversation-item[onclick="selectConversation(${id})"]`)?.classList.add('active');

    // Persistir no backend que a conversa foi lida
    try {
        socket?.emit('mark-read', {
            sessionId: APP.sessionId,
            conversationId: id
        });
        await api.post(`/api/conversations/${id}/read`, {});
    } catch {
        // Não bloqueia abertura da conversa se falhar sincronização de leitura
    }

    // Carregar mensagens
    await loadMessages(currentConversation.leadId);

    // Renderizar chat
    renderChat();
}

async function loadMessages(leadId: number) {
    try {
        const response: MessagesResponse = await api.get(`/api/messages/${leadId}`);
        messages = (response.messages || []).map(m => ({
            ...m,
            direction: normalizeDirection(m),
            created_at: m.created_at || m.sent_at || new Date().toISOString(),
            media_type: m.media_type || 'text',
            media_url: m.media_url || null
        }));
    } catch (error) {
        messages = [];
    }
}

async function loadQuickReplies() {
    try {
        const response: QuickRepliesResponse = await api.get('/api/templates');
        quickReplies = (response.templates || [])
            .filter((item) => {
                const category = normalizeName(item.category || 'custom');
                return category === 'quick_reply' || category === 'custom' || category === '';
            })
            .map((item) => ({
                id: item.id,
                name: item.name,
                content: item.content || '',
                category: item.category,
                media_type: item.media_type,
                media_url: item.media_url
            }));
    } catch (error) {
        quickReplies = [];
    }
}

function renderQuickReplyItems() {
    if (!quickReplies.length) {
        return `<div class="quick-reply-empty">Nenhuma resposta r&aacute;pida cadastrada</div>`;
    }

    return quickReplies
        .map((item) => {
            const isAudio = item.media_type === 'audio';
            const label = isAudio ? `${item.name} (áudio)` : item.name;
            return `<button class="quick-reply-option" onclick="selectQuickReply(${item.id})">${escapeHtml(label)}</button>`;
        })
        .join('');
}

function applyQuickReplyVariables(content: string) {
    if (!currentConversation) return content;
    return content
        .replace(/\{\{\s*nome\s*\}\}/gi, currentConversation.name || '')
        .replace(/\{\{\s*telefone\s*\}\}/gi, formatPhone(currentConversation.phone || ''))
        .replace(/\{\{\s*veiculo\s*\}\}/gi, '')
        .replace(/\{\{\s*placa\s*\}\}/gi, '')
        .replace(/\{\{\s*empresa\s*\}\}/gi, 'ZapVender');
}

function toggleQuickReplyPicker() {
    const picker = document.getElementById('quickReplyPicker') as HTMLElement | null;
    if (!picker) return;
    picker.classList.toggle('open');
}

function closeQuickReplyPicker() {
    const picker = document.getElementById('quickReplyPicker') as HTMLElement | null;
    if (!picker) return;
    picker.classList.remove('open');
}

function selectQuickReply(id: number) {
    const input = document.getElementById('messageInput') as HTMLTextAreaElement | null;
    if (!input) return;

    const selectedReply = quickReplies.find((item) => item.id === id);
    if (!selectedReply) return;

    closeQuickReplyPicker();

    if (selectedReply.media_type === 'audio') {
        sendQuickReplyAudio(selectedReply);
        return;
    }

    const text = applyQuickReplyVariables(selectedReply.content || '');
    input.value = text;
    input.focus();
}

async function sendQuickReplyAudio(quickReply: TemplateItem) {
    if (!currentConversation) return;
    if (!quickReply.media_url) {
        showToast('warning', 'Aviso', 'Resposta rápida de áudio sem arquivo');
        return;
    }
    const mediaUrl = quickReply.media_url;

    const newMessage: ChatMessage = {
        id: Date.now(),
        content: 'Áudio',
        direction: 'outgoing',
        status: 'pending',
        created_at: new Date().toISOString(),
        media_type: 'audio',
        media_url: mediaUrl
    };
    messages.push(newMessage);

    const chatMessages = document.getElementById('chatMessages') as HTMLElement | null;
    renderMessagesInto(chatMessages);
    scrollToBottom();

    try {
        await api.post('/api/send', {
            sessionId: APP.sessionId,
            to: currentConversation.phone,
            message: mediaUrl,
            type: 'audio',
            options: { url: mediaUrl }
        });
        newMessage.status = 'sent';
        renderMessagesInto(chatMessages);
    } catch (error) {
        newMessage.status = 'failed';
        renderMessagesInto(chatMessages);
        showToast('error', 'Erro', 'Não foi possível enviar o áudio');
    }
}

function getMediaUrl(url?: string | null) {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    const base = (window as any).APP?.socketUrl || '';
    return `${base}${url}`;
}

function renderChat() {
    const panel = document.getElementById('chatPanel') as HTMLElement | null;
    if (!panel || !currentConversation) return;

    const quickReplyItems = renderQuickReplyItems();
    
    panel.innerHTML = `
        <div class="chat-header">
            <button class="btn btn-sm btn-outline btn-icon" onclick="backToList()" style="display: none;" id="backBtn">←</button>
            <div class="conversation-avatar" style="background: ${getAvatarColor(currentConversation.name)}; width: 40px; height: 40px; font-size: 14px;">
                ${getInitials(currentConversation.name)}
            </div>
            <div class="chat-header-info">
                <div class="chat-header-name">${escapeHtml(currentConversation.name || 'Sem nome')}</div>
                <div class="chat-header-status">${formatPhone(currentConversation.phone)}</div>
            </div>
            <div style="display: flex; gap: 10px;">
                <button class="btn btn-sm btn-outline btn-icon" onclick="openWhatsApp()" title="Abrir no WhatsApp"><span class="icon icon-whatsapp icon-sm"></span></button>
                <button class="btn btn-sm btn-outline btn-icon" onclick="viewContact()" title="Ver contato"><span class="icon icon-user icon-sm"></span></button>
                <button class="btn btn-sm btn-outline btn-icon" onclick="toggleContactInfo()" title="Mais opções">⋮</button>
            </div>
        </div>
        
        <div class="chat-messages" id="chatMessages">
            <div class="chat-messages-stack">
                ${renderMessages()}
            </div>
        </div>

        <div class="quick-reply-toolbar">
            <button class="btn btn-sm btn-outline quick-reply-trigger" onclick="toggleQuickReplyPicker()" title="Selecionar resposta r&aacute;pida">
                <span class="icon icon-bolt icon-sm"></span> Respostas r&aacute;pidas
            </button>
            <div class="quick-reply-picker" id="quickReplyPicker">
                ${quickReplyItems}
            </div>
        </div>

        <div class="chat-input">
            <textarea id="messageInput" placeholder="Digite uma mensagem..." rows="1" onkeydown="handleKeyDown(event)"></textarea>
            <button onclick="sendMessage()" title="Enviar"><span class="icon icon-send icon-sm"></span></button>
        </div>
    `;

    // Mostrar botão voltar em mobile
    if (window.innerWidth <= 768) {
        const backBtn = document.getElementById('backBtn') as HTMLElement | null;
        if (backBtn) backBtn.style.display = 'block';
        document.getElementById('conversationsPanel')?.classList.add('hidden');
        panel.classList.add('active');
    }

    scrollToBottom();
}

function renderMessages() {
    if (messages.length === 0) {
        return `
            <div style="text-align: center; padding: 40px; color: var(--gray-500);">
                <p>Nenhuma mensagem ainda</p>
                <p style="font-size: 12px;">Envie uma mensagem para iniciar a conversa</p>
            </div>
        `;
    }

    return messages.map(m => {
        let contentHtml = escapeHtml(m.content || '');
        if (m.media_type === 'audio' && m.media_url) {
            const audioUrl = getMediaUrl(m.media_url);
            contentHtml = `<audio controls preload="metadata" src="${audioUrl}"></audio>`;
        }

        return `
        <div class="message ${m.direction === 'outgoing' ? 'sent' : 'received'}">
            <div class="message-content">${contentHtml}</div>
            <div class="message-time">
                ${formatDate(m.created_at, 'time')}
                ${m.direction === 'outgoing' ? `<span class="message-status">${m.status === 'read' ? 'vv' : m.status === 'delivered' ? 'vv' : 'v'}</span>` : ''}
            </div>
        </div>
    `;
    }).join('');
}

function renderMessagesInto(container: HTMLElement | null) {
    if (!container) return;
    container.innerHTML = `<div class="chat-messages-stack">${renderMessages()}</div>`;
}

function scrollToBottom() {
    const container = document.getElementById('chatMessages') as HTMLElement | null;
    if (container) {
        container.scrollTop = container.scrollHeight;
    }
}

function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
}

async function sendMessage() {
    const input = document.getElementById('messageInput') as HTMLTextAreaElement | null;
    const content = input?.value.trim() || '';
    
    if (!content || !currentConversation) return;

    if (APP.whatsappStatus !== 'connected') {
        showToast('warning', 'Aviso', 'WhatsApp não está conectado');
    }

    // Adicionar mensagem localmente
    const newMessage: ChatMessage = {
        id: Date.now(),
        content,
        direction: 'outgoing',
        status: 'pending',
        created_at: new Date().toISOString()
    };
    messages.push(newMessage);
    
    // Atualizar UI
    const chatMessages = document.getElementById('chatMessages') as HTMLElement | null;
    renderMessagesInto(chatMessages);
    scrollToBottom();
    if (input) input.value = '';

    try {
        await api.post('/api/send', {
            sessionId: APP.sessionId,
            to: currentConversation.phone,
            message: content,
            type: 'text'
        });
        
        newMessage.status = 'sent';
        renderMessagesInto(chatMessages);
    } catch (error) {
        newMessage.status = 'failed';
        renderMessagesInto(chatMessages);
        showToast('error', 'Erro', 'Não foi possível enviar a mensagem');
    }
}

function openWhatsApp() {
    if (currentConversation?.phone) {
        window.open(`https://wa.me/55${currentConversation.phone}`, '_blank');
    }
}

function viewContact() {
    if (currentConversation) {
        window.location.href = getContatosUrl(currentConversation.leadId);
    }
}

function toggleContactInfo() {
    showToast('info', 'Info', 'Painel de informações em desenvolvimento');
}

async function registerCurrentUser() {
    if (!currentConversation) return;
    try {
        showLoading('Cadastrando usuário...');
        await api.post('/api/leads', {
            name: currentConversation.name || 'Contato',
            phone: currentConversation.phone,
            status: 1
        });
        hideLoading();
        showToast('success', 'Sucesso', 'Usuário cadastrado na sua audiência!');
        loadConversations();
        const inboxRight = document.getElementById('inboxRightContent') as HTMLElement | null;
        if (inboxRight) {
            inboxRight.innerHTML = `
            <span class="inbox-right-panel-robot icon icon-check icon-lg"></span>
            <p><strong>Cliente cadastrado!</strong></p>
            <p>O cartão do usuário está disponível em Contatos.</p>
        `;
        }
    } catch (error) {
        hideLoading();
        showToast('error', 'Erro', 'Não foi possível cadastrar');
    }
}

function backToList() {
    document.getElementById('conversationsPanel')?.classList.remove('hidden');
    document.getElementById('chatPanel')?.classList.remove('active');
}

function updateUnreadBadge() {
    const unread = conversations.reduce((sum, c) => sum + (c.unread || 0), 0);
    const badge = document.getElementById('unreadBadge') as HTMLElement | null;
    if (!badge) return;
    if (unread > 0) {
        badge.textContent = String(unread);
        badge.style.display = 'inline';
    } else {
        badge.style.display = 'none';
    }
}

// Atualizar conversas a cada 10 segundos (iniciado em initInbox)

const windowAny = window as Window & {
    initInbox?: () => void;
    filterConversations?: (filter: 'all' | 'unread') => void;
    searchConversations?: () => void;
    selectConversation?: (id: number) => Promise<void>;
    toggleQuickReplyPicker?: () => void;
    closeQuickReplyPicker?: () => void;
    selectQuickReply?: (id: number) => void;
    handleKeyDown?: (event: KeyboardEvent) => void;
    sendMessage?: () => Promise<void>;
    openWhatsApp?: () => void;
    viewContact?: () => void;
    toggleContactInfo?: () => void;
    registerCurrentUser?: () => Promise<void>;
    backToList?: () => void;
    logout?: () => void;
};
windowAny.initInbox = initInbox;
windowAny.filterConversations = filterConversations;
windowAny.searchConversations = searchConversations;
windowAny.registerCurrentUser = registerCurrentUser;
windowAny.logout = logout;
windowAny.selectConversation = selectConversation;
windowAny.toggleQuickReplyPicker = toggleQuickReplyPicker;
windowAny.closeQuickReplyPicker = closeQuickReplyPicker;
windowAny.selectQuickReply = selectQuickReply;
windowAny.handleKeyDown = handleKeyDown;
windowAny.sendMessage = sendMessage;
windowAny.openWhatsApp = openWhatsApp;
windowAny.viewContact = viewContact;
windowAny.toggleContactInfo = toggleContactInfo;
windowAny.backToList = backToList;

export { initInbox };
