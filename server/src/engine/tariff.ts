import { ammanParts } from '../clock/amman.js';
import { DAY, NIGHT } from './constants.js';
import type { Us } from './types.js';

/** Tariff by the first pickup's Amman hour: night before 06:00 (SPEC §4.1). */
export const tariff = (T0: Us) => (ammanParts(T0).hour < 6 ? NIGHT : DAY);
