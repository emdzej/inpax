const fs = require('fs');
const path = require('path');

function parseIPO(filePath) {
    const buffer = fs.readFileSync(filePath);
    let offset = 0;

    console.log(`\n--- Analyzing ${path.basename(filePath)} ---`);

    // Helper to read strings
    function readString() {
        let end = buffer.indexOf(0x0a, offset);
        if (end === -1) return null;
        const str = buffer.toString('utf8', offset, end);
        offset = end + 1;
        return str;
    }

    // 1. Header
    const len = buffer[offset]; // 0x05
    offset++;
    const signature = buffer.toString('utf8', offset, offset + len);
    offset += len + 1; // +1 for 0x0a
    console.log(`Signature: ${signature}`);

    // Scan for sections
    // We look for known section headers by text search in buffer to find offsets
    const globalDataHeader = "Global Data";
    const constantDataHeader = "Constant Data";
    
    const globalDataOffset = buffer.indexOf(globalDataHeader);
    const constantDataOffset = buffer.indexOf(constantDataHeader);

    // Parse Constants
    const constants = [];
    if (constantDataOffset !== -1) {
        let cOffset = constantDataOffset + constantDataHeader.length + 1; // Skip header + 0a
        // Skip some bytes? It seems there's 00 00 00 00 0a 0a pattern.
        while(buffer[cOffset] === 0 || buffer[cOffset] === 0x0a) cOffset++;
        
        console.log("Constants found:");
        let idx = 0;
        while (cOffset < buffer.length) {
            const type = buffer[cOffset];
            cOffset++;
            
            if (type === 0x03) { // Int
                // Check if it's 2 bytes or 4 bytes? Usually int is 2 bytes in INPA? 
                // Based on hex dump: 03 0a 00 -> 10. Looks like little endian 2 bytes?
                // Or maybe variable length?
                // Let's assume 2 bytes for now based on '0a 00'.
                // But wait, test_arithmetic has '03 03 00' -> 3.
                // It seems to be Type (1) + Value (Var).
                
                // Heuristic: Read until next known type or valid boundary? 
                // This is risky. Let's look at value.
                
                // Actually, let's look at the dump again.
                // 03 0a 00 -> 0a 00 is 10.
                // 03 03 00 -> 03 00 is 3.
                // 03 ff 00 -> ff 00 is 255.
                // 03 05 00 -> 5.
                // 03 01 00 -> 1.
                // It seems to be 2 bytes for Int.
                
                const val = buffer.readInt16LE(cOffset);
                constants.push({ type: 'int', val: val, idx: idx++ });
                console.log(`  [${idx-1}] Int: ${val}`);
                cOffset += 2;
            } else if (type === 0x06) { // String
               // String format: 06 [chars] 0a? or 06 [len]?
               // Dump: 06 69 6e 70 61 2e 68 0a -> "inpa.h\n"
               // It reads until 0a.
               let end = buffer.indexOf(0x0a, cOffset);
               const str = buffer.toString('utf8', cOffset, end);
               constants.push({ type: 'string', val: str, idx: idx++ });
               console.log(`  [${idx-1}] Str: "${str}"`);
               cOffset = end + 1; // Skip 0a
            } else if (type === 0x05) { // Real/Double
                // 8 bytes?
                const val = buffer.readDoubleLE(cOffset);
                constants.push({ type: 'real', val: val, idx: idx++ });
                console.log(`  [${idx-1}] Real: ${val}`);
                cOffset += 8;
            } else if (type === 0x01) { // Bool?
                 // 1 byte?
                 const val = buffer[cOffset];
                 constants.push({ type: 'bool', val: val, idx: idx++ });
                 console.log(`  [${idx-1}] Bool: ${val}`);
                 cOffset += 1;
            } else {
                // End of constants?
                break;
            }
        }
    }

    // Parse Code - Specifically 'inpainit'
    const inpainitOffset = buffer.indexOf("inpainit");
    if (inpainitOffset !== -1) {
        console.log("\nFunction 'inpainit':");
        let ip = inpainitOffset + "inpainit".length + 1; // Skip name + 0a
        
        // Skip function header bytes (heuristic: read until 00 0f?)
        // Hex: 02 00 00 00 0a 0a 00 0f 00 ...
        // It seems 00 0f starts the bytecode.
        while(ip < buffer.length) {
            if (buffer[ip] === 0x00 && buffer[ip+1] === 0x0f) {
                ip += 2;
                break;
            }
            ip++;
        }
        
        console.log("Bytecode Start:");
        const limit = 200; // Safety limit
        let steps = 0;
        
        while(ip < buffer.length && steps < limit) {
             const opcode = buffer[ip];
             let line = `  @${ip.toString(16).padStart(3,'0')}: ${opcode.toString(16).padStart(2,'0')} `;
             
             // Simple decoder based on observations
             if (opcode === 0x00) {
                 // Assignment? 00 01 [VarIdx] 01 [ConstIdx]?
                 // Dump: 00 01 01 01 00 06 ...
                 // Op VarIdx? Type?
                 // Let's print next few bytes
                 const b1 = buffer[ip+1];
                 const b2 = buffer[ip+2];
                 const b3 = buffer[ip+3];
                 const b4 = buffer[ip+4];
                 const b5 = buffer[ip+5];
                 line += `[ASSIGN?] Var:${b1} ValType?:${b2} Val:${b3}`;
                 ip += 6; // Guessing length
             } else if (opcode === 0x01) {
                // Something
                ip++;
             } else if (opcode === 0x09) {
                 // ALU
                 const sub = buffer[ip+1];
                 let op = "?";
                 if (sub === 0x60) op = "+";
                 if (sub === 0x61) op = "-";
                 if (sub === 0x62) op = "*";
                 if (sub === 0x64) op = "<";
                 if (sub === 0x65) op = ">";
                 line += `[ALU] ${op} (0x${sub.toString(16)})`;
                 ip += 2;
             } else if (opcode === 0x0b) {
                 // Jump?
                 // Dump: 0b 00 0e (Jump 14?)
                 const target = buffer.readInt16BE(ip+1); // Big endian? Or just bytes?
                 // Hex: 00 0e -> 14.
                 line += `[JUMP] Target: +${target}`;
                 ip += 3;
             } else if (opcode === 0x05) {
                 // Function call? or Signature?
                 // Usually see 05 [Name]
                 // But in bytecode?
                 ip++;
             } else if (opcode === 0x0a) {
                 line += "[End/Newline]";
                 console.log(line);
                 break;
             } else {
                 ip++;
             }
             console.log(line);
             steps++;
        }
    }
}

const tests = [
    '/Volumes/Share/inpax-tests/test_if.ipo',
    '/Volumes/Share/inpax-tests/test_while.ipo',
    '/Volumes/Share/inpax-tests/test_arithmetic.ipo'
];

tests.forEach(f => {
    if (fs.existsSync(f)) {
        parseIPO(f);
    } else {
        console.log(`File not found: ${f}`);
    }
});
