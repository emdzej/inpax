import process from "node:process";

import type { Command } from "commander";

import {
    getDataTypeName,
    getMenuKeyName,
    numberToHex,
    withOffsetPrefix
} from "@inpax/core";

import { getCliOptions } from "../options.js";
import { readFile } from "../utils.js";
import { formatDisassembly } from "@inpax/disassembler";
import { parseInpaFile } from "@inpax/parser";

const runDisasm = (filePath: string, options: { resolve: boolean }): void => {
    const buffer = readFile(filePath);
    const ipo = parseInpaFile(buffer);

    const outputs: string[] = [];

    // Global Variables
    if (ipo.globals.variables.length > 0) {
        outputs.push(withOffsetPrefix(
            `=== G: ${ipo.globals.name} ===`, ipo.globals.offset));
        ipo.globals.variables.forEach((type, index) => {
            const typeName = getDataTypeName(type);
            outputs.push(`[${index} : ${numberToHex(index)}] type=${typeName} (${numberToHex(type, "0x", 2)})`);
        });
        outputs.push("");
    }

    // Constants
    if (ipo.constants.constants.length > 0) {
        outputs.push(withOffsetPrefix(
            `=== C: ${ipo.constants.name} ===`, ipo.constants.offset));
        ipo.constants.constants.forEach((constant, index) => {
            const typeName = getDataTypeName(constant.type);
            outputs.push(`[${index} : ${numberToHex(index)}] offset=${numberToHex(constant.offset)} type=${typeName} (${numberToHex(constant.type, "0x", 2)}) value=${constant.value}`);
        });
        outputs.push("");
    }

    // Functions

    ipo.functions.forEach((func) => {
        outputs.push(withOffsetPrefix(
            `=== F: ${func.name}: [${numberToHex(func.id)}] ===`, func.offset))
        if (func.instructions.length === 0) {
            outputs.push("<empty>");
        } else {
            outputs.push(
                formatDisassembly([...func.instructions], ipo, {
                    showRawBytes: true,
                    resolveNames: options.resolve,
                    input: ipo
                })
            );
        }
        outputs.push("");
    });

    // MENUS

    ipo.menus?.forEach((menu) => {
        outputs.push(withOffsetPrefix(
            `=== M: ${menu.name}: [${numberToHex(menu.id)}] ===`, menu.offset));
        if (menu.instructions.length === 0) {
            outputs.push("<empty>");
        } else {
            outputs.push(
                formatDisassembly([...menu.instructions], ipo, {
                    showRawBytes: true,
                    resolveNames: options.resolve,
                    input: ipo
                })
            );
        }
        menu.items.forEach((item, index) => {
            outputs.push(withOffsetPrefix(
                `  --- MI: [${numberToHex(item.id)}] ${item.label} (key=${getMenuKeyName(item.key)}) ---`, item.offset));
            if (item.instructions.length === 0) {
                outputs.push("  <empty>");
            } else {
                outputs.push(
                    formatDisassembly([...item.instructions], ipo, {
                        showRawBytes: true,
                        resolveNames: options.resolve,
                        input: ipo
                    }).split("\n").map((line) => `  ${line}`).join("\n")
                );
            }
        });
        outputs.push("");
    });

    // Screens

    ipo.screens?.forEach((screen) => {
        outputs.push(withOffsetPrefix(
            `=== S: [${numberToHex(screen.id)}] ${screen.name} ===`, screen.offset));

        if (screen.instructions.length === 0) {
            outputs.push("<empty>");
        } else {
            outputs.push(
                formatDisassembly([...screen.instructions], ipo, {
                    showRawBytes: true,
                    resolveNames: options.resolve,
                    input: ipo
                })
            );
        }

        outputs.push(withOffsetPrefix(
            `--- F: [${numberToHex(screen.function.id)}] ${screen.function.name} ---`, screen.function.offset));
        if (screen.function.instructions.length === 0) {
            outputs.push("<empty>");
        } else {
            outputs.push(
                formatDisassembly([...screen.function.instructions], ipo, {
                    showRawBytes: true,
                    resolveNames: options.resolve,
                    input: ipo
                })
            );
        }

        screen.lines.forEach((line) => {
            outputs.push(withOffsetPrefix(
                `  --- L: [${numberToHex(line.id)}] ${line.arg1 || '""'} : ${line.arg2 || '""'} ---`, line.offset));
            if (line.instructions.length === 0) {
                outputs.push("  <empty>");
            } else {
                outputs.push(
                    formatDisassembly([...line.instructions], ipo, {
                        showRawBytes: true,
                        resolveNames: options.resolve,
                        input: ipo
                    }).split("\n").map((line) => `  ${line}`).join("\n")
                );
            }

            if (line.control) {
                outputs.push(withOffsetPrefix(
                    `    --- CT: [${numberToHex(line.control.id)}] ${line.control.name} ---`, line.control.offset));
                if (line.control.instructions.length === 0) {
                    outputs.push("    <empty>");
                } else {
                    outputs.push(
                        formatDisassembly([...line.control.instructions], ipo, {
                            showRawBytes: true,
                            resolveNames: options.resolve,
                            input: ipo
                        }).split("\n").map((line) => `    ${line}`).join("\n")
                    );
                }
            }
        });

        outputs.push("");
    });

    // State Machines

    ipo.stateMachines?.forEach((sm) => {
        outputs.push(withOffsetPrefix(
            `=== SM: ${sm.name} ===`, sm.offset));
        if (sm.instructions.length === 0) {
            outputs.push("<empty>");
        } else {
            outputs.push(
                formatDisassembly([...sm.instructions], ipo, {
                    showRawBytes: true,
                    resolveNames: options.resolve,
                    input: ipo
                })
            );
        }

        sm.states.forEach((state) => {
            outputs.push(withOffsetPrefix(
                `  --- ST: ${state.name} ---`, state.offset));
            if (state.instructions.length === 0) {
                outputs.push("  <empty>");
            } else {
                outputs.push(
                    formatDisassembly([...state.instructions], ipo, {
                        showRawBytes: true,
                        resolveNames: options.resolve,
                        input: ipo
                    }).split("\n").map((line) => `  ${line}`).join("\n")
                );
            }
        });

        outputs.push("");
    });

    // Logic Tables

    ipo.logicTables?.forEach((table) => {
        outputs.push(withOffsetPrefix(
            `=== LT: ${table.name} ===`, table.offset));
        if (table.entries.length === 0) {
            outputs.push("<empty>");
        } else {
            table.entries.forEach((entry, index) => {
                outputs.push(`  [${index}] input=0x${numberToHex(entry.input)} mask=0x${numberToHex(entry.mask)} output=0x${numberToHex(entry.output)}`);
            });
        }
        outputs.push("");
    });

    console.log(outputs.join("\n"));
};

export const registerDisasmCommand = (program: Command): void => {
    program
        .command("disasm")
        .description("Disassemble bytecode")
        .argument("<filePath>", "IPO file to disassemble")
        .option("--raw", "Include raw bytes in disassembly output")
        .option("--no-resolve", "Skip resolving system function names")
        .action(function (filePath: string) {
            const options = getCliOptions(this as Command);

            try {
                runDisasm(filePath, options);
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                console.error(message);
                process.exitCode = 1;
            }
        });
};
