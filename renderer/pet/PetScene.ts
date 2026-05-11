/**
 * PetScene — Phaser scene that renders the pet
 * 
 * Renders a placeholder pet with state-based animations.
 * Replace sprites with custom art for production.
 */

export type PetState = 'idle' | 'busy' | 'sulky' | 'happy' | 'sleepy' | 'alert';

const STATE_COLORS: Record<PetState, string> = {
  idle: '#6c5ce7',
  busy: '#00b894',
  sulky: '#e17055',
  happy: '#fdcb6e',
  sleepy: '#74b9ff',
  alert: '#ff7675',
};

const STATE_EMOJI: Record<PetState, string> = {
  idle: '●‿●',
  busy: '(ง •̀_•́)ง',
  sulky: '(◕︿◕)',
  happy: '(◕ᴗ◕✿)',
  sleepy: '(─‿─)',
  alert: '(⊙_⊙)',
};

const STATE_BUBBLES: Record<PetState, string[]> = {
  idle: ['在呢~', '...', '发呆中'],
  busy: ['工作中...', '写代码中...', '搜索中...'],
  sulky: ['你怎么不理我...', '哼', '好无聊...'],
  happy: ['好开心~ ✨', '谢谢你~', '❤'],
  sleepy: ['困了...', 'Zzz...', '好想睡...'],
  alert: ['有新消息!', '有人找你!', '!'],
};

export class PetScene {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private x: number = 0;
  private y: number = 0;
  private currentState: PetState = 'idle';
  private eyeX = 0;
  private eyeY = 0;
  private blinkTimer = 0;
  private isBlinking = false;
  private breathOffset = 0;
  private bubbleText: string | null = null;
  private bubbleTimer: ReturnType<typeof setTimeout> | null = null;
  private mouseX = 0;
  private mouseY = 0;
  private size: number;

  constructor(parent: HTMLElement, size = 120) {
    this.size = size;
    this.canvas = document.createElement('canvas');
    this.canvas.width = size;
    this.canvas.height = size;
    this.canvas.style.cursor = 'grab';
    this.canvas.style.userSelect = 'none';
    parent.appendChild(this.canvas);

    this.ctx = this.canvas.getContext('2d')!;
    this.x = size / 2;
    this.y = size / 2;

    this.setupEvents();
    this.startRenderLoop();
  }

  private setupEvents() {
    // Mouse tracking for eye follow
    document.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.mouseX = e.clientX - rect.left;
      this.mouseY = e.clientY - rect.top;
    });

    // Drag
    let isDragging = false;
    let dragOffsetX = 0;
    let dragOffsetY = 0;

    this.canvas.addEventListener('mousedown', (e) => {
      isDragging = true;
      dragOffsetX = e.clientX - this.canvas.getBoundingClientRect().left;
      dragOffsetY = e.clientY - this.canvas.getBoundingClientRect().top;
      this.canvas.style.cursor = 'grabbing';
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const rect = this.canvas.parentElement!.getBoundingClientRect();
      this.canvas.style.position = 'fixed';
      this.canvas.style.left = (e.clientX - dragOffsetX) + 'px';
      this.canvas.style.top = (e.clientY - dragOffsetY) + 'px';
    });

    document.addEventListener('mouseup', () => {
      isDragging = false;
      this.canvas.style.cursor = 'grab';
    });

    // Click to interact
    this.canvas.addEventListener('click', () => {
      this.showBubble('摸摸我~');
    });

    // Double-click to open settings
    this.canvas.addEventListener('dblclick', () => {
      (window as any).electronAPI?.openSettings?.();
    });
  }

  private startRenderLoop() {
    let lastTime = 0;
    const loop = (time: number) => {
      const delta = time - lastTime;
      lastTime = time;
      this.update(delta);
      this.render();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  private update(dt: number) {
    // Blink
    this.blinkTimer += dt;
    if (this.blinkTimer > 3000 + Math.random() * 3000) {
      this.blinkTimer = 0;
      this.isBlinking = true;
      setTimeout(() => { this.isBlinking = false; }, 150);
    }

    // Breathing
    this.breathOffset += dt * 0.002;

    // Eye follow mouse
    const dx = this.mouseX - this.x;
    const dy = this.mouseY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const range = 3;
    this.eyeX = dist > 0 ? (dx / dist) * range : 0;
    this.eyeY = dist > 0 ? (dy / dist) * range : 0;
  }

  private render() {
    const ctx = this.ctx;
    const s = this.size;
    const cx = s / 2;
    const cy = s / 2;
    const breathScale = 1 + Math.sin(this.breathOffset) * 0.02;

    ctx.clearRect(0, 0, s, s);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(breathScale, breathScale);

    // Body (soft rounded shape)
    ctx.fillStyle = STATE_COLORS[this.currentState];
    ctx.beginPath();
    ctx.ellipse(0, 0, 40, 35, 0, 0, Math.PI * 2);
    ctx.fill();

    // Ears (cat-like triangles)
    ctx.fillStyle = STATE_COLORS[this.currentState];
    ctx.beginPath();
    ctx.moveTo(-30, -25);
    ctx.lineTo(-20, -45);
    ctx.lineTo(-10, -25);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(10, -25);
    ctx.lineTo(20, -45);
    ctx.lineTo(30, -25);
    ctx.fill();

    // Eyes (white + pupil)
    const eyeSpacing = 14;
    for (const side of [-1, 1]) {
      const ex = side * eyeSpacing;
      // White
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.ellipse(ex, -5, 8, this.isBlinking ? 1 : 7, 0, 0, Math.PI * 2);
      ctx.fill();
      // Pupil
      if (!this.isBlinking) {
        ctx.fillStyle = '#2d3436';
        ctx.beginPath();
        ctx.arc(ex + this.eyeX * 0.3, -5 + this.eyeY * 0.3, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Mouth
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    if (this.currentState === 'happy') {
      // Smile
      ctx.arc(0, 5, 8, 0.1 * Math.PI, 0.9 * Math.PI);
    } else if (this.currentState === 'sulky') {
      // Frown
      ctx.arc(0, 12, 8, 1.1 * Math.PI, 1.9 * Math.PI);
    } else if (this.currentState === 'sleepy') {
      // Flat line
      ctx.moveTo(-6, 6);
      ctx.lineTo(6, 6);
    } else {
      // Normal
      ctx.arc(0, 4, 6, 0.15 * Math.PI, 0.85 * Math.PI);
    }
    ctx.stroke();

    // Blush (happy/alert only)
    if (this.currentState === 'happy') {
      ctx.fillStyle = 'rgba(253, 121, 168, 0.3)';
      ctx.beginPath();
      ctx.ellipse(-22, 5, 6, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(22, 5, 6, 4, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    // State label
    ctx.fillStyle = '#dfe6e9';
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(STATE_EMOJI[this.currentState], cx, s - 8);

    // Speech bubble
    if (this.bubbleText) {
      this.renderBubble(ctx, cx, 10);
    }
  }

  private renderBubble(ctx: CanvasRenderingContext2D, x: number, y: number) {
    const text = this.bubbleText!;
    ctx.font = '13px system-ui, sans-serif';
    const metrics = ctx.measureText(text);
    const padding = 10;
    const bw = metrics.width + padding * 2;
    const bh = 28;
    const bx = x - bw / 2;
    const by = y;

    // Background
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, 8);
    ctx.fill();
    ctx.stroke();

    // Arrow
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath();
    ctx.moveTo(x - 5, by + bh);
    ctx.lineTo(x, by + bh + 6);
    ctx.lineTo(x + 5, by + bh);
    ctx.fill();

    // Text
    ctx.fillStyle = '#333';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, by + bh / 2);
  }

  updateState(state: PetState) {
    this.currentState = state;
  }

  showBubble(text?: string, durationMs = 3000) {
    if (this.bubbleTimer) clearTimeout(this.bubbleTimer);

    if (text) {
      this.bubbleText = text;
    } else {
      // Pick random from current state
      const bubbles = STATE_BUBBLES[this.currentState];
      this.bubbleText = bubbles[Math.floor(Math.random() * bubbles.length)];
    }

    this.bubbleTimer = setTimeout(() => {
      this.bubbleText = null;
      this.bubbleTimer = null;
    }, durationMs);
  }

  destroy() {
    this.canvas.remove();
  }
}
