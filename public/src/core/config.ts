/**
 * CONFIGURAÇÕES DO SISTEMA - ZapVender v2.0.0
 * Altere estas configurações conforme seu ambiente
 */

type StorageKeys = {
    LEADS: string;
    TEMPLATES: string;
    WHATSAPP_CONNECTED: string;
    WHATSAPP_USER: string;
    MESSAGES: string;
    CONTACTS: string;
};

type Config = {
    SOCKET_URL: string;
    SESSION_ID: string;
    COUNTRY_CODE: string;
    BULK_MESSAGE_DELAY: number;
    SEND_TIMEOUT: number;
    QR_REFRESH_INTERVAL: number;
    QR_TIMEOUT: number;
    STORAGE_KEYS: StorageKeys;
    VERSION: string;
};

type SampleLead = {
    id: number;
    data: string;
    nome: string;
    telefone: string;
    placa: string;
    veiculo: string;
    status: number;
};

type SampleTemplate = {
    id: number;
    nome: string;
    mensagem: string;
};

type SampleData = {
    leads: SampleLead[];
    templates: SampleTemplate[];
    contatos: unknown[];
    messages: unknown[];
};

type UtilsType = {
    formatPhoneDisplay: (phone: string) => string;
    formatPhoneNumber: (phone: string) => string;
    formatPhoneToWhatsApp: (phone: string) => string;
    formatDate: (dateStr: string) => string;
    formatDateTime: (dateStr: string) => string;
    fixMojibakeText: (value: string) => string;
};

const CONFIG: Config = {
    // URL do servidor WhatsApp (Node.js com Baileys)
    // Em produção no Railway, usa a mesma origem (sem porta específica)
    SOCKET_URL: window.location.origin,
    
    // ID da sessão WhatsApp
    SESSION_ID: 'default_whatsapp_session',
    
    // Código do país padrão
    COUNTRY_CODE: '55',
    
    // Delay entre mensagens em massa (ms)
    BULK_MESSAGE_DELAY: 3000,
    
    // Timeout para envio de mensagem (ms)
    SEND_TIMEOUT: 30000,
    
    // Configurações de QR Code
    QR_REFRESH_INTERVAL: 30000,
    QR_TIMEOUT: 60000,
    
    // Chaves do localStorage
    STORAGE_KEYS: {
        LEADS: 'self_leads',
        TEMPLATES: 'self_templates',
        WHATSAPP_CONNECTED: 'whatsapp_connected',
        WHATSAPP_USER: 'whatsapp_user',
        MESSAGES: 'self_messages',
        CONTACTS: 'self_contacts'
    },
    
    // Versão do sistema
    VERSION: '2.0.0'
};

// ============================================
// DADOS DE EXEMPLO PARA DEMONSTRAÇÃO
// ============================================

const SAMPLE_DATA: SampleData = {
    leads: [
        {
            id: 1,
            data: '04/01/2025 12:30',
            nome: 'João Silva',
            telefone: '27999999999',
            placa: 'ABC1234',
            veiculo: 'Vectra Elegan. 2.0 MPFI 8V FlexPower Mec (2011)',
            status: 1
        },
        {
            id: 2,
            data: '04/01/2025 14:15',
            nome: 'Maria Santos',
            telefone: '27988888888',
            placa: 'XYZ5678',
            veiculo: 'CITY Sedan EXL 1.5 Flex 16V 4p Aut. (2015)',
            status: 2
        },
        {
            id: 3,
            data: '03/01/2025 09:45',
            nome: 'Pedro Costa',
            telefone: '27977777777',
            placa: 'DEF9012',
            veiculo: 'SANDERO STEPWAY Dynamiq. Flex 1.6 16V 5p (2019)',
            status: 3
        },
        {
            id: 4,
            data: '02/01/2025 16:20',
            nome: 'Ana Oliveira',
            telefone: '27966666666',
            placa: 'GHI3456',
            veiculo: 'NXR 150 BROS ESD MIX/FLEX (2010)',
            status: 1
        },
        {
            id: 5,
            data: '01/01/2025 11:10',
            nome: 'Lucas Pereira',
            telefone: '27955555555',
            placa: 'JKL7890',
            veiculo: 'YS 250 FAZER/ FAZER L. EDITION /BLUEFLEX (2017)',
            status: 4
        },
        {
            id: 6,
            data: '01/01/2025 15:30',
            nome: 'Carla Almeida',
            telefone: '27944444444',
            placa: 'MNO1234',
            veiculo: 'Grand Vitara 2.0 16V 4x2/4x4 5p Aut. (2012)',
            status: 2
        }
    ],
    
    templates: [
        {
            id: 1,
            nome: 'Boas-vindas',
            mensagem: 'Oi {{nome}}, tudo bem? Aqui é da *ZapVender*! Vi que você tem interesse em proteger seu veículo. Posso te ajudar?'
        },
        {
            id: 2,
            nome: 'Promoção Especial',
            mensagem: 'Oi {{nome}}, feliz ano novo! Aqui é o *Thyago* da *ZapVender* Te chamei porque vi que você demonstrou interesse em proteger seu veículo. Ainda está interessado?'
        },
        {
            id: 3,
            nome: 'Desconto',
            mensagem: 'Oi {{nome}}! *PROMOÇÃO ESPECIAL* só essa semana! Proteção veicular com *50% de desconto* na adesão. Quer saber mais?'
        }
    ],
    
    contatos: [],
    messages: []
};

// ============================================
// UTILITÁRIOS GERAIS
// ============================================

function fixMojibakeText(value: string): string {
    if (!value || typeof value !== 'string') return value;
    
    // Padrões comuns de texto corrompido (UTF-8 lido como latin1/windows-1252)
    const suspiciousPattern = /(Ã.|Â.|â.|�)/;
    if (!suspiciousPattern.test(value)) return value;

    try {
        const bytes = new Uint8Array(value.length);
        for (let i = 0; i < value.length; i++) {
            bytes[i] = value.charCodeAt(i) & 0xFF;
        }

        const decoded = new TextDecoder('utf-8').decode(bytes);

        // Evita substituir por resultado pior
        if (!decoded || decoded.includes('\uFFFD')) {
            return value;
        }

        return decoded;
    } catch {
        return value;
    }
}

const Utils: UtilsType = {
    formatPhoneDisplay: (phone) => {
        if (!phone) return '';
        
        const cleaned = phone.replace(/[^0-9]/g, '');
        
        if (cleaned.length === 13) {
            return `+${cleaned.slice(0,2)} (${cleaned.slice(2,4)}) ${cleaned.slice(4,9)}-${cleaned.slice(9)}`;
        }
        
        if (cleaned.length === 11) {
            return `(${cleaned.slice(0,2)}) ${cleaned.slice(2,7)}-${cleaned.slice(7)}`;
        }
        
        return phone;
    },
    
    formatPhoneNumber: (phone) => {
        let cleaned = phone.replace(/[^0-9]/g, '');
        
        if (!cleaned.startsWith(CONFIG.COUNTRY_CODE)) {
            cleaned = CONFIG.COUNTRY_CODE + cleaned;
        }
        
        return cleaned;
    },
    
    formatPhoneToWhatsApp: (phone) => {
        const cleaned = phone.replace(/[^0-9]/g, '');
        if (cleaned.startsWith(CONFIG.COUNTRY_CODE)) {
            return cleaned;
        }
        return CONFIG.COUNTRY_CODE + cleaned;
    },
    
    formatDate: (dateStr) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('pt-BR');
    },
    
    formatDateTime: (dateStr) => {
        const date = new Date(dateStr);
        return date.toLocaleString('pt-BR');
    },

    fixMojibakeText
};

function applyMojibakeFixToDocument() {
    if (typeof document === 'undefined') return;

    const fixTextNode = (node: Text) => {
        const original = node.nodeValue || '';
        const fixed = fixMojibakeText(original);
        if (fixed !== original) {
            node.nodeValue = fixed;
        }
    };

    const scan = (root: Node) => {
        const walker = document.createTreeWalker(
            root,
            NodeFilter.SHOW_TEXT
        );

        let current = walker.nextNode();
        while (current) {
            fixTextNode(current as Text);
            current = walker.nextNode();
        }

        if (root instanceof Element || root instanceof Document) {
            const elements = (root as ParentNode).querySelectorAll
                ? (root as ParentNode).querySelectorAll('*')
                : [];

            elements.forEach((el) => {
                ['placeholder', 'title', 'aria-label'].forEach((attr) => {
                    const value = el.getAttribute(attr);
                    if (!value) return;
                    const fixed = fixMojibakeText(value);
                    if (fixed !== value) {
                        el.setAttribute(attr, fixed);
                    }
                });
            });
        }
    };

    scan(document.body);

    const windowAny = window as Window & { __mojibakeFixObserver?: MutationObserver };
    if (windowAny.__mojibakeFixObserver) return;

    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === Node.TEXT_NODE) {
                    fixTextNode(node as Text);
                } else if (node.nodeType === Node.ELEMENT_NODE) {
                    scan(node);
                }
            });
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    windowAny.__mojibakeFixObserver = observer;
}

console.log(`ZapVender v${CONFIG.VERSION}`);
console.log(`Socket URL: ${CONFIG.SOCKET_URL}`);

const windowAny = window as Window & {
    CONFIG?: Config;
    SAMPLE_DATA?: SampleData;
    Utils?: UtilsType;
};
windowAny.CONFIG = CONFIG;
windowAny.SAMPLE_DATA = SAMPLE_DATA;
windowAny.Utils = Utils;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyMojibakeFixToDocument);
} else {
    applyMojibakeFixToDocument();
}

export {};
