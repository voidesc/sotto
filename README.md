# sotto

_sotto voce_

A Claude Code mod that turns the transcript into a chat:
every tool call is one quiet line, and the commands and their output stay out
of the way.

What a turn looks like with it:

```
> why is the nightly build failing?

● I'll look at the last run.
 Show the last nightly run's log · 40 lines
 read build.yml
 searched the web: ubuntu 24.04 openssl 3 libcrypto missing
● The runner image moved to OpenSSL 3 last week and the build still links
  against 1.1. The fix is one line in build.yml.
 edited build.yml
 Run the build locally · 12 lines
```

Each line says what Claude did, in its own words where it has them: a shell
command shows its description, a file its name, a web search its query, an
agent its task. A glyph in front marks the kind of call and its colour the
state: running, done, failed, interrupted. The output under a call is not
drawn, except an error's.


## Install

Claude Code 2.1.287 or newer. At the prompt of a terminal session:

```
/plugin install sotto --marketplace voidesc/sotto
```

Answer `y` to add the marketplace, then pick the user scope.

## Use

`/sotto` toggles it; `/sotto on` and `/sotto off` set it. Off, the usual
rows are back. `ctrl+o` still shows everything as it was.

Optionally, in `/config` under sotto, your own prompts can be drawn as
bubbles: **Prompt bubble** `right` or `left` (off by default), and **Prompt
outline** `dim`, a colour such as `#b8642a`, or `none`.

The glyphs are Nerd Font symbols; without one they show as boxes.

## License

MIT.
