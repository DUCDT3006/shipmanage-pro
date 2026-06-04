/**
 * Main Application Logic V2.0
 */

const app = {
    currentView: 'dashboard',
    selectedDebtCustomer: '',
    excludeDockingDepreciation: JSON.parse(localStorage.getItem('sm3_excludeDockDepr') || 'false'),
    annualCostsYear: new Date().getFullYear(),
    annualCostsVesselId: '',

    // Đọc dữ liệu form chi phí năm hiện tại trong DOM, gắn với year/vesselId truyền vào.
    _buildAnnualData(year, vesselId) {
        const parseNum = id => {
            const raw = document.getElementById(id)?.value || '0';
            return Number(String(raw).replace(/\./g, '').replace(/,/g, '.')) || 0;
        };
        const numVal = (id, def) => { const v = Number(document.getElementById(id)?.value); return v > 0 ? v : def; };
        const dateVal = id => document.getElementById(id)?.value || '';
        return {
            year: Number(year), vesselId,
            dockingIntermediateCost:  parseNum('a-docking-int-cost'),
            dockingIntermediateYears: numVal('a-docking-int-years', 2.5),
            dockingIntermediateDate:  dateVal('a-docking-int-date'),
            dockingPeriodicCost:      parseNum('a-docking-per-cost'),
            dockingPeriodicYears:     numVal('a-docking-per-years', 5),
            dockingPeriodicDate:      dateVal('a-docking-per-date'),
            registryAnnualCost:       parseNum('a-registry-ann-cost'),
            registryAnnualYears:      numVal('a-registry-ann-years', 1),
            registryAnnualDate:       dateVal('a-registry-ann-date'),
            depreciationCost:         parseNum('a-depreciation-cost'),
            hullInsuranceCost:        parseNum('a-hull-ins-cost')
        };
    },

    // Lưu lặng lẽ form ĐANG hiển thị (theo tàu/năm của lần render trước) — gọi trước khi đổi dropdown.
    _persistCurrentAnnualForm() {
        if (!document.getElementById('a-docking-int-cost')) return;   // form chưa render
        if (!this.annualCostsVesselId) return;
        AppData.saveAnnualCosts(this._buildAnnualData(this.annualCostsYear, this.annualCostsVesselId));
    },

    loadAnnualCosts() {
        // TỰ LƯU form hiện tại trước khi đổi tàu/năm (tránh mất dữ liệu vừa gõ chưa bấm Lưu)
        this._persistCurrentAnnualForm();
        const year = document.getElementById('a-year')?.value;
        const vesselId = document.getElementById('a-vessel')?.value;
        if (year) this.annualCostsYear = Number(year);
        if (vesselId) this.annualCostsVesselId = vesselId;
        this.navigate('annual-costs');
    },

    saveAnnualCosts() {
        const year     = Number(document.getElementById('a-year').value);
        const vesselId = document.getElementById('a-vessel').value;
        this.annualCostsYear = year;
        this.annualCostsVesselId = vesselId;
        AppData.saveAnnualCosts(this._buildAnnualData(year, vesselId));
        alert(`✅ Đã lưu cấu hình năm ${year} cho tàu ${vesselId} và phân bổ lại toàn bộ chuyến!`);
        this.navigate('annual-costs');
    },

    toggleExcludeDockingDepreciation(val) {
        this.excludeDockingDepreciation = !!val;
        localStorage.setItem('sm3_excludeDockDepr', JSON.stringify(this.excludeDockingDepreciation));
        this.navigate('dashboard', this.currentDashboardMonth || '');
    },

    // ===== Tồn kho dầu LO (tab trong Quản lý Nhiên liệu) =====
    saveLOConfig(vesselId) {
        const v = AppData.getVessel(vesselId);
        if (!v) return;
        const cfg = { ...(v.loConfig || {}) };
        cfg.cycleHours   = Number(document.getElementById('lo-cfg-cycle').value) || 0;
        cfg.drumsPerCycle = Number(document.getElementById('lo-cfg-drums').value) || 0;
        cfg.supplement    = Number(document.getElementById('lo-cfg-supp').value) || 0;
        AppData.updateVessel(vesselId, { loConfig: cfg });
        AppData.recalcVesselFixedCosts(vesselId);   // cập nhật lại chi phí LO/chuyến
        this.navigate('fuel', vesselId, 'LO');
    },
    saveLOSupply(vesselId) {
        const qty = Number(document.getElementById('lo-supply-qty').value) || 0;
        const price = this.parseNum(document.getElementById('lo-supply-price').value);
        const date = document.getElementById('lo-supply-date').value;
        const vendor = document.getElementById('lo-supply-vendor').value.trim();
        if (qty <= 0 || price <= 0 || !date || !vendor) return alert('Nhập đủ ngày, NCC, số lượng và đơn giá (> 0).');
        AppData.addLOSupply({ vesselId, date, vendor, qty, price });
        if (window.smLogAudit) window.smLogAudit('Thêm phiếu cấp Dầu LO', `Tàu ${vesselId} · ${qty} phi × ${price} · ${vendor}`);
        this.navigate('fuel', vesselId, 'LO');
    },
    deleteLOSupply(id) {
        if (!confirm('Xóa phiếu cấp Dầu LO này?')) return;
        const s = (AppData.state.loSupplies || []).find(x => x.id === id);
        AppData.deleteLOSupply(id);
        this.navigate('fuel', s ? s.vesselId : (AppData.getVessels()[0] || {}).id, 'LO');
    },

    // Thanh cuộn ngang phụ ở TRÊN bảng rộng, đồng bộ với thanh cuộn chính bên dưới.
    initDoubleScroll(wrapperId) {
        setTimeout(() => {
            const wrapper = document.getElementById(wrapperId);
            if (!wrapper) return;
            const topScroll = wrapper.querySelector('.top-scrollbar');
            const tableContainer = wrapper.querySelector('.table-container');
            const dummy = wrapper.querySelector('.top-scrollbar-dummy');
            const table = wrapper.querySelector('table');
            if (!topScroll || !tableContainer || !dummy || !table) return;
            const updateWidth = () => {
                const tableWidth = table.scrollWidth;
                if (tableWidth > tableContainer.clientWidth) {
                    topScroll.style.display = 'block';
                    dummy.style.width = tableWidth + 'px';
                } else { topScroll.style.display = 'none'; }
            };
            updateWidth();
            if (window.ResizeObserver) {
                if (wrapper._scrollObs) wrapper._scrollObs.disconnect();
                const obs = new ResizeObserver(updateWidth);
                obs.observe(table); obs.observe(tableContainer);
                wrapper._scrollObs = obs;
            }
            let active = null;
            topScroll.onscroll = () => { if (active !== tableContainer) { active = topScroll; tableContainer.scrollLeft = topScroll.scrollLeft; } active = null; };
            tableContainer.onscroll = () => { if (active !== topScroll) { active = tableContainer; topScroll.scrollLeft = tableContainer.scrollLeft; } active = null; };
        }, 150);
    },

    // ===== BÁO CÁO THÁNG THEO TÀU (port từ V5) =====
    getMonthlyVesselReportInputs(vesselId, monthStr) {
        const key = `monthly_vessel_report_inputs_${vesselId}_${monthStr}`;
        const stored = localStorage.getItem(key);
        if (stored) { try { return JSON.parse(stored); } catch (e) {} }
        return { openingBalance: 0, customExpenses: [] };
    },
    saveMonthlyVesselReportInputs(vesselId, monthStr, data) {
        localStorage.setItem(`monthly_vessel_report_inputs_${vesselId}_${monthStr}`, JSON.stringify(data));
    },

    // Gom toàn bộ số liệu của 1 tàu trong 1 tháng (dạng dòng tiền: dư đầu + thu − chi = tồn cuối)
    _monthlyVesselReportData(vesselId, monthStr) {
        const [year, month] = monthStr.split('-').map(Number);
        const catIs = (t, name) => (t.category || '').trim().toLowerCase() === name.toLowerCase();
        const shipments = AppData.getShipments().filter(s => {
            const m = s.reportMonth || (s.dateStart ? s.dateStart.substring(0, 7) : '');
            return s.vesselId === vesselId && m === monthStr;
        }).slice().sort((a, b) => (a.voyageNo || '').localeCompare(b.voyageNo || ''));
        const txs = (AppData.state.transactions || []).filter(t => t.vessel === vesselId && t.date && t.date.substring(0, 7) === monthStr);

        const doCost = (AppData.state.fuelVoyages || [])
            .filter(v => v.vesselId === vesselId && v.fuelDate && v.fuelDate.substring(0, 7) === monthStr)
            .reduce((sum, v) => sum + Math.round((Number(v.addedFuel) || 0) * (Number(v.fuelUnitPrice) || 0)), 0);
        const loCost = txs.filter(t => catIs(t, '5.Dầu LO')).reduce((s, t) => s + (Number(t.chi) || 0), 0);
        const vesselAdvances = txs.filter(t => catIs(t, '1.Tàu Ứng')).reduce((s, t) => s + (Number(t.chi) || 0), 0);
        const monthlyCost = AppData.getMonthlyCosts(monthStr, vesselId);
        const crewSalary = Number(monthlyCost.salary) || 0;
        const interestTxs = txs.filter(t => catIs(t, '6.Lãi Vay'));
        const totalInterest = interestTxs.reduce((s, t) => s + (Number(t.chi) || 0), 0);
        const agentTxs = txs.filter(t => catIs(t, '2.Chi Phí Cảng'));
        const totalAgent = agentTxs.reduce((s, t) => s + (Number(t.chi) || 0), 0);
        const materialTxs = txs.filter(t => catIs(t, '9.Vật Tư'));
        const totalMaterial = materialTxs.reduce((s, t) => s + (Number(t.chi) || 0), 0);
        const daysInMonth = new Date(year, month, 0).getDate();
        const annualConfig = AppData.getAnnualCosts(year, vesselId);
        const hullInsurance = Math.round(daysInMonth * (annualConfig.hullInsuranceDaily || 0));
        const socialInsurance = Number(monthlyCost.insurance) || 0;
        const totalInsurance = hullInsurance + socialInsurance;
        const totalVat = shipments.reduce((s, sh) => s + (Number(sh.costs?.vat) || 0), 0);

        const totalRevenueSum = shipments.reduce((sum, s) => {
            let t = Number(s.revenueReal || 0);
            if (s.revenueInvoice > s.revenueReal) t += Math.round((s.revenueInvoice - s.revenueReal) / 1.08 * 0.28);
            return sum + t;
        }, 0);

        return { year, month, daysInMonth, shipments, interestTxs, agentTxs, materialTxs,
            doCost, loCost, vesselAdvances, crewSalary, totalInterest, totalAgent, totalMaterial,
            hullInsurance, socialInsurance, totalInsurance, totalVat, totalRevenueSum };
    },

    printMonthlyVesselReport(vesselId, monthStr, shouldPrint = false) {
        if (!vesselId || !monthStr) return alert('Hãy chọn Tàu và Tháng trước khi xem báo cáo.');
        const vessel = AppData.getVessel(vesselId);
        const vesselName = vessel ? vessel.name : vesselId;
        const d = this._monthlyVesselReportData(vesselId, monthStr);
        const inputs = this.getMonthlyVesselReportInputs(vesselId, monthStr);
        this.activeReportVessel = vesselId;
        this.activeReportMonth = monthStr;
        const fc = (n) => AppData.formatCurrency(n);

        let customTotal = 0;
        inputs.customExpenses.forEach(e => { customTotal += Number(e.amount) || 0; });
        const totalCostSum = d.doCost + d.loCost + d.vesselAdvances + d.crewSalary + d.totalInterest + d.totalAgent + d.totalMaterial + d.totalInsurance + d.totalVat + customTotal;
        const finalBalance = (Number(inputs.openingBalance) || 0) + d.totalRevenueSum - totalCostSum;

        const boldRow = (label, val) => `<tr style="background:#f1f5f9;font-weight:bold;"><td class="pac"></td><td></td><td>${label}</td><td></td><td></td><td style="text-align:right;color:#b91c1c;">${fc(val)}</td><td></td><td></td></tr>`;
        const subRow = (label, val) => `<tr class="psr"><td class="pac"></td><td></td><td style="padding-left:20px;color:#475569;">${esc(label)}</td><td></td><td></td><td style="text-align:right;">${fc(val)}</td><td></td><td></td></tr>`;

        const html = `
            <div class="print-container" id="report-data-holder"
                 data-do="${d.doCost}" data-lo="${d.loCost}" data-adv="${d.vesselAdvances}" data-sal="${d.crewSalary}"
                 data-int="${d.totalInterest}" data-agent="${d.totalAgent}" data-mat="${d.totalMaterial}"
                 data-ins="${d.totalInsurance}" data-vat="${d.totalVat}" data-rev="${d.totalRevenueSum}">
                <div class="print-actions no-print" style="margin-bottom:1.5rem;display:flex;justify-content:space-between;align-items:center;background:rgba(255,255,255,0.05);padding:10px;border-radius:8px;">
                    <strong style="color:var(--primary-light);">Bảng Xem Trước &amp; Điều Chỉnh Số Liệu</strong>
                    <div style="display:flex;gap:8px;">
                        <button class="btn btn-outline" style="border-color:#10b981;color:#10b981;background:#fff;" onclick="app.exportMonthlyVesselReport('${vesselId}','${monthStr}')"><i class="fa-solid fa-file-excel"></i> Xuất Excel</button>
                        <button class="btn btn-primary" onclick="window.print()"><i class="fa-solid fa-print"></i> In A4</button>
                        <button class="btn" style="background:#ef4444;color:#fff;font-weight:600;" onclick="app.closeModal('report-modal')"><i class="fa-solid fa-xmark"></i> Đóng</button>
                    </div>
                </div>
                <div class="print-header">
                    <h2>BẢNG THEO DÕI DOANH THU - CHI PHÍ TÀU ${esc(vesselName.toUpperCase())}</h2>
                    <h3>THÁNG ${d.month}/${d.year}</h3>
                </div>
                <table class="report-print-table" style="width:100%;border-collapse:collapse;margin-top:1.5rem;">
                    <thead><tr style="background:#cbd5e1;font-weight:bold;">
                        <th class="pac" style="width:40px;">Xóa</th><th style="width:50px;text-align:center;">STT</th>
                        <th>CHI TIẾT HẠNG MỤC</th><th style="text-align:right;width:130px;">DƯ ĐẦU</th>
                        <th style="text-align:right;width:130px;">DOANH THU</th><th style="text-align:right;width:130px;">CHI PHÍ</th>
                        <th style="text-align:right;width:130px;">TỒN CUỐI</th><th style="width:90px;text-align:center;">GHI CHÚ</th>
                    </tr></thead>
                    <tbody>
                        <tr style="background:#e2e8f0;font-weight:bold;">
                            <td class="pac"></td><td></td><td>Tồn tháng trước chuyển sang</td>
                            <td style="text-align:right;"><input type="number" id="rep-input-opening" class="print-input" value="${Number(inputs.openingBalance) || 0}" oninput="app.recalcMonthlyVesselReport()" style="font-weight:bold;text-align:right;"></td>
                            <td></td><td></td><td></td><td></td>
                        </tr>
                        ${d.shipments.map(s => {
                            const qtyStr = Math.round(Number(s.qty) || 0).toLocaleString('en-US');
                            const rateStr = Math.round(Number(s.rate) || 0).toLocaleString('en-US');
                            const details = `HĐ ${s.contractNo || ''} ${vesselName} ${s.portLoad || ''} - ${s.portDischarge || ''} (${s.customer || ''}) ${qtyStr} * ${rateStr}`;
                            let vatRow = '';
                            if (s.revenueInvoice > s.revenueReal) {
                                const vatAmt = Math.round((s.revenueInvoice - s.revenueReal) / 1.08 * 0.28);
                                vatRow = `<tr class="psr"><td class="pac"></td><td></td><td style="padding-left:20px;color:#475569;">VAT tính thêm chuyến này</td><td></td><td style="text-align:right;color:#15803d;">${fc(vatAmt)}</td><td></td><td></td><td></td></tr>`;
                            }
                            return `<tr class="psr"><td class="pac"></td><td style="text-align:center;"><strong>${esc(s.voyageNo || '')}</strong></td>
                                <td style="font-weight:500;">${esc(details)}</td><td></td>
                                <td style="text-align:right;color:#15803d;font-weight:bold;">${fc(s.revenueReal)}</td><td></td><td></td><td></td></tr>${vatRow}`;
                        }).join('')}
                        ${boldRow('Nhiên liệu (Dầu DO &amp; LO)', d.doCost + d.loCost)}
                        ${subRow('Dầu DO cấp trong tháng', d.doCost)}
                        ${subRow('Dầu LO chi trong tháng', d.loCost)}
                        ${boldRow('Tàu ứng chi phí trong tháng', d.vesselAdvances)}
                        ${boldRow('Chi phí lương thủy thủ', d.crewSalary)}
                        ${boldRow('Lãi vay phân bổ', d.totalInterest)}
                        ${d.interestTxs.map(t => subRow(t.content || 'Lãi vay', t.chi)).join('')}
                        ${boldRow('Chi phí Cảng phát sinh', d.totalAgent)}
                        ${d.agentTxs.map(t => subRow('+ ' + (t.content || 'Chi phí cảng'), t.chi)).join('')}
                        ${boldRow('Vật tư mua cấp tàu', d.totalMaterial)}
                        ${d.materialTxs.map(t => subRow(t.content || 'Vật tư', t.chi)).join('')}
                        ${boldRow('Bảo hiểm (thân vỏ &amp; BHXH)', d.totalInsurance)}
                        ${subRow(`Bảo hiểm thân vỏ phân bổ (${d.daysInMonth} ngày)`, d.hullInsurance)}
                        ${subRow('Bảo hiểm xã hội tháng', d.socialInsurance)}
                        ${boldRow('Thuế VAT phát sinh chuyến trong tháng', d.totalVat)}
                    </tbody>
                    <tbody id="rep-custom-expenses-body">
                        <tr style="background:#f8fafc;border-top:2px solid #94a3b8;"><td class="pac"></td><td colspan="7" style="font-weight:bold;padding:6px;">Chi phí văn phòng, Thuế và chi phí tự chọn khác:</td></tr>
                        ${inputs.customExpenses.map(exp => `
                            <tr class="custom-expense-row psr">
                                <td class="pac" style="text-align:center;"><button class="btn-delete-row" onclick="app.deleteReportCustomExpenseRow(this)"><i class="fa-solid fa-trash"></i></button></td>
                                <td></td>
                                <td style="padding-left:20px;"><input type="text" class="print-input-desc" value="${esc(exp.desc || '')}" placeholder="Nhập tên chi phí..." oninput="app.recalcMonthlyVesselReport()"></td>
                                <td></td><td></td>
                                <td style="text-align:right;"><input type="number" class="print-input print-input-amount" value="${Number(exp.amount) || 0}" oninput="app.recalcMonthlyVesselReport()" style="font-weight:bold;color:#b91c1c;"></td>
                                <td></td><td></td>
                            </tr>`).join('')}
                    </tbody>
                    <tbody>
                        <tr class="no-print"><td class="pac"></td><td colspan="7" style="padding:8px;">
                            <button class="btn btn-outline" style="padding:0.3rem 0.6rem;font-size:0.85rem;" onclick="app.addReportCustomExpenseRow()"><i class="fa-solid fa-plus"></i> Thêm chi phí tự nhập (VP, Thuế...)</button>
                        </td></tr>
                        <tr style="background:#cbd5e1;font-weight:bold;border-top:2px solid #000;">
                            <td class="pac"></td><td></td><td style="text-align:center;color:#1e3a8a;font-size:1.05rem;">Cộng</td>
                            <td style="text-align:right;color:#1e3a8a;" id="rep-total-opening">${fc(inputs.openingBalance)}</td>
                            <td style="text-align:right;color:#15803d;" id="rep-total-revenue">${fc(d.totalRevenueSum)}</td>
                            <td style="text-align:right;color:#b91c1c;" id="rep-total-cost">${fc(totalCostSum)}</td>
                            <td style="text-align:right;color:#15803d;font-size:1.1rem;" id="rep-total-balance">${fc(finalBalance)}</td>
                            <td></td>
                        </tr>
                    </tbody>
                </table>
                <div style="margin-top:2rem;text-align:right;font-style:italic;">Lập ngày ${String(new Date().getDate()).padStart(2,'0')}/${String(new Date().getMonth()+1).padStart(2,'0')}/${new Date().getFullYear()}</div>
            </div>`;
        document.getElementById('report-content').innerHTML = html;
        this.openModal('report-modal');
        if (shouldPrint) setTimeout(() => window.print(), 300);
    },

    recalcMonthlyVesselReport() {
        const holder = document.getElementById('report-data-holder');
        if (!holder) return;
        const opening = Number(document.getElementById('rep-input-opening').value) || 0;
        let customTotal = 0;
        const customExpenses = [];
        document.querySelectorAll('.custom-expense-row').forEach(row => {
            const desc = row.querySelector('.print-input-desc').value.trim();
            const amount = Number(row.querySelector('.print-input-amount').value) || 0;
            customTotal += amount;
            if (desc || amount) customExpenses.push({ desc, amount });
        });
        if (this.activeReportVessel && this.activeReportMonth) {
            this.saveMonthlyVesselReportInputs(this.activeReportVessel, this.activeReportMonth, { openingBalance: opening, customExpenses });
        }
        const g = k => Number(holder.dataset[k]) || 0;
        const totalCostSum = g('do') + g('lo') + g('adv') + g('sal') + g('int') + g('agent') + g('mat') + g('ins') + g('vat') + customTotal;
        const finalBalance = opening + g('rev') - totalCostSum;
        document.getElementById('rep-total-opening').innerText = AppData.formatCurrency(opening);
        document.getElementById('rep-total-cost').innerText = AppData.formatCurrency(totalCostSum);
        document.getElementById('rep-total-balance').innerText = AppData.formatCurrency(finalBalance);
    },

    addReportCustomExpenseRow() {
        const tbody = document.getElementById('rep-custom-expenses-body');
        if (!tbody) return;
        const tr = document.createElement('tr');
        tr.className = 'custom-expense-row psr';
        tr.innerHTML = `
            <td class="pac" style="text-align:center;"><button class="btn-delete-row" onclick="app.deleteReportCustomExpenseRow(this)"><i class="fa-solid fa-trash"></i></button></td>
            <td></td>
            <td style="padding-left:20px;"><input type="text" class="print-input-desc" value="" placeholder="Nhập tên chi phí..." oninput="app.recalcMonthlyVesselReport()"></td>
            <td></td><td></td>
            <td style="text-align:right;"><input type="number" class="print-input print-input-amount" value="0" oninput="app.recalcMonthlyVesselReport()" style="font-weight:bold;color:#b91c1c;"></td>
            <td></td><td></td>`;
        tbody.appendChild(tr);
        this.recalcMonthlyVesselReport();
    },
    deleteReportCustomExpenseRow(btn) {
        const tr = btn.closest('tr');
        if (tr) { tr.remove(); this.recalcMonthlyVesselReport(); }
    },

    exportMonthlyVesselReport(vesselId, monthStr) {
        if (typeof XLSX === 'undefined') return alert('Chưa tải xong thư viện xuất Excel!');
        const vessel = AppData.getVessel(vesselId);
        const vesselName = vessel ? vessel.name : vesselId;
        const d = this._monthlyVesselReportData(vesselId, monthStr);
        const inputs = this.getMonthlyVesselReportInputs(vesselId, monthStr);
        let customTotal = 0; inputs.customExpenses.forEach(e => customTotal += Number(e.amount) || 0);
        const totalCostSum = d.doCost + d.loCost + d.vesselAdvances + d.crewSalary + d.totalInterest + d.totalAgent + d.totalMaterial + d.totalInsurance + d.totalVat + customTotal;
        const finalBalance = (Number(inputs.openingBalance) || 0) + d.totalRevenueSum - totalCostSum;

        const rows = [];
        rows.push([`BẢNG THEO DÕI DOANH THU - CHI PHÍ TÀU ${vesselName.toUpperCase()}`]);
        rows.push([`THÁNG ${d.month}/${d.year}`]); rows.push([]);
        rows.push(['STT', 'CHI TIẾT HẠNG MỤC', 'DƯ ĐẦU THÁNG', 'DOANH THU', 'CHI PHÍ', 'TỒN CUỐI', 'GHI CHÚ']);
        rows.push(['', 'Tồn tháng trước chuyển sang', Number(inputs.openingBalance) || 0, '', '', '', '']);
        d.shipments.forEach(s => {
            const qtyStr = Math.round(Number(s.qty) || 0).toLocaleString('en-US');
            const rateStr = Math.round(Number(s.rate) || 0).toLocaleString('en-US');
            rows.push([s.voyageNo || '', `HĐ ${s.contractNo || ''} ${vesselName} ${s.portLoad || ''} - ${s.portDischarge || ''} (${s.customer || ''}) ${qtyStr} * ${rateStr}`, '', Number(s.revenueReal) || 0, '', '', '']);
            if (s.revenueInvoice > s.revenueReal) rows.push(['', 'VAT tính thêm chuyến này', '', Math.round((s.revenueInvoice - s.revenueReal) / 1.08 * 0.28), '', '', '']);
        });
        rows.push(['', 'Nhiên liệu (Dầu DO & LO)', '', '', d.doCost + d.loCost, '', '']);
        rows.push(['', '  Dầu DO cấp trong tháng', '', '', d.doCost, '', '']);
        rows.push(['', '  Dầu LO chi trong tháng', '', '', d.loCost, '', '']);
        rows.push(['', 'Tàu ứng chi phí trong tháng', '', '', d.vesselAdvances, '', '']);
        rows.push(['', 'Chi phí lương thủy thủ', '', '', d.crewSalary, '', '']);
        rows.push(['', 'Lãi vay phân bổ', '', '', d.totalInterest, '', '']);
        d.interestTxs.forEach(t => rows.push(['', '  ' + (t.content || 'Lãi vay'), '', '', Number(t.chi) || 0, '', '']));
        rows.push(['', 'Chi phí Cảng phát sinh', '', '', d.totalAgent, '', '']);
        d.agentTxs.forEach(t => rows.push(['', '  + ' + (t.content || 'Chi phí cảng'), '', '', Number(t.chi) || 0, '', '']));
        rows.push(['', 'Vật tư mua cấp tàu', '', '', d.totalMaterial, '', '']);
        d.materialTxs.forEach(t => rows.push(['', '  ' + (t.content || 'Vật tư'), '', '', Number(t.chi) || 0, '', '']));
        rows.push(['', 'Bảo hiểm (thân vỏ & BHXH)', '', '', d.totalInsurance, '', '']);
        rows.push(['', '  Bảo hiểm thân vỏ phân bổ', '', '', d.hullInsurance, '', '']);
        rows.push(['', '  Bảo hiểm xã hội', '', '', d.socialInsurance, '', '']);
        rows.push(['', 'Thuế VAT phát sinh chuyến trong tháng', '', '', d.totalVat, '', '']);
        rows.push(['', 'Chi phí văn phòng, Thuế và khác', '', '', customTotal, '', '']);
        inputs.customExpenses.forEach(exp => rows.push(['', '  ' + (exp.desc || ''), '', '', Number(exp.amount) || 0, '', '']));
        rows.push(['', 'CỘNG', Number(inputs.openingBalance) || 0, d.totalRevenueSum, totalCostSum, finalBalance, '']);

        const ws = XLSX.utils.aoa_to_sheet(rows);
        for (let key in ws) { if (key[0] === '!') continue; const cell = ws[key]; if (typeof cell.v === 'number') { cell.t = 'n'; cell.z = '#,##0'; } }
        ws['!cols'] = [{ wch: 8 }, { wch: 55 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 15 }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'BaoCaoThang');
        XLSX.writeFile(wb, `BaoCaoThang_${vesselId}_${monthStr}.xlsx`);
    },
    
    exportFuelReport() {
        if (typeof XLSX === 'undefined') return alert('Chưa tải xong thư viện xuất Excel!');
        const wb = XLSX.utils.book_new();
        const formatDt = (iso) => iso ? new Date(iso).toLocaleString('vi-VN') : '';
        const vessels = AppData.state.vessels;
        
        vessels.forEach(v => {
            const rows = [];
            // Header for the vessel
            rows.push(['BÁO CÁO CHI TIẾT NHIÊN LIỆU - TÀU ' + v.name.toUpperCase()]);
            rows.push([]);
            rows.push([
                'ID Chuyến Dầu',
                'ID Chặng Hành Trình',
                'Mã Tàu',
                'Chuyến Dầu Số',
                'Mặt Hàng',
                'Số Dư Đầu Kỳ (L)',
                'Số Lượng Cấp (L)',
                'Ngày Cấp',
                'Nơi Cấp Dầu',
                'Nhà Cung Cấp Dầu',
                'Đơn Giá Dầu (VNĐ)',
                'Tổng Tiêu Thụ Chuyến (L)',
                'Số Dư Cuối Kỳ (L)',
                'Thứ Tự Chặng',
                'Nơi Đi',
                'Thời Gian Đi',
                'Nơi Đến',
                'Thời Gian Đến',
                'Định Mức Tiêu Thụ (L/h)',
                'Số Giờ Chạy (Giờ)',
                'Tiêu Thụ Chặng (L)'
            ]);
            
            const voyages = AppData.sortVoyages(AppData.getFuelVoyages(v.id), 'asc');
            let runningBalance = 0;
            if (voyages.length > 0) {
                runningBalance = Number(voyages[0].initialFuel || 0);
            }

            voyages.forEach(voy => {
                const stats = AppData.getFuelVoyageStats(voy.id);
                const logs = AppData.getFuelLogs(voy.id);
                runningBalance += Number(voy.addedFuel || 0);
                runningBalance -= stats.totalFuel;
                
                if (logs.length === 0) {
                    rows.push([
                        voy.id,
                        '',
                        v.id,
                        voy.voyageNo,
                        voy.cargoType || '',
                        voy.initialFuel || 0,
                        voy.addedFuel || 0,
                        voy.fuelDate || '',
                        voy.fuelLocation || '',
                        voy.fuelVendor || '',
                        voy.fuelUnitPrice || 0,
                        Math.round(stats.totalFuel),
                        Math.round(runningBalance),
                        '',
                        '',
                        '',
                        '',
                        '',
                        '',
                        '',
                        ''
                    ]);
                } else {
                    logs.forEach((log, idx) => {
                        const fuelRate = Number(log.fuelRate) || 0;
                        const hours = Number(log.hours) || 0;
                        const legConsumption = Calc.legConsumption(hours, fuelRate);

                        if (idx === 0) {
                            rows.push([
                                voy.id,
                                log.id,
                                v.id,
                                voy.voyageNo,
                                voy.cargoType || '',
                                voy.initialFuel || 0,
                                voy.addedFuel || 0,
                                voy.fuelDate || '',
                                voy.fuelLocation || '',
                                voy.fuelVendor || '',
                                voy.fuelUnitPrice || 0,
                                Math.round(stats.totalFuel),
                                Math.round(runningBalance),
                                idx + 1,
                                log.startPos || '',
                                formatDt(log.startTime),
                                log.endPos || '',
                                formatDt(log.endTime),
                                Math.round(fuelRate),
                                hours,
                                legConsumption
                            ]);
                        } else {
                            rows.push([
                                '',
                                log.id,
                                '',
                                '',
                                '',
                                '',
                                '',
                                '',
                                '',
                                '',
                                '',
                                '',
                                '',
                                idx + 1,
                                log.startPos || '',
                                formatDt(log.startTime),
                                log.endPos || '',
                                formatDt(log.endTime),
                                Math.round(fuelRate),
                                hours,
                                legConsumption
                            ]);
                        }
                    });
                }
            });
            const ws = XLSX.utils.aoa_to_sheet(rows);
            // Set column widths
            ws['!cols'] = [
                {wch: 15}, {wch: 15}, {wch: 8}, {wch: 12}, {wch: 12}, 
                {wch: 15}, {wch: 15}, {wch: 12}, {wch: 15}, {wch: 18}, 
                {wch: 15}, {wch: 20}, {wch: 18}, {wch: 10}, {wch: 15}, 
                {wch: 20}, {wch: 15}, {wch: 20}, {wch: 18}, {wch: 15}, 
                {wch: 18}
            ];
            XLSX.utils.book_append_sheet(wb, ws, v.id);
        });
        
        XLSX.writeFile(wb, 'Bao_Cao_Nhien_Lieu_' + new Date().toISOString().slice(0,10) + '.xlsx');
    },

    exportFinancialReport(selectedMonth = '', selectedVessel = '', selectedCategory = '', selectedPartner = '') {
        if (typeof XLSX === 'undefined') return alert('Chưa tải xong thư viện xuất Excel!');
        if (selectedMonth === 'undefined') selectedMonth = '';
        if (selectedVessel === 'undefined') selectedVessel = '';
        if (selectedCategory === 'undefined') selectedCategory = '';
        if (selectedPartner === 'undefined') selectedPartner = '';
        
        const wb = XLSX.utils.book_new();
        const rows = [];
        
        rows.push(['BÁO CÁO CHI TIẾT TỔNG HỢP GIAO DỊCH THU CHI']);
        rows.push([]);
        rows.push([
            'ID Giao Dịch',
            'Ngày',
            'Tàu / Bộ Phận',
            'Hạng Mục',
            'Chuyến Số',
            'Số Hợp Đồng',
            'Đối Tác',
            'Nội Dung',
            'Thu Vào (VNĐ)',
            'Chi Ra (VNĐ)',
            'Tài Khoản'
        ]);
        
        let trans = AppData.getTransactions() || [];
        if (selectedMonth) {
            trans = trans.filter(t => t.date && t.date.substring(0, 7) === selectedMonth);
        }
        if (selectedVessel) {
            trans = trans.filter(t => t.vessel === selectedVessel);
        }
        if (selectedCategory) {
            trans = trans.filter(t => t.category === selectedCategory);
        }
        if (selectedPartner) {
            trans = trans.filter(t => t.partner === selectedPartner);
        }
        
        const sortedTrans = trans.slice().sort((a, b) => (a.date || '').localeCompare(b.date || ''));
        
        sortedTrans.forEach(t => {
            rows.push([
                t.id || '',
                t.date || '',
                t.vessel || '',
                t.category || '',
                t.voyageNo || '',
                t.contractNo || '',
                t.partner || '',
                t.content || '',
                Number(t.thu) || 0,
                Number(t.chi) || 0,
                t.account || ''
            ]);
        });
        
        const ws = XLSX.utils.aoa_to_sheet(rows);
        ws['!cols'] = [
            {wch: 15}, // ID
            {wch: 12}, // Ngay
            {wch: 15}, // Tau/Bo phan
            {wch: 15}, // Hang muc
            {wch: 10}, // Chuyen So
            {wch: 15}, // So Hop Dong
            {wch: 25}, // Doi Tac
            {wch: 40}, // Noi dung
            {wch: 18}, // Thu
            {wch: 18}, // Chi
            {wch: 18}  // Tai Khoan
        ];
        
        let suffix = selectedMonth ? selectedMonth : 'Tat_Ca';
        if (selectedVessel) suffix += '_' + selectedVessel;
        if (selectedCategory) suffix += '_' + selectedCategory.replace(/[^a-zA-Z0-9]/g, '');
        if (selectedPartner) suffix += '_' + selectedPartner.replace(/[^a-zA-Z0-9]/g, '');
        
        const filename = 'Bao_Cao_Giao_Dich_' + suffix + '_' + new Date().toISOString().slice(0, 10) + '.xlsx';
        XLSX.utils.book_append_sheet(wb, ws, 'Giao_Dich');
        XLSX.writeFile(wb, filename);
    },

    // === JSON Backup/Restore (sao lưu trung thực từ state trong bộ nhớ) ===
    exportLocalJSON() {
        const data = (AppData.state) ? JSON.stringify(AppData.state) : localStorage.getItem('shipManageDB_v2');
        if (!data) return alert('Không tìm thấy dữ liệu!');
        try {
            // Định dạng đẹp + đính kèm metadata để dễ kiểm tra
            const state = JSON.parse(data);
            const counts = {};
            ['transactions', 'fuelLogs', 'fuelVoyages', 'shipments', 'captainReports',
             'vesselExpenses', 'timesheets', 'employees', 'vendors', 'customers', 'vessels']
                .forEach(k => { if (Array.isArray(state[k])) counts[k] = state[k].length; });
            const payload = {
                _backupMeta: {
                    app: 'ShipManage',
                    schema: 'shipManageDB_v2',
                    exportedAt: new Date().toISOString(),
                    sizeKB: Math.round(data.length / 1024),
                    counts
                },
                state
            };
            const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'shipmanage_backup_' + new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-') + '.json';
            a.click();
            URL.revokeObjectURL(a.href);
            console.log('✅ Đã xuất backup JSON:', payload._backupMeta);
        } catch (e) {
            alert('Lỗi khi xuất backup JSON: ' + e.message);
        }
    },

    importLocalJSON(event) {
        const file = event.target.files && event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const parsed = JSON.parse(e.target.result);
                // Hỗ trợ cả 2 dạng: {state:{...}} (có metadata) hoặc state thuần
                const newState = parsed && parsed.state ? parsed.state : parsed;
                if (!newState || typeof newState !== 'object' || !Array.isArray(newState.transactions)) {
                    throw new Error('File không đúng định dạng backup ShipManage (thiếu mảng transactions).');
                }
                const meta = parsed._backupMeta;
                const summary = meta && meta.counts
                    ? Object.entries(meta.counts).map(([k, v]) => `  • ${k}: ${v}`).join('\n')
                    : `  • transactions: ${newState.transactions.length}`;
                const ok = confirm(
                    '⚠️ KHÔI PHỤC TỪ JSON sẽ GHI ĐÈ toàn bộ dữ liệu hiện tại trên trình duyệt này.\n\n' +
                    'Dữ liệu trong file:\n' + summary + '\n\n' +
                    (meta ? 'Xuất lúc: ' + meta.exportedAt + '\n\n' : '') +
                    'Bạn có chắc chắn muốn tiếp tục? (Nên Tải Backup JSON hiện tại trước khi khôi phục.)'
                );
                if (!ok) { event.target.value = ''; return; }
                localStorage.setItem('shipManageDB_v2', JSON.stringify(newState));
                AppData.state = newState;
                AppData.save();
                this.navigate(this.currentView || 'dashboard');
                alert('✅ Đã khôi phục dữ liệu từ JSON thành công!');
            } catch (err) {
                alert('❌ Lỗi khi đọc file JSON: ' + err.message);
            } finally {
                event.target.value = '';
            }
        };
        reader.readAsText(file);
    },

    exportSystemBackup() {
        if (typeof XLSX === 'undefined') return alert('Chưa tải xong thư viện xuất Excel!');
        const wb = XLSX.utils.book_new();

        // 1. Quản lý chuyến hàng
        const shipmentsRows = [];
        shipmentsRows.push(['DANH SÁCH CHI TIẾT CHUYẾN HÀNG']);
        shipmentsRows.push([]);
        shipmentsRows.push([
            'ID Chuyến Hàng', 'Số Hợp Đồng', 'Chuyến Số', 'Mã Tàu', 'Khách Hàng', 'Tên Hàng', 
            'Cảng Xếp (Đi)', 'Cảng Dỡ (Đến)', 'Ngày Xếp Hàng', 'Ngày Dỡ Hàng', 'Tháng Hạch Toán', 
            'Khối Lượng (Tấn)', 'Đơn Giá Thực (VNĐ)', 'Tiền Gửi (VND/tấn)', 'Giá Dầu Chuyến (VNĐ)', 
            'Số Giờ Chạy (Giờ)', 'Doanh Thu Thực Tế (VNĐ)', 'Doanh Thu Hóa Đơn (VNĐ)', 
            'Tiền Gửi Lại Khách (VNĐ)', 'Tiền Dầu DO (VNĐ)', 'Tiền Dầu LO (VNĐ)', 'Lương TV (VNĐ)', 
            'Tiền Ăn (VNĐ)', 'Bảo Hiểm (VNĐ)', 'Vật Tư Cty Cấp (VNĐ)', 'Vật Tư Tàu Chi (VNĐ)', 
            'CP Khác Cty Cấp (VNĐ)', 'Đại Lý 2 Đầu Cảng (VNĐ)', 'Tàu Chi 2 Đầu Cảng (VNĐ)', 
            'Tiền Bông (VNĐ)', 'Thuế VAT (VNĐ)', 'Hoa Tiêu, Tàu Lai, Phí Cảng (VNĐ)', 
            'Chi Phí Khác Tàu Chi (VNĐ)', 'Tổng Chi Phí (VNĐ)', 'Lợi Nhuận/Hiệu Quả (VNĐ)'
        ]);
        const ships = AppData.state.shipments || [];
        ships.forEach(s => {
            const qty = Number(s.qty || 0);
            const rate = Number(s.rate || 0);
            const markup = Number(s.markup || 0);
            const fuelPrice = Number(s.fuelPrice || 20000);
            const fuelHours = Number(s.fuelHours || 0);
            const revenueReal = Number(s.revenueReal || 0);
            const revenueInvoice = Number(s.revenueInvoice || 0);
            const refund = Number(s.refundAmount || 0);
            const costs = s.costs || {};
            const fuelDO = Number(costs.fuelDO || 0);
            const fuelLO = Number(costs.fuelLO || 0);
            const crewSalary = Number(costs.crewSalary || 0);
            const crewFood = Number(costs.crewFood || 0);
            const crewInsurance = Number(costs.crewInsurance || 0);
            const materialCompany = Number(costs.materialCompany || 0);
            const materialVessel = Number(costs.materialVessel || 0);
            const monthlyOther = Number(costs.monthlyOther || 0);
            const agent = Number(costs.agent || 0);
            const vessel2ends = Number(costs.vessel2ends || 0);
            const brokerage = Number(costs.brokerage || 0);
            const vat = Number(costs.vat || 0);
            const portFees = Number(costs.portFees || 0);
            const others = Number(costs.others || 0);
            const totalExpenses = fuelDO + fuelLO + crewSalary + crewFood + crewInsurance + 
                                  materialCompany + materialVessel + monthlyOther + agent + 
                                  vessel2ends + brokerage + vat + portFees + others;
            const profit = revenueReal - totalExpenses;
            shipmentsRows.push([
                s.id || '', s.contractNo || '', s.voyageNo || '', s.vesselId || '', s.customer || '', s.cargo || '',
                s.portLoad || '', s.portDischarge || '', s.dateStart || '', s.dateEnd || '', s.reportMonth || '',
                qty, rate, markup, fuelPrice, fuelHours, revenueReal, revenueInvoice, refund,
                fuelDO, fuelLO, crewSalary, crewFood, crewInsurance, materialCompany, materialVessel,
                monthlyOther, agent, vessel2ends, brokerage, vat, portFees, others, totalExpenses, profit
            ]);
        });
        const wsShipments = XLSX.utils.aoa_to_sheet(shipmentsRows);
        wsShipments['!cols'] = Array(35).fill({wch: 15});
        XLSX.utils.book_append_sheet(wb, wsShipments, 'Quản lý chuyến hàng');

        // 2. Quản lý nhiên liệu
        const fuelRows = [];
        fuelRows.push(['DANH SÁCH CHI TIẾT NHIÊN LIỆU TOÀN BỘ CÁC TÀU']);
        fuelRows.push([]);
        fuelRows.push([
            'ID Chuyến Dầu', 'ID Chặng Hành Trình', 'Mã Tàu', 'Chuyến Dầu Số', 'Mặt Hàng',
            'Số Dư Đầu Kỳ (L)', 'Số Lượng Cấp (L)', 'Ngày Cấp', 'Nơi Cấp Dầu', 'Nhà Cung Cấp Dầu',
            'Đơn Giá Dầu (VNĐ)', 'Tổng Tiêu Thụ Chuyến (L)', 'Số Dư Cuối Kỳ (L)', 'Thứ Tự Chặng',
            'Nơi Đi', 'Thời Gian Đi', 'Nơi Đến', 'Thời Gian Đến', 'Định Mức Tiêu Thụ (L/h)',
            'Số Giờ Chạy (Giờ)', 'Tiêu Thụ Chặng (L)'
        ]);
        const formatDt = (iso) => iso ? new Date(iso).toLocaleString('vi-VN') : '';
        const vessels = AppData.state.vessels || [];
        vessels.forEach(v => {
            const voyages = AppData.sortVoyages(AppData.getFuelVoyages(v.id), 'asc') || [];
            let runningBalance = 0;
            if (voyages.length > 0) {
                runningBalance = Number(voyages[0].initialFuel || 0);
            }
            voyages.forEach(voy => {
                const stats = AppData.getFuelVoyageStats(voy.id) || { totalFuel: 0 };
                const logs = AppData.getFuelLogs(voy.id) || [];
                runningBalance += Number(voy.addedFuel || 0);
                runningBalance -= stats.totalFuel;
                
                if (logs.length === 0) {
                    fuelRows.push([
                        voy.id, '', v.id, voy.voyageNo, voy.cargoType || '', voy.initialFuel || 0,
                        voy.addedFuel || 0, voy.fuelDate || '', voy.fuelLocation || '', voy.fuelVendor || '',
                        voy.fuelUnitPrice || 0, Math.round(stats.totalFuel), Math.round(runningBalance),
                        '', '', '', '', '', '', '', ''
                    ]);
                } else {
                    logs.forEach((log, idx) => {
                        const fuelRate = Number(log.fuelRate) || 0;
                        const hours = Number(log.hours) || 0;
                        const legConsumption = Calc.legConsumption(hours, fuelRate);
                        if (idx === 0) {
                            fuelRows.push([
                                voy.id, log.id, v.id, voy.voyageNo, voy.cargoType || '', voy.initialFuel || 0,
                                voy.addedFuel || 0, voy.fuelDate || '', voy.fuelLocation || '', voy.fuelVendor || '',
                                voy.fuelUnitPrice || 0, Math.round(stats.totalFuel), Math.round(runningBalance),
                                idx + 1, log.startPos || '', formatDt(log.startTime), log.endPos || '',
                                formatDt(log.endTime), Math.round(fuelRate), hours, legConsumption
                            ]);
                        } else {
                            fuelRows.push([
                                '', log.id, '', '', '', '', '', '', '', '', '', '', '',
                                idx + 1, log.startPos || '', formatDt(log.startTime), log.endPos || '',
                                formatDt(log.endTime), Math.round(fuelRate), hours, legConsumption
                            ]);
                        }
                    });
                }
            });
        });
        const wsFuel = XLSX.utils.aoa_to_sheet(fuelRows);
        wsFuel['!cols'] = Array(21).fill({wch: 15});
        XLSX.utils.book_append_sheet(wb, wsFuel, 'Quản lý nhiên liệu');

        // 3. Theo dõi tài chính
        const finRows = [];
        finRows.push(['DANH SÁCH CHI TIẾT TỔNG HỢP GIAO DỊCH THU CHI']);
        finRows.push([]);
        finRows.push([
            'ID Giao Dịch', 'Ngày', 'Tàu / Bộ Phận', 'Hạng Mục', 'Chuyến Số', 
            'Số Hợp Đồng', 'Đối Tác', 'Nội Dung', 'Thu Vào (VNĐ)', 'Chi Ra (VNĐ)', 'Tài Khoản'
        ]);
        const trans = AppData.state.transactions || [];
        const sortedTrans = trans.slice().sort((a, b) => (a.date || '').localeCompare(b.date || ''));
        sortedTrans.forEach(t => {
            finRows.push([
                t.id || '', t.date || '', t.vessel || '', t.category || '', t.voyageNo || '',
                t.contractNo || '', t.partner || '', t.content || '', Number(t.thu) || 0, Number(t.chi) || 0, t.account || ''
            ]);
        });
        const wsFin = XLSX.utils.aoa_to_sheet(finRows);
        wsFin['!cols'] = Array(11).fill({wch: 15});
        XLSX.utils.book_append_sheet(wb, wsFin, 'Theo dõi tài chính');

        // 4. Quản lý chi phí tàu (Báo cáo Thuyền trưởng)
        const capRows = [];
        capRows.push(['DANH SÁCH BÁO CÁO THUYỀN TRƯỞNG & CHI PHÍ TÀU']);
        capRows.push([]);
        capRows.push([
            'Mã Báo Cáo', 'Mã Tàu', 'Tháng', 'Tiền Ăn (VNĐ)', 'Vật Tư Tàu Chi (VNĐ)', 
            'Tên Khoản Mục Cảng', 'Chuyến Cảng', 'Số Tiền Cảng (VNĐ)', 
            'Chuyến Tiền Bông', 'Số Tiền Bông (VNĐ)'
        ]);
        const reports = AppData.state.captainReports || [];
        const sortedReports = reports.slice().sort((a, b) => (a.month || '').localeCompare(b.month || '') || (a.vesselId || '').localeCompare(b.vesselId || ''));
        sortedReports.forEach(r => {
            const portExps = r.portExpenses || [];
            const brokerages = r.brokerages || [];
            const maxLen = Math.max(portExps.length, brokerages.length, 1);
            for (let i = 0; i < maxLen; i++) {
                const portItem = portExps[i] || {};
                const brokItem = brokerages[i] || {};
                if (i === 0) {
                    capRows.push([
                        r.id || '',
                        r.vesselId || '',
                        r.month || '',
                        Number(r.food) || 0,
                        Number(r.material) || 0,
                        portItem.port || '',
                        portItem.voyageNo || '',
                        Number(portItem.amount) || 0,
                        brokItem.voyageNo || '',
                        Number(brokItem.amount) || 0
                    ]);
                } else {
                    capRows.push([
                        '',
                        '',
                        '',
                        '',
                        '',
                        portItem.port || '',
                        portItem.voyageNo || '',
                        Number(portItem.amount) || 0,
                        brokItem.voyageNo || '',
                        Number(brokItem.amount) || 0
                    ]);
                }
            }
        });
        const wsExp = XLSX.utils.aoa_to_sheet(capRows);
        wsExp['!cols'] = Array(10).fill({wch: 15});
        XLSX.utils.book_append_sheet(wb, wsExp, 'Quản lý chi phí tàu');

        // 5. Nhân sự
        const hrRows = [];
        hrRows.push(['DANH SÁCH NHÂN SỰ VÀ THÔNG TIN LƯƠNG ĐỊNH BÌNH']);
        hrRows.push([]);
        hrRows.push([
            'ID Nhân Sự', 'Họ và Tên', 'Chức Vụ', 'Bộ Phận', 'Lương Cơ Bản (VNĐ)', 'Phụ Cấp (VNĐ)', 
            'Giảm Trừ Bản Thân (VNĐ)', 'Số Người Phụ Thuộc', 'Ngày Vào', 'Ngày Nghỉ', 'Số Điện Thoại', 'Ghi Chú',
            'Mức Lương Thực Tế (VNĐ)', 'Mức BHXH Đóng (VNĐ)', 'Tiền Ăn Ca (VNĐ)', 'Phụ Cấp Điện Thoại (VNĐ)',
            'Phụ Cấp Trang Phục (VNĐ)', 'Phụ Cấp Xăng Xe (VNĐ)', 'Phụ Cấp Giao Nhận (VNĐ)', 'Thưởng Hoàn Thành (VNĐ)'
        ]);
        const employees = AppData.getEmployees() || [];
        employees.forEach(e => {
            hrRows.push([
                e.id || '', e.name || '', e.role || '', e.department || '', Number(e.basicSalary) || 0, Number(e.allowances) || 0,
                Number(e.personalDeduction) || 15500000, Number(e.dependents) || 0, e.joinDate || '', e.leaveDate || '',
                e.phone || '', e.notes || '', Number(e.actualSalary) || 0, Number(e.insurance) || 0, Number(e.mealAllowance) || 0,
                Number(e.phoneAllowance) || 0, Number(e.clothingAllowance) || 0, Number(e.transportAllowance) || 0,
                Number(e.deliveryAllowance) || 0, Number(e.completionBonus) || 0
            ]);
        });
        const wsHr = XLSX.utils.aoa_to_sheet(hrRows);
        wsHr['!cols'] = Array(20).fill({wch: 15});
        XLSX.utils.book_append_sheet(wb, wsHr, 'Nhân sự');

        // 6. Lương
        const salRows = [];
        salRows.push(['DANH SÁCH BẢNG CHẤM CÔNG VÀ ĐIỂM DANH HÀNG THÁNG']);
        salRows.push([]);
        salRows.push([
            'Tháng', 'Bộ Phận', 'Số Chuyến', 'Dữ Liệu Điểm Danh (JSON)'
        ]);
        const tsheets = AppData.state.timesheets || [];
        tsheets.forEach(ts => {
            salRows.push([
                ts.month || '', ts.department || '', Number(ts.voyageCount) || 0, JSON.stringify(ts.attendance || {})
            ]);
        });
        const wsSal = XLSX.utils.aoa_to_sheet(salRows);
        wsSal['!cols'] = Array(4).fill({wch: 15});
        XLSX.utils.book_append_sheet(wb, wsSal, 'Lương');

        // 7. Chi phí theo tháng
        const mCostsRows = [];
        mCostsRows.push(['DANH SÁCH CHI PHÍ CỐ ĐỊNH THEO THÁNG CỦA CÁC TÀU']);
        mCostsRows.push([]);
        mCostsRows.push([
            'Tháng', 'Mã Tàu', 'Lương (VNĐ)', 'Bảo Hiểm (VNĐ)', 'Tiền Ăn (VNĐ)',
            'Vật Tư Công Ty Cấp (VNĐ)', 'Vật Tư Tàu Chi (VNĐ)', 'Chi Phí Khác (VNĐ)', 'Lãi Vay (VNĐ)'
        ]);
        const mCosts = AppData.state.monthlyCosts || [];
        mCosts.forEach(c => {
            mCostsRows.push([
                c.month || '', c.vesselId || '', Number(c.salary) || 0, Number(c.insurance) || 0, Number(c.food) || 0,
                Number(c.materialCompany) || 0, Number(c.materialVessel) || 0, Number(c.other) || 0, Number(c.loanInterest) || 0
            ]);
        });
        const wsMcosts = XLSX.utils.aoa_to_sheet(mCostsRows);
        wsMcosts['!cols'] = Array(9).fill({wch: 15});
        XLSX.utils.book_append_sheet(wb, wsMcosts, 'Chi phí theo tháng');

        // 8. Đối tác
        const partnerRows = [];
        partnerRows.push(['DANH SÁCH KHÁCH HÀNG VÀ NHÀ CUNG CẤP']);
        partnerRows.push([]);
        partnerRows.push(['Loại', 'ID Đối Tác', 'Tên Đối Tác', 'Phân Loại / Mặt Hàng', 'Liên Hệ', 'Địa Chỉ']);
        const vendors = AppData.state.vendors || [];
        vendors.forEach(v => {
            partnerRows.push(['NCC', v.id || '', v.name || '', v.type || '', v.contact || '', v.address || '']);
        });
        const customers = AppData.state.customers || [];
        customers.forEach(c => {
            partnerRows.push(['Khách Hàng', c.id || '', c.name || '', '', c.contact || '', c.address || '']);
        });
        const wsPartner = XLSX.utils.aoa_to_sheet(partnerRows);
        wsPartner['!cols'] = Array(6).fill({wch: 15});
        XLSX.utils.book_append_sheet(wb, wsPartner, 'Đối tác');

        // 9. Tàu
        const vesselRows = [];
        vesselRows.push(['DANH SÁCH CÁC TÀU VÀ ĐỊNH MỨC']);
        vesselRows.push([]);
        vesselRows.push(['Mã Tàu', 'Tên Tàu', 'Trọng Tải (Tấn)', 'Thuyền Trưởng', 'Định Mức Dầu DO (L/h)']);
        const ves = AppData.state.vessels || [];
        ves.forEach(v => {
            vesselRows.push([v.id || '', v.name || '', Number(v.capacity) || 0, v.captain || '', Number(v.fuelRate) || 0]);
        });
        const wsVessels = XLSX.utils.aoa_to_sheet(vesselRows);
        wsVessels['!cols'] = Array(5).fill({wch: 15});
        XLSX.utils.book_append_sheet(wb, wsVessels, 'Tàu');

        // 10. Thông tin công ty
        const compRows = [];
        compRows.push(['THÔNG TIN DOANH NGHIỆP VÀ SỐ DƯ ĐẦU KỲ']);
        compRows.push([]);
        compRows.push([
            'Tên Doanh Nghiệp', 'Mã Số Thuế', 'Thông Tin Ngân Hàng', 'Địa Chỉ',
            'Số Dư Đầu Kỳ ABbank (VNĐ)', 'Số Dư Đầu Kỳ Viettinbank (VNĐ)', 
            'Số Dư Đầu Kỳ Tài Khoản Cá Nhân (VNĐ)', 'Số Dư Đầu Kỳ Tiền Mặt (VNĐ)'
        ]);
        const comp = AppData.state.company || {};
        const balances = comp.openingBalances || {};
        compRows.push([
            comp.name || '', comp.taxId || '', comp.bankInfo || '', comp.address || '',
            Number(balances.ABbank) || 0, Number(balances.Viettinbank) || 0,
            Number(balances['Tài khoản cá nhân']) || 0, Number(balances['Tiền mặt']) || 0
        ]);
        const wsComp = XLSX.utils.aoa_to_sheet(compRows);
        wsComp['!cols'] = Array(8).fill({wch: 15});
        XLSX.utils.book_append_sheet(wb, wsComp, 'Thông tin công ty');

        // Save Workbook
        const filename = 'Bao_Cao_Sao_Luu_He_Thong_' + new Date().toISOString().slice(0, 10) + '.xlsx';
        XLSX.writeFile(wb, filename);
    },

    // Tìm cột Excel bền: ưu tiên theo tên (chuẩn hóa lowercase, bỏ dấu cách thừa);
    // nếu không thấy, dùng vị trí cố định (fallback) để KHÔNG ghi sai dữ liệu khi user đổi tên cột.
    _resolveColIdx(headers, primaryName, fallbackIdx) {
        if (!Array.isArray(headers)) return fallbackIdx;
        const norm = s => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
        const want = norm(primaryName);
        for (let i = 0; i < headers.length; i++) if (norm(headers[i]) === want) return i;
        // không thấy -> fallback
        if (typeof fallbackIdx === 'number') {
            console.warn('[Import] Không tìm thấy cột "' + primaryName + '" theo tên, dùng cột số ' + (fallbackIdx + 1));
            return fallbackIdx;
        }
        return -1;
    },
    importSystemBackupExcel(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const data = new Uint8Array(evt.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                
                const parseExcelDate = (val) => {
                    if (!val) return '';
                    if (typeof val === 'number') {
                        const excelEpoch = new Date(Date.UTC(1899, 11, 30));
                        const dateObj = new Date(excelEpoch.getTime() + val * 24 * 60 * 60 * 1000);
                        return dateObj.toISOString().slice(0, 10);
                    }
                    const str = String(val).trim();
                    if (str.match(/^\d{4}-\d{2}-\d{2}$/)) return str;
                    if (str.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
                        const parts = str.split('/');
                        const d = parts[0].padStart(2, '0');
                        const m = parts[1].padStart(2, '0');
                        const y = parts[2];
                        return `${y}-${m}-${d}`;
                    }
                    const parsed = new Date(str);
                    return isNaN(parsed.getTime()) ? str : parsed.toISOString().slice(0, 10);
                };

                const parseExcelDateTime = (val) => {
                    if (!val) return '';
                    if (typeof val === 'number') {
                        const excelEpoch = new Date(Date.UTC(1899, 11, 30));
                        const dateObj = new Date(excelEpoch.getTime() + val * 24 * 60 * 60 * 1000);
                        return dateObj.toISOString();
                    }
                    const str = String(val).trim();
                    const parts = str.split(', ');
                    if (parts.length === 2) {
                        const [datePart, timePart] = parts;
                        const [d, m, y] = datePart.split('/');
                        return `${y}-${m}-${d}T${timePart}`;
                    }
                    const dateObj = new Date(str);
                    return isNaN(dateObj.getTime()) ? str : dateObj.toISOString();
                };

                let restoredSheets = [];

                // 1. Quản lý chuyến hàng
                const wsShipments = workbook.Sheets['Quản lý chuyến hàng'];
                if (wsShipments) {
                    const rows = XLSX.utils.sheet_to_json(wsShipments, { header: 1 });
                    if (rows.length >= 3) {
                        const headers = rows[2];
                        const dataRows = rows.slice(3);
                        const colIdx = (name) => headers.indexOf(name);
                        
                        const idIdx = colIdx('ID Chuyến Hàng');
                        const contractNoIdx = colIdx('Số Hợp Đồng');
                        const voyageNoIdx = colIdx('Chuyến Số');
                        const vesselIdIdx = colIdx('Mã Tàu');
                        const customerIdx = colIdx('Khách Hàng');
                        const cargoIdx = colIdx('Tên Hàng');
                        const portLoadIdx = colIdx('Cảng Xếp (Đi)');
                        const portDischargeIdx = colIdx('Cảng Dỡ (Đến)');
                        const dateStartIdx = colIdx('Ngày Xếp Hàng');
                        const dateEndIdx = colIdx('Ngày Dỡ Hàng');
                        const reportMonthIdx = colIdx('Tháng Hạch Toán');
                        const qtyIdx = colIdx('Khối Lượng (Tấn)');
                        const rateIdx = colIdx('Đơn Giá Thực (VNĐ)');
                        const markupIdx = colIdx('Tiền Gửi (VND/tấn)');
                        const fuelPriceIdx = colIdx('Giá Dầu Chuyến (VNĐ)');
                        const fuelHoursIdx = colIdx('Số Giờ Chạy (Giờ)');
                        const revenueRealIdx = colIdx('Doanh Thu Thực Tế (VNĐ)');
                        const revenueInvoiceIdx = colIdx('Doanh Thu Hóa Đơn (VNĐ)');
                        const refundIdx = colIdx('Tiền Gửi Lại Khách (VNĐ)');
                        
                        const costsMap = {
                            fuelDO: colIdx('Tiền Dầu DO (VNĐ)'),
                            fuelLO: colIdx('Tiền Dầu LO (VNĐ)'),
                            crewSalary: colIdx('Lương TV (VNĐ)'),
                            crewFood: colIdx('Tiền Ăn (VNĐ)'),
                            crewInsurance: colIdx('Bảo Hiểm (VNĐ)'),
                            materialCompany: colIdx('Vật Tư Cty Cấp (VNĐ)'),
                            materialVessel: colIdx('Vật Tư Tàu Chi (VNĐ)'),
                            monthlyOther: colIdx('CP Khác Cty Cấp (VNĐ)'),
                            agent: colIdx('Đại Lý 2 Đầu Cảng (VNĐ)'),
                            vessel2ends: colIdx('Tàu Chi 2 Đầu Cảng (VNĐ)'),
                            brokerage: colIdx('Tiền Bông (VNĐ)'),
                            vat: colIdx('Thuế VAT (VNĐ)'),
                            portFees: colIdx('Hoa Tiêu, Tàu Lai, Phí Cảng (VNĐ)'),
                            others: colIdx('Chi Phí Khác Tàu Chi (VNĐ)')
                        };

                        dataRows.forEach(row => {
                            if (row.length === 0 || !row[contractNoIdx]) return;
                            const id = row[idIdx] || ('S' + Date.now() + Math.random().toString().slice(2, 6));
                            const s = {
                                id,
                                contractNo: String(row[contractNoIdx] || '').trim(),
                                voyageNo: String(row[voyageNoIdx] || '').trim(),
                                vesselId: String(row[vesselIdIdx] || '').trim(),
                                customer: String(row[customerIdx] || '').trim(),
                                cargo: String(row[cargoIdx] || '').trim(),
                                portLoad: String(row[portLoadIdx] || '').trim(),
                                portDischarge: String(row[portDischargeIdx] || '').trim(),
                                dateStart: row[dateStartIdx] ? parseExcelDate(row[dateStartIdx]) : '',
                                dateEnd: row[dateEndIdx] ? parseExcelDate(row[dateEndIdx]) : '',
                                reportMonth: String(row[reportMonthIdx] || '').trim(),
                                qty: Number(row[qtyIdx]) || 0,
                                rate: Number(row[rateIdx]) || 0,
                                markup: Number(row[markupIdx]) || 0,
                                fuelPrice: Number(row[fuelPriceIdx]) || 0,
                                fuelHours: Number(row[fuelHoursIdx]) || 0,
                                revenueReal: Number(row[revenueRealIdx]) || 0,
                                revenueInvoice: Number(row[revenueInvoiceIdx]) || 0,
                                refundAmount: Number(row[refundIdx]) || 0,
                                costs: {}
                            };
                            for (let key in costsMap) {
                                const idx = costsMap[key];
                                s.costs[key] = idx !== -1 ? (Number(row[idx]) || 0) : 0;
                            }
                            
                            const existingIdx = AppData.state.shipments.findIndex(x => x.id === id);
                            if (existingIdx >= 0) AppData.state.shipments[existingIdx] = s;
                            else AppData.state.shipments.push(s);
                        });
                        restoredSheets.push('Quản lý chuyến hàng');
                    }
                }

                // 2. Quản lý nhiên liệu
                const wsFuel = workbook.Sheets['Quản lý nhiên liệu'];
                if (wsFuel) {
                    const rows = XLSX.utils.sheet_to_json(wsFuel, { header: 1 });
                    if (rows.length >= 3) {
                        const headers = rows[2];
                        const dataRows = rows.slice(3);
                        const colIdx = (name) => headers.indexOf(name);
                        
                        const voyIdIdx = colIdx('ID Chuyến Dầu');
                        const logIdIdx = colIdx('ID Chặng Hành Trình');
                        const vesselIdIdx = colIdx('Mã Tàu');
                        const voyageNoIdx = colIdx('Chuyến Dầu Số');
                        const cargoTypeIdx = colIdx('Mặt Hàng');
                        const initialFuelIdx = colIdx('Số Dư Đầu Kỳ (L)');
                        const addedFuelIdx = colIdx('Số Lượng Cấp (L)');
                        const fuelDateIdx = colIdx('Ngày Cấp');
                        const fuelLocationIdx = colIdx('Nơi Cấp Dầu');
                        const fuelVendorIdx = colIdx('Nhà Cung Cấp Dầu');
                        const fuelUnitPriceIdx = colIdx('Đơn Giá Dầu (VNĐ)');
                        
                        const startPosIdx = colIdx('Nơi Đi');
                        const startTimeIdx = colIdx('Thời Gian Đi');
                        const endPosIdx = colIdx('Nơi Đến');
                        const endTimeIdx = colIdx('Thời Gian Đến');
                        const fuelRateIdx = colIdx('Định Mức Tiêu Thụ (L/h)');
                        const hoursIdx = colIdx('Số Giờ Chạy (Giờ)');
                        
                        let lastVoyageId = '';
                        let lastVesselId = '';
                        
                        dataRows.forEach(row => {
                            if (row.length === 0) return;
                            if (row[voyIdIdx]) {
                                lastVoyageId = String(row[voyIdIdx]).trim();
                                lastVesselId = String(row[vesselIdIdx] || lastVesselId).trim();
                                const voy = {
                                    id: lastVoyageId,
                                    vesselId: lastVesselId,
                                    voyageNo: String(row[voyageNoIdx] || '').trim(),
                                    cargoType: String(row[cargoTypeIdx] || '').trim(),
                                    initialFuel: Number(row[initialFuelIdx]) || 0,
                                    addedFuel: Number(row[addedFuelIdx]) || 0,
                                    fuelDate: row[fuelDateIdx] ? parseExcelDate(row[fuelDateIdx]) : '',
                                    fuelVendor: String(row[fuelVendorIdx] || '').trim(),
                                    fuelLocation: String(row[fuelLocationIdx] || '').trim(),
                                    fuelUnitPrice: Number(row[fuelUnitPriceIdx]) || 0
                                };
                                const existingIdx = AppData.state.fuelVoyages.findIndex(x => x.id === voy.id);
                                if (existingIdx >= 0) AppData.state.fuelVoyages[existingIdx] = voy;
                                else AppData.state.fuelVoyages.push(voy);
                            }
                            if (row[logIdIdx] && lastVoyageId) {
                                const logId = String(row[logIdIdx]).trim();
                                const log = {
                                    id: logId,
                                    fuelVoyageId: lastVoyageId,
                                    startTime: parseExcelDateTime(row[startTimeIdx]),
                                    startPos: String(row[startPosIdx] || '').trim(),
                                    endTime: parseExcelDateTime(row[endTimeIdx]),
                                    endPos: String(row[endPosIdx] || '').trim(),
                                    fuelRate: Number(row[fuelRateIdx]) || 0,
                                    hours: Number(row[hoursIdx]) || 0
                                };
                                const existingIdx = AppData.state.fuelLogs.findIndex(x => x.id === log.id);
                                if (existingIdx >= 0) AppData.state.fuelLogs[existingIdx] = log;
                                else AppData.state.fuelLogs.push(log);
                            }
                        });
                        restoredSheets.push('Quản lý nhiên liệu');
                    }
                }

                // 3. Theo dõi tài chính
                const wsFin = workbook.Sheets['Theo dõi tài chính'];
                const affectedAllocations = new Set();
                if (wsFin) {
                    const rows = XLSX.utils.sheet_to_json(wsFin, { header: 1 });
                    if (rows.length >= 3) {
                        const headers = rows[2];
                        const dataRows = rows.slice(3);
                        const ci = (name, idx) => this._resolveColIdx(headers, name, idx);

                        const idIdx = ci('ID Giao Dịch', 0);
                        const dateIdx = ci('Ngày', 1);
                        const vesselIdx = ci('Tàu / Bộ Phận', 2);
                        const categoryIdx = ci('Hạng Mục', 3);
                        const voyageNoIdx = ci('Chuyến Số', 4);
                        const contractNoIdx = ci('Số Hợp Đồng', 5);
                        const partnerIdx = ci('Đối Tác', 6);
                        const contentIdx = ci('Nội Dung', 7);
                        const thuIdx = ci('Thu Vào (VNĐ)', 8);
                        const chiIdx = ci('Chi Ra (VNĐ)', 9);
                        const accountIdx = ci('Tài Khoản', 10);
                        
                        dataRows.forEach(row => {
                            if (row.length === 0 || !row[dateIdx]) return;
                            const id = row[idIdx] ? String(row[idIdx]).trim() : ('TR' + Date.now() + Math.random().toString().slice(2, 6));
                            const dateStr = parseExcelDate(row[dateIdx]);
                            const t = {
                                id,
                                date: dateStr,
                                vessel: String(row[vesselIdx] || 'VP').trim(),
                                category: String(row[categoryIdx] || '').trim(),
                                voyageNo: row[voyageNoIdx] ? String(row[voyageNoIdx]).trim() : '',
                                contractNo: row[contractNoIdx] ? String(row[contractNoIdx]).trim() : '',
                                partner: String(row[partnerIdx] || '').trim(),
                                content: String(row[contentIdx] || '').trim(),
                                thu: Number(row[thuIdx]) || 0,
                                chi: Number(row[chiIdx]) || 0,
                                account: String(row[accountIdx] || 'Tiền mặt').trim()
                            };
                            
                            const existingIdx = AppData.state.transactions.findIndex(x => x.id === id);
                            const oldTx = existingIdx >= 0 ? { ...AppData.state.transactions[existingIdx] } : null;
                            if (existingIdx >= 0) AppData.state.transactions[existingIdx] = t;
                            else AppData.state.transactions.push(t);
                            
                            if (t.vessel && t.vessel !== 'VP' && t.date && (t.category === '9.Vật Tư' || t.category === '6.Lãi Vay')) {
                                affectedAllocations.add(`${t.vessel}_${t.date.substring(0, 7)}`);
                            }
                            if (oldTx && oldTx.vessel && oldTx.vessel !== 'VP' && oldTx.date && (oldTx.category === '9.Vật Tư' || oldTx.category === '6.Lãi Vay')) {
                                affectedAllocations.add(`${oldTx.vessel}_${oldTx.date.substring(0, 7)}`);
                            }
                        });
                        restoredSheets.push('Theo dõi tài chính');
                    }
                }

                // 4. Quản lý chi phí tàu (Báo cáo Thuyền trưởng)
                const wsExp = workbook.Sheets['Quản lý chi phí tàu'] || workbook.Sheets['Theo dõi tài chính tàu chi'];
                if (wsExp) {
                    const rows = XLSX.utils.sheet_to_json(wsExp, { header: 1 });
                    if (rows.length >= 3) {
                        const headers = rows[2];
                        const dataRows = rows.slice(3);
                        const colIdx = (name) => headers.indexOf(name);
                        
                        const hasNewFormat = colIdx('Mã Báo Cáo') !== -1;
                        if (hasNewFormat) {
                            const idIdx = colIdx('Mã Báo Cáo');
                            const vesselIdx = colIdx('Mã Tàu');
                            const monthIdx = colIdx('Tháng');
                            const foodIdx = colIdx('Tiền Ăn (VNĐ)');
                            const materialIdx = colIdx('Vật Tư Tàu Chi (VNĐ)');
                            const portNameIdx = colIdx('Tên Khoản Mục Cảng');
                            const portVoyageIdx = colIdx('Chuyến Cảng');
                            const portAmountIdx = colIdx('Số Tiền Cảng (VNĐ)');
                            const brokVoyageIdx = colIdx('Chuyến Tiền Bông');
                            const brokAmountIdx = colIdx('Số Tiền Bông (VNĐ)');
                            
                            let currentReport = null;
                            const reportsMap = {};
                            
                            dataRows.forEach(row => {
                                if (row.length === 0) return;
                                if (row[idIdx]) {
                                    const id = String(row[idIdx]).trim();
                                    currentReport = {
                                        id,
                                        vesselId: String(row[vesselIdx] || '').trim(),
                                        month: String(row[monthIdx] || '').trim(),
                                        food: Number(row[foodIdx]) || 0,
                                        material: Number(row[materialIdx]) || 0,
                                        portExpenses: [],
                                        brokerages: []
                                    };
                                    reportsMap[id] = currentReport;
                                }
                                
                                if (currentReport) {
                                    const portName = row[portNameIdx] ? String(row[portNameIdx]).trim() : '';
                                    const portAmount = Number(row[portAmountIdx]) || 0;
                                    const portVoyage = row[portVoyageIdx] ? String(row[portVoyageIdx]).trim() : '';
                                    if (portName || portAmount > 0) {
                                        currentReport.portExpenses.push({
                                            port: portName,
                                            amount: portAmount,
                                            voyageNo: portVoyage
                                        });
                                    }
                                    
                                    const brokVoyage = row[brokVoyageIdx] ? String(row[brokVoyageIdx]).trim() : '';
                                    const brokAmount = Number(row[brokAmountIdx]) || 0;
                                    if (brokVoyage || brokAmount > 0) {
                                        currentReport.brokerages.push({
                                            voyageNo: brokVoyage,
                                            amount: brokAmount
                                        });
                                    }
                                }
                            });
                            
                            if (!AppData.state.captainReports) AppData.state.captainReports = [];
                            Object.values(reportsMap).forEach(report => {
                                const existingIdx = AppData.state.captainReports.findIndex(x => x.id === report.id);
                                if (existingIdx >= 0) {
                                    AppData.state.captainReports[existingIdx] = report;
                                } else {
                                    AppData.state.captainReports.push(report);
                                }
                                AppData.recalculateVesselAllocations(report.vesselId, report.month);
                            });
                            restoredSheets.push('Quản lý chi phí tàu');
                        } else {
                            // Old format
                            const idIdx = colIdx('ID Chi Phí');
                            const dateIdx = colIdx('Ngày');
                            const vesselIdx = colIdx('Mã Tàu');
                            const voyageNoIdx = colIdx('Chuyến Số');
                            const categoryIdx = colIdx('Hạng Mục');
                            const amountIdx = colIdx('Số Tiền (VNĐ)');
                            const contentIdx = colIdx('Nội Dung');
                            
                            dataRows.forEach(row => {
                                if (row.length === 0 || !row[dateIdx]) return;
                                const id = row[idIdx] ? String(row[idIdx]).trim() : ('VE-' + Date.now() + Math.random().toString().slice(2, 6));
                                const dateStr = parseExcelDate(row[dateIdx]);
                                const ve = {
                                    id,
                                    date: dateStr,
                                    vesselId: String(row[vesselIdx] || '').trim(),
                                    voyageNo: String(row[voyageNoIdx] || '').trim(),
                                    category: String(row[categoryIdx] || '').trim(),
                                    amount: Number(row[amountIdx]) || 0,
                                    content: String(row[contentIdx] || '').trim()
                                };
                                const existingIdx = AppData.state.vesselExpenses.findIndex(x => x.id === id);
                                if (existingIdx >= 0) AppData.state.vesselExpenses[existingIdx] = ve;
                                else AppData.state.vesselExpenses.push(ve);
                            });
                            restoredSheets.push('Theo dõi tài chính tàu chi');
                        }
                    }
                }

                // 5. Nhân sự
                const wsHr = workbook.Sheets['Nhân sự'];
                if (wsHr) {
                    const rows = XLSX.utils.sheet_to_json(wsHr, { header: 1 });
                    if (rows.length >= 3) {
                        const headers = rows[2];
                        const dataRows = rows.slice(3);
                        const colIdx = (name) => headers.indexOf(name);
                        
                        const idIdx = colIdx('ID Nhân Sự');
                        const nameIdx = colIdx('Họ và Tên');
                        const roleIdx = colIdx('Chức Vụ');
                        const departmentIdx = colIdx('Bộ Phận');
                        const basicSalaryIdx = colIdx('Lương Cơ Bản (VNĐ)');
                        const allowancesIdx = colIdx('Phụ Cấp (VNĐ)');
                        const personalDeductionIdx = colIdx('Giảm Trừ Bản Thân (VNĐ)');
                        const dependentsIdx = colIdx('Số Người Phụ Thuộc');
                        const joinDateIdx = colIdx('Ngày Vào');
                        const leaveDateIdx = colIdx('Ngày Nghỉ');
                        const phoneIdx = colIdx('Số Điện Thoại');
                        const notesIdx = colIdx('Ghi Chú');
                        
                        const actualSalaryIdx = colIdx('Mức Lương Thực Tế (VNĐ)');
                        const insuranceIdx = colIdx('Mức BHXH Đóng (VNĐ)');
                        const mealAllowanceIdx = colIdx('Tiền Ăn Ca (VNĐ)');
                        const phoneAllowanceIdx = colIdx('Phụ Cấp Điện Thoại (VNĐ)');
                        const clothingAllowanceIdx = colIdx('Phụ Cấp Trang Phục (VNĐ)');
                        const transportAllowanceIdx = colIdx('Phụ Cấp Xăng Xe (VNĐ)');
                        const deliveryAllowanceIdx = colIdx('Phụ Cấp Giao Nhận (VNĐ)');
                        const completionBonusIdx = colIdx('Thưởng Hoàn Thành (VNĐ)');
                        
                        dataRows.forEach(row => {
                            if (row.length === 0 || !row[nameIdx]) return;
                            const id = row[idIdx] ? String(row[idIdx]).trim() : ('EMP-' + Date.now() + Math.random().toString().slice(2, 6));
                            const emp = {
                                id,
                                name: String(row[nameIdx]).trim(),
                                role: String(row[roleIdx] || '').trim(),
                                department: String(row[departmentIdx] || 'VP').trim(),
                                basicSalary: Number(row[basicSalaryIdx]) || 0,
                                allowances: Number(row[allowancesIdx]) || 0,
                                personalDeduction: Number(row[personalDeductionIdx]) || 15500000,
                                dependents: Number(row[dependentsIdx]) || 0,
                                joinDate: row[joinDateIdx] ? parseExcelDate(row[joinDateIdx]) : '',
                                leaveDate: row[leaveDateIdx] ? parseExcelDate(row[leaveDateIdx]) : '',
                                phone: String(row[phoneIdx] || '').trim(),
                                notes: String(row[notesIdx] || '').trim(),
                                actualSalary: Number(row[actualSalaryIdx]) || 0,
                                insurance: Number(row[insuranceIdx]) || 0,
                                mealAllowance: Number(row[mealAllowanceIdx]) || 0,
                                phoneAllowance: Number(row[phoneAllowanceIdx]) || 0,
                                clothingAllowance: Number(row[clothingAllowanceIdx]) || 0,
                                transportAllowance: Number(row[transportAllowanceIdx]) || 0,
                                deliveryAllowance: Number(row[deliveryAllowanceIdx]) || 0,
                                completionBonus: Number(row[completionBonusIdx]) || 0
                            };
                            const existingIdx = AppData.state.employees.findIndex(x => x.id === id);
                            if (existingIdx >= 0) AppData.state.employees[existingIdx] = emp;
                            else AppData.state.employees.push(emp);
                        });
                        restoredSheets.push('Nhân sự');
                    }
                }

                // 6. Lương
                const wsSal = workbook.Sheets['Lương'];
                if (wsSal) {
                    const rows = XLSX.utils.sheet_to_json(wsSal, { header: 1 });
                    if (rows.length >= 3) {
                        const headers = rows[2];
                        const dataRows = rows.slice(3);
                        const colIdx = (name) => headers.indexOf(name);
                        const monthIdx = colIdx('Tháng');
                        const departmentIdx = colIdx('Bộ Phận');
                        const voyageCountIdx = colIdx('Số Chuyến');
                        const attendanceIdx = colIdx('Dữ Liệu Điểm Danh (JSON)');
                        
                        dataRows.forEach(row => {
                            if (row.length === 0 || !row[monthIdx] || !row[departmentIdx]) return;
                            const month = String(row[monthIdx]).trim();
                            const department = String(row[departmentIdx]).trim();
                            let attendance = {};
                            try {
                                if (row[attendanceIdx]) {
                                    attendance = JSON.parse(String(row[attendanceIdx]).trim());
                                }
                            } catch (err) {
                                console.error('Lỗi parse JSON điểm danh:', err);
                            }
                            const ts = {
                                month,
                                department,
                                voyageCount: Number(row[voyageCountIdx]) || 0,
                                attendance
                            };
                            const existingIdx = AppData.state.timesheets.findIndex(x => x.month === month && x.department === department);
                            if (existingIdx >= 0) AppData.state.timesheets[existingIdx] = ts;
                            else AppData.state.timesheets.push(ts);
                        });
                        restoredSheets.push('Lương');
                    }
                }

                // 7. Chi phí theo tháng
                const wsMcosts = workbook.Sheets['Chi phí theo tháng'];
                if (wsMcosts) {
                    const rows = XLSX.utils.sheet_to_json(wsMcosts, { header: 1 });
                    if (rows.length >= 3) {
                        const headers = rows[2];
                        const dataRows = rows.slice(3);
                        const colIdx = (name) => headers.indexOf(name);
                        const monthIdx = colIdx('Tháng');
                        const vesselIdx = colIdx('Mã Tàu');
                        const salaryIdx = colIdx('Lương (VNĐ)');
                        const insuranceIdx = colIdx('Bảo Hiểm (VNĐ)');
                        const foodIdx = colIdx('Tiền Ăn (VNĐ)');
                        const matCIdx = colIdx('Vật Tư Công Ty Cấp (VNĐ)');
                        const matVIdx = colIdx('Vật Tư Tàu Chi (VNĐ)');
                        const otherIdx = colIdx('Chi Phí Khác (VNĐ)');
                        const loanIdx = colIdx('Lãi Vay (VNĐ)');
                        
                        dataRows.forEach(row => {
                            if (row.length === 0 || !row[monthIdx] || !row[vesselIdx]) return;
                            const month = String(row[monthIdx]).trim();
                            const vesselId = String(row[vesselIdx]).trim();
                            const c = {
                                month,
                                vesselId,
                                salary: Number(row[salaryIdx]) || 0,
                                insurance: Number(row[insuranceIdx]) || 0,
                                food: Number(row[foodIdx]) || 0,
                                materialCompany: Number(row[matCIdx]) || 0,
                                materialVessel: Number(row[matVIdx]) || 0,
                                other: Number(row[otherIdx]) || 0,
                                loanInterest: Number(row[loanIdx]) || 0
                            };
                            const existingIdx = AppData.state.monthlyCosts.findIndex(x => x.month === month && x.vesselId === vesselId);
                            if (existingIdx >= 0) AppData.state.monthlyCosts[existingIdx] = c;
                            else AppData.state.monthlyCosts.push(c);
                        });
                        restoredSheets.push('Chi phí theo tháng');
                    }
                }

                // 8. Đối tác
                const wsPartner = workbook.Sheets['Đối tác'];
                if (wsPartner) {
                    const rows = XLSX.utils.sheet_to_json(wsPartner, { header: 1 });
                    if (rows.length >= 3) {
                        const headers = rows[2];
                        const dataRows = rows.slice(3);
                        const colIdx = (name) => headers.indexOf(name);
                        const typeIdx = colIdx('Loại');
                        const idIdx = colIdx('ID Đối Tác');
                        const nameIdx = colIdx('Tên Đối Tác');
                        const catIdx = colIdx('Phân Loại / Mặt Hàng');
                        const contactIdx = colIdx('Liên Hệ');
                        const addrIdx = colIdx('Địa Chỉ');
                        
                        dataRows.forEach(row => {
                            if (row.length === 0 || !row[nameIdx]) return;
                            const isVendor = String(row[typeIdx]).trim() === 'NCC';
                            const id = row[idIdx] ? String(row[idIdx]).trim() : ((isVendor ? 'v' : 'c') + Date.now() + Math.random().toString().slice(2, 6));
                            if (isVendor) {
                                const vendor = {
                                    id,
                                    name: String(row[nameIdx]).trim(),
                                    type: String(row[catIdx] || '').trim(),
                                    contact: String(row[contactIdx] || '').trim(),
                                    address: String(row[addrIdx] || '').trim()
                                };
                                const existingIdx = AppData.state.vendors.findIndex(x => x.id === id);
                                if (existingIdx >= 0) AppData.state.vendors[existingIdx] = vendor;
                                else AppData.state.vendors.push(vendor);
                            } else {
                                const customer = {
                                    id,
                                    name: String(row[nameIdx]).trim(),
                                    contact: String(row[contactIdx] || '').trim(),
                                    address: String(row[addrIdx] || '').trim()
                                };
                                const existingIdx = AppData.state.customers.findIndex(x => x.id === id);
                                if (existingIdx >= 0) AppData.state.customers[existingIdx] = customer;
                                else AppData.state.customers.push(customer);
                            }
                        });
                        restoredSheets.push('Đối tác');
                    }
                }

                // 9. Tàu
                const wsVessels = workbook.Sheets['Tàu'];
                if (wsVessels) {
                    const rows = XLSX.utils.sheet_to_json(wsVessels, { header: 1 });
                    if (rows.length >= 3) {
                        const headers = rows[2];
                        const dataRows = rows.slice(3);
                        const colIdx = (name) => headers.indexOf(name);
                        const idIdx = colIdx('Mã Tàu');
                        const nameIdx = colIdx('Tên Tàu');
                        const capIdx = colIdx('Trọng Tải (Tấn)');
                        const captainIdx = colIdx('Thuyền Trưởng');
                        const rateIdx = colIdx('Định Mức Dầu DO (L/h)');
                        
                        dataRows.forEach(row => {
                            if (row.length === 0 || !row[idIdx] || !row[nameIdx]) return;
                            const id = String(row[idIdx]).trim();
                            const v = {
                                id,
                                name: String(row[nameIdx]).trim(),
                                capacity: Number(row[capIdx]) || 0,
                                captain: String(row[captainIdx] || '').trim(),
                                fuelRate: Number(row[rateIdx]) || 0
                            };
                            const existingIdx = AppData.state.vessels.findIndex(x => x.id === id);
                            if (existingIdx >= 0) AppData.state.vessels[existingIdx] = v;
                            else AppData.state.vessels.push(v);
                        });
                        restoredSheets.push('Tàu');
                    }
                }

                // 10. Thông tin công ty
                const wsComp = workbook.Sheets['Thông tin công ty'];
                if (wsComp) {
                    const rows = XLSX.utils.sheet_to_json(wsComp, { header: 1 });
                    if (rows.length >= 3) {
                        const headers = rows[2];
                        const row = rows[3];
                        if (row) {
                            const colIdx = (name) => headers.indexOf(name);
                            const nameIdx = colIdx('Tên Doanh Nghiệp');
                            const taxIdx = colIdx('Mã Số Thuế');
                            const bankIdx = colIdx('Thông Tin Ngân Hàng');
                            const addrIdx = colIdx('Địa Chỉ');
                            const abIdx = colIdx('Số Dư Đầu Kỳ ABbank (VNĐ)');
                            const vtIdx = colIdx('Số Dư Đầu Kỳ Viettinbank (VNĐ)');
                            const cnIdx = colIdx('Số Dư Đầu Kỳ Tài Khoản Cá Nhân (VNĐ)');
                            const tmIdx = colIdx('Số Dư Đầu Kỳ Tiền Mặt (VNĐ)');
                            
                            AppData.state.company = {
                                name: String(row[nameIdx] || '').trim(),
                                taxId: String(row[taxIdx] || '').trim(),
                                bankInfo: String(row[bankIdx] || '').trim(),
                                address: String(row[addrIdx] || '').trim(),
                                openingBalances: {
                                    ABbank: Number(row[abIdx]) || 0,
                                    Viettinbank: Number(row[vtIdx]) || 0,
                                    'Tài khoản cá nhân': Number(row[cnIdx]) || 0,
                                    'Tiền mặt': Number(row[tmIdx]) || 0
                                }
                            };
                        }
                        restoredSheets.push('Thông tin công ty');
                    }
                }

                // Recalculate allocations for all modified vessel-months
                affectedAllocations.forEach(key => {
                    const [vesselId, monthStr] = key.split('_');
                    AppData.recalculateVesselAllocations(vesselId, monthStr);
                });

                if (restoredSheets.length === 0) {
                    alert('Không tìm thấy sheet hợp lệ nào để khôi phục!');
                    return;
                }

                AppData.save();
                alert('Khôi phục toàn bộ hệ thống thành công! Đã khôi phục các sheet: \n- ' + restoredSheets.join('\n- '));
                this.navigate('company');
            } catch (err) {
                console.error(err);
                alert('Lỗi khi đọc file Excel: ' + err.message);
            }
        };
        reader.readAsArrayBuffer(file);
    },

    exportShipmentReport() {
        if (typeof XLSX === 'undefined') return alert('Chưa tải xong thư viện xuất Excel!');
        const wb = XLSX.utils.book_new();
        const rows = [];
        
        rows.push(['BÁO CÁO CHI TIẾT TỔNG HỢP CHUYẾN HÀNG']);
        rows.push([]);
        rows.push([
            'ID Chuyến Hàng',
            'Số Hợp Đồng',
            'Chuyến Số',
            'Mã Tàu',
            'Khách Hàng',
            'Tên Hàng',
            'Cảng Xếp (Đi)',
            'Cảng Dỡ (Đến)',
            'Ngày Xếp Hàng',
            'Ngày Dỡ Hàng',
            'Tháng Hạch Toán',
            'Khối Lượng (Tấn)',
            'Đơn Giá Thực (VNĐ)',
            'Tiền Gửi (VND/tấn)',
            'Giá Dầu Chuyến (VNĐ)',
            'Số Giờ Chạy (Giờ)',
            'Doanh Thu Thực Tế (VNĐ)',
            'Doanh Thu Hóa Đơn (VNĐ)',
            'Tiền Gửi Lại Khách (VNĐ)',
            'Tiền Dầu DO (VNĐ)',
            'Tiền Dầu LO (VNĐ)',
            'Lương TV (VNĐ)',
            'Tiền Ăn (VNĐ)',
            'Bảo Hiểm (VNĐ)',
            'Vật Tư Cty Cấp (VNĐ)',
            'Vật Tư Tàu Chi (VNĐ)',
            'CP Khác Cty Cấp (VNĐ)',
            'Đại Lý 2 Đầu Cảng (VNĐ)',
            'Tàu Chi 2 Đầu Cảng (VNĐ)',
            'Tiền Bông (VNĐ)',
            'Thuế VAT (VNĐ)',
            'Hoa Tiêu, Tàu Lai, Phí Cảng (VNĐ)',
            'Chi Phí Khác Tàu Chi (VNĐ)',
            'Tổng Chi Phí (VNĐ)',
            'Lợi Nhuận/Hiệu Quả (VNĐ)'
        ]);
        
        const ships = AppData.getShipments()
            .slice()
            .sort((a, b) => {
                const numA = parseInt((a.contractNo || '').replace(/\D/g, '')) || 0;
                const numB = parseInt((b.contractNo || '').replace(/\D/g, '')) || 0;
                return numB - numA; // Descending by HD number
            });
            
        ships.forEach(s => {
            const qty = Number(s.qty || 0);
            const rate = Number(s.rate || 0);
            const markup = Number(s.markup || 0);
            const fuelPrice = Number(s.fuelPrice || 20000);
            const fuelHours = Number(s.fuelHours || 0);
            const revenueReal = Number(s.revenueReal || 0);
            const revenueInvoice = Number(s.revenueInvoice || 0);
            const refund = Number(s.refundAmount || 0);
            
            const costs = s.costs || {};
            const fuelDO = Number(costs.fuelDO || 0);
            const fuelLO = Number(costs.fuelLO || 0);
            const crewSalary = Number(costs.crewSalary || 0);
            const crewFood = Number(costs.crewFood || 0);
            const crewInsurance = Number(costs.crewInsurance || 0);
            const materialCompany = Number(costs.materialCompany || 0);
            const materialVessel = Number(costs.materialVessel || 0);
            const monthlyOther = Number(costs.monthlyOther || 0);
            const agent = Number(costs.agent || 0);
            const vessel2ends = Number(costs.vessel2ends || 0);
            const brokerage = Number(costs.brokerage || 0);
            const vat = Number(costs.vat || 0);
            const portFees = Number(costs.portFees || 0);
            const others = Number(costs.others || 0);
            
            const totalExpenses = fuelDO + fuelLO + crewSalary + crewFood + crewInsurance + 
                                  materialCompany + materialVessel + monthlyOther + agent + 
                                  vessel2ends + brokerage + vat + portFees + others;
            const profit = revenueReal - totalExpenses;
            
            rows.push([
                s.id || '',
                s.contractNo || '',
                s.voyageNo || '',
                s.vesselId || '',
                s.customer || '',
                s.cargo || '',
                s.portLoad || '',
                s.portDischarge || '',
                s.dateStart || '',
                s.dateEnd || '',
                s.reportMonth || '',
                qty,
                rate,
                markup,
                fuelPrice,
                fuelHours,
                revenueReal,
                revenueInvoice,
                refund,
                fuelDO,
                fuelLO,
                crewSalary,
                crewFood,
                crewInsurance,
                materialCompany,
                materialVessel,
                monthlyOther,
                agent,
                vessel2ends,
                brokerage,
                vat,
                portFees,
                others,
                totalExpenses,
                profit
            ]);
        });
        
        const ws = XLSX.utils.aoa_to_sheet(rows);
        ws['!cols'] = [
            {wch: 15}, {wch: 12}, {wch: 10}, {wch: 8}, {wch: 25}, 
            {wch: 15}, {wch: 15}, {wch: 15}, {wch: 12}, {wch: 12}, 
            {wch: 12}, {wch: 15}, {wch: 18}, {wch: 15}, {wch: 18}, 
            {wch: 15}, {wch: 22}, {wch: 22}, {wch: 20}, {wch: 18}, 
            {wch: 18}, {wch: 18}, {wch: 15}, {wch: 15}, {wch: 18}, 
            {wch: 18}, {wch: 18}, {wch: 18}, {wch: 18}, {wch: 15}, 
            {wch: 15}, {wch: 20}, {wch: 18}, {wch: 20}, {wch: 22}
        ];
        XLSX.utils.book_append_sheet(wb, ws, 'Chuyen_Hang');
        XLSX.writeFile(wb, 'Bao_Cao_Chuyen_Hang_' + new Date().toISOString().slice(0,10) + '.xlsx');
    },

    // Đọc số từ input tiền (bỏ dấu chấm phân cách nghìn). Tương thích cả input thường.
    parseNum(v) {
        if (v === null || v === undefined) return 0;
        const n = Number(String(v).replace(/\./g, '').replace(/\s/g, '').replace(',', '.'));
        return isNaN(n) ? 0 : n;
    },
    // Định dạng số nguyên tiền VN: 1000000 -> "1.000.000"
    fmtMoney(v) {
        const n = this.parseNum(v);
        return n ? n.toLocaleString('vi-VN') : (v === 0 || v === '0' ? '0' : '');
    },

    init() {
        this.runAutoBackup();
        // Tự thêm dấu chấm phân cách nghìn cho mọi input có class "money" khi gõ
        document.addEventListener('input', (e) => {
            const el = e.target;
            if (!el || !el.classList) return;
            // Xóa đánh dấu lỗi ngay khi người dùng sửa lại field
            if (el.classList.contains('field-error')) {
                el.classList.remove('field-error');
                const next = el.nextSibling;
                if (next && next.classList && next.classList.contains('field-error-msg')) next.remove();
            }
            if (!el.classList.contains('money')) return;
            const neg = el.value.trim().startsWith('-');
            const digits = el.value.replace(/\D/g, '');
            el.value = (neg ? '-' : '') + (digits ? Number(digits).toLocaleString('vi-VN') : '');
        });
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const view = e.currentTarget.getAttribute('data-view');
                if (view) this.navigate(view);
                this.toggleSidebar(false);   // đóng menu sau khi chọn (mobile)
            });
        });
        this.navigate(this.currentView);
        // #36: nhắc đăng kiểm qua thông báo (chỉ khi đã được cấp quyền trước đó)
        try { this.checkCertNotificationsOnBoot(); } catch (e) {}
    },

    // Mở/đóng sidebar dạng off-canvas trên mobile
    toggleSidebar(force) {
        const sb = document.querySelector('.sidebar');
        const bd = document.querySelector('.sidebar-backdrop');
        if (!sb) return;
        const open = (typeof force === 'boolean') ? force : !sb.classList.contains('open');
        sb.classList.toggle('open', open);
        if (bd) bd.classList.toggle('show', open);
    },

    showMoreTrans() {
        this.transLimit = (this.transLimit || 100) + 200;
        this.navigate('financials');
    },
    navigate(viewName, ...args) {
        if (!Views[viewName]) return;
        // X3: vào lại Theo dõi Tài chính từ view khác -> reset giới hạn phân trang
        if (viewName === 'financials' && this.currentView !== 'financials') this.transLimit = 100;
        this.currentView = viewName;
        if (viewName === 'dashboard' && args.length > 0) {
            this.currentDashboardMonth = args[0];
        }
        if (viewName === 'debts' && args.length > 0) {
            this.currentDebtTab = args[0];
        }
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
            if (item.getAttribute('data-view') === viewName) item.classList.add('active');
        });
        const container = document.getElementById('view-container');
        if (viewName === 'hr') {
            container.innerHTML = Views.hr(this.hrTab || 'all');
        } else {
            container.innerHTML = Views[viewName](...args);
        }

        // Post-render logic
        if (viewName === 'dashboard') {
            this.renderDashboardCharts(...args);
        }
        if (viewName === 'financials') {
            this.renderFinancialChart();
        }
        if (viewName === 'shipments') {
            this.initDoubleScroll('shipments-scroll-wrapper');
        }
        if (viewName === 'vessel-expenses') {
            this.loadVesselExpenses();
        }
        if (viewName === 'company') {
            this.loadMembers();
            this.loadAudit();
        }
    },

    changeDebtCustomer(custName) {
        this.selectedDebtCustomer = custName;
        this.navigate('debts');
    },

    filterFinancials(month) {
        this.navigate('financials', month);
    },

    updateFinancialsFilters() {
        const month = document.getElementById('filter-fin-month').value;
        const vessel = document.getElementById('filter-fin-vessel').value;
        const category = document.getElementById('filter-fin-category').value;
        const partner = document.getElementById('filter-fin-partner').value;
        
        this.navigate('financials', month, vessel, category, partner);
    },

    resetFinancialsFilters() {
        this.navigate('financials');
    },


    renderFinancialChart() {
        const ctx = document.getElementById('financialChart');
        if (!ctx) return;

        const trans = AppData.getTransactions().filter(t => t.category !== 'Luân chuyển');
        const monthly = {};
        trans.forEach(t => {
            const m = t.date.substring(0, 7);
            if (!monthly[m]) monthly[m] = { thu: 0, chi: 0 };
            monthly[m].thu += (Number(t.thu) || 0);
            monthly[m].chi += (Number(t.chi) || 0);
        });

        const labels = Object.keys(monthly).sort();
        const thuData = labels.map(l => monthly[l].thu);
        const chiData = labels.map(l => monthly[l].chi);
        const balanceData = labels.map(l => monthly[l].thu - monthly[l].chi);

        // Update top stats for current/latest month
        const latestMonth = labels[labels.length - 1];
        if (latestMonth) {
            document.getElementById('monthly-thu-val').innerText = AppData.formatCurrency(monthly[latestMonth].thu);
            document.getElementById('monthly-chi-val').innerText = AppData.formatCurrency(monthly[latestMonth].chi);
            document.getElementById('monthly-balance-val').innerText = AppData.formatCurrency(monthly[latestMonth].thu - monthly[latestMonth].chi);
        }

        if (this.finChart) this.finChart.destroy();

        this.finChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels.map(l => `Tháng ${l.split('-').reverse().join('/')}`),
                datasets: [
                    {
                        label: 'Tổng Thu',
                        data: thuData,
                        backgroundColor: 'rgba(16, 185, 129, 0.6)',
                        borderColor: '#10b981',
                        borderWidth: 1,
                        borderRadius: 4
                    },
                    {
                        label: 'Tổng Chi',
                        data: chiData,
                        backgroundColor: 'rgba(244, 63, 94, 0.6)',
                        borderColor: '#f43f5e',
                        borderWidth: 1,
                        borderRadius: 4
                    },
                    {
                        label: 'Lợi nhuận',
                        data: balanceData,
                        type: 'line',
                        borderColor: '#0ea5e9',
                        backgroundColor: 'rgba(14, 165, 233, 0.1)',
                        fill: true,
                        tension: 0.4,
                        borderWidth: 3,
                        pointBackgroundColor: '#0ea5e9'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: { color: '#94a3b8', font: { family: 'Inter' } }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) label += ': ';
                                if (context.parsed.y !== null) {
                                    label += AppData.formatCurrency(context.parsed.y);
                                }
                                return label;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: { 
                            color: '#94a3b8',
                            callback: value => (value / 1e6).toFixed(0) + 'M'
                        }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: '#94a3b8' }
                    }
                }
            }
        });
    },

    renderDashboardCharts(filterMonth = '') {
        const canvasVessel = document.getElementById('repVesselChart');
        const canvasTrend = document.getElementById('repTrendChart');
        const canvasCost = document.getElementById('repCostChart');
        const canvasFuel = document.getElementById('repFuelChart');

        if (!canvasVessel || !canvasTrend || !canvasCost || !canvasFuel) return;

        const allShipments = AppData.getShipments();
        let shipments = allShipments;
        if (filterMonth) {
            shipments = allShipments.filter(s => {
                const m = s.reportMonth || (s.dateStart ? s.dateStart.substring(0, 7) : '');
                return m === filterMonth;
            });
        }

        // 1. Dữ liệu theo Tàu (Vessel Stats)
        const vesselStats = {};
        AppData.state.vessels.forEach(v => {
            vesselStats[v.id] = { name: v.name, revenue: 0, cost: 0, profit: 0, fuelDO: 0 };
        });

        shipments.forEach(s => {
            const vId = s.vesselId;
            if (!vesselStats[vId]) {
                vesselStats[vId] = { name: vId, revenue: 0, cost: 0, profit: 0, fuelDO: 0 };
            }
            const rev = Number(s.revenueReal || 0);
            const vat = Calc.vat(s.revenueInvoice, s.revenueReal, s.costs?.fuelDO);
            const baseCosts = { ...s.costs };
            delete baseCosts.vat;
            const costSum = Object.values(baseCosts).reduce((sum, v) => sum + (Number(v) || 0), 0) + (vat > 0 ? vat : 0);
            const profit = rev - costSum;
            
            vesselStats[vId].revenue += rev;
            vesselStats[vId].cost += costSum;
            vesselStats[vId].profit += profit;
            vesselStats[vId].fuelDO += Number(s.costs?.fuelDO || 0);
        });

        const vesselLabels = Object.keys(vesselStats).sort();
        const vesselNames = vesselLabels.map(id => vesselStats[id].name);
        const vesselRevData = vesselLabels.map(id => vesselStats[id].revenue);
        const vesselCostData = vesselLabels.map(id => vesselStats[id].cost);
        const vesselProfitData = vesselLabels.map(id => vesselStats[id].profit);
        const vesselFuelData = vesselLabels.map(id => vesselStats[id].fuelDO);

        // Destroy existing charts to prevent memory leak/hover glitch
        if (this.dashboardCharts) {
            Object.values(this.dashboardCharts).forEach(c => {
                if (c && typeof c.destroy === 'function') c.destroy();
            });
        }
        this.dashboardCharts = {};

        // Vẽ biểu đồ 1: Hiệu quả theo Tàu
        this.dashboardCharts.vessel = new Chart(canvasVessel, {
            type: 'bar',
            data: {
                labels: vesselNames,
                datasets: [
                    {
                        label: 'Doanh thu',
                        data: vesselRevData,
                        backgroundColor: 'rgba(14, 165, 233, 0.75)',
                        borderColor: '#0ea5e9',
                        borderWidth: 1,
                        borderRadius: 4
                    },
                    {
                        label: 'Chi phí',
                        data: vesselCostData,
                        backgroundColor: 'rgba(244, 63, 94, 0.75)',
                        borderColor: '#f43f5e',
                        borderWidth: 1,
                        borderRadius: 4
                    },
                    {
                        label: 'Lợi nhuận ròng',
                        data: vesselProfitData,
                        backgroundColor: 'rgba(16, 185, 129, 0.75)',
                        borderColor: '#10b981',
                        borderWidth: 1,
                        borderRadius: 4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { labels: { color: '#94a3b8', font: { family: 'Inter' } } },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return context.dataset.label + ': ' + AppData.formatCurrency(context.parsed.y);
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: { color: '#94a3b8', callback: value => (value / 1e6).toFixed(0) + 'M' }
                    },
                    x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
                }
            }
        });

        // 2. Dữ liệu theo Tháng hoặc Chuyến (Monthly Trend / Voyage Details)
        let trendLabels = [];
        let trendRevData = [];
        let trendProfitData = [];

        if (!filterMonth) {
            // Hiển thị xu hướng theo Tháng
            const monthlyStats = {};
            shipments.forEach(s => {
                const m = s.reportMonth || (s.dateStart ? s.dateStart.substring(0, 7) : '');
                if (!m) return;
                if (!monthlyStats[m]) {
                    monthlyStats[m] = { revenue: 0, cost: 0, profit: 0 };
                }
                const rev = Number(s.revenueReal || 0);
                const vat = Calc.vat(s.revenueInvoice, s.revenueReal, s.costs?.fuelDO);
                const baseCosts = { ...s.costs };
                delete baseCosts.vat;
                const costSum = Object.values(baseCosts).reduce((sum, v) => sum + (Number(v) || 0), 0) + (vat > 0 ? vat : 0);
                const profit = rev - costSum;

                monthlyStats[m].revenue += rev;
                monthlyStats[m].cost += costSum;
                monthlyStats[m].profit += profit;
            });

            const monthLabels = Object.keys(monthlyStats).sort();
            trendLabels = monthLabels.map(m => `Tháng ${m.split('-')[1]}/${m.split('-')[0]}`);
            trendRevData = monthLabels.map(m => monthlyStats[m].revenue);
            trendProfitData = monthLabels.map(m => monthlyStats[m].profit);
        } else {
            // Lọc theo tháng: hiển thị chi tiết theo từng chuyến đi
            const sortedVoyages = [...shipments].sort((a, b) => {
                const numA = parseInt((a.contractNo || '').replace(/\D/g, '')) || 0;
                const numB = parseInt((b.contractNo || '').replace(/\D/g, '')) || 0;
                return numA - numB; // Thứ tự hợp đồng tăng dần
            });
            trendLabels = sortedVoyages.map(s => `${s.vesselId} (HĐ: ${s.contractNo || s.voyageNo})`);
            trendRevData = sortedVoyages.map(s => Number(s.revenueReal || 0));
            trendProfitData = sortedVoyages.map(s => {
                const rev = Number(s.revenueReal || 0);
                const vat = Calc.vat(s.revenueInvoice, s.revenueReal, s.costs?.fuelDO);
                const baseCosts = { ...s.costs };
                delete baseCosts.vat;
                const costSum = Object.values(baseCosts).reduce((sum, v) => sum + (Number(v) || 0), 0) + (vat > 0 ? vat : 0);
                return rev - costSum;
            });
        }

        // Vẽ biểu đồ 2: Xu hướng
        this.dashboardCharts.trend = new Chart(canvasTrend, {
            type: filterMonth ? 'bar' : 'line',
            data: {
                labels: trendLabels,
                datasets: [
                    {
                        label: 'Doanh thu thực tế',
                        data: trendRevData,
                        borderColor: '#38bdf8',
                        backgroundColor: filterMonth ? 'rgba(56, 189, 248, 0.75)' : 'rgba(56, 189, 248, 0.1)',
                        fill: !filterMonth,
                        tension: 0.35,
                        borderWidth: filterMonth ? 1 : 3,
                        borderRadius: filterMonth ? 4 : 0,
                        pointBackgroundColor: '#38bdf8'
                    },
                    {
                        label: 'Lợi nhuận ròng',
                        data: trendProfitData,
                        borderColor: '#34d399',
                        backgroundColor: filterMonth ? 'rgba(52, 211, 153, 0.75)' : 'rgba(52, 211, 153, 0.1)',
                        fill: !filterMonth,
                        tension: 0.35,
                        borderWidth: filterMonth ? 1 : 3,
                        borderRadius: filterMonth ? 4 : 0,
                        pointBackgroundColor: '#34d399'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { labels: { color: '#94a3b8', font: { family: 'Inter' } } },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return context.dataset.label + ': ' + AppData.formatCurrency(context.parsed.y);
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: { color: '#94a3b8', callback: value => (value / 1e6).toFixed(0) + 'M' }
                    },
                    x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
                }
            }
        });

        // 3. Cơ cấu Chi phí (Cost Structure)
        const costSums = {
            fuelDO: 0,
            fuelLO: 0,
            crewSalary: 0,
            crewFood: 0,
            crewInsurance: 0,
            materialCompany: 0,
            materialVessel: 0,
            monthlyOther: 0,
            agent: 0,
            vessel2ends: 0,
            portFees: 0,
            brokerage: 0,
            vat: 0,
            others: 0
        };

        shipments.forEach(s => {
            const vat = Calc.vat(s.revenueInvoice, s.revenueReal, s.costs?.fuelDO);
            costSums.fuelDO += Number(s.costs?.fuelDO || 0);
            costSums.fuelLO += Number(s.costs?.fuelLO || 0);
            costSums.crewSalary += Number(s.costs?.crewSalary || 0);
            costSums.crewFood += Number(s.costs?.crewFood || 0);
            costSums.crewInsurance += Number(s.costs?.crewInsurance || 0);
            costSums.materialCompany += Number(s.costs?.materialCompany || 0);
            costSums.materialVessel += Number(s.costs?.materialVessel || 0);
            costSums.monthlyOther += Number(s.costs?.monthlyOther || 0);
            costSums.agent += Number(s.costs?.agent || 0);
            costSums.vessel2ends += Number(s.costs?.vessel2ends || 0);
            costSums.portFees += Number(s.costs?.portFees || 0);
            costSums.brokerage += Number(s.costs?.brokerage || 0);
            costSums.vat += (vat > 0 ? vat : 0);
            costSums.others += Number(s.costs?.others || 0);
        });

        const costLabels = [
            'Dầu DO',
            'Dầu LO',
            'Lương thuyền viên',
            'Tiền ăn',
            'Bảo hiểm TV',
            'Vật tư Cty cấp',
            'Vật tư Tàu chi',
            'CP Phân bổ Cty',
            'Đại lý 2 đầu cảng',
            'Tàu chi 2 đầu cảng',
            'Phí cảng & hoa tiêu',
            'Tiền Bông',
            'Thuế VAT',
            'Chi phí khác'
        ];

        const costValues = [
            costSums.fuelDO,
            costSums.fuelLO,
            costSums.crewSalary,
            costSums.crewFood,
            costSums.crewInsurance,
            costSums.materialCompany,
            costSums.materialVessel,
            costSums.monthlyOther,
            costSums.agent,
            costSums.vessel2ends,
            costSums.portFees,
            costSums.brokerage,
            costSums.vat,
            costSums.others
        ];

        const costColors = [
            'rgba(245, 158, 11, 0.8)',
            'rgba(217, 119, 6, 0.8)',
            'rgba(79, 70, 229, 0.8)',
            'rgba(99, 102, 241, 0.8)',
            'rgba(129, 140, 248, 0.8)',
            'rgba(16, 185, 129, 0.8)',
            'rgba(52, 211, 153, 0.8)',
            'rgba(110, 231, 183, 0.8)',
            'rgba(14, 165, 233, 0.8)',
            'rgba(56, 189, 248, 0.8)',
            'rgba(186, 230, 253, 0.8)',
            'rgba(244, 63, 94, 0.8)',
            'rgba(225, 29, 72, 0.8)',
            'rgba(156, 163, 175, 0.8)'
        ];

        const filteredCosts = [];
        costLabels.forEach((lbl, idx) => {
            if (costValues[idx] > 0) {
                filteredCosts.push({
                    label: lbl,
                    value: costValues[idx],
                    color: costColors[idx]
                });
            }
        });

        // Vẽ biểu đồ 3: Cơ cấu chi phí
        this.dashboardCharts.cost = new Chart(canvasCost, {
            type: 'doughnut',
            data: {
                labels: filteredCosts.map(item => item.label),
                datasets: [{
                    data: filteredCosts.map(item => item.value),
                    backgroundColor: filteredCosts.map(item => item.color),
                    borderWidth: 1,
                    borderColor: 'rgba(15, 17, 26, 0.6)'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            color: '#94a3b8',
                            font: { family: 'Inter', size: 10 },
                            boxWidth: 12
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const val = context.parsed;
                                const pct = ((val / total) * 100).toFixed(1);
                                return context.label + ': ' + AppData.formatCurrency(val) + ' (' + pct + '%)';
                            }
                        }
                    }
                }
            }
        });

        // Vẽ biểu đồ 4: Tiêu hao nhiên liệu DO
        this.dashboardCharts.fuel = new Chart(canvasFuel, {
            type: 'bar',
            data: {
                labels: vesselNames,
                datasets: [{
                    label: 'Tiền dầu DO',
                    data: vesselFuelData,
                    backgroundColor: 'rgba(245, 158, 11, 0.75)',
                    borderColor: '#f59e0b',
                    borderWidth: 1,
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return 'Tiền dầu: ' + AppData.formatCurrency(context.parsed.y);
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: { color: '#94a3b8', callback: value => (value / 1e6).toFixed(0) + 'M' }
                    },
                    x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
                }
            }
        });

        // Tự động phân tích và nhận xét
        this.generateDashboardAnalysis(shipments, allShipments, filterMonth);
    },

    generateDashboardAnalysis(filteredShipments, allShipments, filterMonth) {
        const el = document.getElementById('reports-analysis-content');
        if (!el) return;

        if (filteredShipments.length === 0) {
            el.innerHTML = `<p style="color: var(--text-muted);"><i class="fa-solid fa-triangle-exclamation" style="color: var(--warning); margin-right: 6px;"></i>Không có dữ liệu chuyến hàng nào để phân tích trong giai đoạn này.</p>`;
            return;
        }

        // 1. Tính các chỉ số cơ bản
        let totalRevenue = 0;
        let totalCost = 0;
        let totalFuelDO = 0;
        let totalVat = 0;
        let totalBrokerage = 0;
        let totalCrewSalary = 0;

        filteredShipments.forEach(s => {
            totalRevenue += Number(s.revenueReal || 0);
            const vat = Calc.vat(s.revenueInvoice, s.revenueReal, s.costs?.fuelDO);
            const baseCosts = { ...s.costs };
            delete baseCosts.vat;
            const costSum = Object.values(baseCosts).reduce((sum, v) => sum + (Number(v) || 0), 0) + (vat > 0 ? vat : 0);
            
            totalCost += costSum;
            totalFuelDO += Number(s.costs?.fuelDO || 0);
            totalVat += (vat > 0 ? vat : 0);
            totalBrokerage += Number(s.costs?.brokerage || 0);
            totalCrewSalary += Number(s.costs?.crewSalary || 0);
        });

        const totalProfit = totalRevenue - totalCost;
        const profitMargin = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : 0;

        // 2. Tính hiệu suất theo Tàu
        const vesselStats = {};
        filteredShipments.forEach(s => {
            const vId = s.vesselId;
            if (!vesselStats[vId]) {
                vesselStats[vId] = { 
                    revenue: 0, 
                    cost: 0, 
                    profit: 0, 
                    voyages: 0,
                    costsDetail: {
                        fuelDO: 0,
                        fuelLO: 0,
                        crewSalary: 0,
                        crewFood: 0,
                        crewInsurance: 0,
                        materialCompany: 0,
                        materialVessel: 0,
                        monthlyOther: 0,
                        agent: 0,
                        vessel2ends: 0,
                        portFees: 0,
                        brokerage: 0,
                        vat: 0,
                        others: 0
                    }
                };
            }
            const rev = Number(s.revenueReal || 0);
            const vat = Calc.vat(s.revenueInvoice, s.revenueReal, s.costs?.fuelDO);
            const baseCosts = { ...s.costs };
            delete baseCosts.vat;
            const costSum = Object.values(baseCosts).reduce((sum, v) => sum + (Number(v) || 0), 0) + (vat > 0 ? vat : 0);
            
            vesselStats[vId].revenue += rev;
            vesselStats[vId].cost += costSum;
            vesselStats[vId].profit += (rev - costSum);
            vesselStats[vId].voyages += 1;

            // Cộng dồn chi tiết từng hạng mục chi phí
            vesselStats[vId].costsDetail.fuelDO += Number(s.costs?.fuelDO || 0);
            vesselStats[vId].costsDetail.fuelLO += Number(s.costs?.fuelLO || 0);
            vesselStats[vId].costsDetail.crewSalary += Number(s.costs?.crewSalary || 0);
            vesselStats[vId].costsDetail.crewFood += Number(s.costs?.crewFood || 0);
            vesselStats[vId].costsDetail.crewInsurance += Number(s.costs?.crewInsurance || 0);
            vesselStats[vId].costsDetail.materialCompany += Number(s.costs?.materialCompany || 0);
            vesselStats[vId].costsDetail.materialVessel += Number(s.costs?.materialVessel || 0);
            vesselStats[vId].costsDetail.monthlyOther += Number(s.costs?.monthlyOther || 0);
            vesselStats[vId].costsDetail.agent += Number(s.costs?.agent || 0);
            vesselStats[vId].costsDetail.vessel2ends += Number(s.costs?.vessel2ends || 0);
            vesselStats[vId].costsDetail.portFees += Number(s.costs?.portFees || 0);
            vesselStats[vId].costsDetail.brokerage += Number(s.costs?.brokerage || 0);
            vesselStats[vId].costsDetail.vat += (vat > 0 ? vat : 0);
            vesselStats[vId].costsDetail.others += Number(s.costs?.others || 0);
        });

        let bestVessel = '', maxProfit = -Infinity;
        let worstVessel = '', minProfit = Infinity;
        let mostActiveVessel = '', maxVoyages = 0;

        Object.keys(vesselStats).forEach(vId => {
            const stats = vesselStats[vId];
            if (stats.profit > maxProfit) {
                maxProfit = stats.profit;
                bestVessel = vId;
            }
            if (stats.profit < minProfit) {
                minProfit = stats.profit;
                worstVessel = vId;
            }
            if (stats.voyages > maxVoyages) {
                maxVoyages = stats.voyages;
                mostActiveVessel = vId;
            }
        });

        const bestVesselObj = AppData.state.vessels.find(v => v.id === bestVessel) || { name: bestVessel };
        const worstVesselObj = AppData.state.vessels.find(v => v.id === worstVessel) || { name: worstVessel };

        // 3. Phân tích Chi phí
        const fuelDOPercent = totalRevenue > 0 ? ((totalFuelDO / totalRevenue) * 100).toFixed(1) : 0;
        const crewSalaryPercent = totalRevenue > 0 ? ((totalCrewSalary / totalRevenue) * 100).toFixed(1) : 0;

        // 4. Tính toán so sánh tăng trưởng nếu có chọn tháng
        let growthHTML = '';
        if (filterMonth) {
            // Xác định tháng trước
            const parts = filterMonth.split('-');
            let yr = parseInt(parts[0]);
            let mo = parseInt(parts[1]);
            mo--;
            if (mo === 0) {
                mo = 12;
                yr--;
            }
            const prevMonthStr = yr + '-' + String(mo).padStart(2, '0');
            const prevMonthShipments = allShipments.filter(s => {
                const m = s.reportMonth || (s.dateStart ? s.dateStart.substring(0, 7) : '');
                return m === prevMonthStr;
            });

            if (prevMonthShipments.length > 0) {
                let prevRevenue = 0;
                let prevCost = 0;
                prevMonthShipments.forEach(s => {
                    prevRevenue += Number(s.revenueReal || 0);
                    const vat = Calc.vat(s.revenueInvoice, s.revenueReal, s.costs?.fuelDO);
                    const baseCosts = { ...s.costs };
                    delete baseCosts.vat;
                    const costSum = Object.values(baseCosts).reduce((sum, v) => sum + (Number(v) || 0), 0) + (vat > 0 ? vat : 0);
                    prevCost += costSum;
                });
                const prevProfit = prevRevenue - prevCost;
                const profitDiff = totalProfit - prevProfit;
                
                let growthRate = 0;
                if (prevProfit !== 0) {
                    growthRate = ((profitDiff / Math.abs(prevProfit)) * 100).toFixed(1);
                }
                
                if (profitDiff > 0) {
                    growthHTML = `<li style="margin-bottom: 0.5rem;"><i class="fa-solid fa-arrow-trend-up" style="color: var(--secondary); margin-right: 8px;"></i>So với tháng trước (Tháng ${mo}/${yr}), lợi nhuận ròng của công ty <strong>tăng trưởng ${growthRate}%</strong> (Tương đương tăng thêm <strong style="color: var(--secondary);">${AppData.formatCurrency(profitDiff)}</strong>).</li>`;
                } else if (profitDiff < 0) {
                    growthHTML = `<li style="margin-bottom: 0.5rem;"><i class="fa-solid fa-arrow-trend-down" style="color: var(--accent); margin-right: 8px;"></i>So với tháng trước (Tháng ${mo}/${yr}), lợi nhuận ròng của công ty <strong>suy giảm ${Math.abs(growthRate)}%</strong> (Tương đương giảm <strong style="color: var(--accent);">${AppData.formatCurrency(Math.abs(profitDiff))}</strong>). Ban điều hành cần rà soát lại chi phí chuyến.</li>`;
                } else {
                    growthHTML = `<li style="margin-bottom: 0.5rem;"><i class="fa-solid fa-equals" style="color: var(--info); margin-right: 8px;"></i>Lợi nhuận ròng duy trì ổn định tương đương tháng trước (Tháng ${mo}/${yr}).</li>`;
                }
            } else {
                growthHTML = `<li style="margin-bottom: 0.5rem;"><i class="fa-solid fa-circle-info" style="color: var(--info); margin-right: 8px;"></i>Không có dữ liệu của tháng trước (${prevMonthStr}) để so sánh tăng trưởng.</li>`;
            }
        }

        // 5. Cảnh báo và khuyến nghị (Operational Warnings & Recommendations)
        let alertHTML = '';
        let recommendationHTML = '';
        
        // Nhiên liệu DO
        if (Number(fuelDOPercent) > 40) {
            alertHTML += `<div style="background: rgba(244, 63, 94, 0.08); border: 1px solid rgba(244, 63, 94, 0.2); border-radius: 8px; padding: 12px; margin-top: 10px; display: flex; gap: 10px; align-items: flex-start;">
                <i class="fa-solid fa-triangle-exclamation" style="color: var(--accent); font-size: 1.2rem; margin-top: 2px;"></i>
                <div>
                    <strong style="color: var(--text-main); font-size: 0.9rem;">CẢNH BÁO CHI PHÍ NHIÊN LIỆU DO CAO:</strong>
                    <p style="margin: 4px 0 0 0; font-size: 0.85rem; color: var(--text-muted);">
                        Chi phí dầu DO chiếm tới <strong>${fuelDOPercent}%</strong> tổng doanh thu trong kỳ (vượt ngưỡng kiểm soát 40%). Ban quản lý cần rà soát lại định mức tiêu hao dầu của từng tàu.
                    </p>
                </div>
            </div>`;
            recommendationHTML += `<li style="margin-bottom: 0.5rem;"><i class="fa-solid fa-circle-check" style="color: var(--primary-light); margin-right: 8px;"></i>Tăng cường giám sát chỉ số tiêu thụ nhiên liệu chặng và kiểm tra chênh lệch hiệu suất kỹ thuật giữa các tàu.</li>`;
        } else {
            recommendationHTML += `<li style="margin-bottom: 0.5rem;"><i class="fa-solid fa-circle-check" style="color: var(--secondary); margin-right: 8px;"></i>Chi phí nhiên liệu DO chiếm <strong>${fuelDOPercent}%</strong> tổng doanh thu, nằm trong biên độ an toàn và kiểm soát tốt.</li>`;
        }

        // Lợi nhuận
        if (totalProfit < 0) {
            alertHTML += `<div style="background: rgba(244, 63, 94, 0.08); border: 1px solid rgba(244, 63, 94, 0.2); border-radius: 8px; padding: 12px; margin-top: 10px; display: flex; gap: 10px; align-items: flex-start;">
                <i class="fa-solid fa-chart-line-down" style="color: var(--accent); font-size: 1.2rem; margin-top: 2px;"></i>
                <div>
                    <strong style="color: var(--text-main); font-size: 0.9rem;">CẢNH BÁO THUA LỖ:</strong>
                    <p style="margin: 4px 0 0 0; font-size: 0.85rem; color: var(--text-muted);">
                        Kỳ báo cáo này ghi nhận mức <strong>lỗ ròng</strong> <strong style="color: var(--accent);">${AppData.formatCurrency(Math.abs(totalProfit))}</strong>. Cần tối ưu ngay các khoản chi phí không thiết yếu.
                    </p>
                </div>
            </div>`;
            recommendationHTML += `<li style="margin-bottom: 0.5rem;"><i class="fa-solid fa-circle-check" style="color: var(--primary-light); margin-right: 8px;"></i>Kiểm tra lại giá cước vận tải chuyến và đàm phán tối ưu phụ phí đại lý hoa tiêu cảng 2 đầu.</li>`;
        } else if (Number(profitMargin) < 15) {
            recommendationHTML += `<li style="margin-bottom: 0.5rem;"><i class="fa-solid fa-circle-check" style="color: var(--warning); margin-right: 8px;"></i>Biên lợi nhuận ròng hiện ở mức thấp (<strong>${profitMargin}%</strong>). Công ty cần nâng cao hiệu suất xếp dỡ để rút ngắn số ngày chuyến tàu.</li>`;
        } else {
            recommendationHTML += `<li style="margin-bottom: 0.5rem;"><i class="fa-solid fa-circle-check" style="color: var(--secondary); margin-right: 8px;"></i>Biên lợi nhuận ròng đạt hiệu quả lý tưởng (<strong>${profitMargin}%</strong>). Mô hình hoạt động hiện tại rất tối ưu.</li>`;
        }

        // Tàu kém hiệu quả
        if (minProfit < 0) {
            alertHTML += `<div style="background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.2); border-radius: 8px; padding: 12px; margin-top: 10px; display: flex; gap: 10px; align-items: flex-start;">
                <i class="fa-solid fa-circle-exclamation" style="color: var(--warning); font-size: 1.2rem; margin-top: 2px;"></i>
                <div>
                    <strong style="color: var(--text-main); font-size: 0.9rem;">CẢNH BÁO TÀU HOẠT ĐỘNG THUA LỖ:</strong>
                    <p style="margin: 4px 0 0 0; font-size: 0.85rem; color: var(--text-muted);">
                        Tàu <strong>${worstVesselObj.name}</strong> đang có biên lợi nhuận âm <strong style="color: var(--accent);">${AppData.formatCurrency(minProfit)}</strong> qua <strong>${vesselStats[worstVessel].voyages}</strong> chuyến hàng.
                    </p>
                </div>
            </div>`;
        }

        let timeStr = filterMonth ? `Tháng ${filterMonth.split('-')[1]}/${filterMonth.split('-')[0]}` : 'Toàn bộ thời gian';

        el.innerHTML = `
            <div style="display: grid; grid-template-columns: 3fr 2fr; gap: 2rem;">
                <div>
                    <h4 style="margin: 0 0 0.75rem 0; color: var(--primary-light); font-size: 1.05rem;"><i class="fa-solid fa-list-check" style="margin-right: 6px;"></i>Nhận định Tài chính & Vận hành (${timeStr})</h4>
                    <ul style="padding-left: 1.25rem; margin: 0; color: var(--text-main);">
                        <li style="margin-bottom: 0.5rem;">
                            Tổng doanh thu thực tế toàn đội tàu đạt <strong style="color: var(--info);">${AppData.formatCurrency(totalRevenue)}</strong> 
                            với tổng chi phí vận hành chuyến là <strong style="color: var(--accent);">${AppData.formatCurrency(totalCost)}</strong>.
                        </li>
                        <li style="margin-bottom: 0.5rem;">
                            Lợi nhuận ròng thu về đạt <strong style="color: var(--secondary);">${AppData.formatCurrency(totalProfit)}</strong>, 
                            biên lợi nhuận ròng trung bình đạt <strong>${profitMargin}%</strong>.
                        </li>
                        ${growthHTML}
                        <li style="margin-bottom: 0.5rem;">
                            Tàu mang lại hiệu quả kinh tế cao nhất là <strong>${bestVesselObj.name}</strong> 
                            đạt lợi nhuận ròng <strong style="color: var(--secondary);">${AppData.formatCurrency(maxProfit)}</strong> 
                            qua <strong>${vesselStats[bestVessel].voyages}</strong> chuyến đi.
                        </li>
                        ${bestVessel !== worstVessel ? `
                        <li style="margin-bottom: 0.5rem;">
                            Tàu có hiệu quả kinh tế thấp nhất là <strong>${worstVesselObj.name}</strong> 
                            với lợi nhuận ròng là <strong style="${minProfit < 0 ? 'color: var(--accent);' : 'color: var(--text-main);'}">${AppData.formatCurrency(minProfit)}</strong>.
                        </li>
                        ` : ''}
                        <li style="margin-bottom: 0.5rem;">
                            Chi phí nhiên liệu DO là chi phí lớn nhất, tiêu tốn <strong style="color: var(--warning);">${AppData.formatCurrency(totalFuelDO)}</strong>, 
                            chiếm <strong>${fuelDOPercent}%</strong> tổng doanh thu thực tế.
                        </li>
                    </ul>
                </div>
                
                <div style="border-left: 1px solid var(--border-color); padding-left: 2rem;">
                    <h4 style="margin: 0 0 0.75rem 0; color: var(--secondary); font-size: 1.05rem;"><i class="fa-solid fa-lightbulb" style="margin-right: 6px;"></i>Đề xuất Khuyến nghị Vận hành</h4>
                    <ul style="padding-left: 1.25rem; margin: 0; color: var(--text-main); font-size: 0.9rem;">
                        ${recommendationHTML}
                        <li style="margin-bottom: 0.5rem;"><i class="fa-solid fa-circle-check" style="color: var(--primary-light); margin-right: 8px;"></i>Tập trung khai thác và phân bổ thêm tài nguyên cho đội tàu <strong>${bestVesselObj.name}</strong> để tối ưu hóa doanh số.</li>
                    </ul>
                </div>
            </div>
            
            ${alertHTML ? `
            <div style="margin-top: 1.5rem; border-top: 1px solid var(--border-color); padding-top: 1.25rem;">
                <h4 style="margin: 0 0 0.75rem 0; color: var(--accent); font-size: 1.05rem;"><i class="fa-solid fa-triangle-exclamation" style="margin-right: 6px;"></i>Cảnh báo Vận hành khẩn cấp</h4>
                <div style="display: grid; grid-template-columns: 1fr; gap: 10px;">
                    ${alertHTML}
                </div>
            </div>
            ` : ''}

            <!-- Phân tích Chi tiết Từng Tàu -->
            <div style="margin-top: 2rem; border-top: 1px solid var(--border-color); padding-top: 1.5rem;">
                <h4 style="margin: 0 0 1.25rem 0; color: var(--primary-light); font-size: 1.1rem; display: flex; align-items: center; gap: 8px;">
                    <i class="fa-solid fa-ship"></i> Phân tích Hiệu quả & Chi tiết Chi phí từng Tàu (${timeStr})
                </h4>
                <div style="display: grid; grid-template-columns: 1fr; gap: 1.5rem;">
                    ${Object.keys(vesselStats).map(vId => {
                        const stats = vesselStats[vId];
                        const vesselObj = AppData.state.vessels.find(v => v.id === vId) || { name: vId };
                        const margin = stats.revenue > 0 ? ((stats.profit / stats.revenue) * 100).toFixed(1) : 0;
                        
                        // Chi tiết các hạng mục chi phí > 0
                        const costLabels = {
                            fuelDO: 'Dầu DO',
                            fuelLO: 'Dầu LO',
                            crewSalary: 'Lương thuyền viên',
                            crewFood: 'Tiền ăn',
                            crewInsurance: 'Bảo hiểm TV',
                            materialCompany: 'Vật tư Cty cấp',
                            materialVessel: 'Vật tư Tàu chi',
                            monthlyOther: 'CP Phân bổ Cty',
                            agent: 'Đại lý 2 đầu cảng',
                            vessel2ends: 'Tàu chi 2 đầu cảng',
                            portFees: 'Phí cảng & hoa tiêu',
                            brokerage: 'Tiền Bông',
                            vat: 'Thuế VAT',
                            others: 'Chi phí khác'
                        };

                        const costRows = Object.keys(costLabels).map(key => {
                            const val = stats.costsDetail[key] || 0;
                            if (val <= 0) return '';
                            const pct = stats.cost > 0 ? ((val / stats.cost) * 100).toFixed(1) : 0;
                            const revPct = stats.revenue > 0 ? ((val / stats.revenue) * 100).toFixed(1) : 0;
                            return `
                                <tr>
                                    <td style="padding: 6px 12px; border-bottom: 1px solid rgba(255,255,255,0.03); color: var(--text-muted);">${costLabels[key]}</td>
                                    <td style="padding: 6px 12px; border-bottom: 1px solid rgba(255,255,255,0.03); text-align: right; font-weight: 500;">${AppData.formatCurrency(val)}</td>
                                    <td style="padding: 6px 12px; border-bottom: 1px solid rgba(255,255,255,0.03); text-align: right; color: var(--warning); font-size: 0.85rem;">${pct}%</td>
                                    <td style="padding: 6px 12px; border-bottom: 1px solid rgba(255,255,255,0.03); text-align: right; color: var(--info); font-size: 0.85rem;">${revPct}%</td>
                                </tr>
                            `;
                        }).join('');

                        // Nhận xét định tính cho tàu này
                        let vesselComment = '';
                        if (stats.profit > 0) {
                            if (Number(margin) >= 20) {
                                vesselComment = `<span style="color: var(--secondary); font-weight: 600;"><i class="fa-solid fa-circle-check"></i> Hoạt động rất hiệu quả.</span> Lợi nhuận ròng tốt (${margin}%) nhờ kiểm soát chi phí tối ưu.`;
                            } else {
                                vesselComment = `<span style="color: var(--warning); font-weight: 600;"><i class="fa-solid fa-triangle-exclamation"></i> Hiệu quả trung bình.</span> Biên lợi nhuận ròng đạt ${margin}%, cần rà soát lại các hạng mục chi phí chiếm tỷ trọng cao.`;
                            }
                        } else {
                            vesselComment = `<span style="color: var(--accent); font-weight: 600;"><i class="fa-solid fa-circle-xmark"></i> Hoạt động thua lỗ.</span> Tàu bị âm lợi nhuận <strong style="color: var(--accent);">${AppData.formatCurrency(Math.abs(stats.profit))}</strong> trong kỳ này.`;
                        }

                        const specificDO = stats.costsDetail.fuelDO;
                        const specFuelDOPercent = stats.revenue > 0 ? ((specificDO / stats.revenue) * 100).toFixed(1) : 0;
                        if (Number(specFuelDOPercent) > 40) {
                            vesselComment += ` <br><span style="color: var(--accent); font-weight: 600;"><i class="fa-solid fa-triangle-exclamation"></i> Cảnh báo:</span> Chi phí dầu DO rất cao, chiếm <strong>${specFuelDOPercent}%</strong> tổng doanh thu của tàu.`;
                        }

                        return `
                            <div style="background: rgba(255,255,255,0.01); border: 1px solid rgba(255,255,255,0.04); border-radius: 8px; padding: 1.25rem;">
                                <!-- Vessel Summary Header -->
                                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 1rem; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.75rem;">
                                    <div style="display: flex; align-items: center; gap: 8px;">
                                        <span style="font-size: 1.1rem; font-weight: 700; color: var(--info);"><i class="fa-solid fa-ship"></i> ${vesselObj.name}</span>
                                        <span class="badge badge-outline" style="font-size: 0.75rem;">${stats.voyages} chuyến</span>
                                    </div>
                                    <div style="display: flex; gap: 1.5rem; font-size: 0.9rem;">
                                        <div>Doanh thu: <strong style="color: var(--info);">${AppData.formatCurrency(stats.revenue)}</strong></div>
                                        <div>Chi phí: <strong style="color: var(--accent);">${AppData.formatCurrency(stats.cost)}</strong></div>
                                        <div>Lợi nhuận: <strong class="${stats.profit >= 0 ? 'value-positive' : 'value-negative'}">${AppData.formatCurrency(stats.profit)} (${margin}%)</strong></div>
                                    </div>
                                </div>

                                <!-- Detail Layout: Comment and Cost Breakdown -->
                                <div style="display: grid; grid-template-columns: 1.2fr 2fr; gap: 2rem;">
                                    <div style="font-size: 0.9rem; line-height: 1.6; display: flex; flex-direction: column; justify-content: center; background: rgba(255,255,255,0.01); padding: 12px; border-radius: 6px; border-left: 3px solid var(--primary-light);">
                                        <h5 style="margin: 0 0 6px 0; font-size: 0.95rem; color: var(--text-main); font-weight: 600;">Nhận định vận hành:</h5>
                                        <p style="margin: 0; color: var(--text-muted);">${vesselComment}</p>
                                    </div>
                                    <div>
                                        <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
                                            <thead>
                                                <tr style="background: rgba(255,255,255,0.03); color: var(--text-muted); font-weight: 600;">
                                                    <th style="padding: 6px 12px; text-align: left;">Hạng mục chi phí</th>
                                                    <th style="padding: 6px 12px; text-align: right;">Số tiền</th>
                                                    <th style="padding: 6px 12px; text-align: right;">% Chi phí</th>
                                                    <th style="padding: 6px 12px; text-align: right;">% Doanh thu</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                ${costRows}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    },

    openModal(id) { document.getElementById(id).classList.add('active'); },
    closeModal(id) { document.getElementById(id).classList.remove('active'); },

    hrTab: 'all',

    openEmployeeModal() {
        document.getElementById('employee-modal-content').innerHTML = Views.employeeModal();
        this.openModal('employee-modal');
    },
    editEmployee(id) {
        const e = AppData.getEmployee(id);
        if (!e) return;
        document.getElementById('employee-modal-content').innerHTML = Views.employeeModal(e);
        this.openModal('employee-modal');
    },
    saveEmployee(id) {
        const emp = {
            id: id || null,
            name: document.getElementById('emp-name').value,
            phone: document.getElementById('emp-phone').value,
            role: document.getElementById('emp-role').value,
            department: document.getElementById('emp-department').value,
            joinDate: document.getElementById('emp-join').value,
            leaveDate: document.getElementById('emp-leave').value,
            basicSalary: this.parseNum(document.getElementById('emp-basic-salary').value),
            mealAllowance: this.parseNum(document.getElementById('emp-meal-allowance').value),
            phoneAllowance: this.parseNum(document.getElementById('emp-phone-allowance').value),
            clothingAllowance: this.parseNum(document.getElementById('emp-clothing-allowance').value),
            transportAllowance: this.parseNum(document.getElementById('emp-transport-allowance').value),
            personalDeduction: this.parseNum(document.getElementById('emp-personal-deduction').value),
            dependents: Number(document.getElementById('emp-dependents').value) || 0,
            actualSalary: this.parseNum(document.getElementById('emp-actual-salary').value),
            insurance: this.parseNum(document.getElementById('emp-insurance').value),
            deliveryAllowance: this.parseNum(document.getElementById('emp-delivery-allowance').value),
            completionBonus: this.parseNum(document.getElementById('emp-completion-bonus').value),
            notes: document.getElementById('emp-notes').value
        };
        // --- Validate (inline) ---
        this._clearFieldErrors();
        if (!emp.name || !emp.name.trim()) return this._vErr('Vui lòng nhập Họ tên nhân sự.', 'emp-name');
        if (emp.joinDate && !this._isValidDate(emp.joinDate)) return this._vErr('Ngày vào làm không hợp lệ.', 'emp-join');
        if (emp.basicSalary < 0) return this._vErr('Lương cơ bản không được âm.', 'emp-basic-salary');
        AppData.saveEmployee(emp);
        this.closeModal('employee-modal');
        this.toast('Đã lưu nhân sự ' + emp.name, 'success');
        this.navigate('hr');
    },
    deleteEmployee(id) {
        if (confirm('Bạn có chắc muốn xóa nhân sự này?')) {
            AppData.deleteEmployee(id);
            this.navigate('hr');
        }
    },

    loadSalaryView() {
        const month = document.getElementById('sal-month')?.value;
        const dep = document.getElementById('sal-department')?.value;
        this.navigate('salary', month, dep, app.salaryTab || 'thucte');
    },

    updateVoyageCount() {
        const month = document.getElementById('sal-month')?.value;
        const dep = document.getElementById('sal-department')?.value;
        const count = Number(document.getElementById('sal-voyage-count')?.value) || 0;
        let ts = AppData.getTimesheet(month, dep);
        if (!ts) {
            ts = { month, department: dep, attendance: {}, voyageCount: 0 };
        }
        ts.voyageCount = count;
        AppData.saveTimesheet(ts);
        this.navigate('salary', month, dep, 'chungtu');
    },

    toggleAttendanceDay(employeeId, dayIndex, isChecked) {
        const month = document.getElementById('sal-month')?.value;
        const dep = document.getElementById('sal-department')?.value;
        let ts = AppData.getTimesheet(month, dep);
        if (!ts) return; // Should not happen
        
        if (ts.attendance[employeeId] && ts.attendance[employeeId].length > dayIndex) {
            ts.attendance[employeeId][dayIndex] = isChecked;
            AppData.saveTimesheet(ts);
            // Re-render view to update calculations
            this.navigate('salary', month, dep);
        }
    },

    openTransactionModal() {
        document.getElementById('trans-modal-content').innerHTML = Views.transModal();
        document.getElementById('t-id').value = '';
        this.openModal('trans-modal');
    },
    // === Quản lý người dùng / phân quyền (Phase 3, owner) ===
    async loadMembers() {
        const panel = document.getElementById('members-panel');
        if (!panel || typeof window.smListMembers !== 'function') return;
        try {
            const members = await window.smListMembers();
            const modules = (window.APP_MODULES || []).filter(m => m.key !== 'company');
            const me = window.SM_USER || {};
            const allVessels = (AppData.state.vessels || []);
            let html = `
                <div style="background:rgba(0,0,0,0.25); padding:1.2rem; border-radius:var(--radius-md); margin-bottom:1.5rem; border:1px dashed var(--border-color);">
                    <h4 style="margin:0 0 0.75rem;">Thêm nhân viên (user phụ)</h4>
                    <div class="grid-2">
                        <input id="mb-email" class="form-control" type="email" placeholder="Email nhân viên">
                        <input id="mb-pass" class="form-control" type="password" placeholder="Mật khẩu (≥ 6 ký tự)">
                    </div>
                    <div style="margin:0.9rem 0;">
                        <label style="font-size:0.85rem; font-weight:600;">Vai trò:</label>
                        <select id="mb-role" class="form-control" style="max-width:300px; margin-top:6px;" onchange="app.onRoleChange()">
                            <option value="sub">Sub (Thuyền trưởng/nhân viên — chỉ tàu được gán)</option>
                            <option value="accountant">Kế toán (xem cả tài chính + lương toàn công ty)</option>
                        </select>
                    </div>
                    <div id="mb-vessel-wrap" style="margin:0.9rem 0;">
                        <small style="color:var(--text-muted); font-weight:600;">Gán tàu (BẮT BUỘC cho vai trò Sub) — tối đa 10:</small>
                        <div style="display:flex; flex-wrap:wrap; gap:10px; margin-top:8px;">
                            ${allVessels.map(v => `<label style="display:flex; align-items:center; gap:6px; font-size:0.85rem; cursor:pointer;">
                                <input type="checkbox" class="mb-vessel" value="${esc(v.id)}"> ${esc(v.name)} (${esc(v.id)})</label>`).join('') || '<span style="font-size:0.8rem; color:var(--text-muted);">(Chưa có tàu nào)</span>'}
                        </div>
                    </div>
                    <div style="margin:0.9rem 0;">
                        <small style="color:var(--text-muted); font-weight:600;">Cho phép truy cập các phần (giao diện):</small>
                        <div style="display:flex; flex-wrap:wrap; gap:12px; margin-top:8px;">
                            ${modules.map(m => `<label style="display:flex; align-items:center; gap:6px; font-size:0.85rem; cursor:pointer;">
                                <input type="checkbox" class="mb-perm" value="${m.key}"> ${m.label}</label>`).join('')}
                        </div>
                    </div>
                    <button class="btn btn-primary" onclick="app.addMemberSubmit()"><i class="fa-solid fa-user-plus"></i> Tạo nhân viên</button>
                    <span id="mb-msg" style="margin-left:12px; font-size:0.85rem;"></span>
                </div>
                <div class="table-container"><table class="table">
                    <thead><tr><th>Email</th><th>Vai trò</th><th>Tàu được gán</th><th>Quyền GD</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>`;
            const roleLabel = (r) => r === 'owner' ? '<span class="badge badge-success">Chủ</span>'
                : r === 'accountant' ? '<span class="badge badge-info">Kế toán</span>'
                : '<span class="badge badge-outline">Sub</span>';
            members.sort((a, b) => (a.role === 'owner' ? -1 : (b.role === 'owner' ? 1 : 0))).forEach(mb => {
                const permList = mb.role === 'owner' || mb.role === 'accountant' ? 'Toàn quyền'
                    : (modules.filter(m => mb.permissions && mb.permissions[m.key]).map(m => m.label).join(', ') || '—');
                const vlist = (mb.vesselIds && mb.vesselIds.length)
                    ? mb.vesselIds.map(esc).join(', ')
                    : (mb.role === 'sub' ? '<span style="color:var(--accent);">— chưa gán</span>' : '<span style="color:var(--text-muted);">tất cả</span>');
                const active = mb.active !== false;
                html += `<tr>
                    <td>${esc(mb.email || '')} ${mb.uid === me.uid ? '<span class="badge badge-outline">Bạn</span>' : ''}</td>
                    <td>${roleLabel(mb.role)}</td>
                    <td style="font-size:0.78rem;">${vlist}</td>
                    <td style="font-size:0.78rem; max-width:240px;">${permList}</td>
                    <td>${active ? '<span style="color:var(--secondary)">Hoạt động</span>' : '<span style="color:var(--accent)">Đã khóa</span>'}</td>
                    <td>${mb.role === 'owner' ? '' : `<button class="btn btn-outline" style="padding:0.2rem 0.6rem; font-size:0.78rem;" onclick="app.toggleMember('${mb.uid}', ${active})">${active ? 'Khóa' : 'Mở khóa'}</button>`}</td>
                </tr>`;
            });
            html += `</tbody></table></div>`;
            panel.innerHTML = html;
        } catch (e) {
            panel.innerHTML = '<p style="color:var(--accent)">Lỗi tải danh sách: ' + (e.message || e) + '</p>';
        }
    },
    onRoleChange() {
        const r = (document.getElementById('mb-role') || {}).value;
        const wrap = document.getElementById('mb-vessel-wrap');
        if (wrap) wrap.style.display = (r === 'accountant') ? 'none' : '';
    },
    addMemberSubmit() {
        const email = (document.getElementById('mb-email') || {}).value;
        const pass = (document.getElementById('mb-pass') || {}).value;
        const role = (document.getElementById('mb-role') || {}).value || 'sub';
        const msg = document.getElementById('mb-msg');
        const setMsg = (t, c) => { if (msg) { msg.textContent = t; msg.style.color = c; } };
        const perms = {};
        document.querySelectorAll('.mb-perm:checked').forEach(c => perms[c.value] = true);
        const vesselIds = Array.from(document.querySelectorAll('.mb-vessel:checked')).map(c => c.value);
        if (!email || !pass) return setMsg('Nhập email và mật khẩu.', 'var(--accent)');
        if (pass.length < 6) return setMsg('Mật khẩu phải ≥ 6 ký tự.', 'var(--accent)');
        if (Object.keys(perms).length === 0) return setMsg('Chọn ít nhất 1 phần được phép truy cập (giao diện).', 'var(--accent)');
        if (role === 'sub' && vesselIds.length === 0) return setMsg('Vui lòng gán ít nhất 1 tàu cho Sub.', 'var(--accent)');
        setMsg('Đang tạo...', 'var(--text-muted)');
        const mapErr = (e) => {
            switch (e && e.code) {
                case 'auth/email-already-in-use':
                    return 'Email này đã có tài khoản (có thể đang là chủ/nhân viên nơi khác). Vui lòng dùng một email MỚI chưa từng đăng ký.';
                case 'auth/invalid-email': return 'Email không hợp lệ.';
                case 'auth/weak-password': return 'Mật khẩu quá yếu (cần ≥ 6 ký tự).';
                case 'auth/operation-not-allowed': return 'Chưa bật Email/Password trong Firebase Console.';
                default: return 'Lỗi: ' + (e.code || e.message || e);
            }
        };
        window.smAddSubUser(email, pass, perms, { role, vesselIds })
            .then(() => {
                setMsg('✓ Đã tạo nhân viên!', 'var(--secondary)');
                const em = document.getElementById('mb-email'); if (em) em.value = '';
                const pw = document.getElementById('mb-pass'); if (pw) pw.value = '';
                this.loadMembers();
            })
            .catch(e => setMsg(mapErr(e), 'var(--accent)'));
    },
    toggleMember(uid, currentlyActive) {
        if (!confirm(currentlyActive ? 'Khóa truy cập của user này?' : 'Mở khóa user này?')) return;
        window.smSetMemberActive(uid, !currentlyActive)
            .then(() => this.loadMembers())
            .catch(e => alert('Lỗi: ' + (e.message || e)));
    },

    // === Nhật ký thay đổi (audit log) — owner ===
    // Nhãn field + định dạng để hiển thị "đã đổi gì"
    _AUDIT_FIELD_LABELS: {
        thu: 'Thu', chi: 'Chi', content: 'Nội dung', partner: 'Đối tác', category: 'Hạng mục', account: 'Tài khoản',
        vessel: 'Tàu', date: 'Ngày', voyageNo: 'Số chuyến', contractNo: 'Mã HĐ',
        fuelRate: 'Định mức (L/h)', hours: 'Số giờ', startPos: 'Nơi đi', endPos: 'Nơi đến', startTime: 'TG đi', endTime: 'TG đến',
        addedFuel: 'Tiếp dầu (L)', fuelUnitPrice: 'Đơn giá dầu', initialFuel: 'Tồn đầu (L)', fuelVendor: 'NCC dầu', fuelLocation: 'Nơi cấp', fuelDate: 'Ngày cấp', cargoType: 'Loại hàng',
        customer: 'Khách hàng', cargo: 'Hàng', portLoad: 'Cảng đi', portDischarge: 'Cảng đến', qty: 'Khối lượng (tấn)', rate: 'Đơn giá', markup: 'Tiền gửi',
        revenueReal: 'Doanh thu thực', revenueInvoice: 'Doanh thu HĐ', dateStart: 'Ngày bắt đầu', dateEnd: 'Ngày kết thúc', reportMonth: 'Tháng hạch toán',
        amount: 'Số tiền', salary: 'Lương', insurance: 'Bảo hiểm', food: 'Tiền ăn', other: 'Khác', loanInterest: 'Lãi vay',
        fuelDO: 'Dầu DO', fuelLO: 'Dầu LO', crewSalary: 'Lương TV', crewFood: 'Tiền ăn', crewInsurance: 'Bảo hiểm', vat: 'VAT',
        name: 'Tên', captain: 'Thuyền trưởng', manager: 'Quản lý', capacity: 'Tải trọng', address: 'Địa chỉ', contact: 'SĐT'
    },
    _fmtAuditVal(v) {
        if (v === null || v === undefined || v === '') return '(trống)';
        if (typeof v === 'number') return v.toLocaleString('vi-VN');
        if (typeof v === 'object') return JSON.stringify(v);
        return String(v);
    },
    _diffText(before, after) {
        if (!before || !after) return '';
        const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
        const skip = new Set(['updatedAt', 'id', '_id', 'fuelVoyageId', 'vesselId']);
        const parts = [];
        keys.forEach(k => {
            if (skip.has(k)) return;
            const bv = before[k], av = after[k];
            if ((typeof bv === 'object' && bv) || (typeof av === 'object' && av)) {
                if (JSON.stringify(bv) !== JSON.stringify(av) && bv && av) {
                    const sub = this._diffText(bv, av);
                    if (sub) parts.push(sub);
                }
                return;
            }
            if (String(bv) !== String(av)) {
                const label = this._AUDIT_FIELD_LABELS[k] || k;
                parts.push(`${label}: ${this._fmtAuditVal(bv)} → ${this._fmtAuditVal(av)}`);
            }
        });
        return parts.join(' · ');
    },
    async loadAudit() {
        const panel = document.getElementById('audit-panel');
        if (!panel || typeof window.smListAudit !== 'function') return;
        try {
            const items = await window.smListAudit(50);
            if (!items.length) {
                panel.innerHTML = '<p style="color:var(--text-muted); margin:0;">Chưa có thay đổi nào được ghi nhận.</p>';
                return;
            }
            const fmt = (iso) => { try { return new Date(iso).toLocaleString('vi-VN'); } catch (e) { return iso; } };
            let html = '<div class="table-container"><table class="table"><thead><tr><th>Thời gian</th><th>Người dùng</th><th>Thay đổi</th><th>Thao tác</th></tr></thead><tbody>';
            items.forEach(it => {
                let text = it.summary || it.detail || it.action || '';
                // Với "sửa": hiện rõ field nào đổi (cũ → mới)
                if (it.action === 'edit' && it.before && it.after) {
                    const d = this._diffText(it.before, it.after);
                    if (d) {
                        const head = (it.summary || 'Sửa').split(':')[0];
                        text = `<strong>${esc(head)}</strong><br><span style="color:var(--text-muted); font-size:0.78rem;">${esc(d)}</span>`;
                    } else { text = esc(text); }
                } else { text = esc(text); }
                const canUndo = !it.undone && (it.grouped || (it.coll && it.recordId));
                const undoBtn = it.undone
                    ? '<span style="font-size:0.78rem; color:var(--text-muted);"><i class="fa-solid fa-rotate-left"></i> Đã hoàn tác</span>'
                    : (canUndo ? `<button class="btn btn-outline" style="padding:0.2rem 0.6rem; font-size:0.78rem;" onclick="app.undoAudit('${it._id}')"><i class="fa-solid fa-rotate-left"></i> Hoàn tác</button>` : '');
                html += `<tr style="${it.undone ? 'opacity:0.55;' : ''}">
                    <td style="white-space:nowrap; font-size:0.8rem;">${esc(fmt(it.at))}</td>
                    <td style="font-size:0.8rem;">${esc(it.userEmail || '')}</td>
                    <td style="font-size:0.82rem;">${text}</td>
                    <td>${undoBtn}</td>
                </tr>`;
            });
            html += '</tbody></table></div><p style="font-size:0.75rem; color:var(--text-muted); margin-top:8px;">Hiển thị tối đa 50 thay đổi gần nhất. "Hoàn tác" khôi phục dữ liệu về trước thay đổi đó.</p>';
            panel.innerHTML = html;
        } catch (e) {
            panel.innerHTML = '<p style="color:var(--accent)">Lỗi tải nhật ký: ' + (e.message || e) + '</p>';
        }
    },
    undoAudit(auditId) {
        if (!confirm('Hoàn tác thay đổi này? Dữ liệu sẽ được khôi phục về trạng thái trước đó.')) return;
        if (typeof window.smUndo !== 'function') return alert('Chức năng hoàn tác chưa sẵn sàng.');
        window.smUndo(auditId)
            .then(() => { this.navigate(this.currentView || 'company'); alert('✅ Đã hoàn tác.'); setTimeout(() => this.loadAudit(), 300); })
            .catch(e => alert('Không thể hoàn tác: ' + (e.message || e)));
    },

    // === Toast (thông báo không chặn) ===
    toast(msg, type = 'info', ms = 3200) {
        let wrap = document.getElementById('sm-toast-wrap');
        if (!wrap) {
            wrap = document.createElement('div');
            wrap.id = 'sm-toast-wrap';
            wrap.className = 'sm-toast-wrap';
            document.body.appendChild(wrap);
        }
        const icons = { info: 'fa-circle-info', success: 'fa-circle-check', error: 'fa-circle-exclamation', warning: 'fa-triangle-exclamation' };
        const el = document.createElement('div');
        el.className = 'sm-toast ' + type;
        el.innerHTML = `<i class="fa-solid ${icons[type] || icons.info}"></i><span>${esc(String(msg))}</span>`;
        wrap.appendChild(el);
        setTimeout(() => {
            el.classList.add('hide');
            setTimeout(() => el.remove(), 220);
        }, ms);
    },

    // === Nhắc hết hạn đăng kiểm/chứng chỉ qua thông báo trình duyệt (#36) ===
    // Tính danh sách chứng chỉ sắp/đã hết hạn trong `days` ngày tới.
    getExpiringCerts(days = 30) {
        const today = new Date();
        const out = [];
        (AppData.state.vessels || []).forEach(v => {
            [['certRegistry', 'Đăng kiểm'], ['certLicense', 'Cấp phép VT'], ['certInsurance', 'Bảo hiểm']].forEach(([k, label]) => {
                const d = v[k]; if (!d) return;
                const dt = new Date(d); if (isNaN(dt)) return;
                const diff = Math.ceil((dt - today) / 86400000);
                if (diff <= days) out.push({ vessel: v.name, kind: label, date: d, days: diff });
            });
        });
        return out.sort((a, b) => a.days - b.days);
    },
    // Bật nhắc nhở: xin quyền thông báo, rồi bắn ngay nếu có cảnh báo.
    enableCertNotifications() {
        if (!('Notification' in window)) return this.toast('Trình duyệt không hỗ trợ thông báo.', 'warning');
        Notification.requestPermission().then(perm => {
            if (perm === 'granted') {
                this.toast('Đã bật nhắc đăng kiểm qua thông báo.', 'success');
                this._fireCertNotification(true);
            } else {
                this.toast('Bạn đã từ chối quyền thông báo.', 'warning');
            }
        });
    },
    // Bắn thông báo nếu có cảnh báo + đã được cấp quyền. Mặc định tối đa 1 lần/ngày.
    _fireCertNotification(force) {
        if (!('Notification' in window) || Notification.permission !== 'granted') return;
        const alerts = this.getExpiringCerts(30);
        if (!alerts.length) return;
        if (!force) {
            const today = new Date().toISOString().slice(0, 10);
            try { if (localStorage.getItem('sm_cert_notified') === today) return; } catch (e) {}
            try { localStorage.setItem('sm_cert_notified', today); } catch (e) {}
        }
        const top = alerts[0];
        const more = alerts.length > 1 ? ` (+${alerts.length - 1} mục khác)` : '';
        const body = top.days < 0
            ? `${top.vessel} · ${top.kind} đã hết hạn ${Math.abs(top.days)} ngày${more}`
            : `${top.vessel} · ${top.kind} còn ${top.days} ngày${more}`;
        try {
            const n = new Notification('⚠️ Sắp hết hạn đăng kiểm/chứng chỉ', { body, icon: 'icon.svg', tag: 'sm-cert' });
            n.onclick = () => { window.focus(); n.close(); };
        } catch (e) { /* một số trình duyệt cần SW để hiện -> bỏ qua êm */ }
    },
    // Gọi lúc khởi động: chỉ bắn nếu người dùng đã cấp quyền từ trước.
    checkCertNotificationsOnBoot() {
        if (('Notification' in window) && Notification.permission === 'granted') {
            this._fireCertNotification(false);
        }
    },

    // === Validation helpers (chống nhập sai dữ liệu tài chính) ===
    // Xóa mọi đánh dấu lỗi field trước mỗi lần validate.
    _clearFieldErrors() {
        document.querySelectorAll('.field-error').forEach(el => el.classList.remove('field-error'));
        document.querySelectorAll('.field-error-msg').forEach(el => el.remove());
    },
    // Báo lỗi: highlight field (nếu có id) + chèn message dưới field + toast. Không chặn (không alert).
    _vErr(msg, fieldId) {
        if (fieldId) {
            const el = document.getElementById(fieldId);
            if (el) {
                el.classList.add('field-error');
                const m = document.createElement('small');
                m.className = 'field-error-msg';
                m.textContent = msg;
                (el.parentNode || el).insertBefore(m, el.nextSibling);
                try { el.focus({ preventScroll: false }); el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) {}
            }
        }
        this.toast(msg, 'error');
        return false;
    },
    _isNumeric(raw) { return raw !== '' && raw !== null && raw !== undefined && isFinite(Number(raw)); },
    _isValidDate(v) { return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) && !isNaN(new Date(v).getTime()); },

    // === Auto-backup: giữ tối đa N ảnh chụp gần nhất trong localStorage (mỗi ngày 1 ảnh) ===
    AUTOBACKUP_KEY: 'shipManageDB_autobackups',
    AUTOBACKUP_MAX: 3,
    runAutoBackup() {
        try {
            const today = new Date().toISOString().slice(0, 10);
            let list = this.listAutoBackups();
            if (list.some(b => b.date === today)) return; // hôm nay đã có ảnh
            const data = (AppData.state) ? JSON.stringify(AppData.state) : localStorage.getItem('shipManageDB_v2');
            if (!data) return;
            list.push({ date: today, at: new Date().toISOString(), data });
            while (list.length > this.AUTOBACKUP_MAX) list.shift();
            try {
                localStorage.setItem(this.AUTOBACKUP_KEY, JSON.stringify(list));
                console.log('[AutoBackup] Đã tạo ảnh chụp', today, '(' + list.length + '/' + this.AUTOBACKUP_MAX + ')');
            } catch (e) {
                // localStorage đầy -> bỏ ảnh cũ nhất rồi thử lại 1 lần
                list.shift();
                try { localStorage.setItem(this.AUTOBACKUP_KEY, JSON.stringify(list)); }
                catch (e2) { console.warn('[AutoBackup] localStorage đầy, bỏ qua.'); }
            }
        } catch (e) { console.warn('[AutoBackup] lỗi:', e); }
    },
    listAutoBackups() {
        try { return JSON.parse(localStorage.getItem(this.AUTOBACKUP_KEY)) || []; }
        catch (e) { return []; }
    },
    restoreAutoBackup(date) {
        const b = this.listAutoBackups().find(x => x.date === date);
        if (!b) return alert('Không tìm thấy ảnh chụp ngày ' + date);
        if (!confirm('Khôi phục dữ liệu về ảnh chụp ngày ' + date + '?\n\nDữ liệu hiện tại sẽ bị thay thế. (Nên Tải Backup JSON trước khi khôi phục.)')) return;
        try {
            AppData.state = JSON.parse(b.data);
            localStorage.setItem('shipManageDB_v2', b.data);
            AppData.save();
            this.navigate(this.currentView || 'dashboard');
            alert('✅ Đã khôi phục về ảnh chụp ngày ' + date);
        } catch (e) { alert('Lỗi khôi phục: ' + e.message); }
    },

    saveTransaction() {
        const tId = document.getElementById('t-id').value;
        const t = {
            id: tId || null,
            date: document.getElementById('t-date').value,
            vessel: document.getElementById('t-vessel').value,
            category: document.getElementById('t-cat').value,
            voyageNo: document.getElementById('t-voyage').value,
            contractNo: document.getElementById('t-contract').value,
            partner: document.getElementById('t-partner').value,
            content: document.getElementById('t-content').value,
            thu: this.parseNum(document.getElementById('t-thu').value),
            chi: this.parseNum(document.getElementById('t-chi').value),
            account: document.getElementById('t-acc').value
        };
        // --- Validate (inline: highlight field + toast) ---
        this._clearFieldErrors();
        if (!this._isValidDate(t.date)) return this._vErr('Vui lòng nhập Ngày hợp lệ.', 't-date');
        if (!t.category) return this._vErr('Vui lòng chọn Hạng mục.', 't-cat');
        if (!t.partner || !t.partner.trim()) return this._vErr('Vui lòng nhập Đối tác.', 't-partner');
        if (!t.content || !t.content.trim()) return this._vErr('Vui lòng nhập Nội dung chi tiết.', 't-content');
        if (t.thu < 0 || t.chi < 0) return this._vErr('Khoản Thu/Chi không được âm.', t.thu < 0 ? 't-thu' : 't-chi');
        if (t.thu === 0 && t.chi === 0) return this._vErr('Phải nhập ít nhất một khoản Thu hoặc Chi lớn hơn 0.', 't-thu');
        AppData.addTransaction(t);
        if (window.smLogAudit) window.smLogAudit(tId ? 'Sửa giao dịch' : 'Thêm giao dịch',
            `${t.content || ''} · ${t.partner || ''} · Thu ${t.thu || 0} / Chi ${t.chi || 0} · ${t.vessel || ''}`);
        this.closeModal('trans-modal');
        this.toast(tId ? 'Đã cập nhật giao dịch' : 'Đã thêm giao dịch mới', 'success');
        if (this.currentView === 'debts') {
            this.navigate('debts', this.currentDebtTab || 'customer');
        } else {
            this.navigate('financials');
        }
    },
    editTransaction(id) {
        const trans = AppData.state.transactions.find(t => t.id === id);
        if(!trans) return;
        document.getElementById('trans-modal-content').innerHTML = Views.transModal();
        document.getElementById('t-id').value = trans.id;
        document.getElementById('t-date').value = trans.date;
        document.getElementById('t-vessel').value = trans.vessel;
        document.getElementById('t-cat').value = trans.category;
        
        document.getElementById('t-voyage').value = trans.voyageNo || '';
        this.onTransactionCatChange();
        if (trans.category === 'CVC') {
            document.getElementById('t-contract').value = trans.contractNo || '';
        }
        document.getElementById('t-partner').value = trans.partner;
        document.getElementById('t-content').value = trans.content;
        document.getElementById('t-thu').value = this.fmtMoney(trans.thu);
        document.getElementById('t-chi').value = this.fmtMoney(trans.chi);
        document.getElementById('t-acc').value = trans.account;
        this.openModal('trans-modal');
    },
    deleteTransaction(id) {
        if (confirm('Bạn có chắc muốn xóa giao dịch này?')) {
            const t = AppData.state.transactions.find(x => x.id === id);
            if (t && window.smLogAudit) window.smLogAudit('Xóa giao dịch',
                `${t.content || ''} · ${t.partner || ''} · Thu ${t.thu || 0} / Chi ${t.chi || 0} · ${t.vessel || ''}`);
            AppData.deleteTransaction(id);
            if (this.currentView === 'debts') {
                this.navigate('debts', this.currentDebtTab || 'customer');
            } else {
                this.navigate('financials');
            }
        }
    },
    onTransactionCatChange() {
        const cat = document.getElementById('t-cat').value;
        const wrapper = document.getElementById('t-contract-wrapper');
        const contractSelect = document.getElementById('t-contract');
        
        if (cat === 'CVC') {
            wrapper.style.display = 'block';
            const vesselId = document.getElementById('t-vessel').value;
            const shipments = AppData.state.shipments.filter(s => s.vesselId === vesselId);
            contractSelect.innerHTML = '<option value="">-- Chọn Mã HĐ --</option>' + 
                shipments.map(s => `<option value="${s.contractNo}">${s.contractNo}</option>`).join('');
        } else {
            wrapper.style.display = 'none';
            contractSelect.value = '';
        }
    },

    // Fuel Actions
    openFuelVoyageModal(vesselId, voyageId) {
        document.getElementById('fuel-voyage-modal-content').innerHTML = Views.fuelVoyageModal(vesselId, voyageId);
        this.openModal('fuel-voyage-modal');
    },
    saveFuelVoyage() {
        const id = document.getElementById('fv-id').value;
        const vesselId = document.getElementById('fv-vessel-id').value;
        const fvNo = document.getElementById('fv-no').value;
        
        const existingNo = AppData.findFuelVoyageByVesselAndNo(vesselId, fvNo);
        if (existingNo && existingNo.id !== id) {
            alert(`Lỗi: Chuyến ${fvNo} đã tồn tại cho tàu này!`);
            return;
        }

        const voyage = {
            id: id || null,
            vesselId: vesselId,
            voyageNo: fvNo,
            cargoType: document.getElementById('fv-cargo').value,
            addedFuel: Number(document.getElementById('fv-added').value) || 0,
            fuelUnitPrice: this.parseNum(document.getElementById('fv-price').value),
            fuelDate: document.getElementById('fv-date').value,
            fuelVendor: document.getElementById('fv-vendor').value,
            fuelLocation: document.getElementById('fv-location').value
        };
        // --- Validate ---
        if (!voyage.voyageNo || !voyage.voyageNo.trim()) return this._vErr('Vui lòng nhập Tên chuyến.');
        if (voyage.addedFuel < 0) return this._vErr('Nhiên liệu tiếp thêm không được âm.');
        if (voyage.fuelUnitPrice < 0) return this._vErr('Đơn giá nhiên liệu không được âm.');
        if (voyage.fuelDate && !this._isValidDate(voyage.fuelDate)) return this._vErr('Ngày cấp không hợp lệ.');
        const existing = AppData.getFuelVoyage(id);
        if(existing) {
            voyage.initialFuel = existing.initialFuel;
        }
        AppData.addFuelVoyage(voyage);
        if (window.smLogAudit) window.smLogAudit(id ? 'Sửa chuyến dầu' : 'Thêm chuyến dầu',
            `Chuyến ${voyage.voyageNo} · Tiếp ${voyage.addedFuel || 0}L · Đơn giá ${voyage.fuelUnitPrice || 0} · ${voyage.fuelVendor || ''}`);
        this.closeModal('fuel-voyage-modal');
        this.navigate('fuel', vesselId);
    },
    updateInitialFuel(voyageId, value) {
        const voy = AppData.getFuelVoyage(voyageId);
        if (voy) {
            voy.initialFuel = Number(value) || 0;
            AppData.save();
            if (window.smLogAudit) window.smLogAudit('Sửa tồn dầu đầu', `Chuyến ${voy.voyageNo} · Tồn đầu ${voy.initialFuel}L`);
            this.navigate('fuel', voy.vesselId);
        }
    },
    deleteFuelVoyage(id) {
        const v = AppData.getFuelVoyage(id);
        if (confirm(`Bạn có chắc muốn xóa chuyến ${v.voyageNo} và toàn bộ các chặng thuộc chuyến này?`)) {
            const vesselId = v.vesselId;
            if (window.smLogAudit) window.smLogAudit('Xóa chuyến dầu', `Chuyến ${v.voyageNo}`);
            AppData.deleteFuelVoyage(id);
            this.navigate('fuel', vesselId);
        }
    },

    formatDateTimeLocal(str) {
        if (!str) return '';
        str = String(str).trim();
        if (!str || str === '---') return '';
        
        // If it's already in YYYY-MM-DDTHH:mm format
        if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(str)) {
            return str.substring(0, 16);
        }
        
        // Try to match MM/DD/YYYY HH:mm or DD/MM/YYYY HH:mm
        const parts = str.split(/[\s,T]+/);
        if (parts.length >= 2) {
            const datePart = parts[0];
            const timePart = parts[1];
            
            const dateSubparts = datePart.split('/');
            if (dateSubparts.length === 3) {
                let dVal = Number(dateSubparts[0]);
                let mVal = Number(dateSubparts[1]);
                let yVal = Number(dateSubparts[2]);
                
                // Determine day vs month
                let day, month, year;
                if (dVal > 12) {
                    day = dVal;
                    month = mVal;
                    year = yVal;
                } else if (mVal > 12) {
                    day = mVal;
                    month = dVal;
                    year = yVal;
                } else {
                    // Ambiguous. Default to MM/DD/YYYY, or let Date try to parse it
                    day = dVal;
                    month = mVal;
                    year = yVal;
                    
                    const testD = new Date(str);
                    if (!isNaN(testD.getTime())) {
                        const yr = testD.getFullYear();
                        const mt = String(testD.getMonth() + 1).padStart(2, '0');
                        const dy = String(testD.getDate()).padStart(2, '0');
                        const hr = String(testD.getHours()).padStart(2, '0');
                        const min = String(testD.getMinutes()).padStart(2, '0');
                        return `${yr}-${mt}-${dy}T${hr}:${min}`;
                    }
                }
                
                // Format time part
                const timeSubparts = timePart.split(':');
                let hours = 0;
                let minutes = 0;
                if (timeSubparts.length >= 2) {
                    hours = Number(timeSubparts[0]);
                    minutes = Number(timeSubparts[1]);
                }
                
                if (!isNaN(year) && !isNaN(month) && !isNaN(day) && !isNaN(hours) && !isNaN(minutes)) {
                    const pad = (n) => String(n).padStart(2, '0');
                    return `${year}-${pad(month)}-${pad(day)}T${pad(hours)}:${pad(minutes)}`;
                }
            }
        }
        
        // General fallback using Date
        const d = new Date(str);
        if (!isNaN(d.getTime())) {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            const hours = String(d.getHours()).padStart(2, '0');
            const minutes = String(d.getMinutes()).padStart(2, '0');
            return `${year}-${month}-${day}T${hours}:${minutes}`;
        }
        
        return '';
    },

    openFuelLogModal(voyageId, logId) {
        document.getElementById('fuel-modal-content').innerHTML = Views.fuelModal(voyageId);
        document.getElementById('f-id').value = logId || '';
        if (logId) {
            const log = AppData.state.fuelLogs.find(l => l.id === logId);
            if (log) {
                document.getElementById('f-start-time').value = this.formatDateTimeLocal(log.startTime);
                document.getElementById('f-start-pos').value = log.startPos || '';
                document.getElementById('f-end-time').value = this.formatDateTimeLocal(log.endTime);
                document.getElementById('f-end-pos').value = log.endPos || '';
                document.getElementById('f-fuel-rate').value = log.fuelRate;
                document.getElementById('f-hours').value = log.hours;
            }
        } else {
            const voy = AppData.getFuelVoyage(voyageId);
            const v = AppData.getVessel(voy.vesselId);
            document.getElementById('f-fuel-rate').value = v ? v.fuelRate : 150;
        }
        this.openModal('fuel-modal');
    },
    calcFuelLogHours() {
        const start = document.getElementById('f-start-time').value;
        const end = document.getElementById('f-end-time').value;
        if (start && end) {
            const s = new Date(start);
            const e = new Date(end);
            const hours = Math.abs(e - s) / (1000 * 60 * 60);
            document.getElementById('f-hours').value = hours.toFixed(2);
        }
    },
    saveFuelLog() {
        const fId = document.getElementById('f-id').value;
        const voyId = document.getElementById('f-voyage-id').value;
        const voy = AppData.getFuelVoyage(voyId);
        
        const log = {
            id: fId || null,
            fuelVoyageId: voyId,
            startTime: document.getElementById('f-start-time').value,
            startPos: document.getElementById('f-start-pos').value,
            endTime: document.getElementById('f-end-time').value,
            endPos: document.getElementById('f-end-pos').value,
            fuelRate: Number(document.getElementById('f-fuel-rate').value) || 0,
            hours: document.getElementById('f-hours').value
        };
        // --- Validate ---
        if (!log.startTime || !log.endTime) return this._vErr('Vui lòng nhập đủ Thời gian đi và Thời gian đến.');
        if (new Date(log.endTime).getTime() <= new Date(log.startTime).getTime()) return this._vErr('Thời gian đến phải SAU thời gian đi.');
        if (!log.startPos || !log.startPos.trim() || !log.endPos || !log.endPos.trim()) return this._vErr('Vui lòng nhập Nơi đi và Nơi đến.');
        if (!(log.fuelRate > 0)) return this._vErr('Định mức (Lít/giờ) phải lớn hơn 0.');
        AppData.addFuelLog(log);
        if (window.smLogAudit) window.smLogAudit(fId ? 'Sửa chặng dầu' : 'Thêm chặng dầu',
            `Chuyến ${voy ? voy.voyageNo : ''} · ${log.startPos}→${log.endPos} · Định mức ${log.fuelRate} L/h · ${log.hours}h`);
        this.closeModal('fuel-modal');
        this.navigate('fuel', voy.vesselId);
    },
    editFuelLog(voyageId, logId) {
        this.openFuelLogModal(voyageId, logId);
    },
    deleteFuelLog(id) {
        const log = AppData.state.fuelLogs.find(l => l.id === id);
        if(!log) return;
        const voy = AppData.getFuelVoyage(log.fuelVoyageId);
        if (confirm('Bạn có chắc muốn xóa chặng này?')) {
            if (window.smLogAudit) window.smLogAudit('Xóa chặng dầu',
                `Chuyến ${voy ? voy.voyageNo : ''} · ${log.startPos}→${log.endPos} · Định mức ${log.fuelRate} L/h`);
            AppData.deleteFuelLog(id);
            this.navigate('fuel', voy.vesselId);
        }
    },

    // Monthly Cost Actions
    loadMonthlyCosts() {
        const month = document.getElementById('m-month').value;
        const vesselId = document.getElementById('m-vessel').value;
        const costs = AppData.getMonthlyCosts(month, vesselId);
        document.getElementById('m-salary').value = this.fmtMoney(costs.salary || 0);
        document.getElementById('m-ins').value = this.fmtMoney(costs.insurance || 0);
        document.getElementById('m-food').value = this.fmtMoney(costs.food || 0);
        document.getElementById('m-material-company').value = this.fmtMoney(costs.materialCompany || 0);
        document.getElementById('m-material-vessel').value = costs.materialVessel || 0;
        document.getElementById('m-loan-interest').value = costs.loanInterest || 0;
        document.getElementById('m-loan-interest-external').value = this.fmtMoney(costs.loanInterestExternal || 0);
        document.getElementById('m-other').value = this.fmtMoney(costs.other || 0);
    },
    saveMonthlyCosts() {
        const month = document.getElementById('m-month').value;
        const vesselId = document.getElementById('m-vessel').value;
        const data = {
            month,
            vesselId,
            salary: this.parseNum(document.getElementById('m-salary').value),
            insurance: this.parseNum(document.getElementById('m-ins').value),
            food: this.parseNum(document.getElementById('m-food').value),
            materialCompany: this.parseNum(document.getElementById('m-material-company').value),
            materialVessel: Number(document.getElementById('m-material-vessel').value) || 0,
            loanInterest: Number(document.getElementById('m-loan-interest').value) || 0,
            loanInterestExternal: this.parseNum(document.getElementById('m-loan-interest-external').value),
            other: this.parseNum(document.getElementById('m-other').value)
        };
        AppData.saveMonthlyCosts(data);
        if (window.smLogAudit) window.smLogAudit('Cập nhật chi phí tháng',
            `Tàu ${vesselId} · ${month} · Lương ${data.salary} · BH ${data.insurance} · Khác ${data.other}`);
        // Recalculate daily allocations to voyages
        AppData.recalculateAllShipmentAllocations(vesselId, month);
        alert('Đã lưu chi phí tháng ' + data.month + ' cho tàu ' + data.vesselId + ' và tự động phân bổ lại cho các chuyến đi!');
    },

    // Shipment Actions
    openShipmentModal() { 
        document.getElementById('ship-modal-content').innerHTML = Views.shipModal();
        
        // Auto-fill defaults for new shipment
        document.getElementById('s-contract-no').value = AppData.getNextContractNo();
        const firstVessel = document.getElementById('s-vessel-id').value;
        if (firstVessel) {
            document.getElementById('s-voy-no').value = AppData.getNextVoyageNo(firstVessel);
            const loadDate = AppData.getNextLoadDate(firstVessel);
            if (loadDate) document.getElementById('s-start').value = loadDate;
            
            // Sync fuel details if the new voyage number exists in fuel logs
            setTimeout(() => {
                this.syncShipmentFuel();
            }, 0);
        }

        this.openModal('ship-modal'); 
    },
    
    handleShipmentVesselChange() {
        if (!document.getElementById('s-id').value) {
            const vesselId = document.getElementById('s-vessel-id').value;
            document.getElementById('s-voy-no').value = AppData.getNextVoyageNo(vesselId);
            const loadDate = AppData.getNextLoadDate(vesselId);
            if (loadDate) document.getElementById('s-start').value = loadDate;
        }
        this.syncShipmentFuel();
    },
    
    calcShipmentFinance() {
        const qty = Number(document.getElementById('s-qty').value) || 0;
        const rate = Number(document.getElementById('s-rate').value) || 0;
        const markup = Number(document.getElementById('s-markup').value) || 0;
        const fuelP = Number(document.getElementById('s-fuel-p').value) || 0;
        
        const revReal = qty * rate;
        const revInvoice = (rate + markup) * qty;
        const contractNo = document.getElementById('s-contract-no').value;
        const refund = AppData.calcRefund(revInvoice, revReal, contractNo);
        
        document.getElementById('val-rev-real').innerText = AppData.formatCurrency(revReal);
        document.getElementById('val-rev-inv').innerText = AppData.formatCurrency(revInvoice);
        document.getElementById('val-refund').innerText = AppData.formatCurrency(refund);
        
        // Update fuel cost if hours are loaded
        const hours = Number(document.getElementById('s-c-hours').value) || 0;
        const vesselId = document.getElementById('s-vessel-id').value;
        const vessel = AppData.getVessel(vesselId);
        const voyNo = document.getElementById('s-voy-no')?.value;
        
        let fuelCost = 0;
        let fuelVoy = null;
        if (vesselId && voyNo) {
            fuelVoy = AppData.findFuelVoyageByVesselAndNo(vesselId, voyNo);
        }
        
        if (fuelVoy) {
            // Lấy chính xác từ chi tiết các chặng (Fuel Logs) nếu đã có
            const stats = AppData.getFuelVoyageStats(fuelVoy.id);
            let price = Number(stats.fuelPrice) || fuelP;
            fuelCost = Math.round(stats.totalFuel * price);
            document.getElementById('s-c-fuel').value = fuelCost;
        } else if (vessel) {
            // Tạm tính dựa trên định mức chung nếu chưa có chi tiết chặng
            fuelCost = hours * vessel.fuelRate * fuelP;
            document.getElementById('s-c-fuel').value = fuelCost;
        }

        // Calculate VAT: 8% Doanh Thu hoá đơn - 8% (Dầu DO + Dầu LO + Đại lý 2 đầu + Hoa tiêu, phí cảng)
        const fuelLO = Number(document.getElementById('s-c-fuel-lo')?.value) || 0;
        const agent = Number(document.getElementById('s-c-agent')?.value) || 0;
        const portFees = Number(document.getElementById('s-c-port-fees')?.value) || 0;
        const deduc = fuelCost + fuelLO + agent + portFees;
        const vat = (0.08 * revInvoice) - (0.08 * deduc);
        document.getElementById('s-c-vat').value = Math.round(vat);

        this.calcBrokerage();
    },

    getPortRegion(portName) {
        if (!portName) return '';
        const p = portName.toLowerCase();
        if (p.includes('hải phòng') || p.includes('hải dương') || p.includes('quảng ninh')) return 'NORTH';
        if (p.includes('hòn la') || p.includes('nghi sơn') || p.includes('hà tĩnh') || p.includes('vũng áng')) return 'NORTH_CENTRAL';
        if (p.includes('đà nẵng') || p.includes('vinh') || p.includes('thanh hóa') || p.includes('quảng bình') || p.includes('chân mây')) return 'CENTRAL';
        if (p.includes('nha trang') || p.includes('cam ranh') || p.includes('quy nhơn')) return 'SOUTH_CENTRAL';
        if (p.includes('sài gòn') || p.includes('vũng tàu') || p.includes('long an') || p.includes('đồng nai') || p.includes('phú mỹ') || p.includes('hcm')) return 'SOUTH';
        if (p.includes('cần thơ') || p.includes('an giang') || p.includes('vĩnh xương') || p.includes('hậu giang') || p.includes('miền tây')) return 'MEKONG';
        return '';
    },

    calcBrokerage() {
        const pLoad = document.getElementById('s-p-load').value;
        const pDis = document.getElementById('s-p-dis').value;
        const vesselId = document.getElementById('s-vessel-id').value;
        const coefA = Number(document.getElementById('s-coef-a')?.value || 2.0);
        
        const r1 = this.getPortRegion(pLoad);
        const r2 = this.getPortRegion(pDis);
        
        let L = 0;
        const pair = [r1, r2].sort().join('-');
        
        const rates = {
            'CENTRAL-NORTH': 300000,
            'NORTH-SOUTH_CENTRAL': 350000,
            'NORTH-SOUTH': 400000,
            'MEKONG-NORTH': 500000,
            'NORTH_CENTRAL-SOUTH': 350000,
            'MEKONG-NORTH_CENTRAL': 450000,
            // Estimated intermediate routes
            'CENTRAL-MEKONG': 400000,
            'CENTRAL-SOUTH': 300000,
            'SOUTH-MEKONG': 200000
        };
        
        L = rates[pair] || 300000; // Default to 300k if not found
        
        const crewCount = (vesselId === 'VG18') ? 12 : 11;
        const W = 1.5; // Default for full load
        
        const totalBrokerage = L * W * coefA * crewCount;
        
        // Prevent overwriting if exact value exists in Captain's Report
        const sId = document.getElementById('s-id')?.value;
        const voyageNo = document.getElementById('s-voy-no')?.value;
        const start = document.getElementById('s-start')?.value;
        
        if (sId && voyageNo && start && vesselId) {
            const monthStr = start.substring(0, 7);
            const report = AppData.getCaptainReport(vesselId, monthStr);
            if (report && report.brokerages) {
                const exactBrokerage = report.brokerages.find(b => b.voyageNo === voyageNo);
                if (exactBrokerage) {
                    // Skip overwriting, keep the exact value from report
                    return;
                }
            }
        }

        const field = document.getElementById('s-c-brokerage');
        if (field) field.value = Math.round(totalBrokerage);
    },

    calcShipmentAllocations() {
        const start = document.getElementById('s-start').value;
        const end = document.getElementById('s-end').value;
        const vId = document.getElementById('s-vessel-id').value;
        if (!start || !end || !vId) return;

        const allocate = (field) => AppData.calcExactAllocation(start, end, vId, field);

        document.getElementById('s-c-sal').value = allocate('salary');
        document.getElementById('s-c-food').value = allocate('food');
        document.getElementById('s-c-ins').value = allocate('insurance');
        document.getElementById('s-c-m-mat-company').value = allocate('materialCompany');
        document.getElementById('s-c-m-mat-vessel').value = allocate('materialVessel');
        document.getElementById('s-c-m-other').value = allocate('other');
    },

    syncShipmentFuel() {
        const vId = document.getElementById('s-vessel-id').value;
        const voyNo = document.getElementById('s-voy-no').value;
        if (!vId || !voyNo) return;

        const fuelVoy = AppData.findFuelVoyageByVesselAndNo(vId, voyNo);
        if (fuelVoy) {
            const stats = AppData.getFuelVoyageStats(fuelVoy.id);
            document.getElementById('s-c-hours').value = stats.totalHours.toFixed(1);
            
            let price = Number(stats.fuelPrice);
            if (price === 0) {
                price = AppData.getLastFuelPrice(vId, voyNo);
            }
            document.getElementById('s-fuel-p').value = price;
            
            if (fuelVoy.cargoType) {
                document.getElementById('s-cargo').value = fuelVoy.cargoType;
                // Update brokerage since cargo changed
                if (typeof this.calcBrokerage === 'function') {
                    this.calcBrokerage();
                }
            }
            
            this.calcShipmentFinance();
            console.log(`Synced fuel data for voyage ${voyNo} on vessel ${vId} (Price: ${price})`);
        } else {
            const price = AppData.getLastFuelPrice(vId, voyNo);
            document.getElementById('s-fuel-p').value = price;
            this.calcShipmentFinance();
            console.log(`No fuel voyage record for voyage ${voyNo} on vessel ${vId}. Set fallback price to ${price}`);
        }
    },

    saveShipment() {
        const sId = document.getElementById('s-id').value;
        const s = {
            id: sId || ('S' + Date.now()),
            contractNo: document.getElementById('s-contract-no').value,
            voyageNo: document.getElementById('s-voy-no').value,
            vesselId: document.getElementById('s-vessel-id').value,
            customer: document.getElementById('s-customer').value,
            cargo: document.getElementById('s-cargo').value,
            portLoad: document.getElementById('s-p-load').value,
            portDischarge: document.getElementById('s-p-dis').value,
            dateStart: document.getElementById('s-start').value,
            dateEnd: document.getElementById('s-end').value,
            reportMonth: document.getElementById('s-report-month').value || '',
            qty: Number(document.getElementById('s-qty').value) || 0,
            rate: Number(document.getElementById('s-rate').value) || 0,
            markup: Number(document.getElementById('s-markup').value) || 0,
            fuelPrice: Number(document.getElementById('s-fuel-p').value) || 0,
            fuelHours: Number(document.getElementById('s-c-hours').value) || 0,
            revenueReal: Number(document.getElementById('val-rev-real').innerText.replace(/[^0-9]/g,'')),
            revenueInvoice: Number(document.getElementById('val-rev-inv').innerText.replace(/[^0-9]/g,'')),
            refundAmount: Number(document.getElementById('val-refund').innerText.replace(/[^0-9]/g,'')),
            costs: {
                fuelDO: Number(document.getElementById('s-c-fuel').value) || 0,
                fuelLO: Number(document.getElementById('s-c-fuel-lo').value) || 0,
                crewSalary: Number(document.getElementById('s-c-sal').value) || 0,
                crewFood: Number(document.getElementById('s-c-food').value) || 0,
                crewInsurance: Number(document.getElementById('s-c-ins').value) || 0,
                materialCompany: Number(document.getElementById('s-c-m-mat-company').value) || 0,
                materialVessel: Number(document.getElementById('s-c-m-mat-vessel').value) || 0,
                monthlyOther: Number(document.getElementById('s-c-m-other').value) || 0,
                agent: Number(document.getElementById('s-c-agent').value) || 0,
                vessel2ends: Number(document.getElementById('s-c-vessel-2ends').value) || 0,
                brokerage: Number(document.getElementById('s-c-brokerage').value) || 0,
                vat: Number(document.getElementById('s-c-vat').value) || 0,
                portFees: Number(document.getElementById('s-c-port-fees').value) || 0,
                others: Number(document.getElementById('s-c-others').value) || 0
            }
        };
        AppData.addShipment(s);
        if (window.smLogAudit) window.smLogAudit(sId ? 'Sửa chuyến hàng' : 'Thêm chuyến hàng',
            `${s.voyageNo || ''} · Tàu ${s.vesselId || ''} · KH ${s.customer || ''} · ${s.cargo || ''} · ${s.qty || 0} tấn`);
        this.closeModal('ship-modal');
        if (this.currentView === 'debts') {
            this.navigate('debts', this.currentDebtTab || 'customer');
        } else {
            this.navigate('shipments');
        }
    },
    editShipment(id) {
        const s = AppData.state.shipments.find(x => x.id === id);
        if(!s) return;
        document.getElementById('ship-modal-content').innerHTML = Views.shipModal();
        document.getElementById('s-id').value = s.id;
        document.getElementById('s-contract-no').value = s.contractNo || '';
        document.getElementById('s-voy-no').value = s.voyageNo;
        document.getElementById('s-vessel-id').value = s.vesselId;
        document.getElementById('s-customer').value = s.customer || '';
        document.getElementById('s-cargo').value = s.cargo;
        document.getElementById('s-p-load').value = s.portLoad || '';
        document.getElementById('s-p-dis').value = s.portDischarge || '';
        document.getElementById('s-start').value = s.dateStart;
        document.getElementById('s-end').value = s.dateEnd;
        document.getElementById('s-report-month').value = s.reportMonth || '';
        document.getElementById('s-qty').value = s.qty;
        document.getElementById('s-rate').value = s.rate;
        document.getElementById('s-markup').value = s.markup;
        document.getElementById('s-fuel-p').value = s.fuelPrice;
        
        document.getElementById('s-c-hours').value = s.fuelHours || 0;
        document.getElementById('s-c-fuel').value = s.costs.fuelDO || 0;
        document.getElementById('s-c-fuel-lo').value = s.costs.fuelLO || 0;
        document.getElementById('s-c-sal').value = s.costs.crewSalary || 0;
        document.getElementById('s-c-food').value = s.costs.crewFood || 0;
        document.getElementById('s-c-ins').value = s.costs.crewInsurance || 0;
        document.getElementById('s-c-m-mat-company').value = s.costs.materialCompany || 0;
        document.getElementById('s-c-m-mat-vessel').value = s.costs.materialVessel || 0;
        document.getElementById('s-c-m-other').value = s.costs.monthlyOther || 0;
        document.getElementById('s-c-agent').value = s.costs.agent || 0;
        document.getElementById('s-c-vessel-2ends').value = s.costs.vessel2ends || 0;
        document.getElementById('s-c-brokerage').value = s.costs.brokerage || 0;
        document.getElementById('s-c-vat').value = s.costs.vat || 0;
        document.getElementById('s-c-port-fees').value = s.costs.portFees || 0;
        document.getElementById('s-c-others').value = s.costs.others || 0;

        this.calcShipmentFinance();
        this.openModal('ship-modal');
    },
    deleteShipment(id) {
        if (confirm('Bạn có chắc muốn xóa chuyến hàng này?')) {
            const sh = AppData.state.shipments.find(x => x.id === id);
            if (sh && window.smLogAudit) window.smLogAudit('Xóa chuyến hàng', `${sh.voyageNo || ''} · Tàu ${sh.vesselId || ''} · KH ${sh.customer || ''}`);
            AppData.deleteShipment(id);
            if (this.currentView === 'debts') {
                this.navigate('debts', this.currentDebtTab || 'customer');
            } else {
                this.navigate('shipments');
            }
        }
    },
    openShipmentReport(id) {
        const s = AppData.state.shipments.find(x => x.id === id);
        if(!s) return;
        document.getElementById('report-content').innerHTML = Views.report(s);
        this.openModal('report-modal');
    },

    // Company Actions
    saveCompany() {
        const data = {
            name: document.getElementById('c-name').value,
            address: document.getElementById('c-addr').value,
            taxId: document.getElementById('c-tax').value,
            bankInfo: document.getElementById('c-bank').value,
            openingBalances: {
                'ABbank': this.parseNum(document.getElementById('bal-abbank').value),
                'Viettinbank': this.parseNum(document.getElementById('bal-viettin').value),
                'Tài khoản cá nhân': this.parseNum(document.getElementById('bal-ca-nhan').value),
                'Tiền mặt': this.parseNum(document.getElementById('bal-tien-mat').value)
            }
        };
        AppData.updateCompany(data);
        alert('Đã cập nhật thông tin Master Data và Số dư đầu kỳ!');
        this.navigate('company');
    },

    importTransactionsExcel(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const data = new Uint8Array(evt.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                
                if (rows.length < 3) {
                    alert('File không hợp lệ hoặc không có dữ liệu!');
                    return;
                }
                
                const headers = rows[2];
                const dataRows = rows.slice(3);
                
                const colIdx = (name) => headers.indexOf(name);
                
                const idIdx = colIdx('ID Giao Dịch');
                const dateIdx = colIdx('Ngày');
                const vesselIdx = colIdx('Tàu / Bộ Phận');
                const categoryIdx = colIdx('Hạng Mục');
                const voyageNoIdx = colIdx('Chuyến Số');
                const contractNoIdx = colIdx('Số Hợp Đồng');
                const partnerIdx = colIdx('Đối Tác');
                const contentIdx = colIdx('Nội Dung');
                const thuIdx = colIdx('Thu Vào (VNĐ)');
                const chiIdx = colIdx('Chi Ra (VNĐ)');
                const accountIdx = colIdx('Tài Khoản');
                
                if (dateIdx === -1 || categoryIdx === -1 || contentIdx === -1) {
                    alert('File Excel không đúng định dạng báo cáo giao dịch thu chi!');
                    return;
                }

                let count = 0;
                const affectedAllocations = new Set();
                
                dataRows.forEach(row => {
                    if (row.length === 0 || !row[dateIdx]) return;
                    
                    const id = row[idIdx] ? String(row[idIdx]).trim() : ('TR' + Date.now() + Math.random().toString().slice(2, 6));
                    
                    // Parse Excel Date safely
                    let dateVal = row[dateIdx];
                    let dateStr = '';
                    if (dateVal) {
                        if (typeof dateVal === 'number') {
                            const excelEpoch = new Date(Date.UTC(1899, 11, 30));
                            const dateObj = new Date(excelEpoch.getTime() + dateVal * 24 * 60 * 60 * 1000);
                            dateStr = dateObj.toISOString().slice(0, 10);
                        } else {
                            const str = String(dateVal).trim();
                            if (str.match(/^\d{4}-\d{2}-\d{2}$/)) {
                                dateStr = str;
                            } else if (str.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
                                const parts = str.split('/');
                                const d = parts[0].padStart(2, '0');
                                const m = parts[1].padStart(2, '0');
                                const y = parts[2];
                                dateStr = `${y}-${m}-${d}`;
                            } else {
                                const parsed = new Date(str);
                                if (!isNaN(parsed.getTime())) {
                                    dateStr = parsed.toISOString().slice(0, 10);
                                } else {
                                    dateStr = str;
                                }
                            }
                        }
                    }

                    const t = {
                        id,
                        date: dateStr,
                        vessel: String(row[vesselIdx] || 'VP').trim(),
                        category: String(row[categoryIdx] || '').trim(),
                        voyageNo: row[voyageNoIdx] ? String(row[voyageNoIdx]).trim() : '',
                        contractNo: row[contractNoIdx] ? String(row[contractNoIdx]).trim() : '',
                        partner: String(row[partnerIdx] || '').trim(),
                        content: String(row[contentIdx] || '').trim(),
                        thu: Number(row[thuIdx]) || 0,
                        chi: Number(row[chiIdx]) || 0,
                        account: String(row[accountIdx] || 'Tiền mặt').trim()
                    };
                    
                    const existingIdx = AppData.state.transactions.findIndex(x => x.id === id);
                    const oldTx = existingIdx >= 0 ? { ...AppData.state.transactions[existingIdx] } : null;
                    
                    if (existingIdx >= 0) {
                        AppData.state.transactions[existingIdx] = t;
                    } else {
                        AppData.state.transactions.push(t);
                    }
                    
                    if (t.vessel && t.vessel !== 'VP' && t.date && (t.category === '9.Vật Tư' || t.category === '6.Lãi Vay')) {
                        affectedAllocations.add(`${t.vessel}_${t.date.substring(0, 7)}`);
                    }
                    if (oldTx && oldTx.vessel && oldTx.vessel !== 'VP' && oldTx.date && (oldTx.category === '9.Vật Tư' || oldTx.category === '6.Lãi Vay')) {
                        affectedAllocations.add(`${oldTx.vessel}_${oldTx.date.substring(0, 7)}`);
                    }
                    count++;
                });
                
                affectedAllocations.forEach(key => {
                    const [vesselId, monthStr] = key.split('_');
                    AppData.recalculateVesselAllocations(vesselId, monthStr);
                });
                
                AppData.save();
                alert(`Khôi phục thành công ${count} giao dịch!`);
                this.navigate('company');
            } catch (err) {
                console.error(err);
                alert('Lỗi khi đọc file Excel: ' + err.message);
            }
        };
        reader.readAsArrayBuffer(file);
    },

    importShipmentsExcel(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const data = new Uint8Array(evt.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                
                if (rows.length < 3) {
                    alert('File không hợp lệ hoặc không có dữ liệu!');
                    return;
                }
                
                const headers = rows[2];
                const dataRows = rows.slice(3);
                
                const colIdx = (name) => headers.indexOf(name);
                
                const idIdx = colIdx('ID Chuyến Hàng');
                const contractNoIdx = colIdx('Số Hợp Đồng');
                const voyageNoIdx = colIdx('Chuyến Số');
                const vesselIdIdx = colIdx('Mã Tàu');
                const customerIdx = colIdx('Khách Hàng');
                const cargoIdx = colIdx('Tên Hàng');
                const portLoadIdx = colIdx('Cảng Xếp (Đi)');
                const portDischargeIdx = colIdx('Cảng Dỡ (Đến)');
                const dateStartIdx = colIdx('Ngày Xếp Hàng');
                const dateEndIdx = colIdx('Ngày Dỡ Hàng');
                const reportMonthIdx = colIdx('Tháng Hạch Toán');
                const qtyIdx = colIdx('Khối Lượng (Tấn)');
                const rateIdx = colIdx('Đơn Giá Thực (VNĐ)');
                const markupIdx = colIdx('Tiền Gửi (VND/tấn)');
                const fuelPriceIdx = colIdx('Giá Dầu Chuyến (VNĐ)');
                const fuelHoursIdx = colIdx('Số Giờ Chạy (Giờ)');
                const revenueRealIdx = colIdx('Doanh Thu Thực Tế (VNĐ)');
                const revenueInvoiceIdx = colIdx('Doanh Thu Hóa Đơn (VNĐ)');
                const refundIdx = colIdx('Tiền Gửi Lại Khách (VNĐ)');
                
                const costsMap = {
                    fuelDO: colIdx('Tiền Dầu DO (VNĐ)'),
                    fuelLO: colIdx('Tiền Dầu LO (VNĐ)'),
                    crewSalary: colIdx('Lương TV (VNĐ)'),
                    crewFood: colIdx('Tiền Ăn (VNĐ)'),
                    crewInsurance: colIdx('Bảo Hiểm (VNĐ)'),
                    materialCompany: colIdx('Vật Tư Cty Cấp (VNĐ)'),
                    materialVessel: colIdx('Vật Tư Tàu Chi (VNĐ)'),
                    monthlyOther: colIdx('CP Khác Cty Cấp (VNĐ)'),
                    agent: colIdx('Đại Lý 2 Đầu Cảng (VNĐ)'),
                    vessel2ends: colIdx('Tàu Chi 2 Đầu Cảng (VNĐ)'),
                    brokerage: colIdx('Tiền Bông (VNĐ)'),
                    vat: colIdx('Thuế VAT (VNĐ)'),
                    portFees: colIdx('Hoa Tiêu, Tàu Lai, Phí Cảng (VNĐ)'),
                    others: colIdx('Chi Phí Khác Tàu Chi (VNĐ)')
                };

                let count = 0;
                dataRows.forEach(row => {
                    if (row.length === 0 || !row[contractNoIdx]) return;
                    
                    const id = row[idIdx] || ('S' + Date.now() + Math.random().toString().slice(2, 6));
                    const s = {
                        id,
                        contractNo: String(row[contractNoIdx] || '').trim(),
                        voyageNo: String(row[voyageNoIdx] || '').trim(),
                        vesselId: String(row[vesselIdIdx] || '').trim(),
                        customer: String(row[customerIdx] || '').trim(),
                        cargo: String(row[cargoIdx] || '').trim(),
                        portLoad: String(row[portLoadIdx] || '').trim(),
                        portDischarge: String(row[portDischargeIdx] || '').trim(),
                        dateStart: String(row[dateStartIdx] || '').trim(),
                        dateEnd: String(row[dateEndIdx] || '').trim(),
                        reportMonth: String(row[reportMonthIdx] || '').trim(),
                        qty: Number(row[qtyIdx]) || 0,
                        rate: Number(row[rateIdx]) || 0,
                        markup: Number(row[markupIdx]) || 0,
                        fuelPrice: Number(row[fuelPriceIdx]) || 0,
                        fuelHours: Number(row[fuelHoursIdx]) || 0,
                        revenueReal: Number(row[revenueRealIdx]) || 0,
                        revenueInvoice: Number(row[revenueInvoiceIdx]) || 0,
                        refundAmount: Number(row[refundIdx]) || 0,
                        costs: {}
                    };
                    
                    for (let key in costsMap) {
                        const idx = costsMap[key];
                        s.costs[key] = idx !== -1 ? (Number(row[idx]) || 0) : 0;
                    }
                    
                    const existingIdx = AppData.state.shipments.findIndex(x => x.id === id);
                    if (existingIdx >= 0) {
                        AppData.state.shipments[existingIdx] = s;
                    } else {
                        AppData.state.shipments.push(s);
                    }
                    count++;
                });
                
                AppData.save();
                alert(`Khôi phục thành công ${count} chuyến hàng!`);
                this.navigate('company');
            } catch (err) {
                console.error(err);
                alert('Lỗi khi đọc file Excel: ' + err.message);
            }
        };
        reader.readAsArrayBuffer(file);
    },

    importFuelExcel(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const data = new Uint8Array(evt.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                
                let voyagesCount = 0;
                let logsCount = 0;
                
                workbook.SheetNames.forEach(sheetName => {
                    const worksheet = workbook.Sheets[sheetName];
                    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                    
                    if (rows.length < 3) return;
                    
                    const headers = rows[2];
                    const dataRows = rows.slice(3);
                    
                    const colIdx = (name) => headers.indexOf(name);
                    
                    const voyIdIdx = colIdx('ID Chuyến Dầu');
                    const logIdIdx = colIdx('ID Chặng Hành Trình');
                    const vesselIdIdx = colIdx('Mã Tàu');
                    const voyageNoIdx = colIdx('Chuyến Dầu Số');
                    const cargoTypeIdx = colIdx('Mặt Hàng');
                    const initialFuelIdx = colIdx('Số Dư Đầu Kỳ (L)');
                    const addedFuelIdx = colIdx('Số Lượng Cấp (L)');
                    const fuelDateIdx = colIdx('Ngày Cấp');
                    const fuelLocationIdx = colIdx('Nơi Cấp Dầu');
                    const fuelVendorIdx = colIdx('Nhà Cung Cấp Dầu');
                    const fuelUnitPriceIdx = colIdx('Đơn Giá Dầu (VNĐ)');
                    
                    const startPosIdx = colIdx('Nơi Đi');
                    const startTimeIdx = colIdx('Thời Gian Đi');
                    const endPosIdx = colIdx('Nơi Đến');
                    const endTimeIdx = colIdx('Thời Gian Đến');
                    const fuelRateIdx = colIdx('Định Mức Tiêu Thụ (L/h)');
                    const hoursIdx = colIdx('Số Giờ Chạy (Giờ)');
                    
                    let lastVoyageId = '';
                    let lastVesselId = sheetName;
                    
                    dataRows.forEach(row => {
                        if (row.length === 0) return;
                        
                        if (row[voyIdIdx]) {
                            lastVoyageId = String(row[voyIdIdx]).trim();
                            lastVesselId = String(row[vesselIdIdx] || lastVesselId).trim();
                            
                            const voy = {
                                id: lastVoyageId,
                                vesselId: lastVesselId,
                                voyageNo: String(row[voyageNoIdx] || '').trim(),
                                cargoType: String(row[cargoTypeIdx] || '').trim(),
                                initialFuel: Number(row[initialFuelIdx]) || 0,
                                addedFuel: Number(row[addedFuelIdx]) || 0,
                                fuelDate: String(row[fuelDateIdx] || '').trim(),
                                fuelVendor: String(row[fuelVendorIdx] || '').trim(),
                                fuelLocation: String(row[fuelLocationIdx] || '').trim(),
                                fuelUnitPrice: Number(row[fuelUnitPriceIdx]) || 0
                            };
                            
                            const existingIdx = AppData.state.fuelVoyages.findIndex(x => x.id === voy.id);
                            if (existingIdx >= 0) {
                                AppData.state.fuelVoyages[existingIdx] = voy;
                            } else {
                                AppData.state.fuelVoyages.push(voy);
                            }
                            voyagesCount++;
                        }
                        
                        if (row[logIdIdx] && lastVoyageId) {
                            const logId = String(row[logIdIdx]).trim();
                            
                            const parseDt = (str) => {
                                if (!str) return '';
                                const parts = str.split(', ');
                                if (parts.length === 2) {
                                    const [datePart, timePart] = parts;
                                    const [d, m, y] = datePart.split('/');
                                    return `${y}-${m}-${d}T${timePart}`;
                                }
                                const dateObj = new Date(str);
                                return isNaN(dateObj.getTime()) ? str : dateObj.toISOString();
                            };
                            
                            const log = {
                                id: logId,
                                fuelVoyageId: lastVoyageId,
                                startTime: parseDt(row[startTimeIdx]),
                                startPos: String(row[startPosIdx] || '').trim(),
                                endTime: parseDt(row[endTimeIdx]),
                                endPos: String(row[endPosIdx] || '').trim(),
                                fuelRate: Number(row[fuelRateIdx]) || 0,
                                hours: Number(row[hoursIdx]) || 0
                            };
                            
                            const existingIdx = AppData.state.fuelLogs.findIndex(x => x.id === log.id);
                            if (existingIdx >= 0) {
                                AppData.state.fuelLogs[existingIdx] = log;
                            } else {
                                AppData.state.fuelLogs.push(log);
                            }
                            logsCount++;
                        }
                    });
                });
                
                AppData.save();
                alert(`Khôi phục thành công ${voyagesCount} chuyến dầu và ${logsCount} chặng hành trình!`);
                this.navigate('company');
            } catch (err) {
                console.error(err);
                alert('Lỗi khi đọc file Excel: ' + err.message);
            }
        };
        reader.readAsArrayBuffer(file);
    },
    importVesselExpensesExcel(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const data = new Uint8Array(evt.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                
                const parseExcelDate = (val) => {
                    if (!val) return '';
                    if (typeof val === 'number') {
                        const excelEpoch = new Date(Date.UTC(1899, 11, 30));
                        const dateObj = new Date(excelEpoch.getTime() + val * 24 * 60 * 60 * 1000);
                        return dateObj.toISOString().slice(0, 10);
                    }
                    const str = String(val).trim();
                    if (str.match(/^\d{4}-\d{2}-\d{2}$/)) return str;
                    if (str.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
                        const parts = str.split('/');
                        const d = parts[0].padStart(2, '0');
                        const m = parts[1].padStart(2, '0');
                        const y = parts[2];
                        return `${y}-${m}-${d}`;
                    }
                    const parsed = new Date(str);
                    return isNaN(parsed.getTime()) ? str : parsed.toISOString().slice(0, 10);
                };

                const wsCap = workbook.Sheets['Quản lý chi phí tàu'] || workbook.Sheets['Theo dõi tài chính tàu chi'];
                if (!wsCap) {
                    return alert('Không tìm thấy sheet "Quản lý chi phí tàu" hoặc "Theo dõi tài chính tàu chi" trong file Excel!');
                }

                const rows = XLSX.utils.sheet_to_json(wsCap, { header: 1 });
                if (rows.length < 3) return alert('File Excel không đúng định dạng!');

                const headers = rows[2];
                const dataRows = rows.slice(3);
                const colIdx = (name) => headers.indexOf(name);
                
                const hasNewFormat = colIdx('Mã Báo Cáo') !== -1;
                let restoredCount = 0;

                if (hasNewFormat) {
                    const idIdx = colIdx('Mã Báo Cáo');
                    const vesselIdx = colIdx('Mã Tàu');
                    const monthIdx = colIdx('Tháng');
                    const foodIdx = colIdx('Tiền Ăn (VNĐ)');
                    const materialIdx = colIdx('Vật Tư Tàu Chi (VNĐ)');
                    const portNameIdx = colIdx('Tên Khoản Mục Cảng');
                    const portVoyageIdx = colIdx('Chuyến Cảng');
                    const portAmountIdx = colIdx('Số Tiền Cảng (VNĐ)');
                    const brokVoyageIdx = colIdx('Chuyến Tiền Bông');
                    const brokAmountIdx = colIdx('Số Tiền Bông (VNĐ)');
                    
                    let currentReport = null;
                    const reportsMap = {};
                    
                    dataRows.forEach(row => {
                        if (row.length === 0) return;
                        if (row[idIdx]) {
                            const id = String(row[idIdx]).trim();
                            currentReport = {
                                id,
                                vesselId: String(row[vesselIdx] || '').trim(),
                                month: String(row[monthIdx] || '').trim(),
                                food: Number(row[foodIdx]) || 0,
                                material: Number(row[materialIdx]) || 0,
                                portExpenses: [],
                                brokerages: []
                            };
                            reportsMap[id] = currentReport;
                        }
                        
                        if (currentReport) {
                            const portName = row[portNameIdx] ? String(row[portNameIdx]).trim() : '';
                            const portAmount = Number(row[portAmountIdx]) || 0;
                            const portVoyage = row[portVoyageIdx] ? String(row[portVoyageIdx]).trim() : '';
                            if (portName || portAmount > 0) {
                                currentReport.portExpenses.push({
                                    port: portName,
                                    amount: portAmount,
                                    voyageNo: portVoyage
                                });
                            }
                            
                            const brokVoyage = row[brokVoyageIdx] ? String(row[brokVoyageIdx]).trim() : '';
                            const brokAmount = Number(row[brokAmountIdx]) || 0;
                            if (brokVoyage || brokAmount > 0) {
                                currentReport.brokerages.push({
                                    voyageNo: brokVoyage,
                                    amount: brokAmount
                                });
                            }
                        }
                    });
                    
                    if (!AppData.state.captainReports) AppData.state.captainReports = [];
                    Object.values(reportsMap).forEach(report => {
                        const existingIdx = AppData.state.captainReports.findIndex(x => x.id === report.id);
                        if (existingIdx >= 0) {
                            AppData.state.captainReports[existingIdx] = report;
                        } else {
                            AppData.state.captainReports.push(report);
                        }
                        AppData.recalculateVesselAllocations(report.vesselId, report.month);
                        restoredCount++;
                    });
                    AppData.save();
                    alert(`Khôi phục thành công ${restoredCount} Báo cáo Thuyền trưởng!`);
                } else {
                    const idIdx = colIdx('ID Chi Phí');
                    const dateIdx = colIdx('Ngày');
                    const vesselIdx = colIdx('Mã Tàu');
                    const voyageNoIdx = colIdx('Chuyến Số');
                    const categoryIdx = colIdx('Hạng Mục');
                    const amountIdx = colIdx('Số Tiền (VNĐ)');
                    const contentIdx = colIdx('Nội Dung');
                    
                    dataRows.forEach(row => {
                        if (row.length === 0 || !row[dateIdx]) return;
                        const id = row[idIdx] ? String(row[idIdx]).trim() : ('VE-' + Date.now() + Math.random().toString().slice(2, 6));
                        const dateStr = parseExcelDate(row[dateIdx]);
                        const ve = {
                            id,
                            date: dateStr,
                            vesselId: String(row[vesselIdx] || '').trim(),
                            voyageNo: String(row[voyageNoIdx] || '').trim(),
                            category: String(row[categoryIdx] || '').trim(),
                            amount: Number(row[amountIdx]) || 0,
                            content: String(row[contentIdx] || '').trim()
                        };
                        const existingIdx = AppData.state.vesselExpenses.findIndex(x => x.id === id);
                        if (existingIdx >= 0) AppData.state.vesselExpenses[existingIdx] = ve;
                        else AppData.state.vesselExpenses.push(ve);
                        restoredCount++;
                    });
                    AppData.save();
                    alert(`Khôi phục thành công ${restoredCount} Giao dịch Chi phí Tàu (Legacy)!`);
                }
                this.navigate('company');
            } catch (err) {
                console.error(err);
                alert('Lỗi khi đọc file Excel: ' + err.message);
            }
        };
        reader.readAsArrayBuffer(file);
    },
    editVessel(id) {
        const v = AppData.getVessel(id);
        if(!v) return;
        document.getElementById('vessel-modal-content').innerHTML = Views.vesselModal(id);
        this.openModal('vessel-modal');
    },
    dismissOnboarding() {
        try { localStorage.setItem('sm_onboarding_dismissed', '1'); } catch (e) {}
        this.toast('Đã ẩn hướng dẫn. Bạn vẫn thiết lập được trong Master Data.', 'info');
        this.navigate('dashboard');
    },
    openVesselModal() {   // thêm tàu mới
        document.getElementById('vessel-modal-content').innerHTML = Views.vesselModal(null);
        this.openModal('vessel-modal');
        setTimeout(() => { const el = document.getElementById('v-name'); if (el) el.focus(); }, 100);
    },
    deleteVessel(id) {
        const v = AppData.getVessel(id);
        if (!v) return;
        const c = AppData.getVesselRelatedCounts(id);
        const total = c.shipments + c.transactions + c.fuelVoyages + c.fuelLogs + c.vesselExpenses + c.captainReports + c.monthlyCosts;
        let msg = `Xóa tàu "${v.name}"?`;
        if (total > 0) {
            msg += `\n\n⚠️ Tàu này đang có dữ liệu liên quan sẽ BỊ XÓA THEO:\n`
                + `• ${c.shipments} chuyến hàng\n`
                + `• ${c.transactions} giao dịch\n`
                + `• ${c.fuelVoyages} chuyến dầu, ${c.fuelLogs} chặng dầu\n`
                + `• ${c.vesselExpenses} chi phí tàu\n`
                + `• ${c.captainReports} báo cáo thuyền trưởng\n`
                + `• ${c.monthlyCosts} bản ghi chi phí tháng\n\n`
                + `Thao tác này KHÔNG thể hoàn tác. Tiếp tục?`;
        }
        if (!confirm(msg)) return;
        AppData.deleteVesselCascade(id);
        this.toast('Đã xóa tàu ' + v.name + (total > 0 ? ' và toàn bộ dữ liệu liên quan' : ''), 'success');
        this.navigate('company');
    },
    saveVessel() {
        const id = document.getElementById('v-id').value;
        const get = (k) => { const el = document.getElementById(k); return el ? el.value.trim() : ''; };
        const data = {
            capacity: Number(document.getElementById('v-capacity').value) || 0,
            captain: get('v-captain'),
            captainPhone: get('v-captain-phone'),
            manager: get('v-manager'),
            managerPhone: get('v-manager-phone'),
            fuelRate: Number(document.getElementById('v-fuel-rate').value) || 0,
            certRegistry: get('v-cert-reg'),
            certLicense: get('v-cert-license'),
            certInsurance: get('v-cert-insurance'),
            fixedCosts: {
                drydockPeriodic: this.parseNum(document.getElementById('v-fc-drydock')?.value),
                drydockIntermediate: this.parseNum(document.getElementById('v-fc-drydock-mid')?.value),
                depreciation: this.parseNum(document.getElementById('v-fc-depr')?.value),
                annualSurvey: this.parseNum(document.getElementById('v-fc-survey')?.value),
                hullInsurance: this.parseNum(document.getElementById('v-fc-hull')?.value)
            },
            loConfig: {
                cycleHours: Number(document.getElementById('v-lo-cycle')?.value) || 0,
                drumsPerCycle: Number(document.getElementById('v-lo-drums')?.value) || 0,
                supplement: Number(document.getElementById('v-lo-supp')?.value) || 0,
                unitPrice: this.parseNum(document.getElementById('v-lo-price')?.value),
                litersPerDrum: Number(document.getElementById('v-lo-liters')?.value) || 0
            }
        };
        this._clearFieldErrors();
        let vid = id;
        if (id) {
            AppData.updateVessel(id, data);
            this.toast('Đã cập nhật tàu', 'success');
        } else {
            // Thêm tàu mới: bắt buộc tên
            const name = get('v-name');
            if (!name) return this._vErr('Vui lòng nhập Tên tàu.', 'v-name');
            data.name = name;
            vid = AppData.addVessel(data);
            this.toast('Đã thêm tàu ' + name, 'success');
        }
        // Lớn#A: cấu hình chi phí cố định đổi -> phân bổ lại cho mọi chuyến của tàu
        if (vid) AppData.recalcVesselFixedCosts(vid);
        this.closeModal('vessel-modal');
        this.navigate('company');
    },
    // Partner (NCC & Khach hang) Actions
    openPartnerModal(type, id = null) {
        let partner = null;
        if (id) {
            if (type === 'vendor') partner = AppData.state.vendors.find(x => x.id === id);
            else partner = AppData.state.customers.find(x => x.id === id);
        }
        document.getElementById('partner-modal-content').innerHTML = Views.partnerModal(type, partner);
        this.openModal('partner-modal');
        // Auto-focus the name input
        setTimeout(() => { const el = document.getElementById('p-name'); if(el) el.focus(); }, 100);
    },
    savePartner(type) {
        const id = document.getElementById('p-id').value;
        const partner = {
            id: id || null,
            name: document.getElementById('p-name').value.trim(),
            contact: document.getElementById('p-contact').value.trim(),
            address: document.getElementById('p-address').value.trim()
        };
        this._clearFieldErrors();
        if (!partner.name) return this._vErr('Vui lòng nhập tên đối tác.', 'p-name');
        if (type === 'vendor') {
            AppData.addVendor(partner);
            this.closeModal('partner-modal');
            this.toast('Đã lưu nhà cung cấp ' + partner.name, 'success');
            this.navigate('partners', 'vendor');
        } else {
            AppData.addCustomer(partner);
            this.closeModal('partner-modal');
            this.toast('Đã lưu khách hàng ' + partner.name, 'success');
            this.navigate('partners', 'customer');
        }
    },
    deleteVendor(id) {
        if (confirm('Ban co chac muon xoa Nha Cung Cap nay?')) {
            AppData.deleteVendor(id);
            this.navigate('partners', 'vendor');
        }
    },
    editVendor(id) {
        this.openPartnerModal('vendor', id);
    },
    deleteCustomer(id) {
        if (confirm('Ban co chac muon xoa Khach Hang nay?')) {
            AppData.deleteCustomer(id);
            this.navigate('partners', 'customer');
        }
    },
    editCustomer(id) {
        this.openPartnerModal('customer', id);
    },

    // Vessel Expense Controllers - Captain's Monthly Report Form
    loadVesselExpenses() {
        const month = document.getElementById('ve-month').value;
        const vesselId = document.getElementById('ve-vessel').value;
        const stats = AppData.getVesselFundStats(vesselId, month);

        // Update Stats Cards
        document.getElementById('ve-stat-opening').innerText = AppData.formatCurrency(stats.opening);
        document.getElementById('ve-stat-income').innerText = AppData.formatCurrency(stats.income);
        document.getElementById('ve-stat-expense').innerText = AppData.formatCurrency(stats.expense);
        document.getElementById('ve-stat-balance').innerText = AppData.formatCurrency(stats.balance);

        // Fetch existing Captain Report
        const report = AppData.getCaptainReport(vesselId, month) || {
            food: '',
            material: '',
            portExpenses: [],
            brokerages: []
        };

        // Set static fields
        document.getElementById('ve-food').value = report.food !== undefined ? this.fmtMoney(report.food) : '';
        document.getElementById('ve-material').value = report.material !== undefined ? this.fmtMoney(report.material) : '';

        // Generate dynamic rows for Port Expenses
        const portContainer = document.getElementById('ve-ports-container');
        portContainer.innerHTML = '';
        if (report.portExpenses && report.portExpenses.length > 0) {
            report.portExpenses.forEach(p => {
                this.addPortExpenseRow(p.port, p.voyageNo, p.amount);
            });
        }

        // Generate dynamic rows for Brokerages
        const brokerageContainer = document.getElementById('ve-brokerages-container');
        brokerageContainer.innerHTML = '';
        if (report.brokerages && report.brokerages.length > 0) {
            report.brokerages.forEach(b => {
                this.addBrokerageRow(b.voyageNo, b.amount);
            });
        }

        // Update dynamic allocated voyages list
        this.renderAllocatedVoyages(vesselId, month);
    },

    getVoyageOptionsHtml(vesselId, selectedVoyageNo = '') {
        const shipments = AppData.getShipments().filter(s => s.vesselId === vesselId);
        let html = '<option value="">-- Chọn chuyến --</option>';
        html += shipments.map(s => 
            `<option value="${s.voyageNo}" ${s.voyageNo === selectedVoyageNo ? 'selected' : ''}>Chuyến ${s.voyageNo} (${s.cargo})</option>`
        ).join('');
        return html;
    },

    addPortExpenseRow(port = '', voyageNo = '', amount = '') {
        const container = document.getElementById('ve-ports-container');
        const vesselId = document.getElementById('ve-vessel').value;
        const optionsHtml = this.getVoyageOptionsHtml(vesselId, voyageNo);

        const row = document.createElement('div');
        row.className = 'port-expense-row';
        row.style = 'display:flex; gap:0.5rem; margin-bottom:0.5rem; align-items:center;';
        row.innerHTML = `
            <input type="text" class="form-control port-name" placeholder="Biên phòng, hoa tiêu, bồi dưỡng..." value="${port}" style="flex:2; font-size:0.85rem; padding:6px; background: rgba(0,0,0,0.3);">
            <select class="form-control port-voyage" style="flex:1.2; font-size:0.85rem; padding:6px; background: rgba(0,0,0,0.3);">
                ${optionsHtml}
            </select>
            <input type="number" class="form-control port-amount" placeholder="Số tiền" value="${amount}" style="flex:1.5; font-size:0.85rem; padding:6px; text-align:right; background: rgba(0,0,0,0.3);">
            <button type="button" class="icon-btn" onclick="app.removePortExpenseRow(this)" style="color:var(--rose-light);"><i class="fa-solid fa-trash-can"></i></button>
        `;
        container.appendChild(row);
    },

    removePortExpenseRow(btn) {
        btn.closest('.port-expense-row').remove();
    },

    addBrokerageRow(voyageNo = '', amount = '') {
        const container = document.getElementById('ve-brokerages-container');
        const vesselId = document.getElementById('ve-vessel').value;
        const optionsHtml = this.getVoyageOptionsHtml(vesselId, voyageNo);

        const row = document.createElement('div');
        row.className = 'brokerage-row';
        row.style = 'display:flex; gap:0.5rem; margin-bottom:0.5rem; align-items:center;';
        row.innerHTML = `
            <select class="form-control brokerage-voyage" style="flex:2; font-size:0.85rem; padding:6px; background: rgba(0,0,0,0.3);">
                ${optionsHtml}
            </select>
            <input type="number" class="form-control brokerage-amount" placeholder="Số tiền" value="${amount}" style="flex:2; font-size:0.85rem; padding:6px; text-align:right; background: rgba(0,0,0,0.3);">
            <button type="button" class="icon-btn" onclick="app.removeBrokerageRow(this)" style="color:var(--rose-light);"><i class="fa-solid fa-trash-can"></i></button>
        `;
        container.appendChild(row);
    },

    removeBrokerageRow(btn) {
        btn.closest('.brokerage-row').remove();
    },

    resetCaptainReportForm() {
        if (confirm('Bạn có chắc muốn xóa trống biểu mẫu nhập này?')) {
            document.getElementById('ve-food').value = '';
            document.getElementById('ve-material').value = '';
            document.getElementById('ve-ports-container').innerHTML = '';
            document.getElementById('ve-brokerages-container').innerHTML = '';
        }
    },

    saveMonthlyCaptainReport() {
        const vesselId = document.getElementById('ve-vessel').value;
        const month = document.getElementById('ve-month').value;

        // Collect Port Expenses
        const portExpenses = [];
        const portRows = document.querySelectorAll('.port-expense-row');
        for (let row of portRows) {
            const port = row.querySelector('.port-name').value.trim();
            const voyageNo = row.querySelector('.port-voyage').value;
            const amountVal = row.querySelector('.port-amount').value;
            const amount = Number(amountVal) || 0;

            if (port || amount > 0) {
                if (!voyageNo) {
                    alert('Vui lòng chọn chuyến đi tương ứng cho các khoản Chi phí cảng!');
                    return;
                }
                portExpenses.push({ port, amount, voyageNo });
            }
        }

        // Collect Brokerages
        const brokerages = [];
        const brokerageRows = document.querySelectorAll('.brokerage-row');
        for (let row of brokerageRows) {
            const voyageNo = row.querySelector('.brokerage-voyage').value;
            const amountVal = row.querySelector('.brokerage-amount').value;
            const amount = Number(amountVal) || 0;

            if (voyageNo || amount > 0) {
                if (!voyageNo) {
                    alert('Vui lòng chọn chuyến đi cho các khoản Tiền Bông!');
                    return;
                }
                brokerages.push({ voyageNo, amount });
            }
        }

        // Create Report object
        const report = {
            id: `CR-${vesselId}-${month}`,
            vesselId,
            month,
            food: this.parseNum(document.getElementById('ve-food').value),
            material: this.parseNum(document.getElementById('ve-material').value),
            portExpenses,
            brokerages
        };

        // Save and refresh
        AppData.saveCaptainReport(report);
        alert(`Đã cập nhật số liệu Báo cáo Thuyền trưởng tháng ${month.split('-').reverse().join('/')} cho tàu ${vesselId}!`);
        this.loadVesselExpenses();
    },

    renderAllocatedVoyages(vesselId, monthStr) {
        const tbody = document.getElementById('ve-allocated-voyages');
        if (!tbody) return;

        // Get shipments matching this vessel and month
        const shipments = AppData.getShipments().filter(s => {
            const sMonth = s.reportMonth || (s.dateStart && typeof s.dateStart === 'string' ? s.dateStart.substring(0, 7) : '');
            return s.vesselId === vesselId && sMonth === monthStr;
        });

        if (shipments.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--text-muted); padding:2rem;">Không có chuyến hàng nào hoạt động trong tháng này để nhận phân bổ.</td></tr>`;
            return;
        }

        tbody.innerHTML = shipments.map(s => {
            const food = s.costs.crewFood || 0;
            const matVessel = s.costs.materialVessel || 0;
            const port2ends = s.costs.vessel2ends || 0;
            const brokerage = s.costs.brokerage || 0;
            const total = food + matVessel + port2ends + brokerage;

            return `
                <tr class="hover-row">
                    <td><strong style="color: var(--secondary);">Chuyến ${s.voyageNo}</strong><br><small style="color:var(--text-muted);">${s.cargo}</small></td>
                    <td><small>${s.dateStart} → ${s.dateEnd}</small><br><small style="color:var(--info); font-weight:600;">${AppData.calcDays(s.dateStart, s.dateEnd)} ngày chạy</small></td>
                    <td style="text-align: right; font-weight: 500;">${AppData.formatCurrency(food)}</td>
                    <td style="text-align: right; font-weight: 500;">${AppData.formatCurrency(matVessel)}</td>
                    <td style="text-align: right; font-weight: 500; color:var(--info);">${AppData.formatCurrency(port2ends)}</td>
                    <td style="text-align: right; font-weight: 500; color:var(--warning);">${AppData.formatCurrency(brokerage)}</td>
                    <td style="text-align: right; font-weight: 700; color: var(--rose-light);">${AppData.formatCurrency(total)}</td>
                </tr>
            `;
        }).join('');
    },

    updateCustomerOpeningDebt(custName) {
        const input = document.getElementById('cust-opening-debt');
        if (!input) return;
        const amount = Number(input.value) || 0;

        if (!AppData.state.company.customerOpeningDebts) {
            AppData.state.company.customerOpeningDebts = {};
        }
        AppData.state.company.customerOpeningDebts[custName] = amount;
        
        AppData.save();
        
        alert(`Đã cập nhật công nợ đầu kỳ của khách hàng "${custName}" thành công!`);
        this.navigate('debts');
    }
};

document.addEventListener('DOMContentLoaded', () => {
    // Chờ AppData boot (IndexedDB) xong rồi mới render
    (AppData.bootPromise || Promise.resolve()).then(() => app.init());
});
