# simulate_inbound_email.ps1
# Script para simular o recebimento de um e-mail via webhook (Padrão SendGrid Inbound Parse)

$ConnectorId = "EMAIL_DEV_CONNECTOR"
$WebhookUrl = "http://localhost:3005/api/webhooks/email/$ConnectorId"

$Body = @{
    from = "cliente@exemplo.com"
    to = "suporte@altdesk.dev"
    subject = "Dúvida sobre o meu pedido #1234"
    text = "Olá equipe, gostaria de saber o status do meu pedido. Obrigado!"
    html = "<p>Olá equipe,</p><p>Gostaria de saber o status do meu pedido.</p><p>Obrigado!</p>"
    headers = "Message-ID: <abc-$([guid]::NewGuid().ToString())@exemplo.com>"
} | ConvertTo-Json

Write-Host "`n--- Simulação de E-mail Inbound ---" -ForegroundColor Cyan
Write-Host "Enviando para: $WebhookUrl"

try {
    $Response = Invoke-RestMethod -Uri $WebhookUrl -Method Post -Body $Body -ContentType "application/json"
    Write-Host "`n[SUCESSO] Webhook aceito pelo backend!" -ForegroundColor Green
    $Response | Format-List
}
catch {
    Write-Host "`n[ERRO] Falha ao enviar webhook: $_" -ForegroundColor Red
    if ($_.Exception.Response) {
        $Reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $ErrorDetail = $Reader.ReadToEnd()
        Write-Host "Detalhes do erro: $ErrorDetail" -ForegroundColor Yellow
    }
}

Write-Host "`nVerifique o Dashboard do AltDesk ou o MailHog (http://localhost:8025) para ver o resultado.`n" -ForegroundColor Gray
