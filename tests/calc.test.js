/**
 * Unit tests cho công thức tài chính (app/js/calc.js).
 * Chạy: node tests/calc.test.js
 */
const Calc = require('../app/js/calc.js');

let passed = 0;
function check(name, cond) {
  if (cond) { passed++; console.log('  ✅ ' + name); }
  else { console.error('  ❌ ' + name); process.exitCode = 1; }
}

console.log('Công thức tài chính — tests\n');

console.log('[Group] VAT (0.08*DT - 0.10*dầuDO)');
check('VAT cơ bản: 1.000.000 DT, 100.000 dầu = 70.000', Calc.vat(1000000, 0, 100000) === 70000);
check('VAT dùng doanh thu hóa đơn (ưu tiên)', Calc.vat(2000000, 999, 0) === 160000);
check('VAT fallback doanh thu thực tế khi không có hóa đơn', Calc.vat(0, 500000, 0) === 40000);
check('VAT có thể âm (dầu lớn)', Calc.vat(1000000, 0, 1000000) === -20000);
check('VAT rỗng/undefined -> 0', Calc.vat(undefined, undefined, undefined) === 0);
check('VAT nhận chuỗi số', Calc.vat('1000000', '0', '100000') === 70000);

console.log('[Group] Tiêu thụ dầu chặng (giờ × định mức)');
check('10h × 150 L/h = 1500', Calc.legConsumption(10, 150) === 1500);
check('nhận chuỗi: "5" × "100" = 500', Calc.legConsumption('5', '100') === 500);
check('rỗng -> 0', Calc.legConsumption(undefined, 100) === 0);
check('làm tròn: 1.5h × 101 = 152', Calc.legConsumption(1.5, 101) === 152);

console.log('[Group] Lợi nhuận & hiệu suất');
check('profit 100 - 30 = 70', Calc.profit(100, 30) === 70);
check('profit rỗng -> 0', Calc.profit(undefined, undefined) === 0);
check('margin 70/100 = 70%', Calc.profitMargin(70, 100) === 70);
check('margin chia 0 -> 0', Calc.profitMargin(70, 0) === 0);

console.log('[Group] Tổng chi phí chuyến (chống đếm trùng fixedCost)');
const costsA = { fuelDO: 100, crewSalary: 30,
  dockingIntermediate: 10, dockingPeriodic: 15, registryAnnual: 5, depreciation: 12, hullInsurance: 8,
  fixedCost: 50, vat: 999, _agentAuto: true };
check('tripCostTotal bỏ fixedCost+vat+cờ_: 100+30+10+15+5+12+8 = 180', Calc.tripCostTotal(costsA) === 180);
check('tripCostTotal excludeDepr bỏ đà+khấu hao: 180-10-15-12 = 143', Calc.tripCostTotal(costsA, { excludeDepr: true }) === 143);
check('tripCostTotal rỗng -> 0', Calc.tripCostTotal({}) === 0 && Calc.tripCostTotal(null) === 0);
check('tripCostTotal KHÔNG đếm trùng (cả 5 khoản lẫn fixedCost)',
  Calc.tripCostTotal({ a: 100, dockingPeriodic: 50, fixedCost: 50 }) === 150);

console.log('\n' + (process.exitCode ? '❌ CÓ TEST THẤT BẠI' : `✅ TẤT CẢ ${passed} KIỂM TRA ĐỀU PASS`));
