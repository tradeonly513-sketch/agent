import { globSync } from 'fast-glob';
import fs from 'node:fs/promises';
import { basename } from 'node:path';
import { defineConfig, presetIcons, presetUno, transformerDirectives } from 'unocss';

const iconPaths = globSync('./icons/*.svg');

const collectionName = 'bolt';

const customIconCollection = iconPaths.reduce(
  (acc, iconPath) => {
    const [iconName] = basename(iconPath).split('.');

    acc[collectionName] ??= {};
    acc[collectionName][iconName] = async () => fs.readFile(iconPath, 'utf8');

    return acc;
  },
  {} as Record<string, Record<string, () => Promise<string>>>,
);

// Enhanced color system for CodeCraft Studio
const BASE_COLORS = {
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
  current: 'currentColor',
  
  // Modern gray scale with better contrast
  gray: {
    50: '#FAFBFC',
    100: '#F4F6F8', 
    200: '#E8ECEF',
    300: '#D4DCE2',
    400: '#9AA6B3',
    500: '#6B7784',
    600: '#4F5964',
    700: '#3A424A',
    800: '#262D34',
    900: '#181C20',
    950: '#0D1014',
  },
  
  // Updated slate colors for better UI
  slate: {
    50: '#F8FAFC',
    100: '#F1F5F9',
    200: '#E2E8F0',
    300: '#CBD5E1',
    400: '#94A3B8',
    500: '#64748B',
    600: '#475569',
    700: '#334155',
    800: '#1E293B',
    900: '#0F172A',
    950: '#020617',
  },

  // Primary brand colors - Violet/Purple gradient
  primary: {
    50: '#F5F3FF',
    100: '#EDE9FE',
    200: '#DDD6FE',
    300: '#C4B5FD',
    400: '#A78BFA',
    500: '#8B5CF6',
    600: '#7C3AED',
    700: '#6D28D9',
    800: '#5B21B6',
    900: '#4C1D95',
    950: '#2E1065',
  },

  // Updated accent colors
  accent: {
    50: '#F0F9FF',
    100: '#E0F2FE',
    200: '#BAE6FD',
    300: '#7DD3FC',
    400: '#38BDF8',
    500: '#0EA5E9',
    600: '#0284C7',
    700: '#0369A1',
    800: '#075985',
    900: '#0C4A6E',
    950: '#082F49',
  },

  // Success colors
  success: {
    50: '#F0FDF4',
    100: '#DCFCE7',
    200: '#BBF7D0',
    300: '#86EFAC',
    400: '#4ADE80',
    500: '#22C55E',
    600: '#16A34A',
    700: '#15803D',
    800: '#166534',
    900: '#14532D',
    950: '#052E16',
  },

  // Warning colors
  warning: {
    50: '#FFFBEB',
    100: '#FEF3C7',
    200: '#FDE68A',
    300: '#FCD34D',
    400: '#FBBF24',
    500: '#F59E0B',
    600: '#D97706',
    700: '#B45309',
    800: '#92400E',
    900: '#78350F',
    950: '#451A03',
  },

  // Error/Danger colors
  error: {
    50: '#FEF2F2',
    100: '#FEE2E2',
    200: '#FECACA',
    300: '#FCA5A5',
    400: '#F87171',
    500: '#EF4444',
    600: '#DC2626',
    700: '#B91C1C',
    800: '#991B1B',
    900: '#7F1D1D',
    950: '#450A0A',
  },

  // Special gradient colors
  gradient: {
    primary: 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)',
    secondary: 'linear-gradient(135deg, #0EA5E9 0%, #0284C7 100%)',
    success: 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)',
    danger: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
    sunset: 'linear-gradient(135deg, #F59E0B 0%, #D97706 50%, #EF4444 100%)',
    ocean: 'linear-gradient(135deg, #0EA5E9 0%, #8B5CF6 100%)',
  },
};

export default defineConfig({
  presets: [
    presetUno({
      dark: 'class',
    }),
    presetIcons({
      collections: {
        ...customIconCollection,
      },
    }),
  ],
  transformers: [transformerDirectives()],
  theme: {
    colors: {
      ...BASE_COLORS,
      // Enhanced bolt elements color system
      'bolt-elements': {
        background: {
          depth: {
            1: 'var(--bg-depth-1)',
            2: 'var(--bg-depth-2)',
            3: 'var(--bg-depth-3)',
            4: 'var(--bg-depth-4)',
          },
        },
        borderColor: 'var(--border-color)',
        borderColorActive: 'var(--border-color-active)',
        textPrimary: 'var(--text-primary)',
        textSecondary: 'var(--text-secondary)',
        textTertiary: 'var(--text-tertiary)',
        button: {
          primary: {
            background: 'var(--button-primary-bg)',
            backgroundHover: 'var(--button-primary-bg-hover)',
            text: 'var(--button-primary-text)',
          },
          secondary: {
            background: 'var(--button-secondary-bg)',
            backgroundHover: 'var(--button-secondary-bg-hover)',
            text: 'var(--button-secondary-text)',
          },
        },
        item: {
          backgroundActive: 'var(--item-bg-active)',
          backgroundHover: 'var(--item-bg-hover)',
          contentDefault: 'var(--item-content-default)',
          contentActive: 'var(--item-content-active)',
        },
      },
    },
    fontFamily: {
      sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Monaco', 'Consolas', 'monospace'],
      display: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
    },
    fontSize: {
      xs: ['0.75rem', { lineHeight: '1rem' }],
      sm: ['0.875rem', { lineHeight: '1.25rem' }],
      base: ['1rem', { lineHeight: '1.5rem' }],
      lg: ['1.125rem', { lineHeight: '1.75rem' }],
      xl: ['1.25rem', { lineHeight: '1.75rem' }],
      '2xl': ['1.5rem', { lineHeight: '2rem' }],
      '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
      '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
      '5xl': ['3rem', { lineHeight: '1' }],
      '6xl': ['3.75rem', { lineHeight: '1' }],
      '7xl': ['4.5rem', { lineHeight: '1' }],
      '8xl': ['6rem', { lineHeight: '1' }],
      '9xl': ['8rem', { lineHeight: '1' }],
    },
    spacing: {
      'safe-top': 'env(safe-area-inset-top)',
      'safe-bottom': 'env(safe-area-inset-bottom)',
      'safe-left': 'env(safe-area-inset-left)',
      'safe-right': 'env(safe-area-inset-right)',
    },
    screens: {
      xs: '475px',
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1536px',
      '3xl': '1920px',
    },
    animation: {
      'fade-in': 'fadeIn 0.5s ease-in-out',
      'fade-in-up': 'fadeInUp 0.5s ease-out',
      'slide-in-left': 'slideInLeft 0.3s ease-out',
      'slide-in-right': 'slideInRight 0.3s ease-out',
      'scale-in': 'scaleIn 0.2s ease-out',
      'bounce-gentle': 'bounceGentle 0.6s ease-in-out',
      'pulse-subtle': 'pulseSubtle 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      'gradient-x': 'gradientX 3s ease infinite',
      'gradient-y': 'gradientY 3s ease infinite',
      'gradient-xy': 'gradientXY 3s ease infinite',
      'shimmer': 'shimmer 2s linear infinite',
    },
    keyframes: {
      fadeIn: {
        '0%': { opacity: '0' },
        '100%': { opacity: '1' },
      },
      fadeInUp: {
        '0%': { opacity: '0', transform: 'translateY(10px)' },
        '100%': { opacity: '1', transform: 'translateY(0)' },
      },
      slideInLeft: {
        '0%': { transform: 'translateX(-100%)' },
        '100%': { transform: 'translateX(0)' },
      },
      slideInRight: {
        '0%': { transform: 'translateX(100%)' },
        '100%': { transform: 'translateX(0)' },
      },
      scaleIn: {
        '0%': { transform: 'scale(0.9)', opacity: '0' },
        '100%': { transform: 'scale(1)', opacity: '1' },
      },
      bounceGentle: {
        '0%, 100%': { transform: 'translateY(-5%)' },
        '50%': { transform: 'translateY(0)' },
      },
      pulseSubtle: {
        '0%, 100%': { opacity: '1' },
        '50%': { opacity: '0.8' },
      },
      gradientX: {
        '0%, 100%': { 'background-size': '200% 200%', 'background-position': 'left center' },
        '50%': { 'background-size': '200% 200%', 'background-position': 'right center' },
      },
      gradientY: {
        '0%, 100%': { 'background-size': '200% 200%', 'background-position': 'center top' },
        '50%': { 'background-size': '200% 200%', 'background-position': 'center bottom' },
      },
      gradientXY: {
        '0%, 100%': { 'background-size': '400% 400%', 'background-position': 'left center' },
        '50%': { 'background-size': '400% 400%', 'background-position': 'right center' },
      },
      shimmer: {
        '0%': { transform: 'translateX(-100%)' },
        '100%': { transform: 'translateX(100%)' },
      },
    },
    boxShadow: {
      'soft': '0 2px 8px rgba(0, 0, 0, 0.04)',
      'medium': '0 4px 16px rgba(0, 0, 0, 0.08)',
      'large': '0 8px 32px rgba(0, 0, 0, 0.12)',
      'xl': '0 16px 64px rgba(0, 0, 0, 0.16)',
      'inner-soft': 'inset 0 2px 4px rgba(0, 0, 0, 0.06)',
      'glow': '0 0 20px rgba(139, 92, 246, 0.3)',
      'glow-lg': '0 0 40px rgba(139, 92, 246, 0.4)',
    },
    backdropBlur: {
      xs: '2px',
      sm: '4px',
      md: '8px',
      lg: '16px',
      xl: '24px',
      '2xl': '40px',
      '3xl': '64px',
    },
  },
  shortcuts: [
    // Enhanced button shortcuts
    {
      'btn-primary': 'bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white font-medium px-4 py-2 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105 active:scale-95',
      'btn-secondary': 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 font-medium px-4 py-2 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md',
      'btn-ghost': 'bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200 font-medium px-4 py-2 rounded-lg transition-all duration-200',
    },
    // Card shortcuts
    {
      'card': 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-soft',
      'card-hover': 'card hover:shadow-medium transition-shadow duration-200',
      'card-interactive': 'card-hover cursor-pointer hover:scale-102 active:scale-98 transition-transform duration-200',
    },
    // Layout shortcuts
    {
      'container-responsive': 'w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8',
      'flex-center': 'flex items-center justify-center',
      'flex-between': 'flex items-center justify-between',
      'flex-col-center': 'flex flex-col items-center justify-center',
    },
    // Text shortcuts
    {
      'text-gradient': 'bg-gradient-to-r from-primary-500 to-accent-500 bg-clip-text text-transparent',
      'text-gradient-sunset': 'bg-gradient-to-r from-warning-500 to-error-500 bg-clip-text text-transparent',
    },
    // Mobile-first responsive utilities
    {
      'touch-target': 'min-h-44px min-w-44px md:min-h-40px md:min-w-40px',
      'mobile-padding': 'px-4 md:px-6 lg:px-8',
      'mobile-text': 'text-sm md:text-base',
      'mobile-heading': 'text-lg md:text-xl lg:text-2xl',
    },
  ],
  rules: [
    // Custom touch manipulation rule
    ['touch-manipulation', { 'touch-action': 'manipulation' }],
    // Custom scrollbar rules
    ['scrollbar-thin', {
      'scrollbar-width': 'thin',
      'scrollbar-color': 'rgb(156 163 175) transparent',
    }],
    ['scrollbar-none', {
      'scrollbar-width': 'none',
      '-ms-overflow-style': 'none',
      '&::-webkit-scrollbar': { display: 'none' },
    }],
    // Safe area rules
    ['safe-area-top', { 'padding-top': 'env(safe-area-inset-top)' }],
    ['safe-area-bottom', { 'padding-bottom': 'env(safe-area-inset-bottom)' }],
    ['safe-area-left', { 'padding-left': 'env(safe-area-inset-left)' }],
    ['safe-area-right', { 'padding-right': 'env(safe-area-inset-right)' }],
    // Custom glass effect
    ['glass', {
      'background': 'rgba(255, 255, 255, 0.1)',
      'backdrop-filter': 'blur(10px)',
      'border': '1px solid rgba(255, 255, 255, 0.2)',
    }],
    ['glass-dark', {
      'background': 'rgba(0, 0, 0, 0.1)',
      'backdrop-filter': 'blur(10px)',
      'border': '1px solid rgba(255, 255, 255, 0.1)',
    }],
  ],
});
