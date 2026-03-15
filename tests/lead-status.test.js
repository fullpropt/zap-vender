const {
    LEAD_STATUS_VALUES,
    normalizeLeadStatus,
    isLeadStatusValid,
    getLeadStatusLabel
} = require('../server/utils/leadStatus');

describe('leadStatus utils', () => {
    test('normalizes valid lead statuses', () => {
        expect(normalizeLeadStatus(1, null)).toBe(1);
        expect(normalizeLeadStatus('2', null)).toBe(2);
        expect(normalizeLeadStatus(3, null)).toBe(3);
        expect(normalizeLeadStatus('4', null)).toBe(4);
    });

    test('rejects invalid lead statuses', () => {
        expect(normalizeLeadStatus(0, null)).toBeNull();
        expect(normalizeLeadStatus(5, null)).toBeNull();
        expect(normalizeLeadStatus(-1, null)).toBeNull();
        expect(normalizeLeadStatus('abc', null)).toBeNull();
        expect(normalizeLeadStatus(2.5, null)).toBeNull();
    });

    test('returns fallback for invalid values', () => {
        expect(normalizeLeadStatus('x', 1)).toBe(1);
        expect(normalizeLeadStatus(undefined, 2)).toBe(2);
        expect(normalizeLeadStatus(8, 4)).toBe(4);
    });

    test('validates status membership', () => {
        for (const value of LEAD_STATUS_VALUES) {
            expect(isLeadStatusValid(value)).toBe(true);
        }
        expect(isLeadStatusValid(6)).toBe(false);
    });

    test('provides stage labels', () => {
        expect(getLeadStatusLabel(1, '')).toBe('Novo');
        expect(getLeadStatusLabel(2, '')).toBe('Em Andamento');
        expect(getLeadStatusLabel(3, '')).toBe('Concluido');
        expect(getLeadStatusLabel(4, '')).toBe('Perdido');
        expect(getLeadStatusLabel(5, 'fallback')).toBe('fallback');
    });
});
