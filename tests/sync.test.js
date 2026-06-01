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

  function ref(coll, id) {
    return {
      set: (data) => { getColl(coll).set(id, JSON.parse(JSON.stringify(data))); writeCount++; return Promise.resolve(); },
      delete: () => { getColl(coll).delete(id); writeCount++; return Promise.resolve(); },
      get: () => Promise.resolve({ exists: getColl(coll).has(id), data: () => getColl(coll).get(id) }),
      onSnapshot: (cb) => { docCbs[coll + '/' + id] = cb; cb({ exists: getColl(coll).has(id), data: () => getColl(coll).get(id) }); return () => {}; }
    };
  }
  const db = {
    collection: (name) => ({
      doc: (id) => ref(name, id),
      onSnapshot: (cb) => { collCbs[name] = cb; cb({ docChanges: () => [] }); return () => {}; }
    }),
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
  const lsStore = {};
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
  const sb = buildSandbox(mock, appdata);
  sb.__domReady();            // -> initFirebase -> setupHybridSync -> migration (fire&forget)
  await flush();

  check('grouped doc được tạo', mock.collSize('sm3_grouped') === 1);
  check('2 transactions được fan-out per-record', mock.collSize('sm3_transactions') === 2);
  check('grouped chứa company/vessels (không chứa transactions)', (() => {
    const g = mock.store['sm3_grouped'].get('state');
    return g && g.company && Array.isArray(g.vessels) && !('transactions' in g);
  })());

  // ---------- pushDiff: chỉ đẩy bản ghi thay đổi ----------
  console.log('[Group] pushDiff incremental');
  mock.resetWrites();
  appdata.AppData.state.transactions.push({ id: 'TX3', thu: 999, chi: 0, content: 'c' });
  await sb.pushDiff();
  check('thêm 1 transaction -> đúng 1 write', mock.getWrites() === 1);
  check('cloud giờ có 3 transactions', mock.collSize('sm3_transactions') === 3);

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
  check('giá trị mới có trên cloud', mock.store['sm3_transactions'].get('TX1').thu === 12345);
  check('record được đóng dấu updatedAt', !!mock.store['sm3_transactions'].get('TX1').updatedAt);

  // ---------- Xoá local -> delete cloud ----------
  console.log('[Group] Delete propagation');
  mock.resetWrites();
  appdata.AppData.state.transactions = appdata.AppData.state.transactions.filter(t => t.id !== 'TX2');
  await sb.pushDiff();
  check('xoá 1 local -> đúng 1 write (delete)', mock.getWrites() === 1);
  check('cloud còn 2 transactions', mock.collSize('sm3_transactions') === 2);
  check('TX2 đã bị xoá trên cloud', !mock.store['sm3_transactions'].has('TX2'));

  // ---------- Remote add -> merge vào local ----------
  console.log('[Group] Remote add merge');
  mock.fireColl('sm3_transactions', [
    { type: 'added', doc: { id: 'TX9', data: () => ({ id: 'TX9', thu: 777, content: 'remote', updatedAt: '2026-06-01T00:00:00.000Z' }) } }
  ]);
  check('local nhận TX9 từ remote', appdata.AppData.state.transactions.some(t => t.id === 'TX9'));

  // ---------- Newest-wins: remote cũ hơn KHÔNG ghi đè ----------
  console.log('[Group] Newest-wins');
  const local = appdata.AppData.state.transactions.find(t => t.id === 'TX1');
  local.updatedAt = '2026-06-01T10:00:00.000Z';   // local mới
  local.thu = 88888;
  mock.fireColl('sm3_transactions', [
    { type: 'modified', doc: { id: 'TX1', data: () => ({ id: 'TX1', thu: 11111, updatedAt: '2026-06-01T09:00:00.000Z' }) } } // remote cũ hơn
  ]);
  check('remote CŨ HƠN không ghi đè local mới', appdata.AppData.state.transactions.find(t => t.id === 'TX1').thu === 88888);

  // ---------- Snapshot rỗng không xoá local ----------
  console.log('[Group] Empty snapshot safety');
  const before = appdata.AppData.state.transactions.length;
  mock.fireColl('sm3_transactions', []); // không có docChanges
  check('snapshot rỗng KHÔNG xoá dữ liệu local', appdata.AppData.state.transactions.length === before);

  console.log('\n' + (process.exitCode ? '❌ CÓ TEST THẤT BẠI' : `✅ TẤT CẢ ${passed} KIỂM TRA ĐỀU PASS`));
})();
