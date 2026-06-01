/**
 * View Templates V2.0
 */

const Views = {
    dashboard: (filterMonth = '') => {
        const company = AppData.getCompany();
        const allShips = AppData.getShipments();
        
        // Thu thập danh sách các tháng có dữ liệu chuyến hàng
        const monthsSet = new Set();
        allShips.forEach(s => {
            const m = s.reportMonth || (s.dateStart ? s.dateStart.substring(0, 7) : '');
            if (m) monthsSet.add(m);
        });
        const availableMonths = Array.from(monthsSet).sort((a, b) => b.localeCompare(a));

        let filteredShips = allShips;
        if (filterMonth) {
            filteredShips = allShips.filter(s => {
                const m = s.reportMonth || (s.dateStart ? s.dateStart.substring(0, 7) : '');
                return m === filterMonth;
            });
        }
        
        let totalRevenue = 0;
        let totalCost = 0;

        filteredShips.forEach(s => {
            totalRevenue += Number(s.revenueReal || 0);
            const vat = Calc.vat(s.revenueInvoice, s.revenueReal, s.costs?.fuelDO);
            const baseCosts = { ...s.costs };
            delete baseCosts.vat; // Tránh cộng dồn
            const costSum = Object.values(baseCosts).reduce((sum, v) => sum + (Number(v) || 0), 0) + (vat > 0 ? vat : 0);
            totalCost += costSum;
        });

        const totalProfit = totalRevenue - totalCost;
        const profitMargin = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : 0;

        return `
            <div class="view-section">
                <!-- Page Header & Filter -->
                <div class="page-header" style="flex-wrap: wrap; gap: 1rem; align-items: center; margin-bottom: 1.5rem;">
                    <div>
                        <h1 class="page-title">Bảng điều khiển</h1>
                        <p class="page-subtitle">${company.name}</p>
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.75rem; background: rgba(255,255,255,0.03); padding: 8px 16px; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
                        <label style="font-weight: 600; color: var(--text-main); font-size: 0.9rem; margin: 0; display: flex; align-items: center; gap: 6px;">
                            <i class="fa-solid fa-filter" style="color:var(--primary-light);"></i> Lọc tháng hạch toán:
                        </label>
                        <select class="form-control" style="width: 180px; height: 32px; padding: 4px 8px; font-size: 0.85rem;" onchange="app.navigate('dashboard', this.value)">
                            <option value="">-- Tất cả các tháng --</option>
                            ${availableMonths.map(m => `<option value="${m}" ${m === filterMonth ? 'selected' : ''}>Tháng ${m.split('-')[1]}/${m.split('-')[0]}</option>`).join('')}
                        </select>
                    </div>
                </div>

                <!-- KPI Section -->
                <div class="kpi-grid" style="margin-bottom: 2rem;">
                    <div class="kpi-card kpi-primary">
                        <div class="kpi-details">
                            <span class="kpi-title">Doanh thu Thực tế</span>
                            <span class="kpi-value" style="color: var(--info);">${AppData.formatCurrency(totalRevenue)}</span>
                        </div>
                        <div class="kpi-icon-wrapper">
                            <i class="fa-solid fa-money-bill-trend-up"></i>
                        </div>
                    </div>
                    <div class="kpi-card kpi-danger">
                        <div class="kpi-details">
                            <span class="kpi-title">Tổng Chi phí Chuyến</span>
                            <span class="kpi-value" style="color: var(--accent);">${AppData.formatCurrency(totalCost)}</span>
                        </div>
                        <div class="kpi-icon-wrapper">
                            <i class="fa-solid fa-file-invoice-dollar"></i>
                        </div>
                    </div>
                    <div class="kpi-card kpi-success">
                        <div class="kpi-details">
                            <span class="kpi-title">Lợi nhuận Ròng</span>
                            <span class="kpi-value" style="color: var(--secondary);">${AppData.formatCurrency(totalProfit)}</span>
                        </div>
                        <div class="kpi-icon-wrapper">
                            <i class="fa-solid fa-scale-balanced"></i>
                        </div>
                    </div>
                    <div class="kpi-card kpi-info">
                        <div class="kpi-details">
                            <span class="kpi-title">Hiệu suất Lợi nhuận</span>
                            <span class="kpi-value" style="color: var(--warning);">${profitMargin}%</span>
                        </div>
                        <div class="kpi-icon-wrapper">
                            <i class="fa-solid fa-percent"></i>
                        </div>
                    </div>
                </div>

                <!-- Charts Layout -->
                <div class="charts-grid" style="margin-bottom: 2rem;">
                    <div class="chart-card-wrapper">
                        <div class="chart-card-header">
                            <span class="chart-card-title"><i class="fa-solid fa-ship" style="color: var(--info);"></i> Hiệu quả kinh doanh theo Tàu</span>
                        </div>
                        <div class="chart-card-body">
                            <canvas id="repVesselChart"></canvas>
                        </div>
                    </div>

                    <div class="chart-card-wrapper">
                        <div class="chart-card-header">
                            <span class="chart-card-title"><i class="fa-solid fa-chart-line" style="color: var(--primary-light);"></i> ${filterMonth ? 'Phân tích Doanh thu & Lợi nhuận từng Chuyến' : 'Xu hướng Doanh thu & Lợi nhuận'}</span>
                        </div>
                        <div class="chart-card-body">
                            <canvas id="repTrendChart"></canvas>
                        </div>
                    </div>

                    <div class="chart-card-wrapper">
                        <div class="chart-card-header">
                            <span class="chart-card-title"><i class="fa-solid fa-chart-pie" style="color: var(--secondary);"></i> Phân tích Cơ cấu Chi phí</span>
                        </div>
                        <div class="chart-card-body">
                            <canvas id="repCostChart"></canvas>
                        </div>
                    </div>

                    <div class="chart-card-wrapper">
                        <div class="chart-card-header">
                            <span class="chart-card-title"><i class="fa-solid fa-gas-pump" style="color: var(--warning);"></i> Tiêu hao Nhiên liệu DO theo Tàu (VNĐ)</span>
                        </div>
                        <div class="chart-card-body">
                            <canvas id="repFuelChart"></canvas>
                        </div>
                    </div>
                </div>

                <!-- Auto Analysis Section -->
                <div class="glass-card" style="margin-bottom: 2rem; border-left: 4px solid var(--primary-light);">
                    <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.25rem;">
                        <i class="fa-solid fa-brain" style="color: var(--primary-light); font-size: 1.5rem;"></i>
                        <h3 style="margin: 0; font-size: 1.25rem;">Báo cáo Phân tích & Nhận xét Kinh doanh</h3>
                    </div>
                    <div id="reports-analysis-content" style="line-height: 1.7; font-size: 0.95rem;">
                        <p style="color: var(--text-muted);"><i class="fa-solid fa-spinner fa-spin" style="margin-right: 6px;"></i>Đang phân tích số liệu...</p>
                    </div>
                </div>

                <!-- Bottom Fleet & Transactions Grid -->
                <div class="grid-2">
                    <div class="glass-card">
                        <h3 style="display: flex; align-items: center; gap: 8px; font-size: 1.15rem; margin-bottom: 1rem;">
                            <i class="fa-solid fa-ship" style="color: var(--primary-light);"></i> Đội tàu & Thuyền trưởng
                        </h3>
                        <div class="table-container">
                            <table class="table">
                                <thead><tr><th>Tàu</th><th>Thuyền trưởng</th><th>Trạng thái</th></tr></thead>
                                <tbody>
                                    ${AppData.state.vessels.map(v => `
                                        <tr>
                                            <td><strong>${esc(v.name)}</strong></td>
                                            <td>${esc(v.captain)}</td>
                                            <td><span class="badge badge-success">Đang hành trình</span></td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div class="glass-card">
                        <h3 style="display: flex; align-items: center; gap: 8px; font-size: 1.15rem; margin-bottom: 1rem;">
                            <i class="fa-solid fa-clock-rotate-left" style="color: var(--secondary);"></i> Giao dịch gần đây
                        </h3>
                        <div class="table-container">
                            <table class="table">
                                <thead><tr><th>Ngày</th><th>Nội dung</th><th>Số tiền</th></tr></thead>
                                <tbody>
                                    ${AppData.getTransactions().slice(0,5).map(t => `
                                        <tr>
                                            <td>${t.date ? t.date.split('-').reverse().join('/') : ''}</td>
                                            <td>${esc(t.content)}</td>
                                            <td class="${t.thu > 0 ? 'value-positive' : 'value-negative'}">
                                                ${AppData.formatCurrency(t.thu > 0 ? t.thu : -t.chi)}
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    financials: (selectedMonth = '', selectedVessel = '', selectedCategory = '', selectedPartner = '') => {
        const trans = AppData.getTransactions();
        return `
            <div class="view-section">
                <div class="page-header">
                    <div>
                        <h1 class="page-title">Theo dõi Tài chính</h1>
                        <p class="page-subtitle">Quản lý thu chi hàng ngày theo tài khoản</p>
                    </div>
                    <button class="btn btn-primary" onclick="app.openTransactionModal()">
                        <i class="fa-solid fa-plus"></i> Thêm Thu/Chi
                    </button>
                </div>

                <div class="grid-4" style="margin-bottom: 2rem;">
                    ${['ABbank', 'Viettinbank', 'Tài khoản cá nhân', 'Tiền mặt'].map(acc => {
                        const opening = (AppData.state.company.openingBalances && AppData.state.company.openingBalances[acc]) || 0;
                        const balance = opening + trans.filter(t => t.account === acc).reduce((sum, t) => sum + (Number(t.thu) || 0) - (Number(t.chi) || 0), 0);
                        let iconClass = 'fa-building-columns';
                        let colorClass = 'icon-blue';
                        if(acc === 'Tiền mặt') { iconClass = 'fa-money-bill-1'; colorClass = 'icon-green'; }
                        if(acc === 'Tài khoản cá nhân') { iconClass = 'fa-user-shield'; colorClass = 'icon-purple'; }
                        
                        return `
                            <div class="glass-card stat-card">
                                <div class="stat-header">
                                    <div class="stat-icon ${colorClass}"><i class="fa-solid ${iconClass}"></i></div>
                                    <span class="badge badge-outline">${acc}</span>
                                </div>
                                <div class="stat-value" style="font-size: 1.4rem;">${AppData.formatCurrency(balance)}</div>
                                <div class="stat-label">Số dư hiện tại</div>
                            </div>
                        `;
                    }).join('')}
                </div>

                <div class="glass-card" style="margin-bottom: 2rem; background: var(--gradient-primary); color: white;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <h3 style="color: white; opacity: 0.9;">TỔNG SỐ DƯ TẤT CẢ TÀI KHOẢN</h3>
                            <div style="font-size: 2.5rem; font-weight: 800;">
                                ${(() => {
                                    const totalOpening = Object.values(AppData.state.company.openingBalances || {}).reduce((s, v) => s + (Number(v) || 0), 0);
                                    const totalTrans = trans.reduce((sum, t) => sum + (Number(t.thu) || 0) - (Number(t.chi) || 0), 0);
                                    return AppData.formatCurrency(totalOpening + totalTrans);
                                })()}
                            </div>
                        </div>
                        <i class="fa-solid fa-vault" style="font-size: 4rem; opacity: 0.2;"></i>
                    </div>
                </div>

                <!-- Financial Analysis Section -->
                <div class="grid-1" style="margin-bottom: 2rem;">
                    <div class="glass-card" style="padding: 2rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                            <div>
                                <h3 style="font-size: 1.5rem; margin-bottom: 0.5rem;"><i class="fa-solid fa-chart-column" style="color: var(--primary-light); margin-right: 0.5rem;"></i>Biểu đồ Cân đối Tài chính</h3>
                                <p>Phân tích thu chi và lợi nhuận thực tế theo từng tháng</p>
                            </div>
                            <div class="grid-3" style="gap: 2rem; text-align: right;">
                                <div>
                                    <small class="stat-label">Tổng Thu (Tháng này)</small>
                                    <div id="monthly-thu-val" style="font-weight: 700; color: var(--secondary); font-size: 1.1rem;">0 đ</div>
                                </div>
                                <div>
                                    <small class="stat-label">Tổng Chi (Tháng này)</small>
                                    <div id="monthly-chi-val" style="font-weight: 700; color: var(--rose-light); font-size: 1.1rem;">0 đ</div>
                                </div>
                                <div>
                                    <small class="stat-label">Cân đối</small>
                                    <div id="monthly-balance-val" style="font-weight: 700; color: var(--info); font-size: 1.1rem;">0 đ</div>
                                </div>
                            </div>
                        </div>
                        <div style="height: 350px; position: relative;">
                            <canvas id="financialChart"></canvas>
                        </div>
                    </div>
                </div>

                <!-- Monthly Detailed Table -->
                <div class="glass-card" style="margin-bottom: 2rem;">
                    <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1.5rem;">
                        <i class="fa-solid fa-list-check" style="color: var(--secondary); font-size: 1.2rem;"></i>
                        <h3 style="margin: 0;">Bảng Tổng hợp Cân đối theo Tháng</h3>
                    </div>
                    <div class="table-container">
                        <table class="table" style="background: rgba(255,255,255,0.02);">
                            <thead>
                                <tr>
                                    <th>Tháng</th>
                                    <th style="text-align: right;">Tổng Thu</th>
                                    <th style="text-align: right;">Tổng Chi</th>
                                    <th style="text-align: right;">Lợi nhuận thực</th>
                                    <th style="text-align: right;">Tỷ lệ Chi/Thu</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${(() => {
                                    const monthly = {};
                                    trans.filter(t => t.category !== 'Luân chuyển').forEach(t => {
                                        const m = (t.date && typeof t.date === 'string') ? t.date.substring(0, 7) : '';
                                        if (!m) return;
                                        if (!monthly[m]) monthly[m] = { thu: 0, chi: 0 };
                                        monthly[m].thu += (Number(t.thu) || 0);
                                        monthly[m].chi += (Number(t.chi) || 0);
                                    });
                                    return Object.keys(monthly).sort((a,b) => b.localeCompare(a)).map(m => {
                                        const stats = monthly[m];
                                        const balance = stats.thu - stats.chi;
                                        const ratio = stats.thu > 0 ? (stats.chi / stats.thu * 100).toFixed(1) : 0;
                                        return `
                                            <tr>
                                                <td><strong>Tháng ${m.split('-').reverse().join('/')}</strong></td>
                                                <td style="text-align: right; color: var(--secondary); font-weight: 600;">${AppData.formatCurrency(stats.thu)}</td>
                                                <td style="text-align: right; color: var(--rose-light); font-weight: 600;">${AppData.formatCurrency(stats.chi)}</td>
                                                <td style="text-align: right; font-weight: 700; color: ${balance >= 0 ? 'var(--secondary)' : 'var(--rose-light)'};">
                                                    ${AppData.formatCurrency(balance)}
                                                </td>
                                                <td style="text-align: right;">
                                                    <div style="display: flex; align-items: center; justify-content: flex-end; gap: 8px;">
                                                        <span style="font-size: 0.8rem; color: var(--text-muted);">${ratio}%</span>
                                                        <div style="width: 60px; height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden;">
                                                            <div style="width: ${Math.min(ratio, 100)}%; height: 100%; background: ${ratio > 80 ? 'var(--accent)' : 'var(--primary-light)'};"></div>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        `;
                                    }).join('');
                                })()}
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Entity Breakdown Section -->
                <div class="glass-card" style="margin-bottom: 2rem;">
                    <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1.5rem;">
                        <i class="fa-solid fa-ship" style="color: var(--primary-light); font-size: 1.2rem;"></i>
                        <h3 style="margin: 0;">Phân bổ Thu - Chi chi tiết (Tàu & Văn phòng)</h3>
                    </div>
                    <div class="table-container" style="overflow-x: auto;">
                        <table class="table" style="font-size: 0.85rem; min-width: 1000px;">
                            <thead>
                                <tr>
                                    <th style="position: sticky; left: 0; background: #1e212b; z-index: 10;">Tháng</th>
                                    ${['VP', ...AppData.state.vessels.map(v => v.id)].map(entity => `
                                        <th style="text-align: center; border-left: 1px solid var(--border-color);">${entity}</th>
                                    `).join('')}
                                </tr>
                            </thead>
                            <tbody>
                                ${(() => {
                                    const entities = ['VP', ...AppData.state.vessels.map(v => v.id)];
                                    const breakdown = {};
                                    trans.forEach(t => {
                                        const m = (t.date && typeof t.date === 'string') ? t.date.substring(0, 7) : '';
                                        if (!m) return;
                                        
                                        // Normalize entity name
                                        let ent = t.vessel;
                                        if (ent === 'Công ty' || ent === 'Văn phòng Công ty' || ent === 'Văn phòng') ent = 'VP';
                                        else if (ent && ent.startsWith('Vũ Gia ')) ent = 'VG' + ent.split(' ')[2];
                                        else if (ent) {
                                            const v = AppData.state.vessels.find(v => v.id === ent || v.name === ent);
                                            if (v) ent = v.id;
                                        }
                                        
                                        if (!breakdown[m]) {
                                            breakdown[m] = {};
                                            entities.forEach(e => breakdown[m][e] = { thu: 0, chi: 0 });
                                        }
                                        if (breakdown[m][ent]) {
                                            breakdown[m][ent].thu += (Number(t.thu) || 0);
                                            breakdown[m][ent].chi += (Number(t.chi) || 0);
                                        }
                                    });

                                    return Object.keys(breakdown).sort((a,b) => b.localeCompare(a)).map(m => `
                                        <tr>
                                            <td style="position: sticky; left: 0; background: #1e212b; z-index: 5;"><strong>${m.split('-').reverse().join('/')}</strong></td>
                                            ${entities.map(ent => {
                                                const stats = breakdown[m][ent];
                                                const balance = stats.thu - stats.chi;
                                                return `
                                                    <td style="border-left: 1px solid var(--border-color); padding: 0.5rem;">
                                                        <div style="display: flex; flex-direction: column; gap: 2px; text-align: right;">
                                                            <div style="color: var(--secondary); font-size: 0.75rem;">+${(stats.thu / 1e6).toFixed(1)}M</div>
                                                            <div style="color: var(--rose-light); font-size: 0.75rem;">-${(stats.chi / 1e6).toFixed(1)}M</div>
                                                            <div style="font-weight: 700; color: ${balance >= 0 ? 'var(--text-main)' : 'var(--accent)'}; border-top: 1px solid rgba(255,255,255,0.05); margin-top: 2px;">
                                                                ${(balance / 1e6).toFixed(1)}M
                                                            </div>
                                                        </div>
                                                    </td>
                                                `;
                                            }).join('')}
                                        </tr>
                                    `).join('');
                                })()}
                            </tbody>
                        </table>
                    </div>
                    <p style="margin-top: 1rem; font-size: 0.8rem; opacity: 0.6; text-align: right;">* Đơn vị tính: Triệu đồng (M)</p>
                </div>
                <div class="glass-card" style="margin-bottom: 2rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.2rem; flex-wrap: wrap; gap: 10px;">
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <i class="fa-solid fa-list" style="color: var(--primary-light); font-size: 1.2rem;"></i>
                            <h3 style="margin: 0;">Danh sách Giao dịch</h3>
                        </div>
                    </div>
                    
                    <!-- Sleek Filter Bar -->
                    <div style="display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 1.5rem; padding: 1.2rem; background: rgba(0,0,0,0.25); border-radius: var(--radius-md); border: 1px solid var(--border-color); align-items: flex-end;">
                        <div class="form-group" style="margin: 0; flex: 1; min-width: 150px;">
                            <label class="form-label" style="font-size: 0.75rem; margin-bottom: 4px; color: var(--text-muted); font-weight: 500;">Tháng hạch toán</label>
                            <select id="filter-fin-month" class="form-control" style="font-size: 0.85rem; padding: 6px 12px;" onchange="app.updateFinancialsFilters()">
                                <option value="">-- Tất cả các tháng --</option>
                                ${(() => {
                                    const months = [...new Set(trans.filter(t => t.date).map(t => t.date.substring(0, 7)))].sort().reverse();
                                    return months.map(m => `<option value="${m}" ${m === selectedMonth ? 'selected' : ''}>Tháng ${m.split('-').reverse().join('/')}</option>`).join('');
                                })()}
                            </select>
                        </div>
                        <div class="form-group" style="margin: 0; flex: 1; min-width: 150px;">
                            <label class="form-label" style="font-size: 0.75rem; margin-bottom: 4px; color: var(--text-muted); font-weight: 500;">Tàu / Bộ phận</label>
                            <select id="filter-fin-vessel" class="form-control" style="font-size: 0.85rem; padding: 6px 12px;" onchange="app.updateFinancialsFilters()">
                                <option value="">-- Tất cả tàu --</option>
                                <option value="VP" ${selectedVessel === 'VP' ? 'selected' : ''}>VP (Văn phòng)</option>
                                ${AppData.state.vessels.map(v => `<option value="${v.id}" ${v.id === selectedVessel ? 'selected' : ''}>Tàu ${v.name}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group" style="margin: 0; flex: 1; min-width: 150px;">
                            <label class="form-label" style="font-size: 0.75rem; margin-bottom: 4px; color: var(--text-muted); font-weight: 500;">Hạng mục</label>
                            <select id="filter-fin-category" class="form-control" style="font-size: 0.85rem; padding: 6px 12px;" onchange="app.updateFinancialsFilters()">
                                <option value="">-- Tất cả hạng mục --</option>
                                ${(() => {
                                    const categories = [...new Set(trans.map(t => t.category).filter(Boolean))].sort();
                                    return categories.map(c => `<option value="${c}" ${c === selectedCategory ? 'selected' : ''}>${c}</option>`).join('');
                                })()}
                            </select>
                        </div>
                        <div class="form-group" style="margin: 0; flex: 1; min-width: 150px;">
                            <label class="form-label" style="font-size: 0.75rem; margin-bottom: 4px; color: var(--text-muted); font-weight: 500;">Đối tác / NCC</label>
                            <select id="filter-fin-partner" class="form-control" style="font-size: 0.85rem; padding: 6px 12px;" onchange="app.updateFinancialsFilters()">
                                <option value="">-- Tất cả đối tác --</option>
                                ${(() => {
                                    const partners = [...new Set(trans.map(t => t.partner).filter(Boolean))].sort();
                                    return partners.map(p => `<option value="${p}" ${p === selectedPartner ? 'selected' : ''}>${p}</option>`).join('');
                                })()}
                            </select>
                        </div>
                        <div style="display: flex; gap: 8px;">
                            <button class="btn btn-outline" onclick="app.resetFinancialsFilters()" style="padding: 0.4rem 0.8rem; font-size: 0.85rem; height: 35px;" title="Reset bộ lọc">
                                <i class="fa-solid fa-arrows-rotate"></i> Reset
                            </button>
                            <button class="btn btn-outline" onclick="app.exportFinancialReport('${selectedMonth}', '${selectedVessel}', '${selectedCategory}', '${selectedPartner}')" style="padding: 0.4rem 1rem; font-size: 0.85rem; height: 35px; white-space: nowrap;">
                                <i class="fa-solid fa-file-excel" style="color: var(--secondary); margin-right: 4px;"></i> Xuất Excel
                            </button>
                        </div>
                    </div>

                    <div class="table-container">
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>Ngày</th>
                                    <th>Tàu</th>
                                    <th>Hạng mục</th>
                                    <th>Nội dung</th>
                                    <th>Đối tác</th>
                                    <th>Nguồn tiền</th>
                                    <th>Thu</th>
                                    <th>Chi</th>
                                    <th>Thao tác</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${(() => {
                                    let filtered = trans;
                                    if (selectedMonth) {
                                        filtered = filtered.filter(t => t.date && t.date.substring(0, 7) === selectedMonth);
                                    }
                                    if (selectedVessel) {
                                        filtered = filtered.filter(t => t.vessel === selectedVessel);
                                    }
                                    if (selectedCategory) {
                                        filtered = filtered.filter(t => t.category === selectedCategory);
                                    }
                                    if (selectedPartner) {
                                        filtered = filtered.filter(t => t.partner === selectedPartner);
                                    }
                                    if (filtered.length === 0) {
                                        return `<tr><td colspan="9" style="text-align:center; padding: 3rem; color: var(--text-muted); font-style: italic;">Không tìm thấy giao dịch nào khớp với bộ lọc.</td></tr>`;
                                    }
                                    return filtered.map(t => `
                                        <tr style="${t.category === 'Luân chuyển' ? 'opacity: 0.6; font-style: italic;' : ''}">
                                            <td>${esc(t.date)}</td>
                                            <td><span class="badge badge-outline">${esc(t.vessel)}</span></td>
                                            <td>${esc(t.category)}</td>
                                            <td>${esc(t.content)}</td>
                                            <td>${esc(t.partner)}</td>
                                            <td><small>${esc(t.account)}</small></td>
                                            <td class="value-positive">${t.thu > 0 ? AppData.formatCurrency(t.thu) : '-'}</td>
                                            <td class="value-negative">${t.chi > 0 ? AppData.formatCurrency(t.chi) : '-'}</td>
                                            <td>
                                                <button class="btn btn-outline" style="padding: 0.2rem 0.5rem;" onclick="app.editTransaction('${t.id}')"><i class="fa-solid fa-pen" style="color:var(--info)"></i></button>
                                                <button class="btn btn-outline" style="padding: 0.2rem 0.5rem;" onclick="app.deleteTransaction('${t.id}')"><i class="fa-solid fa-trash" style="color:var(--accent)"></i></button>
                                            </td>
                                        </tr>
                                    `).join('');
                                })()}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    },

    transModal: () => {
        return `
            <div class="modal-header"><h3>Thêm Giao Dịch</h3><button class="modal-close" onclick="app.closeModal('trans-modal')">&times;</button></div>
            <div class="modal-body">
                <form onsubmit="event.preventDefault(); app.saveTransaction();">
                    <input type="hidden" id="t-id">
                    <div class="grid-2">
                        <div class="form-group"><label class="form-label">Ngày</label><input type="date" class="form-control" id="t-date" required></div>
                        <div class="form-group">
                            <label class="form-label">Tên tàu</label>
                            <select class="form-control" id="t-vessel" onchange="app.onTransactionCatChange()">
                                <option value="VP">VP</option>
                                ${AppData.state.vessels.map(v => `<option value="${v.id}">${v.id}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                    <div class="grid-2">
                        <div class="form-group"><label class="form-label">Hạng mục</label><select class="form-control" id="t-cat" required onchange="app.onTransactionCatChange()">
    <option value="">-- Chọn Hạng mục --</option>
    <option value="4.Dầu DO">4. Dầu DO</option>
    <option value="1.Tàu Ứng">1. Tàu Ứng</option>
    <option value="CVC">CVC</option>
    <option value="2.Chi Phí Cảng">2. Chi Phí Cảng</option>
    <option value="9.Vật Tư">9. Vật Tư</option>
    <option value="3.Lương">3. Lương</option>
    <option value="6.Lãi Vay">6. Lãi Vay</option>
    <option value="Trả gốc vay">Trả gốc vay</option>
    <option value="7.Bảo Hiểm">7. Bảo Hiểm</option>
    <option value="5.Dầu LO">5. Dầu LO</option>
    <option value="Luân chuyển">Luân chuyển</option>
    <option value="Văn phòng">Văn phòng</option>
</select></div>
                        <div class="form-group">
                            <label class="form-label">Đối tác</label>
                            <input type="text" class="form-control" id="t-partner" list="trans-partner-list" placeholder="Chọn hoặc nhập..." required>
                            <datalist id="trans-partner-list">
                                ${(() => {
                                    const list = [...AppData.getVendors(), ...AppData.getCustomers()];
                                    const uniqueNames = Array.from(new Set(list.map(p => p.name).filter(Boolean))).sort();
                                    return uniqueNames.map(name => `<option value="${name}"></option>`).join('');
                                })()}
                            </datalist>
                        </div>
                    </div>
                    <div class="grid-2">
                        <div class="form-group">
                            <label class="form-label">Số chuyến</label>
                            <input type="text" class="form-control" id="t-voyage" placeholder="VD: C1, C2... (để trống nếu chi phí tháng)">
                        </div>
                        <div class="form-group" id="t-contract-wrapper" style="display: none;">
                            <label class="form-label">Mã HĐ (Chỉ áp dụng CVC)</label>
                            <select class="form-control" id="t-contract">
                                <option value="">-- Chọn Mã HĐ --</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-group"><label class="form-label">Nội dung chi tiết</label><textarea class="form-control" id="t-content" required></textarea></div>
                    <div class="grid-2">
                        <div class="form-group"><label class="form-label">Khoản Thu (VND)</label><input type="text" inputmode="numeric" class="form-control money" id="t-thu" value="0"></div>
                        <div class="form-group"><label class="form-label">Khoản Chi (VND)</label><input type="text" inputmode="numeric" class="form-control money" id="t-chi" value="0"></div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Tài khoản thanh toán</label>
                        <select class="form-control" id="t-acc">
                            <option value="Tiền mặt">Tiền mặt</option>
                            <option value="ABbank">ABbank</option>
                            <option value="Viettinbank">Viettinbank</option>
                            <option value="Tài khoản cá nhân">Tài khoản cá nhân</option>
                        </select>
                    </div>
                    <div class="modal-footer"><button type="submit" class="btn btn-primary">Lưu Giao Dịch</button></div>
                </form>
            </div>
        `;
    },

    fuel: (vesselId) => {
        const vessels = AppData.getVessels();
        if (!vessels || vessels.length === 0) {
            return `<div class="view-section"><div class="page-header"><div><h1 class="page-title">Quản lý Nhiên liệu</h1></div></div>
                <div class="glass-card" style="text-align:center; padding:3rem;">
                    <i class="fa-solid fa-ship" style="font-size:2.5rem; color:var(--primary-light); margin-bottom:1rem;"></i>
                    <p>Chưa có tàu nào. Vui lòng thêm tàu trong mục <strong>Master Data</strong> (Thiết lập) trước khi quản lý nhiên liệu.</p>
                </div></div>`;
        }
        const selectedVesselId = vesselId || vessels[0].id;
        const selectedVessel = AppData.getVessel(selectedVesselId);
        const voyages = AppData.getFuelVoyages(selectedVesselId);

        return `
            <div class="view-section">
                <div class="page-header">
                    <div>
                        <h1 class="page-title">Quản lý Nhiên liệu</h1>
                        <p class="page-subtitle">Theo dõi theo từng Chuyến hàng (C1, C2...) cho tàu ${selectedVessel.name}</p>
                    </div>
                    
                    ${(() => {
                        const sortedVoyages = AppData.sortVoyages(voyages, 'asc');
                        const firstVoy = sortedVoyages[0];
                        const currentBalance = AppData.getVesselFuelBalance(selectedVesselId);
                        
                        return `
                            <div style="display:flex; gap:1.5rem; align-items:center;">
                                <div class="glass-card" style="padding:0.5rem 1rem; border-color:var(--primary-light); min-width:180px;">
                                    <small style="display:block; font-size:0.7rem; opacity:0.7; margin-bottom:0.2rem; text-transform:uppercase;">Tồn đầu tàu</small>
                                    <input type="number" class="form-control" style="background:transparent; border:none; padding:0; height:auto; font-weight:700; font-size:1.1rem; color:white; width:100%;" 
                                        value="${firstVoy ? (firstVoy.initialFuel || 0) : 0}" 
                                        onchange="app.updateInitialFuel('${firstVoy ? firstVoy.id : ''}', this.value)"
                                        placeholder="Nhập tồn đầu...">
                                </div>
                                <div class="glass-card" style="padding:0.5rem 1rem; border-color:var(--secondary); min-width:180px;">
                                    <small style="display:block; font-size:0.7rem; opacity:0.7; margin-bottom:0.2rem; text-transform:uppercase;">Tồn hiện tại</small>
                                    <div style="font-weight:700; font-size:1.1rem; color:var(--secondary);">${Math.round(currentBalance).toLocaleString()} L</div>
                                </div>
                            </div>
                        `;
                    })()}

                    <div style="display:flex; gap:1rem;">
                        <select class="form-control" onchange="app.navigate('fuel', this.value)" style="width:auto;">
                            ${vessels.map(v => `<option value="${v.id}" ${v.id === selectedVesselId ? 'selected' : ''}>${v.id}</option>`).join('')}
                        </select>
                        <button class="btn btn-primary" onclick="app.openFuelVoyageModal('${selectedVesselId}')">
                            <i class="fa-solid fa-plus"></i> Tạo Chuyến Mới
                        </button>
                        <button class="btn btn-outline" onclick="app.exportFuelReport()">
                            <i class="fa-solid fa-file-excel"></i> Xuất Báo Cáo
                        </button>
                    </div>
                </div>

                <div class="grid-1">
                    ${voyages.length === 0 ? '<div class="glass-card" style="text-align:center; padding:3rem;"><p>Chưa có chuyến hàng nào được ghi nhận cho tàu này.</p></div>' : ''}
                    ${(() => {
                        const sorted = AppData.sortVoyages(voyages, 'asc');
                        let runningBalance = Number(sorted[0]?.initialFuel || 0);
                        
                        return sorted.map(voy => {
                            const stats = AppData.getFuelVoyageStats(voy.id);
                            const logs = AppData.getFuelLogs(voy.id);
                            const prevBalance = runningBalance;
                            runningBalance += Number(voy.addedFuel || 0) - stats.totalFuel;
                            
                            return `
                                <div class="glass-card" style="margin-bottom:2rem;">
                                    <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:1px solid var(--border-color); padding-bottom:1rem; margin-bottom:1rem;">
                                        <div>
                                            <h3 style="color:var(--primary-light);">Chuyến: ${voy.voyageNo}</h3>
                                            <p style="font-size:0.9rem; opacity:0.8;">Loại hàng: ${voy.cargoType || '---'}</p>
                                        </div>
                                        <div style="text-align:right;">
                                            <div style="font-size:0.8rem; margin-bottom:0.5rem;">
                                                Tiếp dầu: <strong>${Math.round(voy.addedFuel || 0).toLocaleString()} L</strong> 
                                                ${voy.fuelDate ? ` | Ngày: <strong>${voy.fuelDate}</strong>` : ''}
                                                ${voy.fuelVendor ? ` | NCC: <strong>${voy.fuelVendor}</strong>` : ''}
                                                ${voy.fuelLocation ? ` | Tại: <strong>${voy.fuelLocation}</strong>` : ''}
                                            </div>
                                            <div style="margin-bottom:0.5rem;"><small>Đơn giá: <strong>${AppData.formatCurrency(voy.fuelUnitPrice)}</strong></small></div>
                                            <button class="btn btn-outline" style="padding:0.3rem 0.6rem; font-size:0.8rem;" onclick="app.openFuelVoyageModal('${selectedVesselId}', '${voy.id}')">
                                                <i class="fa-solid fa-pen"></i> Sửa Chuyến
                                            </button>
                                            <button class="btn btn-outline" style="padding:0.3rem 0.6rem; font-size:0.8rem; border-color:var(--rose-light);" onclick="app.deleteFuelVoyage('${voy.id}')">
                                                <i class="fa-solid fa-trash" style="color:var(--rose-light);"></i>
                                            </button>
                                        </div>
                                    </div>
                                    
                                    <div class="grid-3" style="margin-bottom:1.5rem; background:rgba(255,255,255,0.03); padding:1rem; border-radius:var(--radius-sm);">
                                        <div><small class="stat-label">Tổng giờ hành trình</small><div style="font-size:1.1rem; font-weight:700;">${stats.totalHours.toFixed(1)} h</div></div>
                                        <div><small class="stat-label">Tiêu thụ toàn chuyến</small><div style="font-size:1.1rem; font-weight:700; color:var(--rose-light);">${Math.round(stats.totalFuel).toLocaleString()} L</div></div>
                                        <div><small class="stat-label">Tồn cuối chuyến</small><div style="font-size:1.1rem; font-weight:700; color:var(--secondary);">${Math.round(runningBalance).toLocaleString()} L</div></div>
                                    </div>

                                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
                                    <h4 style="font-size:0.9rem; text-transform:uppercase; letter-spacing:1px; opacity:0.7;">Chi tiết các chặng</h4>
                                    <button class="btn btn-primary" style="padding:0.2rem 0.6rem; font-size:0.8rem;" onclick="app.openFuelLogModal('${voy.id}')">
                                        <i class="fa-solid fa-plus"></i> Thêm Chặng
                                    </button>
                                </div>

                                <div class="table-container">
                                    <table class="table" style="font-size:0.85rem;">
                                        <thead>
                                            <tr><th>Nơi đi</th><th>Thời gian đi</th><th>Nơi đến</th><th>Thời gian đến</th><th>Định mức</th><th>Số giờ</th><th>Thao tác</th></tr>
                                        </thead>
                                        <tbody>
                                            ${logs.map(l => `
                                                <tr>
                                                    <td>${l.startPos}</td>
                                                    <td><small>${l.startTime.replace('T', ' ')}</small></td>
                                                    <td>${l.endPos}</td>
                                                    <td><small>${l.endTime.replace('T', ' ')}</small></td>
                                                    <td>${Math.round(l.fuelRate)} L/h</td>
                                                    <td><strong>${l.hours}h</strong></td>
                                                    <td>
                                                        <button class="btn btn-outline" style="padding:0.1rem 0.3rem;" onclick="app.editFuelLog('${voy.id}', '${l.id}')"><i class="fa-solid fa-pen" style="color:var(--info)"></i></button>
                                                        <button class="btn btn-outline" style="padding:0.1rem 0.3rem;" onclick="app.deleteFuelLog('${l.id}')"><i class="fa-solid fa-trash" style="color:var(--accent)"></i></button>
                                                    </td>
                                                </tr>
                                            `).join('')}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        `;
                        }).reverse().join('')
                    })()}
                </div>
            </div>
        `;
    },

    fuelVoyageModal: (vesselId, voyageId) => {
        const voyage = voyageId ? AppData.getFuelVoyage(voyageId) : null;
        return `
            <div class="modal-header">
                <h3>${voyage ? 'Sửa Chuyến Hàng' : 'Tạo Chuyến Hàng Mới'}</h3>
                <button class="modal-close" onclick="app.closeModal('fuel-voyage-modal')">&times;</button>
            </div>
            <div class="modal-body">
                <form onsubmit="event.preventDefault(); app.saveFuelVoyage();">
                    <input type="hidden" id="fv-id" value="${voyageId || ''}">
                    <input type="hidden" id="fv-vessel-id" value="${vesselId}">
                    <div class="grid-2">
                        <div class="form-group">
                            <label class="form-label">Tên chuyến (Ví dụ: C1, C2...)</label>
                            <input type="text" class="form-control" id="fv-no" value="${voyage ? voyage.voyageNo : ''}" required placeholder="Nhập mã chuyến">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Loại hàng vận chuyển</label>
                            <input type="text" class="form-control" id="fv-cargo" value="${voyage ? (voyage.cargoType || '') : ''}" required placeholder="Ví dụ: Clinker, Than...">
                        </div>
                    </div>
                    <div class="grid-2">
                        <div class="form-group">
                            <label class="form-label">Nhiên liệu tiếp thêm (Lít)</label>
                            <input type="number" step="any" class="form-control" id="fv-added" value="${voyage ? voyage.addedFuel : 0}" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Đơn giá nhiên liệu tiếp thêm</label>
                            <input type="text" inputmode="numeric" class="form-control money" id="fv-price" value="${voyage ? app.fmtMoney(voyage.fuelUnitPrice) : '20.000'}" required>
                        </div>
                    <div class="grid-3">
                        <div class="form-group">
                            <label class="form-label">Ngày cấp</label>
                            <input type="date" class="form-control" id="fv-date" value="${voyage ? (voyage.fuelDate || '') : ''}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Nhà cung cấp</label>
                            <input type="text" class="form-control" id="fv-vendor" value="${voyage ? (voyage.fuelVendor || '') : ''}" list="fuel-vendor-list" placeholder="Chọn hoặc nhập...">
                            <datalist id="fuel-vendor-list">
                                ${AppData.getVendors().map(v => `<option value="${v.name}"></option>`).join('')}
                            </datalist>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Địa điểm cấp</label>
                            <input type="text" class="form-control" id="fv-location" value="${voyage ? (voyage.fuelLocation || '') : ''}" placeholder="Cảng/Vị trí...">
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="submit" class="btn btn-primary">${voyage ? 'Cập nhật Chuyến' : 'Lưu Chuyến Mới'}</button>
                    </div>
                </form>
            </div>
        `;
    },

    fuelModal: (voyageId) => {
        return `
            <div class="modal-header"><h3>Nhập Lộ Trình Chặng</h3><button class="modal-close" onclick="app.closeModal('fuel-modal')">&times;</button></div>
            <div class="modal-body">
                <form onsubmit="event.preventDefault(); app.saveFuelLog();">
                    <input type="hidden" id="f-id">
                    <input type="hidden" id="f-voyage-id" value="${voyageId}">
                    <div class="grid-2">
                        <div class="form-group"><label class="form-label">Thời gian đi</label><input type="datetime-local" class="form-control" id="f-start-time" required onchange="app.calcFuelLogHours()"></div>
                        <div class="form-group"><label class="form-label">Nơi đi</label><input type="text" class="form-control" id="f-start-pos" required></div>
                    </div>
                    <div class="grid-2">
                        <div class="form-group"><label class="form-label">Thời gian đến</label><input type="datetime-local" class="form-control" id="f-end-time" required onchange="app.calcFuelLogHours()"></div>
                        <div class="form-group"><label class="form-label">Nơi đến</label><input type="text" class="form-control" id="f-end-pos" required></div>
                    </div>
                    <div class="grid-2">
                        <div class="form-group"><label class="form-label">Định mức (Lít/giờ)</label><input type="number" step="any" class="form-control" id="f-fuel-rate" required placeholder="Ví dụ: 150"></div>
                        <div class="form-group"><label class="form-label">Số giờ nổ máy</label><input type="number" step="any" class="form-control" id="f-hours" readonly style="background:rgba(0,0,0,0.2);"></div>
                    </div>
                    <div class="modal-footer"><button type="submit" class="btn btn-primary">Lưu Chặng</button></div>
                </form>
            </div>
        `;
    },

    partners: (activeTab = 'vendor') => {
        return `
            <div class="view-section">
                <div class="page-header">
                    <div>
                        <h1 class="page-title">Nhà cung cấp - Khách hàng</h1>
                        <p class="page-subtitle">Quản lý mạng lưới đối tác kinh doanh</p>
                    </div>
                    <button class="btn btn-primary" onclick="app.openPartnerModal('${activeTab}')">
                        <i class="fa-solid fa-plus"></i>
                        ${activeTab === 'vendor' ? 'Thêm NCC' : 'Thêm Khách hàng'}
                    </button>
                </div>
                <div class="glass-card">
                    <div style="display:flex; gap:1rem; border-bottom:1px solid var(--border-color); margin-bottom:1.5rem;">
                        <button class="btn btn-outline" style="border:none; border-bottom:2px solid ${activeTab === 'vendor' ? 'var(--primary-light)' : 'transparent'}; border-radius:0;" onclick="app.navigate('partners', 'vendor')">Nhà cung cấp</button>
                        <button class="btn btn-outline" style="border:none; border-bottom:2px solid ${activeTab === 'customer' ? 'var(--primary-light)' : 'transparent'}; border-radius:0;" onclick="app.navigate('partners', 'customer')">Khách hàng</button>
                    </div>
                    <div class="table-container">
                        <table class="table">
                            <thead><tr><th>Tên đối tác</th><th>Địa chỉ</th><th>Số điện thoại</th><th>Thao tác</th></tr></thead>
                            <tbody>
                                ${activeTab === 'vendor' ? 
                                    (AppData.getVendors().length === 0 ? '<tr><td colspan="4" style="text-align:center; color:var(--text-muted); padding:2rem;">Chưa có nhà cung cấp nào. Nhấn "Thêm NCC" để bắt đầu.</td></tr>' :
                                    AppData.getVendors().map(v => `<tr><td><strong>${esc(v.name)}</strong> <span class="badge badge-outline">NCC</span></td><td>${esc(v.address) || '---'}</td><td>${esc(v.contact) || '---'}</td><td>
                                        <button class="btn btn-outline" style="padding:0.2rem 0.5rem;" onclick="app.editVendor('${v.id}')"><i class="fa-solid fa-pen" style="color:var(--info)"></i></button>
                                        <button class="btn btn-outline" style="padding:0.2rem 0.5rem;" onclick="app.deleteVendor('${v.id}')"><i class="fa-solid fa-trash" style="color:var(--accent)"></i></button>
                                    </td></tr>`).join('')) :
                                    (AppData.getCustomers().length === 0 ? '<tr><td colspan="4" style="text-align:center; color:var(--text-muted); padding:2rem;">Chưa có khách hàng nào. Nhấn "Thêm Khách hàng" để bắt đầu.</td></tr>' :
                                    AppData.getCustomers().map(c => `<tr><td><strong>${esc(c.name)}</strong> <span class="badge badge-outline">KH</span></td><td>${esc(c.address) || '---'}</td><td>${esc(c.contact) || '---'}</td><td>
                                        <button class="btn btn-outline" style="padding:0.2rem 0.5rem;" onclick="app.editCustomer('${c.id}')"><i class="fa-solid fa-pen" style="color:var(--info)"></i></button>
                                        <button class="btn btn-outline" style="padding:0.2rem 0.5rem;" onclick="app.deleteCustomer('${c.id}')"><i class="fa-solid fa-trash" style="color:var(--accent)"></i></button>
                                    </td></tr>`).join(''))
                                }
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    },

    partnerModal: (type, partner = null) => {
        const isVendor = type === 'vendor';
        const title = partner ? (isVendor ? 'Sửa Nhà Cung Cấp' : 'Sửa Khách Hàng') : (isVendor ? 'Thêm Nhà Cung Cấp Mới' : 'Thêm Khách Hàng Mới');
        return `
            <div class="modal-header">
                <h3><i class="fa-solid fa-${isVendor ? 'truck' : 'user-tie'}"></i> ${title}</h3>
                <button class="modal-close" onclick="app.closeModal('partner-modal')">&times;</button>
            </div>
            <div class="modal-body">
                <form onsubmit="event.preventDefault(); app.savePartner('${type}');">
                    <input type="hidden" id="p-id" value="${partner ? partner.id : ''}">
                    <input type="hidden" id="p-type" value="${type}">
                    <div class="form-group">
                        <label class="form-label">Tên ${isVendor ? 'Nhà cung cấp' : 'Khách hàng'} <span style="color:var(--accent)">*</span></label>
                        <input type="text" class="form-control" id="p-name" value="${partner ? esc(partner.name) : ''}" required placeholder="Nhập tên đối tác..." autofocus>
                    </div>
                    <div class="grid-2">
                        <div class="form-group">
                            <label class="form-label">Số điện thoại</label>
                            <input type="text" class="form-control" id="p-contact" value="${partner ? (partner.contact || '') : ''}" placeholder="VD: 0987654321">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Địa chỉ</label>
                            <input type="text" class="form-control" id="p-address" value="${partner ? esc(partner.address || '') : ''}" placeholder="Tỉnh/Thành phố...">
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-outline" onclick="app.closeModal('partner-modal')">Hủy</button>
                        <button type="submit" class="btn btn-primary"><i class="fa-solid fa-floppy-disk"></i> Lưu</button>
                    </div>
                </form>
            </div>
        `;
    },

    'monthly-costs': () => {
        const month = new Date().toISOString().substring(0, 7);
        const vessels = AppData.getVessels();
        const firstVesselId = vessels[0] ? vessels[0].id : '';
        const costs = AppData.getMonthlyCosts(month, firstVesselId);
        return `
            <div class="view-section">
                <div class="page-header"><div><h1 class="page-title">Chi phí theo Tháng</h1><p class="page-subtitle">Nhập liệu chi phí để phân bổ vào chuyến hàng</p></div></div>
                <div class="glass-card" style="max-width:600px;">
                    <form onsubmit="event.preventDefault(); app.saveMonthlyCosts();">
                        <div class="grid-2">
                            <div class="form-group"><label class="form-label">Chọn tháng</label><input type="month" class="form-control" id="m-month" value="${month}" onchange="app.loadMonthlyCosts()"></div>
                            <div class="form-group">
                                <label class="form-label">Chọn tàu</label>
                                <select class="form-control" id="m-vessel" onchange="app.loadMonthlyCosts()">
                                    ${vessels.map(v => `<option value="${v.id}">${v.id}</option>`).join('')}
                                </select>
                            </div>
                        </div>
                        <div class="form-group"><label class="form-label">Lương tổng (VND)</label><input type="text" inputmode="numeric" class="form-control money" id="m-salary" value="${app.fmtMoney(costs.salary || 0)}"></div>
                        <div class="form-group"><label class="form-label">Bảo hiểm (VND)</label><input type="text" inputmode="numeric" class="form-control money" id="m-ins" value="${app.fmtMoney(costs.insurance || 0)}"></div>
                        
                        <div class="form-group">
                            <label class="form-label">Tiền ăn uống (VND) <span style="font-size:0.75rem; color:var(--secondary); font-weight:normal;">(Tự động từ Báo cáo Tàu hoặc tự nhập)</span></label>
                            <input type="text" inputmode="numeric" class="form-control money" id="m-food" value="${app.fmtMoney(costs.food || 0)}">
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label">Vật tư, sửa chữa Công ty cấp (VND) <span style="font-size:0.75rem; color:var(--info); font-weight:normal;">(Tự nhập tại đây)</span></label>
                            <input type="text" inputmode="numeric" class="form-control money" id="m-material-company" value="${app.fmtMoney(costs.materialCompany || 0)}">
                        </div>

                        <div class="form-group">
                            <label class="form-label">Lãi vay (VND) <span style="font-size:0.75rem; color:var(--info); font-weight:normal;">(Tự động tính từ Giao dịch)</span></label>
                            <input type="number" step="any" class="form-control" id="m-loan-interest" value="${costs.loanInterest || 0}" readonly style="background:rgba(0,0,0,0.3); color:var(--text-muted);">
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label">Vật tư, sửa chữa Tàu chi (VND) <span style="font-size:0.75rem; color:var(--warning); font-weight:normal;">(Tự động lấy từ Báo cáo Tàu)</span></label>
                            <input type="number" step="any" class="form-control" id="m-material-vessel" value="${costs.materialVessel || 0}" readonly style="background:rgba(0,0,0,0.3); color:var(--text-muted);">
                        </div>
                        
                        <div class="form-group"><label class="form-label">Chi phí khác (VND)</label><input type="text" inputmode="numeric" class="form-control money" id="m-other" value="${app.fmtMoney(costs.other || 0)}"></div>
                        <button type="submit" class="btn btn-primary" style="width:100%;">Lưu chi phí tháng</button>
                    </form>
                </div>
            </div>
        `;
    },

    'vessel-expenses': () => {
        const month = new Date().toISOString().substring(0, 7);
        const vessels = AppData.getVessels();
        const firstVesselId = vessels[0] ? vessels[0].id : '';
        const stats = AppData.getVesselFundStats(firstVesselId, month);

        return `
            <div class="view-section">
                <div class="page-header">
                    <div>
                        <h1 class="page-title">Quản lý Báo cáo Thuyền trưởng & Quỹ Tàu</h1>
                        <p class="page-subtitle">Quản lý các khoản chi tiêu thực tế của Thuyền trưởng và phân bổ trực tiếp/theo ngày vào các Chuyến đi</p>
                    </div>
                </div>

                <!-- Selector & Fund Stats Grid -->
                <div class="grid-3" style="grid-template-columns: 1fr 2fr; gap: 1.5rem; margin-bottom: 2rem;">
                    <!-- Select Month/Vessel Card -->
                    <div class="glass-card" style="padding: 1.5rem; display: flex; flex-direction: column; justify-content: center; gap: 1rem;">
                        <h3 style="color: var(--accent); margin: 0 0 0.5rem 0;"><i class="fa-solid fa-filter"></i> Lọc dữ liệu</h3>
                        <div class="form-group" style="margin: 0;">
                            <label class="form-label">Chọn tháng</label>
                            <input type="month" class="form-control" id="ve-month" value="${month}" onchange="app.loadVesselExpenses()">
                        </div>
                        <div class="form-group" style="margin: 0;">
                            <label class="form-label">Chọn tàu</label>
                            <select class="form-control" id="ve-vessel" onchange="app.loadVesselExpenses()">
                                ${vessels.map(v => `<option value="${v.id}">${v.id}</option>`).join('')}
                            </select>
                        </div>
                    </div>

                    <!-- 4 Stats Cards Grid -->
                    <div class="grid-4" style="gap: 1rem; margin: 0;">
                        <!-- Opening Balance -->
                        <div class="stat-card glass-panel" style="border-left: 4px solid var(--info); background: linear-gradient(135deg, rgba(0, 180, 216, 0.05), rgba(0,0,0,0.2));">
                            <div class="stat-header">
                                <span class="stat-label">Tồn Quỹ Đầu Kỳ</span>
                                <i class="fa-solid fa-calculator" style="color: var(--info);"></i>
                            </div>
                            <div class="stat-value" id="ve-stat-opening" style="font-size: 1.3rem; color: var(--info); font-weight:600;">${AppData.formatCurrency(stats.opening)}</div>
                            <div style="font-size:0.7rem; color:var(--text-muted); margin-top:5px;">Kết chuyển từ các tháng trước</div>
                        </div>

                        <!-- Income (Advances) -->
                        <div class="stat-card glass-panel" style="border-left: 4px solid var(--secondary); background: linear-gradient(135deg, rgba(0, 255, 100, 0.05), rgba(0,0,0,0.2));">
                            <div class="stat-header">
                                <span class="stat-label">Công Ty Tạm Ứng</span>
                                <i class="fa-solid fa-arrow-down-long" style="color: var(--secondary);"></i>
                            </div>
                            <div class="stat-value" id="ve-stat-income" style="font-size: 1.3rem; color: var(--secondary); font-weight:600;">${AppData.formatCurrency(stats.income)}</div>
                            <div style="font-size:0.7rem; color:var(--text-muted); margin-top:5px;">Từ chi nhánh (1.Tàu Ứng)</div>
                        </div>

                        <!-- Expense -->
                        <div class="stat-card glass-panel" style="border-left: 4px solid var(--rose-light); background: linear-gradient(135deg, rgba(255, 0, 100, 0.05), rgba(0,0,0,0.2));">
                            <div class="stat-header">
                                <span class="stat-label">Tàu Đã Chi</span>
                                <i class="fa-solid fa-arrow-up-long" style="color: var(--rose-light);"></i>
                            </div>
                            <div class="stat-value" id="ve-stat-expense" style="font-size: 1.3rem; color: var(--rose-light); font-weight:600;">${AppData.formatCurrency(stats.expense)}</div>
                            <div style="font-size:0.7rem; color:var(--text-muted); margin-top:5px;">Tổng cộng từ báo cáo tháng</div>
                        </div>

                        <!-- Current Balance -->
                        <div class="stat-card glass-panel" style="border-left: 4px solid var(--warning); background: linear-gradient(135deg, rgba(255, 160, 0, 0.05), rgba(0,0,0,0.2));">
                            <div class="stat-header">
                                <span class="stat-label">Tồn Quỹ Hiện Tại</span>
                                <i class="fa-solid fa-wallet" style="color: var(--warning);"></i>
                            </div>
                            <div class="stat-value" id="ve-stat-balance" style="font-size: 1.3rem; color: var(--warning); font-weight: 700;">${AppData.formatCurrency(stats.balance)}</div>
                            <div style="font-size:0.7rem; color:var(--text-muted); margin-top:5px;">Số dư két tiền mặt tại tàu</div>
                        </div>
                    </div>
                </div>

                <!-- Structured Input Section Grid -->
                <div class="grid-2" style="grid-template-columns: 1.15fr 1.85fr; gap: 1.5rem; align-items: start;">
                    <!-- Left column: Captain's Monthly Form -->
                    <div class="glass-card" style="padding: 1.5rem;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">
                            <h3 style="margin:0; color:var(--info); font-size:1.1rem;"><i class="fa-solid fa-file-invoice-dollar"></i> Nhập Báo cáo Thuyền trưởng</h3>
                            <span class="badge badge-info" style="font-size:0.75rem;">Nhập tay hàng tháng</span>
                        </div>
                        
                        <!-- 1. Tiền ăn uống -->
                        <div class="form-group" style="margin-bottom: 1rem;">
                            <label class="form-label" style="font-weight: 600; color: var(--text-main);"><i class="fa-solid fa-utensils"></i> 1. Tiền ăn & bồi dưỡng TV</label>
                            <input type="text" inputmode="numeric" class="form-control money" id="ve-food" placeholder="Nhập tổng tiền ăn uống..." style="background: rgba(0,0,0,0.4); font-weight:600; color: var(--secondary);">
                            <small class="form-text text-muted">Chi phí ăn uống phân bổ đều theo số ngày chạy tàu.</small>
                        </div>

                        <!-- 4. Vật tư & CP khác -->
                        <div class="form-group" style="margin-bottom: 1.25rem;">
                            <label class="form-label" style="font-weight: 600; color: var(--text-main);"><i class="fa-solid fa-wrench"></i> 4. Tiền Vật tư, sửa chữa (Tàu chi)</label>
                            <input type="text" inputmode="numeric" class="form-control money" id="ve-material" placeholder="Nhập tổng tiền vật tư, sửa chữa..." style="background: rgba(0,0,0,0.4); font-weight:600; color: var(--secondary);">
                            <small class="form-text text-muted">Chi phí vật tư tàu tự mua phân bổ đều theo số ngày chạy tàu.</small>
                        </div>

                        <!-- 2. Chi phí cảng -->
                        <div style="margin-bottom: 1.5rem;">
                            <label class="form-label" style="font-weight: 600; color: var(--text-main); margin-bottom: 0.5rem; display:block;"><i class="fa-solid fa-anchor"></i> 2. Chi phí tại các đầu cảng</label>
                            <div id="ve-ports-container" style="background: rgba(0,0,0,0.2); border: 1px dashed var(--border-color); border-radius: 6px; padding: 0.75rem; margin-bottom: 0.5rem; min-height: 50px;">
                                <!-- Port rows dynamically added -->
                            </div>
                            <button type="button" class="btn btn-outline btn-xs" onclick="app.addPortExpenseRow()" style="font-size:0.75rem; padding: 4px 8px; border-color: rgba(255,255,255,0.15);"><i class="fa-solid fa-plus"></i> Thêm Chi Phí Cảng</button>
                        </div>

                        <!-- 3. Tiền Bông từng chuyến -->
                        <div style="margin-bottom: 1.5rem;">
                            <label class="form-label" style="font-weight: 600; color: var(--text-main); margin-bottom: 0.5rem; display:block;"><i class="fa-solid fa-handshake"></i> 3. Tiền Bông từng chuyến</label>
                            <div id="ve-brokerages-container" style="background: rgba(0,0,0,0.2); border: 1px dashed var(--border-color); border-radius: 6px; padding: 0.75rem; margin-bottom: 0.5rem; min-height: 50px;">
                                <!-- Brokerage rows dynamically added -->
                            </div>
                            <button type="button" class="btn btn-outline btn-xs" onclick="app.addBrokerageRow()" style="font-size:0.75rem; padding: 4px 8px; border-color: rgba(255,255,255,0.15);"><i class="fa-solid fa-plus"></i> Thêm Tiền Bông</button>
                        </div>

                        <!-- Save/Reset action buttons -->
                        <div style="display:flex; gap:1rem; margin-top: 1.5rem; border-top: 1px solid var(--border-color); padding-top: 1rem;">
                            <button type="button" class="btn btn-outline" onclick="app.resetCaptainReportForm()" style="flex:1;"><i class="fa-solid fa-arrow-rotate-left"></i> Xóa Trống</button>
                            <button type="button" class="btn btn-primary" onclick="app.saveMonthlyCaptainReport()" style="flex:2; font-weight:700;"><i class="fa-solid fa-cloud-arrow-up"></i> CẬP NHẬT CHI PHÍ</button>
                        </div>
                    </div>

                    <!-- Right column: Dynamic Voyage Distribution List -->
                    <div class="glass-card" style="padding: 1.5rem; min-height: 500px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">
                            <h3 style="margin:0; color:var(--accent); font-size:1.1rem;"><i class="fa-solid fa-ship"></i> Phân bổ Chi phí vào các Chuyến trong tháng</h3>
                            <span class="badge badge-success" style="font-size:0.75rem;">Đồng bộ Tức thì</span>
                        </div>
                        <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 1.25rem; line-height: 1.45;">
                            Các chuyến hàng chạy trong tháng của tàu được lọc dưới đây sẽ tự động nhận phân bổ từ Báo cáo Thuyền trưởng (theo số ngày chạy chuyến hoặc gán trực tiếp).
                        </p>
                        <div class="table-responsive" style="max-height: 480px; overflow-y: auto;">
                            <table class="table" style="background: rgba(0,0,0,0.15);">
                                <thead>
                                    <tr>
                                        <th>Mã chuyến</th>
                                        <th>Thời gian chạy</th>
                                        <th style="text-align: right;">Tiền ăn</th>
                                        <th style="text-align: right;">Vật tư tàu chi</th>
                                        <th style="text-align: right;">Cảng tàu chi</th>
                                        <th style="text-align: right;">Tiền bông</th>
                                        <th style="text-align: right; color:var(--rose-light);">Tổng chi két tàu</th>
                                    </tr>
                                </thead>
                                <tbody id="ve-allocated-voyages">
                                    <!-- Populated dynamically via JS -->
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    shipments: () => {
        const ships = AppData.getShipments()
            .slice()
            .sort((a, b) => {
                const numA = parseInt((a.contractNo || '').replace(/\D/g, '')) || 0;
                const numB = parseInt((b.contractNo || '').replace(/\D/g, '')) || 0;
                return numB - numA; // Giảm dần: HD52 lên đầu
            });
        return `
            <div class="view-section">
                <div class="page-header">
                    <div><h1 class="page-title">Quản lý Chuyến hàng</h1><p class="page-subtitle">Theo dõi doanh thu, chi phí và hiệu quả từng mã chuyến</p></div>
                    <div>
                        <button class="btn btn-outline" onclick="app.exportShipmentReport()" style="margin-right: 8px;">
                            <i class="fa-solid fa-file-excel"></i> Xuất Báo Cáo
                        </button>
                        <button class="btn btn-primary" onclick="app.openShipmentModal()"><i class="fa-solid fa-plus"></i> Thêm Chuyến Mới</button>
                    </div>
                </div>
                <div class="glass-card">
                    <div class="table-container">
                        <table class="table">
                            <thead>
                                <tr><th>Mã HĐ</th><th>Chuyến số</th><th>Khách hàng</th><th>Tàu</th><th>Thời gian</th><th>Doanh thu thực</th><th>Doanh thu HĐ</th><th>Tiền gửi lại</th><th>Hiệu quả</th><th>Thao tác</th></tr>
                            </thead>
                            <tbody>
                                ${ships.map(s => {
                                    const costSum = Object.values(s.costs || {}).reduce((sum, v) => sum + (Number(v) || 0), 0);
                                    const profit = s.revenueReal - costSum;
                                    return `
                                        <tr>
                                            <td><strong>${s.contractNo || '---'}</strong></td>
                                            <td><span class="badge badge-outline">${s.voyageNo || '---'}</span></td>
                                            <td><span class="text-info">${s.customer || '---'}</span></td>
                                            <td><span class="badge badge-success">${s.vesselId}</span></td>
                                            <td><small>${s.dateStart} → ${s.dateEnd}</small></td>
                                            <td>${AppData.formatCurrency(s.revenueReal)}</td>
                                            <td>${AppData.formatCurrency(s.revenueInvoice)}</td>
                                            <td style="color:var(--warning)">${AppData.formatCurrency(s.refundAmount)}</td>
                                            <td class="${profit >= 0 ? 'value-positive' : 'value-negative'}"><strong>${AppData.formatCurrency(profit)}</strong></td>
                                            <td>
                                                <button class="btn btn-outline" style="padding: 0.2rem 0.5rem;" title="Xem Báo Cáo" onclick="app.openShipmentReport('${s.id}')"><i class="fa-solid fa-file-invoice-dollar" style="color:var(--success)"></i></button>
                                                <button class="btn btn-outline" style="padding: 0.2rem 0.5rem;" title="Sửa" onclick="app.editShipment('${s.id}')"><i class="fa-solid fa-pen" style="color:var(--info)"></i></button>
                                                <button class="btn btn-outline" style="padding: 0.2rem 0.5rem;" title="Xóa" onclick="app.deleteShipment('${s.id}')"><i class="fa-solid fa-trash" style="color:var(--accent)"></i></button>
                                            </td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    },

    shipModal: () => {
        return `
            <div class="modal-header"><h3>Nhập Liệu Chuyến Hàng</h3><button class="modal-close" onclick="app.closeModal('ship-modal')">&times;</button></div>
            <div class="modal-body">
                <form onsubmit="event.preventDefault(); app.saveShipment();">
                    <input type="hidden" id="s-id">
                    <div class="grid-3">
                        <div class="form-group"><label class="form-label">Mã Hợp đồng</label><input type="text" class="form-control" id="s-contract-no" required></div>
                        <div class="form-group"><label class="form-label">Chuyến số (Ví dụ: C1)</label><input type="text" class="form-control" id="s-voy-no" required oninput="app.syncShipmentFuel()"></div>
                        <div class="form-group"><label class="form-label">Tàu</label><select class="form-control" id="s-vessel-id" onchange="app.handleShipmentVesselChange()">${AppData.getVessels().map(v => `<option value="${v.id}">${v.name}</option>`).join('')}</select></div>
                    </div>
                    <div class="grid-3">
                        <div class="form-group"><label class="form-label">Tên khách hàng</label>
                            <input type="text" class="form-control" id="s-customer" list="customer-list" placeholder="Chọn hoặc nhập..." required>
                            <datalist id="customer-list">
                                ${AppData.getCustomers().map(c => `<option value="${c.name}"></option>`).join('')}
                            </datalist>
                        </div>
                        <div class="form-group"><label class="form-label">Tên hàng</label>
                            <input type="text" class="form-control" id="s-cargo" list="cargo-list" placeholder="Chọn hoặc nhập..." required oninput="app.calcBrokerage()">
                            <datalist id="cargo-list">
                                ${AppData.getCargos().map(c => `<option value="${c}"></option>`).join('')}
                            </datalist>
                        </div>
                        <div class="form-group"><label class="form-label">Cảng xếp (Đi)</label>
                            <input type="text" class="form-control" id="s-p-load" list="port-list" placeholder="Chọn hoặc nhập..." required oninput="app.calcBrokerage()">
                        </div>
                    </div>
                    <div class="form-group"><label class="form-label">Cảng dỡ (Đến)</label>
                        <input type="text" class="form-control" id="s-p-dis" list="port-list" placeholder="Chọn hoặc nhập..." required oninput="app.calcBrokerage()">
                        <datalist id="port-list">
                            ${AppData.getPorts().map(p => `<option value="${p}"></option>`).join('')}
                        </datalist>
                    </div>
                    <div class="grid-3">
                        <div class="form-group"><label class="form-label">Ngày xếp hàng</label><input type="date" class="form-control" id="s-start" required onchange="app.calcShipmentAllocations()"></div>
                        <div class="form-group"><label class="form-label">Ngày dỡ hàng</label><input type="date" class="form-control" id="s-end" required onchange="app.calcShipmentAllocations()"></div>
                        <div class="form-group"><label class="form-label">Tháng hạch toán</label><input type="month" class="form-control" id="s-report-month" title="Mặc định lấy theo tháng của ngày xếp hàng"></div>
                    </div>
                    <div class="grid-4">
                        <div class="form-group"><label class="form-label">Khối lượng (Tấn)</label><input type="number" step="any" class="form-control" id="s-qty" oninput="app.calcShipmentFinance()" required></div>
                        <div class="form-group"><label class="form-label">Đơn giá thực</label><input type="number" step="any" class="form-control" id="s-rate" oninput="app.calcShipmentFinance()" required></div>
                        <div class="form-group"><label class="form-label">Tiền gửi (VND/tấn)</label><input type="number" step="any" class="form-control" id="s-markup" oninput="app.calcShipmentFinance()" value="0"></div>
                        <div class="form-group"><label class="form-label">Giá dầu chuyến</label><input type="number" step="any" class="form-control" id="s-fuel-p" oninput="app.calcShipmentFinance()" value="20000"></div>
                    </div>
                    <div class="grid-3" style="background:rgba(255,255,255,0.05); padding:1rem; border-radius:var(--radius-md); margin-bottom:1.5rem;">
                        <div><small class="stat-label">Doanh thu Hóa đơn</small><div id="val-rev-inv" style="font-weight:bold; color:var(--info);">0 đ</div></div>
                        <div><small class="stat-label">Doanh thu thực tế</small><div id="val-rev-real" style="font-weight:bold; color:var(--secondary);">0 đ</div></div>
                        <div><small class="stat-label">Tiền gửi lại khách</small><div id="val-refund" style="font-weight:bold; color:var(--warning);">0 đ</div></div>
                    </div>
                    
                    <h4 style="margin-bottom:1rem; color:var(--accent);">Chi phí Chuyến hàng</h4>
                    <div class="grid-4">
                        <div class="form-group"><label class="form-label">Số giờ chạy (Auto)</label><input type="number" class="form-control" id="s-c-hours" readonly style="background:rgba(0,0,0,0.3);"></div>
                        <div class="form-group"><label class="form-label">Tiền dầu DO (Auto)</label><input type="number" class="form-control" id="s-c-fuel" readonly style="background:rgba(0,0,0,0.3);"></div>
                        <div class="form-group"><label class="form-label">Tiền dầu LO</label><input type="number" class="form-control" id="s-c-fuel-lo" oninput="app.calcShipmentFinance()"></div>
                        <div class="form-group"><label class="form-label">Đại lý 2 đầu cảng</label><input type="number" class="form-control" id="s-c-agent" oninput="app.calcShipmentFinance()"></div>
                    </div>
                    
                    <div class="grid-4" style="background:rgba(255,255,255,0.02); padding:1rem; border-radius:var(--radius-sm); border:1px dashed var(--border-color); margin-bottom:1rem;">
                        <div class="form-group"><label class="form-label" style="color:var(--secondary);">Lương TV (Alloc)</label><input type="number" class="form-control" id="s-c-sal" readonly style="background:rgba(0,0,0,0.3); color:var(--secondary);"></div>
                        <div class="form-group"><label class="form-label" style="color:var(--secondary);">Tiền ăn (Alloc)</label><input type="number" class="form-control" id="s-c-food" readonly style="background:rgba(0,0,0,0.3); color:var(--secondary);"></div>
                        <div class="form-group"><label class="form-label" style="color:var(--secondary);">Bảo hiểm (Alloc)</label><input type="number" class="form-control" id="s-c-ins" readonly style="background:rgba(0,0,0,0.3); color:var(--secondary);"></div>
                        <div class="form-group"><label class="form-label" style="color:var(--secondary);">CP khác Cty cấp (Alloc)</label><input type="number" class="form-control" id="s-c-m-other" readonly style="background:rgba(0,0,0,0.3); color:var(--secondary);"></div>
                    </div>

                    <div class="grid-4" style="background:rgba(255,255,255,0.02); padding:1rem; border-radius:var(--radius-sm); border:1px dashed var(--border-color); margin-bottom:1rem;">
                        <div class="form-group"><label class="form-label" style="color:var(--info);">Vật tư Cty cấp (Alloc)</label><input type="number" class="form-control" id="s-c-m-mat-company" readonly style="background:rgba(0,0,0,0.3); color:var(--info);"></div>
                        <div class="form-group"><label class="form-label" style="color:var(--warning);">Vật tư Tàu chi (Alloc)</label><input type="number" class="form-control" id="s-c-m-mat-vessel" readonly style="background:rgba(0,0,0,0.3); color:var(--warning);"></div>
                        <div class="form-group"><label class="form-label">Tàu chi 2 đầu cảng (Tàu chi)</label><input type="number" class="form-control" id="s-c-vessel-2ends" oninput="app.calcShipmentFinance()"></div>
                        <div class="form-group"><label class="form-label">Tiền Bông (Auto/Tàu chi)</label><input type="number" class="form-control" id="s-c-brokerage" oninput="app.calcShipmentFinance()"></div>
                    </div>

                    <div class="grid-4">
                        <div class="form-group">
                            <label class="form-label">Hệ số hàng (A)</label>
                            <select class="form-control" id="s-coef-a" onchange="app.calcBrokerage()">
                                <option value="2.0">Hàng rời/Than/Cát (2.0)</option>
                                <option value="1.0">Niêm phong (1.0)</option>
                                <option value="1.5">Kiện bịch (1.5)</option>
                                <option value="2.0">Đầu bao (2.0)</option>
                            </select>
                        </div>
                        <div class="form-group"><label class="form-label">Tiền VAT (Tự tính)</label><input type="number" class="form-control" id="s-c-vat" readonly style="background:rgba(0,0,0,0.3);"></div>
                        <div class="form-group"><label class="form-label">Hoa tiêu, Tàu lai, Phí cảng</label><input type="number" class="form-control" id="s-c-port-fees" oninput="app.calcShipmentFinance()"></div>
                        <div class="form-group"><label class="form-label">Chi phí khác tàu chi</label><input type="number" class="form-control" id="s-c-others" oninput="app.calcShipmentFinance()"></div>
                    </div>
                    <div class="modal-footer"><button type="submit" class="btn btn-primary" style="width:100%;">Lưu Chuyến Hàng</button></div>
                </form>
            </div>
        `;
    },

    hr: (activeTab = 'all') => {
        let employees = AppData.getEmployees();
        const vessels = AppData.getVessels();
        
        // Filter by tab
        if (activeTab !== 'all') {
            employees = employees.filter(e => e.department === activeTab);
        }

        const tabs = [
            { id: 'all', name: 'Tất cả' },
            { id: 'VP', name: 'Khối Quản lý' },
            ...vessels.map(v => ({ id: v.id, name: `Tàu ${v.name}` }))
        ];

        return `
            <div class="view-section">
                <div class="page-header">
                    <div>
                        <h1 class="page-title">Quản lý Nhân sự</h1>
                        <p class="page-subtitle">Hồ sơ nhân viên & thuyền viên</p>
                    </div>
                    <button class="btn btn-primary" onclick="app.openEmployeeModal()">
                        <i class="fa-solid fa-plus"></i> Thêm Nhân sự
                    </button>
                </div>
                
                <div class="tabs" style="display:flex; gap:10px; margin-bottom: 20px; overflow-x: auto;">
                    ${tabs.map(t => `
                        <button class="btn ${activeTab === t.id ? 'btn-primary' : 'btn-outline'}" onclick="app.hrTab = '${t.id}'; app.navigate('hr')">
                            ${t.name}
                        </button>
                    `).join('')}
                </div>

                <div class="glass-card">
                    <div class="table-container">
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>Họ và Tên</th>
                                    <th>Chức vụ</th>
                                    ${activeTab === 'all' ? '<th>Bộ phận/Tàu</th>' : ''}
                                    <th>Lương cơ bản</th>
                                    <th>PC Giao nhận</th>
                                    <th>Thưởng HT CV</th>
                                    <th>Tiền ăn ca</th>
                                    <th>Điện thoại</th>
                                    <th>Trang phục</th>
                                    <th>Xăng xe</th>
                                    <th>Giảm trừ bản thân</th>
                                    <th>NPT</th>
                                    <th>Thao tác</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${employees.map(e => `
                                    <tr>
                                        <td>
                                            <strong>${e.name}</strong><br>
                                            <small style="color:var(--text-muted)">
                                                ${e.joinDate ? 'Vào: ' + e.joinDate.split('-').reverse().join('/') : ''} 
                                                ${e.leaveDate ? `<span style="color:var(--rose-light)">Nghỉ: ${e.leaveDate.split('-').reverse().join('/')}</span>` : ''}
                                            </small>
                                        </td>
                                        <td>${e.role || ''}</td>
                                        ${activeTab === 'all' ? `<td><span class="badge badge-outline">${e.department || 'VP'}</span></td>` : ''}
                                        <td>${AppData.formatCurrency(e.basicSalary || 0)}</td>
                                        <td>${AppData.formatCurrency(e.deliveryAllowance || 0)}</td>
                                        <td>${AppData.formatCurrency(e.completionBonus || 0)}</td>
                                        <td>${AppData.formatCurrency(e.mealAllowance || 0)}</td>
                                        <td>${AppData.formatCurrency(e.phoneAllowance || 0)}</td>
                                        <td>${AppData.formatCurrency(e.clothingAllowance || 0)}</td>
                                        <td>${AppData.formatCurrency(e.transportAllowance || 0)}</td>
                                        <td>${AppData.formatCurrency(e.personalDeduction || 0)}</td>
                                        <td style="text-align:center;">${e.dependents || 0}</td>
                                        <td>
                                            <button class="btn btn-outline" style="padding: 0.2rem 0.5rem;" onclick="app.editEmployee('${e.id}')"><i class="fa-solid fa-pen" style="color:var(--info)"></i></button>
                                            <button class="btn btn-outline" style="padding: 0.2rem 0.5rem;" onclick="app.deleteEmployee('${e.id}')"><i class="fa-solid fa-trash" style="color:var(--accent)"></i></button>
                                        </td>
                                    </tr>
                                `).join('')}
                                ${employees.length === 0 ? `<tr><td colspan="${activeTab === 'all' ? 13 : 12}" style="text-align:center;">Chưa có dữ liệu nhân sự</td></tr>` : ''}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    },

    employeeModal: (e = {}) => {
        const vessels = AppData.getVessels();
        return `
            <div class="modal-header">
                <h3>${e.id ? 'Cập nhật Nhân sự' : 'Thêm Nhân sự'}</h3>
                <button class="modal-close" onclick="app.closeModal('employee-modal')">&times;</button>
            </div>
            <div class="modal-body">
                <form onsubmit="event.preventDefault(); app.saveEmployee('${e.id || ''}');">
                    <div class="grid-2">
                        <div class="form-group"><label class="form-label">Họ và Tên</label><input type="text" class="form-control" id="emp-name" value="${e.name || ''}" required></div>
                        <div class="form-group"><label class="form-label">Điện thoại</label><input type="text" class="form-control" id="emp-phone" value="${e.phone || ''}"></div>
                    </div>
                    <div class="grid-2">
                        <div class="form-group"><label class="form-label">Chức vụ</label><input type="text" class="form-control" id="emp-role" value="${e.role || ''}" required></div>
                        <div class="form-group">
                            <label class="form-label">Bộ phận / Tàu</label>
                            <select class="form-control" id="emp-department">
                                <option value="VP" ${e.department === 'VP' ? 'selected' : ''}>Quản lý (VP)</option>
                                ${vessels.map(v => `<option value="${v.id}" ${e.department === v.id ? 'selected' : ''}>Tàu ${v.name}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                    <div class="grid-2">
                        <div class="form-group"><label class="form-label">Lương cơ bản (VND)</label><input type="text" inputmode="numeric" class="form-control money" id="emp-basic-salary" value="${app.fmtMoney(e.basicSalary || '')}"></div>
                        <div class="form-group"><label class="form-label">Mức lương thực tế (VND)</label><input type="text" inputmode="numeric" class="form-control money" id="emp-actual-salary" value="${app.fmtMoney(e.actualSalary || '')}"></div>
                    </div>
                    <div class="grid-2">
                        <div class="form-group"><label class="form-label">Tiền ăn ca (VND)</label><input type="text" inputmode="numeric" class="form-control money" id="emp-meal-allowance" value="${app.fmtMoney(e.mealAllowance || '')}"></div>
                        <div class="form-group"><label class="form-label">Điện thoại (VND)</label><input type="text" inputmode="numeric" class="form-control money" id="emp-phone-allowance" value="${app.fmtMoney(e.phoneAllowance || '')}"></div>
                    </div>
                    <div class="grid-2">
                        <div class="form-group"><label class="form-label">Phụ cấp trang phục (VND)</label><input type="text" inputmode="numeric" class="form-control money" id="emp-clothing-allowance" value="${app.fmtMoney(e.clothingAllowance || '')}"></div>
                        <div class="form-group"><label class="form-label">Xăng xe, đi lại (VND)</label><input type="text" inputmode="numeric" class="form-control money" id="emp-transport-allowance" value="${app.fmtMoney(e.transportAllowance || '')}"></div>
                    </div>
                    <div class="grid-2">
                        <div class="form-group"><label class="form-label">Giảm trừ bản thân (VND)</label><input type="text" inputmode="numeric" class="form-control money" id="emp-personal-deduction" value="${app.fmtMoney(e.personalDeduction || 15500000)}"></div>
                        <div class="form-group"><label class="form-label">Số lượng NPT</label><input type="number" class="form-control" id="emp-dependents" value="${e.dependents || 0}"></div>
                    </div>
                    <div class="grid-2">
                        <div class="form-group"><label class="form-label">Tiền bảo hiểm (VND)</label><input type="text" inputmode="numeric" class="form-control money" id="emp-insurance" value="${app.fmtMoney(e.insurance || 0)}"></div>
                        <div class="form-group"></div>
                    </div>
                    <div class="grid-2">
                        <div class="form-group"><label class="form-label">Phụ cấp giao nhận (VND)</label><input type="text" inputmode="numeric" class="form-control money" id="emp-delivery-allowance" value="${app.fmtMoney(e.deliveryAllowance || 0)}"></div>
                        <div class="form-group"><label class="form-label">Thưởng hoàn thành CV (VND)</label><input type="text" inputmode="numeric" class="form-control money" id="emp-completion-bonus" value="${app.fmtMoney(e.completionBonus || 0)}"></div>
                    </div>
                    <div class="grid-2">
                        <div class="form-group"><label class="form-label">Ngày vào làm / Nhập tàu</label><input type="date" class="form-control" id="emp-join" value="${e.joinDate || ''}"></div>
                        <div class="form-group"><label class="form-label">Ngày nghỉ (Nếu có)</label><input type="date" class="form-control" id="emp-leave" value="${e.leaveDate || ''}"></div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Ghi chú</label>
                        <textarea class="form-control" id="emp-notes" rows="2">${e.notes || ''}</textarea>
                    </div>
                    <div class="modal-footer"><button type="submit" class="btn btn-primary" style="width:100%;">${e.id ? 'Lưu Thay Đổi' : 'Thêm Nhân Sự'}</button></div>
                </form>
            </div>
        `;
    },

    salary: (month, department, activeTab = 'thucte') => {
        // Defaults
        if (!month) month = new Date().toISOString().substring(0, 7);
        if (!department) department = 'VP';

        const vessels = AppData.getVessels();
        let employees = AppData.getEmployees().filter(e => e.department === department);
        
        // Get or initialize timesheet for this month & department
        let timesheet = AppData.getTimesheet(month, department);
        if (!timesheet) {
            timesheet = {
                month: month,
                department: department,
                attendance: {},
                voyageCount: 0
            };
        }

        // Get days in month
        const [yyyy, mm] = month.split('-');
        const daysInMonth = new Date(yyyy, mm, 0).getDate();

        let headerHTML = `
            <div class="view-section">
                <div class="page-header">
                    <div>
                        <h1 class="page-title">Chấm công & Tính lương</h1>
                        <p class="page-subtitle">Quản lý ngày công và tính lương thực lĩnh hàng tháng</p>
                    </div>
                </div>

                <div class="tabs" style="display:flex; gap:10px; margin-bottom: 20px;">
                    <button class="btn ${activeTab === 'thucte' ? 'btn-primary' : 'btn-outline'}" onclick="app.salaryTab = 'thucte'; app.loadSalaryView()">Lương Thực Tế</button>
                    <button class="btn ${activeTab === 'chungtu' ? 'btn-primary' : 'btn-outline'}" onclick="app.salaryTab = 'chungtu'; app.loadSalaryView()">Lương Chứng Từ</button>
                </div>

                <div class="glass-card" style="margin-bottom: 1.5rem; padding: 1.5rem; display: flex; gap: 1rem; align-items: center; flex-wrap: wrap;">
                    <div class="form-group" style="margin: 0; min-width: 200px;">
                        <label class="form-label">Chọn tháng</label>
                        <input type="month" class="form-control" id="sal-month" value="${month}" onchange="app.loadSalaryView()">
                    </div>
                    <div class="form-group" style="margin: 0; min-width: 200px;">
                        <label class="form-label">Chọn Tàu / Bộ phận</label>
                        <select class="form-control" id="sal-department" onchange="app.loadSalaryView()">
                            <option value="VP" ${department === 'VP' ? 'selected' : ''}>Quản lý (VP)</option>
                            ${vessels.map(v => `<option value="${v.id}" ${department === v.id ? 'selected' : ''}>Tàu ${v.name}</option>`).join('')}
                        </select>
                    </div>
                    ${activeTab === 'chungtu' ? `
                    <div class="form-group" style="margin: 0; min-width: 150px;">
                        <label class="form-label">Số chuyến trong tháng</label>
                        <input type="number" class="form-control" id="sal-voyage-count" value="${timesheet.voyageCount || 0}" onchange="app.updateVoyageCount()">
                    </div>
                    ` : ''}
                </div>
        `;

        if (activeTab === 'thucte') {
            // Calculate columns for days
            let daysHeader = '';
            for (let i = 1; i <= daysInMonth; i++) {
                daysHeader += `<th style="width:25px; padding:0.25rem; text-align:center; font-size:0.75rem;">${i}</th>`;
            }

            let totalActual = 0;
            let totalInsurance = 0;
            let totalPayment = 0;

            let tableHTML = `
                <div class="glass-card" style="overflow-x: auto;">
                    <div class="table-container">
                        <table class="table" style="min-width: 1200px;">
                            <thead>
                                <tr>
                                    <th style="min-width: 150px; position: sticky; left: 0; z-index: 2; background: var(--bg-card);">Nhân sự</th>
                                    ${daysHeader}
                                    <th style="text-align:center;">Số công</th>
                                    <th style="text-align:right;">Mức lương thực tế</th>
                                    <th style="text-align:right;">Bảo hiểm</th>
                                    <th style="text-align:right; color:var(--success);">Thực lĩnh</th>
                                </tr>
                            </thead>
                            <tbody>
            `;

            tableHTML += employees.map(e => {
                // Make sure attendance array exists for employee
                if (!timesheet.attendance[e.id]) {
                    // Default: all days ticked
                    timesheet.attendance[e.id] = Array(daysInMonth).fill(true);
                } else {
                    // Adjust array length if month changes (e.g. 30 vs 31 days)
                    while(timesheet.attendance[e.id].length < daysInMonth) timesheet.attendance[e.id].push(true);
                    if (timesheet.attendance[e.id].length > daysInMonth) timesheet.attendance[e.id] = timesheet.attendance[e.id].slice(0, daysInMonth);
                }

                const att = timesheet.attendance[e.id];
                const workingDays = att.filter(Boolean).length;
                const actual = Number(e.actualSalary) || 0;
                const insurance = Number(e.insurance) || 0;
                
                // Calculate formula
                const payment = Math.round((actual / daysInMonth) * workingDays - insurance);

                totalActual += actual;
                totalInsurance += insurance;
                totalPayment += payment;

                let daysCells = '';
                for (let i = 0; i < daysInMonth; i++) {
                    const isChecked = att[i] ? 'checked' : '';
                    daysCells += `
                        <td style="padding:0.25rem; text-align:center;">
                            <input type="checkbox" ${isChecked} style="cursor:pointer;" onchange="app.toggleAttendanceDay('${e.id}', ${i}, this.checked)">
                        </td>
                    `;
                }

                return `
                    <tr>
                        <td style="position: sticky; left: 0; z-index: 1; background: var(--bg-card);">
                            <strong>${e.name}</strong><br>
                            <small style="color:var(--text-muted)">${e.role || ''}</small>
                        </td>
                        ${daysCells}
                        <td style="text-align:center; font-weight:600; color:var(--info);">${workingDays}</td>
                        <td style="text-align:right;">${AppData.formatCurrency(actual)}</td>
                        <td style="text-align:right; color:var(--rose-light);">${AppData.formatCurrency(insurance)}</td>
                        <td style="text-align:right; font-weight:700; color:var(--success);">${AppData.formatCurrency(payment)}</td>
                    </tr>
                `;
            }).join('');

            if (employees.length > 0) {
                tableHTML += `
                                <tr>
                                    <td style="position: sticky; left: 0; z-index: 1; background: var(--bg-card); font-weight: 700; text-transform: uppercase;">Tổng cộng</td>
                                    <td colspan="${daysInMonth + 1}" style="background: rgba(255, 255, 255, 0.03);"></td>
                                    <td style="text-align:right; font-weight:700; color:var(--info); background: rgba(255, 255, 255, 0.03);">${AppData.formatCurrency(totalActual)}</td>
                                    <td style="text-align:right; font-weight:700; color:var(--rose-light); background: rgba(255, 255, 255, 0.03);">${AppData.formatCurrency(totalInsurance)}</td>
                                    <td style="text-align:right; font-weight:700; color:var(--success); background: rgba(255, 255, 255, 0.03);">${AppData.formatCurrency(totalPayment)}</td>
                                </tr>
                `;
            } else {
                tableHTML += `<tr><td colspan="${daysInMonth + 5}" style="text-align:center; padding: 2rem;">Không có nhân sự nào trong bộ phận này</td></tr>`;
            }

            tableHTML += `
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            `;
            
            return headerHTML + tableHTML;
        } else {
            // Render Documented Salary Table
            const calcTax = (income) => {
                if (income <= 0) return 0;
                if (income <= 5000000) return income * 0.05;
                if (income <= 10000000) return (5000000 * 0.05) + ((income - 5000000) * 0.1);
                if (income <= 18000000) return (5000000 * 0.05) + (5000000 * 0.1) + ((income - 10000000) * 0.15);
                if (income <= 32000000) return (5000000 * 0.05) + (5000000 * 0.1) + (8000000 * 0.15) + ((income - 18000000) * 0.2);
                if (income <= 52000000) return (5000000 * 0.05) + (5000000 * 0.1) + (8000000 * 0.15) + (14000000 * 0.2) + ((income - 32000000) * 0.25);
                if (income <= 80000000) return (5000000 * 0.05) + (5000000 * 0.1) + (8000000 * 0.15) + (14000000 * 0.2) + (20000000 * 0.25) + ((income - 52000000) * 0.3);
                return (5000000 * 0.05) + (5000000 * 0.1) + (8000000 * 0.15) + (14000000 * 0.2) + (20000000 * 0.25) + (28000000 * 0.3) + ((income - 80000000) * 0.35);
            };

            const voyageCount = Number(timesheet.voyageCount) || 0;

            let docTableHTML = `
                <div class="glass-card" style="overflow-x: auto;">
                    <div class="table-container">
                        <table class="table" style="min-width: 2500px; font-size: 0.8rem;">
                            <thead>
                                <tr>
                                    <th rowspan="2" style="position: sticky; left: 0; z-index: 3; background: var(--bg-card); min-width: 50px;">STT</th>
                                    <th rowspan="2" style="position: sticky; left: 50px; z-index: 3; background: var(--bg-card); min-width: 150px;">Họ và tên</th>
                                    <th rowspan="2" style="position: sticky; left: 200px; z-index: 3; background: var(--bg-card); min-width: 100px;">Chức vụ</th>
                                    <th rowspan="2">Lương cơ bản</th>
                                    <th colspan="4" style="text-align: center;">Hỗ trợ</th>
                                    <th rowspan="2">Phụ cấp giao nhận</th>
                                    <th rowspan="2">Thưởng HT CV</th>
                                    <th rowspan="2" style="color:var(--info);">Tổng lương thực tế</th>
                                    <th rowspan="2">Thu nhập chịu thuế</th>
                                    <th rowspan="2">Giảm trừ bản thân</th>
                                    <th rowspan="2">Số NPT</th>
                                    <th rowspan="2">Giảm trừ NPT</th>
                                    <th rowspan="2">Mức lương đóng BHXH</th>
                                    <th colspan="4" style="text-align: center;">Trích vào CP DN</th>
                                    <th colspan="4" style="text-align: center;">Trích vào lương NV</th>
                                    <th rowspan="2">Thu nhập tính thuế</th>
                                    <th rowspan="2">Thuế TNCN phải nộp</th>
                                    <th rowspan="2" style="color:var(--success);">Lương còn lại</th>
                                </tr>
                                <tr>
                                    <th>Tiền ăn ca</th>
                                    <th>Điện thoại</th>
                                    <th>Trang phục</th>
                                    <th>Xăng xe, đi lại</th>
                                    <th>BHXH (17.5%)</th>
                                    <th>BHYT (3%)</th>
                                    <th>BHTN (1%)</th>
                                    <th>Cộng</th>
                                    <th>BHXH (8%)</th>
                                    <th>BHYT (1.5%)</th>
                                    <th>BHTN (1%)</th>
                                    <th>Cộng</th>
                                </tr>
                            </thead>
                            <tbody>
            `;

            let sumActualTotal = 0;
            let sumRemaining = 0;

            employees.forEach((e, idx) => {
                const basic = Number(e.basicSalary) || 0;
                const meal = Number(e.mealAllowance) || 0;
                const phone = Number(e.phoneAllowance) || 0;
                const clothing = Number(e.clothingAllowance) || 0;
                const transport = Number(e.transportAllowance) || 0;
                const delivery = (Number(e.deliveryAllowance) || 0) * voyageCount;
                const bonus = (Number(e.completionBonus) || 0) * voyageCount;

                const actualTotal = basic + meal + phone + clothing + transport + delivery + bonus;
                // Income subject to tax: actual total - non-taxable allowances (transport is NOT deducted here per business rule)
                const taxableIncome = Math.max(0, actualTotal - meal - phone - clothing);
                
                const personalDeduction = Number(e.personalDeduction) || 15500000;
                const dependents = Number(e.dependents) || 0;
                const dependentDeduction = dependents * 6200000;

                const insuranceBase = Number(e.insurance) || 0;

                // DN
                const dnBhxh = insuranceBase * 0.175;
                const dnBhyt = insuranceBase * 0.03;
                const dnBhtn = insuranceBase * 0.01;
                const dnTotal = dnBhxh + dnBhyt + dnBhtn;

                // NV
                const nvBhxh = insuranceBase * 0.08;
                const nvBhyt = insuranceBase * 0.015;
                const nvBhtn = insuranceBase * 0.01;
                const nvTotal = nvBhxh + nvBhyt + nvBhtn;

                // Tax calculation
                const assessableIncome = Math.max(0, taxableIncome - personalDeduction - dependentDeduction - nvTotal);
                const tax = calcTax(assessableIncome);

                // Remaining
                const remaining = actualTotal - nvTotal - tax;

                sumActualTotal += actualTotal;
                sumRemaining += remaining;

                docTableHTML += `
                    <tr>
                        <td style="position: sticky; left: 0; z-index: 2; background: var(--bg-card);">${idx + 1}</td>
                        <td style="position: sticky; left: 50px; z-index: 2; background: var(--bg-card);"><strong>${e.name}</strong></td>
                        <td style="position: sticky; left: 200px; z-index: 2; background: var(--bg-card);">${e.role || ''}</td>
                        <td style="text-align:right;">${AppData.formatCurrency(basic)}</td>
                        <td style="text-align:right;">${AppData.formatCurrency(meal)}</td>
                        <td style="text-align:right;">${AppData.formatCurrency(phone)}</td>
                        <td style="text-align:right;">${AppData.formatCurrency(clothing)}</td>
                        <td style="text-align:right;">${AppData.formatCurrency(transport)}</td>
                        <td style="text-align:right;">${AppData.formatCurrency(delivery)}</td>
                        <td style="text-align:right;">${AppData.formatCurrency(bonus)}</td>
                        <td style="text-align:right; font-weight:700; color:var(--info);">${AppData.formatCurrency(actualTotal)}</td>
                        <td style="text-align:right;">${AppData.formatCurrency(taxableIncome)}</td>
                        <td style="text-align:right;">${AppData.formatCurrency(personalDeduction)}</td>
                        <td style="text-align:center;">${dependents}</td>
                        <td style="text-align:right;">${AppData.formatCurrency(dependentDeduction)}</td>
                        <td style="text-align:right;">${AppData.formatCurrency(insuranceBase)}</td>
                        <td style="text-align:right;">${AppData.formatCurrency(dnBhxh)}</td>
                        <td style="text-align:right;">${AppData.formatCurrency(dnBhyt)}</td>
                        <td style="text-align:right;">${AppData.formatCurrency(dnBhtn)}</td>
                        <td style="text-align:right;">${AppData.formatCurrency(dnTotal)}</td>
                        <td style="text-align:right;">${AppData.formatCurrency(nvBhxh)}</td>
                        <td style="text-align:right;">${AppData.formatCurrency(nvBhyt)}</td>
                        <td style="text-align:right;">${AppData.formatCurrency(nvBhtn)}</td>
                        <td style="text-align:right;">${AppData.formatCurrency(nvTotal)}</td>
                        <td style="text-align:right;">${AppData.formatCurrency(assessableIncome)}</td>
                        <td style="text-align:right;">${AppData.formatCurrency(tax)}</td>
                        <td style="text-align:right; font-weight:700; color:var(--success);">${AppData.formatCurrency(remaining)}</td>
                    </tr>
                `;
            });

            if (employees.length === 0) {
                docTableHTML += `<tr><td colspan="27" style="text-align:center; padding: 2rem;">Không có nhân sự nào trong bộ phận này</td></tr>`;
            }

            docTableHTML += `
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            `;

            return headerHTML + docTableHTML;
        }
    },

    company: () => {
        const c = AppData.getCompany();
        return `
            <div class="view-section">
                <div class="page-header"><div><h1 class="page-title">Master Data</h1><p class="page-subtitle">Thông tin công ty và quản lý đội tàu</p></div></div>
                <div class="grid-2">
                    <div class="glass-card">
                        <h3>Thông tin Công ty</h3>
                        <form onsubmit="event.preventDefault(); app.saveCompany();" style="margin-top:1rem;">
                            <div class="form-group"><label class="form-label">Tên công ty</label><input type="text" class="form-control" id="c-name" value="${c.name}"></div>
                            <div class="form-group"><label class="form-label">Địa chỉ</label><input type="text" class="form-control" id="c-addr" value="${c.address}"></div>
                            <div class="form-group"><label class="form-label">Mã số thuế</label><input type="text" class="form-control" id="c-tax" value="${c.taxId}"></div>
                            <div class="form-group"><label class="form-label">Ngân hàng</label><textarea class="form-control" id="c-bank">${c.bankInfo}</textarea></div>
                            
                            <h4 style="margin: 1.5rem 0 1rem; color: var(--primary-light);">Số dư đầu kỳ</h4>
                            <div class="grid-2">
                                <div class="form-group"><label class="form-label">ABbank</label><input type="text" inputmode="numeric" class="form-control money" id="bal-abbank" value="${app.fmtMoney((c.openingBalances && c.openingBalances['ABbank']) || 0)}"></div>
                                <div class="form-group"><label class="form-label">Viettinbank</label><input type="text" inputmode="numeric" class="form-control money" id="bal-viettin" value="${app.fmtMoney((c.openingBalances && c.openingBalances['Viettinbank']) || 0)}"></div>
                            </div>
                            <div class="grid-2">
                                <div class="form-group"><label class="form-label">Cá nhân</label><input type="text" inputmode="numeric" class="form-control money" id="bal-ca-nhan" value="${app.fmtMoney((c.openingBalances && c.openingBalances['Tài khoản cá nhân']) || 0)}"></div>
                                <div class="form-group"><label class="form-label">Tiền mặt</label><input type="text" inputmode="numeric" class="form-control money" id="bal-tien-mat" value="${app.fmtMoney((c.openingBalances && c.openingBalances['Tiền mặt']) || 0)}"></div>
                            </div>
                            
                            <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: 1rem;">Cập nhật hồ sơ & Số dư</button>
                        </form>
                    </div>
                    <div class="glass-card">
                        <h3>Danh sách Tàu & Thuyền trưởng</h3>
                        <div class="table-container" style="margin-top:1rem;">
                            <table class="table">
                                <thead>
                                    <tr>
                                        <th>Tên tàu</th>
                                        <th>Tải trọng</th>
                                        <th>Thuyền trưởng & SĐT</th>
                                        <th>Quản lý & SĐT</th>
                                        <th>Định mức</th>
                                        <th>Thao tác</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${AppData.state.vessels.map(v => `
                                        <tr>
                                            <td><strong>${esc(v.name)}</strong></td>
                                            <td><span class="badge badge-success" style="font-weight:600;">${v.capacity ? (Number(v.capacity).toLocaleString('vi-VN') + ' tấn') : '---'}</span></td>
                                            <td>
                                                <strong>${esc(v.captain) || '---'}</strong>
                                                ${v.captainPhone ? `<br><small style="color:var(--text-muted)"><i class="fa-solid fa-phone"></i> ${esc(v.captainPhone)}</small>` : ''}
                                            </td>
                                            <td>
                                                <strong>${esc(v.manager) || '---'}</strong>
                                                ${v.managerPhone ? `<br><small style="color:var(--text-muted)"><i class="fa-solid fa-phone"></i> ${esc(v.managerPhone)}</small>` : ''}
                                            </td>
                                            <td><span class="badge badge-outline">${Math.round(v.fuelRate)} L/h</span></td>
                                            <td>
                                                <button class="btn btn-outline" style="padding: 0.2rem 0.5rem;" onclick="app.editVessel('${v.id}')" title="Sửa thông tin tàu"><i class="fa-solid fa-pen" style="color:var(--info)"></i></button>
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    ${(typeof window !== 'undefined' && window.SM_USER && window.SM_USER.role === 'owner') ? `
                    <div class="glass-card" style="margin-top: 1.5rem; grid-column: span 2; border: 1px solid var(--primary-light);">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 10px;">
                            <h3 style="margin: 0;"><i class="fa-solid fa-users-gear" style="color: var(--primary-light);"></i> Quản lý Người dùng & Phân quyền</h3>
                        </div>
                        <div id="members-panel"><p style="color: var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Đang tải danh sách người dùng...</p></div>
                    </div>` : ''}

                    ${(typeof window !== 'undefined' && window.SM_USER && window.SM_USER.role === 'owner') ? `
                    <div class="glass-card" style="margin-top: 1.5rem; grid-column: span 2;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 10px;">
                            <h3 style="margin: 0;"><i class="fa-solid fa-clock-rotate-left" style="color: var(--warning);"></i> Nhật ký thay đổi tài chính</h3>
                        </div>
                        <div id="audit-panel"><p style="color: var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Đang tải nhật ký...</p></div>
                    </div>` : ''}

                    <div class="glass-card" style="margin-top: 1.5rem; grid-column: span 2; border: 1px solid var(--secondary);">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 10px;">
                            <h3 style="margin: 0;"><i class="fa-solid fa-shield-halved" style="color: var(--secondary);"></i> Sao lưu & Khôi phục JSON <span class="badge badge-success" style="font-size:0.7rem;">Chuẩn nhất</span></h3>
                            <div style="display: flex; gap: 10px; align-items: center;">
                                <button class="btn btn-primary" onclick="app.exportLocalJSON()" style="padding: 0.4rem 0.8rem; font-size: 0.85rem;">
                                    <i class="fa-solid fa-download"></i> Tải Backup JSON
                                </button>
                                <div style="position: relative; overflow: hidden; display: inline-block;">
                                    <button class="btn btn-outline" style="padding: 0.4rem 0.8rem; font-size: 0.85rem; border-color: var(--secondary);">
                                        <i class="fa-solid fa-upload"></i> Khôi phục từ JSON
                                    </button>
                                    <input type="file" accept=".json" onchange="app.importLocalJSON(event)" style="position: absolute; font-size: 100px; opacity: 0; right: 0; top: 0; cursor: pointer;">
                                </div>
                            </div>
                        </div>
                        <p style="font-size: 0.85rem; color: var(--text-muted); margin: 0 0 1rem;">
                            <i class="fa-solid fa-circle-info"></i> Backup JSON sao chép <strong>nguyên vẹn 100%</strong> toàn bộ dữ liệu (không mất mát như Excel). Khuyến nghị tải backup JSON <strong>trước mỗi lần</strong> thử nghiệm hoặc khôi phục dữ liệu.
                        </p>
                        <div style="border-top: 1px dashed var(--border-color); padding-top: 1rem;">
                            <label class="form-label" style="font-weight: 600;"><i class="fa-solid fa-clock-rotate-left" style="color: var(--info);"></i> Ảnh chụp tự động (mỗi ngày 1 ảnh, giữ 3 ảnh gần nhất)</label>
                            ${(() => {
                                const backups = app.listAutoBackups().slice().reverse();
                                if (backups.length === 0) return '<p style="font-size: 0.8rem; color: var(--text-muted); margin: 0.5rem 0 0;">Chưa có ảnh chụp nào (sẽ tự tạo khi bạn mở app mỗi ngày).</p>';
                                return '<div style="display:flex; flex-wrap:wrap; gap:8px; margin-top:0.5rem;">' + backups.map(b => {
                                    const sizeKB = Math.round((b.data ? b.data.length : 0) / 1024);
                                    return `<button class="btn btn-outline" style="padding:0.35rem 0.7rem; font-size:0.8rem;" onclick="app.restoreAutoBackup('${b.date}')" title="Khôi phục về ${b.date}">
                                        <i class="fa-solid fa-rotate-left" style="color:var(--info);"></i> ${b.date} <small style="opacity:0.6;">(${sizeKB} KB)</small>
                                    </button>`;
                                }).join('') + '</div>';
                            })()}
                        </div>
                    </div>

                    <div class="glass-card" style="margin-top: 1.5rem; grid-column: span 2;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 10px;">
                            <h3 style="margin: 0;">Sao lưu & Khôi phục Dữ liệu (Excel)</h3>
                            <div style="display: flex; gap: 10px; align-items: center;">
                                <button class="btn btn-primary" onclick="app.exportSystemBackup()" style="padding: 0.4rem 0.8rem; font-size: 0.85rem;">
                                    <i class="fa-solid fa-cloud-arrow-down"></i> Tải File Backup (Tất cả)
                                </button>
                                <div style="position: relative; overflow: hidden; display: inline-block;">
                                    <button class="btn btn-outline" style="padding: 0.4rem 0.8rem; font-size: 0.85rem;">
                                        <i class="fa-solid fa-cloud-arrow-up"></i> Khôi phục Toàn bộ
                                    </button>
                                    <input type="file" accept=".xlsx, .xls" onchange="app.importSystemBackupExcel(event)" style="position: absolute; font-size: 100px; opacity: 0; right: 0; top: 0; cursor: pointer;">
                                </div>
                            </div>
                        </div>
                        <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 1.5rem;">
                            Hệ thống hỗ trợ tải xuống toàn bộ dữ liệu chỉ trong 1 file Excel (gồm nhiều sheet). Bạn có thể khôi phục nhanh bằng cách tải lại file backup này hoặc từng phần riêng biệt bên dưới.
                        </p>
                        <div style="display: flex; gap: 1.5rem; flex-wrap: wrap;">
                            <div style="flex: 1; min-width: 200px; background: rgba(255,255,255,0.02); padding: 1.2rem; border-radius: var(--radius-md); border: 1px dashed var(--border-color);">
                                <label class="form-label" style="font-weight: bold; color: var(--info);"><i class="fa-solid fa-file-import"></i> Khôi phục Chuyến Hàng</label>
                                <input type="file" id="import-shipments-file" accept=".xlsx, .xls" class="form-control" style="font-size: 0.8rem; padding: 6px;" onchange="app.importShipmentsExcel(event)">
                            </div>
                            <div style="flex: 1; min-width: 200px; background: rgba(255,255,255,0.02); padding: 1.2rem; border-radius: var(--radius-md); border: 1px dashed var(--border-color);">
                                <label class="form-label" style="font-weight: bold; color: var(--warning);"><i class="fa-solid fa-file-import"></i> Khôi phục Báo Cáo Dầu</label>
                                <input type="file" id="import-fuel-file" accept=".xlsx, .xls" class="form-control" style="font-size: 0.8rem; padding: 6px;" onchange="app.importFuelExcel(event)">
                            </div>
                            <div style="flex: 1; min-width: 200px; background: rgba(255,255,255,0.02); padding: 1.2rem; border-radius: var(--radius-md); border: 1px dashed var(--border-color);">
                                <label class="form-label" style="font-weight: bold; color: var(--secondary);"><i class="fa-solid fa-file-import"></i> Khôi phục Giao dịch Thu/Chi</label>
                                <input type="file" id="import-transactions-file" accept=".xlsx, .xls" class="form-control" style="font-size: 0.8rem; padding: 6px;" onchange="app.importTransactionsExcel(event)">
                            </div>
                            <div style="flex: 1; min-width: 200px; background: rgba(255,255,255,0.02); padding: 1.2rem; border-radius: var(--radius-md); border: 1px dashed var(--border-color);">
                                <label class="form-label" style="font-weight: bold; color: var(--accent);"><i class="fa-solid fa-file-import"></i> Khôi phục Chi phí Tàu</label>
                                <input type="file" id="import-vessel-expenses-file" accept=".xlsx, .xls" class="form-control" style="font-size: 0.8rem; padding: 6px;" onchange="app.importVesselExpensesExcel(event)">
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    debts: (currentTab = 'customer') => {
        // Helper to normalize names
        const normalizeName = (name) => {
            if (!name) return '';
            return name.normalize('NFC').trim().replace(/\s+/g, ' ');
        };

        // Helper to remove accents for robust matching
        const removeAccents = (str) => {
            if (!str) return '';
            return str.normalize('NFD')
                      .replace(/[\u0300-\u036f]/g, '')
                      .replace(/[đĐ]/g, 'd')
                      .toLowerCase();
        };

        // Helper to smart match customer (accents insensitive)
        const matchCustomer = (t, customerName) => {
            const normPartner = removeAccents(t.partner);
            const normCust = removeAccents(customerName);
            if (normPartner && (normPartner === normCust || normPartner.includes(normCust) || normCust.includes(normPartner))) {
                return true;
            }
            const normContent = removeAccents(t.content);
            if (normContent && (normContent.includes(normCust) || normContent.includes(removeAccents(customerName)))) {
                return true;
            }
            return false;
        };

        let content = '';

        if (currentTab === 'customer') {
            const shipments = AppData.getShipments();
            const transactions = AppData.getTransactions();

            // 1. Get all unique customer names from shipments only
            const customerNamesSet = new Set();
            shipments.forEach(s => {
                if (s.customer) {
                    customerNamesSet.add(normalizeName(s.customer));
                }
            });

            const customerNames = Array.from(customerNamesSet).sort();

            // If no selected customer yet, pick the first one by default
            if (!app.selectedDebtCustomer && customerNames.length > 0) {
                app.selectedDebtCustomer = customerNames[0];
            }

            // 2. Compute details for each customer
            const customersDebtData = customerNames.map(custName => {
                const custShipments = shipments.filter(s => normalizeName(s.customer) === custName);
                
                // Transactions matching this customer
                const custTrans = transactions.filter(t => matchCustomer(t, custName));

                // Shipments summary
                let totalRealRevenue = 0;
                let totalInvoiceRevenue = 0;
                let totalRefundAmount = 0;
                custShipments.forEach(s => {
                    totalRealRevenue += Number(s.revenueReal) || 0;
                    totalInvoiceRevenue += Number(s.revenueInvoice) || 0;
                    totalRefundAmount += Number(s.refundAmount) || 0;
                });

                // Payments received (thu) and paid out (chi) from transactions
                let totalPaid = 0;
                let totalReturned = 0;
                custTrans.forEach(t => {
                    if (t.category === 'CVC') {
                        totalPaid += Number(t.thu) || 0;
                        totalReturned += Number(t.chi) || 0;
                    }
                });

                // Calculations
                const openingDebt = AppData.state.company.customerOpeningDebts ? (Number(AppData.state.company.customerOpeningDebts[custName]) || 0) : 0;
                const invoiceDebt = openingDebt + totalInvoiceRevenue - totalPaid;
                const unpaidRefund = totalRefundAmount - totalReturned;
                const netReceived = totalPaid - totalReturned;
                const actualDebt = openingDebt + totalRealRevenue - netReceived;

                return {
                    name: custName,
                    shipmentsCount: custShipments.length,
                    openingDebt,
                    totalRealRevenue,
                    totalInvoiceRevenue,
                    totalRefundAmount,
                    totalPaid,
                    totalReturned,
                    invoiceDebt,
                    unpaidRefund,
                    netReceived,
                    actualDebt,
                    shipments: custShipments,
                    transactions: custTrans
                };
            });

            // Compute system-wide totals
            let sysTotalReal = 0;
            let sysTotalInvoice = 0;
            let sysTotalRefund = 0;
            let sysTotalPaid = 0;
            let sysTotalReturned = 0;
            let sysTotalOpeningDebt = 0;
            customersDebtData.forEach(c => {
                sysTotalReal += c.totalRealRevenue;
                sysTotalInvoice += c.totalInvoiceRevenue;
                sysTotalRefund += c.totalRefundAmount;
                sysTotalPaid += c.totalPaid;
                sysTotalReturned += c.totalReturned;
                sysTotalOpeningDebt += c.openingDebt;
            });
            const sysInvoiceDebt = sysTotalOpeningDebt + sysTotalInvoice - sysTotalPaid;
            const sysUnpaidRefund = sysTotalRefund - sysTotalReturned;
            const sysNetReceived = sysTotalPaid - sysTotalReturned;
            const sysActualDebt = sysTotalOpeningDebt + sysTotalReal - sysNetReceived;

            // Get details of the currently selected customer
            const selectedData = customersDebtData.find(c => c.name === app.selectedDebtCustomer) || customersDebtData[0] || {
                name: '', shipmentsCount: 0, openingDebt: 0, totalRealRevenue: 0, totalInvoiceRevenue: 0, totalRefundAmount: 0,
                totalPaid: 0, totalReturned: 0, invoiceDebt: 0, unpaidRefund: 0, actualDebt: 0, shipments: [], transactions: []
            };

            // Compute monthly breakdown for selected customer
            const monthlyBreakdown = {};
            // Group shipments by month
            selectedData.shipments.forEach(s => {
                const date = s.dateStart || s.dateEnd || '';
                const m = date.substring(0, 7);
                if (!m) return;
                if (!monthlyBreakdown[m]) {
                    monthlyBreakdown[m] = { realRev: 0, invRev: 0, refund: 0, paid: 0, returned: 0 };
                }
                monthlyBreakdown[m].realRev += Number(s.revenueReal) || 0;
                monthlyBreakdown[m].invRev += Number(s.revenueInvoice) || 0;
                monthlyBreakdown[m].refund += Number(s.refundAmount) || 0;
            });

            // Group transactions by month
            selectedData.transactions.forEach(t => {
                if (t.category !== 'CVC') return;
                const date = t.date || '';
                const m = date.substring(0, 7);
                if (!m) return;
                if (!monthlyBreakdown[m]) {
                    monthlyBreakdown[m] = { realRev: 0, invRev: 0, refund: 0, paid: 0, returned: 0 };
                }
                monthlyBreakdown[m].paid += Number(t.thu) || 0;
                monthlyBreakdown[m].returned += Number(t.chi) || 0;
            });

            const sortedMonths = Object.keys(monthlyBreakdown).sort((a, b) => b.localeCompare(a));

            content = `
                <!-- Global Summary Cards -->
                <div class="grid-4" style="margin-bottom: 2.5rem;">
                    <div class="glass-card stat-card" style="border-left: 4px solid var(--info);">
                        <span class="stat-label">Tổng Doanh Thu Hoá Đơn</span>
                        <div class="stat-value" style="font-size: 1.6rem; color: var(--info);">${AppData.formatCurrency(sysTotalInvoice)}</div>
                        <div class="stat-label" style="font-size: 0.8rem; margin-top: 4px;">Tổng phát sinh hoá đơn</div>
                    </div>
                    <div class="glass-card stat-card" style="border-left: 4px solid #f59e0b;">
                        <span class="stat-label">Tổng Khách Hàng Đã Trả</span>
                        <div class="stat-value" style="font-size: 1.6rem; color: #f59e0b;">${AppData.formatCurrency(sysTotalPaid)}</div>
                        <div class="stat-label" style="font-size: 0.8rem; margin-top: 4px;">Đã trả lại ĐT (Chi): ${AppData.formatCurrency(sysTotalReturned)}</div>
                    </div>
                    <div class="glass-card stat-card" style="border-left: 4px solid var(--accent);">
                        <span class="stat-label">Tổng Công Nợ Phải Thu</span>
                        <div class="stat-value" style="font-size: 1.6rem; color: var(--accent);">${AppData.formatCurrency(sysInvoiceDebt)}</div>
                        <div class="stat-label" style="font-size: 0.8rem; margin-top: 4px;">Đầu kỳ: ${AppData.formatCurrency(sysTotalOpeningDebt)}</div>
                    </div>
                    <div class="glass-card stat-card" style="border-left: 4px solid var(--warning);">
                        <span class="stat-label">Quỹ Tiền Gửi Còn Lại</span>
                        <div class="stat-value" style="font-size: 1.6rem; color: var(--warning);">${AppData.formatCurrency(sysUnpaidRefund)}</div>
                        <div class="stat-label" style="font-size: 0.8rem; margin-top: 4px;">Tổng TG phát sinh: ${AppData.formatCurrency(sysTotalRefund)}</div>
                    </div>
                </div>

                <!-- Customer Cards Grid -->
                <div style="margin-bottom: 2rem;">
                    <h3 style="margin-bottom: 1rem;"><i class="fa-solid fa-users" style="color:var(--primary-light); margin-right: 0.5rem;"></i>Danh sách Khách hàng</h3>
                    <div class="grid-4" style="gap: 1rem;">
                        ${customersDebtData.map(cust => {
                            const isSelected = cust.name === selectedData.name;
                            let badgeClass = 'badge-success';
                            let debtStatusText = 'Hoàn thành';
                            if (cust.actualDebt > 100000000) {
                                badgeClass = 'badge-danger';
                                debtStatusText = 'Nợ cao';
                            } else if (cust.actualDebt > 0) {
                                badgeClass = 'badge-warning';
                                debtStatusText = 'Có nợ';
                            }
                            
                            return `
                                <div class="glass-card ${isSelected ? 'active-card' : ''}" 
                                     onclick="app.changeDebtCustomer('${cust.name}')" 
                                     style="cursor: pointer; position: relative; border: ${isSelected ? '2px solid var(--primary-light)' : '1px solid rgba(255,255,255,0.05)'}; padding: 1.2rem; transition: all 0.2s;">
                                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem;">
                                        <h4 style="margin: 0; font-size: 1.1rem; color: ${isSelected ? 'var(--primary-light)' : 'var(--text-main)'};">${cust.name}</h4>
                                        <span class="badge ${badgeClass}" style="font-size: 0.7rem; padding: 2px 6px;">${debtStatusText}</span>
                                    </div>
                                    <div style="font-size: 0.85rem; color: var(--text-muted); display: grid; grid-template-columns: 1fr 1fr; gap: 4px;">
                                        <div>Số chuyến:</div>
                                        <div style="text-align: right; font-weight: bold; color: var(--text-main);">${cust.shipmentsCount}</div>
                                        
                                        <div>DT thực tế:</div>
                                        <div style="text-align: right; font-weight: 600; color: var(--text-muted);">${(cust.totalRealRevenue / 1e6).toFixed(1)}M</div>

                                        <div>Đã trả (Thu):</div>
                                        <div style="text-align: right; font-weight: 600; color: var(--secondary);">${(cust.totalPaid / 1e6).toFixed(1)}M</div>
                                        
                                        <div>Tiền gửi dư:</div>
                                        <div style="text-align: right; font-weight: 600; color: var(--warning);">${(cust.unpaidRefund / 1e6).toFixed(1)}M</div>

                                        <div style="border-top: 1px solid rgba(255,255,255,0.05); margin-top: 4px; padding-top: 4px; font-weight: bold;">Công nợ:</div>
                                        <div style="border-top: 1px solid rgba(255,255,255,0.05); margin-top: 4px; padding-top: 4px; text-align: right; font-weight: bold; color: var(--accent);">${(cust.invoiceDebt / 1e6).toFixed(1)}M</div>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                        ${(() => {
                            const hq = customersDebtData.find(c => c.name.toLowerCase().includes('hoàng quyên'));
                            const na = customersDebtData.find(c => c.name.toLowerCase().includes('ngọc anh'));
                            if (hq || na) {
                                const combinedCount = (hq?.shipmentsCount || 0) + (na?.shipmentsCount || 0);
                                const combinedPaid = (hq?.totalPaid || 0) + (na?.totalPaid || 0);
                                const combinedRefund = (hq?.unpaidRefund || 0) + (na?.unpaidRefund || 0);
                                const combinedDebt = (hq?.invoiceDebt || 0) + (na?.invoiceDebt || 0);
                                const combinedRealRev = (hq?.totalRealRevenue || 0) + (na?.totalRealRevenue || 0);
                                return `
                                    <div class="glass-card" style="grid-column: span 2; border: 2px dashed rgba(255, 255, 255, 0.2); padding: 1.2rem; background: rgba(14, 165, 233, 0.05);">
                                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem;">
                                            <h4 style="margin: 0; font-size: 1.1rem; color: var(--info);">Tổng hợp Ngọc Anh + Hoàng Quyên</h4>
                                            <span class="badge badge-info" style="font-size: 0.7rem; padding: 2px 6px;">Tổng hợp chung</span>
                                        </div>
                                        <div style="font-size: 0.85rem; color: var(--text-muted); display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 8px; align-items: center;">
                                            <div>Số chuyến:</div>
                                            <div style="font-weight: bold; color: var(--text-main); font-size: 1rem;">${combinedCount}</div>
                                            
                                            <div style="text-align: right;">DT thực tế:</div>
                                            <div style="text-align: right; font-weight: 600; color: var(--text-muted); font-size: 1rem;">${(combinedRealRev / 1e6).toFixed(1)}M</div>

                                            <div>Đã trả (Thu):</div>
                                            <div style="font-weight: 600; color: var(--secondary); font-size: 1rem;">${(combinedPaid / 1e6).toFixed(1)}M</div>
                                            
                                            <div style="text-align: right;">Tiền gửi dư:</div>
                                            <div style="text-align: right; font-weight: 600; color: var(--warning); font-size: 1rem;">${(combinedRefund / 1e6).toFixed(1)}M</div>

                                            <div style="grid-column: span 3; text-align: right; font-weight: bold; border-top: 1px solid rgba(255,255,255,0.05); margin-top: 4px; padding-top: 8px;">Tổng Công nợ:</div>
                                            <div style="text-align: right; font-weight: bold; color: var(--accent); font-size: 1rem; border-top: 1px solid rgba(255,255,255,0.05); margin-top: 4px; padding-top: 8px;">${(combinedDebt / 1e6).toFixed(1)}M</div>
                                        </div>
                                    </div>
                                `;
                            }
                            return '';
                        })()}
                    </div>
                </div>

                <!-- Detailed Selected Customer Panel -->
                ${selectedData.name ? `
                    <div class="glass-card" style="border: 1px solid rgba(255, 255, 255, 0.08); background: rgba(30, 33, 43, 0.4);">
                        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 1.2rem; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
                            <div>
                                <span style="font-size: 0.8rem; text-transform: uppercase; color: var(--primary-light); font-weight: 700; letter-spacing: 0.05em;">Chi tiết đối tác</span>
                                <h2 style="margin: 0; font-size: 1.6rem; color: var(--text-main);">${selectedData.name}</h2>
                                
                                <!-- Opening Debt Input Field -->
                                <div style="margin-top: 0.75rem; display: flex; align-items: center; gap: 0.5rem; background: rgba(255,255,255,0.03); padding: 6px 12px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.05);">
                                    <span style="font-size: 0.8rem; color: var(--text-muted); font-weight: 500;"><i class="fa-solid fa-hourglass-start" style="margin-right: 4px;"></i>Nợ đầu kỳ:</span>
                                    <input type="number" 
                                           id="cust-opening-debt" 
                                           class="form-control" 
                                           value="${selectedData.openingDebt}" 
                                           style="width: 140px; font-size: 0.8rem; padding: 2px 6px; height: 26px; text-align: right; background: rgba(0,0,0,0.3); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-main); font-weight: 600;"
                                           placeholder="0">
                                    <span style="font-size: 0.8rem; color: var(--text-muted);">đ</span>
                                    <button onclick="app.updateCustomerOpeningDebt('${selectedData.name}')" 
                                            class="btn" 
                                            style="padding: 2px 10px; font-size: 0.75rem; height: 26px; line-height: 22px; display: inline-flex; align-items: center; gap: 4px; background: var(--primary); border: none; color: white; border-radius: 4px; cursor: pointer; transition: all 0.2s;">
                                        <i class="fa-solid fa-floppy-disk"></i> Lưu
                                    </button>
                                </div>
                            </div>
                            <div style="display: flex; gap: 1.5rem; text-align: right;">
                                <div>
                                    <small class="stat-label">Nợ Đầu Kỳ</small>
                                    <div style="font-weight: 700; color: #f59e0b;">${AppData.formatCurrency(selectedData.openingDebt)}</div>
                                </div>
                                <div style="border-left: 1px solid var(--border-color); padding-left: 1.5rem;">
                                    <small class="stat-label">Tổng Hóa Đơn</small>
                                    <div style="font-weight: 700; color: var(--text-main);">${AppData.formatCurrency(selectedData.totalInvoiceRevenue)}</div>
                                </div>
                                <div style="border-left: 1px solid var(--border-color); padding-left: 1.5rem;">
                                    <small class="stat-label">Đã Trả (Thu)</small>
                                    <div style="font-weight: 700; color: var(--secondary);">${AppData.formatCurrency(selectedData.totalPaid)}</div>
                                </div>
                                <div style="border-left: 1px solid var(--border-color); padding-left: 1.5rem;">
                                    <small class="stat-label">Công Nợ Còn Lại</small>
                                    <div style="font-weight: 700; color: var(--accent);">${AppData.formatCurrency(selectedData.invoiceDebt)}</div>
                                </div>
                                <div style="border-left: 1px solid var(--border-color); padding-left: 1.5rem;">
                                    <small class="stat-label">Tiền Gửi (Còn lại)</small>
                                    <div style="font-weight: 700; color: var(--warning);">${AppData.formatCurrency(selectedData.unpaidRefund)}</div>
                                </div>
                            </div>
                        </div>

                        <!-- Sub-navigation tabs or section layout -->
                        <div style="margin-top: 1.5rem;">
                            <!-- 1. Voyage ledger -->
                            <h3 style="font-size: 1.2rem; margin-bottom: 1rem;"><i class="fa-solid fa-ship" style="color:var(--primary-light); margin-right: 0.5rem;"></i>1. Phát sinh Doanh thu từng chuyến</h3>
                            <div class="table-container" style="margin-bottom: 2.5rem;">
                                ${console.log('DEBUG DATA', selectedData.transactions, selectedData.shipments) || ''}
                                <table class="table">
                                    <thead>
                                        <tr>
                                            <th>STT</th>
                                            <th>Tàu & Chuyến</th>
                                            <th>Hợp đồng</th>
                                            <th>Thời gian</th>
                                            <th style="text-align: right;">Sản lượng (Tấn)</th>
                                            <th style="text-align: right;">Đơn giá</th>
                                            <th style="text-align: right;">Doanh thu hóa đơn</th>
                                            <th style="text-align: right; color: var(--text-muted);">Doanh thu thực tế</th>
                                            <th style="text-align: right; color: var(--secondary);">Số tiền đã trả</th>
                                            <th style="text-align: right; color: var(--accent);">Công nợ còn lại</th>
                                            <th style="text-align: right;">Tiền gửi phát sinh</th>
                                            <th style="text-align: right; color: var(--warning);">Tiền gửi còn lại</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${(() => {
                                            const sortedShipments = [...selectedData.shipments].sort((a, b) => {
                                                const dateA = a.dateStart || '';
                                                const dateB = b.dateStart || '';
                                                if (dateA !== dateB) return dateA.localeCompare(dateB);
                                                return (a.contractNo || '').localeCompare(b.contractNo || '', undefined, {numeric: true, sensitivity: 'base'});
                                            });
                                            
                                            const explicitPaidMap = {};
                                            const explicitReturnedMap = {};
                                            let unallocatedPaid = 0;
                                            let unallocatedReturned = 0;
                                            
                                            selectedData.transactions.forEach(t => {
                                                if (t.category === 'CVC') {
                                                    const matchedShipment = sortedShipments.find(s => s.contractNo && s.contractNo === t.contractNo);
                                                    if (matchedShipment) {
                                                        const sid = matchedShipment.id;
                                                        explicitPaidMap[sid] = (explicitPaidMap[sid] || 0) + (Number(t.thu) || 0);
                                                        explicitReturnedMap[sid] = (explicitReturnedMap[sid] || 0) + (Number(t.chi) || 0);
                                                    } else {
                                                        unallocatedPaid += (Number(t.thu) || 0);
                                                        unallocatedReturned += (Number(t.chi) || 0);
                                                    }
                                                }
                                            });

                                            let remainingPaid = unallocatedPaid;
                                            remainingPaid -= selectedData.openingDebt;
                                            if (remainingPaid < 0) remainingPaid = 0;
                                        
                                            let remainingReturned = unallocatedReturned;
                                        
                                            let totalRemainingDebt = 0;
                                            let totalRemainingRefund = 0;
                                            let totalPaidForThis = 0;
                                            
                                            const rows = sortedShipments.map((s, idx) => {
                                                const vessel = AppData.getVessel(s.vesselId);
                                                
                                                let invoiceAmt = Number(s.revenueInvoice) || 0;
                                                let explicitPaid = explicitPaidMap[s.id] || 0;
                                                let paidForThis = explicitPaid;
                                                
                                                if (remainingPaid > 0) {
                                                    if (idx === sortedShipments.length - 1) {
                                                        paidForThis += remainingPaid;
                                                        remainingPaid = 0;
                                                    } else if (invoiceAmt > paidForThis) {
                                                        let gap = invoiceAmt - paidForThis;
                                                        let add = Math.min(remainingPaid, gap);
                                                        paidForThis += add;
                                                        remainingPaid -= add;
                                                    }
                                                }
                                                let remainingDebt = invoiceAmt - paidForThis;
                                                totalRemainingDebt += remainingDebt;
                                                totalPaidForThis += paidForThis;
                                                
                                                let refundAmt = Number(s.refundAmount) || 0;
                                                let explicitReturned = explicitReturnedMap[s.id] || 0;
                                                let returnedForThis = explicitReturned;
                                                
                                                if (remainingReturned > 0) {
                                                    if (idx === sortedShipments.length - 1) {
                                                        returnedForThis += remainingReturned;
                                                        remainingReturned = 0;
                                                    } else if (refundAmt > returnedForThis) {
                                                        let gap = refundAmt - returnedForThis;
                                                        let add = Math.min(remainingReturned, gap);
                                                        returnedForThis += add;
                                                        remainingReturned -= add;
                                                    }
                                                }
                                                let remainingRefund = refundAmt - returnedForThis;
                                                totalRemainingRefund += remainingRefund;
                                                
                                                return `
                                                    <tr onclick="app.editShipment('${s.id}')" title="Click để nhập liệu/chỉnh sửa chuyến hàng" style="cursor: pointer;">
                                                        <td>${idx + 1}</td>
                                                        <td><strong>${vessel ? vessel.name : s.vesselId}</strong> <span class="badge badge-outline">Chuyến ${s.voyageNo}</span></td>
                                                        <td><code style="font-size: 1.1rem; font-weight: bold; padding: 4px 8px; color: var(--primary-light); background: rgba(255,255,255,0.08); border-radius: 4px;">${s.contractNo || '---'}</code></td>
                                                        <td style="font-size: 0.8rem; color:var(--text-muted);">${s.dateStart.split('-').reverse().join('/')} - ${s.dateEnd.split('-').reverse().join('/')}</td>
                                                        <td style="text-align: right; font-weight: 500;">${s.qty ? s.qty.toLocaleString('vi-VN') : 0}</td>
                                                        <td style="text-align: right;">${s.rate ? s.rate.toLocaleString('vi-VN') : '0'}</td>
                                                        <td style="text-align: right; font-weight: 600; color: var(--info);">${AppData.formatCurrency(invoiceAmt)}</td>
                                                        <td style="text-align: right; font-size: 0.85rem; color: var(--text-muted);">${AppData.formatCurrency(s.revenueReal)}</td>
                                                        <td style="text-align: right; font-weight: 600; color: var(--secondary);">${AppData.formatCurrency(paidForThis)}</td>
                                                        <td style="text-align: right; font-weight: 700; color: ${remainingDebt > 0 ? 'var(--accent)' : 'var(--text-muted)'};">${AppData.formatCurrency(remainingDebt)}</td>
                                                        <td style="text-align: right; font-weight: 500;">${AppData.formatCurrency(refundAmt)}</td>
                                                        <td style="text-align: right; font-weight: 700; color: ${remainingRefund > 0 ? 'var(--warning)' : 'var(--text-muted)'};">${AppData.formatCurrency(remainingRefund)}</td>
                                                    </tr>
                                                `;
                                            }).join('');
                                            
                                            const summaryRow = selectedData.shipments.length === 0 ? `
                                                <tr><td colspan="10" style="text-align: center; color: var(--text-muted);">Không có dữ liệu chuyến hàng nào cho khách hàng này.</td></tr>
                                            ` : `
                                                <tr style="font-weight: 700; background: rgba(255,255,255,0.03); border-top: 2px solid var(--border-color);">
                                                    <td colspan="4">TỔNG CỘNG PHÁT SINH CHUYẾN</td>
                                                    <td style="text-align: right;">${selectedData.shipments.reduce((sum, s) => sum + (s.qty || 0), 0).toLocaleString('vi-VN')}</td>
                                                    <td></td>
                                                    <td style="text-align: right; color: var(--info);">${AppData.formatCurrency(selectedData.totalInvoiceRevenue)}</td>
                                                    <td style="text-align: right; color: var(--text-muted);">${AppData.formatCurrency(selectedData.totalRealRevenue)}</td>
                                                    <td style="text-align: right; color: var(--secondary);">${AppData.formatCurrency(totalPaidForThis)}</td>
                                                    <td style="text-align: right; color: var(--accent);">${AppData.formatCurrency(totalRemainingDebt)}</td>
                                                    <td style="text-align: right;">${AppData.formatCurrency(selectedData.totalRefundAmount)}</td>
                                                    <td style="text-align: right; color: var(--warning);">${AppData.formatCurrency(totalRemainingRefund)}</td>
                                                </tr>
                                            `;
                                            return rows + summaryRow;
                                        })()}
                                    </tbody>
                                </table>
                            </div>

                            <div class="grid-2" style="margin-bottom: 2.5rem; gap: 1.5rem;">
                                <!-- 2. Payments ledger -->
                                <div>
                                    <h3 style="font-size: 1.2rem; margin-bottom: 1rem;"><i class="fa-solid fa-receipt" style="color:var(--secondary); margin-right: 0.5rem;"></i>2. Giao dịch Thanh toán & Trả lại (CVC)</h3>
                                    <div class="table-container">
                                        <table class="table" style="font-size: 0.85rem;">
                                            <thead>
                                                <tr>
                                                    <th>Ngày</th>
                                                    <th>Nội dung</th>
                                                    <th>Tài khoản</th>
                                                    <th style="text-align: right;">Khách trả (+)</th>
                                                    <th style="text-align: right;">Trả lại (-)</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                ${selectedData.transactions.filter(t => t.category === 'CVC').map(t => `
                                                    <tr onclick="app.editTransaction('${t.id}')" title="Click để xem chi tiết / chỉnh sửa giao dịch" style="cursor: pointer;">
                                                        <td>${t.date.split('-').reverse().join('/')}</td>
                                                        <td>${t.content}</td>
                                                        <td><span class="badge badge-outline" style="font-size: 0.7rem;">${t.account}</span></td>
                                                        <td style="text-align: right; color: var(--secondary); font-weight: bold;">
                                                            ${t.thu > 0 ? '+' + AppData.formatCurrency(t.thu) : '---'}
                                                        </td>
                                                        <td style="text-align: right; color: var(--accent); font-weight: bold;">
                                                            ${t.chi > 0 ? '-' + AppData.formatCurrency(t.chi) : '---'}
                                                        </td>
                                                    </tr>
                                                `).join('')}
                                                ${selectedData.transactions.filter(t => t.category === 'CVC').length === 0 ? `
                                                    <tr><td colspan="5" style="text-align: center; color: var(--text-muted);">Chưa phát sinh giao dịch thanh toán nào.</td></tr>
                                                ` : `
                                                    <tr style="font-weight: 700; background: rgba(255,255,255,0.03); border-top: 1px solid var(--border-color);">
                                                        <td colspan="3">TỔNG GIAO DỊCH PHÁT SINH</td>
                                                        <td style="text-align: right; color: var(--secondary);">${AppData.formatCurrency(selectedData.totalPaid)}</td>
                                                        <td style="text-align: right; color: var(--accent);">${AppData.formatCurrency(selectedData.totalReturned)}</td>
                                                    </tr>
                                                `}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                <!-- 3. Monthly Summary -->
                                <div>
                                    <h3 style="font-size: 1.2rem; margin-bottom: 1rem;"><i class="fa-solid fa-calendar-check" style="color:#f59e0b; margin-right: 0.5rem;"></i>3. Tổng hợp Công nợ theo Tháng</h3>
                                    <div class="table-container">
                                        <table class="table" style="font-size: 0.85rem;">
                                            <thead>
                                                <tr>
                                                    <th>Tháng</th>
                                                    <th style="text-align: right;">Doanh thu Hoá đơn</th>
                                                    <th style="text-align: right;">Tiền gửi trả lại</th>
                                                    <th style="text-align: right;">Khách trả trong tháng</th>
                                                    <th style="text-align: right;">Công nợ ròng phát sinh</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                ${sortedMonths.map(m => {
                                                    const data = monthlyBreakdown[m];
                                                    const monthlyNetDebt = data.invRev - data.refund - data.paid + data.returned;
                                                    return `
                                                        <tr>
                                                            <td><strong>Tháng ${m.split('-').reverse().join('/')}</strong></td>
                                                            <td style="text-align: right; font-weight: 500;">${AppData.formatCurrency(data.invRev)}</td>
                                                            <td style="text-align: right; color: var(--accent);">${AppData.formatCurrency(data.refund)}</td>
                                                            <td style="text-align: right; color: var(--secondary); font-weight: 600;">${AppData.formatCurrency(data.paid)}</td>
                                                            <td style="text-align: right; font-weight: 700; color: ${monthlyNetDebt >= 0 ? 'var(--accent)' : 'var(--secondary)'};">
                                                                ${AppData.formatCurrency(monthlyNetDebt)}
                                                            </td>
                                                        </tr>
                                                    `;
                                                }).join('')}
                                                ${sortedMonths.length === 0 ? `
                                                    <tr><td colspan="5" style="text-align: center; color: var(--text-muted);">Không có dữ liệu tổng hợp tháng.</td></tr>
                                                ` : ''}
                                            </tbody>
                                        </table>
                                    </div>
                                    <p style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.75rem; font-style: italic; line-height: 1.4;">
                                        * Công nợ ròng phát sinh tháng = (Doanh thu Hoá đơn - Tiền gửi phát sinh) - (Khách trả - Tiền gửi đã nhận lại). <br>
                                        Nếu âm (-), khách hàng đang trả dư nợ cũ phát sinh từ các tháng trước.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                ` : `
                    <div class="glass-card" style="text-align: center; padding: 3rem; color: var(--text-muted);">
                        <i class="fa-solid fa-users-slash" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                        <p>Không tìm thấy khách hàng nào có dữ liệu công nợ trong hệ thống.</p>
                    </div>
                `}
            `;
        } else if (currentTab === 'supplier') {
            const supplierDebts = AppData.getSupplierDebts();
            
            let sysTotalPurchased = 0;
            let sysTotalPaid = 0;
            
            supplierDebts.forEach(s => {
                sysTotalPurchased += s.totalPurchased;
                sysTotalPaid += s.totalPaid;
            });
            const sysDebt = sysTotalPurchased - sysTotalPaid;

            content = `
                <!-- Global Summary Cards -->
                <div class="grid-3" style="margin-bottom: 2.5rem;">
                    <div class="glass-card stat-card" style="border-left: 4px solid var(--info);">
                        <span class="stat-label">Tổng Phát Sinh Mua Dầu</span>
                        <div class="stat-value" style="font-size: 1.6rem; color: var(--info);">${AppData.formatCurrency(sysTotalPurchased)}</div>
                        <div class="stat-label" style="font-size: 0.8rem; margin-top: 4px;">Giá trị cấp dầu</div>
                    </div>
                    <div class="glass-card stat-card" style="border-left: 4px solid #f59e0b;">
                        <span class="stat-label">Tổng Đã Thanh Toán</span>
                        <div class="stat-value" style="font-size: 1.6rem; color: #f59e0b;">${AppData.formatCurrency(sysTotalPaid)}</div>
                        <div class="stat-label" style="font-size: 0.8rem; margin-top: 4px;">Đã trả NCC</div>
                    </div>
                    <div class="glass-card stat-card" style="border-left: 4px solid var(--accent);">
                        <span class="stat-label">Tổng Công Nợ Còn Lại</span>
                        <div class="stat-value" style="font-size: 1.6rem; color: var(--accent);">${AppData.formatCurrency(sysDebt)}</div>
                        <div class="stat-label" style="font-size: 0.8rem; margin-top: 4px;">Nợ NCC dầu</div>
                    </div>
                </div>

                <div class="glass-card">
                    <h3 style="color: var(--accent); margin-bottom: 1rem;"><i class="fa-solid fa-truck-droplet"></i> Báo cáo Công nợ Nhà Cung Cấp Nhiên liệu</h3>
                    
                    ${supplierDebts.length === 0 ? '<p style="text-align:center; color:var(--text-muted); padding: 2rem;">Chưa có dữ liệu nhà cung cấp dầu.</p>' : `
                    <div class="table-responsive">
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>Nhà Cung Cấp</th>
                                    <th style="text-align: right;">Tổng Tiền Mua Dầu (VNĐ)</th>
                                    <th style="text-align: right;">Đã Thanh Toán (VNĐ)</th>
                                    <th style="text-align: right;">Còn Nợ (VNĐ)</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${supplierDebts.map(s => `
                                    <tr>
                                        <td><strong>${s.name}</strong></td>
                                        <td style="text-align: right; color: var(--info);">${AppData.formatCurrency(s.totalPurchased)}</td>
                                        <td style="text-align: right; color: var(--secondary);">${AppData.formatCurrency(s.totalPaid)}</td>
                                        <td style="text-align: right; font-weight: bold; color: var(--accent);">${AppData.formatCurrency(s.debt)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                    `}
                </div>
            `;
        }

        return `
            <div class="view-section">
                <div class="page-header">
                    <div>
                        <h1 class="page-title"><i class="fa-solid fa-file-invoice-dollar" style="color:var(--primary-light); margin-right:0.5rem;"></i>Báo Cáo Công Nợ</h1>
                        <p class="page-subtitle">Quản lý, đối chiếu công nợ thực tế của khách hàng và nhà cung cấp</p>
                    </div>
                </div>

                <div style="display:flex; gap:1rem; border-bottom:1px solid var(--border-color); margin-bottom:1.5rem;">
                    <button class="btn btn-outline" style="border:none; border-bottom:2px solid ${currentTab === 'customer' ? 'var(--primary-light)' : 'transparent'}; border-radius:0; font-weight: ${currentTab === 'customer' ? 'bold' : 'normal'};" onclick="app.navigate('debts', 'customer')">
                        <i class="fa-solid fa-users"></i> Công nợ Khách Hàng
                    </button>
                    <button class="btn btn-outline" style="border:none; border-bottom:2px solid ${currentTab === 'supplier' ? 'var(--primary-light)' : 'transparent'}; border-radius:0; font-weight: ${currentTab === 'supplier' ? 'bold' : 'normal'};" onclick="app.navigate('debts', 'supplier')">
                        <i class="fa-solid fa-truck"></i> Công nợ NCC (Dầu)
                    </button>
                </div>

                ${content}
            </div>
        `;
    },
    vesselModal: (id) => {
        const v = AppData.getVessel(id);
        if (!v) return '';
        return `
            <div class="modal-header"><h3>Cập nhật thông tin Tàu ${v.name}</h3><button class="modal-close" onclick="app.closeModal('vessel-modal')">&times;</button></div>
            <div class="modal-body">
                <form onsubmit="event.preventDefault(); app.saveVessel();">
                    <input type="hidden" id="v-id" value="${v.id}">
                    <div class="grid-2">
                        <div class="form-group"><label class="form-label">Tên tàu</label><input type="text" class="form-control" id="v-name" value="${v.name}" disabled style="background:rgba(0,0,0,0.3); font-weight:bold; color:var(--success);"></div>
                        <div class="form-group"><label class="form-label">Tải trọng (Tấn)</label><input type="number" class="form-control" id="v-capacity" value="${v.capacity || ''}" required placeholder="Ví dụ: 3500"></div>
                    </div>
                    <div class="grid-2">
                        <div class="form-group"><label class="form-label">Thuyền trưởng</label><input type="text" class="form-control" id="v-captain" value="${v.captain || ''}" required placeholder="Tên thuyền trưởng"></div>
                        <div class="form-group"><label class="form-label">Số điện thoại Thuyền trưởng</label><input type="text" class="form-control" id="v-captain-phone" value="${v.captainPhone || ''}" placeholder="Số điện thoại"></div>
                    </div>
                    <div class="grid-2">
                        <div class="form-group"><label class="form-label">Quản lý tàu</label><input type="text" class="form-control" id="v-manager" value="${v.manager || ''}" placeholder="Tên người quản lý" required></div>
                        <div class="form-group"><label class="form-label">Số điện thoại Quản lý</label><input type="text" class="form-control" id="v-manager-phone" value="${v.managerPhone || ''}" placeholder="Số điện thoại"></div>
                    </div>
                    <div class="form-group"><label class="form-label">Định mức nhiên liệu chung (Lít/giờ)</label><input type="number" class="form-control" id="v-fuel-rate" value="${v.fuelRate || ''}" required placeholder="Định mức tiêu hao"></div>
                    <div class="modal-footer"><button type="submit" class="btn btn-primary" style="width:100%;">Lưu thay đổi</button></div>
                </form>
            </div>
        `;
    },

    report: (s) => {
        const fuelDO = s.costs.fuelDO || 0;
        const fuelLO = s.costs.fuelLO || 0;
        const agent = s.costs.agent || 0;
        const portFees = s.costs.portFees || 0;
        const deduc = fuelDO + fuelLO + agent + portFees;
        const vat = Math.round((0.08 * (s.revenueInvoice || s.revenueReal)) - (0.08 * deduc));
        const baseCosts = { ...s.costs };
        delete baseCosts.vat; // Tránh cộng dồn nếu đã có VAT trong object
        
        const costSum = Object.values(baseCosts).reduce((sum, v) => sum + (Number(v) || 0), 0) + vat;
        const profit = s.revenueReal - costSum;
        const vessel = AppData.getVessel(s.vesselId);
        
        return `
            <div class="report-container glass-panel" style="padding: 2rem; color: var(--text-main); font-family: 'Inter', sans-serif;">
                <div style="text-align: center; border-bottom: 2px solid var(--primary-light); padding-bottom: 1rem; margin-bottom: 2rem;">
                    <h2 style="color: var(--primary-light); text-transform: uppercase;">Báo cáo Kết quả Kinh doanh Chuyến hàng</h2>
                    <p>Mã chuyến: <strong>${s.voyageNo}</strong> | Tàu: <strong>${vessel ? vessel.name : s.vesselId}</strong></p>
                </div>

                <div class="grid-2" style="margin-bottom: 2rem; font-size: 0.9rem;">
                    <div>
                        <p>Thời gian: <strong>${s.dateStart}</strong> đến <strong>${s.dateEnd}</strong></p>
                        <p>Hàng hóa: <strong>${s.cargo}</strong></p>
                    </div>
                    <div style="text-align: right;">
                        <p>Khối lượng: <strong>${s.qty.toLocaleString()} tấn</strong></p>
                        <p>Tuyến đường: <strong>${s.portLoad || '---'} → ${s.portDischarge || '---'}</strong></p>
                    </div>
                </div>

                <div style="margin-bottom: 2rem;">
                    <h3 style="border-left: 4px solid var(--info); padding-left: 10px; margin-bottom: 1rem;">I. DOANH THU</h3>
                    <table class="table" style="background: rgba(255,255,255,0.02);">
                        <tr style="font-weight: bold; background: rgba(0,255,100,0.05);">
                            <td>1. DOANH THU THỰC TẾ</td>
                            <td style="text-align: right; color: var(--secondary);">${AppData.formatCurrency(s.revenueReal)}</td>
                        </tr>
                        <tr><td>2. Tiền VAT (8% HĐ - 8% DO, LO, Đại lý, Cảng)</td><td style="text-align: right;">${AppData.formatCurrency(vat)}</td></tr>
                        <tr style="font-weight: bold; border-top: 1px solid var(--border-color);">
                            <td>3. DOANH THU SAU KHI TRỪ VAT</td>
                            <td style="text-align: right; color: var(--info);">${AppData.formatCurrency(s.revenueReal - vat)}</td>
                        </tr>
                    </table>
                </div>

                <div style="margin-bottom: 2rem;">
                    <h3 style="border-left: 4px solid var(--rose-light); padding-left: 10px; margin-bottom: 1rem;">II. CHI PHÍ CHUYẾN HÀNG</h3>
                    <table class="table" style="background: rgba(255,255,255,0.02);">
                        <tr><td>1. Nhiên liệu DO</td><td style="text-align: right;">${AppData.formatCurrency(s.costs.fuelDO)}</td></tr>
                        <tr><td>2. Nhiên liệu LO</td><td style="text-align: right;">${AppData.formatCurrency(s.costs.fuelLO || 0)}</td></tr>
                        <tr><td>3. Đại lý 2 đầu cảng</td><td style="text-align: right;">${AppData.formatCurrency(s.costs.agent || 0)}</td></tr>
                        <tr><td>4. Tàu chi 2 đầu cảng</td><td style="text-align: right;">${AppData.formatCurrency(s.costs.vessel2ends || 0)}</td></tr>
                        <tr><td>5. Phí cảng, Tàu lai, Hoa tiêu</td><td style="text-align: right;">${AppData.formatCurrency(s.costs.portFees || 0)}</td></tr>
                        <tr><td>6. Tiền Bông</td><td style="text-align: right;">${AppData.formatCurrency(s.costs.brokerage || 0)}</td></tr>
                        <tr><td>7. Lương thuyền viên (Phân bổ)</td><td style="text-align: right;">${AppData.formatCurrency(s.costs.crewSalary)}</td></tr>
                        <tr><td>8. Tiền ăn thuyền viên (Phân bổ)</td><td style="text-align: right;">${AppData.formatCurrency(s.costs.crewFood)}</td></tr>
                        <tr><td>9. Bảo hiểm (Phân bổ)</td><td style="text-align: right;">${AppData.formatCurrency(s.costs.crewInsurance || 0)}</td></tr>
                        <tr><td>10. Vật tư, sửa chữa Cty cấp (Phân bổ)</td><td style="text-align: right;">${AppData.formatCurrency(s.costs.materialCompany || 0)}</td></tr>
                        <tr><td>11. Vật tư, sửa chữa Tàu chi (Phân bổ)</td><td style="text-align: right;">${AppData.formatCurrency(s.costs.materialVessel || 0)}</td></tr>
                        <tr><td>12. Lãi vay (Phân bổ)</td><td style="text-align: right; color: var(--warning);">${AppData.formatCurrency(s.costs.loanInterest || 0)}</td></tr>
                        <tr><td>13. Phân bổ chi phí khác từ Cty</td><td style="text-align: right;">${AppData.formatCurrency(s.costs.monthlyOther || 0)}</td></tr>
                        <tr><td>14. Chi phí khác tàu chi tại chuyến</td><td style="text-align: right;">${AppData.formatCurrency(s.costs.others || 0)}</td></tr>
                        <tr style="font-weight: bold; background: rgba(255,0,100,0.05);">
                            <td>TỔNG CHI PHÍ</td>
                            <td style="text-align: right; color: var(--rose-light);">${AppData.formatCurrency(costSum)}</td>
                        </tr>
                    </table>
                </div>

                <div style="background: var(--primary-dark); padding: 1.5rem; border-radius: 12px; display: flex; justify-content: space-between; align-items: center; border: 1px solid var(--primary-light);">
                    <h2 style="margin: 0;">III. LỢI NHUẬN RÒNG</h2>
                    <h2 style="margin: 0; color: ${profit >= 0 ? 'var(--secondary)' : 'var(--rose-light)'};">${AppData.formatCurrency(profit)}</h2>
                </div>
                
                <div style="margin-top: 2rem; text-align: center;">
                    <button class="btn btn-outline" onclick="app.closeModal('report-modal')">Đóng Báo Cáo</button>
                    <button class="btn btn-primary" onclick="window.print()"><i class="fa-solid fa-print"></i> In Báo Cáo</button>
                </div>
            </div>
        `;
    },

    vesselExpenseModal: (e = {}) => {
        const vessels = AppData.getVessels();
        const firstVesselId = e.vesselId || (vessels[0] ? vessels[0].id : '');
        
        // Find shipments for this vessel to link voyageNo
        const shipments = AppData.getShipments().filter(s => s.vesselId === firstVesselId);
        
        const categories = [
            'Tiền ăn & bồi dưỡng TV',
            'Tiền Bồi dưỡng',
            'Chi phí tại các đầu cảng',
            'Vật tư & CP khác'
        ];

        return `
            <div class="modal-header" style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border-color); padding-bottom:1rem; margin-bottom:1rem;">
                <h3 class="modal-title" style="color:var(--accent); margin:0;"><i class="fa-solid fa-wallet"></i> ${e.id ? 'Cập Nhật' : 'Thêm'} Chi Phí Tàu</h3>
                <button class="close-btn" onclick="app.closeModal('vessel-expense-modal')" style="background:none; border:none; color:var(--text-muted); font-size:1.5rem; cursor:pointer;">&times;</button>
            </div>
            <div class="modal-body">
                <form onsubmit="event.preventDefault(); app.saveVesselExpense('${e.id || ''}');">
                    <div class="grid-2">
                        <div class="form-group">
                            <label class="form-label">Chọn Tàu</label>
                            <select class="form-control" id="ve-m-vessel" onchange="app.updateVesselExpenseModalVoyages()" required>
                                ${vessels.map(v => `<option value="${v.id}" ${v.id === firstVesselId ? 'selected' : ''}>${v.name}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Ngày Chi</label>
                            <input type="date" class="form-control" id="ve-m-date" value="${e.date || new Date().toISOString().substring(0, 10)}" required>
                        </div>
                    </div>

                    <div class="grid-2">
                        <div class="form-group">
                            <label class="form-label">Phân nhóm Chi Phí</label>
                            <select class="form-control" id="ve-m-category" required>
                                ${categories.map(c => `<option value="${c}" ${e.category === c ? 'selected' : ''}>${c}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Liên kết Chuyến</label>
                            <select class="form-control" id="ve-m-voyage">
                                <option value="">--- Không liên kết ---</option>
                                ${shipments.map(s => `<option value="${s.voyageNo}" ${e.voyageNo === s.voyageNo ? 'selected' : ''}>Chuyến ${s.voyageNo} (${s.cargo})</option>`).join('')}
                            </select>
                        </div>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Số Tiền (VND)</label>
                        <input type="text" inputmode="numeric" class="form-control money" id="ve-m-amount" value="${app.fmtMoney(e.amount || '')}" required placeholder="Nhập số tiền chi...">
                    </div>

                    <div class="form-group">
                        <label class="form-label">Nội Dung Chi Tiết</label>
                        <textarea class="form-control" id="ve-m-content" rows="3" required placeholder="Nhập mô tả chi tiết nội dung chi tiêu...">${e.content || ''}</textarea>
                    </div>

                    <div class="modal-footer" style="padding-top:1rem; display:flex; gap:1rem;">
                        <button type="button" class="btn btn-outline" onclick="app.closeModal('vessel-expense-modal')" style="flex:1;">Hủy</button>
                        <button type="submit" class="btn btn-primary" style="flex:2;">Lưu Khoản Chi</button>
                    </div>
                </form>
            </div>
        `;
    },

    reports: (currentTab = 'voyage', filterMonth = '') => {
        let content = '';

        if (currentTab === 'fuel') {
            const supplierDebts = AppData.getSupplierDebts();
            
            // Extract all purchases with their allocated payments
            let allPurchases = [];
            supplierDebts.forEach(supplier => {
                supplier.purchases.forEach(p => {
                    allPurchases.push({
                        ...p,
                        supplierName: supplier.name
                    });
                });
            });
            
            // Sort by date ascending
            allPurchases.sort((a, b) => new Date(a.date) - new Date(b.date));
            
            // Build filter months dropdown
            const monthsSet = new Set();
            allPurchases.forEach(p => {
                if (p.date) {
                    const d = new Date(p.date);
                    if (!isNaN(d.getTime())) {
                        const m = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
                        p.filterMonth = m;
                        monthsSet.add(m);
                    }
                }
            });
            const availableMonths = Array.from(monthsSet).sort((a, b) => b.localeCompare(a));
            if (!filterMonth && availableMonths.length > 0) {
                filterMonth = availableMonths[0]; // Mặc định chọn tháng mới nhất
            }
            
            // Filter by month
            const monthPurchases = allPurchases.filter(p => p.filterMonth === filterMonth);
            
            // Group by Vessel
            const groupedByVessel = {};
            monthPurchases.forEach(p => {
                if (!groupedByVessel[p.vessel]) groupedByVessel[p.vessel] = [];
                groupedByVessel[p.vessel].push(p);
            });
            
            // Build HTML
            let fuelHTML = '';
            
            if (monthPurchases.length === 0) {
                fuelHTML = `<p style="text-align:center; color:var(--text-muted); padding: 2rem;">Không có dữ liệu cấp dầu trong tháng này.</p>`;
            } else {
                fuelHTML += `<div class="table-responsive"><table class="table" style="font-size: 0.85rem;">
                    <thead>
                        <tr>
                            <th>TÀU</th>
                            <th>NGÀY CẤP</th>
                            <th>ĐỊA ĐIỂM</th>
                            <th style="text-align:right;">SỐ LƯỢNG</th>
                            <th style="text-align:right;">ĐƠN GIÁ</th>
                            <th style="text-align:right;">THÀNH TIỀN</th>
                            <th style="text-align:right;">THANH TOÁN</th>
                            <th style="text-align:right;">CÒN NỢ</th>
                            <th>ĐV CẤP</th>
                        </tr>
                    </thead>
                    <tbody>`;
                
                Object.keys(groupedByVessel).sort().forEach(vesselId => {
                    const group = groupedByVessel[vesselId];
                    let groupQty = 0, groupCost = 0, groupPaid = 0, groupRemaining = 0;
                    
                    group.forEach((p, idx) => {
                        const fuelVoy = AppData.state.fuelVoyages.find(v => v.id === p.id);
                        const location = fuelVoy ? fuelVoy.fuelLocation : '---';
                        
                        groupQty += Number(p.qty) || 0;
                        groupCost += p.cost;
                        groupPaid += p.paid;
                        groupRemaining += p.remaining;
                        
                        fuelHTML += `<tr>
                            <td>${idx === 0 ? `<strong>${vesselId}</strong>` : ''}</td>
                            <td>${p.date ? new Date(p.date).toLocaleDateString('vi-VN') : '---'}</td>
                            <td>${location}</td>
                            <td style="text-align:right; font-weight:bold;">${Math.round(Number(p.qty || 0)).toLocaleString('vi-VN')}</td>
                            <td style="text-align:right;">${AppData.formatCurrency(p.price)}</td>
                            <td style="text-align:right; color:var(--info);">${AppData.formatCurrency(p.cost)}</td>
                            <td style="text-align:right; color:var(--secondary);">${p.paid > 0 ? AppData.formatCurrency(p.paid) : '-'}</td>
                            <td style="text-align:right; color:var(--accent); font-weight:bold;">${p.remaining > 0 ? AppData.formatCurrency(p.remaining) : '-'}</td>
                            <td>${p.supplierName}</td>
                        </tr>`;
                    });
                    
                    // Group Total
                    fuelHTML += `<tr style="background: rgba(245, 158, 11, 0.1); font-weight:bold;">
                        <td colspan="3" style="color: #f59e0b;">Cộng ${vesselId}</td>
                        <td style="text-align:right;">${Math.round(groupQty).toLocaleString('vi-VN')}</td>
                        <td></td>
                        <td style="text-align:right; color:var(--info);">${AppData.formatCurrency(groupCost)}</td>
                        <td style="text-align:right; color:var(--secondary);">${groupPaid > 0 ? AppData.formatCurrency(groupPaid) : '-'}</td>
                        <td style="text-align:right; color:var(--accent);">${groupRemaining > 0 ? AppData.formatCurrency(groupRemaining) : '-'}</td>
                        <td></td>
                    </tr>`;
                });
                
                fuelHTML += `</tbody></table></div>`;
            }
            
            content = `
                <div class="glass-card" style="margin-bottom: 1.5rem; padding: 1rem 1.5rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div style="display: flex; align-items: center; gap: 1rem;">
                            <label style="font-weight: bold; color: var(--text-main);">Lọc theo tháng:</label>
                            <select class="form-control" style="width: 200px;" onchange="app.navigate('reports', 'fuel', this.value)">
                                <option value="">-- Chọn tháng --</option>
                                ${availableMonths.map(m => `<option value="${m}" ${m === filterMonth ? 'selected' : ''}>Tháng ${m.split('-')[1]}/${m.split('-')[0]}</option>`).join('')}
                            </select>
                        </div>
                        <button class="btn btn-outline" onclick="app.exportFuelReport()"><i class="fa-solid fa-file-excel"></i> Xuất Excel Báo Cáo Dầu</button>
                    </div>
                </div>

                <div class="glass-card">
                    <h3 style="color: var(--accent); margin-bottom: 1rem;"><i class="fa-solid fa-gas-pump"></i> Bảng Theo Dõi Cấp DO - ${filterMonth ? 'Tháng ' + filterMonth.split('-')[1] + '/' + filterMonth.split('-')[0] : 'Tất cả'}</h3>
                    ${fuelHTML}
                </div>
            `;
        } else {
            // VOYAGE REPORT (Mặc định)
            const ships = AppData.getShipments();
            
            // Xây dựng danh sách các tháng có dữ liệu
            const monthsSet = new Set();
            ships.forEach(s => {
                const m = s.reportMonth || (s.dateStart ? s.dateStart.substring(0, 7) : '');
                if (m) monthsSet.add(m);
            });
            const availableMonths = Array.from(monthsSet).sort((a, b) => b.localeCompare(a));
            
            if (!filterMonth && availableMonths.length > 0) {
                filterMonth = availableMonths[0]; // Mặc định chọn tháng gần nhất
            }

            const monthShips = ships.filter(s => {
                const m = s.reportMonth || (s.dateStart ? s.dateStart.substring(0, 7) : '');
                return m === filterMonth;
            }).sort((a, b) => {
                const numA = parseInt((a.contractNo || '').replace(/\D/g, '')) || 0;
                const numB = parseInt((b.contractNo || '').replace(/\D/g, '')) || 0;
                return numB - numA;
            });

            let totalRev = 0, totalCost = 0, totalProfit = 0;

            content = `
                <div class="glass-card" style="margin-bottom: 1.5rem; padding: 1rem 1.5rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div style="display: flex; align-items: center; gap: 1rem;">
                            <label style="font-weight: bold; color: var(--text-main);">Lọc theo tháng hạch toán:</label>
                            <select class="form-control" style="width: 200px;" onchange="app.navigate('reports', 'voyage', this.value)">
                                <option value="">-- Chọn tháng --</option>
                                ${availableMonths.map(m => `<option value="${m}" ${m === filterMonth ? 'selected' : ''}>Tháng ${m.split('-')[1]}/${m.split('-')[0]}</option>`).join('')}
                            </select>
                        </div>
                        <button class="btn btn-outline" onclick="app.exportShipmentReport()"><i class="fa-solid fa-file-excel"></i> Xuất Excel Tất Cả</button>
                    </div>
                </div>

                <div class="glass-card">
                    <h3 style="color: var(--accent); margin-bottom: 1rem;"><i class="fa-solid fa-route"></i> Báo cáo Lợi nhuận Chuyến hàng - ${filterMonth ? 'Tháng ' + filterMonth.split('-')[1] + '/' + filterMonth.split('-')[0] : 'Tất cả'}</h3>
                    
                    ${monthShips.length === 0 ? '<p style="text-align:center; color:var(--text-muted); padding: 2rem;">Không có dữ liệu chuyến hàng trong tháng này.</p>' : `
                    <div class="table-responsive">
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>Mã HĐ</th>
                                    <th>Chuyến</th>
                                    <th>Tàu</th>
                                    <th>Hàng</th>
                                    <th>Khách hàng</th>
                                    <th style="text-align: right;">Doanh thu (VNĐ)</th>
                                    <th style="text-align: right;">Tổng chi phí (VNĐ)</th>
                                    <th style="text-align: right;">Lợi nhuận (VNĐ)</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${monthShips.map(s => {
                                    const rev = Number(s.revenueReal || 0);
                                    
                                    const vat = Calc.vat(s.revenueInvoice, s.revenueReal, s.costs?.fuelDO);
                                    const baseCosts = { ...s.costs };
                                    delete baseCosts.vat; // Tránh cộng dồn
                                    const costSum = Object.values(baseCosts).reduce((sum, v) => sum + (Number(v) || 0), 0) + (vat > 0 ? vat : 0);
                                    
                                    const profit = rev - costSum;
                                    
                                    totalRev += rev;
                                    totalCost += costSum;
                                    totalProfit += profit;
                                    
                                    return `
                                        <tr>
                                            <td><strong>${s.contractNo || '---'}</strong></td>
                                            <td><span class="badge badge-outline">${s.voyageNo || '---'}</span></td>
                                            <td><span class="badge badge-success">${s.vesselId}</span></td>
                                            <td>${s.cargo}</td>
                                            <td>${s.customer}</td>
                                            <td style="text-align: right; color: var(--secondary);">${AppData.formatCurrency(rev)}</td>
                                            <td style="text-align: right; color: var(--rose-light);">${AppData.formatCurrency(costSum)}</td>
                                            <td style="text-align: right;" class="${profit >= 0 ? 'value-positive' : 'value-negative'}"><strong>${AppData.formatCurrency(profit)}</strong></td>
                                        </tr>
                                    `;
                                }).join('')}
                                <tr style="font-weight: 700; background: rgba(255,255,255,0.05); border-top: 2px solid var(--border-color);">
                                    <td colspan="5" style="text-align: center; color: var(--primary-light);">TỔNG CỘNG THÁNG</td>
                                    <td style="text-align: right; color: var(--secondary); font-size: 1.1rem;">${AppData.formatCurrency(totalRev)}</td>
                                    <td style="text-align: right; color: var(--rose-light); font-size: 1.1rem;">${AppData.formatCurrency(totalCost)}</td>
                                    <td style="text-align: right; font-size: 1.1rem;" class="${totalProfit >= 0 ? 'value-positive' : 'value-negative'}">${AppData.formatCurrency(totalProfit)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    `}
                </div>
            `;
        }

        return `
            <div class="view-section">
                <div class="page-header">
                    <div>
                        <h1 class="page-title">Báo cáo Tổng hợp</h1>
                        <p class="page-subtitle">Xem bảng theo dõi cấp dầu và hiệu quả chuyến hàng</p>
                    </div>
                </div>

                <div style="display:flex; gap:1rem; border-bottom:1px solid var(--border-color); margin-bottom:1.5rem;">
                    <button class="btn btn-outline" style="border:none; border-bottom:2px solid ${currentTab === 'voyage' ? 'var(--primary-light)' : 'transparent'}; border-radius:0; font-weight: ${currentTab === 'voyage' ? 'bold' : 'normal'};" onclick="app.navigate('reports', 'voyage')">
                        <i class="fa-solid fa-route"></i> Báo cáo Chuyến hàng
                    </button>
                    <button class="btn btn-outline" style="border:none; border-bottom:2px solid ${currentTab === 'fuel' ? 'var(--primary-light)' : 'transparent'}; border-radius:0; font-weight: ${currentTab === 'fuel' ? 'bold' : 'normal'};" onclick="app.navigate('reports', 'fuel')">
                        <i class="fa-solid fa-gas-pump"></i> Bảng Theo Dõi Cấp DO
                    </button>
                </div>

                ${content}
            </div>
        `;
    }
};
