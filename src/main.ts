/**
 * Entry point: boots the battle app (milestone M2 — one fight at a time).
 */
import { boot } from './app';

const root = document.getElementById('app');
if (!root) throw new Error('#app root missing');

void boot(root);
