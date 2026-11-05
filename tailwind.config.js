/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        spotify: {
          green: '#1DB954',
          dark: '#121212',
          black: '#0b0d10',
          elevated: '#181818',
          card: '#1a1d24',
          subtext: '#b3b3b3'
        }
      }
    },
  },
  plugins: [],
}

