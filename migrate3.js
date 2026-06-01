const fs = require('fs');

const allowances = require('./allowances.json');
let datajs = fs.readFileSync('app/js/data.js', 'utf8');

const migrationBlock = `                this.state = JSON.parse(stored);

                if (!localStorage.getItem('allowances_extracted_v4')) {
                    const extractedAllowances = ${JSON.stringify(allowances)};
                    
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
                            }
                        });
                    }
                    localStorage.setItem('allowances_extracted_v4', 'true');
                    this.save();
                }
`;

datajs = datajs.replace('                this.state = JSON.parse(stored);', migrationBlock);

fs.writeFileSync('app/js/data.js', datajs);
console.log('Migrated data.js with v4');
