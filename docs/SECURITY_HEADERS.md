# CORS and Security Headers

Current backend protections in `server/index.js`:

- `helmet()` enabled globally
  - `contentSecurityPolicy: false` (kept disabled due current frontend compatibility)
  - `crossOriginEmbedderPolicy: false`
- Dynamic CORS policy via `CORS_ORIGINS`
  - Supports exact origins and host matching
  - Rejects disallowed origins with CORS error
  - Allows methods: `GET, POST, PUT, DELETE, PATCH, OPTIONS`
  - Allows headers: `Content-Type, Authorization, X-Requested-With`

Operational notes:

- In production, define `CORS_ORIGINS` explicitly.
- Keep `helmet` active for all environments.
- If a stricter CSP is needed, roll out in report-only mode first to avoid frontend regressions.
