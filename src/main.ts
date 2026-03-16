import './style.css'
import Phaser from 'phaser'

type WeaponType = 'peashooter' | 'multishot' | 'laser'
type EnemyKind = 'rusher' | 'shooter' | 'tank' | 'boss'
type MovementPattern = 'sine' | 'zigzag' | 'dive'
type UpgradeId = 'fireRate' | 'projectiles' | 'moveSpeed' | 'damage' | 'maxHpHeal' | 'laserCharge'

type UpgradeOption = {
  id: UpgradeId
  title: string
  description: string
  apply: () => void
}

type EnemyState = {
  kind: EnemyKind
  hp: number
  maxHp: number
  touchDamage: number
  xp: number
  scrap: number
  score: number
  pattern: MovementPattern
  spawnX: number
  spawnY: number
  ageMs: number
  amplitude: number
  phase: number
  zigDir: number
  zigTimer: number
  zigTargetX: number
  diveState: 'sweep' | 'dive'
  fireTimer: number
}

class NeonRequiemScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private wasd!: { [key: string]: Phaser.Input.Keyboard.Key }

  private bullets!: Phaser.Physics.Arcade.Group
  private enemyBullets!: Phaser.Physics.Arcade.Group
  private enemies!: Phaser.Physics.Arcade.Group

  private score = 0
  private health = 100
  private maxHealth = 100
  private level = 1
  private xp = 0
  private xpToNext = 70
  private wave = 1
  private runScrap = 0
  private totalScrap = 0

  private scoreText!: Phaser.GameObjects.Text
  private healthText!: Phaser.GameObjects.Text
  private levelText!: Phaser.GameObjects.Text
  private waveText!: Phaser.GameObjects.Text
  private weaponText!: Phaser.GameObjects.Text
  private scrapText!: Phaser.GameObjects.Text
  private totalScrapText!: Phaser.GameObjects.Text
  private statusText!: Phaser.GameObjects.Text
  private bossBannerText!: Phaser.GameObjects.Text
  private xpBarFill!: Phaser.GameObjects.Rectangle
  private bossHpBg!: Phaser.GameObjects.Rectangle
  private bossHpFill!: Phaser.GameObjects.Rectangle

  private gameOver = false
  private levelUpPending = false
  private bossActive = false
  private weapon: WeaponType = 'peashooter'

  private baseFireCooldown = 140
  private fireCooldown = 0
  private moveSpeed = 225
  private damageMult = 1
  private extraProjectiles = 0
  private laserCharge = 0

  private waveTimer?: Phaser.Time.TimerEvent
  private spawnTimer?: Phaser.Time.TimerEvent
  private bossBannerTimer?: Phaser.Time.TimerEvent

  private readonly totalScrapKey = 'nr_afterglitch_total_scrap'
  private audioCtx?: AudioContext

  constructor() {
    super('NeonRequiemScene')
  }

  create() {
    this.totalScrap = Number(localStorage.getItem(this.totalScrapKey) ?? '0') || 0

    this.drawBackground()

    this.player = this.physics.add.sprite(480, 540, '').setTint(0x00f5ff)
    this.player.setDisplaySize(28, 28)
    this.player.setCollideWorldBounds(true)
    this.player.setDamping(true).setDrag(0.9).setMaxVelocity(360)

    this.cursors = this.input.keyboard!.createCursorKeys()
    this.wasd = this.input.keyboard!.addKeys('W,A,S,D') as { [key: string]: Phaser.Input.Keyboard.Key }

    this.bullets = this.physics.add.group({ classType: Phaser.Physics.Arcade.Image, maxSize: 140 })
    this.enemyBullets = this.physics.add.group({ classType: Phaser.Physics.Arcade.Image, maxSize: 180 })
    this.enemies = this.physics.add.group()

    this.createHud()

    this.physics.add.overlap(this.bullets, this.enemies, (obj1, obj2) => this.onBulletHitEnemy(obj1, obj2), undefined, this)
    this.physics.add.overlap(this.player, this.enemies, (obj1, obj2) => this.onPlayerHitEnemy(obj1, obj2), undefined, this)
    this.physics.add.overlap(this.player, this.enemyBullets, (obj1, obj2) => this.onPlayerHitByProjectile(obj1, obj2), undefined, this)

    this.spawnTimer = this.time.addEvent({
      delay: 1200,
      callback: this.spawnPatternPack,
      callbackScope: this,
      loop: true,
    })

    this.waveTimer = this.time.addEvent({
      delay: 14000,
      callback: this.advanceWave,
      callbackScope: this,
      loop: true,
    })

    this.input.keyboard!.on('keydown-SPACE', () => {
      if (!this.gameOver && !this.levelUpPending) this.shoot()
    })
    this.input.keyboard!.on('keydown-R', () => {
      if (this.gameOver) this.scene.restart()
    })
    this.input.keyboard!.on('keydown-ONE', () => this.setWeapon('peashooter'))
    this.input.keyboard!.on('keydown-TWO', () => this.setWeapon('multishot'))
    this.input.keyboard!.on('keydown-THREE', () => this.setWeapon('laser'))

    this.refreshHud()
  }

  update(_time: number, delta: number) {
    if (this.gameOver || this.levelUpPending) {
      this.player.setVelocity(0, 0)
      return
    }

    let vx = 0
    let vy = 0

    if (this.cursors.left.isDown || this.wasd.A.isDown) vx = -this.moveSpeed
    if (this.cursors.right.isDown || this.wasd.D.isDown) vx = this.moveSpeed
    if (this.cursors.up.isDown || this.wasd.W.isDown) vy = -this.moveSpeed
    if (this.cursors.down.isDown || this.wasd.S.isDown) vy = this.moveSpeed

    this.player.setVelocity(vx, vy)
    this.fireCooldown = Math.max(0, this.fireCooldown - delta)

    this.enemies.children.iterate((child) => {
      const enemy = child as Phaser.Physics.Arcade.Sprite | null
      if (!enemy || !enemy.active) return null

      const state = enemy.getData('state') as EnemyState
      state.ageMs += delta
      this.updateEnemyMovement(enemy, state)
      this.updateEnemyFire(enemy, state, delta)

      enemy.setData('state', state)

      if (enemy.y > 700 || enemy.x < -60 || enemy.x > 1020) {
        enemy.destroy()
      }
      return null
    })
  }

  private createHud() {
    this.scoreText = this.add.text(16, 12, 'SCORE: 0', this.hudStyle('#67f6ff'))
    this.healthText = this.add.text(16, 42, 'HP: 100/100', this.hudStyle('#ff4fcf'))
    this.levelText = this.add.text(16, 72, 'LVL: 1', this.hudStyle('#f7ff82'))
    this.waveText = this.add.text(16, 102, 'WAVE: 1', this.hudStyle('#f0c8ff'))
    this.weaponText = this.add.text(16, 132, 'WEAPON: PEASHOOTER [1]', this.hudStyle('#72ff5e'))
    this.scrapText = this.add.text(16, 162, 'RUN SCRAP: 0', this.hudStyle('#ffd173'))
    this.totalScrapText = this.add.text(16, 192, `TOTAL SCRAP: ${this.totalScrap}`, this.hudStyle('#ff9f4d'))

    this.add.rectangle(16, 232, 360, 18, 0x1a1a2e).setOrigin(0, 0.5).setStrokeStyle(2, 0x67f6ff)
    this.xpBarFill = this.add.rectangle(18, 232, 0, 14, 0x67f6ff).setOrigin(0, 0.5)

    this.bossHpBg = this.add.rectangle(240, 24, 480, 18, 0x22070d).setOrigin(0, 0.5).setVisible(false).setStrokeStyle(2, 0xff5a7a)
    this.bossHpFill = this.add.rectangle(242, 24, 0, 14, 0xff5a7a).setOrigin(0, 0.5).setVisible(false)

    this.bossBannerText = this.add
      .text(480, 72, '', {
        fontFamily: 'monospace',
        fontSize: '28px',
        color: '#ff5a7a',
        stroke: '#16020a',
        strokeThickness: 6,
      })
      .setOrigin(0.5)

    this.statusText = this.add
      .text(480, 320, '', {
        fontFamily: 'monospace',
        fontSize: '28px',
        color: '#f8f8f8',
        align: 'center',
      })
      .setOrigin(0.5)
  }

  private spawnPatternPack() {
    if (this.gameOver || this.levelUpPending || this.bossActive) return

    const intensity = Math.floor((this.wave - 1) / 2)
    const count = Phaser.Math.Clamp(2 + intensity, 2, 6)

    for (let i = 0; i < count; i++) {
      const roll = Phaser.Math.Between(1, 100)
      let kind: EnemyKind = 'rusher'
      if (roll > 68 && roll <= 90) kind = 'shooter'
      if (roll > 90) kind = 'tank'

      const patternRoll = Phaser.Math.RND.pick<MovementPattern>(['sine', 'zigzag', 'dive'])
      this.spawnEnemy(kind, patternRoll)
    }
  }

  private spawnEnemy(kind: EnemyKind, pattern: MovementPattern) {
    const x = Phaser.Math.Between(40, 920)
    const y = Phaser.Math.Between(-150, -40)

    const enemy = this.physics.add.sprite(x, y, '')
    enemy.setBlendMode(Phaser.BlendModes.SCREEN)

    let hp = 20 + this.wave * 3
    let speed = 110 + this.wave * 3
    let tint = 0xff5a7a
    let touchDamage = 10
    let xp = 14
    let scrap = 2
    let score = 12

    if (kind === 'shooter') {
      hp = 26 + this.wave * 4
      speed = 88 + this.wave * 2
      tint = 0xffa93c
      touchDamage = 8
      xp = 18
      scrap = 3
      score = 18
      enemy.setDisplaySize(34, 28)
    } else if (kind === 'tank') {
      hp = 65 + this.wave * 8
      speed = 62 + this.wave
      tint = 0x8f7dff
      touchDamage = 18
      xp = 28
      scrap = 6
      score = 35
      enemy.setDisplaySize(42, 42)
    } else {
      enemy.setDisplaySize(30, 30)
    }

    if (kind === 'rusher') {
      speed += 24
    }

    enemy.setTint(tint)
    const state: EnemyState = {
      kind,
      hp,
      maxHp: hp,
      touchDamage,
      xp,
      scrap,
      score,
      pattern,
      spawnX: x,
      spawnY: y,
      ageMs: 0,
      amplitude: Phaser.Math.Between(40, 110),
      phase: Phaser.Math.FloatBetween(0, Math.PI * 2),
      zigDir: Phaser.Math.Between(0, 1) ? 1 : -1,
      zigTimer: 0,
      zigTargetX: x,
      diveState: 'sweep',
      fireTimer: Phaser.Math.Between(900, 1800),
    }

    enemy.setData('state', state)
    this.enemies.add(enemy)

    if (kind === 'rusher') {
      this.physics.moveToObject(enemy, this.player, speed)
    } else {
      enemy.setVelocity(0, speed * 0.65)
    }
  }

  private updateEnemyMovement(enemy: Phaser.Physics.Arcade.Sprite, state: EnemyState) {
    const dangerScale = 1 + (this.wave - 1) * 0.08

    if (state.kind === 'rusher') {
      this.physics.moveToObject(enemy, this.player, (130 + this.wave * 4) * dangerScale)
      return
    }

    if (state.pattern === 'sine') {
      const drift = Math.sin(state.phase + state.ageMs * 0.004) * state.amplitude
      const targetX = Phaser.Math.Clamp(state.spawnX + drift, 30, 930)
      const yVel = state.kind === 'tank' ? 58 : 86
      enemy.setVelocity((targetX - enemy.x) * 2.4, yVel)
      return
    }

    if (state.pattern === 'zigzag') {
      state.zigTimer -= this.game.loop.delta
      if (state.zigTimer <= 0) {
        state.zigDir *= -1
        state.zigTimer = 500
        state.zigTargetX = Phaser.Math.Clamp(enemy.x + state.zigDir * Phaser.Math.Between(90, 150), 40, 920)
      }
      const yVel = state.kind === 'tank' ? 52 : 82
      enemy.setVelocity((state.zigTargetX - enemy.x) * 3.2, yVel)
      return
    }

    if (state.diveState === 'sweep') {
      const sweepX = state.spawnX + Math.sin(state.phase + state.ageMs * 0.0035) * 200
      enemy.setVelocity((sweepX - enemy.x) * 2.2, 70)
      if (enemy.y > 160 || state.ageMs > 2200) state.diveState = 'dive'
      return
    }

    this.physics.moveToObject(enemy, this.player, state.kind === 'tank' ? 88 : 138)
  }

  private updateEnemyFire(enemy: Phaser.Physics.Arcade.Sprite, state: EnemyState, delta: number) {
    if (state.kind !== 'shooter' && state.kind !== 'boss') return

    state.fireTimer -= delta
    if (state.fireTimer > 0) return

    if (state.kind === 'shooter') {
      state.fireTimer = Phaser.Math.Between(1300, 1900)
      this.spawnEnemyBullet(enemy.x, enemy.y + 14, this.player.x, this.player.y, 220, 0xffb347)
      return
    }

    state.fireTimer = Phaser.Math.Between(850, 1200)
    this.spawnEnemyBullet(enemy.x - 24, enemy.y + 18, this.player.x, this.player.y, 240, 0xff5a7a)
    this.spawnEnemyBullet(enemy.x + 24, enemy.y + 18, this.player.x, this.player.y, 240, 0xff5a7a)
    this.spawnEnemyBullet(enemy.x, enemy.y + 18, this.player.x, this.player.y, 260, 0xff95b8)
  }

  private spawnEnemyBullet(fromX: number, fromY: number, targetX: number, targetY: number, speed: number, tint: number) {
    const bullet = this.enemyBullets.get(fromX, fromY) as Phaser.Physics.Arcade.Image
    if (!bullet) return

    bullet.setActive(true).setVisible(true)
    bullet.setTint(tint)
    bullet.setDisplaySize(8, 14)
    if (bullet.body) bullet.body.enable = true

    this.physics.moveTo(bullet, targetX, targetY, speed)

    this.time.delayedCall(2600, () => {
      if (bullet.active) bullet.disableBody(true, true)
    })
  }

  private shoot() {
    if (this.fireCooldown > 0) return

    if (this.weapon === 'laser') {
      this.fireLaser()
      this.playTone(250 + this.laserCharge * 18, 0.09, 'triangle', 0.08)
      const cooldown = Math.max(190, 340 - this.baseFireCooldown * 0.35 - this.laserCharge * 10)
      this.fireCooldown = cooldown
      return
    }

    if (this.weapon === 'multishot') {
      const spread = 16
      const count = 3 + this.extraProjectiles
      for (let i = 0; i < count; i++) {
        const offset = i - (count - 1) / 2
        this.spawnBullet(this.player.x + offset * 7, this.player.y - 16, -90 + offset * spread, 0x72ff5e, 5, 12, 500)
      }
      this.playTone(300, 0.05, 'square', 0.06)
      this.fireCooldown = Math.max(95, 210 - this.baseFireCooldown * 0.35)
      return
    }

    const count = 1 + Math.min(2, this.extraProjectiles)
    for (let i = 0; i < count; i++) {
      const offset = i - (count - 1) / 2
      this.spawnBullet(this.player.x + offset * 9, this.player.y - 18, -90 + offset * 6, 0x72ff5e, 5, 14, 460)
    }
    this.playTone(460, 0.04, 'square', 0.04)
    this.fireCooldown = Math.max(65, this.baseFireCooldown)
  }

  private spawnBullet(x: number, y: number, angleDeg: number, tint: number, w: number, h: number, speed: number) {
    const bullet = this.bullets.get(x, y) as Phaser.Physics.Arcade.Image
    if (!bullet) return

    bullet.setActive(true).setVisible(true)
    bullet.setTint(tint)
    bullet.setDisplaySize(w, h)
    if (bullet.body) bullet.body.enable = true

    const v = this.physics.velocityFromAngle(angleDeg, speed)
    bullet.setVelocity(v.x, v.y)

    this.time.delayedCall(1800, () => {
      if (bullet.active) bullet.disableBody(true, true)
    })
  }

  private fireLaser() {
    const width = 10 + this.extraProjectiles * 3
    const laser = this.add.rectangle(this.player.x, this.player.y - 220, width, 450, 0x00f5ff, 0.8)
    laser.setBlendMode(Phaser.BlendModes.ADD)
    this.time.delayedCall(80, () => laser.destroy())

    this.enemies.children.iterate((child) => {
      const enemy = child as Phaser.Physics.Arcade.Sprite | null
      if (!enemy || !enemy.active) return null
      if (Math.abs(enemy.x - this.player.x) < 28 + this.extraProjectiles * 8 && enemy.y < this.player.y) {
        this.damageEnemy(enemy, 16 + 4 * this.damageMult)
      }
      return null
    })
  }

  private onBulletHitEnemy(bulletObj: any, enemyObj: any) {
    const bullet = bulletObj as Phaser.Physics.Arcade.Image
    const enemy = enemyObj as Phaser.Physics.Arcade.Sprite
    bullet.disableBody(true, true)

    const baseDamage = this.weapon === 'laser' ? 2 : 12
    this.damageEnemy(enemy, baseDamage * this.damageMult)
  }

  private damageEnemy(enemy: Phaser.Physics.Arcade.Sprite, damage: number) {
    if (!enemy.active) return

    const state = enemy.getData('state') as EnemyState
    state.hp -= damage
    enemy.setTintFill(0xffffff)
    this.time.delayedCall(50, () => {
      if (enemy.active) enemy.clearTint().setTint(this.colorForEnemyKind(state.kind))
    })

    if (state.hp <= 0) {
      this.killEnemy(enemy, state)
      return
    }

    enemy.setData('state', state)
    if (state.kind === 'boss') {
      this.updateBossUi(state)
    }
  }

  private killEnemy(enemy: Phaser.Physics.Arcade.Sprite, state: EnemyState) {
    this.score += state.score
    this.runScrap += state.scrap
    this.gainXp(state.xp)

    this.scoreText.setText(`SCORE: ${this.score}`)
    this.scrapText.setText(`RUN SCRAP: ${this.runScrap}`)

    this.spawnDeathParticles(enemy.x, enemy.y, this.colorForEnemyKind(state.kind))
    this.playTone(state.kind === 'tank' || state.kind === 'boss' ? 120 : 190, 0.07, 'sawtooth', 0.07)

    if (state.kind === 'boss') {
      this.score += 350
      this.runScrap += 40
      this.scoreText.setText(`SCORE: ${this.score}`)
      this.scrapText.setText(`RUN SCRAP: ${this.runScrap}`)
      this.bossActive = false
      this.bossHpBg.setVisible(false)
      this.bossHpFill.setVisible(false)
      this.showBossBanner('BOSS DOWN! +POWER UPGRADE')
      this.offerGuaranteedBossUpgrade()
    }

    enemy.destroy()
  }

  private onPlayerHitEnemy(playerObj: any, enemyObj: any) {
    const enemy = enemyObj as Phaser.Physics.Arcade.Sprite
    const state = enemy.getData('state') as EnemyState

    this.inflictPlayerDamage(state.touchDamage)

    if (state.kind !== 'boss') {
      enemy.destroy()
    }

    const player = playerObj as Phaser.Physics.Arcade.Sprite
    player.setTintFill(0xffffff)
    this.time.delayedCall(80, () => player.clearTint().setTint(0x00f5ff))
  }

  private onPlayerHitByProjectile(_playerObj: any, bulletObj: any) {
    const bullet = bulletObj as Phaser.Physics.Arcade.Image
    bullet.disableBody(true, true)
    this.inflictPlayerDamage(8)
  }

  private inflictPlayerDamage(amount: number) {
    this.health = Math.max(0, this.health - amount)
    this.healthText.setText(`HP: ${Math.floor(this.health)}/${this.maxHealth}`)
    this.cameras.main.shake(70, 0.0025)
    this.playTone(90, 0.05, 'triangle', 0.07)
    if (this.health <= 0) this.endGame()
  }

  private gainXp(amount: number) {
    this.xp += amount
    while (this.xp >= this.xpToNext) {
      this.xp -= this.xpToNext
      this.level += 1
      this.xpToNext = Math.floor(this.xpToNext * 1.2 + 20)
      this.onLevelUp()
    }
    this.refreshHud()
  }

  private onLevelUp() {
    if (this.gameOver) return

    this.levelUpPending = true
    this.physics.world.pause()
    if (this.spawnTimer) this.spawnTimer.paused = true
    if (this.waveTimer) this.waveTimer.paused = true

    const options = this.pickUpgradeOptions(3)

    const panel = this.add.container(480, 320)
    const bg = this.add.rectangle(0, 0, 620, 340, 0x06081b, 0.95).setStrokeStyle(3, 0x72ffea)
    const title = this.add
      .text(0, -125, `LEVEL ${this.level} // SELECT UPGRADE`, {
        fontFamily: 'monospace',
        fontSize: '26px',
        color: '#d4fff7',
      })
      .setOrigin(0.5)

    panel.add([bg, title])

    const chooseUpgrade = (option?: UpgradeOption) => {
      if (!option || !this.levelUpPending) return
      option.apply()
      panel.destroy(true)
      this.resumeAfterUpgrade()
    }

    options.forEach((option, idx) => {
      const y = -35 + idx * 92
      const button = this.add.rectangle(0, y, 560, 74, 0x111f3a, 0.95).setStrokeStyle(2, 0x67f6ff).setInteractive({ useHandCursor: true })
      const text = this.add
        .text(-252, y - 12, `${idx + 1}. ${option.title}\n${option.description}`, {
          fontFamily: 'monospace',
          fontSize: '20px',
          color: '#f8fbff',
        })
        .setOrigin(0, 0)

      button.on('pointerover', () => button.setFillStyle(0x1f2f57, 0.98))
      button.on('pointerout', () => button.setFillStyle(0x111f3a, 0.95))
      button.on('pointerdown', () => chooseUpgrade(option))

      panel.add([button, text])
    })

    this.input.keyboard!.once('keydown-ONE', () => chooseUpgrade(options[0]))
    this.input.keyboard!.once('keydown-TWO', () => chooseUpgrade(options[1]))
    this.input.keyboard!.once('keydown-THREE', () => chooseUpgrade(options[2]))

    this.refreshHud()
  }

  private pickUpgradeOptions(count: number): UpgradeOption[] {
    const pool: UpgradeOption[] = [
      {
        id: 'fireRate',
        title: 'Overclock Trigger',
        description: '+12% fire rate for all weapons.',
        apply: () => {
          this.baseFireCooldown = Math.max(55, this.baseFireCooldown * 0.88)
          this.playTone(560, 0.07, 'square', 0.05)
        },
      },
      {
        id: 'projectiles',
        title: 'Multi-feed Chamber',
        description: '+1 projectile lane (up to +3).',
        apply: () => {
          this.extraProjectiles = Math.min(3, this.extraProjectiles + 1)
          this.playTone(520, 0.07, 'sawtooth', 0.05)
        },
      },
      {
        id: 'moveSpeed',
        title: 'Mag Boots',
        description: '+18 move speed. Better dodging.',
        apply: () => {
          this.moveSpeed = Math.min(340, this.moveSpeed + 18)
          this.playTone(640, 0.05, 'triangle', 0.05)
        },
      },
      {
        id: 'damage',
        title: 'Focused Core',
        description: '+18% weapon damage.',
        apply: () => {
          this.damageMult *= 1.18
          this.playTone(470, 0.07, 'square', 0.06)
        },
      },
      {
        id: 'maxHpHeal',
        title: 'Reinforced Frame',
        description: '+15 max HP and heal 18.',
        apply: () => {
          this.maxHealth += 15
          this.health = Math.min(this.maxHealth, this.health + 18)
          this.healthText.setText(`HP: ${Math.floor(this.health)}/${this.maxHealth}`)
          this.playTone(420, 0.06, 'triangle', 0.05)
        },
      },
      {
        id: 'laserCharge',
        title: 'Ion Capacitors',
        description: 'Laser fires faster and thicker.',
        apply: () => {
          this.laserCharge += 1
          this.playTone(340, 0.08, 'sawtooth', 0.05)
        },
      },
    ]

    return Phaser.Utils.Array.Shuffle(pool).slice(0, count)
  }

  private offerGuaranteedBossUpgrade() {
    if (this.gameOver) return
    this.levelUpPending = true
    this.physics.world.pause()
    if (this.spawnTimer) this.spawnTimer.paused = true
    if (this.waveTimer) this.waveTimer.paused = true

    const options = this.pickUpgradeOptions(3)
    const strongest = options.sort((a, b) => this.upgradePriority(b.id) - this.upgradePriority(a.id))[0]
    strongest.apply()

    this.statusText.setText(`SALVAGE BONUS\n${strongest.title}\n(Guaranteed Boss Reward)`) 
    this.time.delayedCall(1200, () => {
      this.statusText.setText('')
      this.resumeAfterUpgrade()
    })
  }

  private upgradePriority(id: UpgradeId): number {
    if (id === 'projectiles') return 6
    if (id === 'damage') return 5
    if (id === 'fireRate') return 4
    if (id === 'maxHpHeal') return 3
    if (id === 'laserCharge') return 2
    return 1
  }

  private resumeAfterUpgrade() {
    if (this.gameOver) return

    this.levelUpPending = false
    this.physics.world.resume()
    if (this.spawnTimer) this.spawnTimer.paused = false
    if (this.waveTimer) this.waveTimer.paused = false
    this.statusText.setText('')
    this.refreshHud()
  }

  private setWeapon(next: WeaponType) {
    this.weapon = next
    let label = 'PEASHOOTER [1]'
    if (next === 'multishot') label = 'MULTI-SHOT [2]'
    if (next === 'laser') label = 'ION LASER [3]'
    this.weaponText.setText(`WEAPON: ${label}`)
  }

  private advanceWave() {
    if (this.gameOver) return

    this.wave += 1
    this.waveText.setText(`WAVE: ${this.wave}`)

    if (this.wave % 5 === 0) {
      this.spawnBoss()
    }
  }

  private spawnBoss() {
    if (this.bossActive || this.gameOver) return

    this.bossActive = true
    this.showBossBanner(`WAVE ${this.wave} // EXECUTIONER CORE INBOUND`)

    const boss = this.physics.add.sprite(480, -120, '')
    boss.setDisplaySize(120, 92)
    boss.setTint(0xff2d62)
    boss.setBlendMode(Phaser.BlendModes.SCREEN)

    const hp = 680 + this.wave * 120
    const state: EnemyState = {
      kind: 'boss',
      hp,
      maxHp: hp,
      touchDamage: 22,
      xp: 140,
      scrap: 28,
      score: 220,
      pattern: 'sine',
      spawnX: 480,
      spawnY: -120,
      ageMs: 0,
      amplitude: 220,
      phase: Phaser.Math.FloatBetween(0, Math.PI * 2),
      zigDir: 1,
      zigTimer: 0,
      zigTargetX: 480,
      diveState: 'sweep',
      fireTimer: 1000,
    }

    boss.setData('state', state)
    boss.setVelocity(0, 65)
    this.enemies.add(boss)

    this.bossHpBg.setVisible(true)
    this.bossHpFill.setVisible(true)
    this.updateBossUi(state)
  }

  private updateBossUi(state: EnemyState) {
    const pct = Phaser.Math.Clamp(state.hp / state.maxHp, 0, 1)
    this.bossHpFill.width = 476 * pct
  }

  private showBossBanner(text: string) {
    this.bossBannerText.setText(text)
    this.bossBannerTimer?.remove(false)
    this.bossBannerTimer = this.time.delayedCall(2200, () => this.bossBannerText.setText(''))
  }

  private refreshHud() {
    this.healthText.setText(`HP: ${Math.floor(this.health)}/${this.maxHealth}`)
    this.levelText.setText(`LVL: ${this.level}`)
    this.waveText.setText(`WAVE: ${this.wave}`)
    this.scoreText.setText(`SCORE: ${this.score}`)
    this.scrapText.setText(`RUN SCRAP: ${this.runScrap}`)
    this.totalScrapText.setText(`TOTAL SCRAP: ${this.totalScrap}`)
    const pct = Phaser.Math.Clamp(this.xp / this.xpToNext, 0, 1)
    this.xpBarFill.width = 356 * pct
  }

  private spawnDeathParticles(x: number, y: number, color: number) {
    for (let i = 0; i < 8; i++) {
      const p = this.add.rectangle(x, y, 4, 4, color, 0.95)
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2)
      const dist = Phaser.Math.Between(18, 44)
      const tx = x + Math.cos(angle) * dist
      const ty = y + Math.sin(angle) * dist

      this.tweens.add({
        targets: p,
        x: tx,
        y: ty,
        alpha: 0,
        scale: 0.3,
        duration: Phaser.Math.Between(140, 240),
        onComplete: () => p.destroy(),
      })
    }
    this.cameras.main.shake(60, 0.0018)
  }

  private playTone(freq: number, durationSec: number, wave: OscillatorType, gainValue: number) {
    try {
      const webkitContext = (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!this.audioCtx) {
        const Ctx = window.AudioContext ?? webkitContext
        if (!Ctx) return
        this.audioCtx = new Ctx()
      }

      if (this.audioCtx.state === 'suspended') {
        void this.audioCtx.resume()
      }

      const osc = this.audioCtx.createOscillator()
      const gain = this.audioCtx.createGain()

      osc.type = wave
      osc.frequency.value = freq
      gain.gain.value = gainValue
      gain.gain.exponentialRampToValueAtTime(0.0001, this.audioCtx.currentTime + durationSec)

      osc.connect(gain)
      gain.connect(this.audioCtx.destination)
      osc.start()
      osc.stop(this.audioCtx.currentTime + durationSec)
    } catch {
      // Audio not available (e.g. autoplay restrictions); gameplay should continue.
    }
  }

  private colorForEnemyKind(kind: EnemyKind): number {
    if (kind === 'shooter') return 0xffa93c
    if (kind === 'tank') return 0x8f7dff
    if (kind === 'boss') return 0xff2d62
    return 0xff5a7a
  }

  private endGame() {
    this.gameOver = true
    this.levelUpPending = false

    this.spawnTimer?.remove(false)
    this.waveTimer?.remove(false)
    this.physics.world.pause()

    this.totalScrap += this.runScrap
    localStorage.setItem(this.totalScrapKey, String(this.totalScrap))

    this.statusText.setText(
      `SYSTEM FAILURE\nFINAL SCORE: ${this.score}\nRUN SCRAP: ${this.runScrap}\nTOTAL SCRAP: ${this.totalScrap}\nPRESS R TO REBOOT`,
    )
    this.statusText.setStyle({
      backgroundColor: '#21061a',
      padding: { x: 18, y: 14 },
    })
  }

  private drawBackground() {
    const g = this.add.graphics()
    g.fillGradientStyle(0x080914, 0x120525, 0x1a1030, 0x04030a, 1)
    g.fillRect(0, 0, 960, 640)

    for (let i = 0; i < 26; i++) {
      const y = i * 26
      const alpha = 0.07 + (i % 4) * 0.02
      g.lineStyle(1, 0x00d9ff, alpha * 0.65)
      g.lineBetween(0, y, 960, y)
    }

    for (let i = 0; i < 60; i++) {
      const x = Phaser.Math.Between(20, 940)
      const y = Phaser.Math.Between(40, 620)
      const size = Phaser.Math.Between(1, 3)
      g.fillStyle(Phaser.Math.RND.pick([0x00e7ff, 0xff4fcf, 0x72ff5e]), 0.8)
      g.fillRect(x, y, size, size)
    }

    this.add.text(16, 604, 'MOVE [WASD/ARROWS] FIRE [SPACE] SWITCH [1/2/3] RESTART [R] LEVEL-UP PICK [MOUSE/1-3]', {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#9af5ff',
      stroke: '#000000',
      strokeThickness: 3,
    })
  }

  private hudStyle(color: string): Phaser.Types.GameObjects.Text.TextStyle {
    return {
      fontFamily: 'monospace',
      fontSize: '21px',
      color,
      stroke: '#000000',
      strokeThickness: 4,
    }
  }
}

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#05010e',
  width: 960,
  height: 640,
  physics: {
    default: 'arcade',
    arcade: { debug: false },
  },
  scene: [NeonRequiemScene],
}

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div class="shell">
    <header class="topbar">
      <h1>NEON REQUIEM: AFTERGLITCH</h1>
      <p>Survive the blackout grid. Level up, build your loadout, and break every boss wave.</p>
    </header>
    <div id="game" class="game-wrap"></div>
  </div>
`

new Phaser.Game(config)
