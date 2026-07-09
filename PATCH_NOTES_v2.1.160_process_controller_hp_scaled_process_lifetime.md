# v2.1.160 — Process Controller HP-scaled process lifetime

## Process Controller
- Захваченный процесс теперь получает индивидуальный срок контроля на основе его `maxHp` до захвата.
- Чем жирнее/элитнее моб, тем дольше он живёт после захвата.
- Кривая срока контроля суб-линейная: высокий HP даёт заметный бонус, но не превращает процесс в вечного спутника.
- `CTRL: СРОК +` теперь усиливает базу срока, поверх которой применяется HP-скейлинг.
- Уже перенесённые через портал процессы сохраняют свой индивидуальный `ttl/maxT`.

## Balance examples
- RUN / 16 HP живёт заметно меньше среднего.
- SHT / 30 HP остаётся около базового срока.
- TNK / 120 HP живёт примерно вдвое дольше базового.

## Checks
- JS syntax check.
- ESM imports.
- Capture smoke: runner and tank captured by CMD; tank receives a longer `maxT` than runner.
- HTML version sync.
