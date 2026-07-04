# Script PowerShell para fazer push dos commits pendentes
# Execute com: powershell -ExecutionPolicy Bypass -File PUSH_FINAL.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "PUSH FINAL - Commits para GitHub" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Mostra status
Write-Host "Status do repositório:" -ForegroundColor Yellow
git status

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Fazendo push para origin/claude/missing-test-script-q1fos8..." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Tenta push com force
git push -u origin claude/missing-test-script-q1fos8 --force-with-lease

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "✓ SUCESSO! Commits enviados para GitHub" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "✗ ERRO ao fazer push" -ForegroundColor Red
    Write-Host "Tente novamente ou verifique suas credenciais" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
}

Write-Host ""
Read-Host "Pressione Enter para fechar"
