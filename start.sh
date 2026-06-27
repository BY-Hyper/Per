#!/bin/bash
echo ""
echo "  FinancePro — Iniciando servidor local..."
echo "  ========================================="
echo ""

PORT=8080
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

# Tenta Python 3
if command -v python3 &>/dev/null; then
    echo "  [OK] python3 encontrado."
    echo "  Acesse: http://localhost:$PORT"
    echo "  Para parar: Ctrl+C"
    echo ""
    (sleep 1 && open "http://localhost:$PORT" 2>/dev/null || xdg-open "http://localhost:$PORT" 2>/dev/null) &
    python3 -m http.server $PORT
    exit 0
fi

# Tenta Python 2
if command -v python &>/dev/null; then
    echo "  [OK] python encontrado."
    echo "  Acesse: http://localhost:$PORT"
    (sleep 1 && open "http://localhost:$PORT" 2>/dev/null || xdg-open "http://localhost:$PORT" 2>/dev/null) &
    python -m SimpleHTTPServer $PORT
    exit 0
fi

# Tenta Node.js
if command -v npx &>/dev/null; then
    echo "  [OK] Node.js encontrado."
    echo "  Acesse: http://localhost:$PORT"
    (sleep 1 && open "http://localhost:$PORT" 2>/dev/null || xdg-open "http://localhost:$PORT" 2>/dev/null) &
    npx serve -l $PORT .
    exit 0
fi

echo "  [ERRO] Python e Node.js nao encontrados."
echo ""
echo "  Instale Python (https://python.org) ou Node.js (https://nodejs.org)"
echo ""
