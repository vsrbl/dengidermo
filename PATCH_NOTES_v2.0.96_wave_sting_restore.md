# v2.0.100 — wave sting restore

Small audio rollback/polish after v2.0.95:

- Restored the single director wave / enemy combo arrival sting.
- The sting is intentionally one-shot and cooldown-limited, so a new pack is audible without reintroducing repeated enemy/damper/bullet audio spam.
- Kept the v2.0.95 anti-spam removals for bullet damp/stop and enemy echo shot sounds.

Checks:

```bash
node --check server/index.js
node --check shared/*.js
node --check src/*.js
node -e "import('./shared/sim.v2-0-100.js').then(()=>console.log('sim import ok'))"
node -e "import('./src/audio.v2-0-100.js').then(()=>console.log('audio import ok'))"
zip -T nncckkrr_v2.0.100_wave_sting_restore.zip
```
