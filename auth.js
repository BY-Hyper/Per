/**
 * @fileoverview FinancePro — auth.js
 * Authentication: register, login, logout, session management,
 * brute-force protection, password validation.
 */

'use strict';

/* ═══════════════════════════════════════════════════════════
   AUTH MODULE  (App.auth)
═══════════════════════════════════════════════════════════ */

App.auth = (() => {

  const SESSION_KEY   = 'fp_session';
  const BRUTE_KEY     = 'fp_brute';
  const MAX_ATTEMPTS  = 5;
  const LOCKOUT_MS    = 15 * 60 * 1000; // 15 minutes

  /* ── Brute-force helpers ── */
  function getBrute(email) {
    try {
      const raw = localStorage.getItem(BRUTE_KEY);
      const data = raw ? JSON.parse(raw) : {};
      return data[email] || { attempts: 0, lockedUntil: 0 };
    } catch { return { attempts: 0, lockedUntil: 0 }; }
  }

  function setBrute(email, data) {
    try {
      const raw = localStorage.getItem(BRUTE_KEY);
      const all = raw ? JSON.parse(raw) : {};
      all[email] = data;
      localStorage.setItem(BRUTE_KEY, JSON.stringify(all));
    } catch {}
  }

  function clearBrute(email) {
    try {
      const raw = localStorage.getItem(BRUTE_KEY);
      if (!raw) return;
      const all = JSON.parse(raw);
      delete all[email];
      localStorage.setItem(BRUTE_KEY, JSON.stringify(all));
    } catch {}
  }

  function isLocked(email) {
    const b = getBrute(email);
    if (b.lockedUntil && Date.now() < b.lockedUntil) {
      const mins = Math.ceil((b.lockedUntil - Date.now()) / 60000);
      return `Conta bloqueada. Tente novamente em ${mins} min.`;
    }
    return false;
  }

  function recordFailedAttempt(email) {
    const b = getBrute(email);
    b.attempts++;
    if (b.attempts >= MAX_ATTEMPTS) {
      b.lockedUntil = Date.now() + LOCKOUT_MS;
      b.attempts = 0;
    }
    setBrute(email, b);
  }

  /* ── Session helpers ── */
  function saveSession(user) {
    const sess = generateSessionToken(user.id);
    const data = { userId: user.id, name: user.name, email: user.email, ...sess };
    localStorage.setItem(SESSION_KEY, JSON.stringify(data));
    App.state.currentUser = { id: user.id, name: user.name, email: user.email };
  }

  function loadSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const sess = JSON.parse(raw);
      if (!validateSession(sess)) {
        localStorage.removeItem(SESSION_KEY);
        return null;
      }
      return { id: sess.userId, name: sess.name, email: sess.email };
    } catch { return null; }
  }

  /* ── Register ── */
  async function register() {
    const name  = $id('regName').value.trim();
    const email = $id('regEmail').value.trim().toLowerCase();
    const pwd   = $id('regPassword').value;
    const conf  = $id('regConfirm').value;

    if (!name || !email || !pwd || !conf) {
      return showToast('Preencha todos os campos.', 'error');
    }
    if (!isValidEmail(email)) {
      return showToast('E-mail inválido.', 'error');
    }
    if (pwd.length < 8) {
      return showToast('A senha deve ter no mínimo 8 caracteres.', 'error');
    }
    if (pwd !== conf) {
      return showToast('As senhas não coincidem.', 'error');
    }

    const btn = $id('registerBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner spinner--sm"></span> Criando...';

    try {
      const existing = await db.users.where('email').equals(email).first();
      if (existing) throw new Error('Este e-mail já está cadastrado.');

      const salt = generateSalt();
      const hash = hashPassword(pwd, salt);
      const id = await db.users.add({
        name, email,
        passwordHash: hash, salt,
        avatar: null,
        createdAt: new Date().toISOString(),
      });

      await seedUserData(id);
      saveSession({ id, name, email });
      showToast(`Bem-vindo(a), ${name}! 🎉`, 'success');
      await App.init();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<span>Criar conta</span><i class="fas fa-arrow-right"></i>';
    }
  }

  /* ── Login ── */
  async function login() {
    const email = $id('loginEmail').value.trim().toLowerCase();
    const pwd   = $id('loginPassword').value;

    if (!email || !pwd) return showToast('Preencha todos os campos.', 'error');

    // Brute-force check
    const lockMsg = isLocked(email);
    if (lockMsg) return showToast(lockMsg, 'error');

    const btn = $id('loginBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner spinner--sm"></span> Entrando...';

    try {
      const user = await db.users.where('email').equals(email).first();
      if (!user) {
        recordFailedAttempt(email);
        throw new Error('Credenciais inválidas.');
      }

      const hash = hashPassword(pwd, user.salt);
      if (hash !== user.passwordHash) {
        recordFailedAttempt(email);
        const b = getBrute(email);
        const remaining = MAX_ATTEMPTS - b.attempts;
        const msg = remaining > 0
          ? `Senha incorreta. ${remaining} tentativa(s) restante(s).`
          : 'Credenciais inválidas.';
        throw new Error(msg);
      }

      clearBrute(email);
      saveSession(user);
      showToast(`Bem-vindo(a) de volta, ${user.name}!`, 'success');
      await App.init();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<span>Entrar</span><i class="fas fa-arrow-right"></i>';
    }
  }

  /* ── Logout ── */
  function logout() {
    App.modal.confirm(
      'Sair da conta',
      'Tem certeza que deseja sair?',
      () => {
        localStorage.removeItem(SESSION_KEY);
        App.state.currentUser = null;
        App.state.settings    = {};
        location.reload();
      }
    );
  }

  /* ── Switch auth tab ── */
  function switchTab(tab) {
    $$('.auth-tab').forEach(t => t.classList.remove('active'));
    $$('.auth-panel').forEach(p => p.classList.remove('active'));

    if (tab === 'login') {
      $id('tabLogin').classList.add('active');
      $id('panelLogin').classList.add('active');
    } else if (tab === 'register') {
      $id('tabRegister').classList.add('active');
      $id('panelRegister').classList.add('active');
    } else if (tab === 'forgot') {
      $id('panelForgot').classList.add('active');
    }
  }

  function showForgot() { switchTab('forgot'); }

  /* ── Forgot password (simulated) ── */
  async function forgotPassword() {
    const email = $id('forgotEmail').value.trim().toLowerCase();
    if (!email || !isValidEmail(email)) {
      return showToast('Informe um e-mail válido.', 'error');
    }
    // Simulate delay
    await new Promise(r => setTimeout(r, 800));
    showToast('Se esse e-mail existir, um link de recuperação foi enviado.', 'info', 5000);
    switchTab('login');
  }

  /* ── Password toggle visibility ── */
  function togglePwd(inputId) {
    const input = $id(inputId);
    const btn   = input.closest('.input-wrapper').querySelector('.input-toggle-pwd i');
    if (input.type === 'password') {
      input.type = 'text';
      btn.className = 'fas fa-eye-slash';
    } else {
      input.type = 'password';
      btn.className = 'fas fa-eye';
    }
  }

  /* ── Password strength UI ── */
  function checkPwdStrength(pwd) {
    const score = passwordStrength(pwd);
    const bar   = $id('pwdStrengthBar');
    const label = $id('pwdStrengthLabel');
    if (!bar || !label) return;
    bar.style.width    = `${(score / 4) * 100}%`;
    bar.style.background = PWD_COLORS[score] || '#ef4444';
    label.textContent  = pwd ? (PWD_LABELS[score] || '') : '';
  }

  /* ── Restore session ── */
  function restoreSession() {
    return loadSession();
  }

  return { register, login, logout, switchTab, showForgot, forgotPassword, togglePwd, checkPwdStrength, restoreSession, saveSession };

})();
