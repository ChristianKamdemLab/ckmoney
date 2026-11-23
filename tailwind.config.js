// Charte « Ndop la nuit » : indigo nuit #0E1533, mangue #F2A71B, corail #FF5C7A, turquoise #1FB5A6.
// Les nuances « indigo », « amber » et « slate » de Tailwind sont redirigées vers la charte.
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './App.tsx', './index.tsx', './jambo.html', './jambo.tsx', './bac.html', './bac.tsx', './wiseman.html', './wiseman.tsx', './evenement.html', './evenement.tsx', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        indigo: { 50: '#EEF0F6', 100: '#DDE1EE', 200: '#BCC3DC', 300: '#AAB1CF', 400: '#5D6798', 500: '#3A4370', 600: '#0E1533', 700: '#0B1129', 800: '#080D20', 900: '#050816' },
        amber: { 50: '#FFF8E6', 100: '#FFF1D1', 200: '#FFE2A3', 300: '#FFD274', 400: '#FFC23D', 500: '#F2A71B', 600: '#C98410', 700: '#7A4A00', 800: '#5C3700', 900: '#3D2500' },
        slate: { 50: '#F8F7F3', 100: '#F1EFE9', 200: '#E4E0D6', 300: '#D9D2C3', 400: '#9A9CA8', 500: '#6B6F80', 600: '#4E5266', 700: '#3A3E52', 800: '#262A3D', 900: '#0E1533' },
        ink: '#0E1533', ochre: '#F2A71B', coral: '#FF5C7A', teal: '#1FB5A6', rule: '#D9D2C3', mute: '#6B6F80', soft: '#EEF0F6', 'ochre-light': '#FFF1D1',
      },
      fontFamily: {
        sans: ['Manrope', 'system-ui', 'sans-serif'],
        serif: ['Manrope', 'system-ui', 'sans-serif'],
        display: ['Unbounded', 'Manrope', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
