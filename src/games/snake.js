// Game G: Classic Snake for Brick Game
class SnakeGame {
  constructor(sound, onGameOver) {
    this.sound = sound;
    this.onGameOver = onGameOver;

    this.COLS = 10;
    this.ROWS = 20;

    this.snake = [
      { x: 5, y: 12 },
      { x: 5, y: 13 },
      { x: 5, y: 14 }
    ];
    this.dir = { x: 0, y: -1 };
    this.dirQueue = [];
    this.obstacles = [];

    this.food = { x: 3, y: 6 };
    this.foodBlink = true;

    this.score = 0;
    this.highScore = this.loadHighScore();
    this.speed = 1;
    this.initialSpeed = 1;
    this.level = 1;

    this.isTurbo = false;
    this.isPaused = false;
    this.wasPaused = false;
    this.isCrashing = false;
    this.crashStartTime = 0;
    this.crashFlashOn = true;
    this.gameOver = false;

    this.lastTickTime = 0;
    this.lastBlinkTime = 0;

    this.initObstacles();
    this.spawnFood();
  }

  loadHighScore() {
    if (typeof localStorage !== 'undefined') {
      return parseInt(localStorage.getItem('brick_snake_hi') || '0', 10) || 0;
    }
    return 0;
  }

  saveHighScore() {
    if (this.score > this.highScore) {
      this.highScore = this.score;
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('brick_snake_hi', String(this.highScore));
      }
    }
  }

  setSpeed(s) {
    this.speed = Math.max(1, Math.min(10, s));
    this.initialSpeed = this.speed;
  }

  setLevel(l) {
    this.level = Math.max(1, Math.min(10, l));
    this.initObstacles();
    this.spawnFood();
  }

  initObstacles() {
    this.obstacles = [];
    const targetCount = (this.level - 1) * 2;
    if (targetCount <= 0) return;

    const candidates = [];
    for (let r = 1; r < this.ROWS - 1; r++) {
      for (let c = 1; c < this.COLS - 1; c++) {
        // Keep safe corridor around snake start (cols 4..6, rows 8..16)
        if (c >= 4 && c <= 6 && r >= 8 && r <= 16) continue;
        if (this.snake.some(s => s.x === c && s.y === r)) continue;
        candidates.push({ x: c, y: r });
      }
    }

    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }

    for (let i = 0; i < Math.min(targetCount, candidates.length); i++) {
      this.obstacles.push(candidates[i]);
    }
  }

  spawnFood() {
    const emptyCells = [];
    for (let r = 0; r < this.ROWS; r++) {
      for (let c = 0; c < this.COLS; c++) {
        if (this.snake.some(s => s.x === c && s.y === r)) continue;
        if (this.obstacles.some(o => o.x === c && o.y === r)) continue;
        emptyCells.push({ x: c, y: r });
      }
    }
    if (emptyCells.length > 0) {
      this.food = emptyCells[Math.floor(Math.random() * emptyCells.length)];
    } else {
      this.food = null;
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
      this.isTurbo = false;
      if (this.isPaused) {
        return;
      }
      unpausedThisFrame = true;
      if (input.now) {
        this.lastTickTime = input.now;
        this.lastBlinkTime = input.now;
        if (this.isCrashing) this.crashStartTime = input.now;
      }
    }

    if (this.isPaused || this.isCrashing) return;

    const lastScheduledDir = this.dirQueue.length > 0
      ? this.dirQueue[this.dirQueue.length - 1]
      : this.dir;

    if (this.dirQueue.length < 2) {
      if ((input.justPressed('UP') || (unpausedThisFrame && input.isDown('UP'))) && lastScheduledDir.y === 0) {
        this.dirQueue.push({ x: 0, y: -1 });
        this.sound.move();
      } else if ((input.justPressed('DOWN') || (unpausedThisFrame && input.isDown('DOWN'))) && lastScheduledDir.y === 0) {
        this.dirQueue.push({ x: 0, y: 1 });
        this.sound.move();
      } else if ((input.justPressed('LEFT') || (unpausedThisFrame && input.isDown('LEFT'))) && lastScheduledDir.x === 0) {
        this.dirQueue.push({ x: -1, y: 0 });
        this.sound.move();
      } else if ((input.justPressed('RIGHT') || (unpausedThisFrame && input.isDown('RIGHT'))) && lastScheduledDir.x === 0) {
        this.dirQueue.push({ x: 1, y: 0 });
        this.sound.move();
      }
    }

    // Hold ACTION / TURBO for speed boost
    this.isTurbo = input.isDown('ACTION') || input.isDown('TURBO');
  }

  update(timestamp) {
    if (this.isPaused) {
      this.wasPaused = true;
      this.isTurbo = false;
      return;
    }
    if (this.gameOver) return;

    if (this.wasPaused) {
      this.wasPaused = false;
      this.lastTickTime = timestamp;
      this.lastBlinkTime = timestamp;
      if (this.isCrashing) this.crashStartTime = timestamp;
    }

    if (this.isCrashing) {
      if (!this.crashStartTime) this.crashStartTime = timestamp;
      const elapsed = timestamp - this.crashStartTime;
      this.crashFlashOn = Math.floor(elapsed / 100) % 2 === 0;

      if (elapsed >= 600) {
        this.isCrashing = false;
        this.crashStartTime = 0;
        this.crashFlashOn = true;
        this.gameOver = true;
        this.saveHighScore();
        if (this.onGameOver) this.onGameOver();
      }
      return;
    }

    // Timestamp-based food blink
    if (!this.lastBlinkTime) this.lastBlinkTime = timestamp;
    if (timestamp - this.lastBlinkTime >= 150) {
      this.lastBlinkTime = timestamp;
      this.foodBlink = !this.foodBlink;
    }

    // Snake movement tick (turbo gives speed boost)
    const baseInterval = Math.max(75, 260 - (this.speed * 18));
    const snakeInterval = this.isTurbo ? Math.max(45, baseInterval * 0.55) : baseInterval;
    if (!this.lastTickTime) this.lastTickTime = timestamp;

    if (timestamp - this.lastTickTime >= snakeInterval) {
      this.lastTickTime = timestamp;
      this.tick(timestamp);
    }
  }

  tick(timestamp = 0) {
    if (this.dirQueue.length > 0) {
      this.dir = this.dirQueue.shift();
    }

    const head = this.snake[0];
    const newHead = { x: head.x + this.dir.x, y: head.y + this.dir.y };

    // Check food consumption first
    const eating = !!(this.food && newHead.x === this.food.x && newHead.y === this.food.y);
    let removedTail = null;
    if (!eating) {
      removedTail = this.snake.pop();
    }

    // Wall collision
    if (newHead.x < 0 || newHead.x >= this.COLS || newHead.y < 0 || newHead.y >= this.ROWS) {
      if (removedTail) this.snake.push(removedTail);
      this.triggerCrash(timestamp);
      return;
    }

    // Obstacle collision
    if (this.obstacles.some(o => o.x === newHead.x && o.y === newHead.y)) {
      if (removedTail) this.snake.push(removedTail);
      this.triggerCrash(timestamp);
      return;
    }

    // Self collision (tail already popped if not eating, allowing tail chasing)
    if (this.snake.some(segment => segment.x === newHead.x && segment.y === newHead.y)) {
      if (removedTail) this.snake.push(removedTail);
      this.triggerCrash(timestamp);
      return;
    }

    this.snake.unshift(newHead);

    if (eating) {
      this.score += 30;
      this.saveHighScore();
      this.sound.clear();
      this.spawnFood();

      if (this.snake.length % 5 === 0 && this.speed < 10) {
        this.speed++;
      }
    }
  }

  triggerCrash(timestamp = 0) {
    this.isCrashing = true;
    this.crashStartTime = timestamp;
    this.crashFlashOn = true;
    this.isTurbo = false;
    this.sound.crash();
  }

  resetGame() {
    this.speed = this.initialSpeed;
    this.score = 0;
    this.gameOver = false;
    this.isPaused = false;
    this.wasPaused = false;
    this.isCrashing = false;
    this.crashStartTime = 0;
    this.crashFlashOn = true;
    this.isTurbo = false;
    this.lastTickTime = 0;
    this.snake = [
      { x: 5, y: 12 },
      { x: 5, y: 13 },
      { x: 5, y: 14 }
    ];
    this.dir = { x: 0, y: -1 };
    this.dirQueue = [];
    this.initObstacles();
    this.spawnFood();
  }

  destroy() {}

  getDisplayMatrix() {
    const grid = Array(this.ROWS).fill(null).map(() => Array(this.COLS).fill(0));

    // Draw level obstacles
    for (const obs of this.obstacles) {
      if (obs.y >= 0 && obs.y < this.ROWS && obs.x >= 0 && obs.x < this.COLS) {
        grid[obs.y][obs.x] = 1;
      }
    }

    // Draw snake body (flashes during crash animation)
    if (!this.isCrashing || this.crashFlashOn) {
      for (const segment of this.snake) {
        if (segment.y >= 0 && segment.y < this.ROWS && segment.x >= 0 && segment.x < this.COLS) {
          grid[segment.y][segment.x] = 1;
        }
      }
    }

    // Draw blinking food
    if (this.foodBlink && this.food) {
      grid[this.food.y][this.food.x] = 1;
    }

    return grid;
  }

  getHUDState(gamepadConnected) {
    const preview = [
      [0, 1, 1, 0],
      [0, 0, 1, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 0]
    ];

    return {
      score: this.score,
      highScore: this.highScore,
      speed: this.speed,
      level: this.level,
      isPaused: this.isPaused,
      gameOver: this.gameOver,
      isMuted: this.sound.muted,
      gamepadConnected: gamepadConnected,
      preview: preview
    };
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = SnakeGame;
}
