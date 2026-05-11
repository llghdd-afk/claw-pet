/**
 * ClawPet — Renderer entry point
 * Connects: OpenClaw Gateway → StateMachine → PetScene
 */

import { PetStateMachine } from './pet/PetStateMachine.js';
import { OpenClawConnector } from './pet/OpenClawConnector.js';
import { PetScene } from './pet/PetScene.js';

// Read config from env vars (set by extension)
const GATEWAY_URL = window.electronAPI?.getEnv?.('GATEWAY_URL') || 'ws://127.0.0.1:18789';
const GATEWAY_TOKEN = window.electronAPI?.getEnv?.('GATEWAY_TOKEN') || '';
const IDLE_TIMEOUT = parseInt(window.electronAPI?.getEnv?.('IDLE_TIMEOUT') || '30');
const SHOW_BUBBLE = window.etool?.getEnv?.('SHOW_BUBBLE_ON_TOOL') !== 'false';
const BUBBLE_DURATION = parseInt(window.electronAPI?.getEnv?.('BUBBLE_DURATION') || '3000');

// Tool bubble messages
const TOOL_BUBBLES: Record<string, string> = {
  web_search: '搜索中...',
  web_fetch: '读取网页...',
  exec: '执行命令...',
  write: '写文件...',
  read: '读文件...',
  edit: '编辑文件...',
  image: '看图片...',
  sessions_send: '派单中...',
  sessions_spawn: '启动子代理...',
  image_generate: '生成图片...',
};

function init() {
  // 1. Create state machine
  const sm = new PetStateMachine(IDLE_TIMEOUT);

  // 2. Create scene
  const container = document.getElementById('pet-container')!;
  const scene = new PetScene(container as HTMLElement);

  // 3. Create connector
  const connector = new OpenClawConnector({
    wsUrl: GATEWAY_URL,
    gatewayToken: GATEWAY_TOKEN || undefined,
    onToolCall: (data) => {
      const toolName = data?.tool || data?.name || 'unknown';
      sm.toolCall(toolName);
      if (SHOW_BUBBLE) {
        const msg = TOOL_BUBBLES[toolName] || `调用 ${toolName}...`;
        scene.showBubble(msg, BUBBLE_DURATION);
      }
    },
    onSessionStart: () => {
      sm.taskStart();
      scene.showBubble('任务开始~', BUBBLE_DURATION);
    },
    onSessionEnd: () => {
      sm.taskEnd();
      scene.showBubble('完成了! ✨', BUBBLE_DURATION);
    },
    onAssistantMessage: (data) => {
      sm.interact('message');
    },
    onConnect: () => {
      console.log('🐾 Connected to OpenClaw');
      scene.showBubble('已连接到 OpenClaw ✨', 3000);
    },
    onDisconnect: () => {
      console.log('🐾 Disconnected from OpenClaw');
      scene.showBubble('断开连接...', 3000);
    },
  });

  // 4. Sync state machine → scene
  sm.onStateChange((state) => {
    scene.updateState(state);
    scene.showBubble(); // Show random bubble for new state

    // Update badge
    const dot = document.getElementById('state-dot');
    const label = document.getElementById('state-label');
    if (dot && label) {
      const colors: Record<string, string> = {
        idle: '#6c5ce7', busy: '#00b894', sulky: '#e17055',
        happy: '#fdcb6e', sleepy: '#74b9ff', alert: '#ff7675',
      };
      dot.style.background = colors[state] || '#999';
      label.textContent = state;
    }
  });

  // 5. Connect to Gateway
  connector.connect().catch(() => {
    console.log('⚠️ Gateway not available, running standalone');
    scene.showBubble('等待 OpenClaw 连接...', 5000);
  });

  // 6. Settings button
  document.getElementById('settings-btn')?.addEventListener('click', () => {
    window.electronAPI?.openSettings?.();
  });

  // Cleanup
  window.addEventListener('beforeunload', () => {
    connector.disconnect();
    sm.dispose();
    scene.destroy();
  });
}

// Wait for DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
