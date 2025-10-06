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
        // Signal's color palette (dark theme)
        dark: {
          bg: '#1b1b1d',           // Signal's main background
          surface: '#2c2c2e',       // Signal's sidebar/surface
          elevated: '#3a3a3c',      // Signal's elevated elements
          border: '#48484a',        // Signal's borders
          text: '#ffffff',          // Signal's primary text
          'text-secondary': '#8e8e93', // Signal's secondary text
        },
        accent: {
          primary: '#2C6BED',       // Signal blue (their signature color)
          'primary-hover': '#1A5AD7',
          secondary: '#8e8e93',
          success: '#4cd964',
          error: '#ff3b30',
          incoming: '#3a3a3c',      // Incoming message bubble
          outgoing: '#2C6BED',      // Outgoing message bubble (Signal blue)
        }
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
      },
      borderRadius: {
        'signal': '18px',           // Signal's message bubble radius
        'signal-lg': '22px',        // Larger bubble radius
      },
      spacing: {
        'signal': '12px',
      }
    },
  },
  plugins: [],
  darkMode: 'class',
}
