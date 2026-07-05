/**
 * @fileoverview FinancePro — db.js
 * Database layer using Dexie.js (IndexedDB wrapper).
 * Defines schema, indices, and provides the shared `db` instance.
 */

'use strict';

/* ═══════════════════════════════════════════════════════════
   DATABASE SCHEMA
═══════════════════════════════════════════════════════════ */
const db = new Dexie('FinancePro_v2');

db.version(1).stores({
  /**
   * users: id | name | email | passwordHash | salt | avatar(base64) | createdAt
   */
  users: '++id, email',

  /**
   * settings: id | userId | key | value
   * key/value store per user (currency, theme, dateFormat, language, notifications…)
   */
  settings: '++id, [userId+key]',

  /**
   * accounts: id | userId | name | type | color | initialBalance | createdAt
   * type: 'checking' | 'savings' | 'wallet' | 'credit' | 'investment'
   */
  accounts: '++id, userId, type',

  /**
   * categories: id | userId | name | type | icon | color | isDefault | order
   * type: 'income' | 'expense'
   */
  categories: '++id, userId, type',

  /**
   * transactions: id | userId | type | amount | categoryId | accountId
   *               | accountToId (transfers) | date | description | tags
   *               | isRecurring | recurringRule | groupId | installmentNum
   *               | installmentTotal | createdAt | updatedAt
   * type: 'income' | 'expense' | 'transfer'
   * Composite indices for fast filtering
   */
  transactions: '++id, userId, [userId+date], [userId+type], [userId+categoryId], [userId+accountId], date, groupId',

  /**
   * budgets: id | userId | monthYear ('YYYY-MM') | categoryId (null = total) | limitAmount
   */
  budgets: '++id, userId, [userId+monthYear], [userId+monthYear+categoryId]',

  /**
   * goals: id | userId | name | targetAmount | currentAmount | deadline | icon | createdAt
   */
  goals: '++id, userId',

  /**
   * notifications: id | userId | type | message | relatedId | read | createdAt
   * type: 'budget_80' | 'budget_100' | 'anomaly' | 'recurring' | 'goal'
   */
  notifications: '++id, userId, read, createdAt',

  /**
   * transactionLogs: id | transactionId | userId | action | snapshot | createdAt
   * action: 'create' | 'update' | 'delete'
   */
  transactionLogs: '++id, transactionId, userId'
});

db.version(2).stores({
  reports: '++id, userId, event, ts'
});

/* ═══════════════════════════════════════════════════════════
   DEFAULT CATEGORIES (seeded on first user registration)
═══════════════════════════════════════════════════════════ */
const DEFAULT_CATEGORIES = [
  // ── Expenses ──
  { name: 'Alimentação',   type: 'expense', icon: 'fa-utensils',       color: '#ef4444', order: 1  },
  { name: 'Transporte',    type: 'expense', icon: 'fa-car',             color: '#f59e0b', order: 2  },
  { name: 'Moradia',       type: 'expense', icon: 'fa-home',            color: '#8b5cf6', order: 3  },
  { name: 'Saúde',         type: 'expense', icon: 'fa-heartbeat',       color: '#ec4899', order: 4  },
  { name: 'Educação',      type: 'expense', icon: 'fa-graduation-cap',  color: '#3b82f6', order: 5  },
  { name: 'Lazer',         type: 'expense', icon: 'fa-gamepad',         color: '#06b6d4', order: 6  },
  { name: 'Compras',       type: 'expense', icon: 'fa-shopping-bag',    color: '#f97316', order: 7  },
  { name: 'Assinaturas',   type: 'expense', icon: 'fa-credit-card',     color: '#6366f1', order: 8  },
  { name: 'Outros',        type: 'expense', icon: 'fa-tag',             color: '#94a3b8', order: 9  },
  // ── Incomes ──
  { name: 'Salário',       type: 'income',  icon: 'fa-briefcase',       color: '#10b981', order: 10 },
  { name: 'Freelance',     type: 'income',  icon: 'fa-laptop-code',     color: '#059669', order: 11 },
  { name: 'Investimentos', type: 'income',  icon: 'fa-chart-line',      color: '#0284c7', order: 12 },
  { name: 'Vendas',        type: 'income',  icon: 'fa-store',           color: '#7c3aed', order: 13 },
  { name: 'Reembolso',     type: 'income',  icon: 'fa-undo',            color: '#0d9488', order: 14 },
  { name: 'Outras receitas', type: 'income',icon: 'fa-plus-circle',     color: '#64748b', order: 15 },
];

/* Default account for new users */
const DEFAULT_ACCOUNT = {
  name: 'Carteira',
  type: 'wallet',
  color: '#10b981',
  initialBalance: 0,
};

/* Default settings */
const DEFAULT_SETTINGS = {
  currency: 'BRL',
  dateFormat: 'dd/MM/yyyy',
  language: 'pt',
  theme: 'light',
  accent: '#10b981',
  notifBudget80: true,
  notifBudget100: true,
  notifAnomalous: true,
  notifSubscriptionDue: true,
  notifAutoVoice: true,
  aiVoiceEnabled: false,
  onboardingDone: false,
};

/**
 * Seeds default data for a newly registered user.
 * @param {number} userId
 */
async function seedUserData(userId) {
  await db.transaction('rw', db.categories, db.accounts, db.settings, async () => {
    // Categories
    const catData = DEFAULT_CATEGORIES.map(c => ({ ...c, userId, isDefault: true }));
    await db.categories.bulkAdd(catData);

    // Default account
    await db.accounts.add({
      ...DEFAULT_ACCOUNT,
      userId,
      createdAt: new Date().toISOString(),
    });

    // Default settings
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
      await db.settings.add({ userId, key, value: JSON.stringify(value) });
    }
  });
}

/* ═══════════════════════════════════════════════════════════
   SETTINGS HELPERS
═══════════════════════════════════════════════════════════ */

/**
 * Get a setting value for the current user.
 * @param {number} userId
 * @param {string} key
 * @param {*} fallback
 */
async function getSetting(userId, key, fallback = null) {
  const row = await db.settings.where('[userId+key]').equals([userId, key]).first();
  if (!row) return fallback;
  try { return JSON.parse(row.value); } catch { return row.value; }
}

/**
 * Set a setting value.
 * @param {number} userId
 * @param {string} key
 * @param {*} value
 */
async function setSetting(userId, key, value) {
  const existing = await db.settings.where('[userId+key]').equals([userId, key]).first();
  const serialized = JSON.stringify(value);
  if (existing) {
    await db.settings.update(existing.id, { value: serialized });
  } else {
    await db.settings.add({ userId, key, value: serialized });
  }
}

/**
 * Load all settings for user into a plain object.
 * @param {number} userId
 * @returns {Promise<Object>}
 */
async function getAllSettings(userId) {
  const rows = await db.settings.where('userId').equals(userId).toArray();
  const result = { ...DEFAULT_SETTINGS };
  for (const row of rows) {
    try { result[row.key] = JSON.parse(row.value); } catch { result[row.key] = row.value; }
  }
  return result;
}

/* ═══════════════════════════════════════════════════════════
   TRANSACTION LOG HELPER
═══════════════════════════════════════════════════════════ */

/**
 * Record a transaction audit log entry.
 * @param {number} txId
 * @param {number} userId
 * @param {'create'|'update'|'delete'} action
 * @param {Object} snapshot  — copy of the transaction record
 */
async function logTransaction(txId, userId, action, snapshot) {
  try {
    await db.transactionLogs.add({
      transactionId: txId,
      userId,
      action,
      snapshot: JSON.stringify(snapshot),
      createdAt: new Date().toISOString(),
    });
    // Keep logs trimmed to 200 entries per user
    const count = await db.transactionLogs.where('userId').equals(userId).count();
    if (count > 200) {
      const oldest = await db.transactionLogs.where('userId').equals(userId)
        .limit(count - 200).primaryKeys();
      await db.transactionLogs.bulkDelete(oldest);
    }
  } catch (e) {
    console.warn('Log write failed', e);
  }
}

/* ═══════════════════════════════════════════════════════════
   NOTIFICATION HELPERS
═══════════════════════════════════════════════════════════ */

/**
 * Add a notification for a user.
 * @param {number} userId
 * @param {string} type
 * @param {string} message
 * @param {number|null} relatedId
 */
async function addNotification(userId, type, message, relatedId = null) {
  await db.notifications.add({
    userId, type, message, relatedId,
    read: false,
    createdAt: new Date().toISOString(),
  });
}

/**
 * Get unread count.
 * @param {number} userId
 */
async function getUnreadCount(userId) {
  return db.notifications.where({ userId, read: false }).count();
}
