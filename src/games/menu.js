// Game Menu & Mode Selector (Classic A through G selector)
class MenuManager {
  constructor(sound, onSelectGame) {
    this.sound = sound;
    this.onSelectGame = onSelectGame;

    this.COLS = 10;
    this.ROWS = 20;

    this.games = [
      { id: 'racing', letter: 'A', name: 'RACING', hiKey: 'brick_racing_hi' },
      { id: 'tetris', letter: 'B', name: 'TETRIS', hiKey: 'brick_tetris_hi' },
      { id: 'tanks', letter: 'C', name: 'TANK BATTLE', hiKey: 'brick_tank_hi' },
      { id: 'breakout', letter: 'D', name: 'BREAKOUT', hiKey: 'brick_breakout_hi' },
      { id: 'frogger', letter: 'E', name: 'RIVER CROSSING', hiKey: 'brick_frogger_hi' },
      { id: 'whack', letter: 'F', name: 'WHACK A MOLE', hiKey: 'brick_whack_hi' },
      { id: 'snake', letter: 'G', name: 'SNAKE', hiKey: 'brick_snake_hi' }
    ];

    this.currentIndex = 0; // Starts at Racing (Game A)
    this.speed = 1;
    this.level = 1;

    this.lastAnimTime = 0;
    this.lastBlinkTime = 0;
    this.demoOffset = 0;
    this.letterBlink = true;

    // Big 5x7 bitmap fonts for letters A..G
    this.LETTERS = {
      A: [
        [0, 1, 1, 1, 0],
        [1, 0, 0, 0, 1],
        [1, 0, 0, 0, 1],
        [1, 1, 1, 1, 1],
        [1, 0, 0, 0, 1],
        [1, 0, 0, 0, 1],
        [1, 0, 0, 0, 1]
      ],
      B: [
        [1, 1, 1, 1, 0],
        [1, 0, 0, 0, 1],
        [1, 0, 0, 0, 1],
        [1, 1, 1, 1, 0],
        [1, 0, 0, 0, 1],
        [1, 0, 0, 0, 1],
        [1, 1, 1, 1, 0]
      ],
      C: [
        [0, 1, 1, 1, 0],
        [1, 0, 0, 0, 1],
        [1, 0, 0, 0, 0],
        [1, 0, 0, 0, 0],
        [1, 0, 0, 0, 0],
        [1, 0, 0, 0, 1],
        [0, 1, 1, 1, 0]
      ],
      D: [
        [1, 1, 1, 1, 0],
        [1, 0, 0, 0, 1],
        [1, 0, 0, 0, 1],
        [1, 0, 0, 0, 1],
        [1, 0, 0, 0, 1],
        [1, 0, 0, 0, 1],
        [1, 1, 1, 1, 0]
      ],
      E: [
        [1, 1, 1, 1, 1],
        [1, 0, 0, 0, 0],
        [1, 0, 0, 0, 0],
        [1, 1, 1, 1, 0],
        [1, 0, 0, 0, 0],
        [1, 0, 0, 0, 0],
        [1, 1, 1, 1, 1]
      ],
      F: [
        [1, 1, 1, 1, 1],
        [1, 0, 0, 0, 0],
        [1, 0, 0, 0, 0],
        [1, 1, 1, 1, 0],
        [1, 0, 0, 0, 0],
        [1, 0, 0, 0, 0],
        [1, 0, 0, 0, 0]
      ],
      G: [
        [0, 1, 1, 1, 0],
        [1, 0, 0, 0, 1],
        [1, 0, 0, 0, 0],
        [1, 0, 1, 1, 1],
        [1, 0, 0, 0, 1],
        [1, 0, 0, 0, 1],
        [0, 1, 1, 1, 0]
      ]
    };

    if (typeof window !== 'undefined' && this.sound && this.sound.playTetrisTheme) {
      setTimeout(() => {
        if (this.sound && this.sound.playTetrisTheme) {
          this.sound.playTetrisTheme();
        }
      }, 200);
    }
  }

  handleInput(input) {
    // Cycle Games: UP / DOWN
    if (input.justPressedOrRepeated('DOWN', 220, 110)) {
      this.currentIndex = (this.currentIndex + 1) % this.games.length;
      this.sound.click();
    } else if (input.justPressedOrRepeated('UP', 220, 110)) {
      this.currentIndex = (this.currentIndex - 1 + this.games.length) % this.games.length;
      this.sound.click();
    }

    // SPEED Adjustment: RIGHT
    if (input.justPressedOrRepeated('RIGHT', 200, 90)) {
      this.speed = (this.speed % 10) + 1;
      this.sound.move();
    }

    // LEVEL Adjustment: LEFT
    if (input.justPressedOrRepeated('LEFT', 200, 90)) {
      this.level = (this.level % 10) + 1;
      this.sound.move();
    }

    // Launch Selected Game: START or ACTION
    if (input.justPressed('START') || input.justPressed('ACTION')) {
      if (this.sound.stopMelody) this.sound.stopMelody();
      this.sound.clear();
      const chosen = this.games[this.currentIndex];
      this.onSelectGame(chosen.id, this.speed, this.level);
    }
  }

  update(timestamp) {
    if (!this.lastBlinkTime) this.lastBlinkTime = timestamp;
    if (timestamp - this.lastBlinkTime >= 350) {
      this.lastBlinkTime = timestamp;
      this.letterBlink = !this.letterBlink;
    }

    if (!this.lastAnimTime) this.lastAnimTime = timestamp;
    if (timestamp - this.lastAnimTime >= 160) {
      this.lastAnimTime = timestamp;
      this.demoOffset = (this.demoOffset + 1) % 4;
    }
  }

  getDisplayMatrix() {
    const grid = Array(this.ROWS).fill(null).map(() => Array(this.COLS).fill(0));
    const currentGame = this.games[this.currentIndex];
    const letterBitmap = this.LETTERS[currentGame.letter];

    // 1. Big Letter at Top (Col 2..6, Row 1..7)
    if (letterBitmap && this.letterBlink) {
      for (let r = 0; r < letterBitmap.length; r++) {
        for (let c = 0; c < letterBitmap[r].length; c++) {
          if (letterBitmap[r][c]) {
            grid[1 + r][2 + c] = 1;
          }
        }
      }
    }

    // 2. Decorative divider row at row 9
    for (let c = 0; c < this.COLS; c++) {
      grid[9][c] = (c % 2 === 0) ? 1 : 0;
    }

    // 3. Animated Game Previews below row 10
    if (currentGame.id === 'racing') {
      // Road guardrails scrolling DOWNWARD
      for (let r = 10; r < this.ROWS; r++) {
        if (((r - this.demoOffset) % 4 + 4) % 4 !== 3) {
          grid[r][0] = 1;
          grid[r][9] = 1;
        }
      }
      // Classic F1 Car
      const car = [
        [0, 1, 0],
        [1, 1, 1],
        [0, 1, 0],
        [1, 0, 1]
      ];
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 3; c++) {
          if (car[r][c]) grid[15 + r][2 + c] = 1;
        }
      }
    } else if (currentGame.id === 'tetris') {
      grid[19] = [1, 1, 1, 0, 1, 1, 1, 1, 1, 1];
      grid[18] = [1, 1, 0, 0, 1, 1, 0, 1, 1, 1];
      grid[17] = [0, 1, 0, 0, 0, 1, 0, 0, 1, 0];
      // Falling T-piece
      const dropY = 11 + (this.demoOffset % 3);
      grid[dropY][4] = 1;
      grid[dropY + 1][3] = 1;
      grid[dropY + 1][4] = 1;
      grid[dropY + 1][5] = 1;
    } else if (currentGame.id === 'tanks') {
      // Player tank pointing up
      grid[17][4] = 1;
      grid[18][3] = 1;
      grid[18][4] = 1;
      grid[18][5] = 1;
      grid[19][3] = 1;
      grid[19][5] = 1;
      // Moving bullet
      grid[15 - this.demoOffset][4] = 1;
    } else if (currentGame.id === 'breakout') {
      grid[19][3] = 1;
      grid[19][4] = 1;
      grid[19][5] = 1;
      grid[17 - this.demoOffset][3 + (this.demoOffset % 2)] = 1;
      grid[11] = [1, 0, 1, 0, 1, 0, 1, 0, 1, 0];
      grid[12] = [0, 1, 0, 1, 0, 1, 0, 1, 0, 1];
    } else if (currentGame.id === 'frogger') {
      // Moving river obstacle bars
      for (let c = 0; c < this.COLS; c++) {
        if (((c - this.demoOffset + 10) % 5) < 3) grid[12][c] = 1;
        if (((c + this.demoOffset) % 4) < 2) grid[14][c] = 1;
        if (((c - this.demoOffset + 10) % 4) < 2) grid[16][c] = 1;
      }
      // Blinking frog at bottom
      if (this.letterBlink) {
        grid[19][4] = 1;
      }
    } else if (currentGame.id === 'whack') {
      // Top target bricks
      grid[11] = [1, 1, 0, 1, 1, 0, 1, 0, 1, 1];
      grid[12] = [0, 1, 1, 0, 1, 1, 0, 1, 0, 1];
      grid[13] = [1, 0, 1, 0, 0, 1, 1, 0, 1, 0];
      // T-shaped shooter at rows 18..19
      grid[18][4] = 1;
      grid[19][3] = 1;
      grid[19][4] = 1;
      grid[19][5] = 1;
      // Rising shot
      grid[17 - this.demoOffset][4] = 1;
    } else if (currentGame.id === 'snake') {
      grid[14][3] = 1;
      grid[14][4] = 1;
      grid[14][5] = 1;
      grid[15][5] = 1;
      grid[16][5] = 1;
      grid[16][6] = 1;
      grid[14][7] = this.letterBlink ? 1 : 0;
    }

    return grid;
  }

  getHUDState(gamepadConnected) {
    const currentGame = this.games[this.currentIndex];
    let hi = 0;
    if (typeof localStorage !== 'undefined') {
      hi = parseInt(localStorage.getItem(currentGame.hiKey) || '0', 10) || 0;
    }

    const preview = [
      [1, 1, 1, 1],
      [1, 0, 0, 1],
      [1, 0, 0, 1],
      [1, 1, 1, 1]
    ];

    return {
      score: 0,
      highScore: hi,
      speed: this.speed,
      level: this.level,
      isPaused: false,
      gameOver: false,
      isMuted: this.sound.muted,
      gamepadConnected: gamepadConnected,
      preview: preview
    };
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = MenuManager;
}
