// What one tool call reads as in a chat: an icon (Nerd Font glyphs, single cell) and one short line.
// Pure: the row's props in, the line out.

export type Row = {
  tool: string
  input: unknown
  isRunning: boolean
  isErrored: boolean
  isInterrupted: boolean
  output?: unknown
}

export type Line = { icon: string; text: string }

type Input = Record<string, unknown>

/** Nerd Font glyphs: nf-fa-* in U+F000-U+F2E0, nf-md-robot in the Material range. */
export const ICON = {
  shell: '',
  read: '',
  edit: '',
  agent: '\u{f06a9}',
  web: '',
  skill: '',
  watch: '',
  tools: '',
  publish: '',
  plug: '',
  list: '',
  other: '',
} as const

export const WIDTH = 100

export const shorten = (text: string, width = WIDTH) => {
  const one = text.replace(/\s+/g, ' ').trim()

  return one.length > width ? `${one.slice(0, width - 1)}…` : one
}

export const base = (path: string) => path.replace(/\/+$/, '').split('/').pop() || path

const str = (input: Input, key: string) => (typeof input[key] === 'string' ? (input[key] as string) : '')

const host = (url: string) => {
  try {
    return new URL(url).host || url
  } catch {
    return url
  }
}

/** `mcp__plugin_atlassian_atlassian__getJiraIssue` -> `getJiraIssue (atlassian)`; anything else as it is. */
export const mcpName = (tool: string) => {
  const m = /^mcp__(.+?)__(.+)$/.exec(tool)
  if (!m || m[1] === undefined) return tool
  const server = m[1].replace(/^plugin_/, '').split('_').filter((part, i, all) => all.indexOf(part) === i).join('_')

  return `${m[2]} (${server})`
}

/** The call itself, as one line without its status. */
export function describe(tool: string, raw: unknown): Line {
  const input: Input = raw !== null && typeof raw === 'object' ? (raw as Input) : {}

  switch (tool) {
    case 'Bash': {
      const command = str(input, 'command')
      const text = str(input, 'description') || shorten(command.split('\n')[0] ?? '', 72)

      return { icon: ICON.shell, text: input.run_in_background === true ? `${text} (in the background)` : text }
    }
    case 'Read': {
      const offset = typeof input.offset === 'number' ? ` from line ${input.offset}` : ''

      return { icon: ICON.read, text: `read ${base(str(input, 'file_path'))}${offset}` }
    }
    case 'Edit':
    case 'NotebookEdit':
      return { icon: ICON.edit, text: `edited ${base(str(input, 'file_path') || str(input, 'notebook_path'))}` }
    case 'Write':
      return { icon: ICON.edit, text: `wrote ${base(str(input, 'file_path'))}` }
    case 'Agent':
      return { icon: ICON.agent, text: `agent: ${str(input, 'description') || str(input, 'subagent_type') || 'a task'}` }
    case 'WebFetch':
      return { icon: ICON.web, text: `fetched ${host(str(input, 'url'))}` }
    case 'WebSearch':
      return { icon: ICON.web, text: `searched the web: ${str(input, 'query')}` }
    case 'Skill':
      return { icon: ICON.skill, text: `skill ${str(input, 'skill')}${str(input, 'args') ? ` ${str(input, 'args')}` : ''}` }
    case 'Monitor':
      return { icon: ICON.watch, text: `watched: ${str(input, 'description')}` }
    case 'ToolSearch':
      return { icon: ICON.tools, text: `looked up tools: ${str(input, 'query')}` }
    case 'TodoWrite':
      return { icon: ICON.list, text: 'updated the todo list' }
    case 'Artifact': {
      const action = str(input, 'action') || 'publish'
      const what = str(input, 'file_path') ? ` ${base(str(input, 'file_path'))}` : str(input, 'url') ? ` ${str(input, 'url')}` : ''

      return { icon: ICON.publish, text: `artifact ${action}${what}` }
    }
    default: {
      if (tool.startsWith('mcp__')) return { icon: ICON.plug, text: `called ${mcpName(tool)}` }
      const first = Object.values(input).find(v => typeof v === 'string' && v.length > 0)

      return { icon: ICON.other, text: `${tool}${typeof first === 'string' ? `: ${shorten(first, 60)}` : ''}` }
    }
  }
}

const count = (text: unknown) => (typeof text === 'string' && text.length > 0 ? text.split('\n').filter(l => l.length > 0).length : 0)

/** What came back, in a few words; '' when nothing to say. */
export function outcome(row: Row): string {
  if (row.isInterrupted) return 'interrupted'
  if (row.isErrored) return 'failed'
  if (row.isRunning) return '…'
  if (row.tool === 'Bash' && row.output !== null && typeof row.output === 'object') {
    const out = row.output as Input
    const n = count(out.stdout) + count(out.stderr)

    return n === 0 ? '' : n === 1 ? '1 line' : `${n} lines`
  }

  return ''
}

/** The whole line: `<icon>` and `<what> · <outcome>`. */
export function line(row: Row): Line {
  const { icon, text } = describe(row.tool, row.input)
  const note = outcome(row)

  return { icon, text: shorten(note === '' ? text : note === '…' ? `${text} …` : `${text} · ${note}`) }
}

/** Share of the transcript a prompt bubble may take before its text wraps. */
export const BUBBLE_SHARE = 0.72

/**
 * How wide a prompt bubble is: its longest line plus `frame` cells (padding, a border), capped
 * at a share of the transcript; undefined where nothing measured the transcript, so the box
 * sizes itself.
 */
export function bubble(text: string, columns: number | undefined, frame: number): number | undefined {
  if (columns === undefined) return undefined
  const longest = Math.max(1, ...text.split('\n').map(l => l.length))

  return Math.min(longest + frame, Math.max(frame + 8, Math.floor(columns * BUBBLE_SHARE)))
}

const PASTE = /<pasted_content id="([^"]*)">\n?([\s\S]*?)\n?<\/pasted_content id="\1">/g

/** A prompt as a bubble shows it: a pasted block as its text, without the tags around it. */
export function spoken(text: string): string {
  return text.replace(PASTE, (_, __, body: string) => body).trim()
}
