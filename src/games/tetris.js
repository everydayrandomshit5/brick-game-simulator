// Game B: Classic Tetris for Brick Game
class TetrisGame {
  constructor(sound, onGameOver) {
    this.sound = sound;
    this.onGameOver = onGameOver;

    this.COLS = 10;
    this.ROWS = 20;

    this.SHAPES = {
      I: [[1, 1, 1, 1]],
      O: [
        [1, 1],
        [1, 1]
      ],
      T: [
        [0, 1, 0],
        [1, 1, 1]
      ],
      S: [
        [0, 1, 1],
        [1, 1, 0]
      ],
      Z: [
        [1, 1, 0],
        [0, 1, 1]
      ],
      J: [
        [1, 0, 0],
        [1, 1, 1]
      ],
      L: [
        [0, 0, 1],
        [1, 1, 1]
      ]
    };

    this.PIECE_KEYS = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];

    this.score = 0;
    this.highScore = this.loadHighScore();
    this.speed = 1;
    this.initialSpeed = 1;
    this.level = 1;
    this.linesCleared = 0;
    this.linesSinceSpeedUp = 0;

    this.isPaused = false;
    this.wasPaused = false;
    this.gameOver = false;
    this.clearingLines = [];
    this.isClearing = false;
    this.clearStartTime = 0;
    this.clearFlashOn = false;

    this.lastDropTime = 0;
    this.resetDropTimer = false;
    this.touchingBase = false;
    this.lockDelay = 400;
    this.lockStartTime = 0;

    this.grid = [];
    this.initGrid();

    this.currentPiece = null;
    this.pieceX = 3;
    this.pieceY = 0;
    this.nextPieceKey = this.getRandomPieceKey();
    this.spawnPiece();
  }

  loadHighScore() {
    if (typeof localStorage !== 'undefined') {
      return parseInt(localStorage.getItem('brick_tetris_hi') || '0', 10) || 0;
    }
    return 0;
  }

  saveHighScore() {
    if (this.score > this.highScore) {
      this.highScore = this.score;
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('brick_tetris_hi', String(this.highScore));
      }
    }
  }

  initGrid() {
    this.grid = Array(this.ROWS).fill(null).map(() => Array(this.COLS).fill(0));

    // Level 2..10 generates starting garbage rows at the bottom (1..9 rows)
    const garbageRows = Math.max(0, Math.min(9, this.level - 1));
    if (garbageRows > 0) {
      const startRow = this.ROWS - garbageRows;
      for (let r = startRow; r < this.ROWS; r++) {
        // Fill 4..7 bricks per row, always leaving at least 3 empty cells
        const targetBricks = 4 + Math.floor(Math.random() * 4);
        const indices = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
        for (let i = indices.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [indices[i], indices[j]] = [indices[j], indices[i]];
        }
        for (let k = 0; k < targetBricks; k++) {
          this.grid[r][indices[k]] = 1;
        }
      }
    }
  }

  getRandomPieceKey() {
    return this.PIECE_KEYS[Math.floor(Math.random() * this.PIECE_KEYS.length)];
  }

  setSpeed(s) {
    this.speed = Math.max(1, Math.min(10, s));
    this.initialSpeed = this.speed;
  }

  setLevel(l) {
    this.level = Math.max(1, Math.min(10, l));
    this.initGrid();
  }

  spawnPiece() {
    const key = this.nextPieceKey;
    this.nextPieceKey = this.getRandomPieceKey();
    this.currentPiece = this.SHAPES[key].map(row => [...row]);
    this.pieceX = Math.floor((this.COLS - this.currentPiece[0].length) / 2);
    this.pieceY = 0;
    this.touchingBase = false;
    this.lockStartTime = 0;

    if (this.checkCollision(this.currentPiece, this.pieceX, this.pieceY)) {
      this.gameOver = true;
      this.sound.crash();
      this.saveHighScore();
      if (this.onGameOver) this.onGameOver();
    } else if (this.checkCollision(this.currentPiece, this.pieceX, this.pieceY + 1)) {
      this.touchingBase = true;
    }
  }

  rotateMatrix(matrix) {
    const rows = matrix.length;
    const cols = matrix[0].length;
    const rotated = Array(cols).fill(null).map(() => Array(rows).fill(0));
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        rotated[c][rows - 1 - r] = matrix[r][c];
      }
    }
    return rotated;
  }

  checkCollision(piece, px, py) {
    for (let r = 0; r < piece.length; r++) {
      for (let c = 0; c < piece[r].length; c++) {
        if (piece[r][c]) {
          const newX = px + c;
          const newY = py + r;

          if (newX < 0 || newX >= this.COLS || newY < 0 || newY >= this.ROWS) {
            return true;
          }
          if (this.grid[newY][newX]) {
            return true;
          }
        }
      }
    }
    return false;
  }

  lockPiece() {
    for (let r = 0; r < this.currentPiece.length; r++) {
      for (let c = 0; c < this.currentPiece[r].length; c++) {
        if (this.currentPiece[r][c]) {
          const y = this.pieceY + r;
          const x = this.pieceX + c;
          if (y >= 0 && y < this.ROWS && x >= 0 && x < this.COLS) {
            this.grid[y][x] = 1;
          }
        }
      }
    }

    this.sound.drop();
    this.checkLines();
  }

  checkLines() {
    const fullRows = [];
    for (let r = 0; r < this.ROWS; r++) {
      if (this.grid[r].every(val => val === 1)) {
        fullRows.push(r);
      }
    }

    if (fullRows.length > 0) {
      this.clearingLines = fullRows.sort((a, b) => a - b);
      this.isClearing = true;
      this.clearStartTime = 0;
      this.clearFlashOn = false;
      this.sound.clear();

      const points = [0, 100, 300, 700, 1500][fullRows.length] * this.level;
      this.score += points;
      this.linesCleared += fullRows.length;
      this.linesSinceSpeedUp += fullRows.length;
      this.saveHighScore();

      if (this.linesSinceSpeedUp >= 10) {
        this.linesSinceSpeedUp -= 10;
        if (this.speed < 10) this.speed++;
      }
    } else {
      this.spawnPiece();
    }
  }

  finishLineClear() {
    for (const r of this.clearingLines) {
      this.grid.splice(r, 1);
      this.grid.unshift(Array(this.COLS).fill(0));
    }
    this.clearingLines = [];
    this.spawnPiece();
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
        this.lastDropTime = input.now;
        if (this.isClearing) this.clearStartTime = input.now;
        if (this.lockStartTime) this.lockStartTime = input.now;
      }
    }

    if (this.isPaused || this.isClearing) return;

    // Left / Right move with tuned DAS/ARR
    if (input.justPressedOrRepeated('LEFT', 190, 85) || (unpausedThisFrame && input.isDown('LEFT'))) {
      if (!this.checkCollision(this.currentPiece, this.pieceX - 1, this.pieceY)) {
        this.pieceX--;
        this.sound.move();
        this.touchingBase = this.checkCollision(this.currentPiece, this.pieceX, this.pieceY + 1);
        if (!this.touchingBase) this.lockStartTime = 0;
      }
    } else if (input.justPressedOrRepeated('RIGHT', 190, 85) || (unpausedThisFrame && input.isDown('RIGHT'))) {
      if (!this.checkCollision(this.currentPiece, this.pieceX + 1, this.pieceY)) {
        this.pieceX++;
        this.sound.move();
        this.touchingBase = this.checkCollision(this.currentPiece, this.pieceX, this.pieceY + 1);
        if (!this.touchingBase) this.lockStartTime = 0;
      }
    }

    // Center-pivoted rotation with wall & ceiling kicks
    if (input.justPressed('ACTION') || input.justPressed('UP')) {
      const rotated = this.rotateMatrix(this.currentPiece);
      const oldH = this.currentPiece.length;
      const oldW = this.currentPiece[0].length;
      const newH = rotated.length;
      const newW = rotated[0].length;
      const baseX = this.pieceX + Math.trunc((oldW - newW) / 2);
      const baseY = this.pieceY + Math.trunc((oldH - newH) / 2);

      const kicksY = [0, 1, 2];
      const kicksX = [0, -1, 1, -2, 2];
      let rotatedOk = false;
      for (const ky of kicksY) {
        for (const kx of kicksX) {
          if (!this.checkCollision(rotated, baseX + kx, baseY + ky)) {
            this.pieceX = baseX + kx;
            this.pieceY = baseY + ky;
            this.currentPiece = rotated;
            this.sound.rotate();
            this.touchingBase = this.checkCollision(this.currentPiece, this.pieceX, this.pieceY + 1);
            if (!this.touchingBase) this.lockStartTime = 0;
            rotatedOk = true;
            break;
          }
        }
        if (rotatedOk) break;
      }
    }

    // Controlled Soft Drop (locks when pressed/repeated while already touching base)
    if (input.justPressedOrRepeated('DOWN', 140, 95)) {
      if (!this.checkCollision(this.currentPiece, this.pieceX, this.pieceY + 1)) {
        this.pieceY++;
        this.score += 1;
        this.saveHighScore();
        this.resetDropTimer = true;
        this.touchingBase = this.checkCollision(this.currentPiece, this.pieceX, this.pieceY + 1);
      } else {
        this.lockPiece();
      }
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
      this.lastDropTime = timestamp;
      if (this.isClearing) this.clearStartTime = timestamp;
      if (this.lockStartTime) this.lockStartTime = timestamp;
    }

    // Timestamp-based line clear flash (350ms)
    if (this.isClearing) {
      if (!this.clearStartTime) this.clearStartTime = timestamp;
      const elapsed = timestamp - this.clearStartTime;
      this.clearFlashOn = Math.floor(elapsed / 80) % 2 === 0;
      if (elapsed >= 350) {
        this.isClearing = false;
        this.clearStartTime = 0;
        this.lastDropTime = timestamp;
        this.finishLineClear();
      }
      return;
    }

    if (this.resetDropTimer) {
      this.lastDropTime = timestamp;
      this.resetDropTimer = false;
    }

    const supported = this.checkCollision(this.currentPiece, this.pieceX, this.pieceY + 1);
    if (supported) {
      this.touchingBase = true;
      if (!this.lockStartTime) this.lockStartTime = timestamp;
      this.lastDropTime = timestamp;
      if (timestamp - this.lockStartTime >= this.lockDelay) {
        this.lockPiece();
      }
      return;
    }

    this.touchingBase = false;
    this.lockStartTime = 0;

    // Gravity drop (tuned classic Brick Game speed: ~1005ms at Speed 1 down to 150ms at Speed 10)
    const dropInterval = Math.max(150, 1100 - (this.speed * 95));
    if (!this.lastDropTime) this.lastDropTime = timestamp;

    if (timestamp - this.lastDropTime >= dropInterval) {
      this.lastDropTime = timestamp;
      this.pieceY++;
      if (this.checkCollision(this.currentPiece, this.pieceX, this.pieceY + 1)) {
        this.touchingBase = true;
        this.lockStartTime = timestamp;
      }
    }
  }

  resetGame() {
    this.speed = this.initialSpeed;
    this.score = 0;
    this.linesCleared = 0;
    this.linesSinceSpeedUp = 0;
    this.gameOver = false;
    this.isPaused = false;
    this.wasPaused = false;
    this.clearingLines = [];
    this.isClearing = false;
    this.clearStartTime = 0;
    this.lastDropTime = 0;
    this.resetDropTimer = false;
    this.touchingBase = false;
    this.lockStartTime = 0;
    this.initGrid();
    this.spawnPiece();
  }

  destroy() {}

  getDisplayMatrix() {
    const display = this.grid.map(row => [...row]);

    // Line clear flashing effect
    if (this.isClearing) {
      for (const r of this.clearingLines) {
        for (let c = 0; c < this.COLS; c++) {
          display[r][c] = this.clearFlashOn ? 1 : 0;
        }
      }
    }

    // Render active piece
    if (this.currentPiece && !this.gameOver && !this.isClearing) {
      for (let r = 0; r < this.currentPiece.length; r++) {
        for (let c = 0; c < this.currentPiece[r].length; c++) {
          if (this.currentPiece[r][c]) {
            const gy = this.pieceY + r;
            const gx = this.pieceX + c;
            if (gy >= 0 && gy < this.ROWS && gx >= 0 && gx < this.COLS) {
              display[gy][gx] = 1;
            }
          }
        }
      }
    }

    return display;
  }

  getHUDState(gamepadConnected) {
    // 4x4 preview subgrid for next piece
    const preview = Array(4).fill(null).map(() => Array(4).fill(0));
    const nextShape = this.SHAPES[this.nextPieceKey];
    if (nextShape) {
      const offX = Math.floor((4 - nextShape[0].length) / 2);
      const offY = Math.floor((4 - nextShape.length) / 2);
      for (let r = 0; r < nextShape.length; r++) {
        for (let c = 0; c < nextShape[r].length; c++) {
          if (nextShape[r][c]) {
            preview[offY + r][offX + c] = 1;
          }
        }
      }
    }

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
  module.exports = TetrisGame;
}
