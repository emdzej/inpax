import type { Command } from "commander";

export type CliOptions = {
    raw: boolean;
    resolve: boolean;
};

type CommanderOptions = {
    raw?: boolean;
    resolve?: boolean;
};

export const getCliOptions = (command: Command): CliOptions => {
    const parentOptions = command.parent?.opts<CommanderOptions>() ?? {};
    const commandOptions = command.opts<CommanderOptions>();

    return {
        raw: commandOptions.raw ?? parentOptions.raw ?? false,
        resolve: commandOptions.resolve ?? parentOptions.resolve ?? true
    };
};
