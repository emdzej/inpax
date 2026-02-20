#!/usr/bin/env node

/**
 * Simple CLI runner for testing the interpreter
 */

import { readFileSync } from 'fs';
import { VM } from './index.js';
import { parseIpo } from '@inpax/parser';


function main(): void {
    const args = process.argv.slice(2);
    console.log('INPAX Interpreter CLI');
    if (args.length === 0) {
        console.log('Usage: inpax-run <file.ipo>');
        console.log('');
        console.log('Options:');
        console.log('  --parse    Only parse, don\'t execute');
        console.log('  --debug    Enable debug output');
        process.exit(1);
    }

    const filename = args.find(a => !a.startsWith('--'));
    const parseOnly = args.includes('--parse');
    const debug = args.includes('--debug');

    if (!filename) {
        console.error('No input file specified');
        process.exit(1);
    }

    try {
        //console.log(`Loading: ${filename}`);
        const buffer = readFileSync(filename);

        //console.log('Parsing IPO file...');
        const ipo = parseIpo(buffer);

        if (debug) {
            console.log(`Version: ${ipo.header.versionHi}.${ipo.header.versionLo}`);
            console.log(`Globals: ${ipo.globals.types.length}`);
            console.log(`Constants: ${ipo.constants.values.length}`);
            console.log(`Functions: ${ipo.functions.size}`);
            console.log(`Screens: ${ipo.screens.size}`);
            console.log(`Menus: ${ipo.menus.size}`);
            console.log('\n--- Functions ---');
            for (const [id, func] of ipo.functions) {
                console.log(`  ${id}: ${func.header.name} (${func.instructions.length} instructions)`);
            }

            console.log('\n--- Constants ---');
            for (let i = 0; i < ipo.constants.values.length; i++) {
                const c = ipo.constants.values[i];
                console.log(`  ${i}: type=${c.type} value=${JSON.stringify(c.value)}`);
            }
        }

        if (parseOnly) {
            console.log('\nParse complete.');
            return;
        }

        console.log('\n--- Running ---\n');
        const vm = new VM(ipo);
        vm.run();

        console.log('\n--- Execution complete ---');

    } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : error);
        process.exit(1);
    }
}

main();
