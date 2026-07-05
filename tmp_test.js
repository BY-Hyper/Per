const fs = require("fs");
const vm = require("vm");
const code = fs.readFileSync("fp-import-pro.js", "utf8");
const sandbox = {
  window: {},
  document: { getElementById: () => null, addEventListener: () => null },
  console,
  require,
  setTimeout,
  clearTimeout,
  process,
};
vm.createContext(sandbox);
vm.runInContext(code, sandbox, { filename: 'fp-import-pro.js' });
const parser = sandbox.window.FP_IMPORT_PRO.Parser;
if (!parser) { console.error('NO PARSER'); process.exit(1); }
const files = [
  'arquivos bancos\\bradesco janeiro-25 até 26- abril\\a27c8e68-ac5e-4332-9e23-87371e2dd7d2.csv',
  'arquivos bancos\\Nubank\\NU_2265219525_01MAR2026_31MAR2026.csv',
];
for (const file of files) {
  const csv = fs.readFileSync(file, 'utf8');
  (async () => {
    const result = await parser.parseFile({ name: file, arrayBuffer: async () => Buffer.from(csv,'utf8').buffer, text: async () => csv }, csv);
    console.log('FILE', file);
    console.log('BANK', result.bank && result.bank.id);
    console.log('FORMAT', result.format);
    console.log('TXS', JSON.stringify(result.txs.slice(0,4).map(t=>({date:t.date,description:t.description,payee:t.payee,rawDescription:t.rawDescription,amount:t.amount,type:t.type})), null, 2));
  })();
}
