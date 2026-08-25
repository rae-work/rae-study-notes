import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const P = {
  content:  path.join(ROOT, 'content'),
  lessons:  path.join(ROOT, 'content/lessons'),
  i18n:     path.join(ROOT, 'content/i18n'),
  src:      path.join(ROOT, 'src'),
  audio:    path.join(ROOT, 'audio'),
  dist:     path.join(ROOT, 'dist'),
  legacy:   path.join(ROOT, 'legacy'),
  android:  path.join(ROOT, 'android-app'),
};
