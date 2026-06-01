const fs = require('fs');
const vm = require('vm');

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
    
    console.log('DEFAULT_STATE keys:', Object.keys(result.DEFAULT_STATE));
    console.log('DEFAULT_STATE.transactions length:', result.DEFAULT_STATE.transactions.length);
    console.log('DEFAULT_STATE.shipments length:', result.DEFAULT_STATE.shipments.length);
    console.log('DEFAULT_STATE.employees length:', result.DEFAULT_STATE.employees.length);
    
    // Print first 3 transactions
    if (result.DEFAULT_STATE.transactions.length > 0) {
        console.log('First 3 transactions in DEFAULT_STATE:');
        console.log(result.DEFAULT_STATE.transactions.slice(0, 3));
    }
} catch (e) {
    console.error('FAILED:', e);
}
