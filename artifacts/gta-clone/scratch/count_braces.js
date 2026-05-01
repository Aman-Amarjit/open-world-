import fs from 'fs';
const content = fs.readFileSync('c:/Users/dibya/OneDrive/Desktop/open-world-1/open-world-1/artifacts/gta-clone/src/game/ai.ts', 'utf8');
let open = 0;
let lines = content.split('\n');
for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    for (let char of line) {
        if (char === '{') open++;
        if (char === '}') open--;
    }
    if (open < 0) {
        console.log(`Extra closing brace at line ${i + 1}`);
        open = 0;
    }
    if (i > 1380 && i < 1390) {
        console.log(`Line ${i + 1}: open braces = ${open}`);
    }
}
if (open > 0) {
    console.log(`Missing ${open} closing braces at end of file`);
}
