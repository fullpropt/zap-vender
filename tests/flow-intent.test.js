jest.mock('../server/services/intentClassifierService', () => ({
    classifyKeywordFlowIntent: jest.fn(),
    classifyIntentRoute: jest.fn()
}));

const intentClassifier = require('../server/services/intentClassifierService');
const flowService = require('../server/services/flowService');
const { FlowService } = require('../server/services/flowService');
const { Lead, Flow } = require('../server/database/models');

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

describe('FlowService intent routing compatibility', () => {
    test('continueFlow treats trigger keyword node as intent routing node', async () => {
        const service = new FlowService();
        const node = {
            id: 'trigger-mid',
            type: 'trigger',
            subtype: 'keyword',
            data: {
                intentRoutes: [
                    { id: 'route-buy', label: 'Comprar', phrases: 'comprar' }
                ]
            }
        };

        const execution = {
            id: 999,
            flow: { id: 1, nodes: [node], edges: [] },
            conversation: { id: 11 },
            currentNode: 'trigger-mid',
            variables: {}
        };

        const pickSpy = jest.spyOn(service, 'pickTriggerIntentHandle').mockResolvedValue('route-buy');
        const goToNextSpy = jest.spyOn(service, 'goToNextNode').mockResolvedValue();

        await service.continueFlow(execution, { text: 'comprar agora' });

        expect(pickSpy).toHaveBeenCalledWith(execution, node, 'comprar agora');
        expect(goToNextSpy).toHaveBeenCalledWith(execution, node, 'route-buy');

        pickSpy.mockRestore();
        goToNextSpy.mockRestore();
    });

    test('goToNextNode on intent envia segunda mensagem opcional apos a primeira', async () => {
        const service = new FlowService();
        const sendMock = jest.fn().mockResolvedValue();
        service.init(sendMock);

        const intentNode = {
            id: 'intent-mid',
            type: 'intent',
            data: {
                intentRoutes: [
                    {
                        id: 'route-store',
                        label: 'Loja Fisica',
                        phrases: 'loja fisica, showroom',
                        response: 'Temos um showroom em Cocal.',
                        followupResponse: 'Quer que eu te envie o endereco completo?'
                    }
                ],
                intentResponseDelaySeconds: 0
            }
        };

        const execution = {
            flow: {
                id: 37,
                nodes: [intentNode],
                edges: [
                    { source: 'intent-mid', target: 'next-node', sourceHandle: 'route-store', targetHandle: 'default' }
                ]
            },
            conversation: { id: 54, session_id: 'session-1' },
            lead: { id: 25, phone: '5511966666666', jid: '5511966666666@s.whatsapp.net' },
            variables: {}
        };

        const executeSpy = jest.spyOn(service, 'executeNode').mockResolvedValue();

        await service.goToNextNode(execution, intentNode, 'route-store');

        expect(sendMock).toHaveBeenCalledTimes(2);
        expect(sendMock.mock.calls[0][0].content).toBe('Temos um showroom em Cocal.');
        expect(sendMock.mock.calls[1][0].content).toBe('Quer que eu te envie o endereco completo?');
        expect(executeSpy).toHaveBeenCalledWith(execution, 'next-node', 'default');

        executeSpy.mockRestore();
    });

    test('goToNextNode on intent envia varias mensagens extras configuradas em lista', async () => {
        const service = new FlowService();
        const sendMock = jest.fn().mockResolvedValue();
        service.init(sendMock);

        const intentNode = {
            id: 'intent-mid',
            type: 'intent',
            data: {
                intentRoutes: [
                    {
                        id: 'route-store',
                        label: 'Loja Fisica',
                        phrases: 'loja fisica, showroom',
                        response: 'Temos um showroom em Cocal.',
                        followupResponses: [
                            'Quer que eu te envie o endereco completo?',
                            'Posso te mandar a localizacao agora.'
                        ]
                    }
                ],
                intentResponseDelaySeconds: 0
            }
        };

        const execution = {
            flow: {
                id: 38,
                nodes: [intentNode],
                edges: [
                    { source: 'intent-mid', target: 'next-node', sourceHandle: 'route-store', targetHandle: 'default' }
                ]
            },
            conversation: { id: 55, session_id: 'session-1' },
            lead: { id: 26, phone: '5511966666666', jid: '5511966666666@s.whatsapp.net' },
            variables: {}
        };

        const executeSpy = jest.spyOn(service, 'executeNode').mockResolvedValue();

        await service.goToNextNode(execution, intentNode, 'route-store');

        expect(sendMock).toHaveBeenCalledTimes(3);
        expect(sendMock.mock.calls[0][0].content).toBe('Temos um showroom em Cocal.');
        expect(sendMock.mock.calls[1][0].content).toBe('Quer que eu te envie o endereco completo?');
        expect(sendMock.mock.calls[2][0].content).toBe('Posso te mandar a localizacao agora.');
        expect(executeSpy).toHaveBeenCalledWith(execution, 'next-node', 'default');

        executeSpy.mockRestore();
    });

        test('goToNextNode on intent envia resposta configurada com delay unico', async () => {
        const service = new FlowService();
        const sendMock = jest.fn().mockResolvedValue();
        service.init(sendMock);

        const intentNode = {
            id: 'intent-mid',
            type: 'intent',
            data: {
                intentRoutes: [
                    { id: 'route-hours', label: 'Horarios', phrases: 'horario, funcionamento', response: 'Nosso horario e de 8h as 18h, {{nome}}.' }
                ],
                intentResponseDelaySeconds: 2
            }
        };

        const execution = {
            id: 111,
            flow: {
                id: 33,
                nodes: [intentNode],
                edges: [
                    { source: 'intent-mid', target: 'next-node', sourceHandle: 'route-hours', targetHandle: 'default' }
                ]
            },
            conversation: { id: 51, session_id: 'session-1' },
            lead: { id: 22, phone: '5511999999999', jid: '5511999999999@s.whatsapp.net' },
            currentNode: 'intent-mid',
            variables: { nome: 'Carlos' }
        };

        const delaySpy = jest.spyOn(service, 'delay').mockResolvedValue();
        const executeSpy = jest.spyOn(service, 'executeNode').mockResolvedValue();

        await service.goToNextNode(execution, intentNode, 'route-hours');

        expect(delaySpy).toHaveBeenCalledWith(2000);
        expect(sendMock).toHaveBeenCalledWith(expect.objectContaining({
            content: 'Nosso horario e de 8h as 18h, Carlos.'
        }));
        expect(executeSpy).toHaveBeenCalledWith(execution, 'next-node', 'default');
        expect(sendMock.mock.invocationCallOrder[0]).toBeLessThan(executeSpy.mock.invocationCallOrder[0]);

        delaySpy.mockRestore();
        executeSpy.mockRestore();
    });

    test('goToNextNode on intent usa resposta default quando nao houver match', async () => {
        const service = new FlowService();
        const sendMock = jest.fn().mockResolvedValue();
        service.init(sendMock);

        const intentNode = {
            id: 'intent-mid',
            type: 'intent',
            data: {
                intentRoutes: [
                    { id: 'route-buy', label: 'Comprar', phrases: 'comprar', response: 'Vamos falar de compra.' }
                ],
                intentDefaultResponse: 'Nao entendi, pode me explicar melhor?'
            }
        };

        const execution = {
            flow: {
                id: 34,
                nodes: [intentNode],
                edges: [
                    { source: 'intent-mid', target: 'fallback-node', sourceHandle: 'default', targetHandle: 'default' }
                ]
            },
            conversation: { id: 52, session_id: 'session-1' },
            lead: { id: 23, phone: '5511988888888', jid: '5511988888888@s.whatsapp.net' },
            variables: {}
        };

        const executeSpy = jest.spyOn(service, 'executeNode').mockResolvedValue();

        await service.goToNextNode(execution, intentNode, null);

        expect(sendMock).toHaveBeenCalledWith(expect.objectContaining({
            content: 'Nao entendi, pode me explicar melhor?'
        }));
        expect(executeSpy).toHaveBeenCalledWith(execution, 'fallback-node', 'default');

        executeSpy.mockRestore();
    });

    test('goToNextNode on intent envia segunda resposta default opcional', async () => {
        const service = new FlowService();
        const sendMock = jest.fn().mockResolvedValue();
        service.init(sendMock);

        const intentNode = {
            id: 'intent-mid',
            type: 'intent',
            data: {
                intentRoutes: [
                    { id: 'route-buy', label: 'Comprar', phrases: 'comprar', response: 'Vamos falar de compra.' }
                ],
                intentDefaultResponse: 'Nao entendi, pode me explicar melhor?',
                intentDefaultFollowupResponse: 'Se preferir, posso te mostrar as opcoes principais.'
            }
        };

        const execution = {
            flow: {
                id: 36,
                nodes: [intentNode],
                edges: [
                    { source: 'intent-mid', target: 'fallback-node', sourceHandle: 'default', targetHandle: 'default' }
                ]
            },
            conversation: { id: 53, session_id: 'session-1' },
            lead: { id: 24, phone: '5511977777777', jid: '5511977777777@s.whatsapp.net' },
            variables: {}
        };

        const executeSpy = jest.spyOn(service, 'executeNode').mockResolvedValue();

        await service.goToNextNode(execution, intentNode, null);

        expect(sendMock).toHaveBeenCalledTimes(2);
        expect(sendMock.mock.calls[0][0].content).toBe('Nao entendi, pode me explicar melhor?');
        expect(sendMock.mock.calls[1][0].content).toBe('Se preferir, posso te mostrar as opcoes principais.');
        expect(executeSpy).toHaveBeenCalledWith(execution, 'fallback-node', 'default');

        executeSpy.mockRestore();
    });

    test('goToNextNode on intent envia varias respostas extras default configuradas em lista', async () => {
        const service = new FlowService();
        const sendMock = jest.fn().mockResolvedValue();
        service.init(sendMock);

        const intentNode = {
            id: 'intent-mid',
            type: 'intent',
            data: {
                intentRoutes: [
                    { id: 'route-buy', label: 'Comprar', phrases: 'comprar', response: 'Vamos falar de compra.' }
                ],
                intentDefaultResponse: 'Nao entendi, pode me explicar melhor?',
                intentDefaultFollowupResponses: [
                    'Se preferir, posso te mostrar as opcoes principais.',
                    'Tambem posso encaminhar para um atendente.'
                ]
            }
        };

        const execution = {
            flow: {
                id: 39,
                nodes: [intentNode],
                edges: [
                    { source: 'intent-mid', target: 'fallback-node', sourceHandle: 'default', targetHandle: 'default' }
                ]
            },
            conversation: { id: 56, session_id: 'session-1' },
            lead: { id: 27, phone: '5511977777777', jid: '5511977777777@s.whatsapp.net' },
            variables: {}
        };

        const executeSpy = jest.spyOn(service, 'executeNode').mockResolvedValue();

        await service.goToNextNode(execution, intentNode, null);

        expect(sendMock).toHaveBeenCalledTimes(3);
        expect(sendMock.mock.calls[0][0].content).toBe('Nao entendi, pode me explicar melhor?');
        expect(sendMock.mock.calls[1][0].content).toBe('Se preferir, posso te mostrar as opcoes principais.');
        expect(sendMock.mock.calls[2][0].content).toBe('Tambem posso encaminhar para um atendente.');
        expect(executeSpy).toHaveBeenCalledWith(execution, 'fallback-node', 'default');

        executeSpy.mockRestore();
    });

    test('boas vindas do gatilho de intencao respeita comportamento de mensagem unica', async () => {
        const service = new FlowService();
        const sendMock = jest.fn().mockResolvedValue();
        service.init(sendMock);

        const triggerNode = {
            id: 'trigger-intent',
            type: 'trigger',
            subtype: 'intent',
            data: {
                triggerWelcomeEnabled: true,
                triggerWelcomeContent: 'Ola, {{nome}}! Seja bem-vindo.',
                triggerWelcomeDelaySeconds: 1,
                triggerWelcomeRepeatMode: 'always',
                triggerWelcomeRepeatValue: 1
            }
        };

        const execution = {
            flow: { id: 35 },
            conversation: { id: 53, session_id: 'session-1' },
            lead: { id: 24, phone: '5511977777777', jid: '5511977777777@s.whatsapp.net', custom_fields: '{}' },
            variables: { nome: 'Ana' }
        };

        const leadUpdateSpy = jest.spyOn(Lead, 'update').mockResolvedValue({ success: true });
        const delaySpy = jest.spyOn(service, 'delay').mockResolvedValue();

        await service.maybeSendTriggerWelcomeMessage(execution, triggerNode);
        await service.maybeSendTriggerWelcomeMessage(execution, triggerNode);

        expect(delaySpy).toHaveBeenCalledWith(1000);
        expect(sendMock).toHaveBeenCalledTimes(1);
        expect(sendMock).toHaveBeenCalledWith(expect.objectContaining({
            content: 'Ola, Ana! Seja bem-vindo.'
        }));

        leadUpdateSpy.mockRestore();
        delaySpy.mockRestore();
    });

    test('goToNextNode falls back to edge label when sourceHandle is stale', async () => {
        const service = new FlowService();
        const currentNode = {
            id: 'intent-mid',
            type: 'intent',
            data: {
                intentRoutes: [
                    { id: 'route-buy', label: 'Intenção 1', phrases: 'comprar roupa' },
                    { id: 'route-store', label: 'Intenção 2', phrases: 'onde fica a loja' }
                ]
            }
        };

        const execution = {
            flow: {
                id: 11,
                edges: [
                    {
                        source: 'intent-mid',
                        target: 'message-buy',
                        sourceHandle: 'legacy-route-id-a',
                        label: 'Intenção 1'
                    },
                    {
                        source: 'intent-mid',
                        target: 'message-store',
                        sourceHandle: 'legacy-route-id-b',
                        label: 'Intenção 2'
                    }
                ]
            },
            conversation: { id: 77 }
        };

        const executeSpy = jest.spyOn(service, 'executeNode').mockResolvedValue();
        const endSpy = jest.spyOn(service, 'endFlow').mockResolvedValue();

        await service.goToNextNode(execution, currentNode, 'route-buy');

        expect(executeSpy).toHaveBeenCalledWith(execution, 'message-buy', 'default');
        expect(endSpy).not.toHaveBeenCalled();

        executeSpy.mockRestore();
        endSpy.mockRestore();
    });

    test('goToNextNode reuses non-intent entry handle for path-aligned nodes', async () => {
        const service = new FlowService();
        const currentNode = {
            id: 'message-once',
            type: 'message_once',
            data: {}
        };

        const execution = {
            flow: {
                id: 12,
                edges: [
                    { source: 'message-once', target: 'default-next', sourceHandle: 'default', targetHandle: 'default' },
                    { source: 'message-once', target: 'path-two-next', sourceHandle: 'path-2', targetHandle: 'path-2' }
                ]
            },
            conversation: { id: 78 },
            variables: {
                node_entry_handle_by_node: {
                    'message-once': 'path-2'
                }
            }
        };

        const executeSpy = jest.spyOn(service, 'executeNode').mockResolvedValue();
        const endSpy = jest.spyOn(service, 'endFlow').mockResolvedValue();

        await service.goToNextNode(execution, currentNode);

        expect(executeSpy).toHaveBeenCalledWith(execution, 'path-two-next', 'path-2');
        expect(endSpy).not.toHaveBeenCalled();

        executeSpy.mockRestore();
        endSpy.mockRestore();
    });

    test('goToNextNode executes output actions configured for the chosen handle', async () => {
        const service = new FlowService();
        const currentNode = {
            id: 'message-root',
            type: 'message',
            data: {
                outputActions: {
                    'path-2': [
                        { type: 'tag', tag: 'vip' }
                    ]
                }
            }
        };

        const execution = {
            flow: {
                id: 99,
                edges: [
                    { source: 'message-root', target: 'next-node', sourceHandle: 'path-2', targetHandle: 'path-2' }
                ]
            },
            conversation: { id: 79 },
            variables: {
                node_entry_handle_by_node: {
                    'message-root': 'path-2'
                }
            }
        };

        const outputActionsSpy = jest.spyOn(service, 'executeOutputActions').mockResolvedValue();
        const executeSpy = jest.spyOn(service, 'executeNode').mockResolvedValue();

        await service.goToNextNode(execution, currentNode);

        expect(outputActionsSpy).toHaveBeenCalledWith(execution, currentNode, 'path-2');
        expect(executeSpy).toHaveBeenCalledWith(execution, 'next-node', 'path-2');
        expect(outputActionsSpy.mock.invocationCallOrder[0]).toBeLessThan(executeSpy.mock.invocationCallOrder[0]);

        outputActionsSpy.mockRestore();
        executeSpy.mockRestore();
    });

    test('continueFlow on wait node executes output actions for evaluated edge', async () => {
        const service = new FlowService();
        const waitNode = {
            id: 'wait-mid',
            type: 'wait',
            data: {
                timeout: 30,
                outputActions: {
                    default: [
                        { type: 'status', status: 3 }
                    ]
                }
            }
        };
        const nextNode = {
            id: 'next-mid',
            type: 'message',
            data: {}
        };

        const execution = {
            id: 123,
            currentNode: 'wait-mid',
            flow: {
                id: 55,
                nodes: [waitNode, nextNode],
                edges: [
                    { source: 'wait-mid', target: 'next-mid', sourceHandle: 'default', targetHandle: 'default' }
                ]
            },
            conversation: { id: 45 },
            variables: {}
        };

        const outputActionsSpy = jest.spyOn(service, 'executeOutputActions').mockResolvedValue();
        const executeSpy = jest.spyOn(service, 'executeNode').mockResolvedValue();

        await service.continueFlow(execution, { text: 'ok, continue' });

        expect(outputActionsSpy).toHaveBeenCalledWith(execution, waitNode, 'default');
        expect(executeSpy).toHaveBeenCalledWith(execution, 'next-mid', 'default');

        outputActionsSpy.mockRestore();
        executeSpy.mockRestore();
    });

    test('goToNextNode marks trigger default -> message_once edge as intent reentry bridge', async () => {
        const service = new FlowService();
        const currentNode = {
            id: 'trigger-intent',
            type: 'trigger',
            subtype: 'intent',
            data: {
                intentRoutes: [
                    { id: 'route-buy', label: 'Comprar', phrases: 'comprar' }
                ]
            }
        };
        const onceNode = {
            id: 'welcome-once',
            type: 'message',
            data: {
                isOnceMessage: true
            }
        };

        const execution = {
            flow: {
                id: 13,
                nodes: [currentNode, onceNode],
                edges: [
                    { source: 'trigger-intent', target: 'welcome-once', sourceHandle: 'default', targetHandle: 'path-2' }
                ]
            },
            conversation: { id: 80 },
            variables: {}
        };

        const executeSpy = jest.spyOn(service, 'executeNode').mockResolvedValue();

        await service.goToNextNode(execution, currentNode);

        expect(executeSpy).toHaveBeenCalledWith(execution, 'welcome-once', 'path-2');
        expect(execution.variables.intent_default_message_once_reentry).toEqual({
            triggerNodeId: 'trigger-intent',
            messageOnceNodeId: 'welcome-once',
            targetHandle: 'path-2',
            fallbackReady: false
        });

        executeSpy.mockRestore();
    });

    test('goToNextNode clears stale intent reentry bridge on non-bridge edge', async () => {
        const service = new FlowService();
        const currentNode = {
            id: 'trigger-intent',
            type: 'trigger',
            subtype: 'intent',
            data: {
                intentRoutes: [
                    { id: 'route-buy', label: 'Comprar', phrases: 'comprar' }
                ]
            }
        };
        const routeNode = {
            id: 'route-answer',
            type: 'message',
            data: {}
        };

        const execution = {
            flow: {
                id: 14,
                nodes: [currentNode, routeNode],
                edges: [
                    { source: 'trigger-intent', target: 'route-answer', sourceHandle: 'route-buy', targetHandle: 'default' }
                ]
            },
            conversation: { id: 81 },
            variables: {
                intent_default_message_once_reentry: {
                    triggerNodeId: 'old-trigger',
                    messageOnceNodeId: 'old-once',
                    targetHandle: 'default'
                }
            }
        };

        const executeSpy = jest.spyOn(service, 'executeNode').mockResolvedValue();

        await service.goToNextNode(execution, currentNode, 'route-buy');

        expect(executeSpy).toHaveBeenCalledWith(execution, 'route-answer', 'default');
        expect(execution.variables.intent_default_message_once_reentry).toBeUndefined();

        executeSpy.mockRestore();
    });

    test('flow session scope matches only the configured WhatsApp account', () => {
        const service = new FlowService();

        expect(service.flowMatchesConversationSession({ session_id: null }, 'conta_a')).toBe(true);
        expect(service.flowMatchesConversationSession({ session_id: '' }, 'conta_a')).toBe(true);
        expect(service.flowMatchesConversationSession({ session_id: 'conta_a' }, 'conta_a')).toBe(true);
        expect(service.flowMatchesConversationSession({ session_id: 'conta_a' }, 'conta_b')).toBe(false);
        expect(service.flowMatchesConversationSession({ session_id: 'conta_a' }, '')).toBe(false);
    });

    test('processIncomingMessage serializes concurrent messages for the same conversation', async () => {
        const service = new FlowService();
        const execution = {
            id: 701,
            flow: { id: 88, nodes: [], edges: [] },
            conversation: { id: 331 },
            currentNode: 'intent-mid',
            variables: {}
        };
        const lead = { id: 26, phone: '5527996459659' };
        const conversation = { id: 331, session_id: 'momnt', is_bot_active: 1, created: false };

        const resolveExecutionSpy = jest.spyOn(service, 'resolveActiveExecution').mockResolvedValue(execution);
        const order = [];
        let inFlight = 0;
        let maxInFlight = 0;
        const continueSpy = jest.spyOn(service, 'continueFlow').mockImplementation(async (_execution, message) => {
            inFlight += 1;
            maxInFlight = Math.max(maxInFlight, inFlight);
            order.push(`start:${message.text}`);
            await new Promise((resolve) => setTimeout(resolve, 20));
            order.push(`end:${message.text}`);
            inFlight -= 1;
            return execution;
        });

        await Promise.all([
            service.processIncomingMessage({ text: 'Ei' }, lead, conversation),
            service.processIncomingMessage({ text: 'Oi' }, lead, conversation),
            service.processIncomingMessage({ text: 'Boa tarde' }, lead, conversation)
        ]);

        expect(resolveExecutionSpy).toHaveBeenCalledTimes(3);
        expect(continueSpy).toHaveBeenCalledTimes(3);
        expect(maxInFlight).toBe(1);
        expect(order).toEqual([
            'start:Ei',
            'end:Ei',
            'start:Oi',
            'end:Oi',
            'start:Boa tarde',
            'end:Boa tarde'
        ]);

        resolveExecutionSpy.mockRestore();
        continueSpy.mockRestore();
    });

    test('processIncomingMessage starts keyword flow via default->message_once fallback on unmatched greeting', async () => {
        const service = new FlowService();
        const triggerNode = {
            id: 'trigger-intent',
            type: 'trigger',
            subtype: 'intent',
            data: {
                intentRoutes: [
                    { id: 'route-buy', label: 'Comprar', phrases: 'onde compro' }
                ]
            }
        };
        const onceNode = {
            id: 'welcome-once',
            type: 'message_once',
            data: {
                label: 'Mensagem Única',
                content: 'Olá {{nome}}, tudo bem?'
            }
        };
        const flow = {
            id: 77,
            name: 'FAQ',
            trigger_type: 'keyword',
            session_id: 'momnt',
            priority: 10,
            nodes: [triggerNode, onceNode],
            edges: [
                { source: 'trigger-intent', target: 'welcome-once', sourceHandle: 'default', targetHandle: 'default' }
            ]
        };

        const resolveExecutionSpy = jest.spyOn(service, 'resolveActiveExecution').mockResolvedValue(null);
        const keywordSpy = jest.spyOn(Flow, 'findKeywordMatches').mockResolvedValue([]);
        const activeSpy = jest.spyOn(Flow, 'findActiveKeywordFlows').mockResolvedValue([flow]);
        const newContactSpy = jest.spyOn(Flow, 'findByTrigger').mockResolvedValue(null);
        const startFlowSpy = jest.spyOn(service, 'startFlow').mockResolvedValue({ id: 123 });
        intentClassifier.classifyKeywordFlowIntent.mockResolvedValue({ status: 'no_match' });

        const result = await service.processIncomingMessage(
            { text: 'oi' },
            { id: 26, phone: '5527996459659', assigned_to: null },
            { id: 331, session_id: 'momnt', is_bot_active: 1, assigned_to: null, created: false }
        );

        expect(startFlowSpy).toHaveBeenCalledWith(
            flow,
            expect.objectContaining({ id: 26 }),
            expect.objectContaining({ id: 331 }),
            expect.objectContaining({ text: 'oi' })
        );
        expect(result).toEqual({ id: 123 });

        resolveExecutionSpy.mockRestore();
        keywordSpy.mockRestore();
        activeSpy.mockRestore();
        newContactSpy.mockRestore();
        startFlowSpy.mockRestore();
    });

    test('processIncomingMessage starts session-scoped keyword intent flow via catch-all fallback on unmatched greeting', async () => {
        process.env.FLOW_INTENT_CLASSIFIER_STRICT = '1';
        process.env.GEMINI_API_KEY = 'mock-key';

        const service = new FlowService();

        const sessionTriggerNode = {
            id: 'trigger-session',
            type: 'trigger',
            subtype: 'intent',
            data: {
                intentRoutes: [
                    { id: 'route-sport', label: 'Esportivos', phrases: 'gostei dos esportivos' }
                ],
                intentDefaultResponse: 'Desculpa, nao consegui entender',
                triggerWelcomeEnabled: true,
                triggerWelcomeContent: 'Ola, {{nome}}! Tudo bem?'
            }
        };
        const globalTriggerNode = {
            id: 'trigger-global',
            type: 'trigger',
            subtype: 'intent',
            data: {
                intentRoutes: [
                    { id: 'route-global', label: 'Global', phrases: 'onde compro roupa' }
                ],
                intentDefaultResponse: 'Nao entendi'
            }
        };
        const endNode = { id: 'end', type: 'end', data: {} };

        const scopedFlow = {
            id: 101,
            name: 'FAQ MOMNT',
            trigger_type: 'keyword',
            session_id: 'momnt',
            priority: 0,
            nodes: [sessionTriggerNode, endNode],
            edges: [
                { source: 'trigger-session', target: 'end', sourceHandle: 'default', targetHandle: 'default' }
            ]
        };
        const globalFlow = {
            id: 102,
            name: 'FAQ Global',
            trigger_type: 'keyword',
            session_id: null,
            priority: 100,
            nodes: [globalTriggerNode, endNode],
            edges: [
                { source: 'trigger-global', target: 'end', sourceHandle: 'default', targetHandle: 'default' }
            ]
        };

        const resolveExecutionSpy = jest.spyOn(service, 'resolveActiveExecution').mockResolvedValue(null);
        const keywordSpy = jest.spyOn(Flow, 'findKeywordMatches').mockResolvedValue([]);
        const activeSpy = jest.spyOn(Flow, 'findActiveKeywordFlows').mockResolvedValue([globalFlow, scopedFlow]);
        const newContactSpy = jest.spyOn(Flow, 'findByTrigger').mockResolvedValue(null);
        const startFlowSpy = jest.spyOn(service, 'startFlow').mockResolvedValue({ id: 456 });
        intentClassifier.classifyKeywordFlowIntent.mockResolvedValue({ status: 'no_match' });

        const result = await service.processIncomingMessage(
            { text: 'oi' },
            { id: 26, phone: '5527996459659', assigned_to: null },
            { id: 331, session_id: 'momnt', is_bot_active: 1, assigned_to: null, created: false }
        );

        expect(startFlowSpy).toHaveBeenCalledWith(
            scopedFlow,
            expect.objectContaining({ id: 26 }),
            expect.objectContaining({ id: 331 }),
            expect.objectContaining({ text: 'oi' })
        );
        expect(result).toEqual({ id: 456 });

        resolveExecutionSpy.mockRestore();
        keywordSpy.mockRestore();
        activeSpy.mockRestore();
        newContactSpy.mockRestore();
        startFlowSpy.mockRestore();
    });

    test('processIncomingMessage preserves direct keyword match even with semantic no_match in strict mode', async () => {
        process.env.FLOW_INTENT_CLASSIFIER_STRICT = '1';
        process.env.GEMINI_API_KEY = 'mock-key';

        const service = new FlowService();
        const flow = {
            id: 202,
            name: 'Onde Comprar',
            trigger_type: 'keyword',
            session_id: 'momnt',
            priority: 20,
            nodes: [
                {
                    id: 'trigger-buy',
                    type: 'trigger',
                    subtype: 'intent',
                    data: {
                        intentRoutes: [
                            { id: 'route-buy', label: 'Comprar', phrases: 'onde compro oculos' }
                        ]
                    }
                }
            ],
            edges: []
        };

        const resolveExecutionSpy = jest.spyOn(service, 'resolveActiveExecution').mockResolvedValue(null);
        const keywordSpy = jest.spyOn(Flow, 'findKeywordMatches').mockResolvedValue([flow]);
        const activeSpy = jest.spyOn(Flow, 'findActiveKeywordFlows').mockResolvedValue([flow]);
        const newContactSpy = jest.spyOn(Flow, 'findByTrigger').mockResolvedValue(null);
        const startFlowSpy = jest.spyOn(service, 'startFlow').mockResolvedValue({ id: 789 });
        intentClassifier.classifyKeywordFlowIntent.mockResolvedValue({ status: 'no_match', confidence: 0.99 });

        const result = await service.processIncomingMessage(
            { text: 'onde compro oculos momnt?' },
            { id: 26, phone: '5527996459659', assigned_to: null },
            { id: 331, session_id: 'momnt', is_bot_active: 1, assigned_to: null, created: false }
        );

        expect(startFlowSpy).toHaveBeenCalledWith(
            flow,
            expect.objectContaining({ id: 26 }),
            expect.objectContaining({ id: 331 }),
            expect.objectContaining({ text: 'onde compro oculos momnt?' })
        );
        expect(result).toEqual({ id: 789 });

        resolveExecutionSpy.mockRestore();
        keywordSpy.mockRestore();
        activeSpy.mockRestore();
        newContactSpy.mockRestore();
        startFlowSpy.mockRestore();
    });

    test('continueFlow routes second unmatched reply through message_once output after reentry', async () => {
        const service = new FlowService();
        const triggerNode = {
            id: 'trigger-intent',
            type: 'trigger',
            subtype: 'intent',
            data: {
                intentRoutes: [
                    { id: 'route-buy', label: 'Comprar', phrases: 'comprar' }
                ]
            }
        };
        const messageOnceNode = {
            id: 'welcome-once',
            type: 'message_once',
            data: {}
        };

        const execution = {
            id: 700,
            flow: {
                id: 21,
                nodes: [triggerNode, messageOnceNode],
                edges: []
            },
            conversation: { id: 70 },
            lead: { id: 26 },
            currentNode: 'trigger-intent',
            variables: {
                intent_default_message_once_reentry: {
                    triggerNodeId: 'trigger-intent',
                    messageOnceNodeId: 'welcome-once',
                    targetHandle: 'path-4',
                    fallbackReady: true
                }
            }
        };

        const pickSpy = jest.spyOn(service, 'pickTriggerIntentHandle').mockResolvedValue(null);
        const goToNextSpy = jest.spyOn(service, 'goToNextNode').mockResolvedValue();

        await service.continueFlow(execution, { text: 'oi novamente' });

        expect(goToNextSpy).toHaveBeenCalledWith(execution, messageOnceNode);
        expect(execution.variables.intent_default_message_once_reentry).toBeUndefined();

        pickSpy.mockRestore();
        goToNextSpy.mockRestore();
    });

    test('intent node waits one extra message before default route and reuses context', async () => {
        const service = new FlowService();
        const node = {
            id: 'intent-mid',
            type: 'intent',
            data: {
                intentRoutes: [
                    { id: 'route-hours', label: 'Duvida horario', phrases: 'qual horario voces tem disponibilidade' }
                ]
            }
        };

        const execution = {
            id: 500,
            flow: {
                id: 9,
                nodes: [node],
                edges: [
                    { source: 'intent-mid', target: 'hours-answer', sourceHandle: 'route-hours' },
                    { source: 'intent-mid', target: 'fallback-answer', sourceHandle: 'default' }
                ]
            },
            conversation: { id: 17 },
            lead: { id: 31 },
            currentNode: 'intent-mid',
            variables: {}
        };

        const pickSpy = jest.spyOn(service, 'pickTriggerIntentHandle')
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce('route-hours');
        const persistSpy = jest.spyOn(service, 'persistExecutionVariables').mockResolvedValue();
        const goToNextSpy = jest.spyOn(service, 'goToNextNode').mockResolvedValue();

        await service.continueFlow(execution, { text: 'voces tem disponibilidade?' });

        expect(goToNextSpy).not.toHaveBeenCalled();
        expect(persistSpy).toHaveBeenCalledTimes(1);
        expect(execution.variables.intent_no_match_count_by_node['intent-mid']).toBe(1);

        await service.continueFlow(execution, { text: 'qual horario voces tem?' });

        expect(goToNextSpy).toHaveBeenCalledWith(execution, node, 'route-hours');
        expect(String(pickSpy.mock.calls[1][2] || '')).toContain('voces tem disponibilidade?');
        expect(String(pickSpy.mock.calls[1][2] || '')).toContain('qual horario voces tem?');

        pickSpy.mockRestore();
        persistSpy.mockRestore();
        goToNextSpy.mockRestore();
    });

    test('trigger intent node waits one extra message before default route', async () => {
        const service = new FlowService();
        const node = {
            id: 'trigger-intent',
            type: 'trigger',
            subtype: 'intent',
            data: {
                intentRoutes: [
                    { id: 'route-buy', label: 'Comprar', phrases: 'comprar oculos' }
                ]
            }
        };

        const execution = {
            id: 522,
            flow: {
                id: 11,
                nodes: [node],
                edges: [
                    { source: 'trigger-intent', target: 'buy-answer', sourceHandle: 'route-buy' },
                    { source: 'trigger-intent', target: 'fallback-answer', sourceHandle: 'default' }
                ]
            },
            conversation: { id: 19 },
            lead: { id: 33 },
            currentNode: 'trigger-intent',
            variables: {}
        };

        const pickSpy = jest.spyOn(service, 'pickTriggerIntentHandle').mockResolvedValue(null);
        const persistSpy = jest.spyOn(service, 'persistExecutionVariables').mockResolvedValue();
        const goToNextSpy = jest.spyOn(service, 'goToNextNode').mockResolvedValue();

        await service.continueFlow(execution, { text: 'boa tarde' });

        expect(goToNextSpy).not.toHaveBeenCalled();
        expect(persistSpy).toHaveBeenCalledTimes(1);
        expect(execution.variables.intent_no_match_count_by_node['trigger-intent']).toBe(1);

        await service.continueFlow(execution, { text: 'so olhando' });

        expect(goToNextSpy).toHaveBeenCalledWith(execution, node, null);
        expect(execution.variables.intent_no_match_count_by_node).toBeUndefined();

        pickSpy.mockRestore();
        persistSpy.mockRestore();
        goToNextSpy.mockRestore();
    });

    test('intent node falls back to latest reply when merged context misses', async () => {
        const service = new FlowService();
        const node = {
            id: 'intent-short',
            type: 'intent',
            data: {
                intentRoutes: [
                    { id: 'route-interested', label: 'Interessado', phrases: 'Gostei desse' }
                ]
            }
        };

        const execution = {
            id: 521,
            flow: {
                id: 10,
                nodes: [node],
                edges: [
                    { source: 'intent-short', target: 'interested-answer', sourceHandle: 'route-interested' },
                    { source: 'intent-short', target: 'fallback-answer', sourceHandle: 'default' }
                ]
            },
            conversation: { id: 18 },
            lead: { id: 32 },
            currentNode: 'intent-short',
            variables: {}
        };

        const persistSpy = jest.spyOn(service, 'persistExecutionVariables').mockResolvedValue();
        const goToNextSpy = jest.spyOn(service, 'goToNextNode').mockResolvedValue();

        await service.continueFlow(execution, { text: 'Gostei do mais arredondado' });

        expect(goToNextSpy).not.toHaveBeenCalled();
        expect(execution.variables.intent_no_match_count_by_node['intent-short']).toBe(1);

        await service.continueFlow(execution, { text: 'Gostei' });

        expect(goToNextSpy).toHaveBeenCalledWith(execution, node, 'route-interested');

        persistSpy.mockRestore();
        goToNextSpy.mockRestore();
    });

    test('queues inbound messages that arrive before a wait/intent node and replays them', async () => {
        const service = new FlowService();
        const messageNode = {
            id: 'intro-message',
            type: 'message',
            data: {}
        };
        const intentNode = {
            id: 'intent-mid',
            type: 'intent',
            data: {
                intentRoutes: [
                    { id: 'route-classic', label: 'Linha classica', phrases: 'gostei da linha classica' }
                ]
            }
        };

        const execution = {
            id: 501,
            flow: {
                id: 10,
                nodes: [messageNode, intentNode],
                edges: []
            },
            conversation: { id: 18 },
            lead: { id: 32 },
            currentNode: 'intro-message',
            variables: {}
        };

        const persistSpy = jest.spyOn(service, 'persistExecutionVariables').mockResolvedValue();

        await service.continueFlow(execution, { text: 'Gostei da linha clássica' });

        expect(Array.isArray(execution.variables.pending_incoming_messages)).toBe(true);
        expect(execution.variables.pending_incoming_messages).toHaveLength(1);
        expect(execution.variables.pending_incoming_messages[0].text).toBe('Gostei da linha clássica');

        const continueSpy = jest.spyOn(service, 'continueFlow').mockResolvedValue(execution);
        execution.currentNode = 'intent-mid';

        await service.drainPendingIncomingMessages(execution);

        expect(continueSpy).toHaveBeenCalledWith(
            execution,
            expect.objectContaining({ text: 'Gostei da linha clássica' })
        );
        expect(execution.variables.pending_incoming_messages).toBeUndefined();
        expect(persistSpy).toHaveBeenCalledTimes(2);

        continueSpy.mockRestore();
        persistSpy.mockRestore();
    });

    test('message_once stores delivery flag per lead and node', async () => {
        const service = new FlowService();
        const execution = {
            flow: { id: 21 },
            lead: {
                id: 44,
                custom_fields: '{}'
            },
            variables: {}
        };
        const node = {
            id: 'welcome_once',
            type: 'message_once',
            data: {}
        };

        const leadUpdateSpy = jest.spyOn(Lead, 'update').mockResolvedValue({ changes: 1 });

        expect(service.hasLeadSeenOnceMessageNode(execution, node)).toBe(false);

        const marked = await service.markLeadOnceMessageNodeSeen(execution, node);
        expect(marked).toBe(true);
        expect(leadUpdateSpy).toHaveBeenCalledTimes(1);

        const updatedCustomFields = JSON.parse(execution.lead.custom_fields || '{}');
        const onceMap = updatedCustomFields?.__system?.flow_once_message_nodes || {};
        expect(onceMap['flow:21:node:welcome_once']).toBeTruthy();
        expect(service.hasLeadSeenOnceMessageNode(execution, node)).toBe(true);

        leadUpdateSpy.mockRestore();
    });

    test('message_once with hourly repeat allows resend after cooldown per lead', () => {
        const service = new FlowService();
        const node = {
            id: 'welcome_once',
            type: 'message_once',
            data: {
                onceRepeatMode: 'hours',
                onceRepeatValue: 1
            }
        };

        const now = Date.now();
        const staleTimestamp = new Date(now - (2 * 60 * 60 * 1000)).toISOString();
        const freshTimestamp = new Date(now - (20 * 60 * 1000)).toISOString();

        const staleExecution = {
            flow: { id: 21 },
            lead: {
                custom_fields: JSON.stringify({
                    __system: {
                        flow_once_message_nodes: {
                            'flow:21:node:welcome_once': staleTimestamp
                        }
                    }
                })
            }
        };

        const freshExecution = {
            flow: { id: 21 },
            lead: {
                custom_fields: JSON.stringify({
                    __system: {
                        flow_once_message_nodes: {
                            'flow:21:node:welcome_once': freshTimestamp
                        }
                    }
                })
            }
        };

        expect(service.hasLeadSeenOnceMessageNode(staleExecution, node)).toBe(false);
        expect(service.hasLeadSeenOnceMessageNode(freshExecution, node)).toBe(true);
    });

    test('message_once keeps legacy always behavior by default', () => {
        const service = new FlowService();
        const node = {
            id: 'welcome_once',
            type: 'message_once',
            data: {}
        };

        const execution = {
            flow: { id: 21 },
            lead: {
                custom_fields: JSON.stringify({
                    __system: {
                        flow_once_message_nodes: {
                            'flow:21:node:welcome_once': new Date().toISOString()
                        }
                    }
                })
            }
        };

        expect(service.hasLeadSeenOnceMessageNode(execution, node)).toBe(true);
    });
});
