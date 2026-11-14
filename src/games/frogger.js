// Game E: Frogs Crossing the River (Frogger) for Brick Game
class FroggerGame {
  constructor(sound, onGameOver) {
    this.sound = sound;
    this.onGameOver = onGameOver;

    this.COLS = 10;
    this.ROWS = 20;

    this.GOAL_COLS = [1, 3, 5, 7, 9];
    this.WALL_COLS = [0, 2, 4, 6, 8];
    this.goals = [false, false, false, false, false];

    this.frogX = 4;
    this.frogY = 19;
    this.frogBlink = true;
    this.resetBlinkTimer = false;
    this.lastBlinkTime = 0;

    this.lanes = [];

    this.score = 0;
    this.highScore = this.loadHighScore();
    this.speed = 1;
    this.initialSpeed = 1;
    this.level = 1;
    this.lives = 4;

    this.isPaused = false;
    this.wasPaused = false;
    this.gameOver = false;
    this.isCrashing = false;
    this.crashStartTime = 0;
    this.crashFlashOn = true;

    this.initLanes();
  }

  loadHighScore() {
    if (typeof localStorage !== 'undefined') {
      return parseInt(localStorage.getItem('brick_frogger_hi') || '0', 10) || 0;
    }
    return 0;
  }

  saveHighScore() {
    if (this.score > this.highScore) {
      this.highScore = this.score;
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('brick_frogger_hi', String(this.highScore));
      }
    }
  }

  setSpeed(s) {
    this.speed = Math.max(1, Math.min(10, s));
    this.initialSpeed = this.speed;
  }

  setLevel(l) {
    this.level = Math.max(1, Math.min(10, l));
    this.initLanes();
  }

  buildLanePattern(basePattern, extraDensity) {
    const pattern = [...basePattern];
    if (extraDensity > 0) {
      let added = 0;
      for (let i = 0; i < pattern.length && added < extraDensity; i++) {
        const emptyCount = pattern.filter(v => v === 0).length;
        if (emptyCount <= 3) break; // Always preserve at least 3 open gaps
        if (pattern[i] === 0 && ((i * 3 + this.level) % 2 === 0)) {
          pattern[i] = 1;
          added++;
        }
      }
    }
    return pattern;
  }

  initLanes() {
    const extra = Math.floor((this.level - 1) / 3); // 0..3 extra blocks at higher levels

    const specs = [
      { row: 2,  dir: -1, speedMult: 1.35, base: [1, 1, 1, 0, 0, 1, 1, 0, 0, 0] },
      { row: 4,  dir:  1, speedMult: 1.00, base: [1, 1, 0, 0, 1, 1, 1, 0, 0, 0] },
      { row: 6,  dir: -1, speedMult: 1.50, base: [1, 1, 0, 0, 0, 1, 1, 0, 0, 0] },
      { row: 7,  dir:  1, speedMult: 0.85, base: [1, 1, 1, 0, 0, 0, 1, 1, 0, 0] },
      { row: 11, dir: -1, speedMult: 1.15, base: [1, 1, 0, 0, 1, 1, 0, 0, 0, 0] },
      { row: 13, dir:  1, speedMult: 1.40, base: [1, 1, 1, 0, 0, 1, 0, 0, 0, 0] },
      { row: 15, dir: -1, speedMult: 0.90, base: [1, 1, 0, 0, 0, 1, 1, 0, 0, 0] },
      { row: 17, dir:  1, speedMult: 1.10, base: [1, 1, 0, 0, 1, 1, 0, 0, 0, 0] }
    ];

    this.lanes = specs.map((spec, idx) => ({
      row: spec.row,
      dir: spec.dir,
      offset: (idx * 2) % 10,
      speedMult: spec.speedMult,
      pattern: this.buildLanePattern(spec.base, extra),
      lastStepTime: 0
    }));
  }

  getLaneCell(lane, col) {
    if (lane.dir === 1) {
      return lane.pattern[((col - lane.offset) % 10 + 10) % 10];
    }
    return lane.pattern[(col + lane.offset) % 10];
  }

  isHazardAt(x, y) {
    const lane = this.lanes.find(l => l.row === y);
    if (!lane) return false;
    return this.getLaneCell(lane, x) === 1;
  }

  handleInput(input) {
    if (this.gameOver) {
      if (input.justPressed('ACTION') || input.justPressed('START')) {
        this.resetGame();
      }
      return;
    }

    let unpausedThisFrame = false;
    if (input.justPressed('START')) {
      this.isPaused = !this.isPaused;
      this.sound.pause();
      this.wasPaused = true;
      if (this.isPaused) {
        return;
      }
      unpausedThisFrame = true;
      if (input.now) {
        this.lastBlinkTime = input.now;
        if (this.isCrashing) this.crashStartTime = input.now;
        for (const lane of this.lanes) {
          lane.lastStepTime = input.now;
        }
      }
    }

    if (this.isPaused || this.isCrashing) return;

    let moved = false;
    if (input.justPressedOrRepeated('UP', 150, 80) || input.justPressedOrRepeated('ACTION', 150, 80) || (unpausedThisFrame && input.isDown('UP'))) {
      if (this.frogY > 0) {
        this.frogY--;
        moved = true;
      }
    } else if (input.justPressedOrRepeated('DOWN', 150, 80) || (unpausedThisFrame && input.isDown('DOWN'))) {
      if (this.frogY < this.ROWS - 1) {
        this.frogY++;
        moved = true;
      }
    } else if (input.justPressedOrRepeated('LEFT', 150, 80) || (unpausedThisFrame && input.isDown('LEFT'))) {
      if (this.frogX > 0) {
        this.frogX--;
        moved = true;
      }
    } else if (input.justPressedOrRepeated('RIGHT', 150, 80) || (unpausedThisFrame && input.isDown('RIGHT'))) {
      if (this.frogX < this.COLS - 1) {
        this.frogX++;
        moved = true;
      }
    }

    if (moved) {
      this.frogBlink = true;
      this.resetBlinkTimer = true;
      this.sound.move();
      this.checkFrogState();
    }
  }

  checkFrogState(timestamp = 0) {
    // Reached top goal row
    if (this.frogY === 0) {
      const goalIdx = this.GOAL_COLS.indexOf(this.frogX);
      if (goalIdx !== -1 && !this.goals[goalIdx]) {
        this.goals[goalIdx] = true;
        this.score += 100 * this.level;
        this.saveHighScore();
        this.sound.clear();

        this.frogX = 4;
        this.frogY = 19;

        if (this.goals.every(Boolean)) {
          this.score += 500;
          this.saveHighScore();
          this.goals = [false, false, false, false, false];
          if (this.speed < 10) this.speed++;
          if (this.level < 10) this.level++;
          this.initLanes();
        }
      } else {
        this.triggerCrash(timestamp);
      }
      return;
    }

    if (this.isHazardAt(this.frogX, this.frogY)) {
      this.triggerCrash(timestamp);
    }
  }

  update(timestamp) {
    if (this.isPaused) {
      this.wasPaused = true;
      return;
    }
    if (this.gameOver) return;

    if (this.wasPaused) {
      this.wasPaused = false;
      this.lastBlinkTime = timestamp;
      if (this.isCrashing) this.crashStartTime = timestamp;
      for (const lane of this.lanes) {
        lane.lastStepTime = timestamp;
      }
    }

    // Blink frog rapidly so it stands out on the 10x20 grid
    if (!this.lastBlinkTime || this.resetBlinkTimer) {
      this.lastBlinkTime = timestamp;
      this.resetBlinkTimer = false;
    }
    if (timestamp - this.lastBlinkTime >= 110) {
      this.lastBlinkTime = timestamp;
      this.frogBlink = !this.frogBlink;
    }

    // Handle crash animation (900ms)
    if (this.isCrashing) {
      if (!this.crashStartTime) this.crashStartTime = timestamp;
      const elapsed = timestamp - this.crashStartTime;
      this.crashFlashOn = Math.floor(elapsed / 100) % 2 === 0;

      if (elapsed >= 900) {
        this.isCrashing = false;
        this.crashStartTime = 0;
        this.crashFlashOn = true;

        if (this.lives <= 0) {
          this.gameOver = true;
          this.saveHighScore();
          if (this.onGameOver) this.onGameOver();
        } else {
          this.frogX = 4;
          this.frogY = 19;
          for (const lane of this.lanes) {
            lane.lastStepTime = timestamp;
          }
        }
      }
      return;
    }

    // Advance each moving lane independently by its speed multiplier
    const baseLaneInterval = Math.max(120, 620 - (this.speed * 46));
    for (const lane of this.lanes) {
      if (!lane.lastStepTime) lane.lastStepTime = timestamp;
      const laneInterval = baseLaneInterval / lane.speedMult;
      if (timestamp - lane.lastStepTime >= laneInterval) {
        lane.lastStepTime = timestamp;
        lane.offset = (lane.offset + 1) % 10;

        if (this.frogY === lane.row && this.isHazardAt(this.frogX, this.frogY)) {
          this.triggerCrash(timestamp);
          return;
        }
      }
    }
  }

  triggerCrash(timestamp = 0) {
    this.isCrashing = true;
    this.crashStartTime = timestamp;
    this.crashFlashOn = true;
    this.lives--;
    this.sound.crash();
  }

  resetGame() {
    this.speed = this.initialSpeed;
    this.score = 0;
    this.lives = 4;
    this.gameOver = false;
    this.isPaused = false;
    this.wasPaused = false;
    this.isCrashing = false;
    this.crashStartTime = 0;
    this.crashFlashOn = true;
    this.goals = [false, false, false, false, false];
    this.frogX = 4;
    this.frogY = 19;
    this.initLanes();
  }

  destroy() {}

  getDisplayMatrix() {
    const grid = Array(this.ROWS).fill(null).map(() => Array(this.COLS).fill(0));

    // 1. Row 0: Permanent bank walls & filled goal pockets
    for (const wc of this.WALL_COLS) {
      grid[0][wc] = 1;
    }
    for (let i = 0; i < this.GOAL_COLS.length; i++) {
      if (this.goals[i]) {
        grid[0][this.GOAL_COLS[i]] = 1;
      }
    }

    // 2. Moving obstacle lanes
    for (const lane of this.lanes) {
      for (let c = 0; c < this.COLS; c++) {
        if (this.getLaneCell(lane, c) === 1) {
          grid[lane.row][c] = 1;
        }
      }
    }

    // 3. Player frog (rapid blink when alive, crash flash when hit)
    const showFrog = this.isCrashing ? this.crashFlashOn : this.frogBlink;
    if (showFrog && this.frogY >= 0 && this.frogY < this.ROWS && this.frogX >= 0 && this.frogX < this.COLS) {
      grid[this.frogY][this.frogX] = 1;
    }

    return grid;
  }

  getHUDState(gamepadConnected) {
    const preview = Array(4).fill(null).map(() => Array(4).fill(0));
    for (let i = 0; i < 4; i++) {
      preview[0][i] = i < this.lives ? 1 : 0;
    }

    return {
      score: this.score,
      highScore: this.highScore,
      speed: this.speed,
      level: this.level,
      lives: this.lives,
      isPaused: this.isPaused,
      gameOver: this.gameOver,
      isMuted: this.sound.muted,
      gamepadConnected: gamepadConnected,
      preview: preview
    };
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = FroggerGame;
}
