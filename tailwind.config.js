/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          dark: '#0b0b0f',
          card: '#141419',
          border: '#2a2a36',
        },
        brand: {
          DEFAULT: '#6851ff',
          light: '#7a66ff',
          muted: '#a594ff',
        },
        text: {
          primary: '#f4f4f5',
          secondary: '#a1a1aa',
          muted: '#71717a',
        },
        success: '#00e6a0',
        danger: '#ff5c5c',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
