// Game C: 4-Directional Tank Battle for Brick Game
class TankGame {
  constructor(sound, onGameOver) {
    this.sound = sound;
    this.onGameOver = onGameOver;

    this.COLS = 10;
    this.ROWS = 20;

    // Directions: 0 = UP, 1 = RIGHT, 2 = DOWN, 3 = LEFT
    this.TANK_SHAPES = [
      [
        [0, 1, 0],
        [1, 1, 1],
        [1, 0, 1]
      ],
      [
        [1, 1, 0],
        [0, 1, 1],
        [1, 1, 0]
      ],
      [
        [1, 0, 1],
        [1, 1, 1],
        [0, 1, 0]
      ],
      [
        [0, 1, 1],
        [1, 1, 0],
        [0, 1, 1]
      ]
    ];

    this.DIR_VECS = [
      { x: 0, y: -1 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: -1, y: 0 }
    ];

    this.BARREL_OFFSETS = [
      { x: 1, y: 0 },
      { x: 2, y: 1 },
      { x: 1, y: 2 },
      { x: 0, y: 1 }
    ];

    this.playerX = 3;
    this.playerY = 17;
    this.playerDir = 0; // UP

    this.bullets = [];
    this.enemyTanks = [];
    this.obstacles = [];

    this.score = 0;
    this.highScore = this.loadHighScore();
    this.speed = 1;
    this.initialSpeed = 1;
    this.level = 1;
    this.lives = 4;
    this.enemiesDefeated = 0;

    this.isPaused = false;
    this.wasPaused = false;
    this.pausedAt = 0;
    this.gameOver = false;
    this.isCrashing = false;
    this.crashStartTime = 0;
    this.crashFlashOn = true;

    this.lastTickTime = 0;
    this.bulletTickTime = 0;
    this.nextSpawnTime = 0;
    this.inBulletTick = false;
    this.pendingWallRebuild = false;

    this.initLevel();
  }

  loadHighScore() {
    if (typeof localStorage !== 'undefined') {
      return parseInt(localStorage.getItem('brick_tank_hi') || '0', 10) || 0;
    }
    return 0;
  }

  saveHighScore() {
    if (this.score > this.highScore) {
      this.highScore = this.score;
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('brick_tank_hi', String(this.highScore));
      }
    }
  }

  setSpeed(s) {
    this.speed = Math.max(1, Math.min(10, s));
    this.initialSpeed = this.speed;
  }

  setLevel(l) {
    this.level = Math.max(1, Math.min(10, l));
    this.initLevel();
  }

  buildDefaultWallCells() {
    // Classic defensive brick clusters (kept clear of corner spawn zones & player start)
    const wallCells = [
      { x: 2, y: 5 }, { x: 3, y: 5 }, { x: 6, y: 5 }, { x: 7, y: 5 },
      { x: 4, y: 9 }, { x: 5, y: 9 }, { x: 4, y: 10 }, { x: 5, y: 10 },
      { x: 2, y: 13 }, { x: 3, y: 13 }, { x: 6, y: 13 }, { x: 7, y: 13 }
    ];

    if (this.level >= 3) {
      wallCells.push({ x: 1, y: 10 }, { x: 8, y: 10 });
    }
    if (this.level >= 6) {
      wallCells.push({ x: 4, y: 4 }, { x: 5, y: 4 }, { x: 4, y: 14 }, { x: 5, y: 14 });
    }
    return wallCells;
  }

  initLevel() {
    this.bullets = [];
    this.enemyTanks = [];
    this.obstacles = [];
    this.playerX = 3;
    this.playerY = 17;
    this.playerDir = 0;
    this.nextSpawnTime = 0;

    for (const cell of this.buildDefaultWallCells()) {
      this.obstacles.push({ x: cell.x, y: cell.y });
    }

    this.spawnEnemy();
    this.spawnEnemy();
  }

  canMoveTank(nx, ny, ignoreEnemyIdx) {
    if (nx < 0 || nx > this.COLS - 3 || ny < 0 || ny > this.ROWS - 3) {
      return false;
    }

    // Check obstacle overlap within 3x3 tank footprint
    for (const obs of this.obstacles) {
      if (obs.x >= nx && obs.x < nx + 3 && obs.y >= ny && obs.y < ny + 3) {
        return false;
      }
    }

    // Check collision with player tank (when an enemy is moving)
    if (ignoreEnemyIdx >= 0) {
      if (Math.abs(nx - this.playerX) < 3 && Math.abs(ny - this.playerY) < 3) {
        return false;
      }
    }

    // Check collision with other enemy tanks
    for (let i = 0; i < this.enemyTanks.length; i++) {
      if (i === ignoreEnemyIdx) continue;
      const other = this.enemyTanks[i];
      if (Math.abs(nx - other.x) < 3 && Math.abs(ny - other.y) < 3) {
        return false;
      }
    }

    return true;
  }

  spawnEnemy() {
    if (this.enemyTanks.length >= 3) return false;

    const corners = [
      { x: 0, y: 0, dir: 2 },
      { x: 7, y: 0, dir: 2 },
      { x: 0, y: 7, dir: 1 },
      { x: 7, y: 7, dir: 3 }
    ];

    // Shuffle corners so spawns vary
    for (let i = corners.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [corners[i], corners[j]] = [corners[j], corners[i]];
    }

    for (const spot of corners) {
      if (this.canMoveTank(spot.x, spot.y, this.enemyTanks.length)) {
        this.enemyTanks.push({
          x: spot.x,
          y: spot.y,
          dir: spot.dir,
          fireCooldown: 8 + Math.floor(Math.random() * 14)
        });
        return true;
      }
    }
    return false;
  }

  inFootprint(bx, by, tx, ty) {
    return bx >= tx && bx < tx + 3 && by >= ty && by < ty + 3;
  }

  fireBullet(x, y, dir, fromPlayer, owner = null) {
    const vec = this.DIR_VECS[dir];
    const barrel = this.BARREL_OFFSETS[dir];
    const bx = x + barrel.x + vec.x;
    const by = y + barrel.y + vec.y;

    if (bx < 0 || bx >= this.COLS || by < 0 || by >= this.ROWS) {
      return;
    }

    // Immediate point-blank obstacle hit
    const obsIdx = this.obstacles.findIndex(o => o.x === bx && o.y === by);
    if (obsIdx !== -1) {
      this.obstacles.splice(obsIdx, 1);
      this.sound.drop();
      return;
    }

    // Immediate point-blank tank hit
    if (fromPlayer) {
      for (let e = this.enemyTanks.length - 1; e >= 0; e--) {
        const enemy = this.enemyTanks[e];
        if (this.inFootprint(bx, by, enemy.x, enemy.y)) {
          this.handleEnemyDestroyed(e);
          return;
        }
      }
    } else {
      for (let e = this.enemyTanks.length - 1; e >= 0; e--) {
        const enemy = this.enemyTanks[e];
        if (enemy !== owner && this.inFootprint(bx, by, enemy.x, enemy.y)) {
          return;
        }
      }
      if (this.inFootprint(bx, by, this.playerX, this.playerY)) {
        this.triggerCrash(this.lastTickTime);
        return;
      }
    }

    this.bullets.push({
      x: bx,
      y: by,
      prevX: bx,
      prevY: by,
      dx: vec.x,
      dy: vec.y,
      fromPlayer: fromPlayer,
      owner: owner,
      justSpawned: true
    });
  }

  rebuildWallsIfNeeded() {
    if (!this.pendingWallRebuild) return;
    this.pendingWallRebuild = false;
    if (this.obstacles.length < 4) {
      for (const cell of this.buildDefaultWallCells()) {
        const exists = this.obstacles.some(o => o.x === cell.x && o.y === cell.y);
        const onPlayer = this.inFootprint(cell.x, cell.y, this.playerX, this.playerY);
        const onEnemy = this.enemyTanks.some(e => this.inFootprint(cell.x, cell.y, e.x, e.y));
        if (!exists && !onPlayer && !onEnemy) {
          this.obstacles.push({ x: cell.x, y: cell.y });
        }
      }
    }
  }

  handleEnemyDestroyed(enemyIdx) {
    this.enemyTanks.splice(enemyIdx, 1);
    this.score += 100;
    this.enemiesDefeated++;
    this.saveHighScore();
    this.sound.clear();

    if (this.enemiesDefeated % 15 === 0) {
      if (this.level < 10) this.level++;
      if (this.speed < 10) this.speed++;
      if (this.obstacles.length < 4) {
        this.pendingWallRebuild = true;
        if (!this.inBulletTick) {
          this.rebuildWallsIfNeeded();
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
      if (this.isPaused) {
        this.pausedAt = input.now || this.lastTickTime || 0;
        return;
      }
      unpausedThisFrame = true;
      if (input.now) {
        this.lastTickTime = input.now;
        this.bulletTickTime = input.now;
        if (this.isCrashing) this.crashStartTime = input.now;
        if (this.nextSpawnTime) {
          this.nextSpawnTime = this.pausedAt
            ? input.now + Math.max(0, this.nextSpawnTime - this.pausedAt)
            : input.now + 1800;
        }
        this.pausedAt = 0;
      }
    }

    if (this.isPaused || this.isCrashing) return;

    // 4-Directional movement & orientation
    const dirActions = [
      { action: 'UP', dir: 0 },
      { action: 'RIGHT', dir: 1 },
      { action: 'DOWN', dir: 2 },
      { action: 'LEFT', dir: 3 }
    ];

    for (const item of dirActions) {
      if (input.justPressedOrRepeated(item.action, 150, 85) || (unpausedThisFrame && input.isDown(item.action))) {
        const wasJustPressed = input.justPressed(item.action);
        if (this.playerDir !== item.dir && wasJustPressed) {
          this.playerDir = item.dir;
          this.sound.move();
        } else {
          this.playerDir = item.dir;
          const vec = this.DIR_VECS[item.dir];
          if (this.canMoveTank(this.playerX + vec.x, this.playerY + vec.y, -1)) {
            this.playerX += vec.x;
            this.playerY += vec.y;
            this.sound.move();
            for (let i = this.bullets.length - 1; i >= 0; i--) {
              const b = this.bullets[i];
              if (!b.fromPlayer && this.inFootprint(b.x, b.y, this.playerX, this.playerY)) {
                this.bullets.splice(i, 1);
                this.triggerCrash(this.lastTickTime);
                return;
              }
            }
          }
        }
        break;
      }
    }

    // Fire bullet in facing direction
    if (input.justPressedOrRepeated('ACTION', 220, 180)) {
      const playerBullets = this.bullets.filter(b => b.fromPlayer);
      if (playerBullets.length < 2) {
        this.fireBullet(this.playerX, this.playerY, this.playerDir, true);
        this.sound.rotate();
      }
    }
  }

  update(timestamp) {
    if (this.isPaused) {
      if (!this.wasPaused) {
        this.pausedAt = timestamp;
      }
      this.wasPaused = true;
      return;
    }
    if (this.gameOver) return;

    if (this.wasPaused) {
      this.wasPaused = false;
      this.lastTickTime = timestamp;
      this.bulletTickTime = timestamp;
      if (this.isCrashing) this.crashStartTime = timestamp;
      if (this.nextSpawnTime) {
        this.nextSpawnTime = this.pausedAt
          ? timestamp + Math.max(0, this.nextSpawnTime - this.pausedAt)
          : timestamp + 1800;
      }
      this.pausedAt = 0;
    }

    // Timestamp-based crash animation (900ms)
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
          // Respawn player at a safe spot
          this.bullets = [];
          this.playerDir = 0;
          if (this.canMoveTank(3, 17, -1)) {
            this.playerX = 3;
            this.playerY = 17;
          } else {
            this.enemyTanks = this.enemyTanks.filter(e => Math.abs(e.x - 3) >= 3 || Math.abs(e.y - 17) >= 3);
            this.playerX = 3;
            this.playerY = 17;
          }
          this.lastTickTime = timestamp;
          this.bulletTickTime = timestamp;
        }
      }
      return;
    }

    // Bullet physics (55ms)
    if (!this.bulletTickTime) this.bulletTickTime = timestamp;
    if (timestamp - this.bulletTickTime >= 55) {
      this.bulletTickTime = timestamp;
      this.tickBullets(timestamp);
    }

    if (this.isCrashing) return;

    // Tank AI & movement ticks
    const tankInterval = Math.max(160, 460 - (this.speed * 28));
    if (!this.lastTickTime) this.lastTickTime = timestamp;
    if (timestamp - this.lastTickTime >= tankInterval) {
      this.lastTickTime = timestamp;
      this.tickTanks(timestamp);
    }
  }

  tickBullets(timestamp) {
    this.inBulletTick = true;
    try {
      // Check bullets already inside a tank footprint before stepping
      for (let i = this.bullets.length - 1; i >= 0; i--) {
        const b = this.bullets[i];
        if (b.fromPlayer) {
          let hit = false;
          for (let e = this.enemyTanks.length - 1; e >= 0; e--) {
            const enemy = this.enemyTanks[e];
            if (this.inFootprint(b.x, b.y, enemy.x, enemy.y)) {
              this.bullets.splice(i, 1);
              this.handleEnemyDestroyed(e);
              hit = true;
              break;
            }
          }
          if (hit) continue;
        } else {
          let hitOtherEnemy = false;
          for (let e = this.enemyTanks.length - 1; e >= 0; e--) {
            const enemy = this.enemyTanks[e];
            if (enemy !== b.owner && this.inFootprint(b.x, b.y, enemy.x, enemy.y)) {
              this.bullets.splice(i, 1);
              hitOtherEnemy = true;
              break;
            }
          }
          if (hitOtherEnemy) continue;
          if (this.inFootprint(b.x, b.y, this.playerX, this.playerY)) {
            this.bullets.splice(i, 1);
            this.triggerCrash(timestamp);
            return;
          }
        }
      }

      for (const b of this.bullets) {
        b.prevX = b.x;
        b.prevY = b.y;
        if (b.justSpawned) {
          b.justSpawned = false;
          continue;
        }
        b.x += b.dx;
        b.y += b.dy;
      }

      // Bullet-vs-bullet collisions (opposite teams on same cell or head-on swap)
      const toRemove = new Set();
      for (let i = 0; i < this.bullets.length; i++) {
        if (toRemove.has(i)) continue;
        const a = this.bullets[i];
        for (let j = i + 1; j < this.bullets.length; j++) {
          if (toRemove.has(j)) continue;
          const b = this.bullets[j];
          if (a.fromPlayer === b.fromPlayer) continue;
          const samePos = a.x === b.x && a.y === b.y;
          const swapped = a.x === b.prevX && a.y === b.prevY && b.x === a.prevX && b.y === a.prevY;
          if (samePos || swapped) {
            toRemove.add(i);
            toRemove.add(j);
            break;
          }
        }
      }

      for (let i = this.bullets.length - 1; i >= 0; i--) {
        if (toRemove.has(i)) {
          this.bullets.splice(i, 1);
          continue;
        }

        const b = this.bullets[i];

        // Offscreen check
        if (b.x < 0 || b.x >= this.COLS || b.y < 0 || b.y >= this.ROWS) {
          this.bullets.splice(i, 1);
          continue;
        }

        // Check obstacle hit
        const obsIdx = this.obstacles.findIndex(o => o.x === b.x && o.y === b.y);
        if (obsIdx !== -1) {
          this.obstacles.splice(obsIdx, 1);
          this.bullets.splice(i, 1);
          this.sound.drop();
          continue;
        }

        // Check player bullet hitting enemy tank
        if (b.fromPlayer) {
          let hitEnemy = false;
          for (let e = this.enemyTanks.length - 1; e >= 0; e--) {
            const enemy = this.enemyTanks[e];
            if (this.inFootprint(b.x, b.y, enemy.x, enemy.y)) {
              this.bullets.splice(i, 1);
              this.handleEnemyDestroyed(e);
              hitEnemy = true;
              break;
            }
          }
          if (hitEnemy) continue;
        }

        // Check enemy bullet hitting other enemies or player
        if (!b.fromPlayer) {
          let hitOtherEnemy = false;
          for (let e = this.enemyTanks.length - 1; e >= 0; e--) {
            const enemy = this.enemyTanks[e];
            if (enemy !== b.owner && this.inFootprint(b.x, b.y, enemy.x, enemy.y)) {
              this.bullets.splice(i, 1);
              hitOtherEnemy = true;
              break;
            }
          }
          if (hitOtherEnemy) continue;

          if (this.inFootprint(b.x, b.y, this.playerX, this.playerY)) {
            this.bullets.splice(i, 1);
            this.triggerCrash(timestamp);
            return;
          }
        }
      }
    } finally {
      this.inBulletTick = false;
      this.rebuildWallsIfNeeded();
    }
  }

  tickTanks(timestamp) {
    // Timestamp-based enemy spawning (up to 3 enemies)
    if (this.enemyTanks.length < 3) {
      if (!this.nextSpawnTime) {
        this.nextSpawnTime = timestamp + 1800;
      } else if (timestamp >= this.nextSpawnTime) {
        if (this.spawnEnemy()) {
          this.nextSpawnTime = this.enemyTanks.length < 3 ? timestamp + 2200 : 0;
        } else {
          this.nextSpawnTime = timestamp + 800;
        }
      }
    } else {
      this.nextSpawnTime = 0;
    }

    for (let idx = 0; idx < this.enemyTanks.length; idx++) {
      const enemy = this.enemyTanks[idx];
      const vec = this.DIR_VECS[enemy.dir];
      const canForward = this.canMoveTank(enemy.x + vec.x, enemy.y + vec.y, idx);

      if (canForward && Math.random() < 0.7) {
        enemy.x += vec.x;
        enemy.y += vec.y;

        let enemyAlive = true;
        for (let bi = this.bullets.length - 1; bi >= 0; bi--) {
          const b = this.bullets[bi];
          if (this.inFootprint(b.x, b.y, enemy.x, enemy.y)) {
            if (b.fromPlayer) {
              this.bullets.splice(bi, 1);
              this.handleEnemyDestroyed(idx);
              idx--;
              enemyAlive = false;
              break;
            } else if (b.owner !== enemy) {
              this.bullets.splice(bi, 1);
            }
          }
        }
        if (!enemyAlive) continue;
      } else {
        // Choose a new valid direction, biasing toward player alignment
        const validDirs = [];
        for (let d = 0; d < 4; d++) {
          const dv = this.DIR_VECS[d];
          if (this.canMoveTank(enemy.x + dv.x, enemy.y + dv.y, idx)) {
            validDirs.push(d);
          }
        }

        if (validDirs.length > 0) {
          const preferred = [];
          if (this.playerY < enemy.y) preferred.push(0);
          if (this.playerX > enemy.x) preferred.push(1);
          if (this.playerY > enemy.y) preferred.push(2);
          if (this.playerX < enemy.x) preferred.push(3);

          const goodDirs = validDirs.filter(d => preferred.includes(d));
          if (goodDirs.length > 0 && Math.random() < 0.75) {
            enemy.dir = goodDirs[Math.floor(Math.random() * goodDirs.length)];
          } else {
            enemy.dir = validDirs[Math.floor(Math.random() * validDirs.length)];
          }
        }
      }

      // Enemy aiming & firing
      enemy.fireCooldown--;
      if (enemy.fireCooldown <= 0) {
        // Face player if aligned on X or Y
        if (Math.abs(enemy.x - this.playerX) <= 1) {
          enemy.dir = this.playerY > enemy.y ? 2 : 0;
        } else if (Math.abs(enemy.y - this.playerY) <= 1) {
          enemy.dir = this.playerX > enemy.x ? 1 : 3;
        }

        enemy.fireCooldown = Math.max(8, 22 - this.level) + Math.floor(Math.random() * 14);
        this.fireBullet(enemy.x, enemy.y, enemy.dir, false, enemy);
        if (this.isCrashing) return;
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
    this.enemiesDefeated = 0;
    this.gameOver = false;
    this.isPaused = false;
    this.wasPaused = false;
    this.pausedAt = 0;
    this.isCrashing = false;
    this.crashStartTime = 0;
    this.crashFlashOn = true;
    this.lastTickTime = 0;
    this.bulletTickTime = 0;
    this.inBulletTick = false;
    this.pendingWallRebuild = false;
    this.initLevel();
  }

  destroy() {}

  drawTankOnGrid(grid, x, y, dir) {
    const shape = this.TANK_SHAPES[dir] || this.TANK_SHAPES[0];
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        if (shape[r][c]) {
          const gy = y + r;
          const gx = x + c;
          if (gy >= 0 && gy < this.ROWS && gx >= 0 && gx < this.COLS) {
            grid[gy][gx] = 1;
          }
        }
      }
    }
  }

  getDisplayMatrix() {
    const grid = Array(this.ROWS).fill(null).map(() => Array(this.COLS).fill(0));

    // Draw obstacles
    for (const obs of this.obstacles) {
      if (obs.y >= 0 && obs.y < this.ROWS && obs.x >= 0 && obs.x < this.COLS) {
        grid[obs.y][obs.x] = 1;
      }
    }

    // Draw enemy tanks
    for (const enemy of this.enemyTanks) {
      this.drawTankOnGrid(grid, enemy.x, enemy.y, enemy.dir);
    }

    // Draw player tank (flashes when crashing)
    if (!this.isCrashing || this.crashFlashOn) {
      this.drawTankOnGrid(grid, this.playerX, this.playerY, this.playerDir);
    }

    // Draw bullets
    for (const b of this.bullets) {
      if (b.y >= 0 && b.y < this.ROWS && b.x >= 0 && b.x < this.COLS) {
        grid[b.y][b.x] = 1;
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
  module.exports = TankGame;
}
