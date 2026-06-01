const fs = require('fs');
const xlsx = require('xlsx');

const workbook = xlsx.readFile('Bang luong 2026 - Copy.xlsx');
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });

const result = {};
for (let i = 2; i < data.length; i++) {
    const row = data[i];
    if (!row || !row[1]) continue;
    
    const name = String(row[1]).trim();
    if (name === 'Họ và tên' || name === 'BỘ PHẬN QUẢN LÝ' || name === 'CỘNG' || name.startsWith('TÀU VŨ GIA')) continue;
    
    // As determined: 
    // E (4) -> meal
    // F (5) -> phone
    // G (6) -> clothing
    // H (7) -> transport
    // I (8) -> deliveryAllowance
    // J (9) -> completionBonus
    const meal = Number(row[4]) || 0;
    const phone = Number(row[5]) || 0;
    const clothing = Number(row[6]) || 0;
    const transport = Number(row[7]) || 0;
    const delivery = Number(row[8]) || 0;
    const bonus = Number(row[9]) || 0;
    
    if (meal || phone || clothing || transport || delivery || bonus) {
        result[name] = {
            meal, phone, clothing, transport,
            deliveryAllowance: delivery,
            completionBonus: bonus
        };
    }
}

fs.writeFileSync('allowances.json', JSON.stringify(result, null, 2));
console.log('DONE');
