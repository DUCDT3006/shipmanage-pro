# Tóm tắt công việc ngày 15/05/2026 - Nâng cấp Hệ thống Quản lý Tàu V2.1

Hôm nay chúng ta đã hoàn thành một khối lượng lớn công việc tập trung vào việc hoàn thiện quản lý tài chính và tự động hóa nhập liệu.

### 1. Cải tiến Quản lý Chuyến hàng (Shipments)
- **Thông tin chi tiết**: Thêm các trường dữ liệu quan trọng gồm: Cảng đi (Port Load), Cảng đến (Port Discharge) và Tên khách hàng.
- **Định mức nhiên liệu**: Cho phép nhập định mức riêng cho từng chặng (mỗi chuyến 3-4 chặng) để tính toán tiêu thụ nhiên liệu chính xác hơn.
- **Hỗ trợ số lẻ**: Cập nhật tất cả các trường nhập liệu tài chính và nhiên liệu hỗ trợ số thập phân (`step="any"`).

### 2. Hệ thống Quản lý Tài chính V2.1
- **Số dư đầu kỳ (Opening Balance)**:
    - Thêm tính năng nhập số dư đầu kỳ cho 4 loại tài khoản: **ABbank, Viettinbank, Cá nhân, Tiền mặt** trong phần Thiết lập Công ty.
- **Tính toán tự động**:
    - Dashboard Tài chính giờ đây tự động tính toán: **Số dư cuối kỳ = Số dư đầu kỳ + Tổng Thu - Tổng Chi**.
    - Các con số được cập nhật thời gian thực ngay khi phát sinh giao dịch mới.
- **Báo cáo P&L**: Tích hợp chi phí tháng (lương, bảo hiểm...) phân bổ theo số ngày của từng chuyến hàng vào báo cáo kết quả kinh doanh.

### 3. Nhập dữ liệu tự động từ Excel
- **Trích xuất dữ liệu**: Đã lấy thành công **226 giao dịch** từ file Excel `03.Theo doi tai chinh.xlsx` (tháng 4 và tháng 5 năm 2026).
- **Tích hợp dữ liệu lịch sử**:
    - Đưa toàn bộ dữ liệu vào `app/js/data.js`.
    - Thêm logic tự động trộn (merge) dữ liệu vào trình duyệt (localStorage) mà không làm mất dữ liệu hiện có của người dùng.
    - Xử lý triệt để lỗi hiển thị font tiếng Việt cho các trường nội dung và tài khoản.

### 4. Sửa lỗi Giao diện (UI/UX)
- **Lỗi hiển thị**: Khắc phục triệt để tình trạng các bảng biểu bị đè lên nhau (z-index) trong mục Theo dõi tài chính.
- **Lỗi tương tác**: Sửa lỗi không click chọn được khách hàng trong phần Quản lý đối tác.
- **Độ ổn định**: Tối ưu hóa việc đóng/mở Modal và cuộn trang (Sticky Header).

---
**Ghi chú**: Hệ thống hiện đã sẵn sàng cho việc theo dõi tài chính chuyên sâu. Bạn chỉ cần tải lại trang (F5) để thấy toàn bộ dữ liệu lịch sử và số dư mới cập nhật.
