#!/bin/bash

# Script para fazer push dos 9 commits para GitHub
# Execute no Git Bash ou terminal Linux/Mac

echo "=========================================="
echo "FAZENDO PUSH DOS 9 COMMITS"
echo "=========================================="
echo ""

# Verifica se está em um repositório git
if [ ! -d .git ]; then
    echo "❌ Erro: Não está em um repositório git"
    echo "Certifique-se de estar na pasta do repositório"
    exit 1
fi

echo "📍 Repositório: $(pwd)"
echo "📍 Branch: $(git branch --show-current)"
echo ""

# Tenta fazer push
echo "🚀 Tentando fazer push..."
echo ""

git push -u origin claude/missing-test-script-q1fos8 -v

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ SUCESSO! Os 9 commits foram enviados para GitHub"
    echo ""
    echo "Verifique em:"
    echo "https://github.com/KetrinDiovanaVargas/PlatformLGPDCompliance"
else
    echo ""
    echo "❌ Erro ao fazer push"
    echo ""
    echo "Tente manualmente:"
    echo "  git push -u origin claude/missing-test-script-q1fos8"
    echo ""
    echo "Se pedir credenciais, use:"
    echo "  Username: seu email do GitHub"
    echo "  Password: seu personal access token (ou senha)"
fi
