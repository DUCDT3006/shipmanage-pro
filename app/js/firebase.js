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
              'captainReports', 'vesselExpenses', 'timesheets'],
  // ===== Phân loại theo độ nhạy cảm (task #17) =====
  // Nhạy cảm (tài chính/lương): chỉ owner + accountant được sync
  sensitivePerRecord: ['transactions', 'timesheets'],
  // Vận hành: sub được sync nhưng filter theo vesselId
  operationalPerRecord: ['fuelLogs', 'fuelVoyages', 'shipments', 'captainReports', 'vesselExpenses'],
  // Grouped tách theo độ nhạy cảm (task #17):
  //  - PUBLIC = doc sm3_grouped/state (cũ): mọi key TRỪ private; company KHÔNG kèm openingBalances.
  //  - PRIVATE = doc sm3_grouped_private/state (mới): lương + số dư đầu kỳ -> chỉ owner/accountant
  //    được Firestore Rules cho đọc/ghi => sub KHÔNG nhận về máy (vá rò rỉ qua snapshot/F12).
  groupedPrivateKeys: ['employees', 'monthlyCosts']
};
// Doc grouped PRIVATE (lương/số dư) — tách riêng, rules chỉ cho owner/accountant.
function groupedPrivateRef() { return tenantRoot().collection('sm3_grouped_private').doc(SM3.groupedDocId); }
// Vai trò có quyền xem dữ liệu nhạy cảm
function isFinanceRole() {
  return currentUser && (currentUser.role === 'owner' || currentUser.role === 'accountant');
}
function userVesselIds() {
  if (!currentUser) return [];
  const arr = currentUser.vesselIds || (currentUser.vesselId ? [currentUser.vesselId] : []);
  return Array.isArray(arr) ? arr.filter(Boolean) : [];
}
// Sub có thể xem collection vận hành cho tàu mình; nhạy cảm thì KHÔNG.
function canSyncCollection(coll) {
  if (isFinanceRole()) return true;                         // owner/accountant: tất cả
  if (SM3.sensitivePerRecord.includes(coll)) return false;  // sub không thấy tài chính/lương
  if (SM3.operationalPerRecord.includes(coll)) return userVesselIds().length > 0;
  return true;
}

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
  grouped: null,                     // JSON string của grouped (public + private nếu là finance)
  records: {}                        // records[collection] = Map(id -> JSON string)
};

// ---------------------------------------------------------------
// Khởi tạo
// ---------------------------------------------------------------
function initFirebase() {
  try {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('local') === 'true' || params.get('mockAuth') === 'true') {
        console.warn('[Sync V3] Bỏ qua Firebase Auth để chạy local/offline.');
        updateServerStatus('offline', 'Ngoại tuyến (Lưu cục bộ)');
        return;
      }
    }
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

  // Thanh loading mảnh ở đỉnh trang: bật khi đang kết nối/đồng bộ, tắt khi xong.
  toggleTopLoadingBar(status === 'connecting');
}

// Thanh tiến trình mảnh (top progress bar) — báo hiệu app đang tải/đồng bộ.
function toggleTopLoadingBar(show) {
  if (typeof document === 'undefined') return;
  let bar = document.getElementById('sm-top-loading');
  if (show) {
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'sm-top-loading';
      bar.className = 'sm-top-loading';
      bar.innerHTML = '<div class="sm-top-loading-fill"></div>';
      (document.body || document.documentElement).appendChild(bar);
    }
    bar.style.display = 'block';
  } else if (bar) {
    bar.style.display = 'none';
  }
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

// ----- Tách grouped theo độ nhạy cảm (task #17) -----
// PUBLIC: mọi key trừ private; company KHÔNG kèm openingBalances (số dư ngân hàng).
function buildGroupedPublic() {
  const o = {};
  groupedKeys().forEach(k => {
    if (SM3.groupedPrivateKeys.includes(k)) return;            // lương -> không vào doc public
    if (k === 'company' && AppData.state.company) {
      const c = Object.assign({}, AppData.state.company);
      delete c.openingBalances;                                // số dư đầu kỳ -> doc private
      o[k] = c;
    } else {
      o[k] = AppData.state[k];
    }
  });
  return o;
}
// PRIVATE: employees, monthlyCosts (lương) + openingBalances của company.
function buildGroupedPrivate() {
  const o = {};
  SM3.groupedPrivateKeys.forEach(k => { o[k] = AppData.state[k]; });
  if (AppData.state.company && AppData.state.company.openingBalances != null) {
    o._companyOpeningBalances = AppData.state.company.openingBalances;
  }
  return o;
}
// Chuỗi cơ sở để so diff + ghi nhớ đã-đồng-bộ. Sub không tính phần private (vì state không có).
function groupedSyncBasis() {
  const g = buildGrouped();
  if (!isFinanceRole()) SM3.groupedPrivateKeys.forEach(k => { delete g[k]; });
  return JSON.stringify(g);
}

// Re-render khi có dữ liệu mới từ cloud — debounce + GIỮ trải nghiệm:
//  - bỏ qua nếu đang mở modal (không phá thao tác nhập liệu)
//  - giữ nguyên vị trí cuộn và ô đang focus
function scheduleRerender() {
  if (rerenderTimer) clearTimeout(rerenderTimer);
  rerenderTimer = setTimeout(() => {
    if (typeof document === 'undefined' || typeof app === 'undefined' || !app.currentView) return;
    // Đang mở modal -> hoãn re-render (state đã cập nhật, sẽ làm mới khi đóng/điều hướng)
    if (document.querySelector('.modal-overlay.active')) return;
    const vc = document.getElementById('view-container');
    const scrollTop = vc ? vc.scrollTop : 0;
    const activeEl = document.activeElement;
    const activeId = activeEl && activeEl.id ? activeEl.id : null;
    try { app.navigate(app.currentView); } catch (e) { /* ignore */ }
    if (vc) vc.scrollTop = scrollTop;                       // khôi phục vị trí cuộn
    if (activeId) { const el = document.getElementById(activeId); if (el && el.focus) el.focus(); }
  }, 200);
}

// Fix#3: sau khi tải dữ liệu từ cloud, tính lại các số phân bổ dẫn xuất cho ĐÚNG (local-only,
// KHÔNG đẩy ngược để tránh vòng lặp). Debounce để gộp nhiều snapshot liên tiếp.
let recalcTimer = null;
function scheduleRecalcAfterSync() {
  if (recalcTimer) clearTimeout(recalcTimer);
  recalcTimer = setTimeout(() => {
    if (typeof AppData === 'undefined' || typeof AppData.recalcAllAllocations !== 'function') return;
    const prev = suppressPush;
    suppressPush = true;                 // recompute cục bộ, không phát sinh push
    try { AppData.recalcAllAllocations(); } catch (e) { console.warn('[Sync] recalc heal lỗi:', e); }
    suppressPush = prev;
    scheduleRerender();
  }, 900);
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
        currentUser = { uid: user.uid, email: user.email || '', role: info.role, tenantId: info.tenantId, permissions: info.permissions, vesselIds: info.vesselIds || [] };
        if (typeof window !== 'undefined') window.SM_USER = currentUser;
        tenantId = info.tenantId;
        console.log('[Tenant] tenantId =', tenantId, '| role =', info.role);
        hideLoginOverlay();

        // Phase 4: kiểm tra license của tenant trước khi vào app
        const lic = await checkLicense(tenantId);
        currentUser.maxSubUsers = lic.maxSubUsers || 0;
        if (!lic.valid) {
          showLicenseGate(currentUser.role === 'owner' ? 'activate' : 'blocked', lic.reason);
          return;                      // chưa kích hoạt / hết hạn -> không vào app, không sync
        }
        proceedAfterLicense();
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

// Sau khi license hợp lệ -> vào app + bắt đầu đồng bộ
function proceedAfterLicense() {
  hideLoginOverlay();
  hideLicenseGate();
  const badge = (typeof document !== 'undefined') ? document.getElementById('auth-user-badge') : null;
  if (badge && currentUser) badge.textContent = (currentUser.email || '') + (currentUser.role === 'sub' ? ' (NV)' : '');
  resetLocalIfTenantChanged(tenantId);
  applyPermissionGating();
  if (!authStarted) { authStarted = true; setupHybridSync(); }
  else { scheduleRerender(); }
}

// ===== Phase 4: License =====
// Nguồn sự thật là licenses/{key} (owner KHÔNG sửa được -> không tự kích hoạt khống).
async function checkLicense(tid) {
  try {
    const tsnap = await db.collection('tenants').doc(tid).get();
    const key = tsnap.exists ? (tsnap.data().licenseKey || null) : null;
    if (!key) return { valid: false, reason: 'Chưa kích hoạt' };
    const lsnap = await db.collection('licenses').doc(key).get();
    if (!lsnap.exists) return { valid: false, reason: 'Key không tồn tại' };
    const d = lsnap.data();
    const today = new Date().toISOString().slice(0, 10);
    if (d.status === 'revoked') return { valid: false, reason: 'Key đã bị thu hồi' };
    if (d.activatedBy && d.activatedBy !== tid) return { valid: false, reason: 'Key đã dùng cho tài khoản khác' };
    if (d.expiresAt && d.expiresAt < today) return { valid: false, reason: 'License đã hết hạn (' + d.expiresAt + ')' };
    return { valid: true, maxSubUsers: d.maxSubUsers || 0, expiresAt: d.expiresAt || null, plan: d.plan || '' };
  } catch (e) {
    console.error('[License] checkLicense error:', e);
    return { valid: false, reason: 'Lỗi kiểm tra license' };
  }
}
async function activateLicense(key) {
  key = (key || '').trim();
  if (!key) throw new Error('Vui lòng nhập key.');
  const lref = db.collection('licenses').doc(key);
  const lsnap = await lref.get();
  if (!lsnap.exists) throw new Error('Key không tồn tại.');
  const d = lsnap.data();
  const today = new Date().toISOString().slice(0, 10);
  if (d.status === 'revoked') throw new Error('Key đã bị thu hồi.');
  if (d.activatedBy && d.activatedBy !== tenantId) throw new Error('Key đã được dùng cho tài khoản khác.');
  if (d.expiresAt && d.expiresAt < today) throw new Error('Key đã hết hạn (' + d.expiresAt + ').');
  await lref.set({ activatedBy: tenantId, activatedAt: new Date().toISOString(), status: 'active' }, { merge: true });
  await db.collection('tenants').doc(tenantId).set({ licenseKey: key }, { merge: true });
  if (currentUser) currentUser.maxSubUsers = d.maxSubUsers || 0;
  return { maxSubUsers: d.maxSubUsers || 0, expiresAt: d.expiresAt || null };
}
function injectLicenseOverlay() {
  if (typeof document === 'undefined' || document.getElementById('license-overlay')) return;
  const ov = document.createElement('div');
  ov.id = 'license-overlay';
  ov.style.cssText = 'position:fixed;inset:0;z-index:99998;display:none;align-items:center;justify-content:center;background:#0b0f19;font-family:Inter,sans-serif;';
  ov.innerHTML = '<div id="license-card" style="background:rgba(17,24,39,0.9);border:1px solid rgba(255,255,255,0.08);border-radius:20px;padding:2.5rem;width:90%;max-width:440px;text-align:center;"></div>';
  document.body.appendChild(ov);
}
function showLicenseGate(mode, reason) {
  injectLicenseOverlay();
  const ov = document.getElementById('license-overlay');
  const card = document.getElementById('license-card');
  if (!ov || !card) return;
  if (mode === 'activate') {
    card.innerHTML =
      '<div style="font-size:2.2rem;color:#f59e0b;margin-bottom:0.5rem;"><i class="fa-solid fa-key"></i></div>' +
      '<h2 style="color:#fff;margin:0 0 0.3rem;font-size:1.3rem;">Kích hoạt phần mềm</h2>' +
      '<p style="color:#94a3b8;font-size:0.85rem;margin:0 0 1.2rem;">' + (reason ? reason + '. ' : '') + 'Nhập mã kích hoạt (key) để sử dụng.</p>' +
      '<input id="license-key" placeholder="Nhập key..." style="width:100%;box-sizing:border-box;padding:0.7rem;border-radius:10px;border:1px solid rgba(255,255,255,0.12);background:rgba(0,0,0,0.3);color:#fff;margin-bottom:0.8rem;">' +
      '<div id="license-err" style="display:none;color:#fca5a5;font-size:0.82rem;margin-bottom:0.8rem;"></div>' +
      '<button id="license-btn" onclick="smActivate()" style="width:100%;padding:0.8rem;border:none;border-radius:10px;background:linear-gradient(135deg,#3b82f6,#1d4ed8);color:#fff;font-weight:600;cursor:pointer;">Kích hoạt</button>' +
      '<p style="margin-top:1rem;"><a href="#" onclick="signOutApp();return false;" style="color:#64748b;font-size:0.8rem;">Đăng xuất</a></p>';
  } else {
    card.innerHTML =
      '<div style="font-size:2.2rem;color:#ef4444;margin-bottom:0.5rem;"><i class="fa-solid fa-lock"></i></div>' +
      '<h2 style="color:#fff;margin:0 0 0.3rem;font-size:1.3rem;">Chưa thể truy cập</h2>' +
      '<p style="color:#94a3b8;font-size:0.9rem;margin:0 0 1.2rem;">' + (reason || 'Công ty chưa kích hoạt hoặc đã hết hạn') + '. Vui lòng liên hệ chủ tài khoản.</p>' +
      '<button onclick="signOutApp()" style="width:100%;padding:0.8rem;border:none;border-radius:10px;background:#334155;color:#fff;font-weight:600;cursor:pointer;">Đăng xuất</button>';
  }
  ov.style.display = 'flex';
}
function hideLicenseGate() { const ov = (typeof document !== 'undefined') && document.getElementById('license-overlay'); if (ov) ov.style.display = 'none'; }
function smActivate() {
  const key = (document.getElementById('license-key') || {}).value;
  const err = document.getElementById('license-err');
  const btn = document.getElementById('license-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Đang kích hoạt...'; }
  activateLicense(key)
    .then(() => proceedAfterLicense())
    .catch(e => { if (err) { err.textContent = e.message || e; err.style.display = 'block'; } })
    .finally(() => { if (btn) { btn.disabled = false; btn.textContent = 'Kích hoạt'; } });
}
if (typeof window !== 'undefined') window.smActivate = smActivate;

// Tra users/{uid} -> tenantId + role + permissions. Lần đầu (chưa có doc) = OWNER, tự bootstrap.
async function resolveTenantAndRole(user) {
  const uref = db.collection('users').doc(user.uid);
  const snap = await uref.get();
  if (snap.exists) {
    const d = snap.data() || {};
    if (d.active === false) return { blocked: true };
    return { tenantId: d.tenantId || user.uid, role: d.role || 'sub', permissions: d.permissions || {}, vesselIds: d.vesselIds || [] };
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
  return { tenantId: user.uid, role: 'owner', permissions: perms, vesselIds: [] };
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
async function smAddSubUser(email, password, permissions, opts) {
  if (!currentUser || currentUser.role !== 'owner') throw new Error('Chỉ chủ tài khoản mới thêm được người dùng.');
  opts = opts || {};
  const role = (opts.role === 'accountant') ? 'accountant' : 'sub';
  const vesselIds = Array.isArray(opts.vesselIds) ? opts.vesselIds.filter(Boolean) : [];
  // Sub bắt buộc gán ít nhất 1 tàu (nếu không sẽ không thấy gì)
  if (role === 'sub' && vesselIds.length === 0) {
    throw new Error('Vui lòng gán ít nhất 1 tàu cho nhân viên (vai trò Sub).');
  }
  // Giới hạn số nhân viên theo license
  const max = currentUser.maxSubUsers || 0;
  if (max > 0) {
    const members = await smListMembers();
    const subCount = members.filter(m => m.role !== 'owner').length;
    if (subCount >= max) throw new Error('Đã đạt giới hạn ' + max + ' nhân viên của gói license. Nâng cấp để thêm.');
  }
  const secondary = firebase.initializeApp(firebaseConfig, 'Secondary-' + Date.now());
  try {
    const cred = await secondary.auth().createUserWithEmailAndPassword(email, password);
    const newUid = cred.user.uid;
    await db.collection('users').doc(newUid).set({
      tenantId: currentUser.tenantId, role: role, email: email,
      permissions: permissions || {}, vesselIds: vesselIds,
      active: true, createdAt: new Date().toISOString()
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

// ===== Audit log (nhật ký MỌI thay đổi) + Hoàn tác =====
// Ghi vào tenants/{tid}/auditLog kèm before/after để có thể hoàn tác.
const AUDIT_COLL_LABELS = {
  transactions: 'Giao dịch', fuelLogs: 'Chặng dầu', fuelVoyages: 'Chuyến dầu',
  shipments: 'Chuyến hàng', captainReports: 'Báo cáo thuyền trưởng',
  vesselExpenses: 'Chi phí tàu', timesheets: 'Bảng công'
};
const GROUPED_LABELS = {
  company: 'Thông tin công ty', vessels: 'Đội tàu', vendors: 'Nhà cung cấp',
  customers: 'Khách hàng', employees: 'Nhân viên', monthlyCosts: 'Chi phí tháng'
};
function auditSummary(coll, rec) {
  if (!rec) return '';
  switch (coll) {
    case 'transactions': return `${rec.content || ''} · ${rec.partner || ''} · Thu ${rec.thu || 0}/Chi ${rec.chi || 0}`;
    case 'fuelLogs': return `${rec.startPos || ''}→${rec.endPos || ''} · ĐM ${rec.fuelRate || 0}L/h · ${rec.hours || 0}h`;
    case 'fuelVoyages': return `Chuyến ${rec.voyageNo || ''} · Tiếp ${rec.addedFuel || 0}L · ĐG ${rec.fuelUnitPrice || 0}`;
    case 'shipments': return `${rec.voyageNo || ''} · ${rec.customer || ''} · ${rec.cargo || ''}`;
    case 'captainReports': return `${rec.vesselId || ''} ${rec.month || ''}`;
    case 'vesselExpenses': return `${rec.category || rec.content || ''} · ${rec.amount || 0}`;
    default: return rec.id || '';
  }
}
// Ghi 1 mảng audit entries vào auditLog (gọi trong pushDiff sau khi commit dữ liệu)
async function writeAuditEntries(entries) {
  if (!db || !tenantId || !currentUser || !entries.length) return;
  const meta = { userEmail: currentUser.email || '', uid: currentUser.uid, at: new Date().toISOString() };
  for (let i = 0; i < entries.length; i += 400) {
    const batch = db.batch();
    entries.slice(i, i + 400).forEach((e, k) => {
      const id = 'AL' + Date.now() + '_' + (i + k) + Math.random().toString(36).slice(2, 6);
      batch.set(tenantRoot().collection('auditLog').doc(id), Object.assign({}, e, meta));
    });
    await batch.commit();
  }
}
// Hoàn tác 1 thay đổi: khôi phục "before"
async function smUndo(auditId) {
  if (!db || !tenantId) throw new Error('Chưa kết nối.');
  const ref = tenantRoot().collection('auditLog').doc(auditId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error('Không tìm thấy mục nhật ký.');
  const e = snap.data();
  if (e.undone) throw new Error('Mục này đã được hoàn tác.');
  if (e.grouped) {
    const before = e.before || {};
    Object.keys(before).forEach(k => {
      if (!k.startsWith('_') && !SM3.perRecord.includes(k)) AppData.state[k] = before[k];
    });
  } else if (e.coll && e.recordId) {
    const arr = AppData.state[e.coll] || (AppData.state[e.coll] = []);
    const idx = arr.findIndex(x => x && String(x.id) === String(e.recordId));
    if (e.before) { if (idx >= 0) arr[idx] = e.before; else arr.push(e.before); }
    else { if (idx >= 0) arr.splice(idx, 1); }   // before null = vốn là "thêm mới" -> hoàn tác = xóa
  } else {
    throw new Error('Mục này không hỗ trợ hoàn tác.');
  }
  AppData.save();                                  // đồng bộ thay đổi (sẽ tự ghi 1 audit mới cho lần hoàn tác)
  await ref.set({ undone: true, undoneAt: new Date().toISOString() }, { merge: true });
}
async function smListAudit(max) {
  if (!db || !tenantId) return [];
  // Defense-in-depth: nhật ký chứa before/after lương -> chỉ owner/accountant.
  // Rules đã chặn read phía server; chặn thêm ở client để không gọi thừa + không lỗi console cho sub.
  if (!isFinanceRole()) return [];
  try {
    const snap = await tenantRoot().collection('auditLog').get();
    const items = snap.docs.map(d => Object.assign({ _id: d.id }, d.data()));
    items.sort((a, b) => (b.at || '').localeCompare(a.at || ''));
    return items.slice(0, max || 50);
  } catch (e) { return []; }
}
if (typeof window !== 'undefined') {
  window.smListAudit = smListAudit;
  window.smUndo = smUndo;
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
        <div style="display:flex;justify-content:center;margin-bottom:0.8rem;">
          <div style="width:115px;height:115px;display:flex;align-items:center;justify-content:center;overflow:hidden;">
            <img src="logo.png" alt="VesselFil Logo" style="width:100%;height:100%;object-fit:contain;">
          </div>
        </div>
        <h2 style="color:#fff;margin:0;font-size:1.4rem;font-weight:700;">VesselFil (VEF) Pro</h2>
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
  runMigrationIfNeeded().then(() => migrateGroupedSplitIfNeeded());
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
    const auditEntries = [];        // nhật ký kèm before/after để hoàn tác

    // 1) GROUPED — tách public/private theo độ nhạy cảm (task #17).
    //    Sub chỉ ghi doc public; lương/số dư đi vào doc private (chỉ finance, rules chặn server-side).
    const curGrouped = buildGrouped();
    if (!isFinanceRole()) {
      SM3.groupedPrivateKeys.forEach(k => { delete curGrouped[k]; });
    }
    const groupedStr = groupedSyncBasis();
    let publicToWrite = null, privateToWrite = null;
    if (groupedStr !== lastSynced.grouped) {
      const nowG = new Date().toISOString();
      publicToWrite = buildGroupedPublic();
      publicToWrite._groupedUpdatedAt = nowG;
      if (isFinanceRole()) {
        privateToWrite = buildGroupedPrivate();
        privateToWrite._groupedUpdatedAt = nowG;
      }
      changedAnything = true;
      // audit cho thay đổi master data (gộp)
      let gBefore = null; try { gBefore = lastSynced.grouped ? JSON.parse(lastSynced.grouped) : null; } catch (e) {}
      const changedKeys = Object.keys(curGrouped).filter(k =>
        JSON.stringify(curGrouped[k]) !== JSON.stringify(gBefore ? gBefore[k] : undefined));
      auditEntries.push({
        grouped: true, action: 'edit', before: gBefore,
        summary: 'Cập nhật ' + (changedKeys.map(k => GROUPED_LABELS[k] || k).join(', ') || 'thông tin chung')
      });
    }

    // 2) PER-RECORD
    SM3.perRecord.forEach(coll => {
      // Vai trò không có quyền -> không đẩy gì, không tính delete (vì local không có dữ liệu này)
      if (!canSyncCollection(coll)) return;
      const arr = AppData.state[coll] || [];
      const last = lastSynced.records[coll] || (lastSynced.records[coll] = new Map());
      const seen = new Set();

      arr.forEach(rec => {
        if (!rec || rec.id == null) return;
        const id = String(rec.id);
        seen.add(id);
        const prevStr = last.get(id);
        const cur = JSON.stringify(rec);
        if (prevStr !== cur) {
          const before = prevStr ? JSON.parse(prevStr) : null;
          // có thay đổi -> đóng dấu updatedAt rồi ghi
          rec.updatedAt = new Date().toISOString();
          const data = Object.assign({}, rec);
          ops.push({ type: 'set', coll, id, data });
          pendingLast.push({ coll, id, str: JSON.stringify(rec) });
          changedAnything = true;
          auditEntries.push({
            coll: coll, recordId: id, action: before ? 'edit' : 'add',
            before: before, after: Object.assign({}, rec),
            summary: (before ? 'Sửa ' : 'Thêm ') + (AUDIT_COLL_LABELS[coll] || coll) + ': ' + auditSummary(coll, rec)
          });
        }
      });

      // bản ghi bị xoá local -> xoá trên cloud
      for (const id of Array.from(last.keys())) {
        if (!seen.has(id)) {
          const before = (() => { try { return JSON.parse(last.get(id)); } catch (e) { return null; } })();
          ops.push({ type: 'delete', coll, id });
          pendingLast.push({ coll, id, str: null });
          changedAnything = true;
          auditEntries.push({
            coll: coll, recordId: id, action: 'delete', before: before, after: null,
            summary: 'Xóa ' + (AUDIT_COLL_LABELS[coll] || coll) + ': ' + auditSummary(coll, before)
          });
        }
      }
    });

    if (!changedAnything) {
      updateServerStatus('online', 'Đã đồng bộ đám mây');
      return;
    }

    // Lưu lại localStorage để các dấu updatedAt vừa đóng được giữ ở local
    originalSave();

    // 3) Commit lên Firestore.
    //    Doc public dùng FULL set (không merge) -> tự xóa sạch key private cũ còn sót trong doc gộp.
    if (publicToWrite) {
      await groupedDocRef().set(publicToWrite);
    }
    if (privateToWrite) {
      await groupedPrivateRef().set(privateToWrite);
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
    if (publicToWrite || privateToWrite) lastSynced.grouped = groupedSyncBasis();
    pendingLast.forEach(p => {
      const last = lastSynced.records[p.coll] || (lastSynced.records[p.coll] = new Map());
      if (p.str === null) last.delete(p.id);
      else last.set(p.id, p.str);
    });

    // 5) Ghi nhật ký (sau khi dữ liệu đã commit). Không chặn nếu lỗi.
    try { await writeAuditEntries(auditEntries); } catch (e) { console.warn('[Audit] lỗi ghi nhật ký:', e); }

    updateServerStatus('online', 'Đã đồng bộ đám mây');
  } catch (err) {
    handleSyncError(err, 'pushDiff');
  }
}

// ---------------------------------------------------------------
// ĐỌC: lắng nghe theo collection, merge theo id
// ---------------------------------------------------------------
function attachListeners() {
  // ===== GROUPED — luôn listen doc gộp cũ (cho tương thích ngược) =====
  groupedDocRef().onSnapshot(doc => {
    if (!doc.exists) return;
    const data = doc.data() || {};
    suppressPush = true;
    Object.keys(data).forEach(k => {
      if (k.startsWith('_')) return;
      if (SM3.perRecord.includes(k)) return;
      // Phòng vệ: bỏ qua key private nếu doc public cũ còn sót (trước khi dọn tách).
      if (SM3.groupedPrivateKeys.includes(k)) return;
      // annualCosts (chi phí năm) chỉ thêm/sửa theo (năm+tàu), KHÔNG có xóa -> GỘP theo khóa
      // để snapshot cũ (thiếu tàu vừa lưu) KHÔNG ghi đè làm mất cấu hình tàu khác.
      if (k === 'annualCosts' && typeof AppData.mergeAnnualCosts === 'function') {
        AppData.state[k] = AppData.mergeAnnualCosts(AppData.state[k], data[k]);
      } else {
        AppData.state[k] = data[k];
      }
    });
    lastSynced.grouped = groupedSyncBasis();
    originalSave();
    suppressPush = false;
    updateServerStatus('online', 'Đã đồng bộ đám mây');
    scheduleRerender();
  }, err => handleSyncError(err, 'grouped.onSnapshot'));

  // ===== GROUPED PRIVATE (lương + số dư đầu kỳ) — chỉ owner/accountant mới listen =====
  if (isFinanceRole()) {
    groupedPrivateRef().onSnapshot(doc => {
      if (!doc.exists) return;
      const data = doc.data() || {};
      suppressPush = true;
      SM3.groupedPrivateKeys.forEach(k => { if (data[k] !== undefined) AppData.state[k] = data[k]; });
      if (data._companyOpeningBalances !== undefined) {
        if (!AppData.state.company) AppData.state.company = {};
        AppData.state.company.openingBalances = data._companyOpeningBalances;
      }
      lastSynced.grouped = groupedSyncBasis();
      originalSave();
      suppressPush = false;
      updateServerStatus('online', 'Đã đồng bộ đám mây');
      scheduleRerender();
      // Fix#3: monthlyCosts (chi phí tháng) thay đổi -> tính lại phân bổ cho chuyến
      scheduleRecalcAfterSync();
    }, err => handleSyncError(err, 'groupedPrivate.onSnapshot'));
  }

  // PER-RECORD — theo vai trò + filter vesselId cho sub
  SM3.perRecord.forEach(coll => {
    if (!canSyncCollection(coll)) {
      console.log('[Perm] Bỏ qua listener', coll, '(vai trò không có quyền)');
      return;                                          // KHÔNG đăng ký listener -> dữ liệu KHÔNG về máy
    }
    let query = recColl(coll);
    // Sub: chỉ tải bản ghi thuộc tàu mình
    if (!isFinanceRole() && SM3.operationalPerRecord.includes(coll)) {
      const vids = userVesselIds();
      if (vids.length === 0) return;
      try { query = recColl(coll).where('vesselId', 'in', vids.slice(0, 10)); }
      catch (e) { console.warn('[Perm] where vesselId in lỗi:', e); return; }
    }
    query.onSnapshot(snap => {
      updateServerStatus('online', 'Đã đồng bộ đám mây');
      suppressPush = true;
      let touched = false;
      snap.docChanges().forEach(ch => {
        const id = ch.doc.id;
        if (ch.type === 'removed') applyRemoteRecord(coll, id, null, true);
        else applyRemoteRecord(coll, id, ch.doc.data(), false);
        touched = true;
      });
      if (touched) originalSave();
      suppressPush = false;
      if (touched) scheduleRerender();
      // Fix#3: giao dịch / báo cáo TT thay đổi -> tính lại phân bổ dẫn xuất cho đúng
      if (touched && (coll === 'transactions' || coll === 'captainReports')) scheduleRecalcAfterSync();
    }, err => handleSyncError(err, recordsColl(coll) + '.onSnapshot'));
  });
}

// Áp dụng 1 thay đổi từ cloud vào state local.
// Thuật toán: field-level merge dùng baseline (lastSynced) làm tổ tiên chung.
//   - Trường chỉ đổi ở local  → giữ local
//   - Trường chỉ đổi ở remote → lấy remote
//   - Trường cả 2 cùng đổi khác nhau → remote thắng (server-wins), ghi cảnh báo
// Nếu không có baseline (record mới hoàn toàn) → dùng newest-wins như cũ.
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

  // Thử field-level merge nếu có cả local lẫn baseline (tổ tiên chung)
  // Chỉ merge khi remote KHÔNG cũ hơn local (nếu remote cũ hơn rõ ràng -> newest-wins như cũ).
  if (local && last.has(sid)) {
    let baseline;
    try { baseline = JSON.parse(last.get(sid)); } catch (e) { baseline = null; }
    const localNewer = local.updatedAt && data.updatedAt && local.updatedAt > data.updatedAt;

    if (baseline && !localNewer) {
      const merged = {};
      const allKeys = new Set([
        ...Object.keys(baseline),
        ...Object.keys(local),
        ...Object.keys(data)
      ]);
      const conflicts = [];

      for (const k of allKeys) {
        const bStr = JSON.stringify(baseline[k]);
        const lStr = JSON.stringify(local[k]);
        const rStr = JSON.stringify(data[k]);
        const localChanged  = lStr !== bStr;
        const remoteChanged = rStr !== bStr;

        if (localChanged && remoteChanged && lStr !== rStr) {
          // Xung đột thật: cả 2 sửa khác nhau -> remote thắng (đã được server commit)
          merged[k] = data[k];
          conflicts.push(k);
        } else if (localChanged) {
          merged[k] = local[k];   // chỉ local đổi -> giữ local
        } else {
          merged[k] = data[k];    // remote đổi hoặc không ai đổi -> lấy remote
        }
      }

      // updatedAt lấy bản mới hơn
      merged.updatedAt = (data.updatedAt || '') > (local.updatedAt || '')
        ? data.updatedAt : local.updatedAt;

      if (conflicts.length) {
        console.warn('[Sync] Xung đột merge tự động (server-wins):', coll, sid,
          '| trường xung đột:', conflicts.join(', '));
      }

      if (idx >= 0) arr[idx] = merged; else arr.push(merged);
      last.set(sid, JSON.stringify(merged));
      // Nếu có field local thắng -> đánh dấu để đẩy lại lên cloud
      const hasLocalWins = Array.from(allKeys).some(k => {
        const bStr = JSON.stringify(baseline[k]);
        const lStr = JSON.stringify(local[k]);
        const rStr = JSON.stringify(data[k]);
        return lStr !== bStr && lStr !== rStr;
      });
      if (hasLocalWins) last.delete(sid);  // kích pushDiff ở lần save() tiếp theo
      return;
    }
  }

  // Fallback: không có baseline (record mới) -> newest-wins đơn giản
  if (local && local.updatedAt && data.updatedAt && data.updatedAt < local.updatedAt) {
    last.delete(sid); // buộc đẩy lại bản local mới hơn
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

    // GROUPED — tách public/private ngay từ migration (task #17)
    const nowIso = new Date().toISOString();
    const pub = buildGroupedPublic();
    pub._groupedUpdatedAt = nowIso;
    pub._migratedAt = nowIso;
    await ref.set(pub);
    if (isFinanceRole()) {
      const priv = buildGroupedPrivate();
      priv._groupedUpdatedAt = nowIso;
      priv._migratedAt = nowIso;
      await groupedPrivateRef().set(priv);
    }
    lastSynced.grouped = groupedSyncBasis();

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

// Dọn rò rỉ cho tenant ĐÃ migrate TRƯỚC khi tách public/private (task #17):
// nếu doc private chưa tồn tại -> tạo từ state + ghi đè doc public sạch (xóa lương còn sót).
// Chỉ owner/accountant chạy được (rules chỉ cho finance ghi doc private).
async function migrateGroupedSplitIfNeeded() {
  try {
    if (!isFinanceRole()) return;
    const privRef = groupedPrivateRef();
    const privSnap = await privRef.get();
    if (privSnap.exists) return;                       // đã tách trước đó

    const pubSnap = await groupedDocRef().get();
    const pubData = pubSnap.exists ? (pubSnap.data() || {}) : {};
    const hasLegacyPrivate = SM3.groupedPrivateKeys.some(k => pubData[k] !== undefined)
      || (pubData.company && pubData.company.openingBalances !== undefined);

    const nowIso = new Date().toISOString();
    const priv = buildGroupedPrivate();
    priv._groupedUpdatedAt = nowIso;
    priv._splitAt = nowIso;
    await privRef.set(priv);

    if (!pubSnap.exists || hasLegacyPrivate) {
      const pub = buildGroupedPublic();               // FULL set -> xóa key private còn sót
      pub._groupedUpdatedAt = nowIso;
      await groupedDocRef().set(pub);
    }
    lastSynced.grouped = groupedSyncBasis();
    console.log('[Sync V3] Đã tách grouped public/private (vá rò rỉ lương #17).');
  } catch (e) {
    console.warn('[Sync V3] migrateGroupedSplit lỗi (sẽ thử lại lần sau):', e);
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
