import type { WebContainer, WebContainerProcess } from '@webcontainer/api';
import { atom, type WritableAtom } from 'nanostores';
import type { ITerminal } from '~/types/terminal';
import { newBoltShellProcess, newShellProcess } from '~/utils/shell';

// 直接定义颜色函数以避免导入问题
const reset = '\x1b[0m';
const escapeCodes = {
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

const coloredText = {
  red: (text: string) => `${escapeCodes.red}${text}${reset}`,
  green: (text: string) => `${escapeCodes.green}${text}${reset}`,
  yellow: (text: string) => `${escapeCodes.yellow}${text}${reset}`,
  blue: (text: string) => `${escapeCodes.blue}${text}${reset}`,
  magenta: (text: string) => `${escapeCodes.magenta}${text}${reset}`,
  cyan: (text: string) => `${escapeCodes.cyan}${text}${reset}`,
  white: (text: string) => `${escapeCodes.white}${text}${reset}`,
};

export class TerminalStore {
  #webcontainer: Promise<WebContainer>;
  #terminals: Array<{ terminal: ITerminal; process: WebContainerProcess }> = [];
  #boltTerminal = newBoltShellProcess();

  showTerminal: WritableAtom<boolean> = import.meta.hot?.data.showTerminal ?? atom(true);

  constructor(webcontainerPromise: Promise<WebContainer>) {
    this.#webcontainer = webcontainerPromise;

    if (import.meta.hot) {
      import.meta.hot.data.showTerminal = this.showTerminal;
    }
  }

  get boltTerminal() {
    return this.#boltTerminal;
  }

  toggleTerminal(value?: boolean) {
    this.showTerminal.set(value !== undefined ? value : !this.showTerminal.get());
  }

  async attachBoltTerminal(terminal: ITerminal) {
    try {
      console.log('Attaching bolt terminal...');
      terminal.write(coloredText.blue('Initializing bolt shell...\n'));

      // Check if WebContainer is available
      const wc = await Promise.race([
        this.#webcontainer,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('WebContainer loading timeout')), 15000)
        )
      ]) as any;

      if (!wc) {
        throw new Error('WebContainer is not available');
      }

      console.log('WebContainer ready, initializing bolt terminal...');

      // 添加超时机制
      const initPromise = this.#boltTerminal.init(wc, terminal);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Terminal initialization timeout')), 15000);
      });

      await Promise.race([initPromise, timeoutPromise]);
      console.log('Bolt terminal attached successfully');
      terminal.write(coloredText.green('Bolt shell ready!\n'));
    } catch (error: any) {
      console.error('Failed to attach bolt terminal:', error);
      terminal.write(coloredText.red('Failed to spawn bolt shell\n\n') + error.message + '\n');

      // Show more helpful error message
      if (error.message.includes('WebContainer')) {
        terminal.write(coloredText.yellow('WebContainer is still loading. Please wait...\n'));
      } else if (error.message.includes('timeout')) {
        terminal.write(coloredText.yellow('Terminal initialization is taking longer than expected.\n'));
      }

      // 尝试重新初始化，但限制重试次数
      const retryCount = (this as any)._boltRetryCount || 0;
      if (retryCount < 3) {
        (this as any)._boltRetryCount = retryCount + 1;
        terminal.write(coloredText.blue(`Retrying... (attempt ${retryCount + 1}/3)\n`));

        setTimeout(() => {
          console.log('Retrying bolt terminal initialization...');
          this.attachBoltTerminal(terminal).catch(console.error);
        }, 3000);
      } else {
        terminal.write(coloredText.red('Maximum retry attempts reached. Please refresh the page.\n'));
      }

      return;
    }
  }

  async attachTerminal(terminal: ITerminal) {
    try {
      console.log('Attaching new terminal...');
      terminal.write(coloredText.blue('Initializing shell...\n'));

      // Check if WebContainer is available
      const wc = await Promise.race([
        this.#webcontainer,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('WebContainer loading timeout')), 15000)
        )
      ]) as any;

      if (!wc) {
        throw new Error('WebContainer is not available');
      }

      // 添加超时机制
      const shellPromise = newShellProcess(wc, terminal);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Shell process timeout')), 10000);
      });

      const shellProcess = (await Promise.race([shellPromise, timeoutPromise])) as WebContainerProcess;
      this.#terminals.push({ terminal, process: shellProcess });
      console.log('Terminal attached successfully');
      terminal.write(coloredText.green('Shell ready!\n'));
    } catch (error: any) {
      console.error('Failed to attach terminal:', error);
      terminal.write(coloredText.red('Failed to spawn shell\n\n') + error.message + '\n');

      // Show more helpful error message
      if (error.message.includes('WebContainer')) {
        terminal.write(coloredText.yellow('WebContainer is still loading. Please wait...\n'));
      } else if (error.message.includes('timeout')) {
        terminal.write(coloredText.yellow('Shell initialization is taking longer than expected.\n'));
      }

      // 尝试重新初始化，但限制重试次数
      const terminalId = (terminal as any).id || 'unknown';
      const retryKey = `_terminalRetryCount_${terminalId}`;
      const retryCount = (this as any)[retryKey] || 0;

      if (retryCount < 3) {
        (this as any)[retryKey] = retryCount + 1;
        terminal.write(coloredText.blue(`Retrying... (attempt ${retryCount + 1}/3)\n`));

        setTimeout(() => {
          console.log('Retrying terminal initialization...');
          this.attachTerminal(terminal).catch(console.error);
        }, 3000);
      } else {
        terminal.write(coloredText.red('Maximum retry attempts reached. Please refresh the page.\n'));
      }

      return;
    }
  }

  onTerminalResize(cols: number, rows: number) {
    for (const { process } of this.#terminals) {
      process.resize({ cols, rows });
    }
  }

  async detachTerminal(terminal: ITerminal) {
    const terminalIndex = this.#terminals.findIndex((t) => t.terminal === terminal);

    if (terminalIndex !== -1) {
      const { process } = this.#terminals[terminalIndex];

      try {
        process.kill();
      } catch (error) {
        console.warn('Failed to kill terminal process:', error);
      }
      this.#terminals.splice(terminalIndex, 1);
    }
  }
}
