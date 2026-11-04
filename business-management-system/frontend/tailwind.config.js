/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Sage / teal accent ramp taken from the Production Receive Entry screen
        // (page #dce8e1, header #2c5f57, borders #789d93, table head #c2ded7).
        // Every blue-* utility across the app resolves to this ramp.
        blue: {
          50: '#eef4f2',
          100: '#d8e8e3',
          200: '#b6d3ca',
          300: '#8dbaad',
          400: '#5f9a8b',
          500: '#3f7f70',
          600: '#2c5f57',
          700: '#254e47',
          800: '#1f4842',
          900: '#183330',
          950: '#112422',
        },
        brand: {
          50: '#eef4f2',
          100: '#d8e8e3',
          500: '#3f7f70',
          600: '#2c5f57',
          700: '#254e47',
          900: '#183330',
        }
      }
    },
  },
  plugins: [],
}

