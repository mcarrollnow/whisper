/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          bg: '#0a0a0a',
          surface: '#1a1a1a',
          elevated: '#242424',
          border: '#2a2a2a',
          text: '#e5e5e5',
          'text-secondary': '#a3a3a3',
        },
        accent: {
          primary: '#3b82f6',
          secondary: '#8b5cf6',
          success: '#10b981',
          error: '#ef4444',
        }
      },
    },
  },
  plugins: [],
  darkMode: 'class',
}
