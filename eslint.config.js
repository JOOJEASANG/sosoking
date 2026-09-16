import js from '@eslint/js';
import globals from 'globals';
import prettier from 'eslint-config-prettier';

// Rules tuned to catch real bugs (undefined refs, duplicate keys, unreachable
// code, accidental fallthrough) while staying quiet about pure style, which is
// Prettier's job. Low-signal correctness rules are downgraded to "warn" so a
// pre-existing warning never blocks CI, but genuine mistakes stay errors.
const sharedRules = {
  // Errors from js.configs.recommended stay errors (no-undef, no-dupe-keys,
  // no-unreachable, no-fallthrough, valid-typeof, ...): those are real bugs.
  // The rules below are downgraded to warnings so pre-existing, intentional
  // patterns don't block CI, while still surfacing for gradual cleanup.
  'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
  'no-empty': ['warn', { allowEmptyCatch: true }],
  'no-constant-condition': ['error', { checkLoops: false }],
  eqeqeq: ['warn', 'smart'],
  'no-var': 'warn',
  'prefer-const': ['warn', { destructuring: 'all' }],
  // Deliberate existing patterns: outer-catch error capture in the auth flow,
  // explicit emoji-codepoint stripping, and exact-match regexes in tooling.
  'no-ex-assign': 'warn',
  'no-misleading-character-class': 'warn',
  'no-regex-spaces': 'warn',
  'no-useless-escape': 'warn',
  // Control characters appear on purpose in the server-side input
  // sanitizers (stripping \x00-\x1f from user text), so this rule is off.
  'no-control-regex': 'off',
  // Still catch stray irregular whitespace in code, but allow it inside the
  // sanitizer regexes/strings that deliberately match those characters.
  'no-irregular-whitespace': [
    'error',
    { skipStrings: true, skipTemplates: true, skipComments: true, skipRegExps: true }
  ]
};

export default [
  {
    ignores: [
      'node_modules/**',
      'functions/node_modules/**',
      'package-lock.json',
      'functions/package-lock.json',
      'assets/**',
      'public/data/**',
      '**/*.min.js'
    ]
  },
  js.configs.recommended,

  // Browser front-end (user pages and admin panel): ES modules loaded
  // directly by the browser.
  {
    files: ['public/**/*.js'],
    ignores: ['public/sw.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.browser }
    },
    rules: sharedRules
  },

  // Service worker has its own global scope.
  {
    files: ['public/sw.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.serviceworker, ...globals.browser }
    },
    rules: sharedRules
  },

  // Cloud Functions and their check/CLI scripts: CommonJS on Node.
  {
    files: ['functions/**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'commonjs',
      globals: { ...globals.node }
    },
    rules: sharedRules
  },

  // Repository tooling: ES modules on Node.
  {
    files: ['tools/**/*.mjs', 'eslint.config.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.node }
    },
    rules: sharedRules
  },

  prettier
];
