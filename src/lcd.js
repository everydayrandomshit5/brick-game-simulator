// LCD Canvas Renderer for Authentic 10x20 Brick Game Screen
class LCDRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    // Matrix dimensions
    this.COLS = 10;
    this.ROWS = 20;

    // Sizing
    this.cellSize = 20;
    this.cellPadding = 2;
    this.brickSize = this.cellSize - this.cellPadding;

    this.playfieldX = 14;
    this.playfieldY = 16;
    this.playfieldWidth = this.COLS * this.cellSize;
    this.playfieldHeight = this.ROWS * this.cellSize;

    this.hudX = this.playfieldX + this.playfieldWidth + 14;
    this.hudY = this.playfieldY;

    // Palette: Authentic olive-gray LCD colors
    this.colors = {
      bg: '#9aa585',            // Classic greenish-olive LCD backlight
      bgDark: '#8c9776',
      brickOffBorder: 'rgba(24, 32, 19, 0.11)',
      brickOffCore: 'rgba(24, 32, 19, 0.09)',
      brickOnOuter: '#182013',  // Deep charcoal LCD outer frame
      brickOnCore: '#11170d',   // Deep charcoal LCD center core
      text: '#1a2213',
      textDim: 'rgba(26, 34, 19, 0.14)'
    };
  }

  // Draw a single authentic box-in-box (回) LCD brick
  drawBrick(x, y, active = true, size = this.brickSize) {
    const ctx = this.ctx;
    const outerColor = active ? this.colors.brickOnOuter : this.colors.brickOffBorder;

    // 1. Outer square frame
    ctx.fillStyle = outerColor;
    ctx.fillRect(x, y, size, size);

    // 2. Inner LCD gap ring (matches screen background so the brick reads as box-in-box)
    const gapInset = Math.max(2, Math.floor(size * 0.16));
    ctx.fillStyle = this.colors.bg;
    ctx.fillRect(x + gapInset, y + gapInset, size - gapInset * 2, size - gapInset * 2);

    // 3. Inner solid core square
    const coreInset = Math.max(4, Math.floor(size * 0.31));
    if (size - coreInset * 2 > 0) {
      ctx.fillStyle = active ? this.colors.brickOnCore : this.colors.brickOffCore;
      ctx.fillRect(x + coreInset, y + coreInset, size - coreInset * 2, size - coreInset * 2);
    }
  }

  // Clear and paint background with authentic LCD framing
  clear() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.fillStyle = this.colors.bg;
    ctx.fillRect(0, 0, w, h);

    // Inner playfield border
    ctx.strokeStyle = this.colors.text;
    ctx.lineWidth = 2;
    ctx.strokeRect(
      this.playfieldX - 4,
      this.playfieldY - 4,
      this.playfieldWidth + 8,
      this.playfieldHeight + 8
    );

    // Subtle vertical divider between playfield and HUD
    const dividerX = this.playfieldX + this.playfieldWidth + 7;
    ctx.beginPath();
    ctx.moveTo(dividerX, this.playfieldY - 4);
    ctx.lineTo(dividerX, this.playfieldY + this.playfieldHeight + 4);
    ctx.strokeStyle = 'rgba(26, 34, 19, 0.38)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Draw the entire 10x20 matrix
  renderMatrix(grid) {
    for (let r = 0; r < this.ROWS; r++) {
      for (let c = 0; c < this.COLS; c++) {
        const x = this.playfieldX + c * this.cellSize + Math.floor(this.cellPadding / 2);
        const y = this.playfieldY + r * this.cellSize + Math.floor(this.cellPadding / 2);
        const active = !!(grid && grid[r] && grid[r][c]);
        this.drawBrick(x, y, active);
      }
    }
  }

  // 7-segment digit drawing with ghost 8-segments behind active digits
  draw7SegmentDigit(x, y, digit, size = 11) {
    const ctx = this.ctx;
    const w = size;
    const h = size * 1.8;
    const t = Math.max(1.5, size * 0.19);

    // Segment mappings: a, b, c, d, e, f, g
    const segPatterns = {
      '0': [1, 1, 1, 1, 1, 1, 0],
      '1': [0, 1, 1, 0, 0, 0, 0],
      '2': [1, 1, 0, 1, 1, 0, 1],
      '3': [1, 1, 1, 1, 0, 0, 1],
      '4': [0, 1, 1, 0, 0, 1, 1],
      '5': [1, 0, 1, 1, 0, 1, 1],
      '6': [1, 0, 1, 1, 1, 1, 1],
      '7': [1, 1, 1, 0, 0, 0, 0],
      '8': [1, 1, 1, 1, 1, 1, 1],
      '9': [1, 1, 1, 1, 0, 1, 1],
      ' ': [0, 0, 0, 0, 0, 0, 0],
      '-': [0, 0, 0, 0, 0, 0, 1]
    };

    const pattern = segPatterns[digit] || segPatterns[' '];

    const segRects = [
      [x + t, y, w - t * 2, t],                               // a: top
      [x + w - t, y + t, t, h / 2 - t * 1.5],                 // b: top-right
      [x + w - t, y + h / 2 + t * 0.5, t, h / 2 - t * 1.5],   // c: bottom-right
      [x + t, y + h - t, w - t * 2, t],                       // d: bottom
      [x, y + h / 2 + t * 0.5, t, h / 2 - t * 1.5],           // e: bottom-left
      [x, y + t, t, h / 2 - t * 1.5],                         // f: top-left
      [x + t, y + h / 2 - t / 2, w - t * 2, t]                // g: middle
    ];

    // Always render all 7 ghost segments first
    ctx.fillStyle = this.colors.textDim;
    for (let i = 0; i < 7; i++) {
      const [sx, sy, sw, sh] = segRects[i];
      ctx.fillRect(sx, sy, sw, sh);
    }

    // Overlay lit segments
    ctx.fillStyle = this.colors.text;
    for (let i = 0; i < 7; i++) {
      if (pattern[i]) {
        const [sx, sy, sw, sh] = segRects[i];
        ctx.fillRect(sx, sy, sw, sh);
      }
    }
  }

  drawNumber(x, y, value, digits = 6, size = 9.5, padChar = ' ') {
    const clamped = Math.min(Math.pow(10, digits) - 1, Math.max(0, Math.floor(value || 0)));
    const str = (value === null || value === undefined)
      ? ''.padStart(digits, ' ')
      : String(clamped).padStart(digits, padChar);
    const spacing = size * 1.42;
    for (let i = 0; i < digits; i++) {
      this.draw7SegmentDigit(x + i * spacing, y, str[i], size);
    }
  }

  // Draw the HUD (HI-SCORE, SCORE, 4x4 Preview/Lives, Side-by-Side SPEED & LEVEL, Status)
  renderHUD(state) {
    const ctx = this.ctx;
    const x = this.hudX;
    let y = this.hudY + 6;

    // 1. HI-SCORE (6 digits)
    ctx.fillStyle = this.colors.text;
    ctx.font = 'bold 9px monospace';
    ctx.fillText('HI-SCORE', x, y);
    y += 6;
    this.drawNumber(x, y, state.highScore, 6, 10.5);

    // 2. SCORE (6 digits)
    y += 32;
    ctx.fillStyle = this.colors.text;
    ctx.font = 'bold 9px monospace';
    ctx.fillText('SCORE', x, y);
    y += 6;
    this.drawNumber(x, y, state.score, 6, 10.5);

    // 3. 4x4 NEXT / LIVES subgrid
    y += 36;
    const previewGrid = state.preview || [];
    const pCell = 13;
    const pBrick = pCell - 2;
    const previewX = x + 12;

    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        const px = previewX + c * pCell;
        const py = y + r * pCell;
        const active = !!(previewGrid[r] && previewGrid[r][c]);
        this.drawBrick(px, py, active, pBrick);
      }
    }

    // 4. Side-by-side 2-digit SPEED and LEVEL (handles 1..10 cleanly)
    y += 74;
    this.drawNumber(x + 4, y, state.speed, 2, 9);
    this.drawNumber(x + 52, y, state.level, 2, 9);

    y += 28;
    ctx.fillStyle = this.colors.text;
    ctx.font = 'bold 9px monospace';
    ctx.fillText('SPEED', x + 2, y);
    ctx.fillText('LEVEL', x + 49, y);

    // 5. PAUSE indicator
    y += 34;
    ctx.fillStyle = state.isPaused ? this.colors.text : this.colors.textDim;
    ctx.font = 'bold 11px monospace';
    ctx.fillText('PAUSE', x + 18, y);

    // 6. GAME OVER indicator
    y += 22;
    ctx.fillStyle = state.gameOver ? this.colors.text : this.colors.textDim;
    ctx.font = 'bold 11px monospace';
    ctx.fillText('GAME OVER', x + 6, y);

    // 7. SOUND Note Icon (monochrome)
    y += 30;
    ctx.fillStyle = (state.poweredOff || state.isMuted) ? this.colors.textDim : this.colors.text;
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText('♪', x + 32, y);

    // 8. Monochrome GAMEPAD status indicator
    y += 30;
    ctx.fillStyle = (!state.poweredOff && state.gamepadConnected) ? this.colors.text : this.colors.textDim;
    ctx.font = 'bold 10px monospace';
    ctx.fillText(state.gamepadConnected ? 'PAD: ON' : 'PAD: OFF', x + 12, y);
  }

  // Render authentic unpowered LCD (ghost segments only)
  renderPowerOff() {
    this.clear();
    this.renderMatrix(null);
    this.renderHUD({
      score: null,
      highScore: null,
      speed: null,
      level: null,
      isPaused: false,
      gameOver: false,
      isMuted: true,
      gamepadConnected: false,
      poweredOff: true,
      preview: []
    });
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = LCDRenderer;
}
