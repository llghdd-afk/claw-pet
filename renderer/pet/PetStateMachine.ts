/**
 * PetStateMachine — Core personality engine for ClawPet
 * 
 * States: idle, busy, sulky, happy, sleepy, alert
 * Each state triggers a different visual animation and speech bubble.
 */

export type PetState = 'idle' | 'busy' | 'sulky' | 'happy' | 'sleepy' | 'alert';

export interface StateTransition {
  from: PetState;
  to: PetState;
  trigger: string;
  timestamp: number;
}

export type StateChangeListener = (state: PetState, prev: PetState) => void;

export class PetStateMachine {
  private state: PetState = 'idle';
  private listeners: StateChangeListener[] = [];
  private history: StateTransition[] = [];
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private lastInteraction: number = Date.now();
  private readonly IDLE_TIMEOUT_MS: number;
  private readonly SULKY_TIMEOUT_MS = 5 * 60 * 1000; // sulky lasts max 5 min before auto-idle

  constructor(idleTimeoutMinutes = 30) {
    this.IDLE_TIMEOUT_MS = idleTimeoutMinutes * 60 * 1000;
    this.checkSleepSchedule();
    this.startIdleTimer();
  }

  get currentState(): PetState {
    return this.state;
  }

  /** Subscribe to state changes. Returns unsubscribe function. */
  onStateChange(listener: StateChangeListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  /** Transition to a new state */
  transition(to: PetState, trigger: string) {
    if (to === this.state) return;

    const prev = this.state;
    this.state = to;

    this.history.push({ from: prev, to, trigger, timestamp: Date.now() });
    if (this.history.length > 100) this.history = this.history.slice(-100);

    console.log(`🐾 State: ${prev} → ${to} (${trigger})`);
    this.listeners.forEach(l => l(to, prev));
  }

  /** User interacts with the pet */
  interact(type: 'pet' | 'click' | 'drag' | 'message') {
    this.lastInteraction = Date.now();
    this.resetIdleTimer();

    switch (type) {
      case 'pet':
        if (this.state === 'sulky') {
          this.transition('happy', 'user_broke_sulk');
          this.scheduleAutoRevert('happy', 5000);
        } else {
          this.transition('happy', 'user_pet');
          this.scheduleAutoRevert('happy', 5000);
        }
        break;
      case 'click':
      case 'drag':
        if (this.state === 'sulky') {
          this.transition('happy', 'user_broke_sulk');
          this.scheduleAutoRevert('happy', 5000);
        } else if (this.state !== 'busy') {
          this.transition('alert', 'user_click');
          this.scheduleAutoRevert('alert', 3000);
        }
        break;
      case 'message':
        this.transition('alert', 'new_message');
        this.scheduleAutoRevert('alert', 5000);
        break;
    }
  }

  /** OpenClaw task started */
  taskStart() {
    this.transition('busy', 'task_start');
    this.resetIdleTimer();
  }

  /** OpenClaw task ended */
  taskEnd() {
    if (this.state === 'busy') {
      this.transition('happy', 'task_complete');
      this.scheduleAutoRevert('happy', 3000);
    }
  }

  /** Tool call received — show brief activity */
  toolCall(toolName?: string) {
    if (this.state !== 'busy') {
      this.transition('busy', `tool:${toolName || 'unknown'}`);
    }
    this.resetIdleTimer();
  }

  /** Auto-revert from a temporary state */
  private scheduleAutoRevert(fromState: PetState, delayMs: number) {
    setTimeout(() => {
      if (this.state === fromState) {
        // Check if we should go to sleepy or idle
        const hour = new Date().getHours();
        if (hour >= 23 || hour < 7) {
          this.transition('sleepy', 'auto_revert_sleep');
        } else {
          this.transition('idle', 'auto_revert');
        }
      }
    }, delayMs);
  }

  private startIdleTimer() {
    this.idleTimer = setTimeout(() => {
      if (this.state === 'idle' || this.state === 'sulky') {
        this.transition('sulky', 'idle_timeout');
        // Sulky auto-reverts after SULKY_TIMEOUT_MS
        setTimeout(() => {
          if (this.state === 'sulky') {
            this.transition('idle', 'sulky_timeout');
          }
        }, this.SULKY_TIMEOUT_MS);
      }
    }, this.IDLE_TIMEOUT_MS);
  }

  private resetIdleTimer() {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.startIdleTimer();
  }

  private checkSleepSchedule() {
    const hour = new Date().getHours();
    if (hour >= 23 || hour < 7) {
      if (this.state === 'idle') {
        this.transition('sleepy', 'sleep_schedule');
      }
    }
    setInterval(() => {
      const h = new Date().getHours();
      if ((h >= 23 || h < 7) && this.state === 'idle') {
        this.transition('sleepy', 'sleep_schedule');
      } else if (h >= 7 && h < 23 && this.state === 'sleepy') {
        this.transition('idle', 'wake_up');
      }
    }, 60 * 60 * 1000);
  }

  getHistory(): StateTransition[] {
    return [...this.history];
  }

  getTimeSinceLastInteraction(): number {
    return Date.now() - this.lastInteraction;
  }

  dispose() {
    if (this.idleTimer) clearTimeout(this.idleTimer);
  }
}
