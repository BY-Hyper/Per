const fs = require('fs');
const vm = require('vm');
const code = fs.readFileSync('fp-import-pro.js', 'utf8');
const sandbox = {
  window: { S: { cats: [
    { id: 10, name: 'Alimentação', type: 'expense' },
    { id: 11, name: 'Transporte', type: 'expense' },
    { id: 12, name: 'Renda', type: 'income' },
    { id: 13, name: 'Financeiro', type: 'expense' },
    { id: 14, name: 'Moradia', type: 'expense' }
  ], accs: [{ id: 1, name: 'Conta teste' }], user: { id: 1 } } },
  document: { getElementById: () => null, addEventListener: () => null },
  console, require, setTimeout, clearTimeout, process
};
vm.createContext(sandbox);
vm.runInContext(code, sandbox, { filename: 'fp-import-pro.js' });
(async () => {
  try {
    const parser = sandbox.window.FP_IMPORT_PRO.Parser;
    const SmartCat = sandbox.window.FP_IMPORT_PRO.SmartCat;
    const csv = fs.readFileSync('arquivos bancos/Nubank/NU_2265219525_01MAR2026_31MAR2026.csv', 'utf8');
    const res = await parser.parseFile({ name: 'nubank.csv', arrayBuffer: async () => Buffer.from(csv, 'utf8').buffer, text: async () => csv }, csv);
    console.log('PARSED TXS', res.txs.length);
    const items = await SmartCat.categorizeAll(res.txs);
    console.log(JSON.stringify(items.map(i => ({ date: i.date, description: i.description, rawCategory: i.rawCategory, categoryId: i.categoryId, _catSource: i._catSource, _catConfidence: i._catConfidence })), null, 2));
  } catch (e) { console.error(e); }
})();
