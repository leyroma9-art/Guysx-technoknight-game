# Библиотека модов — Убегай от ТехноКнайта

Каталог `.js` модов для игры. Игра качает `catalog.json` и файлы модов по HTTPS (jsDelivr / raw GitHub).

## Структура

```text
catalog.json              ← список всех модов
mods/
  banner-hello/mod.js
  double-ammo/mod.js
  speed-boost/mod.js
```

## Как добавить свой мод

1. Создай папку `mods/my-mod-id/`
2. Положи туда `mod.js` (см. API ниже)
3. Добавь запись в `catalog.json`:

```json
{
  "id": "my-mod-id",
  "name": "Название",
  "author": "ты",
  "desc": "Кратко что делает",
  "version": "1.0.0",
  "tags": ["demo"],
  "file": "mods/my-mod-id/mod.js"
}
```

4. `git add` → `commit` → `push` в `main`
5. В игре нажми «Обновить» в библиотеке (кэш jsDelivr сбрасывается через несколько минут; можно указать `@main` или коммит)

## URL после публикации на GitHub

Замени `USER` и `REPO` на свои:

```text
Каталог:
https://cdn.jsdelivr.net/gh/USER/REPO@main/catalog.json

Файл мода:
https://cdn.jsdelivr.net/gh/USER/REPO@main/mods/double-ammo/mod.js
```

Эти URL вписываются в `index.html` игры (константы `MOD_LIBRARY_URL` и `MOD_LIBRARY_BASE`).

## API мода (как в игре)

**Хуки (объяви функциями в файле):**

- `onStart`
- `onUpdate(dt)`
- `onDraw`
- `onShoot`
- `onDie(reason)`
- `onBossStart`
- `onBossWin`
- `onEnemyHit(e)`
- `onEnemyKill(e)`
- `onDamage(amount, source)`
- `onNet(msg)`

**Объекты:** `player`, `enemies`, `boss`, `bullets`, `particles`, `guns`, `cam`, `ctx`, `world`, `time`, `running`, `bossMode`, `keys`, `mouse`, `settings`, `mods`, `bossMods`, `game`

**Функции:** `spawnP`, `die`, `startBoss`, `makeEnemy`, `spawnGun`, `loadSprite`, `drawSprite`, `addEnemy`, `heal`, `damageBoss`, `setPlayerSpeed`, `log`

**Мультиплеер:** `game.isHost`, `game.online`, `game.banner(text)`, `game.broadcast(obj)`, `game.shared` + `game.syncShared()`, `game.syncSolids()`

Моды **стакаются**: можно включить несколько сразу.

## Важно

- В библиотеку клади только **свой** проверенный код — он выполняется в браузере игрока.
- В комнате мультиплеера хост с галочкой «Синхр. JS-код» отдаёт установленные моды всем клиентам.
