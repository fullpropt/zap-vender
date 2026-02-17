/**
 * SELF PROTECAO VEICULAR - Script de Migracao
 * Executa o esquema SQL para criar/atualizar tabelas
 */

const fs = require('fs');
const path = require('path');
const { getDatabase, query, run, close } = require('./connection');

async function migrate() {
    console.log('?? Iniciando migracao do banco de dados...');

    try {
        // Valida conexao uma unica vez para evitar dezenas de erros repetidos por statement.
        getDatabase();

        const schemaPath = path.join(__dirname, 'schema.pg.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');

        const cleanedSchema = schema
            .split('\n')
            .map(line => {
                const commentIndex = line.indexOf('--');
                if (commentIndex !== -1) {
                    return line.substring(0, commentIndex);
                }
                return line;
            })
            .join('\n');

        const statements = cleanedSchema
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0);

        let successCount = 0;
        let skipCount = 0;
        let errorCount = 0;

        console.log(`?? Executando ${statements.length} statements...`);

        for (const statement of statements) {
            try {
                await run(statement, []);
                successCount++;

                if (statement.toUpperCase().includes('CREATE TABLE')) {
                    const match = statement.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)/i);
                    if (match) {
                        console.log(`   ? Tabela ${match[1]} criada`);
                    }
                }
            } catch (error) {
                const msg = String(error.message || error);
                if (
                    msg.includes('already exists') ||
                    msg.includes('UNIQUE constraint') ||
                    msg.includes('duplicate key') ||
                    msg.toLowerCase().includes('duplicate column')
                ) {
                    skipCount++;
                } else {
                    console.error(`   ? Erro: ${msg}`);
                    console.error(`     Statement: ${statement.substring(0, 100)}...`);
                    errorCount++;
                }
            }
        }

        console.log('');
        console.log('? Migracao concluida!');
        console.log(`   - Executados: ${successCount}`);
        console.log(`   - Ignorados (ja existem): ${skipCount}`);
        if (errorCount > 0) {
            console.log(`   - Erros: ${errorCount}`);
        }

        const tables = await query(
            "SELECT table_name as name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
        );
        console.log('');
        console.log(`?? Tabelas no banco de dados (${tables.length}):`);
        tables.forEach(t => console.log(`   - ${t.name}`));

        return true;
    } catch (error) {
        console.error('? Erro fatal na migracao:', error.message);
        return false;
    } finally {
        await close();
    }
}

if (require.main === module) {
    migrate().then(success => process.exit(success ? 0 : 1));
}

module.exports = { migrate };
