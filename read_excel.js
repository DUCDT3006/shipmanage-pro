const XLSX = require('xlsx');

const workbook = XLSX.readFile('Bang luong 2026 - Copy.xlsx');
console.log('Sheets:', workbook.SheetNames);

workbook.SheetNames.forEach(sheetName => {
    console.log(`\n--- Sheet: ${sheetName} ---`);
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    // print first 10 rows
    for (let i = 0; i < Math.min(10, data.length); i++) {
        console.log(`Row ${i}:`, data[i]);
    }
});
