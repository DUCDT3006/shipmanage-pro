/**
 * Công thức tài chính dùng chung — NGUỒN DUY NHẤT, có unit test (tests/calc.test.js).
 * Trước đây các công thức này bị lặp ~9 nơi trong views.js/app.js -> dễ sai lệch.
 */
const Calc = {
  // VAT đặc thù ngành: 8% doanh thu (ưu tiên hóa đơn, fallback thực tế) - 10% tiền dầu DO
  vat(revenueInvoice, revenueReal, fuelDO) {
    const rev = Number(revenueInvoice) || Number(revenueReal) || 0;
    const fuel = Number(fuelDO) || 0;
    return Math.round((0.08 * rev) - (0.10 * fuel));
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
  }
};
if (typeof module !== 'undefined' && module.exports) module.exports = Calc;
