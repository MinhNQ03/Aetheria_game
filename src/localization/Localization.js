import { DEFAULT_LANGUAGE, LANGUAGES } from '../utils/constants.js';
import { STRINGS } from './strings.js';

/**
 * Localization service.
 *
 * Usage:
 *   const loc = new Localization();        // defaults to vi
 *   loc.t('menu.start');                    // -> "Bắt đầu"
 *   loc.setLanguage('en');
 *   loc.t('menu.start');                    // -> "Start"
 *
 * Never hard-code UI text; always resolve through t().
 */
export class Localization {
  /**
   * @param {string} [language] Initial language code (defaults to DEFAULT_LANGUAGE).
   * @param {object} [tables] String tables, keyed by language. Defaults to STRINGS.
   */
  constructor(language = DEFAULT_LANGUAGE, tables = STRINGS) {
    this._tables = tables;
    this._language = this._isSupported(language) ? language : DEFAULT_LANGUAGE;
    /** @type {Set<(language: string) => void>} */
    this._listeners = new Set();
  }

  /** @returns {string} the active language code. */
  get language() {
    return this._language;
  }

  /** @returns {string[]} supported language codes. */
  get availableLanguages() {
    return Object.values(LANGUAGES);
  }

  _isSupported(language) {
    return Object.prototype.hasOwnProperty.call(this._tables, language);
  }

  /**
   * Change the active language and notify listeners.
   * @param {string} language
   * @returns {boolean} true if the language changed.
   */
  setLanguage(language) {
    if (!this._isSupported(language) || language === this._language) {
      return false;
    }
    this._language = language;
    for (const listener of this._listeners) {
      listener(this._language);
    }
    return true;
  }

  /** Toggle between the two primary languages (vi <-> en). */
  toggleLanguage() {
    const next =
      this._language === LANGUAGES.VI ? LANGUAGES.EN : LANGUAGES.VI;
    this.setLanguage(next);
    return this._language;
  }

  /**
   * Subscribe to language changes.
   * @param {(language: string) => void} listener
   * @returns {() => void} unsubscribe function.
   */
  onChange(listener) {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  /**
   * Resolve a dotted key for the active language.
   * Falls back to the default language, then returns the key itself if missing.
   *
   * @param {string} key e.g. "debug.player"
   * @param {Record<string, string|number>} [params] optional {name} interpolation.
   * @returns {string}
   */
  t(key, params) {
    let value = this._resolve(this._language, key);
    if (value == null && this._language !== DEFAULT_LANGUAGE) {
      value = this._resolve(DEFAULT_LANGUAGE, key);
    }
    if (value == null) {
      // Visible, non-crashing signal that a key is missing.
      return key;
    }
    return params ? this._interpolate(value, params) : value;
  }

  _resolve(language, key) {
    const table = this._tables[language];
    if (!table) return null;
    let node = table;
    for (const part of key.split('.')) {
      if (node == null || typeof node !== 'object' || !(part in node)) {
        return null;
      }
      node = node[part];
    }
    return typeof node === 'string' ? node : null;
  }

  _interpolate(template, params) {
    return template.replace(/\{(\w+)\}/g, (match, name) =>
      Object.prototype.hasOwnProperty.call(params, name)
        ? String(params[name])
        : match
    );
  }
}
