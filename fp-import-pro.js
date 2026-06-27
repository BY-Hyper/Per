/* ═══════════════════════════════════════════════════════════
   FinancePro — Import/Export Pro v1.0
   ───────────────────────────────────────────────────────────
   Camada inteligente de importação/exportação que ESTENDE
   (não substitui) o sistema existente.

   FEATURES:
     • Parser universal: CSV, TSV, Excel (.xlsx/.xls), OFX, QIF, JSON, PDF
     • Auto-detecção de delimitador, encoding, header, banco
     • Auto-mapeamento de colunas com IA (data, valor, descrição, tipo)
     • Parse inteligente de valores monetários (BR, US, EU)
     • Aplicação combinada: Regras → Classifier → LocalAI → keywords
     • Deduplicação com hash robusto (data + valor + descrição normalizada)
     • Edição em lote no preview (selecionar várias → aplicar categoria/conta)
     • Aprendizado contínuo: treina LocalAI + sugere regras automáticas
     • Export multi-formato: CSV, XLSX, JSON, PDF, com filtros e criptografia

   Encapsulado em window.FP_IMPORT_PRO. Zero alterações no app.js.
═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ────── helpers ────── */
  const T = (m, t = 'info', ms = 3500) => typeof window.toast === 'function' && window.toast(m, t, ms);
  const $ = id => document.getElementById(id);
  const esc = s => String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtMoney = v => typeof window.fmtCurrency === 'function' ? window.fmtCurrency(v) :
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
  const today = () => new Date().toISOString().split('T')[0];
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

  function normalizeDescription(description, isBradesco = false) {
    const text = String(description || '').trim();
    if (!text) return '';
    let cleaned = text.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();

    // Para Bradesco, preserva mais informações
    if (isBradesco) {
      // Padroniza formatos
      cleaned = cleaned.replace(/\s*-\s*/g, ' - ').replace(/\s+/g, ' ').trim();
      // Remove apenas caracteres de controle
      cleaned = cleaned.replace(/[\r\n]+/g, ' ').trim();
      return cleaned || text;
    }

    // Preserve Pix descriptions that only include a numeric identifier.
    if (/transfer[eê]ncia\s+pix/i.test(cleaned) || (/pix/i.test(cleaned) && /-\s*\d+/.test(cleaned))) {
      cleaned = cleaned.replace(/\s*-\s*/g, ' - ').replace(/\s+/g, ' ').replace(/ - $/, '').trim();
      return cleaned;
    }

    if (/Transferência (?:enviada|recebida) pelo Pix/i.test(cleaned) || /Compra no débito via/i.test(cleaned)) {
      cleaned = cleaned.replace(/\s*-\s*/g, ' - ').replace(/\s+/g, ' ').replace(/ - $/, '').trim();
      return cleaned;
    }

    cleaned = cleaned.replace(/\b(?:pix|ted|doc|transferencia|transferência|pagamento|pagto|compra|debito|débito|credito|crédito|boleto|fatura|qrcode|qr code|online|presencial|estatico|estático|dinamico|dinâmico|agendado|programado|em conta|estorno|devolução|devolucao)\b/gi, ' ');
    cleaned = cleaned.replace(/\d{6,}/g, ' ');
    cleaned = cleaned.replace(/\d{2}[\/\-.]\d{2}([\/\-.]\d{2,4})?/g, ' ');
    cleaned = cleaned.replace(/[-–—]{2,}/g, ' ');
    cleaned = cleaned.replace(/[()\[\]{}]/g, ' ');
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    if (/^[\-\s]+$/.test(cleaned)) return text.replace(/\s+/g, ' ').trim();
    return cleaned || text;
  }

  function extractPayee(description, bankHint) {
    if (!description) return null;
    const source = String(description || '').trim();
    const isBradesco = bankHint?.id === 'bradesco';

    // Para Bradesco, extrai o tipo de transação
    if (isBradesco) {
      const patterns = [
        /^(?:PIX|Pix)\s*-\s*(.+)$/,
        /^(Salário|Transferência|Pagamento|Rendimentos|Serviço|Saque|Câmbio|Imposto|Devolução|Cartão).*/i,
        /^([A-Za-zÀ-ÿ\s]+?)(?:\s*-|$)/
      ];
      for (const pattern of patterns) {
        const match = source.match(pattern);
        if (match) return (match[1] || source).trim().substring(0, 120);
      }
      return source.substring(0, 120);
    }

    const pixHeaderMatch = source.match(/^(transfer[eê]ncia\s+pix)/i);
    if (pixHeaderMatch) return pixHeaderMatch[1].toUpperCase().trim().substring(0, 120);
    const pixMatch = source.match(/Transferência (?:enviada|recebida) pelo Pix - ([^-]+?)(?: - |$)/i);
    if (pixMatch) return pixMatch[1].trim().substring(0, 120);
    const debitMatch = source.match(/Compra no débito via [^-]+ - (.+)$/i);
    if (debitMatch) return debitMatch[1].trim().substring(0, 120);
    const payMatch = source.match(/Pagamento de (.+?)(?: - |$)/i);
    if (payMatch) return payMatch[1].trim().substring(0, 120);
    const NOISE = /^(PIX|TED|DOC|TRANSF(?:ERENCIA)?|TRANSFERÊNCIA|PAGTO|PAGAMENTO|COMPRA|DEBITO|DÉBITO|CREDITO|CRÉDITO|CARTAO|CARTÃO|FATURA|BOLETO|AGENDADO|PROGRAMADO|ONLINE|PRESENCIAL|TAR|IOF|CPMF|JUR|MULTA|ESTORNO|DEVOLUÇÃO|DEVOLUCAO)\s*/gi;
    const CLEAN_WORDS = new Set([
      'pix','ted','doc','transf','transferencia','transferência','pagto','pagamento','compra','debito','débito','credito','crédito','boleto','fatura','qrcode','qr','online','presencial','estatico','estático','dinamico','dinâmico','agendado','programado','estorno','devolução','devolucao','enviado','recebido','enviada','recebida','ao','a','o','e','de','da','do','via','para','por','com','no','na','em','dois','tres','três'
    ]);
    let clean = source.replace(NOISE, '').replace(/\d{6,}/g, '').replace(/\d{2}[\/\-.]\d{2}([\/\-.]\d{2,4})?/g, '').replace(/\s+/g, ' ').trim();
    const parts = clean.split(/[^\p{L}\p{N}]+/u).filter(p => p.length >= 2 && !CLEAN_WORDS.has(p.toLowerCase()));
    if (!parts.length) return null;
    return parts.slice(0, 8).join(' ').substring(0, 120);
  }

  function formatDocumentPayee(bankHint, documentNumber) {
    if (!documentNumber) return null;
    const doc = String(documentNumber || '').trim();
    if (!doc) return null;
    if (bankHint?.id === 'bb' || bankHint?.id === 'bradesco') return `PIX ${doc}`;
    if (/pix/i.test(doc)) return doc;
    return `Documento ${doc}`;
  }

  function normalizeTransaction(tx, bankHint) {
    const isBradesco = bankHint?.id === 'bradesco';
    const description = normalizeDescription(tx.description || tx.rawDescription || '', isBradesco);
    let payee = extractPayee(description, bankHint) || '';
    if (!payee && tx.rawDocument) {
      payee = formatDocumentPayee(bankHint, tx.rawDocument) || '';
    }
    return { ...tx, description, payee };
  }

  function ready() { return window.db && window.S && window.S.user; }
  function waitApp(maxMs = 20000) {
    return new Promise((res, rej) => {
      const t0 = Date.now();
      (function loop() {
        if (ready()) return res();
        if (Date.now() - t0 > maxMs) return rej(new Error('IMPORT_PRO timeout'));
        setTimeout(loop, 250);
      })();
    });
  }

  async function getPref(k, fb = null) {
    if (typeof window.getSetting === 'function' && window.S?.user)
      return await window.getSetting(window.S.user.id, k, fb);
    return fb;
  }
  async function setPref(k, v) {
    if (typeof window.setSetting === 'function' && window.S?.user)
      await window.setSetting(window.S.user.id, k, v);
  }

  /* ═══════════════════════════════════════════════════════════
     ENCODING & FILE READING
  ═══════════════════════════════════════════════════════════ */
  const FileIO = {
    /** Lê arquivo com auto-detecção de encoding (UTF-8 vs Latin-1) */
    async readSmartText(file) {
      const buf = await file.arrayBuffer();
      // BOM UTF-8 ou UTF-16
      const u8 = new Uint8Array(buf);
      if (u8[0] === 0xEF && u8[1] === 0xBB && u8[2] === 0xBF) {
        return new TextDecoder('utf-8').decode(buf.slice(3));
      }
      if ((u8[0] === 0xFF && u8[1] === 0xFE) || (u8[0] === 0xFE && u8[1] === 0xFF)) {
        return new TextDecoder('utf-16').decode(buf);
      }
      // Tenta UTF-8 strict, se der replacement chars, tenta latin1
      try {
        const utf8 = new TextDecoder('utf-8', { fatal: true }).decode(buf);
        return utf8;
      } catch {
        return new TextDecoder('iso-8859-1').decode(buf);
      }
    },

    async readArrayBuffer(file) { return await file.arrayBuffer(); },
    async readText(file) { return await file.text(); },
  };

  /* ═══════════════════════════════════════════════════════════
     MONEY PARSER — entende formatos diversos
       "R$ 1.234,56"  → 1234.56
       "$1,234.56"    → 1234.56
       "-R$ 50,00"    → -50.00
       "1234,56"      → 1234.56
       "1.234"        → 1234.00 (BR — sem decimais)
       "(50.00)"      → -50.00 (contábil)
  ═══════════════════════════════════════════════════════════ */
  const Money = {
    parse(input) {
      if (input == null || input === '') return null;
      if (typeof input === 'number') return input;
      let s = String(input).trim();
      if (!s) return null;

      // Sinal
      let sign = 1;
      if (s.startsWith('-') || /^\(.+\)$/.test(s)) sign = -1;
      s = s.replace(/[()\-+]/g, '');
      // Remove símbolos R$, $, €, etc.
      s = s.replace(/[R$\s€£¥₩₹ ]/gi, '');
      if (!s) return null;

      const lastDot = s.lastIndexOf('.');
      const lastComma = s.lastIndexOf(',');
      let normalized;

      if (lastComma === -1 && lastDot === -1) {
        normalized = s;
      } else if (lastComma > lastDot) {
        // BR: vírgula = decimal, ponto = milhar
        normalized = s.replace(/\./g, '').replace(',', '.');
      } else if (lastDot > lastComma) {
        // US: ponto = decimal, vírgula = milhar
        normalized = s.replace(/,/g, '');
      } else {
        normalized = s;
      }
      const n = parseFloat(normalized);
      if (isNaN(n)) return null;
      return n * sign;
    },
  };

  /* ═══════════════════════════════════════════════════════════
     DATE PARSER — entende formatos diversos
       "2024-12-31", "31/12/2024", "12/31/2024", "31-12-2024",
       "20241231", "2024.12.31", "Dec 31, 2024", "31 dez 2024"
  ═══════════════════════════════════════════════════════════ */
  const DateParse = {
    _monthsPT: { jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6, jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12 },
    _monthsEN: { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 },

    parse(input, hint = null) {
      if (!input) return null;
      const s = String(input).trim();
      if (!s) return null;

      // ISO
      let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (m) return `${m[1]}-${m[2]}-${m[3]}`;

      // YYYYMMDD
      m = s.match(/^(\d{4})(\d{2})(\d{2})/);
      if (m) return `${m[1]}-${m[2]}-${m[3]}`;

      // dd/mm/yyyy ou mm/dd/yyyy ou dd.mm.yyyy ou dd-mm-yyyy
      m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/);
      if (m) {
        let [_, a, b, y] = m;
        a = parseInt(a, 10); b = parseInt(b, 10);
        if (y.length === 2) y = (parseInt(y, 10) > 50 ? '19' : '20') + y;
        // Decisão dd/mm vs mm/dd
        let day, month;
        if (a > 12) { day = a; month = b; }
        else if (b > 12) { day = b; month = a; }
        else if (hint === 'us') { day = b; month = a; }
        else { day = a; month = b; } // default BR
        return `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }

      // "31 dez 2024" / "Dec 31, 2024"
      const lower = s.toLowerCase();
      for (const [name, n] of Object.entries({ ...this._monthsPT, ...this._monthsEN })) {
        if (lower.includes(name)) {
          const dayMatch = lower.match(/(\d{1,2})/);
          const yearMatch = lower.match(/(\d{4})/);
          if (dayMatch && yearMatch) {
            return `${yearMatch[1]}-${String(n).padStart(2, '0')}-${dayMatch[1].padStart(2, '0')}`;
          }
        }
      }

      // Última cartada: Date()
      const d = new Date(s);
      if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
      return null;
    },
  };

  /* ═══════════════════════════════════════════════════════════
     CSV PARSER — robusto, RFC 4180 + tolerante
  ═══════════════════════════════════════════════════════════ */
  const CSV = {
    /** Tenta parsear valores numéricos com heurísticas extras (vírgula decimal, separador de milhares) */
    _tryParseMoney(val) {
      if (val == null) return null;
      const s0 = String(val).trim();
      if (!s0) return null;
      // primeira tentativa: Money.parse padrão
      let n = Money.parse(s0);
      if (n != null) return n;
      // se falhou, tenta limpar espaços e NBSP
      let s = s0.replace(/\u00A0/g, ' ').trim();
      // tenta inverter pontos e vírgulas (caso delimitador/decimal confundidos)
      const swap = s.replace(/\./g, '').replace(/,/g, '.');
      n = Money.parse(swap);
      if (n != null) return n;
      // tenta remover vírgulas (milhar) e usar ponto como decimal
      const rmComma = s.replace(/,/g, '');
      n = Money.parse(rmComma);
      if (n != null) return n;
      // tenta remover pontos (milhar) e vírgula para ponto
      const rmDotComma = s.replace(/\./g, '').replace(/,/g, '.');
      n = Money.parse(rmDotComma);
      if (n != null) return n;
      return null;
    },
    detectDelimiter(text) {
      const candidates = [',', ';', '\t', '|'];
      const lines = text.split(/\r?\n/).slice(0, 10).filter(l => l.trim());
      let best = ',', bestScore = 0;
      for (const c of candidates) {
        const counts = lines.map(l => (l.match(new RegExp(c === '\t' ? '\\t' : '\\' + c, 'g')) || []).length);
        if (!counts.length) continue;
        const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
        const variance = counts.reduce((s, n) => s + Math.pow(n - avg, 2), 0) / counts.length;
        const score = avg - variance; // alta média + baixa variância = bom delim
        if (score > bestScore) { bestScore = score; best = c; }
      }
      return best;
    },

    parse(text, delimiter = null) {
      if (!delimiter) delimiter = this.detectDelimiter(text);
      const rows = [];
      let row = [], field = '', inQ = false, i = 0;
      while (i < text.length) {
        const c = text[i];
        if (inQ) {
          if (c === '"') {
            if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
            inQ = false; i++; continue;
          }
          field += c; i++;
        } else {
          if (c === '"') { inQ = true; i++; continue; }
          if (c === delimiter) { row.push(field); field = ''; i++; continue; }
          if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
          if (c === '\r') { i++; continue; }
          field += c; i++;
        }
      }
      if (field !== '' || row.length) { row.push(field); rows.push(row); }
      return rows.filter(r => r.length && r.some(x => x !== ''));
    },

    /** Encontra a linha de cabeçalho em CSVs com preâmbulo */
    findHeaderRow(rows) {
      const headerKeywords = [/\bdata\b/i, /\bhist[oó]rico\b/i, /\bdocto\.?\b/i, /\bcr[eé]dito\b/i, /\bd[eé]bito\b/i, /\bsaldo\b/i];
      for (let i = 0; i < Math.min(rows.length, 8); i++) {
        const row = rows[i].join(' ');
        const matches = headerKeywords.filter(rx => rx.test(row));
        if (matches.length >= 2) return i;
      }
      return -1;
    },

    /** Remove preâmbulo e traz o cabeçalho para a primeira linha */
    normalizeRows(rows) {
      const headerRow = this.findHeaderRow(rows);
      if (headerRow > 0) {
        return rows.slice(headerRow);
      }
      return rows;
    },

    /** Detecta se a primeira linha é cabeçalho */
    hasHeader(rows) {
      if (rows.length < 2) return false;
      const headerKeywords = /(data|date|descricao|description|valor|amount|hist|memo|tipo|categoria|category|account|conta|debit|credit)/i;
      const first = rows[0].join(' ');
      const second = rows[1].join(' ');
      // Se a primeira linha tem palavras-chave e a segunda parece ter números (data ou valor), é header
      const firstHasKw = headerKeywords.test(first);
      const secondHasNum = /\d/.test(second);
      const firstHasNum = /\b\d{1,2}[\/\-.]\d{1,2}/.test(first) || /R?\$\s*\d/.test(first);
      return firstHasKw && secondHasNum && !firstHasNum;
    },

    /** Auto-mapeia colunas baseado no cabeçalho ou no conteúdo */
    autoMap(rows, hasHeader, bankHint) {
      const sample = hasHeader ? rows.slice(1, 6) : rows.slice(0, 5);
      const colCount = Math.max(...rows.map(r => r.length));
      const map = { date: -1, description: -1, description2: -1, description3: -1, amount: -1, type: -1, category: -1, account: -1, debit: -1, credit: -1 };
      const bankId = bankHint?.id;

      const assignField = (field, idx) => {
        if (idx < 0) return;
        if (map[field] !== -1) return;
        if (field === 'description2' && idx === map.description) return;
        if (field === 'description3' && (idx === map.description || idx === map.description2)) return;
        map[field] = idx;
      };

      const bankHeaderRules = {
        itau: [
          { rx: /^(data|date|dt|fecha)$/i, field: 'date' },
          { rx: /^(hist[oó]rico|historico|descri[cç][ãa]o|descricao|description|memo|nome)$/i, field: 'description' },
          { rx: /^(docto|documento|nr|n[oó]mero|numero|cod(?:igo)?|c[oó]digo)$/i, field: 'description2' },
          { rx: /^(cr[eé]dito|entrada)$/i, field: 'credit' },
          { rx: /^(d[eé]bito|sa[ií]da|debito)$/i, field: 'debit' },
          { rx: /^(valor|amount|amt|montante)$/i, field: 'amount' },
          { rx: /^(tipo|tipo de|transaction|transa[cç][ãa]o)$/i, field: 'type' },
          { rx: /^(conta|account|acct)$/i, field: 'account' },
        ],
        santander: [
          { rx: /^(data|date|dt)$/i, field: 'date' },
          { rx: /^(hist[oó]rico|hist|descri[cç][ãa]o|descricao|description|memo)$/i, field: 'description' },
          { rx: /^(cr[eé]dito|entrada)$/i, field: 'credit' },
          { rx: /^(d[eé]bito|sa[ií]da|debito)$/i, field: 'debit' },
          { rx: /^(valor|amount|amt|montante)$/i, field: 'amount' },
          { rx: /^(saldo|balance)$/i, field: 'account' },
        ],
        caixa: [
          { rx: /^(data|date|dt)$/i, field: 'date' },
          { rx: /^(hist[oó]rico|historico|descri[cç][ãa]o|descricao|description|memo)$/i, field: 'description' },
          { rx: /^(cr[eé]dito|entrada)$/i, field: 'credit' },
          { rx: /^(d[eé]bito|sa[ií]da|debito)$/i, field: 'debit' },
          { rx: /^(valor|amount|amt|montante)$/i, field: 'amount' },
          { rx: /^(saldo|balance)$/i, field: 'account' },
        ],
        bb: [
          { rx: /^(data|date|dt)$/i, field: 'date' },
          { rx: /^(descri[cç][ãa]o|descricao|description|hist[oó]rico|hist|memo)$/i, field: 'description' },
          { rx: /^(cr[eé]dito|entrada)$/i, field: 'credit' },
          { rx: /^(d[eé]bito|sa[ií]da|debito)$/i, field: 'debit' },
          { rx: /^(valor|amount|amt|montante)$/i, field: 'amount' },
          { rx: /^(saldo|balance)$/i, field: 'account' },
        ],
        inter: [
          { rx: /^(data|date|dt)$/i, field: 'date' },
          { rx: /^(hist[oó]rico|historico|descri[cç][ãa]o|descricao|description|memo)$/i, field: 'description' },
          { rx: /^(documento|docto|nr|n[oó]mero|numero)$/i, field: 'description2' },
          { rx: /^(valor|amount|amt|montante)$/i, field: 'amount' },
          { rx: /^(cr[eé]dito|entrada)$/i, field: 'credit' },
          { rx: /^(d[eé]bito|sa[ií]da|debito)$/i, field: 'debit' },
        ],
        nubank: [
          { rx: /^(data|date|dt)$/i, field: 'date' },
          { rx: /^(descri[cç][ãa]o|descricao|description|memo)$/i, field: 'description' },
          { rx: /^(identificador|id|identificador)$/i, field: 'description2' },
          { rx: /^(valor|amount|amt|montante)$/i, field: 'amount' },
        ],
        bradesco: [
          { rx: /^(data|date|dt)$/i, field: 'date' },
          { rx: /^(hist[oó]rico|historico)$/i, field: 'description' },
          { rx: /^(docto|documento|nr|n[oó]mero|numero|cod(?:igo)?|c[oó]digo)$/i, field: 'description2' },
          { rx: /^(cr[eé]dito|entrada)$/i, field: 'credit' },
          { rx: /^(d[eé]bito|sa[ií]da|debito)$/i, field: 'debit' },
          { rx: /^(valor|amount|amt|montante)$/i, field: 'amount' },
        ],
      };

      // Por nome do header
      if (hasHeader) {
        const header = rows[0].map(h => norm(h));
        header.forEach((h, idx) => {
          if (bankId && bankHeaderRules[bankId]) {
            for (const rule of bankHeaderRules[bankId]) {
              if (rule.rx.test(h)) {
                assignField(rule.field, idx);
                break;
              }
            }
          }
          if (/^(data|date|dt|fecha)$/i.test(h)) assignField('date', idx);
          else if (/^(hist[oó]rico|historico)$/i.test(h)) {
            if (map.description === -1) assignField('description', idx);
            else if (map.description2 === -1) assignField('description2', idx);
            else assignField('description3', idx);
          }
          else if (/^(docto|documento|numero|número|cod(?:igo)?|código)$/i.test(h)) {
            if (map.description2 === -1) assignField('description2', idx);
            else assignField('description3', idx);
          }
          else if (/(descric|descript|hist|historico|memo|name|nome|estabel|merch)/i.test(h)) {
            if (map.description === -1) assignField('description', idx);
            else if (map.description2 === -1) assignField('description2', idx);
            else assignField('description3', idx);
          }
          else if (/(tipo|tipo de|type)/i.test(h)) assignField('type', idx);
          else if (/(categ|cat)/i.test(h)) assignField('category', idx);
          else if (/(conta|account|acct)/i.test(h)) assignField('account', idx);
          else if (/(deb|saida|exit)/i.test(h)) assignField('debit', idx);
          else if (/(cred|entrada)/i.test(h)) assignField('credit', idx);
          else if (/^(valor|amount|amt|montante)$/i.test(h)) assignField('amount', idx);
        });
      }

      const textCandidates = [];
      for (let c = 0; c < colCount; c++) {
        const col = sample.map(r => r[c] || '');
        const nonEmpty = col.filter(Boolean);
        if (!nonEmpty.length) continue;
        const datePct = nonEmpty.filter(v => DateParse.parse(v)).length / nonEmpty.length;
        const moneyPct = nonEmpty.filter(v => CSV._tryParseMoney(v) !== null && /\d/.test(v)).length / nonEmpty.length;
        if (datePct > 0.7 && map.date === -1) map.date = c;
        else if (moneyPct > 0.7 && map.amount === -1 && map.debit === -1 && map.credit === -1) map.amount = c;
        else {
          const textPct = nonEmpty.filter(v => /[a-zA-Zà-ÿ]/.test(v) && CSV._tryParseMoney(v) === null).length / nonEmpty.length;
          if (textPct > 0.4) {
            const avgWords = nonEmpty
              .map(v => String(v).trim().split(/\s+/).length)
              .reduce((a, b) => a + b, 0) / nonEmpty.length;
            textCandidates.push({ col: c, score: textPct + avgWords * 0.1, avgWords });
          }
        }
      }
      textCandidates.sort((a, b) => b.score - a.score || b.avgWords - a.avgWords);
      if (map.description === -1 && textCandidates[0]) assignField('description', textCandidates[0].col);
      if (map.description2 === -1 && textCandidates[1]) assignField('description2', textCandidates[1].col);
      if (map.description3 === -1 && textCandidates[2]) assignField('description3', textCandidates[2].col);
      return map;
    },

    /** Converte rows + map em objetos transação */
    toTransactions(rows, map, hasHeader, bankHint) {
      const data = hasHeader ? rows.slice(1) : rows;
      const out = [];
      for (const r of data) {
        const date = map.date >= 0 ? DateParse.parse(r[map.date]) : null;
        if (!date) continue;
        let amount = null, type = 'expense';
        if (map.debit >= 0 || map.credit >= 0) {
          const deb = map.debit >= 0 ? CSV._tryParseMoney(r[map.debit]) : null;
          const cred = map.credit >= 0 ? CSV._tryParseMoney(r[map.credit]) : null;
          if (deb && deb !== 0) { amount = Math.abs(deb); type = 'expense'; }
          else if (cred && cred !== 0) { amount = Math.abs(cred); type = 'income'; }
          else if (bankHint?.id === 'santander' && map.amount >= 0) {
            amount = CSV._tryParseMoney(r[map.amount]);
            if (amount != null) type = amount < 0 ? 'expense' : 'income';
          }
        } else if (map.amount >= 0) {
          amount = CSV._tryParseMoney(r[map.amount]);
          if (amount == null) continue;
          if (amount < 0) { type = 'expense'; amount = Math.abs(amount); }
          else { type = 'income'; }
        }
        if (amount == null || amount === 0) continue;
        // Type explícito sobrescreve sinal
        if (map.type >= 0 && r[map.type]) {
          const t = norm(r[map.type]);
          if (/(receita|income|cred|entrada|in)/.test(t)) type = 'income';
          else if (/(despesa|expense|deb|saida|out|payment)/.test(t)) type = 'expense';
        }
        const parts = [];
        if (map.description >= 0) parts.push(String(r[map.description] || '').trim());
        if (map.description2 >= 0 && map.description2 !== map.description) parts.push(String(r[map.description2] || '').trim());
        if (map.description3 >= 0 && map.description3 !== map.description && map.description3 !== map.description2) parts.push(String(r[map.description3] || '').trim());
        let description = parts.filter(Boolean).join(' - ').trim();
        if (!description && map.description2 >= 0 && map.description2 !== map.description && String(r[map.description2] || '').trim()) {
          description = String(r[map.description2] || '').trim();
        }
        if (!description && bankHint?.id === 'nubank' && map.description >= 0) {
          description = String(r[map.description] || '').trim();
        }
        const rawDocument = map.description2 >= 0 ? String(r[map.description2] || '').trim() : '';
        if (/COD\.?\s*LANC\.?\s*0/i.test(description) || /saldo inicial/i.test(description)) continue;
        const normalized = normalizeTransaction({ description, rawDescription: description, rawDocument }, bankHint);
        out.push({
          date,
          amount,
          type,
          description: normalized.description,
          payee: normalized.payee,
          rawDescription: description,
          rawDocument,
          rawCategory: map.category >= 0 ? String(r[map.category] || '').trim() : '',
          rawAccount: map.account >= 0 ? String(r[map.account] || '').trim() : '',
        });
      }
      return out;
    },
  };

  /* ═══════════════════════════════════════════════════════════
     OFX & QIF PARSERS
  ═══════════════════════════════════════════════════════════ */
  const OFX = {
    parse(text) {
      const out = [];
      // Aceita SGML simples (sem fechamento)
      const blocks = text.match(/<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi) ||
                     text.match(/<STMTTRN>([\s\S]*?)(?=<STMTTRN>|<\/BANKTRANLIST>)/gi);
      if (!blocks) return out;
      for (const blk of blocks) {
        const get = tag => {
          const m = blk.match(new RegExp(`<${tag}>([^\\n<]+)`, 'i'));
          return m ? m[1].trim() : '';
        };
        const dt = get('DTPOSTED');
        const amt = parseFloat(get('TRNAMT'));
        const name = get('NAME') || get('MEMO');
        const fitid = get('FITID');
        const trntype = get('TRNTYPE');
        const date = dt ? `${dt.substring(0, 4)}-${dt.substring(4, 6)}-${dt.substring(6, 8)}` : null;
        if (!date || isNaN(amt)) continue;
        const normalized = normalizeTransaction({ description: name, rawDescription: name });
        out.push({
          date,
          amount: Math.abs(amt),
          type: amt < 0 || /DEBIT|PAYMENT|CHECK/i.test(trntype) ? 'expense' : 'income',
          description: normalized.description,
          payee: normalized.payee,
          rawCategory: '',
          rawAccount: '',
          fitid,
        });
      }
      return out;
    },
  };

  const QIF = {
    parse(text) {
      const out = [];
      const blocks = text.split(/\n\^\n?/);
      for (const blk of blocks) {
        const lines = blk.split(/\r?\n/);
        let date = null, amount = null, desc = '', cat = '';
        for (const line of lines) {
          const tag = line[0];
          const val = line.substring(1).trim();
          if (tag === 'D') date = DateParse.parse(val);
          else if (tag === 'T' || tag === 'U') amount = Money.parse(val);
          else if (tag === 'P' || tag === 'M') desc = val;
          else if (tag === 'L') cat = val;
        }
        if (date && amount != null && amount !== 0) {
          const normalized = normalizeTransaction({ description: desc, rawDescription: desc });
          out.push({
            date,
            amount: Math.abs(amount),
            type: amount < 0 ? 'expense' : 'income',
            description: normalized.description,
            payee: normalized.payee,
            rawCategory: cat,
            rawAccount: '',
          });
        }
      }
      return out;
    },
  };

  /* ═══════════════════════════════════════════════════════════
     EXCEL PARSER — usa SheetJS já carregado pelo app
  ═══════════════════════════════════════════════════════════ */
  const Excel = {
    available() { return typeof window.XLSX !== 'undefined'; },

    async parse(file) {
      if (!this.available()) throw new Error('SheetJS não está carregado.');
      const buf = await file.arrayBuffer();
      const wb = window.XLSX.read(buf, { type: 'array', cellDates: true });
      const sheetName = wb.SheetNames[0];
      const sheet = wb.Sheets[sheetName];
      const rows = window.XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });
      // Converte cell objects para string normalizada
      return rows.map(r => r.map(c => c == null ? '' : String(c)));
    },
  };

  /* ═══════════════════════════════════════════════════════════
     JSON PARSER — formatos genéricos
  ═══════════════════════════════════════════════════════════ */
  const JSONP = {
    parse(text) {
      let obj;
      try { obj = JSON.parse(text); } catch { return []; }
      // Backup do FinancePro
      if (obj.data && Array.isArray(obj.data.transactions)) return obj.data.transactions;
      // Array direto
      if (Array.isArray(obj)) return obj;
      // Genérico: procura por array de objetos
      for (const k of Object.keys(obj || {})) {
        if (Array.isArray(obj[k]) && obj[k][0] && typeof obj[k][0] === 'object') return obj[k];
      }
      return [];
    },

    /** Converte objetos genéricos em transações padronizadas */
    normalize(items) {
      const out = [];
      const findKey = (obj, ...keys) => {
        for (const k of keys) {
          for (const ok of Object.keys(obj)) {
            if (norm(ok) === norm(k)) return obj[ok];
          }
        }
        return null;
      };
      for (const it of items) {
        if (!it || typeof it !== 'object') continue;
        const date = DateParse.parse(findKey(it, 'date', 'data', 'dt', 'dtposted'));
        const amount = Money.parse(findKey(it, 'amount', 'valor', 'value', 'trnamt'));
        if (!date || amount == null) continue;
        const typeRaw = String(findKey(it, 'type', 'tipo') || '').toLowerCase();
        let type = 'expense';
        if (/(income|receita|credit|cred|entrada)/.test(typeRaw)) type = 'income';
        else if (/(transfer|transferencia)/.test(typeRaw)) type = 'transfer';
        else if (amount < 0) type = 'expense';
        else if (typeRaw === '' && amount > 0) type = 'income';
        const description = String(findKey(it, 'description', 'descricao', 'desc', 'memo', 'name') || '');
        const normalized = normalizeTransaction({ description, rawDescription: description });
        out.push({
          date,
          amount: Math.abs(amount),
          type,
          description: normalized.description,
          payee: normalized.payee,
          rawCategory: String(findKey(it, 'category', 'categoria', 'cat') || ''),
          rawAccount: String(findKey(it, 'account', 'conta') || ''),
          fitid: findKey(it, 'fitid', 'id', 'externalId'),
        });
      }
      return out;
    },
  };

  /* ═══════════════════════════════════════════════════════════
     BANK DETECTOR — descobre instituição pelo formato
  ═══════════════════════════════════════════════════════════ */
  const BankDetector = {
    detect(filename, text) {
      const fn = (filename || '').toLowerCase();
      const head = (text || '').slice(0, 2000).toLowerCase();
      const banks = [
        { id: 'nubank', name: 'Nubank', tests: [/nubank|nu_pagamentos|nuconta/i] },
        { id: 'itau', name: 'Itaú', tests: [/itau|itaú/i] },
        { id: 'bradesco', name: 'Bradesco', tests: [/bradesco/i, /Extrato de: Ag:/i, /Histórico;Docto\.;Crédito \(R\$\);Débito \(R\$\);Saldo \(R\$\)/i] },
        { id: 'santander', name: 'Santander', tests: [/santander/i] },
        { id: 'caixa', name: 'Caixa', tests: [/caixa econ|cef/i] },
        { id: 'bb', name: 'Banco do Brasil', tests: [/banco do brasil|\bbb\b/i] },
        { id: 'inter', name: 'Inter', tests: [/banco inter|interpag|inter banco/i] },
        { id: 'c6', name: 'C6 Bank', tests: [/c6 bank|c6bank|c6/i] },
        { id: 'next', name: 'Next', tests: [/\bnext\b/i] },
        { id: 'neon', name: 'Neon', tests: [/neon banco|neon/i] },
        { id: 'safra', name: 'Safra', tests: [/safra/i] },
        { id: 'picpay', name: 'PicPay', tests: [/picpay/i] },
        { id: 'mercadopago', name: 'Mercado Pago', tests: [/mercado pago|mercadopago/i] },
      ];
      for (const b of banks) {
        for (const rx of b.tests) {
          if (rx.test(fn) || rx.test(head)) return b;
        }
      }
      return null;
    },
  };

  /* ═══════════════════════════════════════════════════════════
     PARSER DISPATCHER — escolhe o parser correto
  ═══════════════════════════════════════════════════════════ */
  const Parser = {
    detectTextFormat(text, ext) {
      if (!text) return null;
      const head = String(text).slice(0, 2000).trim();
      if (/^<\?xml|<ofx>/i.test(head) || /<SIGNONMSGSRQV1>/i.test(text)) return 'ofx';
      if (/^!Type:(Bank|Cash|CC)/mi.test(text)) return 'qif';
      if (/^\s*[{[]/.test(head)) {
        try { const obj = JSON.parse(text); if (obj && (Array.isArray(obj) || typeof obj === 'object')) return 'json'; } catch (e) {}
      }
      if (ext === 'tsv') return 'csv';
      if (/\t/.test(text) && !/,/.test(text)) return 'csv';
      if (/;/.test(text) && !/,/.test(text)) return 'csv';
      return 'csv';
    },

    async parseFile(file, textOpt) {
      const name = (file.name || '').toLowerCase();
      const ext = name.split('.').pop();
      const result = { txs: [], format: null, bank: null, meta: {} };
      const isTextFile = ['csv', 'tsv', 'txt', 'json', 'qif', 'ofx', 'qfx'].includes(ext);
      const text = isTextFile ? (textOpt || await FileIO.readSmartText(file)) : null;
      if (text != null) result.meta.rawText = text;
      const detected = text != null ? Parser.detectTextFormat(text, ext) : null;

      if (detected === 'ofx' || ext === 'ofx' || ext === 'qfx') {
        const sourceText = text != null ? text : await FileIO.readSmartText(file);
        result.meta.rawText = sourceText;
        result.txs = OFX.parse(sourceText);
        result.format = 'ofx';
        result.bank = BankDetector.detect(name, sourceText);
      }
      else if (detected === 'qif' || ext === 'qif') {
        const sourceText = text != null ? text : await FileIO.readSmartText(file);
        result.meta.rawText = sourceText;
        result.bank = BankDetector.detect(name, sourceText);
        result.txs = QIF.parse(sourceText);
        result.format = 'qif';
      }
      else if (detected === 'json' || ext === 'json') {
        const sourceText = text != null ? text : await FileIO.readText(file);
        result.meta.rawText = sourceText;
        const items = JSONP.parse(sourceText);
        result.txs = JSONP.normalize(items);
        result.format = 'json';
      }
      else if (ext === 'xlsx' || ext === 'xls' || ext === 'xlsm') {
        const sourceText = text != null ? text : await FileIO.readSmartText(file);
        result.bank = BankDetector.detect(name, sourceText);
        const rows = await Excel.parse(file);
        if (!rows.length) throw new Error('Planilha vazia.');
        const hasHeader = CSV.hasHeader(rows);
        const map = CSV.autoMap(rows, hasHeader, result.bank);
        result.txs = CSV.toTransactions(rows, map, hasHeader, result.bank);
        result.format = 'excel';
        result.meta = { rows: rows.length, columns: rows[0]?.length || 0, hasHeader, map };
      }
      else {
        const sourceText = text != null ? text : await FileIO.readSmartText(file);
        result.meta.rawText = sourceText;
        result.bank = BankDetector.detect(name, sourceText);
        const delim = ext === 'tsv' ? '\t' : CSV.detectDelimiter(sourceText);
        let rows = CSV.parse(sourceText, delim);
        if (!rows.length) throw new Error('Arquivo vazio ou inválido.');
        rows = CSV.normalizeRows(rows, result.bank);
        const hasHeader = CSV.hasHeader(rows);
        const map = CSV.autoMap(rows, hasHeader, result.bank);
        result.txs = CSV.toTransactions(rows, map, hasHeader, result.bank);
        result.format = 'csv';
        result.meta = { rows: rows.length, columns: rows[0]?.length || 0, hasHeader, delimiter: delim, map, detectedFormat: detected };
      }
      if (Array.isArray(result.txs) && result.txs.length) {
        result.txs = await Enricher.enrichTransactions(result.txs, result.bank);
      }
      return result;
    },

    /** Retorna diagnósticos simples sobre o resultado do parse */
    diagnose(result) {
      const issues = [];
      if (!result) { issues.push({ code: 'no_result', message: 'Resultado vazio.' }); return issues; }
      if (!Array.isArray(result.txs) || !result.txs.length) {
        issues.push({ code: 'no_txs', message: 'Nenhuma transação encontrada.' });
        return issues;
      }
      const emptyDesc = result.txs.filter(t => !t.description || !String(t.description).trim()).length;
      if (emptyDesc / result.txs.length > 0.4) issues.push({ code: 'many_empty_descriptions', message: `${emptyDesc}/${result.txs.length} descrições vazias.` });
      const missingPayee = result.txs.filter(t => !t.payee).length;
      if (missingPayee / result.txs.length > 0.6) issues.push({ code: 'many_missing_payee', message: `${missingPayee}/${result.txs.length} sem favorecido.` });
      const zeroAmounts = result.txs.filter(t => !t.amount || Number(t.amount) === 0).length;
      if (zeroAmounts) issues.push({ code: 'zero_amounts', message: `${zeroAmounts} transações com valor zero ou inválido.` });
      return issues;
    },
  };

  const Enricher = {
    async enrichTransactions(txs, bankHint) {
      if (!Array.isArray(txs) || !txs.length) return txs;
      const enriched = txs.map(tx => {
        const normalized = normalizeTransaction(tx, bankHint);
        let result = { ...tx, description: normalized.description, payee: normalized.payee };

        // Enriquecimento PIX para Bradesco
        if (bankHint?.id === 'bradesco' && /^PIX\s*-\s*Ref:\s*(\d+)/.test(result.description)) {
          const match = result.description.match(/^PIX\s*-\s*Ref:\s*(\d+)/);
          if (match && typeof window.FP_PIX_ENRICHMENT !== 'undefined') {
            const pixCode = match[1];
            const beneficiary = window.FP_PIX_ENRICHMENT.getBeneficiary(pixCode);
            if (beneficiary) {
              result.description = `PIX para ${beneficiary}`;
              result.payee = beneficiary;
              result.pixCode = pixCode;
            }
          }
        }

        return result;
      });
      return enriched;
    },
  };

  /* ═══════════════════════════════════════════════════════════
     MEGA KEYWORD DATABASE — 600+ termos brasileiros mapeados
     Estrutura: { cat: 'NomeDaCategoria', kws: ['termo1','termo2',...], type:'expense'|'income'|'all' }
  ═══════════════════════════════════════════════════════════ */
  const MEGA_KW = [
    // ── ALIMENTAÇÃO ──────────────────────────────────────────
    { cat:'Alimentação', type:'expense', kws:['ifood','rappi','uber eats','99food','james delivery','loggi','zap delivery','marmita','lanchonete','padaria','panificadora','confeitaria','sorveteria','acai','acaí','sorvete','pastelaria','esfiharia','pizzaria','hamburgueria','hamburguer','churrascaria','rodizio','self service','buffet','bistrô','bistro','taberna','boteco','botequim','bar e restaurante','sushi','japonês','japones','chinês','chines','thai','árabe','arabe','italiano','mexicano','tex mex','fast food','mc donalds','mcdonalds','burger king','kfc','subway','bob\'s','bobs','giraffas','outback','olive garden','madero','spoleto','ragazzo','frango assado','frango','galeto','grelhado','mercado','supermercado','hipermercado','atacado','atacadão','atacadao','assai','assaí','carrefour','extra','walmart','big','makro','dia','sams club','hortifruti','sacolao','sacolão','feira','quitanda','verdureiro','frutaria','padoca','pao de acucar','pão de açúcar','zaffari','bahamas','nacional','fort atacadista','tenda','supernosso','condor','angeloni','bistek','festval','copercampos','comper','rede econômica','econômica','econocom','alimentos','alimentação','alimento','comida','refeicao','refeição','lanche','almoco','almoço','jantar','ceia','cafe','café','cafeteria','coffee','snack','bebida','agua mineral','agua','suco','refrigerante','cerveja','vinho','drinks','copos','talheres','utensilios','panela','cooking','kitchen','hortifruti','legumes','frutas','verduras','graos','graõs','proteinas','proteínas'] },
    // ── TRANSPORTE ───────────────────────────────────────────
    { cat:'Transporte', type:'expense', kws:['uber','99','cabify','indriver','lyft','taxi','táxi','mototaxi','buser','clickbus','latam','gol','tam','azul','avianca','passagem','embarque','rodoviaria','rodoviária','aeroporto','terminal','metro','metrô','trem','onibus','ônibus','lotacao','lotação','vlt','monorail','brt','bilhete unico','bilhete único','bilhete','cartao transporte','combustivel','combustível','gasolina','etanol','alcool','álcool','diesel','arla','posto','ipiranga','shell','br distribuidora','petrobras','raizen','redefort','rede','carro','veiculo','veículo','automovel','automóvel','manutencao','manutenção','revisao','revisão','pneu','borracheiro','borracha','officina','oficina','mecanico','mecânico','mecànico','autoland','autoshop','rappi farma','drogaria auto','estacionamento','parking','cancela','rotativo','zona azul','detran','renavam','ipva','dpvat','seguro auto','seguro veiculo','seguro veículo','emplacamento','licenciamento','licenca','licença','multa','autoinfra','cartorio transito','cartório trânsito','pedagio','pedágio','sem parar','connect car','move mais','veloe','autopista','ecovias','arteris','triângulo','rota das bandeiras'] },
    // ── MORADIA ──────────────────────────────────────────────
    { cat:'Moradia', type:'expense', kws:['aluguel','condominio','condomínio','iptu','agua esgoto','saneamento','sabesp','copasa','sanepar','cedae','embasa','casal','cosama','cagepa','caern','caesa','luz','energia','celesc','cemig','cosern','cpe','energisa','copel','elektro','light','coelba','celpe','cemar','cearas','eletropaulo','enel','comgas','gas natural','gas encanado','gás encanado','naturgy','scgas','progas','ultragaz','liquigas','empregada','diarista','conserje','zelador','porteiro','seguro residencial','seguro imovel','seguro imóvel','imobiliaria','imobiliária','sindico','síndico','taxa condominio','taxa condominial','fundo reserva','area comum','manutenção predial','pintura','eletricista','encanador','pedreiro','marceneiro','serralheiro','chaveiro','vidraceiro','desentupimento','dedetizacao','dedetização','limpeza residencial','reforma','construcao','construção','materiais construcao','c&c','leroy merlin','telhanorte','dicico','materiais','lojas do construtor','obra','planta','arquiteto','engenheiro','topografo','topógrafo','cartorio imovel','cartório imóvel','financiamento imovel','financiamento imóvel','caixa habitacional','casa propria','casa própria','escritura','taxa registro','itbi','itcmd'] },
    // ── SAÚDE ────────────────────────────────────────────────
    { cat:'Saúde', type:'expense', kws:['farmacia','farmácia','drogaria','drogasil','raia','ultrafarma','sao joao','são joão','pacheco','nissei','panvel','droga','remedio','remédio','medicamento','vitamina','suplemento','whey','proteina','fitoterapico','fitoterapêutico','hospital','clinica','clínica','consultorio','consultório','laboratorio','laboratório','exame','analise','análise','checkup','check-up','dentista','odonto','ortodontia','implante','plano dental','plano odontologico','plano odontológico','amil','unimed','hapvida','notredame','sulamérica','sulamerica','bradesco saude','bradesco saúde','porto seguro saude','porto seguro saúde','gndi','medicanal','oncoclínicas','oncoclinicas','einstein','sirio libanes','sírio libanês','albert einstein','pasteur','fleury','hermes pardini','dasa','hilab','diagnosticos','diagnósticos','raio x','tomografia','ressonancia','ressonância','ultrassom','eletrocardiograma','ecg','consulta','honorario','honorário','medico','médico','fisioterapia','psicologia','psiquiatria','nutricao','nutrição','nutricionista','academia','bioimpedancia','bioimpedância','anamnese','prontuario','prontuário','plano saude','plano saúde','mensalidade saude','internacao','internação','cirurgia','anestesia','uti','urgencia','urgência','emergencia','emergência','ambulancia','ambulância','samu','bombeiros','cruz vermelha','santa casa','cga','upa'] },
    // ── EDUCAÇÃO ─────────────────────────────────────────────
    { cat:'Educação', type:'expense', kws:['mensalidade escola','mensalidade universidade','mensalidade faculdade','mensalidade curso','escola','colegio','colégio','universidade','faculdade','instituto','ifsp','ifsc','etec','senac','senai','sesc','sebrae','cursinho','preparatorio','preparatório','enem','vestibular','concurso','pos graduacao','pós graduação','especializacao','especialização','mba','mestrado','doutorado','idioma','ingles','inglês','espanhol','frances','francês','alemao','alemão','mandarim','babbel','duolingo','wizard','ccaa','fisk','wise up','cultura inglesa','curso online','udemy','coursera','alura','dio','hotmart','eduzz','monetizze','livro','livraria','saraiva','cultura','amazon livros','fnac','lelivros','ebookit','apostila','material escolar','papelaria','caderno','caneta','mochila','uniforme','material','biblioteca','mensalidade bibliotea','taxa escolar','taxa matricula','taxa matrícula','anuidade'] },
    // ── LAZER ────────────────────────────────────────────────
    { cat:'Lazer', type:'expense', kws:['netflix','spotify','amazon prime','disney','hbo max','paramount','apple tv','globoplay','telecine','telecine play','deezer','youtube premium','twitch','steam','playstation','xbox','nintendo','epic games','nuuvem','origin','uplay','gog','cinema','cinemark','uci','kinoplex','moviecom','ingresso','show','show ao vivo','teatro','museu','parque','aquapark','aquatico','waterpark','balada','boate','festa','evento','aniversario','aniversário','formatura','casamento','churrasco','reunião amigos','chopperia','viagem','hotel','pousada','hospedagem','airbnb','booking','tripadvisor','turismo','agencia viagem','agência viagem','cruzeiro','navio','excursao','excursão','tour','mochilao','mochilão','resort','spa','massagem','estetica','estética','barbearia','salao beleza','salão beleza','manicure','pedicure','depilacao','depilação','bronzeamento','academy','jogo','game','hobby','colecao','coleção','musica','instrument','violao','violão','guitarra','bateria','teclado','piano','aula musica'] },
    // ── VESTUÁRIO ────────────────────────────────────────────
    { cat:'Vestuário', type:'expense', kws:['renner','riachuelo','marisa','c&a','cea','hering','reserva','aramis','ellus','forum','farm','animale','zara','h&m','forever21','forever 21','gap','polo ralph','tommy hilfiger','calvin klein','levis','wrangler','sawary','malwee','leader','marisol','bebe store','infantil','moda bebê','lojas americanas','americanas','shoptime','casas bahia','magazine luiza','magalu','netshoes','centauro','decathlon','nike','adidas','puma','new balance','asics','under armour','mizuno','reebok','havaianas','ipanema','rider','moleca','via marte','loucos e santos','roupa','vestido','blusa','camisa','camiseta','calca','calça','jeans','bermuda','short','saia','vestido','terno','smoking','paletó','paleto','gravata','cinto','cueca','calcinha','meia','sapato','sandalia','sandália','tenis','tênis','bota','chinelo','sapatilha','sapato','mocassim','oxford','loafer','bolsa','carteira','acessorio','acessório','bijuteria','joia','joalheria','relogio','relógio','oculos','óculos','chapeu','chapéu','boné','bone','cachecol','luva'] },
    // ── HIGIENE & BELEZA ─────────────────────────────────────
    { cat:'Higiene/Beleza', type:'expense', kws:['shampoo','condicionador','creme','hidratante','sabonete','desodorante','perfume','maquiagem','batom','base','corretivo','sombra','rimel','mascara','blush','po','pó','iluminador','primer','fixador','removedor','tônico','tonico','serum','sérum','esfoliante','protetor solar','bronzeador','creme dental','escova dente','fio dental','enxaguante','pasta de dente','razor','barbeador','gillette','bic','navalha','creme barbear','loção','locao','absorvente','intimo','cotonete','algodao','algodão','fralda','lenco umido','lenço úmido','papel higienico','papel higiênico','toalha','lavanderia','lavandaria','dry clean','tinturaria','sabão em pó','sabao em po','ariel','omo','ace','vanish','amaciante','comfort','amaciante','downy','limpeza geral','multiuso','desinfetante','cloro','pinho sol','veja','lysoform','mr musculo','ajax','sql','limpa vidro','saponáceo'] },
    // ── COMUNICAÇÃO ──────────────────────────────────────────
    { cat:'Comunicação', type:'expense', kws:['tim','vivo','claro','oi','nextel','algar','sercomtel','celular','smartphone','iphone','samsung','motorola','xiaomi','fatura celular','plano cel','plano celular','recarga','chip','sim card','internet movel','dados','4g','5g','net','sky','claro net','embratel','vivo fibra','tim live','oi fibra','algar fibra','linktel','brisanet','copel telecom','unifique','desktop','tv por assinatura','telecomunicacoes','telecomunicações','streaming','pacote','banda larga','wifi','modem','roteador','hospedagem site','dominio','registro.br','ssl','servidor','cloud','aws','azure','google cloud','digitalocean','vultr','hostgator','locaweb','kinghost','umbler','plano dados','ligacao','ligação','chamada','voip','zoom','teams','slack','whatsapp business','linphone','celular conta'] },
    // ── FINANCEIRO ───────────────────────────────────────────
    { cat:'Financeiro', type:'expense', kws:['tarifa bancaria','tarifa bancária','taxa manutencao','taxa manutenção','taxa adm','taxa administracao','taxa administração','juros','multa atraso','iof','ir retido','imposto','iss','cofins','pis','csll','irpf','irpj','darf','das','simples nacional','guia','boleto','ted','doc','pix taxa','transferencia','transferência','cambio','câmbio','dolar','dólar','euro','bitcoin','criptomoeda','cripto','investimento','aplicacao','aplicação','cdb','lci','lca','tesouro','tesouro direto','debênture','debenture','fundo','fii','acao','ação','etf','renda fixa','renda variavel','renda variável','previdencia','previdência','pgbl','vgbl','plano prev','aporte','resgate','saque','tev','stv','doc stv','seguro vida','apolice','apólice','premio','prêmio','corretor','corretagem','nota corretagem','bovespa','b3','xp','nuinvest','clear','rico','toro','órama','orama','modalmais','modal','inter invest','inter','c6 invest','itau invest','bradesco invest','bb invest','caixa invest'] },
    // ── RECEITAS ─────────────────────────────────────────────
    { cat:'Renda', type:'income', kws:['salario','salário','pro labore','pró labore','holerite','contra cheque','contra-cheque','remuneracao','remuneração','pagamento','folha pagamento','13 salario','13 salário','ferias','férias','hora extra','bonus','bônus','gratificacao','gratificação','participacao','participação','ppl','plr','comissao','comissão','dividendo','lucro','distribuicao','distribuição','aluguel recebido','receita aluguel','renda aluguel','freelance','autonomo','autônomo','mei','servico prestado','serviço prestado','nota fiscal','nf','honorario recebido','honorário recebido','venda','receita','faturamento','entrada','deposito','depósito','transferencia recebida','transferência recebida','pix recebido','boleto recebido','doacão','doação','herança','heranca','reembolso','restituicao','restituição','resgate','saque','rendimento','juros recebidos','dividendo recebido','inss','beneficio','benefício','previdencia recebida','auxilio','auxílio','bolsa familia','bolsa família','bpc','loas','pensao','pensão','alimentos','aposentadoria','beneficio inss'] },
    // ── BANCOS ESPECÍFICOS ───────────────────────────────────
    { cat:'Financeiro', type:'expense', kws:['itaú','itau','bradesco','banco do brasil','bb','caixa economica','caixa econômica','cef','santander','hsbc','citibank','banco inter','inter','nubank','c6 bank','c6','next','neon','pagseguro','stone','getnet','rede','cielo','safra','bmg','pan','pernambucanas','renner cartao','renner cartão','magazine cartao','magazine cartão','riachuelo cartao','riachuelo cartão','carrefour cartao','carrefour cartão','extra cartao','extra cartão','hiper cartao','hiper cartão','atacadao cartao','atacadão cartão','assai cartao','assaí cartão'] },
    // ── PETS ─────────────────────────────────────────────────
    { cat:'Pets', type:'expense', kws:['petshop','pet shop','agropet','agro pet','veterinário','veterinario','vet','consulta vet','banho tosa','tosa','vacina animal','racao','ração','petlove','cobasi','petz','mundo animal','dona ração','dona racao','pedigree','whiskas','golden','hills','royal canin','premier','farmina','ração gato','ração cachorro'] },
    // ── IMPOSTOS & TAXAS ─────────────────────────────────────
    { cat:'Impostos', type:'expense', kws:['ipva','iptu','itr','darf','das','simples','irpf','irpj','itbi','itcmd','iof','iss','icms','cofins','pis','csll','contribuição','contribuicao','taxa','tarifa governamental','cartório','cartorio','registro','documentos','habilitação','habilitacao','renovação habilitação','renovacao habilitacao','cnh','detran','procon','juizado','emolumentos'] },
  ];

  /* ═══════════════════════════════════════════════════════════
     FUZZY MATCHING — similaridade de trigramas + Levenshtein
  ═══════════════════════════════════════════════════════════ */
  const Fuzzy = {
    /** Trigramas de uma string */
    trigrams(s) {
      const t = new Set();
      const p = ' ' + s + ' ';
      for (let i = 0; i < p.length - 2; i++) t.add(p.slice(i, i + 3));
      return t;
    },

    /** Similaridade de Dice entre dois conjuntos de trigramas (0–1) */
    diceSim(a, b) {
      const ta = this.trigrams(a);
      const tb = this.trigrams(b);
      let inter = 0;
      for (const g of ta) if (tb.has(g)) inter++;
      return (2 * inter) / (ta.size + tb.size || 1);
    },

    /** Levenshtein truncado (retorna false se dist > maxDist) */
    levenshtein(a, b, maxDist = 3) {
      if (Math.abs(a.length - b.length) > maxDist) return false;
      const dp = Array.from({ length: a.length + 1 }, (_, i) => [i]);
      dp[0] = Array.from({ length: b.length + 1 }, (_, j) => j);
      for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
          dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1]
            : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
        }
        if (Math.min(...dp[i]) > maxDist) return false;
      }
      const d = dp[a.length][b.length];
      return d <= maxDist ? d : false;
    },

    /** Match com tolerância: exato→trigrama→levenshtein */
    match(desc, keyword) {
      const d = norm(desc);
      const k = norm(keyword);
      if (!k || k.length < 3) return { match: false };

      // Exato (substring)
      if (d.includes(k)) return { match: true, score: 1.0, method: 'exact' };

      // Palavra-início (ex: "mac" → "macdonalds")
      if (d.split(' ').some(w => w.startsWith(k) && w.length <= k.length + 3))
        return { match: true, score: 0.92, method: 'prefix' };

      // Trigrama (≥0.65)
      const dice = this.diceSim(d, k);
      if (dice >= 0.65) return { match: true, score: dice, method: 'trigram' };

      // Levenshtein apenas para keywords ≥5 chars (evita falsos positivos em termos curtos)
      if (k.length >= 5) {
        const words = d.split(' ');
        for (const w of words) {
          if (Math.abs(w.length - k.length) > 3) continue;
          const lev = this.levenshtein(w, k, Math.max(1, Math.floor(k.length * 0.25)));
          if (lev !== false) return { match: true, score: 0.7 - lev * 0.1, method: 'levenshtein' };
        }
      }
      return { match: false };
    },
  };

  /* ═══════════════════════════════════════════════════════════
     RULES ENGINE v2 — Regras do usuário + Banco MEGA + Auto-sugestão
  ═══════════════════════════════════════════════════════════ */
  const Rules = {
    async loadAll() {
      const rules  = await getPref('importRules', []) || [];
      const auto   = await getPref('importRulesAuto', []) || [];
      return { user: rules, auto };
    },

    async saveAuto(autoRules) { await setPref('importRulesAuto', autoRules); },

    /** Aplica regras do usuário (prioridade máxima):
     *  suporta keyword + amountMin/Max + type
     *  suporta match exato OU fuzzy (fuzzy: true na regra)
     */
    apply(tx, rules) {
      const desc = norm(tx.description);
      for (const r of rules) {
        if (!r.keyword || !r.categoryId) continue;
        // Tipo
        if (r.type && r.type !== 'all' && r.type !== tx.type) continue;
        // Faixa de valor
        if (r.amountMin != null && tx.amount < r.amountMin) continue;
        if (r.amountMax != null && tx.amount > r.amountMax) continue;
        // Match keyword (fuzzy ou exato)
        const m = r.fuzzy
          ? Fuzzy.match(desc, r.keyword)
          : { match: norm(desc).includes(norm(r.keyword)), score: 1.0, method: 'exact' };
        if (!m.match) continue;
        return { categoryId: r.categoryId, source: 'rule', confidence: Math.round(m.score * 100) };
      }
      return null;
    },

    /** Aplica banco MEGA de keywords (fallback após regras do usuário) */
    applyMega(tx, cats) {
      const desc = norm(tx.description);
      // Mapa de nome → id da categoria do usuário
      const catByName = new Map(cats.map(c => [norm(c.name), c.id]));

      let best = null;
      for (const entry of MEGA_KW) {
        if (entry.type !== 'all' && entry.type !== tx.type) continue;
        for (const kw of entry.kws) {
          const m = Fuzzy.match(desc, kw);
          if (!m.match) continue;
          const catId = catByName.get(norm(entry.cat));
          if (!catId) continue;
          if (!best || m.score > best.score) {
            best = { categoryId: catId, source: 'rulekw', confidence: Math.round(m.score * 100), score: m.score };
          }
        }
      }
      return best;
    },

    /** Histórico exato: busca transações passadas com mesmo descrição normalizada */
    async applyHistory(tx, cats) {
      try {
        const uid = window.S?.user?.id;
        if (!uid) return null;
        const descNorm = norm(tx.description).split(' ').slice(0, 4).join(' ');
        if (descNorm.length < 4) return null;
        const all = await window.db.transactions
          .where('userId').equals(uid)
          .filter(t => t.categoryId && norm(t.description).startsWith(descNorm))
          .limit(10).toArray();
        if (!all.length) return null;
        // Categoria mais frequente
        const freq = new Map();
        for (const t of all) freq.set(t.categoryId, (freq.get(t.categoryId) || 0) + 1);
        const top = [...freq.entries()].sort((a, b) => b[1] - a[1])[0];
        if (!top || top[1] < 2) return null;
        const cat = cats.find(c => c.id == top[0]);
        if (!cat) return null;
        return { categoryId: cat.id, source: 'history', confidence: Math.min(99, 70 + top[1] * 5) };
      } catch { return null; }
    },

    /** Sugere regras automáticas baseadas em padrões repetidos no histórico */
    async suggestAutoRules() {
      if (!window.S?.user) return [];
      const uid = window.S.user.id;
      const all = await window.db.transactions.where('userId').equals(uid).toArray();
      const cats = window.S.cats || [];
      const catMap = new Map(cats.map(c => [c.id, c]));

      // Agrupa por descrição normalizada (até 4 palavras) → categoria mais comum
      const groups = new Map();
      for (const t of all) {
        if (!t.description || !t.categoryId) continue;
        const k = norm(t.description).split(' ').slice(0, 4).join(' ');
        if (!k || k.length < 3) continue;
        if (!groups.has(k)) groups.set(k, { catCounts: new Map(), type: t.type, amounts: [] });
        const g = groups.get(k);
        g.catCounts.set(t.categoryId, (g.catCounts.get(t.categoryId) || 0) + 1);
        g.amounts.push(t.amount);
      }

      const suggestions = [];
      for (const [keyword, g] of groups) {
        const total = Array.from(g.catCounts.values()).reduce((a, b) => a + b, 0);
        if (total < 2) continue;
        const sorted = Array.from(g.catCounts.entries()).sort((a, b) => b[1] - a[1]);
        const dominance = sorted[0][1] / total;
        if (dominance < 0.7) continue;
        const catId = sorted[0][0];
        const cat = catMap.get(catId);
        if (!cat) continue;
        const avgAmt = g.amounts.reduce((a, b) => a + b, 0) / g.amounts.length;
        suggestions.push({
          keyword, categoryId: catId, type: g.type,
          occurrences: total, dominance: Math.round(dominance * 100),
          avgAmount: avgAmt, catName: cat.name,
        });
      }
      return suggestions.sort((a, b) => b.occurrences - a.occurrences).slice(0, 20);
    },
  };

  /* ═══════════════════════════════════════════════════════════
     SMART CATEGORIZER v2 — 5 camadas de categorização
     Prioridade: CSV → UserRules → Histórico → MegaKW → Classifier → Default
  ═══════════════════════════════════════════════════════════ */
  const SmartCat = {
    async categorizeAll(txs) {
      const cats   = window.S.cats || [];
      const { user, auto } = await Rules.loadAll();
      const combined = [...(user || []), ...(auto || [])];
      const catByName = new Map(cats.map(c => [norm(c.name), c]));

      const out = [];
      for (const tx of txs) {
        const item = { ...tx, _selected: true, _duplicate: false };

        // 1. Categoria explícita do CSV — tenta resolver por nome, id, tokens e fuzzy
        if (tx.rawCategory) {
          const rc0 = String(tx.rawCategory || '').trim();
          if (rc0) {
            // tentativa exata por nome
            const r = catByName.get(norm(rc0));
            if (r) { item.categoryId = r.id; item._catSource = 'file'; item._catConfidence = 100; out.push(item); continue; }

            // se for um id numérico
            const numeric = rc0.match(/^\d+$/);
            if (numeric) {
              const byId = cats.find(c => String(c.id) === rc0);
              if (byId) { item.categoryId = byId.id; item._catSource = 'file'; item._catConfidence = 100; out.push(item); continue; }
            }

            // tenta tokens separados por :,;,|,/,- ou ->
            const tokens = rc0.split(/[:;|\/\\,>\-]+/).map(s => s.trim()).filter(Boolean);
            let resolved = null;
            for (const tok of tokens) {
              const tnorm = norm(tok);
              if (catByName.has(tnorm)) { resolved = catByName.get(tnorm); break; }
            }
            if (resolved) { item.categoryId = resolved.id; item._catSource = 'file'; item._catConfidence = 95; out.push(item); continue; }

            // fuzzy contra nomes de categoria
            let best = null;
            for (const [name, catObj] of catByName) {
              const m = Fuzzy.match(rc0, name);
              if (m.match && (!best || m.score > best.score)) best = { cat: catObj, score: m.score };
            }
            if (best && best.score >= 0.7) { item.categoryId = best.cat.id; item._catSource = 'file-fuzzy'; item._catConfidence = Math.round(best.score * 100); out.push(item); continue; }
          }
        }

        // 2. Regras do usuário (exatas + fuzzy + faixa de valor)
        const ruled = Rules.apply(tx, combined);
        if (ruled) { item.categoryId = ruled.categoryId; item._catSource = ruled.source; item._catConfidence = ruled.confidence; out.push(item); continue; }

        // 3. Histórico exato
        const hist = await Rules.applyHistory(tx, cats);
        if (hist) { item.categoryId = hist.categoryId; item._catSource = hist.source; item._catConfidence = hist.confidence; out.push(item); continue; }

        // 4. Banco MEGA de keywords com fuzzy
        const mega = Rules.applyMega(tx, cats);
        if (mega && mega.confidence >= 70) { item.categoryId = mega.categoryId; item._catSource = mega.source; item._catConfidence = mega.confidence; out.push(item); continue; }

        // 5. Classifier de IA (FP_AI_PRO)
        let suggestion = null;
        if (window.FP_AI_PRO?.Classifier) {
          suggestion = await window.FP_AI_PRO.Classifier.classify(tx.description, tx.type, tx.amount).catch(() => null);
        } else if (window.LocalAI?.classify) {
          try { const r = window.LocalAI.classify(tx.description); if (r?.categoryId) suggestion = { categoryId: r.categoryId, source: 'localai', confidence: Math.round((r.confidence || 0) * 100) }; } catch {}
        }
        if (suggestion?.categoryId) { item.categoryId = suggestion.categoryId; item._catSource = suggestion.source; item._catConfidence = suggestion.confidence; out.push(item); continue; }

        // 5b. MEGA com confiança mais baixa (60–70%)
        if (mega && mega.confidence >= 60) { item.categoryId = mega.categoryId; item._catSource = mega.source; item._catConfidence = mega.confidence; out.push(item); continue; }

        // 6. Fallback: primeira categoria do tipo
        const first = cats.find(c => c.type === tx.type);
        item.categoryId = first?.id || null;
        item._catSource = 'default';
        item._catConfidence = 0;
        out.push(item);
      }
      return out;
    },
  };


  /* ═══════════════════════════════════════════════════════════
     DEDUPLICATOR — hash robusto
  ═══════════════════════════════════════════════════════════ */
  const Dedup = {
    _hash(t) {
      const desc = norm(t.description).split(' ').slice(0, 4).join(' ');
      const amt = Math.round((Number(t.amount) || 0) * 100);
      return `${t.date}|${amt}|${desc}`;
    },

    async markDuplicates(items, accountId) {
      if (!window.S?.user) return items;
      const uid = window.S.user.id;
      const since = items.reduce((min, t) => t.date < min ? t.date : min, today());
      const sinceD = new Date(since); sinceD.setDate(sinceD.getDate() - 1);
      const sinceStr = sinceD.toISOString().split('T')[0];
      const existing = await window.db.transactions.where('userId').equals(uid)
        .filter(t => t.date >= sinceStr).toArray();
      const set = new Set(existing.map(this._hash));
      // Também detecta duplicatas dentro do próprio batch
      const batchSet = new Set();
      for (const it of items) {
        const h = this._hash(it);
        if (set.has(h) || batchSet.has(h)) {
          it._duplicate = true;
          it._selected = false;
        }
        batchSet.add(h);
      }
      return items;
    },
  };

  /* ═══════════════════════════════════════════════════════════
     IMPORTER — orquestra parse → categorize → dedup → save
  ═══════════════════════════════════════════════════════════ */
  const Importer = {
    state: { items: [], accountId: null, fileName: '', format: null, bank: null, meta: {} },

    async openWizard() {
      this._render();
      await this._injectIntoPage();
    },

    async _injectIntoPage() {
      // Injeta painel "Import Pro" na página de import existente
      const page = $('page-import');
      if (!page) {
        T('Página de importação não encontrada. Tente navegar para "Importar".', 'warning');
        return;
      }
      let panel = $('importProPanel');
      if (!panel) {
        panel = document.createElement('div');
        panel.id = 'importProPanel';
        panel.className = 'card fp-imp-panel';
        page.insertBefore(panel, page.firstChild?.nextSibling || null);
      }
      panel.innerHTML = `
        <div class="card-hdr">
          <div class="card-title">
            <i class="fas fa-magic" style="color:var(--accent)"></i> Import Pro — Importação Inteligente
          </div>
          <div class="fp-imp-hdr-actions">
            <button class="btn btn-ghost btn-sm" id="impProRulesBtn"><i class="fas fa-filter"></i> Regras</button>
            <button class="btn btn-ghost btn-sm" id="impProSuggestBtn"><i class="fas fa-lightbulb"></i> Sugerir regras</button>
          </div>
        </div>
        <div class="card-body">
          <div class="fp-imp-drop" id="impProDrop">
            <i class="fas fa-cloud-upload-alt"></i>
            <p><strong>Arraste qualquer extrato aqui</strong> ou clique para selecionar</p>
            <p class="fp-imp-formats">Suportados: CSV, TSV, OFX, QFX, QIF, XLSX, XLS, JSON</p>
            <input type="file" id="impProFile" accept=".csv,.tsv,.txt,.ofx,.qfx,.qif,.xlsx,.xls,.xlsm,.json" hidden>
          </div>
          <div id="impProStatus" class="fp-imp-status hidden"></div>
          <div id="impProPreview"></div>
        </div>
      `;
      this._wireEvents();
    },

    _wireEvents() {
      const drop = $('impProDrop');
      const file = $('impProFile');
      drop?.addEventListener('click', () => file.click());
      drop?.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('drag-over'); });
      drop?.addEventListener('dragleave', () => drop.classList.remove('drag-over'));
      drop?.addEventListener('drop', e => {
        e.preventDefault();
        drop.classList.remove('drag-over');
        const f = e.dataTransfer.files[0];
        if (f) this._handleFile(f);
      });
      file?.addEventListener('change', e => {
        const f = e.target.files[0];
        if (f) this._handleFile(f);
        e.target.value = '';
      });
      $('impProRulesBtn')?.addEventListener('click', () => this._openRulesModal());
      $('impProSuggestBtn')?.addEventListener('click', () => this._openSuggestModal());
    },

    async _handleFile(file) {
      const status = $('impProStatus');
      status.classList.remove('hidden');
      status.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Analisando "${esc(file.name)}"...`;
      try {
        const text = await FileIO.readSmartText(file);
        let result = await Parser.parseFile(file, text);
        const diag = Parser.diagnose(result);
        window.EventBus?.emit('fpimport:parsed', {
          fileName: file.name,
          txCount: result.txs.length,
          bank: result.bank?.id || null,
          diagnostics: diag.map(d => d.code),
        });
        if (diag.length) {
          // Mostra avisos não bloqueantes
          status.innerHTML = `<div class="fp-imp-warn"><i class="fas fa-exclamation-circle"></i> Import: ${diag.map(d => esc(d.message)).join(' • ')}</div>`;
        }
        // Se nada encontrado, tenta heurísticas adicionais (vários delimitadores)
        if (!result.txs.length) {
          const delims = [',', ';', '\t', '|', '\\;'];
          for (const d of delims) {
            const rows = CSV.parse(text, d === '\\;' ? ';' : d);
            if (!rows.length) continue;
            const hasHeader = CSV.hasHeader(rows);
            const map = CSV.autoMap(rows, hasHeader, result.bank);
            const txs = CSV.toTransactions(rows, map, hasHeader, result.bank);
            if (txs && txs.length) {
              result.txs = txs;
              result.format = 'csv-fallback2';
              result.meta = result.meta || {};
              result.meta.delimiterTried = d;
              break;
            }
          }
        }
        if (!result.txs.length) {
          status.innerHTML = `<div class="fp-imp-error"><i class="fas fa-exclamation-triangle"></i> Nenhuma transação reconhecida no arquivo.</div>`;
          return;
        }

        // Enriquecimento inteligente de PIX (automático)
        if (typeof window.PIX_SMART_ENRICHER !== 'undefined' && result.bank?.id === 'bradesco') {
          status.innerHTML = `<i class="fas fa-robot fa-spin"></i> Enriquecendo PIX com IA (${result.txs.length} transações)...`;
          result.txs = await window.PIX_SMART_ENRICHER.enrichAllPixTransactions(result.txs);
        }

        status.innerHTML = `<i class="fas fa-cog fa-spin"></i> Categorizando com IA (${result.txs.length} transações)...`;

        // Categoriza
        let items = await SmartCat.categorizeAll(result.txs);
        // Dedup (usa primeira conta como default)
        const accs = window.S.accs || [];
        const defaultAcc = accs[0]?.id;
        items = await Dedup.markDuplicates(items, defaultAcc);

        this.state = {
          items, accountId: defaultAcc, fileName: file.name,
          format: result.format, bank: result.bank, meta: result.meta
        };

        const okCount = items.filter(i => !i._duplicate).length;
        const dupCount = items.filter(i => i._duplicate).length;
        const bankInfo = result.bank ? ` • Banco: <strong>${esc(result.bank.name)}</strong>` : '';
        const fmtInfo = ` • Formato: <strong>${esc(result.format.toUpperCase())}</strong>`;
        status.innerHTML = `
          <div class="fp-imp-ok">
            <i class="fas fa-check-circle"></i>
            <strong>${items.length}</strong> transações encontradas
            (${okCount} novas, ${dupCount} possíveis duplicatas)${fmtInfo}${bankInfo}
          </div>
        `;
        this._renderPreview();
      } catch (e) {
        console.warn('[IMPORT_PRO]', e);
        status.innerHTML = `<div class="fp-imp-error"><i class="fas fa-times-circle"></i> ${esc(e.message)}</div>`;
      }
    },

    _renderPreview() {
      const wrap = $('impProPreview');
      if (!wrap) return;
      const { items } = this.state;
      const cats = window.S.cats || [];
      const accs = window.S.accs || [];

      const accOptions = accs.map(a => `<option value="${a.id}" ${a.id == this.state.accountId ? 'selected' : ''}>${esc(a.name)}</option>`).join('');
      const summary = this.state.items.reduce((acc, it) => {
        if (!it._selected) return acc;
        if (it.type === 'expense') { acc.expense += Number(it.amount) || 0; }
        else if (it.type === 'income') { acc.income += Number(it.amount) || 0; }
        const payee = it.payee || 'Não identificado';
        acc.payees[payee] = (acc.payees[payee] || 0) + Number(it.amount || 0);
        return acc;
      }, { expense: 0, income: 0, payees: {} });
      const topPayees = Object.entries(summary.payees).sort((a, b) => b[1] - a[1]).slice(0, 5);
      const payeeRows = topPayees.length ? topPayees.map(([p, v]) => `<span>${esc(p)}: <strong>${fmtMoney(v)}</strong></span>`).join('') : '<span>Nenhum favorecido identificado</span>';

      wrap.innerHTML = `
        <div class="fp-imp-toolbar">
          <div class="fp-imp-tool-group">
            <label>Conta destino:</label>
            <select id="impProAccount" class="form-inp" style="max-width:200px">${accOptions}</select>
          </div>
          <div class="fp-imp-tool-group">
            <button class="btn btn-outline btn-sm" id="impProSelectAll"><i class="fas fa-check-square"></i> Marcar todas</button>
            <button class="btn btn-outline btn-sm" id="impProSelectNew"><i class="fas fa-filter"></i> Só novas</button>
            <button class="btn btn-outline btn-sm" id="impProBulkCat"><i class="fas fa-tag"></i> Aplicar categoria</button>
            <button class="btn btn-outline btn-sm" id="impProAutoCat"><i class="fas fa-magic"></i> Re-categorizar IA</button>
          </div>
          <div class="fp-imp-summary">
            <div><strong>Receita:</strong> ${fmtMoney(summary.income)}</div>
            <div><strong>Despesa:</strong> ${fmtMoney(summary.expense)}</div>
            <div><strong>Top favorecidos:</strong> ${payeeRows}</div>
          </div>
          <div class="fp-imp-tool-actions">
            <button class="btn btn-ghost" id="impProCancel">Cancelar</button>
            <button class="btn btn-primary" id="impProConfirm"><i class="fas fa-check"></i> Importar selecionadas</button>
          </div>
        </div>
        <div class="fp-imp-table-wrap">
          <table class="fp-imp-table">
            <thead>
              <tr>
                <th><input type="checkbox" id="impProMaster" checked></th>
                <th>Data</th>
                <th>Descrição</th>
                <th>Favorecido</th>
                <th>Tipo</th>
                <th>Categoria</th>
                <th class="fp-imp-th-amount">Valor</th>
              </tr>
            </thead>
            <tbody id="impProBody">
              ${items.map((it, i) => this._renderRow(it, i, cats)).join('')}
            </tbody>
          </table>
        </div>
      `;
      this._wirePreview();
    },

    _renderRow(it, i, cats) {
      const dupClass = it._duplicate ? 'fp-imp-row-dup' : '';
      const srcBadge = {
        rule: '<span class="fp-imp-badge fp-imp-badge-rule" title="Regra aplicada">R</span>',
        history: '<span class="fp-imp-badge fp-imp-badge-ai" title="Histórico exato">H</span>',
        fuzzy: '<span class="fp-imp-badge fp-imp-badge-ai" title="Similaridade">F</span>',
        localai: '<span class="fp-imp-badge fp-imp-badge-ai" title="LocalAI Naive Bayes">A</span>',
        rulekw: '<span class="fp-imp-badge fp-imp-badge-rule" title="Palavra-chave">K</span>',
        file: '<span class="fp-imp-badge fp-imp-badge-file" title="Categoria do arquivo">📄</span>',
        default: '<span class="fp-imp-badge fp-imp-badge-default" title="Padrão">?</span>',
      }[it._catSource] || '';

      const dupIcon = it._duplicate
        ? '<span class="fp-imp-dup-tag" title="Possível duplicata"><i class="fas fa-clone"></i> dup</span>'
        : '';

      const conf = it._catConfidence != null
        ? `<span class="fp-imp-conf">${it._catConfidence}%</span>` : '';

      const catOptions = cats
        .filter(c => c.type === it.type)
        .map(c => `<option value="${c.id}" ${c.id === it.categoryId ? 'selected' : ''}>${esc(c.name)}</option>`)
        .join('');

      return `
        <tr class="fp-imp-row ${dupClass}" data-idx="${i}">
          <td><input type="checkbox" class="impProRowCk" data-idx="${i}" ${it._selected ? 'checked' : ''}></td>
          <td><input type="date" class="fp-imp-cell-input" data-idx="${i}" data-field="date" value="${esc(it.date)}"></td>
          <td>
            <input type="text" class="fp-imp-cell-input fp-imp-desc" data-idx="${i}" data-field="description" value="${esc(it.description)}">
            ${dupIcon}
          </td>
          <td>
            <input type="text" class="fp-imp-cell-input fp-imp-payee" data-idx="${i}" data-field="payee" value="${esc(it.payee || '')}">
          </td>
          <td>
            <select class="fp-imp-cell-input fp-imp-type" data-idx="${i}" data-field="type">
              <option value="expense" ${it.type === 'expense' ? 'selected' : ''}>Despesa</option>
              <option value="income" ${it.type === 'income' ? 'selected' : ''}>Receita</option>
              <option value="transfer" ${it.type === 'transfer' ? 'selected' : ''}>Transf.</option>
            </select>
          </td>
          <td>
            <div class="fp-imp-cat-cell">
              <select class="fp-imp-cell-input fp-imp-cat" data-idx="${i}" data-field="categoryId">${catOptions}</select>
              ${srcBadge}${conf}
            </div>
          </td>
          <td class="fp-imp-amt ${it.type === 'expense' ? 'fp-imp-amt-exp' : it.type === 'income' ? 'fp-imp-amt-inc' : ''}">
            <input type="number" step="0.01" class="fp-imp-cell-input fp-imp-amt-input" data-idx="${i}" data-field="amount" value="${it.amount}">
          </td>
        </tr>`;
    },

    _wirePreview() {
      $('impProAccount')?.addEventListener('change', e => this.state.accountId = parseInt(e.target.value, 10));
      $('impProMaster')?.addEventListener('change', e => {
        this.state.items.forEach(it => it._selected = e.target.checked);
        document.querySelectorAll('.impProRowCk').forEach(cb => cb.checked = e.target.checked);
      });
      $('impProSelectAll')?.addEventListener('click', () => {
        this.state.items.forEach(it => it._selected = true);
        document.querySelectorAll('.impProRowCk').forEach(cb => cb.checked = true);
      });
      $('impProSelectNew')?.addEventListener('click', () => {
        this.state.items.forEach(it => it._selected = !it._duplicate);
        document.querySelectorAll('.impProRowCk').forEach(cb => {
          const i = parseInt(cb.dataset.idx, 10);
          cb.checked = this.state.items[i]._selected;
        });
      });
      $('impProBulkCat')?.addEventListener('click', () => this._bulkCategory());
      $('impProAutoCat')?.addEventListener('click', () => this._reCategorize());
      $('impProCancel')?.addEventListener('click', () => {
        this.state = { items: [], accountId: null, fileName: '', format: null, bank: null, meta: {} };
        $('impProPreview').innerHTML = '';
        $('impProStatus').classList.add('hidden');
      });
      $('impProConfirm')?.addEventListener('click', () => this._confirm());

      document.querySelectorAll('.impProRowCk').forEach(cb => {
        cb.addEventListener('change', e => {
          const i = parseInt(e.target.dataset.idx, 10);
          this.state.items[i]._selected = e.target.checked;
        });
      });
      document.querySelectorAll('.fp-imp-cell-input').forEach(inp => {
        inp.addEventListener('change', e => {
          const i = parseInt(e.target.dataset.idx, 10);
          const f = e.target.dataset.field;
          let v = e.target.value;
          if (f === 'categoryId' || f === 'amount') v = parseFloat(v);
          if (f === 'amount') v = Math.abs(v);
          this.state.items[i][f] = v;
          // Se mudou tipo, re-renderiza categorias
          if (f === 'type') this._renderPreview();
        });
      });
    },

    _bulkCategory() {
      const selected = this.state.items.filter(i => i._selected);
      if (!selected.length) { T('Selecione transações primeiro.', 'warning'); return; }
      const cats = window.S.cats || [];
      const opts = cats.map(c => `<option value="${c.id}">${esc(c.name)} (${c.type})</option>`).join('');
      const html = `
        <div class="modal-wrap" id="impProBulkModal">
          <div class="modal modal-sm">
            <div class="modal-hdr">
              <div class="modal-title">Aplicar categoria em lote</div>
              <button class="modal-close" onclick="document.getElementById('impProBulkModal').remove()"><i class="fas fa-times"></i></button>
            </div>
            <div class="modal-body">
              <p>Aplicar a categoria selecionada nas <strong>${selected.length}</strong> transações marcadas.</p>
              <select class="form-inp" id="impProBulkCatSel">${opts}</select>
            </div>
            <div class="modal-footer">
              <button class="btn btn-ghost" onclick="document.getElementById('impProBulkModal').remove()">Cancelar</button>
              <button class="btn btn-primary" id="impProBulkOk">Aplicar</button>
            </div>
          </div>
        </div>`;
      document.body.insertAdjacentHTML('beforeend', html);
      $('impProBulkOk').onclick = () => {
        const cid = parseInt($('impProBulkCatSel').value, 10);
        const cat = cats.find(c => c.id === cid);
        if (!cat) return;
        for (const it of this.state.items) {
          if (!it._selected) continue;
          it.categoryId = cid;
          it.type = cat.type === 'income' ? 'income' : (it.type === 'transfer' ? 'transfer' : 'expense');
          it._catSource = 'manual';
          it._catConfidence = 100;
        }
        $('impProBulkModal').remove();
        this._renderPreview();
        T(`Categoria aplicada em ${this.state.items.filter(i => i._selected).length} transações.`, 'success');
      };
    },

    async _reCategorize() {
      // Re-classifica usando IA (mantém apenas as não-duplicadas selecionadas)
      const fresh = this.state.items.map(i => ({
        date: i.date, amount: i.amount, type: i.type,
        description: i.description, rawCategory: '', rawAccount: ''
      }));
      const updated = await SmartCat.categorizeAll(fresh);
      // Mantém flags de seleção/dup
      this.state.items = updated.map((u, i) => ({ ...u, _selected: this.state.items[i]._selected, _duplicate: this.state.items[i]._duplicate }));
      this._renderPreview();
      T('IA reaplicada nas transações.', 'success');
    },

    async _confirm() {
      const selected = this.state.items.filter(i => i._selected);
      if (!selected.length) { T('Selecione ao menos uma transação.', 'warning'); return; }
      if (!this.state.accountId) { T('Escolha uma conta destino.', 'warning'); return; }
      const uid = window.S.user.id;
      const cats = window.S.cats || [];
      const inserted = [];
      const now = new Date().toISOString();
      for (const it of selected) {
        const tx = {
          userId: uid,
          type: it.type,
          amount: Number(it.amount) || 0,
          description: it.description || '',
          categoryId: it.categoryId || null,
          accountId: this.state.accountId,
          date: it.date,
          tags: [],
          createdAt: now,
          updatedAt: now,
          source: `import:${this.state.format}`,
        };
        const id = await window.db.transactions.add(tx);
        tx.id = id;
        inserted.push(tx);

        // Treina LocalAI
        try {
          const cat = cats.find(c => c.id === it.categoryId);
          if (cat && window.LocalAI?.train) {
            window.LocalAI.train(it.description, cat.name, it.type);
          }
        } catch {}
      }
      try { window.LocalAI?.saveModel?.(); } catch {}

      window.EventBus?.emit('fpimport:imported', {
        fileName: this.state.fileName,
        count: inserted.length,
        accountId: this.state.accountId,
        format: this.state.format,
      });

      T(`${inserted.length} transação(ões) importada(s) com sucesso!`, 'success');

      // Sugere regras automáticas com base no histórico atualizado
      try {
        const sug = await Rules.suggestAutoRules();
        if (sug.length) await Rules.saveAuto(sug);
      } catch {}

      // Reset
      this.state = { items: [], accountId: null, fileName: '', format: null, bank: null, meta: {} };
      $('impProPreview').innerHTML = '';
      $('impProStatus').innerHTML = `<div class="fp-imp-ok"><i class="fas fa-check-circle"></i> Importação concluída! Veja na aba "Transações".</div>`;

      // Refresh página de transações se acessível
      if (typeof window.refreshActivePage === 'function') window.refreshActivePage();
    },

    async _openRulesModal() {
      const { user } = await Rules.loadAll();
      const cats = window.S.cats || [];
      const typeOpts = [['all','Todos'],['expense','Despesa'],['income','Receita']];
      const catOpts = cats.map(c => `<option value="${c.id}">${esc(c.name)} (${c.type === 'expense' ? '−' : '+'})</option>`).join('');

      const rowHtml = (r, i) => `
        <tr class="imp-rule-row" data-idx="${i}">
          <td style="width:32px;text-align:center">
            <i class="fas fa-grip-vertical" style="color:var(--txt3);cursor:grab"></i>
          </td>
          <td>
            <input class="form-inp imp-rl-kw" style="font-size:.82rem" data-idx="${i}" data-field="keyword"
              value="${esc(r.keyword || '')}" placeholder="ex: mercado, uber, aluguel...">
          </td>
          <td style="width:110px">
            <select class="form-inp imp-rl-type" style="font-size:.82rem" data-idx="${i}" data-field="type">
              ${typeOpts.map(([v, l]) => `<option value="${v}" ${r.type === v ? 'selected' : ''}>${l}</option>`).join('')}
            </select>
          </td>
          <td style="width:160px">
            <select class="form-inp imp-rl-cat" style="font-size:.82rem" data-idx="${i}" data-field="categoryId">
              ${cats.map(c => `<option value="${c.id}" ${c.id == r.categoryId ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
            </select>
          </td>
          <td style="width:80px">
            <input type="number" min="0" step="1" class="form-inp imp-rl-min" style="font-size:.78rem"
              data-idx="${i}" data-field="amountMin" value="${r.amountMin ?? ''}" placeholder="Mín R$">
          </td>
          <td style="width:80px">
            <input type="number" min="0" step="1" class="form-inp imp-rl-max" style="font-size:.78rem"
              data-idx="${i}" data-field="amountMax" value="${r.amountMax ?? ''}" placeholder="Máx R$">
          </td>
          <td style="width:60px;text-align:center">
            <label style="display:flex;align-items:center;gap:4px;justify-content:center;cursor:pointer">
              <input type="checkbox" class="imp-rl-fuzzy" data-idx="${i}" ${r.fuzzy ? 'checked' : ''}>
              <span style="font-size:.68rem;color:var(--txt2)">Fuzzy</span>
            </label>
          </td>
          <td style="width:40px;text-align:center">
            <button class="btn btn-ghost btn-sm imp-rl-del" data-idx="${i}" style="color:var(--danger);padding:4px 8px">
              <i class="fas fa-trash"></i>
            </button>
          </td>
        </tr>`;

      const html = `
        <div class="modal-wrap" id="impProRulesModal">
          <div class="modal" style="max-width:880px;width:calc(100vw - 2rem)">
            <div class="modal-hdr">
              <div class="modal-title"><i class="fas fa-filter" style="color:var(--accent)"></i> Regras de Categorização</div>
              <button class="modal-close" onclick="document.getElementById('impProRulesModal').remove()"><i class="fas fa-times"></i></button>
            </div>
            <div class="modal-body" style="padding:.85rem">
              <div style="background:rgba(var(--accent-rgb),.07);border-left:3px solid var(--accent);padding:.6rem .85rem;border-radius:8px;font-size:.78rem;color:var(--txt2);margin-bottom:.75rem">
                <i class="fas fa-info-circle" style="color:var(--accent)"></i>
                Regras têm <strong>prioridade máxima</strong> sobre IA. Aplicadas em ordem — a primeira que combinar vence.
                <strong>Fuzzy</strong> = aceita erros de digitação e abreviações.
                <strong>Mín/Máx</strong> = aplica só em determinado intervalo de valor.
              </div>
              <div style="overflow-x:auto">
                <table class="fp-imp-rules-table" style="min-width:700px">
                  <thead>
                    <tr>
                      <th style="width:32px"></th>
                      <th>Palavra-chave</th>
                      <th style="width:110px">Tipo</th>
                      <th style="width:160px">Categoria</th>
                      <th style="width:80px">Mín R$</th>
                      <th style="width:80px">Máx R$</th>
                      <th style="width:60px">Fuzzy</th>
                      <th style="width:40px"></th>
                    </tr>
                  </thead>
                  <tbody id="impProRulesBody">
                    ${(user || []).map((r, i) => rowHtml(r, i)).join('')}
                    ${!(user || []).length ? '<tr><td colspan="8" style="text-align:center;padding:1.5rem;color:var(--txt2)">Nenhuma regra. Clique em <strong>+ Nova regra</strong> para criar.</td></tr>' : ''}
                  </tbody>
                </table>
              </div>
              <button class="btn btn-outline btn-sm" id="impProRuleAdd" style="margin-top:.5rem">
                <i class="fas fa-plus"></i> Nova regra
              </button>
              <div style="margin-top:.75rem;font-size:.75rem;color:var(--txt2)">
                <strong>Dica:</strong> Clique em <em>"Sugerir regras"</em> no painel para criar regras automaticamente a partir do seu histórico.
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-ghost" onclick="document.getElementById('impProRulesModal').remove()">Cancelar</button>
              <button class="btn btn-primary" id="impProRulesSave"><i class="fas fa-save"></i> Salvar regras</button>
            </div>
          </div>
        </div>`;

      document.getElementById('impProRulesModal')?.remove();
      document.body.insertAdjacentHTML('beforeend', html);

      const refresh = async () => {
        document.getElementById('impProRulesModal')?.remove();
        await this._openRulesModal();
      };

      $('impProRuleAdd').onclick = async () => {
        const cur = (await getPref('importRules', [])) || [];
        cur.push({ keyword: '', type: 'all', categoryId: cats[0]?.id, fuzzy: false });
        await setPref('importRules', cur);
        await refresh();
      };

      document.querySelectorAll('.imp-rl-del').forEach(btn => {
        btn.onclick = async () => {
          const i = parseInt(btn.dataset.idx, 10);
          const cur = (await getPref('importRules', [])) || [];
          cur.splice(i, 1);
          await setPref('importRules', cur);
          await refresh();
        };
      });

      $('impProRulesSave').onclick = async () => {
        const rows = document.querySelectorAll('#impProRulesBody .imp-rule-row');
        const cur = [];
        rows.forEach(row => {
          const kw = row.querySelector('.imp-rl-kw')?.value.trim();
          const type = row.querySelector('.imp-rl-type')?.value;
          const catId = parseInt(row.querySelector('.imp-rl-cat')?.value, 10);
          const amountMin = parseFloat(row.querySelector('.imp-rl-min')?.value) || undefined;
          const amountMax = parseFloat(row.querySelector('.imp-rl-max')?.value) || undefined;
          const fuzzy = row.querySelector('.imp-rl-fuzzy')?.checked || false;
          if (kw && catId) cur.push({ keyword: kw, type: type || 'all', categoryId: catId, amountMin, amountMax, fuzzy });
        });
        await setPref('importRules', cur);
        T(`${cur.length} regra(s) salva(s)!`, 'success');
        document.getElementById('impProRulesModal')?.remove();
      };
    },

    async _openSuggestModal() {
      T('Analisando histórico...', 'info', 1500);
      const sug = await Rules.suggestAutoRules();
      const cats = window.S.cats || [];
      if (!sug.length) { T('Nenhum padrão repetido encontrado. Adicione mais transações primeiro.', 'info'); return; }

      const html = `
        <div class="modal-wrap" id="impProSugModal">
          <div class="modal" style="max-width:720px;width:calc(100vw - 2rem)">
            <div class="modal-hdr">
              <div class="modal-title"><i class="fas fa-lightbulb" style="color:#f59e0b"></i> Sugestões Inteligentes de Regras</div>
              <button class="modal-close" onclick="document.getElementById('impProSugModal').remove()"><i class="fas fa-times"></i></button>
            </div>
            <div class="modal-body" style="padding:.85rem">
              <div style="background:rgba(245,158,11,.08);border-left:3px solid #f59e0b;padding:.6rem .85rem;border-radius:8px;font-size:.78rem;color:var(--txt2);margin-bottom:.75rem">
                <i class="fas fa-magic" style="color:#f59e0b"></i>
                IA encontrou <strong>${sug.length}</strong> padrões repetidos no seu histórico. Marque os que deseja virar regras automáticas.
              </div>
              <div style="overflow-x:auto">
                <table class="fp-imp-rules-table">
                  <thead>
                    <tr>
                      <th style="width:36px"><input type="checkbox" id="sugSelectAll" checked></th>
                      <th>Palavra-chave</th>
                      <th>Categoria sugerida</th>
                      <th>Tipo</th>
                      <th>Ocorrências</th>
                      <th>Confiança</th>
                      <th>Valor médio</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${sug.map((s, i) => {
                      const confColor = s.dominance >= 90 ? 'var(--success)' : s.dominance >= 75 ? 'var(--warning)' : 'var(--txt2)';
                      return `<tr>
                        <td><input type="checkbox" class="sug-ck" data-idx="${i}" checked></td>
                        <td><strong>${esc(s.keyword)}</strong></td>
                        <td>
                          <select class="form-inp sug-cat" style="font-size:.8rem" data-idx="${i}">
                            ${cats.map(c => `<option value="${c.id}" ${c.id == s.categoryId ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
                          </select>
                        </td>
                        <td style="font-size:.78rem">${s.type === 'expense' ? '💸 Despesa' : s.type === 'income' ? '💰 Receita' : '⇆ Todos'}</td>
                        <td><span style="font-size:.75rem;padding:1px 8px;border-radius:9999px;background:rgba(var(--accent-rgb),.12);color:var(--accent);font-weight:700">${s.occurrences}×</span></td>
                        <td><span style="font-size:.78rem;font-weight:700;color:${confColor}">${s.dominance}%</span></td>
                        <td style="font-size:.78rem;color:var(--txt2)">${fmtMoney(s.avgAmount)}</td>
                      </tr>`;
                    }).join('')}
                  </tbody>
                </table>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-ghost" onclick="document.getElementById('impProSugModal').remove()">Cancelar</button>
              <button class="btn btn-primary" id="impProSugApply"><i class="fas fa-check"></i> Adicionar selecionadas</button>
            </div>
          </div>
        </div>`;

      document.getElementById('impProSugModal')?.remove();
      document.body.insertAdjacentHTML('beforeend', html);

      $('sugSelectAll').onchange = e => {
        document.querySelectorAll('.sug-ck').forEach(cb => cb.checked = e.target.checked);
      };

      $('impProSugApply').onclick = async () => {
        const cur = (await getPref('importRules', [])) || [];
        let added = 0;
        document.querySelectorAll('.sug-ck:checked').forEach(cb => {
          const i = parseInt(cb.dataset.idx, 10);
          const s = sug[i];
          const catId = parseInt(document.querySelector(`.sug-cat[data-idx="${i}"]`)?.value, 10);
          if (!cur.some(r => norm(r.keyword) === norm(s.keyword))) {
            cur.push({ keyword: s.keyword, type: s.type, categoryId: catId || s.categoryId, fuzzy: false });
            added++;
          }
        });
        await setPref('importRules', cur);
        T(`${added} regra(s) adicionada(s)!`, 'success');
        document.getElementById('impProSugModal')?.remove();
      };
    },


    async _confirm() {
      const selected = this.state.items.filter(i => i._selected);
      if (!selected.length) { T('Selecione ao menos uma transação.', 'warning'); return; }
      if (!this.state.accountId) { T('Escolha uma conta destino.', 'warning'); return; }
      const uid = window.S.user.id;
      const cats = window.S.cats || [];
      const inserted = [];
      const now = new Date().toISOString();
      for (const it of selected) {
        const tx = {
          userId: uid,
          type: it.type,
          amount: Number(it.amount) || 0,
          description: it.description || '',
          categoryId: it.categoryId || null,
          accountId: this.state.accountId,
          date: it.date,
          tags: [],
          createdAt: now,
          updatedAt: now,
          source: `import:${this.state.format}`,
        };
        const id = await window.db.transactions.add(tx);
        tx.id = id;
        inserted.push(tx);

        // Treina LocalAI
        try {
          const cat = cats.find(c => c.id === it.categoryId);
          if (cat && window.LocalAI?.train) {
            window.LocalAI.train(it.description, cat.name, it.type);
          }
        } catch {}
      }
      try { window.LocalAI?.saveModel?.(); } catch {}

      T(`${inserted.length} transação(ões) importada(s) com sucesso!`, 'success');

      // Sugere regras automáticas com base no histórico atualizado
      try {
        const sug = await Rules.suggestAutoRules();
        if (sug.length) await Rules.saveAuto(sug);
      } catch {}

      // Reset
      this.state = { items: [], accountId: null, fileName: '', format: null, bank: null, meta: {} };
      $('impProPreview').innerHTML = '';
      $('impProStatus').innerHTML = `<div class="fp-imp-ok"><i class="fas fa-check-circle"></i> Importação concluída! Veja na aba "Transações".</div>`;

      // Refresh página de transações se acessível
      if (typeof window.refreshActivePage === 'function') window.refreshActivePage();
    },

    async _openRulesModal() {
      const { user } = await Rules.loadAll();
      const cats = window.S.cats || [];
      const html = `
        <div class="modal-wrap" id="impProRulesModal">
          <div class="modal modal-lg">
            <div class="modal-hdr">
              <div class="modal-title"><i class="fas fa-filter"></i> Regras de Importação</div>
              <button class="modal-close" onclick="document.getElementById('impProRulesModal').remove()"><i class="fas fa-times"></i></button>
            </div>
            <div class="modal-body">
              <p class="text-muted" style="margin-bottom:1rem">Quando a descrição da transação importada contiver a palavra-chave, ela será automaticamente categorizada.</p>
              <table class="fp-imp-rules-table">
                <thead>
                  <tr><th>Palavra-chave</th><th>Tipo</th><th>Categoria</th><th></th></tr>
                </thead>
                <tbody id="impProRulesBody">
                  ${(user || []).map((r, i) => `
                    <tr>
                      <td><input class="form-inp" data-idx="${i}" data-field="keyword" value="${esc(r.keyword || '')}"></td>
                      <td>
                        <select class="form-inp" data-idx="${i}" data-field="type">
                          <option value="all" ${r.type === 'all' ? 'selected' : ''}>Todos</option>
                          <option value="expense" ${r.type === 'expense' ? 'selected' : ''}>Despesa</option>
                          <option value="income" ${r.type === 'income' ? 'selected' : ''}>Receita</option>
                        </select>
                      </td>
                      <td>
                        <select class="form-inp" data-idx="${i}" data-field="categoryId">
                          ${cats.map(c => `<option value="${c.id}" ${c.id == r.categoryId ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
                        </select>
                      </td>
                      <td><button class="row-btn row-btn-d" data-del="${i}"><i class="fas fa-trash"></i></button></td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
              <button class="btn btn-outline btn-sm" id="impProRuleAdd" style="margin-top:.5rem"><i class="fas fa-plus"></i> Nova regra</button>
            </div>
            <div class="modal-footer">
              <button class="btn btn-ghost" onclick="document.getElementById('impProRulesModal').remove()">Cancelar</button>
              <button class="btn btn-primary" id="impProRulesSave"><i class="fas fa-save"></i> Salvar</button>
            </div>
          </div>
        </div>`;
      document.body.insertAdjacentHTML('beforeend', html);
      const refresh = async () => {
        document.getElementById('impProRulesModal')?.remove();
        await this._openRulesModal();
      };
      $('impProRuleAdd').onclick = async () => {
        const cur = (await getPref('importRules', [])) || [];
        cur.push({ keyword: '', type: 'all', categoryId: cats[0]?.id });
        await setPref('importRules', cur);
        await refresh();
      };
      document.querySelectorAll('#impProRulesBody [data-del]').forEach(btn => {
        btn.onclick = async () => {
          const i = parseInt(btn.dataset.del, 10);
          const cur = (await getPref('importRules', [])) || [];
          cur.splice(i, 1);
          await setPref('importRules', cur);
          await refresh();
        };
      });
      $('impProRulesSave').onclick = async () => {
        const rows = document.querySelectorAll('#impProRulesBody tr');
        const cur = [];
        for (const row of rows) {
          const r = {};
          row.querySelectorAll('[data-field]').forEach(inp => {
            r[inp.dataset.field] = inp.dataset.field === 'categoryId' ? parseInt(inp.value, 10) : inp.value;
          });
          if (r.keyword && r.categoryId) cur.push(r);
        }
        await setPref('importRules', cur);
        T('Regras salvas!', 'success');
        document.getElementById('impProRulesModal')?.remove();
      };
    },

    async _openSuggestModal() {
      T('Analisando histórico...', 'info', 1500);
      const sug = await Rules.suggestAutoRules();
      const cats = window.S.cats || [];
      if (!sug.length) { T('Nenhum padrão repetido encontrado para sugerir regras.', 'info'); return; }
      const html = `
        <div class="modal-wrap" id="impProSugModal">
          <div class="modal modal-lg">
            <div class="modal-hdr">
              <div class="modal-title"><i class="fas fa-lightbulb"></i> Sugestões de Regras</div>
              <button class="modal-close" onclick="document.getElementById('impProSugModal').remove()"><i class="fas fa-times"></i></button>
            </div>
            <div class="modal-body">
              <p class="text-muted">Baseado no seu histórico, identifiquei esses padrões. Marque os que quiser virar regras:</p>
              <table class="fp-imp-rules-table">
                <thead><tr><th></th><th>Palavra-chave</th><th>Categoria</th><th>Ocorrências</th></tr></thead>
                <tbody>
                  ${sug.map((s, i) => {
                    const c = cats.find(c => c.id === s.categoryId);
                    return `
                      <tr>
                        <td><input type="checkbox" data-idx="${i}" checked></td>
                        <td><strong>${esc(s.keyword)}</strong></td>
                        <td>${esc(c?.name || '-')}</td>
                        <td><span class="badge badge-info">${s.occurrences}×</span></td>
                      </tr>`;
                  }).join('')}
                </tbody>
              </table>
            </div>
            <div class="modal-footer">
              <button class="btn btn-ghost" onclick="document.getElementById('impProSugModal').remove()">Cancelar</button>
              <button class="btn btn-primary" id="impProSugApply">Adicionar regras selecionadas</button>
            </div>
          </div>
        </div>`;
      document.body.insertAdjacentHTML('beforeend', html);
      $('impProSugApply').onclick = async () => {
        const cur = (await getPref('importRules', [])) || [];
        document.querySelectorAll('#impProSugModal [type=checkbox]:checked').forEach(cb => {
          const i = parseInt(cb.dataset.idx, 10);
          const s = sug[i];
          if (!cur.some(r => norm(r.keyword) === norm(s.keyword))) {
            cur.push({ keyword: s.keyword, type: 'all', categoryId: s.categoryId });
          }
        });
        await setPref('importRules', cur);
        T('Regras adicionadas!', 'success');
        document.getElementById('impProSugModal')?.remove();
      };
    },
  };

  /* ═══════════════════════════════════════════════════════════
     EXPORTER — múltiplos formatos com filtros
  ═══════════════════════════════════════════════════════════ */
  const Exporter = {
    async getFiltered(filter = {}) {
      const uid = window.S.user.id;
      let txs = await window.db.transactions.where('userId').equals(uid).toArray();
      if (filter.from) txs = txs.filter(t => t.date >= filter.from);
      if (filter.to) txs = txs.filter(t => t.date <= filter.to);
      if (filter.type) txs = txs.filter(t => t.type === filter.type);
      if (filter.categoryId) txs = txs.filter(t => t.categoryId === filter.categoryId);
      if (filter.accountId) txs = txs.filter(t => t.accountId === filter.accountId);
      return txs.sort((a, b) => a.date.localeCompare(b.date));
    },

    _enrichRows(txs) {
      const cats = window.S.cats || [];
      const accs = window.S.accs || [];
      const catName = id => (cats.find(c => c.id === id) || {}).name || '';
      const accName = id => (accs.find(a => a.id === id) || {}).name || '';
      return txs.map(t => ({
        Data: t.date,
        Tipo: t.type,
        Valor: Number(t.amount).toFixed(2),
        Descrição: t.description || '',
        Categoria: catName(t.categoryId),
        Conta: accName(t.accountId),
        Tags: Array.isArray(t.tags) ? t.tags.join(', ') : '',
        Recorrente: t.isRecurring ? 'sim' : 'não',
      }));
    },

    async exportCSV(filter, separator = ';') {
      const txs = await this.getFiltered(filter);
      const rows = this._enrichRows(txs);
      if (!rows.length) { T('Nada para exportar.', 'warning'); return; }
      const headers = Object.keys(rows[0]);
      const escape = v => {
        const s = String(v || '');
        if (s.includes(separator) || s.includes('"') || s.includes('\n'))
          return '"' + s.replace(/"/g, '""') + '"';
        return s;
      };
      const csv = '﻿' + headers.join(separator) + '\n' +
        rows.map(r => headers.map(h => escape(r[h])).join(separator)).join('\n');
      this._download(`financepro-${today()}.csv`, csv, 'text/csv;charset=utf-8');
    },

    async exportXLSX(filter) {
      if (!window.XLSX) { T('SheetJS não disponível.', 'warning'); return; }
      const txs = await this.getFiltered(filter);
      const rows = this._enrichRows(txs);
      if (!rows.length) { T('Nada para exportar.', 'warning'); return; }
      const wb = window.XLSX.utils.book_new();
      const ws = window.XLSX.utils.json_to_sheet(rows);
      // Ajusta largura das colunas
      ws['!cols'] = Object.keys(rows[0]).map(k => ({
        wch: Math.max(k.length, ...rows.map(r => String(r[k] || '').length)) + 2
      }));
      window.XLSX.utils.book_append_sheet(wb, ws, 'Transações');

      // Aba de orçamentos
      const uid = window.S.user.id;
      try {
        const budgets = await window.db.budgets.where('userId').equals(uid).toArray();
        const cats = window.S.cats || [];
        if (budgets.length) {
          const bRows = budgets.map(b => ({
            Mês: b.monthYear,
            Categoria: b.categoryId ? (cats.find(c => c.id === b.categoryId)?.name || '') : 'Total',
            Limite: Number(b.limitAmount).toFixed(2),
          }));
          const bWs = window.XLSX.utils.json_to_sheet(bRows);
          window.XLSX.utils.book_append_sheet(wb, bWs, 'Orçamentos');
        }
        const goals = await window.db.goals.where('userId').equals(uid).toArray();
        if (goals.length) {
          const gRows = goals.map(g => ({
            Meta: g.name, Alvo: Number(g.targetAmount || 0).toFixed(2),
            Atual: Number(g.currentAmount || 0).toFixed(2),
            Prazo: g.deadline || '',
          }));
          const gWs = window.XLSX.utils.json_to_sheet(gRows);
          window.XLSX.utils.book_append_sheet(wb, gWs, 'Metas');
        }
      } catch {}

      const wbout = window.XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbout], { type: 'application/octet-stream' });
      this._download(`financepro-${today()}.xlsx`, blob);
    },

    async exportJSON(filter, encrypted = false, password = null) {
      const txs = await this.getFiltered(filter);
      const uid = window.S.user.id;
      const out = {
        schema: 'FinancePro-Export-v1',
        exportedAt: new Date().toISOString(),
        userId: uid,
        filter,
        data: { transactions: txs },
      };
      // Inclui categorias/contas/orçamentos/metas para referência
      try {
        out.data.categories = await window.db.categories.where('userId').equals(uid).toArray();
        out.data.accounts = await window.db.accounts.where('userId').equals(uid).toArray();
        out.data.budgets = await window.db.budgets.where('userId').equals(uid).toArray();
        out.data.goals = await window.db.goals.where('userId').equals(uid).toArray();
      } catch {}

      let content = JSON.stringify(out, null, 2);
      let name = `financepro-${today()}.json`;
      if (encrypted && password && window.CryptoJS) {
        content = window.CryptoJS.AES.encrypt(content, password).toString();
        content = JSON.stringify({ encrypted: true, schema: 'FinancePro-Export-v1-Enc', payload: content });
        name = `financepro-${today()}.enc.json`;
      }
      this._download(name, content, 'application/json');
    },

    _download(name, content, type = 'application/octet-stream') {
      if (typeof window.dl === 'function') {
        window.dl(name, content, type);
        return;
      }
      const blob = content instanceof Blob ? content : new Blob([content], { type });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = name; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },

    /** Abre modal de exportação inteligente */
    openModal() {
      if ($('impProExpModal')) return;
      const cats = window.S.cats || [];
      const accs = window.S.accs || [];
      const html = `
        <div class="modal-wrap" id="impProExpModal">
          <div class="modal">
            <div class="modal-hdr">
              <div class="modal-title"><i class="fas fa-file-export"></i> Exportação Inteligente</div>
              <button class="modal-close" onclick="document.getElementById('impProExpModal').remove()"><i class="fas fa-times"></i></button>
            </div>
            <div class="modal-body">
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">De</label>
                  <input type="date" class="form-inp" id="expFrom">
                </div>
                <div class="form-group">
                  <label class="form-label">Até</label>
                  <input type="date" class="form-inp" id="expTo">
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Tipo</label>
                  <select class="form-inp" id="expType">
                    <option value="">Todos</option>
                    <option value="expense">Despesas</option>
                    <option value="income">Receitas</option>
                    <option value="transfer">Transferências</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Categoria</label>
                  <select class="form-inp" id="expCat">
                    <option value="">Todas</option>
                    ${cats.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}
                  </select>
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Conta</label>
                <select class="form-inp" id="expAcc">
                  <option value="">Todas</option>
                  ${accs.map(a => `<option value="${a.id}">${esc(a.name)}</option>`).join('')}
                </select>
              </div>
              <div class="check-label" style="margin-top:1rem">
                <input type="checkbox" id="expEnc">
                <span>Criptografar JSON com senha</span>
              </div>
              <div class="form-group hidden" id="expPwdGroup" style="margin-top:.5rem">
                <input type="password" class="form-inp" id="expPwd" placeholder="Senha (mín. 6 caracteres)">
              </div>
            </div>
            <div class="modal-footer" style="flex-wrap:wrap;gap:.5rem">
              <button class="btn btn-outline" id="expBtnCSV"><i class="fas fa-file-csv"></i> CSV</button>
              <button class="btn btn-outline" id="expBtnXLSX"><i class="fas fa-file-excel"></i> Excel</button>
              <button class="btn btn-primary" id="expBtnJSON"><i class="fas fa-file-code"></i> JSON</button>
            </div>
          </div>
        </div>`;
      document.body.insertAdjacentHTML('beforeend', html);
      const filter = () => {
        const f = {};
        if ($('expFrom').value) f.from = $('expFrom').value;
        if ($('expTo').value) f.to = $('expTo').value;
        if ($('expType').value) f.type = $('expType').value;
        if ($('expCat').value) f.categoryId = parseInt($('expCat').value, 10);
        if ($('expAcc').value) f.accountId = parseInt($('expAcc').value, 10);
        return f;
      };
      $('expEnc').onchange = e => $('expPwdGroup').classList.toggle('hidden', !e.target.checked);
      $('expBtnCSV').onclick = () => this.exportCSV(filter()).then(() => $('impProExpModal').remove());
      $('expBtnXLSX').onclick = () => this.exportXLSX(filter()).then(() => $('impProExpModal').remove());
      $('expBtnJSON').onclick = () => {
        const enc = $('expEnc').checked;
        const pwd = $('expPwd').value;
        if (enc && (!pwd || pwd.length < 6)) { T('Senha precisa ter ao menos 6 caracteres.', 'warning'); return; }
        this.exportJSON(filter(), enc, pwd).then(() => $('impProExpModal').remove());
      };
    },
  };

  /* ═══════════════════════════════════════════════════════════
     UI INSTALL
  ═══════════════════════════════════════════════════════════ */
  const UI = {
    install() {
      // Botão "Import Pro" e "Export Pro" na topbar e em settings
      this._installTopbar();
      this._watchPages();
    },

    _installTopbar() {
      const topRight = document.querySelector('.topbar-right');
      if (!topRight || $('impProTopbarBtn')) return;
      const btn = document.createElement('button');
      btn.id = 'impProTopbarBtn';
      btn.className = 'icon-btn';
      btn.title = 'Exportação Inteligente';
      btn.innerHTML = '<i class="fas fa-file-export"></i>';
      btn.onclick = () => Exporter.openModal();
      topRight.insertBefore(btn, topRight.firstChild);
    },

    _watchPages() {
      // Quando navegar para Import, garante o painel
      const tryInject = () => {
        const page = $('page-import');
        if (page && !$('importProPanel')) Importer.openWizard().catch(() => {});
      };
      tryInject();
      let tries = 0;
      const ivl = setInterval(() => {
        tryInject();
        if (++tries > 60) clearInterval(ivl);
      }, 1500);
      // Em qualquer click que possa navegar
      document.addEventListener('click', e => {
        const t = e.target.closest('[data-route="import"], [data-page-target="import"]');
        if (t) setTimeout(tryInject, 400);
      });
    },
  };

  /* ═══════════════════════════════════════════════════════════
     ENTRY POINT
  ═══════════════════════════════════════════════════════════ */
  /* Watch for import page navigation and enhance it */
  function watchImportPage() {
    const observer = new MutationObserver(() => {
      const importBtn = document.getElementById('importFileBtn') || document.querySelector('[onclick*="onImportFile"]');
      if (importBtn && !importBtn.dataset.proBound) {
        importBtn.dataset.proBound = '1';
        // Add Pro drag-and-drop panel next to standard import
        const target = importBtn.closest('.card') || importBtn.parentElement;
        if (target && !document.getElementById('fpImportProPanel')) {
          const div = document.createElement('div');
          div.id = 'fpImportProDrop';
          div.style.cssText = 'margin-top:1rem';
          target.after(div);
          window.FP_IMPORT_PRO?.UI?.render?.('fpImportProDrop');
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  const FP_IMPORT_PRO = {
    Parser, CSV, OFX, QIF, Excel, JSONP, Money, DateParse, BankDetector,
    Rules, SmartCat, Dedup, Importer, Exporter, UI,
    async init() {
      try {
        await waitApp();
        UI.install();
        console.log('[FP_IMPORT_PRO] inicializado');
        watchImportPage();
        // After successful import, retrain LocalAI and refresh suggestions
        document.addEventListener('fpimport:saved', e => {
          const count = e.detail?.count || 0;
          if (count > 0) {
            if (typeof window.LocalAI?.trainFromHistory === 'function') {
              setTimeout(() => window.LocalAI.trainFromHistory().catch(()=>{}), 500);
            }
            if (typeof window.refreshSuggestions === 'function') {
              setTimeout(() => window.refreshSuggestions().catch(()=>{}), 800);
            }
            if (window.FP_AI_PRO?.Panel?.render) {
              setTimeout(() => window.FP_AI_PRO.Panel.render().catch(()=>{}), 1000);
            }
          }
        });
      } catch (e) {
        console.warn('[FP_IMPORT_PRO] falha init', e);
      }
    }
  };
  window.FP_IMPORT_PRO = FP_IMPORT_PRO;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => FP_IMPORT_PRO.init());
  } else {
    setTimeout(() => FP_IMPORT_PRO.init(), 1000);
  }
})();
