# Aetheria

Một game 3D fantasy action RPG nhỏ chạy trực tiếp trên trình duyệt. Phong cách
low-poly / stylized, camera góc nhìn thứ ba. Xây bằng **JavaScript + Vite +
Three.js**, deploy dạng static website (GitHub Pages, itch.io).

> Trạng thái: **STEP 1 — Nền tảng.** Mới có khung kiến trúc, world thử nghiệm,
> player placeholder di chuyển được, camera follow, localization vi/en và debug
> overlay. Chưa có combat, quái, NPC, quest, âm thanh, nhiều map... (xem lộ trình).

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

## Điều khiển (STEP 1)

- Di chuyển: `W A S D` hoặc các phím mũi tên
- Đổi ngôn ngữ UI (vi ⇄ en): `L`

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
    World.js                # scene thử nghiệm: sky, ground, light, placeholder
  player/
    Player.js               # player placeholder (capsule), di chuyển cơ bản
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

Xem [docs/STORY.md](docs/STORY.md). STEP 1 chưa triển khai bất kỳ logic cốt
truyện nào; đây là tài liệu định hướng cho các bước sau.

## Lộ trình (các bước sau)

Chưa làm ở STEP 1: nhân vật GLB, animation, quái + AI, combat/damage/HP, skill,
boss, NPC, dialogue, quest, inventory, nhiều map + chuyển map, save/load, âm
thanh, settings menu.
