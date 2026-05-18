/**
 * Main Application Logic V2.0
 */

const app = {
    currentView: 'dashboard',
    
    init() {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const view = e.currentTarget.getAttribute('data-view');
                if (view) this.navigate(view);
            });
        });
        this.navigate(this.currentView);
    },

    navigate(viewName, ...args) {
        if (!Views[viewName]) return;
        this.currentView = viewName;
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
            if (item.getAttribute('data-view') === viewName) item.classList.add('active');
        });
        const container = document.getElementById('view-container');
        container.innerHTML = Views[viewName](...args);

        // Post-render logic
        if (viewName === 'financials') {
            this.renderFinancialChart();
        }
        if (viewName === 'vessel-expenses') {
            this.loadVesselExpenses();
        }
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

    openModal(id) { document.getElementById(id).classList.add('active'); },
    closeModal(id) { document.getElementById(id).classList.remove('active'); },

    openTransactionModal() {
        document.getElementById('trans-modal-content').innerHTML = Views.transModal();
        document.getElementById('t-id').value = '';
        this.openModal('trans-modal');
    },
    saveTransaction() {
        const tId = document.getElementById('t-id').value;
        const t = {
            id: tId || null,
            date: document.getElementById('t-date').value,
            vessel: document.getElementById('t-vessel').value,
            category: document.getElementById('t-cat').value,
            partner: document.getElementById('t-partner').value,
            content: document.getElementById('t-content').value,
            thu: Number(document.getElementById('t-thu').value) || 0,
            chi: Number(document.getElementById('t-chi').value) || 0,
            account: document.getElementById('t-acc').value
        };
        AppData.addTransaction(t);
        this.closeModal('trans-modal');
        this.navigate('financials');
    },
    editTransaction(id) {
        const trans = AppData.state.transactions.find(t => t.id === id);
        if(!trans) return;
        document.getElementById('trans-modal-content').innerHTML = Views.transModal();
        document.getElementById('t-id').value = trans.id;
        document.getElementById('t-date').value = trans.date;
        document.getElementById('t-vessel').value = trans.vessel;
        document.getElementById('t-cat').value = trans.category;
        document.getElementById('t-partner').value = trans.partner;
        document.getElementById('t-content').value = trans.content;
        document.getElementById('t-thu').value = trans.thu;
        document.getElementById('t-chi').value = trans.chi;
        document.getElementById('t-acc').value = trans.account;
        this.openModal('trans-modal');
    },
    deleteTransaction(id) {
        if (confirm('Bạn có chắc muốn xóa giao dịch này?')) {
            AppData.deleteTransaction(id);
            this.navigate('financials');
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
        const voyage = {
            id: id || null,
            vesselId: vesselId,
            voyageNo: document.getElementById('fv-no').value,
            cargoType: document.getElementById('fv-cargo').value,
            addedFuel: Number(document.getElementById('fv-added').value) || 0,
            fuelUnitPrice: Number(document.getElementById('fv-price').value) || 0,
            fuelDate: document.getElementById('fv-date').value,
            fuelVendor: document.getElementById('fv-vendor').value,
            fuelLocation: document.getElementById('fv-location').value
        };
        const existing = AppData.getFuelVoyage(id);
        if(existing) {
            voyage.initialFuel = existing.initialFuel;
        }
        AppData.addFuelVoyage(voyage);
        this.closeModal('fuel-voyage-modal');
        this.navigate('fuel', vesselId);
    },
    updateInitialFuel(voyageId, value) {
        const voy = AppData.getFuelVoyage(voyageId);
        if (voy) {
            voy.initialFuel = Number(value) || 0;
            AppData.save();
            this.navigate('fuel', voy.vesselId);
        }
    },
    deleteFuelVoyage(id) {
        const v = AppData.getFuelVoyage(id);
        if (confirm(`Bạn có chắc muốn xóa chuyến ${v.voyageNo} và toàn bộ các chặng thuộc chuyến này?`)) {
            const vesselId = v.vesselId;
            AppData.deleteFuelVoyage(id);
            this.navigate('fuel', vesselId);
        }
    },

    openFuelLogModal(voyageId, logId) {
        document.getElementById('fuel-modal-content').innerHTML = Views.fuelModal(voyageId);
        document.getElementById('f-id').value = logId || '';
        if (logId) {
            const log = AppData.state.fuelLogs.find(l => l.id === logId);
            if (log) {
                document.getElementById('f-start-time').value = log.startTime;
                document.getElementById('f-start-pos').value = log.startPos;
                document.getElementById('f-end-time').value = log.endTime;
                document.getElementById('f-end-pos').value = log.endPos;
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
        AppData.addFuelLog(log);
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
            AppData.deleteFuelLog(id);
            this.navigate('fuel', voy.vesselId);
        }
    },

    // Monthly Cost Actions
    loadMonthlyCosts() {
        const month = document.getElementById('m-month').value;
        const vesselId = document.getElementById('m-vessel').value;
        const costs = AppData.getMonthlyCosts(month, vesselId);
        document.getElementById('m-salary').value = costs.salary || 0;
        document.getElementById('m-ins').value = costs.insurance || 0;
        document.getElementById('m-food').value = costs.food || 0;
        document.getElementById('m-material-company').value = costs.materialCompany || 0;
        document.getElementById('m-material-vessel').value = costs.materialVessel || 0;
        document.getElementById('m-other').value = costs.other || 0;
    },
    saveMonthlyCosts() {
        const month = document.getElementById('m-month').value;
        const vesselId = document.getElementById('m-vessel').value;
        const data = {
            month,
            vesselId,
            salary: Number(document.getElementById('m-salary').value) || 0,
            insurance: Number(document.getElementById('m-ins').value) || 0,
            food: Number(document.getElementById('m-food').value) || 0,
            materialCompany: Number(document.getElementById('m-material-company').value) || 0,
            materialVessel: Number(document.getElementById('m-material-vessel').value) || 0,
            other: Number(document.getElementById('m-other').value) || 0
        };
        AppData.saveMonthlyCosts(data);
        // Recalculate daily allocations to voyages
        AppData.recalculateAllShipmentAllocations(vesselId, month);
        alert('Đã lưu chi phí tháng ' + data.month + ' cho tàu ' + data.vesselId + ' và tự động phân bổ lại cho các chuyến đi!');
    },

    // Shipment Actions
    openShipmentModal() { 
        document.getElementById('ship-modal-content').innerHTML = Views.shipModal();
        this.openModal('ship-modal'); 
    },
    
    calcShipmentFinance() {
        const qty = Number(document.getElementById('s-qty').value) || 0;
        const rate = Number(document.getElementById('s-rate').value) || 0;
        const markup = Number(document.getElementById('s-markup').value) || 0;
        const fuelP = Number(document.getElementById('s-fuel-p').value) || 0;
        
        const revReal = qty * rate;
        const revInvoice = (rate + markup) * qty;
        const refund = AppData.calcRefund(revInvoice, revReal);
        
        document.getElementById('val-rev-real').innerText = AppData.formatCurrency(revReal);
        document.getElementById('val-rev-inv').innerText = AppData.formatCurrency(revInvoice);
        document.getElementById('val-refund').innerText = AppData.formatCurrency(refund);
        
        // Update fuel cost if hours are loaded
        const hours = Number(document.getElementById('s-c-hours').value) || 0;
        const vesselId = document.getElementById('s-vessel-id').value;
        const vessel = AppData.getVessel(vesselId);
        
        let fuelCost = 0;
        if (vessel) {
            fuelCost = hours * vessel.fuelRate * fuelP;
            document.getElementById('s-c-fuel').value = fuelCost;
        }

        // Calculate VAT: 8% Doanh Thu hoá đơn - 10% hoá đơn dầu
        const vat = (0.08 * revInvoice) - (0.10 * fuelCost);
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
        const field = document.getElementById('s-c-brokerage');
        if (field) field.value = Math.round(totalBrokerage);
    },

    calcShipmentAllocations() {
        const start = document.getElementById('s-start').value;
        const end = document.getElementById('s-end').value;
        const vId = document.getElementById('s-vessel-id').value;
        if (!start || !end || !vId) return;

        const voyageDays = AppData.calcDays(start, end);
        const monthStr = start.substring(0, 7);
        const monthly = AppData.getMonthlyCosts(monthStr, vId);
        const daysInMonth = new Date(new Date(start).getFullYear(), new Date(start).getMonth() + 1, 0).getDate();

        const allocate = (total) => Math.round((Number(total) || 0) / daysInMonth * voyageDays);

        document.getElementById('s-c-sal').value = allocate(monthly.salary);
        document.getElementById('s-c-food').value = allocate(monthly.food);
        document.getElementById('s-c-ins').value = allocate(monthly.insurance);
        document.getElementById('s-c-m-mat-company').value = allocate(monthly.materialCompany);
        document.getElementById('s-c-m-mat-vessel').value = allocate(monthly.materialVessel);
        document.getElementById('s-c-m-other').value = allocate(monthly.other);
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
                price = AppData.getLastFuelPrice(vId);
            }
            document.getElementById('s-fuel-p').value = price;
            
            this.calcShipmentFinance();
            console.log(`Synced fuel data for voyage ${voyNo} on vessel ${vId} (Price: ${price})`);
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
        this.closeModal('ship-modal');
        this.navigate('shipments');
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
            AppData.deleteShipment(id);
            this.navigate('shipments');
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
                'ABbank': Number(document.getElementById('bal-abbank').value) || 0,
                'Viettinbank': Number(document.getElementById('bal-viettin').value) || 0,
                'Tài khoản cá nhân': Number(document.getElementById('bal-ca-nhan').value) || 0,
                'Tiền mặt': Number(document.getElementById('bal-tien-mat').value) || 0
            }
        };
        AppData.updateCompany(data);
        alert('Đã cập nhật thông tin Master Data và Số dư đầu kỳ!');
        this.navigate('company');
    },
    editVessel(id) {
        const v = AppData.getVessel(id);
        if(!v) return;
        document.getElementById('vessel-modal-content').innerHTML = Views.vesselModal(id);
        this.openModal('vessel-modal');
    },
    saveVessel() {
        const id = document.getElementById('v-id').value;
        const data = {
            capacity: Number(document.getElementById('v-capacity').value) || 0,
            captain: document.getElementById('v-captain').value.trim(),
            captainPhone: document.getElementById('v-captain-phone').value.trim(),
            manager: document.getElementById('v-manager').value.trim(),
            managerPhone: document.getElementById('v-manager-phone').value.trim(),
            fuelRate: Number(document.getElementById('v-fuel-rate').value) || 0
        };
        AppData.updateVessel(id, data);
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
        if (!partner.name) { alert('Vui long nhap ten doi tac!'); return; }
        if (type === 'vendor') {
            AppData.addVendor(partner);
            this.closeModal('partner-modal');
            this.navigate('partners', 'vendor');
        } else {
            AppData.addCustomer(partner);
            this.closeModal('partner-modal');
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
        document.getElementById('ve-food').value = report.food !== undefined ? report.food : '';
        document.getElementById('ve-material').value = report.material !== undefined ? report.material : '';

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
            food: Number(document.getElementById('ve-food').value) || 0,
            material: Number(document.getElementById('ve-material').value) || 0,
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
        const shipments = AppData.getShipments().filter(s => 
            s.vesselId === vesselId && s.dateStart && typeof s.dateStart === 'string' && s.dateStart.substring(0, 7) === monthStr
        );

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
    }
};

document.addEventListener('DOMContentLoaded', () => app.init());
