import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // TRC brand palette — placeholder; refine with design/01-product-ux.md
        marigold: '#F5A623',
        jasmine: '#FDF8F0',
        leaf: '#2E5E3A',
      },
    },
  },
  plugins: [],
};

export default config;
