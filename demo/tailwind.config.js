/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#00486d',
          container: '#006190',
          fixed: '#cbe6ff',
          'fixed-dim': '#8ecdff',
        },
        secondary: {
          DEFAULT: '#006494',
          container: '#71c3ff',
          fixed: '#cae6ff',
          'fixed-dim': '#8ecdff',
        },
        tertiary: {
          DEFAULT: '#004f1c',
          container: '#006a28',
          fixed: '#9af8a2',
          'fixed-dim': '#7edb89',
        },
        error: { DEFAULT: '#ba1a1a', container: '#ffdad6' },
        cta: { DEFAULT: '#3D95CE' },
        background: '#f9f9fa',
        surface: {
          DEFAULT: '#f9f9fa',
          variant: '#e2e2e3',
          container: {
            DEFAULT: '#eeeeef',
            low: '#f3f3f4',
            lowest: '#ffffff',
            high: '#e8e8e9',
            highest: '#e2e2e3',
          },
        },
        outline: { DEFAULT: '#707880', variant: '#bfc7d1' },
        on: {
          primary: '#ffffff',
          'primary-container': '#add9ff',
          'secondary-container': '#005077',
          background: '#1a1c1d',
          surface: '#1a1c1d',
          'surface-variant': '#40484f',
        },
      },
      borderRadius: { card: '24px' },
      spacing: {
        'stack-gap-md': '16px',
        'stack-gap-lg': '24px',
        'edge-margin': '16px',
        'container-padding': '20px',
      },
      fontSize: {
        'display-amount': ['48px', { lineHeight: '56px', letterSpacing: '-0.02em', fontWeight: '700' }],
        'display-amount-mobile': ['36px', { lineHeight: '44px', fontWeight: '700' }],
        'headline-md': ['20px', { lineHeight: '28px', fontWeight: '600' }],
        'headline-sm': ['18px', { lineHeight: '24px', fontWeight: '600' }],
        'section-label': ['12px', { lineHeight: '16px', letterSpacing: '0.05em', fontWeight: '800' }],
        'body-lg': ['16px', { lineHeight: '24px' }],
        'body-md': ['16px', { lineHeight: '24px' }],
        'body-sm': ['14px', { lineHeight: '20px' }],
        'label-md': ['14px', { lineHeight: '20px', fontWeight: '600' }],
        'label-sm': ['12px', { lineHeight: '16px', fontWeight: '500' }],
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        'section-label': ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 4px 20px rgba(0, 0, 0, 0.04)',
        card: '0 2px 12px rgba(0, 0, 0, 0.05)',
      },
    },
  },
  plugins: [],
};
