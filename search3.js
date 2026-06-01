const fs = require('fs');
const readline = require('readline');

async function searchTranscript() {
    const fileStream = fs.createReadStream('C:\\Users\\DELL\\.gemini\\antigravity\\brain\\7aa47a94-562e-4382-8cc8-8dce3dbb99d4\\.system_generated\\logs\\transcript.jsonl');

    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    let found = false;
    for await (const line of rl) {
        if (line.includes('deliveryAllowance') && line.includes('750000')) {
            console.log('FOUND:', line.substring(0, 1000));
            found = true;
        }
    }
    
    if (!found) {
        // Just print any write_to_file or replace_file_content tool calls related to JS files from before my migration
        let count = 0;
        for await (const line of rl) {
            // Re-stream
        }
    }
}

searchTranscript();
