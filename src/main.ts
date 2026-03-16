import './style.css'
import Phaser from 'phaser'

class NeonRequiemScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private wasd!: { [key: string]: Phaser.Input.Keyboard.Key }
  private bullets!: Phaser.Physics.Arcade.Group
  private enemies!: Phaser.Physics.Arcade.Group
  private score = 0
  private health = 100
  private scoreText!: Phaser.GameObjects.Text
  private healthText!: Phaser.GameObjects.Text
  private statusText!: Phaser.GameObjects.Text
  private weaponText!: Phaser.GameObjects.Text
  private gameOver = false
  private fireCooldown = 0
  private enemyTimer?: Phaser.Time.TimerEvent
  private weapon: 'peashooter' | 'multishot' | 'laser' = 'peashooter'

  constructor() {
    super('NeonRequiemScene')
  }

  create() {
    this.drawBackground()

    this.player = this.physics.add.sprite(480, 320, '').setTint(0x00f5ff)
    this.player.setDisplaySize(28, 28)
    this.player.setCollideWorldBounds(true)
    this.player.setDamping(true).setDrag(0.98).setMaxVelocity(260)

    this.cursors = this.input.keyboard!.createCursorKeys()
    this.wasd = this.input.keyboard!.addKeys('W,A,S,D') as { [key: string]: Phaser.Input.Keyboard.Key }

    this.bullets = this.physics.add.group({
      classType: Phaser.Physics.Arcade.Image,
      maxSize: 50,
      runChildUpdate: false,
    })

    this.enemies = this.physics.add.group()

    this.scoreText = this.add.text(16, 14, 'SCORE: 0', this.hudStyle('#67f6ff'))
    this.healthText = this.add.text(16, 44, 'HP: 100', this.hudStyle('#ff4fcf'))
    this.statusText = this.add
      .text(480, 320, '', {
        fontFamily: 'monospace',
        fontSize: '28px',
        color: '#f8f8f8',
        align: 'center',
      })
      .setOrigin(0.5)

    this.weaponText = this.add.text(16, 74, 'WEAPON: PEASHOOTER [1]', this.hudStyle('#72ff5e'))

    this.physics.add.overlap(
      this.bullets,
      this.enemies,
      (bulletObj, enemyObj) => {
        const bullet = bulletObj as Phaser.Physics.Arcade.Image
        const enemy = enemyObj as Phaser.Physics.Arcade.Sprite
        bullet.disableBody(true, true)
        enemy.destroy()
        this.score += 10
        this.scoreText.setText(`SCORE: ${this.score}`)
      },
      undefined,
      this,
    )

    this.physics.add.overlap(
      this.player,
      this.enemies,
      (_playerObj, enemyObj) => {
        const enemy = enemyObj as Phaser.Physics.Arcade.Sprite
        enemy.destroy()
        this.health = Math.max(0, this.health - 10)
        this.healthText.setText(`HP: ${this.health}`)
        this.cameras.main.shake(80, 0.004)
        if (this.health <= 0) this.endGame()
      },
      undefined,
      this,
    )

    this.enemyTimer = this.time.addEvent({
      delay: 1200,
      callback: this.spawnWave,
      callbackScope: this,
      loop: true,
    })

    this.input.keyboard!.on('keydown-SPACE', () => {
      if (!this.gameOver) this.shoot()
    })

    this.input.keyboard!.on('keydown-R', () => {
      if (this.gameOver) this.scene.restart()
    })

    this.input.keyboard!.on('keydown-ONE', () => this.setWeapon('peashooter'))
    this.input.keyboard!.on('keydown-TWO', () => this.setWeapon('multishot'))
    this.input.keyboard!.on('keydown-THREE', () => this.setWeapon('laser'))
  }

  update(_time: number, delta: number) {
    if (this.gameOver) {
      this.player.setVelocity(0, 0)
      return
    }

    const speed = 220
    let vx = 0
    let vy = 0

    if (this.cursors.left.isDown || this.wasd.A.isDown) vx = -speed
    if (this.cursors.right.isDown || this.wasd.D.isDown) vx = speed
    if (this.cursors.up.isDown || this.wasd.W.isDown) vy = -speed
    if (this.cursors.down.isDown || this.wasd.S.isDown) vy = speed

    this.player.setVelocity(vx, vy)

    this.fireCooldown = Math.max(0, this.fireCooldown - delta)

    // Continuously home enemies so they don't stall or drift off-course
    const enemySpeed = 80 + Math.min(100, this.score / 5)
    this.enemies.children.iterate((child) => {
      const enemy = child as Phaser.Physics.Arcade.Sprite | null
      if (!enemy || !enemy.active) return null
      this.physics.moveToObject(enemy, this.player, enemySpeed)
      return null
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

    this.add.text(16, 600, 'MOVE [WASD/ARROWS] FIRE [SPACE] WEAPONS [1/2/3] RESTART [R]', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#9af5ff',
      stroke: '#000000',
      strokeThickness: 3,
    })
  }

  private shoot() {
    if (this.fireCooldown > 0) return

    if (this.weapon === 'laser') {
      this.fireLaser()
      this.fireCooldown = 320
      return
    }

    if (this.weapon === 'multishot') {
      this.spawnBullet(this.player.x, this.player.y - 18, -90, 0x72ff5e, 5, 14, 500)
      this.spawnBullet(this.player.x - 8, this.player.y - 16, -105, 0x33d6ff, 4, 12, 480)
      this.spawnBullet(this.player.x + 8, this.player.y - 16, -75, 0x33d6ff, 4, 12, 480)
      this.fireCooldown = 220
      return
    }

    this.spawnBullet(this.player.x, this.player.y - 18, -90, 0x72ff5e, 5, 14, 460)
    this.fireCooldown = 140
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

    this.time.delayedCall(1800, () => bullet.disableBody(true, true))
  }

  private fireLaser() {
    const laser = this.add.rectangle(this.player.x, this.player.y - 200, 10, 420, 0x00f5ff, 0.8)
    laser.setBlendMode(Phaser.BlendModes.ADD)
    this.time.delayedCall(90, () => laser.destroy())

    this.enemies.children.iterate((child) => {
      const enemy = child as Phaser.Physics.Arcade.Sprite | null
      if (!enemy || !enemy.active) return null
      if (Math.abs(enemy.x - this.player.x) < 26 && enemy.y < this.player.y) {
        enemy.destroy()
        this.score += 10
      }
      return null
    })
    this.scoreText.setText(`SCORE: ${this.score}`)
  }

  private setWeapon(next: 'peashooter' | 'multishot' | 'laser') {
    this.weapon = next
    let label = 'PEASHOOTER [1]'
    if (next === 'multishot') label = 'MULTI-SHOT [2]'
    if (next === 'laser') label = 'ION LASER [3]'
    this.weaponText.setText(`WEAPON: ${label}`)
  }

  private spawnWave() {
    const waveSize = 2 + Math.floor(this.score / 80)

    for (let i = 0; i < waveSize; i++) {
      // Spawn above the arena so enemies visibly "come down"
      const x = Phaser.Math.Between(24, 936)
      const y = Phaser.Math.Between(-140, -24)

      const enemy = this.physics.add.sprite(x, y, '')
      enemy.setDisplaySize(30, 30)
      enemy.setTint(0xff5a7a)
      enemy.setAlpha(1)
      enemy.setBlendMode(Phaser.BlendModes.SCREEN)
      enemy.setBounce(0)

      this.physics.moveToObject(enemy, this.player, 80 + Math.min(80, this.score / 6))
      this.enemies.add(enemy)
    }
  }

  private endGame() {
    this.gameOver = true
    this.enemyTimer?.remove(false)
    this.statusText.setText(`SYSTEM FAILURE\nFINAL SCORE: ${this.score}\nPRESS R TO REBOOT`)
    this.statusText.setStyle({
      backgroundColor: '#21061a',
      padding: { x: 18, y: 14 },
    })
  }

  private hudStyle(color: string): Phaser.Types.GameObjects.Text.TextStyle {
    return {
      fontFamily: 'monospace',
      fontSize: '22px',
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
    arcade: {
      debug: false,
    },
  },
  scene: [NeonRequiemScene],
}

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div class="shell">
    <header class="topbar">
      <h1>NEON REQUIEM: AFTERGLITCH</h1>
      <p>Survive endless corp drones in the blackout grid.</p>
    </header>
    <div id="game" class="game-wrap"></div>
  </div>
`

new Phaser.Game(config)
