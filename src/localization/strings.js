/**
 * Localized string tables.
 *
 * Keys are namespaced with dots (e.g. "menu.start") and resolved by
 * Localization.t(). Add new namespaces here as later steps introduce
 * menus, HUD, dialogue, quests, settings, etc.
 *
 * Only keep keys that are actually used. STEP 1 ships a minimal set plus a
 * few forward-looking namespaces to prove the structure scales.
 */
export const STRINGS = {
  vi: {
    game: {
      title: 'Aetheria',
    },
    debug: {
      fps: 'FPS',
      map: 'Bản đồ',
      player: 'Nhân vật',
      language: 'Ngôn ngữ',
      state: 'Trạng thái',
      speed: 'Tốc độ',
      camera: 'Máy quay',
      stateIdle: 'Đứng yên',
      stateMoving: 'Di chuyển',
      assets: 'Tài nguyên',
      colliders: 'Vật cản',
    },
    language: {
      vi: 'Tiếng Việt',
      en: 'Tiếng Anh',
    },
    // Forward-looking namespaces (not rendered yet in STEP 1).
    menu: {
      start: 'Bắt đầu',
      continue: 'Tiếp tục',
      settings: 'Cài đặt',
      quit: 'Thoát',
    },
    system: {
      loading: 'Đang tải...',
    },
  },
  en: {
    game: {
      title: 'Aetheria',
    },
    debug: {
      fps: 'FPS',
      map: 'Map',
      player: 'Player',
      language: 'Language',
      state: 'State',
      speed: 'Speed',
      camera: 'Camera',
      stateIdle: 'Idle',
      stateMoving: 'Moving',
      assets: 'Assets',
      colliders: 'Colliders',
    },
    language: {
      vi: 'Vietnamese',
      en: 'English',
    },
    menu: {
      start: 'Start',
      continue: 'Continue',
      settings: 'Settings',
      quit: 'Quit',
    },
    system: {
      loading: 'Loading...',
    },
  },
};
