/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        avian: {
          50:  '#f0fefb',
          100: '#ccfdf2',
          200: '#9af9e6',
          300: '#34f5c6', // brand mint
          400: '#34e2d5', // cyan-turquoise
          500: '#17a7b6', // mid teal-blue
          600: '#2a737f', // dark teal-blue (button bg)
          700: '#19827a', // dark teal (button hover)
          800: '#125a54',
          900: '#0b3733',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};
