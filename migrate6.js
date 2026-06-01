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
    
    const meal = Number(row[5]) || 0;
    const phone = Number(row[6]) || 0;
    const clothing = Number(row[7]) || 0;
    const transport = Number(row[8]) || 0;
    const delivery = Number(row[9]) || 0;
    const bonus = 0;
    
    if (meal || phone || clothing || transport || delivery || bonus) {
        result[name] = {
            meal, phone, clothing, transport,
            deliveryAllowance: delivery,
            completionBonus: bonus
        };
    }
}

fs.writeFileSync('allowances.json', JSON.stringify(result, null, 2));

let datajs = fs.readFileSync('app/js/data.js', 'utf8');

const migrationBlock = `                this.state = JSON.parse(stored);

                if (!localStorage.getItem('allowances_extracted_v6')) {
                    const extractedAllowances = ${JSON.stringify(result)};
                    
                    if (this.state.employees) {
                        this.state.employees.forEach(emp => {
                            let match = extractedAllowances[emp.name];
                            if (!match) {
                                if (emp.name.includes('Đỗ Hữu Xuân') && extractedAllowances['Đỗ Hữu Xuần']) match = extractedAllowances['Đỗ Hữu Xuần'];
                                else if (emp.name.includes('Đỗ Hữu Xuân') && extractedAllowances['Đỗ Hữu Xoa']) match = extractedAllowances['Đỗ Hữu Xoa'];
                            }
                            
                            if (match) {
                                emp.mealAllowance = match.meal;
                                emp.phoneAllowance = match.phone;
                                emp.clothingAllowance = match.clothing;
                                emp.transportAllowance = match.transport;
                                emp.deliveryAllowance = match.deliveryAllowance;
                                emp.completionBonus = match.completionBonus;
                            }
                        });
                    }
                    localStorage.setItem('allowances_extracted_v6', 'true');
                    this.save();
                }
`;

datajs = datajs.replace(/                this\.state = JSON\.parse\(stored\);\n\n                if \(\!localStorage\.getItem\('allowances_extracted_v5'\)\) \{[\s\S]*?this\.save\(\);\n                \}/, migrationBlock);

fs.writeFileSync('app/js/data.js', datajs);
console.log('Migrated data.js with v6');
