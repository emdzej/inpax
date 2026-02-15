import process from "node:process";

import type { Command } from "commander";

import {
    formatDisassembly,
    getDataTypeName,
    getMenuKeyName,
    parseInpaFile
} from "@inpax/core";

import { getCliOptions } from "../options.js";
import { formatHex, readFile } from "../utils.js";

const runDisasm = (filePath: string, options: { resolve: boolean }): void => {
    const buffer = readFile(filePath);
    const ipo = parseInpaFile(buffer);

    const outputs: string[] = [];

    // Global Variables
    if (ipo.globals.variables.length > 0) {
        outputs.push(`=== Globals @ 0x${formatHex(ipo.globals.offset, 4)} ===`);
        ipo.globals.variables.forEach((type, index) => {
            const typeName = getDataTypeName(type);
            outputs.push(`[${index} : ${formatHex(index, 4)}] type=${typeName} (0x${formatHex(type)})`);
        });
        outputs.push("");
    }

    // Constants
    if (ipo.constants.constants.length > 0) {
        outputs.push(`=== Constants @ 0x${formatHex(ipo.constants.offset, 4)} ===`);
        ipo.constants.constants.forEach((constant, index) => {
            const typeName = getDataTypeName(constant.type);
            outputs.push(`[${index} : ${formatHex(index, 4)}] offset=0x${formatHex(constant.offset, 4)} type=${typeName} (0x${formatHex(constant.type)}) value=${constant.value}`);
        });
        outputs.push("");
    }

    // Functions

    ipo.functions.forEach((func) => {
        outputs.push(`=== Function: [${func.id}] ${func.name} (offset 0x${formatHex(func.offset, 4)}, size ${func.size}) ===`);
        if (func.instructions.length === 0) {
            outputs.push("<empty>");
        } else {
            outputs.push(
                formatDisassembly([...func.instructions], {
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
        outputs.push(`=== Menu: [${menu.id}] ${menu.name} (offset 0x${formatHex(menu.offset, 4)}, size ${menu.size}) ===`);
        if (menu.instructions.length === 0) {
            outputs.push("<empty>");
        } else {
            outputs.push(
                formatDisassembly([...menu.instructions], {
                    showRawBytes: true,
                    resolveNames: options.resolve,
                    input: ipo
                })
            );
        }
        menu.items.forEach((item, index) => {
            outputs.push(`  --- Item: [${item.id}] ${item.label} (key=${getMenuKeyName(item.key)}) ---`);
            if (item.instructions.length === 0) {
                outputs.push("  <empty>");
            } else {
                outputs.push(
                    formatDisassembly([...item.instructions], {
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
        outputs.push(`=== Screen: [${screen.id}] ${screen.name} (offset 0x${formatHex(screen.offset, 4)}, size ${screen.size}) ===`);

        if (screen.instructions.length === 0) {
            outputs.push("<empty>");
        } else {
            outputs.push(
                formatDisassembly([...screen.instructions], {
                    showRawBytes: true,
                    resolveNames: options.resolve,
                    input: ipo
                })
            );
        }

        outputs.push(`--- Function: [${screen.function.id}] ${screen.function.name} ---`);
        if (screen.function.instructions.length === 0) {
            outputs.push("<empty>");
        } else {
            outputs.push(
                formatDisassembly([...screen.function.instructions], {
                    showRawBytes: true,
                    resolveNames: options.resolve,
                    input: ipo
                })
            );
        }

        screen.lines.forEach((line) => {
            outputs.push(`  --- Line: [${line.id}] ${line.arg1 || '""'} : ${line.arg2 || '""'} ---`);
            if (line.instructions.length === 0) {
                outputs.push("  <empty>");
            } else {
                outputs.push(
                    formatDisassembly([...line.instructions], {
                        showRawBytes: true,
                        resolveNames: options.resolve,
                        input: ipo
                    }).split("\n").map((line) => `  ${line}`).join("\n")
                );
            }

            if (line.control) {
                outputs.push(`    --- Control: [${line.control.id}] ${line.control.name}   ---`);
                if (line.control.instructions.length === 0) {
                    outputs.push("    <empty>");
                } else {
                    outputs.push(
                        formatDisassembly([...line.control.instructions], {
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
        outputs.push(`=== State Machine: ${sm.name} (offset 0x${formatHex(sm.offset, 4)}, size ${sm.size}) ===`);
        if (sm.instructions.length === 0) {
            outputs.push("<empty>");
        } else {
            outputs.push(
                formatDisassembly([...sm.instructions], {
                    showRawBytes: true,
                    resolveNames: options.resolve,
                    input: ipo
                })
            );
        }

        sm.states.forEach((state) => {
            outputs.push(`  --- State: ${state.name} ---`);
            if (state.instructions.length === 0) {
                outputs.push("  <empty>");
            } else {
                outputs.push(
                    formatDisassembly([...state.instructions], {
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
        outputs.push(`=== Logic Table: ${table.name} (offset 0x${formatHex(table.offset, 4)}, size ${table.size}) ===`);
        if (table.entries.length === 0) {
            outputs.push("<empty>");
        } else {
            table.entries.forEach((entry, index) => {
                outputs.push(`  [${index}] input=0x${formatHex(entry.input)} mask=0x${formatHex(entry.mask)} output=0x${formatHex(entry.output)}`);
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
