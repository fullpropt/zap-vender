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
};

type LeadsResponse = { leads?: Array<Record<string, any>> };
type MessagesResponse = { messages?: Array<Record<string, any>> };

let conversations: Conversation[] = [];
let currentConversation: Conversation | null = null;
let messages: ChatMessage[] = [];
let socket: null | { on: (event: string, handler: (data?: any) => void) => void; emit: (event: string, payload?: any) => void } = null;
let refreshInterval: number | null = null;

function onReady(callback: () => void) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', callback);
    } else {
        callback();
    }
}


function getContatosUrl(id: string | number) {
    return `app.html#/contatos?id=${id}`;
}

function initInbox() {
    loadConversations();
    initSocket();
    if (refreshInterval === null) {
        refreshInterval = window.setInterval(loadConversations, 10000);
    }
}

onReady(initInbox);

function initSocket() {
    try {
        if (!io) {
            console.log('Socket não disponível');
            return;
        }
        socket = io();
        
        socket.on('new-message', (data) => {
            if (currentConversation && data.leadId === currentConversation.id) {
                messages.push({
                    id: data.id || Date.now(),
                    content: data.text || '',
                    direction: data.isFromMe ? 'outgoing' : 'incoming',
                    status: data.status || (data.isFromMe ? 'sent' : 'received'),
                    created_at: new Date(data.timestamp || Date.now()).toISOString()
                });
                const chatMessages = document.getElementById('chatMessages') as HTMLElement | null;
                if (chatMessages) chatMessages.innerHTML = renderMessages();
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
        const response: LeadsResponse = await api.get('/api/leads');
        const leads = response.leads || [];
        conversations = leads.map(l => ({
            id: l.id,
            name: l.name || l.phone,
            phone: l.phone,
            lastMessage: l.last_message || 'Clique para iniciar conversa',
            lastMessageAt: l.last_message_at || l.updated_at || l.created_at,
            unread: l.unread_count || 0,
            status: l.status
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
                <div class="conversation-name">${c.name || 'Sem nome'}</div>
                <div class="conversation-preview">${c.lastMessage || 'Sem mensagens'}</div>
            </div>
            <div class="conversation-meta">
                <div class="conversation-time">${c.lastMessageAt ? timeAgo(c.lastMessageAt) : ''}</div>
                ${c.unread > 0 ? `<div class="conversation-badge">${c.unread}</div>` : ''}
            </div>
        </div>
    `).join('');
}

function filterConversations(filter: 'all' | 'unread') {
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
                <div class="conversation-name">${c.name || 'Sem nome'}</div>
                <div class="conversation-preview">${c.lastMessage || ''}</div>
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

    // Marcar como ativo
    document.querySelectorAll('.conversation-item').forEach(i => i.classList.remove('active'));
    document.querySelector(`.conversation-item[onclick="selectConversation(${id})"]`)?.classList.add('active');

    // Carregar mensagens
    await loadMessages(id);

    // Renderizar chat
    renderChat();
}

async function loadMessages(leadId) {
    try {
        const response: MessagesResponse = await api.get(`/api/messages/${leadId}`);
        messages = (response.messages || []).map(m => ({
            ...m,
            direction: m.direction || (m.is_from_me ? 'outgoing' : 'incoming'),
            created_at: m.created_at || m.sent_at || new Date().toISOString()
        }));
    } catch (error) {
        messages = [];
    }
}

function renderChat() {
    const panel = document.getElementById('chatPanel') as HTMLElement | null;
    if (!panel || !currentConversation) return;
    
    panel.innerHTML = `
        <div class="chat-header">
            <button class="btn btn-sm btn-outline btn-icon" onclick="backToList()" style="display: none;" id="backBtn">←</button>
            <div class="conversation-avatar" style="background: ${getAvatarColor(currentConversation.name)}; width: 40px; height: 40px; font-size: 14px;">
                ${getInitials(currentConversation.name)}
            </div>
            <div class="chat-header-info">
                <div class="chat-header-name">${currentConversation.name || 'Sem nome'}</div>
                <div class="chat-header-status">${formatPhone(currentConversation.phone)}</div>
            </div>
            <div style="display: flex; gap: 10px;">
                <button class="btn btn-sm btn-outline btn-icon" onclick="openWhatsApp()" title="Abrir no WhatsApp"><span class="icon icon-whatsapp icon-sm"></span></button>
                <button class="btn btn-sm btn-outline btn-icon" onclick="viewContact()" title="Ver contato"><span class="icon icon-user icon-sm"></span></button>
                <button class="btn btn-sm btn-outline btn-icon" onclick="toggleContactInfo()" title="Mais opções">⋮</button>
            </div>
        </div>
        
        <div class="chat-messages" id="chatMessages">
            ${renderMessages()}
        </div>

        <div class="quick-replies">
            <div class="quick-reply" onclick="insertQuickReply('Olá! Tudo bem?')">Olá! Tudo bem?</div>
            <div class="quick-reply" onclick="insertQuickReply('Posso ajudar?')">Posso ajudar?</div>
            <div class="quick-reply" onclick="insertQuickReply('Obrigado pelo contato!')">Obrigado!</div>
            <div class="quick-reply" onclick="insertQuickReply('Vou verificar e retorno em breve.')">Vou verificar</div>
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

    return messages.map(m => `
        <div class="message ${m.direction === 'outgoing' ? 'sent' : 'received'}">
            <div class="message-content">${m.content}</div>
            <div class="message-time">
                ${formatDate(m.created_at, 'time')}
                ${m.direction === 'outgoing' ? `<span class="message-status">${m.status === 'read' ? '✓✓' : m.status === 'delivered' ? '✓✓' : '✓'}</span>` : ''}
            </div>
        </div>
    `).join('');
}

function scrollToBottom() {
    const container = document.getElementById('chatMessages') as HTMLElement | null;
    if (container) {
        container.scrollTop = container.scrollHeight;
    }
}

function insertQuickReply(text: string) {
    const input = document.getElementById('messageInput') as HTMLTextAreaElement | null;
    if (!input) return;
    input.value = text;
    input.focus();
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
    if (chatMessages) chatMessages.innerHTML = renderMessages();
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
        if (chatMessages) chatMessages.innerHTML = renderMessages();
    } catch (error) {
        newMessage.status = 'failed';
        if (chatMessages) chatMessages.innerHTML = renderMessages();
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
        window.location.href = getContatosUrl(currentConversation.id);
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
    filterConversations?: (filter: string) => void;
    searchConversations?: () => void;
    registerCurrentUser?: () => void;
    logout?: () => void;
    filterConversations?: (filter: 'all' | 'unread') => void;
    searchConversations?: () => void;
    selectConversation?: (id: number) => Promise<void>;
    insertQuickReply?: (text: string) => void;
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
windowAny.filterConversations = filterConversations;
windowAny.searchConversations = searchConversations;
windowAny.selectConversation = selectConversation;
windowAny.insertQuickReply = insertQuickReply;
windowAny.handleKeyDown = handleKeyDown;
windowAny.sendMessage = sendMessage;
windowAny.openWhatsApp = openWhatsApp;
windowAny.viewContact = viewContact;
windowAny.toggleContactInfo = toggleContactInfo;
windowAny.registerCurrentUser = registerCurrentUser;
windowAny.backToList = backToList;
windowAny.logout = logout;

export { initInbox };
