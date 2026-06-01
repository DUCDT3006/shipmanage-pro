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
  apiKey: "AIzaSyAoAhYpcijQZ0Wgs8ZwtMmcyWX3-pf7jmQ",
  authDomain: "shipmanagevgt.firebaseapp.com",
  projectId: "shipmanagevgt",
  storageBucket: "shipmanagevgt.firebasestorage.app",
  messagingSenderId: "266936765184",
  appId: "1:266936765184:web:52abed9b1caa12ffaec1e5",
  measurementId: "G-P5N1346GZS"
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
      setupHybridSync();
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
function recordsColl(collection) { return SM3.prefix + collection; }

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
      await db.collection(SM3.groupedCollection).doc(SM3.groupedDocId)
              .set(groupedToWrite, { merge: true });
    }
    for (let i = 0; i < ops.length; i += 450) {
      const batch = db.batch();
      ops.slice(i, i + 450).forEach(op => {
        const ref = db.collection(recordsColl(op.coll)).doc(op.id);
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
  db.collection(SM3.groupedCollection).doc(SM3.groupedDocId).onSnapshot(doc => {
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
    scheduleRerender();
  }, err => handleSyncError(err, 'grouped.onSnapshot'));

  // PER-RECORD
  SM3.perRecord.forEach(coll => {
    db.collection(recordsColl(coll)).onSnapshot(snap => {
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
    const ref = db.collection(SM3.groupedCollection).doc(SM3.groupedDocId);
    const snap = await ref.get();
    if (snap.exists) {
      console.log('[Sync V3] Layout v3 đã tồn tại trên cloud — bỏ qua migration.');
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
          batch.set(db.collection(recordsColl(coll)).doc(String(rec.id)), Object.assign({}, rec));
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
