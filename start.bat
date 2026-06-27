@echo off
title FinancePro — Servidor Local
color 0A
echo.
echo  FinancePro - Iniciando servidor local...
echo  =========================================
echo.

REM Tenta Python 3
python --version >nul 2>&1
if %errorlevel% == 0 (
    echo  [OK] Python encontrado. Iniciando servidor...
    echo.
    echo  Acesse: http://localhost:8080
    echo  Para parar: feche esta janela ou pressione Ctrl+C
    echo.
    start http://localhost:8080
    python -m http.server 8080
    goto end
)

REM Tenta Python via py launcher
py --version >nul 2>&1
if %errorlevel% == 0 (
    echo  [OK] Python encontrado (py). Iniciando servidor...
    echo.
    echo  Acesse: http://localhost:8080
    echo.
    start http://localhost:8080
    py -m http.server 8080
    goto end
)

REM Tenta Node.js / npx serve
npx --version >nul 2>&1
if %errorlevel% == 0 (
    echo  [OK] Node.js encontrado. Iniciando servidor HTTP sem cache via npx http-server...
    echo.
    echo  Acesse: http://localhost:8080
    echo.
    start http://localhost:8080
    REM usa http-server com cache desativado (-c-1) para evitar servir assets antigos
    npx http-server -c-1 -p 8080 .
    goto end
)

REM Nenhuma opção encontrada
echo  [ERRO] Python e Node.js nao encontrados.
echo.
echo  Instale uma das opcoes abaixo e tente novamente:
echo    Python: https://python.org/downloads
echo    Node.js: https://nodejs.org
echo.
pause
:end
