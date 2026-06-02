/**
 * Test logic phân bổ chi phí trong data.js (Fix#2, Fix#3).
 * Chạy: node tests/data.test.js   (cần: npm install)
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
  localStorage: ls, console, JSON, Date, Math, Object, Array, String, Number, Set, Map, isFinite, isNaN,
  TextDecoder, Uint8Array, Promise, setTimeout, indexedDB: global.indexedDB, IDBKeyRange: global.IDBKeyRange,
  Intl, document: { addEventListener() {} }
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'app/js/seed-data.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'app/js/data.js'), 'utf8'), ctx);

const get = (expr) => { vm.runInContext('globalThis.__r = (' + expr + ');', ctx); return ctx.__r; };

(async () => {
  console.log('data.js — phân bổ chi phí (Fix#2 / Fix#3)\n');
  vm.runInContext('globalThis.__boot = AppData.bootPromise;', ctx);
  await ctx.__boot;

  // Dựng state tối thiểu, rõ ràng
  vm.runInContext(`
    AppData.state.vessels = [{ id: 'VG01', name: 'Tàu 01', fuelRate: 100 }];
    AppData.state.shipments = [
      { id: 'S1', vesselId: 'VG01', voyageNo: 'C1', reportMonth: '2026-05', dateStart: '2026-05-01', dateEnd: '2026-05-10', costs: {} },
      { id: 'S2', vesselId: 'VG01', voyageNo: 'C2', reportMonth: '2026-05', dateStart: '2026-05-11', dateEnd: '2026-05-20', costs: { agent: 5000000 } }
    ];
    AppData.state.transactions = [];
    AppData.state.captainReports = [];
    AppData.state.monthlyCosts = [];
  `, ctx);

  // 1) Thêm giao dịch "2.Chi Phí Cảng" gán cho C1 -> agent của S1 = tổng
  vm.runInContext(`
    AppData.addTransaction({ id: 'T1', category: '2.Chi Phí Cảng', vessel: 'VG01', voyageNo: 'C1', date: '2026-05-05', chi: 3000000 });
    AppData.addTransaction({ id: 'T2', category: '2.Chi Phí Cảng', vessel: 'VG01', voyageNo: 'C1', date: '2026-05-06', chi: 1500000 });
  `, ctx);
  check('Fix#2: gộp chi phí cảng vào agent của chuyến (3.0tr + 1.5tr = 4.5tr)',
    get("AppData.state.shipments.find(s => s.id === 'S1').costs.agent") === 4500000);

  // 2) S2 đã có agent nhập tay = 5tr -> KHÔNG bị đè
  vm.runInContext(`
    AppData.addTransaction({ id: 'T3', category: '2.Chi Phí Cảng', vessel: 'VG01', voyageNo: 'C2', date: '2026-05-12', chi: 9999999 });
  `, ctx);
  check('Fix#2: KHÔNG đè agent đã nhập tay (giữ 5.000.000)',
    get("AppData.state.shipments.find(s => s.id === 'S2').costs.agent") === 5000000);

  // 3) recalcAllAllocations chạy không lỗi + giữ kết quả
  let ok = true;
  try { vm.runInContext('AppData.recalcAllAllocations();', ctx); } catch (e) { ok = false; console.error(e); }
  check('Fix#3: recalcAllAllocations chạy không lỗi', ok);
  check('Fix#3: agent C1 vẫn đúng sau recalc toàn bộ',
    get("AppData.state.shipments.find(s => s.id === 'S1').costs.agent") === 4500000);

  console.log('\n' + (process.exitCode ? '❌ CÓ TEST THẤT BẠI' : `✅ TẤT CẢ ${passed} KIỂM TRA ĐỀU PASS`));
})();
