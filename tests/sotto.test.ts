import type { RenderElement } from 'claude-code'
import { expect, test } from 'claude-code/testing'

import { bubble, describe as what, line, mcpName, spoken } from '../hooks/lib'

/** A command as typed at the prompt, for the test's engine `$`. */
const typed = (command: string, args: string) => ({ command, args, origin: { kind: 'composer' } as const, presentation: { isFullscreen: false, columns: 120 } })

const row = (tool: string, input: unknown, more: Partial<Parameters<typeof line>[0]> = {}) => ({
  tool,
  input,
  isRunning: false,
  isErrored: false,
  isInterrupted: false,
  ...more,
})

test('a Bash call is its description, then how many lines came back', () => {
  const r = row('Bash', { command: 'ls -t ~/Pictures | head', description: 'Find the latest screenshot' }, { output: { stdout: 'a\nb\nc\n', stderr: '' } })
  expect(line(r).text).toBe('Find the latest screenshot · 3 lines')
})

test('a Bash call without a description shows its first line, cut', () => {
  const r = row('Bash', { command: `${'x'.repeat(100)}\nsecond` })
  expect(line(r).text.length).toBeLessThanOrEqual(73)
  expect(line(r).text.endsWith('…')).toBe(true)
})

test('running, failed and interrupted calls say so', () => {
  const input = { command: 'make', description: 'Build it' }
  expect(line(row('Bash', input, { isRunning: true })).text).toBe('Build it …')
  expect(line(row('Bash', input, { isErrored: true })).text).toBe('Build it · failed')
  expect(line(row('Bash', input, { isInterrupted: true })).text).toBe('Build it · interrupted')
})

test('files are named by their basename', () => {
  expect(what('Read', { file_path: '/home/a/work/x/lib.ts', offset: 40 }).text).toBe('read lib.ts from line 40')
  expect(what('Edit', { file_path: '/home/a/work/x/lib.ts', old_string: '', new_string: '' }).text).toBe('edited lib.ts')
  expect(what('Write', { file_path: 'notes.md', content: '' }).text).toBe('wrote notes.md')
})

test('an MCP tool names the tool and its server', () => {
  expect(mcpName('mcp__plugin_atlassian_atlassian__getJiraIssue')).toBe('getJiraIssue (atlassian)')
  expect(mcpName('mcp__notes__add_note')).toBe('add_note (notes)')
  expect(what('mcp__notes__add_note', { text: 'milk' }).text).toBe('called add_note (notes)')
})

test('the web, agents and skills read as what they are', () => {
  expect(what('WebFetch', { url: 'https://docs.example.com/a/b', prompt: '' }).text).toBe('fetched docs.example.com')
  expect(what('Agent', { description: 'Review the diff', prompt: '' }).text).toBe('agent: Review the diff')
  expect(what('Skill', { skill: 'plugin-authoring' }).text).toBe('skill plugin-authoring')
})

for (const surface of ['terminal', 'desktop'] as const) {
  test(`a tool row is one icon and one dim line on ${surface}`, async $ => {
    const ui = await $.ui.mount({
      plugin: 'sotto',
      surface,
      component: 'ToolUse',
      requestId: 'tu1',
      props: {
        tool_use_id: 'tu1',
        tool: 'Bash',
        input: { command: 'ls', description: 'List files' },
        isRunning: false,
        isErrored: false,
        isInterrupted: false,
        output: { stdout: 'a\n', stderr: '', interrupted: false },
      },
    })
    const text = await ui.find({ type: 'Text', text: 'List files · 1 line' })
    expect(text).toBeDefined()
    expect(text?.props.dimColor).toBe(true)
  })

  test(`a result block draws nothing on ${surface}`, async $ => {
    const ui = await $.ui.mount({
      plugin: 'sotto',
      surface,
      component: 'ToolResult',
      requestId: 'tu1',
      props: { tool_use_id: 'tu1', tool: 'Bash', output: { stdout: 'a\n', stderr: '', interrupted: false }, isErrored: false },
    })
    expect(await ui.findAll({ type: 'Text' })).toEqual([])
  })

  test(`/sotto off hands the rows back to the engine on ${surface}`, async ($, on) => {
    on('ui.render', ($, e) => {
      const { Text } = $.ui.resolve(e)

      return h(Text, {}, 'the engine drew this') as RenderElement
    })
    const { text } = await $.command.run(typed('sotto', 'off'))
    expect(text).toBe('sotto: off, the usual tool rows')
    const ui = await $.ui.mount({
      plugin: 'sotto',
      surface,
      component: 'ToolUse',
      requestId: 'tu2',
      props: { tool_use_id: 'tu2', tool: 'Bash', input: { command: 'ls', description: 'List files' }, isRunning: false, isErrored: false, isInterrupted: false },
    })
    expect(await ui.find({ type: 'Text', text: 'List files' })).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: 'the engine drew this' })).toBeDefined()
    await $.command.run(typed('sotto', 'on'))
  })
}

test('a bubble is as wide as its longest line, capped at a share of the transcript', () => {
  expect(bubble('hi', 100, 2)).toBe(4)
  expect(bubble('a\n' + 'x'.repeat(30), 100, 2)).toBe(32)
  expect(bubble('x'.repeat(500), 100, 2)).toBe(72)
  expect(bubble('hi', undefined, 2)).toBeUndefined()
})

const prompt = (text: string, kind: 'composer' | 'task-notification' = 'composer') => ({
  text,
  origin: { kind } as { kind: 'composer' },
  isExpanded: true,
})

for (const surface of ['terminal', 'desktop'] as const) {
  test(`a prompt stays the engine's row by default on ${surface}`, async ($, on) => {
    on('ui.render', ($, e) => {
      const { Text } = $.ui.resolve(e)

      return h(Text, {}, 'the engine drew this') as RenderElement
    })
    const ui = await $.ui.mount({
      plugin: 'sotto',
      surface,
      component: 'UserMessage',
      requestId: 'm5',
      props: prompt('hello'),
    })
    expect(await ui.find({ type: 'Text', text: 'the engine drew this' })).toBeDefined()
  })

  test(`with the bubble on, a prompt is a dim outlined bubble on the right on ${surface}`, { options: { promptAlign: 'right' } }, async $ => {
    const ui = await $.ui.mount({
      plugin: 'sotto',
      surface,
      component: 'UserMessage',
      requestId: 'm0',
      props: prompt('hello'),
      viewport: { columns: 100, rows: 40 },
    })
    const [outer, inner] = await ui.findAll({ type: 'Box' })
    expect(outer?.props.justifyContent).toBe('flex-end')
    expect(inner?.props.borderStyle).toBe('round')
    expect(inner?.props.borderColor).toBe('subtle')
    expect(inner?.props.borderDimColor).toBe(true)
    expect((await ui.find({ type: 'Text', text: 'hello' }))?.props.backgroundColor).toBeUndefined()
  })

  test(`promptBorder as a colour and promptAlign left on ${surface}`, { options: { promptAlign: 'left', promptBorder: '#b8642a' } }, async $ => {
    const ui = await $.ui.mount({
      plugin: 'sotto',
      surface,
      component: 'UserMessage',
      requestId: 'm2',
      props: prompt('hello'),
      viewport: { columns: 100, rows: 40 },
    })
    const [outer, inner] = await ui.findAll({ type: 'Box' })
    expect(outer?.props.justifyContent).toBe('flex-start')
    expect(inner?.props.borderColor).toBe('#b8642a')
    expect(inner?.props.borderDimColor).toBe(false)
  })

  test(`promptBorder none is plain text on ${surface}`, { options: { promptAlign: 'right', promptBorder: 'none' } }, async $ => {
    const ui = await $.ui.mount({
      plugin: 'sotto',
      surface,
      component: 'UserMessage',
      requestId: 'm4',
      props: prompt('hello'),
      viewport: { columns: 100, rows: 40 },
    })
    const [, inner] = await ui.findAll({ type: 'Box' })
    expect(inner?.props.borderStyle).toBeUndefined()
    expect(inner?.props.backgroundColor).toBeUndefined()
  })

  test(`a notification row stays the engine's on ${surface}`, async ($, on) => {
    on('ui.render', ($, e) => {
      const { Text } = $.ui.resolve(e)

      return h(Text, {}, 'the engine drew this') as RenderElement
    })
    const ui = await $.ui.mount({
      plugin: 'sotto',
      surface,
      component: 'UserMessage',
      requestId: 'm3',
      props: prompt('a task finished', 'task-notification'),
    })
    expect(await ui.find({ type: 'Text', text: 'the engine drew this' })).toBeDefined()
  })
}

test('a pasted block in a prompt shows its text without the tags', () => {
  const text = 'look at this:\n<pasted_content id="1ee9">\none\ntwo\nthree\n</pasted_content id="1ee9">\nthanks'
  expect(spoken(text)).toBe('look at this:\none\ntwo\nthree\nthanks')
  expect(spoken('plain')).toBe('plain')
  expect(spoken('see:\n\n<pasted_content id="2">\na\n</pasted_content id="2">\n')).toBe('see:\n\na')
})

test('a prompt right after another prompt stacks on it; one after a reply stands apart', { options: { promptAlign: 'right' } }, async ($, on) => {
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)

    return h(Text, {}, 'the engine drew this') as RenderElement
  })
  const mount = (requestId: string, text: string) =>
    $.ui.mount({ plugin: 'sotto', surface: 'terminal', component: 'UserMessage', requestId, props: prompt(text), viewport: { columns: 100, rows: 40 } })
  const first = await mount('p1', 'i actually prefer master')
  const second = await mount('p2', 'but all good!')
  expect((await first.findAll({ type: 'Box' }))[0]?.props.marginTop).toBe(1)
  expect((await second.findAll({ type: 'Box' }))[0]?.props.marginTop).toBe(0)
  await $.ui.mount({ plugin: 'sotto', surface: 'terminal', component: 'AssistantMessage', requestId: 'a1', props: { text: 'noted', isFirstOfReply: true } })
  const third = await mount('p3', 'thanks')
  expect((await third.findAll({ type: 'Box' }))[0]?.props.marginTop).toBe(1)
})
