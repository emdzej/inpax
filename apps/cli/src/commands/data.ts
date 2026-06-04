/**
 * `inpax data` — umbrella for INPA data-management routines. Empty
 * shell on its own; subcommands live in `./data/*.ts`.
 *
 * Today: `inpax data index` (write per-directory index.json files).
 * Reserved for future: cataloguing, normalising, validating, diffing
 * INPA data trees.
 */
import { Command } from 'commander';
import { indexCommand } from './data/index-cmd.js';

export const dataCommand = new Command('data').description(
  'Manage INPA data routines (indexing, etc.)',
);

dataCommand.addCommand(indexCommand);
