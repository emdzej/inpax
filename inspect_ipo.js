const fs = require('fs');
const path = require('path');

const ipoFile = process.argv[2];
if (!ipoFile) {
    console.log("Usage: node inspect_ipo.js <file.ipo>");
    process.exit(1);
}

const buffer = fs.readFileSync(ipoFile);

// Helper to read strings
function readString(offset) {
    let end = buffer.indexOf(0x0a, offset);
    if (end === -1) return { str: null, next: offset };
    return { str: buffer.toString('utf8', offset, end), next: end + 1 };
}

// 1. Header
let offset = 0;
const len = buffer[offset];
offset++;
const signature = buffer.toString('utf8', offset, offset + len);
offset += len + 1; // +0a

console.log(`Signature: ${signature}`);

// Function to find sections
function findSection(name) {
    const idx = buffer.indexOf(name);
    if (idx === -1) return -1;
    // Section start is usually name + 0a
    return idx + name.length + 1;
}

// Parse Constants
const constStart = findSection("Constant Data");
const constants = [];
if (constStart !== -1) {
    let ptr = constStart;
    // Skip padding?
    while (ptr < buffer.length && (buffer[ptr] === 0 || buffer[ptr] === 0x0a)) ptr++;
    
    let idx = 0;
    while (ptr < buffer.length) {
        if (buffer[ptr] === 0x00 && buffer[ptr+1] === 0x05 && buffer[ptr+2] === 0x00) {
             // Heuristic end?
        }
        
        const type = buffer[ptr];
        ptr++;
        
        if (type === 0x03) { // Int
            const val = buffer.readInt16LE(ptr);
            constants.push({ idx: idx, type: 'int', val: val });
            ptr += 2;
        } else if (type === 0x06) { // String
            const res = readString(ptr);
            constants.push({ idx: idx, type: 'string', val: res.str });
            ptr = res.next;
        } else if (type === 0x05) { // Real
            const val = buffer.readDoubleLE(ptr);
            constants.push({ idx: idx, type: 'real', val: val });
            ptr += 8;
        } else if (type === 0x00) {
             // Padding?
             continue;
        } else {
            // Assume end
            break;
        }
        idx++;
    }
}
console.log("Constants:", constants);

// Parse Code
const funcStart = findSection("inpainit");
if (funcStart !== -1) {
    let ptr = funcStart;
    // Look for start of bytecode: 00 0F
    while (ptr < buffer.length) {
        if (buffer[ptr] === 0x00 && buffer[ptr+1] === 0x0f) {
            ptr += 2; 
             if (buffer[ptr] === 0x00 && buffer[ptr+1] === 0x01) ptr += 2;
            break;
        }
        ptr++;
    }
    
    console.log(`\nBytecode Start at 0x${ptr.toString(16)}`);
    const end = buffer.indexOf("inpaexit");
    
    let i = ptr;
    while (i < end) {
        const op = buffer[i];
        let info = `0x${op.toString(16).padStart(2,'0')}`;
        
        if (op === 0x01) {
            const val = buffer.readUInt16LE(i+1);
            info += ` PUSH_VAR_ADDR Idx:${val}`;
            i += 3;
        } else if (op === 0x00) {
            const sub = buffer[i+1];
            if (sub === 0x06) {
                 const idx = buffer.readUInt16LE(i+2);
                 const c = constants[idx] || {val:'?'};
                 info += ` 00 06 PUSH_CONST Idx:${idx} (${c.val})`;
                 i += 4;
            } else if (sub === 0x01) {
                 const idx = buffer.readUInt16LE(i+2);
                 info += ` 00 01 PUSH_VAR_VAL Idx:${idx}`;
                 i += 4;
            } else if (sub === 0x05) {
                info += ` 00 05 STORE`;
                i += 2;
            } else if (sub === 0x09) {
                const alu = buffer[i+2];
                const aluMap = { 0x60:'+', 0x61:'-', 0x62:'*', 0x64:'<', 0x65:'>' };
                info += ` 00 09 ALU ${aluMap[alu] || alu.toString(16)}`;
                i += 4; 
            } else if (sub === 0x0b) {
                 const jmp = buffer.readInt16BE(i+2); 
                 info += ` 00 0B JMP_FALSE +${jmp}`;
                 i += 4;
            } else if (sub === 0x0e) {
                 // Might be JMP_ALWAYS?
                 // Usually JMP is relative?
                 // Let's check args
                 const val = buffer.readInt16BE(i+2);
                 info += ` 00 0E JUMP +${val}`;
                 i += 4;
            } else {
                info += ` 00 ${sub.toString(16)} ?`;
                i += 2;
            }
        } else {
            // Unknown
             info += ` ?`;
            i++;
        }
        console.log(`0x${i.toString(16).padStart(4,'0')}: ${info}`);
    }
}
