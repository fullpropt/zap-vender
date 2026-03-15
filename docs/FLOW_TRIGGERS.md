# Flow Triggers (Current Availability)

Available trigger types for flows:

- `new_contact`
- `keyword`
- `manual`

Not available yet:

- `webhook` trigger via HTTP start endpoint

Current behavior:

- API rejects `trigger_type=webhook` in `POST /api/flows` and `PUT /api/flows/:id` with `400`.
- This avoids creating flows with an unsupported trigger expectation.
