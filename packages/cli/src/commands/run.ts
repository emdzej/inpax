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
  const { TuiProvider } = await import('@inpax/tui-provider');
  const { renderTui } = await import('@inpax/tui');

  const provider = new TuiProvider();
  
  // Set initial state
  provider.setTitle(`INPA - ${scriptName}`);
  
  // Demo: Add some menu items
  provider.setItem(1, 'Start', true);
  provider.setItem(2, 'Status', true);
  provider.setItem(3, 'Config', true);
  provider.setItem(10, 'Exit', true);

  // Handle menu selections
  provider.on('menu:select', ({ itemNum, text }) => {
    if (options.debug) {
      console.log(`Menu selected: F${itemNum} - ${text}`);
    }
    
    if (itemNum === 10) {
      // Exit selected
      process.exit(0);
    }
    
    // Demo: Update screen on selection
    provider.blankScreen();
    provider.text(0, 0, `Selected: ${text}`);
    provider.text(1, 0, `Function key: F${itemNum}`);
    
    // Demo analog gauge
    provider.analogOut(Math.random() * 100, 3, 0, 0, 100, 20, 80, '%.1f');
    
    // Demo digital indicator  
    provider.digitalOut(Math.random() > 0.5, 5, 0, 'on', 'off');
  });

  // Render TUI
  const { waitUntilExit } = renderTui(provider, {
    title: scriptName,
    onQuit: () => {
      console.log(chalk.gray('\nExiting...'));
      process.exit(0);
    },
  });

  // Initial screen
  provider.text(0, 0, 'INPAX Runtime');
  provider.text(1, 0, `Script: ${scriptName}`);
  provider.text(2, 0, '');
  provider.text(3, 0, 'Press 1-9,0 for F1-F10');
  provider.text(4, 0, 'Press Q to quit');

  if (options.debug) {
    provider.text(6, 0, '[DEBUG MODE]');
  }

  await waitUntilExit();
}

/**
 * Run with headless CLI provider (no TUI)
 */
async function runHeadless(filePath: string, scriptName: string, options: RunOptions) {
  const { CliProvider } = await import('@inpax/cli-provider');

  console.log(chalk.bold('=== INPAX Headless Mode ==='));
  console.log(`Script: ${scriptName}`);
  console.log(`File: ${filePath}`);
  console.log();

  const provider = new CliProvider();

  // Demo output
  provider.setTitle(`INPA - ${scriptName}`);
  provider.text(0, 0, 'Running in headless mode...');
  
  // TODO: Integrate with interpreter
  console.log(chalk.yellow('Interpreter integration pending'));
  console.log(chalk.gray('The VM will execute the bytecode here.'));
}

interface RunOptions {
  function: string;
  debug?: boolean;
  trace?: boolean;
  headless?: boolean;
  sgbd?: string;
}
