/**
 * SELF PROTEÇÃO VEICULAR - Script de Migração
 * Executa o esquema SQL para criar/atualizar tabelas
 */

const fs = require('fs');
const path = require('path');
const { getDatabase, close } = require('./connection');

async function migrate() {
    console.log('🔄 Iniciando migração do banco de dados...');
    
    try {
        const db = getDatabase();
        
        // Ler arquivo de esquema
        const schemaPath = path.join(__dirname, 'schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');
        
        // Dividir em statements individuais
        const statements = schema
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--'));
        
        // Executar cada statement
        let successCount = 0;
        let errorCount = 0;
        
        for (const statement of statements) {
            try {
                db.exec(statement + ';');
                successCount++;
            } catch (error) {
                // Ignorar erros de "já existe"
                if (!error.message.includes('already exists')) {
                    console.error(`⚠️  Erro em statement: ${error.message}`);
                    errorCount++;
                }
            }
        }
        
        console.log(`✅ Migração concluída: ${successCount} statements executados`);
        if (errorCount > 0) {
            console.log(`⚠️  ${errorCount} erros (podem ser ignorados se tabelas já existem)`);
        }
        
        // Verificar tabelas criadas
        const tables = db.prepare(`
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name NOT LIKE 'sqlite_%'
            ORDER BY name
        `).all();
        
        console.log(`📋 Tabelas no banco de dados: ${tables.map(t => t.name).join(', ')}`);
        
    } catch (error) {
        console.error('❌ Erro na migração:', error.message);
        process.exit(1);
    } finally {
        close();
    }
}

// Executar se chamado diretamente
if (require.main === module) {
    migrate();
}

module.exports = { migrate };
