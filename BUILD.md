# Build & Kiến trúc — Lộ trình hiện đại hóa (task #22)

## Hiện tại
App là **vanilla JS, classic scripts** nạp theo thứ tự trong `app/index.html`:
`seed-data.js → data.js → calc.js → firebase.js → views.js → app.js`
Tất cả chia sẻ global scope (`AppData`, `Views`, `app`, `esc`, `Calc`...). Inline `onclick="app.x()"` khắp HTML.

## Đã làm (bước nền tảng — branch `arch-upgrade`)
- **package.json + esbuild**: `npm install` rồi `npm run build`.
- **`build.mjs`**: gộp 6 file (đúng thứ tự, cùng global scope) → minify → `app/dist/app.bundle.js` (911KB → ~557KB).
- Dùng bản build: trong `index.html` thay 6 thẻ `<script src="js/*.js">` bằng `<script src="dist/app.bundle.js">` (giữ Firebase SDK + Chart/XLSX CDN).
- **An toàn**: bundle giống hệt về hành vi (cùng global scope), không đụng logic.

## CÒN LẠI (làm dần, có giám sát — KHÔNG nên rush)
Đây là refactor lớn, đụng ~7000 dòng, nên làm **từng bước + test trình duyệt mỗi bước**:

1. **Tách `views.js` (2927 dòng)** thành nhiều file theo màn hình:
   `views/dashboard.js`, `views/financials.js`, `views/fuel.js`, `views/shipments.js`,
   `views/hr-salary.js`, `views/company.js`, `views/reports.js`...
   Mỗi file: `Object.assign(Views, { dashboard: (...) => `...` })`. Vẫn classic script, global `Views` giữ nguyên → **an toàn, không cần đổi gì khác**.
2. **Tách `app.js` (4111 dòng)** tương tự theo nhóm hành động (transactions, fuel, shipments, members, backup...).
3. **Chuyển sang ES Modules + Vite** (bước cuối, lớn nhất):
   - Mỗi file `export` object, `import` phụ thuộc thay vì global.
   - Inline `onclick="app.x()"` → cần `window.app = app` (hoặc chuyển sang addEventListener).
   - `vite.config.js` + `index.html` dùng `<script type="module">`.
   - Deploy: GitHub Pages serve `dist/` (build qua GitHub Action) thay vì serve trực tiếp.
   - Cân nhắc framework (Vue/Svelte) nếu muốn component thật + reactivity.

## Vì sao chưa làm hết bước 3
Chuyển toàn bộ sang ESM + đổi deploy là việc **nhiều ngày**, dễ làm vỡ bản live nếu vội. Nền tảng build ở trên cho phép bắt đầu dần mà **không phá** bản đang chạy (`main` vẫn dùng classic scripts).
