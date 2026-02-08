# Claude Branch Visualiser

A web app that visualises branching conversations from [Claude.ai](https://claude.ai) as interactive tree diagrams.

Claude conversations branch when you edit a message or retry a response. This tool lets you see the full tree structure, navigate between branches, and search across messages.

## Features

- **Tree Visualisation** - Interactive GoJS-powered tree diagram with nodes colour-coded by sender
- **Message Details** - Click any node to view the full message content, branch path, and timestamps
- **Search** - Full-text search within the current chat or across all uploaded chats (keyboard shortcut: `S`)
- **Heatmap Mode** - Colour nodes by message recency to see conversation activity over time (keyboard shortcut: `H`)
- **Persistent Storage** - All data stored locally in IndexedDB, nothing leaves your browser
- **Fileserver Sync** - Optional sync with a remote fileserver for shared access (Authentication required)

## Getting Started

### Prerequisites

- Node.js

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Opens at [localhost:5173](http://localhost:5173).

### Build

```bash
npm run build
```

## Usage

1. Open a conversation on [claude.ai](https://claude.ai)
2. Open browser developer tools and go to the **Network** tab
3. Reload the page if needed
4. Filter requests by typing `tree`
5. Click the matching request and go to its **Response** tab
6. Copy the full response content and save it as a `.json` file
7. Upload the file using the sidebar

## Tech Stack

- React 19 + TypeScript
- GoJS for tree rendering
- Vite
- IndexedDB for client-side persistence
