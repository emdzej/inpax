import process from "node:process";

import type { Command } from "commander";
import { Box, Text, render, useApp, useInput } from "ink";

import { parseInpaFile } from "@inpax/core";

import { readFile } from "../utils.js";

type DebugInfo = {
    filePath: string;
    fileSize: number;
    globals: number;
    constants: number;
    functions: number;
    menus: number;
    screens: number;
    stateMachines: number;
};

type DebugAppProps = {
    info: DebugInfo;
};

const DebugApp = ({ info }: DebugAppProps): JSX.Element => {
    const { exit } = useApp();

    useInput((input) => {
        if (input.toLowerCase() === "q") {
            exit();
        }
    });

    return (
        <Box flexDirection="column" height="100%">
            <Box borderStyle="round" borderColor="cyan" paddingX={1}>
                <Text bold>inpax debug</Text>
                <Text> · {info.filePath}</Text>
            </Box>

            <Box flexDirection="column" paddingX={1} paddingY={1}>
                <Text>
                    File size: {info.fileSize} bytes | Globals: {info.globals} | Constants: {info.constants} | Functions: {info.functions}
                </Text>
                <Text>
                    Menus: {info.menus} | Screens: {info.screens} | State machines: {info.stateMachines}
                </Text>
            </Box>

            <Box flexGrow={1} flexDirection="row" paddingX={1} paddingBottom={1}>
                <Box flexDirection="column" flexGrow={2} marginRight={2} borderStyle="round" paddingX={1} paddingY={1}>
                    <Text bold>Code</Text>
                    <Text dimColor>TODO: instruction listing</Text>
                </Box>
                <Box flexDirection="column" flexGrow={1}>
                    <Box borderStyle="round" paddingX={1} paddingY={1} marginBottom={1}>
                        <Text bold>Stack</Text>
                        <Text dimColor>TODO: stack values</Text>
                    </Box>
                    <Box borderStyle="round" paddingX={1} paddingY={1}>
                        <Text bold>Variables</Text>
                        <Text dimColor>TODO: locals/globals</Text>
                    </Box>
                </Box>
            </Box>

            <Box borderStyle="round" borderColor="gray" paddingX={1}>
                <Text dimColor>Press q to quit</Text>
            </Box>
        </Box>
    );
};

const buildDebugInfo = (filePath: string): DebugInfo => {
    const buffer = readFile(filePath);
    const ipo = parseInpaFile(buffer);

    return {
        filePath,
        fileSize: buffer.length,
        globals: ipo.globals.variables.length,
        constants: ipo.constants.constants.length,
        functions: ipo.functions.length,
        menus: ipo.menus?.length ?? 0,
        screens: ipo.screens?.length ?? 0,
        stateMachines: ipo.stateMachines?.length ?? 0
    };
};

const runDebug = async (filePath: string): Promise<void> => {
    const info = buildDebugInfo(filePath);
    const instance = render(<DebugApp info={info} />);
    await instance.waitUntilExit();
};

export const registerDebugCommand = (program: Command): void => {
    program
        .command("debug")
        .description("Launch TUI debugger")
        .argument("<filePath>", "IPO file to debug")
        .action(async (filePath: string) => {
            try {
                await runDebug(filePath);
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                console.error(message);
                process.exitCode = 1;
            }
        });
};
