# fix-my-comments-mcp

MCP server for [Fix My Comments](https://github.com/fix-my-comments/fix-my-comments) — exposes code review tasks to AI agents (Claude Code, Cursor, etc.) via the [Model Context Protocol](https://modelcontextprotocol.io/).

## How it works

The server reads task data from the `.fixmycomments/<branch>/` directory at the root of your Git repository. This directory is written by the **Fix My Comments** VS Code extension.

- **Zero config** — the server auto-discovers the storage path based on `process.cwd()` and the current Git branch.
- **Branch-scoped** — tasks are isolated per Git branch, matching VS Code workspace state.

## Installation

### Option A: Global install via npm (recommended)

```bash
npm install -g fix-my-comments-mcp
```

Then add to Claude Code:

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

| Tool | Description |
|------|-------------|
| `list_open_tasks` | List all open tasks for the current branch. Optionally filter by file path. |
| `get_task_thread` | Get a task and its full message thread. |
| `post_agent_reply` | Append a reply to a task thread as an AI agent. |
| `set_task_status` | Set a task status (`resolved` or `requires_review`). |

## Requirements

- Node.js 18+
- The [Fix My Comments](https://marketplace.visualstudio.com/items?itemName=fix-my-comments.fix-my-comments) VS Code extension installed and active in the project
