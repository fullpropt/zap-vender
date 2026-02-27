# Integracao de Cadastro + Confirmacao de Email (Pagina de Vendas)

Este projeto ja esta preparado no backend para o fluxo de cadastro com confirmacao de email, sem depender de alteracao imediata na pagina de vendas.

## Endpoints publicos prontos

1. `POST /api/auth/register`

- Objetivo: criar conta e disparar email de confirmacao.
- Body:

```json
{
  "name": "Nome do cliente",
  "email": "cliente@dominio.com",
  "password": "senha_com_6_ou_mais"
}
```

- Resposta de sucesso: `201` (novo cadastro) ou `200` (reenvio para conta pendente).

2. `POST /api/auth/resend-confirmation`

- Objetivo: reenviar email de confirmacao para conta ainda nao confirmada.
- Body:

```json
{
  "email": "cliente@dominio.com"
}
```

3. `GET /api/auth/confirm-email?token=...`

- Objetivo: validar o token e confirmar email da conta.
- Resposta de sucesso: `200`.

## Fluxo sugerido para o frontend da pagina de vendas

1. Enviar cadastro para `POST /api/auth/register`.
2. Exibir mensagem: "Verifique seu email para confirmar o cadastro".
3. Na tela "nao recebi o email", chamar `POST /api/auth/resend-confirmation`.
4. Ao clicar no link recebido por email, confirmar com `GET /api/auth/confirm-email?token=...`.
5. Depois da confirmacao, redirecionar para login.

## Variaveis de ambiente necessarias

- `APP_URL` (ou `FRONTEND_URL`): URL base usada para montar o link de confirmacao.
- `MAILMKT_URL`: base da integracao de email.
- `MAILMKT_INTEGRATION_API_KEY`: chave de autenticacao da integracao de email.
- `CORS_ORIGINS`: incluir o dominio da pagina de vendas se ela estiver em dominio diferente da API.

## Observacoes

- Os endpoints acima sao publicos (nao exigem JWT).
- Se o email ja estiver confirmado, `resend-confirmation` retorna sucesso informando que a conta ja pode fazer login.
- Se houver falha no provedor de email, a API retorna `EMAIL_CONFIRMATION_SEND_FAILED`.
