#!/usr/bin/env node

/**
 * Simple CLI runner for testing the interpreter
 */

import { readFileSync } from 'fs';
import { VM } from './index.js';
import { parseIpo } from '@emdzej/inpax-parser';
import { getLogger } from '@emdzej/inpax-logger';

const log = getLogger('interpreter-cli');

function main(): void {
    const args = process.argv.slice(2);
    log.info('INPAX Interpreter CLI');
    if (args.length === 0) {
        log.info('Usage: inpax-run <file.ipo>');
        log.info('');
        log.info('Options:');
        log.info("  --parse    Only parse, don't execute");
        log.info('  --debug    Enable debug output');
        process.exit(1);
    }

    const filename = args.find(a => !a.startsWith('--'));
    const parseOnly = args.includes('--parse');
    const debug = args.includes('--debug');

    if (!filename) {
        log.error('No input file specified');
        process.exit(1);
    }

    try {
        //console.log(`Loading: ${filename}`);
        const buffer = readFileSync(filename);

        //console.log('Parsing IPO file...');
        const ipo = parseIpo(buffer);

        if (debug) {
            log.info(`Version: ${ipo.header.versionHi}.${ipo.header.versionLo}`);
            log.info(`Globals: ${ipo.globals.types.length}`);
            log.info(`Constants: ${ipo.constants.values.length}`);
            log.info(`Functions: ${ipo.functions.size}`);
            log.info(`Screens: ${ipo.screens.size}`);
            log.info(`Menus: ${ipo.menus.size}`);
            log.info('\n--- Functions ---');
            for (const [id, func] of ipo.functions) {
                log.info(`  ${id}: ${func.header.name} (${func.instructions.length} instructions)`);
            }

            log.info('\n--- Constants ---');
            for (let i = 0; i < ipo.constants.values.length; i++) {
                const c = ipo.constants.values[i];
                log.info(`  ${i}: type=${c.type} value=${JSON.stringify(c.value)}`);
            }
        }

        if (parseOnly) {
            log.info('\nParse complete.');
            return;
        }

        log.info('\n--- Running ---\n');
        const vm = new VM(ipo);
        vm.run();

        log.info('\n--- Execution complete ---');

    } catch (error) {
        log.error({ err: error instanceof Error ? error.message : error }, 'Error');
        process.exit(1);
    }
}

main();
