import type { WebContainer, WebContainerProcess } from '@webcontainer/api';
import { atom, type WritableAtom } from 'nanostores';
import type { ITerminal } from '~/types/terminal';
import { newBoltShellProcess, newShellProcess } from '~/utils/shell';
import { coloredText } from '~/utils/terminal';

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

      const wc = await this.#webcontainer;

      // 添加超时机制
      const initPromise = this.#boltTerminal.init(wc, terminal);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Terminal initialization timeout')), 10000);
      });

      await Promise.race([initPromise, timeoutPromise]);
      console.log('Bolt terminal attached successfully');
    } catch (error: any) {
      console.error('Failed to attach bolt terminal:', error);
      terminal.write(coloredText.red('Failed to spawn bolt shell\n\n') + error.message);

      // 尝试重新初始化
      setTimeout(() => {
        console.log('Retrying bolt terminal initialization...');
        this.attachBoltTerminal(terminal).catch(console.error);
      }, 3000);

      return;
    }
  }

  async attachTerminal(terminal: ITerminal) {
    try {
      console.log('Attaching new terminal...');

      const wc = await this.#webcontainer;

      // 添加超时机制
      const shellPromise = newShellProcess(wc, terminal);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Shell process timeout')), 8000);
      });

      const shellProcess = (await Promise.race([shellPromise, timeoutPromise])) as WebContainerProcess;
      this.#terminals.push({ terminal, process: shellProcess });
      console.log('Terminal attached successfully');
    } catch (error: any) {
      console.error('Failed to attach terminal:', error);
      terminal.write(coloredText.red('Failed to spawn shell\n\n') + error.message);

      // 尝试重新初始化
      setTimeout(() => {
        console.log('Retrying terminal initialization...');
        this.attachTerminal(terminal).catch(console.error);
      }, 3000);

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
