/**
 * State Management & LocalStorage Mock Database - V2.0
 */

const hasFontError = (str) => {
    if (!str) return false;
    return /[\u00c3\u00c4\u00c6\u00bb\u00ba\u00bd\u00be\u00bf]/.test(str);
};

const fixMojibake = (str) => {
    if (!str) return str;
    try {
        if (hasFontError(str)) {
            const bytes = new Uint8Array(str.split('').map(c => c.charCodeAt(0)));
            const decoded = new TextDecoder('utf-8').decode(bytes);
            if (decoded && !decoded.includes('\ufffd') && decoded.trim() !== '') {
                return decoded;
            }
        }
    } catch (e) {}
    return str;
};

// Escape HTML để chống XSS khi nhúng dữ liệu người dùng vào template (innerHTML)
function esc(s) {
    if (s === null || s === undefined) return '';
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const correctVendors = [
    { name: 'Petrolimex', type: 'Dầu DO/LO', contact: '0987654321', address: 'Hải Phòng' },
    { name: 'Cảng Chân Mây', type: 'Cảng', contact: '0987654322', address: 'Huế' },
    { name: 'Lê Phạm', type: 'Đối tác giao dịch', contact: '---', address: '---' },
    { name: 'Sunshine', type: 'Đối tác giao dịch', contact: '---', address: '---' },
    { name: 'Sông Hậu', type: 'Đối tác giao dịch', contact: '---', address: '---' },
    { name: 'Quốc Tế Xanh', type: 'Đối tác giao dịch', contact: '---', address: '---' },
    { name: 'Hoàng Đăng', type: 'Đối tác giao dịch', contact: '---', address: '---' },
    { name: 'Alberta', type: 'Đối tác giao dịch', contact: '---', address: '---' },
    { name: 'Công ty Đại Dương', type: 'Đối tác giao dịch', contact: '---', address: '---' },
    { name: 'Petrotime', type: 'Đối tác giao dịch', contact: '---', address: '---' },
    { name: 'Hoàng Khải', type: 'Đối tác giao dịch', contact: '---', address: '---' },
    { name: 'Nhất Minh Sơn', type: 'Đối tác giao dịch', contact: '---', address: '---' },
    { name: 'Long Bình', type: 'Đối tác giao dịch', contact: '---', address: '---' },
    { name: 'Sơn HP', type: 'Đối tác giao dịch', contact: '---', address: '---' },
    { name: 'Công ty Tấn My', type: 'Đối tác giao dịch', contact: '---', address: '---' },
    { name: 'Pvoil Đà Nẵng', type: 'Đối tác giao dịch', contact: '---', address: '---' },
    { name: 'PV Oil miền trung', type: 'Đối tác giao dịch', contact: '---', address: '---' },
    { name: 'Hồng Vân', type: 'Đối tác giao dịch', contact: '---', address: '---' },
    { name: 'Hồng Minh', type: 'Đối tác giao dịch', contact: '---', address: '---' }
];

const correctCustomers = [
    { name: 'Ngọc Anh', contact: '---', address: '---' },
    { name: 'Hoàng Quyên', contact: '---', address: '---' },
    { name: 'Bình Minh', contact: '---', address: '---' },
    { name: 'Thái Bình Dương', contact: '---', address: '---' },
    { name: 'Việt Anh', contact: '---', address: '---' }
];

// DEFAULT_STATE đã chuyển sang js/seed-data.js (nạp trước file này).

const DB_KEY = 'shipManageDB_v2';

// ===== SMStore: lưu trữ local bằng IndexedDB (task #21) =====
// IDB không bị trần 5MB như localStorage và ghi BẤT ĐỒNG BỘ (không chặn luồng giao diện).
// Vẫn giữ localStorage làm cache khởi động nhanh (best-effort, try/catch chống tràn quota).
const SMStore = (() => {
    let dbp = null;
    function open() {
        if (dbp) return dbp;
        dbp = new Promise((resolve) => {
            let settled = false;
            const done = (v) => { if (!settled) { settled = true; resolve(v); } };
            try {
                if (typeof indexedDB === 'undefined') return done(null);
                const req = indexedDB.open('shipmanage_db', 1);
                req.onupgradeneeded = () => { try { req.result.createObjectStore('kv'); } catch (e) {} };
                req.onsuccess = () => done(req.result);
                req.onerror = () => done(null);
                // Safari (đặc biệt chế độ riêng tư) đôi khi open() treo không phát onsuccess/onerror,
                // hoặc bị 'blocked' -> dùng timeout để fallback về localStorage thay vì treo app.
                req.onblocked = () => done(null);
                setTimeout(() => done(null), 3000);
            } catch (e) { done(null); }
        });
        return dbp;
    }
    return {
        get(key) {
            // Tạo transaction + đọc trong CÙNG khối đồng bộ (tránh TransactionInactiveError)
            return open().then(db => db ? new Promise(res => {
                try {
                    const t = db.transaction('kv', 'readonly');
                    const r = t.objectStore('kv').get(key);
                    r.onsuccess = () => res(r.result);
                    r.onerror = () => res(undefined);
                } catch (e) { res(undefined); }
            }) : undefined).catch(() => undefined);
        },
        set(key, val) {
            return open().then(db => { if (!db) return;
                return new Promise(res => {
                    try {
                        const t = db.transaction('kv', 'readwrite');
                        t.objectStore('kv').put(val, key);   // put NGAY sau khi tạo tx (cùng task)
                        t.oncomplete = () => res();
                        t.onerror = () => res();
                        t.onabort = () => res();
                    } catch (e) { res(); }
                });
            }).catch(() => {});
        }
    };
})();

const AppData = {
    state: null,

    init() {
        const stored = localStorage.getItem(DB_KEY);
        if (stored) {
            try {
                this.state = JSON.parse(stored);

                
                // === Transaction Safety Migration v276 ===
                if (!localStorage.getItem('tx_merge_v276')) {
                    try {
                        const existingIds = new Set((this.state.transactions || []).map(t => t.id));
                        let added = 0;
                        (DEFAULT_STATE.transactions || []).forEach(t => {
                            if (!existingIds.has(t.id)) {
                                this.state.transactions.push(t);
                                existingIds.add(t.id);
                                added++;
                            }
                        });
                        if (added > 0) {
                            console.log('[Migration] Added', added, 'missing transactions from DEFAULT_STATE');
                            this.save();
                        }
                    } catch(e) { console.warn('[Migration] tx_merge_v276 error:', e); }
                    localStorage.setItem('tx_merge_v276', '1');
                }
                // === End Transaction Safety Migration ===

if (!localStorage.getItem('allowances_extracted_v6')) {
                    const extractedAllowances = {"Lê Ngọc Ngọ":{"meal":2500000,"phone":400000,"clothing":2000000,"transport":0,"deliveryAllowance":4500000,"completionBonus":0},"Vũ Đức Ngọ":{"meal":2500000,"phone":400000,"clothing":2000000,"transport":0,"deliveryAllowance":4500000,"completionBonus":0},"Bùi Thị Phương":{"meal":2000000,"phone":400000,"clothing":2000000,"transport":0,"deliveryAllowance":5200000,"completionBonus":0},"Nguyễn Thị Nhị":{"meal":1500000,"phone":400000,"clothing":2000000,"transport":0,"deliveryAllowance":3900000,"completionBonus":0},"Hoàng Thị Diệp Linh":{"meal":1500000,"phone":400000,"clothing":2000000,"transport":0,"deliveryAllowance":3900000,"completionBonus":0},"Lương Thị Bích Hằng":{"meal":1500000,"phone":400000,"clothing":2000000,"transport":0,"deliveryAllowance":3900000,"completionBonus":0},"Vũ Ngọc Vĩnh":{"meal":1500000,"phone":400000,"clothing":2000000,"transport":0,"deliveryAllowance":4550000,"completionBonus":0},"Phạm Ngọc Tùng":{"meal":1500000,"phone":400000,"clothing":2000000,"transport":0,"deliveryAllowance":4550000,"completionBonus":0},"Lê Ngọc Huế":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":10500000,"deliveryAllowance":9000000,"completionBonus":0},"Lê Duy Anh":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":7500000,"deliveryAllowance":6000000,"completionBonus":0},"Lưu Quang Trường":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":7500000,"deliveryAllowance":6000000,"completionBonus":0},"Vũ Đức Trọng":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":6600000,"deliveryAllowance":5400000,"completionBonus":0},"Nguyễn Xuân Toàn":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":7500000,"deliveryAllowance":6000000,"completionBonus":0},"Nguyễn Văn Tú":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":6600000,"deliveryAllowance":5400000,"completionBonus":0},"Lê Đức Mừng":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":4500000,"deliveryAllowance":3000000,"completionBonus":0},"Nguyễn Trọng Dương":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":4500000,"deliveryAllowance":3000000,"completionBonus":0},"Vũ Đức An":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":4500000,"deliveryAllowance":3000000,"completionBonus":0},"Nguyễn Trọng Vũ":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":4500000,"deliveryAllowance":3000000,"completionBonus":0},"Nguyễn Đức Giang":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":4500000,"deliveryAllowance":3100000,"completionBonus":0},"Nguyễn Hữu Quyết":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":4500000,"deliveryAllowance":3000000,"completionBonus":0},"Tạ Quang Hợp":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":7000000,"deliveryAllowance":6000000,"completionBonus":0},"Lê Ngọc Hoàng":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":5000000,"deliveryAllowance":4000000,"completionBonus":0},"Nguyễn Trọng Vinh":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":5000000,"deliveryAllowance":4000000,"completionBonus":0},"Bùi Đình Thịnh":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":5600000,"deliveryAllowance":4600000,"completionBonus":0},"Tạ Duy Trưởng":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":5000000,"deliveryAllowance":4400000,"completionBonus":0},"Nguyễn Văn Danh":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":4400000,"deliveryAllowance":3600000,"completionBonus":0},"Lê Duy Tới":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":3000000,"deliveryAllowance":2000000,"completionBonus":0},"Nguyễn Đức Huy":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":3000000,"deliveryAllowance":2000000,"completionBonus":0},"Lê Ngọc Hà":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":3000000,"deliveryAllowance":2000000,"completionBonus":0},"Đinh Ngọc Hà":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":3400000,"deliveryAllowance":2400000,"completionBonus":0},"Nguyễn Đức Dũng":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":3000000,"deliveryAllowance":2000000,"completionBonus":0},"Nguyễn Dương Thân":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":3000000,"deliveryAllowance":2000000,"completionBonus":0},"Lê Bá Thạo":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":3000000,"deliveryAllowance":2000000,"completionBonus":0},"Tạ Quang Đức":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":12000000,"deliveryAllowance":10200000,"completionBonus":0},"Nguyễn Trường Giang":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":10500000,"deliveryAllowance":8000000,"completionBonus":0},"Nguyễn Trọng Hồng":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":9000000,"deliveryAllowance":7500000,"completionBonus":0},"Vũ Đình Đại":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":8100000,"deliveryAllowance":5850000,"completionBonus":0},"Lê Văn Cường":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":8100000,"deliveryAllowance":5700000,"completionBonus":0},"Lê Mạnh Hùng":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":8100000,"deliveryAllowance":5850000,"completionBonus":0},"Vũ Đức Thắng":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":4500000,"deliveryAllowance":3000000,"completionBonus":0},"Lê Ngọc Cung":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":4500000,"deliveryAllowance":3000000,"completionBonus":0},"Lê Văn Cường(QB)":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":4500000,"deliveryAllowance":3000000,"completionBonus":0},"Lê Ngọc Hoa":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":4500000,"deliveryAllowance":3000000,"completionBonus":0},"Nguyễn Trọng Tuấn Anh":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":4500000,"deliveryAllowance":3000000,"completionBonus":0},"Lương Anh Tuấn":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":4500000,"deliveryAllowance":3000000,"completionBonus":0},"Lê Văn Thắng":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":4500000,"deliveryAllowance":3000000,"completionBonus":0},"Trần Văn Phiến":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":4500000,"deliveryAllowance":3000000,"completionBonus":0},"CỘNG SX":{"meal":35000000,"phone":5600000,"clothing":35000000,"transport":91800000,"deliveryAllowance":67100000,"completionBonus":0},"Lại Xuân Kiều":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":7000000,"deliveryAllowance":6000000,"completionBonus":0},"Nguyễn Xuân Soái":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":5600000,"deliveryAllowance":4600000,"completionBonus":0},"Phạm Văn Long":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":5000000,"deliveryAllowance":4000000,"completionBonus":0},"Nguyễn Trọng Hiếu":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":5000000,"deliveryAllowance":4000000,"completionBonus":0},"Bùi Thế Tuấn Anh":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":5000000,"deliveryAllowance":4000000,"completionBonus":0},"Vũ Hội":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":4400000,"deliveryAllowance":3600000,"completionBonus":0},"Trần Bá Trọng":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":4400000,"deliveryAllowance":3600000,"completionBonus":0},"Bùi Thế Tiến":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":3000000,"deliveryAllowance":2000000,"completionBonus":0},"Lê Ngọc Anh":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":3000000,"deliveryAllowance":2000000,"completionBonus":0},"Lại Xuân Hà":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":3000000,"deliveryAllowance":2000000,"completionBonus":0},"Phạm Văn Khiêm":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":3000000,"deliveryAllowance":2000000,"completionBonus":0},"Lê Xuân Hồng":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":3000000,"deliveryAllowance":2000000,"completionBonus":0},"Cộng":{"meal":27500000,"phone":4400000,"clothing":27500000,"transport":68700000,"deliveryAllowance":52800000,"completionBonus":0},"Lê Thân Thắng":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":10500000,"deliveryAllowance":9000000,"completionBonus":0},"Đỗ Hữu Xuần":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":7500000,"deliveryAllowance":6000000,"completionBonus":0},"Nguyễn Đức Hiền":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":7500000,"deliveryAllowance":6000000,"completionBonus":0},"Nguyễn Thái Bình":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":7500000,"deliveryAllowance":6000000,"completionBonus":0},"Bùi Đình Kha":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":6600000,"deliveryAllowance":5400000,"completionBonus":0},"Nguyễn Văn Bắc":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":4500000,"deliveryAllowance":3000000,"completionBonus":0},"Phạm Văn Tứ":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":4500000,"deliveryAllowance":3000000,"completionBonus":0},"Nguyễn Trọng Hậu":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":6600000,"deliveryAllowance":5400000,"completionBonus":0},"Đỗ Hữu Xoa":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":4500000,"deliveryAllowance":3000000,"completionBonus":0},"Nguyễn Văn Luân":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":4500000,"deliveryAllowance":3000000,"completionBonus":0},"Vũ Văn Cường":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":4500000,"deliveryAllowance":3000000,"completionBonus":0},"Tổng cộng":{"meal":169500000,"phone":28000000,"clothing":171000000,"transport":338500000,"deliveryAllowance":291600000,"completionBonus":0}};
                    
                    if (this.state.employees) {
                        this.state.employees.forEach(emp => {
                            let match = extractedAllowances[emp.name];
                            if (!match) {
                                if (emp.name.includes('Đỗ Hữu Xuân') && extractedAllowances['Đỗ Hữu Xuần']) match = extractedAllowances['Đỗ Hữu Xuần'];
                                else if (emp.name.includes('Đỗ Hữu Xuân') && extractedAllowances['Đỗ Hữu Xoa']) match = extractedAllowances['Đỗ Hữu Xoa'];
                            }
                            
                            if (match) {
                                emp.mealAllowance = match.meal;
                                emp.phoneAllowance = match.phone;
                                emp.clothingAllowance = match.clothing;
                                emp.transportAllowance = match.transport;
                                emp.deliveryAllowance = match.deliveryAllowance;
                                emp.completionBonus = match.completionBonus;
                            }
                        });
                    }
                    localStorage.setItem('allowances_extracted_v6', 'true');
                    this.save();
                }



                // Ensure employees exist
                if (!this.state.employees || this.state.employees.length === 0) {
                    this.state.employees = JSON.parse(JSON.stringify(DEFAULT_STATE.employees || []));
                    this.save();
                }
                if (!this.state.timesheets) {
                    this.state.timesheets = [];
                    this.save();
                }

                if (!localStorage.getItem('vg18_salaries_updated_v2')) {
                    const updates = {
                        "Tạ Quang Đức": { actualSalary: 30000000, insurance: 1102500 },
                        "Nguyễn Trọng Hồng": { actualSalary: 24000000, insurance: 798000 },
                        "Vũ Đình Đại": { actualSalary: 20000000, insurance: 798000 },
                        "Lê Ngọc Hoa": { actualSalary: 15000000, insurance: 525000 },
                        "Lê Văn Cường(QB)": { actualSalary: 15000000, insurance: 525000 },
                        "Lê Ngọc Cung": { actualSalary: 15000000, insurance: 525000 },
                        "Nguyễn Trường Giang": { actualSalary: 25000000, insurance: 798000 },
                        "Lê Văn Cường": { actualSalary: 21000000, insurance: 630000 },
                        "Lê Mạnh Hùng": { actualSalary: 20000000, insurance: 630000 },
                        "Nguyễn Trọng Tuấn Anh": { actualSalary: 16000000, insurance: 525000 },
                        "Trần Văn Phiến": { actualSalary: 15000000, insurance: 525000 },
                        "Lê Văn Thắng": { actualSalary: 15000000, insurance: 525000 }
                    };
                    
                    // Remove Lê Ngọc Vũ if it was added previously
                    this.state.employees = this.state.employees.filter(e => e.name !== "Lê Ngọc Vũ");

                    let foundNames = new Set();
                    
                    this.state.employees.forEach(emp => {
                        if (emp.department === 'VG18' && updates[emp.name]) {
                            emp.actualSalary = updates[emp.name].actualSalary;
                            emp.insurance = updates[emp.name].insurance;
                            foundNames.add(emp.name);
                        }
                    });
                    
                    Object.keys(updates).forEach(name => {
                        if (!foundNames.has(name)) {
                            this.state.employees.push({
                                id: 'EMP-' + Math.random().toString(36).substr(2, 9),
                                name: name,
                                role: "Nhân viên",
                                department: "VG18",
                                basicSalary: 5000000,
                                actualSalary: updates[name].actualSalary,
                                insurance: updates[name].insurance,
                                allowances: 0,
                                personalDeduction: 15500000,
                                dependents: 0,
                                joinDate: "", leaveDate: "", phone: "", notes: ""
                            });
                        }
                    });

                    localStorage.setItem('vg18_salaries_updated_v2', '1');
                    this.save();
                }

                if (!localStorage.getItem('vg09_salaries_updated')) {
                    const updates = {
                        "Lại Xuân Kiều": { actualSalary: 28000000, insurance: 1102500 },
                        "Phạm Văn Long": { actualSalary: 22000000, insurance: 798000 },
                        "Nguyễn Trọng Hiếu": { actualSalary: 20000000, insurance: 630000 },
                        "Lê Ngọc Anh": { actualSalary: 15000000, insurance: 525000 },
                        "Bùi Thế Tiến": { actualSalary: 15000000, insurance: 525000 },
                        "Lại Xuân Hà": { actualSalary: 15000000, insurance: 0 },
                        "Nguyễn Xuân Soái": { actualSalary: 23000000, insurance: 798000 },
                        "Vũ Hội": { actualSalary: 19000000, insurance: 630000 },
                        "Bùi Thế Tuấn Anh": { actualSalary: 20000000, insurance: 630000 },
                        "Trần Bá Trọng": { actualSalary: 19000000, insurance: 630000 },
                        "Lê Xuân Hồng": { actualSalary: 15000000, insurance: 0 }
                    };
                    
                    let foundNames = new Set();
                    
                    this.state.employees.forEach(emp => {
                        if (emp.department === 'VG09' && updates[emp.name]) {
                            emp.actualSalary = updates[emp.name].actualSalary;
                            emp.insurance = updates[emp.name].insurance;
                            foundNames.add(emp.name);
                        }
                    });
                    
                    Object.keys(updates).forEach(name => {
                        if (!foundNames.has(name)) {
                            this.state.employees.push({
                                id: 'EMP-' + Math.random().toString(36).substr(2, 9),
                                name: name,
                                role: "Nhân viên",
                                department: "VG09",
                                basicSalary: 5000000,
                                actualSalary: updates[name].actualSalary,
                                insurance: updates[name].insurance,
                                allowances: 0,
                                personalDeduction: 15500000,
                                dependents: 0,
                                joinDate: "", leaveDate: "", phone: "", notes: ""
                            });
                        }
                    });

                    localStorage.setItem('vg09_salaries_updated', '1');
                    this.save();
                }

                if (!localStorage.getItem('vg_multiple_salaries_updated')) {
                    const updates = [
                        { name: "Lê Thân Thắng", dept: "VG05", actualSalary: 26000000, insurance: 1102500, role: "Thuyền trưởng" },
                        { name: "Nguyễn Đức Hiền", dept: "VG05", actualSalary: 22000000, insurance: 798000, role: "Thuyền phó" },
                        { name: "Bùi Đình Kha", dept: "VG05", actualSalary: 19000000, insurance: 0, role: "Nhân viên" },
                        { name: "Phạm Văn Tứ", dept: "VG05", actualSalary: 15500000, insurance: 525000, role: "Thủy thủ" },
                        { name: "Nguyễn Văn Luân", dept: "VG05", actualSalary: 15000000, insurance: 0, role: "Thủy thủ" },
                        { name: "Nguyễn Văn Bắc", dept: "VG05", actualSalary: 15000000, insurance: 525000, role: "Thủy thủ" },
                        { name: "Nguyễn Trọng Hậu", dept: "VG05", actualSalary: 17000000, insurance: 525000, role: "Thủy thủ" },
                        { name: "Nguyễn Viết Xuân", dept: "VG05", actualSalary: 23000000, insurance: 0, role: "Máy trưởng" },
                        { name: "Nguyễn Thái Bình", dept: "VG05", actualSalary: 21000000, insurance: 630000, role: "Nhân viên" },
                        { name: "Đỗ Hữu Xoa", dept: "VG05", actualSalary: 16000000, insurance: 525000, role: "Nhân viên" },
                        { name: "Vũ Văn Cường", dept: "VG05", actualSalary: 15000000, insurance: 0, role: "Bếp" },

                        { name: "Lê Ngọc Huế", dept: "VG15", actualSalary: 28000000, insurance: 1102500, role: "Thuyền trưởng" },
                        { name: "Lê Duy Quỳnh", dept: "VG15", actualSalary: 22000000, insurance: 798000, role: "Thuyền phó" },
                        { name: "Vũ Đức Trọng", dept: "VG15", actualSalary: 19000000, insurance: 525000, role: "Nhân viên" },
                        { name: "Lê Đức Mừng", dept: "VG15", actualSalary: 15000000, insurance: 525000, role: "Thủy thủ" },
                        { name: "Nguyễn Trọng Dương", dept: "VG15", actualSalary: 15000000, insurance: 0, role: "Thủy thủ" },
                        { name: "Nguyễn Trọng Vũ", dept: "VG15", actualSalary: 14000000, insurance: 525000, role: "Thủy thủ" },
                        { name: "Lưu Quang Trường", dept: "VG15", actualSalary: 23000000, insurance: 798000, role: "Máy trưởng" },
                        { name: "Nguyễn Xuân Toản", dept: "VG15", actualSalary: 20000000, insurance: 630000, role: "Nhân viên" },
                        { name: "Nguyễn Văn Tú", dept: "VG15", actualSalary: 19000000, insurance: 0, role: "Nhân viên" },
                        { name: "Nguyễn Đức Giang", dept: "VG15", actualSalary: 18000000, insurance: 525000, role: "Nhân viên" },
                        { name: "Nguyễn Hữu Quyết", dept: "VG15", actualSalary: 15000000, insurance: 0, role: "Bếp" },

                        { name: "Tạ Quang Hợp", dept: "VG36", actualSalary: 28000000, insurance: 1102500, role: "Thuyền trưởng" },
                        { name: "Lê Ngọc Hoàng", dept: "VG36", actualSalary: 22000000, insurance: 798000, role: "Thuyền phó" },
                        { name: "Nguyễn Trọng Vinh", dept: "VG36", actualSalary: 14666667, insurance: 630000, role: "Nhân viên" },
                        { name: "Nguyễn Đức Huy", dept: "VG36", actualSalary: 15000000, insurance: 525000, role: "Thủy thủ" },
                        { name: "Lê Ngọc Hà", dept: "VG36", actualSalary: 15000000, insurance: 525000, role: "Thủy thủ" },
                        { name: "Lê Duy Tới", dept: "VG36", actualSalary: 15000000, insurance: 525000, role: "Thủy thủ" },
                        { name: "Bùi Đình Thịnh", dept: "VG36", actualSalary: 23000000, insurance: 0, role: "Máy trưởng" },
                        { name: "Nguyễn Văn Danh", dept: "VG36", actualSalary: 19000000, insurance: 630000, role: "Nhân viên" },
                        { name: "Tạ Duy Trưởng", dept: "VG36", actualSalary: 22000000, insurance: 630000, role: "Nhân viên" },
                        { name: "Đinh Ngọc Hà", dept: "VG36", actualSalary: 16000000, insurance: 525000, role: "Nhân viên" },
                        { name: "Lê Bá Thạo", dept: "VG36", actualSalary: 15000000, insurance: 0, role: "Bếp" }
                    ];

                    let processedKeys = new Set();

                    // Update existing employees
                    this.state.employees.forEach(emp => {
                        const target = updates.find(u => u.name === emp.name && u.dept === emp.department);
                        if (target) {
                            emp.actualSalary = target.actualSalary;
                            emp.insurance = target.insurance;
                            processedKeys.add(`${target.name}-${target.dept}`);
                        }
                    });

                    // Add missing employees
                    updates.forEach(u => {
                        const key = `${u.name}-${u.dept}`;
                        if (!processedKeys.has(key)) {
                            this.state.employees.push({
                                id: 'EMP-' + Math.random().toString(36).substr(2, 9),
                                name: u.name,
                                role: u.role,
                                department: u.dept,
                                basicSalary: 5000000,
                                actualSalary: u.actualSalary,
                                insurance: u.insurance,
                                allowances: 0,
                                personalDeduction: 15500000,
                                dependents: 0,
                                joinDate: "", leaveDate: "", phone: "", notes: ""
                            });
                        }
                    });

                    localStorage.setItem('vg_multiple_salaries_updated', '1');
                    this.save();
                }

                if (!localStorage.getItem('allowances_added_v1')) {
                    const allowanceUpdates = {
                        "Lê Ngọc Ngọ": { delivery: 0, bonus: 400000 },
                        "Vũ Đức Ngọ": { delivery: 0, bonus: 400000 },
                        "Bùi Thị Phương": { delivery: 0, bonus: 400000 },
                        "Nguyễn Thị Nhị": { delivery: 0, bonus: 300000 },
                        "Hoàng Thị Diệp Linh": { delivery: 0, bonus: 300000 },
                        "Lương Thị Bích Hằng": { delivery: 0, bonus: 300000 },
                        "Vũ Ngọc Vĩnh": { delivery: 0, bonus: 350000 },
                        "Phạm Ngọc Tùng": { delivery: 0, bonus: 350000 },

                        "Lê Ngọc Huế": { delivery: 3500000, bonus: 3000000 },
                        "Lê Duy Anh": { delivery: 2500000, bonus: 2000000 },
                        "Lưu Quang Trường": { delivery: 2500000, bonus: 2000000 },
                        "Vũ Đức Trọng": { delivery: 2200000, bonus: 1800000 },
                        "Nguyễn Xuân Toàn": { delivery: 2500000, bonus: 2000000 },
                        "Nguyễn Văn Tú": { delivery: 2200000, bonus: 1800000 },
                        "Lê Đức Mừng": { delivery: 1500000, bonus: 1000000 },
                        "Nguyễn Trọng Dương": { delivery: 1500000, bonus: 1000000 },
                        "Vũ Đức An": { delivery: 1500000, bonus: 1000000 },
                        "Nguyễn Trọng Vũ": { delivery: 1500000, bonus: 1000000 },
                        "Nguyễn Đức Giang": { delivery: 1500000, bonus: 1000000 },
                        "Nguyễn Hữu Quyết": { delivery: 1500000, bonus: 1000000 },

                        "Lê Ngọc Hoàng": { delivery: 2500000, bonus: 2000000 },
                        "Nguyễn Trọng Vinh": { delivery: 2500000, bonus: 2000000 },
                        "Bùi Đình Thịnh": { delivery: 2800000, bonus: 2300000 },
                        "Tạ Duy Trưởng": { delivery: 2500000, bonus: 2200000 },
                        "Nguyễn Văn Danh": { delivery: 2200000, bonus: 1800000 },
                        "Lê Duy Tới": { delivery: 1500000, bonus: 1000000 },
                        "Nguyễn Đức Huy": { delivery: 1500000, bonus: 1000000 },
                        "Lê Ngọc Hà": { delivery: 1500000, bonus: 1000000 },
                        "Đinh Ngọc Hà": { delivery: 1700000, bonus: 1200000 },
                        "Nguyễn Đức Dũng": { delivery: 1500000, bonus: 1000000 },
                        "Nguyễn Dương Thân": { delivery: 1500000, bonus: 1000000 },
                        "Lê Bá Thạo": { delivery: 1500000, bonus: 1000000 },

                        "Tạ Quang Đức": { delivery: 4000000, bonus: 3500000 },
                        "Nguyễn Trường Giang": { delivery: 3500000, bonus: 3000000 },
                        "Nguyễn Trọng Hồng": { delivery: 3000000, bonus: 2500000 },
                        "Vũ Đình Đại": { delivery: 2700000, bonus: 1950000 },
                        "Lê Văn Cường": { delivery: 2700000, bonus: 1950000 },
                        "Lê Mạnh Hùng": { delivery: 2700000, bonus: 1950000 },
                        "Vũ Đức Thắng": { delivery: 1500000, bonus: 1000000 },
                        "Lê Ngọc Cung": { delivery: 1500000, bonus: 1000000 },
                        "Lê Văn Cường(QB)": { delivery: 1500000, bonus: 1000000 },
                        "Lê Ngọc Hoa": { delivery: 1500000, bonus: 1000000 },
                        "Nguyễn Trọng Tuấn Anh": { delivery: 1500000, bonus: 1000000 },
                        "Lương Anh Tuấn": { delivery: 1500000, bonus: 1000000 },
                        "Lê Văn Thắng": { delivery: 1500000, bonus: 1000000 },
                        "Trần Văn Phiến": { delivery: 1500000, bonus: 1000000 },

                        "Lại Xuân Kiều": { delivery: 3500000, bonus: 3000000 },
                        "Nguyễn Xuân Soái": { delivery: 2800000, bonus: 2300000 },
                        "Phạm Văn Long": { delivery: 2500000, bonus: 2000000 },
                        "Nguyễn Trọng Hiếu": { delivery: 2500000, bonus: 2000000 },
                        "Bùi Thế Tuấn Anh": { delivery: 2500000, bonus: 2000000 },
                        "Vũ Hội": { delivery: 2200000, bonus: 1800000 },
                        "Trần Bá Trọng": { delivery: 2200000, bonus: 1800000 },
                        "Bùi Thế Tiến": { delivery: 1500000, bonus: 1000000 },
                        "Lê Ngọc Anh": { delivery: 1500000, bonus: 1000000 },
                        "Lại Xuân Hà": { delivery: 1500000, bonus: 1000000 },
                        "Phạm Văn Khiêm": { delivery: 1500000, bonus: 1000000 },
                        "Lê Xuân Hồng": { delivery: 1500000, bonus: 1000000 }
                    };

                    this.state.employees.forEach(emp => {
                        let nameKey = emp.name;
                        // Some basic normalizations might apply, but exact match first
                        if (allowanceUpdates[nameKey]) {
                            emp.deliveryAllowance = allowanceUpdates[nameKey].delivery;
                            emp.completionBonus = allowanceUpdates[nameKey].bonus;
                        } else {
                            // Try removing spaces or matching partly if needed. We'll stick to exact first.
                            // Handle cases like "Bùi Thế T.Anh" -> "Bùi Thế Tuấn Anh" (which were mapped previously)
                            const matchedKey = Object.keys(allowanceUpdates).find(k => 
                                k.replace(/\s+/g, '').toLowerCase() === nameKey.replace(/\s+/g, '').toLowerCase()
                            );
                            if (matchedKey) {
                                emp.deliveryAllowance = allowanceUpdates[matchedKey].delivery;
                                emp.completionBonus = allowanceUpdates[matchedKey].bonus;
                            }
                        }
                    });

                    localStorage.setItem('allowances_added_v1', '1');
                    this.save();
                }

                if (!localStorage.getItem('allowances_added_v2_vg05')) {
                    const vg05Updates = {
                        "Lê Thân Thắng": { delivery: 3500000, bonus: 3000000 },
                        "Đỗ Hữu Xuân": { delivery: 2500000, bonus: 2000000 },
                        "Nguyễn Viết Xuân": { delivery: 2500000, bonus: 2000000 },
                        "Nguyễn Đức Hiền": { delivery: 2500000, bonus: 2000000 },
                        "Nguyễn Thái Bình": { delivery: 2500000, bonus: 2000000 },
                        "Bùi Đình Kha": { delivery: 2200000, bonus: 1800000 },
                        "Nguyễn Văn Bắc": { delivery: 1500000, bonus: 1000000 },
                        "Phạm Văn Tứ": { delivery: 1500000, bonus: 1000000 },
                        "Nguyễn Trọng Hậu": { delivery: 2200000, bonus: 1800000 },
                        "Đỗ Hữu Xoa": { delivery: 1500000, bonus: 1000000 },
                        "Nguyễn Văn Luân": { delivery: 1500000, bonus: 1000000 },
                        "Vũ Văn Cường": { delivery: 1500000, bonus: 1000000 }
                    };

                    this.state.employees.forEach(emp => {
                        if (emp.department === 'VG05') {
                            let nameKey = emp.name;
                            if (vg05Updates[nameKey]) {
                                emp.deliveryAllowance = vg05Updates[nameKey].delivery;
                                emp.completionBonus = vg05Updates[nameKey].bonus;
                            } else {
                                const matchedKey = Object.keys(vg05Updates).find(k => 
                                    k.replace(/\s+/g, '').toLowerCase() === nameKey.replace(/\s+/g, '').toLowerCase()
                                );
                                if (matchedKey) {
                                    emp.deliveryAllowance = vg05Updates[matchedKey].delivery;
                                    emp.completionBonus = vg05Updates[matchedKey].bonus;
                                }
                            }
                        }
                    });

                    localStorage.setItem('allowances_added_v2_vg05', '1');
                    this.save();
                }

                                if (!localStorage.getItem('importedTchinh12345')) {
                    this.state.transactions = JSON.parse(JSON.stringify(DEFAULT_STATE.transactions));
                    localStorage.setItem('importedTchinh12345', 'true');
                    localStorage.setItem('transactionsClearedV1', 'true');
                    this.save();
                }
                                if (!localStorage.getItem('importedFuelReport20260526')) {
                    this.state.fuelVoyages = JSON.parse(JSON.stringify(DEFAULT_STATE.fuelVoyages));
                    this.state.fuelLogs = JSON.parse(JSON.stringify(DEFAULT_STATE.fuelLogs));
                    localStorage.setItem('importedFuelReport20260526', 'true');
                    this.save();
                }
                if (!this.state.transactions) this.state.transactions = [];
                if (!this.state.fuelLogs) this.state.fuelLogs = [];
                if (!this.state.fuelVoyages) this.state.fuelVoyages = [];
                if (!this.state.vesselExpenses) this.state.vesselExpenses = [];
                if (!this.state.captainReports) this.state.captainReports = [];
                if (!this.state.monthlyCosts) this.state.monthlyCosts = [];
                
                // Initialize new allowance fields
                if (this.state.employees) {
                    this.state.employees.forEach(emp => {
                        if (emp.mealAllowance === undefined) emp.mealAllowance = 0;
                        if (emp.phoneAllowance === undefined) emp.phoneAllowance = 0;
                        if (emp.clothingAllowance === undefined) emp.clothingAllowance = 0;
                        if (emp.transportAllowance === undefined) emp.transportAllowance = 0;
                    });
                }

                if (!localStorage.getItem('allowances_extracted_v2')) {
                    const extractedAllowances = {"Lê Ngọc Ngọ":{"meal":2500000,"phone":400000,"clothing":2000000,"transport":0},"Vũ Đức Ngọ":{"meal":2500000,"phone":400000,"clothing":2000000,"transport":0},"Bùi Thị Phương":{"meal":2000000,"phone":400000,"clothing":2000000,"transport":0},"Nguyễn Thị Nhị":{"meal":1500000,"phone":400000,"clothing":2000000,"transport":0},"Hoàng Thị Diệp Linh":{"meal":1500000,"phone":400000,"clothing":2000000,"transport":0},"Lương Thị Bích Hằng":{"meal":1500000,"phone":400000,"clothing":2000000,"transport":0},"Vũ Ngọc Vĩnh":{"meal":1500000,"phone":400000,"clothing":2000000,"transport":0},"Phạm Ngọc Tùng":{"meal":1500000,"phone":400000,"clothing":2000000,"transport":0},"Lê Ngọc Huế":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":10500000},"Lê Duy Anh":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":7500000},"Lưu Quang Trường":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":7500000},"Vũ Đức Trọng":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":6600000},"Nguyễn Xuân Toàn":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":7500000},"Nguyễn Văn Tú":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":6600000},"Lê Đức Mừng":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":4500000},"Nguyễn Trọng Dương":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":4500000},"Vũ Đức An":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":4500000},"Nguyễn Trọng Vũ":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":4500000},"Nguyễn Đức Giang":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":4500000},"Nguyễn Hữu Quyết":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":4500000},"Tạ Quang Hợp":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":7000000},"Lê Ngọc Hoàng":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":5000000},"Nguyễn Trọng Vinh":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":5000000},"Bùi Đình Thịnh":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":5600000},"Tạ Duy Trưởng":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":5000000},"Nguyễn Văn Danh":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":4400000},"Lê Duy Tới":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":3000000},"Nguyễn Đức Huy":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":3000000},"Lê Ngọc Hà":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":3000000},"Đinh Ngọc Hà":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":3400000},"Nguyễn Đức Dũng":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":3000000},"Nguyễn Dương Thân":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":3000000},"Lê Bá Thạo":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":3000000},"Tạ Quang Đức":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":12000000},"Nguyễn Trường Giang":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":10500000},"Nguyễn Trọng Hồng":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":9000000},"Vũ Đình Đại":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":8100000},"Lê Văn Cường":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":8100000},"Lê Mạnh Hùng":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":8100000},"Vũ Đức Thắng":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":4500000},"Lê Ngọc Cung":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":4500000},"Lê Văn Cường(QB)":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":4500000},"Lê Ngọc Hoa":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":4500000},"Nguyễn Trọng Tuấn Anh":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":4500000},"Lương Anh Tuấn":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":4500000},"Lê Văn Thắng":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":4500000},"Trần Văn Phiến":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":4500000},"CỘNG SX":{"meal":35000000,"phone":5600000,"clothing":35000000,"transport":91800000},"Lại Xuân Kiều":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":7000000},"Nguyễn Xuân Soái":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":5600000},"Phạm Văn Long":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":5000000},"Nguyễn Trọng Hiếu":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":5000000},"Bùi Thế Tuấn Anh":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":5000000},"Vũ Hội":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":4400000},"Trần Bá Trọng":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":4400000},"Bùi Thế Tiến":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":3000000},"Lê Ngọc Anh":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":3000000},"Lại Xuân Hà":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":3000000},"Phạm Văn Khiêm":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":3000000},"Lê Xuân Hồng":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":3000000},"Cộng":{"meal":27500000,"phone":4400000,"clothing":27500000,"transport":68700000},"Lê Thân Thắng":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":10500000},"Đỗ Hữu Xuần":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":7500000},"Nguyễn Đức Hiền":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":7500000},"Nguyễn Thái Bình":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":7500000},"Bùi Đình Kha":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":6600000},"Nguyễn Văn Bắc":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":4500000},"Phạm Văn Tứ":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":4500000},"Nguyễn Trọng Hậu":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":6600000},"Đỗ Hữu Xoa":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":4500000},"Nguyễn Văn Luân":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":4500000},"Vũ Văn Cường":{"meal":2500000,"phone":400000,"clothing":2500000,"transport":4500000},"Tổng cộng":{"meal":169500000,"phone":28000000,"clothing":171000000,"transport":338500000}};
                    
                    if (this.state.employees) {
                        this.state.employees.forEach(emp => {
                            let match = extractedAllowances[emp.name];
                            if (!match) {
                                if (emp.name.includes('Đỗ Hữu Xuân') && extractedAllowances['Đỗ Hữu Xuần']) match = extractedAllowances['Đỗ Hữu Xuần'];
                                else if (emp.name.includes('Đỗ Hữu Xuân') && extractedAllowances['Đỗ Hữu Xoa']) match = extractedAllowances['Đỗ Hữu Xoa'];
                            }
                            
                            if (match) {
                                emp.mealAllowance = match.meal;
                                emp.phoneAllowance = match.phone;
                                emp.clothingAllowance = match.clothing;
                                emp.transportAllowance = match.transport;
                            }
                        });
                    }
                    localStorage.setItem('allowances_extracted_v2', 'true');
                    this.save();
                }



        // Automatically heal double-encoded company info
        if (this.state.company) {
            this.state.company.name = fixMojibake(this.state.company.name);
            this.state.company.bankInfo = fixMojibake(this.state.company.bankInfo);
            this.state.company.address = fixMojibake(this.state.company.address);
        }

        // Automatically heal double-encoded vessel info
        if (this.state.vessels) {
            this.state.vessels.forEach(v => {
                v.name = fixMojibake(v.name);
                v.captain = fixMojibake(v.captain);
            });
        }

        // Automatically heal double-encoded fuel voyages
        if (this.state.fuelVoyages) {
            this.state.fuelVoyages.forEach(fv => {
                fv.cargoType = fixMojibake(fv.cargoType);
                fv.fuelVendor = fixMojibake(fv.fuelVendor);
                fv.fuelLocation = fixMojibake(fv.fuelLocation);
            });
        }

        // Automatically heal double-encoded fuel logs
        if (this.state.fuelLogs) {
            this.state.fuelLogs.forEach(fl => {
                fl.startPos = fixMojibake(fl.startPos);
                fl.endPos = fixMojibake(fl.endPos);
            });
        }

        // 3. Clear all bad vendors and customers from state
        this.state.vendors = (this.state.vendors || []).filter(v => v.name && !hasFontError(v.name));
        this.state.customers = (this.state.customers || []).filter(c => c.name && !hasFontError(c.name));

        // 4. Merge clean correct vendors/customers if they are not already there
        const existingVendorNames = new Set(this.state.vendors.map(v => v.name.trim().toLowerCase()));
        correctVendors.forEach(v => {
            if (!existingVendorNames.has(v.name.trim().toLowerCase())) {
                this.state.vendors.push({
                    id: 'v-' + Math.floor(Math.random() * 1000000),
                    name: v.name,
                    type: v.type,
                    contact: v.contact,
                    address: v.address
                });
                existingVendorNames.add(v.name.trim().toLowerCase());
            }
        });

        const existingCustomerNames = new Set(this.state.customers.map(c => c.name.trim().toLowerCase()));
        correctCustomers.forEach(c => {
            if (!existingCustomerNames.has(c.name.trim().toLowerCase())) {
                this.state.customers.push({
                    id: 'c-' + Math.floor(Math.random() * 1000000),
                    name: c.name,
                    contact: c.contact,
                    address: c.address
                });
                existingCustomerNames.add(c.name.trim().toLowerCase());
            }
        });

        // 5. Map customer and vendor names to proper accented standard versions
        const partnerMap = {
            'ngoc anh': 'Ng\u1ecdc Anh',
            'hoang quyen': 'Ho\u00e0ng Quy\u00ean',
            'binh minh': 'B\u00ecnh Minh',
            'thai binh duong': 'Th\u00e1i B\u00ecnh D\u01b0\u01a1ng',
            'viet anh': 'Vi\u1ec7t Anh',
            'le pham': 'L\u00ea Ph\u1ea1m',
            'sunshine': 'Sunshine',
            'song hau': 'S\u00f4ng H\u1eadu',
            'quoc te xanh': 'Qu\u1ed1c T\u1ebf Xanh',
            'hoang dang': 'Ho\u00e0ng \u0110\u0103ng',
            'alberta': 'Alberta',
            'cong ty dai duong': 'C\u00f4ng ty \u0110\u1ea1i D\u01b0\u01a1ng',
            'petrotime': 'Petrotime',
            'petroltime': 'Petrotime',
            'hoang khai': 'Ho\u00e0ng Kh\u1ea3i',
            'nhat minh son': 'Nh\u1ea5t Minh S\u01a1n',
            'long binh': 'Long B\u00ecnh',
            'son hp': 'S\u01a1n HP',
            'cong ty tan my': 'C\u00f4ng ty T\u1ea5n My',
            'cong ty to my': 'C\u00f4ng ty T\u1ed1 My',
            'cang chan may': 'C\u1ea3ng Ch\u00e2n M\u00e2y',
            'petrolimex': 'Petrolimex',
            'pv da nang': 'Pvoil \u0110\u00e0 N\u1eb5ng',
            'pv \u0111\u00e0 n\u1eb5ng': 'Pvoil \u0110\u00e0 N\u1eb5ng',
            'pvoil da nang': 'Pvoil \u0110\u00e0 N\u1eb5ng',
            'pvoil \u0111\u00e0 n\u1eb5ng': 'Pvoil \u0110\u00e0 N\u1eb5ng',
            'pv oil mien trung': 'PvOil Mi\u1ec1n Trung',
            'pv oil mi\u1ec1n trung': 'PvOil Mi\u1ec1n Trung',
            'pvoil mien trung': 'PvOil Mi\u1ec1n Trung',
            'pvoil mi\u1ec1n trung': 'PvOil Mi\u1ec1n Trung'
        };

        // Standardize fuelVendor in fuel voyages using partnerMap
        if (this.state.fuelVoyages) {
            this.state.fuelVoyages.forEach(fv => {
                if (fv.fuelVendor) {
                    const trimmedLower = fv.fuelVendor.trim().toLowerCase();
                    if (partnerMap[trimmedLower]) {
                        fv.fuelVendor = partnerMap[trimmedLower];
                    }
                }
            });
        }

        // Standardize shipment customer names
        if (this.state.shipments) {
            this.state.shipments.forEach(s => {
                if (s.customer) {
                    const trimmedLower = s.customer.trim().toLowerCase();
                    if (partnerMap[trimmedLower]) {
                        s.customer = partnerMap[trimmedLower];
                    }
                }
                // Normalize vessel identifiers in shipments
                if (s.vessel) {
                    const vesselName = s.vessel.trim();
                    if (vesselName === 'Công ty' || vesselName === 'Văn phòng' || vesselName === 'Văn phòng Công ty') {
                        s.vessel = 'VP';
                    } else {
                        const match = this.state.vessels.find(v => v.name === vesselName);
                        if (match) {
                            s.vessel = match.id;
                        }
                    }
                }
            });
        }

        // Standardize transaction partner names
        if (this.state.transactions) {
            this.state.transactions.forEach(t => {
                if (t.partner) {
                    const trimmedLower = t.partner.trim().toLowerCase();
                    if (partnerMap[trimmedLower]) {
                        t.partner = partnerMap[trimmedLower];
                    }
                }
                // Normalize vessel identifiers
                if (t.vessel) {
                    const vesselName = t.vessel.trim();
                    if (vesselName === 'Công ty' || vesselName === 'Văn phòng' || vesselName === 'Văn phòng Công ty') {
                        t.vessel = 'VP';
                    } else {
                        // Map full vessel name to its id if present
                        const match = this.state.vessels.find(v => v.name === vesselName);
                        if (match) {
                            t.vessel = match.id;
                        }
                    }
                }
            });
        }

        // 6. Map and inject Excel agency fees (Äáº¡i lÃ½ 2 Ä‘áº§u cáº£ng) from "Dai ly.xlsx"
        const agencyFees = {
            "VG15-C11": 49919486,
            "VG36-C2": 68550556,
            "VG05-C11": 0,
            "VG09-C2": 76803260,
            "VG05-C5": 18705998,
            "VG15-C4": 83766933,
            "VG05-C6": 11331240,
            "VG36-C8": 43325404,
            "VG09-C4": 80517025,
            "VG36-C1": 38929631,
            "VG36-C3": 34226090,
            "VG05-C10": 7000000,
            "VG09-C6": 64825931,
            "VG15-C6": 78056498,
            "VG05-C7": 51316155,
            "VG18-C8": 85566050,
            "VG36-C10": 33300235,
            "VG36-C9": 72605793,
            "VG18-C9": 0,
            "VG05-C8": 7000000,
            "VG15-C1": 80111428,
            "VG05-C9": 8331267,
            "VG15-C3": 82886836,
            "VG05-C4": 21134056,
            "VG18-C4": 46981024,
            "VG36-C4": 42729942,
            "VG15-C9": 54487716,
            "VG36-C6": 86422459,
            "VG18-C6": 79949241,
            "VG09-C9": 50353338,
            "VG05-C1": 9531480,
            "VG05-C2": 51479227,
            "VG15-C12": 0,
            "VG05-C3": 9122710,
            "VG15-C10": 75640393,
            "VG18-C5": 91095292,
            "VG18-C2": 64837024,
            "VG36-C5": 86538115,
            "VG09-C1": 57146836,
            "VG15-C8": 37347457,
            "VG36-C7": 0,
            "VG18-C7": 75699340,
            "VG18-C3": 133519412,
            "VG09-C3": 43024312,
            "VG09-C8": 57352367,
            "VG18-C1": 51613525,
            "VG15-C5": 11979485,
            "VG15-C2": 55058278,
            "VG18-C10": 0,
            "VG36-C11": 0,
            "VG09-C5": 56025556,
            "VG09-C10": 0,
            "VG15-C7": 54802633,
            "VG36-C12": 0,
            "VG09-C7": 56448916
        };

        if (this.state.shipments) {
            this.state.shipments.forEach(s => {
                const key = `${s.vesselId}-${s.voyageNo}`;
                if (agencyFees[key] !== undefined) {
                    if (!s.costs) s.costs = {};
                    s.costs.agent = agencyFees[key];
                }
                // Automatically update refundAmount based on the new calcRefund rates (e.g. 20% for HD25 & HD54)
                if (s.revenueInvoice !== undefined && s.revenueReal !== undefined) {
                    s.refundAmount = Math.round(this.calcRefund(s.revenueInvoice, s.revenueReal, s.contractNo));
                }
                // Force-fix HD18 (VG15-C4) customer to Bình Minh
                if (s.contractNo === 'HD18' && s.vesselId === 'VG15' && s.voyageNo === 'C4') {
                    s.customer = 'B\u00ecnh Minh';
                }
            });
        }

        // Tự động tính lại chi phí Vật Tư từ các giao dịch (Migration + Heal data)
        if (this.state.transactions) {
            const monthsAndVessels = new Set();
            this.state.transactions.forEach(t => {
                if ((t.category === '9.Vật Tư' || t.category === '6.Lãi Vay') && t.vessel && t.vessel !== 'VP' && t.date) {
                    monthsAndVessels.add(`${t.vessel}_${t.date.substring(0, 7)}`);
                }
            });
            monthsAndVessels.forEach(key => {
                const [vesselId, monthStr] = key.split('_');
                this.recalculateVesselAllocations(vesselId, monthStr);
            });
        }

        // Tạm tính chi phí tháng 12/2025 bằng tháng 01/2026 để phân bổ cho các chuyến cuối 2025
        if (this.state.monthlyCosts && this.state.vessels) {
            let neededRecalc = false;
            this.state.vessels.forEach(v => {
                const janCost = this.state.monthlyCosts.find(c => c.month === '2026-01' && c.vesselId === v.id);
                if (janCost) {
                    const decCostIdx = this.state.monthlyCosts.findIndex(c => c.month === '2025-12' && c.vesselId === v.id);
                    if (decCostIdx === -1) {
                        this.state.monthlyCosts.push({ ...janCost, month: '2025-12' });
                        this.recalculateVesselAllocations(v.id, '2025-12');
                        neededRecalc = true;
                    } else if (!this.state.monthlyCosts[decCostIdx].salary) {
                        this.state.monthlyCosts[decCostIdx] = { ...janCost, month: '2025-12' };
                        this.recalculateVesselAllocations(v.id, '2025-12');
                        neededRecalc = true;
                    }
                }
            });
            if (neededRecalc) this.save();
        }

        if (this.state.shipments) {
            this.state.shipments.forEach(s => this.syncShipmentFuelFromLogs(s));
        }
        this.save();
            } catch (e) {
                console.error("Error in AppData.init:", e);
                // X4: lỗi -> state TRẮNG (không seed dữ liệu Vũ Gia). Cloud sẽ hydrate nếu đã đăng nhập.
                this.state = this.blankState();
                this.save();
            }
        } else {
            // X4: cài đặt mới / chưa có dữ liệu cục bộ -> state TRẮNG, KHÔNG seed dữ liệu Vũ Gia.
            // Khách thật đăng nhập sẽ được đồng bộ dữ liệu của họ từ đám mây.
            this.state = this.blankState();
            this.save();
        }
    },

    // State trắng cho cài đặt mới / khách mới (bản SaaS sạch, không lộ dữ liệu cũ).
    blankState() {
        return {
            company: { name: '', taxId: '', bankInfo: '', address: '',
                openingBalances: { 'ABbank': 0, 'Viettinbank': 0, 'Tài khoản cá nhân': 0, 'Tiền mặt': 0 } },
            vessels: [], vendors: [], customers: [], employees: [], monthlyCosts: [],
            transactions: [], fuelLogs: [], fuelVoyages: [], shipments: [],
            captainReports: [], vesselExpenses: [], timesheets: [], annualCosts: []
        };
    },

    mergeDefaultTransactions() {
        if (!this.state.transactions) this.state.transactions = [];
        const currentIds = new Set(this.state.transactions.map(t => t.id));
        let added = 0;
        DEFAULT_STATE.transactions.forEach(t => {
            if (!currentIds.has(t.id)) {
                this.state.transactions.push(t);
                added++;
            }
        });
        if (added > 0) {
            console.log(`Merged ${added} historical transactions.`);
            this.save();
        }
    },

    mergeDefaultShipments() {
        if (!this.state.shipments) this.state.shipments = [];
        let added = 0;
        let updated = 0;
        DEFAULT_STATE.shipments.forEach(s => {
            const idx = this.state.shipments.findIndex(curr => 
                (curr.id === s.id) || (curr.vesselId === s.vesselId && curr.voyageNo === s.voyageNo)
            );
            if (idx === -1) {
                this.state.shipments.push(s);
                added++;
            } else {
                const existingCosts = this.state.shipments[idx].costs || {};
                this.state.shipments[idx] = { 
                    ...s, 
                    ...this.state.shipments[idx],
                    id: this.state.shipments[idx].id,
                    costs: { ...s.costs, ...existingCosts } 
                };
                updated++;
            }
        });
        if (added > 0 || updated > 0) {
            console.log(`Merged ${added} new shipments and updated ${updated} existing shipments from Excel.`);
            this.save();
        }
    },

    syncShipmentFuelFromLogs(s) {
        if (!s.costs) s.costs = {};
        const fuelVoy = this.findFuelVoyageByVesselAndNo(s.vesselId, s.voyageNo);
        if (fuelVoy) {
            const stats = this.getFuelVoyageStats(fuelVoy.id);
            s.fuelHours = Number(stats.totalHours) || 0;
            let price = Number(stats.fuelPrice);
            if (price === 0) {
                price = this.getLastFuelPrice(s.vesselId, s.voyageNo);
            }
            s.costs.fuelDO = Math.round(stats.totalFuel * price);
            s.fuelPrice = price;
        } else {
            s.fuelHours = s.fuelHours || 0;
            s.costs.fuelDO = s.costs.fuelDO || 0;
        }
    },

    mergeDefaultCustomers() {
        if (!this.state.customers) this.state.customers = [];
        // Force-replace stale placeholder customers (old data had fake company names)
        const hasStale = this.state.customers.some(c =>
            (c.name || '').toLowerCase().includes('cong ty') ||
            (c.name || '').toLowerCase().includes('xi mang') ||
            (c.name || '').toLowerCase().includes('long an')
        );
        if (hasStale || this.state.customers.length === 0) {
            this.state.customers = JSON.parse(JSON.stringify(DEFAULT_STATE.customers));
            console.log('Force-synced customers from DEFAULT_STATE (replaced stale data).');
            this.save();
            return;
        }
        // Otherwise just add any missing ones from DEFAULT_STATE
        const currentNames = new Set(this.state.customers.map(c => (c.name || '').trim().toLowerCase()));
        let added = 0;
        DEFAULT_STATE.customers.forEach(c => {
            if (c.name && !currentNames.has(c.name.trim().toLowerCase())) {
                this.state.customers.push({ ...c });
                currentNames.add(c.name.trim().toLowerCase());
                added++;
            }
        });
        if (added > 0) {
            console.log(`Merged ${added} new customers from DEFAULT_STATE.`);
            this.save();
        }
    },

    mergeDefaultPartnersFromTransactions() {
        if (!this.state.vendors) this.state.vendors = [];
        if (!this.state.customers) this.state.customers = [];

        const vendorNames = new Set(this.state.vendors.map(v => (v.name || '').trim().toLowerCase()));
        const customerNames = new Set(this.state.customers.map(c => (c.name || '').trim().toLowerCase()));

        const skipNames = new Set(['công ty', 'tàu chi', 'tàu', 'cá nhân', 'thu', 'chi', '-', '---']);

        let vendorsAdded = 0;
        let customersAdded = 0;

        DEFAULT_STATE.transactions.forEach(t => {
            if (t.partner && t.partner.trim()) {
                const nameTrimmed = t.partner.trim();
                const nameLower = nameTrimmed.toLowerCase();
                
                if (skipNames.has(nameLower)) return;

                if (Number(t.thu) > 0) {
                    // Customer
                    if (!customerNames.has(nameLower)) {
                        this.state.customers.push({
                            id: 'CUST-TX-' + Math.floor(Math.random()*1000000),
                            name: nameTrimmed,
                            contact: '---',
                            address: '---'
                        });
                        customerNames.add(nameLower);
                        customersAdded++;
                    }
                } else if (Number(t.chi) > 0) {
                    // Vendor
                    if (!vendorNames.has(nameLower)) {
                        this.state.vendors.push({
                            id: 'VEND-TX-' + Math.floor(Math.random()*1000000),
                            name: nameTrimmed,
                            type: t.category || 'Đối tác giao dịch',
                            contact: '---',
                            address: '---'
                        });
                        vendorNames.add(nameLower);
                        vendorsAdded++;
                    }
                }
            }
        });

        if (vendorsAdded > 0 || customersAdded > 0) {
            console.log(`Merged ${vendorsAdded} vendors and ${customersAdded} customers from ledger transactions.`);
            this.save();
        }
    },

    mergeDefaultFuelData() {
        if (!this.state.fuelVoyages) this.state.fuelVoyages = [];
        if (!this.state.fuelLogs) this.state.fuelLogs = [];
        
        let voyagesAdded = 0;
        let logsAdded = 0;

        // 1. Sync fuelVoyages - Only add if missing
        DEFAULT_STATE.fuelVoyages.forEach(v => {
            const idx = this.state.fuelVoyages.findIndex(curr => 
                (curr.id === v.id) || (curr.vesselId === v.vesselId && curr.voyageNo === v.voyageNo)
            );
            if (idx === -1) {
                this.state.fuelVoyages.push(v);
                voyagesAdded++;
            }
        });

        // 2. Sync fuelLogs - Only add if the log id does not exist in state
        const currentLogIds = new Set(this.state.fuelLogs.map(l => l.id));
        DEFAULT_STATE.fuelLogs.forEach(l => {
            if (!currentLogIds.has(l.id)) {
                this.state.fuelLogs.push(l);
                logsAdded++;
            }
        });

        if (voyagesAdded > 0 || logsAdded > 0) {
            console.log(`Merged default fuel data: Added ${voyagesAdded} voyages and ${logsAdded} logs.`);
            this.save();
        }
    },

    mergeDefaultVesselExpenses() {
        if (!this.state.vesselExpenses) this.state.vesselExpenses = [];
        const currentIds = new Set(this.state.vesselExpenses.map(e => e.id));
        let added = 0;
        DEFAULT_STATE.vesselExpenses.forEach(e => {
            if (!currentIds.has(e.id)) {
                this.state.vesselExpenses.push(e);
                added++;
            }
        });
        if (added > 0) {
            console.log(`Merged ${added} default vessel expenses`);
            this.save();
        }
    },

    mergeDefaultCaptainReports() {
        if (!this.state.captainReports) this.state.captainReports = [];
        const currentIds = new Set(this.state.captainReports.map(r => r.id));
        let added = 0;
        DEFAULT_STATE.captainReports.forEach(r => {
            if (!currentIds.has(r.id)) {
                this.state.captainReports.push(r);
                added++;
            }
        });
        if (added > 0) {
            console.log(`Merged ${added} default captain reports`);
            this.save();
        }
    },

    save() {
        const json = JSON.stringify(this.state);
        // localStorage: cache khởi động nhanh (chống tràn quota -> dựa vào IDB)
        try { localStorage.setItem(DB_KEY, json); }
        catch (e) { console.warn('[Store] localStorage đầy, dùng IndexedDB làm bản chính.'); }
        // IndexedDB: bản lưu durable, không trần 5MB, ghi bất đồng bộ (không chặn UI)
        SMStore.set(DB_KEY, this.state);
    },
    // Nạp lại từ IndexedDB nếu localStorage trống/bị xoá (ổ lớn hơn localStorage)
    hydrateFromIDB() {
        return SMStore.get(DB_KEY).then(idbState => {
            if (!idbState) return false;
            const hasLocal = !!localStorage.getItem(DB_KEY);
            if (!hasLocal) {
                this.state = idbState;
                try { localStorage.setItem(DB_KEY, JSON.stringify(idbState)); } catch (e) {}
                if (typeof app !== 'undefined' && app.currentView) {
                    try { app.navigate(app.currentView); } catch (e) {}
                }
                return true;
            }
            return false;
        }).catch(() => false);
    },

    // Getters
    getCompany() { return this.state.company; },
    getVessels() { return this.state.vessels; },
    getVessel(id) { return this.state.vessels.find(v => v.id === id); },
    getVendors() {
        const hasFontError = (str) => {
            if (!str) return false;
            return /[\u00c3\u00c4\u00c6\u00bb\u00ba\u00bd\u00be\u00bf]/.test(str);
        };
        return (this.state.vendors || []).filter(v => v.name && !hasFontError(v.name));
    },
    getCustomers() {
        const hasFontError = (str) => {
            if (!str) return false;
            return /[\u00c3\u00c4\u00c6\u00bb\u00ba\u00bd\u00be\u00bf]/.test(str);
        };
        return (this.state.customers || []).filter(c => c.name && !hasFontError(c.name));
    },
    getTransactions() { return this.state.transactions.sort((a,b) => new Date(b.date) - new Date(a.date)); },

    // HR Management Methods
    getTimesheets() { return this.state.timesheets || []; },
    getTimesheet(month, department) {
        return (this.state.timesheets || []).find(ts => ts.month === month && ts.department === department);
    },
    saveTimesheet(timesheet) {
        if (!this.state.timesheets) this.state.timesheets = [];
        const index = this.state.timesheets.findIndex(ts => ts.month === timesheet.month && ts.department === timesheet.department);
        if (index !== -1) {
            this.state.timesheets[index] = timesheet;
        } else {
            this.state.timesheets.push(timesheet);
        }
        this.save();
    },

    getEmployees() { return this.state.employees || []; },
    getEmployee(id) { return (this.state.employees || []).find(e => e.id === id); },
    saveEmployee(employee) {
        if (!this.state.employees) this.state.employees = [];
        if (employee.id) {
            const index = this.state.employees.findIndex(e => e.id === employee.id);
            if (index !== -1) {
                this.state.employees[index] = { ...this.state.employees[index], ...employee };
            } else {
                this.state.employees.push(employee);
            }
        } else {
            employee.id = 'EMP-' + Math.random().toString(36).substr(2, 9);
            this.state.employees.push(employee);
        }
        this.save();
    },
    deleteEmployee(id) {
        if (!this.state.employees) return;
        this.state.employees = this.state.employees.filter(e => e.id !== id);
        this.save();
    },
    // Công nợ khách hàng: doanh thu hóa đơn − đã thu (CVC) + công nợ đầu kỳ
    getCustomerDebts() {
        const shipments = this.getShipments();
        const transactions = this.getTransactions();
        const norm = (n) => n ? n.trim().toUpperCase().replace(/\s+/g, ' ') : 'KHÁC';
        const namesSet = new Set();
        shipments.forEach(s => { if (s.customer) namesSet.add(norm(s.customer)); });
        const opening = this.state.company.customerOpeningDebts || {};
        Object.keys(opening).forEach(k => namesSet.add(norm(k)));
        let totalCustomerDebt = 0;
        const list = Array.from(namesSet).sort().map(custName => {
            const custShipments = shipments.filter(s => norm(s.customer) === custName);
            const custTrans = transactions.filter(t => t.partner && norm(t.partner) === custName);
            let totalInvoice = 0, totalPaid = 0;
            custShipments.forEach(s => { totalInvoice += Number(s.revenueInvoice) || 0; });
            custTrans.forEach(t => { if (t.category === 'CVC') { totalPaid += Number(t.thu) || 0; } });
            const openDebt = Number(opening[custName]) || 0;
            const debt = openDebt + totalInvoice - totalPaid;
            totalCustomerDebt += debt;
            return { name: custName, debt };
        });
        return { totalCustomerDebt, list };
    },

    getSupplierDebts() {
        const suppliers = {};
        
        // 1. Calculate Fuel Purchases
        this.state.fuelVoyages.forEach(v => {
            if (!v.fuelVendor) return;
            const vendor = v.fuelVendor.trim().toLowerCase();
            if (!suppliers[vendor]) suppliers[vendor] = { name: v.fuelVendor.trim(), totalPurchased: 0, totalPaid: 0, debt: 0, purchases: [], payments: [] };
            
            const cost = Math.round((Number(v.addedFuel) || 0) * (Number(v.fuelUnitPrice) || 0));
            if (cost > 0) {
                suppliers[vendor].totalPurchased += cost;
                suppliers[vendor].purchases.push({
                    id: v.id,
                    date: v.fuelDate || new Date().toISOString(),
                    cost: cost,
                    vessel: v.vesselId,
                    qty: v.addedFuel,
                    price: v.fuelUnitPrice,
                    paid: 0,
                    remaining: cost
                });
            }
        });
        
        // 2. Calculate Payments from Transactions (Chi)
        this.state.transactions.forEach(t => {
            const isDO = t.category && (
                t.category === '4.Dầu DO' ||
                t.category === '10.Nhiên Liệu DO' ||
                t.category === '11.Nhiên Liệu LO' ||
                t.category.toLowerCase().includes('dầu do')
            );
            if (Number(t.chi) > 0 && isDO && t.partner) {
                const vendor = t.partner.trim().toLowerCase();
                // We map payments to suppliers even if they don't have purchases yet
                if (!suppliers[vendor]) suppliers[vendor] = { name: t.partner.trim(), totalPurchased: 0, totalPaid: 0, debt: 0, purchases: [], payments: [] };
                
                const amount = Number(t.chi) || 0;
                suppliers[vendor].totalPaid += amount;
                suppliers[vendor].payments.push({
                    date: t.date,
                    amount: amount
                });
            }
        });
        
        // 3. Calculate Debt and FIFO allocation
        Object.values(suppliers).forEach(s => {
            s.debt = s.totalPurchased - s.totalPaid;
            
            // FIFO Allocation to Purchases
            s.purchases.sort((a, b) => new Date(a.date) - new Date(b.date));
            let remainingPayment = s.totalPaid;
            
            for (let p of s.purchases) {
                if (remainingPayment <= 0) break;
                if (remainingPayment >= p.cost) {
                    p.paid = p.cost;
                    p.remaining = 0;
                    remainingPayment -= p.cost;
                } else {
                    p.paid = remainingPayment;
                    p.remaining = p.cost - remainingPayment;
                    remainingPayment = 0;
                }
            }
        });
        
        return Object.values(suppliers).sort((a,b) => b.debt - a.debt);
    },
    getMonthlyCosts(month, vesselId) { 
        let cost = this.state.monthlyCosts.find(c => c.month === month && c.vesselId === vesselId);
        let result = cost ? { ...cost } : { month, vesselId, salary: 0, insurance: 0, food: 0, materialCompany: 0, materialVessel: 0, loanInterestExternal: 0, other: 0 };
        if (result.loanInterestExternal === undefined) result.loanInterestExternal = 0;
        
        // Nếu chưa có lương và bảo hiểm (bằng 0), lấy từ tháng gần nhất trước đó
        if (!result.salary && !result.insurance) {
            const pastCosts = this.state.monthlyCosts
                .filter(c => c.vesselId === vesselId && c.month < month && (c.salary > 0 || c.insurance > 0))
                .sort((a, b) => b.month.localeCompare(a.month)); // Sort descending
                
            if (pastCosts.length > 0) {
                if (!result.salary) result.salary = pastCosts[0].salary || 0;
                if (!result.insurance) result.insurance = pastCosts[0].insurance || 0;
            }
        }
        return result;
    },
    getShipments() { 
        return this.state.shipments.sort((a,b) => {
            const numA = parseInt((a.voyageNo || '').replace(/[^0-9]/g, '')) || 0;
            const numB = parseInt((b.voyageNo || '').replace(/[^0-9]/g, '')) || 0;
            if (numB !== numA) {
                return numB - numA; // Chuyến mới nhất/lớn nhất lên trước (C12, C11, C10...)
            }
            return (a.vesselId || '').localeCompare(b.vesselId || '');
        });
    },

    getCargos() {
        const cargos = new Set(['Than cám', 'Cát', 'Đá', 'Clinker', 'Thạch cao', 'Xỉ than', 'Quặng', 'Dăm gỗ', 'Gạo', 'Ngô', 'Thép']);
        if (this.state.shipments) {
            this.state.shipments.forEach(s => {
                if (s.cargo) cargos.add(s.cargo);
            });
        }
        return Array.from(cargos).sort();
    },

    getPorts() {
        const ports = new Set(['Cẩm Phả', 'Hòn Gai', 'Nghi Sơn', 'Vũng Áng', 'Cửa Lò', 'Đà Nẵng', 'Quy Nhơn', 'Nha Trang', 'Phú Mỹ', 'Sài Gòn', 'Cần Thơ', 'Hải Phòng', 'Chân Mây', 'Đồng Nai']);
        if (this.state.shipments) {
            this.state.shipments.forEach(s => {
                if (s.portLoad) ports.add(s.portLoad);
                if (s.portDischarge) ports.add(s.portDischarge);
            });
        }
        return Array.from(ports).sort();
    },

    // Captain's Monthly Reports Getters & Setters
    getCaptainReport(vesselId, monthStr) {
        if (!this.state.captainReports) this.state.captainReports = [];
        return this.state.captainReports.find(r => r.vesselId === vesselId && r.month === monthStr);
    },

    saveCaptainReport(report) {
        if (!this.state.captainReports) this.state.captainReports = [];
        const idx = this.state.captainReports.findIndex(r => r.vesselId === report.vesselId && r.month === report.month);
        if (idx >= 0) {
            this.state.captainReports[idx] = report;
        } else {
            this.state.captainReports.push(report);
        }
        this.save();
        this.recalculateVesselAllocations(report.vesselId, report.month);
    },

    // Vessel Fund Thu-Chi-Ton Calculation
    getVesselFundStats(vesselId, monthStr) {
        // Thu: Total transactions in company with category '1.Tàu Ứng' and matching vessel
        const companyAdvances = this.state.transactions
            .filter(t => t.vessel === vesselId && t.category === '1.Tàu Ứng' && t.date && typeof t.date === 'string' && t.date.substring(0, 7) === monthStr)
            .reduce((sum, t) => sum + (Number(t.chi) || 0), 0);

        // Chi: Calculated from the captain's report of this vessel and month
        const report = this.getCaptainReport(vesselId, monthStr);
        let chiVessel = 0;
        if (report) {
            const foodChi = Number(report.food) || 0;
            const matChi = Number(report.material) || 0;
            const portsChi = (report.portExpenses || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
            const brokChi = (report.brokerages || []).reduce((sum, b) => sum + (Number(b.amount) || 0), 0);
            chiVessel = foodChi + matChi + portsChi + brokChi;
        }

        // Ton dau ky: Calculated by aggregating all previous months
        let openingBalance = 0;
        
        // Sum previous company advances
        const prevAdvances = this.state.transactions
            .filter(t => t.vessel === vesselId && t.category === '1.Tàu Ứng' && t.date && typeof t.date === 'string' && t.date.substring(0, 7) < monthStr)
            .reduce((sum, t) => sum + (Number(t.chi) || 0), 0);
            
        // Sum previous captain reports' spending
        let prevExpensesSum = 0;
        (this.state.captainReports || [])
            .filter(r => r.vesselId === vesselId && r.month && r.month < monthStr)
            .forEach(r => {
                const foodChi = Number(r.food) || 0;
                const matChi = Number(r.material) || 0;
                const portsChi = (r.portExpenses || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
                const brokChi = (r.brokerages || []).reduce((sum, b) => sum + (Number(b.amount) || 0), 0);
                prevExpensesSum += foodChi + matChi + portsChi + brokChi;
            });

        openingBalance = prevAdvances - prevExpensesSum;

        return {
            opening: openingBalance,
            income: companyAdvances,
            expense: chiVessel,
            balance: openingBalance + companyAdvances - chiVessel
        };
    },

    syncShipmentExpensesFromReports(vesselId) {
        const allReports = this.state.captainReports.filter(r => r.vesselId === vesselId);
        
        this.state.shipments.forEach(s => {
            if (s.vesselId !== vesselId) return;

            let hasBrokerage = false;
            let voyageBrokerage = 0;
            
            let hasPortExpenses = false;
            let voyagePortExpenses = 0;

            allReports.forEach(rep => {
                if (rep.brokerages) {
                    const matched = rep.brokerages.filter(b => b.voyageNo === s.voyageNo);
                    if (matched.length > 0) {
                        hasBrokerage = true;
                        voyageBrokerage += matched.reduce((sum, b) => sum + (Number(b.amount) || 0), 0);
                    }
                }
                
                if (rep.portExpenses) {
                    const matched = rep.portExpenses.filter(p => p.voyageNo === s.voyageNo);
                    if (matched.length > 0) {
                        hasPortExpenses = true;
                        voyagePortExpenses += matched.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
                    }
                }
            });

            if (hasBrokerage) {
                if (!s.costs) s.costs = {};
                s.costs.brokerage = voyageBrokerage;
            }
            if (hasPortExpenses) {
                if (!s.costs) s.costs = {};
                s.costs.vessel2ends = voyagePortExpenses;
            }
        });
    },

    // Business Logic Auto-Allocation
    recalculateVesselAllocations(vesselId, monthStr) {
        const report = this.getCaptainReport(vesselId, monthStr);
        
        const crewFood = report ? (Number(report.food) || 0) : 0;
        const materialVessel = report ? (Number(report.material) || 0) : 0;

        // Tự động tính vật tư công ty mua (từ Giao dịch)
        const materialCompany = (this.state.transactions || [])
            .filter(t => t.vessel === vesselId && t.category === '9.Vật Tư' && t.date && t.date.substring(0, 7) === monthStr)
            .reduce((sum, t) => sum + (Number(t.chi) || 0), 0);

        // Tự động tính lãi vay (từ Giao dịch)
        const loanInterest = (this.state.transactions || [])
            .filter(t => t.vessel === vesselId && t.category === '6.Lãi Vay' && t.date && t.date.substring(0, 7) === monthStr)
            .reduce((sum, t) => sum + (Number(t.chi) || 0), 0);

        // 1. Update Monthly Costs
        const monthly = this.getMonthlyCosts(monthStr, vesselId);
        monthly.food = crewFood;
        monthly.materialVessel = materialVessel;
        monthly.materialCompany = materialCompany;
        monthly.loanInterest = loanInterest;
        this.saveMonthlyCosts(monthly);

        // 2. Sync exact expenses from all captain reports across all months
        this.syncShipmentExpensesFromReports(vesselId);
        this.save();

        // 3. Recalculate daily allocations
        this.recalculateAllShipmentAllocations(vesselId, monthStr);
    },

    // Fix#3: tính lại TẤT CẢ phân bổ dẫn xuất (vật tư cty, lãi vay, chi phí cảng, phân bổ ngày...)
    // cho mọi (tàu, tháng) suy ra từ chuyến + giao dịch. Dùng để "heal" sau khi tải dữ liệu từ cloud.
    recalcAllAllocations() {
        if (!this.state) return;
        const pairs = new Set();
        (this.state.shipments || []).forEach(s => {
            const m = s.reportMonth || (s.dateStart ? String(s.dateStart).substring(0, 7) : '');
            if (s.vesselId && m) pairs.add(s.vesselId + '|' + m);
        });
        (this.state.transactions || []).forEach(t => {
            if (t.vessel && t.vessel !== 'VP' && t.date) pairs.add(t.vessel + '|' + String(t.date).substring(0, 7));
        });
        pairs.forEach(k => {
            const i = k.indexOf('|');
            this.recalculateVesselAllocations(k.slice(0, i), k.slice(i + 1));
        });
    },

    // Số ngày của 1 chuyến (gồm cả ngày đầu & cuối).
    _voyageDays(start, end) {
        if (!start || !end) return 0;
        const a = new Date(start), b = new Date(end);
        if (isNaN(a) || isNaN(b)) return 0;
        return Math.max(0, Math.round((b - a) / 86400000) + 1);
    },
    // ─── Annual costs (V5): cấu hình chi phí theo NĂM × TÀU ───────────────────
    // Lấy cấu hình chi phí hàng năm cho 1 tàu + 1 năm.
    // Nếu chưa có, tìm năm gần nhất → migration tự động từ fixedCosts cũ.
    getAnnualCosts(year, vesselId) {
        if (!this.state.annualCosts) this.state.annualCosts = [];
        let config = this.state.annualCosts.find(c => c.year === Number(year) && c.vesselId === vesselId);
        if (!config) {
            const sameVessel = this.state.annualCosts.filter(c => c.vesselId === vesselId);
            if (sameVessel.length > 0) {
                sameVessel.sort((a, b) => Math.abs(a.year - year) - Math.abs(b.year - year));
                config = sameVessel[0];
            }
        }
        // Migration: nếu chưa có annualCosts nhưng có fixedCosts cũ → tạo tạm từ fixedCosts
        if (!config) {
            const v = this.getVessel(vesselId);
            const fc = v && v.fixedCosts;
            if (fc) {
                config = {
                    year: Number(year), vesselId,
                    dockingIntermediateCost: Number(fc.drydockIntermediate) || 0,
                    dockingIntermediateYears: 2.5, dockingIntermediateDate: '',
                    dockingPeriodicCost: Number(fc.drydockPeriodic) || 0,
                    dockingPeriodicYears: 5, dockingPeriodicDate: '',
                    registryAnnualCost: Number(fc.annualSurvey) || 0,
                    registryAnnualYears: 1, registryAnnualDate: '',
                    depreciationCost: Number(fc.depreciation) || 0,
                    hullInsuranceCost: Number(fc.hullInsurance) || 0
                };
            }
        }
        const res = config ? { ...config } : {
            year: Number(year), vesselId,
            dockingIntermediateCost: 0, dockingIntermediateYears: 2.5, dockingIntermediateDate: '',
            dockingPeriodicCost: 0, dockingPeriodicYears: 5, dockingPeriodicDate: '',
            registryAnnualCost: 0, registryAnnualYears: 1, registryAnnualDate: '',
            depreciationCost: 0, hullInsuranceCost: 0
        };
        res.dockingIntermediateDaily = (Number(res.dockingIntermediateCost) || 0) / ((Number(res.dockingIntermediateYears) || 2.5) * 365);
        res.dockingPeriodicDaily    = (Number(res.dockingPeriodicCost)    || 0) / ((Number(res.dockingPeriodicYears)    || 5  ) * 365);
        res.registryAnnualDaily    = (Number(res.registryAnnualCost)     || 0) / ((Number(res.registryAnnualYears)     || 1  ) * 365);
        res.depreciationDaily      = (Number(res.depreciationCost)       || 0) / 365;
        res.hullInsuranceDaily     = (Number(res.hullInsuranceCost)      || 0) / 365;
        return res;
    },

    saveAnnualCosts(data) {
        if (!this.state.annualCosts) this.state.annualCosts = [];
        data.year = Number(data.year);
        const idx = this.state.annualCosts.findIndex(c => c.year === data.year && c.vesselId === data.vesselId);
        if (idx >= 0) this.state.annualCosts[idx] = data;
        else this.state.annualCosts.push(data);
        // Chỉ tính lại chi phí cho CHUYẾN CỦA TÀU NÀY rồi lưu MỘT lần.
        // (Tránh recalcAllAllocations() gọi save() mỗi cặp tàu-tháng -> push cloud liên tục -> reload.)
        (this.state.shipments || []).forEach(s => {
            if (s.vesselId === data.vesselId) this.applyAutoCostsToShipment(s);
        });
        this.save();
    },

    // Phân bổ chi phí cố định hàng năm cho 1 chuyến (tích phân theo ngày, hỗ trợ chuyến vắt qua 2 năm).
    calcAnnualAllocation(startStr, endStr, vesselId) {
        const empty = { dockingIntermediate: 0, dockingPeriodic: 0, registryAnnual: 0, depreciation: 0, hullInsurance: 0 };
        if (!startStr || !endStr) return empty;
        const d1 = new Date(startStr), d2 = new Date(endStr);
        if (isNaN(d1) || isNaN(d2)) return empty;
        const totals = { ...empty };
        if (d2 <= d1) {
            const cfg = this.getAnnualCosts(d1.getFullYear(), vesselId);
            totals.dockingIntermediate = Math.round(cfg.dockingIntermediateDaily);
            totals.dockingPeriodic     = Math.round(cfg.dockingPeriodicDaily);
            totals.registryAnnual      = Math.round(cfg.registryAnnualDaily);
            totals.depreciation        = Math.round(cfg.depreciationDaily);
            totals.hullInsurance       = Math.round(cfg.hullInsuranceDaily);
            return totals;
        }
        let cur = new Date(d1);
        while (cur < d2) {
            const nxt = new Date(Math.min(new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 1), d2));
            const cfg = this.getAnnualCosts(cur.getFullYear(), vesselId);
            const frac = (nxt - cur) / 86400000;
            totals.dockingIntermediate += cfg.dockingIntermediateDaily * frac;
            totals.dockingPeriodic     += cfg.dockingPeriodicDaily     * frac;
            totals.registryAnnual      += cfg.registryAnnualDaily      * frac;
            totals.depreciation        += cfg.depreciationDaily        * frac;
            totals.hullInsurance       += cfg.hullInsuranceDaily       * frac;
            cur = nxt;
        }
        totals.dockingIntermediate = Math.round(totals.dockingIntermediate);
        totals.dockingPeriodic     = Math.round(totals.dockingPeriodic);
        totals.registryAnnual      = Math.round(totals.registryAnnual);
        totals.depreciation        = Math.round(totals.depreciation);
        totals.hullInsurance       = Math.round(totals.hullInsurance);
        return totals;
    },
    // ────────────────────────────────────────────────────────────────────────────

    // Lớn#A: chi phí cố định/năm của tàu -> phân bổ cho chuyến theo số ngày (annual/365 × ngày).
    // Kept for backward-compat (tests). New logic uses calcAnnualAllocation above.
    calcFixedCostForShipment(s, vesselId) {
        const alloc = this.calcAnnualAllocation(s && s.dateStart, s && s.dateEnd, vesselId || (s && s.vesselId));
        return alloc.dockingIntermediate + alloc.dockingPeriodic + alloc.registryAnnual + alloc.depreciation + alloc.hullInsurance;
    },
    // Lớn#B: chi phí dầu LO theo công thức giờ chạy.
    //   tiêu thụ (phi) = giờ chạy × (phi thay + phi bổ sung) / giờ chu kỳ
    //   chi phí = tiêu thụ × đơn giá/phi ; lít = tiêu thụ × lít/phi
    calcLO(s, vesselId) {
        const v = this.getVessel(vesselId || (s && s.vesselId));
        const cfg = v && v.loConfig;
        if (!cfg) return { cost: 0, drums: 0, liters: 0 };
        const cycle = Number(cfg.cycleHours) || 0;
        if (cycle <= 0) return { cost: 0, drums: 0, liters: 0 };
        const perCycle = (Number(cfg.drumsPerCycle) || 0) + (Number(cfg.supplement) || 0);
        const hours = Number(s.fuelHours) || 0;
        const drums = hours * perCycle / cycle;
        return {
            cost: Math.round(drums * (Number(cfg.unitPrice) || 0)),
            drums: drums,
            liters: Math.round(drums * (Number(cfg.litersPerDrum) || 0))
        };
    },
    // Áp các chi phí TỰ ĐỘNG cho 1 chuyến (không đụng tới crew/material nhập tay):
    //  - agent: gộp giao dịch "2.Chi Phí Cảng" (chỉ khi trống/đã auto)
    //  - fuelLO: chi phí dầu LO theo công thức (chỉ khi trống/đã auto)
    //  - fixedCost: phân bổ chi phí cố định theo ngày
    applyAutoCostsToShipment(s) {
        if (!s) return;
        if (!s.costs) s.costs = {};
        if (!Number(s.costs.agent) || s._agentAuto) {
            const portSum = (this.state.transactions || [])
                .filter(t => t.category === '2.Chi Phí Cảng' && t.vessel === s.vesselId
                    && t.voyageNo && s.voyageNo && String(t.voyageNo) === String(s.voyageNo))
                .reduce((sum, t) => sum + (Number(t.chi) || 0), 0);
            if (portSum > 0) { s.costs.agent = portSum; s._agentAuto = true; }
            else if (s._agentAuto) { s.costs.agent = 0; delete s._agentAuto; }
        }
        if (!Number(s.costs.fuelLO) || s._loAuto) {
            const lo = this.calcLO(s, s.vesselId);
            if (lo.cost > 0) { s.costs.fuelLO = lo.cost; s.loLiters = lo.liters; s._loAuto = true; }
            else if (s._loAuto) { s.costs.fuelLO = 0; delete s.loLiters; delete s._loAuto; }
        }
        const annualAlloc = this.calcAnnualAllocation(s.dateStart, s.dateEnd, s.vesselId);
        s.costs.dockingIntermediate = annualAlloc.dockingIntermediate;
        s.costs.dockingPeriodic     = annualAlloc.dockingPeriodic;
        s.costs.registryAnnual      = annualAlloc.registryAnnual;
        s.costs.depreciation        = annualAlloc.depreciation;
        s.costs.hullInsurance       = annualAlloc.hullInsurance;
        // Giữ fixedCost = tổng 5 khoản để tương thích với báo cáo cũ
        s.costs.fixedCost = annualAlloc.dockingIntermediate + annualAlloc.dockingPeriodic
            + annualAlloc.registryAnnual + annualAlloc.depreciation + annualAlloc.hullInsurance;
    },
    // Tính lại chi phí cố định cho tất cả chuyến của 1 tàu (gọi khi đổi cấu hình chi phí cố định).
    recalcVesselFixedCosts(vesselId) {
        (this.state.shipments || []).forEach(s => {
            if (s.vesselId === vesselId) this.applyAutoCostsToShipment(s);
        });
        this.save();
    },

    recalculateAllShipmentAllocations(vesselId, monthStr) {
        this.state.shipments.forEach(s => {
            const sMonth = s.reportMonth || (s.dateStart && typeof s.dateStart === 'string' ? s.dateStart.substring(0, 7) : '');
            if (s.vesselId === vesselId && sMonth === monthStr) {
                if (!s.costs) s.costs = {};
                s.costs.crewSalary = this.calcExactAllocation(s.dateStart, s.dateEnd, vesselId, 'salary');
                s.costs.crewFood = this.calcExactAllocation(s.dateStart, s.dateEnd, vesselId, 'food');
                s.costs.crewInsurance = this.calcExactAllocation(s.dateStart, s.dateEnd, vesselId, 'insurance');
                s.costs.materialCompany = this.calcExactAllocation(s.dateStart, s.dateEnd, vesselId, 'materialCompany');
                s.costs.materialVessel = this.calcExactAllocation(s.dateStart, s.dateEnd, vesselId, 'materialVessel');
                s.costs.loanInterest = this.calcExactAllocation(s.dateStart, s.dateEnd, vesselId, 'loanInterest');
                s.costs.loanInterestExternal = this.calcExactAllocation(s.dateStart, s.dateEnd, vesselId, 'loanInterestExternal');
                s.costs.monthlyOther = this.calcExactAllocation(s.dateStart, s.dateEnd, vesselId, 'other');

                // Fix#2 (chi phí cảng -> agent) + Lớn#A (chi phí cố định) — gom vào 1 helper.
                this.applyAutoCostsToShipment(s);
            }
        });
        this.save();
    },
    
    // Fuel Voyages & Logs
    sortVoyages(voyages, order = 'asc') {
        return [...voyages].sort((a, b) => {
            const getNum = s => {
                if (!s || !s.voyageNo) return 0;
                const match = s.voyageNo.match(/\d+/);
                return match ? parseInt(match[0], 10) : 0;
            };
            const numA = getNum(a);
            const numB = getNum(b);
            if (numA !== numB) {
                return order === 'asc' ? numA - numB : numB - numA;
            }
            return order === 'asc' ? a.id.localeCompare(b.id) : b.id.localeCompare(a.id);
        });
    },

    getNextContractNo() {
        let max = 0;
        this.state.shipments.forEach(s => {
            if (s.contractNo && s.contractNo.toUpperCase().startsWith('HD')) {
                const num = parseInt(s.contractNo.substring(2), 10);
                if (!isNaN(num) && num > max) max = num;
            }
        });
        return max > 0 ? 'HD' + (max + 1) : 'HD1';
    },

    getNextVoyageNo(vesselId) {
        if (!vesselId) return 'C1';
        let max = 0;
        this.state.shipments.forEach(s => {
            if (s.vesselId === vesselId && s.voyageNo && s.voyageNo.toUpperCase().startsWith('C')) {
                const num = parseInt(s.voyageNo.substring(1), 10);
                if (!isNaN(num) && num > max) max = num;
            }
        });
        return max > 0 ? 'C' + (max + 1) : 'C1';
    },

    getNextLoadDate(vesselId) {
        if (!vesselId) return '';
        // Find latest shipment by dateEnd
        const vesselShipments = this.state.shipments.filter(s => s.vesselId === vesselId && s.dateEnd);
        if (vesselShipments.length === 0) return '';
        
        vesselShipments.sort((a, b) => new Date(b.dateEnd) - new Date(a.dateEnd));
        const lastDischarge = vesselShipments[0].dateEnd; // yyyy-mm-dd
        
        const d = new Date(lastDischarge);
        d.setDate(d.getDate() + 1);
        return d.toISOString().split('T')[0];
    },

    getFuelVoyages(vesselId) { 
        let list = vesselId ? this.state.fuelVoyages.filter(v => v.vesselId === vesselId) : [...this.state.fuelVoyages];
        return this.sortVoyages(list, 'desc'); // Newest first
    },
    getFuelVoyage(id) { return this.state.fuelVoyages.find(v => v.id === id); },
    getFuelLogs(voyageId) { return this.state.fuelLogs.filter(l => l.fuelVoyageId === voyageId); },
    // Tồn dầu DO hiện tại của 1 tàu = tồn đầu (chuyến đầu) + tổng cấp − tổng tiêu thụ.
    getVesselDOInventory(vesselId) {
        const voyages = this.sortVoyages(this.getFuelVoyages(vesselId), 'asc');
        if (!voyages.length) return { current: 0, initial: 0, added: 0, consumed: 0, voyages: 0 };
        const initial = Number(voyages[0].initialFuel || 0);
        let added = 0, consumed = 0;
        voyages.forEach(v => {
            added += Number(v.addedFuel || 0);
            consumed += Number((this.getFuelVoyageStats(v.id) || {}).totalFuel || 0);
        });
        return { current: initial + added - consumed, initial, added, consumed, voyages: voyages.length };
    },
    
    getFuelVoyageStats(voyageId) {
        const logs = this.getFuelLogs(voyageId);
        const voyage = this.getFuelVoyage(voyageId);
        const totalHours = logs.reduce((sum, l) => sum + Number(l.hours || 0), 0);
        const totalFuel = logs.reduce((sum, l) => sum + (Number(l.hours) * Number(l.fuelRate)), 0);
        return { totalHours, totalFuel, fuelPrice: voyage ? voyage.fuelUnitPrice : 0 };
    },

    getVesselFuelBalance(vesselId) {
        const voyages = this.getFuelVoyages(vesselId);
        const sortedAsc = this.sortVoyages(voyages, 'asc'); // Oldest first
        if (sortedAsc.length === 0) return 0;
        
        let balance = Number(sortedAsc[0].initialFuel || 0);
        sortedAsc.forEach(v => {
            const stats = this.getFuelVoyageStats(v.id);
            balance += Number(v.addedFuel || 0);
            balance -= stats.totalFuel;
        });
        return balance;
    },

    getLastFuelPrice(vesselId, voyageNo = null) {
        const voyages = this.getFuelVoyages(vesselId); // getFuelVoyages is already sorted desc
        if (voyageNo) {
            const getNum = s => {
                if (!s) return 0;
                const match = String(s).match(/\d+/);
                return match ? parseInt(match[0], 10) : 0;
            };
            const currentNum = getNum(voyageNo);
            const vWithPrice = voyages.find(v => {
                const vNum = getNum(v.voyageNo);
                return Number(v.fuelUnitPrice) > 0 && vNum <= currentNum;
            });
            if (vWithPrice) return Number(vWithPrice.fuelUnitPrice);
        }
        const vWithPrice = voyages.find(v => Number(v.fuelUnitPrice) > 0);
        return vWithPrice ? Number(vWithPrice.fuelUnitPrice) : 20000;
    },

    findFuelVoyageByVesselAndNo(vesselId, voyageNo) {
        return this.state.fuelVoyages.find(v => v.vesselId === vesselId && v.voyageNo === voyageNo);
    },

    // Setters
    updateCompany(data) { this.state.company = { ...this.state.company, ...data }; this.save(); },
    updateVessel(id, data) {
        const idx = this.state.vessels.findIndex(v => v.id === id);
        if (idx >= 0) {
            this.state.vessels[idx] = { ...this.state.vessels[idx], ...data };
            this.save();
        }
    },
    // Thêm tàu mới (cho khách hàng SaaS tự lập đội tàu). Trả về id.
    addVessel(v) {
        v.id = v.id || ('VS' + Date.now());
        const idx = this.state.vessels.findIndex(x => x.id === v.id);
        if (idx >= 0) this.state.vessels[idx] = { ...this.state.vessels[idx], ...v };
        else this.state.vessels.push(v);
        this.save();
        return v.id;
    },
    deleteVessel(id) {
        this.state.vessels = this.state.vessels.filter(v => v.id !== id);
        this.save();
    },
    // X1: đếm dữ liệu liên quan tới 1 tàu (để cảnh báo trước khi xóa).
    getVesselRelatedCounts(id) {
        const s = this.state;
        const voyIds = new Set((s.fuelVoyages || []).filter(v => v.vesselId === id).map(v => v.id));
        return {
            shipments: (s.shipments || []).filter(x => x.vesselId === id).length,
            transactions: (s.transactions || []).filter(x => x.vessel === id).length,
            fuelVoyages: voyIds.size,
            fuelLogs: (s.fuelLogs || []).filter(l => voyIds.has(l.fuelVoyageId)).length,
            vesselExpenses: (s.vesselExpenses || []).filter(x => x.vesselId === id).length,
            captainReports: (s.captainReports || []).filter(x => x.vesselId === id).length,
            monthlyCosts: (s.monthlyCosts || []).filter(x => x.vesselId === id).length
        };
    },
    // X1: xóa tàu + DỌN mọi dữ liệu liên quan (tránh orphaned records).
    deleteVesselCascade(id) {
        const s = this.state;
        const voyIds = new Set((s.fuelVoyages || []).filter(v => v.vesselId === id).map(v => v.id));
        s.shipments = (s.shipments || []).filter(x => x.vesselId !== id);
        s.transactions = (s.transactions || []).filter(x => x.vessel !== id);
        s.fuelLogs = (s.fuelLogs || []).filter(l => !voyIds.has(l.fuelVoyageId));
        s.fuelVoyages = (s.fuelVoyages || []).filter(v => v.vesselId !== id);
        s.vesselExpenses = (s.vesselExpenses || []).filter(x => x.vesselId !== id);
        s.captainReports = (s.captainReports || []).filter(x => x.vesselId !== id);
        s.monthlyCosts = (s.monthlyCosts || []).filter(x => x.vesselId !== id);
        s.vessels = (s.vessels || []).filter(v => v.id !== id);
        this.save();
    },
    
    addTransaction(t) { 
        t.id = t.id || ('TR' + Date.now()); 
        const idx = this.state.transactions.findIndex(x => x.id === t.id);
        let oldTx = null;
        if(idx >= 0) {
            oldTx = { ...this.state.transactions[idx] };
            this.state.transactions[idx] = t;
        } else {
            this.state.transactions.push(t); 
        }
        this.save();

        // Auto-recalculate khi giao dịch ảnh hưởng phân bổ.
        // - 9.Vật Tư / 6.Lãi Vay: recalc theo THÁNG của giao dịch.
        // - 2.Chi Phí Cảng: recalc theo THÁNG của CHUYẾN (theo voyageNo) vì chi phí cảng gắn theo chuyến.
        const recalcForTxn = (tx) => {
            if (!tx || !tx.vessel || tx.vessel === 'VP') return;
            if (tx.category === '9.Vật Tư' || tx.category === '6.Lãi Vay') {
                if (tx.date) this.recalculateVesselAllocations(tx.vessel, tx.date.substring(0, 7));
            } else if (tx.category === '2.Chi Phí Cảng' && tx.voyageNo) {
                const sh = (this.state.shipments || []).find(s => s.vesselId === tx.vessel && String(s.voyageNo) === String(tx.voyageNo));
                const m = sh ? (sh.reportMonth || (sh.dateStart ? sh.dateStart.substring(0, 7) : '')) : (tx.date ? tx.date.substring(0, 7) : '');
                if (m) this.recalculateVesselAllocations(tx.vessel, m);
            }
        };
        recalcForTxn(t);
        if (oldTx) recalcForTxn(oldTx);
    },
    deleteTransaction(id) {
        const t = this.state.transactions.find(x => x.id === id);
        this.state.transactions = this.state.transactions.filter(x => x.id !== id);
        this.save();
        if (t && t.vessel && t.vessel !== 'VP' && t.date && (t.category === '9.Vật Tư' || t.category === '6.Lãi Vay')) {
            this.recalculateVesselAllocations(t.vessel, t.date.substring(0, 7));
        }
    },

    saveMonthlyCosts(data) {
        const idx = this.state.monthlyCosts.findIndex(c => c.month === data.month && c.vesselId === data.vesselId);
        if (idx >= 0) this.state.monthlyCosts[idx] = data;
        else this.state.monthlyCosts.push(data);
        this.save();
    },

    addFuelVoyage(v) {
        v.id = v.id || ('FV' + Date.now());
        const idx = this.state.fuelVoyages.findIndex(x => x.id === v.id);
        if(idx >= 0) this.state.fuelVoyages[idx] = v;
        else this.state.fuelVoyages.push(v);
        this.save();
        return v.id;
    },
    deleteFuelVoyage(id) {
        this.state.fuelVoyages = this.state.fuelVoyages.filter(v => v.id !== id);
        this.state.fuelLogs = this.state.fuelLogs.filter(l => l.fuelVoyageId !== id);
        this.save();
    },

    addFuelLog(log) {
        log.id = log.id || ('FL' + Date.now());
        const idx = this.state.fuelLogs.findIndex(x => x.id === log.id);
        if(idx >= 0) this.state.fuelLogs[idx] = log;
        else this.state.fuelLogs.push(log);
        this.save();
    },
    deleteFuelLog(id) {
        this.state.fuelLogs = this.state.fuelLogs.filter(t => t.id !== id);
        this.save();
    },

    addShipment(s) {
        s.id = s.id || ('S' + Date.now());
        this.applyAutoCostsToShipment(s);   // fixedCost + auto-agent (không đụng crew nhập tay)
        const idx = this.state.shipments.findIndex(x => x.id === s.id);
        if(idx >= 0) this.state.shipments[idx] = s;
        else this.state.shipments.push(s);
        this.save();
    },
    deleteShipment(id) {
        this.state.shipments = this.state.shipments.filter(t => t.id !== id);
        this.save();
    },
    addVendor(v) {
        v.id = v.id || ('v' + Date.now());
        const idx = this.state.vendors.findIndex(x => x.id === v.id);
        if (idx >= 0) this.state.vendors[idx] = v;
        else this.state.vendors.push(v);
        this.save();
    },
    deleteVendor(id) {
        this.state.vendors = this.state.vendors.filter(t => t.id !== id);
        this.save();
    },
    addCustomer(c) {
        c.id = c.id || ('c' + Date.now());
        const idx = this.state.customers.findIndex(x => x.id === c.id);
        if (idx >= 0) this.state.customers[idx] = c;
        else this.state.customers.push(c);
        this.save();
    },
    deleteCustomer(id) {
        this.state.customers = this.state.customers.filter(t => t.id !== id);
        this.save();
    },

    // Logic Formulas
    calcDays(start, end) {
        const d1 = new Date(start);
        const d2 = new Date(end);
        const diffTime = Math.abs(d2 - d1);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return Math.max(1, diffDays);
    },

    calcExactAllocation(startStr, endStr, vesselId, field) {
        if (!startStr || !endStr) return 0;
        const d1 = new Date(startStr);
        const d2 = new Date(endStr);
        
        if (d2 <= d1) {
            const mStr = startStr.substring(0, 7);
            const monthly = this.getMonthlyCosts(mStr, vesselId);
            const [y, m] = mStr.split('-').map(Number);
            const daysInMonth = new Date(y, m, 0).getDate();
            return Math.round((Number(monthly[field]) || 0) / daysInMonth);
        }

        // Tối ưu: duyệt theo TỪNG THÁNG giao thoa (O số tháng ≈ 1-2), thay vì từng ngày (O số ngày).
        // Kết quả tương đương loop ngày (chênh tối đa ±1 VND do làm tròn dấu phẩy động).
        let totalCost = 0;
        let cur = new Date(d1.getFullYear(), d1.getMonth(), 1);   // đầu tháng của d1
        while (cur < d2) {
            const y = cur.getFullYear(), m = cur.getMonth();       // m: 0-based
            const monthStart = new Date(y, m, 1);
            const monthEnd = new Date(y, m + 1, 1);                // loại trừ (đầu tháng sau)
            const overlapStart = d1 > monthStart ? d1 : monthStart;
            const overlapEnd = d2 < monthEnd ? d2 : monthEnd;
            const overlapDays = (overlapEnd - overlapStart) / (1000 * 60 * 60 * 24);
            if (overlapDays > 0) {
                const mStr = `${y}-${String(m + 1).padStart(2, '0')}`;
                const monthly = this.getMonthlyCosts(mStr, vesselId);
                const daysInMonth = new Date(y, m + 1, 0).getDate();
                totalCost += ((Number(monthly[field]) || 0) / daysInMonth) * overlapDays;
            }
            cur = new Date(y, m + 1, 1);                           // sang tháng kế
        }

        return Math.round(totalCost);
    },

    calcRefund(invoiceRev, realRev, contractNo) {
        const diff = invoiceRev - realRev;
        const rate = (contractNo === 'HD25' || contractNo === 'HD54') ? 0.20 : 0.28;
        // Formula: (Diff) - (Diff / 1.08 * rate)
        return diff - (diff / 1.08 * rate);
    },

    formatCurrency(amount) {
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount || 0);
    }
};

// Boot: ưu tiên IndexedDB (durable, không trần 5MB). Nếu localStorage trống mà IDB có dữ liệu
// -> khôi phục vào localStorage TRƯỚC khi init (tránh seed DEFAULT ghi đè dữ liệu thật trong IDB).
AppData.bootPromise = (async () => {
    try {
        const idbState = await SMStore.get(DB_KEY);
        if (idbState && !localStorage.getItem(DB_KEY)) {
            try { localStorage.setItem(DB_KEY, JSON.stringify(idbState)); } catch (e) {}
        }
    } catch (e) { /* IDB không khả dụng -> dùng localStorage như cũ */ }
    AppData.init();
})();
