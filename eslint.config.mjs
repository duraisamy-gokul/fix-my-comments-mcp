import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import ts from 'typescript-eslint';
import unusedImports from 'eslint-plugin-unused-imports';

export default ts.config(
  {
    ignores: [
      'dist/**',
      'out/**',
      'node_modules/**',
      '.vscode-test/**',
      'coverage/**',
      'esbuild.js',
    ],
  },
  js.configs.recommended,
  ...ts.configs.recommended,
  prettier,
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'unused-imports': unusedImports,
    },
    rules: {
      'no-undef': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          varsIgnorePattern: '^_',
          args: 'after-used',
          argsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
      curly: ['error', 'all'],
      '@typescript-eslint/consistent-type-assertions': [
        'error',
        {
          assertionStyle: 'never',
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'TSTypePredicate',
          message:
            'Type predicates (value is Type) are not allowed. Use type guards with explicit type checking instead.',
        },
        {
          selector: 'Identifier[name="undefined"]',
          message: 'undefined is not allowed. Use null or proper type checking instead.',
        },
      ],
    },
  },
  {
    files: ['src/generated/**/*.ts'],
    rules: {
      'no-restricted-syntax': 'off',
      '@typescript-eslint/consistent-type-assertions': 'off',
      '@typescript-eslint/consistent-type-definitions': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      'unused-imports/no-unused-vars': 'off',
      'unused-imports/no-unused-imports': 'off',
    },
  },
);
