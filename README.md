# Neon Requiem: Afterglitch

A cyberpunk arcade survival shooter built with **Phaser 3 + TypeScript + Vite**.

## Gameplay

You are a rogue runner trapped in a corrupted city grid.

- Move with **WASD** or **Arrow keys**
- Shoot with **Space**
- Switch weapons with **1 / 2 / 3**
- Survive escalating enemy waves and boss encounters every 5 waves
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
- Boss has high HP, unique multi-shot attack pressure, and visible HP bar
- Boss wave includes clear banner messaging
- Boss kill grants big score + scrap reward and guaranteed strong upgrade reward

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
