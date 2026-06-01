const XLSX = require('xlsx');
const fs = require('fs');
const crypto = require('crypto');
const vm = require('vm');

const newTransactions = [
    { date: '27/5/2026', vessel: 'VP', voyage: '', category: 'Văn phòng', content: 'Rút tiền đưa Ông', thu: '', chi: 400000000, account: 'VT' },
    { date: '27/5/2026', vessel: 'VG15', voyage: 'C10', category: '2.Chi Phí Cảng', content: 'Cầu bến tại Huế', thu: '', chi: 18571540, account: 'VT' },
    { date: '27/5/2026', vessel: 'VP', voyage: '', category: 'Luân chuyển', content: 'Chuyển tk Tùng', thu: '', chi: 1399956900, account: 'VT' },
    { date: '27/5/2026', vessel: 'VP', voyage: '', category: 'Luân chuyển', content: 'Chuyển tk Tùng', thu: 1399956900, chi: '', account: 'CN' },
    { date: '27/5/2026', vessel: 'VP', voyage: '', category: '3.Lương', content: 'Lương C Phương Tháng 4', thu: '', chi: 20000000, account: 'CN' },
    { date: '27/5/2026', vessel: 'VP', voyage: '', category: '3.Lương', content: 'Lương Tùng Tháng 4', thu: '', chi: 40000000, account: 'CN' },
    { date: '27/5/2026', vessel: 'VP', voyage: '', category: '3.Lương', content: 'Lương Vĩnh Tháng 4', thu: '', chi: 67450000, account: 'CN' },
    { date: '27/5/2026', vessel: 'VG05', voyage: '', category: '3.Lương', content: 'Lương thuyền Viên Tháng 4', thu: '', chi: 199869500, account: 'CN' },
    { date: '27/5/2026', vessel: 'VG09', voyage: '', category: '3.Lương', content: 'Lương thuyền Viên Tháng 4', thu: '', chi: 204731500, account: 'CN' },
    { date: '27/5/2026', vessel: 'VG15', voyage: '', category: '3.Lương', content: 'Lương thuyền Viên Tháng 4', thu: '', chi: 202571500, account: 'CN' },
    { date: '27/5/2026', vessel: 'VG18', voyage: '', category: '3.Lương', content: 'Lương thuyền Viên Tháng 4', thu: '', chi: 223093500, account: 'CN' },
    { date: '27/5/2026', vessel: 'VG36', voyage: '', category: '3.Lương', content: 'Lương thuyền Viên Tháng 4', thu: '', chi: 198776167, account: 'CN' },
    { date: '27/5/2026', vessel: 'VG15', voyage: '', category: '3.Lương', content: 'Thu tiền ứng trước Lưu Quang Trường (ất)', thu: 4000000, chi: '', account: 'CN' },
    { date: '27/5/2026', vessel: 'VG09', voyage: '', category: '3.Lương', content: 'Thu tiền ứng trước Lê Ngọc Anh', thu: 2000000, chi: '', account: 'CN' },
    { date: '27/5/2026', vessel: 'VG36', voyage: '', category: '3.Lương', content: 'Thu tiền ứng trước Danh', thu: 5000000, chi: '', account: 'CN' },
    { date: '27/5/2026', vessel: 'VG15', voyage: '', category: '3.Lương', content: 'Ứng lương Lê Ngọc Hoa', thu: '', chi: 5000000, account: 'CN' },
    { date: '27/5/2026', vessel: 'VG18', voyage: '', category: '3.Lương', content: 'Ứng lương Lê Văn Hùng', thu: '', chi: 10000000, account: 'CN' },
    { date: '27/5/2026', vessel: 'VG18', voyage: '', category: '3.Lương', content: 'Ứng lương Châu', thu: '', chi: 5000000, account: 'CN' }
];

function writeCell(ws, r, c, val) {
    const cellRef = XLSX.utils.encode_cell({ r, c });
    if (val === '' || val === undefined || val === null) {
        delete ws[cellRef];
        return;
    }
    if (typeof val === 'number') {
        ws[cellRef] = { t: 'n', v: val };
    } else if (typeof val === 'boolean') {
        ws[cellRef] = { t: 'b', v: val };
    } else {
        ws[cellRef] = { t: 's', v: String(val) };
    }
}

function appendToExcel(filePath) {
    console.log(`\nAppending to Excel file: ${filePath}`);
    const wb = XLSX.readFile(filePath);
    const ws = wb.Sheets['THU-CHI'] || wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    
    // Find the last row with a date (Column A / index 0)
    let lastRow = 10;
    for (let i = 10; i < data.length; i++) {
        const row = data[i];
        if (row && row[0]) {
            lastRow = i + 1;
        }
    }
    console.log(`Last transaction row found in Excel: Row ${lastRow}`);
    
    // Append the 18 new rows starting from lastRow (index lastRow)
    let currentRow = lastRow;
    newTransactions.forEach(t => {
        writeCell(ws, currentRow, 0, t.date);
        writeCell(ws, currentRow, 1, t.vessel);
        writeCell(ws, currentRow, 2, t.voyage);
        writeCell(ws, currentRow, 3, t.category);
        writeCell(ws, currentRow, 4, t.content);
        writeCell(ws, currentRow, 5, t.thu);
        writeCell(ws, currentRow, 6, t.chi);
        writeCell(ws, currentRow, 7, t.account);
        writeCell(ws, currentRow, 8, ''); // partner is empty in Excel
        currentRow++;
    });
    
    // Update ws['!ref'] if needed
    const range = XLSX.utils.decode_range(ws['!ref']);
    if (range.e.r < currentRow - 1) {
        range.e.r = currentRow - 1;
        ws['!ref'] = XLSX.utils.encode_range(range);
    }
    console.log(`Updated range: ${ws['!ref']}`);
    
    // Write back file
    XLSX.writeFile(wb, filePath);
    console.log(`Excel file successfully updated and saved!`);
}

function parseMessedUpDate(serial) {
    const utc_days = Math.floor(serial - 25569);
    const date = new Date(utc_days * 86400 * 1000);
    const excelDay = date.getUTCDate();
    const excelMonth = date.getUTCMonth() + 1;
    const excelYear = date.getUTCFullYear();
    return `${excelYear}-${String(excelMonth).padStart(2, '0')}-${String(excelDay).padStart(2, '0')}`;
}

const mapAccount = {
    'AB': 'ABbank',
    'CN': 'Tiền mặt',
    'VT': 'Vietinbank'
};

function importLedger() {
    console.log('\nParsing updated transactions from Theo doi tai chinh t4.5.xlsx...');
    const wb = XLSX.readFile('Theo doi tai chinh t4.5.xlsx');
    const ws = wb.Sheets['THU-CHI'];
    const rawData = XLSX.utils.sheet_to_json(ws, { header: 1 });
    
    let headerRowIdx = -1;
    for (let i = 0; i < 20; i++) {
        if (rawData[i] && rawData[i][0] === 'Ngày' && rawData[i][1] === 'Tàu') {
            headerRowIdx = i;
            break;
        }
    }
    
    const parsedTransactions = [];
    
    for (let i = headerRowIdx + 1; i < rawData.length; i++) {
        const row = rawData[i];
        if (!row || !row[0]) continue;
        
        if (typeof row[0] !== 'number' && typeof row[0] !== 'string') continue;
        if (row[0] === 'Ngày') continue;
        
        let date = '';
        if (typeof row[0] === 'number') {
            date = parseMessedUpDate(row[0]);
        } else {
            const parts = String(row[0]).split('/');
            if (parts.length === 3) {
                date = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            } else {
                date = String(row[0]);
            }
        }
        
        let vessel = row[1] || '';
        if (vessel === 'VG 36') vessel = 'VG36';
        if (vessel === 'VG 18') vessel = 'VG18';
        if (vessel === 'VG 15') vessel = 'VG15';
        if (vessel === 'VG 09') vessel = 'VG09';
        
        let chuyenHD = row[2] || '';
        let category = row[3] || '';
        let content = row[4] || '';
        let thu = Number(row[5]) || 0;
        let chi = Number(row[6]) || 0;
        let accountCode = row[7] || '';
        let partner = row[8] || '';
        
        let account = mapAccount[accountCode] || accountCode;
        
        let voyageNo = '';
        let contractNo = '';
        
        if (chuyenHD) {
            voyageNo = 'C' + chuyenHD;
            if (category === 'CVC') {
                contractNo = 'HD' + chuyenHD;
            }
        }
        
        parsedTransactions.push({
            id: 'TX' + crypto.randomUUID(),
            date: date,
            vessel: vessel,
            category: category,
            voyageNo: voyageNo,
            contractNo: contractNo,
            partner: partner,
            content: content,
            thu: thu,
            chi: chi,
            account: account
        });
    }
    
    console.log(`Parsed ${parsedTransactions.length} transactions from Excel.`);
    
    // Load app/js/data.js
    let dataJs = fs.readFileSync('app/js/data.js', 'utf8');
    
    // We want to replace the importedT45V4 block to importedT45V5
    const blockRegex = /if \(!localStorage\.getItem\('importedT45V4'\)\) \{[\s\S]*?this\.save\(\);\s*\}/;
    
    const newBlockCode = `if (!localStorage.getItem('importedT45V5')) {
                    this.state.transactions = ${JSON.stringify(parsedTransactions, null, 4)};
                    localStorage.setItem('importedT45V5', 'true');
                    localStorage.setItem('transactionsClearedV1', 'true');
                    this.save();
                }`;
                
    if (blockRegex.test(dataJs)) {
        dataJs = dataJs.replace(blockRegex, newBlockCode);
        console.log('Successfully replaced importedT45V4 block with importedT45V5!');
    } else {
        console.error('ERROR: Could not find importedT45V4 block in data.js');
        process.exit(1);
    }
    
    fs.writeFileSync('app/js/data.js', dataJs, 'utf8');
    console.log('data.js updated and written to file!');
}

function verifyDataJs() {
    console.log('\nVerifying updated data.js in VM...');
    const mockLocalStorage = {
        store: {},
        getItem(key) { return this.store[key] || null; },
        setItem(key, value) { this.store[key] = String(value); }
    };
    const sandbox = {
        window: {},
        localStorage: mockLocalStorage,
        console,
        Uint8Array,
        TextDecoder,
        process,
        setTimeout,
        setInterval
    };
    try {
        const dataJs = fs.readFileSync('app/js/data.js', 'utf8');
        const context = vm.createContext(sandbox);
        const result = vm.runInContext(dataJs + '\n; ({ AppData, DEFAULT_STATE });', context);
        mockLocalStorage.store['shipManageDB_v2'] = JSON.stringify(result.DEFAULT_STATE);
        result.AppData.init();
        
        console.log('SUCCESS: data.js is syntax-error-free and runs perfectly!');
        console.log('Total transactions in database after migration:', result.AppData.state.transactions.length);
        
        // Print the newly added transactions
        const newAdded = result.AppData.state.transactions.filter(t => t.date === '2026-05-27');
        console.log(`Newly added transactions count (2026-05-27): ${newAdded.length}`);
    } catch (e) {
        console.error('FAILED: Verification failed with error:', e);
        process.exit(1);
    }
}

// Run the pipeline
appendToExcel('Theo doi tai chinh t4.5.xlsx');
appendToExcel('03.Theo doi tai chinh.xlsx');
importLedger();
verifyDataJs();
