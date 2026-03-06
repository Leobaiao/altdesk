# GTI (WhatsApp não-oficial) - handoff
Referência pública (overview): https://www.postman.com/gtiapi/gti-api-vip/overview

## O que colocar nesta pasta
- gti-collection-v2.1.json (export do Postman)
- gti-environment.json (export do Postman)
- sample-webhook-text.json (payload real inbound texto)
- sample-webhook-media.json (payload real inbound mídia)

## Como o dev finaliza a integração
1) Importar a collection+environment no Postman.
2) Confirmar:
   - endpoint de envio de texto
   - endpoint de envio de menu (botões)
   - headers e autenticação
3) Implementar em `backend/src/adapters/gti.ts`:
   - parseInbound() com base nos samples
   - sendText() e sendMenu() com base nas requests do Postman

## Webhook no OmniChat
`POST /api/webhooks/whatsapp/gti/:connectorId`
