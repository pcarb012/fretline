# Fretline

Browser guitar trainer (Vite, plain JS). `npm test` runs the unit tests with coverage,
`npm run build` the production build, `npm run e2e` the fake-microphone replays. See README.md.

## Skills

Two skill systems are installed in `.claude/`:

- **GSD Core** (`/gsd-*` commands, agents and hooks), installed with
  `npx @opengsd/gsd-core@1.16.0 --claude --local --relative-includes`. Its hooks live in
  `.claude/settings.json`. Reinstall or `--uninstall` with the same tool rather than editing
  its files by hand.
- **task-observer** (`.claude/skills/task-observer/`, from
  github.com/rebelytics/one-skill-to-rule-them-all at 56e8907, v3.6.0).

### task-observer activation

The observation log lives in this repository at `skill-observations/`, at the repository root
(`/home/user/fretline` in Claude Code cloud sessions). Cloud containers are discarded after a
session, so observation files must be committed and pushed with the session's branch, or they
are lost.

Before the first tool call of any session — and before writing or
proposing a plan, not merely before executing one — invoke the
task-observer skill AND execute its Session Start Protocol (storage
check, frontmatter scan, review trigger). Loading the skill and running
the protocol are separate steps; a session that loads the file and stops
has activated nothing. Any turn that will involve a tool call counts; do
not classify the session as "too simple" from its opening message.

Select skills on the DECISION the request is about, not on the artefact it
arrived as. Name what the user is deciding, then match the installed skill
descriptions against that — a request handed over as a file to review
still needs the skill whose description names its subject.

After completing each task, list the observation records written this
session in the same turn and report a one-line summary from that listing
(ids and titles, or "none logged and why") — never from memory of
writing them. This is the activation backstop: it forces a look at the log,
so a session that silently skipped the protocol is discovered at the
first task boundary instead of never.

Loading a skill is not complete until you have queried the observation
log for OPEN observations naming it and read their bodies:
  find "<repository root>/skill-observations/observation-log" -maxdepth 1 \
    -name '*.md' -exec grep -l "skill:.*<skill-name>" {} +
(<skill-name> is the bare name: drop a plugin: prefix, up to the last
colon.) Apply their insights to the current work; editing a skill file
because of an observation waits for the review (see "Log, don't act" in
the skill's SKILL.md).
