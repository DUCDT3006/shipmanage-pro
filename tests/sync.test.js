/**
 * Logic tests for the Hybrid Sync Layer (app/js/firebase.js).
 * Chạy: node tests/sync.test.js
 *
 * Dùng vm sandbox + mock Firestore/AppData/document để kiểm chứng:
 *  1. Migration fan-out local -> layout v3 (đúng số bản ghi).
 *  2. pushDiff chỉ đẩy bản ghi THAY ĐỔI (không đẩy lại dữ liệu cũ).
 *  3. Save không thay đổi -> không ghi cloud.
 *  4. Xoá local -> phát sinh delete trên cloud.
 *  5. Remote add -> merge vào local.
 *  6. Newest-wins: remote CŨ HƠN không ghi đè bản local mới hơn.
 *  7. Snapshot rỗng KHÔNG xoá dữ liệu local.
 */

const vm = require('vm');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const code = fs.readFileSync(path.join(__dirname, '..', 'app', 'js', 'firebase.js'), 'utf8');

let passed = 0;
function check(name, cond) {
  if (cond) { passed++; console.log('  ✅ ' + name); }
  else { console.error('  ❌ ' + name); process.exitCode = 1; }
}
const flush = () => new Promise(r => setTimeout(r, 10));

// ---- Mock Firestore (in-memory) ----
function makeMock() {
  const store = {};                 // collName -> Map(id -> data)
  let writeCount = 0;
  const collCbs = {};               // collName -> onSnapshot cb
  const docCbs = {};                // "coll/id" -> onSnapshot cb
  const getColl = n => store[n] || (store[n] = new Map());

  function docRef(collPath, id) {
    const fullDoc = collPath + '/' + id;
    return {
      set: (data, opts) => {
        const clone = JSON.parse(JSON.stringify(data));
        if (opts && opts.merge && getColl(collPath).has(id)) {
          getColl(collPath).set(id, Object.assign({}, getColl(collPath).get(id), clone));
        } else { getColl(collPath).set(id, clone); }
        if (!collPath.includes('auditLog')) writeCount++;   // không tính write nhật ký
        return Promise.resolve();
      },
      delete: () => { getColl(collPath).delete(id); if (!collPath.includes('auditLog')) writeCount++; return Promise.resolve(); },
      get: () => Promise.resolve({ exists: getColl(collPath).has(id), data: () => getColl(collPath).get(id) }),
      onSnapshot: (cb) => { docCbs[fullDoc] = cb; cb({ exists: getColl(collPath).has(id), data: () => getColl(collPath).get(id) }); return () => {}; },
      collection: (sub) => collectionRef(fullDoc + '/' + sub)   // hỗ trợ subcollection (multi-tenant)
    };
  }
  function collectionRef(path) {
    return {
      doc: (id) => docRef(path, id),
      onSnapshot: (cb) => { collCbs[path] = cb; cb({ docChanges: () => [] }); return () => {}; },
      get: () => Promise.resolve({ docs: Array.from(getColl(path).entries()).map(([id, v]) => ({ id, data: () => v })) }),
      where: () => collectionRef(path)   // đơn giản hoá cho test (bỏ qua filter)
    };
  }
  const db = {
    collection: (name) => collectionRef(name),
    batch: () => {
      const ops = [];
      return {
        set: (r, d) => ops.push(() => r.set(d)),
        delete: (r) => ops.push(() => r.delete()),
        commit: () => { ops.forEach(fn => fn()); return Promise.resolve(); }
      };
    }
  };
  return {
    db, store,
    getWrites: () => writeCount,
    resetWrites: () => { writeCount = 0; },
    fireColl: (coll, changes) => collCbs[coll] && collCbs[coll]({ docChanges: () => changes }),
    collSize: (coll) => (store[coll] ? store[coll].size : 0)
  };
}

function makeAppData() {
  // Giả lập "đã ở đúng tenant u1" để bỏ qua reset-về-trắng (test này tập trung vào sync/migration)
  const lsStore = { 'shipManage_currentTenant': 'u1' };
  const AppData = {
    state: {
      company: { name: 'Cty', openingBalances: {} },
      vessels: [{ id: 'VG05', name: 'Vu Gia 05' }],
      vendors: [], customers: [], employees: [], monthlyCosts: [],
      transactions: [
        { id: 'TX1', thu: 100, chi: 0, content: 'a' },
        { id: 'TX2', thu: 0, chi: 50, content: 'b' }
      ],
      fuelLogs: [], fuelVoyages: [], shipments: [],
      captainReports: [], vesselExpenses: [], timesheets: []
    },
    save() { lsStore['shipManageDB_v2'] = JSON.stringify(this.state); }
  };
  return { AppData, lsStore };
}

function buildSandbox(mock, appdata) {
  const firebaseMock = {
    initializeApp: () => {},
    firestore: () => mock.db,
    analytics: () => ({}),
    // Auth mock: tự báo đã đăng nhập ngay để cổng auth đi qua
    auth: () => ({
      onAuthStateChanged: (cb) => { cb({ email: 'test@demo.com', uid: 'u1' }); },
      signInWithEmailAndPassword: () => Promise.resolve(),
      signOut: () => Promise.resolve()
    })
  };
  let domReady = null;
  const sandbox = {
    firebase: firebaseMock,
    AppData: appdata.AppData,
    app: { currentView: 'dashboard', navigate: () => {} },
    localStorage: {
      getItem: k => (k in appdata.lsStore ? appdata.lsStore[k] : null),
      setItem: (k, v) => { appdata.lsStore[k] = v; }
    },
    document: {
      addEventListener: (ev, cb) => { if (ev === 'DOMContentLoaded') domReady = cb; },
      querySelector: () => null,
      getElementById: () => null,
      querySelectorAll: () => [],
      createElement: () => ({ style: {} }),
      head: { appendChild: () => {} },
      body: { appendChild: () => {} }
    },
    window: {},
    console, setTimeout, clearTimeout, Promise, JSON, Object, Array, Date, String, Set, Map
  };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  sandbox.__domReady = () => domReady && domReady();
  return sandbox;
}

(async function run() {
  console.log('Hybrid Sync Layer — logic tests\n');

  // ---------- Setup + Migration ----------
  console.log('[Group] Migration');
  const mock = makeMock();
  const appdata = makeAppData();
  // Pre-seed license hợp lệ cho tenant u1 (để qua cổng license, tập trung test sync)
  mock.store['tenants'] = new Map([['u1', { licenseKey: 'TESTKEY', ownerUid: 'u1' }]]);
  mock.store['licenses'] = new Map([['TESTKEY', { status: 'active', activatedBy: 'u1', maxSubUsers: 5, expiresAt: '2099-12-31' }]]);
  const sb = buildSandbox(mock, appdata);
  sb.__domReady();            // -> initFirebase -> setupHybridSync -> migration (fire&forget)
  await flush();

  check('grouped doc được tạo', mock.collSize('tenants/u1/sm3_grouped') === 1);
  check('2 transactions được fan-out per-record', mock.collSize('tenants/u1/sm3_transactions') === 2);
  check('grouped chứa company/vessels (không chứa transactions)', (() => {
    const g = mock.store['tenants/u1/sm3_grouped'].get('state');
    return g && g.company && Array.isArray(g.vessels) && !('transactions' in g);
  })());

  // ---------- pushDiff: chỉ đẩy bản ghi thay đổi ----------
  console.log('[Group] pushDiff incremental');
  mock.resetWrites();
  appdata.AppData.state.transactions.push({ id: 'TX3', thu: 999, chi: 0, content: 'c' });
  await sb.pushDiff();
  check('thêm 1 transaction -> đúng 1 write', mock.getWrites() === 1);
  check('cloud giờ có 3 transactions', mock.collSize('tenants/u1/sm3_transactions') === 3);

  // ---------- Save không đổi -> không ghi ----------
  console.log('[Group] No-op save');
  mock.resetWrites();
  await sb.pushDiff();
  check('không thay đổi -> 0 write', mock.getWrites() === 0);

  // ---------- Sửa 1 record -> đúng 1 write ----------
  console.log('[Group] Edit one record');
  mock.resetWrites();
  appdata.AppData.state.transactions[0].thu = 12345;
  await sb.pushDiff();
  check('sửa 1 transaction -> đúng 1 write', mock.getWrites() === 1);
  check('giá trị mới có trên cloud', mock.store['tenants/u1/sm3_transactions'].get('TX1').thu === 12345);
  check('record được đóng dấu updatedAt', !!mock.store['tenants/u1/sm3_transactions'].get('TX1').updatedAt);

  // ---------- Xoá local -> delete cloud ----------
  console.log('[Group] Delete propagation');
  mock.resetWrites();
  appdata.AppData.state.transactions = appdata.AppData.state.transactions.filter(t => t.id !== 'TX2');
  await sb.pushDiff();
  check('xoá 1 local -> đúng 1 write (delete)', mock.getWrites() === 1);
  check('cloud còn 2 transactions', mock.collSize('tenants/u1/sm3_transactions') === 2);
  check('TX2 đã bị xoá trên cloud', !mock.store['tenants/u1/sm3_transactions'].has('TX2'));

  // ---------- Remote add -> merge vào local ----------
  console.log('[Group] Remote add merge');
  mock.fireColl('tenants/u1/sm3_transactions', [
    { type: 'added', doc: { id: 'TX9', data: () => ({ id: 'TX9', thu: 777, content: 'remote', updatedAt: '2026-06-01T00:00:00.000Z' }) } }
  ]);
  check('local nhận TX9 từ remote', appdata.AppData.state.transactions.some(t => t.id === 'TX9'));

  // ---------- Newest-wins: remote cũ hơn KHÔNG ghi đè ----------
  console.log('[Group] Newest-wins');
  const local = appdata.AppData.state.transactions.find(t => t.id === 'TX1');
  local.updatedAt = '2026-06-01T10:00:00.000Z';   // local mới
  local.thu = 88888;
  mock.fireColl('tenants/u1/sm3_transactions', [
    { type: 'modified', doc: { id: 'TX1', data: () => ({ id: 'TX1', thu: 11111, updatedAt: '2026-06-01T09:00:00.000Z' }) } } // remote cũ hơn
  ]);
  check('remote CŨ HƠN không ghi đè local mới', appdata.AppData.state.transactions.find(t => t.id === 'TX1').thu === 88888);

  // ---------- Snapshot rỗng không xoá local ----------
  console.log('[Group] Empty snapshot safety');
  const before = appdata.AppData.state.transactions.length;
  mock.fireColl('tenants/u1/sm3_transactions', []); // không có docChanges
  check('snapshot rỗng KHÔNG xoá dữ liệu local', appdata.AppData.state.transactions.length === before);

  // ---------- Đổi tenant -> reset local về trắng ----------
  console.log('[Group] Reset khi đổi tenant');
  const hadData = appdata.AppData.state.transactions.length > 0;
  sb.resetLocalIfTenantChanged('u2-khac');   // đăng nhập tenant KHÁC
  check('trước đó có dữ liệu', hadData);
  check('đổi tenant -> transactions về rỗng', appdata.AppData.state.transactions.length === 0);
  check('đổi tenant -> vessels về rỗng', appdata.AppData.state.vessels.length === 0);
  check('marker tenant được cập nhật', appdata.lsStore['shipManage_currentTenant'] === 'u2-khac');
  check('gọi lại cùng tenant -> KHÔNG reset nữa', (() => {
    appdata.AppData.state.transactions.push({ id: 'KEEP1' });
    sb.resetLocalIfTenantChanged('u2-khac'); // cùng tenant
    return appdata.AppData.state.transactions.length === 1;
  })());

  // ---------- License (Phase 4) ----------
  console.log('[Group] License');
  const lic1 = await sb.checkLicense('u1');
  check('license hợp lệ cho tenant đã kích hoạt', lic1.valid === true && lic1.maxSubUsers === 5);
  const lic2 = await sb.checkLicense('tenant-chua-kich-hoat');
  check('tenant chưa có key -> invalid', lic2.valid === false);
  mock.store['tenants'].set('expTenant', { licenseKey: 'EXPKEY' });
  mock.store['licenses'].set('EXPKEY', { status: 'active', activatedBy: 'expTenant', expiresAt: '2000-01-01' });
  const lic3 = await sb.checkLicense('expTenant');
  check('license hết hạn -> invalid', lic3.valid === false && /hết hạn/.test(lic3.reason));
  mock.store['licenses'].set('NEWKEY', { status: 'unused', activatedBy: null, maxSubUsers: 3, expiresAt: '2099-01-01' });
  await sb.activateLicense('NEWKEY');
  check('activate gắn key vào tenant hiện tại (u1)', mock.store['licenses'].get('NEWKEY').activatedBy === 'u1');
  check('tenant lưu licenseKey mới', mock.store['tenants'].get('u1').licenseKey === 'NEWKEY');
  mock.store['licenses'].set('USEDKEY', { status: 'active', activatedBy: 'someoneelse', expiresAt: '2099-01-01' });
  let usedBlocked = false;
  try { await sb.activateLicense('USEDKEY'); } catch (e) { usedBlocked = /tài khoản khác/.test(e.message); }
  check('key đã dùng cho tenant khác -> chặn kích hoạt', usedBlocked);

  // ---------- Audit log + Hoàn tác ----------
  console.log('[Group] Audit + Hoàn tác');
  await sb.pushDiff();                                   // đồng bộ để lastSynced khớp state hiện tại
  // Thêm record mới -> kiểm tra audit "add" rồi hoàn tác
  appdata.AppData.state.transactions.push({ id: 'TXUNDO', thu: 5, chi: 0, content: 'undo-add' });
  await sb.pushDiff();
  const addE = (await sb.smListAudit(100)).find(a => a.recordId === 'TXUNDO' && a.action === 'add');
  check('audit ghi nhận THÊM record (kèm summary)', !!addE && /Thêm Giao dịch/.test(addE.summary || ''));
  if (addE) await sb.smUndo(addE._id);
  check('hoàn tác THÊM -> record bị xóa khỏi state', !appdata.AppData.state.transactions.some(t => t.id === 'TXUNDO'));

  // Sửa record -> kiểm tra audit "edit" rồi hoàn tác (khôi phục giá trị cũ)
  appdata.AppData.state.transactions.push({ id: 'TXEDIT', thu: 100, chi: 0, content: 'goc' });
  await sb.pushDiff();
  const txe = appdata.AppData.state.transactions.find(t => t.id === 'TXEDIT');
  txe.thu = 999999;
  await sb.pushDiff();
  const editE = (await sb.smListAudit(100)).find(a => a.recordId === 'TXEDIT' && a.action === 'edit' && !a.undone);
  check('audit ghi nhận SỬA record', !!editE && editE.before && editE.before.thu === 100);
  if (editE) await sb.smUndo(editE._id);
  check('hoàn tác SỬA -> giá trị khôi phục (thu=100)', appdata.AppData.state.transactions.find(t => t.id === 'TXEDIT').thu === 100);

  // ---------- Phân quyền dữ liệu (task #17) ----------
  console.log('[Group] Phân quyền dữ liệu theo vai trò');
  // Simulate currentUser bị thay đổi sang sub
  vm.runInContext("currentUser = { uid:'sub1', role:'sub', tenantId:'u1', vesselIds:['VG05'] };", sb);
  check('sub KHÔNG được sync transactions (nhạy cảm)', sb.canSyncCollection('transactions') === false);
  check('sub KHÔNG được sync timesheets (nhạy cảm)', sb.canSyncCollection('timesheets') === false);
  check('sub được sync fuelLogs (vận hành, có tàu gán)', sb.canSyncCollection('fuelLogs') === true);
  check('isFinanceRole=false cho sub', sb.isFinanceRole() === false);
  vm.runInContext("currentUser = { uid:'acc1', role:'accountant', tenantId:'u1', vesselIds:[] };", sb);
  check('accountant ĐƯỢC sync transactions', sb.canSyncCollection('transactions') === true);
  check('isFinanceRole=true cho accountant', sb.isFinanceRole() === true);
  vm.runInContext("currentUser = { uid:'u1', role:'owner', tenantId:'u1', vesselIds:[] };", sb);
  check('owner sync tất cả', sb.canSyncCollection('transactions') && sb.canSyncCollection('fuelLogs'));

  console.log('\n' + (process.exitCode ? '❌ CÓ TEST THẤT BẠI' : `✅ TẤT CẢ ${passed} KIỂM TRA ĐỀU PASS`));
})();
