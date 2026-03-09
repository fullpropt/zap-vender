# Metrics Endpoint

Prometheus-style metrics endpoint:

- `GET /metrics`

Environment:

- `METRICS_ENABLED=false` (default)
- `METRICS_BEARER_TOKEN=` (optional; if set, requires `Authorization: Bearer <token>` or `?token=<token>`)

Current exported metrics:

- `zapvender_process_uptime_seconds`
- `zapvender_whatsapp_sessions_total`
- `zapvender_whatsapp_sessions_connected`
- `zapvender_queue_pending_messages`
- `zapvender_queue_processing_messages`
- `zapvender_queue_sent_messages`
- `zapvender_queue_failed_messages`
- `zapvender_flow_executions_running`

Suggested alert starters:

- Queue backlog too high (`zapvender_queue_pending_messages`)
- No connected WhatsApp sessions (`zapvender_whatsapp_sessions_connected == 0`)
- Running flows stuck high for long period (`zapvender_flow_executions_running`)
