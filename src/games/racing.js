// Game A: Formula 1 / Brick Racing Game (Block Traffic Jam)
class RacingGame {
  constructor(sound, onGameOver) {
    this.sound = sound;
    this.onGameOver = onGameOver;

    this.COLS = 10;
    this.ROWS = 20;

    // Lanes: Left lane starts at col 2, Right lane starts at col 5
    this.LANES = [2, 5];
    this.playerLaneIndex = 0; // 0 = Left, 1 = Right
    this.playerRow = 16;      // Rows 16..19

    this.carShape = [
      [0, 1, 0],
      [1, 1, 1],
      [0, 1, 0],
      [1, 0, 1]
    ];

    this.enemies = []; // { col: 2|5, row: number }
    this.roadOffset = 0;
    this.lastSpawnLane = 0;

    this.score = 0;
    this.highScore = this.loadHighScore();
    this.speed = 1;
    this.initialSpeed = 1;
    this.level = 1;
    this.lives = 4;
    this.carsPassed = 0;

    // Speed 1..10 base intervals in ms (220ms at Speed 1 down to 38ms at Speed 10)
    this.SPEED_INTERVALS = [220, 220, 180, 150, 125, 105, 88, 73, 60, 48, 38];

    this.isTurbo = false;
    this.isPaused = false;
    this.wasPaused = false;
    this.isCrashing = false;
    this.crashStartTime = 0;
    this.crashFlashOn = true;
    this.gameOver = false;

    this.lastTickTime = 0;
    this.nextSpawnGap = 11;
    this.distanceSinceLastSpawn = 11;

    this.init();
  }

  loadHighScore() {
    if (typeof localStorage !== 'undefined') {
      return parseInt(localStorage.getItem('brick_racing_hi') || '0', 10) || 0;
    }
    return 0;
  }

  saveHighScore() {
    if (this.score > this.highScore) {
      this.highScore = this.score;
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('brick_racing_hi', String(this.highScore));
      }
    }
  }

  init() {
    this.enemies = [];
    this.spawnEnemy();
    this.distanceSinceLastSpawn = 0;
    if (this.sound && this.sound.startEngine) {
      this.sound.startEngine();
    }
  }

  setSpeed(s) {
    this.speed = Math.max(1, Math.min(10, s));
    this.initialSpeed = this.speed;
  }

  setLevel(l) {
    this.level = Math.max(1, Math.min(10, l));
    this.nextSpawnGap = Math.max(9, 13 - Math.floor(this.level * 0.4));
  }

  spawnEnemy() {
    let topEnemy = null;
    if (this.enemies.length > 0) {
      topEnemy = this.enemies[0];
      for (const e of this.enemies) {
        if (e.row < topEnemy.row) {
          topEnemy = e;
        }
      }
    }

    let laneIndex = Math.random() < 0.5 ? 0 : 1;
    let chosenCol = this.LANES[laneIndex];

    // Safety guarantee: prevent impassable opposite-lane walls when cars are close vertically
    if (topEnemy && topEnemy.row < 5) {
      chosenCol = topEnemy.col;
      laneIndex = this.LANES.indexOf(chosenCol);
    }

    this.lastSpawnLane = laneIndex;
    this.enemies.push({
      col: chosenCol,
      row: -4
    });

    // Occasional 5-row same-lane 2-car convoy at level >= 3; otherwise safe 9..13 row gap
    if (this.level >= 3 && (!topEnemy || topEnemy.row >= 5) && Math.random() < 0.25) {
      this.nextSpawnGap = 5;
    } else {
      this.nextSpawnGap = Math.max(9, 13 - Math.floor(this.level * 0.4));
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
        this.isTurbo = false;
        this.sound.stopEngine();
        return;
      }
      unpausedThisFrame = true;
      if (input.now) {
        this.lastTickTime = input.now;
        if (this.isCrashing) this.crashStartTime = input.now;
      }
      this.sound.startEngine();
    }

    if (this.isPaused || this.isCrashing) return;

    // Lane switching with auto-repeat & immediate collision check
    if (input.justPressedOrRepeated('LEFT', 140, 80) || (unpausedThisFrame && input.isDown('LEFT'))) {
      if (this.playerLaneIndex > 0) {
        this.playerLaneIndex = 0;
        this.sound.move();
        if (this.checkCollision()) {
          this.triggerCrash(this.lastTickTime);
          return;
        }
      }
    } else if (input.justPressedOrRepeated('RIGHT', 140, 80) || (unpausedThisFrame && input.isDown('RIGHT'))) {
      if (this.playerLaneIndex < 1) {
        this.playerLaneIndex = 1;
        this.sound.move();
        if (this.checkCollision()) {
          this.triggerCrash(this.lastTickTime);
          return;
        }
      }
    }

    // Turbo detection
    this.isTurbo = input.isDown('TURBO') || input.isDown('UP') || input.isDown('ACTION');
    this.sound.setEngineSpeed(this.isTurbo, this.speed);
  }

  update(timestamp) {
    if (this.isPaused) {
      this.wasPaused = true;
      return;
    }
    if (this.gameOver) return;

    if (this.wasPaused) {
      this.wasPaused = false;
      this.lastTickTime = timestamp;
      if (this.isCrashing) this.crashStartTime = timestamp;
    }

    // Handle timestamp-based crash animation (900ms)
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
          this.isTurbo = false;
          this.sound.stopEngine();
          this.saveHighScore();
          if (this.onGameOver) this.onGameOver();
        } else {
          // Clear immediate danger near player before resuming
          this.enemies = this.enemies.filter(e => e.row < 10);
          this.lastTickTime = timestamp;
          this.sound.startEngine();
        }
      }
      return;
    }

    // Calculate game tick based on speed & turbo
    const baseInterval = this.SPEED_INTERVALS[this.speed] || Math.max(38, 240 - (this.speed * 20));
    const currentInterval = this.isTurbo ? Math.max(19, Math.round(baseInterval * 0.5)) : baseInterval;

    if (!this.lastTickTime) this.lastTickTime = timestamp;
    const delta = timestamp - this.lastTickTime;

    if (delta >= currentInterval) {
      this.lastTickTime += currentInterval;
      if (timestamp - this.lastTickTime >= currentInterval) {
        this.lastTickTime = timestamp;
      }
      this.tick(timestamp);
    }
  }

  tick(timestamp) {
    // 1. Advance road dashed borders (scroll downward)
    this.roadOffset = (this.roadOffset + 1) % 5;

    // 2. Advance enemies
    this.distanceSinceLastSpawn++;

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      e.row += 1;

      // Check if passed player
      if (e.row === this.playerRow + 4) {
        const prevScore = this.score;
        const points = this.isTurbo ? 2 : 1;
        this.score += points;
        this.carsPassed++;
        this.saveHighScore();

        // Auto speed ramp every 8 cars passed or every 25 points
        if ((this.carsPassed % 8 === 0 || Math.floor(this.score / 25) > Math.floor(prevScore / 25)) && this.speed < 10) {
          this.speed++;
          if (this.sound && this.sound.setEngineSpeed) {
            this.sound.setEngineSpeed(this.isTurbo, this.speed);
          }
        }
      }

      // Remove offscreen
      if (e.row > this.ROWS) {
        this.enemies.splice(i, 1);
      }
    }

    // 3. Spawn new enemies
    if (this.distanceSinceLastSpawn >= this.nextSpawnGap) {
      this.spawnEnemy();
      this.distanceSinceLastSpawn = 0;
    }

    // 4. Collision check
    if (this.checkCollision()) {
      this.triggerCrash(timestamp);
    }
  }

  checkCollision() {
    const pCol = this.LANES[this.playerLaneIndex];
    const pRow = this.playerRow;

    for (const e of this.enemies) {
      const eRow = Math.floor(e.row);
      const eCol = e.col;

      if (Math.abs(eRow - pRow) < 4 && Math.abs(eCol - pCol) < 3) {
        for (let r = 0; r < 4; r++) {
          for (let c = 0; c < 3; c++) {
            if (this.carShape[r][c] === 1) {
              const worldR = pRow + r;
              const worldC = pCol + c;
              const enemyR = worldR - eRow;
              const enemyC = worldC - eCol;

              if (enemyR >= 0 && enemyR < 4 && enemyC >= 0 && enemyC < 3) {
                if (this.carShape[enemyR][enemyC] === 1) {
                  return true;
                }
              }
            }
          }
        }
      }
    }
    return false;
  }

  triggerCrash(timestamp = 0) {
    this.isCrashing = true;
    this.crashStartTime = timestamp;
    this.crashFlashOn = true;
    this.isTurbo = false;
    this.lives--;
    this.sound.crash();
  }

  resetGame() {
    this.speed = this.initialSpeed;
    this.score = 0;
    this.carsPassed = 0;
    this.lives = 4;
    this.gameOver = false;
    this.isPaused = false;
    this.wasPaused = false;
    this.isCrashing = false;
    this.crashStartTime = 0;
    this.crashFlashOn = true;
    this.isTurbo = false;
    this.lastTickTime = 0;
    this.playerLaneIndex = 0;
    this.enemies = [];
    this.nextSpawnGap = Math.max(9, 13 - Math.floor(this.level * 0.4));
    this.spawnEnemy();
    this.distanceSinceLastSpawn = 0;
    this.sound.startEngine();
  }

  destroy() {
    this.sound.stopEngine();
  }

  getDisplayMatrix() {
    const grid = Array(this.ROWS).fill(null).map(() => Array(this.COLS).fill(0));

    // 1. Draw Left & Right Guardrails (3 lit, 2 unlit scrolling downward)
    for (let r = 0; r < this.ROWS; r++) {
      const patternIndex = ((r - this.roadOffset) % 5 + 5) % 5;
      if (patternIndex < 3) {
        grid[r][0] = 1;
        grid[r][9] = 1;
      }
    }

    // 2. Draw Enemy Cars
    for (const e of this.enemies) {
      const eRow = Math.floor(e.row);
      const eCol = e.col;

      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 3; c++) {
          if (this.carShape[r][c] === 1) {
            const gridR = eRow + r;
            const gridC = eCol + c;
            if (gridR >= 0 && gridR < this.ROWS && gridC >= 0 && gridC < this.COLS) {
              grid[gridR][gridC] = 1;
            }
          }
        }
      }
    }

    // 3. Draw Player Car (flashes during crash)
    const showPlayer = !this.isCrashing || this.crashFlashOn;
    if (showPlayer) {
      const pCol = this.LANES[this.playerLaneIndex];
      const pRow = this.playerRow;

      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 3; c++) {
          if (this.carShape[r][c] === 1) {
            const gridR = pRow + r;
            const gridC = pCol + c;
            if (gridR >= 0 && gridR < this.ROWS && gridC >= 0 && gridC < this.COLS) {
              grid[gridR][gridC] = 1;
            }
          }
        }
      }
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
  module.exports = RacingGame;
}
