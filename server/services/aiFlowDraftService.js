/**
 * Gera rascunhos de fluxo de conversa a partir de prompts em linguagem natural.
 * MVP conservador: heuristico + contexto do negocio (sem dependencia de LLM).
 *
 * O contrato de saida foi desenhado para ser compativel com o Flow Builder atual
 * (nodes/edges), permitindo evoluir depois para um provider de IA real.
 */

function normalizeText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeMultilineText(value) {
    return String(value || '').replace(/\r/g, '').trim();
}

function toLowerNoAccents(value) {
    return String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

function containsAny(haystack, terms) {
    const source = toLowerNoAccents(haystack);
    return terms.some((term) => source.includes(toLowerNoAccents(term)));
}

function clip(value, max = 240) {
    const text = normalizeText(value);
    if (text.length <= max) return text;
    return `${text.slice(0, Math.max(0, max - 1)).trim()}...`;
}

function firstSentence(value) {
    const text = normalizeMultilineText(value);
    if (!text) return '';
    const sentence = text.split(/[\n.!?]+/).map((item) => item.trim()).find(Boolean) || '';
    return clip(sentence, 140);
}

function safeArray(value) {
    return Array.isArray(value) ? value : [];
}

function parseFaqEntries(rawValue) {
    const raw = normalizeMultilineText(rawValue);
    if (!raw) return [];

    return raw
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, 8);
}

function normalizeWebsiteUrl(value) {
    const raw = normalizeText(value);
    if (!raw) return '';
    if (/^https?:\/\//i.test(raw)) return raw;
    return `https://${raw}`;
}

function normalizeAiConfig(rawConfig = {}) {
    const config = rawConfig && typeof rawConfig === 'object' && !Array.isArray(rawConfig)
        ? rawConfig
        : {};

    return {
        enabled: Boolean(config.enabled),
        businessDescription: normalizeMultilineText(config.businessDescription),
        productsServices: normalizeMultilineText(config.productsServices),
        targetAudience: normalizeMultilineText(config.targetAudience),
        toneOfVoice: normalizeText(config.toneOfVoice),
        rulesPolicies: normalizeMultilineText(config.rulesPolicies),
        faqs: normalizeMultilineText(config.faqs),
        websiteUrl: normalizeWebsiteUrl(config.websiteUrl),
        documentsNotes: normalizeMultilineText(config.documentsNotes),
        internalNotes: normalizeMultilineText(config.internalNotes)
    };
}

function inferFlowIntent(promptText = '') {
    const text = toLowerNoAccents(promptText);

    if (containsAny(text, ['reativar', 'reativacao', 'reengajar', 'reengajamento'])) {
        return 'reactivation';
    }
    if (containsAny(text, ['suporte', 'atendimento', 'pos-venda', 'assistencia'])) {
        return 'support';
    }
    if (containsAny(text, ['agendar', 'agendamento', 'marcar horario', 'marcar visita'])) {
        return 'scheduling';
    }
    if (containsAny(text, ['qualificar', 'qualificacao'])) {
        return 'qualification';
    }
    if (containsAny(text, ['venda', 'vendas', 'fechar venda', 'converter', 'fechar negocio', 'fechar negocios'])) {
        return 'sales';
    }

    return 'generic';
}

function inferTrigger(promptText = '') {
    const normalized = toLowerNoAccents(promptText);
    if (containsAny(normalized, ['palavra-chave', 'palavra chave', 'keyword', 'intencao'])) {
        return 'keyword';
    }
    if (containsAny(normalized, ['manual'])) {
        return 'manual';
    }
    if (containsAny(normalized, ['novo lead', 'novos leads', 'novo contato', 'novos contatos', 'lead'])) {
        return 'new_contact';
    }
    return 'new_contact';
}

function inferKeywordPhrases(promptText = '', aiConfig = {}) {
    const explicitMatch = String(promptText || '').match(/(?:palavra-?chave|keyword|intencao)\s*[:\-]\s*([^\n]+)/i);
    if (explicitMatch?.[1]) {
        const phrases = explicitMatch[1]
            .split(/[,;|]/)
            .map((item) => normalizeText(item))
            .filter(Boolean)
            .slice(0, 6);
        if (phrases.length) return phrases;
    }

    const productLine = firstSentence(aiConfig.productsServices || aiConfig.businessDescription || '');
    if (productLine) {
        const words = productLine
            .split(/\s+/)
            .map((word) => word.replace(/[^\p{L}\p{N}-]/gu, '').trim())
            .filter((word) => word.length >= 4);
        const dedupe = Array.from(new Set(words)).slice(0, 3);
        if (dedupe.length) return dedupe;
    }

    return ['quero saber mais', 'tenho interesse', 'como funciona'];
}

function inferCompanyLabel(aiConfig = {}) {
    const fromDescription = firstSentence(aiConfig.businessDescription || '');
    if (!fromDescription) return 'nossa equipe';

    const leading = fromDescription.split(/\s+/).slice(0, 6).join(' ').trim();
    return leading || 'nossa equipe';
}

function inferOfferSnippet(aiConfig = {}) {
    const source = firstSentence(aiConfig.productsServices || aiConfig.businessDescription || '');
    if (!source) return 'uma solucao adequada para sua necessidade';
    return source;
}

function inferToneInstruction(aiConfig = {}) {
    const tone = toLowerNoAccents(aiConfig.toneOfVoice || '');
    if (!tone) return '';
    if (tone.includes('formal')) return 'Mantenha uma abordagem educada e objetiva.';
    if (tone.includes('consultiv')) return 'Use uma abordagem consultiva, com perguntas antes de ofertar.';
    if (tone.includes('descontra')) return 'Use uma linguagem leve e amigavel, sem perder clareza.';
    return `Tom sugerido: ${clip(aiConfig.toneOfVoice, 80)}.`;
}

function buildContextNotes(aiConfig = {}) {
    const notes = [];
    if (aiConfig.businessDescription) notes.push(`Negocio: ${clip(firstSentence(aiConfig.businessDescription), 120)}`);
    if (aiConfig.productsServices) notes.push(`Oferta: ${clip(firstSentence(aiConfig.productsServices), 120)}`);
    if (aiConfig.targetAudience) notes.push(`Publico: ${clip(firstSentence(aiConfig.targetAudience), 100)}`);
    if (aiConfig.rulesPolicies) notes.push(`Regra/politica: ${clip(firstSentence(aiConfig.rulesPolicies), 120)}`);
    if (aiConfig.websiteUrl) notes.push(`Site cadastrado: ${aiConfig.websiteUrl}`);
    return notes;
}

function createNode(id, type, x, y, data = {}, subtype) {
    const node = {
        id,
        type,
        position: { x, y },
        data: {
            label: data.label || type,
            collapsed: false,
            ...data
        }
    };
    if (subtype) node.subtype = subtype;
    return node;
}

function createEdge(source, target, sourceHandle = 'default', targetHandle = 'default', label = '') {
    const edge = { source, target, sourceHandle, targetHandle };
    if (label) edge.label = label;
    return edge;
}

function buildBaseTriggerNode(promptText, aiConfig) {
    const trigger = inferTrigger(promptText);

    if (trigger === 'keyword') {
        const phrases = inferKeywordPhrases(promptText, aiConfig);
        return createNode(
            'node_trigger',
            'trigger',
            70,
            180,
            {
                label: 'Intencao',
                keyword: phrases.join(', '),
                intentRoutes: [
                    {
                        id: 'interesse-principal',
                        label: 'Interesse principal',
                        phrases: phrases.join(', ')
                    }
                ]
            },
            'keyword'
        );
    }

    if (trigger === 'manual') {
        return createNode('node_trigger', 'trigger', 70, 180, { label: 'Manual' }, 'manual');
    }

    return createNode('node_trigger', 'trigger', 70, 180, { label: 'Novo Contato' }, 'new_contact');
}

function buildSalesDraft(promptText, aiConfig) {
    const company = inferCompanyLabel(aiConfig);
    const offer = inferOfferSnippet(aiConfig);
    const toneHint = inferToneInstruction(aiConfig);
    const faqHints = parseFaqEntries(aiConfig.faqs);
    const faqHintLine = faqHints[0] ? `Ex.: ${clip(faqHints[0], 90)}` : '';

    const nodes = [
        buildBaseTriggerNode(promptText, aiConfig),
        createNode('node_msg_welcome', 'message', 360, 70, {
            label: 'Boas-vindas',
            content: `Oi! Seja bem-vindo(a). Sou do time da ${company}. Posso te ajudar a encontrar a melhor opcao hoje.`,
            delaySeconds: 0
        }),
        createNode('node_wait_need', 'wait', 650, 70, {
            label: 'Aguardar necessidade',
            timeout: 300
        }),
        createNode('node_msg_qualify', 'message', 940, 40, {
            label: 'Qualificacao',
            content: `Perfeito. Para eu te indicar a melhor opcao, me conta rapidamente: o que voce procura e qual sua principal prioridade?`,
            delaySeconds: 0
        }),
        createNode('node_wait_qualify', 'wait', 1230, 40, {
            label: 'Aguardar resposta',
            timeout: 300
        }),
        createNode('node_msg_offer', 'message', 1520, 10, {
            label: 'Apresentar oferta',
            content: `Com base no que voce informou, temos ${offer}. Posso te explicar os beneficios, valores e proximo passo para fechar hoje.`,
            delaySeconds: 0
        }),
        createNode('node_wait_close', 'wait', 1810, 10, {
            label: 'Aguardar interesse',
            timeout: 300
        }),
        createNode('node_msg_close', 'message', 2100, -20, {
            label: 'Fechamento',
            content: `Se fizer sentido para voce, eu posso seguir com o atendimento para fechamento agora mesmo. Se preferir, te passo as condicoes e tiramos qualquer duvida antes.`,
            delaySeconds: 0
        }),
        createNode('node_transfer', 'transfer', 2390, -20, {
            label: 'Transferir para vendedor',
            message: `Vou te encaminhar para um consultor finalizar com voce. ${faqHintLine}`.trim()
        }),
        createNode('node_end', 'end', 2680, -20, {
            label: 'Fim'
        })
    ];

    const edges = [
        createEdge('node_trigger', 'node_msg_welcome'),
        createEdge('node_msg_welcome', 'node_wait_need'),
        createEdge('node_wait_need', 'node_msg_qualify'),
        createEdge('node_msg_qualify', 'node_wait_qualify'),
        createEdge('node_wait_qualify', 'node_msg_offer'),
        createEdge('node_msg_offer', 'node_wait_close'),
        createEdge('node_wait_close', 'node_msg_close'),
        createEdge('node_msg_close', 'node_transfer'),
        createEdge('node_transfer', 'node_end')
    ];

    const assumptions = [
        'Fluxo inicial gerado em modo rascunho para revisao humana.',
        'Nao inclui regras de preco/condicoes especificas; ajuste nas mensagens antes de ativar.'
    ];
    if (toneHint) assumptions.push(toneHint);
    if (aiConfig.websiteUrl) assumptions.push('Site cadastrado sera usado como referencia nas proximas evolucoes (RAG/indexacao).');

    return {
        name: 'Fluxo IA - Receber leads e fechar vendas',
        description: `Rascunho gerado por IA para captacao e conversao de leads. Prompt: ${clip(promptText, 180)}`,
        nodes,
        edges,
        assumptions
    };
}

function buildSupportDraft(promptText, aiConfig) {
    const company = inferCompanyLabel(aiConfig);
    const nodes = [
        buildBaseTriggerNode(promptText, aiConfig),
        createNode('node_msg_triage', 'message', 360, 130, {
            label: 'Recepcao',
            content: `Oi! Aqui e o time da ${company}. Me conta o que aconteceu para eu tentar te ajudar rapidamente.`,
            delaySeconds: 0
        }),
        createNode('node_wait_details', 'wait', 650, 130, { label: 'Aguardar detalhes', timeout: 300 }),
        createNode('node_msg_steps', 'message', 940, 100, {
            label: 'Orientacao inicial',
            content: 'Obrigado pelo detalhe. Vou te orientar com os proximos passos e, se necessario, encaminhar para um atendente.',
            delaySeconds: 0
        }),
        createNode('node_transfer', 'transfer', 1230, 100, {
            label: 'Escalar humano',
            message: 'Vou encaminhar para um atendente humano para continuidade.'
        }),
        createNode('node_end', 'end', 1520, 100, { label: 'Fim' })
    ];

    return {
        name: 'Fluxo IA - Suporte e encaminhamento',
        description: `Rascunho gerado por IA para triagem de suporte. Prompt: ${clip(promptText, 180)}`,
        nodes,
        edges: [
            createEdge('node_trigger', 'node_msg_triage'),
            createEdge('node_msg_triage', 'node_wait_details'),
            createEdge('node_wait_details', 'node_msg_steps'),
            createEdge('node_msg_steps', 'node_transfer'),
            createEdge('node_transfer', 'node_end')
        ],
        assumptions: [
            'Fluxo foca em triagem e encaminhamento; nao executa diagnostico tecnico detalhado.',
            'Revise mensagens com politicas internas antes de ativar.'
        ]
    };
}

function buildQualificationDraft(promptText, aiConfig) {
    const offer = inferOfferSnippet(aiConfig);
    const nodes = [
        buildBaseTriggerNode(promptText, aiConfig),
        createNode('node_msg_open', 'message', 360, 120, {
            label: 'Abertura',
            content: 'Oi! Posso te fazer algumas perguntas rapidas para entender sua necessidade e te atender melhor?',
            delaySeconds: 0
        }),
        createNode('node_wait_open', 'wait', 650, 120, { label: 'Aguardar ok', timeout: 300 }),
        createNode('node_msg_q1', 'message', 940, 90, {
            label: 'Pergunta principal',
            content: 'Qual e o seu objetivo principal hoje? (ex.: preco, prazo, cobertura, comparacao, contratacao)',
            delaySeconds: 0
        }),
        createNode('node_wait_q1', 'wait', 1230, 90, { label: 'Aguardar resposta', timeout: 300 }),
        createNode('node_msg_summary', 'message', 1520, 60, {
            label: 'Resumo + proximo passo',
            content: `Perfeito. Com base no que voce responder, eu direciono a melhor opcao de ${offer} e o proximo passo para atendimento.`,
            delaySeconds: 0
        }),
        createNode('node_end', 'end', 1810, 60, { label: 'Fim' })
    ];

    return {
        name: 'Fluxo IA - Qualificacao de leads',
        description: `Rascunho gerado por IA para qualificacao. Prompt: ${clip(promptText, 180)}`,
        nodes,
        edges: [
            createEdge('node_trigger', 'node_msg_open'),
            createEdge('node_msg_open', 'node_wait_open'),
            createEdge('node_wait_open', 'node_msg_q1'),
            createEdge('node_msg_q1', 'node_wait_q1'),
            createEdge('node_wait_q1', 'node_msg_summary'),
            createEdge('node_msg_summary', 'node_end')
        ],
        assumptions: ['Fluxo de qualificacao generico; personalize perguntas para seu processo comercial.']
    };
}

function buildReactivationDraft(promptText, aiConfig) {
    const offer = inferOfferSnippet(aiConfig);
    const nodes = [
        buildBaseTriggerNode(promptText, aiConfig),
        createNode('node_msg_reactivate', 'message', 360, 120, {
            label: 'Reativacao',
            content: `Oi! Passando para retomar seu atendimento. Ainda faz sentido pra voce avaliar ${offer}?`,
            delaySeconds: 0
        }),
        createNode('node_wait_return', 'wait', 650, 120, { label: 'Aguardar retorno', timeout: 86400 }),
        createNode('node_msg_followup', 'message', 940, 90, {
            label: 'Follow-up',
            content: 'Se preferir, eu posso resumir as opcoes e te ajudar a decidir mais rapido.',
            delaySeconds: 0
        }),
        createNode('node_end', 'end', 1230, 90, { label: 'Fim' })
    ];

    return {
        name: 'Fluxo IA - Reativacao de leads',
        description: `Rascunho gerado por IA para reativacao. Prompt: ${clip(promptText, 180)}`,
        nodes,
        edges: [
            createEdge('node_trigger', 'node_msg_reactivate'),
            createEdge('node_msg_reactivate', 'node_wait_return'),
            createEdge('node_wait_return', 'node_msg_followup'),
            createEdge('node_msg_followup', 'node_end')
        ],
        assumptions: ['Timeout em 86400s (24h) como placeholder; ajuste conforme sua estrategia.']
    };
}

function buildGenericDraft(promptText, aiConfig) {
    const notes = buildContextNotes(aiConfig);
    const contextLine = notes[0] ? `Contexto: ${notes[0]}` : '';
    const nodes = [
        buildBaseTriggerNode(promptText, aiConfig),
        createNode('node_msg_start', 'message', 360, 120, {
            label: 'Boas-vindas',
            content: 'Oi! Recebi sua mensagem e vou te ajudar no atendimento.',
            delaySeconds: 0
        }),
        createNode('node_wait_reply', 'wait', 650, 120, { label: 'Aguardar resposta', timeout: 300 }),
        createNode('node_msg_next', 'message', 940, 90, {
            label: 'Proximo passo',
            content: `Obrigado. Vou seguir com o proximo passo do atendimento. ${contextLine}`.trim(),
            delaySeconds: 0
        }),
        createNode('node_end', 'end', 1230, 90, { label: 'Fim' })
    ];

    return {
        name: 'Fluxo IA - Rascunho inicial',
        description: `Rascunho generico gerado por IA. Prompt: ${clip(promptText, 180)}`,
        nodes,
        edges: [
            createEdge('node_trigger', 'node_msg_start'),
            createEdge('node_msg_start', 'node_wait_reply'),
            createEdge('node_wait_reply', 'node_msg_next'),
            createEdge('node_msg_next', 'node_end')
        ],
        assumptions: [
            'Fluxo generico por falta de detalhes especificos no prompt.',
            'Refine o prompt ou preencha mais contexto em Configuracoes > Inteligencia Artificial.'
        ]
    };
}

function buildSchedulingDraft(promptText, aiConfig) {
    const nodes = [
        buildBaseTriggerNode(promptText, aiConfig),
        createNode('node_msg_schedule_intro', 'message', 360, 120, {
            label: 'Agendamento',
            content: 'Perfeito. Posso te ajudar a agendar. Me informe sua disponibilidade (dia e horario) e o melhor contato.',
            delaySeconds: 0
        }),
        createNode('node_wait_schedule', 'wait', 650, 120, { label: 'Aguardar disponibilidade', timeout: 300 }),
        createNode('node_transfer_schedule', 'transfer', 940, 90, {
            label: 'Encaminhar agendamento',
            message: 'Vou encaminhar para confirmacao do agendamento com um atendente.'
        }),
        createNode('node_end', 'end', 1230, 90, { label: 'Fim' })
    ];

    return {
        name: 'Fluxo IA - Agendamento',
        description: `Rascunho gerado por IA para agendamento. Prompt: ${clip(promptText, 180)}`,
        nodes,
        edges: [
            createEdge('node_trigger', 'node_msg_schedule_intro'),
            createEdge('node_msg_schedule_intro', 'node_wait_schedule'),
            createEdge('node_wait_schedule', 'node_transfer_schedule'),
            createEdge('node_transfer_schedule', 'node_end')
        ],
        assumptions: ['Fluxo nao confirma agenda automaticamente; apenas coleta e encaminha.']
    };
}

function generateFlowDraft(options = {}) {
    const prompt = normalizeMultilineText(options.prompt);
    if (!prompt) {
        throw new Error('Prompt de geracao e obrigatorio');
    }

    const aiConfig = normalizeAiConfig(options.businessContext);
    const intent = inferFlowIntent(prompt);

    let draft;
    switch (intent) {
        case 'sales':
            draft = buildSalesDraft(prompt, aiConfig);
            break;
        case 'support':
            draft = buildSupportDraft(prompt, aiConfig);
            break;
        case 'qualification':
            draft = buildQualificationDraft(prompt, aiConfig);
            break;
        case 'reactivation':
            draft = buildReactivationDraft(prompt, aiConfig);
            break;
        case 'scheduling':
            draft = buildSchedulingDraft(prompt, aiConfig);
            break;
        default:
            draft = buildGenericDraft(prompt, aiConfig);
            break;
    }

    return {
        provider: 'heuristic',
        intent,
        prompt,
        context: {
            hasAiConfig: aiConfig.enabled || Boolean(
                aiConfig.businessDescription
                || aiConfig.productsServices
                || aiConfig.targetAudience
                || aiConfig.rulesPolicies
                || aiConfig.faqs
                || aiConfig.websiteUrl
                || aiConfig.documentsNotes
                || aiConfig.internalNotes
            ),
            websiteUrl: aiConfig.websiteUrl || null,
            notesUsed: buildContextNotes(aiConfig)
        },
        draft: {
            ...draft,
            is_active: 0,
            metadata: {
                generated_by: 'ai_flow_draft_service',
                provider: 'heuristic',
                source_prompt: clip(prompt, 500)
            }
        }
    };
}

module.exports = {
    generateFlowDraft,
    normalizeAiConfig
};

