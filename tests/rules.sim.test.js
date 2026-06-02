/**
 * MÔ PHỎNG LOGIC firestore.rules (không phải emulator thật — môi trường thiếu Java).
 * Dịch các điều kiện `allow` sang JS rồi chạy ma trận tình huống để bắt lỗi LOGIC
 * (phân quyền finance, cách ly tenant, validate ghi, default-deny, lỗ catch-all).
 * Cú pháp CEL được Firebase Console kiểm tra khi Publish.
 *
 * Chạy: node tests/rules.sim.test.js
 */
let passed = 0;
function check(name, cond) {
  if (cond) { passed++; console.log('  ✅ ' + name); }
  else { console.error('  ❌ ' + name); process.exitCode = 1; }
}

// ---- Dịch helpers từ firestore.rules ----
const isSignedIn = (u) => !!u;
const isOwner = (u) => isSignedIn(u) && u.role === 'owner';
const isFinance = (u) => isSignedIn(u) && (u.role === 'owner' || u.role === 'accountant');
const inTenant = (u, tid) => isSignedIn(u) && u.tenantId === tid;

const nonNegOpt = (d, k) => !(k in d) || (typeof d[k] === 'number' && d[k] >= 0);
const strOpt = (d, k) => !(k in d) || typeof d[k] === 'string';
const validTransaction = (d) => nonNegOpt(d, 'thu') && nonNegOpt(d, 'chi')
  && strOpt(d, 'vessel') && strOpt(d, 'category') && strOpt(d, 'date') && strOpt(d, 'voyageNo') && strOpt(d, 'partner');
const validShipment = (d) => nonNegOpt(d, 'revenueReal') && nonNegOpt(d, 'revenueInvoice')
  && nonNegOpt(d, 'qty') && nonNegOpt(d, 'fuelHours')
  && (!('costs' in d) || (typeof d.costs === 'object' && d.costs !== null))
  && strOpt(d, 'vesselId') && strOpt(d, 'voyageNo');

// ---- decide(user, op, coll, tid, data) -> true=allow, false=deny ----
// Mô phỏng ĐÚNG cấu trúc rules: mỗi collection có 1 match riêng, KHÔNG catch-all rộng,
// còn lại default-deny.
function decide(u, op, coll, tid, data = {}) {
  const read = op === 'read', write = (op === 'create' || op === 'update'), del = op === 'delete';
  switch (coll) {
    case 'sm3_grouped_private':
      return inTenant(u, tid) && isFinance(u);
    case 'sm3_transactions':
      if (read || del) return inTenant(u, tid) && isFinance(u);
      if (write) return inTenant(u, tid) && isFinance(u) && validTransaction(data);
      return false;
    case 'sm3_timesheets':
      if (read || del) return inTenant(u, tid) && isFinance(u);
      if (write) return inTenant(u, tid) && isFinance(u);
      return false;
    case 'sm3_shipments':
      if (read || del) return inTenant(u, tid);
      if (write) return inTenant(u, tid) && validShipment(data);
      return false;
    case 'sm3_grouped':
    case 'sm3_fuelVoyages':
    case 'sm3_fuelLogs':
    case 'sm3_captainReports':
    case 'sm3_vesselExpenses':
      return inTenant(u, tid);
    default:
      return false; // default-deny (không có collection nào khác được phép)
  }
}

console.log('firestore.rules — mô phỏng logic\n');

const owner = { uid: 'u1', role: 'owner', tenantId: 'T1' };
const acc   = { uid: 'u2', role: 'accountant', tenantId: 'T1' };
const sub   = { uid: 'u3', role: 'sub', tenantId: 'T1' };
const other = { uid: 'x1', role: 'owner', tenantId: 'T2' };

console.log('[Nhóm] Phân quyền dữ liệu nhạy cảm');
check('owner ĐỌC transactions', decide(owner, 'read', 'sm3_transactions', 'T1') === true);
check('accountant ĐỌC transactions', decide(acc, 'read', 'sm3_transactions', 'T1') === true);
check('sub KHÔNG đọc transactions (chốt chặn server)', decide(sub, 'read', 'sm3_transactions', 'T1') === false);
check('sub KHÔNG ghi transactions', decide(sub, 'create', 'sm3_transactions', 'T1', { thu: 100 }) === false);
check('sub KHÔNG đọc lương (sm3_grouped_private)', decide(sub, 'read', 'sm3_grouped_private', 'T1') === false);
check('owner ĐỌC lương', decide(owner, 'read', 'sm3_grouped_private', 'T1') === true);
check('sub KHÔNG đọc timesheets', decide(sub, 'read', 'sm3_timesheets', 'T1') === false);

console.log('[Nhóm] Vận hành (mọi member trong tenant)');
check('sub ĐỌC fuelLogs', decide(sub, 'read', 'sm3_fuelLogs', 'T1') === true);
check('sub GHI fuelVoyages', decide(sub, 'create', 'sm3_fuelVoyages', 'T1') === true);
check('sub ĐỌC shipments', decide(sub, 'read', 'sm3_shipments', 'T1') === true);
check('sub ĐỌC grouped public', decide(sub, 'read', 'sm3_grouped', 'T1') === true);

console.log('[Nhóm] Cách ly tenant');
check('người tenant T2 KHÔNG đọc data T1', decide(other, 'read', 'sm3_shipments', 'T1') === false);
check('người tenant T2 KHÔNG đọc lương T1', decide(other, 'read', 'sm3_grouped_private', 'T1') === false);
check('chưa đăng nhập KHÔNG đọc gì', decide(null, 'read', 'sm3_shipments', 'T1') === false);

console.log('[Nhóm] Validate ghi');
check('owner ghi transaction hợp lệ -> OK', decide(owner, 'create', 'sm3_transactions', 'T1', { thu: 100, chi: 0, vessel: 'VG01', category: '1', date: '2026-06-01' }) === true);
check('owner ghi transaction thu ÂM -> CHẶN', decide(owner, 'create', 'sm3_transactions', 'T1', { thu: -5 }) === false);
check('owner ghi transaction chi sai kiểu -> CHẶN', decide(owner, 'create', 'sm3_transactions', 'T1', { chi: 'abc' }) === false);
check('ghi shipment doanh thu ÂM -> CHẶN', decide(owner, 'create', 'sm3_shipments', 'T1', { revenueReal: -1 }) === false);
check('ghi shipment hợp lệ -> OK', decide(sub, 'create', 'sm3_shipments', 'T1', { revenueReal: 1000, qty: 50, costs: {} }) === true);

console.log('[Nhóm] Default-deny + lỗ catch-all đã đóng');
check('collection lạ (vd sm3_secret) -> CHẶN', decide(owner, 'read', 'sm3_secret', 'T1') === false);
check('không còn catch-all: sub vẫn bị chặn transactions dù là member', decide(sub, 'read', 'sm3_transactions', 'T1') === false);

console.log('\n' + (process.exitCode ? '❌ CÓ TEST THẤT BẠI' : `✅ TẤT CẢ ${passed} KIỂM TRA LOGIC ĐỀU PASS`));
