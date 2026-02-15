import process from "node:process";

import type { Command } from "commander";
import { Box, Text, render, useApp, useInput } from "ink";

type RunAppProps = {
    filePath: string;
};

const RunApp = ({ filePath }: RunAppProps): JSX.Element => {
    const { exit } = useApp();

    useInput((input) => {
        if (input.toLowerCase() === "q") {
            exit();
        }
    });

    return (
        <Box flexDirection="column" height="100%">
            <Box borderStyle="round" borderColor="cyan" paddingX={1}>
                <Text bold>inpax run</Text>
                <Text> · {filePath}</Text>
            </Box>

            <Box flexDirection="column" paddingX={1} paddingY={1} flexGrow={1}>
                <Text dimColor>TODO: IPO runtime UI</Text>
            </Box>

            <Box borderStyle="round" borderColor="gray" paddingX={1}>
                <Text dimColor>Press q to quit</Text>
            </Box>
        </Box>
    );
};

const runFile = async (filePath: string): Promise<void> => {
    const instance = render(<RunApp filePath={filePath} />);
    await instance.waitUntilExit();
};

export const registerRunCommand = (program: Command): void => {
    program
        .command("run")
        .description("Run IPO file with TUI")
        .argument("<filePath>", "IPO file to run")
        .action(async (filePath: string) => {
            try {
                await runFile(filePath);
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                console.error(message);
                process.exitCode = 1;
            }
        });
};
