/**
 * @fileoverview FinancePro — utils.js
 * Pure utility functions: formatting, validation, DOM helpers,
 * toast notifications, debounce, and event bus.
 */

'use strict';

/* ═══════════════════════════════════════════════════════════
   CURRENCY & NUMBER FORMATTING
═══════════════════════════════════════════════════════════ */

/**
 * Format a number as currency based on user settings.
 * @param {number} value
 * @param {string} [currency='BRL']
 * @returns {string}
 */
function formatCurrency(value, currency) {
  const cur = currency || (window.App?.state?.settings?.currency) || 'BRL';
  const locale = cur === 'BRL' ? 'pt-BR' : cur === 'EUR' ? 'de-DE' : 'en-US';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: cur,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);
}

/**
 * Format number with thousands separator, no currency symbol.
 * @param {number} value
 */
function formatNumber(value) {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);
}

/* ═══════════════════════════════════════════════════════════
   DATE FORMATTING
═══════════════════════════════════════════════════════════ */

/**
 * Format an ISO date string according to user's format preference.
 * @param {string} dateStr  e.g. '2025-01-15'
 * @param {string} [fmt]    e.g. 'dd/MM/yyyy'
 * @returns {string}
 */
function formatDate(dateStr, fmt) {
  if (!dateStr) return '—';
  const format = fmt || window.App?.state?.settings?.dateFormat || 'dd/MM/yyyy';
  const [y, m, d] = dateStr.split('-');
  if (!y || !m || !d) return dateStr;
  return format
    .replace('dd', d.padStart(2,'0'))
    .replace('MM', m.padStart(2,'0'))
    .replace('yyyy', y);
}

/**
 * Return today's date as YYYY-MM-DD.
 */
function today() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Return first day of current month as YYYY-MM-DD.
 */
function monthStart(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-01`;
}

/**
 * Return last day of current month as YYYY-MM-DD.
 */
function monthEnd(date = new Date()) {
  const last = new Date(date.getFullYear(), date.getMonth()+1, 0);
  return last.toISOString().split('T')[0];
}

/**
 * Return YYYY-MM for a Date.
 */
function toMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;
}

/**
 * Get the last N days as YYYY-MM-DD strings (oldest → newest).
 * @param {number} n
 */
function lastNDays(n) {
  const days = [];
  for (let i = n-1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().split('T')[0]);
  }
  return days;
}

/**
 * Return relative date label: 'Hoje', 'Ontem', or formatted date.
 */
function relativeDate(dateStr) {
  const t = today();
  const y = new Date(); y.setDate(y.getDate()-1);
  const yesterday = y.toISOString().split('T')[0];
  if (dateStr === t) return 'Hoje';
  if (dateStr === yesterday) return 'Ontem';
  return formatDate(dateStr);
}

/* ═══════════════════════════════════════════════════════════
   VALIDATION
═══════════════════════════════════════════════════════════ */

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPassword(pwd) {
  return pwd && pwd.length >= 8;
}

/**
 * Check password strength (0-4).
 * @param {string} pwd
 * @returns {number}
 */
function passwordStrength(pwd) {
  let score = 0;
  if (!pwd || pwd.length < 6) return 0;
  if (pwd.length >= 8) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  return score;
}

const PWD_LABELS = ['Muito fraca', 'Fraca', 'Razoável', 'Boa', 'Forte'];
const PWD_COLORS = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981'];

/* ═══════════════════════════════════════════════════════════
   DOM HELPERS
═══════════════════════════════════════════════════════════ */

/** @param {string} id @returns {HTMLElement} */
const $id = id => document.getElementById(id);

/** @param {string} sel @returns {NodeList} */
const $$ = sel => document.querySelectorAll(sel);

/**
 * Set innerHTML safely (basic XSS mitigation — escapes text nodes).
 * For trusted HTML, use directly; for user input, always escape first.
 * @param {string} str
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Simple HTML tag stripper for search result highlighting.
 * @param {string} str
 * @param {string} term
 */
function highlight(str, term) {
  if (!term) return escapeHtml(str);
  const re = new RegExp(`(${escapeHtml(term)})`, 'gi');
  return escapeHtml(str).replace(re, '<mark>$1</mark>');
}

/* ═══════════════════════════════════════════════════════════
   TOAST NOTIFICATIONS
═══════════════════════════════════════════════════════════ */

const TOAST_ICONS = {
  success: 'fa-check-circle',
  error:   'fa-times-circle',
  warning: 'fa-exclamation-triangle',
  info:    'fa-info-circle',
};

/**
 * Show a toast notification.
 * @param {string} message
 * @param {'success'|'error'|'warning'|'info'} [type='info']
 * @param {number} [duration=3500]
 */
function showToast(message, type = 'info', duration = 3500) {
  const container = $id('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.setAttribute('role', 'alert');
  toast.innerHTML = `
    <i class="fas ${TOAST_ICONS[type] || TOAST_ICONS.info} toast-icon"></i>
    <span class="toast-text">${escapeHtml(message)}</span>
    <button class="toast-close" aria-label="Fechar"><i class="fas fa-times"></i></button>
  `;

  const close = () => {
    toast.classList.add('removing');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  };

  toast.querySelector('.toast-close').addEventListener('click', close);
  container.appendChild(toast);
  setTimeout(close, duration);
  return toast;
}

/* ═══════════════════════════════════════════════════════════
   DEBOUNCE & THROTTLE
═══════════════════════════════════════════════════════════ */

/**
 * Debounce a function call.
 * @param {Function} fn
 * @param {number} delay ms
 */
function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Throttle a function call.
 * @param {Function} fn
 * @param {number} limit ms
 */
function throttle(fn, limit = 100) {
  let last = 0;
  return (...args) => {
    const now = Date.now();
    if (now - last >= limit) { last = now; fn(...args); }
  };
}

/* ═══════════════════════════════════════════════════════════
   SIMPLE EVENT BUS
═══════════════════════════════════════════════════════════ */

const EventBus = (() => {
  const listeners = {};
  return {
    on(event, fn) {
      (listeners[event] = listeners[event] || []).push(fn);
    },
    off(event, fn) {
      if (!listeners[event]) return;
      listeners[event] = listeners[event].filter(f => f !== fn);
    },
    emit(event, data) {
      (listeners[event] || []).forEach(fn => fn(data));
    },
  };
})();

/* ═══════════════════════════════════════════════════════════
   CRYPTO / AUTH HELPERS
═══════════════════════════════════════════════════════════ */

function generateSalt() {
  return CryptoJS.lib.WordArray.random(16).toString();
}

function hashPassword(password, salt) {
  return CryptoJS.SHA256(password + salt).toString();
}

/**
 * Generate a session token (HMAC-like using SHA256 + userId + timestamp).
 * @param {number} userId
 * @returns {{token: string, expiresAt: number}}
 */
function generateSessionToken(userId) {
  const secret = 'FP_SECRET_2025_' + userId;
  const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days
  const token = CryptoJS.HmacSHA256(String(userId) + String(expiresAt), secret).toString();
  return { token, expiresAt };
}

/**
 * Validate stored session.
 * @param {{userId:number, token:string, expiresAt:number}} session
 */
function validateSession(session) {
  if (!session || !session.token || !session.expiresAt) return false;
  if (Date.now() > session.expiresAt) return false;
  const { token, expiresAt } = generateSessionToken(session.userId);
  // Regenerate expected token to compare
  const secret = 'FP_SECRET_2025_' + session.userId;
  const expected = CryptoJS.HmacSHA256(
    String(session.userId) + String(session.expiresAt), secret
  ).toString();
  return session.token === expected;
}

/* ═══════════════════════════════════════════════════════════
   MISC HELPERS
═══════════════════════════════════════════════════════════ */

/**
 * Download a file in the browser.
 * @param {string} filename
 * @param {string|Blob} content
 * @param {string} [mimeType='text/plain']
 */
function downloadFile(filename, content, mimeType = 'text/plain') {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Read a File as text.
 * @param {File} file
 * @returns {Promise<string>}
 */
function readFileText(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = e => resolve(e.target.result);
    r.onerror = reject;
    r.readAsText(file);
  });
}

/**
 * Convert File to base64 data URL.
 * @param {File} file
 * @returns {Promise<string>}
 */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = e => resolve(e.target.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

/**
 * Clamp a number between min and max.
 */
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Format percentage.
 * @param {number} value  0-100
 */
function fmtPct(value) {
  return `${Math.round(clamp(value, 0, 9999))}%`;
}

/**
 * Calculate percentage safely.
 * @param {number} part
 * @param {number} total
 */
function pct(part, total) {
  if (!total || total === 0) return 0;
  return (part / total) * 100;
}

/**
 * Generate a color for Chart.js datasets.
 * @param {number} index
 */
const CHART_COLORS = [
  '#ef4444','#f97316','#f59e0b','#84cc16','#10b981',
  '#06b6d4','#3b82f6','#8b5cf6','#ec4899','#14b8a6',
  '#a855f7','#0ea5e9','#22c55e','#fb923c','#f43f5e',
];

function chartColor(index) {
  return CHART_COLORS[index % CHART_COLORS.length];
}

/**
 * Parse tags string ("travel, food") into array.
 * @param {string} str
 */
function parseTags(str) {
  if (!str) return [];
  return str.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
}

/**
 * Join tags array to display string.
 * @param {string[]} tags
 */
function joinTags(tags) {
  return Array.isArray(tags) ? tags.join(', ') : '';
}

/**
 * Estimate months to reach a goal.
 * @param {number} remaining
 * @param {number} monthlyAvg
 */
function monthsToGoal(remaining, monthlyAvg) {
  if (monthlyAvg <= 0) return null;
  return Math.ceil(remaining / monthlyAvg);
}

/**
 * Get initials from a full name.
 * @param {string} name
 */
function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length-1][0]).toUpperCase();
}

/**
 * Deep clone a plain object.
 * @param {Object} obj
 */
function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}
