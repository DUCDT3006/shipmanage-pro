const XLSX = require('xlsx');
const fs = require('fs');
const crypto = require('crypto');

function generateId() {
    return 'TX' + crypto.randomUUID();
}

function parseDate(excelDate) {
    if (!excelDate) return null;
    if (typeof excelDate === 'number') {
        const date = XLSX.SSF.parse_date_code(excelDate);
        return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
    }
    // String dates like 13/4/2026
    if (typeof excelDate === 'string') {
        const parts = excelDate.split('/');
        if (parts.length === 3) {
            return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
        // Handle yyyy-mm-dd if any
        if (excelDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
            return excelDate;
        }
    }
    return null;
}

try {
    const workbook = XLSX.readFile('d:/01.VU GIA TAM/1.TAI CHINH/Antigravity/ShipManage/Theo doi tai chinh t4.5.xlsx');
    const sheet = workbook.Sheets['THU-CHI'];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    const newTransactions = [];
    
    // Start from row 10 (0-indexed, so row 11 in Excel is index 10)
    for (let i = 10; i < data.length; i++) {
        const row = data[i];
        if (!row || !row[0] || String(row[0]).includes('Tổng')) {
            break; // Stop at end or summary
        }
        
        const rawDate = sheet[XLSX.utils.encode_cell({r: i, c: 0})] ? sheet[XLSX.utils.encode_cell({r: i, c: 0})].v : '';
        const dateStr = parseDate(rawDate);
        if (!dateStr) continue;

        const vessel = row[1] ? String(row[1]).trim() : '';
        const category = row[3] ? String(row[3]).trim() : '';
        const content = row[4] ? String(row[4]).trim() : '';
        let thuStr = String(row[5]).replace(/[^\d]/g, '');
        let chiStr = String(row[6]).replace(/[^\d]/g, '');
        const thu = thuStr ? parseInt(thuStr, 10) : 0;
        const chi = chiStr ? parseInt(chiStr, 10) : 0;
        const account = row[7] ? String(row[7]).trim() : '';
        const partner = row[8] ? String(row[8]).trim() : '';

        newTransactions.push({
            id: generateId(),
            date: dateStr,
            vessel: vessel,
            category: category,
            partner: partner,
            content: content,
            thu: thu,
            chi: chi,
            account: account
        });
    }

    // Read app/js/data.js
    const dataJsPath = 'd:/01.VU GIA TAM/1.TAI CHINH/Antigravity/ShipManage/app/js/data.js';
    let dataJsContent = fs.readFileSync(dataJsPath, 'utf8');

    // Extract the existing DEFAULT_STATE using regex or string splitting
    const stateStart = dataJsContent.indexOf('const DEFAULT_STATE = {');
    const funcStart = dataJsContent.indexOf('const AppData = {');
    if (stateStart === -1 || funcStart === -1) {
        throw new Error('Could not parse data.js structure');
    }

    const beforeState = dataJsContent.substring(0, stateStart);
    const afterState = dataJsContent.substring(funcStart);
    
    const stateStr = dataJsContent.substring(stateStart, funcStart);
    
    // Evaluate DEFAULT_STATE
    // We need to isolate it to eval it
    let tempStr = stateStr.replace('const DEFAULT_STATE =', 'return');
    const getState = new Function(tempStr);
    const defaultState = getState();

    // Filter old transactions (keep before April 1, 2026)
    const oldTransactions = defaultState.transactions.filter(tx => tx.date < '2026-04-01');

    // Merge transactions
    const mergedTransactions = [...oldTransactions, ...newTransactions];

    // Replace the transactions array in the string
    // A safe way is to construct a new DEFAULT_STATE string or just regex replace inside stateStr
    // But generating it via JSON.stringify might break formatting or lose functions if any (though DEFAULT_STATE is data only).
    // Let's regex replace inside stateStr
    
    const txRegex = /transactions:\s*\[[\s\S]*?\],\s*fuelLogs:/;
    const newTxStr = 'transactions: ' + JSON.stringify(mergedTransactions, null, 8) + ',\n    fuelLogs:';
    
    let newStateStr = stateStr.replace(txRegex, newTxStr);
    
    // Write back
    fs.writeFileSync(dataJsPath, beforeState + newStateStr + afterState, 'utf8');
    
    console.log(`Successfully extracted ${newTransactions.length} new transactions.`);
    console.log(`Total transactions now: ${mergedTransactions.length}`);
} catch (error) {
    console.error('Error:', error);
}
