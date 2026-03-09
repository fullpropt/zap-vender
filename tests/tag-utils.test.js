const {
    normalizeTagKey,
    parseTagList,
    uniqueTagLabels,
    normalizeTagFilterInput,
    leadMatchesTagFilter
} = require('../server/utils/tagUtils');

describe('tagUtils', () => {
    test('parseTagList aceita array JSON em string', () => {
        expect(parseTagList('["VIP","  Cliente Novo  "]')).toEqual(['VIP', 'Cliente Novo']);
    });

    test('parseTagList usa delimitadores legados', () => {
        expect(parseTagList('vip;quente|retorno, lead')).toEqual(['vip', 'quente', 'retorno', 'lead']);
    });

    test('uniqueTagLabels remove duplicados por case e acento', () => {
        expect(uniqueTagLabels(['Agua', 'agua', ' AGUA ', 'Agua com gas'])).toEqual(['Agua', 'Agua com gas']);
    });

    test('normalizeTagKey remove acentos e normaliza caixa', () => {
        expect(normalizeTagKey('  Pro-Medico  ')).toBe('pro-medico');
    });

    test('normalizeTagFilterInput preserva undefined e normaliza vazios', () => {
        expect(normalizeTagFilterInput(undefined)).toBeUndefined();
        expect(normalizeTagFilterInput('')).toBeNull();
    });

    test('normalizeTagFilterInput retorna JSON deduplicado', () => {
        expect(normalizeTagFilterInput('vip;VIP;vip')).toBe(JSON.stringify(['vip']));
    });

    test('leadMatchesTagFilter aceita delimitadores legados em lead e filtro', () => {
        expect(leadMatchesTagFilter('vip;quente|retorno', 'retorno')).toBe(true);
        expect(leadMatchesTagFilter('vip;quente|retorno', 'frio')).toBe(false);
    });

    test('leadMatchesTagFilter ignora caixa e acento no matching', () => {
        expect(leadMatchesTagFilter('["Pro-Medico"]', 'pro-medico')).toBe(true);
        expect(leadMatchesTagFilter('["cliente novo"]', 'Cliente Novo')).toBe(true);
    });

    test('leadMatchesTagFilter retorna true quando filtro vazio', () => {
        expect(leadMatchesTagFilter('vip', '')).toBe(true);
        expect(leadMatchesTagFilter('', '')).toBe(true);
    });
});
