import js from '@eslint/js';
import ts from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';

export default ts.config(
  { ignores: ['extras/**', '**/dist/**', '**/.svelte-kit/**', '**/.wrangler/**', 'coverage/**', '.local/**', 'node_modules/**', '**/build/**', '**/dist-ssr/**', '**/imageway-env.d.ts'] },
  js.configs.recommended,
  ...ts.configs.recommended,
  ...svelte.configs['flat/recommended'],
  { languageOptions: { globals: { ...globals.node, ...globals.browser } }, rules: { '@typescript-eslint/no-explicit-any': 'error' } },
  { files: ['**/*.svelte'], languageOptions: { parserOptions: { parser: ts.parser } } },
);
