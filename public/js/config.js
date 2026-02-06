/**
 * CONFIGURAÇÕES DO SISTEMA - SELF Proteção Veicular v2.0.0
 * Altere estas configurações conforme seu ambiente
 */

const CONFIG = {
    // URL do servidor WhatsApp (Node.js com Baileys)
    // Em produção no Railway, usa a mesma origem (sem porta específica)
    SOCKET_URL: window.location.origin,
    
    // ID da sessão WhatsApp
    SESSION_ID: 'self_whatsapp_session',
    
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

// Dados iniciais de exemplo (serão substituídos pelo banco de dados)
const INITIAL_LEADS = [
    {
        id: 1,
        data: '04/01/2026, 21:08:17',
        nome: 'Vanderlei Dazilio',
        telefone: '27988117501',
        placa: 'MTD7021',
        veiculo: 'Vectra Elegan. 2.0 MPFI 8V FlexPower Mec (2011)',
        status: 3
    },
    {
        id: 2,
        data: '04/01/2026, 21:08:17',
        nome: 'Dkdkdkdk',
        telefone: '99999999999',
        placa: '-',
        veiculo: 'CITY Sedan EXL 1.5 Flex 16V 4p Aut. (2015)',
        status: 1
    },
    {
        id: 3,
        data: '04/01/2026, 21:08:17',
        nome: 'Izabel Carlinda Alves',
        telefone: '28999560503',
        placa: 'QRE9C41',
        veiculo: 'SANDERO STEPWAY Dynamiq. Flex 1.6 16V 5p (2019)',
        status: 2
    },
    {
        id: 4,
        data: '04/01/2026, 21:08:17',
        nome: 'Oziel',
        telefone: '27996403141',
        placa: 'MTE9813',
        veiculo: 'NXR 150 BROS ESD MIX/FLEX (2010)',
        status: 2
    },
    {
        id: 5,
        data: '04/01/2026, 21:08:17',
        nome: 'Pedro Henrique',
        telefone: '27988242959',
        placa: '-',
        veiculo: 'YS 250 FAZER/ FAZER L. EDITION /BLUEFLEX (2017)',
        status: 2
    },
    {
        id: 6,
        data: '04/01/2026, 21:08:17',
        nome: 'Thiago',
        telefone: '27997622522',
        placa: 'ODC3979',
        veiculo: 'Grand Vitara 2.0 16V 4x2/4x4 5p Aut. (2012)',
        status: 2
    }
];

const INITIAL_TEMPLATES = [
    {
        id: 1,
        nome: 'Boas-vindas',
        mensagem: 'Oi {{nome}}, tudo bem? Aqui é da *SELF Proteção Veicular*! Vi que você tem interesse em proteger seu veículo. Posso te ajudar?'
    },
    {
        id: 2,
        nome: 'Follow-up',
        mensagem: 'Oi {{nome}}, feliz ano novo! Aqui é o *Thyago* da *SELF Proteção Veicular* Te chamei porque vi que você demonstrou interesse em proteger seu veículo. Ainda está interessado?'
    },
    {
        id: 3,
        nome: 'Promoção',
        mensagem: 'Oi {{nome}}! *PROMOÇÃO ESPECIAL* só essa semana! Proteção veicular com *50% de desconto* na adesão. Quer saber mais?'
    }
];

// Funções utilitárias
const Utils = {
    /**
     * Formata número de telefone para exibição
     */
    formatPhoneDisplay: function(phone) {
        const cleaned = phone.replace(/[^0-9]/g, '');
        if (cleaned.length === 11) {
            return `(${cleaned.slice(0,2)}) ${cleaned.slice(2,7)}-${cleaned.slice(7)}`;
        } else if (cleaned.length === 10) {
            return `(${cleaned.slice(0,2)}) ${cleaned.slice(2,6)}-${cleaned.slice(6)}`;
        }
        return phone;
    },
    
    /**
     * Formata número para envio WhatsApp
     */
    formatPhoneWhatsApp: function(phone) {
        let cleaned = phone.replace(/[^0-9]/g, '');
        if (!cleaned.startsWith('55')) {
            cleaned = '55' + cleaned;
        }
        return cleaned;
    },
    
    /**
     * Valida número de telefone brasileiro
     */
    validatePhone: function(phone) {
        const cleaned = phone.replace(/[^0-9]/g, '');
        return cleaned.length >= 10 && cleaned.length <= 13;
    },
    
    /**
     * Formata data atual
     */
    formatDateTime: function() {
        const now = new Date();
        return now.toLocaleString('pt-BR');
    },
    
    /**
     * Gera ID único
     */
    generateId: function() {
        return Date.now() + Math.random().toString(36).substr(2, 9);
    }
};

// Exportar para uso global
window.CONFIG = CONFIG;
window.INITIAL_LEADS = INITIAL_LEADS;
window.INITIAL_TEMPLATES = INITIAL_TEMPLATES;
window.Utils = Utils;

// Log de inicialização
console.log(`SELF Proteção Veicular v${CONFIG.VERSION}`);
console.log(`Socket URL: ${CONFIG.SOCKET_URL}`);
