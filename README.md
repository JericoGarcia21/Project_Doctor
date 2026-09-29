# Project Doctor

A VS Code extension that analyzes entire software projects for issues, dependencies, and code relationships — going beyond single-file analysis to provide project-level insights.

## Purpose

Project Doctor is designed to analyze software projects holistically rather than file-by-file. It scans your entire project structure, understands technology stacks, detects broken imports and references, analyzes dependencies, identifies security issues, and builds a relationship graph between project components.

This extension helps developers:
- Understand project architecture and dependencies
- Detect broken imports and missing references
- Identify potential security issues
- Track project health over time
- Visualize code relationships
- Understand change impact across the project

## Current Features (Phase 1 - Foundation)

✅ **Project Scanning**
- Automatic project structure discovery
- Technology detection (Node.js, TypeScript, PHP, Laravel, Vite)
- Package manager detection (npm, yarn, pnpm, composer)
- Git repository detection
- Configurable file enumeration with smart ignoring

✅ **Basic Analysis**
- Dependency analysis
- File size analysis
- Security configuration checks
- Environment file detection

✅ **Dashboard**
- Clean VS Code webview-based dashboard
- Project statistics and health metrics
- Scan history tracking
- Finding visualization

✅ **Data Persistence**
- SQLite-based local storage
- Scan history tracking
- Finding storage and retrieval
- Project relationship storage foundation

✅ **Architecture**
- Modular analyzer system
- Extensible parser architecture
- Graph-based relationship model
- Clean separation of concerns

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     VS Code Extension                        │
├─────────────────────────────────────────────────────────────┤
│  Commands          │  Dashboard (Webview)                    │
│  - Scan Project    │  - Project Statistics                   │
│  - Open Dashboard  │  - Finding Visualization                │
└──────────┬─────────┴──────────────────────────┬─────────────┘
           │                                     │
           ▼                                     ▼
┌──────────────────────┐            ┌───────────────────────┐
│   Project Scanner    │            │   Finding Manager     │
├──────────────────────┤            ├───────────────────────┤
│  - Discover Structure│            │  - Collect Findings   │
│  - Detect Tech Stack │            │  - Categorize Issues  │
│  - Enumerate Files   │            │  - Severity Analysis  │
└──────────┬───────────┘            └───────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────────┐
│                       Analyzers                               │
├─────────────┬─────────────┬─────────────┬───────────────────┤
│  Import     │ Dependency  │    File     │    Security       │
│  Analyzer   │  Analyzer   │  Analyzer   │    Analyzer       │
└─────────────┴─────────────┴─────────────┴───────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────────┐
│                         Parsers                               │
├──────────────────────────┬───────────────────────────────────┤
│  TypeScript/JavaScript   │         PHP (Laravel)             │
└──────────────────────────┴───────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────────┐
│                     Project Graph                             │
│                   (Relationship Model)                        │
└──────────────────────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────────┐
│                  Database (SQLite)                            │
│   - Projects  - Scans  - Findings  - Relationships           │
└──────────────────────────────────────────────────────────────┘
```

## Tech Stack

**Core:**
- TypeScript
- Node.js
- VS Code Extension API

**UI:**
- VS Code Webview API
- HTML/CSS (with VS Code theming)

**Code Analysis:**
- TypeScript Compiler API (for AST parsing)
- PHP Parser (designed for future Laravel analysis)

**Project Relationship Model:**
- Graphology (graph data structure library)

**Git Integration:**
- simple-git

**Local Storage:**
- SQLite (via better-sqlite3)

**Testing:**
- Vitest

**Packaging:**
- VSCE (VS Code Extension CLI)

## Development

### Prerequisites
- Node.js (v18+)
- npm or yarn

### Setup

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Watch mode (for development)
npm run watch

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Lint code
npm run lint

# Package extension
npm run package
```

### Running the Extension

1. Open the project in VS Code
2. Press `F5` to launch Extension Development Host
3. In the new VS Code window, open a project folder
4. Open the Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`)
5. Run: **Project Doctor: Scan Project**
6. Run: **Project Doctor: Open Dashboard** to view results

### Project Structure

```
project-doctor/
├── src/
│   ├── extension.ts              # Extension entry point
│   ├── core/                     # Core scanning logic
│   │   ├── ProjectContext.ts     # Project metadata
│   │   ├── ProjectScanner.ts     # Main scanner
│   │   ├── ScanResult.ts         # Scan results
│   │   └── types.ts              # Core type definitions
│   ├── analyzers/                # Pluggable analyzers
│   │   ├── Analyzer.ts           # Base analyzer interface
│   │   ├── DependencyAnalyzer.ts
│   │   ├── FileAnalyzer.ts
│   │   ├── ImportAnalyzer.ts
│   │   └── SecurityAnalyzer.ts
│   ├── parsers/                  # Language parsers
│   │   ├── Parser.ts
│   │   ├── TypeScriptParser.ts
│   │   └── PHPParser.ts
│   ├── graph/                    # Relationship graph
│   │   ├── ProjectGraph.ts
│   │   ├── GraphNode.ts
│   │   └── GraphEdge.ts
│   ├── git/                      # Git integration
│   │   └── GitService.ts
│   ├── database/                 # SQLite storage
│   │   ├── Database.ts
│   │   └── repositories/
│   ├── diagnostics/              # Finding management
│   │   ├── Finding.ts
│   │   └── FindingManager.ts
│   ├── commands/                 # VS Code commands
│   │   ├── ScanProjectCommand.ts
│   │   └── OpenDashboardCommand.ts
│   └── utils/                    # Utilities
└── tests/                        # Vitest tests
```

## Commands

- **Project Doctor: Scan Project** - Analyzes the current workspace and detects issues
- **Project Doctor: Open Dashboard** - Opens the Project Doctor dashboard with scan results

## Roadmap

### Phase 1 — Foundation ✅ (Current)
- [x] VS Code extension setup
- [x] Project scanner foundation
- [x] Analyzer architecture
- [x] Basic technology detection
- [x] Database foundation
- [x] Dashboard foundation
- [x] Git service foundation
- [x] Graph model foundation

### Phase 2 — Project Scanner
- [ ] Advanced file enumeration
- [ ] TypeScript AST parsing
- [ ] Import/export detection
- [ ] Dependency tree building
- [ ] Configuration validation
- [ ] Performance optimization

### Phase 3 — Code Relationship Analysis
- [ ] Full TypeScript analysis
- [ ] PHP/Laravel analysis
- [ ] Component relationship mapping
- [ ] API flow detection
- [ ] Database schema inference
- [ ] Graph visualization

### Phase 4 — Problem Detection
- [ ] Broken import detection
- [ ] Unused dependency detection
- [ ] Dead code detection
- [ ] Circular dependency detection
- [ ] Security vulnerability scanning
- [ ] Configuration issue detection

### Phase 5 — Impact Analysis
- [ ] Change impact prediction
- [ ] Dependency impact analysis
- [ ] "What Did I Break?" feature
- [ ] Risk scoring

### Phase 6 — Git Analysis
- [ ] Commit history analysis
- [ ] File change tracking
- [ ] Historical problem tracking
- [ ] Regression detection

### Phase 7 — Dashboard Improvements
- [ ] Interactive graph visualization
- [ ] Filtering and search
- [ ] Trend analysis
- [ ] Export functionality
- [ ] Custom reports

### Phase 8 — AI Integration
- [ ] AI-powered finding explanations
- [ ] Automated fix suggestions
- [ ] Natural language queries
- [ ] Smart recommendations

## Contributing

This project is in active development. Contributions, issues, and feature requests are welcome!

## License

MIT License - See LICENSE file for details

---

**Project Doctor** - Analyze your entire project, not just individual files.
