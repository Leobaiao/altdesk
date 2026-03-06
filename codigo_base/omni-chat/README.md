# OmniChat (dev scaffold)
Starter kit para um sistema omnichannel (WhatsApp não-oficial + oficial), multi-agente, tickets/escalonamento, respostas rápidas e automações.
**Ambiente alvo inicial:** SQL Server Express/Dev (local). Depois migra para nuvem sem refazer.

## 0) Pré-requisitos
- Node.js 20+
- SQL Server Express (ou Docker com SQL Server Developer)
- (Opcional) Docker Desktop

## 1) Banco (SQL Server)
Crie um banco chamado `OmniChatDev` e rode os scripts na ordem:
1. `db/01-schema.sql`
2. `db/02-canned-and-automation.sql`
3. (Opcional) `db/03-seed.sql`

> Dica: no MVP, não armazene mídia pesada no DB. Guarde anexos fora (S3/Blob/Files) e salve apenas URL/metadata.

## 2) Backend
```bash
cd backend
cp .env.example .env
npm i
npm run dev
```

## 3) Frontend
```bash
cd frontend
npm i
npm run dev
```

## 4) Teste rápido (sem WhatsApp)
- Abra o frontend e envie mensagens; o backend publica via Socket.IO (modo demo).
- Depois substitua o modo demo por chamadas REST com JWT.

## 5) WhatsApp GTI (pendente de payload real)
A integração GTI está estruturada em:
- `backend/src/adapters/gti.ts`
- Webhook: `POST /api/webhooks/whatsapp/gti/:connectorId`

Para finalizar o adapter, coloque em `docs/vendors/gti/`:
- `sample-webhook-text.json`
- `sample-webhook-media.json`
- colecione/exporte no Postman: `gti-collection-v2.1.json` e `gti-environment.json`

Veja: `docs/vendors/gti/README-gti.md`.

## 6) Definição de pronto (fase 1)
- Mensagem entra via webhook GTI -> aparece no UI em tempo real -> resposta enviada via API GTI.
- ExternalThreadMap cria/resolve conversas automaticamente.
- Respostas rápidas e sugestões por automação aparecem no painel.

