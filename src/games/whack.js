// Game F: Whack-a-Mole / Shooting Gallery for Brick Game
class WhackGame {
  constructor(sound, onGameOver) {
    this.sound = sound;
    this.onGameOver = onGameOver;

    this.COLS = 10;
    this.ROWS = 20;

    this.playerX = 4; // Nose at (playerX, 18), base at (playerX-1..playerX+1, 19)
    this.bullets = []; // { x, y }
    this.grid = [];    // Rows 0..17 hold descending target bricks

    this.score = 0;
    this.highScore = this.loadHighScore();
    this.speed = 1;
    this.initialSpeed = 1;
    this.level = 1;
    this.lives = 4;
    this.bricksCleared = 0;

    this.isPaused = false;
    this.wasPaused = false;
    this.gameOver = false;
    this.isCrashing = false;
    this.crashStartTime = 0;
    this.crashFlashOn = true;

    this.lastBulletTime = 0;
    this.lastStepTime = 0;

    this.initGrid();
  }

  loadHighScore() {
    if (typeof localStorage !== 'undefined') {
      return parseInt(localStorage.getItem('brick_whack_hi') || '0', 10) || 0;
    }
    return 0;
  }

  saveHighScore() {
    if (this.score > this.highScore) {
      this.highScore = this.score;
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('brick_whack_hi', String(this.highScore));
      }
    }
  }

  setSpeed(s) {
    this.speed = Math.max(1, Math.min(10, s));
    this.initialSpeed = this.speed;
  }

  setLevel(l) {
    this.level = Math.max(1, Math.min(10, l));
    this.initGrid();
  }

  generateTargetRow() {
    const row = Array(this.COLS).fill(0);
    const minBricks = Math.min(7, 3 + Math.floor(this.level / 2));
    const maxBricks = Math.min(7, 5 + Math.floor(this.level / 2));
    const count = minBricks + Math.floor(Math.random() * (maxBricks - minBricks + 1));

    const indices = [1, 2, 3, 4, 5, 6, 7, 8];
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    for (let k = 0; k < count; k++) {
      row[indices[k]] = 1;
    }
    return row;
  }

  initGrid() {
    this.grid = Array(this.ROWS).fill(null).map(() => Array(this.COLS).fill(0));
    this.bullets = [];

    const initialRows = Math.min(9, 5 + Math.floor(this.level / 2));
    for (let r = 0; r < initialRows; r++) {
      this.grid[r] = this.generateTargetRow();
    }
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
        this.lastBulletTime = input.now;
        this.lastStepTime = input.now;
        if (this.isCrashing) this.crashStartTime = input.now;
      }
    }

    if (this.isPaused || this.isCrashing) return;

    if (input.justPressedOrRepeated('LEFT', 100, 45) || (unpausedThisFrame && input.isDown('LEFT'))) {
      if (this.playerX > 1) {
        this.playerX--;
        this.sound.move();
      }
    } else if (input.justPressedOrRepeated('RIGHT', 100, 45) || (unpausedThisFrame && input.isDown('RIGHT'))) {
      if (this.playerX < this.COLS - 2) {
        this.playerX++;
        this.sound.move();
      }
    }

    if (input.justPressedOrRepeated('ACTION', 85, 70) || input.justPressedOrRepeated('UP', 85, 70)) {
      this.fireShot();
    }
  }

  fireShot() {
    this.sound.rotate();
    const spawnY = 17;
    if (this.grid[spawnY][this.playerX] === 1) {
      this.destroyBrick(this.playerX, spawnY);
      return;
    }
    // Avoid stacking duplicate bullets on identical coordinates
    if (!this.bullets.some(b => b.x === this.playerX && b.y === spawnY)) {
      this.bullets.push({ x: this.playerX, y: spawnY });
    }
  }

  destroyBrick(x, y) {
    this.grid[y][x] = 0;
    this.score += 10;
    this.bricksCleared++;
    this.saveHighScore();

    if (this.bricksCleared % 35 === 0 && this.speed < 10) {
      this.speed++;
    }

    // Bonus wave clear if all bricks in active playfield (rows 0..17) were blasted away
    let remaining = 0;
    for (let r = 0; r <= 17; r++) {
      for (let c = 0; c < this.COLS; c++) {
        if (this.grid[r][c] === 1) remaining++;
      }
    }
    if (remaining === 0) {
      this.score += 50;
      this.saveHighScore();
      this.sound.clear();
      for (let r = 0; r <= 2; r++) {
        this.grid[r] = this.generateTargetRow();
      }
      for (let i = this.bullets.length - 1; i >= 0; i--) {
        const b = this.bullets[i];
        if (b.y >= 0 && b.y <= 2 && this.grid[b.y][b.x] === 1) {
          this.bullets.splice(i, 1);
          this.grid[b.y][b.x] = 0;
          this.score += 10;
          this.bricksCleared++;
          this.saveHighScore();
          if (this.bricksCleared % 35 === 0 && this.speed < 10) {
            this.speed++;
          }
        }
      }
    } else {
      this.sound.drop();
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
      this.lastBulletTime = timestamp;
      this.lastStepTime = timestamp;
      if (this.isCrashing) this.crashStartTime = timestamp;
    }

    // Crash flash timer (900ms)
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
          // Clear lower rows 13..18 so player can recover
          for (let r = 13; r <= 18; r++) {
            this.grid[r] = Array(this.COLS).fill(0);
          }
          this.bullets = [];
          this.lastStepTime = timestamp;
          this.lastBulletTime = timestamp;
        }
      }
      return;
    }

    // Bullet ticks every 35ms
    if (!this.lastBulletTime) this.lastBulletTime = timestamp;
    if (timestamp - this.lastBulletTime >= 35) {
      this.lastBulletTime = timestamp;
      this.tickBullets();
    }

    // Descend target bricks periodically
    const stepInterval = Math.max(450, 1800 - (this.speed * 130) - (this.level * 30));
    if (!this.lastStepTime) this.lastStepTime = timestamp;
    if (timestamp - this.lastStepTime >= stepInterval) {
      this.lastStepTime = timestamp;
      this.stepDown(timestamp);
    }
  }

  tickBullets() {
    for (const b of [...this.bullets]) {
      if (!this.bullets.includes(b)) continue;

      if (b.y >= 0 && b.y < this.ROWS && this.grid[b.y][b.x] === 1) {
        const idx = this.bullets.indexOf(b);
        if (idx !== -1) this.bullets.splice(idx, 1);
        this.destroyBrick(b.x, b.y);
        continue;
      }

      b.y -= 1;

      if (b.y < 0) {
        const idx = this.bullets.indexOf(b);
        if (idx !== -1) this.bullets.splice(idx, 1);
        continue;
      }

      if (this.grid[b.y][b.x] === 1) {
        const idx = this.bullets.indexOf(b);
        if (idx !== -1) this.bullets.splice(idx, 1);
        this.destroyBrick(b.x, b.y);
      }
    }
  }

  stepDown(timestamp) {
    // Shift rows down from row 18 downward check
    for (let r = 18; r >= 1; r--) {
      this.grid[r] = [...this.grid[r - 1]];
    }
    this.grid[0] = this.generateTargetRow();

    // Remove bullets that collided with newly descended bricks
    for (const b of [...this.bullets]) {
      if (!this.bullets.includes(b)) continue;
      if (this.grid[b.y][b.x] === 1) {
        const idx = this.bullets.indexOf(b);
        if (idx !== -1) this.bullets.splice(idx, 1);
        this.destroyBrick(b.x, b.y);
      }
    }

    // If any brick reached Row 18, trigger crash
    if (this.grid[18].some(v => v === 1)) {
      this.triggerCrash(timestamp);
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
    this.bricksCleared = 0;
    this.gameOver = false;
    this.isPaused = false;
    this.wasPaused = false;
    this.isCrashing = false;
    this.crashStartTime = 0;
    this.crashFlashOn = true;
    this.playerX = 4;
    this.lastBulletTime = 0;
    this.lastStepTime = 0;
    this.initGrid();
  }

  destroy() {}

  getDisplayMatrix() {
    const display = this.grid.map(row => [...row]);

    // Draw bullets
    for (const b of this.bullets) {
      if (b.y >= 0 && b.y < this.ROWS && b.x >= 0 && b.x < this.COLS) {
        display[b.y][b.x] = 1;
      }
    }

    // Draw T-shaped player turret at rows 18..19
    if (!this.isCrashing || this.crashFlashOn) {
      const cx = Math.max(1, Math.min(this.COLS - 2, this.playerX));
      display[18][cx] = 1;
      for (let dx = -1; dx <= 1; dx++) {
        display[19][cx + dx] = 1;
      }
    }

    return display;
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
  module.exports = WhackGame;
}
