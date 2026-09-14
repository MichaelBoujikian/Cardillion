// @ts-check
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'coverage/**', 'node_modules/**', 'art/out/**'] },
  js.configs.recommended,

  // TypeScript sources: type-aware rules using the tsconfig project.
  {
    files: ['**/*.ts'],
    extends: [...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // The rules engine and content tables must stay free of rendering and browser concerns.
  {
    files: ['src/engine/**/*.ts', 'src/content/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['three', 'three/*'], message: 'engine/content must not depend on three.js' },
            {
              group: ['@render/*', '@ui/*', '@app/*', '@save/*'],
              message: 'engine/content must not import outer layers',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        'window',
        'document',
        'localStorage',
        'requestAnimationFrame',
      ],
    },
  },

  // Plain JS (config files, tools/): Node globals, no type information.
  {
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: { globals: globals.node },
  },

  prettier,
);
