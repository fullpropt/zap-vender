/**
 * SELF PROTEÇÃO VEICULAR - Serviço de Fluxos de Automação
 * Executa fluxos de automação baseados em triggers
 */

const { Flow, Lead, Conversation, Message } = require('../database/models');
const { run, queryOne, generateUUID } = require('../database/connection');
const EventEmitter = require('events');
const { classifyKeywordFlowIntent, classifyIntentRoute } = require('./intentClassifierService');

function isStrictFlowIntentRoutingEnabled() {
    const value = String(process.env.FLOW_INTENT_CLASSIFIER_STRICT || '').trim().toLowerCase();
    return value === '1' || value === 'true' || value === 'on';
}

function isFlowIntentClassifierConfigured() {
    const enabledValue = String(process.env.FLOW_INTENT_CLASSIFIER_ENABLED || '').trim().toLowerCase();
    if (enabledValue === '0' || enabledValue === 'false' || enabledValue === 'off') {
        return false;
    }
    return Boolean(String(process.env.GEMINI_API_KEY || '').trim());
}

function normalizeIntentText(value = '') {
    return String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function parseIntentPhrases(value = '') {
    return String(value || '')
        .split(',')
        .map((item) => normalizeIntentText(item))
        .filter(Boolean);
}

function includesIntentPhrase(normalizedMessage = '', normalizedPhrase = '') {
    if (!normalizedMessage || !normalizedPhrase) return false;
    return ` ${normalizedMessage} `.includes(` ${normalizedPhrase} `);
}

class FlowService extends EventEmitter {
    constructor() {
        super();
        this.sendFunction = null;
        this.activeExecutions = new Map();
    }
    
    /**
     * Inicializar serviço
     */
    init(sendFunction) {
        this.sendFunction = sendFunction;
        console.log('🔄 Serviço de fluxos de automação iniciado');
    }
    
    /**
     * Processar mensagem recebida e verificar triggers
     */
    async processIncomingMessage(message, lead, conversation) {
        // Verificar se bot está ativo para esta conversa
        if (conversation && !conversation.is_bot_active) {
            return null;
        }
        
        // Verificar se já há um fluxo em execução
        const activeExecution = this.getActiveExecution(conversation?.id);
        if (activeExecution) {
            return await this.continueFlow(activeExecution, message);
        }
        
        // Procurar fluxo por palavra-chave
        const text = message.text?.trim() || '';
        let flow = null;
        let suppressKeywordFallback = false;

        if (text) {
            const strictIntentRouting = isStrictFlowIntentRoutingEnabled() && isFlowIntentClassifierConfigured();
            const keywordMatches = await Flow.findKeywordMatches(text);
            const semanticCandidates = await Flow.findActiveKeywordFlows();
            if (semanticCandidates.length > 0) {
                const intentDecision = await classifyKeywordFlowIntent(text, semanticCandidates);
                if (intentDecision?.status === 'selected' && intentDecision.flowId) {
                    flow = semanticCandidates.find((item) => Number(item.id) === Number(intentDecision.flowId)) || null;
                } else if (intentDecision?.status === 'no_match') {
                    suppressKeywordFallback = true;
                } else if (strictIntentRouting) {
                    suppressKeywordFallback = true;
                }
            }

            if (!flow && !suppressKeywordFallback && keywordMatches.length > 0) {
                flow = keywordMatches[0];
            }
        }
        
        // Se não encontrou por keyword, verificar se é novo contato
        if (!flow && conversation?.created) {
            flow = await Flow.findByTrigger('new_contact');
        }
        
        if (flow) {
            return await this.startFlow(flow, lead, conversation, message);
        }
        
        return null;
    }
    
    /**
     * Iniciar execução de um fluxo
     */
    async startFlow(flow, lead, conversation, triggerMessage = null) {
        const executionUuid = generateUUID();
        
        // Criar registro de execução
        const result = await run(`
            INSERT INTO flow_executions (uuid, flow_id, conversation_id, lead_id, current_node, variables, status)
            VALUES (?, ?, ?, ?, ?, ?, 'running')
        `, [
            executionUuid,
            flow.id,
            conversation?.id,
            lead.id,
            'start',
            JSON.stringify({
                lead: {
                    nome: lead.name,
                    telefone: lead.phone,
                    veiculo: lead.vehicle,
                    placa: lead.plate
                },
                trigger_message: triggerMessage?.text
            })
        ]);
        
        const execution = {
            id: result.lastInsertRowid,
            uuid: executionUuid,
            flow,
            lead,
            conversation,
            currentNode: 'start',
            variables: {
                nome: lead.name || 'Cliente',
                telefone: lead.phone,
                veiculo: lead.vehicle || '',
                placa: lead.plate || '',
                trigger_message: triggerMessage?.text || ''
            },
            triggerMessageText: triggerMessage?.text || ''
        };
        
        // Armazenar execução ativa
        if (conversation?.id) {
            this.activeExecutions.set(conversation.id, execution);
        }
        
        this.emit('flow:started', { 
            flowId: flow.id, 
            flowName: flow.name,
            leadId: lead.id 
        });
        
        // Executar primeiro nó
        await this.executeNode(execution, 'start');
        
        return execution;
    }
    
    /**
     * Continuar fluxo em execução
     */
    async continueFlow(execution, message) {
        const currentNode = this.findNode(execution.flow, execution.currentNode);

        if (!currentNode) {
            await this.endFlow(execution, 'completed');
            return null;
        }

        if (currentNode.type === 'intent') {
            execution.variables.last_response = message.text;
            const selectedHandle = await this.pickTriggerIntentHandle(execution, currentNode, message.text);
            await this.goToNextNode(execution, currentNode, selectedHandle);
            return execution;
        }

        if (currentNode.type === 'wait' || currentNode.type === 'condition') {
            execution.variables.last_response = message.text;

            const nextNodeId = this.evaluateCondition(execution.flow, currentNode, message.text);

            if (nextNodeId) {
                await this.executeNode(execution, nextNodeId);
            } else {
                await this.endFlow(execution, 'completed');
            }
        }

        return execution;
    }
    
    /**
     * Executar um nó do fluxo
     */
    async executeNode(execution, nodeId) {
        const node = this.findNode(execution.flow, nodeId);
        
        if (!node) {
            await this.endFlow(execution, 'completed');
            return;
        }
        
        execution.currentNode = nodeId;
        
        // Atualizar registro
        await run(`
            UPDATE flow_executions 
            SET current_node = ?, variables = ?
            WHERE id = ?
        `, [nodeId, JSON.stringify(execution.variables), execution.id]);
        
        try {
            switch (node.type) {
                case 'trigger':
                    await this.executeTriggerNode(execution, node);
                    break;
                    
                case 'message':
                    // Enviar mensagem
                    const content = this.replaceVariables(node.data.content, execution.variables);
                    
                    if (this.sendFunction) {
                        await this.sendFunction({
                            to: execution.lead.phone,
                            jid: execution.lead.jid,
                            content,
                            mediaType: node.data.mediaType || 'text',
                            mediaUrl: node.data.mediaUrl
                        });
                    }
                    
                    // Aguardar um pouco e ir para próximo
                    await this.delay(1500);
                    await this.goToNextNode(execution, node);
                    break;
                    
                case 'wait':
                    // Aguarda resposta do usuario
                    // O fluxo sera continuado quando chegar nova mensagem
                    break;

                case 'intent':
                    // Aguarda resposta para classificar a intencao no meio do fluxo
                    break;

                case 'condition':
                    // Aguardar resposta para avaliar condição
                    break;
                    
                case 'delay':
                    // Aguardar tempo especificado
                    const delayMs = (node.data.seconds || 5) * 1000;
                    await this.delay(delayMs);
                    await this.goToNextNode(execution, node);
                    break;
                    
                case 'transfer':
                    // Transferir para atendente
                    if (node.data.message && this.sendFunction) {
                        const transferMsg = this.replaceVariables(node.data.message, execution.variables);
                        await this.sendFunction({
                            to: execution.lead.phone,
                            jid: execution.lead.jid,
                            content: transferMsg
                        });
                    }
                    
                    // Desativar bot para esta conversa
                    if (execution.conversation?.id) {
                        await Conversation.update(execution.conversation.id, { is_bot_active: 0 });
                    }
                    
                    await this.endFlow(execution, 'completed');
                    
                    this.emit('flow:transfer', {
                        flowId: execution.flow.id,
                        leadId: execution.lead.id,
                        conversationId: execution.conversation?.id
                    });
                    break;
                    
                case 'tag':
                    // Adicionar tag ao lead
                    const currentTags = JSON.parse(execution.lead.tags || '[]');
                    if (!currentTags.includes(node.data.tag)) {
                        currentTags.push(node.data.tag);
                        await Lead.update(execution.lead.id, { tags: currentTags });
                    }
                    await this.goToNextNode(execution, node);
                    break;
                    
                case 'status':
                    // Alterar status do lead
                    await Lead.update(execution.lead.id, { status: node.data.status });
                    await this.goToNextNode(execution, node);
                    break;
                    
                case 'webhook':
                    // Disparar webhook
                    this.emit('flow:webhook', {
                        url: node.data.url,
                        data: {
                            lead: execution.lead,
                            variables: execution.variables,
                            flowId: execution.flow.id
                        }
                    });
                    await this.goToNextNode(execution, node);
                    break;
                    
                case 'end':
                    await this.endFlow(execution, 'completed');
                    break;
                    
                default:
                    await this.goToNextNode(execution, node);
            }
        } catch (error) {
            console.error(`❌ Erro ao executar nó ${nodeId}:`, error.message);
            await this.endFlow(execution, 'failed', error.message);
        }
    }
    
    /**
     * Ir para próximo nó
     */
    resolveTriggerIntentRoutes(node) {
        const nodeType = String(node?.type || '').trim().toLowerCase();
        const subtype = String(node?.subtype || '').trim().toLowerCase();
        if (nodeType === 'trigger' && subtype !== 'keyword' && subtype !== 'intent') {
            return [];
        }
        if (nodeType !== 'trigger' && nodeType !== 'intent') {
            return [];
        }

        const routes = Array.isArray(node?.data?.intentRoutes) ? node.data.intentRoutes : [];
        if (routes.length > 0) {
            return routes
                .map((route, index) => {
                    const id = String(route?.id || `intent-${index + 1}`).trim();
                    const label = String(route?.label || '').trim() || `Intencao ${index + 1}`;
                    const phrases = String(route?.phrases || '').trim();
                    const normalizedPhrases = parseIntentPhrases(phrases);
                    if (!id || normalizedPhrases.length === 0) return null;
                    return { id, label, phrases, normalizedPhrases };
                })
                .filter(Boolean);
        }

        const fallbackPhrases = parseIntentPhrases(node?.data?.keyword || '');
        return fallbackPhrases.map((phrase, index) => ({
            id: `intent-${index + 1}`,
            label: `Intencao ${index + 1}`,
            phrases: phrase,
            normalizedPhrases: [phrase]
        }));
    }

    async pickTriggerIntentHandle(execution, node, responseText = null) {
        const routes = this.resolveTriggerIntentRoutes(node);
        if (routes.length === 0) return null;

        const messageText = String(responseText ?? execution?.triggerMessageText ?? execution?.variables?.trigger_message ?? '').trim();
        if (!messageText) return null;
        const strictIntentRouting = isStrictFlowIntentRoutingEnabled() && isFlowIntentClassifierConfigured();

        const semanticDecision = await classifyIntentRoute(messageText, routes);
        if (semanticDecision?.status === 'selected' && semanticDecision.routeId) {
            return String(semanticDecision.routeId);
        }
        if (semanticDecision?.status === 'no_match') {
            return null;
        }
        if (strictIntentRouting) {
            return null;
        }

        const normalizedMessage = normalizeIntentText(messageText);
        if (!normalizedMessage) return null;

        let best = null;
        for (const route of routes) {
            const matchedPhrases = route.normalizedPhrases.filter((phrase) => includesIntentPhrase(normalizedMessage, phrase));
            if (matchedPhrases.length === 0) continue;

            const longestWords = matchedPhrases.reduce((max, phrase) => Math.max(max, phrase.split(' ').length), 0);
            const longestLength = matchedPhrases.reduce((max, phrase) => Math.max(max, phrase.length), 0);
            const score = {
                longestWords,
                longestLength,
                matchedCount: matchedPhrases.length
            };

            const isBetter = !best
                || score.longestWords > best.score.longestWords
                || (
                    score.longestWords === best.score.longestWords
                    && score.longestLength > best.score.longestLength
                )
                || (
                    score.longestWords === best.score.longestWords
                    && score.longestLength === best.score.longestLength
                    && score.matchedCount > best.score.matchedCount
                );

            if (isBetter) {
                best = { id: route.id, score };
            }
        }

        return best?.id || null;
    }

    async executeTriggerNode(execution, node) {
        const selectedHandle = await this.pickTriggerIntentHandle(execution, node);

        if (selectedHandle) {
            execution.variables.trigger_intent_handle = selectedHandle;
        } else {
            delete execution.variables.trigger_intent_handle;
        }

        await run(`
            UPDATE flow_executions
            SET variables = ?
            WHERE id = ?
        `, [JSON.stringify(execution.variables), execution.id]);

        await this.goToNextNode(execution, node, selectedHandle);
    }

    async goToNextNode(execution, currentNode, preferredSourceHandle = null) {
        const outgoingEdges = (execution.flow.edges || []).filter((edge) => edge.source === currentNode.id);
        if (outgoingEdges.length === 0) {
            await this.endFlow(execution, 'completed');
            return;
        }

        const subtype = String(currentNode?.subtype || '').trim().toLowerCase();
        const isIntentNode = currentNode?.type === 'intent' || (currentNode?.type === 'trigger' && (subtype === 'keyword' || subtype === 'intent'));
        const normalizeHandle = (value) => {
            const normalized = String(value || '').trim();
            return normalized || 'default';
        };

        let edge = null;
        if (isIntentNode && preferredSourceHandle) {
            edge = outgoingEdges.find((item) => normalizeHandle(item.sourceHandle) === normalizeHandle(preferredSourceHandle));
        }

        if (!edge) {
            edge = outgoingEdges.find((item) => normalizeHandle(item.sourceHandle) === 'default');
        }

        if (!edge && !isIntentNode) {
            edge = outgoingEdges[0];
        }

        if (edge) {
            await this.executeNode(execution, edge.target);
        } else {
            await this.endFlow(execution, 'completed');
        }
    }
    
    /**
     * Avaliar condição e retornar próximo nó
     */
    evaluateCondition(flow, node, response) {
        const text = response?.toLowerCase().trim() || '';
        
        // Verificar condições definidas no nó
        if (node.data.conditions) {
            for (const condition of node.data.conditions) {
                if (text === condition.value.toLowerCase() || text.includes(condition.value.toLowerCase())) {
                    return condition.next;
                }
            }
        }
        
        // Procurar nas edges
        const edges = flow.edges.filter(e => e.source === node.id);
        
        for (const edge of edges) {
            if (edge.label && (text === edge.label.toLowerCase() || text.includes(edge.label.toLowerCase()))) {
                return edge.target;
            }
        }
        
        // Retornar edge padrão (sem label)
        const defaultEdge = edges.find(e => !e.label);
        return defaultEdge?.target;
    }
    
    /**
     * Encerrar fluxo
     */
    async endFlow(execution, status, errorMessage = null) {
        await run(`
            UPDATE flow_executions 
            SET status = ?, completed_at = CURRENT_TIMESTAMP, error_message = ?
            WHERE id = ?
        `, [status, errorMessage, execution.id]);
        
        // Remover da lista de execuções ativas
        if (execution.conversation?.id) {
            this.activeExecutions.delete(execution.conversation.id);
        }
        
        this.emit('flow:ended', {
            flowId: execution.flow.id,
            leadId: execution.lead.id,
            status,
            errorMessage
        });
    }
    
    /**
     * Encontrar nó no fluxo
     */
    findNode(flow, nodeId) {
        return flow.nodes.find(n => n.id === nodeId);
    }
    
    /**
     * Substituir variáveis no texto
     */
    replaceVariables(text, variables) {
        if (!text) return '';
        
        let result = text;
        
        for (const [key, value] of Object.entries(variables)) {
            const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'gi');
            result = result.replace(regex, value || '');
        }
        
        return result;
    }
    
    /**
     * Obter execução ativa de uma conversa
     */
    getActiveExecution(conversationId) {
        return this.activeExecutions.get(conversationId);
    }
    
    /**
     * Pausar execução
     */
    async pauseExecution(conversationId) {
        const execution = this.activeExecutions.get(conversationId);
        if (execution) {
            await run(`UPDATE flow_executions SET status = 'paused' WHERE id = ?`, [execution.id]);
            this.activeExecutions.delete(conversationId);
        }
    }
    
    /**
     * Cancelar execução
     */
    async cancelExecution(conversationId) {
        const execution = this.activeExecutions.get(conversationId);
        if (execution) {
            await run(`UPDATE flow_executions SET status = 'cancelled' WHERE id = ?`, [execution.id]);
            this.activeExecutions.delete(conversationId);
        }
    }
    
    /**
     * Utilitário de delay
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = new FlowService();
module.exports.FlowService = FlowService;




