# Neon Requiem: Afterglitch

A cyberpunk arcade survival shooter built with **Phaser 3 + TypeScript + Vite**.

## Gameplay

You are a rogue runner trapped in a corrupted city grid.

- Move with **WASD** or **Arrow keys**
- Shoot with **Space**
- Switch weapons with **1 / 2 / 3**
- Survive escalating enemy waves and named boss encounters every 5 waves
- Gain **XP** from kills and level up during a run
- On level-up, action pauses and you pick 1 of 3 upgrades
- Earn run-based **Scrap** and bank total scrap across runs
- On death, press **R** to restart

## Phase 1 Fun Patch Systems

### Progression loop

- Mid-run XP + level-ups tuned to pop roughly every 20–40 seconds based on performance
- Upgrade drafts (3 choices) from a shared pool:
  - Fire rate boost
  - Projectile/multishot boost
  - Movement speed
  - Weapon damage
  - Max HP + heal
  - Laser charge utility
- Upgrades apply instantly and affect all compatible weapons

### Enemy variety + arcade patterns

- **Rusher** enemies: fast melee pursuers
- **Shooter** enemies: maintain lane pressure and fire projectiles
- **Tank** enemies: high-HP bruisers with heavier contact damage
- Movement pattern set includes:
  - Sine-wave horizontal drift while descending
  - Zig-zag lane hopping
  - Formation sweep into dive behavior

### Boss cadence

- Distinct boss spawns every 5th wave
- Rotating named bosses with unique mechanics:
  - **Vanta Warden**: radial nova artillery spread
  - **Shard Seraph**: lane-phase teleports + fast tri-burst shots
  - **Null Hydra**: charge movement + periodic drone summons
- Boss health bar now includes boss name + health percentage
- Boss wave includes a clear intro banner cue
- Boss kill grants big score + scrap reward and guaranteed strong upgrade reward

### Fullscreen + responsive layout

- Game now fills the full browser viewport (`100vw x 100vh`) with no shell letterboxing
- Phaser runs in `RESIZE` scale mode and updates camera/physics bounds on resize events
- HUD elements are anchored and scaled for common desktop resolutions to stay readable
- Gameplay systems (collisions, projectiles, laser height, spawn bounds) adapt to current viewport size

### Juice pass

- Enemy hit flash feedback
- Death particle bursts
- Subtle screen shake on impacts/explosions
- Lightweight weapon/enemy SFX differentiation using WebAudio tones

### HUD + meta-lite

- HUD now shows:
  - Score
  - HP
  - Level
  - Wave
  - Weapon
  - Run scrap + total scrap
  - XP progress bar
- Total scrap persists with `localStorage`

## Tech Stack

- [Phaser 3](https://phaser.io/)
- [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vite.dev/)

## Setup

```bash
npm install
```

## Run in development

```bash
npm run dev
```

## Build for production

```bash
npm run build
```

## Preview production build

```bash
npm run preview
```
