const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const bootstrapPath = path.join(projectRoot, 'bootstrap.html');
const indexPath = path.join(projectRoot, 'index.html');
const allCarsPath = path.join(__dirname, 'AllCars.json');

function findObjectRange(content, startIdx) {
    // find first '{' after startIdx
    const firstBrace = content.indexOf('{', startIdx);
    if (firstBrace === -1) return null;

    let i = firstBrace;
    let depth = 0;
    let inString = false;
    let stringChar = null;
    let escaped = false;

    for (; i < content.length; i++) {
        const ch = content[i];
        if (inString) {
            if (escaped) {
                escaped = false;
            } else if (ch === '\\') {
                escaped = true;
            } else if (ch === stringChar) {
                inString = false;
                stringChar = null;
            }
            continue;
        }

        if (ch === '"' || ch === "'") {
            inString = true;
            stringChar = ch;
            continue;
        }

        if (ch === '{') depth++;
        else if (ch === '}') {
            depth--;
            if (depth === 0) {
                return { start: firstBrace, end: i };
            }
        }
    }

    return null;
}

function main() {
    if (!fs.existsSync(bootstrapPath)) {
        console.error('bootstrap.html not found at', bootstrapPath);
        process.exit(1);
    }
    if (!fs.existsSync(allCarsPath)) {
        console.error('AllCars.json not found at', allCarsPath);
        process.exit(1);
    }

    const bootstrap = fs.readFileSync(bootstrapPath, 'utf8');
    // Step 1: clear index.html and copy bootstrap.html into it
    let newIndex = bootstrap;

    // Step 2: locate `const jsonData` in the copied content
    const jsonMarker = 'const jsonData';
    const markerIdx = newIndex.indexOf(jsonMarker);
    if (markerIdx === -1) {
        console.error('Could not find "const jsonData" marker in bootstrap.html');
        // still write bootstrap to index so index is updated
        fs.writeFileSync(indexPath, newIndex, 'utf8');
        process.exit(1);
    }

    const objRange = findObjectRange(newIndex, markerIdx);
    if (!objRange) {
        console.error('Failed to locate the jsonData object range in bootstrap.html');
        fs.writeFileSync(indexPath, newIndex, 'utf8');
        process.exit(1);
    }

    // Read AllCars.json and stringify with indentation
    const allCarsRaw = fs.readFileSync(allCarsPath, 'utf8');
    let parsed;
    try {
        parsed = JSON.parse(allCarsRaw);
    } catch (e) {
        console.error('AllCars.json is not valid JSON:', e.message);
        process.exit(1);
    }

    const replacement = JSON.stringify(parsed, null, 2);

    // Find '=' after 'const jsonData' to know where assignment begins
    const eqPos = newIndex.indexOf('=', markerIdx);
    if (eqPos === -1) {
        console.error('Could not find assignment operator for jsonData');
        fs.writeFileSync(indexPath, newIndex, 'utf8');
        process.exit(1);
    }

    const replaceStart = eqPos + 1; // start replacing after '='
    const replaceEnd = objRange.end + 1; // include closing brace

    const composed = newIndex.slice(0, replaceStart) + '\n' + replacement + ';' + newIndex.slice(replaceEnd);

    // Write composed content to index.html
    fs.writeFileSync(indexPath, composed, 'utf8');
    console.log('index.html cleared, updated with latest bootstrap.html and AllCars.json data');
}

main();
