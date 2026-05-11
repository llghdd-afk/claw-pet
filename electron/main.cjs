/**
 * ClawPet — Electron Main Process
 * Transparent overlay window + system tray
 */

const { app, BrowserWindow, Tray, Menu, screen, ipcMain, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

// Single instance lock
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

// Read config from env (set by OpenClaw extension or standalone)
const CONFIG = {
  gatewayUrl: process.env.GATEWAY_URL || 'ws://127.0.0.1:18789',
  gatewayToken: process.env.GATEWAY_TOKEN || '',
  theme: process.env.PET_THEME || 'default',
  alwaysOnTop: process.env.PET_ALWAYS_ON_TOP !== 'false',
  idleTimeout: process.env.IDLE_TIMEOUT || '30',
  showBubbleOnTool: process.env.SHOW_BUBBLE_ON_TOOL !== 'false',
  bubbleDuration: process.env.BUBBLE_DURATION || '3000',
  customSprite: process.env.CUSTOM_SPRITE || '',
};

let mainWindow = null;
let tray = null;
let petSize = 200;

function createWindow() {
  const { width: screenW, height: screenH } = screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
    width: petSize,
    height: petSize,
    x: screenW - petSize - 60,
    y: screenH - petSize - 20,
    transparent: true,
    frame: false,
    alwaysOnTop: CONFIG.alwaysOnTop,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    focusable: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  // Click-through on transparent areas, but interactive on pet
  mainWindow.setIgnoreMouseEvents(false);

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  // Expose config to renderer
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.send('config', CONFIG);
  });

  // IPC handlers
  ipcMain.handle('get-config', () => CONFIG);
  ipcMain.handle('get-env', (_e, key) => process.env[key] || '');
  ipcMain.handle('open-settings', () => {
    // TODO: open settings window
    console.log('Settings requested');
  });
}

function createTray() {
  // Try to find an icon
  const iconPath = path.join(__dirname, '..', 'assets', 'icon.png');
  let trayIcon;
  if (fs.existsSync(iconPath)) {
    trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  } else {
    // Create a tiny placeholder icon
    trayIcon = nativeImage.createEmpty();
  }

  tray = new Tray(trayIcon);
  tray.setToolTip('ClawPet');

  const contextMenu = Menu.buildFromTemplate([
    { label: 'ClawPet', enabled: false },
    { type: 'separator' },
    {
      label: 'Show / Hide',
      click: () => {
        if (mainWindow.isVisible()) {
          mainWindow.hide();
        } else {
          mainWindow.show();
        }
      },
    },
    {
      label: 'Always on Top',
      type: 'checkbox',
      checked: CONFIG.alwaysOnTop,
      click: (menuItem) => {
        CONFIG.alwaysOnTop = menuItem.checked;
        mainWindow.setAlwaysOnTop(CONFIG.alwaysOnTop);
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => {
    mainWindow.show();
    mainWindow.focus();
  });
}

// Event file for OpenClaw extension to push events
function watchEventFile() {
  const eventFile = path.join(
    process.env.HOME || process.env.USERPROFILE || '',
    '.openclaw', 'extensions', 'claw-pet-events.jsonl'
  );

  const dir = path.dirname(eventFile);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  let lastSize = 0;
  setInterval(() => {
    try {
      if (!fs.existsSync(eventFile)) return;
      const stat = fs.statSync(eventFile);
      if (stat.size > lastSize) {
        // Read new lines
        const content = fs.readFileSync(eventFile, 'utf-8');
        const lines = content.split('\n').filter(Boolean);
        const newLines = lines.slice(Math.floor(lastSize / 50)); // rough offset
        lastSize = stat.size;

        for (const line of newLines) {
          try {
            const event = JSON.parse(line);
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('gateway-event', event);
            }
          } catch {}
        }
      }
    } catch {}
  }, 1000);
}

// App lifecycle
app.whenReady().then(() => {
  createWindow();
  createTray();
  watchEventFile();
});

app.on('second-instance', () => {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
  }
});

app.on('window-all-closed', (e) => {
  e.preventDefault(); // Keep running in tray
});

app.on('activate', () => {
  if (mainWindow) {
    mainWindow.show();
  }
});

app.on('before-quit', () => {
  if (tray) tray.destroy();
});
