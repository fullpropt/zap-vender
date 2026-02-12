/**
 * SELF PROTECAO VEICULAR - Script de Seed
 * Popula o banco de dados com dados iniciais
 */

const bcrypt = require('bcryptjs');
const { getDatabase, run, generateUUID, close } = require('./connection');

async function seed() {
    console.log('?? Iniciando seed do banco de dados...');

    try {
        getDatabase();

        // Criar usuario admin padrao
        const adminPassword = await bcrypt.hash('admin123', 10);
        const adminUuid = generateUUID();

        try {
            await run(
                `INSERT INTO users (uuid, name, email, password_hash, role)
                 VALUES (?, 'Administrador', 'admin@self.com.br', ?, 'admin')`,
                [adminUuid, adminPassword]
            );
            console.log('?? Usuario admin criado');
        } catch (e) {
            const msg = String(e.message || e);
            if (msg.includes('UNIQUE') || msg.includes('duplicate')) {
                console.log('?? Usuario admin ja existe');
            } else {
                throw e;
            }
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
                await run(
                    `INSERT INTO leads (uuid, phone, phone_formatted, jid, name, vehicle, plate, status, source)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'seed')`,
                    [
                        uuid,
                        lead.phone,
                        `(${lead.phone.slice(0, 2)}) ${lead.phone.slice(2, 7)}-${lead.phone.slice(7)}`,
                        jid,
                        lead.name,
                        lead.vehicle,
                        lead.plate,
                        lead.status
                    ]
                );
            } catch (e) {
                const msg = String(e.message || e);
                if (!msg.includes('UNIQUE') && !msg.includes('duplicate')) {
                    throw e;
                }
            }
        }
        console.log(`?? ${leads.length} leads de exemplo criados`);

        // Criar templates de mensagem
        const templates = [
            { name: 'Boas-vindas', category: 'welcome', content: 'Oi {{nome}}, tudo bem? ?? Aqui e da *ZapVender*! Vi que voce tem interesse em proteger seu veiculo. Posso te ajudar?' },
            { name: 'Follow-up', category: 'followup', content: 'Oi {{nome}}, feliz ano novo! ?? Aqui e o *Thyago* da *ZapVender* ?? Te chamei porque vi que voce demonstrou interesse em proteger seu veiculo. Ainda esta interessado?' },
            { name: 'Promocao', category: 'promotion', content: 'Oi {{nome}}! ?? *PROMOCAO ESPECIAL* so essa semana! Protecao veicular com *50% de desconto* na adesao. Quer saber mais?' },
            { name: 'Agradecimento', category: 'thanks', content: 'Ola {{nome}}! ?? Muito obrigado pelo seu interesse na ZapVender. Estamos a disposicao para qualquer duvida!' },
            { name: 'Retorno', category: 'callback', content: 'Oi {{nome}}! Vi que voce entrou em contato conosco. Desculpe a demora! Como posso ajudar? ??' }
        ];

        for (const template of templates) {
            const uuid = generateUUID();
            try {
                await run(
                    `INSERT INTO templates (uuid, name, category, content, variables)
                     VALUES (?, ?, ?, ?, '["nome", "veiculo", "placa"]')`,
                    [uuid, template.name, template.category, template.content]
                );
            } catch (e) {
                const msg = String(e.message || e);
                if (!msg.includes('UNIQUE') && !msg.includes('duplicate')) {
                    throw e;
                }
            }
        }
        console.log(`?? ${templates.length} templates criados`);

        // Criar tags padrao
        const tags = [
            { name: 'Novo', color: '#10b981' },
            { name: 'Em Negociacao', color: '#3b82f6' },
            { name: 'Fechado', color: '#8b5cf6' },
            { name: 'Perdido', color: '#ef4444' },
            { name: 'VIP', color: '#f59e0b' },
            { name: 'Retorno', color: '#06b6d4' }
        ];

        for (const tag of tags) {
            try {
                await run(
                    `INSERT INTO tags (name, color)
                     VALUES (?, ?)`,
                    [tag.name, tag.color]
                );
            } catch (e) {
                const msg = String(e.message || e);
                if (!msg.includes('UNIQUE') && !msg.includes('duplicate')) {
                    throw e;
                }
            }
        }
        console.log(`???  ${tags.length} tags criadas`);

        console.log('? Seed concluido com sucesso!');

    } catch (error) {
        console.error('? Erro no seed:', error.message);
        process.exit(1);
    } finally {
        await close();
    }
}

if (require.main === module) {
    seed();
}

module.exports = { seed };
