/**
 * @fileoverview FinancePro — lockscreen.js
 * Modo anônimo / tela de bloqueio:
 *  - PIN de 4-6 dígitos (diferente do login)
 *  - Bloqueio automático após N minutos de inatividade
 *  - Botão manual de bloqueio
 *  - Desfoca conteúdo sensível sem sair da sessão
 */

'use strict';

App.lock = (() => {

  let _locked     = false;
  let _pinHash    = null;
  let _timeout    = null;
  let _inactivity = 5; // minutes default
  const PIN_KEY   = 'fp_lock_pin';
  const PREFS_KEY = 'fp_lock_prefs';

  /* ══════════════════════════════════════
     INIT — called from App.init
  ══════════════════════════════════════ */
  function init() {
    loadPrefs();
    injectUI();
    resetInactivityTimer();

    // Track activity
    ['mousemove','keydown','touchstart','click'].forEach(evt => {
      document.addEventListener(evt, resetInactivityTimer, { passive: true });
    });

    // Add lock button to topbar
    const topbarActions = document.querySelector('.topbar-actions');
    if (topbarActions && !$id('lockBtn')) {
      const btn = document.createElement('button');
      btn.className = 'icon-btn';
      btn.id        = 'lockBtn';
      btn.title     = 'Bloquear tela';
      btn.setAttribute('aria-label','Bloquear tela');
      btn.innerHTML = '<i class="fas fa-lock"></i>';
      btn.onclick   = () => lock();
      topbarActions.insertBefore(btn, topbarActions.firstChild);
    }
  }

  /* ── Load prefs from localStorage ── */
  function loadPrefs() {
    try {
      const raw = localStorage.getItem(PREFS_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        _inactivity = p.inactivity || 5;
      }
      _pinHash = localStorage.getItem(PIN_KEY);
    } catch {}
  }

  /* ── Inactivity timer ── */
  function resetInactivityTimer() {
    if (_locked) return;
    clearTimeout(_timeout);
    if (!_pinHash) return; // no PIN set → no auto-lock
    _timeout = setTimeout(() => lock(), _inactivity * 60 * 1000);
  }

  /* ══════════════════════════════════════
     LOCK / UNLOCK
  ══════════════════════════════════════ */
  function lock() {
    if (!_pinHash) {
      // No PIN set → just blur content and ask to set one
      showSetPinModal();
      return;
    }
    _locked = true;
    showLockScreen();
  }

  function unlock(pin) {
    const hash = hashPassword(pin, 'fp_lock_salt');
    if (hash !== _pinHash) {
      // Shake effect
      const input = $id('lockPinInput');
      input.classList.add('shake');
      input.value = '';
      setTimeout(() => input.classList.remove('shake'), 500);
      showToast('PIN incorreto', 'error');
      return;
    }
    _locked = false;
    hideLockScreen();
    resetInactivityTimer();
  }

  /* ══════════════════════════════════════
     LOCK SCREEN UI
  ══════════════════════════════════════ */
  function injectUI() {
    if ($id('lockScreen')) return;
    const div = document.createElement('div');
    div.id        = 'lockScreen';
    div.className = 'lock-screen hidden';
    div.setAttribute('role','dialog');
    div.setAttribute('aria-modal','true');
    div.setAttribute('aria-label','Tela bloqueada');
    div.innerHTML = `
      <div class="lock-card">
        <div class="lock-icon"><i class="fas fa-lock"></i></div>
        <h2 class="lock-title">Tela bloqueada</h2>
        <p class="lock-subtitle">Digite seu PIN para continuar</p>
        <div class="lock-dots" id="lockDots">
          <span class="lock-dot"></span><span class="lock-dot"></span>
          <span class="lock-dot"></span><span class="lock-dot"></span>
        </div>
        <!-- Numeric pad -->
        <div class="lock-numpad">
          ${[1,2,3,4,5,6,7,8,9,'','0','⌫'].map(k => `
            <button class="lock-key ${k===''?'lock-key--empty':''}"
                    onclick="App.lock.handleKey('${k}')">${k}</button>
          `).join('')}
        </div>
        <button class="link-btn" style="margin-top:16px" onclick="App.auth.logout()">
          Sair da conta
        </button>
      </div>
    `;
    document.body.appendChild(div);
  }

  let _pinBuffer = '';

  function handleKey(key) {
    if (key === '⌫') {
      _pinBuffer = _pinBuffer.slice(0, -1);
    } else if (key !== '' && _pinBuffer.length < 6) {
      _pinBuffer += key;
    }
    updateDots();
    if (_pinBuffer.length >= 4 && _pinBuffer.length === _pinHash?.length || _pinBuffer.length === 6) {
      // Wait a tick then verify
      setTimeout(() => {
        const pin = _pinBuffer;
        _pinBuffer = '';
        updateDots();
        unlock(pin);
      }, 150);
    }
  }

  function updateDots() {
    const dots = document.querySelectorAll('.lock-dot');
    dots.forEach((d, i) => d.classList.toggle('lock-dot--filled', i < _pinBuffer.length));
  }

  function showLockScreen() {
    const ls = $id('lockScreen');
    if (ls) {
      ls.classList.remove('hidden');
      ls.classList.add('lock-screen--visible');
      _pinBuffer = '';
      updateDots();
    }
    // Blur app content
    const shell = $id('appShell');
    if (shell) shell.style.filter = 'blur(8px)';
  }

  function hideLockScreen() {
    const ls = $id('lockScreen');
    if (ls) {
      ls.classList.remove('lock-screen--visible');
      ls.classList.add('hidden');
    }
    const shell = $id('appShell');
    if (shell) shell.style.filter = '';
    $id('lockBtn')?.querySelector('i')?.setAttribute('class','fas fa-lock');
  }

  /* ══════════════════════════════════════
     SET PIN MODAL
  ══════════════════════════════════════ */
  function showSetPinModal() {
    let modal = $id('modalSetPin');
    if (!modal) {
      modal = document.createElement('div');
      modal.className = 'modal-backdrop hidden';
      modal.id = 'modalSetPin';
      modal.setAttribute('role','dialog');
      modal.innerHTML = `
        <div class="modal modal--sm">
          <div class="modal-header">
            <h2 class="modal-title">Configurar PIN de bloqueio</h2>
            <button class="modal-close" onclick="App.modal.close('modalSetPin')"><i class="fas fa-times"></i></button>
          </div>
          <div class="modal-body">
            <p style="font-size:var(--text-sm);color:var(--text-secondary);margin-bottom:var(--space-4)">
              Defina um PIN de 4-6 dígitos para bloquear rapidamente o aplicativo, sem sair da sua conta.
            </p>
            <div class="form-group">
              <label class="form-label">Novo PIN (4-6 dígitos)</label>
              <input type="password" id="setPinInput" class="form-input" inputmode="numeric" maxlength="6" placeholder="••••" />
            </div>
            <div class="form-group">
              <label class="form-label">Confirmar PIN</label>
              <input type="password" id="setPinConfirm" class="form-input" inputmode="numeric" maxlength="6" placeholder="••••" />
            </div>
            <div class="form-group">
              <label class="form-label">Bloquear após (minutos de inatividade)</label>
              <select id="lockInactivity" class="form-input">
                <option value="2">2 minutos</option>
                <option value="5" selected>5 minutos</option>
                <option value="10">10 minutos</option>
                <option value="30">30 minutos</option>
                <option value="0">Nunca (somente manual)</option>
              </select>
            </div>
            ${_pinHash ? `<button class="btn btn-danger btn-sm" onclick="App.lock.removePin()" style="margin-bottom:12px">
              <i class="fas fa-unlock"></i> Remover PIN</button>` : ''}
          </div>
          <div class="modal-footer">
            <button class="btn btn-ghost" onclick="App.modal.close('modalSetPin')">Cancelar</button>
            <button class="btn btn-primary" onclick="App.lock.savePin()">
              <i class="fas fa-lock"></i> Salvar PIN
            </button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    }
    App.modal.open('modalSetPin');
  }

  function savePin() {
    const pin  = $id('setPinInput').value.trim();
    const conf = $id('setPinConfirm').value.trim();
    const inact= parseInt($id('lockInactivity').value);

    if (!pin || pin.length < 4) return showToast('PIN deve ter ao menos 4 dígitos.', 'error');
    if (!/^\d+$/.test(pin))     return showToast('PIN deve conter apenas números.', 'error');
    if (pin !== conf)            return showToast('Os PINs não coincidem.', 'error');

    _pinHash    = hashPassword(pin, 'fp_lock_salt');
    _inactivity = inact;
    localStorage.setItem(PIN_KEY, _pinHash);
    localStorage.setItem(PREFS_KEY, JSON.stringify({ inactivity: inact }));

    App.modal.close('modalSetPin');
    showToast('PIN configurado! Tela bloqueará após ' + (inact > 0 ? inact + ' min' : 'comando manual') + ' de inatividade.', 'success', 5000);
    resetInactivityTimer();
  }

  function removePin() {
    App.modal.confirm('Remover PIN', 'Deseja remover o PIN de bloqueio?', () => {
      _pinHash = null;
      localStorage.removeItem(PIN_KEY);
      App.modal.close('modalSetPin');
      showToast('PIN removido.', 'info');
    });
  }

  /* ── Settings page shortcut ── */
  function openSettings() { showSetPinModal(); }

  return { init, lock, unlock, handleKey, savePin, removePin, openSettings, showSetPinModal };
})();
