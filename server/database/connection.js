/**
 * SELF PROTECAO VEICULAR - Conexao com Banco de Dados
 * Modo Postgres-only
 */

let pool = null;
let PostgresPool = null;

const USE_POSTGRES = true;
const DB_PATH = null;

function getPostgresPool() {
    if (PostgresPool) return PostgresPool;
    try {
        PostgresPool = require('pg').Pool;
        return PostgresPool;
    } catch (error) {
        throw new Error('pg nao esta disponivel. Instale a dependencia para usar Postgres.');
    }
}

/**
 * Inicializar conexao com o banco de dados
 */
function getDatabase() {
    if (pool) return pool;

    if (!process.env.DATABASE_URL) {
        throw new Error('DATABASE_URL e obrigatoria (modo Postgres-only).');
    }

    const Pool = getPostgresPool();
    pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV == 'production'
            ? { rejectUnauthorized: false }
            : false
    });

    console.log('?? Banco de dados conectado: Postgres');
    return pool;
}

function normalizeParams(sql, params) {
    let index = 0;
    const converted = sql.replace(/\?/g, () => `$${++index}`);
    return { sql: converted, params };
}

/**
 * Executar query com parametros
 */
async function query(sql, params = []) {
    const database = getDatabase();
    const normalized = normalizeParams(sql, params);
    const result = await database.query(normalized.sql, normalized.params);
    return result.rows;
}

/**
 * Executar query que retorna uma unica linha
 */
async function queryOne(sql, params = []) {
    const database = getDatabase();
    const normalized = normalizeParams(sql, params);
    const result = await database.query(normalized.sql, normalized.params);
    return result.rows[0] || null;
}

/**
 * Executar INSERT/UPDATE/DELETE
 */
async function run(sql, params = []) {
    const database = getDatabase();
    const normalized = normalizeParams(sql, params);
    let statement = normalized.sql;

    if (statement.trim().endsWith(';')) {
        statement = statement.replace(/;\s*$/, '');
    }

    if (/^\s*insert\s+/i.test(statement) && !/returning\s+/i.test(statement)) {
        statement = `${statement} RETURNING id`;
    }

    const result = await database.query(statement, normalized.params);
    return {
        lastInsertRowid: result.rows[0]?.id ?? null,
        changes: result.rowCount
    };
}

/**
 * Executar multiplas queries em uma transacao
 */
async function transaction(callback) {
    const database = getDatabase();
    const client = await database.connect();

    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

/**
 * Fechar conexao
 */
async function close() {
    if (pool) {
        await pool.end();
        pool = null;
        console.log('?? Conexao com banco de dados fechada');
    }
}

/**
 * Verificar se tabela existe
 */
async function tableExists(tableName) {
    const result = await queryOne(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ?",
        [tableName]
    );
    return !!result;
}

/**
 * Gerar UUID v4
 */
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

module.exports = {
    getDatabase,
    query,
    queryOne,
    run,
    transaction,
    close,
    tableExists,
    generateUUID,
    DB_PATH,
    USE_POSTGRES
};
