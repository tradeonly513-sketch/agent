const reset = '\x1b[0m';

export const escapeCodes = {
  reset,
  clear: '\x1b[g',
  red: '\x1b[1;31m',
  green: '\x1b[1;32m',
  yellow: '\x1b[1;33m',
  blue: '\x1b[1;34m',
  magenta: '\x1b[1;35m',
  cyan: '\x1b[1;36m',
  white: '\x1b[1;37m',
};

export const coloredText = {
  red: (text: string) => `${escapeCodes.red}${text}${reset}`,
  green: (text: string) => `${escapeCodes.green}${text}${reset}`,
  yellow: (text: string) => `${escapeCodes.yellow}${text}${reset}`,
  blue: (text: string) => `${escapeCodes.blue}${text}${reset}`,
  magenta: (text: string) => `${escapeCodes.magenta}${text}${reset}`,
  cyan: (text: string) => `${escapeCodes.cyan}${text}${reset}`,
  white: (text: string) => `${escapeCodes.white}${text}${reset}`,
};
