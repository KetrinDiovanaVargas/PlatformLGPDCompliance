# Script para aplicar os patches dos 6 commits
# Execute este script no seu repositório local no Windows

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Aplicando 6 commits via PATCH" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Criar pasta para os patches se não existir
$patchDir = ".\patches"
if (-not (Test-Path $patchDir)) {
    New-Item -ItemType Directory -Path $patchDir | Out-Null
    Write-Host "Pasta 'patches' criada" -ForegroundColor Yellow
}

# Listar patches
$patches = Get-ChildItem $patchDir -Filter "*.patch" -ErrorAction SilentlyContinue

if ($patches.Count -eq 0) {
    Write-Host "Erro: Nenhum arquivo .patch encontrado em ./patches/" -ForegroundColor Red
    Write-Host ""
    Write-Host "Faça o download dos arquivos patch first:" -ForegroundColor Yellow
    Write-Host "  0001-Implementar-componente-de-Matriz-de-Confus*.patch"
    Write-Host "  0002-Adicionar-instru-es-para-resolver-erro-403*.patch"
    Write-Host "  0003-Adicionar-relat-rio-de-diagn-stico*.patch"
    Write-Host "  0004-Adicionar-scripts-de-push*.patch"
    Write-Host "  0005-Adicionar-instru-es-claras*.patch"
    Write-Host "  0006-Adicionar-STATUS_FINAL*.patch"
    Write-Host ""
    Read-Host "Pressione Enter para sair"
    exit 1
}

Write-Host "Encontrados $($patches.Count) patches" -ForegroundColor Green
Write-Host ""

# Aplicar cada patch
$count = 0
foreach ($patch in $patches | Sort-Object Name) {
    $count++
    Write-Host "[$count/$($patches.Count)] Aplicando: $($patch.Name)" -ForegroundColor Yellow

    git apply $patch.FullName

    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✓ Sucesso" -ForegroundColor Green
    } else {
        Write-Host "  ✗ Erro ao aplicar patch" -ForegroundColor Red
        Read-Host "Pressione Enter para sair"
        exit 1
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "✓ Todos os 6 commits foram aplicados!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# Mostrar o que foi adicionado
Write-Host "Arquivos criados:" -ForegroundColor Yellow
git status --short

Write-Host ""
Write-Host "Próximo passo: Fazer commit dos changes"
Write-Host "  git add ."
Write-Host "  git commit -m 'Adicionar componente Matriz de Confusão para LGPD'"
Write-Host ""

Read-Host "Pressione Enter para fechar"
