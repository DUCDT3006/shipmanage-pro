/**
 * Firebase Hybrid Sync Layer — V3
 * =================================================================
 * Mục tiêu: thay thế cơ chế ghi đè TOÀN BỘ state vào 1 document
 * (nguyên nhân mất dữ liệu khi dùng nhiều máy/tab) bằng kiến trúc Hybrid:
 *
 *  - PER-RECORD (mỗi bản ghi = 1 document): các collection tăng trưởng
 *      transactions, fuelLogs, fuelVoyages, shipments,
 *      captainReports, vesselExpenses, timesheets
 *      -> Firestore: collection "sm3_<tên>" , doc id = record.id
 *      -> Diệt trần 1MB; ghi/xoá TỪNG bản ghi (không đụng record khác).
 *
 *  - GROUPED (gộp 1 document): dữ liệu nhỏ/cố định
 *      company, vessels, vendors, customers, employees, monthlyCosts...
 *      -> Firestore: doc "sm3_grouped/state"
 *
 * Cơ chế an toàn:
 *  - GHI: diff tại chokepoint AppData.save() — chỉ đẩy bản ghi THAY ĐỔI.
 *  - ĐỌC: onSnapshot theo collection, MERGE THEO ID (added/modified/removed).
 *         Snapshot rỗng KHÔNG xoá dữ liệu local.
 *  - "Newest-wins": chỉ ghi đè local khi remote.updatedAt MỚI HƠN local.
 *  - MIGRATION: một-lần, KHÔNG phá huỷ — fan-out state local lên layout mới,
 *               GIỮ NGUYÊN document cũ "shipmanage/state" làm backup.
 *
 * ⚠️ CHƯA được nạp trong index.html. Để BẬT cloud sync, thêm các dòng sau
 * vào app/index.html TRƯỚC <script src="js/app.js">:
 *
 *   <script src="https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js"></script>
 *   <script src="https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore-compat.js"></script>
 *   <script src="https://www.gstatic.com/firebasejs/9.22.0/firebase-analytics-compat.js"></script>
 *   <script src="js/firebase.js"></script>
 *
 * KHUYẾN NGHỊ: bật Firestore Security Rules + Authentication trước khi
 * dùng thật (xem task bảo mật). Migration chỉ ghi vào collection MỚI (sm3_*),
 * không động vào dữ liệu cũ, nên bật để test là an toàn.
 * =================================================================
 */

const firebaseConfig = {
  apiKey: "AIzaSyAw8DPNj3mLSvNrWh8qEr_qwnfaJ8kfSnM",
  authDomain: "shipmanage-vgt.firebaseapp.com",
  projectId: "shipmanage-vgt",
  storageBucket: "shipmanage-vgt.firebasestorage.app",
  messagingSenderId: "216198811980",
  appId: "1:216198811980:web:1d31e2166cf9958179bfe9",
  measurementId: "G-W23K5B00LV"
};

// ---- Cấu hình layout Hybrid ----
const SM3 = {
  prefix: 'sm3_',
  groupedCollection: 'sm3_grouped',
  groupedDocId: 'state',
  // Các collection tăng trưởng -> tách per-record
  perRecord: ['transactions', 'fuelLogs', 'fuelVoyages', 'shipments',
              'captainReports', 'vesselExpenses', 'timesheets']
};

let db = null;
let isFirebaseInitialized = false;
let suppressPush = false;            // chặn đẩy ngược khi đang áp dụng thay đổi từ cloud
let originalSave = null;             // bản save() gốc (chỉ ghi localStorage)
let rerenderTimer = null;
let auth = null;                     // Firebase Auth
let authStarted = false;             // đã start hybrid sync sau đăng nhập chưa
let tenantId = null;                  // ID khách thuê (Phase 2): mỗi khách = 1 tenant
let currentUser = null;               // {uid, email, role, tenantId, permissions} (Phase 3)

// Danh sách module để phân quyền (key = tên view trong app)
const APP_MODULES = [
  { key: 'dashboard',       label: 'Bảng điều khiển' },
  { key: 'financials',      label: 'Theo dõi Tài chính' },
  { key: 'debts',           label: 'Báo cáo Công nợ' },
  { key: 'fuel',            label: 'Quản lý Nhiên liệu' },
  { key: 'shipments',       label: 'Quản lý Chuyến hàng' },
  { key: 'partners',        label: 'NCC - Khách hàng' },
  { key: 'vessel-expenses', label: 'Quản lý Chi phí Tàu' },
  { key: 'monthly-costs',   label: 'Chi phí theo Tháng' },
  { key: 'hr',              label: 'Nhân sự' },
  { key: 'salary',          label: 'Tính lương' },
  { key: 'reports',         label: 'Báo cáo' },
  { key: 'company',         label: 'Master Data / Thiết lập' }
];
function allPermissions() { const p = {}; APP_MODULES.forEach(m => p[m.key] = true); return p; }
if (typeof window !== 'undefined') window.APP_MODULES = APP_MODULES;

// Bộ nhớ "đã đồng bộ" để tính diff (tránh đẩy lại dữ liệu không đổi)
const lastSynced = {
  grouped: null,                     // JSON string của phần grouped
  records: {}                        // records[collection] = Map(id -> JSON string)
};

// ---------------------------------------------------------------
// Khởi tạo
// ---------------------------------------------------------------
function initFirebase() {
  try {
    if (typeof firebase !== 'undefined') {
      firebase.initializeApp(firebaseConfig);
      if (typeof firebase.analytics === 'function') {
        try { firebase.analytics(); } catch (e) { /* analytics optional */ }
      }
      db = firebase.firestore();
      isFirebaseInitialized = true;
      console.log('[Sync V3] Firebase Firestore initialized (Hybrid layout).');
      // GATE: chỉ đồng bộ cloud sau khi đăng nhập
      if (typeof firebase.auth === 'function') {
        auth = firebase.auth();
        setupAuthGate();
      } else {
        console.warn('[Auth] SDK Auth chưa nạp — chạy local, không đồng bộ.');
        updateServerStatus('offline', 'Ngoại tuyến (Lưu cục bộ)');
      }
    } else {
      console.warn('[Sync V3] Firebase SDK not loaded. Local-only mode.');
      updateServerStatus('offline', 'Ngoại tuyến (Lưu cục bộ)');
    }
  } catch (e) {
    console.error('[Sync V3] Failed to initialize Firebase:', e);
    updateServerStatus('error', 'Lỗi kết nối Firebase');
  }
}

// UI status indicator (giữ nguyên hành vi cũ)
function updateServerStatus(status, text) {
  const container = document.querySelector('.server-status');
  if (!container) return;

  let dotColor = '#10b981';
  let pulseClass = '';
  if (status === 'connecting') {
    dotColor = '#f59e0b';
    pulseClass = 'animation: pulse 1s infinite alternate;';
  } else if (status === 'error' || status === 'offline') {
    dotColor = '#ef4444';
  }

  container.innerHTML = `
    <span class="status-dot" style="
        background-color: ${dotColor};
        box-shadow: 0 0 10px ${dotColor};
        display: inline-block;
        width: 8px; height: 8px;
        border-radius: 50%;
        margin-right: 6px;
        vertical-align: middle;
        ${pulseClass}
    "></span>
    <span style="font-size: 0.85rem; font-weight: 500;">${text}</span>
  `;
}

function handleSyncError(err, action) {
  console.error('[Sync V3] ' + action + ' error:', err);
  if (err && err.code === 'permission-denied') {
    updateServerStatus('error', 'Lỗi phân quyền (Chưa bật Rules)');
  } else {
    updateServerStatus('error', 'Lỗi đồng bộ (Offline)');
  }
}

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------
function recordsColl(collection) { return SM3.prefix + collection; }  // tên collection (dùng làm nhãn)

// === Tham chiếu Firestore theo TENANT (Phase 2) ===
// Mọi dữ liệu nằm dưới tenants/{tenantId}/... -> cách ly hoàn toàn giữa các khách.
function tenantRoot() { return db.collection('tenants').doc(tenantId); }
function recColl(name) { return tenantRoot().collection(SM3.prefix + name); }      // tenants/{tid}/sm3_<name>
function groupedDocRef() { return tenantRoot().collection(SM3.groupedCollection).doc(SM3.groupedDocId); } // .../sm3_grouped/state

// Mọi key cấp cao KHÔNG thuộc per-record => thuộc nhóm grouped (động, không bỏ sót).
function groupedKeys() {
  if (!AppData.state) return [];
  return Object.keys(AppData.state).filter(k => !SM3.perRecord.includes(k));
}

function buildGrouped() {
  const o = {};
  groupedKeys().forEach(k => { o[k] = AppData.state[k]; });
  return o;
}

// Re-render có debounce nhẹ để tránh giật khi nhiều snapshot dồn về
function scheduleRerender() {
  if (rerenderTimer) clearTimeout(rerenderTimer);
  rerenderTimer = setTimeout(() => {
    if (typeof app !== 'undefined' && app.currentView) {
      try { app.navigate(app.currentView); } catch (e) { /* ignore */ }
    }
  }, 120);
}

// ===============================================================
// AUTHENTICATION GATE (Phase 1) — chặn cửa, phải đăng nhập mới vào
// ===============================================================
function setupAuthGate() {
  injectLoginOverlay();
  updateServerStatus('connecting', 'Đang kiểm tra đăng nhập...');
  auth.onAuthStateChanged(async (user) => {
    if (user) {
      try {
        const info = await resolveTenantAndRole(user);
        if (info.blocked) {                 // tài khoản bị khóa
          await auth.signOut();
          showLoginOverlay();
          showLoginError('Tài khoản đã bị khóa. Liên hệ quản trị viên.');
          return;
        }
        currentUser = { uid: user.uid, email: user.email || '', role: info.role, tenantId: info.tenantId, permissions: info.permissions };
        if (typeof window !== 'undefined') window.SM_USER = currentUser;
        tenantId = info.tenantId;
        console.log('[Tenant] tenantId =', tenantId, '| role =', info.role);

        hideLoginOverlay();
        const badge = document.getElementById('auth-user-badge');
        if (badge) badge.textContent = (user.email || '') + (info.role === 'sub' ? ' (NV)' : '');

        resetLocalIfTenantChanged(tenantId);
        applyPermissionGating();
        if (!authStarted) {
          authStarted = true;
          setupHybridSync();          // chỉ đồng bộ cloud SAU khi đăng nhập
        } else {
          scheduleRerender();
        }
      } catch (e) {
        console.error('[Auth] resolveTenantAndRole error:', e);
        updateServerStatus('error', 'Lỗi tải hồ sơ người dùng');
      }
    } else {
      showLoginOverlay();
      updateServerStatus('offline', 'Chưa đăng nhập');
    }
  });
}

// Tra users/{uid} -> tenantId + role + permissions. Lần đầu (chưa có doc) = OWNER, tự bootstrap.
async function resolveTenantAndRole(user) {
  const uref = db.collection('users').doc(user.uid);
  const snap = await uref.get();
  if (snap.exists) {
    const d = snap.data() || {};
    if (d.active === false) return { blocked: true };
    return { tenantId: d.tenantId || user.uid, role: d.role || 'sub', permissions: d.permissions || {} };
  }
  // Bootstrap owner: tenantId = uid, full quyền
  const perms = allPermissions();
  await uref.set({
    tenantId: user.uid, role: 'owner', email: user.email || '',
    permissions: perms, active: true, createdAt: new Date().toISOString()
  });
  // tạo doc tenant (metadata + giới hạn user phụ - Phase 4 sẽ dùng license)
  try {
    await db.collection('tenants').doc(user.uid).set(
      { ownerUid: user.uid, maxSubUsers: 5, createdAt: new Date().toISOString() }, { merge: true });
  } catch (e) { /* không chặn nếu rules chưa cho */ }
  console.log('[Auth] Bootstrap OWNER cho', user.email);
  return { tenantId: user.uid, role: 'owner', permissions: perms };
}

// ===== Phân quyền theo module: ẩn menu + chặn navigate =====
function isViewAllowed(view) {
  if (!currentUser) return true;
  if (currentUser.role === 'owner') return true;
  if (!APP_MODULES.some(m => m.key === view)) return true; // view ngoài danh sách module -> không chặn
  return currentUser.permissions && currentUser.permissions[view] === true;
}
function firstAllowedView() {
  if (!currentUser || currentUser.role === 'owner') return 'dashboard';
  const m = APP_MODULES.find(x => currentUser.permissions && currentUser.permissions[x.key] === true);
  return m ? m.key : 'dashboard';
}
function applyPermissionGating() {
  if (typeof document === 'undefined') return;
  const owner = currentUser && currentUser.role === 'owner';
  document.querySelectorAll('.nav-item[data-view]').forEach(el => {
    const v = el.getAttribute('data-view');
    el.style.display = (owner || isViewAllowed(v)) ? '' : 'none';
  });
  // Chặn navigate tới view không có quyền (patch 1 lần)
  if (typeof app !== 'undefined' && !app.__permPatched) {
    const origNav = app.navigate.bind(app);
    app.navigate = function (view, ...args) {
      if (view && !isViewAllowed(view)) {
        console.warn('[Perm] Không có quyền vào "' + view + '" -> chuyển hướng.');
        view = firstAllowedView();
      }
      return origNav(view, ...args);
    };
    app.__permPatched = true;
  }
  // Nếu đang ở view không được phép -> chuyển về view đầu tiên hợp lệ
  if (typeof app !== 'undefined' && app.currentView && !isViewAllowed(app.currentView)) {
    app.navigate(firstAllowedView());
  }
}

// ===== Quản lý thành viên (owner) =====
async function smListMembers() {
  if (!currentUser) return [];
  const snap = await db.collection('users').where('tenantId', '==', currentUser.tenantId).get();
  return snap.docs.map(d => Object.assign({ uid: d.id }, d.data()));
}
async function smAddSubUser(email, password, permissions) {
  if (!currentUser || currentUser.role !== 'owner') throw new Error('Chỉ chủ tài khoản mới thêm được người dùng.');
  // Secondary app: tạo tài khoản phụ mà KHÔNG làm văng phiên owner (chạy được trên gói Spark)
  const secondary = firebase.initializeApp(firebaseConfig, 'Secondary-' + Date.now());
  try {
    const cred = await secondary.auth().createUserWithEmailAndPassword(email, password);
    const newUid = cred.user.uid;
    await db.collection('users').doc(newUid).set({
      tenantId: currentUser.tenantId, role: 'sub', email: email,
      permissions: permissions || {}, active: true, createdAt: new Date().toISOString()
    });
    await secondary.auth().signOut();
    return newUid;
  } finally {
    try { await secondary.delete(); } catch (e) { /* ignore */ }
  }
}
async function smSetMemberActive(uid, active) {
  await db.collection('users').doc(uid).update({ active: !!active });
}
async function smUpdateMemberPermissions(uid, permissions) {
  await db.collection('users').doc(uid).update({ permissions: permissions });
}
if (typeof window !== 'undefined') {
  window.smListMembers = smListMembers;
  window.smAddSubUser = smAddSubUser;
  window.smSetMemberActive = smSetMemberActive;
  window.smUpdateMemberPermissions = smUpdateMemberPermissions;
}

// State trắng cho khách mới (không phải dữ liệu mẫu Vũ Gia) -> khách tự nhập công ty
function blankState() {
  return {
    company: { name: '', taxId: '', bankInfo: '', address: '',
      openingBalances: { 'ABbank': 0, 'Viettinbank': 0, 'Tài khoản cá nhân': 0, 'Tiền mặt': 0 } },
    vessels: [], vendors: [], customers: [], employees: [], monthlyCosts: [],
    transactions: [], fuelLogs: [], fuelVoyages: [], shipments: [],
    captainReports: [], vesselExpenses: [], timesheets: []
  };
}

// Đổi tenant (đăng nhập user khác) trên cùng trình duyệt -> xoá cache local, bắt đầu trắng.
// Nếu tenant đã có dữ liệu trên cloud, các listener sẽ tự nạp lại sau đó.
function resetLocalIfTenantChanged(tid) {
  const KEY = 'shipManage_currentTenant';
  const cached = localStorage.getItem(KEY);
  if (cached === tid) return;                 // cùng tenant -> giữ cache cho nhanh
  AppData.state = blankState();
  try { localStorage.setItem('shipManageDB_v2', JSON.stringify(AppData.state)); } catch (e) {}
  localStorage.setItem(KEY, tid);
  console.log('[Tenant] Đổi tenant -> reset dữ liệu local về trắng.');
  if (typeof app !== 'undefined' && app.currentView) {
    try { app.navigate(app.currentView); } catch (e) { /* ignore */ }
  }
}

function injectLoginOverlay() {
  if (document.getElementById('auth-overlay')) return;
  const ov = document.createElement('div');
  ov.id = 'auth-overlay';
  ov.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:#0b0f19;background-image:radial-gradient(at 0% 0%, rgba(59,130,246,0.12) 0, transparent 50%),radial-gradient(at 100% 100%, rgba(16,185,129,0.06) 0, transparent 50%);font-family:Inter,sans-serif;';
  ov.innerHTML = `
    <div style="background:rgba(17,24,39,0.85);backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,0.08);border-radius:20px;padding:2.5rem;width:90%;max-width:400px;box-shadow:0 20px 50px rgba(0,0,0,0.5);">
      <div style="text-align:center;margin-bottom:1.5rem;">
        <div style="font-size:2.5rem;color:#3b82f6;margin-bottom:0.5rem;"><i class="fa-solid fa-anchor"></i></div>
        <h2 style="color:#fff;margin:0;font-size:1.4rem;font-weight:700;">ShipManage Pro</h2>
        <p style="color:#94a3b8;font-size:0.85rem;margin:0.4rem 0 0;">Đăng nhập để tiếp tục</p>
      </div>
      <form id="auth-form" onsubmit="event.preventDefault();doLogin();">
        <div style="margin-bottom:1rem;">
          <label style="display:block;color:#cbd5e1;font-size:0.8rem;margin-bottom:0.35rem;">Email</label>
          <input id="auth-email" type="email" required autocomplete="username" placeholder="email@congty.com"
            style="width:100%;box-sizing:border-box;padding:0.7rem 0.9rem;border-radius:10px;border:1px solid rgba(255,255,255,0.12);background:rgba(0,0,0,0.3);color:#fff;font-size:0.95rem;">
        </div>
        <div style="margin-bottom:1.25rem;">
          <label style="display:block;color:#cbd5e1;font-size:0.8rem;margin-bottom:0.35rem;">Mật khẩu</label>
          <input id="auth-pass" type="password" required autocomplete="current-password" placeholder="••••••••"
            style="width:100%;box-sizing:border-box;padding:0.7rem 0.9rem;border-radius:10px;border:1px solid rgba(255,255,255,0.12);background:rgba(0,0,0,0.3);color:#fff;font-size:0.95rem;">
        </div>
        <div id="auth-error" style="display:none;color:#fca5a5;font-size:0.82rem;margin-bottom:0.9rem;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);padding:0.6rem 0.8rem;border-radius:8px;"></div>
        <button id="auth-submit" type="submit"
          style="width:100%;padding:0.8rem;border:none;border-radius:10px;background:linear-gradient(135deg,#3b82f6,#1d4ed8);color:#fff;font-weight:600;font-size:0.95rem;cursor:pointer;">
          Đăng nhập
        </button>
      </form>
      <p style="color:#64748b;font-size:0.72rem;text-align:center;margin:1.25rem 0 0;">Tài khoản do quản trị viên cấp.</p>
    </div>`;
  document.body.appendChild(ov);
}

function showLoginOverlay() {
  const ov = document.getElementById('auth-overlay');
  if (ov) ov.style.display = 'flex';
}
function hideLoginOverlay() {
  const ov = document.getElementById('auth-overlay');
  if (ov) ov.style.display = 'none';
}
function showLoginError(msg) {
  const e = document.getElementById('auth-error');
  if (e) { e.textContent = msg; e.style.display = 'block'; }
}

function doLogin() {
  if (!auth) return;
  const email = (document.getElementById('auth-email') || {}).value;
  const pass = (document.getElementById('auth-pass') || {}).value;
  const btn = document.getElementById('auth-submit');
  if (btn) { btn.disabled = true; btn.textContent = 'Đang đăng nhập...'; }
  auth.signInWithEmailAndPassword(email, pass)
    .catch(err => showLoginError(mapAuthError(err)))
    .finally(() => { if (btn) { btn.disabled = false; btn.textContent = 'Đăng nhập'; } });
}

function signOutApp() {
  if (!auth) return;
  auth.signOut().then(() => location.reload());
}
// cho phép gọi từ HTML inline + nút đăng xuất
if (typeof window !== 'undefined') {
  window.doLogin = doLogin;
  window.signOutApp = signOutApp;
}

function mapAuthError(err) {
  const c = err && err.code ? err.code : '';
  switch (c) {
    case 'auth/invalid-email': return 'Email không hợp lệ.';
    case 'auth/user-disabled': return 'Tài khoản đã bị khóa.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential': return 'Sai email hoặc mật khẩu.';
    case 'auth/too-many-requests': return 'Thử quá nhiều lần. Vui lòng đợi rồi thử lại.';
    case 'auth/network-request-failed': return 'Lỗi mạng. Kiểm tra kết nối Internet.';
    case 'auth/operation-not-allowed': return 'Chưa bật Email/Password trong Firebase Console.';
    default: return 'Đăng nhập thất bại: ' + (err && err.message ? err.message : c);
  }
}

// ---------------------------------------------------------------
// Thiết lập sync
// ---------------------------------------------------------------
function setupHybridSync() {
  patchSaveForPush();
  attachListeners();
  runMigrationIfNeeded();
}

// Vá AppData.save(): vẫn ghi localStorage trước (nhanh), rồi đẩy diff lên cloud.
function patchSaveForPush() {
  originalSave = AppData.save.bind(AppData);
  AppData.save = function () {
    originalSave();
    if (!isFirebaseInitialized || !db || suppressPush) return;
    pushDiff();
  };
}

// ---------------------------------------------------------------
// GHI: tính diff và đẩy CHỈ phần thay đổi
// ---------------------------------------------------------------
async function pushDiff() {
  try {
    updateServerStatus('connecting', 'Đang lưu đám mây...');

    let changedAnything = false;
    const ops = [];                 // {type:'set'|'delete', coll, id, data}
    const pendingLast = [];         // [{coll, id, str}] áp dụng sau khi commit thành công

    // 1) GROUPED
    const groupedStr = JSON.stringify(buildGrouped());
    let groupedToWrite = null;
    if (groupedStr !== lastSynced.grouped) {
      groupedToWrite = buildGrouped();
      groupedToWrite._groupedUpdatedAt = new Date().toISOString();
      changedAnything = true;
    }

    // 2) PER-RECORD
    SM3.perRecord.forEach(coll => {
      const arr = AppData.state[coll] || [];
      const last = lastSynced.records[coll] || (lastSynced.records[coll] = new Map());
      const seen = new Set();

      arr.forEach(rec => {
        if (!rec || rec.id == null) return;
        const id = String(rec.id);
        seen.add(id);
        const cur = JSON.stringify(rec);
        if (last.get(id) !== cur) {
          // có thay đổi -> đóng dấu updatedAt rồi ghi
          rec.updatedAt = new Date().toISOString();
          const data = Object.assign({}, rec);
          ops.push({ type: 'set', coll, id, data });
          pendingLast.push({ coll, id, str: JSON.stringify(rec) });
          changedAnything = true;
        }
      });

      // bản ghi bị xoá local -> xoá trên cloud
      for (const id of Array.from(last.keys())) {
        if (!seen.has(id)) {
          ops.push({ type: 'delete', coll, id });
          pendingLast.push({ coll, id, str: null });
          changedAnything = true;
        }
      }
    });

    if (!changedAnything) {
      updateServerStatus('online', 'Đã đồng bộ đám mây');
      return;
    }

    // Lưu lại localStorage để các dấu updatedAt vừa đóng được giữ ở local
    originalSave();

    // 3) Commit lên Firestore
    if (groupedToWrite) {
      await groupedDocRef().set(groupedToWrite, { merge: true });
    }
    for (let i = 0; i < ops.length; i += 450) {
      const batch = db.batch();
      ops.slice(i, i + 450).forEach(op => {
        const ref = recColl(op.coll).doc(op.id);
        if (op.type === 'set') batch.set(ref, op.data);
        else batch.delete(ref);
      });
      await batch.commit();
    }

    // 4) Cập nhật bộ nhớ đồng bộ SAU KHI commit thành công
    if (groupedToWrite) lastSynced.grouped = JSON.stringify(buildGrouped());
    pendingLast.forEach(p => {
      const last = lastSynced.records[p.coll] || (lastSynced.records[p.coll] = new Map());
      if (p.str === null) last.delete(p.id);
      else last.set(p.id, p.str);
    });

    updateServerStatus('online', 'Đã đồng bộ đám mây');
  } catch (err) {
    handleSyncError(err, 'pushDiff');
  }
}

// ---------------------------------------------------------------
// ĐỌC: lắng nghe theo collection, merge theo id
// ---------------------------------------------------------------
function attachListeners() {
  // GROUPED
  groupedDocRef().onSnapshot(doc => {
    if (!doc.exists) return; // KHÔNG xoá local khi cloud rỗng
    const data = doc.data() || {};
    suppressPush = true;
    Object.keys(data).forEach(k => {
      if (k.startsWith('_')) return;
      if (SM3.perRecord.includes(k)) return; // an toàn: không đụng per-record
      AppData.state[k] = data[k];
    });
    lastSynced.grouped = JSON.stringify(buildGrouped());
    originalSave();
    suppressPush = false;
    updateServerStatus('online', 'Đã đồng bộ đám mây');
    scheduleRerender();
  }, err => handleSyncError(err, 'grouped.onSnapshot'));

  // PER-RECORD
  SM3.perRecord.forEach(coll => {
    recColl(coll).onSnapshot(snap => {
      updateServerStatus('online', 'Đã đồng bộ đám mây'); // snapshot fired => đã kết nối
      suppressPush = true;
      let touched = false;
      snap.docChanges().forEach(ch => {
        const id = ch.doc.id;
        if (ch.type === 'removed') {
          applyRemoteRecord(coll, id, null, true);
        } else {
          applyRemoteRecord(coll, id, ch.doc.data(), false);
        }
        touched = true;
      });
      if (touched) originalSave();
      suppressPush = false;
      if (touched) scheduleRerender();
    }, err => handleSyncError(err, recordsColl(coll) + '.onSnapshot'));
  });
}

// Áp dụng 1 thay đổi từ cloud vào state local (newest-wins)
function applyRemoteRecord(coll, id, data, removed) {
  if (!AppData.state[coll]) AppData.state[coll] = [];
  const arr = AppData.state[coll];
  const sid = String(id);
  const idx = arr.findIndex(x => x && String(x.id) === sid);
  const last = lastSynced.records[coll] || (lastSynced.records[coll] = new Map());

  if (removed) {
    if (idx >= 0) arr.splice(idx, 1);
    last.delete(sid);
    return;
  }

  const local = idx >= 0 ? arr[idx] : null;
  // Nếu bản local MỚI HƠN remote -> giữ local và buộc đẩy lại lên cloud
  if (local && local.updatedAt && data.updatedAt && data.updatedAt < local.updatedAt) {
    last.delete(sid); // để lần save() sau diff thấy "khác" và đẩy bản local lên
    return;
  }

  if (idx >= 0) arr[idx] = data; else arr.push(data);
  last.set(sid, JSON.stringify(data));
}

// ---------------------------------------------------------------
// MIGRATION một-lần (không phá huỷ): fan-out state local -> layout v3
// ---------------------------------------------------------------
async function runMigrationIfNeeded() {
  try {
    const ref = groupedDocRef();
    const snap = await ref.get();
    if (snap.exists) {
      console.log('[Sync V3] Layout v3 đã tồn tại trên cloud — bỏ qua migration.');
      updateServerStatus('online', 'Đã đồng bộ đám mây');
      return;
    }

    console.log('[Sync V3] Bắt đầu migration local -> v3 (không phá huỷ, giữ doc cũ shipmanage/state)...');
    updateServerStatus('connecting', 'Đang nâng cấp cấu trúc đám mây...');

    // GROUPED
    const grouped = buildGrouped();
    const nowIso = new Date().toISOString();
    grouped._groupedUpdatedAt = nowIso;
    grouped._migratedAt = nowIso;
    await ref.set(grouped);
    lastSynced.grouped = JSON.stringify(buildGrouped());

    // PER-RECORD
    let total = 0;
    for (const coll of SM3.perRecord) {
      const arr = AppData.state[coll] || [];
      const last = lastSynced.records[coll] || (lastSynced.records[coll] = new Map());
      for (let i = 0; i < arr.length; i += 450) {
        const batch = db.batch();
        arr.slice(i, i + 450).forEach(rec => {
          if (!rec || rec.id == null) return;
          // Đóng dấu updatedAt NGAY TRÊN record local để state == lastSynced,
          // tránh lần save() đầu tiên hiểu nhầm "đã đổi" và đẩy lại toàn bộ.
          if (!rec.updatedAt) rec.updatedAt = nowIso;
          batch.set(recColl(coll).doc(String(rec.id)), Object.assign({}, rec));
          last.set(String(rec.id), JSON.stringify(rec));
          total++;
        });
        await batch.commit();
      }
    }

    console.log('[Sync V3] Migration hoàn tất. Số bản ghi đã tải lên:', total);
    updateServerStatus('online', 'Đã đồng bộ đám mây');
  } catch (err) {
    handleSyncError(err, 'migration');
  }
}

// ---------------------------------------------------------------
// Tự khởi tạo khi DOM sẵn sàng (chỉ chạy nếu SDK được nạp)
// ---------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  const style = document.createElement('style');
  style.innerHTML = `
    @keyframes pulse {
      from { transform: scale(1); opacity: 0.6; }
      to   { transform: scale(1.3); opacity: 1; }
    }
  `;
  document.head.appendChild(style);
  initFirebase();
});
