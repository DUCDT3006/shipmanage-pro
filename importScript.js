const xlsx = require('xlsx');
const fs = require('fs');
const crypto = require('crypto');

const wb = xlsx.readFile('Theo doi tai chinh t4.5.xlsx');
const ws = wb.Sheets[wb.SheetNames[0]];
const rawData = xlsx.utils.sheet_to_json(ws, {header: 1});

function parseMessedUpDate(serial) {
    const utc_days = Math.floor(serial - 25569);
    const date = new Date(utc_days * 86400 * 1000);
    const excelDay = date.getUTCDate();
    const excelMonth = date.getUTCMonth() + 1;
    const excelYear = date.getUTCFullYear();
    return `${excelYear}-${String(excelDay).padStart(2, '0')}-${String(excelMonth).padStart(2, '0')}`;
}

const mapAccount = {
    'AB': 'ABbank',
    'CN': 'Tiền mặt',
    'VT': 'Vietinbank'
};

const transactions = [];

let headerRowIdx = -1;
for (let i=0; i<20; i++) {
    if (rawData[i] && rawData[i][0] === 'Ngày' && rawData[i][1] === 'Tàu') {
        headerRowIdx = i;
        break;
    }
}

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

    transactions.push({
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

let dataJs = fs.readFileSync('app/js/data.js', 'utf8');

let injectionCode = `                if (!localStorage.getItem('importedT45V3')) {
                    this.state.transactions = ${JSON.stringify(transactions, null, 4)};
                    localStorage.setItem('importedT45V3', 'true');
                    localStorage.setItem('transactionsClearedV1', 'true');
                    this.save();
                }`;

dataJs = dataJs.replace(/if \(!localStorage\.getItem\('transactionsClearedV1'\)\) \{[\s\S]*?this\.save\(\);\s*\}/, injectionCode);

fs.writeFileSync('app/js/data.js', dataJs);
console.log('Imported ' + transactions.length + ' transactions.');
