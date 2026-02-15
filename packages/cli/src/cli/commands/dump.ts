import process from "node:process";

import type { Command } from "commander";

import { formatHexDump, readFile } from "../utils.js";

const runDump = (filePath: string): void => {
    const buffer = readFile(filePath);
    console.log(formatHexDump(buffer));
};

export const registerDumpCommand = (program: Command): void => {
    program
        .command("dump")
        .description("Hex dump raw bytes")
        .argument("<filePath>", "IPO file to dump")
        .option("--raw", "Include raw bytes in disassembly output")
        .option("--no-resolve", "Skip resolving system function names")
        .action(function (filePath: string) {
            try {
                runDump(filePath);
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                console.error(message);
                process.exitCode = 1;
            }
        });
};
