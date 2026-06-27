const fs = require('fs');
const vm = require('vm');
const path = require('path');
const cwd = path.join(__dirname);
const code = fs.readFileSync(path.join(cwd, 'fp-import-pro.js'), 'utf8');
const sandbox = { window: {}, document: { getElementById: () => null }, console, require, setTimeout, clearTimeout };
vm.createContext(sandbox);
vm.runInContext(code, sandbox, { filename: 'fp-import-pro.js' });
const fn = sandbox.normalizeDescription || sandbox.window.normalizeDescription || (sandbox.window.FP_IMPORT_PRO && sandbox.window.FP_IMPORT_PRO.normalizeDescription);
console.log('fn', !!fn);
if (fn) {
  console.log(fn('TRANSFERENCIA PIX - 1601370'));
}
