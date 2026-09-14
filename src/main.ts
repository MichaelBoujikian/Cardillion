/**
 * Entry point. During milestone M1 this boots the throwaway look prototype; from M2 on it
 * boots the real app router (`src/app`).
 */
import { mountLook } from './prototype/look';

const root = document.getElementById('app');
if (!root) throw new Error('#app root missing');

void mountLook(root);
