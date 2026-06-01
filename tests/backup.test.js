/**
 * Tests cho validation helpers + auto-backup (app/js/app.js).
 * Chạy: node tests/backup.test.js
 *
 * app.js là object literal `const app = {...}`; các method KHÔNG chạy lúc load
 * (chỉ đăng ký 1 DOMContentLoaded listener), nên nạp được trong vm với mock tối thiểu.
 */

const vm = require('vm');
const fs = require('fs');
const path = require('path');

let code = fs.readFileSync(path.join(__dirname, '..', 'app', 'js', 'app.js'), 'utf8');
code += '\nthis.__app = app;';   // expose const app ra sandbox global

let passed = 0;
function check(name, cond) {
  if (cond) { passed++; console.log('  ✅ ' + name); }
  else { console.error('  ❌ ' + name); process.exitCode = 1; }
}

// ---- localStorage mock ----
function makeLS() {
  const d = {};
  return {
    _d: d,
    getItem: k => (k in d ? d[k] : null),
    setItem: (k, v) => { d[k] = String(v); },
    removeItem: k => { delete d[k]; }
  };
}

const ls = makeLS();
const sandbox = {
  document: { addEventListener: () => {}, querySelectorAll: () => [], getElementById: () => null },
  localStorage: ls,
  AppData: { state: { transactions: [] }, save() { ls.setItem('shipManageDB_v2', JSON.stringify(this.state)); } },
  alert: () => {},
  console, JSON, Date, Math, Object, Array, String, Number, isFinite, RegExp
};
vm.createContext(sandbox);
vm.runInContext(code, sandbox);
const app = sandbox.__app;

console.log('Validation + Auto-backup — tests\n');

// ---------- Validators ----------
console.log('[Group] Validators');
check('_isValidDate nhận ngày đúng', app._isValidDate('2026-06-01') === true);
check('_isValidDate từ chối rỗng', !app._isValidDate(''));
check('_isValidDate từ chối rác', !app._isValidDate('not-a-date'));
check('_isNumeric nhận số', app._isNumeric('12345') === true);
check('_isNumeric nhận số thập phân', app._isNumeric('123.45') === true);
check('_isNumeric từ chối chữ', !app._isNumeric('abc'));
check('_isNumeric từ chối rỗng', !app._isNumeric(''));

// ---------- Auto-backup rotation ----------
console.log('[Group] Auto-backup rotation');
ls.setItem('shipManageDB_v2', JSON.stringify({ transactions: [{ id: 'TX1' }] }));
// Seed 3 ảnh cũ (ngày quá khứ)
ls.setItem(app.AUTOBACKUP_KEY, JSON.stringify([
  { date: '2026-05-01', at: '2026-05-01T00:00:00Z', data: '{}' },
  { date: '2026-05-02', at: '2026-05-02T00:00:00Z', data: '{}' },
  { date: '2026-05-03', at: '2026-05-03T00:00:00Z', data: '{}' }
]));

app.runAutoBackup();             // tạo ảnh "hôm nay"
let list = app.listAutoBackups();
const today = new Date().toISOString().slice(0, 10);
check('giữ tối đa 3 ảnh (AUTOBACKUP_MAX)', list.length === app.AUTOBACKUP_MAX);
check('ảnh cũ nhất (2026-05-01) đã bị loại', !list.some(b => b.date === '2026-05-01'));
check('ảnh hôm nay đã được tạo', list.some(b => b.date === today));
check('ảnh hôm nay chứa dữ liệu shipManageDB_v2 hiện tại', (() => {
  const b = list.find(x => x.date === today);
  return b && JSON.parse(b.data).transactions[0].id === 'TX1';
})());

// ---------- Không tạo trùng trong ngày ----------
console.log('[Group] Không tạo trùng trong ngày');
const before = app.listAutoBackups().length;
app.runAutoBackup();             // gọi lại cùng ngày
check('gọi lại trong ngày -> không thêm ảnh trùng', app.listAutoBackups().length === before);
check('chỉ 1 ảnh cho ngày hôm nay', app.listAutoBackups().filter(b => b.date === today).length === 1);

// ---------- Restore ----------
console.log('[Group] Restore');
app.navigate = () => {};          // stub để tránh đụng DOM
app.currentView = 'dashboard';
// thêm 1 ảnh có dữ liệu khác để khôi phục
const snapData = JSON.stringify({ transactions: [{ id: 'SNAP-OK' }] });
const cur = app.listAutoBackups();
cur.push({ date: '2026-04-01', at: '2026-04-01T00:00:00Z', data: snapData });
ls.setItem(app.AUTOBACKUP_KEY, JSON.stringify(cur));
sandbox.confirm = () => true;     // chấp nhận hộp thoại
app.restoreAutoBackup('2026-04-01');
check('restore áp dụng đúng dữ liệu ảnh chụp', JSON.parse(ls.getItem('shipManageDB_v2')).transactions[0].id === 'SNAP-OK');

console.log('[Group] Định dạng số tiền');
check('parseNum bỏ dấu chấm: "1.000.000" -> 1000000', app.parseNum('1.000.000') === 1000000);
check('parseNum số thường "5000" -> 5000', app.parseNum('5000') === 5000);
check('parseNum rỗng -> 0', app.parseNum('') === 0);
check('parseNum số âm "-1.500" -> -1500', app.parseNum('-1.500') === -1500);
check('fmtMoney 1000000 -> "1.000.000"', app.fmtMoney(1000000) === '1.000.000');
check('fmtMoney 0 -> "0"', app.fmtMoney(0) === '0');
check('vòng tròn parseNum(fmtMoney(x)) == x', app.parseNum(app.fmtMoney(2500000)) === 2500000);

console.log('\n' + (process.exitCode ? '❌ CÓ TEST THẤT BẠI' : `✅ TẤT CẢ ${passed} KIỂM TRA ĐỀU PASS`));
