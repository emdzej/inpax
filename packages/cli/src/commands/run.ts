/**
 * Run/Execute command with TUI
 */
import { Command } from 'commander';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import chalk from 'chalk';

export const runCommand = new Command('run')
  .description('Execute IPO bytecode or IPS script file')
  .argument('<file>', 'IPO/IPS file to execute')
  .option('-f, --function <name>', 'Entry function', 'inpainit')
  .option('-d, --debug', 'Enable debug mode')
  .option('--trace', 'Trace VM execution')
  .option('--headless', 'Use headless CLI provider instead of TUI')
  .option('--sgbd <path>', 'Path to SGBD files')
  .option('--tick <ms>', 'Tick interval in milliseconds', '16')
  .action(async (file, options) => {
    try {
      const filePath = resolve(file);
      
      if (!existsSync(filePath)) {
        console.error(chalk.red(`Error: File not found: ${file}`));
        process.exit(1);
      }

      const ext = filePath.toLowerCase();
      const isSource = ext.endsWith('.ips');
      const isBytecode = ext.endsWith('.ipo');

      if (!isSource && !isBytecode) {
        console.error(chalk.red('Error: File must be .ipo (bytecode) or .ips (source)'));
        process.exit(1);
      }

      // For now, only bytecode is supported
      if (isSource) {
        console.error(chalk.yellow('Source compilation not yet integrated'));
        console.error(chalk.gray('Use: inpax compile <file.ips> first'));
        process.exit(1);
      }

      const scriptName = basename(filePath, '.ipo');

      if (options.headless) {
        await runHeadless(filePath, scriptName, options);
      } else {
        await runWithTui(filePath, scriptName, options);
      }

    } catch (error) {
      console.error(chalk.red(`Error: ${(error as Error).message}`));
      if (options.debug) {
        console.error((error as Error).stack);
      }
      process.exit(1);
    }
  });

/**
 * Run with full TUI interface
 */
async function runWithTui(filePath: string, scriptName: string, options: RunOptions) {
  const { parseIpo } = await import('@inpax/parser');
  const { VM, MainScheduler } = await import('@inpax/interpreter');
  const { TuiProvider } = await import('@inpax/tui-provider');
  const { renderTui } = await import('@inpax/tui');

  // Parse IPO file
  const buffer = readFileSync(filePath);
  const ipo = parseIpo(buffer);

  if (options.debug) {
    console.log(chalk.gray(`Parsed IPO: ${ipo.functions.size} functions, ${ipo.screens.size} screens, ${ipo.stateMachines.size} state machines`));
  }

  // Create TUI provider as runtime
  const provider = new TuiProvider();
  
  // Create VM with runtime
  const vm = new VM(ipo, {
    runtime: {
      ui: provider,
      ediabas: null as any, // TODO: Add EDIABAS provider
      simulation: null as any,
      print: null as any,
      pem: null as any,
      dtm: null as any,
      external: null as any,
      sps: null as any,
      inp1: null as any,
    },
    debug: options.debug || options.trace,
  });

  // Create main scheduler
  const tickInterval = parseInt(options.tick || '16', 10);
  const scheduler = new MainScheduler(vm, {
    tickInterval,
    debug: options.trace,
  });

  // Set initial title
  provider.setTitle(`INPA - ${scriptName}`);

  // Connect menu events to scheduler
  provider.on('menu:select', ({ itemNum }) => {
    // Find menu item handler in IPO
    const menuItem = findMenuItemHandler(ipo, itemNum);
    if (menuItem) {
      scheduler.queueMenuAction(itemNum, async () => {
        await vm.executeBlock(menuItem);
      });
    } else if (options.debug) {
      console.log(chalk.gray(`No handler for F${itemNum}`));
    }
  });

  // Handle exit
  const cleanup = () => {
    scheduler.stop();
    process.exit(0);
  };

  // Scheduler events
  scheduler.on('stopped', cleanup);
  scheduler.on('error', (err: Error) => {
    console.error(chalk.red(`Runtime error: ${err.message}`));
    if (options.debug) {
      console.error(err.stack);
    }
  });

  // Render TUI
  const { waitUntilExit } = renderTui(provider, {
    title: scriptName,
    onQuit: cleanup,
  });

  try {
    // Run inpainit() to initialize
    if (options.debug) {
      console.log(chalk.gray('Executing inpainit()...'));
    }
    await vm.run();

    // Start main scheduler loop
    if (options.debug) {
      console.log(chalk.gray('Starting main scheduler...'));
    }
    scheduler.start();

    // Wait for TUI to exit
    await waitUntilExit();
  } catch (error) {
    console.error(chalk.red(`Execution error: ${(error as Error).message}`));
    if (options.debug) {
      console.error((error as Error).stack);
    }
    cleanup();
  }
}

/**
 * Run with headless CLI provider (no TUI)
 */
async function runHeadless(filePath: string, scriptName: string, options: RunOptions) {
  const { parseIpo } = await import('@inpax/parser');
  const { VM, MainScheduler } = await import('@inpax/interpreter');
  const { CliProvider } = await import('@inpax/cli-provider');

  console.log(chalk.bold('=== INPAX Headless Mode ==='));
  console.log(`Script: ${scriptName}`);
  console.log(`File: ${filePath}`);
  console.log();

  // Parse IPO file
  const buffer = readFileSync(filePath);
  const ipo = parseIpo(buffer);

  console.log(chalk.gray(`Parsed: ${ipo.functions.size} functions, ${ipo.screens.size} screens, ${ipo.stateMachines.size} state machines`));

  // Create CLI provider as runtime
  const provider = new CliProvider();
  
  // Create VM with runtime
  const vm = new VM(ipo, {
    runtime: {
      ui: provider,
      ediabas: null as any,
      simulation: null as any,
      print: null as any,
      pem: null as any,
      dtm: null as any,
      external: null as any,
      sps: null as any,
      inp1: null as any,
    },
    debug: options.debug || options.trace,
  });

  // Create main scheduler
  const tickInterval = parseInt(options.tick || '16', 10);
  const scheduler = new MainScheduler(vm, {
    tickInterval,
    debug: options.trace,
  });

  provider.setTitle(`INPA - ${scriptName}`);

  // Scheduler events
  scheduler.on('stopped', () => {
    console.log(chalk.gray('\nExecution stopped.'));
    process.exit(0);
  });

  scheduler.on('error', (err: Error) => {
    console.error(chalk.red(`Runtime error: ${err.message}`));
    if (options.debug) {
      console.error(err.stack);
    }
  });

  try {
    // Run inpainit()
    console.log(chalk.gray('Executing inpainit()...'));
    await vm.run();
    console.log(chalk.green('inpainit() completed.'));

    // Start scheduler
    console.log(chalk.gray('Starting main scheduler...'));
    scheduler.start();

    // In headless mode, run for a limited time or until exit() is called
    console.log(chalk.yellow('Running... (Ctrl+C to stop)'));
    
    // Handle Ctrl+C
    process.on('SIGINT', () => {
      console.log(chalk.gray('\nInterrupted.'));
      scheduler.stop();
    });

  } catch (error) {
    console.error(chalk.red(`Execution error: ${(error as Error).message}`));
    if (options.debug) {
      console.error((error as Error).stack);
    }
    process.exit(1);
  }
}

/**
 * Find menu item handler function block by item number
 */
function findMenuItemHandler(ipo: any, itemNum: number): any {
  // Menu items are stored in menus, each with items that have handlers
  for (const menu of ipo.menus.values()) {
    for (const item of menu.items) {
      if (item.itemNum === itemNum && item.func) {
        return item.func;
      }
    }
  }
  return null;
}

interface RunOptions {
  function: string;
  debug?: boolean;
  trace?: boolean;
  headless?: boolean;
  sgbd?: string;
  tick?: string;
}
