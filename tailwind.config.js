// Charte CKLabs : encre indigo #1C2551, ocre #C98A1E, filets #D9D2C3, gris #6B6F80.
// Les nuances « indigo », « amber » et « slate » de Tailwind sont redirigées vers la charte.
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './App.tsx', './index.tsx', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        indigo: { 50: '#EEF0F6', 100: '#DDE1EE', 200: '#BCC3DC', 300: '#AAB1CF', 400: '#5D6798', 500: '#3A4370', 600: '#1C2551', 700: '#161D42', 800: '#111733', 900: '#0C1024' },
        amber: { 50: '#FBF5EA', 100: '#F6EBD6', 200: '#EDD5AC', 300: '#E2BC7C', 400: '#D6A24C', 500: '#C98A1E', 600: '#A97318', 700: '#865B13', 800: '#64440E', 900: '#432E09' },
        slate: { 50: '#F8F7F3', 100: '#F1EFE9', 200: '#E4E0D6', 300: '#D9D2C3', 400: '#9A9CA8', 500: '#6B6F80', 600: '#4E5266', 700: '#3A3E52', 800: '#262A3D', 900: '#1C2551' },
        ink: '#1C2551', ochre: '#C98A1E', rule: '#D9D2C3', mute: '#6B6F80', soft: '#EEF0F6', 'ochre-light': '#F6EBD6',
      },
      fontFamily: {
        sans: ['Figtree', 'system-ui', 'sans-serif'],
        serif: ['"Source Serif 4"', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
};
