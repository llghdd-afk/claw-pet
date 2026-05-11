/**
 * PetStateMachine — Core personality engine for ClawPet
 * 6 states: idle, busy, sulky, happy, sleepy, alert
 */

export class PetStateMachine {
  constructor(idleTimeoutMinutes = 30) {
    this.IDLE_TIMEOUT_MS = idleTimeoutMinutes * 60 * 1000;
    this.SULKY_TIMEOUT_MS = 5 * 60 * 1000;
    this.state = 'idle';
    this.listeners = [];
    this.history = [];
    this.idleTimer = null;
    this.lastInteraction = Date.now();
    this.checkSleepSchedule();
    this.startIdleTimer();
  }

  get currentState() {
    return this.state;
  }

  onStateChange(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  transition(to, trigger) {
    if (to === this.state) return;
    const prev = this.state;
    this.state = to;
    this.history.push({ from: prev, to, trigger, timestamp: Date.now() });
    if (this.history.length > 100) this.history = this.history.slice(-100);
    console.log(`🐾 State: ${prev} → ${to} (${trigger})`);
    this.listeners.forEach(l => l(to, prev));
  }

  interact(type) {
    this.lastInteraction = Date.now();
    this.resetIdleTimer();
    switch (type) {
      case 'pet':
        if (this.state === 'sulky') {
          this.transition('happy', 'user_broke_sulk');
        } else {
          this.transition('happy', 'user_pet');
        }
        this.scheduleAutoRevert('happy', 5000);
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

  taskStart() {
    this.transition('busy', 'task_start');
    this.resetIdleTimer();
  }

  taskEnd() {
    if (this.state === 'busy') {
      this.transition('happy', 'task_complete');
      this.scheduleAutoRevert('happy', 3000);
    }
  }

  toolCall(toolName) {
    if (this.state !== 'busy') {
      this.transition('busy', 'tool:' + (toolName || 'unknown'));
    }
    this.resetIdleTimer();
  }

  scheduleAutoRevert(fromState, delayMs) {
    setTimeout(() => {
      if (this.state === fromState) {
        const hour = new Date().getHours();
        if (hour >= 23 || hour < 7) {
          this.transition('sleepy', 'auto_revert_sleep');
        } else {
          this.transition('idle', 'auto_revert');
        }
      }
    }, delayMs);
  }

  startIdleTimer() {
    this.idleTimer = setTimeout(() => {
      if (this.state === 'idle' || this.state === 'sulky') {
        this.transition('sulky', 'idle_timeout');
        setTimeout(() => {
          if (this.state === 'sulky') {
            this.transition('idle', 'sulky_timeout');
          }
        }, this.SULKY_TIMEOUT_MS);
      }
    }, this.IDLE_TIMEOUT_MS);
  }

  resetIdleTimer() {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.startIdleTimer();
  }

  checkSleepSchedule() {
    const hour = new Date().getHours();
    if (hour >= 23 || hour < 7) {
      if (this.state === 'idle') this.transition('sleepy', 'sleep_schedule');
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

  getHistory() { return [...this.history]; }

  getTimeSinceLastInteraction() { return Date.now() - this.lastInteraction; }

  dispose() {
    if (this.idleTimer) clearTimeout(this.idleTimer);
  }
}
