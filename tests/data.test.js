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

  // 4) Lớn#A: chi phí cố định/năm = 365tr -> 1tr/ngày; S1 10 ngày (01->10/05) = 10tr
  vm.runInContext(`
    AppData.state.vessels[0].fixedCosts = { drydockPeriodic: 200000000, drydockIntermediate: 0, depreciation: 100000000, annualSurvey: 65000000, hullInsurance: 0 };
    AppData.recalcVesselFixedCosts('VG01');
  `, ctx);
  check('Lớn#A: chi phí cố định phân bổ theo ngày (365tr/năm × 10 ngày = 10tr)',
    get("AppData.state.shipments.find(s => s.id === 'S1').costs.fixedCost") === 10000000);
  check('Lớn#A: cờ _agentAuto KHÔNG nằm trong costs (tránh hỏng tổng chi phí)',
    get("'_agentAuto' in AppData.state.shipments.find(s => s.id === 'S1').costs") === false);

  // 5) Lớn#B: LO. cycle 800h, 11 phi/cycle, đơn giá 2tr/phi, 200 L/phi.
  //    S1 fuelHours = 400 -> drums = 400*11/800 = 5.5 -> cost = 11.000.000, liters = 1100
  vm.runInContext(`
    AppData.state.vessels[0].loConfig = { cycleHours: 800, drumsPerCycle: 11, supplement: 0, unitPrice: 2000000, litersPerDrum: 200 };
    AppData.state.shipments.find(s => s.id === 'S1').fuelHours = 400;
    AppData.state.shipments.find(s => s.id === 'S1').costs.fuelLO = 0;
    delete AppData.state.shipments.find(s => s.id === 'S1')._loAuto;
    AppData.recalcVesselFixedCosts('VG01');
  `, ctx);
  check('Lớn#B: chi phí LO = 400h × 11/800 × 2tr = 11.000.000',
    get("AppData.state.shipments.find(s => s.id === 'S1').costs.fuelLO") === 11000000);
  check('Lớn#B: LO quy ra lít = 5.5 phi × 200 = 1100 L',
    get("AppData.state.shipments.find(s => s.id === 'S1').loLiters") === 1100);
  check('Lớn#B: KHÔNG đè fuelLO nhập tay', (() => {
    vm.runInContext(`
      AppData.state.shipments.find(s => s.id === 'S2').fuelHours = 400;
      AppData.state.shipments.find(s => s.id === 'S2').costs.fuelLO = 7000000;
      delete AppData.state.shipments.find(s => s.id === 'S2')._loAuto;
      AppData.recalcVesselFixedCosts('VG01');
    `, ctx);
    return get("AppData.state.shipments.find(s => s.id === 'S2').costs.fuelLO") === 7000000;
  })());

  // 6) X1: cascade-delete khi xóa tàu — dọn chuyến + giao dịch + dầu liên quan
  vm.runInContext(`
    AppData.state.vessels = [{ id: 'VG01', name: 'Tàu 01' }, { id: 'VG02', name: 'Tàu 02' }];
    AppData.state.shipments = [
      { id: 'S1', vesselId: 'VG01', voyageNo: 'C1', costs: {} },
      { id: 'S2', vesselId: 'VG02', voyageNo: 'C1', costs: {} }
    ];
    AppData.state.transactions = [
      { id: 'T1', vessel: 'VG01', chi: 1 }, { id: 'T2', vessel: 'VG02', chi: 1 }
    ];
    AppData.state.fuelVoyages = [{ id: 'FV1', vesselId: 'VG01' }];
    AppData.state.fuelLogs = [{ id: 'FL1', fuelVoyageId: 'FV1' }, { id: 'FL2', fuelVoyageId: 'FVX' }];
    AppData.state.vesselExpenses = [{ id: 'E1', vesselId: 'VG01' }];
    AppData.state.captainReports = [{ id: 'R1', vesselId: 'VG01', month: '2026-05' }];
    AppData.state.monthlyCosts = [{ id: 'M1', vesselId: 'VG01', month: '2026-05' }];
  `, ctx);
  const cnt = get("JSON.stringify(AppData.getVesselRelatedCounts('VG01'))");
  check('X1: đếm đúng dữ liệu liên quan tàu VG01',
    JSON.parse(cnt).shipments === 1 && JSON.parse(cnt).fuelLogs === 1 && JSON.parse(cnt).transactions === 1);
  vm.runInContext("AppData.deleteVesselCascade('VG01');", ctx);
  check('X1: tàu VG01 đã xóa', get("AppData.state.vessels.some(v => v.id === 'VG01')") === false);
  check('X1: chuyến/giao dịch/dầu của VG01 đã dọn',
    get("AppData.state.shipments.length") === 1 &&
    get("AppData.state.transactions.length") === 1 &&
    get("AppData.state.fuelVoyages.length") === 0 &&
    get("AppData.state.vesselExpenses.length") === 0);
  check('X1: KHÔNG đụng dữ liệu tàu VG02',
    get("AppData.state.shipments[0].vesselId") === 'VG02' &&
    get("AppData.state.fuelLogs.some(l => l.id === 'FL2')") === true);

  console.log('\n' + (process.exitCode ? '❌ CÓ TEST THẤT BẠI' : `✅ TẤT CẢ ${passed} KIỂM TRA ĐỀU PASS`));
})();
