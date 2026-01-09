/**
 * SELF PROTEÇÃO VEICULAR - Script de Seed
 * Popula o banco de dados com dados iniciais
 */

const bcrypt = require('bcryptjs');
const { getDatabase, run, generateUUID, close } = require('./connection');

async function seed() {
    console.log('🌱 Iniciando seed do banco de dados...');
    
    try {
        const db = getDatabase();
        
        // Criar usuário admin padrão
        const adminPassword = await bcrypt.hash('admin123', 10);
        const adminUuid = generateUUID();
        
        try {
            run(`
                INSERT OR IGNORE INTO users (uuid, name, email, password_hash, role)
                VALUES (?, 'Administrador', 'admin@self.com.br', ?, 'admin')
            `, [adminUuid, adminPassword]);
            console.log('👤 Usuário admin criado');
        } catch (e) {
            console.log('👤 Usuário admin já existe');
        }
        
        // Criar leads de exemplo
        const leads = [
            { phone: '27988117501', name: 'Vanderlei Dazilio', vehicle: 'Vectra Elegan. 2.0 MPFI 8V FlexPower Mec (2011)', plate: 'MTD7021', status: 3 },
            { phone: '28999560503', name: 'Izabel Carlinda Alves', vehicle: 'SANDERO STEPWAY Dynamiq. Flex 1.6 16V 5p (2019)', plate: 'QRE9C41', status: 2 },
            { phone: '27996403141', name: 'Oziel', vehicle: 'NXR 150 BROS ESD MIX/FLEX (2010)', plate: 'MTE9813', status: 2 },
            { phone: '27988242959', name: 'Pedro Henrique', vehicle: 'YS 250 FAZER/ FAZER L. EDITION /BLUEFLEX (2017)', plate: '-', status: 2 },
            { phone: '27997622522', name: 'Thiago', vehicle: 'Grand Vitara 2.0 16V 4x2/4x4 5p Aut. (2012)', plate: 'ODC3979', status: 2 }
        ];
        
        for (const lead of leads) {
            const uuid = generateUUID();
            const jid = `55${lead.phone}@s.whatsapp.net`;
            try {
                run(`
                    INSERT OR IGNORE INTO leads (uuid, phone, phone_formatted, jid, name, vehicle, plate, status, source)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'seed')
                `, [uuid, lead.phone, `(${lead.phone.slice(0,2)}) ${lead.phone.slice(2,7)}-${lead.phone.slice(7)}`, jid, lead.name, lead.vehicle, lead.plate, lead.status]);
            } catch (e) {
                // Ignorar duplicatas
            }
        }
        console.log(`📋 ${leads.length} leads de exemplo criados`);
        
        // Criar templates de mensagem
        const templates = [
            { name: 'Boas-vindas', category: 'welcome', content: 'Oi {{nome}}, tudo bem? 👋 Aqui é da *SELF Proteção Veicular*! Vi que você tem interesse em proteger seu veículo. Posso te ajudar?' },
            { name: 'Follow-up', category: 'followup', content: 'Oi {{nome}}, feliz ano novo! 🎉 Aqui é o *Thyago* da *SELF Proteção Veicular* 🚗 Te chamei porque vi que você demonstrou interesse em proteger seu veículo. Ainda está interessado?' },
            { name: 'Promoção', category: 'promotion', content: 'Oi {{nome}}! 🔥 *PROMOÇÃO ESPECIAL* só essa semana! Proteção veicular com *50% de desconto* na adesão. Quer saber mais?' },
            { name: 'Agradecimento', category: 'thanks', content: 'Olá {{nome}}! 🙏 Muito obrigado pelo seu interesse na SELF Proteção Veicular. Estamos à disposição para qualquer dúvida!' },
            { name: 'Retorno', category: 'callback', content: 'Oi {{nome}}! Vi que você entrou em contato conosco. Desculpe a demora! Como posso ajudar? 😊' }
        ];
        
        for (const template of templates) {
            const uuid = generateUUID();
            try {
                run(`
                    INSERT OR IGNORE INTO templates (uuid, name, category, content, variables)
                    VALUES (?, ?, ?, ?, '["nome", "veiculo", "placa"]')
                `, [uuid, template.name, template.category, template.content]);
            } catch (e) {
                // Ignorar duplicatas
            }
        }
        console.log(`📝 ${templates.length} templates criados`);
        
        // Criar tags padrão
        const tags = [
            { name: 'Novo', color: '#10b981' },
            { name: 'Em Negociação', color: '#3b82f6' },
            { name: 'Fechado', color: '#8b5cf6' },
            { name: 'Perdido', color: '#ef4444' },
            { name: 'VIP', color: '#f59e0b' },
            { name: 'Retorno', color: '#06b6d4' }
        ];
        
        for (const tag of tags) {
            try {
                run(`
                    INSERT OR IGNORE INTO tags (name, color)
                    VALUES (?, ?)
                `, [tag.name, tag.color]);
            } catch (e) {
                // Ignorar duplicatas
            }
        }
        console.log(`🏷️  ${tags.length} tags criadas`);
        
        // Criar fluxo de boas-vindas padrão
        const welcomeFlowUuid = generateUUID();
        const welcomeFlowNodes = JSON.stringify([
            {
                id: 'start',
                type: 'trigger',
                position: { x: 100, y: 100 },
                data: { label: 'Novo Contato' }
            },
            {
                id: 'welcome_msg',
                type: 'message',
                position: { x: 100, y: 200 },
                data: { 
                    label: 'Mensagem de Boas-vindas',
                    content: 'Olá! 👋 Bem-vindo à SELF Proteção Veicular!\n\nComo posso ajudar você hoje?\n\n1️⃣ Quero uma cotação\n2️⃣ Já sou cliente\n3️⃣ Falar com atendente'
                }
            },
            {
                id: 'wait_response',
                type: 'wait',
                position: { x: 100, y: 300 },
                data: { label: 'Aguardar Resposta', timeout: 300 }
            },
            {
                id: 'condition',
                type: 'condition',
                position: { x: 100, y: 400 },
                data: { 
                    label: 'Verificar Opção',
                    conditions: [
                        { value: '1', next: 'cotacao' },
                        { value: '2', next: 'cliente' },
                        { value: '3', next: 'atendente' }
                    ]
                }
            },
            {
                id: 'cotacao',
                type: 'message',
                position: { x: -100, y: 500 },
                data: { 
                    label: 'Cotação',
                    content: 'Ótimo! Para fazer uma cotação, preciso de algumas informações:\n\n📋 Qual é o modelo do seu veículo?'
                }
            },
            {
                id: 'cliente',
                type: 'message',
                position: { x: 100, y: 500 },
                data: { 
                    label: 'Cliente',
                    content: 'Que bom ter você de volta! 😊\n\nPor favor, informe seu CPF ou placa do veículo para eu localizar seu cadastro.'
                }
            },
            {
                id: 'atendente',
                type: 'transfer',
                position: { x: 300, y: 500 },
                data: { 
                    label: 'Transferir para Atendente',
                    message: 'Certo! Vou transferir você para um de nossos atendentes. Aguarde um momento... 🙏'
                }
            }
        ]);
        
        const welcomeFlowEdges = JSON.stringify([
            { source: 'start', target: 'welcome_msg' },
            { source: 'welcome_msg', target: 'wait_response' },
            { source: 'wait_response', target: 'condition' },
            { source: 'condition', target: 'cotacao', label: '1' },
            { source: 'condition', target: 'cliente', label: '2' },
            { source: 'condition', target: 'atendente', label: '3' }
        ]);
        
        try {
            run(`
                INSERT OR IGNORE INTO flows (uuid, name, description, trigger_type, trigger_value, nodes, edges, is_active, priority)
                VALUES (?, 'Fluxo de Boas-vindas', 'Fluxo automático para novos contatos', 'new_contact', null, ?, ?, 1, 100)
            `, [welcomeFlowUuid, welcomeFlowNodes, welcomeFlowEdges]);
            console.log('🔄 Fluxo de boas-vindas criado');
        } catch (e) {
            console.log('🔄 Fluxo de boas-vindas já existe');
        }
        
        console.log('✅ Seed concluído com sucesso!');
        
    } catch (error) {
        console.error('❌ Erro no seed:', error.message);
        process.exit(1);
    } finally {
        close();
    }
}

// Executar se chamado diretamente
if (require.main === module) {
    seed();
}

module.exports = { seed };
