const color = name => ({50:`rgb(var(--${name}-50) / <alpha-value>)`,100:`rgb(var(--${name}-100) / <alpha-value>)`,200:`rgb(var(--${name}-200) / <alpha-value>)`,300:`rgb(var(--${name}-300) / <alpha-value>)`,400:`rgb(var(--${name}-400) / <alpha-value>)`,500:`rgb(var(--${name}-500) / <alpha-value>)`,600:`rgb(var(--${name}-600) / <alpha-value>)`,700:`rgb(var(--${name}-700) / <alpha-value>)`,800:`rgb(var(--${name}-800) / <alpha-value>)`,900:`rgb(var(--${name}-900) / <alpha-value>)`})
module.exports = {
 content: ['./components/new-landing/**/*.{ts,tsx}'],
 important: '.new-landing',
 corePlugins: {preflight: false},
 theme: {extend: {
 ringColor: {DEFAULT:'var(--primary)'}, ringOffsetColor:{DEFAULT:'var(--panel)'},
 colors: {brand:color('brand'),slate:color('slate'),violet:color('brand'),emerald:color('success'),amber:color('warning'),white:'rgb(var(--panel-rgb) / <alpha-value>)'},
 fontFamily:{display:['var(--font-display)'],sans:['var(--font-body)'],mono:['var(--font-mono)']},
 borderRadius:{route:'6px'},
 boxShadow:{card:'0 1px 3px color-mix(in srgb, var(--text) 6%, transparent)',lift:'0 12px 32px -12px color-mix(in srgb, var(--text) 18%, transparent)'}
 }}
}
