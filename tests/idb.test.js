/**
 * Test SMStore (IndexedDB) — task #21. Dùng fake-indexeddb.
 * Chạy: node tests/idb.test.js   (cần: npm install)
 */
require('fake-indexeddb/auto');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let passed = 0;
function check(name, cond) {
  if (cond) { passed++; console.log('  ✅ ' + name); }
  else { console.error('  ❌ ' + name); process.exitCode = 1; }
}

const ls = { _d: {}, getItem(k) { return k in this._d ? this._d[k] : null; }, setItem(k, v) { this._d[k] = String(v); }, removeItem(k) { delete this._d[k]; } };
const ctx = {
  localStorage: ls, console, JSON, Date, Math, Object, Array, String, Number, Set, Map, isFinite,
  TextDecoder, Uint8Array, Promise, setTimeout, indexedDB: global.indexedDB, IDBKeyRange: global.IDBKeyRange,
  document: { addEventListener() {} }
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'app/js/seed-data.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'app/js/data.js'), 'utf8'), ctx);
vm.runInContext('globalThis.__boot = AppData.bootPromise;', ctx);

(async () => {
  console.log('SMStore (IndexedDB) — tests\n');
  await ctx.__boot;

  // 1) Ghi qua AppData.save() -> đọc lại từ IDB
  vm.runInContext('AppData.state.transactions.push({ id: "IDBTEST", thu: 123 }); AppData.save();', ctx);
  await new Promise(r => setTimeout(r, 200));
  vm.runInContext('globalThis.__g = SMStore.get("shipManageDB_v2");', ctx);
  const got = await ctx.__g;
  check('AppData.save() ghi state vào IndexedDB', !!(got && got.transactions));
  check('đọc lại đúng giao dịch vừa thêm (IDBTEST, thu=123)',
    !!(got && got.transactions.some(t => t.id === 'IDBTEST' && t.thu === 123)));

  // 2) SMStore.set/get trực tiếp
  vm.runInContext('globalThis.__s = SMStore.set("k1", { a: 1, b: "x" });', ctx);
  await ctx.__s;
  vm.runInContext('globalThis.__g2 = SMStore.get("k1");', ctx);
  const v = await ctx.__g2;
  check('SMStore.set + get giữ đúng object', v && v.a === 1 && v.b === 'x');

  // 3) get key không tồn tại -> undefined
  vm.runInContext('globalThis.__g3 = SMStore.get("khong-co");', ctx);
  const v3 = await ctx.__g3;
  check('get key không tồn tại -> undefined', v3 === undefined);

  console.log('\n' + (process.exitCode ? '❌ CÓ TEST THẤT BẠI' : `✅ TẤT CẢ ${passed} KIỂM TRA ĐỀU PASS`));
})();
