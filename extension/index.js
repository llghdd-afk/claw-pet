/**
 * ClawPet — OpenClaw Plugin (pure JS, no build step needed)
 * 
 * Gateway loads this on startup. Spawns the Electron pet window
 * and bridges Gateway events to the pet via a JSONL event file.
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync, appendFileSync, unlinkSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const EVENT_DIR = join(process.env.HOME || process.env.USERPROFILE || "", ".openclaw", "extensions");
const EVENT_FILE = join(EVENT_DIR, "claw-pet-events.jsonl");
const LOCK_FILE = join(EVENT_DIR, "claw-pet.lock");
const PROJECT_DIR = join(__dirname, "..");

let electronProcess = null;

function ensureEventDir() {
  if (!existsSync(EVENT_DIR)) mkdirSync(EVENT_DIR, { recursive: true });
}

function writeEvent(event) {
  try {
    ensureEventDir();
    appendFileSync(EVENT_FILE, JSON.stringify({ ...event, ts: Date.now() }) + "\n");
  } catch {}
}

function isAlreadyRunning() {
  try {
    if (existsSync(LOCK_FILE)) {
      const pid = parseInt(readFileSync(LOCK_FILE, "utf-8").trim(), 10);
      if (pid && !isNaN(pid)) {
        try { process.kill(pid, 0); return true; } catch {}
      }
    }
  } catch {}
  return false;
}

function createLock(pid) {
  ensureEventDir();
  writeFileSync(LOCK_FILE, String(pid));
}

function removeLock() {
  try { if (existsSync(LOCK_FILE)) unlinkSync(LOCK_FILE); } catch {}
}

function startElectron(logger) {
  if (isAlreadyRunning()) {
    logger?.info?.("🐾 ClawPet already running, skipping");
    return;
  }

  const electronScript = join(PROJECT_DIR, "electron", "main.cjs");
  if (!existsSync(electronScript)) {
    logger?.warn?.("🐾 ClawPet: electron/main.cjs not found at " + electronScript);
    return;
  }

  const isWSL = existsSync("/proc/sys/fs/binfmt_misc/WSLInterop");

  const env = {
    ...process.env,
    GATEWAY_URL: "ws://127.0.0.1:" + (process.env.OPENCLAW_GATEWAY_PORT || "18789"),
    GATEWAY_TOKEN: "",
    PET_THEME: "default",
    PET_ALWAYS_ON_TOP: "true",
    IDLE_TIMEOUT: "30",
    SHOW_BUBBLE_ON_TOOL: "true",
    BUBBLE_DURATION: "3000",
    CUSTOM_SPRITE: "",
  };

  let cmd, args, opts = { cwd: PROJECT_DIR, env, stdio: ["ignore", "pipe", "pipe"] };

  if (isWSL) {
    // WSL: launch via Windows side
    // Convert /home/llghd/.openclaw/workspace/projects/claw-pet to Windows path
    const winPath = "/mnt/" + PROJECT_DIR.replace(/^\/home\/([^/]+)/, (_, u) => u)
      .split("/").join("\\");
    cmd = "cmd.exe";
    args = ["/c", "cd", winPath, "&&", "npx", "electron", "."];
    opts.shell = false;
  } else if (process.platform === "win32") {
    cmd = "cmd.exe";
    args = ["/c", "cd", PROJECT_DIR, "&&", "npx", "electron", "."];
  } else {
    // Linux/macOS native: find electron binary
    const electronBin = join(PROJECT_DIR, "node_modules", ".bin", "electron");
    cmd = electronBin;
    args = [electronScript];
  }

  try {
    electronProcess = spawn(cmd, args, opts);

    if (electronProcess.pid) {
      createLock(electronProcess.pid);
      logger?.info?.("🐾 ClawPet started (PID " + electronProcess.pid + ")");
    }

    electronProcess.stdout?.on("data", (d) => {
      const msg = d.toString().trim();
      if (msg) logger?.debug?.("[ClawPet] " + msg);
    });

    electronProcess.stderr?.on("data", (d) => {
      const msg = d.toString().trim();
      if (msg) logger?.debug?.("[ClawPet] " + msg);
    });

    electronProcess.on("close", () => {
      electronProcess = null;
      removeLock();
      logger?.info?.("🐾 ClawPet process exited");
    });

    electronProcess.on("error", (err) => {
      logger?.warn?.("🐾 ClawPet spawn error: " + err.message);
      electronProcess = null;
    });
  } catch (err) {
    logger?.warn?.("🐾 ClawPet failed to start: " + err.message);
  }
}

function stopElectron() {
  if (electronProcess) {
    if (process.platform === "win32") {
      spawn("taskkill", ["/F", "/PID", String(electronProcess.pid)]);
    } else {
      electronProcess.kill("SIGTERM");
    }
    electronProcess = null;
  }
  removeLock();
}

export default {
  id: "claw-pet",
  name: "ClawPet",
  description: "A cute desktop pet for OpenClaw — displays AI status, reacts to tool calls, and has personality",

  register(api) {
    const logger = api.logger;
    logger?.info?.("🐾 ClawPet plugin loading...");

    ensureEventDir();
    try { writeFileSync(EVENT_FILE, ""); } catch {}

    startElectron(logger);

    // Bridge Gateway events → JSONL → Electron reads this
    if (api.registerToolCallHook) {
      api.registerToolCallHook((event) => {
        writeEvent({ type: "tool", tool: event.tool || event.name || "unknown", data: event });
      });
    }
    if (api.registerSessionHook) {
      api.registerSessionHook((event) => {
        writeEvent({ type: "session", phase: event.phase || "unknown", data: event });
      });
    }
    if (api.registerAssistantHook) {
      api.registerAssistantHook((event) => {
        writeEvent({ type: "assistant", data: event });
      });
    }

    // Heartbeat so Electron knows Gateway is alive
    const heartbeat = setInterval(() => {
      writeEvent({ type: "heartbeat" });
    }, 30000);

    logger?.info?.("🐾 ClawPet ready — events → " + EVENT_FILE);

    return {
      dispose() {
        clearInterval(heartbeat);
        stopElectron();
        logger?.info?.("🐾 ClawPet disposed");
      },
    };
  },
};
