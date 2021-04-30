import { VERSION } from 'meta';
import { getDb } from './pouch';

export const SETTINGS_KEY = 'settings';

export const DEFAULT_SETTINGS = {
  _id: SETTINGS_KEY,
  version: VERSION,
  syncEnabled: false,
  hasSynced: false,
  accountClosed: false,
};
