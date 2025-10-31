const { configs } = require('@eslint/js');
const globals = require('globals');

module.exports = [
  {
    files: ['**/*.js'],
    languageOptions: {
      ...configs.recommended.languageOptions,
      sourceType: 'commonjs',
      ecmaVersion: 2022,
      globals: {
        ...globals.node
      }
    },
    rules: {
      ...configs.recommended.rules,
      'space-before-function-paren': 'off',
      'comma-dangle': ['error', 'never']
    }
  }
];
