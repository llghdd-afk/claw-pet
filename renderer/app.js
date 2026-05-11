/**
 * ClawPet — Renderer entry point
 * Connects: OpenClaw Gateway → StateMachine → PetScene
 */

import { PetStateMachine } from './pet/PetStateMachine.js';
import { OpenClawConnector } from './pet/OpenClawConnector.js';
import { PetScene } from './pet/PetScene.js';

// Read config from env vars (set by extension / electron)
const GATEWAY_URL = (window.electronAPI && window.electronAPI.getEnv)
  ? window.electronAPI.getEnv('GATEWAY_URL')
  : 'ws://127.0.0.1:18789';
const GATEWAY_TOKEN = (window.electronAPI && window.electronAPI.getEnv)
  ? window.electronAPI.getEnv('GATEWAY_TOKEN')
  : '';
const IDLE_TIMEOUT = parseInt(
  (window.electronAPI && window.electronAPI.getEnv('IDLE_TIMEOUT')) || '30'
);
const SHOW_BUBBLE = (window.electronAPI && window.electronAPI.getEnv('SHOW_BUBBLE_ON_TOOL'))
  ? window.electronAPI.getEnv('SHOW_BUBBLE_ON_TOOL') !== 'false'
  : true;
const BUBBLE_DURATION = parseInt(
  (window.electronAPI && window.electronAPI.getEnv('BUBBLE_DURATION')) || '3000'
);

// Tool bubble messages
const TOOL_BUBBLES = {
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
  // 1. State machine
  var sm = new PetStateMachine(IDLE_TIMEOUT);

  // 2. Scene
  var container = document.getElementById('pet-container');
  var scene = new PetScene(container, 120);

  // 3. Connector
  var connector = new OpenClawConnector({
    wsUrl: GATEWAY_URL,
    gatewayToken: GATEWAY_TOKEN || undefined,
    onToolCall: function(data) {
      var toolName = (data && data.tool) || (data && data.name) || 'unknown';
      sm.toolCall(toolName);
      if (SHOW_BUBBLE) {
        var msg = TOOL_BUBBLES[toolName] || '调用 ' + toolName + '...';
        scene.showBubble(msg, BUBBLE_DURATION);
      }
    },
    onSessionStart: function() {
      sm.taskStart();
      scene.showBubble('任务开始~', BUBBLE_DURATION);
    },
    onSessionEnd: function() {
      sm.taskEnd();
      scene.showBubble('完成了! ✨', BUBBLE_DURATION);
    },
    onAssistantMessage: function() {
      sm.interact('message');
    },
    onConnect: function() {
      console.log('🐾 Connected to OpenClaw');
      scene.showBubble('已连接到 OpenClaw ✨', 3000);
    },
    onDisconnect: function() {
      console.log('🐾 Disconnected from OpenClaw');
      scene.showBubble('断开连接...', 3000);
    },
  });

  // 4. Sync state machine → scene
  sm.onStateChange(function(state) {
    scene.updateState(state);
    scene.showBubble(null);

    var dot = document.getElementById('state-dot');
    var label = document.getElementById('state-label');
    if (dot && label) {
      var colors = {
        idle: '#6c5ce7', busy: '#00b894', sulky: '#e17055',
        happy: '#fdcb6e', sleepy: '#74b9ff', alert: '#ff7675',
      };
      dot.style.background = colors[state] || '#999';
      label.textContent = state;
    }
  });

  // 5. Connect
  connector.connect().catch(function() {
    console.log('⚠️ Gateway not available, running standalone');
    scene.showBubble('等待 OpenClaw 连接...', 5000);
  });

  // 6. Settings
  var btn = document.getElementById('settings-btn');
  if (btn) {
    btn.addEventListener('click', function() {
      if (window.electronAPI && window.electronAPI.openSettings) {
        window.electronAPI.openSettings();
      }
    });
  }

  // 7. Cleanup
  window.addEventListener('beforeunload', function() {
    connector.disconnect();
    sm.dispose();
    scene.destroy();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
