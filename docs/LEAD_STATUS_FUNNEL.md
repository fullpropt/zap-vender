# Lead Status and Funnel Mapping

Single source of truth for funnel stage mapping:

- `1` -> `Novo`
- `2` -> `Em Andamento`
- `3` -> `Concluido`
- `4` -> `Perdido`

Rules:

- Any lead status change must use only values `1..4`.
- Backend normalization is centralized in `server/utils/leadStatus.js`.
- Main update paths that enforce this mapping:
  - `POST /api/leads`
  - `PUT /api/leads/:id`
  - `POST /api/leads/bulk-update`
  - Flow output action `update_status` (`server/services/flowService.js`)
  - Automation status change (`change_status`) in `server/index.js`

If a status outside `1..4` is sent in create/update APIs, the backend returns `400`.
