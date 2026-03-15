jest.mock('../server/database/models', () => ({
    Flow: {},
    Lead: {
        update: jest.fn()
    },
    Conversation: {},
    Message: {},
    CustomEvent: {}
}));

jest.mock('../server/database/connection', () => ({
    run: jest.fn(),
    queryOne: jest.fn(),
    generateUUID: jest.fn(() => 'test-uuid')
}));

jest.mock('../server/services/intentClassifierService', () => ({
    classifyKeywordFlowIntent: jest.fn(),
    classifyIntentRoute: jest.fn()
}));

const { FlowService } = require('../server/services/flowService');
const { Lead } = require('../server/database/models');

describe('FlowService executeLeadStatusAction', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('updates lead status when payload status is valid', async () => {
        const flowService = new FlowService();
        const execution = {
            lead: {
                id: 10,
                status: 1
            }
        };

        await flowService.executeLeadStatusAction(execution, { status: 3 });

        expect(Lead.update).toHaveBeenCalledTimes(1);
        expect(Lead.update).toHaveBeenCalledWith(10, { status: 3 });
        expect(execution.lead.status).toBe(3);
    });

    test('ignores update when payload status is invalid', async () => {
        const flowService = new FlowService();
        const execution = {
            lead: {
                id: 10,
                status: 2
            }
        };

        await flowService.executeLeadStatusAction(execution, { status: 8 });

        expect(Lead.update).not.toHaveBeenCalled();
        expect(execution.lead.status).toBe(2);
    });
});
