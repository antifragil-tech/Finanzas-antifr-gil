import js from '@eslint/js';
import ts from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default ts.config(
  js.configs.recommended,
  ...ts.configs.recommended,
  {
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      // void fetchAsync() inside useEffect is valid — react-hooks/v7 flags it as false positive
      'react-hooks/set-state-in-effect': 'off',
      // useMemo with array push is valid — rule is overly strict for migration code
      'react-hooks/preserve-manual-memoization': 'off',
    },
  },
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/.next/**',
      '**/build/**',
      '**/next-env.d.ts',
    ],
  },
);
