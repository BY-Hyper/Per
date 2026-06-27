const fs = require("fs");
const vm = require("vm");
const code = fs.readFileSync("fp-import-pro.js", "utf8");
const sandbox = {
  window: {},
  document: { getElementById: () => null, addEventListener: () => null },
  console,
  require,
  setTimeout: (fn) => { fn(); return 0; },
  clearTimeout: () => {},
  process,
};
vm.createContext(sandbox);
vm.runInContext(code, sandbox, { filename: 'fp-import-pro.js' });
const parser = sandbox.window.FP_IMPORT_PRO.Parser;
const csv = fs.readFileSync('arquivos bancos/bradesco janeiro-25 até 26- abril/a27c8e68-ac5e-4332-9e23-87371e2dd7d2.csv', 'utf8');
(async () => {
  const result = await parser.parseFile({name:'bradesco.csv', arrayBuffer: async () => Buffer.from(csv,'utf8').buffer, text: async () => csv}, csv);
  console.log(JSON.stringify(result.txs.slice(0,10).map(t=>({date:t.date,description:t.description,payee:t.payee,rawDescription:t.rawDescription,amount:t.amount,type:t.type})), null, 2));
  process.exit(0);
})();
