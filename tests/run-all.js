/**
 * Chạy toàn bộ test suite, gom kết quả, thoát mã 1 nếu có bất kỳ suite nào fail.
 * Dùng cho CI (GitHub Actions) và local: npm test
 */
const { spawnSync } = require('child_process');
const path = require('path');

const SUITES = [
  'sync.test.js',
  'calc.test.js',
  'backup.test.js',
  'idb.test.js',
  'data.test.js',
  'rules.sim.test.js',
];

let failed = 0;
const results = [];

for (const file of SUITES) {
  const full = path.join(__dirname, file);
  console.log('\n══════════════════════════════════════════');
  console.log('▶ ' + file);
  console.log('══════════════════════════════════════════');
  const r = spawnSync(process.execPath, [full], { stdio: 'inherit' });
  const ok = r.status === 0;
  if (!ok) failed++;
  results.push({ file, ok });
}

console.log('\n══════════════════════════════════════════');
console.log('  TỔNG KẾT');
console.log('══════════════════════════════════════════');
results.forEach(r => console.log(`  ${r.ok ? '✅' : '❌'} ${r.file}`));
console.log('──────────────────────────────────────────');
console.log(`  ${results.length - failed}/${results.length} suite PASS`);

if (failed > 0) {
  console.error(`\n❌ ${failed} suite THẤT BẠI`);
  process.exit(1);
}
console.log('\n✅ TẤT CẢ SUITE ĐỀU PASS');
