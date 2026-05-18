/**
 * View Templates V2.0
 */

const Views = {
    dashboard: () => {
        const company = AppData.getCompany();
        const shipments = AppData.getShipments();
        let revenue = 0, costs = 0;
        shipments.forEach(s => {
            revenue += s.revenueReal || 0;
            const costSum = Object.values(s.costs || {}).reduce((sum, v) => sum + (Number(v) || 0), 0);
            costs += costSum;
        });

        return `
            <div class="view-section">
                <div class="page-header">
                    <div>
                        <h1 class="page-title">Bảng điều khiển</h1>
                        <p class="page-subtitle">${company.name}</p>
                    </div>
                </div>
                <div class="grid-4">
                    <div class="glass-card stat-card">
                        <span class="stat-label">Doanh thu thực tế</span>
                        <div class="stat-value">${AppData.formatCurrency(revenue)}</div>
                        <div class="stat-icon icon-blue"><i class="fa-solid fa-money-bill-trend-up"></i></div>
                    </div>
                    <div class="glass-card stat-card">
                        <span class="stat-label">Tổng chi phí chuyến</span>
                        <div class="stat-value">${AppData.formatCurrency(costs)}</div>
                        <div class="stat-icon icon-rose"><i class="fa-solid fa-file-invoice"></i></div>
                    </div>
                    <div class="glass-card stat-card">
                        <span class="stat-label">Lợi nhuận gộp</span>
                        <div class="stat-value">${AppData.formatCurrency(revenue - costs)}</div>
                        <div class="stat-icon icon-green"><i class="fa-solid fa-vault"></i></div>
                    </div>
                    <div class="glass-card stat-card">
                        <span class="stat-label">Số chuyến hoạt động</span>
                        <div class="stat-value">${shipments.length}</div>
                        <div class="stat-icon icon-purple"><i class="fa-solid fa-ship"></i></div>
                    </div>
                </div>
                
                <div class="grid-2" style="margin-top:2rem;">
                    <div class="glass-card">
                        <h3>Đội tàu & Thuyền trưởng</h3>
                        <div class="table-container" style="margin-top:1rem;">
                            <table class="table">
                                <thead><tr><th>Tàu</th><th>Thuyền trưởng</th><th>Trạng thái</th></tr></thead>
                                <tbody>
                                    ${AppData.state.vessels.map(v => `
                                        <tr>
                                            <td><strong>${v.name}</strong></td>
                                            <td>${v.captain}</td>
                                            <td><span class="badge badge-success">Đang hành trình</span></td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div class="glass-card">
                        <h3>Giao dịch gần đây</h3>
                        <div class="table-container" style="margin-top:1rem;">
                            <table class="table">
                                <thead><tr><th>Ngày</th><th>Nội dung</th><th>Số tiền</th></tr></thead>
                                <tbody>
                                    ${AppData.getTransactions().slice(0,5).map(t => `
                                        <tr>
                                            <td>${t.date}</td>
                                            <td>${t.content}</td>
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

    financials: () => {
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
                                    ${['Công ty', ...AppData.state.vessels.map(v => v.name)].map(entity => `
                                        <th style="text-align: center; border-left: 1px solid var(--border-color);">${entity}</th>
                                    `).join('')}
                                </tr>
                            </thead>
                            <tbody>
                                ${(() => {
                                    const entities = ['Công ty', ...AppData.state.vessels.map(v => v.name)];
                                    const breakdown = {};
                                    trans.forEach(t => {
                                        const m = (t.date && typeof t.date === 'string') ? t.date.substring(0, 7) : '';
                                        if (!m) return;
                                        const ent = t.vessel === 'Công ty' ? 'Công ty' : (AppData.state.vessels.find(v => v.id === t.vessel || v.name === t.vessel)?.name || t.vessel);
                                        
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
                                ${trans.map(t => `
                                    <tr style="${t.category === 'Luân chuyển' ? 'opacity: 0.6; font-style: italic;' : ''}">
                                        <td>${t.date}</td>
                                        <td><span class="badge badge-outline">${t.vessel}</span></td>
                                        <td>${t.category}</td>
                                        <td>${t.content}</td>
                                        <td>${t.partner}</td>
                                        <td><small>${t.account}</small></td>
                                        <td class="value-positive">${t.thu > 0 ? AppData.formatCurrency(t.thu) : '-'}</td>
                                        <td class="value-negative">${t.chi > 0 ? AppData.formatCurrency(t.chi) : '-'}</td>
                                        <td>
                                            <button class="btn btn-outline" style="padding: 0.2rem 0.5rem;" onclick="app.editTransaction('${t.id}')"><i class="fa-solid fa-pen" style="color:var(--info)"></i></button>
                                            <button class="btn btn-outline" style="padding: 0.2rem 0.5rem;" onclick="app.deleteTransaction('${t.id}')"><i class="fa-solid fa-trash" style="color:var(--accent)"></i></button>
                                        </td>
                                    </tr>
                                `).join('')}
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
                            <select class="form-control" id="t-vessel">
                                <option value="Công ty">Văn phòng Công ty</option>
                                ${AppData.state.vessels.map(v => `<option value="${v.name}">${v.name}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                    <div class="grid-2">
                        <div class="form-group"><label class="form-label">Hạng mục</label><input type="text" class="form-control" id="t-cat" required placeholder="Dầu, Lương, Phí cảng..."></div>
                        <div class="form-group"><label class="form-label">Đối tác</label><input type="text" class="form-control" id="t-partner" required></div>
                    </div>
                    <div class="form-group"><label class="form-label">Nội dung chi tiết</label><textarea class="form-control" id="t-content" required></textarea></div>
                    <div class="grid-2">
                        <div class="form-group"><label class="form-label">Khoản Thu (VND)</label><input type="number" step="any" class="form-control" id="t-thu" value="0"></div>
                        <div class="form-group"><label class="form-label">Khoản Chi (VND)</label><input type="number" step="any" class="form-control" id="t-chi" value="0"></div>
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
                        const sortedVoyages = [...voyages].sort((a,b) => a.id.localeCompare(b.id));
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
                                    <div style="font-weight:700; font-size:1.1rem; color:var(--secondary);">${currentBalance.toLocaleString()} L</div>
                                </div>
                            </div>
                        `;
                    })()}

                    <div style="display:flex; gap:1rem;">
                        <select class="form-control" onchange="app.navigate('fuel', this.value)" style="width:auto;">
                            ${vessels.map(v => `<option value="${v.id}" ${v.id === selectedVesselId ? 'selected' : ''}>${v.name}</option>`).join('')}
                        </select>
                        <button class="btn btn-primary" onclick="app.openFuelVoyageModal('${selectedVesselId}')">
                            <i class="fa-solid fa-plus"></i> Tạo Chuyến Mới
                        </button>
                    </div>
                </div>

                <div class="grid-1">
                    ${voyages.length === 0 ? '<div class="glass-card" style="text-align:center; padding:3rem;"><p>Chưa có chuyến hàng nào được ghi nhận cho tàu này.</p></div>' : ''}
                    ${(() => {
                        const sorted = [...voyages].sort((a,b) => {
                            const getNum = s => parseInt(s.voyageNo.replace(/\D/g, '') || 0);
                            return getNum(a) - getNum(b);
                        });
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
                                                Tiếp dầu: <strong>${voy.addedFuel || 0} L</strong> 
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
                                        <div><small class="stat-label">Tiêu thụ toàn chuyến</small><div style="font-size:1.1rem; font-weight:700; color:var(--rose-light);">${stats.totalFuel.toLocaleString()} L</div></div>
                                        <div><small class="stat-label">Tồn cuối chuyến</small><div style="font-size:1.1rem; font-weight:700; color:var(--secondary);">${runningBalance.toLocaleString()} L</div></div>
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
                                                    <td>${l.fuelRate} L/h</td>
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
                            <input type="number" step="any" class="form-control" id="fv-price" value="${voyage ? voyage.fuelUnitPrice : 20000}" required>
                        </div>
                    <div class="grid-3">
                        <div class="form-group">
                            <label class="form-label">Ngày cấp</label>
                            <input type="date" class="form-control" id="fv-date" value="${voyage ? (voyage.fuelDate || '') : ''}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Nhà cung cấp</label>
                            <input type="text" class="form-control" id="fv-vendor" value="${voyage ? (voyage.fuelVendor || '') : ''}" placeholder="Tên NCC...">
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
                        <h1 class="page-title">Nha cung cap - Khach hang</h1>
                        <p class="page-subtitle">Quan ly mang luoi doi tac kinh doanh</p>
                    </div>
                    <button class="btn btn-primary" onclick="app.openPartnerModal('${activeTab}')">
                        <i class="fa-solid fa-plus"></i>
                        ${activeTab === 'vendor' ? 'Them NCC' : 'Them Khach hang'}
                    </button>
                </div>
                <div class="glass-card">
                    <div style="display:flex; gap:1rem; border-bottom:1px solid var(--border-color); margin-bottom:1.5rem;">
                        <button class="btn btn-outline" style="border:none; border-bottom:2px solid ${activeTab === 'vendor' ? 'var(--primary-light)' : 'transparent'}; border-radius:0;" onclick="app.navigate('partners', 'vendor')">Nha cung cap</button>
                        <button class="btn btn-outline" style="border:none; border-bottom:2px solid ${activeTab === 'customer' ? 'var(--primary-light)' : 'transparent'}; border-radius:0;" onclick="app.navigate('partners', 'customer')">Khach hang</button>
                    </div>
                    <div class="table-container">
                        <table class="table">
                            <thead><tr><th>Ten doi tac</th><th>Dia chi</th><th>So dien thoai</th><th>Thao tac</th></tr></thead>
                            <tbody>
                                ${activeTab === 'vendor' ? 
                                    (AppData.getVendors().length === 0 ? '<tr><td colspan="4" style="text-align:center; color:var(--text-muted); padding:2rem;">Chua co nha cung cap nao. Nhan "Them NCC" de bat dau.</td></tr>' :
                                    AppData.getVendors().map(v => `<tr><td><strong>${v.name}</strong> <span class="badge badge-outline">NCC</span></td><td>${v.address || '---'}</td><td>${v.contact || '---'}</td><td>
                                        <button class="btn btn-outline" style="padding:0.2rem 0.5rem;" onclick="app.editVendor('${v.id}')"><i class="fa-solid fa-pen" style="color:var(--info)"></i></button>
                                        <button class="btn btn-outline" style="padding:0.2rem 0.5rem;" onclick="app.deleteVendor('${v.id}')"><i class="fa-solid fa-trash" style="color:var(--accent)"></i></button>
                                    </td></tr>`).join('')) :
                                    (AppData.getCustomers().length === 0 ? '<tr><td colspan="4" style="text-align:center; color:var(--text-muted); padding:2rem;">Chua co khach hang nao. Nhan "Them Khach hang" de bat dau.</td></tr>' :
                                    AppData.getCustomers().map(c => `<tr><td><strong>${c.name}</strong> <span class="badge badge-outline">KH</span></td><td>${c.address || '---'}</td><td>${c.contact || '---'}</td><td>
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
        const title = partner ? (isVendor ? 'Sua Nha Cung Cap' : 'Sua Khach Hang') : (isVendor ? 'Them Nha Cung Cap Moi' : 'Them Khach Hang Moi');
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
                        <label class="form-label">Ten ${isVendor ? 'Nha cung cap' : 'Khach hang'} <span style="color:var(--accent)">*</span></label>
                        <input type="text" class="form-control" id="p-name" value="${partner ? partner.name : ''}" required placeholder="Nhap ten doi tac..." autofocus>
                    </div>
                    <div class="grid-2">
                        <div class="form-group">
                            <label class="form-label">So dien thoai</label>
                            <input type="text" class="form-control" id="p-contact" value="${partner ? (partner.contact || '') : ''}" placeholder="VD: 0987654321">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Dia chi</label>
                            <input type="text" class="form-control" id="p-address" value="${partner ? (partner.address || '') : ''}" placeholder="Tinh/Thanh pho...">
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-outline" onclick="app.closeModal('partner-modal')">Huy</button>
                        <button type="submit" class="btn btn-primary"><i class="fa-solid fa-floppy-disk"></i> Luu</button>
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
                                    ${vessels.map(v => `<option value="${v.id}">${v.name}</option>`).join('')}
                                </select>
                            </div>
                        </div>
                        <div class="form-group"><label class="form-label">Lương tổng (VND)</label><input type="number" step="any" class="form-control" id="m-salary" value="${costs.salary || 0}"></div>
                        <div class="form-group"><label class="form-label">Bảo hiểm (VND)</label><input type="number" step="any" class="form-control" id="m-ins" value="${costs.insurance || 0}"></div>
                        
                        <div class="form-group">
                            <label class="form-label">Tiền ăn uống (VND) <span style="font-size:0.75rem; color:var(--secondary); font-weight:normal;">(Tự động từ Báo cáo Tàu hoặc tự nhập)</span></label>
                            <input type="number" step="any" class="form-control" id="m-food" value="${costs.food || 0}">
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label">Vật tư, sửa chữa Công ty cấp (VND) <span style="font-size:0.75rem; color:var(--info); font-weight:normal;">(Tự nhập tại đây)</span></label>
                            <input type="number" step="any" class="form-control" id="m-material-company" value="${costs.materialCompany || 0}">
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label">Vật tư, sửa chữa Tàu chi (VND) <span style="font-size:0.75rem; color:var(--warning); font-weight:normal;">(Tự động lấy từ Báo cáo Tàu)</span></label>
                            <input type="number" step="any" class="form-control" id="m-material-vessel" value="${costs.materialVessel || 0}" readonly style="background:rgba(0,0,0,0.3); color:var(--text-muted);">
                        </div>
                        
                        <div class="form-group"><label class="form-label">Chi phí khác (VND)</label><input type="number" step="any" class="form-control" id="m-other" value="${costs.other || 0}"></div>
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
                                ${vessels.map(v => `<option value="${v.id}">${v.name}</option>`).join('')}
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
                            <input type="number" class="form-control" id="ve-food" placeholder="Nhập tổng tiền ăn uống..." style="background: rgba(0,0,0,0.4); font-weight:600; color: var(--secondary);">
                            <small class="form-text text-muted">Chi phí ăn uống phân bổ đều theo số ngày chạy tàu.</small>
                        </div>

                        <!-- 4. Vật tư & CP khác -->
                        <div class="form-group" style="margin-bottom: 1.25rem;">
                            <label class="form-label" style="font-weight: 600; color: var(--text-main);"><i class="fa-solid fa-wrench"></i> 4. Tiền Vật tư, sửa chữa (Tàu chi)</label>
                            <input type="number" class="form-control" id="ve-material" placeholder="Nhập tổng tiền vật tư, sửa chữa..." style="background: rgba(0,0,0,0.4); font-weight:600; color: var(--secondary);">
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
                    <button class="btn btn-primary" onclick="app.openShipmentModal()"><i class="fa-solid fa-plus"></i> Thêm Chuyến Mới</button>
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
                        <div class="form-group"><label class="form-label">Tàu</label><select class="form-control" id="s-vessel-id" onchange="app.syncShipmentFuel()">${AppData.getVessels().map(v => `<option value="${v.id}">${v.name}</option>`).join('')}</select></div>
                    </div>
                    <div class="grid-3">
                        <div class="form-group"><label class="form-label">Tên khách hàng</label>
                            <input type="text" class="form-control" id="s-customer" list="customer-list" placeholder="Chọn hoặc nhập..." required>
                            <datalist id="customer-list">
                                ${AppData.getCustomers().map(c => `<option value="${c.name}"></option>`).join('')}
                            </datalist>
                        </div>
                        <div class="form-group"><label class="form-label">Tên hàng</label><input type="text" class="form-control" id="s-cargo" required oninput="app.calcBrokerage()"></div>
                        <div class="form-group"><label class="form-label">Cảng xếp (Đi)</label><input type="text" class="form-control" id="s-p-load" required oninput="app.calcBrokerage()"></div>
                    </div>
                    <div class="form-group"><label class="form-label">Cảng dỡ (Đến)</label><input type="text" class="form-control" id="s-p-dis" required oninput="app.calcBrokerage()"></div>
                    <div class="grid-2">
                        <div class="form-group"><label class="form-label">Ngày xếp hàng</label><input type="date" class="form-control" id="s-start" required onchange="app.calcShipmentAllocations()"></div>
                        <div class="form-group"><label class="form-label">Ngày dỡ hàng</label><input type="date" class="form-control" id="s-end" required onchange="app.calcShipmentAllocations()"></div>
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
                        <div class="form-group"><label class="form-label">Tàu chi 2 đầu cảng</label><input type="number" class="form-control" id="s-c-vessel-2ends" oninput="app.calcShipmentFinance()"></div>
                        <div class="form-group"><label class="form-label">Tiền Bông</label><input type="number" class="form-control" id="s-c-brokerage" oninput="app.calcShipmentFinance()"></div>
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
                                <div class="form-group"><label class="form-label">ABbank</label><input type="number" step="any" class="form-control" id="bal-abbank" value="${(c.openingBalances && c.openingBalances['ABbank']) || 0}"></div>
                                <div class="form-group"><label class="form-label">Viettinbank</label><input type="number" step="any" class="form-control" id="bal-viettin" value="${(c.openingBalances && c.openingBalances['Viettinbank']) || 0}"></div>
                            </div>
                            <div class="grid-2">
                                <div class="form-group"><label class="form-label">Cá nhân</label><input type="number" step="any" class="form-control" id="bal-ca-nhan" value="${(c.openingBalances && c.openingBalances['Tài khoản cá nhân']) || 0}"></div>
                                <div class="form-group"><label class="form-label">Tiền mặt</label><input type="number" step="any" class="form-control" id="bal-tien-mat" value="${(c.openingBalances && c.openingBalances['Tiền mặt']) || 0}"></div>
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
                                            <td><strong>${v.name}</strong></td>
                                            <td><span class="badge badge-success" style="font-weight:600;">${v.capacity ? (Number(v.capacity).toLocaleString('vi-VN') + ' tấn') : '---'}</span></td>
                                            <td>
                                                <strong>${v.captain || '---'}</strong>
                                                ${v.captainPhone ? `<br><small style="color:var(--text-muted)"><i class="fa-solid fa-phone"></i> ${v.captainPhone}</small>` : ''}
                                            </td>
                                            <td>
                                                <strong>${v.manager || '---'}</strong>
                                                ${v.managerPhone ? `<br><small style="color:var(--text-muted)"><i class="fa-solid fa-phone"></i> ${v.managerPhone}</small>` : ''}
                                            </td>
                                            <td><span class="badge badge-outline">${v.fuelRate} L/h</span></td>
                                            <td>
                                                <button class="btn btn-outline" style="padding: 0.2rem 0.5rem;" onclick="app.editVessel('${v.id}')" title="Sửa thông tin tàu"><i class="fa-solid fa-pen" style="color:var(--info)"></i></button>
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
        const vat = Math.round((0.08 * (s.revenueInvoice || s.revenueReal)) - (0.10 * (s.costs.fuelDO || 0)));
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
                        <tr><td>2. Tiền VAT (8% DT hoá đơn - 10% hoá đơn dầu)</td><td style="text-align: right;">${AppData.formatCurrency(vat)}</td></tr>
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
                        <tr><td>12. Phân bổ chi phí khác từ Cty</td><td style="text-align: right;">${AppData.formatCurrency(s.costs.monthlyOther || 0)}</td></tr>
                        <tr><td>13. Chi phí khác tàu chi tại chuyến</td><td style="text-align: right;">${AppData.formatCurrency(s.costs.others || 0)}</td></tr>
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
                        <input type="number" step="any" class="form-control" id="ve-m-amount" value="${e.amount || ''}" required placeholder="Nhập số tiền chi...">
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
    }
};
