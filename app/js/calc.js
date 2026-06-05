/**
 * Công thức tài chính dùng chung — NGUỒN DUY NHẤT, có unit test (tests/calc.test.js).
 * Trước đây các công thức này bị lặp ~9 nơi trong views.js/app.js -> dễ sai lệch.
 */
const Calc = {
  // VAT đặc thù ngành (KHỚP với form nhập chuyến & báo cáo in):
  //   8% × doanh thu (ưu tiên hóa đơn, fallback thực tế) − 8% × (dầu DO + dầu LO + đại lý + phí cảng)
  // Tham số thứ 3 nhận object costs (hoặc, để tương thích cũ, 1 số = fuelDO).
  vat(revenueInvoice, revenueReal, costs) {
    const rev = Number(revenueInvoice) || Number(revenueReal) || 0;
    let deduc;
    if (costs && typeof costs === 'object') {
      deduc = (Number(costs.fuelDO) || 0) + (Number(costs.fuelLO) || 0)
            + (Number(costs.agent) || 0) + (Number(costs.portFees) || 0);
    } else {
      deduc = Number(costs) || 0;   // tương thích: chỉ truyền fuelDO
    }
    return Math.round((0.08 * rev) - (0.08 * deduc));
  },
  // Tiêu thụ dầu 1 chặng = định mức (L/h) × số giờ chạy
  legConsumption(hours, fuelRate) {
    return Math.round((Number(hours) || 0) * (Number(fuelRate) || 0));
  },
  // Lợi nhuận ròng = doanh thu - chi phí
  profit(revenue, cost) {
    return (Number(revenue) || 0) - (Number(cost) || 0);
  },
  // Hiệu suất lợi nhuận (%) = lợi nhuận / doanh thu * 100
  profitMargin(profit, revenue) {
    const r = Number(revenue) || 0;
    return r > 0 ? ((Number(profit) || 0) / r * 100) : 0;
  },

  // Tổng chi phí 1 chuyến (CHƯA gồm VAT — gọi nơi dùng tự cộng VAT).
  //  - BỎ 'vat' (cộng riêng) và 'fixedCost' (= tổng 5 khoản cố định chi tiết -> tránh ĐẾM 2 LẦN).
  //  - opts.excludeDepr: bỏ lên đà (trung gian/định kỳ) + khấu hao khỏi tổng.
  tripCostTotal(costs, opts) {
    const o = opts || {};
    const c = costs || {};
    let sum = 0;
    for (const k in c) {
      if (k === 'vat' || k === 'fixedCost') continue;
      if (k[0] === '_') continue;                 // cờ nội bộ (_agentAuto, _loAuto...)
      if (o.excludeDepr && (k === 'dockingIntermediate' || k === 'dockingPeriodic' || k === 'depreciation')) continue;
      sum += Number(c[k]) || 0;
    }
    return sum;
  }
};
if (typeof module !== 'undefined' && module.exports) module.exports = Calc;
