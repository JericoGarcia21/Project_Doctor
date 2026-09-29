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

## Current Status

**Phase 1 and Phase 2 are complete. Phase 3 is in progress.** The scanner builds a relationship graph for TypeScript/JavaScript projects and performs initial Laravel route/controller analysis. Relationship analysis is currently limited to the first 100 TypeScript/JavaScript source files per scan.

## Current Features

✅ **Project Scanning**
- Automatic project structure discovery
- Technology detection (Node.js, TypeScript, PHP, Laravel, Vite)
- Package manager detection (npm, yarn, pnpm, composer)
- Git repository detection
- Configurable file enumeration with smart ignoring

✅ **Project Analysis**
- Dependency analysis
- File size analysis
- Security configuration checks
- Environment file detection
- Framework detection and configuration validation
- Import/export analysis, dependency graphs, and circular import detection

✅ **Code Relationship Analysis (Phase 3 in progress)**
- TypeScript/JavaScript call, import, inheritance, implementation, decorator, mixin, callback, and named JSX handler relationships
- Cross-file symbol resolution for named/default imports, re-exports, and `tsconfig` path aliases
- Relationship graph returned with each scan result
- Laravel `routes/web.php` and `routes/api.php` analysis for common routes, resource routes, and route groups
- Route-to-controller and route-to-public-action mapping, including action parameter metadata
- PHP parsing powered by `php-parser`

Phase 3 work still planned includes anonymous inline callbacks, Laravel middleware and model/Blade analysis, frontend component relationships, API/data-flow mapping, and graph visualization. See [ROADMAP.md](ROADMAP.md) for details.

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
- TypeScript Compiler API (AST parsing and symbol relationships)
- `php-parser` (PHP AST parsing and Laravel route/controller analysis)

**Project Relationship Model:**
- Graphology (graph data structure library)

**Git Integration:**
- simple-git

**Local Storage:**
- SQLite database compiled and accessed through `sql.js`

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
│   │   ├── ASTParser.ts
│   │   ├── TypeScriptParser.ts
│   │   ├── PHPParser.ts
│   │   └── LockFileParser.ts
│   ├── graph/                    # Relationship graph
│   │   ├── ProjectGraph.ts
│   │   ├── ImportGraph.ts
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

### Phase 1 — Foundation ✅ Complete
- [x] VS Code extension setup
- [x] Project scanner foundation
- [x] Analyzer architecture
- [x] Basic technology detection
- [x] Database foundation
- [x] Dashboard foundation
- [x] Git service foundation
- [x] Graph model foundation

### Phase 2 — Advanced Project Scanner ✅ Complete
- [x] Advanced file enumeration and framework detection
- [x] TypeScript/JavaScript AST parsing and import/export detection
- [x] Dependency tree building and circular dependency detection
- [x] Configuration validation
- [x] Scan caching and performance statistics

### Phase 3 — Code Relationship Analysis
- [x] TypeScript/JavaScript calls, imports, class relationships, callbacks, and named JSX handlers
- [x] Cross-file symbols, re-exports, and TypeScript path aliases
- [x] Initial Laravel route groups, controller actions, and route-to-action mapping
- [ ] Complete PHP/Laravel analysis (middleware, models, Blade templates)
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
