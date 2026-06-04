// excel-input.js
(function() {
    // Keep track of the original descriptor for HTMLInputElement.prototype.value
    const originalValueDescriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    
    // Custom formulas map to store raw formulas per input (to restore on focus)
    const formulaMap = new WeakMap();

    // Helper: evaluate formula or raw text safely
    function evaluateFormula(str) {
        if (typeof str !== 'string') return NaN;
        let expr = str.trim();
        if (expr.startsWith('=')) {
            expr = expr.substring(1).trim();
        }
        if (!expr) return 0;

        // Clean numbers in the expression:
        expr = expr.replace(/[\d.,]+/g, (match) => {
            const dotCount = (match.match(/\./g) || []).length;
            const commaCount = (match.match(/,/g) || []).length;

            if (dotCount > 0 && commaCount > 0) {
                // Both present: standardise to English decimal dot format
                if (match.indexOf('.') < match.indexOf(',')) {
                    // E.g. 1.200.000,50
                    return match.replace(/\./g, '').replace(/,/g, '.');
                } else {
                    // E.g. 1,200,000.50
                    return match.replace(/,/g, '');
                }
            } else if (dotCount > 0) {
                // Only dots
                if (dotCount > 1) {
                    return match.replace(/\./g, '');
                } else {
                    // Single dot. Treat as thousands separator if followed by exactly 3 digits (e.g. 27.000)
                    if (/^\d+\.\d{3}$/.test(match)) {
                        return match.replace(/\./g, '');
                    }
                    return match;
                }
            } else if (commaCount > 0) {
                // Only commas
                if (commaCount > 1) {
                    return match.replace(/,/g, '');
                } else {
                    // Single comma. Treat as thousands separator if followed by exactly 3 digits (e.g. 21,885)
                    if (/^\d+,\d{3}$/.test(match)) {
                        return match.replace(/,/g, '');
                    }
                    return match.replace(/,/g, '.');
                }
            }
            return match;
        });

        // Strip spaces
        expr = expr.replace(/\s+/g, '');

        // Safe arithmetic character validation
        if (!/^[0-9.+\-*/()]*$/.test(expr)) {
            return NaN;
        }

        try {
            const fn = new Function(`return (${expr});`);
            const result = fn();
            return typeof result === 'number' && isFinite(result) ? result : NaN;
        } catch (e) {
            return NaN;
        }
    }

    // Helper: format number with dot thousands separator and comma decimal separator
    function formatNumber(num) {
        if (num === null || num === undefined || isNaN(num) || num === '') return '';
        const parts = num.toString().split('.');
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        if (parts[1] !== undefined) {
            let dec = parts[1].substring(0, 4); // max 4 decimal digits
            while (dec.endsWith('0') && dec.length > 0) {
                dec = dec.slice(0, -1);
            }
            return dec.length > 0 ? parts[0] + ',' + dec : parts[0];
        }
        return parts[0];
    }

    if (originalValueDescriptor) {
        // Override value descriptor on HTMLInputElement
        Object.defineProperty(HTMLInputElement.prototype, 'value', {
            get: function() {
                try {
                    if (this.dataset.excelInput === 'true') {
                        const rawVal = originalValueDescriptor.get.call(this);
                        const evalVal = evaluateFormula(rawVal);
                        if (!isNaN(evalVal)) {
                            return evalVal.toString();
                        }
                        return isNaN(evalVal) && (rawVal.startsWith('=') || /[\+\-\*\/]/.test(rawVal)) ? '' : '';
                    }
                } catch (err) {
                    console.error('Error in excel input value getter:', err);
                }
                return originalValueDescriptor.get.call(this);
            },
            set: function(val) {
                try {
                    if (this.dataset.excelInput === 'true') {
                        const strVal = String(val === null || val === undefined ? '' : val);
                        if (strVal.startsWith('=') || /[\+\-\*\/]/.test(strVal)) {
                            formulaMap.set(this, strVal);
                            const evalVal = evaluateFormula(strVal);
                            if (!isNaN(evalVal)) {
                                this.style.borderColor = '';
                                originalValueDescriptor.set.call(this, formatNumber(evalVal));
                            } else {
                                this.style.borderColor = 'var(--rose-light)';
                                originalValueDescriptor.set.call(this, strVal);
                            }
                        } else {
                            formulaMap.delete(this);
                            this.style.borderColor = '';
                            const evalVal = evaluateFormula(strVal);
                            originalValueDescriptor.set.call(this, isNaN(evalVal) ? '' : formatNumber(evalVal));
                        }
                        return;
                    }
                } catch (err) {
                    console.error('Error in excel input value setter:', err);
                }
                originalValueDescriptor.set.call(this, val);
            }
        });
    }

    // Delegate focusin and focusout events
    document.addEventListener('focusin', function(e) {
        try {
            const input = e.target;
            if (input && input.tagName === 'INPUT' && input.dataset.excelInput === 'true' && originalValueDescriptor) {
                // Restore formula if exists, or show raw number without thousands dots
                const formula = formulaMap.get(input);
                if (formula) {
                    originalValueDescriptor.set.call(input, formula);
                } else {
                    const currentFormatted = originalValueDescriptor.get.call(input);
                    const clean = currentFormatted.replace(/\./g, '').replace(/,/g, '.');
                    originalValueDescriptor.set.call(input, clean);
                }
            }
        } catch (err) {
            console.error('Error on focusin:', err);
        }
    });

    document.addEventListener('focusout', function(e) {
        try {
            const input = e.target;
            if (input && input.tagName === 'INPUT' && input.dataset.excelInput === 'true' && originalValueDescriptor) {
                const rawVal = originalValueDescriptor.get.call(input);
                const evalVal = evaluateFormula(rawVal);
                if (!isNaN(evalVal)) {
                    input.style.borderColor = '';
                    if (rawVal.startsWith('=') || /[\+\-\*\/]/.test(rawVal)) {
                        formulaMap.set(input, rawVal);
                    } else {
                        formulaMap.delete(input);
                    }
                    originalValueDescriptor.set.call(input, formatNumber(evalVal));
                } else {
                    if (rawVal.trim() !== '' && (rawVal.startsWith('=') || /[\+\-\*\/]/.test(rawVal))) {
                        input.style.borderColor = 'var(--rose-light)';
                        formulaMap.set(input, rawVal);
                        originalValueDescriptor.set.call(input, rawVal);
                    } else {
                        input.style.borderColor = '';
                        originalValueDescriptor.set.call(input, '');
                        formulaMap.delete(input);
                    }
                }
                
                // Trigger input event so that any listeners (e.g. app.calcShipmentFinance) receive the updated value
                const event = new Event('input', { bubbles: true });
                input.dispatchEvent(event);
                const changeEvent = new Event('change', { bubbles: true });
                input.dispatchEvent(changeEvent);
            }
        } catch (err) {
            console.error('Error on focusout:', err);
        }
    });

    // Initialize inputs dynamically
    function setupInput(input) {
        try {
            if (!originalValueDescriptor) return;
            if (input.dataset.excelInput === 'true') return;
            
            // Mark as Excel input
            input.dataset.excelInput = 'true';
            
            // Save initial value
            const initialVal = originalValueDescriptor.get.call(input);
            
            // Change type to text so user can enter symbols/dots
            input.type = 'text';
            input.inputMode = 'text'; // Allow text keyboard so they can type operators + - * / and dots
            
            // Right-align inputs for numeric/money formatting
            input.style.textAlign = 'right';
            
            // Format initial value
            const evalVal = evaluateFormula(initialVal);
            if (!isNaN(evalVal) && initialVal !== '') {
                originalValueDescriptor.set.call(input, formatNumber(evalVal));
            }
        } catch (err) {
            console.error('Error setting up excel input:', err);
        }
    }

    // Observe insertions of input elements
    const observer = new MutationObserver(function(mutations) {
        try {
            mutations.forEach(function(mutation) {
                mutation.addedNodes.forEach(function(node) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        if (node.tagName === 'INPUT' && (node.type === 'number' || node.getAttribute('type') === 'number')) {
                            setupInput(node);
                        }
                        const subInputs = node.querySelectorAll('input[type="number"]');
                        subInputs.forEach(setupInput);
                    }
                });
            });
        } catch (err) {
            console.error('MutationObserver error:', err);
        }
    });

    // Observe body for inputs
    observer.observe(document.documentElement, {
        childList: true,
        subtree: true
    });

    // Also process existing inputs on DOM load
    function initExisting() {
        document.querySelectorAll('input[type="number"]').forEach(setupInput);
    }
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initExisting);
    } else {
        initExisting();
    }
})();
