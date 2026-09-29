# Phase 2 - Advanced Project Scanner

## 🎯 Sprint Plan

**Goal**: Implement deep project structure analysis and intelligent file scanning

**Timeline**: 3-4 weeks  
**Start Date**: 2026-09-29  
**Priority**: HIGH 🔥

---

## 📋 Sprint Breakdown

### Sprint 1 (Week 1-2): TypeScript AST Parsing & Import Detection

#### Week 1: Setup & Basic Parsing
- [ ] Add TypeScript Compiler API dependency
- [ ] Create enhanced TypeScriptParser with AST support
- [ ] Implement import statement extraction
- [ ] Implement export statement extraction
- [ ] Write parser tests

#### Week 2: Advanced Parsing & Graph Building
- [ ] Extract function signatures
- [ ] Extract class definitions
- [ ] Extract interfaces and types
- [ ] Build import dependency graph
- [ ] Handle dynamic imports

### Sprint 2 (Week 3-4): Enhanced Scanning & Optimization

#### Week 3: Technology & Framework Detection
- [ ] Detect React (components, hooks)
- [ ] Detect Vue (components, composition API)
- [ ] Detect Angular
- [ ] Detect Next.js/Nuxt
- [ ] Detect build tools (Webpack, Rollup, esbuild)
- [ ] Detect testing frameworks (Jest, Vitest, Mocha)

#### Week 4: Performance & Polish
- [ ] Implement incremental scanning
- [ ] Add caching mechanism
- [ ] Parallel file processing
- [ ] Lock file analysis
- [ ] Configuration validation
- [ ] Performance tests

---

## 🔨 Implementation Tasks

### Task 1: Enhanced TypeScript Parser
**Priority**: Critical 🔥  
**Estimated Time**: 3-4 days

**Requirements**:
- Use TypeScript Compiler API
- Parse imports (default, named, namespace, side-effect)
- Parse exports (default, named, re-exports)
- Extract function signatures
- Extract class definitions
- Handle JSX/TSX
- Support ES6+ features

**Files to Create/Modify**:
- `src/parsers/TypeScriptParser.ts` (enhance existing)
- `src/parsers/ASTParser.ts` (new)
- `tests/parsers/TypeScriptParser.test.ts` (new)

### Task 2: Import/Export Graph Builder
**Priority**: Critical 🔥  
**Estimated Time**: 2-3 days

**Requirements**:
- Build directed graph of imports
- Track import types
- Detect circular imports
- Calculate module dependencies
- Support barrel exports

**Files to Create**:
- `src/graph/ImportGraph.ts`
- `src/graph/ImportNode.ts`
- `tests/graph/ImportGraph.test.ts`

### Task 3: Dependency Tree Analyzer
**Priority**: High  
**Estimated Time**: 2 days

**Requirements**:
- Parse package.json dependencies
- Parse lock files (npm, yarn, pnpm)
- Build dependency tree
- Detect version conflicts
- Identify dev vs prod dependencies

**Files to Create**:
- `src/analyzers/DependencyTreeAnalyzer.ts`
- `src/parsers/LockFileParser.ts`
- `tests/analyzers/DependencyTreeAnalyzer.test.ts`

### Task 4: Framework Detection
**Priority**: High  
**Estimated Time**: 2-3 days

**Requirements**:
- Detect React (check for JSX, hooks usage)
- Detect Vue (check for .vue files, composition API)
- Detect Angular (check for decorators, modules)
- Detect Next.js (check for pages/, app/ directories)
- Detect Laravel (already done in Phase 1)

**Files to Create**:
- `src/detectors/FrameworkDetector.ts`
- `src/detectors/ReactDetector.ts`
- `src/detectors/VueDetector.ts`
- `tests/detectors/FrameworkDetector.test.ts`

### Task 5: Build Tool Detection
**Priority**: Medium  
**Estimated Time**: 1-2 days

**Requirements**:
- Detect Webpack
- Detect Vite (already done in Phase 1)
- Detect Rollup
- Detect esbuild
- Detect Parcel

**Files to Modify**:
- `src/core/ProjectScanner.ts` (enhance)

### Task 6: Configuration Validator
**Priority**: Medium  
**Estimated Time**: 2 days

**Requirements**:
- Validate tsconfig.json
- Validate package.json (scripts, dependencies)
- Check ESLint config
- Check Prettier config
- Report misconfigurations

**Files to Create**:
- `src/validators/ConfigValidator.ts`
- `src/validators/TSConfigValidator.ts`
- `tests/validators/ConfigValidator.test.ts`

### Task 7: Performance Optimization
**Priority**: High  
**Estimated Time**: 2-3 days

**Requirements**:
- Implement file caching
- Incremental scanning (only scan changed files)
- Parallel processing with worker threads
- Memory optimization
- Benchmark tests

**Files to Create**:
- `src/cache/ScanCache.ts`
- `src/workers/FileWorker.ts`
- `tests/performance/ScanPerformance.test.ts`

---

## 🎯 Success Criteria

### Must Have:
- [x] Parse 100% of TypeScript files without errors
- [ ] Extract all imports and exports
- [ ] Build complete import dependency graph
- [ ] Detect React, Vue, Angular frameworks
- [ ] Scan 10,000+ files in under 5 seconds
- [ ] Pass all existing tests (20/20)
- [ ] Add 30+ new tests for Phase 2 features

### Nice to Have:
- [ ] Incremental scanning working
- [ ] Configuration validation
- [ ] Lock file analysis
- [ ] Parallel processing

---

## 📊 Testing Strategy

### Unit Tests (Target: 50+ tests)
- [ ] TypeScript parser tests (10 tests)
- [ ] Import graph tests (8 tests)
- [ ] Framework detection tests (12 tests)
- [ ] Dependency tree tests (10 tests)
- [ ] Configuration validator tests (10 tests)

### Integration Tests (Target: 10+ tests)
- [ ] Full project scan tests
- [ ] Import graph building tests
- [ ] Framework detection integration tests

### Performance Tests (Target: 5+ tests)
- [ ] Scan 1,000 files benchmark
- [ ] Scan 10,000 files benchmark
- [ ] Memory usage tests
- [ ] Cache performance tests

---

## 🗂️ New Dependencies

Add to package.json:
```json
{
  "dependencies": {
    "typescript": "^5.3.0" // Already installed
  }
}
```

No new dependencies needed! We'll use the TypeScript Compiler API that's already included.

---

## 📁 File Structure for Phase 2

```
src/
├── parsers/
│   ├── Parser.ts (existing)
│   ├── TypeScriptParser.ts (enhance)
│   ├── ASTParser.ts (new)
│   ├── LockFileParser.ts (new)
│   └── PHPParser.ts (existing)
├── graph/
│   ├── ProjectGraph.ts (existing)
│   ├── ImportGraph.ts (new)
│   ├── ImportNode.ts (new)
│   └── GraphNode.ts (existing)
├── analyzers/
│   ├── DependencyTreeAnalyzer.ts (new)
│   └── [existing analyzers]
├── detectors/
│   ├── FrameworkDetector.ts (new)
│   ├── ReactDetector.ts (new)
│   ├── VueDetector.ts (new)
│   └── AngularDetector.ts (new)
├── validators/
│   ├── ConfigValidator.ts (new)
│   ├── TSConfigValidator.ts (new)
│   └── PackageJsonValidator.ts (new)
├── cache/
│   └── ScanCache.ts (new)
└── workers/
    └── FileWorker.ts (new)

tests/
├── parsers/
│   ├── TypeScriptParser.test.ts (new)
│   └── LockFileParser.test.ts (new)
├── graph/
│   └── ImportGraph.test.ts (new)
├── analyzers/
│   └── DependencyTreeAnalyzer.test.ts (new)
├── detectors/
│   └── FrameworkDetector.test.ts (new)
└── validators/
    └── ConfigValidator.test.ts (new)
```

---

## 🚀 Getting Started

### Step 1: Enhanced TypeScript Parser (Start Here)
We'll begin by creating a robust TypeScript parser that can:
1. Parse TypeScript/JavaScript files using the TS Compiler API
2. Extract imports and exports
3. Extract function and class definitions
4. Build an AST representation

### Step 2: Import Graph
Build a graph of all imports/exports to visualize dependencies.

### Step 3: Framework Detection
Detect React, Vue, Angular, and other frameworks.

### Step 4: Optimize Performance
Add caching and parallel processing.

---

## 📝 Development Notes

### TypeScript Compiler API Resources:
- Official Docs: https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API
- AST Viewer: https://ts-ast-viewer.com/

### Best Practices:
1. **Parse in Memory**: Don't write files to disk
2. **Cache Results**: Cache AST parsing results
3. **Fail Gracefully**: Don't crash on parse errors
4. **Progress Reporting**: Show progress for long scans
5. **Test with Real Projects**: Test with actual React, Vue, Angular projects

---

## 🎯 Week 1 Goals (This Week)

**Primary Goal**: Get TypeScript AST parsing working

**Tasks**:
1. ✅ Review TypeScript Compiler API documentation
2. [ ] Create ASTParser.ts
3. [ ] Enhance TypeScriptParser.ts with AST support
4. [ ] Extract imports from .ts files
5. [ ] Write tests for parser
6. [ ] Test with real TypeScript project

**Deliverable**: Parser that extracts all imports from TypeScript files

---

## 📊 Progress Tracking

Update daily:
- **Day 1**: Setup TypeScript Compiler API, create ASTParser
- **Day 2**: Implement import extraction
- **Day 3**: Implement export extraction
- **Day 4**: Extract functions and classes
- **Day 5**: Write tests and fix bugs

---

**Ready to start? Let's build the enhanced TypeScript parser!** 🚀
