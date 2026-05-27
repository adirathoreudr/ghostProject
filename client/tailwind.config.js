/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ghost: {
          black:   '#080810',
          deep:    '#0d0d1a',
          surface: '#12121f',
          card:    '#16162a',
          border:  '#1e1e35',
          muted:   '#2a2a45',
          accent:  '#e94560',
          accentlo:'#c73550',
          gold:    '#f4a623',
          cyan:    '#00d4ff',
          green:   '#00ff88',
          text:    '#e8e8f0',
          sub:     '#8888aa',
          dim:     '#555570',
        },
      },
      fontFamily: {
        display: ['"Syne"', 'sans-serif'],
        mono:    ['"JetBrains Mono"', 'monospace'],
        body:    ['"DM Sans"', 'sans-serif'],
      },
      animation: {
        'pulse-slow':   'pulse 3s cubic-bezier(0.4,0,0.6,1) infinite',
        'glow':         'glow 2s ease-in-out infinite alternate',
        'slide-up':     'slideUp 0.5s cubic-bezier(0.16,1,0.3,1)',
        'fade-in':      'fadeIn 0.4s ease-out',
        'ping-slow':    'ping 2s cubic-bezier(0,0,0.2,1) infinite',
        'scan':         'scan 3s linear infinite',
      },
      keyframes: {
        glow: {
          '0%':   { boxShadow: '0 0 20px rgba(233,69,96,0.3)' },
          '100%': { boxShadow: '0 0 40px rgba(233,69,96,0.7), 0 0 80px rgba(233,69,96,0.2)' },
        },
        slideUp: {
          '0%':   { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        scan: {
          '0%':   { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};
