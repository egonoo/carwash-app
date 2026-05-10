import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';
import forms from '@tailwindcss/forms';

const config: Config = {
  darkMode: 'class',
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    container: { center: true, padding: '1rem' },
    extend: {
      colors: {
        brand: {
          DEFAULT: 'var(--brand, #0A84FF)',
          ink: 'var(--brand-ink, #0057D9)',
        },
        accent: '#00C48C',
        warning: '#FFB020',
        danger: '#E03131',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', 'ui-sans-serif', 'system-ui'],
      },
      borderRadius: {
        sm: '6px',
        md: '10px',
        lg: '16px',
        xl: '24px',
      },
    },
  },
  plugins: [animate, forms],
};

export default config;
