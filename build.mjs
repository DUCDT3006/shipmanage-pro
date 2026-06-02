/**
 * Build production: gộp + minify các script (cùng global scope như khi nạp rời) -> 1 file.
 * Mục tiêu task #22 (bước nền tảng): giảm 6 request -> 1, minify, có pipeline build.
 * Thứ tự PHẢI giữ đúng phụ thuộc: seed-data -> data -> calc -> firebase -> views -> app.
 * Chạy: npm run build   (cần: npm install)
 */
import esbuild from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';

const ORDER = [
  'app/js/seed-data.js',
  'app/js/data.js',
  'app/js/calc.js',
  'app/js/firebase.js',
  'app/js/views.js',
  'app/js/app.js'
];

const concatenated = ORDER.map(f => `\n/* ===== ${f} ===== */\n` + readFileSync(f, 'utf8')).join('\n');

const result = await esbuild.transform(concatenated, {
  minify: true,
  legalComments: 'none',
  target: 'es2019'
});

mkdirSync('app/dist', { recursive: true });
writeFileSync('app/dist/app.bundle.js', result.code);

const rawKB = (Buffer.byteLength(concatenated) / 1024).toFixed(0);
const minKB = (Buffer.byteLength(result.code) / 1024).toFixed(0);
console.log(`✅ Build xong: app/dist/app.bundle.js  (${rawKB}KB -> ${minKB}KB minified)`);
console.log('   Để dùng bản build: trong index.html thay 6 thẻ <script src="js/*.js"> bằng 1 thẻ <script src="dist/app.bundle.js">');
console.log('   (Vẫn giữ Firebase SDK + Chart/XLSX CDN như cũ.)');
