// Main Application Coordinator
if (typeof SoundManager === 'undefined' && typeof require === 'function') {
  const path = require('path');
  globalThis.SoundManager = require(path.join(__dirname, 'src', 'audio'));
  globalThis.InputManager = require(path.join(__dirname, 'src', 'input'));
  globalThis.LCDRenderer = require(path.join(__dirname, 'src', 'lcd'));
  globalThis.MenuManager = require(path.join(__dirname, 'src', 'games', 'menu'));
  globalThis.RacingGame = require(path.join(__dirname, 'src', 'games', 'racing'));
  globalThis.TetrisGame = require(path.join(__dirname, 'src', 'games', 'tetris'));
  globalThis.TankGame = require(path.join(__dirname, 'src', 'games', 'tanks'));
  globalThis.BreakoutGame = require(path.join(__dirname, 'src', 'games', 'breakout'));
  globalThis.FroggerGame = require(path.join(__dirname, 'src', 'games', 'frogger'));
  globalThis.WhackGame = require(path.join(__dirname, 'src', 'games', 'whack'));
  globalThis.SnakeGame = require(path.join(__dirname, 'src', 'games', 'snake'));
}

class BrickGameApp {
  constructor() {
    this.canvas = document.getElementById('lcd-screen');
    this.sound = new SoundManager();
    this.input = new InputManager();
    this.lcd = new LCDRenderer(this.canvas);

    this.sound.setRumbleCallback((dur, weak, strong) => this.input.rumble(dur, weak, strong));

    this.poweredOn = true;
    this.state = 'MENU'; // 'MENU' or 'PLAYING'
    this.currentGame = null;
    this.currentGameId = null;
    this.currentTimestamp = 0;

    this.curtainActive = false;
    this.curtainStartTime = 0;

    this.uiHeldKeys = new Set();

    this.menu = new MenuManager(this.sound, (gameId, speed, level) => {
      this.launchGame(gameId, speed, level);
    });

    this.setupUI();
    this.setupGamepadStatus();
    this.fitToWindow();
    window.addEventListener('resize', () => this.fitToWindow());

    requestAnimationFrame((ts) => this.loop(ts));
  }

  fitToWindow() {
    const container = document.querySelector('.desktop-container');
    if (!container) return;
    container.style.zoom = '1';
    const rect = container.getBoundingClientRect();
    const availW = window.innerWidth - 8;
    const availH = window.innerHeight - 4;
    if (rect.width > 0 && rect.height > 0) {
      const scale = Math.min(1, availW / rect.width, availH / rect.height);
      if (scale < 1) {
        container.style.zoom = String(Number(scale.toFixed(4)));
      }
    }
  }

  setupUI() {
    const bindBtn = (id, action) => {
      const el = document.getElementById(id);
      if (!el) return;

      const press = (e) => {
        e.preventDefault();
        this.sound.ensureContext();
        this.uiHeldKeys.add(action);
        this.input.uiState[action] = true;
        this.input.updateButtonVisuals();
      };

      const release = () => {
        if (this.uiHeldKeys.has(action)) {
          this.uiHeldKeys.delete(action);
          this.input.uiState[action] = false;
          this.input.updateButtonVisuals();
        }
      };

      el.addEventListener('mousedown', press);
      el.addEventListener('mouseup', release);
      el.addEventListener('mouseleave', release);
      el.addEventListener('touchstart', press, { passive: false });
      el.addEventListener('touchend', release);
      el.addEventListener('touchcancel', release);
    };

    const releaseAllUiKeys = () => {
      if (this.uiHeldKeys.size === 0) return;
      for (const action of this.uiHeldKeys) {
        this.input.uiState[action] = false;
      }
      this.uiHeldKeys.clear();
      this.input.updateButtonVisuals();
    };

    window.addEventListener('mouseup', releaseAllUiKeys);
    window.addEventListener('touchend', releaseAllUiKeys);
    window.addEventListener('blur', releaseAllUiKeys);

    bindBtn('btn-up', 'ArrowUp');
    bindBtn('btn-down', 'ArrowDown');
    bindBtn('btn-left', 'ArrowLeft');
    bindBtn('btn-right', 'ArrowRight');
    bindBtn('btn-action', 'Space');
    bindBtn('btn-start', 'Enter');
    bindBtn('btn-reset', 'Escape');
    bindBtn('btn-sound', 'KeyM');
    bindBtn('btn-power', 'KeyO');
  }

  setupGamepadStatus() {
    const padBadge = document.getElementById('pad-status');
    this.input.onGamepadStatusChange = (connected, name) => {
      if (padBadge) {
        if (connected) {
          padBadge.textContent = name.split('(')[0].trim() + ' Connected';
          padBadge.classList.add('connected');
        } else {
          padBadge.textContent = 'Gamepad Disconnected (Keyboard Ready)';
          padBadge.classList.remove('connected');
        }
      }
    };
  }

  triggerGameOverCurtain() {
    this.curtainActive = true;
    this.curtainStartTime = this.currentTimestamp;
  }

  launchGame(gameId, speed, level) {
    if (this.currentGame && this.currentGame.destroy) {
      this.currentGame.destroy();
    }

    this.curtainActive = false;
    this.currentGameId = gameId;

    const onGameOver = () => {
      this.triggerGameOverCurtain();
    };

    switch (gameId) {
      case 'racing':
        this.currentGame = new RacingGame(this.sound, onGameOver);
        break;
      case 'tetris':
        this.currentGame = new TetrisGame(this.sound, onGameOver);
        break;
      case 'tanks':
        this.currentGame = new TankGame(this.sound, onGameOver);
        break;
      case 'breakout':
        this.currentGame = new BreakoutGame(this.sound, onGameOver);
        break;
      case 'frogger':
        this.currentGame = new FroggerGame(this.sound, onGameOver);
        break;
      case 'whack':
        this.currentGame = new WhackGame(this.sound, onGameOver);
        break;
      case 'snake':
        this.currentGame = new SnakeGame(this.sound, onGameOver);
        break;
      default:
        this.currentGame = new RacingGame(this.sound, onGameOver);
    }

    this.currentGame.setSpeed(speed);
    this.currentGame.setLevel(level);
    this.state = 'PLAYING';
  }

  returnToMenu() {
    if (this.currentGame && this.currentGame.destroy) {
      this.currentGame.destroy();
    }
    this.curtainActive = false;
    this.currentGame = null;
    this.state = 'MENU';
    this.sound.click();
    this.sound.playTetrisTheme();
  }

  togglePower() {
    this.poweredOn = !this.poweredOn;
    this.curtainActive = false;

    if (!this.poweredOn) {
      if (this.currentGame && this.currentGame.destroy) {
        this.currentGame.destroy();
      }
      this.currentGame = null;
      this.state = 'MENU';
      this.sound.stopEngine();
      this.sound.stopMelody();
    } else {
      this.state = 'MENU';
      this.sound.click();
      this.sound.playTetrisTheme();
    }
  }

  applyCurtainOverlay(matrix, timestamp) {
    const elapsed = timestamp - this.curtainStartTime;
    const totalDuration = 800;

    if (elapsed >= totalDuration) {
      this.curtainActive = false;
      return matrix;
    }

    const overlaid = matrix.map(row => [...row]);
    let fillFromRow = 20;

    if (elapsed < 400) {
      // Phase 1: sweep UP from row 19 to row 0
      const step = Math.min(19, Math.floor(elapsed / 20));
      fillFromRow = 19 - step;
    } else {
      // Phase 2: sweep DOWN from row 0 to row 19
      const step = Math.min(20, Math.floor((elapsed - 400) / 20) + 1);
      fillFromRow = step;
    }

    for (let r = fillFromRow; r < 20; r++) {
      for (let c = 0; c < 10; c++) {
        overlaid[r][c] = 1;
      }
    }

    return overlaid;
  }

  loop(timestamp) {
    this.currentTimestamp = timestamp;

    // 1. Poll inputs (gamepad + keyboard)
    this.input.poll(timestamp);

    // Global Power Toggle (ON/OFF)
    if (this.input.justPressed('POWER')) {
      this.togglePower();
    }

    if (!this.poweredOn) {
      this.lcd.renderPowerOff();
      this.input.endFrame();
      requestAnimationFrame((ts) => this.loop(ts));
      return;
    }

    // Global Reset / Menu button
    if (this.input.justPressed('RESET')) {
      if (this.state === 'PLAYING') {
        this.returnToMenu();
      }
    }

    // Global Sound Toggle
    if (this.input.justPressed('SOUND')) {
      this.sound.toggleMute();
    }

    // 2. Active Engine Update
    const activeEngine = (this.state === 'MENU') ? this.menu : this.currentGame;

    if (activeEngine) {
      if (!this.curtainActive) {
        activeEngine.handleInput(this.input);
        activeEngine.update(timestamp);
      }

      // 3. Render frame to LCD
      let matrix = activeEngine.getDisplayMatrix();
      if (this.curtainActive) {
        matrix = this.applyCurtainOverlay(matrix, timestamp);
      }

      this.lcd.clear();
      this.lcd.renderMatrix(matrix);
      this.lcd.renderHUD(activeEngine.getHUDState(this.input.gamepadConnected));
    }

    // 4. End frame input state
    this.input.endFrame();

    requestAnimationFrame((ts) => this.loop(ts));
  }
}

// Bootstrap once DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  new BrickGameApp();
});
