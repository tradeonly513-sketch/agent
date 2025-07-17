import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Terminal as XTerm } from '@xterm/xterm';
import { forwardRef, memo, useEffect, useImperativeHandle, useRef } from 'react';
import type { Theme } from '~/lib/stores/theme';
import { createScopedLogger } from '~/utils/logger';
import { getTerminalTheme } from './theme';

const logger = createScopedLogger('Terminal');

export interface TerminalRef {
  reloadStyles: () => void;
  getTerminal: () => XTerm | undefined;
}

export interface TerminalProps {
  className?: string;
  theme: Theme;
  readonly?: boolean;
  id: string;
  onTerminalReady?: (terminal: XTerm) => void;
  onTerminalResize?: (cols: number, rows: number) => void;
}

export const Terminal = memo(
  forwardRef<TerminalRef, TerminalProps>(
    ({ className, theme, readonly, id, onTerminalReady, onTerminalResize }, ref) => {
      const terminalElementRef = useRef<HTMLDivElement>(null);
      const terminalRef = useRef<XTerm>();

      useEffect(() => {
        const element = terminalElementRef.current!;

        try {
          const fitAddon = new FitAddon();
          const webLinksAddon = new WebLinksAddon();

          const terminal = new XTerm({
            cursorBlink: true,
            convertEol: true,
            disableStdin: readonly,
            theme: getTerminalTheme(readonly ? { cursor: '#00000000' } : {}),
            fontSize: 12,
            fontFamily: 'Menlo, courier-new, courier, monospace',
            allowProposedApi: true, // 允许提议的API
          });

          terminalRef.current = terminal;

          terminal.loadAddon(fitAddon);
          terminal.loadAddon(webLinksAddon);
          terminal.open(element);

          // 添加错误处理
          terminal.onRender(() => {
            try {
              fitAddon.fit();
            } catch (error) {
              console.warn('Terminal fit error:', error);
            }
          });

          const resizeObserver = new ResizeObserver(() => {
            try {
              fitAddon.fit();
              onTerminalResize?.(terminal.cols, terminal.rows);
            } catch (error) {
              console.warn('Terminal resize error:', error);
            }
          });

          resizeObserver.observe(element);

          logger.debug(`Attach [${id}]`);

          // 延迟调用onTerminalReady，确保终端完全初始化
          setTimeout(() => {
            try {
              onTerminalReady?.(terminal);
            } catch (error) {
              console.error('Terminal ready callback error:', error);
            }
          }, 100);

          return () => {
            try {
              resizeObserver.disconnect();
              terminal.dispose();
            } catch (error) {
              console.warn('Terminal cleanup error:', error);
            }
          };
        } catch (error) {
          console.error('Terminal initialization error:', error);
          // 显示错误信息
          if (element) {
            element.innerHTML = `<div style="color: red; padding: 10px;">Terminal initialization failed: ${error}</div>`;
          }
        }
      }, []);

      useEffect(() => {
        const terminal = terminalRef.current!;

        // we render a transparent cursor in case the terminal is readonly
        terminal.options.theme = getTerminalTheme(readonly ? { cursor: '#00000000' } : {});

        terminal.options.disableStdin = readonly;
      }, [theme, readonly]);

      useImperativeHandle(ref, () => {
        return {
          reloadStyles: () => {
            const terminal = terminalRef.current!;
            terminal.options.theme = getTerminalTheme(readonly ? { cursor: '#00000000' } : {});
          },
          getTerminal: () => {
            return terminalRef.current;
          },
        };
      }, []);

      return <div className={className} ref={terminalElementRef} />;
    },
  ),
);
