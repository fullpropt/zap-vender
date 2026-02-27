jest.mock('../server/services/intentClassifierService', () => ({
    classifyKeywordFlowIntent: jest.fn(),
    classifyIntentRoute: jest.fn()
}));

const intentClassifier = require('../server/services/intentClassifierService');
const flowService = require('../server/services/flowService');

describe('FlowService intent routing', () => {
    const execution = { triggerMessageText: '', variables: {} };

    beforeEach(() => {
        intentClassifier.classifyIntentRoute.mockReset();
        intentClassifier.classifyKeywordFlowIntent.mockReset();
        delete process.env.FLOW_INTENT_CLASSIFIER_STRICT;
        delete process.env.FLOW_INTENT_CLASSIFIER_ENABLED;
        delete process.env.GEMINI_API_KEY;
    });

    test('uses local fallback for intent node when semantic returns no_match', async () => {
        intentClassifier.classifyIntentRoute.mockResolvedValue({
            status: 'no_match',
            confidence: 0.99,
            reason: 'mock'
        });

        const node = {
            type: 'intent',
            data: {
                intentRoutes: [
                    { id: 'route-showroom', label: 'showroom', phrases: 'ok obrigado' },
                    { id: 'route-hours', label: 'duvida horario', phrases: 'Qual horario eu posso ir?' }
                ]
            }
        };

        const selected = await flowService.pickTriggerIntentHandle(execution, node, 'Que horas posso ir?');
        expect(selected).toBe('route-hours');
    });

    test('matches horario intent with canonicalized hour token', async () => {
        intentClassifier.classifyIntentRoute.mockResolvedValue(null);

        const node = {
            type: 'intent',
            data: {
                intentRoutes: [
                    { id: 'route-hours', label: 'duvida horario', phrases: 'Qual horario eu posso ir?' }
                ]
            }
        };

        const selected = await flowService.pickTriggerIntentHandle(execution, node, 'Que horas posso ir?');
        expect(selected).toBe('route-hours');
    });

    test('keeps strict behavior for trigger node when semantic returns no_match', async () => {
        process.env.FLOW_INTENT_CLASSIFIER_STRICT = '1';
        process.env.GEMINI_API_KEY = 'mock-key';

        intentClassifier.classifyIntentRoute.mockResolvedValue({
            status: 'no_match',
            confidence: 0.92,
            reason: 'mock'
        });

        const node = {
            type: 'trigger',
            subtype: 'intent',
            data: {
                intentRoutes: [
                    { id: 'route-hours', label: 'duvida horario', phrases: 'Qual horario eu posso ir?' }
                ]
            }
        };

        const selected = await flowService.pickTriggerIntentHandle(execution, node, 'Que horas posso ir?');
        expect(selected).toBeNull();
    });
});
