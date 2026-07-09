# v2.1.163 — english_choice_fallback_audit

- Fixed EN fallback labels that could show generic `CHOICE` instead of the real upgrade/module name.
- Added explicit EN labels for mixed RU-source upgrade names in WPN/ABL/RAR/INSTALL cards:
  - projectile upgrades;
  - SHG/SEK/RKT branches;
  - RLT/CRD branches;
  - Process Controller CMD/QRN/SAW upgrades;
  - rare/core-threat prizes.
- Added explicit EN descriptions for rewards that previously fell back to a generic text.
- Prevented array-valued internal `upgrade` metadata from overriding the real option id in tooltip description lookup.
- Localized rare chest tag/header fragments in the shared ABL/RAR modal.
- Localized casino reel display symbols in EN: `JCK`, `RAR`, `LOCK` instead of RU-only symbols.
- Kept RU text in terminal-casino style: no chat slang such as “жирный/толстый”; descriptions use “запас прочности / прочные цели”.

Checks:
- `node --check` all JS.
- ESM imports.
- EN label/description audit over upgrade/chest/protocol data: no Cyrillic, no `CHOICE`, no generic fallback.
- Browser-stub import of `main`.
- `/health` version v2.1.163.
