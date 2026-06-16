# nncckkrr.space v2.0.44_active_ability_expansion_ui

Source: v2.0.28_active_duration_aura_rework
Date: 2026-06-16

## Goal

Expand the ABL/Q system beyond the existing four cores and make the Ability chest window readable as a designed UI instead of a long text list.

## New Q cores

### VOID CUT

- Phase dash toward aim.
- Cuts enemies along the line.
- Erases enemy bullets near the line.
- Applies short invulnerability.
- Leaves a short dirty void tear field.

### SIGNAL SPIKE

- Deploys a square antenna/spike at aim point.
- Pulses damage over time.
- Slows enemies and dampens bullets in its area.
- Works as a map-control active rather than a self-aura.

### BLACK BOX

- Follow aura around the player.
- Strongly decays enemy bullets.
- Slows enemies and delays enemy fire cadence inside the box.
- Designed as a survival/control panic tool.

### DEBT PULSE

- Large red risk burst.
- Damages and knocks enemies outward.
- Applies EXPOSED.
- Has a chance to trigger STATIC DEBT, reduced a bit by luck and CASINO mutation.
- Can produce a small GLD kickback when it hits enough enemies without debt.

## New Q mutations

### CHAIN

- Adds a jump-damage signal after casts.
- Hits several nearby enemies with extra damage and a short slow.

### ANCHOR

- Leaves a heavy square anchor field.
- Pulls enemies inward, slows them, and dampens bullets.

### HUNGER

- Adds a scaling bite.
- More enemies hit by the cast means a stronger follow-up burst.

### BAD TAPE

- Records the cast onto broken tape.
- Fires two delayed weaker glitch repeats.

## New unstable signal weaves

No clean `COMBO FOUND` messaging was added. The new interactions appear as dirty signal labels:

- `WIRE STORM` — CHAIN + SHRAPNEL.
- `DEAD ZONE` — ANCHOR + STATIC.
- `RED HUNGER` — HUNGER + BLOOD.
- `FALSE REEL` — BAD TAPE + CASINO.
- `BOX CHAIN` — BLACK BOX + CHAIN.

## Ability chest UI

- ABL choices now render as structured cards.
- Each card has a header, action line, type tag, role tag, and two centered sections:
  - `ДЕЙСТВИЕ`
  - `СИГНАЛ`
- The panel is wider and centered.
- Text is split into readable blocks instead of one long paragraph.
- Mobile/narrow layout collapses card sections vertically.

## Versioning

- Version bumped to v2.0.44.
- Versioned module filenames changed from v2-0-28 to v2-0-44.
- Imports, index.html, package.json, protocol, and server version updated.
