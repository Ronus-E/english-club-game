/**
 * Exhibition demo preset: one click, no setup, no network.
 * Pure data so the stand configuration can be unit-tested.
 */
import { DEFAULT_SETTINGS } from './storage.js';

export const DEMO_LEVEL = 'A1';
export const DEMO_NAME = 'Guest';

/** Readable at a distance, animated, French off, no input device required. */
export function demoPreset() {
  return {
    name: DEMO_NAME,
    avatar: 0,
    level: DEMO_LEVEL,
    settings: {
      ...DEFAULT_SETTINGS,
      musicOn: true,
      highContrast: true,
      reduceMotion: false,
      reducedGraphics: false,
      frenchHints: false,
      forceTouch: false,
    },
  };
}
