/**
 * OpenClaw Connector — WebSocket client for Gateway events
 */
export class OpenClawConnector {
  constructor(options = {}) {
    this.wsUrl = options.wsUrl || 'ws://127.0.0.1:18789';
    this.gatewayToken = options.gatewayToken || null;
    this.onToolCall = options.onToolCall || (() => {});
    this.onSessionStart = options.onSessionStart || (() => {});
    this.onSessionEnd = options.onSessionEnd || (() => {});
    this.onAssistantMessage = options.onAssistantMessage || (() => {});
    this.onConnect = options.onConnect || (() => {});
    this.onDisconnect = options.onDisconnect || (() => {});
    this.onError = options.onError || (() => {});
    this.ws = null;
    this._isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 1000;
  }

  connect() {
    return new Promise((resolve, reject) => {
      try {
        let url = this.wsUrl;
        if (this.gatewayToken) {
          url += '?token=' + encodeURIComponent(this.gatewayToken);
        }
        console.log('🔌 Connecting to Gateway:', this.wsUrl);
        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
          console.log('✅ Gateway connected');
          this._isConnected = true;
          this.reconnectAttempts = 0;
          this.registerClient();
          this.onConnect();
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(typeof event.data === 'string' ? event.data : event.data.toString());
            this.handleMessage(msg);
          } catch (e) {
            console.error('❌ Parse error:', e);
          }
        };

        this.ws.onclose = (event) => {
          console.log('⚠️ Gateway closed:', event.code);
          this._isConnected = false;
          this.onDisconnect();
          this.scheduleReconnect();
        };

        this.ws.onerror = (error) => {
          console.error('❌ Gateway error:', error);
          this.onError(error);
          reject(error);
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  registerClient() {
    if (!this.ws || this.ws.readyState !== 1) return;
    this.ws.send(JSON.stringify({
      type: 'connect',
      client: 'claw-pet',
      version: '0.1.0',
      platform: 'electron',
      mode: 'ui',
      caps: ['tool-events'],
      auth: this.gatewayToken ? { token: this.gatewayToken } : undefined,
    }));
  }

  handleMessage(msg) {
    if (msg.type === 'agent') {
      if (msg.stream === 'tool') {
        this.onToolCall(msg.data);
      } else if (msg.stream === 'lifecycle') {
        if (msg.data && msg.data.phase === 'start') this.onSessionStart(msg.data);
        else if (msg.data && msg.data.phase === 'end') this.onSessionEnd(msg.data);
      } else if (msg.stream === 'assistant') {
        this.onAssistantMessage(msg.data);
      }
    } else if (msg.type === 'hello-ok') {
      console.log('✅ Gateway handshake OK');
    } else if (msg.type === 'event') {
      this.onToolCall(msg.data);
    }
  }

  scheduleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
      console.log('🔄 Reconnecting in ' + delay + 'ms (' + this.reconnectAttempts + '/' + this.maxReconnectAttempts + ')');
      setTimeout(() => this.connect().catch(() => {}), delay);
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this._isConnected = false;
    }
  }

  get isConnected() {
    return this._isConnected && this.ws && this.ws.readyState === 1;
  }
}
