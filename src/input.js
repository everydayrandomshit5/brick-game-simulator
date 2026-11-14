// Gamepad & Keyboard Unified Input Manager with Auto-Repeat (DAS/ARR)
class InputManager {
  constructor() {
    this.keyState = {};
    this.prevKeyState = {};
    this.uiState = {};
    this.prevUiState = {};
    this.gamepadIndex = null;
    this.gamepadConnected = false;
    this.gamepadName = 'None';
    this.axisBaseline = null;
    this.onGamepadStatusChange = null;

    this.prevGamepadButtons = {};
    this.gamepadState = {};
    this.justPressedGamepad = {};

    this.now = 0;
    this.holdStartTime = {};
    this.lastRepeatTime = {};
    this.repeatActions = ['UP', 'DOWN', 'LEFT', 'RIGHT', 'ACTION'];

    if (typeof window !== 'undefined') {
      this.initKeyboard();
      this.initGamepad();
    }
  }

  initKeyboard() {
    window.addEventListener('keydown', (e) => {
      // Prevent browser scrolling on arrow keys and space
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
      this.keyState[e.code] = true;
      this.updateButtonVisuals();
    });

    window.addEventListener('keyup', (e) => {
      this.keyState[e.code] = false;
      this.updateButtonVisuals();
    });

    window.addEventListener('blur', () => {
      this.keyState = {};
      this.updateButtonVisuals();
    });
  }

  initGamepad() {
    window.addEventListener('gamepadconnected', (e) => {
      const isPreferred = e.gamepad.mapping === 'standard' ||
        /xbox|xinput|controller|gamepad/i.test(e.gamepad.id || '');
      if (this.gamepadIndex === null || isPreferred) {
        this.gamepadIndex = e.gamepad.index;
        this.gamepadConnected = true;
        this.gamepadName = e.gamepad.id || 'Gamepad';
        this.axisBaseline = null;
        if (this.onGamepadStatusChange) {
          this.onGamepadStatusChange(true, this.gamepadName);
        }
      }
    });

    window.addEventListener('gamepaddisconnected', (e) => {
      if (this.gamepadIndex === e.gamepad.index) {
        this.gamepadIndex = null;
        this.gamepadConnected = false;
        this.gamepadName = 'None';
        this.axisBaseline = null;
        if (this.onGamepadStatusChange) {
          this.onGamepadStatusChange(false, 'Disconnected');
        }
      }
    });
  }

  // Called on each frame before game logic
  poll(now = (typeof performance !== 'undefined' ? performance.now() : Date.now())) {
    this.now = now;

    const gamepads = (typeof navigator !== 'undefined' && navigator.getGamepads) ? navigator.getGamepads() : [];
    let gp = null;

    if (this.gamepadIndex !== null && gamepads[this.gamepadIndex] && gamepads[this.gamepadIndex].connected) {
      gp = gamepads[this.gamepadIndex];
    } else {
      let fallbackGp = null;
      for (let i = 0; i < gamepads.length; i++) {
        const candidate = gamepads[i];
        if (candidate && candidate.connected) {
          if (!fallbackGp) fallbackGp = candidate;
          if (candidate.mapping === 'standard' || /xbox|xinput|controller|gamepad/i.test(candidate.id || '')) {
            gp = candidate;
            break;
          }
        }
      }
      if (!gp) gp = fallbackGp;
      if (gp) {
        this.gamepadIndex = gp.index !== undefined ? gp.index : Array.prototype.indexOf.call(gamepads, gp);
        this.axisBaseline = null;
        this.gamepadName = gp.id || 'Gamepad';
        if (!this.gamepadConnected) {
          this.gamepadConnected = true;
          if (this.onGamepadStatusChange) this.onGamepadStatusChange(true, this.gamepadName);
        }
      }
    }

    const currentButtons = [];
    if (gp) {
      const buttons = gp.buttons || [];
      for (let b = 0; b < buttons.length; b++) {
        currentButtons[b] = !!(buttons[b] && (buttons[b].pressed || buttons[b].value > 0.3));
      }

      const axes = gp.axes || [];
      const rawX = axes[0] || 0;
      const rawY = axes[1] || 0;
      const rawRX = axes.length >= 4 ? (axes[2] || 0) : 0;
      const rawRY = axes.length >= 4 ? (axes[3] || 0) : 0;

      if (!this.axisBaseline) {
        this.axisBaseline = [
          Math.abs(rawX) < 0.60 ? rawX : 0,
          Math.abs(rawY) < 0.60 ? rawY : 0,
          Math.abs(rawRX) < 0.60 ? rawRX : 0,
          Math.abs(rawRY) < 0.60 ? rawRY : 0
        ];
      }

      const baseX = this.axisBaseline[0] || 0;
      const baseY = this.axisBaseline[1] || 0;
      const deadzone = 0.58;
      const minDelta = 0.32;

      const leftStickLeft = rawX < -deadzone && (rawX - baseX) < -minDelta;
      const leftStickRight = rawX > deadzone && (rawX - baseX) > minDelta;
      const leftStickUp = rawY < -deadzone && (rawY - baseY) < -minDelta;
      const leftStickDown = rawY > deadzone && (rawY - baseY) > minDelta;

      let rightStickLeft = false;
      let rightStickRight = false;
      let rightStickUp = false;
      let rightStickDown = false;
      if (axes.length >= 4) {
        const baseRX = this.axisBaseline[2] || 0;
        const baseRY = this.axisBaseline[3] || 0;
        const rDeadzone = 0.65;
        rightStickLeft = rawRX < -rDeadzone && (rawRX - baseRX) < -minDelta;
        rightStickRight = rawRX > rDeadzone && (rawRX - baseRX) > minDelta;
        rightStickUp = rawRY < -rDeadzone && (rawRY - baseRY) < -minDelta;
        rightStickDown = rawRY > rDeadzone && (rawRY - baseRY) > minDelta;
      }

      const stickLeft = leftStickLeft || rightStickLeft;
      const stickRight = leftStickRight || rightStickRight;
      const stickUp = leftStickUp || rightStickUp;
      const stickDown = leftStickDown || rightStickDown;

      // Standard Xbox 360 mapping:
      // 0: A, 1: B, 2: X, 3: Y
      // 4: LB, 5: RB, 6: LT, 7: RT
      // 8: Back, 9: Start
      // 12: D-Up, 13: D-Down, 14: D-Left, 15: D-Right
      const actionPressed = !!(
        currentButtons[0] || currentButtons[1] || currentButtons[2] ||
        currentButtons[4] || currentButtons[5] || currentButtons[6] || currentButtons[7]
      );
      this.gamepadState = {
        up: !!(currentButtons[12] || stickUp),
        down: !!(currentButtons[13] || stickDown),
        left: !!(currentButtons[14] || stickLeft),
        right: !!(currentButtons[15] || stickRight),
        action: actionPressed, // A, B, X, LB, RB, LT, RT
        turbo: actionPressed,  // A, B, X, LB, RB, LT, RT
        start: !!currentButtons[9],  // Start
        reset: !!currentButtons[8],  // Back / Select
        sound: !!currentButtons[3]   // Y
      };
    } else {
      this.gamepadState = {};
    }

    // Calculate edge triggers for gamepad
    this.justPressedGamepad = {};
    for (const key in this.gamepadState) {
      this.justPressedGamepad[key] = this.gamepadState[key] && !this.prevGamepadButtons[key];
    }
    this.prevGamepadButtons = { ...this.gamepadState };

    // Update auto-repeat hold timers for tracked actions
    for (const action of this.repeatActions) {
      if (this.justPressed(action)) {
        this.holdStartTime[action] = this.now;
        this.lastRepeatTime[action] = this.now;
      } else if (!this.isDown(action)) {
        delete this.holdStartTime[action];
        delete this.lastRepeatTime[action];
      } else if (this.holdStartTime[action] === undefined) {
        this.holdStartTime[action] = this.now;
        this.lastRepeatTime[action] = this.now;
      }
    }

    this.updateButtonVisuals();
  }

  _codeDown(code) {
    return !!(this.keyState[code] || this.uiState[code]);
  }

  _prevCodeDown(code) {
    return !!(this.prevKeyState[code] || this.prevUiState[code]);
  }

  _codeHit(code) {
    return this._codeDown(code) && !this._prevCodeDown(code);
  }

  _rawDown(action) {
    switch (action) {
      case 'UP':
        return !!(this.gamepadState.up || this._codeDown('ArrowUp') || this._codeDown('KeyW'));
      case 'DOWN':
        return !!(this.gamepadState.down || this._codeDown('ArrowDown') || this._codeDown('KeyS'));
      case 'LEFT':
        return !!(this.gamepadState.left || this._codeDown('ArrowLeft') || this._codeDown('KeyA'));
      case 'RIGHT':
        return !!(this.gamepadState.right || this._codeDown('ArrowRight') || this._codeDown('KeyD'));
      case 'ACTION':
        return !!(this.gamepadState.action || this._codeDown('Space') || this._codeDown('KeyZ'));
      case 'TURBO':
        return !!(this.gamepadState.turbo || this._codeDown('Space') || this._codeDown('KeyZ'));
      case 'START':
        return !!(this.gamepadState.start || this._codeDown('KeyP') || this._codeDown('Enter') || this._codeDown('NumpadEnter'));
      case 'RESET':
        return !!(this.gamepadState.reset || this._codeDown('Escape') || this._codeDown('KeyR'));
      case 'SOUND':
        return !!(this.gamepadState.sound || this._codeDown('KeyM'));
      case 'POWER':
        return this._codeDown('KeyO');
      default:
        return false;
    }
  }

  isDown(action) {
    if ((action === 'LEFT' || action === 'RIGHT') && this._rawDown('LEFT') && this._rawDown('RIGHT')) {
      return false;
    }
    if ((action === 'UP' || action === 'DOWN') && this._rawDown('UP') && this._rawDown('DOWN')) {
      return false;
    }
    return this._rawDown(action);
  }

  justPressed(action) {
    if ((action === 'LEFT' || action === 'RIGHT') && this._rawDown('LEFT') && this._rawDown('RIGHT')) {
      return false;
    }
    if ((action === 'UP' || action === 'DOWN') && this._rawDown('UP') && this._rawDown('DOWN')) {
      return false;
    }

    switch (action) {
      case 'UP':
        return !!(this.justPressedGamepad.up || this._codeHit('ArrowUp') || this._codeHit('KeyW'));
      case 'DOWN':
        return !!(this.justPressedGamepad.down || this._codeHit('ArrowDown') || this._codeHit('KeyS'));
      case 'LEFT':
        return !!(this.justPressedGamepad.left || this._codeHit('ArrowLeft') || this._codeHit('KeyA'));
      case 'RIGHT':
        return !!(this.justPressedGamepad.right || this._codeHit('ArrowRight') || this._codeHit('KeyD'));
      case 'ACTION':
        return !!(this.justPressedGamepad.action || this._codeHit('Space') || this._codeHit('KeyZ'));
      case 'START':
        return !!(this.justPressedGamepad.start || this._codeHit('KeyP') || this._codeHit('Enter') || this._codeHit('NumpadEnter'));
      case 'RESET':
        return !!(this.justPressedGamepad.reset || this._codeHit('Escape') || this._codeHit('KeyR'));
      case 'SOUND':
        return !!(this.justPressedGamepad.sound || this._codeHit('KeyM'));
      case 'POWER':
        return this._codeHit('KeyO');
      default:
        return false;
    }
  }

  /**
   * Returns true on the initial press and then repeatedly at `intervalMs`
   * once the button has been held past `delayMs`.
   */
  justPressedOrRepeated(action, delayMs = 170, intervalMs = 55) {
    if (this.justPressed(action)) {
      return true;
    }
    if (this.isDown(action) && this.holdStartTime[action] !== undefined) {
      if (this.now - this.holdStartTime[action] >= delayMs &&
          this.now - this.lastRepeatTime[action] >= intervalMs) {
        this.lastRepeatTime[action] = this.now;
        return true;
      }
    }
    return false;
  }

  endFrame() {
    this.prevKeyState = { ...this.keyState };
    this.prevUiState = { ...this.uiState };
  }

  /**
   * Trigger dual-motor XInput gamepad vibration when a controller is connected.
   */
  rumble(durationMs = 60, weakMagnitude = 0.5, strongMagnitude = 0.5) {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return;
    const gamepads = navigator.getGamepads();
    let gp = null;

    if (this.gamepadIndex !== null && gamepads[this.gamepadIndex]) {
      gp = gamepads[this.gamepadIndex];
    } else {
      for (let i = 0; i < gamepads.length; i++) {
        if (gamepads[i] && gamepads[i].connected) {
          gp = gamepads[i];
          break;
        }
      }
    }

    if (!gp) return;

    const dur = Math.max(10, Math.round(durationMs));
    const weak = Math.max(0, Math.min(1, weakMagnitude));
    const strong = Math.max(0, Math.min(1, strongMagnitude));

    if (gp.vibrationActuator && typeof gp.vibrationActuator.playEffect === 'function') {
      gp.vibrationActuator.playEffect('dual-rumble', {
        startDelay: 0,
        duration: dur,
        weakMagnitude: weak,
        strongMagnitude: strong
      }).catch(() => {});
    } else if (gp.hapticActuators && gp.hapticActuators[0] && typeof gp.hapticActuators[0].pulse === 'function') {
      gp.hapticActuators[0].pulse(Math.max(weak, strong), dur).catch(() => {});
    }
  }

  // Visual button depression on the console
  updateButtonVisuals() {
    if (typeof document === 'undefined') return;
    this.setBtnClass('btn-up', this.isDown('UP'));
    this.setBtnClass('btn-down', this.isDown('DOWN'));
    this.setBtnClass('btn-left', this.isDown('LEFT'));
    this.setBtnClass('btn-right', this.isDown('RIGHT'));
    this.setBtnClass('btn-action', this.isDown('ACTION') || this.isDown('TURBO'));
    this.setBtnClass('btn-start', this.isDown('START'));
    this.setBtnClass('btn-reset', this.isDown('RESET'));
    this.setBtnClass('btn-sound', this.isDown('SOUND'));
    this.setBtnClass('btn-power', this.isDown('POWER'));
  }

  setBtnClass(id, pressed) {
    const el = document.getElementById(id);
    if (!el) return;
    if (pressed) {
      el.classList.add('active');
    } else {
      el.classList.remove('active');
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = InputManager;
}
