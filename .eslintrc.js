module.exports = {
  extends: 'expo',
  ignorePatterns: ['/dist/*', '/node_modules/*', '/ios/*', '/android/*'],
  rules: {
    'react-hooks/exhaustive-deps': 'warn',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
  },
};
