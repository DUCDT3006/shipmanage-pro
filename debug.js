const xlsx = require('xlsx');

try {
    const workbook = xlsx.readFile('Bang luong 2026 - Copy.xlsx');
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    
    const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
    
    for (let i = 0; i < 20; i++) {
        console.log(`Row ${i}:`, data[i]);
    }
} catch (e) {
    console.error(e);
}
