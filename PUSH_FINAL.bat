@echo off
REM Script para fazer push dos commits pendentes
REM Execute este arquivo no Windows (duplo clique) ou execute no PowerShell

echo ========================================
echo PUSH FINAL - Commits para GitHub
echo ========================================
echo.

REM Verifica status
git status

echo.
echo ========================================
echo Fazendo push para origin/claude/missing-test-script-q1fos8...
echo ========================================
echo.

REM Tenta push com force
git push -u origin claude/missing-test-script-q1fos8 --force-with-lease

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo SUCESSO! Commits enviados para GitHub
    echo ========================================
    pause
) else (
    echo.
    echo ========================================
    echo ERRO ao fazer push
    echo Tente novamente ou verifique suas credenciais
    echo ========================================
    pause
)
