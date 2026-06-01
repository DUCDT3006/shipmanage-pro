const fs = require('fs');
let dataJs = fs.readFileSync('app/js/data.js', 'utf8');

// Find the block of importedT45V3
let blockStart = dataJs.indexOf("if (!localStorage.getItem('importedT45V3')) {");
if (blockStart === -1) {
    console.log("Could not find importedT45V3 block");
    process.exit(1);
}

// Find the end of the JSON array injection. It ends where the save() block or localStorage...
let blockEnd = dataJs.indexOf("this.state.transactions = [];", blockStart);
if (blockEnd === -1) {
    blockEnd = dataJs.indexOf("if (!this.state.transactions)", blockStart);
}

if (blockEnd === -1) {
    console.log("Could not find end of block");
    process.exit(1);
}

let block = dataJs.substring(blockStart, blockEnd);

// Replace accounts
block = block.replace(/"account": "Vietinbank"/g, '"account": "Viettinbank"');
block = block.replace(/"account": "Tiền mặt"/g, '"account": "Tài khoản cá nhân"');

// Wait! If the user wants to re-trigger the import, we need to change importedT45V3 to importedT45V4
block = block.replace(/'importedT45V3'/g, "'importedT45V4'");

dataJs = dataJs.substring(0, blockStart) + block + dataJs.substring(blockEnd);
fs.writeFileSync('app/js/data.js', dataJs);
console.log("Successfully fixed accounts.");
