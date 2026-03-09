# API Limits

This document summarizes hard limits currently enforced by the backend.

## Leads

- `POST /api/leads/bulk`
  - Maximum `1000` leads per request.
  - Error response when exceeded: `400` with `Quantidade maxima por lote: 1000`.

## Campaigns

- `GET /api/campaigns/:id/recipients`
  - Query `limit` is clamped to `1..1000`.
  - Default when omitted: `200`.

## AI Flow Draft

- `POST /api/ai/flows/generate`
  - Prompt maximum length: `5000` characters.

## WhatsApp Send

- `POST /api/send`
- `POST /api/messages/send`
- Queue worker dispatch (campaigns/flows that call `sendMessage`)
  - Per-session throttle is enforced in the send path.
  - Default: `30` messages per minute per `session_id`.
  - Environment controls:
    - `WHATSAPP_SESSION_RATE_LIMIT_ENABLED=true`
    - `WHATSAPP_SESSION_RATE_LIMIT_MAX_PER_MINUTE=30`

## Notes

- Additional business limits may come from plan settings (for example queue delay and max messages per minute by owner).
- Keep this file updated whenever a route limit is changed in `server/index.js`.
