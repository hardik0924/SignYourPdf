/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#6366f1', // Indigo-500 (main blue)
          dark: '#4f46e5',    // Indigo-600
          light: '#a5b4fc',   // Indigo-300
        },
        accent: {
          DEFAULT: '#a21caf', // Purple-700
          light: '#c084fc',   // Purple-300
        },
        background: {
          DEFAULT: '#f8fafc', // Soft gray/white
        },
        gradientFrom: '#6366f1', // Indigo-500
        gradientTo: '#a21caf',   // Purple-700
      },
    },
  },
  plugins: [],
};
