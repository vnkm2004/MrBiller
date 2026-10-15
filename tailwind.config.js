/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: 'rgb(var(--accent-color) / <alpha-value>)',
          light: 'rgb(var(--accent-color-light) / <alpha-value>)',
          dark: 'rgb(var(--accent-color-dark) / <alpha-value>)',
        },
        accent2: {
          DEFAULT: '#2a9d8f',
          light: '#52b788',
          dark: '#1d7265',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
