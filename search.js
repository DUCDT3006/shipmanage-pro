const fs = require('fs');
const readline = require('readline');

async function searchTranscript() {
    const fileStream = fs.createReadStream('C:\\Users\\DELL\\.gemini\\antigravity\\brain\\7aa47a94-562e-4382-8cc8-8dce3dbb99d4\\.system_generated\\logs\\transcript.jsonl');

    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    for await (const line of rl) {
        if (line.includes('1500000') || line.includes('750000') || line.includes('VG15')) {
            const data = JSON.parse(line);
            if (data.type === 'USER_INPUT') {
                console.log('USER:', data.content);
            }
        }
    }
}

searchTranscript();
