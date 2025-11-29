module.exports = {
	parser: '@typescript-eslint/parser',
	plugins: ['import', '@typescript-eslint', 'simple-import-sort', 'react-hooks'],
	extends: [],
	ignorePatterns: ['dist/**', 'node_modules/**', 'build/**', 'cache/**', '*.config.js'],
	rules: {
		'import/no-duplicates': 'error',
		'simple-import-sort/imports': 'error',
		'simple-import-sort/exports': 'error',
	},
	overrides: [
		{
			files: ['*.js', '*.jsx', '*.ts', '*.tsx'],
			rules: {
				'simple-import-sort/imports': [
					'error',
					{
						groups: [
							['^react', '^@?\\w'],
							[
								'^arweave',
								'^@permaweb/aoconnect',
								'^@permaweb/aoprofile',
								'^@permaweb/stampjs',
								'^@permaweb/ucm',
								'^@?\\w',
							],
							['^(@|api)(/.*|$)', '^(@|gql)(/.*|$)'],
							[
								'^(@|app)(/.*|$)',
								'^(@|assets)(/.*|$)',
								'^(@|clients)(/.*|$)',
								'^(@|components)(/.*|$)',
								'^(@|filters)(/.*|$)',
								'^(@|global)(/.*|$)',
								'^(@|helpers)(/.*|$)',
								'^(@|hooks)(/.*|$)',
								'^(@|navigation)(/.*|$)',
								'^(@|providers)(/.*|$)',
								'^(@|root)(/.*|$)',
								'^(@|routes)(/.*|$)',
								'^(@|search)(/.*|$)',
								'^(@|store)(/.*|$)',
								'^(@|views)(/.*|$)',
								'^(@|wallet)(/.*|$)',
								'^(@|workers)(/.*|$)',
								'^(@|wrappers)(/.*|$)',
							],
							['^\\u0000'],
							['^\\.\\.(?!/?$)', '^\\.\\./?$'],
							['^\\./(?=.*/)(?!/?$)', '^\\.(?!/?$)', '^\\./?$'],
						],
					},
				],
				'react-hooks/exhaustive-deps': 'off',
			},
		},
	],
};
