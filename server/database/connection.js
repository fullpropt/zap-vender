/**
 * SELF PROTECAO VEICULAR - Conexao com Banco de Dados
 * Suporte a SQLite (local) e Postgres (producao)
 */

const path = require('path');
const fs = require('fs');

// Diretorio de dados
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data');

// Garantir que o diretorio existe
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Caminho do banco de dados (SQLite)
const DB_PATH = process.env.DATABASE_PATH || path.join(DATA_DIR, 'self.db');

const DB_DRIVER = (process.env.DB_DRIVER || '').toLowerCase();
const USE_POSTGRES = !!process.env.DATABASE_URL || DB_DRIVER === 'postgres';

// Instancia do banco de dados
let db = null;
let pool = null;
let SQLiteDatabase = null;
let PostgresPool = null;

function getSQLiteDriver() {
    if (SQLiteDatabase) return SQLiteDatabase;
    try {
        SQLiteDatabase = require('better-sqlite3');
        return SQLiteDatabase;
    } catch (error) {
        throw new Error('better-sqlite3 nao esta disponivel. Instale a dependencia ou configure DATABASE_URL para usar Postgres.');
    }
}

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
    if (USE_POSTGRES) {
        if (pool) return pool;
        if (!process.env.DATABASE_URL) {
            throw new Error('DATABASE_URL e obrigatoria quando DB_DRIVER=postgres');
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

    if (db) return db;

    try {
        const Database = getSQLiteDriver();
        db = new Database(DB_PATH, {
            verbose: process.env.NODE_ENV == 'development' ? console.log : null
        });

        // Configuracoes de performance
        db.pragma('journal_mode = WAL');
        db.pragma('synchronous = NORMAL');
        db.pragma('cache_size = 10000');
        db.pragma('temp_store = MEMORY');
        db.pragma('foreign_keys = ON');

        console.log(`?? Banco de dados conectado: ${DB_PATH}`);

        return db;
    } catch (error) {
        console.error('? Erro ao conectar ao banco de dados:', error.message);
        throw error;
    }
}

function normalizeParams(sql, params) {
    if (!USE_POSTGRES) return { sql, params };
    let index = 0;
    const converted = sql.replace(/\?/g, () => `$${++index}`);
    return { sql: converted, params };
}

/**
 * Executar query com parametros
 */
async function query(sql, params = []) {
    const database = getDatabase();
    if (USE_POSTGRES) {
        const normalized = normalizeParams(sql, params);
        const result = await database.query(normalized.sql, normalized.params);
        return result.rows;
    }
    return database.prepare(sql).all(...params);
}

/**
 * Executar query que retorna uma unica linha
 */
async function queryOne(sql, params = []) {
    const database = getDatabase();
    if (USE_POSTGRES) {
        const normalized = normalizeParams(sql, params);
        const result = await database.query(normalized.sql, normalized.params);
        return result.rows[0] || null;
    }
    return database.prepare(sql).get(...params);
}

/**
 * Executar INSERT/UPDATE/DELETE
 */
async function run(sql, params = []) {
    const database = getDatabase();
    if (USE_POSTGRES) {
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
    return database.prepare(sql).run(...params);
}

/**
 * Executar multiplas queries em uma transacao
 */
async function transaction(callback) {
    const database = getDatabase();
    if (!USE_POSTGRES) {
        return database.transaction(callback)();
    }
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
    if (USE_POSTGRES && pool) {
        await pool.end();
        pool = null;
        console.log('?? Conexao com banco de dados fechada');
        return;
    }
    if (db) {
        db.close();
        db = null;
        console.log('?? Conexao com banco de dados fechada');
    }
}

/**
 * Verificar se tabela existe
 */
async function tableExists(tableName) {
    if (USE_POSTGRES) {
        const result = await queryOne(
            "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ?",
            [tableName]
        );
        return !!result;
    }
    const result = await queryOne(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
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
