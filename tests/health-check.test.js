describe('healthCheck.checkWhatsAppSessions', () => {
    beforeEach(() => {
        jest.resetModules();
    });

    test('contabiliza sessoes quando runtime usa Map', () => {
        const mockSessions = new Map([
            ['session-a', { isConnected: true, status: 'connected' }],
            ['session-b', { isConnected: false, status: 'disconnected' }]
        ]);

        jest.doMock('../server/services/whatsapp', () => ({
            sessions: mockSessions
        }));

        const { checkWhatsAppSessions } = require('../server/utils/healthCheck');
        const result = checkWhatsAppSessions();

        expect(result.status).toBe('healthy');
        expect(result.totalSessions).toBe(2);
        expect(result.connectedSessions).toBe(1);
        expect(result.sessions).toEqual([
            { id: 'session-a', connected: true, status: 'connected' },
            { id: 'session-b', connected: false, status: 'disconnected' }
        ]);
    });

    test('retorna degraded quando modulo whatsapp falha', () => {
        jest.doMock('../server/services/whatsapp', () => {
            throw new Error('mock failure');
        });

        const { checkWhatsAppSessions } = require('../server/utils/healthCheck');
        const result = checkWhatsAppSessions();

        expect(result.status).toBe('degraded');
        expect(result.message).toBe('Erro ao verificar sessoes WhatsApp');
        expect(result.error).toMatch(/mock failure/);
    });
});
