# fix-my-comments-mcp

MCP server for [Fix My Comments](https://github.com/duraisamy-gokul/fix-my-comments) — exposes local VS Code comment threads to AI agents (Claude Code, Cursor, Windsurf, etc.) through the [Model Context Protocol](https://modelcontextprotocol.io/).

The server is intentionally small: it reads and writes the same JSON files as the VS Code extension, under `~/.fixmycomments/<repo>-<hash>/<branch>/`, and communicates over stdio.

## How it works

- **Zero config** — the server derives storage from `process.cwd()` and the current Git branch.
- **Repo + branch scoped** — comments are isolated by repository and branch.
- **Shared with the extension** — the VS Code extension and MCP server read/write the same `threads.json` and `messages.json` files.
- **Stale-comment safe** — the server checks anchored line hashes against the current workspace file. Outdated threads are hidden by default and write actions are blocked.

> Run your agent from inside the repository root. If you start it from another directory, the server will resolve a different storage path.

## Installation

### Option A: Global install via npm (recommended)

```bash
npm install -g fix-my-comments-mcp
```

Then add it to Claude Code:

```bash
claude mcp add fix-my-comments --scope user -- fix-my-comments
```

### Option B: Local dev via npm link

```bash
git clone <this-repo>
cd fix-my-comments-mcp
npm install
npm run build
npm link
claude mcp add fix-my-comments --scope user -- fix-my-comments
```

## Available Tools

| Tool                      | Description                                                                                  |
| ------------------------- | -------------------------------------------------------------------------------------------- |
| `list_open_threads`       | List open, non-outdated threads for the current branch. Optionally filter by file path.      |
| `get_thread`              | Get a thread and its messages; use `messageLimit` to fetch only the latest messages.         |
| `get_message`             | Get one comment/message with its thread summary and position.                                |
| `get_message_context`     | Get one message plus N messages before/after it to avoid loading a whole long thread.        |
| `post_agent_reply`        | Append an AI reply, optionally tied to a message and optionally posted as a code suggestion. |
| `set_thread_status`       | Resolve or reopen a thread.                                                                  |
| `set_task_message_status` | Check or uncheck a task message.                                                             |
| `add_reaction`            | Add an emoji reaction to a message.                                                          |
| `remove_reaction`         | Remove an agent's emoji reaction from a message.                                             |

### Token-efficient reads

Agents should prefer the smallest read tool that answers the question:

- Use `list_open_threads` to discover work.
- Use `get_message` when a message id is already known.
- Use `get_message_context` to fetch a small window around one message.
- Use `get_thread` only when the whole thread is needed, or pass `messageLimit` for the latest messages.

### Outdated thread behavior

By default, the server filters out and blocks writes to outdated threads whose anchored line changed.

- `list_open_threads` excludes outdated threads unless `includeOutdated=true`.
- `get_thread`, `get_message`, and `get_message_context` require `includeOutdated=true` to inspect stale comments.
- `post_agent_reply`, `set_task_message_status`, `add_reaction`, and `remove_reaction` are blocked on outdated threads.

## Requirements

- Node.js 18+
- The [Fix My Comments](https://github.com/duraisamy-gokul/fix-my-comments) VS Code extension installed and active in the project
