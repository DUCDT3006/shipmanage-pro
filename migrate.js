const fs = require('fs');

const allowances = require('./allowances.json');
let datajs = fs.readFileSync('app/js/data.js', 'utf8');

const migrationBlock = `
                if (!localStorage.getItem('allowances_extracted_v1')) {
                    const extractedAllowances = ${JSON.stringify(allowances, null, 24).trim()};
                    
                    if (this.state.employees) {
                        this.state.employees.forEach(emp => {
                            // Try exact match
                            let match = extractedAllowances[emp.name];
                            
                            // Try approximate matching for typos
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
                    localStorage.setItem('allowances_extracted_v1', 'true');
                    this.save();
                }
`;

datajs = datajs.replace(
    `                // Initialize new allowance fields\r\n                if (this.state.employees) {\r\n                    this.state.employees.forEach(emp => {\r\n                        if (emp.mealAllowance === undefined) emp.mealAllowance = 0;\r\n                        if (emp.phoneAllowance === undefined) emp.phoneAllowance = 0;\r\n                        if (emp.clothingAllowance === undefined) emp.clothingAllowance = 0;\r\n                        if (emp.transportAllowance === undefined) emp.transportAllowance = 0;\r\n                    });\r\n                }`,
    `                // Initialize new allowance fields\n                if (this.state.employees) {\n                    this.state.employees.forEach(emp => {\n                        if (emp.mealAllowance === undefined) emp.mealAllowance = 0;\n                        if (emp.phoneAllowance === undefined) emp.phoneAllowance = 0;\n                        if (emp.clothingAllowance === undefined) emp.clothingAllowance = 0;\n                        if (emp.transportAllowance === undefined) emp.transportAllowance = 0;\n                    });\n                }\n${migrationBlock}`
);

fs.writeFileSync('app/js/data.js', datajs);
console.log('Migrated data.js');
