// sotto: tool calls sotto voce, the transcript as a chat. Every tool call is one dim line, an icon first, saying what
// Claude did (a Bash call's description, "read lib.ts", "called getJiraIssue (atlassian)") and how
// it went (… while it runs, N lines, failed, interrupted). The result block under a call is not
// drawn, except an error's. Folded runs ("Read 3 files") are unfolded so every call gets its line.
// Opt-in: your own prompts as bubbles (promptAlign: off, right, left), outlined (promptBorder: dim, a colour, none).
//   /sotto        toggle it
//   /sotto on|off set it
// Off, the engine draws its own rows; ctrl+o still shows everything as the engine stores it.
import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import { bubble, line, spoken } from './lib'

const isOn = atom({ plugin: 'sotto', key: 'isOn' } as const, true)

/** Dialogs stay the engine's: a tool whose row is a question needs its own drawing. */
const DIALOGS = new Set(['AskUserQuestion', 'ExitPlanMode'])

/** Components that are not rows of the transcript: they say nothing about what came before a prompt. */
const NOT_ROWS = new Set(['AskUserQuestion', 'Spinner', 'PromptHint', 'AbovePrompt', 'Pane', 'SessionMode', 'ToolProgress'])

/**
 * The transcript's rows in the order they were first drawn, enough to know whether a prompt
 * follows another prompt directly: those stack as one run of bubbles. Module state: a reload
 * starts over, and the rows are drawn again from the top.
 */
const seen = new Map<string, boolean>()
let lastWasPrompt = false

function follows(component: string, requestId: string, isPrompt: boolean): boolean {
  const key = `${component}:${requestId}`
  const known = seen.get(key)
  if (known !== undefined) return known
  const joined = isPrompt && lastWasPrompt
  seen.set(key, joined)
  if (!NOT_ROWS.has(component)) lastWasPrompt = isPrompt
  if (seen.size > 2000) seen.delete(seen.keys().next().value as string)

  return joined
}

export const register: Register = (on, options) => {
  const bubbles = options.promptAlign === 'right' || options.promptAlign === 'left'
  const align = options.promptAlign === 'left' ? 'flex-start' : 'flex-end'
  const border = typeof options.promptBorder === 'string' && options.promptBorder.trim() !== '' ? options.promptBorder.trim() : 'dim'
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'sotto',
      description: 'Tool calls as one line each: /sotto toggles, /sotto on, /sotto off',
      argumentHint: '[on|off]',
    })

    return next(e)
  })

  on('command.run', { command: 'sotto' }, async ($, e) => {
    const word = e.args.trim()
    const was = await read($, isOn)
    const now = word === 'on' ? true : word === 'off' ? false : !was
    await update($, isOn, () => now)

    return { text: now ? 'sotto: tool calls as one line each' : 'sotto: off, the usual tool rows' }
  })

  on('ui.render', { component: 'ToolUse' }, async ($, e, next) => {
    if (DIALOGS.has(e.props.tool) || !(await read($, isOn))) return next(e)
    const { Box, Text } = $.ui.resolve(e)
    const { icon, text } = line(e.props)
    const color = e.props.isInterrupted ? 'warning' : e.props.isErrored ? 'error' : e.props.isRunning ? 'claude' : 'success'

    return (
      <Box width={e.viewport?.columns}>
        <Text color={color}>{icon} </Text>
        <Text dimColor wrap="truncate-end">
          {text}
        </Text>
      </Box>
    )
  })

  // every other row, so a prompt knows what it follows
  on('ui.render', ($, e, next) => {
    follows(e.component, e.requestId, e.component === 'UserMessage' && e.props.origin.kind === 'composer')

    return next(e)
  })

  on('ui.render', { component: 'UserMessage', props: { origin: { kind: 'composer' } } }, async ($, e, next) => {
    const joined = follows(e.component, e.requestId, true)
    if (!bubbles || !(await read($, isOn))) return next(e)
    const { Box, Text } = $.ui.resolve(e)
    const text = spoken(e.props.text)
    const width = bubble(text, e.viewport?.columns, border === 'none' ? 2 : 4)

    return (
      <Box justifyContent={align} marginTop={joined ? 0 : 1}>
        {border === 'none' ? (
          <Box width={width} paddingX={1}>
            <Text>{text}</Text>
          </Box>
        ) : (
          <Box width={width} paddingX={1} borderStyle="round" borderColor={border === 'dim' ? 'subtle' : border} borderDimColor={border === 'dim'}>
            <Text>{text}</Text>
          </Box>
        )}
      </Box>
    )
  })

  on('ui.render', { component: 'ToolResult' }, async ($, e, next) => {
    if (e.props.isErrored || !(await read($, isOn))) return next(e)
    const { Box } = $.ui.resolve(e)

    return <Box />
  })

  on('ui.render', { component: 'ToolGroup' }, async ($, e, next) =>
    (await read($, isOn)) ? next({ ...e, props: { ...e.props, isExpanded: true } }) : next(e),
  )
}
