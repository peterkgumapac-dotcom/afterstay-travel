module.exports = {
  extends: 'expo',
  ignorePatterns: ['/dist/*', '/node_modules/*', '/ios/*', '/android/*', '/supabase/functions/*', '/scripts/*'],
  rules: {
    'react-hooks/exhaustive-deps': 'warn',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
  },
};
