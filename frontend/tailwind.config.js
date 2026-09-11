/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'civic-primary': '#1A365D',
        'civic-alert': '#E53E3E',
        'civic-surface': '#F7FAFC',
        'civic-surface-dark': '#111827',
        'civic-card': '#FFFFFF',
        'civic-card-dark': '#1F2937',
        'civic-text-main': '#2D3748',
        'civic-text-main-dark': '#F9FAFB',
        'civic-text-muted': '#718096',
        'civic-text-muted-dark': '#9CA3AF',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
