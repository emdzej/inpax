#!/usr/bin/env node
/**
 * Extract System Function IDs from INPA - Version 2
 * Fixed: Added inpaexit() requirement
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const INPA_H_PATH = 'C:\\EC-APPS\\INPA\\BIN\\inpa.h';
const SGDAT_DIR = 'C:\\EC-APPS\\INPA\\SGDAT';
const COMPILER_PATH = 'C:\\EC-APPS\\INPA\\BIN\\INPACOMP.exe';
const OUTPUT_DIR = 'S:\\inpax-tests\\sysfunction-map-v3';

function parseFunctionSignature(line) {
  const match = line.match(/extern\s+(\w+)\s*\((.*?)\);/);
  if (!match) return null;
  const name = match[1];
  const paramsStr = match[2].trim();
  const params = [];
  if (paramsStr) {
    const parts = paramsStr.split(',').map(p => p.trim());
    for (const part of parts) {
      const paramMatch = part.match(/(in|out|inout):\s*(\w+)\s+(\w+)/);
      if (paramMatch) {
        params.push({ direction: paramMatch[1], type: paramMatch[2], name: paramMatch[3] });
      }
    }
  }
  return { name, params };
}

function generateOutVarDeclarations(params) {
  const decls = [];
  for (const param of params) {
    if (param.direction === 'out' || param.direction === 'inout') {
      switch (param.type) {
        case 'string': decls.push(`    string ${param.name};`); break;
        case 'int': decls.push(`    int ${param.name};`); break;
        case 'real': decls.push(`    real ${param.name};`); break;
        case 'bool': decls.push(`    bool ${param.name};`); break;
        case 'byte': decls.push(`    byte ${param.name};`); break;
        case 'long': decls.push(`    long ${param.name};`); break;
        default: decls.push(`    int ${param.name};`);
      }
    }
  }
  return decls.join('\n');
}

function generateDummyArgs(params) {
  const args = [];
  for (const param of params) {
    if (param.direction === 'out' || param.direction === 'inout') continue;
    switch (param.type) {
      case 'string': args.push('""'); break;
      case 'int': args.push('0'); break;
      case 'real': args.push('0.0'); break;
      case 'bool': args.push('false'); break;
      case 'byte': args.push('0'); break;
      case 'long': args.push('0'); break;
      default: args.push('0');
    }
  }
  return args.join(', ');
}

function generateCompleteArgList(params) {
  return params.map(p => p.name).join(', ');
}

function generateTestScript(funcInfo) {
  const outVarDecls = generateOutVarDeclarations(funcInfo.params);
  const hasOutParams = funcInfo.params.some(p => p.direction === 'out' || p.direction === 'inout');
  let argList = hasOutParams ? generateCompleteArgList(funcInfo.params) : generateDummyArgs(funcInfo.params);
  
  // CRITICAL FIX: Must have both inpainit() AND inpaexit()
  return `#include "inpa.h"

inpainit() {
${outVarDecls ? outVarDecls + '\n' : ''}    ${funcInfo.name}(${argList});
}

inpaexit() {
}
`;
}

function extractFunctionId(ipoPath) {
  if (!fs.existsSync(ipoPath)) return null;
  const buffer = fs.readFileSync(ipoPath);
  // Look for opcode pattern: 0C 81 XX 00
  for (let i = 0; i < buffer.length - 3; i++) {
    if (buffer[i] === 0x0C && buffer[i + 1] === 0x81 && buffer[i + 3] === 0x00) {
      return buffer[i + 2];
    }
  }
  return null;
}

async function main() {
  console.log('=== INPA System Function ID Extractor v2 ===\n');
  
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  
  console.log('Reading inpa.h...');
  const inpaH = fs.readFileSync(INPA_H_PATH, 'utf-8');
  const lines = inpaH.split('\n');
  
  const functions = [];
  for (const line of lines) {
    if (line.trim().startsWith('extern ')) {
      const funcInfo = parseFunctionSignature(line);
      if (funcInfo) functions.push(funcInfo);
    }
  }
  
  console.log(`Found ${functions.length} extern functions\n`);
  
  const results = [];
  let successCount = 0;
  let failCount = 0;
  
  for (let i = 0; i < functions.length; i++) {
    const func = functions[i];
    const testName = `test_${func.name}`;
    const ipsPath = path.join(SGDAT_DIR, `${testName}.ips`);
    const ipoPath = path.join(SGDAT_DIR, `${testName}.ipo`);
    const logPath = path.join(SGDAT_DIR, `${testName}.log`);
    
    process.stdout.write(`[${i + 1}/${functions.length}] ${func.name.padEnd(30)} ... `);
    
    try {
      const script = generateTestScript(func);
      fs.writeFileSync(ipsPath, script, 'ascii');
      
      const compileCmd = `cd /d "${SGDAT_DIR}" && "${COMPILER_PATH}" ${testName}.ips -B ${testName}.log`;
      
      try {
        execSync(compileCmd, { stdio: 'pipe', windowsHide: true, timeout: 5000 });
      } catch (e) {
        // Compiler might fail but still produce .ipo
      }
      
      const id = extractFunctionId(ipoPath);
      
      if (id !== null) {
        console.log(`✓ ID=0x${id.toString(16).padStart(2, '0').toUpperCase()} (${id})`);
        results.push({
          id,
          name: func.name,
          params: func.params,
          hex: `0x${id.toString(16).padStart(2, '0').toUpperCase()}`,
          dec: id
        });
        successCount++;
      } else {
        console.log('✗ No .ipo generated');
        failCount++;
        
        if (fs.existsSync(logPath)) {
          const log = fs.readFileSync(logPath, 'utf-8');
          const errorMatch = log.match(/Error:.*/);
          if (errorMatch) {
            console.log(`  └─ ${errorMatch[0]}`);
          }
        }
      }
      
      // Clean up test files
      try {
        if (fs.existsSync(ipsPath)) fs.unlinkSync(ipsPath);
        if (fs.existsSync(logPath)) fs.unlinkSync(logPath);
        // Keep .ipo for final verification
      } catch (e) {}
      
    } catch (error) {
      console.log(`✗ ${error.message}`);
      failCount++;
    }
  }
  
  console.log(`\n=== Summary ===`);
  console.log(`Success: ${successCount}`);
  console.log(`Failed:  ${failCount}`);
  console.log(`Total:   ${functions.length}\n`);
  
  // Sort by ID
  results.sort((a, b) => a.id - b.id);
  
  // Generate markdown table
  let markdown = `# INPA System Function ID Map - Complete\n\n`;
  markdown += `**Generated:** ${new Date().toISOString()}\n`;
  markdown += `**Method:** Compiled ${successCount}/${functions.length} test scripts\n\n`;
  markdown += `## Complete Mapping\n\n`;
  markdown += `| ID (hex) | ID (dec) | Function Name | Signature |\n`;
  markdown += `|----------|----------|---------------|------------|\n`;
  
  for (const result of results) {
    const paramStr = result.params.map(p => `${p.direction}: ${p.type} ${p.name}`).join(', ');
    const signature = `(${paramStr})`;
    markdown += `| ${result.hex} | ${result.dec} | ${result.name} | ${signature} |\n`;
  }
  
  const outputPath = path.join(OUTPUT_DIR, 'system-function-ids-complete.md');
  fs.writeFileSync(outputPath, markdown);
  console.log(`Saved complete mapping to: ${outputPath}`);
  
  const jsonPath = path.join(OUTPUT_DIR, 'system-function-ids.json');
  fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2));
  console.log(`Saved JSON to: ${jsonPath}`);
  
  let tsCode = `/**\n * INPA System Function IDs\n * Auto-generated from inpa.h\n */\n\n`;
  tsCode += `export enum INPASystemFunctionId {\n`;
  for (const result of results) {
    const constName = result.name.replace(/([A-Z])/g, '_$1').toUpperCase().replace(/^_/, '');
    tsCode += `  ${constName} = 0x${result.id.toString(16).padStart(2, '0').toUpperCase()},\n`;
  }
  tsCode += `}\n\n`;
  
  tsCode += `export const INPA_SYSTEM_FUNCTIONS: Record<number, string> = {\n`;
  for (const result of results) {
    tsCode += `  0x${result.id.toString(16).padStart(2, '0').toUpperCase()}: '${result.name}',\n`;
  }
  tsCode += `};\n`;
  
  const tsPath = path.join(OUTPUT_DIR, 'system-function-ids.ts');
  fs.writeFileSync(tsPath, tsCode);
  console.log(`Saved TypeScript definitions to: ${tsPath}`);
}

main().catch(console.error);
