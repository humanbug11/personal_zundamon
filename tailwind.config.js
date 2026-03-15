import plugin from 'tailwindcss/plugin'

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/renderer/index.html',
    './src/renderer/src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        zunda: {
          light: '#d9f99d',
          DEFAULT: '#84cc16',
          dark: '#4d7c0f',
        },
      },
    },
  },
  plugins: [],
}
