#!/usr/bin/env node
import { resolve, join, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { watch, existsSync, realpathSync } from 'node:fs';
import { init } from './init.js';
import { audit } from './audit.js';
import { optimizeDirectory } from './optimize.js';
import { migrate } from './migrate.js';
import { create } from './files.js';
import { templates } from './templates.js';
import { invariant } from '../core/errors.js';
const help = `svelte-imageway <command> [directory] [options]
  init [dir] --dry-run                 Configure a literal Vite plugin array and example
  typegen [dir]                       Generate typed image imports without starting Vite
  codecs --json                       Inspect installed native decoder/encoder capabilities
  optimize [dir] --dry-run --watch     Write variants to imageway-output, preserve originals
    --output <dir> --width <px> --quality <q> --format webp|avif|jpeg|png
  audit [dir] --json                   Static image audit; findings exit 1
  deploy cloudflare|docker --output <dir>  Generate configuration, never create paid resources
  purge --endpoint <https-url> --key|--prefix|--tag <value> --yes
    --token-env IMAGEWAY_PURGE_TOKEN   Protected Worker purge API; no token in arguments
  migrate [dir] --from enhanced-img|imagetools --write
  --json --help --version              Plain output respects NO_COLOR; no telemetry
`;
interface Args {
  command: string;
  positional: string[];
  flags: Record<string, string | boolean>;
}
function parse(argv: string[]): Args {
  const booleans = new Set(['json', 'help', 'version', 'dry-run', 'watch', 'write', 'yes']);
  const values = new Set([
    'output',
    'width',
    'quality',
    'format',
    'endpoint',
    'key',
    'prefix',
    'tag',
    'token-env',
    'from',
  ]);
  const positional: string[] = [],
    flags: Record<string, string | boolean> = {};
  let command = '';
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      invariant(
        booleans.has(key) || values.has(key),
        'CLI_OPTION',
        `Unknown option --${key}. Use --help.`,
      );
      invariant(!Object.hasOwn(flags, key), 'CLI_OPTION', `Duplicate option --${key}.`);
      if (booleans.has(key)) flags[key] = true;
      else {
        const value = argv[++i];
        invariant(value && !value.startsWith('--'), 'CLI_VALUE', `--${key} requires a value.`);
        flags[key] = value;
      }
    } else if (!command) command = arg;
    else positional.push(arg);
  }
  return { command, positional, flags };
}
/** Execute the public CLI without process exit, allowing packed-consumer tests. */
export async function main(argv = process.argv.slice(2), cwd = process.cwd()): Promise<number> {
  let json = false;
  try {
    const a = parse(argv),
      f = a.flags;
    json = Boolean(f.json);
    const output = (v: unknown) =>
      console.log(typeof v === 'string' && !json ? v : JSON.stringify(v, null, 2));
    if (f.version) {
      const { PACKAGE_VERSION } = await import('../version.js');
      output(PACKAGE_VERSION);
      return 0;
    }
    if (!a.command || f.help) {
      console.log(help);
      return 0;
    }
    const root = resolve(cwd, a.positional[0] ?? '.');
    const text = (key: string, fallback?: string) =>
      typeof f[key] === 'string' ? (f[key] as string) : fallback;
    const number = (key: string) => {
      if (!f[key]) return;
      const n = Number(f[key]);
      invariant(Number.isFinite(n) && n > 0, 'CLI_NUMBER', `--${key} requires a positive number.`);
      return n;
    };
    switch (a.command) {
      case 'codecs': {
        const { codecCapabilities } = await import('../node/pipeline.js');
        const capabilities = await codecCapabilities();
        output(
          json
            ? capabilities
            : Object.entries(capabilities.formats)
                .map(
                  ([name, c]) =>
                    `${name}: input=${c.input.buffer ? 'yes' : 'no'} output=${c.output.buffer ? 'yes' : 'no'}`,
                )
                .join('\n'),
        );
        return 0;
      }
      case 'typegen': {
        const { generateImageTypes } = await import('../vite/typegen.js');
        output(await generateImageTypes(root));
        return 0;
      }
      case 'init':
        output(await init(root, Boolean(f['dry-run'])));
        return 0;
      case 'audit': {
        const findings = await audit(root);
        output(
          json
            ? { findings }
            : findings.length
              ? findings.map((v) => `${v.file}:${v.line} ${v.code} ${v.message}`).join('\n')
              : 'No static image findings.',
        );
        return findings.length ? 1 : 0;
      }
      case 'optimize': {
        const run = async () =>
          output(
            await optimizeDirectory(root, {
              output: text('output') ? resolve(cwd, text('output')!) : undefined,
              width: number('width'),
              quality: number('quality'),
              format: text('format'),
              dryRun: Boolean(f['dry-run']),
            }),
          );
        await run();
        if (f.watch) {
          let timer: ReturnType<typeof setTimeout>,
            busy = false,
            dirty = false;
          const rerun = async () => {
            if (busy) {
              dirty = true;
              return;
            }
            busy = true;
            try {
              await run();
            } catch (e) {
              console.error((e as Error).message);
            } finally {
              busy = false;
              if (dirty) {
                dirty = false;
                void rerun();
              }
            }
          };
          const watcher = watch(root, { recursive: true }, (_event, name) => {
            if (
              !name ||
              (text('output') &&
                resolve(root, name).startsWith(resolve(cwd, text('output')!) + sep)) ||
              name
                .split(/[\\/]/)
                .some(
                  (v) =>
                    v.startsWith('.') ||
                    ['node_modules', 'imageway-output', 'dist', 'build'].includes(v),
                ) ||
              !/\.(png|jpe?g|webp|avif|gif|tiff?|heic|heif|jxl|svg)$/i.test(name)
            )
              return;
            clearTimeout(timer);
            timer = setTimeout(() => void rerun(), 150);
          });
          await new Promise<void>((done) => {
            const stop = () => {
              clearTimeout(timer);
              watcher.close();
              done();
            };
            process.once('SIGINT', stop);
            process.once('SIGTERM', stop);
          });
        }
        return 0;
      }
      case 'migrate':
        output(await migrate(root, text('from') ?? '', Boolean(f.write)));
        return 0;
      case 'deploy': {
        const target = a.positional[0];
        invariant(
          target === 'cloudflare' || target === 'docker',
          'DEPLOY_TARGET',
          'Use deploy cloudflare or deploy docker.',
        );
        const directory = resolve(cwd, text('output') ?? `imageway-${target}`),
          created: string[] = [];
        for (const [file, source] of Object.entries(templates))
          if (file.startsWith(target + '/')) {
            const path = join(directory, file.slice(target.length + 1));
            if (await create(path, source, Boolean(f['dry-run']))) created.push(path);
          }
        output({
          target,
          directory,
          created,
          dryRun: Boolean(f['dry-run']),
          next:
            target === 'cloudflare'
              ? [
                  'Install wrangler; create the two R2 buckets and enable Images. Costs depend on account/usage.',
                  'Set PURGE_TOKEN, METRICS_TOKEN and SIGNING_KEY_CURRENT with wrangler secret put.',
                  'Review wrangler.toml, then run wrangler deploy --dry-run before an explicitly authorized deploy.',
                ]
              : [
                  'Review sources mount and signature environment variables.',
                  'After svelte-imageway 0.1.0 is available (or substitute a locally packed artifact), run docker compose build and docker compose up.',
                  'Place the origin behind a CDN; keep admin routes private.',
                ],
        });
        return 0;
      }
      case 'purge': {
        invariant(
          f.yes,
          'PURGE_CONFIRM',
          'Purge invalidates live caches. Review the selector, then pass --yes.',
        );
        const endpoint = new URL(text('endpoint') ?? '');
        invariant(
          endpoint.protocol === 'https:' &&
            !endpoint.username &&
            !endpoint.password &&
            !endpoint.search &&
            !endpoint.hash,
          'PURGE_ENDPOINT',
          'Use a trusted HTTPS purge endpoint without credentials/query.',
        );
        const kinds = ['key', 'prefix', 'tag'].filter((k) => typeof f[k] === 'string');
        invariant(
          kinds.length === 1,
          'PURGE_SELECTOR',
          'Specify exactly one --key, --prefix or --tag.',
        );
        const token = process.env[text('token-env', 'IMAGEWAY_PURGE_TOKEN')!];
        invariant(
          token && token.length >= 32,
          'PURGE_TOKEN',
          'Set a token of at least 32 bytes in the selected environment variable.',
        );
        const response = await fetch(endpoint, {
          method: 'POST',
          redirect: 'error',
          signal: AbortSignal.timeout(15000),
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ kind: kinds[0], value: f[kinds[0]!] }),
        });
        invariant(
          response.ok,
          'PURGE_HTTP',
          `Purge returned HTTP ${response.status}; check endpoint and authorization.`,
        );
        output(await response.json());
        return 0;
      }
      default:
        throw new Error(`Unknown command ${a.command}. Use --help.`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Command failed.';
    console.error(json ? JSON.stringify({ error: message }) : `imageway: ${message}`);
    return 2;
  }
}
if (
  process.argv[1] &&
  existsSync(process.argv[1]) &&
  import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href
)
  process.exitCode = await main();
