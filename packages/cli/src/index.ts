#!/usr/bin/env node

import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

import {
  decodeInstructions,
  decodeLogtable,
  formatDisassembly,
  parseIpo
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

const runInfo = (filePath: string): void => {
  const buffer = readFile(filePath);
  const ipo = parseIpo(buffer);

  const sections = Array.from(ipo.sections.values());
  const typeCounts = sections.reduce<Record<string, number>>((acc, section) => {
    acc[section.type] = (acc[section.type] ?? 0) + 1;
    return acc;
  }, {});

  const version = ipo.header.version.join(".");
  const title = path.basename(filePath);
  const constantsCount = ipo.constantData.constants.length;
  const logtableDataSections = sections.filter((section) => section.type === "logtable-data");
  const logtableEntries = logtableDataSections.reduce((acc, section) => {
    const logtable = decodeLogtable(buffer, section.offset, section.size);
    return acc + logtable.entries.length;
  }, 0);

  console.log(`Title: ${title}`);
  console.log(`Version: ${version}`);
  console.log(`Magic: ${ipo.header.magic.trimEnd()}`);
  console.log(`Sections: ${sections.length}`);
  console.log(
    `  Functions: ${typeCounts.function ?? 0}, Screens: ${typeCounts.screen ?? 0}, Menus: ${typeCounts.menu ?? 0}, State machines: ${typeCounts.statemachine ?? 0}`
  );
  console.log(
    `  Control blocks: ${typeCounts.control ?? 0}`
  );
  console.log(
    `  Logtable data: ${typeCounts["logtable-data"] ?? 0}, Logtable entries: ${logtableEntries}`
  );
  console.log(`Globals: ${ipo.globalData.count}`);
  console.log(`Constants: ${constantsCount}`);
};

const runDisasm = (filePath: string, options: CliOptions): void => {
  const buffer = readFile(filePath);
  const ipo = parseIpo(buffer);

  const outputs: string[] = [];

  // Global Variables
  if (ipo.globalData.count > 0) {
    outputs.push("=== Global Variables ===");
    ipo.globalData.variables.forEach((type, index) => {
      outputs.push(`[${index}] offset=0x${formatHex(ipo.globalData.offset, 4)} type=${type}`);
    });
    outputs.push("");
  }

  // Constants
  if (ipo.constantData.constants.length > 0) {
    outputs.push("=== Constants ===");
    ipo.constantData.constants.forEach((constant, index) => {
      const value = constant.type === "string" ? `"${constant.value}"` : constant.value;
      outputs.push(`[${index}] offset=0x${formatHex(constant.offset, 4)} type=${constant.type.padEnd(6)} value=${value}`);
    });
    outputs.push("");
  }

  const allSections = Array.from(ipo.sections.values()).filter(
    (section) => section.type !== "global" && section.type !== "constant"
  );

  // Separate control sections from regular sections
  const controlSections = allSections.filter((section) => section.type === "control");
  const regularSections = allSections.filter((section) => section.type !== "control");

  if (regularSections.length === 0 && controlSections.length === 0) {
    console.log("No disassemblable sections found.");
    return;
  }
  
  // Track which control sections we've output (to nest them under LINE functions)
  const outputControlSections = new Set<string>();
  
  for (const section of regularSections) {
    const idStr = section.id !== undefined ? `id=0x${formatHex(section.id, 2)}, ` : "";
    outputs.push(
      `## ${section.name} (${section.type}, ${idStr}offset 0x${formatHex(section.offset, 4)}, size ${section.size})`
    );

    if (section.type === "logtable-data") {
      const logtable = decodeLogtable(buffer, section.offset, section.size);
      outputs.push(`Entries: ${logtable.entries.length}`);

      if (logtable.entries.length === 0) {
        outputs.push("<empty>");
        continue;
      }

      outputs.push(
        logtable.entries
          .map(
            (entry, index) =>
              `  [${index}] input=0x${formatHex(entry.input, 8)} mask=0x${formatHex(entry.mask, 8)} output=0x${formatHex(entry.output, 8)}`
          )
          .join("\n")
      );
      continue;
    }

    const instructions = decodeInstructions(buffer, section.offset, section.size);

    if (instructions.length === 0) {
      outputs.push("<empty>");
      continue;
    }

    outputs.push(
      formatDisassembly(instructions, {
        showRawBytes: options.raw,
        resolveNames: options.resolve,
        constantData: ipo.constantData
      })
    );
    
    // If this is a "!" function (LINE body), output associated CONTROL sections
    if (section.name === "!") {
      // Find CONTROL sections that follow this section (by offset)
      const associatedControls = controlSections.filter(
        (ctrl) => 
          ctrl.offset > section.offset && 
          !outputControlSections.has(ctrl.name)
      );
      
      for (const ctrlSection of associatedControls) {
        // Check if there's another regular section between this and the control
        const hasIntervening = regularSections.some(
          (s) => s.offset > section.offset && s.offset < ctrlSection.offset && s.name !== "!"
        );
        
        if (hasIntervening) {
          break;
        }
        
        outputControlSections.add(ctrlSection.name);
        outputs.push(
          `\n  ### CONTROL (offset 0x${formatHex(ctrlSection.offset, 4)}, size ${ctrlSection.size})`
        );
        
        const ctrlInstructions = decodeInstructions(buffer, ctrlSection.offset, ctrlSection.size);
        
        if (ctrlInstructions.length === 0) {
          outputs.push("  <empty>");
          continue;
        }
        
        // Indent CONTROL disassembly
        const ctrlDisasm = formatDisassembly(ctrlInstructions, {
          showRawBytes: options.raw,
          resolveNames: options.resolve,
          constantData: ipo.constantData
        });
        outputs.push(ctrlDisasm.split("\n").map((line) => `  ${line}`).join("\n"));
      }
    }
  }
  
  // Output any remaining control sections that weren't nested
  for (const ctrlSection of controlSections) {
    if (!outputControlSections.has(ctrlSection.name)) {
      const idStr = ctrlSection.id !== undefined ? `id=0x${formatHex(ctrlSection.id, 2)}, ` : "";
      outputs.push(
        `## ${ctrlSection.name} (control, ${idStr}offset 0x${formatHex(ctrlSection.offset, 4)}, size ${ctrlSection.size})`
      );
      
      const ctrlInstructions = decodeInstructions(buffer, ctrlSection.offset, ctrlSection.size);
      
      if (ctrlInstructions.length === 0) {
        outputs.push("<empty>");
        continue;
      }
      
      outputs.push(
        formatDisassembly(ctrlInstructions, {
          showRawBytes: options.raw,
          resolveNames: options.resolve,
          constantData: ipo.constantData
        })
      );
    }
  }

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
      case "info":
        runInfo(filePath);
        return;
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
