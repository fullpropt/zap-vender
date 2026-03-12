const {
    PLAN_DEFINITIONS,
    getPlanDefinition,
    normalizePlanCode
} = require('../server/services/planLimitsService');

describe('PlanLimitsService', () => {
    test('normaliza codigos de plano conhecidos', () => {
        expect(normalizePlanCode('starter')).toBe('starter');
        expect(normalizePlanCode('Premium')).toBe('premium');
        expect(normalizePlanCode('Avancado')).toBe('advanced');
        expect(normalizePlanCode('avancado')).toBe('advanced');
        expect(normalizePlanCode('Monster')).toBe('monster');
    });

    test('retorna limites esperados por plano', () => {
        expect(getPlanDefinition('starter')).toMatchObject({
            ...PLAN_DEFINITIONS.starter,
            maxWhatsAppSessions: 1,
            maxContacts: 1000
        });
        expect(getPlanDefinition('premium')).toMatchObject({
            ...PLAN_DEFINITIONS.premium,
            maxWhatsAppSessions: 3,
            maxContacts: null
        });
        expect(getPlanDefinition('advanced')).toMatchObject({
            ...PLAN_DEFINITIONS.advanced,
            maxWhatsAppSessions: 5,
            maxContacts: null
        });
        expect(getPlanDefinition('monster')).toMatchObject({
            ...PLAN_DEFINITIONS.monster,
            maxWhatsAppSessions: null,
            maxContacts: null
        });
    });

    test('plano desconhecido nao aplica limite por padrao', () => {
        expect(getPlanDefinition('enterprise')).toEqual(PLAN_DEFINITIONS.unknown);
    });
});
