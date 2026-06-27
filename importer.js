/**
 * @fileoverview FinancePro — importer.js
 * Advanced CSV importer with auto-classification for:
 *   - Nubank (conta corrente / extrato)
 *   - Banco do Brasil
 *   - Formato genérico
 * Features: duplicate detection, custom rule engine, reconciliation,
 *           anomaly detection, per-import preview.
 */

'use strict';

App.importer = (() => {

  /* ══════════════════════════════════════
     CUSTOM RULE ENGINE
     Rules are stored in IndexedDB (settings key 'classifyRules')
     Rule format: { id, bank, keyword, type:'income'|'expense', categoryId, priority }
  ══════════════════════════════════════ */

  let _customRules = [];

  async function loadRules() {
    const uid  = App.state.currentUser?.id;
    if (!uid) return [];
    _customRules = await getSetting(uid, 'classifyRules', []);
    return _customRules;
  }

  async function saveRules(rules) {
    const uid = App.state.currentUser.id;
    _customRules = rules;
    await setSetting(uid, 'classifyRules', rules);
  }

  /**
   * Apply custom rules first (priority), then built-in classifiers.
   * @param {string} description
   * @param {number} amount
   * @param {'nubank'|'bb'|'generic'} bank
   * @param {Object} cats - category map by name
   */
  function applyRules(description, amount, bank, catMap) {
    const desc = (description || '').toLowerCase();

    // 1) Custom rules (ordered by priority desc)
    const sorted = [..._customRules].sort((a, b) => (b.priority || 0) - (a.priority || 0));
    for (const rule of sorted) {
      if (rule.bank && rule.bank !== 'all' && rule.bank !== bank) continue;
      if (desc.includes((rule.keyword || '').toLowerCase())) {
        return { type: rule.type, categoryId: rule.categoryId };
      }
    }

    // 2) Built-in classifiers
    if (bank === 'nubank') return classifyNubank(desc, amount, catMap);
    if (bank === 'bb')     return classifyBB(desc, amount, catMap);
    return classifyGeneric(desc, amount);
  }

  /* ══════════════════════════════════════
     BUILT-IN CLASSIFIERS
  ══════════════════════════════════════ */

  function findCatId(catMap, name) {
    return catMap[name]?.id || null;
  }

  function classifyNubank(desc, valor, catMap) {
    if (desc.includes('transferência enviada') || desc.includes('pix enviado'))
      return { type: 'expense', categoryId: findCatId(catMap, 'Transferência') || findCatId(catMap, 'Outros') };
    if (desc.includes('transferência recebida') || desc.includes('pix recebido'))
      return { type: 'income',  categoryId: findCatId(catMap, 'Outras receitas') };
    if (desc.includes('aplicação rdb') || desc.includes('aplicação'))
      return { type: 'expense', categoryId: findCatId(catMap, 'Investimentos') };
    if (desc.includes('resgate rdb') || desc.includes('resgate'))
      return { type: 'income',  categoryId: findCatId(catMap, 'Investimentos') };
    if (desc.includes('recarga de celular'))
      return { type: 'expense', categoryId: findCatId(catMap, 'Assinaturas') };
    if (desc.includes('uber') || desc.includes('99') || desc.includes('cabify'))
      return { type: 'expense', categoryId: findCatId(catMap, 'Transporte') };
    if (desc.includes('ifood') || desc.includes('rappi') || desc.includes('delivery'))
      return { type: 'expense', categoryId: findCatId(catMap, 'Alimentação') };
    if (desc.includes('compra no débito') || desc.includes('nupay') || desc.includes('débito'))
      return { type: 'expense', categoryId: findCatId(catMap, 'Compras') };
    if (desc.includes('venda de criptomoedas') || desc.includes('cripto'))
      return { type: 'income',  categoryId: findCatId(catMap, 'Investimentos') };
    if (desc.includes('salário') || desc.includes('salario') || desc.includes('pagamento'))
      return { type: 'income',  categoryId: findCatId(catMap, 'Salário') };
    if (desc.includes('netflix') || desc.includes('spotify') || desc.includes('amazon prime') || desc.includes('disney'))
      return { type: 'expense', categoryId: findCatId(catMap, 'Assinaturas') };
    if (desc.includes('farmácia') || desc.includes('farmacia') || desc.includes('drogaria') || desc.includes('hospital'))
      return { type: 'expense', categoryId: findCatId(catMap, 'Saúde') };
    if (desc.includes('escola') || desc.includes('faculdade') || desc.includes('curso') || desc.includes('mensalidade'))
      return { type: 'expense', categoryId: findCatId(catMap, 'Educação') };
    if (desc.includes('supermercado') || desc.includes('mercado') || desc.includes('carrefour') || desc.includes('extra'))
      return { type: 'expense', categoryId: findCatId(catMap, 'Alimentação') };
    if (desc.includes('posto') || desc.includes('combustível') || desc.includes('gasolina'))
      return { type: 'expense', categoryId: findCatId(catMap, 'Transporte') };
    if (desc.includes('aluguel') || desc.includes('condomínio') || desc.includes('iptu') || desc.includes('energia') || desc.includes('água'))
      return { type: 'expense', categoryId: findCatId(catMap, 'Moradia') };
    // Fallback
    if (valor < 0) return { type: 'expense', categoryId: findCatId(catMap, 'Outros') };
    return      { type: 'income',  categoryId: findCatId(catMap, 'Outras receitas') };
  }

  function classifyBB(desc, amount, catMap) {
    const rules = {
      'TRANSFERENCIA PIX':           { debito: 'Outros',        credito: 'Outras receitas' },
      'PIX QR CODE':                 { debito: 'Compras',       credito: 'Outras receitas' },
      'GASTOS CARTAO DE CREDITO':    { debito: 'Compras' },
      'SERVICO CARTAO PROTEGIDO':    { debito: 'Assinaturas' },
      'RENDIMENTOS':                 { credito: 'Investimentos' },
      'DEVOLUCAO PIX':               { credito: 'Outras receitas' },
      'PAGAMENTO BOLETO':            { debito: 'Outros' },
      'TARIFA BANCARIA':             { debito: 'Outros' },
      'APLICACAO':                   { debito: 'Investimentos', credito: 'Investimentos' },
      'RESGATE':                     { credito: 'Investimentos' },
      'SALARIO':                     { credito: 'Salário' },
      'FOLHA':                       { credito: 'Salário' },
    };
    const nature = amount > 0 ? 'credito' : 'debito';
    const upperDesc = desc.toUpperCase().trim();
    for (const [key, cats] of Object.entries(rules)) {
      if (upperDesc.includes(key)) {
        const catName = cats[nature] || (nature === 'debito' ? 'Outros' : 'Outras receitas');
        return { type: nature === 'credito' ? 'income' : 'expense', categoryId: findCatId(catMap, catName) };
      }
    }
    return { type: amount > 0 ? 'income' : 'expense', categoryId: findCatId(catMap, amount > 0 ? 'Outras receitas' : 'Outros') };
  }

  function classifyGeneric(desc, amount) {
    return { type: amount < 0 ? 'expense' : 'income', categoryId: null };
  }

  /* ══════════════════════════════════════
     CSV PARSERS
  ══════════════════════════════════════ */

  function parseDate(str) {
    if (!str) return today();
    str = str.trim();
    // DD/MM/YYYY
    const m1 = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m1) return `${m1[3]}-${m1[2].padStart(2,'0')}-${m1[1].padStart(2,'0')}`;
    // YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
    // DD/MM/YY
    const m2 = str.match(/^(\d{2})\/(\d{2})\/(\d{2})$/);
    if (m2) return `20${m2[3]}-${m2[2].padStart(2,'0')}-${m2[1].padStart(2,'0')}`;
    return today();
  }

  function parseBRL(str) {
    if (!str) return 0;
    return parseFloat(str.replace(/\./g,'').replace(',','.')) || 0;
  }

  /**
   * Detect bank format from CSV header row.
   * @param {string[][]} rows
   * @returns {'nubank'|'bb'|'generic'}
   */
  function detectBank(rows) {
    if (!rows.length) return 'generic';
    const header = (rows[0] || []).map(c => c.trim().toLowerCase()).join('|');
    if (header.includes('identificador') && header.includes('valor')) return 'nubank';
    if (header.includes('histórico') || header.includes('historico')) return 'bb';
    if (header.includes('data') && header.includes('descrição')) return 'generic';
    return 'generic';
  }

  /**
   * Parse Nubank CSV rows into raw transaction objects.
   * Header: Data, Valor, Identificador, Descrição
   */
  function parseNubank(rows) {
    const results = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i].map(c => (c||'').trim());
      if (r.length < 3) continue;
      const dateStr = r[0];
      if (!/\d/.test(dateStr)) continue;
      const valor    = parseBRL(r[1]);
      const docto    = r[2] || '';
      const desc     = r.slice(3).join(' ').trim() || r[2] || '';
      results.push({ date: parseDate(dateStr), amount: Math.abs(valor), rawAmount: valor, description: desc, docto });
    }
    return results;
  }

  /**
   * Parse BB CSV rows.
   * Header: Data, Histórico, Docto., Crédito (R$), Débito (R$), Saldo (R$)
   */
  function parseBB(rows) {
    const results = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i].map(c => (c||'').trim());
      if (r.length < 4) continue;
      if (!/\d{2}\/\d{2}\/\d{4}/.test(r[0])) continue;
      const credito = parseBRL(r[3]);
      const debito  = parseBRL(r[4]);
      if (credito === 0 && debito === 0) continue;
      const rawAmount = credito > 0 ? credito : -debito;
      results.push({
        date: parseDate(r[0]),
        amount: Math.abs(rawAmount),
        rawAmount,
        description: r[1] || '',
        docto: r[2] || '',
      });
    }
    return results;
  }

  /**
   * Parse generic CSV (Date, Description, Amount).
   */
  function parseGeneric(rows) {
    const results = [];
    // Find column indices
    const header = (rows[0] || []).map(c => c.trim().toLowerCase());
    const dateCol = header.findIndex(h => h.includes('data') || h.includes('date'));
    const descCol = header.findIndex(h => h.includes('descri') || h.includes('desc') || h.includes('historic'));
    const amtCol  = header.findIndex(h => h.includes('valor') || h.includes('amount') || h.includes('value'));
    if (dateCol < 0 || amtCol < 0) return results;

    for (let i = 1; i < rows.length; i++) {
      const r = rows[i].map(c => (c||'').trim());
      const rawAmount = parseBRL(r[amtCol]);
      if (!rawAmount && rawAmount !== 0) continue;
      results.push({
        date: parseDate(r[dateCol]),
        amount: Math.abs(rawAmount),
        rawAmount,
        description: descCol >= 0 ? r[descCol] : '',
        docto: '',
      });
    }
    return results;
  }

  /* ══════════════════════════════════════
     DUPLICATE DETECTION
  ══════════════════════════════════════ */

  function isDuplicate(tx, existing) {
    return existing.some(e =>
      e.date   === tx.date &&
      Math.abs(e.amount - tx.amount) < 0.01 &&
      e.type   === tx.type &&
      ((tx.docto && e.docto === tx.docto) ||
       (!tx.docto && (e.description || '').toLowerCase() === (tx.description || '').toLowerCase()))
    );
  }

  /* ══════════════════════════════════════
     RECONCILIATION
     Identify transfers between accounts (same amount, close dates, opposite types).
  ══════════════════════════════════════ */

  function reconcile(newTxs, existing) {
    const reconciled = [];
    for (const tx of newTxs) {
      const partner = existing.find(e =>
        e.type !== tx.type &&
        Math.abs(e.amount - tx.amount) < 0.01 &&
        Math.abs(new Date(e.date) - new Date(tx.date)) <= 3 * 86400000 // 3 days window
      );
      if (partner) {
        reconciled.push({ tx, partnerId: partner.id });
      }
    }
    return reconciled;
  }

  /* ══════════════════════════════════════
     ANOMALY DETECTION (IQR method)
  ══════════════════════════════════════ */

  function detectAnomalies(txs) {
    const amounts = txs.filter(t => t.type === 'expense').map(t => t.amount).sort((a,b)=>a-b);
    if (amounts.length < 4) return new Set();
    const q1 = amounts[Math.floor(amounts.length * 0.25)];
    const q3 = amounts[Math.floor(amounts.length * 0.75)];
    const iqr = q3 - q1;
    const upper = q3 + 1.5 * iqr;
    return new Set(txs.filter(t => t.amount > upper).map(t => t.id || t._tempId));
  }

  /* ══════════════════════════════════════
     IMPORT MODAL UI
  ══════════════════════════════════════ */

  let _previewData  = [];
  let _detectedBank = 'generic';
  let _accountId    = null;

  function openImportModal() {
    // Ensure modal exists
    let modal = $id('modalImport');
    if (!modal) buildImportModal();
    loadRules().then(() => populateRulesUI());
    // Populate account selector
    const accs = App.state.accountsCache;
    const sel  = $id('importAccount');
    if (sel) {
      sel.innerHTML = accs.map(a =>
        `<option value="${a.id}">${escapeHtml(a.name)}</option>`
      ).join('') || '<option value="">Nenhuma conta</option>';
    }
    App.modal.open('modalImport');
  }

  function buildImportModal() {
    const div = document.createElement('div');
    div.className = 'modal-backdrop hidden';
    div.id = 'modalImport';
    div.setAttribute('role','dialog');
    div.setAttribute('aria-modal','true');
    div.innerHTML = `
      <div class="modal" style="max-width:680px">
        <div class="modal-header">
          <h2 class="modal-title">Importar Extrato</h2>
          <button class="modal-close" onclick="App.modal.close('modalImport')">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="modal-body">

          <!-- Step 1: Upload -->
          <div id="importStep1">
            <div class="import-drop-zone" id="importDropZone"
                 onclick="$id('importFileInput').click()"
                 ondragover="event.preventDefault()"
                 ondrop="App.importer.handleDrop(event)">
              <i class="fas fa-file-import" style="font-size:2.5rem;color:var(--accent);margin-bottom:12px"></i>
              <p style="font-weight:var(--fw-semi);margin-bottom:4px">Arraste o arquivo aqui ou clique para selecionar</p>
              <p style="font-size:var(--text-sm)">Suporte: Nubank CSV, Banco do Brasil CSV, formato genérico</p>
              <input type="file" id="importFileInput" accept=".csv,.txt" hidden
                     onchange="App.importer.handleFile(this.files[0])" />
            </div>

            <div class="form-row-2" style="margin-top:16px">
              <div class="form-group">
                <label class="form-label">Banco / Formato</label>
                <select id="importBankSelect" class="form-input" onchange="App.importer.setBankOverride(this.value)">
                  <option value="auto">Detectar automaticamente</option>
                  <option value="nubank">Nubank</option>
                  <option value="bb">Banco do Brasil</option>
                  <option value="generic">Genérico</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Conta destino</label>
                <select id="importAccount" class="form-input"></select>
              </div>
            </div>

            <div id="importStatus" style="margin-top:12px;font-size:var(--text-sm);color:var(--text-secondary)"></div>
          </div>

          <!-- Step 2: Preview -->
          <div id="importStep2" class="hidden">
            <div class="import-summary" id="importSummary"></div>
            <div style="max-height:320px;overflow-y:auto;margin-top:12px">
              <table class="data-table" id="importPreviewTable">
                <thead>
                  <tr>
                    <th><input type="checkbox" id="importSelectAll" checked onchange="App.importer.toggleAllPreview(this.checked)"/></th>
                    <th>Data</th><th>Descrição</th><th>Tipo</th><th>Categoria</th><th>Valor</th><th>Status</th>
                  </tr>
                </thead>
                <tbody id="importPreviewBody"></tbody>
              </table>
            </div>
          </div>

          <!-- Rules Tab -->
          <div style="margin-top:20px;border-top:1px solid var(--border);padding-top:16px">
            <button class="link-btn" onclick="App.importer.toggleRulesPanel()"
                    style="display:flex;align-items:center;gap:6px">
              <i class="fas fa-cog"></i> Regras de categorização personalizadas
              <i class="fas fa-chevron-down" id="rulesChevron"></i>
            </button>
            <div id="rulesPanel" class="hidden" style="margin-top:12px">
              <div id="rulesList" style="margin-bottom:12px"></div>
              <button class="btn btn-outline btn-sm" onclick="App.importer.addRuleRow()">
                <i class="fas fa-plus"></i> Nova regra
              </button>
              <button class="btn btn-primary btn-sm" onclick="App.importer.saveRulesUI()" style="margin-left:8px">
                <i class="fas fa-save"></i> Salvar regras
              </button>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-ghost" onclick="App.modal.close('modalImport')">Cancelar</button>
          <button class="btn btn-outline" id="importBackBtn" onclick="App.importer.backToStep1()" style="display:none">
            <i class="fas fa-arrow-left"></i> Voltar
          </button>
          <button class="btn btn-primary" id="importConfirmBtn" onclick="App.importer.confirmImport()" style="display:none">
            <i class="fas fa-download"></i> Importar selecionadas
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(div);
  }

  /* ── Drop zone ── */
  function handleDrop(event) {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  /* ── File handling ── */
  let _bankOverride = 'auto';
  function setBankOverride(val) { _bankOverride = val; }

  async function handleFile(file) {
    if (!file) return;
    const status = $id('importStatus');
    status.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Lendo arquivo...';

    try {
      let text = await readFileText(file);

      // Encoding detection — if garbled chars, try Latin-1
      if (text.includes('\uFFFD') || text.includes('脙')) {
        text = await new Promise((res, rej) => {
          const r = new FileReader();
          r.onload  = e => res(e.target.result);
          r.onerror = rej;
          r.readAsText(file, 'ISO-8859-1');
        });
      }

      // Detect delimiter
      const delim = text.includes(';') ? ';' : ',';

      // Parse CSV manually (avoid external dep)
      const rows = parseCSVText(text, delim);

      // Detect or override bank
      _detectedBank = _bankOverride !== 'auto' ? _bankOverride : detectBank(rows);
      $id('importBankSelect').value = _detectedBank;

      status.innerHTML = `<i class="fas fa-check-circle" style="color:var(--color-success)"></i> Arquivo lido — Banco detectado: <strong>${_detectedBank.toUpperCase()}</strong> | ${rows.length - 1} linhas`;

      // Parse raw rows
      let raw = [];
      if (_detectedBank === 'nubank') raw = parseNubank(rows);
      else if (_detectedBank === 'bb') raw = parseBB(rows);
      else                             raw = parseGeneric(rows);

      if (!raw.length) {
        status.innerHTML = '<span style="color:var(--color-danger)">Nenhuma transação encontrada no arquivo.</span>';
        return;
      }

      // Load categories, build name→cat map
      const uid  = App.state.currentUser.id;
      const cats = await db.categories.where('userId').equals(uid).toArray();
      const catNameMap = Object.fromEntries(cats.map(c => [c.name, c]));
      const catIdMap   = Object.fromEntries(cats.map(c => [c.id, c]));

      // Classify
      await loadRules();
      const classified = raw.map((r, idx) => {
        const cl = applyRules(r.description, r.rawAmount, _detectedBank, catNameMap);
        return {
          _tempId: idx,
          ...r,
          type:       cl.type,
          categoryId: cl.categoryId,
          selected:   true,
        };
      });

      // Duplicate detection
      const existing = await db.transactions.where('userId').equals(uid).toArray();
      classified.forEach(tx => {
        tx.isDuplicate = isDuplicate(tx, existing);
        if (tx.isDuplicate) tx.selected = false;
      });

      // Anomaly detection
      const anomalyIds = detectAnomalies(classified);
      classified.forEach(tx => { tx.isAnomaly = anomalyIds.has(tx._tempId); });

      _previewData  = classified;
      _accountId    = parseInt($id('importAccount')?.value) || App.state.accountsCache[0]?.id;

      renderPreview(classified, catIdMap);
      showStep2();
    } catch (err) {
      status.innerHTML = `<span style="color:var(--color-danger)">Erro: ${escapeHtml(err.message)}</span>`;
    }
  }

  /* ── Simple CSV parser (no external dep) ── */
  function parseCSVText(text, delim = ',') {
    const rows = [];
    const lines = text.split(/\r?\n/);
    for (const line of lines) {
      if (!line.trim()) continue;
      const row = [];
      let cur = '', inQ = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') { inQ = !inQ; continue; }
        if (ch === delim && !inQ) { row.push(cur); cur = ''; continue; }
        cur += ch;
      }
      row.push(cur);
      rows.push(row);
    }
    return rows;
  }

  /* ── Preview rendering ── */
  function renderPreview(data, catIdMap) {
    const tbody = $id('importPreviewBody');
    const income  = data.filter(t=>!t.isDuplicate&&t.type==='income').reduce((s,t)=>s+t.amount,0);
    const expense = data.filter(t=>!t.isDuplicate&&t.type==='expense').reduce((s,t)=>s+t.amount,0);
    const dupes   = data.filter(t=>t.isDuplicate).length;
    const anomalies = data.filter(t=>t.isAnomaly).length;
    const cur = App.state.settings?.currency;

    $id('importSummary').innerHTML = `
      <div style="display:flex;gap:16px;flex-wrap:wrap;padding:12px 16px;background:var(--bg-subtle);border-radius:var(--radius);font-size:var(--text-sm)">
        <span><strong>${data.length}</strong> transações encontradas</span>
        <span style="color:var(--color-success)"><i class="fas fa-arrow-up"></i> ${formatCurrency(income,cur)}</span>
        <span style="color:var(--color-danger)"><i class="fas fa-arrow-down"></i> ${formatCurrency(expense,cur)}</span>
        ${dupes > 0 ? `<span style="color:var(--color-warning)"><i class="fas fa-copy"></i> ${dupes} duplicata(s) detectada(s)</span>` : ''}
        ${anomalies > 0 ? `<span style="color:var(--color-danger)"><i class="fas fa-exclamation-triangle"></i> ${anomalies} valor(es) anômalo(s)</span>` : ''}
      </div>
    `;

    const cats = App.state.categoriesCache;
    const catSel = cats.map(c=>`<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');

    tbody.innerHTML = data.map((t, i) => {
      const cat = catIdMap[t.categoryId];
      const statusHtml = t.isDuplicate
        ? '<span class="badge badge--warning">Duplicata</span>'
        : t.isAnomaly
        ? '<span class="badge badge--danger" title="Valor muito acima da média">Anômalo</span>'
        : '<span class="badge badge--success">Novo</span>';

      return `
        <tr style="opacity:${t.isDuplicate?'.5':'1'}">
          <td><input type="checkbox" ${t.selected?'checked':''} onchange="App.importer.toggleRow(${i},this.checked)" /></td>
          <td style="white-space:nowrap;font-size:var(--text-xs)">${formatDate(t.date)}</td>
          <td style="font-size:var(--text-xs);max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"
              title="${escapeHtml(t.description)}">${escapeHtml(t.description)}</td>
          <td>
            <select style="padding:3px 6px;font-size:var(--text-xs);border:1px solid var(--border);border-radius:6px;background:var(--input-bg);color:var(--text)"
                    onchange="App.importer.setRowType(${i},this.value)">
              <option value="expense" ${t.type==='expense'?'selected':''}>Despesa</option>
              <option value="income"  ${t.type==='income'?'selected':''}>Receita</option>
            </select>
          </td>
          <td>
            <select style="padding:3px 6px;font-size:var(--text-xs);border:1px solid var(--border);border-radius:6px;background:var(--input-bg);color:var(--text);max-width:120px"
                    onchange="App.importer.setRowCategory(${i},this.value)">
              ${catSel.replace(`value="${t.categoryId}"`, `value="${t.categoryId}" selected`)}
            </select>
          </td>
          <td class="tx-amount tx-amount--${t.type}" style="white-space:nowrap;font-size:var(--text-sm)">
            ${t.type==='income'?'+':'−'} ${formatCurrency(t.amount,cur)}
          </td>
          <td>${statusHtml}</td>
        </tr>
      `;
    }).join('');
  }

  function toggleRow(idx, checked)   { _previewData[idx].selected = checked; }
  function setRowType(idx, type)     { _previewData[idx].type = type; }
  function setRowCategory(idx, catId){ _previewData[idx].categoryId = parseInt(catId); }

  function toggleAllPreview(checked) {
    _previewData.forEach((t, i) => {
      if (!t.isDuplicate) { t.selected = checked; }
    });
    // Re-check all checkboxes
    const rows = $id('importPreviewBody').querySelectorAll('input[type=checkbox]');
    rows.forEach((cb, i) => { if (!_previewData[i]?.isDuplicate) cb.checked = checked; });
  }

  /* ── Step navigation ── */
  function showStep2() {
    $id('importStep1').classList.add('hidden');
    $id('importStep2').classList.remove('hidden');
    $id('importBackBtn').style.display = 'inline-flex';
    $id('importConfirmBtn').style.display = 'inline-flex';
  }

  function backToStep1() {
    $id('importStep2').classList.add('hidden');
    $id('importStep1').classList.remove('hidden');
    $id('importBackBtn').style.display = 'none';
    $id('importConfirmBtn').style.display = 'none';
    _previewData = [];
  }

  /* ── Confirm import ── */
  async function confirmImport() {
    const uid      = App.state.currentUser.id;
    const selected = _previewData.filter(t => t.selected && !t.isDuplicate);
    if (!selected.length) return showToast('Nenhuma transação selecionada.', 'warning');

    const accId = parseInt($id('importAccount')?.value) || App.state.accountsCache[0]?.id;

    const toInsert = selected.map(t => ({
      userId:         uid,
      type:           t.type,
      amount:         t.amount,
      categoryId:     t.categoryId || null,
      accountId:      accId,
      date:           t.date,
      description:    t.description,
      tags:           [],
      isRecurring:    false,
      recurringRule:  null,
      groupId:        null,
      installmentNum: null,
      installmentTotal: null,
      docto:          t.docto || '',
      createdAt:      new Date().toISOString(),
      updatedAt:      new Date().toISOString(),
    }));

    await db.transactions.bulkAdd(toInsert);

    showToast(`${toInsert.length} transações importadas com sucesso!`, 'success');
    App.modal.close('modalImport');
    backToStep1();

    EventBus.emit('transactionSaved');
    if (App.state.currentPage === 'transactions') App.transactions.load();
    if (App.state.currentPage === 'dashboard')    App.dashboard.load();
  }

  /* ══════════════════════════════════════
     RULES UI
  ══════════════════════════════════════ */

  let _rulesUI = [];

  function toggleRulesPanel() {
    const panel   = $id('rulesPanel');
    const chevron = $id('rulesChevron');
    const hidden  = panel.classList.toggle('hidden');
    chevron.className = `fas fa-chevron-${hidden ? 'down' : 'up'}`;
  }

  async function populateRulesUI() {
    _rulesUI = [..._customRules];
    renderRulesUI();
  }

  function renderRulesUI() {
    const cats = App.state.categoriesCache;
    const catOptions = cats.map(c =>
      `<option value="${c.id}">${escapeHtml(c.name)}</option>`
    ).join('');

    const el = $id('rulesList');
    if (!el) return;
    if (!_rulesUI.length) {
      el.innerHTML = '<p style="font-size:var(--text-sm);color:var(--text-secondary)">Nenhuma regra personalizada. Adicione abaixo.</p>';
      return;
    }
    el.innerHTML = `
      <table style="width:100%;border-collapse:collapse;font-size:var(--text-xs)">
        <thead>
          <tr style="background:var(--bg-subtle)">
            <th style="padding:8px;text-align:left">Palavra-chave</th>
            <th style="padding:8px;text-align:left">Banco</th>
            <th style="padding:8px;text-align:left">Tipo</th>
            <th style="padding:8px;text-align:left">Categoria</th>
            <th style="padding:8px;text-align:left">Prio.</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${_rulesUI.map((r, i) => `
            <tr style="border-bottom:1px solid var(--border)">
              <td style="padding:6px"><input type="text" value="${escapeHtml(r.keyword)}" class="form-input" style="padding:4px 8px;font-size:var(--text-xs)"
                onchange="_rulesUI[${i}].keyword=this.value" /></td>
              <td style="padding:6px">
                <select class="form-input" style="padding:4px;font-size:var(--text-xs)" onchange="_rulesUI[${i}].bank=this.value">
                  <option value="all" ${r.bank==='all'?'selected':''}>Todos</option>
                  <option value="nubank" ${r.bank==='nubank'?'selected':''}>Nubank</option>
                  <option value="bb" ${r.bank==='bb'?'selected':''}>BB</option>
                </select>
              </td>
              <td style="padding:6px">
                <select class="form-input" style="padding:4px;font-size:var(--text-xs)" onchange="_rulesUI[${i}].type=this.value">
                  <option value="expense" ${r.type==='expense'?'selected':''}>Despesa</option>
                  <option value="income"  ${r.type==='income'?'selected':''}>Receita</option>
                </select>
              </td>
              <td style="padding:6px">
                <select class="form-input" style="padding:4px;font-size:var(--text-xs)" onchange="_rulesUI[${i}].categoryId=parseInt(this.value)">
                  ${catOptions.replace(`value="${r.categoryId}"`,`value="${r.categoryId}" selected`)}
                </select>
              </td>
              <td style="padding:6px"><input type="number" value="${r.priority||0}" min="0" max="100" class="form-input"
                style="padding:4px 8px;font-size:var(--text-xs);width:60px" onchange="_rulesUI[${i}].priority=parseInt(this.value)||0" /></td>
              <td style="padding:6px">
                <button class="row-btn row-btn--danger" onclick="App.importer.removeRuleRow(${i})"><i class="fas fa-trash"></i></button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  function addRuleRow() {
    _rulesUI.push({ id: Date.now(), keyword: '', bank: 'all', type: 'expense', categoryId: App.state.categoriesCache[0]?.id || null, priority: 0 });
    renderRulesUI();
  }

  function removeRuleRow(idx) {
    _rulesUI.splice(idx, 1);
    renderRulesUI();
  }

  async function saveRulesUI() {
    await saveRules(_rulesUI);
    showToast('Regras salvas!', 'success');
  }

  return {
    openImportModal,
    handleFile, handleDrop, setBankOverride,
    toggleRow, toggleAllPreview, setRowType, setRowCategory,
    toggleRulesPanel, addRuleRow, removeRuleRow, saveRulesUI,
    backToStep1, confirmImport,
    detectAnomalies,
  };
})();
