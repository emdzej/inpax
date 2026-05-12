/**
 * Run / execute command — drives an IPO bytecode file through the
 * INPA interpreter against a chosen EDIABAS backend.
 *
 * The bytecode itself doesn't care which backend it talks to; the
 * choice lives in this CLI surface and feeds an `IEdiabasProvider`
 * into the runtime. Three options:
 *
 *   --ediabas-config <path>  load full EdiabasX config from JSON
 *   --sgbd <path>            point at an ECU directory (real ECU)
 *   --mock                   in-process mock (no real ECU)
 *   (default)                EdiabasX simulation in the cwd
 */
import { Command } from 'commander';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, basename, join } from 'node:path';
import { homedir } from 'node:os';
import chalk from 'chalk';
import { MockEdiabasProvider } from '@emdzej/inpax-mock-provider';
import { EdiabasXProvider, Inp1Adapter } from '@emdzej/inpax-ediabasx-provider';
import type { IEdiabasProvider } from '@emdzej/inpax-interfaces';
import { NodeNativeImportProvider } from '../native-imports/index.js';

/**
 * Shape of `~/.config/ediabasx/config.json` — same one the ediabasx CLI
 * writes via `inpax-ediabasx configure`. Re-reading it here means the
 * user keeps a single source of truth for cable / transport settings;
 * inpax just needs the ecuPath (which comes from --sgbd or the script's
 * directory layout) on top of that.
 */
interface EdiabasxCliConfig {
    interface: string;
    options?: Record<string, unknown>;
}

/**
 * Walk the conventional ediabasx default-config locations and return the
 * first existing path. Returns null when nothing matches — the caller
 * decides the fallback.
 *
 * Search order:
 *   1. EDIABASX_CONFIG env var (absolute path)
 *   2. cwd: ./ediabasx.config.json
 *   3. user config dir: $XDG_CONFIG_HOME/ediabasx/config.json
 *      (or ~/.config/ediabasx/config.json) — same location every other
 *      ediabasx tool uses, so one config drives all consumers.
 */
function findDefaultEdiabasConfig(): string | null {
    const fromEnv = process.env.EDIABASX_CONFIG;
    if (fromEnv && existsSync(fromEnv)) return resolve(fromEnv);

    const cwdCandidate = resolve(process.cwd(), 'ediabasx.config.json');
    if (existsSync(cwdCandidate)) return cwdCandidate;

    const xdg = process.env.XDG_CONFIG_HOME || join(homedir(), '.config');
    const userCandidate = join(xdg, 'ediabasx', 'config.json');
    if (existsSync(userCandidate)) return userCandidate;

    return null;
}

function readEdiabasxCliConfig(path: string): EdiabasxCliConfig {
    const raw = readFileSync(path, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.interface !== 'string') {
        throw new Error(
            `Invalid ediabasx config at ${path}: missing required "interface" string field`
        );
    }
    return {
        interface: parsed.interface,
        options: parsed.options && typeof parsed.options === 'object' ? parsed.options : {},
    };
}

/**
 * INPA convention: the EDIABAS Ecu directory lives at
 * `<inpa-root>/EDIABAS/Ecu`, while scripts live in
 * `<inpa-root>/EC-APPS/INPA/CFGDAT` (or SGDAT). Walk up from the IPO and
 * try that layout. Falls back to the IPO's directory when the
 * convention doesn't match — most users will pass `--sgbd` for clarity.
 */
function deriveEcuPath(ipoPath: string): string {
    const ipoDir = resolve(ipoPath, '..');
    const inpaRoot = resolve(ipoDir, '..', '..', '..');
    const conventional = join(inpaRoot, 'EDIABAS', 'Ecu');
    if (existsSync(conventional)) return conventional;
    return ipoDir;
}

/**
 * Walk up from the IPO file to the conventional INPA install root —
 * the dir that contains both `EDIABAS/` and `EC-APPS/`. Used by the
 * native-import handler to translate Windows-relative paths like
 * `..\CFGDAT\INPA.INI` into host paths.
 */
function deriveInpaRoot(ipoPath: string): string | undefined {
    const candidate = resolve(ipoPath, '..', '..', '..', '..');
    return existsSync(join(candidate, 'EDIABAS')) ? candidate : undefined;
}

interface RunOptions {
    function: string;
    debug?: boolean;
    trace?: boolean;
    headless?: boolean;
    sgbd?: string;
    ediabasConfig?: string;
    mock?: boolean;
    tick?: string;
}

export const runCommand = new Command('run')
    .description('Execute IPO bytecode or IPS script file')
    .argument('<file>', 'IPO/IPS file to execute')
    .option('-f, --function <name>', 'Entry function', 'inpainit')
    .option('-d, --debug', 'Enable debug mode')
    .option('--trace', 'Trace VM execution')
    .option('--headless', 'Use headless CLI provider instead of TUI')
    .option('--sgbd <path>', 'Path to SGBD (.prg/.grp) files for the live ECU')
    .option('--ediabas-config <path>', 'Path to an ediabas.config.json (overrides --sgbd)')
    .option('--mock', 'Use the in-process mock provider instead of EdiabasX (for development)')
    .option('--tick <ms>', 'Tick interval in milliseconds', '16')
    .action(async (file, options: RunOptions) => {
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
 * Pick an EDIABAS provider based on the CLI flags, log what we chose,
 * and `init()` it. Returns the provider so the caller can dispose it
 * on shutdown. Failure to initialise is fatal — without an EDIABAS
 * backend, anything that talks to an ECU (most INPA scripts) breaks
 * immediately, so it's better to bail here than midway through
 * `inpainit()`.
 */
interface ResolvedEdiabas {
    provider: IEdiabasProvider;
    /** Snapshot of the ediabasx config used to build the provider —
     *  surfaced to native-imports for `__apiGetConfig` lookups. */
    configSnapshot: {
        ecuPath: string;
        interfaceName: string;
        iniPath: string;
    };
}

async function resolveEdiabasProvider(
    options: RunOptions,
    ipoPath: string
): Promise<ResolvedEdiabas> {
    let provider: IEdiabasProvider;
    let summary: string;
    let interfaceName = '';
    let iniPath = '';
    let resolvedEcuPath = '';

    if (options.mock) {
        provider = new MockEdiabasProvider();
        summary = 'mock provider (no real ECU)';
        resolvedEcuPath = '';
        interfaceName = 'simulation';
    } else {
        // --sgbd is now strictly an ecuPath override — the transport always
        // comes from the ediabasx config (explicit --ediabas-config wins
        // over the auto-discovered file). The old "--sgbd alone" branch
        // forced simulation:false without a transport, which is exactly
        // what produces "Communication interface is not configured" from
        // EdiabasX's BEST2 VM.
        const configPath =
            (options.ediabasConfig && resolve(options.ediabasConfig)) ||
            findDefaultEdiabasConfig();
        const ecuPath = options.sgbd ? resolve(options.sgbd) : deriveEcuPath(ipoPath);
        resolvedEcuPath = ecuPath;

        if (configPath) {
            provider = await buildProviderFromCliConfig(configPath, ecuPath);
            iniPath = configPath;
            try {
                interfaceName = readEdiabasxCliConfig(configPath).interface;
            } catch {
                interfaceName = '';
            }
            const tag = options.ediabasConfig ? configPath : `${configPath} (auto-discovered)`;
            summary = `EdiabasX via ${tag} · ecuPath=${ecuPath}`;
        } else {
            // No config anywhere — fall back to in-memory simulation rooted
            // at the chosen ecuPath. Scripts that touch a real ECU will
            // still fail; the summary makes it obvious why.
            provider = new EdiabasXProvider({
                config: {
                    ecuPath,
                    simulation: true,
                },
                autoConnect: true,
            });
            interfaceName = 'simulation';
            summary = `EdiabasX simulation · ecuPath=${ecuPath} — no ediabasx config found (looked for ~/.config/ediabasx/config.json, ./ediabasx.config.json, $EDIABASX_CONFIG), pass --ediabas-config or --mock`;
        }
    }

    // Always announce the chosen provider so config issues aren't silent.
    // The original gating behind --debug made it too easy to miss why an
    // INPA script couldn't reach the ECU.
    console.log(chalk.gray(`EDIABAS provider: ${summary}`));

    // Wire provider events so connection issues / job errors surface
    // in the console rather than vanishing silently. The mock provider
    // is a `silent` event emitter so this only fires on the EdiabasX
    // path; safe to attach unconditionally.
    provider.on('job:error', ({ message }) => {
        console.error(chalk.red(`[ediabas] job error: ${message}`));
    });
    provider.on('connection:lost', () => {
        console.error(chalk.yellow('[ediabas] connection lost'));
    });

    await provider.init();
    return {
        provider,
        configSnapshot: {
            ecuPath: resolvedEcuPath,
            interfaceName,
            iniPath,
        },
    };
}

/**
 * Read the ediabasx CLI config shape (`{ interface, options }`), build
 * the transport via `createInterface`, and instantiate Ediabas. The
 * EdiabasXProvider just wraps the resulting Ediabas instance — this
 * mirrors what `ediabasx run` does, so users keep one config file.
 */
async function buildProviderFromCliConfig(
    configPath: string,
    ecuPath: string
): Promise<IEdiabasProvider> {
    const cliCfg = readEdiabasxCliConfig(configPath);
    const isSimulation = cliCfg.interface === 'simulation';

    let transport: unknown = undefined;
    if (!isSimulation) {
        const { createInterface } = await import('@emdzej/ediabasx-interfaces');
        // ediabasx CLI's loadConfig validates `options` as a plain object;
        // its actual shape is interface-specific (port/baudRate/host/...).
        // Cast at the boundary — createInterface narrows per interface.
        transport = createInterface(
            cliCfg.interface,
            (cliCfg.options ?? {}) as Parameters<typeof createInterface>[1]
        );
    }

    return new EdiabasXProvider({
        config: {
            ecuPath,
            simulation: isSimulation,
            // EdiabasConfig accepts `transport` for live mode — same field
            // ediabasx CLI's run command uses.
            ...(transport ? { transport } : {}),
        } as never,
        autoConnect: true,
    });
}

/**
 * Run with full TUI interface
 */
async function runWithTui(filePath: string, scriptName: string, options: RunOptions) {
    const { parseIpo } = await import('@emdzej/inpax-parser');
    const { VM, MainScheduler } = await import('@emdzej/inpax-interpreter');
    const { TuiProvider } = await import('@emdzej/inpax-tui-provider');
    const { renderTui } = await import('@emdzej/inpax-tui');

    // Parse IPO file
    const buffer = readFileSync(filePath);
    const ipo = parseIpo(buffer);

    if (options.debug) {
        console.log(chalk.gray(`Parsed IPO: ${ipo.functions.size} functions, ${ipo.screens.size} screens, ${ipo.stateMachines.size} state machines`));
    }

    const provider = new TuiProvider();
    const { provider: ediabasProvider, configSnapshot: ediabasConfigSnap } =
        await resolveEdiabasProvider(options, filePath);
    // Many BMW scripts mix INPA + INP1 result calls against the same
    // EDIABAS job. The INP1 surface is just a thin re-shape of the
    // same backend state, so wrap the same provider instance.
    const inp1Provider = new Inp1Adapter(ediabasProvider);
    // CALLE handler — currently routes `GetPrivateProfileStringA` to
    // the INI parser so script-level config (INPA.INI keys for F-key
    // bindings, screen title, contact info) actually populates.
    const nativeImports = new NodeNativeImportProvider({
        inpaRoot: deriveInpaRoot(filePath),
        ediabasConfig: ediabasConfigSnap,
    });

    // Create VM with runtime. Null providers for surfaces not yet
    // wired (print, pem, dtm, external, sps, simulation) — scripts
    // that touch them throw with a clear "provider not available"
    // error from the dispatcher rather than crashing silently here.
    const vm = new VM(ipo, {
        runtime: {
            ui: provider,
            ediabas: ediabasProvider,
            simulation: null as any,
            print: null as any,
            pem: null as any,
            dtm: null as any,
            external: null as any,
            sps: null as any,
            inp1: inp1Provider,
            nativeImports,
        },
        debug: options.debug || options.trace,
    });

    // Create main scheduler
    //const tickInterval = parseInt(options.tick || '16', 1000);
    const scheduler = new MainScheduler(vm, {
        tickInterval: 1000,
        debug: options.trace,
    });


    // Connect menu events to scheduler
    provider.on('menu:select', ({ itemNum }) => {
        // Find menu item handler in IPO
        const menuHandle = provider.state.menuHandle;
        if (menuHandle === null) return;
        const menuItem = findMenuItemHandler(ipo, menuHandle, itemNum);
        if (menuItem) {
            scheduler.queueMenuAction(itemNum, async () => {
                await vm.executeBlock(menuItem);
            });
        } else if (options.debug) {
            console.log(chalk.gray(`No handler for F${itemNum}`));
        }
    });

    // Handle exit. Tear the EDIABAS link down before letting the
    // process drop — without this, an active serial port or DoIP
    // socket can leak and block the next run.
    let cleaned = false;
    const cleanup = async () => {
        if (cleaned) return;
        cleaned = true;
        scheduler.stop();
        try {
            await ediabasProvider.end();
        } catch {
            /* ignore */
        }
        process.exit(0);
    };

    // Scheduler events
    scheduler.on('stopped', () => { void cleanup(); });
    scheduler.on('error', (err: Error) => {
        console.error(chalk.red(`Runtime error: ${err.message}`));
        if (options.debug) {
            console.error(err.stack);
        }
    });

    // Render TUI
    const { waitUntilExit } = renderTui(provider, {
        title: scriptName,
        onQuit: () => { void cleanup(); },
    });

    try {

        // Start main scheduler loop
        if (options.debug) {
            console.log(chalk.gray('Starting main scheduler...'));
        }
        scheduler.start();
        // Run inpainit() to initialize
        if (options.debug) {
            console.log(chalk.gray('Executing inpainit()...'));
        }
        await vm.run();
        // Wait for TUI to exit
        await waitUntilExit();
    } catch (error) {
        console.error(chalk.red(`Execution error: ${(error as Error).message}`));
        if (options.debug) {
            console.error((error as Error).stack);
        }
        await cleanup();
    }
}

/**
 * Run with headless CLI provider (no TUI)
 */
async function runHeadless(filePath: string, scriptName: string, options: RunOptions) {
    const { parseIpo } = await import('@emdzej/inpax-parser');
    const { VM, MainScheduler } = await import('@emdzej/inpax-interpreter');
    const { CliProvider } = await import('@emdzej/inpax-cli-provider');

    console.log(chalk.bold('=== INPAX Headless Mode ==='));
    console.log(`Script: ${scriptName}`);
    console.log(`File: ${filePath}`);
    console.log();

    // Parse IPO file
    const buffer = readFileSync(filePath);
    const ipo = parseIpo(buffer);

    console.log(chalk.gray(`Parsed: ${ipo.functions.size} functions, ${ipo.screens.size} screens, ${ipo.stateMachines.size} state machines`));

    const provider = new CliProvider();
    const { provider: ediabasProvider, configSnapshot: ediabasConfigSnap } =
        await resolveEdiabasProvider(options, filePath);
    const inp1Provider = new Inp1Adapter(ediabasProvider);
    const nativeImports = new NodeNativeImportProvider({
        inpaRoot: deriveInpaRoot(filePath),
        ediabasConfig: ediabasConfigSnap,
    });

    // Create VM with runtime
    const vm = new VM(ipo, {
        runtime: {
            ui: provider,
            ediabas: ediabasProvider,
            simulation: null as any,
            print: null as any,
            pem: null as any,
            dtm: null as any,
            external: null as any,
            sps: null as any,
            inp1: inp1Provider,
            nativeImports,
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

    let cleaned = false;
    const cleanup = async (exitCode = 0): Promise<void> => {
        if (cleaned) return;
        cleaned = true;
        scheduler.stop();
        try {
            await ediabasProvider.end();
        } catch {
            /* ignore */
        }
        process.exit(exitCode);
    };

    // Scheduler events
    scheduler.on('stopped', () => {
        console.log(chalk.gray('\nExecution stopped.'));
        void cleanup(0);
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
        //scheduler.start();

        // In headless mode, run for a limited time or until exit() is called
        console.log(chalk.yellow('Running... (Ctrl+C to stop)'));

        // Handle Ctrl+C — tear EDIABAS down cleanly so the cable's
        // session ends and the OS releases the serial / socket.
        process.on('SIGINT', () => {
            console.log(chalk.gray('\nInterrupted.'));
            void cleanup(0);
        });

    } catch (error) {
        console.error(chalk.red(`Execution error: ${(error as Error).message}`));
        if (options.debug) {
            console.error((error as Error).stack);
        }
        await cleanup(1);
    }
}

/**
 * Find the handler block for an F-key in the active menu. The F-key
 * slot lives in `header.flags` (1..10 = F1..F10, 11..20 = Shift+F1..
 * Shift+F10), not in the array index.
 */
function findMenuItemHandler(ipo: any, menuHandle: number, itemNum: number): any {
    const menu = ipo.menus.get(menuHandle);
    if (!menu) return null;
    const item = menu.items.find((m: any) => m.header.flags === itemNum);
    return item?.func ?? null;
}
