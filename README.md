# 🐾 ClawPet

> A cute desktop pet for [OpenClaw](https://github.com/openclaw/openclaw) — lives on your screen, reacts to AI status, and has personality.

ClawPet is an [OpenClaw Extension](https://docs.openclaw.ai/extensions) that puts a little companion on your desktop. It watches what your AI is doing in real time and expresses itself through animations and speech bubbles.

```
  ╭──────╮
  │ ◕ ‿ ◕│   "在呢~"
  ╰──────╯
   ╱    ╲
```

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| **Real-time AI status** | Pet reacts to tool calls, session start/end, and assistant messages |
| **6 personality states** | idle, busy, sulky, happy, sleepy, alert — each with unique animations |
| **Speech bubbles** | Context-aware messages: "搜索中...", "写文件...", "好开心~ ✨" |
| **Click-through overlay** | Transparent window, pet sits on top of everything |
| **Drag & interact** | Drag the pet around, click to pet, double-click for settings |
| **Idle sulking** | Ignores pet for 30+ minutes? She turns her back on you 😤 |
| **Sleep schedule** | Auto-sleepy mode between 23:00–07:00 |
| **System tray** | Always accessible from the tray icon |
| **Custom themes** | Swap pet appearance via config or custom sprites |

---

## 🚀 Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) ≥ 18
- [OpenClaw](https://github.com/openclaw/openclaw) running with Gateway
- Windows 10+, macOS 12+, or Linux with a display server

### 1. Clone & Install

```bash
git clone https://github.com/llghd/claw-pet.git
cd claw-pet
npm install
```

### 2. Check Dependencies

```bash
npm run check
# Or auto-fix missing dependencies:
npm run setup
```

### 3. Run

```bash
npm start
```

The pet appears on your desktop and connects to OpenClaw Gateway at `ws://127.0.0.1:18789`.

### 4. Package (optional)

```bash
# Windows portable exe
npm run package

# All platforms
npm run package:all
```

---

## ⚙️ Configuration

ClawPet reads config from `openclaw.json` → `extensions.claw-pet`:

```json
{
  "extensions": {
    "claw-pet": {
      "enabled": true,
      "gatewayUrl": "ws://127.0.0.1:18789",
      "gatewayToken": "",
      "alwaysOnTop": true,
      "theme": "default",
      "customSpritePath": "",
      "idleTimeoutMinutes": 30,
      "showBubbleOnToolCall": true,
      "bubbleDuration": 3000
    }
  }
}
```

### Themes

| Theme | Description |
|-------|-------------|
| `default` | Simple geometric cat (built-in) |
| `cat` | Cat-shaped with ear animations |
| `robot` | Robot pet for tech enthusiasts |
| `custom` | Use your own sprite sheet |

### Custom Sprites

Place a PNG sprite sheet at `renderer/sprites/custom/sprite.png` and set `theme: "custom"`.

Sprite sheet format: 6 columns × N rows, each column is a state (idle, busy, sulky, happy, sleepy, alert).

---

## 🏗️ Architecture

```
claw-pet/
├── extension/           # OpenClaw Extension entry point (TypeScript)
│   └── index.ts         # Gateway lifecycle management
├── electron/            # Electron main process
│   └── main.cjs         # Transparent window + system tray
├── renderer/            # Pet rendering layer
│   ├── index.html       # HTML shell
│   ├── app.js           # Bootstrap: connector → state machine → scene
│   └── pet/
│       ├── PetStateMachine.ts   # 6-state personality engine
│       ├── OpenClawConnector.ts # WebSocket client for Gateway
│       └── PetScene.ts          # Canvas-based pet renderer
├── tools/
│   └── check-deps.mjs  # Dependency checker & auto-installer
├── assets/              # Icons, sprites (NOT user data)
├── openclaw.plugin.json # Extension metadata
├── package.json
└── README.md
```

### Event Flow

```
OpenClaw Gateway
    │ WebSocket
    ▼
OpenClawConnector
    │ callbacks
    ▼
PetStateMachine
    │ state change
    ▼
PetScene
    │ canvas render
    ▼
Your Screen 🐾
```

---

## 🔒 Privacy

- **No telemetry** — ClawPet doesn't phone home
- **No user data in repo** — Custom sprites, settings, and user data are gitignored
- **Gateway token** — Stored in env vars, never logged or transmitted outside Gateway
- **Local only** — WebSocket connects to localhost only by default

The `.gitignore` excludes:
- `renderer/sprites/custom/` — Your custom sprite art
- `settings.local.json` — Local overrides
- `*.custom.*` — Any custom asset files

---

## 🛠️ Development

```bash
# Watch mode (extension TypeScript)
npm run dev

# Run Electron (separate terminal)
npm start

# Run tests
npm test
```

### Project Structure

| File | Purpose |
|------|---------|
| `extension/index.ts` | OpenClaw loads this. Manages Electron process lifecycle. |
| `electron/main.cjs` | Creates transparent BrowserWindow, system tray, IPC. |
| `renderer/app.js` | Glue: connects Gateway → StateMachine → PetScene. |
| `renderer/pet/PetStateMachine.ts` | Core personality logic. Pure TS, no DOM. |
| `renderer/pet/OpenClawConnector.ts` | WebSocket client. Handles reconnection. |
| `renderer/pet/PetScene.ts` | Canvas 2D renderer. Swap with Phaser/Live2D for richer art. |

---

## 🤝 Contributing

1. Fork the repo
2. Create a feature branch
3. Make your changes
4. Run `npm run check` to verify dependencies
5. Submit a PR

**Design principles:**
- Lightweight — should use < 50MB RAM
- Privacy-first — no data leaves localhost
- Fun — the pet should make people smile

---

## 📜 License

[MIT](LICENSE)

---

## 🙏 Credits

Built on top of these amazing projects:

- [WindowPet](https://github.com/SeakMengs/WindowPet) — Tauri pet framework (architecture reference)
- [openclaw-desktop-pet](https://github.com/44-99/openclaw-desktop-pet) — OpenClaw extension pattern (reference)
- [OpenClaw](https://github.com/openclaw/openclaw) — The AI platform this pet calls home
