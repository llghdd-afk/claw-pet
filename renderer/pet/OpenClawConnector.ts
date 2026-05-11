/**
 * OpenClaw Connector — WebSocket client for Gateway events
 */

export interface ConnectorOptions {
  wsUrl?: string;
  gatewayToken?: string;
  onToolCall?: (data: any) => void;
  onSessionStart?: (data: any) => void;
  onSessionEnd?: (data: any) => void;
  onAssistantMessage?: (data: any) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: any) => void;
}

export class OpenClawConnector {
  private ws: any = null;
  private wsUrl: string;
  private gatewayToken: string | null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;
  private _isConnected = false;
  private clientId = 'claw-pet';
  private version = '0.1.0';
  private callbacks: Required<Pick<ConnectorOptions,
    'onToolCall' | 'onSessionStart' | 'onSessionEnd' |
    'onAssistantMessage' | 'onConnect' | 'onDisconnect' | 'onError'
  >>;

  constructor(options: ConnectorOptions = {}) {
    this.wsUrl = options.wsUrl || 'ws://127.0.0.1:18789';
    this.gatewayToken = options.gatewayToken || null;
    this.callbacks = {
      onToolCall: options.onToolCall || (() => {}),
      onSessionStart: options.onSessionStart || (() => {}),
      onSessionEnd: options.onSessionEnd || (() => {}),
      onAssistantMessage: options.onAssistantMessage || (() => {}),
      onConnect: options.onConnect || (() => {}),
      onDisconnect: options.onDisconnect || (() => {}),
      onError: options.onError || (() => {}),
    };
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        let url = this.wsUrl;
        if (this.gatewayToken) {
          url += `?token=${encodeURIComponent(this.gatewayToken)}`;
        }

        console.log('🔌 Connecting to Gateway:', this.wsUrl);
        const WebSocket = (globalThis as any).WebSocket || require('ws');
        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
          console.log('✅ Gateway connected');
          this._isConnected = true;
          this.reconnectAttempts = 0;
          this.registerClient();
          this.callbacks.onConnect();
          resolve();
        };

        this.ws.onmessage = (event: any) => {
          try {
            const msg = JSON.parse(typeof event.data === 'string' ? event.data : event.data.toString());
            this.handleMessage(msg);
          } catch (e) {
            console.error('❌ Parse error:', e);
          }
        };

        this.ws.onclose = (event: any) => {
          console.log('⚠️ Gateway closed:', event.code);
          this._isConnected = false;
          this.callbacks.onDisconnect();
          this.scheduleReconnect();
        };

        this.ws.onerror = (error: any) => {
          console.error('❌ Gateway error:', error);
          this.callbacks.onError(error);
          reject(error);
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  private registerClient() {
    if (!this.ws || this.ws.readyState !== 1) return;
    this.ws.send(JSON.stringify({
      type: 'connect',
      client: this.clientId,
      version: this.version,
      platform: 'electron',
      mode: 'ui',
      caps: ['tool-events'],
      auth: this.gatewayToken ? { token: this.gatewayToken } : undefined,
    }));
  }

  private handleMessage(msg: any) {
    if (msg.type === 'agent') {
      if (msg.stream === 'tool') {
        this.callbacks.onToolCall(msg.data);
      } else if (msg.stream === 'lifecycle') {
        if (msg.data?.phase === 'start') this.callbacks.onSessionStart(msg.data);
        else if (msg.data?.phase === 'end') this.callbacks.onSessionEnd(msg.data);
      } else if (msg.stream === 'assistant') {
        this.callbacks.onAssistantMessage(msg.data);
      }
    } else if (msg.type === 'hello-ok') {
      console.log('✅ Gateway handshake OK');
    } else if (msg.type === 'event') {
      this.callbacks.onToolCall(msg.data);
    }
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
      console.log(`🔄 Reconnecting in ${delay}ms (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
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

  get isConnected(): boolean {
    return this._isConnected && this.ws?.readyState === 1;
  }
}
