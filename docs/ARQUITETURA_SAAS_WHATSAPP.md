# Arquitetura e Diagnóstico – SaaS WhatsApp (estilo BotConversa/ZapVoice)

**SELF Proteção Veicular** – Análise de arquiteto de software para conexão estável, persistência de mensagens e bot conversacional.

---

## 1. Diagnóstico dos problemas mais prováveis

### 1.1 Falha de healthcheck no deploy (Railway)

- **Causa:** O processo fazia trabalho síncrono pesado (`migrate()`) **antes** de `server.listen()`. Se a migração ou qualquer init travar/falhar, o servidor nunca abre a porta e o healthcheck retorna "service unavailable".
- **Correção aplicada:** Migração executada **dentro** do callback de `server.listen()`, para que a porta suba primeiro e `/health` responda imediatamente.

### 1.2 Uso de Baileys (não-API oficial)

- **Situação:** O projeto usa **@whiskeysockets/baileys** (conexão não-oficial via WhatsApp Web).
- **Riscos:** Bloqueios da Meta, instabilidade, mudanças não documentadas, violação de ToS.
- **Recomendação:** Para produção e escala, migrar para **WhatsApp Cloud API** (ou BSP oficial). Baileys serve bem para MVP/protótipo; para "100% estável" e compliance, a API oficial é o caminho.

### 1.3 Persistência e perda de mensagens

- **Pontos de falha comuns:**
  - Salvar mensagem só após processar (se o processo cair no meio, perde).
  - Sem fila: envio direto; falha = mensagem perdida.
  - Sem idempotência em webhook: reprocessamento duplica efeitos.
- **No código atual:** Há salvamento em SQLite e fila em memória (queueService). Em restart, a fila em memória é perdida; apenas itens persistidos em `message_queue` sobrevivem.

### 1.4 Reconexão e retry

- **Atual:** Reconexão automática do Baileys com limite de tentativas e delay.
- **Faltando:** Backoff exponencial, limite máximo de tentativas, alertas (log/métricas) e opção de dead-letter após N falhas.

### 1.5 Multi-tenant

- **Atual:** Uma sessão fixa (`self_whatsapp_session`), sem isolamento por tenant.
- **Para multi-tenant:** É necessário tenant_id em leads/conversas/mensagens, sessão ou número por tenant (Cloud API: um app pode ter vários números) e isolamento de dados e filas por tenant.

### 1.6 Segurança

- **Já tratado:** CORS, rate limit, JWT, aviso de secrets em produção.
- **Reforçar:** Validar assinatura de webhooks (Cloud API), não expor tokens no front, rate limit por tenant e sanitização de entrada em todas as rotas.

---

## 2. Arquitetura recomendada

### 2.1 Visão geral

```
                    ┌─────────────────────────────────────────────────────────┐
                    │                     FRONTEND (SPA)                       │
                    │  Dashboard | Inbox | Fluxos | Configurações | WhatsApp   │
                    └─────────────────────────────┬─────────────────────────────┘
                                                  │ HTTPS / WSS
                    ┌─────────────────────────────▼─────────────────────────────┐
                    │                      API GATEWAY                           │
                    │  Auth (JWT) | Rate Limit | CORS | Validação                │
                    └─────────────────────────────┬─────────────────────────────┘
                                                  │
    ┌─────────────────────────────────────────────┼─────────────────────────────────────────────┐
    │                                             │                      BACKEND                  │
    │  ┌──────────────┐  ┌──────────────┐  ┌──────▼──────┐  ┌──────────────┐  ┌──────────────┐  │
    │  │ WhatsApp     │  │ Webhook      │  │ Message     │  │ Flow         │  │ Queue        │  │
    │  │ Connector    │  │ Handler      │  │ Service     │  │ Engine       │  │ Worker       │  │
    │  │ (Cloud API   │  │ (recebe      │  │ (persiste   │  │ (bot,        │  │ (envio       │  │
    │  │ ou Baileys)  │  │ eventos)     │  │ + enfileira)│  │ fluxos)      │  │ assíncrono)  │  │
    │  └──────┬───────┘  └──────┬───────┘  └──────┬──────┘  └──────┬───────┘  └──────┬───────┘  │
    │         │                  │                  │                 │                  │        │
    │         └──────────────────┴──────────────────┴────────────────┴──────────────────┘        │
    │                                            │                                                 │
    │  ┌─────────────────────────────────────────▼─────────────────────────────────────────────┐  │
    │  │                    FILA (BullMQ + Redis ou RabbitMQ)                                  │  │
    │  │  incoming_messages | outgoing_messages | webhooks | flow_steps                        │  │
    │  └─────────────────────────────────────────┬─────────────────────────────────────────────┘  │
    │                                            │                                                 │
    │  ┌─────────────────────────────────────────▼─────────────────────────────────────────────┐  │
    │  │  PostgreSQL (principal)  │  Redis (cache/sessão/fila)  │  S3/Storage (mídia)           │  │
    │  └───────────────────────────────────────────────────────────────────────────────────────┘  │
    └─────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Estrutura de pastas sugerida (backend)

```
server/
├── src/
│   ├── app.js                    # Express + middlewares
│   ├── server.js                 # listen + init (migrate após listen)
│   ├── config/
│   │   ├── database.js
│   │   ├── redis.js
│   │   └── whatsapp.js
│   ├── modules/
│   │   ├── auth/
│   │   ├── tenants/
│   │   ├── leads/
│   │   ├── conversations/
│   │   ├── messages/
│   │   ├── flows/
│   │   ├── webhooks/
│   │   └── whatsapp/             # Connector (Cloud API ou Baileys)
│   ├── jobs/                     # Workers das filas
│   │   ├── incoming-message.job.js
│   │   ├── outgoing-message.job.js
│   │   └── webhook-delivery.job.js
│   ├── queues/
│   │   ├── incoming.queue.js
│   │   ├── outgoing.queue.js
│   │   └── webhooks.queue.js
│   ├── services/
│   │   ├── message.service.js
│   │   ├── flow-engine.service.js
│   │   └── media.service.js
│   ├── middleware/
│   └── utils/
├── database/
│   ├── migrations/
│   └── schema.sql
└── tests/
```

### 2.3 Responsabilidades

| Componente        | Responsabilidade |
|-------------------|------------------|
| **Webhook Handler** | Receber eventos da API do WhatsApp; validar assinatura; enfileirar evento (não processar pesado na thread do webhook). |
| **Message Service** | Persistir mensagem (entrada/saída/status) em DB; enfileirar para bot/envio. |
| **Queue Worker**    | Consumir fila; chamar Flow Engine ou enviar mensagem; retry com backoff; dead-letter após N falhas. |
| **Flow Engine**     | Estados do usuário, regras, respostas automáticas, integração opcional com IA. |
| **WhatsApp Connector** | Envio via Cloud API (ou Baileys); um módulo por canal para facilitar troca futura. |

---

## 3. Fluxo completo de mensagens

### 3.1 Mensagem recebida (entrada)

```
WhatsApp (Cloud API) → POST /webhook
  → Validar assinatura
  → Persistir evento/mensagem no DB (status: received)
  → Enfileirar job: incoming_message
  → Responder 200 rápido (< 5s)

Worker (incoming_message):
  → Buscar mensagem no DB
  → Atualizar lead/contato
  → Se conversa tem fluxo ativo → Flow Engine (próximo nó)
  → Se trigger (ex.: palavra-chave) → Flow Engine (iniciar fluxo)
  → Gerar resposta (bot ou template)
  → Enfileirar job: outgoing_message
  → Disparar webhooks externos (opcional)
```

### 3.2 Mensagem enviada (saída)

```
API ou Bot → Message Service
  → Persistir no DB (status: pending)
  → Enfileirar job: outgoing_message

Worker (outgoing_message):
  → Chamar WhatsApp API (ou Baileys)
  → Atualizar status no DB (sent/failed)
  → Se falha → retry com backoff (até N vezes)
  → Atualizar status (delivered/read) via webhook de status
```

### 3.3 Status: sent, delivered, read, failed

- **Webhook da API:** Eventos de status (sent, delivered, read, failed) chegam no mesmo webhook.
- **Fluxo:** Handler persiste o evento e atualiza a linha da mensagem no DB (e opcionalmente notifica front via WebSocket).
- **Modelo:** Campos como `status`, `sent_at`, `delivered_at`, `read_at`, `failed_reason` na tabela de mensagens.

### 3.4 Mídia (áudio, imagem, documento)

- **Recebimento:** URL da mídia no payload do webhook → download assíncrono (job) → salvar em S3/storage → guardar URL no DB.
- **Envio:** Mensagem com tipo (image/document/audio) e URL ou buffer; connector usa a API de mídia do WhatsApp.
- **Persistência:** Tabela `media` ou colunas `media_url`, `media_type`, `media_mime_type` em `messages`.

---

## 4. Modelo de banco de dados (resumido)

- **tenants** – id, name, settings (json), whatsapp_phone_id, whatsapp_token_encrypted, created_at.
- **users** – id, tenant_id, email, password_hash, role, ...
- **leads** – id, tenant_id, phone, name, metadata, last_message_at, ...
- **conversations** – id, tenant_id, lead_id, status, assigned_to, is_bot_active, current_flow_id, current_flow_step, ...
- **messages** – id, tenant_id, conversation_id, message_id (WhatsApp), direction (in/out), content, content_encrypted, media_type, media_url, status (pending/sent/delivered/read/failed), sent_at, delivered_at, read_at, failed_reason, ...
- **flows** – id, tenant_id, name, trigger_type, trigger_value, nodes (json), edges (json), is_active.
- **flow_executions** – id, flow_id, conversation_id, current_node, variables (json), status, started_at, completed_at.
- **message_queue** – id, tenant_id, lead_id, content, media_*, status, scheduled_at, attempts, max_attempts, error_message.
- **webhooks** – id, tenant_id, url, events (json), secret, is_active.
- **webhook_logs** – id, webhook_id, event, payload, response_status, duration_ms.

Índices: tenant_id onde houver; (conversation_id, created_at) em messages; (tenant_id, status) em message_queue; message_id (WhatsApp) único por tenant.

---

## 5. Estratégia de bot conversacional

### 5.1 Conceitos

- **Fluxo:** Grafo de nós (trigger, message, condition, wait, delay, transfer, tag, end).
- **Estado do usuário:** `current_flow_id` + `current_flow_step` (ou node_id) em `conversations`; variáveis em `flow_executions.variables`.
- **Gatilhos:** Palavra-chave, novo contato, horário, webhook externo.

### 5.2 Fluxo de execução

1. Mensagem chega → buscar conversa e execução ativa.
2. Se há execução ativa → nó atual é `wait`/`condition` → avaliar resposta → próximo nó (ou fim).
3. Se não há execução → buscar fluxo por gatilho (keyword/new_contact) → criar execução → executar a partir do primeiro nó.
4. Nó `message` → enfileirar envio e ir ao próximo nó.
5. Nó `wait` → parar; próxima mensagem continua.
6. Nó `condition` → ramificar por valor (opções ou regex).
7. Nó `transfer` → desativar bot, opcionalmente notificar atendente.

### 5.3 Integração com IA (opcional)

- Nó tipo "ai_reply": envia texto do usuário para um provedor (OpenAI, Claude, etc.), recebe resposta e enfileira como mensagem de saída.
- Manter contexto (últimas N mensagens) em `flow_executions.variables` ou tabela de histórico.

---

## 6. Referências de projetos (estrutura apenas)

- **whatsapp-web.js / Baileys** – Estrutura de sessão, eventos e tipos de mensagem (referência de conceitos; não substitui API oficial).
- **BotConversa / ZapVoice (conceitual)** – Fluxos visuais, inbox único, fila de envio, webhooks; inspirar fluxo de produto.
- **Twilio API** – Padrão de webhook + resposta rápida + fila de envio.
- **Meta WhatsApp Cloud API** – Documentação oficial de webhooks, assinatura, tipos de mensagem e mídia.
- **BullMQ + Redis** – Filas com retry, prioridade e jobs agendados.
- **NestJS** – Módulos, injeção de dependência e estrutura escalável (se migrar para TypeScript).

Não copiar código; usar como referência de desenho de sistemas e boas práticas.

---

## 7. Checklist final (estilo BotConversa/ZapVoice)

- [ ] **Conexão:** API oficial (Cloud API ou BSP) configurada; webhook URL válido e verificado.
- [ ] **Webhooks:** Validação de assinatura; resposta 200 em < 5s; lógica pesada em fila.
- [ ] **Persistência:** Toda mensagem (entrada/saída) salva antes de processar; status atualizados (sent/delivered/read/failed).
- [ ] **Filas:** Envio e processamento de entrada via fila; retry com backoff; dead-letter.
- [ ] **Bot:** Fluxos com estados e variáveis; gatilhos (keyword, new_contact); nós message, wait, condition, transfer.
- [ ] **Mídia:** Download e armazenamento em storage; envio com tipo e URL/buffer.
- [ ] **Multi-tenant:** tenant_id em dados; isolamento de sessão/número por tenant.
- [ ] **Segurança:** JWT, rate limit, CORS, validação de entrada; secrets em env.
- [ ] **Logs e monitoramento:** Logs estruturados; métricas (mensagens/min, falhas, fila); alertas de falha.
- [ ] **Deploy:** Healthcheck que responde antes de init pesado (listen primeiro, migrate depois); variáveis de ambiente documentadas.

---

## 8. Próximos passos práticos

1. **Imediato:** Garantir que o deploy atual passe (migração após `listen` já aplicada).
2. **Curto prazo:** Adicionar `package-lock.json` e considerar Redis + BullMQ para fila persistente.
3. **Médio prazo:** Desenhar migração para WhatsApp Cloud API (webhook oficial, envio via API, mesmo modelo de dados).
4. **Longo prazo:** Multi-tenant, storage de mídia (S3), e opção de nó de IA nos fluxos.

Documento criado para servir de guia de evolução do SELF Proteção Veicular em direção a um SaaS de WhatsApp robusto e escalável.
