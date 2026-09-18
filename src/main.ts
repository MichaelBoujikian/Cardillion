/**
 * Entry point: boots the app (title → run → result, src/app).
 */
import { boot } from './app';

const root = document.getElementById('app');
if (!root) throw new Error('#app root missing');

void boot(root);
