import process from "node:process";

import { Command } from "commander";

import { registerDebugCommand } from "./commands/debug.js";
import { registerDisasmCommand } from "./commands/disasm.js";
import { registerDumpCommand } from "./commands/dump.js";
import { registerRunCommand } from "./commands/run.js";

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
    registerRunCommand(program);

    if (argv.length <= 2) {
        program.outputHelp();
        return;
    }

    const candidate = argv[2];
    const normalizedArgv = candidate?.toLowerCase().endsWith(".ipo")
        ? [argv[0], argv[1], "run", ...argv.slice(2)]
        : argv;

    program.parse(normalizedArgv);
};
