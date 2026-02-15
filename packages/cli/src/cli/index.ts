import process from "node:process";

import { Command } from "commander";

import { registerDebugCommand } from "./commands/debug.js";
import { registerDisasmCommand } from "./commands/disasm.js";
import { registerDumpCommand } from "./commands/dump.js";

export const runCli = (argv: string[] = process.argv): void => {
    const program = new Command();

    program
        .name("inpax")
        .description("INPA IPO tools")
        .option("--raw", "Include raw bytes in disassembly output")
        .option("--no-resolve", "Skip resolving system function names")
        .showHelpAfterError();

    registerDebugCommand(program);
    registerDisasmCommand(program);
    registerDumpCommand(program);

    if (argv.length <= 2) {
        program.outputHelp();
        return;
    }

    program.parse(argv);
};
