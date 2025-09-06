import { describe, expect, it, vi } from 'vitest';
import { StreamingMessageParser, type ActionCallback, type ArtifactCallback } from './message-parser';
import { EnhancedStreamingMessageParser } from './enhanced-message-parser';

interface ExpectedResult {
  output: string;
  callbacks?: {
    onArtifactOpen?: number;
    onArtifactClose?: number;
    onActionOpen?: number;
    onActionClose?: number;
  };
}

describe('StreamingMessageParser', () => {
  it('should pass through normal text', () => {
    const parser = new StreamingMessageParser();
    expect(parser.parse('test_id', 'Hello, world!')).toBe('Hello, world!');
  });

  it('should allow normal HTML tags', () => {
    const parser = new StreamingMessageParser();
    expect(parser.parse('test_id', 'Hello <strong>world</strong>!')).toBe('Hello <strong>world</strong>!');
  });

  describe('no artifacts', () => {
    it.each<[string | string[], ExpectedResult | string]>([
      ['Foo bar', 'Foo bar'],
      ['Foo bar <', 'Foo bar '],
      ['Foo bar <p', 'Foo bar <p'],
      [['Foo bar <', 's', 'p', 'an>some text</span>'], 'Foo bar <span>some text</span>'],
    ])('should correctly parse chunks and strip out bolt artifacts (%#)', (input, expected) => {
      runTest(input, expected);
    });
  });

  describe('invalid or incomplete artifacts', () => {
    it.each<[string | string[], ExpectedResult | string]>([
      ['Foo bar <b', 'Foo bar '],
      ['Foo bar <ba', 'Foo bar <ba'],
      ['Foo bar <bol', 'Foo bar '],
      ['Foo bar <bolt', 'Foo bar '],
      ['Foo bar <bolta', 'Foo bar <bolta'],
      ['Foo bar <boltA', 'Foo bar '],
      ['Foo bar <boltArtifacs></boltArtifact>', 'Foo bar <boltArtifacs></boltArtifact>'],
      ['Before <oltArtfiact>foo</boltArtifact> After', 'Before <oltArtfiact>foo</boltArtifact> After'],
      ['Before <boltArtifactt>foo</boltArtifact> After', 'Before <boltArtifactt>foo</boltArtifact> After'],
    ])('should correctly parse chunks and strip out bolt artifacts (%#)', (input, expected) => {
      runTest(input, expected);
    });
  });

  describe('valid artifacts without actions', () => {
    it.each<[string | string[], ExpectedResult | string]>([
      [
        'Some text before <boltArtifact title="Some title" id="artifact_1">foo bar</boltArtifact> Some more text',
        {
          output: 'Some text before  Some more text',
          callbacks: { onArtifactOpen: 1, onArtifactClose: 1, onActionOpen: 0, onActionClose: 0 },
        },
      ],
      [
        [
          'Some text before <boltArti',
          'fact',
          ' title="Some title" id="artifact_1" type="bundled" >foo</boltArtifact> Some more text',
        ],
        {
          output: 'Some text before  Some more text',
          callbacks: { onArtifactOpen: 1, onArtifactClose: 1, onActionOpen: 0, onActionClose: 0 },
        },
      ],
      [
        [
          'Some text before <boltArti',
          'fac',
          't title="Some title" id="artifact_1"',
          ' ',
          '>',
          'foo</boltArtifact> Some more text',
        ],
        {
          output: 'Some text before  Some more text',
          callbacks: { onArtifactOpen: 1, onArtifactClose: 1, onActionOpen: 0, onActionClose: 0 },
        },
      ],
      [
        [
          'Some text before <boltArti',
          'fact',
          ' title="Some title" id="artifact_1"',
          ' >fo',
          'o</boltArtifact> Some more text',
        ],
        {
          output: 'Some text before  Some more text',
          callbacks: { onArtifactOpen: 1, onArtifactClose: 1, onActionOpen: 0, onActionClose: 0 },
        },
      ],
      [
        [
          'Some text before <boltArti',
          'fact tit',
          'le="Some ',
          'title" id="artifact_1">fo',
          'o',
          '<',
          '/boltArtifact> Some more text',
        ],
        {
          output: 'Some text before  Some more text',
          callbacks: { onArtifactOpen: 1, onArtifactClose: 1, onActionOpen: 0, onActionClose: 0 },
        },
      ],
      [
        [
          'Some text before <boltArti',
          'fact title="Some title" id="artif',
          'act_1">fo',
          'o<',
          '/boltArtifact> Some more text',
        ],
        {
          output: 'Some text before  Some more text',
          callbacks: { onArtifactOpen: 1, onArtifactClose: 1, onActionOpen: 0, onActionClose: 0 },
        },
      ],
      [
        'Before <boltArtifact title="Some title" id="artifact_1">foo</boltArtifact> After',
        {
          output: 'Before  After',
          callbacks: { onArtifactOpen: 1, onArtifactClose: 1, onActionOpen: 0, onActionClose: 0 },
        },
      ],
    ])('should correctly parse chunks and strip out bolt artifacts (%#)', (input, expected) => {
      runTest(input, expected);
    });
  });

  describe('valid artifacts with actions', () => {
    it.each<[string | string[], ExpectedResult | string]>([
      [
        'Before <boltArtifact title="Some title" id="artifact_1"><boltAction type="shell">npm install</boltAction></boltArtifact> After',
        {
          output: 'Before  After',
          callbacks: { onArtifactOpen: 1, onArtifactClose: 1, onActionOpen: 1, onActionClose: 1 },
        },
      ],
      [
        'Before <boltArtifact title="Some title" id="artifact_1"><boltAction type="shell">npm install</boltAction><boltAction type="file" filePath="index.js">some content</boltAction></boltArtifact> After',
        {
          output: 'Before  After',
          callbacks: { onArtifactOpen: 1, onArtifactClose: 1, onActionOpen: 2, onActionClose: 2 },
        },
      ],
    ])('should correctly parse chunks and strip out bolt artifacts (%#)', (input, expected) => {
      runTest(input, expected);
    });
  });

  /*
   * Note: Enhanced parser tests should be added for shell command detection
   * Tests for: npm install && npm run dev -> <boltAction type="shell">
   * Tests for: script files with shebang -> <boltAction type="file">
   * Tests for: code blocks without context -> no action created
   */
});

describe('EnhancedStreamingMessageParser', () => {
  it('should detect shell commands in code blocks', () => {
    const callbacks = {
      onArtifactOpen: vi.fn(),
      onArtifactClose: vi.fn(),
      onActionOpen: vi.fn(),
      onActionClose: vi.fn(),
    };

    const parser = new EnhancedStreamingMessageParser({
      callbacks,
    });

    const input = '```bash\nnpm install && npm run dev\n```';
    parser.parse('test_id', input);

    expect(callbacks.onActionOpen).toHaveBeenCalledWith(
      expect.objectContaining({
        action: expect.objectContaining({
          type: 'shell',
          content: 'npm install && npm run dev',
        }),
      }),
    );
  });

  it('should detect file creation from code blocks with context', () => {
    const callbacks = {
      onArtifactOpen: vi.fn(),
      onArtifactClose: vi.fn(),
      onActionOpen: vi.fn(),
      onActionClose: vi.fn(),
    };

    const parser = new EnhancedStreamingMessageParser({
      callbacks,
    });

    const input =
      'Create a new file called index.js:\n\n```javascript\nfunction hello() {\n  console.log("Hello World");\n}\n```';
    parser.parse('test_id', input);

    expect(callbacks.onArtifactOpen).toHaveBeenCalledWith(
      expect.objectContaining({
        id: expect.stringContaining('test_id-'),
        title: 'index.js',
      }),
    );
  });

  it('should not create actions for code blocks without context', () => {
    const callbacks = {
      onArtifactOpen: vi.fn(),
      onArtifactClose: vi.fn(),
      onActionOpen: vi.fn(),
      onActionClose: vi.fn(),
    };

    const parser = new EnhancedStreamingMessageParser({
      callbacks,
    });

    const input = 'Here is some code:\n\n```javascript\nfunction test() {}\n```';
    parser.parse('test_id', input);

    expect(callbacks.onArtifactOpen).not.toHaveBeenCalled();
    expect(callbacks.onActionOpen).not.toHaveBeenCalled();
  });
});

function runTest(input: string | string[], outputOrExpectedResult: string | ExpectedResult) {
  let expected: ExpectedResult;

  if (typeof outputOrExpectedResult === 'string') {
    expected = { output: outputOrExpectedResult };
  } else {
    expected = outputOrExpectedResult;
  }

  const callbacks = {
    onArtifactOpen: vi.fn<ArtifactCallback>((data) => {
      expect(data).toMatchSnapshot('onArtifactOpen');
    }),
    onArtifactClose: vi.fn<ArtifactCallback>((data) => {
      expect(data).toMatchSnapshot('onArtifactClose');
    }),
    onActionOpen: vi.fn<ActionCallback>((data) => {
      expect(data).toMatchSnapshot('onActionOpen');
    }),
    onActionClose: vi.fn<ActionCallback>((data) => {
      expect(data).toMatchSnapshot('onActionClose');
    }),
  };

  const parser = new StreamingMessageParser({
    artifactElement: () => '',
    callbacks,
  });

  let message = '';

  let result = '';

  const chunks = Array.isArray(input) ? input : input.split('');

  for (const chunk of chunks) {
    message += chunk;

    result += parser.parse('message_1', message);
  }

  for (const name in expected.callbacks) {
    const callbackName = name;

    expect(callbacks[callbackName as keyof typeof callbacks]).toHaveBeenCalledTimes(
      expected.callbacks[callbackName as keyof typeof expected.callbacks] ?? 0,
    );
  }

  expect(result).toEqual(expected.output);
}
