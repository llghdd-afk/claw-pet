/**
 * ClawPet — OpenClaw Extension Entry
 * 
 * Loaded by OpenClaw Gateway. Manages the Electron pet window
 * and receives real-time events via Extension API.
 */

import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface PetConfig {
  enabled?: boolean;
  alwaysOnTop?: boolean;
  theme?: string;
  gatewayUrl?: string;
  gatewayToken?: string;
  customSpritePath?: string;
  idleTimeoutMinutes?: number;
  showBubbleOnToolCall?: boolean;
  bubbleDuration?: number;
}

const EXTENSION_ID = 'claw-pet';
const LOCK_FILE = path.join(
  process.env.HOME || process.env.USERPROFILE || '',
  '.openclaw', 'extensions', EXTENSION_ID + '.lock'
);

let electronProcess: ChildProcess | null = null;
let electronPid: number | null = null;

function isAlreadyRunning(): boolean {
  try {
    if (fs.existsSync(LOCK_FILE)) {
      const pid = parseInt(fs.readFileSync(LOCK_FILE, 'utf-8').trim(), 10);
      if (pid && !isNaN(pid)) {
        try {
          process.kill(pid, 0);
          console.log(`ℹ️ ClawPet already running (PID ${pid}), skipping init`);
          return true;
        } catch {
          fs.unlinkSync(LOCK_FILE);
        }
      }
    }
  } catch (e) {
    console.error('❌ Lock check failed:', e);
  }
  return false;
}

function createLock(pid: number) {
  const dir = path.dirname(LOCK_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(LOCK_FILE, String(pid));
}

function removeLock() {
  if (fs.existsSync(LOCK_FILE)) fs.unlinkSync(LOCK_FILE);
}

function startElectron(config: PetConfig) {
  const extRoot = path.join(__dirname, '..');
  const electronCmd = process.platform === 'win32'
    ? path.join(extRoot, 'node_modules', '.bin', 'electron.cmd')
    : path.join(extRoot, 'node_modules', '.bin', 'electron');
  const electronScript = path.join(extRoot, 'electron', 'main.cjs');

  // Resolve config values to pass as env vars
  const env: Record<string, string> = {
    ...process.env as Record<string, string>,
    PET_THEME: config.theme || 'default',
    PET_ALWAYS_ON_TOP: String(config.alwaysOnTop ?? true),
    GATEWAY_URL: config.gatewayUrl || 'ws://127.0.0.1:18789',
    GATEWAY_TOKEN: config.gatewayToken || '',
    IDLE_TIMEOUT: String(config.idleTimeoutMinutes || 30),
    SHOW_BUBBLE_ON_TOOL: String(config.showBubbleOnToolCall ?? true),
    BUBBLE_DURATION: String(config.bubbleDuration || 3000),
    CUSTOM_SPRITE: config.customSpritePath || '',
  };

  electronProcess = spawn(electronCmd, [electronScript], {
    cwd: extRoot,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (electronProcess.pid) {
    electronPid = electronProcess.pid;
    createLock(electronPid);
  }

  electronProcess.stdout?.on('data', (d) => console.log(`[ClawPet] ${d.toString().trim()}`));
  electronProcess.stderr?.on('data', (d) => console.error(`[ClawPet] ${d.toString().trim()}`));

  electronProcess.on('close', () => {
    electronProcess = null;
    electronPid = null;
    removeLock();
  });
}

function stopProcess() {
  if (electronProcess) {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/F', '/PID', String(electronProcess.pid)]);
    } else {
      electronProcess.kill('SIGTERM');
    }
    electronProcess = null;
  }
}

/**
 * Extension registration function
 * Called by OpenClaw Gateway when the extension is loaded
 */
export default function register(api: any) {
  if (isAlreadyRunning()) {
    return { dispose: () => {} };
  }

  const config: PetConfig = api.config || {};

  if (config.enabled === false) {
    console.log('ℹ️ ClawPet disabled in config');
    return { dispose: () => {} };
  }

  console.log('🐾 ClawPet initializing...');
  startElectron(config);

  // Forward lifecycle events to the pet process via env file
  // The Electron process watches this file for event signals
  const eventFile = path.join(
    process.env.HOME || process.env.USERPROFILE || '',
    '.openclaw', 'extensions', 'claw-pet-events.jsonl'
  );

  api.onConfigChange?.((newConfig: PetConfig) => {
    console.log('📝 ClawPet config updated:', JSON.stringify(newConfig));
    // Could restart electron with new config, but for now just log
  });

  console.log('✅ ClawPet ready');
  console.log('  Config:', JSON.stringify({
    theme: config.theme || 'default',
    alwaysOnTop: config.alwaysOnTop ?? true,
  }));

  return {
    dispose: () => {
      console.log('🐾 ClawPet shutting down...');
      stopProcess();
      removeLock();
    }
  };
}
