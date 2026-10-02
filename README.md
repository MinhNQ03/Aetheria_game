# Aetheria

Một game 3D fantasy action RPG nhỏ chạy trực tiếp trên trình duyệt. Phong cách
low-poly / stylized, camera góc nhìn thứ ba. Xây bằng **JavaScript + Vite +
Three.js**, deploy dạng static website (GitHub Pages, itch.io).

> Trạng thái: **STEP 4 — Enemy + AI + HP/Death.** Có hệ enemy data-driven
> (Enemy = model + AI + health), EnemyManager quản vòng đời (spawn/update/
> remove/dispose), AI state machine idle/patrol/chase/dead với detection +
> lose-target, enemy dùng chung CollisionSystem (không xuyên vật cản/biên),
> HealthComponent (takeDamage/death một lần). Kế thừa world/map + collision
> (STEP 3), player 3D + camera orbit (STEP 2). **Chưa có combat thật** — enemy
> có máu và chết được (phím K dev-damage để test), nhưng player chưa tấn công.
> Chưa có skill, NPC, quest, âm thanh, chuyển map... (xem lộ trình).

## Yêu cầu

- Node.js >= 18
- npm

## Chạy dự án

```bash
npm install      # cài three + vite
npm run dev      # chạy dev server (mặc định http://localhost:5173)
npm run build    # build production ra thư mục dist/
npm run preview  # xem thử bản build
```

## Điều khiển

- Di chuyển (camera-relative): `W A S D` hoặc các phím mũi tên
- Xoay camera (orbit): kéo chuột
- Đổi ngôn ngữ UI (vi ⇄ en): `L`
- (DEV) Gây sát thương quái gần nhất: `K` — chỉ để test HP/death, sẽ bỏ khi có combat

## Kiến trúc thư mục

```
src/
  main.js                  # entry point, chỉ khởi động Game
  game/
    Game.js                # orchestrator: renderer, clock, vòng đời subsystem
    GameLoop.js            # vòng update(dt) -> render() dựa trên rAF
    GameState.js           # state trung tâm (map, player, story, quests, language)
  camera/
    CameraController.js     # camera góc nhìn thứ ba, follow target
  world/
    World.js                # một map đã load: scene, environment, objects, collision
    MapManager.js           # registry map + load/unload/current (async-ready)
    CollisionSystem.js      # va chạm tĩnh (AABB/circle) + world boundary
    maps/
      TestWorld.js          # định nghĩa map dạng dữ liệu (spawn/bounds/objects)
  player/
    Player.js               # facade mỏng: ghép model + movement
    PlayerModel.js          # visual (capsule placeholder; thay GLB sau này)
    MovementController.js   # logic di chuyển camera-relative + state
  enemy/
    Enemy.js                # facade: ghép model + AI + health
    EnemyModel.js           # visual enemy (placeholder; GLB-ready seam)
    EnemyAIController.js    # state machine idle/patrol/chase/dead
    EnemyManager.js         # vòng đời enemy: spawn/update/remove/dispose
  health/
    HealthComponent.js      # máu thuần logic: damage/heal/death (dùng chung)
  input/
    InputManager.js         # map WASD/Arrow -> action logic (isPressed)
  localization/
    Localization.js         # dịch vụ t(key), đổi ngôn ngữ, fallback
    strings.js              # bảng chuỗi vi/en
  ui/
    DebugOverlay.js         # overlay FPS / map / vị trí / ngôn ngữ
  utils/
    AssetLoader.js          # bọc LoadingManager (sẵn sàng cho GLB/audio sau này)
    constants.js            # cấu hình tập trung (camera, movement, ngôn ngữ...)
```

### Nguyên tắc

- ES Modules, mỗi module một trách nhiệm rõ ràng.
- `GameLoop` không biết gì về gameplay; thêm hệ thống mới ở `Game.update()`.
- Không hard-code text UI — mọi chuỗi đi qua `Localization.t()`.
- Cấu hình tập trung ở `constants.js`, tránh magic number rải rác.

## Localization

- Ngôn ngữ mặc định: `vi`. Hỗ trợ `vi` và `en`.
- Lấy chuỗi: `localization.t('debug.player')`.
- Đổi ngôn ngữ runtime: `localization.setLanguage('en')` hoặc `toggleLanguage()`.
- Thêm chuỗi mới: khai báo trong `src/localization/strings.js` theo namespace
  (`menu`, `system`, và sau này `dialogue`, `quest`, `hud`...).

## Deploy

Build ra static site với `base: './'` (đã cấu hình trong `vite.config.js`) nên
chạy được cả trên GitHub Pages (subpath) lẫn itch.io (iframe).

- **GitHub Pages:** `npm run build` rồi publish thư mục `dist/`.
- **itch.io:** `npm run build`, nén thư mục `dist/` thành `.zip`, upload dạng
  HTML và đặt `index.html` làm file khởi chạy.

## Cốt truyện

Xem [docs/STORY.md](docs/STORY.md). Chưa có logic cốt truyện trong game; đây là
tài liệu định hướng cho các bước sau.

## Lộ trình

Đã làm (STEP 1-4): nền tảng engine, player 3D + di chuyển camera-relative,
camera orbit, world/map data-driven + collision + boundary, quái + AI
(idle/patrol/chase/dead) + máu/chết.

Chưa làm (các bước tới): combat thật (player tấn công, hitbox, damage), nhân vật
GLB + animation, skill, boss, NPC, dialogue, quest, inventory, nhiều map +
chuyển map, save/load, âm thanh, settings menu.
