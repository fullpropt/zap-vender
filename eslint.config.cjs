const globals = require('globals');

module.exports = [
    {
        ignores: [
            'node_modules/**',
            'dist/**',
            'coverage/**',
            'uploads/**',
            'sessions/**',
            'public/**',
            'landing-bruno/**'
        ]
    },
    {
        files: ['server/**/*.js', 'scripts/**/*.js', 'tests/**/*.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'commonjs',
            globals: {
                ...globals.node,
                ...globals.es2022
            }
        },
        linterOptions: {
            reportUnusedDisableDirectives: 'warn'
        },
        rules: {
            'no-undef': 'error',
            'no-unreachable': 'error',
            'no-unsafe-finally': 'error',
            'no-empty': ['warn', { allowEmptyCatch: true }],
            'no-unused-vars': ['warn', {
                argsIgnorePattern: '^_',
                varsIgnorePattern: '^_',
                caughtErrorsIgnorePattern: '^(_|error|err|e)$'
            }]
        }
    }
];
