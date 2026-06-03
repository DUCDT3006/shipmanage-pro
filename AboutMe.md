# ShipManage — Tài liệu Sản phẩm cho Marketing & Truyền thông

> **Mục đích tài liệu:** Giúp Trưởng phòng Marketing/Truyền thông hiểu **toàn bộ** phần mềm — sản phẩm là gì, phục vụ ai, làm được gì, tính toán ra sao — để xây dựng thông điệp, nội dung quảng bá **chính xác và hấp dẫn**.
> **Cập nhật:** 2026-06 · **Phiên bản:** V2.1 · **Trạng thái:** Sẵn sàng thương mại cho thị trường ngách.

---

## 1. TÓM TẮT SẢN PHẨM (đọc trong 30 giây)

**ShipManage** là phần mềm **quản lý hành trình & tài chính cho đội tàu hàng rời nội địa** (tàu chở cát, đá, than, clinker, xà lan, vận tải thủy nội địa).

**Một câu định vị:**
> *"Toàn bộ tài chính, nhiên liệu, chuyến hàng, lương thuyền viên và đăng kiểm của cả đội tàu — gói gọn trên một màn hình, đồng bộ đám mây, dùng mọi lúc mọi nơi."*

**Bản chất:** Thay thế hàng chục file Excel rời rạc + sổ tay giấy bằng **một hệ thống duy nhất**, tự động tính toán lãi/lỗ từng chuyến, tự nhắc hạn đăng kiểm, phân quyền chặt chẽ cho từng nhân viên.

**Hình thức:** Ứng dụng web (chạy trên trình duyệt), cài được như app trên điện thoại (PWA), không cần cài đặt máy chủ, hoạt động cả khi mất mạng.

---

## 2. ĐỐI TƯỢNG PHỤC VỤ

### 2.1. Khách hàng mục tiêu (ai sẽ MUA)
| Phân khúc | Mô tả | Quy mô điển hình |
|---|---|---|
| **Chủ tàu hàng rời nội địa** | Cá nhân/doanh nghiệp sở hữu tàu chở cát, đá, than, clinker, vật liệu xây dựng | 1–15 tàu |
| **Doanh nghiệp vận tải thủy nội địa** | Công ty TNHH/hộ kinh doanh chạy tuyến sông, ven biển | 3–10 tàu |
| **Chủ đội xà lan** | Vận chuyển hàng rời đường thủy | 1–20 xà lan |

### 2.2. Người sử dụng trực tiếp (ai DÙNG hằng ngày — persona)
| Vai trò | Họ là ai | Nỗi đau được giải quyết |
|---|---|---|
| **Chủ tàu / Giám đốc** | Người ra quyết định | "Tàu nào đang lãi, tàu nào lỗ? Tháng này thu chi thế nào?" → xem ngay trên Dashboard |
| **Kế toán** | Theo dõi thu chi, lương, công nợ | "Nhập liệu Excel rối, công thức dễ sai, khó tổng hợp" → tự động hóa, có nhật ký thay đổi |
| **Thuyền trưởng / Nhân viên vận hành** | Nhập dầu, giờ chạy, chi phí chuyến | "Báo cáo giấy thất lạc" → nhập trực tiếp trên điện thoại, chỉ thấy phần của mình |

### 2.3. Nỗi đau cốt lõi ShipManage giải quyết
1. **Không biết chính xác mỗi chuyến lãi hay lỗ** (chi phí dầu, lương, cảng… rải rác).
2. **Quên hạn đăng kiểm/bảo hiểm** → tàu bị giữ, phạt.
3. **Thất thoát dầu** khó kiểm soát (không có định mức, không theo dõi tồn).
4. **Dữ liệu Excel dễ sai, dễ mất, khó chia sẻ** giữa văn phòng và tàu.
5. **Nhân viên thấy hết dữ liệu nhạy cảm** (lương, doanh thu) → không kiểm soát được.

---

## 3. BẢN ĐỒ TÍNH NĂNG (chi tiết theo từng phân hệ)

### 📊 3.1. Bảng điều khiển (Dashboard)
Trang tổng quan đầu tiên khi đăng nhập.
- **4 chỉ số chính:** Doanh thu thực tế · Tổng chi phí chuyến · Lợi nhuận ròng · Hiệu suất lợi nhuận (%).
- **So sánh tháng này / tháng trước** (▲▼ % tăng giảm doanh thu, lợi nhuận, biên lợi nhuận).
- **Top 5 khách hàng** theo doanh thu.
- **Xếp hạng tàu** lãi nhất / cần chú ý.
- **Bảng so sánh đội tàu** (doanh thu/chi phí/lợi nhuận/số chuyến từng tàu).
- **Bảng tồn dầu DO toàn đội** (tồn đầu / đã cấp / đã dùng / tồn hiện tại).
- **Bảng chi phí cố định theo tàu** (5 hạng mục/năm).
- **Cảnh báo đăng kiểm/chứng chỉ sắp hết hạn** (trong 30 ngày) + nhắc qua thông báo trình duyệt.
- **Biểu đồ:** hiệu quả theo tàu, xu hướng theo tháng, cơ cấu chi phí, nhiên liệu.

> **Giá trị marketing:** "Mở app là thấy ngay sức khỏe tài chính cả đội tàu."

### 💰 3.2. Theo dõi Tài chính
- Ghi nhận **thu/chi** theo từng giao dịch, gắn với tàu + chuyến + hạng mục + nguồn tiền.
- **Số dư 4 tài khoản** (ABbank, Vietinbank, Tài khoản cá nhân, Tiền mặt) = số dư đầu kỳ + thu − chi, cập nhật thời gian thực.
- **Bảng cân đối theo tháng** (tổng thu/chi/lợi nhuận/tỷ lệ chi-thu).
- **Định dạng số tự động** (1.000.000) để nhập nhanh, ít sai.
- **Phân trang** (mới nhất trước) — mượt kể cả khi có hàng nghìn giao dịch.

### 📉 3.3. Báo cáo Công nợ
- Theo dõi **phải thu (khách hàng)** và **phải trả (nhà cung cấp)**.
- Lọc theo từng đối tác, tổng hợp công nợ tự động.

### ⛽ 3.4. Quản lý Nhiên liệu (DO)
- Quản lý **theo từng chuyến dầu** của từng tàu.
- **Tồn đầu / dầu cấp thêm / tiêu thụ / tồn cuối** từng chuyến.
- **Tiêu thụ tự tính theo định mức × giờ chạy** từng chặng.
- Kiểm soát thất thoát: so sánh định mức và thực tế.

### 🛢️ 3.5. Dầu nhờn LO (tự tính chi phí)
- Cấu hình theo tàu: giờ chu kỳ, phi thay định kỳ, phi bổ sung, đơn giá, quy đổi lít/phi.
- **Tự tính chi phí LO mỗi chuyến** theo giờ chạy (xem công thức mục 4).

### 🚢 3.6. Quản lý Chuyến hàng
- Hợp đồng, mã chuyến (C1, C2…), cảng đi/đến, loại hàng, khối lượng, khách hàng.
- **Định mức nhiên liệu riêng từng chặng** (mỗi chuyến 3–4 chặng) → tính tiêu thụ chính xác.

### 🤝 3.7. NCC – Khách hàng
- Danh bạ nhà cung cấp & khách hàng (tên, địa chỉ, liên hệ).

### 🔧 3.8. Quản lý Chi phí Tàu & Chi phí theo Tháng
- Chi phí phát sinh tại tàu (ăn uống thuyền viên, vật tư, phí cảng…).
- **Chi phí tháng** (lương, bảo hiểm…) **tự phân bổ vào từng chuyến theo số ngày**.

### 👥 3.9. Nhân sự & 💵 Tính lương
- Hồ sơ thuyền viên/nhân viên: chức vụ, bộ phận, ngày vào/ra, lương, phụ cấp.
- **Chấm công** theo tháng/bộ phận.
- **Bảng lương tự động**: lương cơ bản + phụ cấp + thưởng − BHXH − **thuế TNCN (lũy tiến)** → lương thực nhận.

### 📑 3.10. Báo cáo & In ấn
- **Báo cáo Kết quả Kinh doanh từng chuyến** (P&L) chi tiết 15 dòng chi phí.
- **In / Xuất PDF** sạch đẹp khổ A4, có **letterhead công ty** (tên, MST, địa chỉ) → gửi khách/ngân hàng.
- **Xuất Excel** dữ liệu.

### ⚙️ 3.11. Master Data & Thiết lập
- Thông tin công ty, số dư đầu kỳ.
- **Quản lý đội tàu**: thêm/sửa/xóa tàu, thuyền trưởng, định mức, đăng kiểm, chi phí cố định, cấu hình LO.
- **Quản lý người dùng & phân quyền** (xem mục 5).
- **Kích hoạt license** (key bản quyền).
- **Nhật ký thay đổi (Audit log) + Hoàn tác**.
- **Sao lưu/khôi phục** (tự động + thủ công).

### 🧭 3.12. Onboarding (hướng dẫn khởi tạo)
- Khách mới đăng nhập thấy **checklist 4 bước**: nhập công ty → thêm tàu → thêm đối tác → thêm nhân sự, có thanh tiến độ.

---

## 4. CÔNG THỨC & LOGIC TÍNH TOÁN
*(Giải thích đơn giản cho marketing — đây là "bộ não" tạo niềm tin: phần mềm tính ĐÚNG và NHẤT QUÁN, có kiểm thử tự động.)*

| Chỉ tiêu | Công thức | Diễn giải |
|---|---|---|
| **VAT (thuế GTGT đặc thù)** | `8% × doanh thu − 10% × tiền dầu DO` | Doanh thu ưu tiên theo hóa đơn, nếu không có thì lấy thực tế |
| **Tiêu thụ dầu DO 1 chặng** | `Định mức (lít/giờ) × số giờ chạy` | Phát hiện thất thoát khi thực tế > định mức |
| **Chi phí dầu LO 1 chuyến** | `Giờ chạy × (phi thay + phi bổ sung) ÷ giờ chu kỳ × đơn giá` | Quy ra lít: `số phi × lít/phi` |
| **Chi phí cố định/chuyến** | `(Tổng chi phí cố định năm ÷ 365) × số ngày chuyến` | Lên đà, khấu hao, đăng kiểm, BH thân vỏ — chia đều theo ngày |
| **Tồn dầu DO** | `Tồn đầu + tổng cấp − tổng tiêu thụ` | Cảnh báo khi tồn âm (thất thoát/nhập sai) |
| **Chi phí tháng/chuyến** | Phân bổ theo **số ngày chạy** của chuyến trong tháng | Lương, bảo hiểm… chia công bằng giữa các chuyến |
| **Lợi nhuận ròng/chuyến** | `Doanh thu thực tế − Tổng chi phí` | Tổng chi phí = 15 khoản + VAT |
| **Biên lợi nhuận (%)** | `Lợi nhuận ÷ Doanh thu × 100` | Đo hiệu quả từng chuyến/tàu |
| **Thuế TNCN** | Biểu lũy tiến 7 bậc (5%→35%), giảm trừ bản thân 15,5tr + người phụ thuộc | Theo quy định thuế Việt Nam |

> **Điểm nhấn truyền thông:** *"Mọi công thức tài chính được viết MỘT lần, dùng chung toàn hệ thống, và có **bộ kiểm thử tự động** chạy mỗi lần cập nhật → con số luôn nhất quán, không sợ lệch như Excel."*

---

## 5. BẢO MẬT & PHÂN QUYỀN (điểm bán hàng quan trọng)

### 5.1. Ba cấp người dùng
| Vai trò | Quyền |
|---|---|
| **Chủ tài khoản (Owner)** | Toàn quyền: tài chính, lương, thêm/xóa nhân viên, cấu hình |
| **Kế toán (Accountant)** | Xem/sửa tài chính + lương (như chủ về dữ liệu tiền) |
| **Nhân viên (Sub)** | **Chỉ thấy phần được giao** (theo module + theo tàu); **KHÔNG thấy lương, không thấy doanh thu tài chính** |

### 5.2. Cam kết bảo mật (dùng cho nội dung quảng bá)
- **Mỗi công ty một không gian dữ liệu riêng biệt** (multi-tenant) — dữ liệu khách hàng này **không thể** chạm vào khách hàng khác.
- **Dữ liệu lương & số dư ngân hàng được khóa ở tầng máy chủ** — nhân viên có giỏi kỹ thuật cũng không lấy được.
- **Nhật ký thay đổi (Audit log):** ghi lại ai sửa gì, khi nào + nút **Hoàn tác** → minh bạch tuyệt đối.
- **Đăng nhập bằng email/mật khẩu**, chặn truy cập trái phép.
- **Sao lưu tự động** hằng ngày, không lo mất dữ liệu.

> ⚠️ *Lưu ý cho marketing:* chỉ nói **"bảo mật nhiều lớp, dữ liệu lương ẩn với nhân viên, cách ly từng công ty"** — chính xác và đủ mạnh. Không cần đi sâu kỹ thuật.

---

## 6. CÔNG NGHỆ & TRẢI NGHIỆM (dịch sang lợi ích)

| Công nghệ | Lợi ích cho khách |
|---|---|
| **Đám mây (Firebase)** | Dữ liệu an toàn, đồng bộ tức thì giữa văn phòng và tàu |
| **Hoạt động offline (PWA)** | Tàu mất sóng vẫn nhập được, có mạng tự đồng bộ lại |
| **Cài như ứng dụng** | Thêm vào màn hình điện thoại, mở nhanh như app thật |
| **Chống mất dữ liệu khi nhiều người sửa** | Gộp thông minh theo từng trường, không ai bị mất sửa đổi |
| **Đa thiết bị** | Máy tính văn phòng, điện thoại thuyền trưởng — cùng một dữ liệu |
| **Giao diện hiện đại (Dark mode)** | Sang trọng, dễ nhìn, có biểu đồ trực quan |
| **Chi phí hạ tầng gần như 0** | Giá bán cạnh tranh, không tốn máy chủ riêng |

---

## 7. MÔ HÌNH KINH DOANH & BẢNG GIÁ

**Mô hình:** Bán **license (key bản quyền)** — mỗi key dùng cho **một công ty**, kèm số tài khoản nhân viên theo gói.

| Gói | Đối tượng | Giới hạn | Giá tham khảo* |
|---|---|---|---|
| **Cơ bản** | Đội tàu nhỏ | 3 tàu · 3 nhân viên | 3.000.000đ/năm |
| **Doanh nghiệp** ⭐ | Đội tàu vừa | 10 tàu · 10 nhân viên | 6.000.000đ/năm |
| **Không giới hạn** | Đội tàu lớn | Không giới hạn | Liên hệ |

\* *Giá mẫu — phòng kinh doanh điều chỉnh theo chiến lược thực tế.*

**Trang giới thiệu (landing page):** đã có sẵn tại đường dẫn gốc của hệ thống, có nút "Dùng thử", bảng giá, nút gọi/Zalo.

---

## 8. ĐỊNH VỊ & LỢI THẾ CẠNH TRANH

### 8.1. So với Excel + sổ giấy (đối thủ thực tế của khách)
| | Excel/Giấy | ShipManage |
|---|---|---|
| Tính lãi/lỗ từng chuyến | Thủ công, dễ sai | Tự động, chính xác |
| Nhắc đăng kiểm | Tự nhớ | Tự cảnh báo |
| Nhiều người dùng | Gửi file qua lại | Đồng bộ real-time |
| Phân quyền | Không có | 3 cấp, ẩn lương |
| Mất dữ liệu | Rủi ro cao | Sao lưu đám mây |

### 8.2. So với phần mềm logistics quốc tế (CargoWise, Magaya…)
- Các phần mềm đó dành cho **forwarder/hãng tàu container quốc tế** — quá phức tạp, quá đắt, **không phù hợp** tàu hàng rời nội địa.
- ShipManage **chuyên sâu đúng nghiệp vụ tàu rời nội địa** mà các "ông lớn" không làm.

> **Thông điệp định vị:** *"Không phải phần mềm logistics quốc tế thu nhỏ — mà là công cụ SINH RA cho chủ tàu hàng rời Việt Nam."*

---

## 9. THÔNG ĐIỆP TRUYỀN THÔNG GỢI Ý

### 9.1. Tagline (chọn 1)
- *"Cả đội tàu trong lòng bàn tay."*
- *"Quản lý tàu hàng rời — đơn giản như mở điện thoại."*
- *"Hết Excel rối. Hết lo quên đăng kiểm. Hết mập mờ lãi lỗ."*

### 9.2. Thông điệp theo nỗi đau (content angle)
| Nỗi đau | Tiêu đề bài viết/quảng cáo |
|---|---|
| Lãi lỗ mập mờ | *"Chuyến vừa rồi tàu bạn LÃI hay LỖ? Biết chính xác sau 5 giây."* |
| Quên đăng kiểm | *"Tàu bị giữ vì hết hạn đăng kiểm — câu chuyện không còn xảy ra."* |
| Thất thoát dầu | *"Mỗi giờ chạy tốn bao nhiêu lít? Phần mềm trả lời thay bạn."* |
| Nhân viên xem lương | *"Nhân viên nhập liệu nhưng KHÔNG thấy lương ai — yên tâm tuyệt đối."* |
| Excel mất dữ liệu | *"Máy hỏng, mất file? Dữ liệu của bạn nằm an toàn trên đám mây."* |

### 9.3. Kênh đề xuất
- Hội nhóm chủ tàu/vận tải thủy trên Facebook, Zalo.
- Video demo ngắn (nhập 1 chuyến → ra ngay báo cáo lãi/lỗ).
- Bài viết "trước/sau" (Excel rối → Dashboard gọn).

---

## 10. CÂU HỎI THƯỜNG GẶP (FAQ)

**Có cần cài đặt máy chủ không?** Không. Chạy trên trình duyệt, dữ liệu trên đám mây.
**Mất mạng có dùng được không?** Có. Nhập offline, có mạng tự đồng bộ.
**Dùng trên điện thoại được không?** Được. Cài như app (PWA), giao diện responsive.
**Nhân viên có thấy lương người khác không?** Không. Lương bị khóa ở máy chủ với vai trò nhân viên.
**Dữ liệu công ty tôi có lẫn với công ty khác không?** Không. Mỗi công ty một không gian riêng biệt.
**Mua xong cài thế nào?** Nhận key bản quyền → đăng nhập → kích hoạt → làm theo checklist khởi tạo.
**Có hỗ trợ nhiều tàu không?** Có, tùy gói (3 / 10 / không giới hạn).

---

## 11. THUẬT NGỮ NGÀNH (giúp marketing viết đúng)

| Thuật ngữ | Nghĩa |
|---|---|
| **Tàu hàng rời (bulk)** | Tàu chở hàng đổ đống: cát, đá, than, clinker… |
| **Chuyến (Voyage – C1, C2…)** | Một lượt vận chuyển hàng từ cảng đi đến cảng đến |
| **Dầu DO** | Dầu Diesel chạy máy chính (nhiên liệu vận hành) |
| **Dầu LO (Lube Oil)** | Dầu nhờn bôi trơn máy, thay theo chu kỳ giờ chạy |
| **Định mức (lít/giờ)** | Lượng dầu DO tiêu hao chuẩn cho 1 giờ chạy |
| **Phi (phuy)** | Đơn vị thùng dầu LO (quy đổi ra lít) |
| **Lên đà** | Đưa tàu lên ụ sửa chữa/bảo dưỡng định kỳ |
| **Đăng kiểm** | Kiểm định an toàn kỹ thuật tàu (bắt buộc, có hạn) |
| **P&L (Profit & Loss)** | Báo cáo kết quả kinh doanh (lãi/lỗ) |
| **Công nợ phải thu/phải trả** | Tiền khách còn nợ / tiền mình còn nợ NCC |
| **Multi-tenant** | Một phần mềm phục vụ nhiều công ty, dữ liệu cách ly |
| **PWA** | Ứng dụng web cài được như app điện thoại |

---

## 12. ⚠️ ĐIỀU **KHÔNG NÊN** HỨA (tránh marketing quá đà)

Để tránh khách kỳ vọng sai → review xấu, **KHÔNG** nên truyền thông các ý sau:
- ❌ "Phần mềm vận tải biển **quốc tế** / quản lý **container** / **forwarder**" → SAI thị trường, sẽ bị so với CargoWise.
- ❌ "Quản lý vận đơn B/L, lịch tàu container, EDI hải quan" → phần mềm **không có** các nghiệp vụ này (và không cần, vì khách hàng rời nội địa không dùng).
- ❌ "Kế toán đa tiền tệ / chuẩn kiểm toán quốc tế" → phần mềm tập trung VND, nghiệp vụ tàu nội địa.
- ❌ Hứa "không bao giờ mất dữ liệu / bảo mật tuyệt đối 100%" → nói **"bảo mật nhiều lớp, sao lưu đám mây"** là đủ và an toàn pháp lý.

**Nói ĐÚNG là:** *"Phần mềm quản lý hành trình & tài chính cho đội tàu hàng rời, xà lan, vận tải thủy nội địa."*

---

*Tài liệu nội bộ phục vụ Marketing & Truyền thông. Mọi số liệu kỹ thuật đối chiếu trực tiếp từ mã nguồn sản phẩm.*
