/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'Inter', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      boxShadow: {
        'tactile': '0 2px 0 0 rgba(28, 25, 23, 0.08)',
        'tactile-lg': '0 4px 0 0 rgba(28, 25, 23, 0.1)',
      }
    },
  },
  plugins: [],
}
