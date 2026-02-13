#!/usr/bin/env node

import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

import {
    formatDisassembly,
    getDataTypeName,
    getMenuKeyName,
    parseInpaFile
} from "@inpax/core";

type CliOptions = {
    raw: boolean;
    resolve: boolean;
};

const USAGE = `Usage: inpax <command> <file.ipo> [options]

Commands:
  info <file.ipo>    Show header info
  disasm <file.ipo>  Disassemble bytecode
  dump <file.ipo>    Hex dump raw bytes

Options:
  --raw              Include raw bytes in disassembly output
  --no-resolve       Skip resolving system function names
  -h, --help         Show this help
`;

const printUsage = (): void => {
    console.log(USAGE.trimEnd());
};

const parseOptions = (args: string[]): CliOptions => {
    const options: CliOptions = {
        raw: false,
        resolve: true
    };

    for (const arg of args) {
        if (arg === "--raw") {
            options.raw = true;
            continue;
        }

        if (arg === "--no-resolve") {
            options.resolve = false;
            continue;
        }

        if (arg === "-h" || arg === "--help") {
            printUsage();
            process.exit(0);
        }

        if (arg.startsWith("-")) {
            throw new Error(`Unknown option: ${arg}`);
        }
    }

    return options;
};

const readFile = (filePath: string): Buffer => {
    try {
        return readFileSync(filePath);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to read file: ${filePath}\n${message}`);
    }
};

const formatHex = (value: number, width = 2): string =>
    value.toString(16).padStart(width, "0");

const formatHexDump = (buffer: Uint8Array): string => {
    const lines: string[] = [];
    const bytesPerLine = 16;

    for (let offset = 0; offset < buffer.length; offset += bytesPerLine) {
        const chunk = buffer.slice(offset, offset + bytesPerLine);
        const hex = Array.from(chunk)
            .map((byte) => formatHex(byte))
            .join(" ");
        const ascii = Array.from(chunk)
            .map((byte) => (byte >= 0x20 && byte <= 0x7e ? String.fromCharCode(byte) : "."))
            .join("");
        lines.push(`${formatHex(offset, 6)}  ${hex.padEnd(bytesPerLine * 3 - 1, " ")}  ${ascii}`);
    }

    return lines.join("\n");
};

const runDisasm = (filePath: string, options: CliOptions): void => {
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

        screen.lines.forEach((line, index) => {
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

        sm.states.forEach((state, index) => {
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

const runDump = (filePath: string): void => {
    const buffer = readFile(filePath);
    console.log(formatHexDump(buffer));
};

const main = (): void => {
    const args = process.argv.slice(2);

    if (args.length === 0 || args[0] === "-h" || args[0] === "--help") {
        printUsage();
        return;
    }

    const [command, filePath, ...rest] = args;

    if (!filePath || filePath.startsWith("-")) {
        printUsage();
        process.exitCode = 1;
        return;
    }

    let options: CliOptions;
    try {
        options = parseOptions(rest);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(message);
        printUsage();
        process.exitCode = 1;
        return;
    }

    try {
        switch (command) {
            case "disasm":
                runDisasm(filePath, options);
                return;
            case "dump":
                runDump(filePath);
                return;
            default:
                console.error(`Unknown command: ${command}`);
                printUsage();
                process.exitCode = 1;
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(message);
        process.exitCode = 1;
    }
};

main();
