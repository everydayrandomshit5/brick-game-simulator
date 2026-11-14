// Game D: Barrier Elastic Ball (Breakout) for Brick Game
class BreakoutGame {
  constructor(sound, onGameOver) {
    this.sound = sound;
    this.onGameOver = onGameOver;

    this.COLS = 10;
    this.ROWS = 20;

    this.paddleWidth = 3;
    this.paddleX = 3;
    this.paddleY = 19;

    this.ballX = 4;
    this.ballY = 18;
    this.ballVx = 1;
    this.ballVy = -1;

    this.bricks = [];
    this.score = 0;
    this.highScore = this.loadHighScore();
    this.speed = 1;
    this.initialSpeed = 1;
    this.level = 1;
    this.lives = 4;

    this.isTurbo = false;
    this.isPaused = false;
    this.wasPaused = false;
    this.gameOver = false;
    this.isBallLaunched = false;
    this.visitedBounceStates = new Set();

    this.lastTickTime = 0;
    this.initBricks();
  }

  loadHighScore() {
    if (typeof localStorage !== 'undefined') {
      return parseInt(localStorage.getItem('brick_breakout_hi') || '0', 10) || 0;
    }
    return 0;
  }

  saveHighScore() {
    if (this.score > this.highScore) {
      this.highScore = this.score;
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('brick_breakout_hi', String(this.highScore));
      }
    }
  }

  setSpeed(s) {
    this.speed = Math.max(1, Math.min(10, s));
    this.initialSpeed = this.speed;
  }

  setLevel(l) {
    this.level = Math.max(1, Math.min(10, l));
    this.initBricks();
  }

  initBricks() {
    this.bricks = [];
    this.visitedBounceStates = new Set();
    const numRows = Math.min(7, 3 + Math.ceil(this.level / 2));
    const startRow = 2;
    const endRow = startRow + numRows - 1;
    const patternType = (this.level - 1) % 5;

    for (let r = startRow; r <= endRow; r++) {
      for (let c = 0; c < this.COLS; c++) {
        let place = false;
        if (patternType === 0) {
          // Classic staggered fortress
          place = (r + c) % 2 === 0 || r === startRow;
        } else if (patternType === 1) {
          // Twin pillars with gap
          place = (c !== 4 && c !== 5) || r === startRow;
        } else if (patternType === 2) {
          // Inverted chevron / V-barrier with lower defense row on higher levels
          const dist = Math.abs(c - 4.5);
          place = (r - startRow) <= Math.floor(dist) || (r - startRow >= 5 && (r + c) % 2 === 0);
        } else if (patternType === 3) {
          // Checkerboard + solid border
          place = r === startRow || r === endRow || (r + c) % 2 === 0;
        } else {
          // Dense wall with side slits
          place = !(r % 2 === 1 && (c === 0 || c === 9));
        }
        if (place) {
          this.bricks.push({ x: c, y: r });
        }
      }
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
      }
    }

    if (this.isPaused) return;

    // Move paddle left/right cleanly with DAS/ARR
    if (input.justPressedOrRepeated('LEFT', 90, 40) || (unpausedThisFrame && input.isDown('LEFT'))) {
      if (this.paddleX > 0) {
        this.paddleX--;
        this.sound.move();
        if (!this.isBallLaunched) {
          this.ballX = this.paddleX + 1;
        } else if (this.ballY === this.paddleY && this.ballX >= this.paddleX && this.ballX < this.paddleX + this.paddleWidth) {
          this.ballY = this.paddleY - 1;
          this.ballVy = -1;
          this.sound.rotate();
        }
      }
    } else if (input.justPressedOrRepeated('RIGHT', 90, 40) || (unpausedThisFrame && input.isDown('RIGHT'))) {
      if (this.paddleX < this.COLS - this.paddleWidth) {
        this.paddleX++;
        this.sound.move();
        if (!this.isBallLaunched) {
          this.ballX = this.paddleX + 1;
        } else if (this.ballY === this.paddleY && this.ballX >= this.paddleX && this.ballX < this.paddleX + this.paddleWidth) {
          this.ballY = this.paddleY - 1;
          this.ballVy = -1;
          this.sound.rotate();
        }
      }
    }

    // Launch ball or hold ACTION for turbo ball speed
    if (!this.isBallLaunched) {
      if (input.justPressed('ACTION') || input.justPressed('UP')) {
        this.isBallLaunched = true;
        if (this.visitedBounceStates) this.visitedBounceStates.clear();
        this.ballVx = Math.random() < 0.5 ? 1 : -1;
        this.ballVy = -1;
        this.sound.rotate();
      }
      this.isTurbo = false;
    } else {
      this.isTurbo = input.isDown('ACTION') || input.isDown('TURBO');
    }
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
    }

    if (!this.isBallLaunched) {
      this.lastTickTime = timestamp;
      return;
    }

    const baseInterval = Math.max(65, 210 - (this.speed * 14));
    const ballInterval = this.isTurbo ? baseInterval * 0.5 : baseInterval;
    if (!this.lastTickTime) this.lastTickTime = timestamp;

    if (timestamp - this.lastTickTime >= ballInterval) {
      this.lastTickTime = timestamp;
      this.tickBall();
    }
  }

  findBrick(x, y) {
    return this.bricks.findIndex(b => b.x === x && b.y === y);
  }

  removeBrickAt(x, y) {
    const idx = this.findBrick(x, y);
    if (idx !== -1) {
      this.bricks.splice(idx, 1);
      if (this.visitedBounceStates) this.visitedBounceStates.clear();
      this.score += 20;
      this.saveHighScore();
      this.sound.drop();
      return true;
    }
    return false;
  }

  tickBall() {
    // 1 & 2. Resolve wall and brick reflections iteratively before stepping
    for (let iter = 0; iter < 4; iter++) {
      let bounced = false;

      if (this.ballX + this.ballVx < 0 || this.ballX + this.ballVx >= this.COLS) {
        this.ballVx = -this.ballVx;
        this.sound.click();
        bounced = true;
      }
      if (this.ballY + this.ballVy < 0) {
        this.ballVy = -this.ballVy;
        this.sound.click();
        bounced = true;
      }

      const hitX = this.findBrick(this.ballX + this.ballVx, this.ballY) !== -1;
      const hitY = this.findBrick(this.ballX, this.ballY + this.ballVy) !== -1;

      if (hitX || hitY) {
        const targetX = this.ballX + this.ballVx;
        const targetY = this.ballY + this.ballVy;
        if (hitX) {
          this.removeBrickAt(targetX, this.ballY);
          this.ballVx = -this.ballVx;
          bounced = true;
        }
        if (hitY) {
          this.removeBrickAt(this.ballX, targetY);
          this.ballVy = -this.ballVy;
          bounced = true;
        }
      } else {
        const diagX = this.ballX + this.ballVx;
        const diagY = this.ballY + this.ballVy;
        if (this.findBrick(diagX, diagY) !== -1) {
          this.removeBrickAt(diagX, diagY);
          this.ballVy = -this.ballVy;
          bounced = true;
        }
      }

      if (!bounced) break;
    }

    // Check stage cleared
    if (this.bricks.length === 0) {
      this.sound.clear();
      if (this.level < 10) this.level++;
      if (this.speed < 10) this.speed++;
      this.initBricks();
      this.isBallLaunched = false;
      this.ballY = 18;
      this.ballX = this.paddleX + 1;
      return;
    }

    // 3. Paddle bounce check when ball is at row 18 moving downward
    if (this.ballY === this.paddleY - 1 && this.ballVy > 0) {
      const candidateX = this.ballX + this.ballVx;
      const hitsAtCandidate = candidateX >= this.paddleX && candidateX < this.paddleX + this.paddleWidth;
      const hitsDirectlyBelow = this.ballX >= this.paddleX && this.ballX < this.paddleX + this.paddleWidth;

      if (hitsAtCandidate || hitsDirectlyBelow) {
        this.ballVy = -1;

        const hitCol = hitsDirectlyBelow ? this.ballX : candidateX;
        const isCenterHit = hitCol === this.paddleX + 1;

        if (hitCol === this.paddleX) {
          this.ballVx = -1;
        } else if (hitCol === this.paddleX + this.paddleWidth - 1) {
          this.ballVx = 1;
        }

        let nextX = isCenterHit ? this.ballX : (this.ballX + this.ballVx);
        if (nextX <= 0) {
          nextX = 0;
          this.ballVx = 1;
        } else if (nextX >= this.COLS - 1) {
          nextX = this.COLS - 1;
          this.ballVx = -1;
        }

        if (!this.visitedBounceStates) {
          this.visitedBounceStates = new Set();
        }

        let stateKey = nextX + ':' + this.ballVx;
        if (this.visitedBounceStates.has(stateKey)) {
          if (this.visitedBounceStates.size >= 18) {
            this.visitedBounceStates.clear();
          }
          let found = null;
          for (const dx of [0, -1, 1, -2, 2]) {
            const cx = this.ballX + dx;
            if (cx < 0 || cx >= this.COLS) continue;
            for (const cvx of [this.ballVx, -this.ballVx]) {
              const nvx = (cx === 0) ? 1 : (cx === this.COLS - 1 ? -1 : cvx);
              const k = cx + ':' + nvx;
              if (!this.visitedBounceStates.has(k)) {
                found = { x: cx, vx: nvx, key: k };
                break;
              }
            }
            if (found) break;
          }
          if (found) {
            nextX = found.x;
            this.ballVx = found.vx;
            stateKey = found.key;
          }
        }

        this.visitedBounceStates.add(stateKey);
        this.ballX = nextX;
        this.ballY = this.paddleY - 2; // Row 17: bounce cleanly off paddle without overlapping row 19
        this.sound.rotate();
        return;
      }
    }

    // 4. Advance ball & check miss below paddle
    const nextX = Math.max(0, Math.min(this.COLS - 1, this.ballX + this.ballVx));
    const nextY = this.ballY + this.ballVy;

    if (nextY > this.paddleY) {
      this.lives--;
      this.sound.crash();
      if (this.lives <= 0) {
        this.gameOver = true;
        this.saveHighScore();
        if (this.onGameOver) this.onGameOver();
      } else {
        this.isBallLaunched = false;
        this.ballX = this.paddleX + 1;
        this.ballY = 18;
      }
      return;
    }

    this.ballX = nextX;
    this.ballY = nextY;
  }

  resetGame() {
    this.speed = this.initialSpeed;
    this.score = 0;
    this.lives = 4;
    this.gameOver = false;
    this.isPaused = false;
    this.wasPaused = false;
    this.isBallLaunched = false;
    this.isTurbo = false;
    if (this.visitedBounceStates) this.visitedBounceStates.clear();
    this.paddleX = 3;
    this.ballX = 4;
    this.ballY = 18;
    this.lastTickTime = 0;
    this.initBricks();
  }

  destroy() {}

  getDisplayMatrix() {
    const grid = Array(this.ROWS).fill(null).map(() => Array(this.COLS).fill(0));

    for (const b of this.bricks) {
      if (b.y >= 0 && b.y < this.ROWS && b.x >= 0 && b.x < this.COLS) {
        grid[b.y][b.x] = 1;
      }
    }

    for (let c = 0; c < this.paddleWidth; c++) {
      grid[this.paddleY][this.paddleX + c] = 1;
    }

    if (this.ballY >= 0 && this.ballY < this.ROWS && this.ballX >= 0 && this.ballX < this.COLS) {
      grid[this.ballY][this.ballX] = 1;
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
  module.exports = BreakoutGame;
}
