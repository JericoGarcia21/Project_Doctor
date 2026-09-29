import * as ts from 'typescript';

export interface ASTImport {
  moduleName: string;
  importType: 'default' | 'named' | 'namespace' | 'side-effect';
  importedNames: string[];
  bindings: { importedName: string; localName: string }[];
  isTypeOnly: boolean;
  sourceLine: number;
}

export interface ASTExport {
  exportType: 'default' | 'named' | 're-export';
  exportedNames: string[];
  bindings: { exportedName: string; localName: string }[];
  isTypeOnly: boolean;
  sourceLine: number;
  exportedFrom?: string;
}

export interface ASTFunction {
  name: string;
  parameters: string[];
  returnType?: string;
  isAsync: boolean;
  isExported: boolean;
  sourceLine: number;
}

export interface ASTClass {
  name: string;
  isExported: boolean;
  isAbstract: boolean;
  extendsClass?: string;
  implements: string[];
  methods: string[];
  properties: string[];
  sourceLine: number;
}

export interface ASTInterface {
  name: string;
  isExported: boolean;
  extends: string[];
  properties: string[];
  methods: string[];
  sourceLine: number;
}

export interface ASTRelationship {
  type: 'calls' | 'callback' | 'handles' | 'decorates' | 'uses' | 'extends' | 'implements';
  source: string;
  target: string;
  sourceLine: number;
}

export interface ASTParseResult {
  imports: ASTImport[];
  exports: ASTExport[];
  functions: ASTFunction[];
  classes: ASTClass[];
  interfaces: ASTInterface[];
  relationships: ASTRelationship[];
  hasJSX: boolean;
  hasTypeScript: boolean;
}

export class ASTParser {
  /**
   * Parse TypeScript/JavaScript file and extract AST information
   */
  parse(sourceCode: string, filePath: string): ASTParseResult {
    const result: ASTParseResult = {
      imports: [],
      exports: [],
      functions: [],
      classes: [],
      interfaces: [],
      relationships: [],
      hasJSX: false,
      hasTypeScript: filePath.endsWith('.ts') || filePath.endsWith('.tsx')
    };

    try {
      // Create source file with TypeScript compiler
      const sourceFile = ts.createSourceFile(
        filePath,
        sourceCode,
        ts.ScriptTarget.Latest,
        true,
        filePath.endsWith('.tsx') || filePath.endsWith('.jsx')
          ? ts.ScriptKind.TSX
          : ts.ScriptKind.TS
      );

      // Check for JSX
      result.hasJSX = this.containsJSX(sourceFile);

      // Visit all nodes in the AST
      this.visitNode(sourceFile, result, sourceFile);
      this.collectFunctionCallRelationships(sourceFile, result);

    } catch (error) {
      console.error(`[ASTParser] Error parsing ${filePath}:`, error);
    }

    return result;
  }

  private visitNode(node: ts.Node, result: ASTParseResult, sourceFile: ts.SourceFile): void {
    // Import statements
    if (ts.isImportDeclaration(node)) {
      this.extractImport(node, result, sourceFile);
    }

    // Export statements
    if (ts.isExportDeclaration(node) || ts.isExportAssignment(node)) {
      this.extractExport(node, result, sourceFile);
    }

    // Function declarations (including export default function)
    if (ts.isFunctionDeclaration(node)) {
      this.extractFunction(node, result, sourceFile);
      // Check if it's a default export
      const hasDefault = node.modifiers?.some((mod) => mod.kind === ts.SyntaxKind.DefaultKeyword);
      if (hasDefault) {
        const sourceLine = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
        result.exports.push({
          exportType: 'default',
          exportedNames: ['default'],
          bindings: [{ exportedName: 'default', localName: node.name?.text ?? 'default' }],
          isTypeOnly: false,
          sourceLine
        });
      }
    }

    // Arrow functions and function expressions (const myFunc = () => {})
    if (ts.isVariableStatement(node)) {
      this.extractVariableFunctions(node, result, sourceFile);
    }

    // Class declarations (including export default class)
    if (ts.isClassDeclaration(node)) {
      this.extractClass(node, result, sourceFile);
      // Check if it's a default export
      const hasDefault = node.modifiers?.some((mod) => mod.kind === ts.SyntaxKind.DefaultKeyword);
      if (hasDefault) {
        const sourceLine = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
        result.exports.push({
          exportType: 'default',
          exportedNames: ['default'],
          bindings: [{ exportedName: 'default', localName: node.name?.text ?? 'default' }],
          isTypeOnly: false,
          sourceLine
        });
      }
    }

    // Interface declarations
    if (ts.isInterfaceDeclaration(node)) {
      this.extractInterface(node, result, sourceFile);
    }

    // Recursively visit child nodes
    ts.forEachChild(node, (child) => this.visitNode(child, result, sourceFile));
  }

  private extractImport(node: ts.ImportDeclaration, result: ASTParseResult, sourceFile: ts.SourceFile): void {
    const moduleSpecifier = node.moduleSpecifier;
    if (!ts.isStringLiteral(moduleSpecifier)) {
      return;
    }

    const moduleName = moduleSpecifier.text;
    const importClause = node.importClause;
    const sourceLine = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;

    if (!importClause) {
      // Side-effect import: import './styles.css'
      result.imports.push({
        moduleName,
        importType: 'side-effect',
        importedNames: [],
        bindings: [],
        isTypeOnly: false,
        sourceLine
      });
      return;
    }

    const isTypeOnly = importClause.isTypeOnly;

    // Default import: import React from 'react'
    if (importClause.name) {
      result.imports.push({
        moduleName,
        importType: 'default',
        importedNames: [importClause.name.text],
        bindings: [{ importedName: 'default', localName: importClause.name.text }],
        isTypeOnly,
        sourceLine
      });
    }

    // Named imports: import { useState, useEffect } from 'react'
    if (importClause.namedBindings) {
      const namedBindings = importClause.namedBindings;
      if (ts.isNamedImports(namedBindings)) {
        const bindings = namedBindings.elements.map((element) => ({
          importedName: element.propertyName?.text ?? element.name.text,
          localName: element.name.text
        }));
        result.imports.push({
          moduleName,
          importType: 'named',
          importedNames: bindings.map((binding) => binding.localName),
          bindings,
          isTypeOnly,
          sourceLine
        });
      }
      // Namespace import: import * as React from 'react'
      else if (ts.isNamespaceImport(importClause.namedBindings)) {
        result.imports.push({
          moduleName,
          importType: 'namespace',
          importedNames: [importClause.namedBindings.name.text],
          bindings: [],
          isTypeOnly,
          sourceLine
        });
      }
    }
  }

  private extractExport(node: ts.ExportDeclaration | ts.ExportAssignment, result: ASTParseResult, sourceFile: ts.SourceFile): void {
    const sourceLine = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;

    if (ts.isExportDeclaration(node)) {
      const moduleSpecifier = node.moduleSpecifier;
      const exportedFrom = moduleSpecifier && ts.isStringLiteral(moduleSpecifier)
        ? moduleSpecifier.text
        : undefined;

      if (node.exportClause && ts.isNamedExports(node.exportClause)) {
        const bindings = node.exportClause.elements.map((element) => ({
          exportedName: element.name.text,
          localName: element.propertyName?.text ?? element.name.text
        }));
        result.exports.push({
          exportType: exportedFrom ? 're-export' : 'named',
          exportedNames: bindings.map((binding) => binding.exportedName),
          bindings,
          isTypeOnly: node.isTypeOnly,
          sourceLine,
          exportedFrom
        });
      } else if (exportedFrom) {
        // export * from './module'
        result.exports.push({
          exportType: 're-export',
          exportedNames: ['*'],
          bindings: [],
          isTypeOnly: false,
          sourceLine,
          exportedFrom
        });
      }
    } else if (ts.isExportAssignment(node)) {
      // export default ...
      result.exports.push({
        exportType: 'default',
        exportedNames: ['default'],
        bindings: [{
          exportedName: 'default',
          localName: ts.isIdentifier(node.expression) ? node.expression.text : 'default'
        }],
        isTypeOnly: false,
        sourceLine
      });
    }
  }

  private extractFunction(node: ts.FunctionDeclaration, result: ASTParseResult, sourceFile: ts.SourceFile): void {
    if (!node.name) {
      return;
    }

    const name = node.name.text;
    const parameters = node.parameters.map((param) => {
      if (ts.isIdentifier(param.name)) {
        return param.name.text;
      }
      return 'unknown';
    });

    const isAsync = node.modifiers?.some((mod) => mod.kind === ts.SyntaxKind.AsyncKeyword) || false;
    const isExported = node.modifiers?.some(
      (mod) => mod.kind === ts.SyntaxKind.ExportKeyword
    ) || false;

    const returnType = node.type ? node.type.getText(sourceFile) : undefined;
    const sourceLine = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;

    result.functions.push({
      name,
      parameters,
      returnType,
      isAsync,
      isExported,
      sourceLine
    });
  }

  private extractVariableFunctions(node: ts.VariableStatement, result: ASTParseResult, sourceFile: ts.SourceFile): void {
    node.declarationList.declarations.forEach((declaration) => {
      if (!declaration.initializer) {
        return;
      }

      // Check if it's an arrow function or function expression
      const isFunction = ts.isArrowFunction(declaration.initializer) ||
        ts.isFunctionExpression(declaration.initializer);

      if (isFunction && ts.isIdentifier(declaration.name)) {
        const name = declaration.name.text;
        const func = declaration.initializer as ts.ArrowFunction | ts.FunctionExpression;
        const parameters = func.parameters.map((param) => {
          if (ts.isIdentifier(param.name)) {
            return param.name.text;
          }
          return 'unknown';
        });

        const isAsync = func.modifiers?.some((mod) => mod.kind === ts.SyntaxKind.AsyncKeyword) || false;
        const isExported = node.modifiers?.some((mod) => mod.kind === ts.SyntaxKind.ExportKeyword) || false;
        const sourceLine = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;

        result.functions.push({
          name,
          parameters,
          returnType: undefined,
          isAsync,
          isExported,
          sourceLine
        });
      }
    });
  }

  private extractClass(node: ts.ClassDeclaration, result: ASTParseResult, sourceFile: ts.SourceFile): void {
    if (!node.name) {
      return;
    }

    const name = node.name.text;
    const isExported = node.modifiers?.some((mod) => mod.kind === ts.SyntaxKind.ExportKeyword) || false;
    const isAbstract = node.modifiers?.some((mod) => mod.kind === ts.SyntaxKind.AbstractKeyword) || false;

    const extendsClass = node.heritageClauses?.find(
      (clause) => clause.token === ts.SyntaxKind.ExtendsKeyword
    )?.types[0]?.expression.getText(sourceFile);

    const implementsList = node.heritageClauses?.find(
      (clause) => clause.token === ts.SyntaxKind.ImplementsKeyword
    )?.types.map((type) => type.expression.getText(sourceFile)) || [];

    const methods: string[] = [];
    const properties: string[] = [];

    node.members.forEach((member) => {
      if (ts.isMethodDeclaration(member) && member.name && ts.isIdentifier(member.name)) {
        methods.push(member.name.text);
        const methodName = `${name}.${member.name.text}`;
        const parameters = member.parameters.map((parameter) => (
          ts.isIdentifier(parameter.name) ? parameter.name.text : 'unknown'
        ));
        result.functions.push({
          name: methodName,
          parameters,
          returnType: member.type?.getText(sourceFile),
          isAsync: member.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.AsyncKeyword) || false,
          isExported,
          sourceLine: sourceFile.getLineAndCharacterOfPosition(member.getStart()).line + 1
        });
        const decorators = ts.canHaveDecorators(member) ? ts.getDecorators(member) ?? [] : [];
        decorators.forEach((decorator) => {
          const decoratorName = this.getDecoratorName(decorator);
          if (decoratorName) {
            this.addRelationship(result, 'decorates', methodName, decoratorName, sourceFile.getLineAndCharacterOfPosition(decorator.getStart()).line + 1);
          }
        });
      } else if (ts.isPropertyDeclaration(member) && member.name && ts.isIdentifier(member.name)) {
        properties.push(member.name.text);
      }
    });

    const sourceLine = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;

    if (extendsClass) {
      this.addRelationship(result, 'extends', name, extendsClass, sourceLine);
    }

    const extendsExpression = node.heritageClauses?.find(
      (clause) => clause.token === ts.SyntaxKind.ExtendsKeyword
    )?.types[0]?.expression;
    if (extendsExpression && ts.isCallExpression(extendsExpression)) {
      const mixinName = ts.isIdentifier(extendsExpression.expression)
        ? extendsExpression.expression.text
        : ts.isPropertyAccessExpression(extendsExpression.expression)
          ? extendsExpression.expression.name.text
          : undefined;
      if (mixinName) {
        this.addRelationship(result, 'uses', name, mixinName, sourceLine);
      }
    }

    const decorators = ts.canHaveDecorators(node) ? ts.getDecorators(node) ?? [] : [];
    decorators.forEach((decorator) => {
      const decoratorName = this.getDecoratorName(decorator);
      if (decoratorName) {
        this.addRelationship(result, 'decorates', name, decoratorName, sourceFile.getLineAndCharacterOfPosition(decorator.getStart()).line + 1);
      }
    });

    implementsList.forEach((implementedType) => {
      this.addRelationship(result, 'implements', name, implementedType, sourceLine);
    });

    result.classes.push({
      name,
      isExported,
      isAbstract,
      extendsClass,
      implements: implementsList,
      methods,
      properties,
      sourceLine
    });
  }

  private extractInterface(node: ts.InterfaceDeclaration, result: ASTParseResult, sourceFile: ts.SourceFile): void {
    const name = node.name.text;
    const isExported = node.modifiers?.some((mod) => mod.kind === ts.SyntaxKind.ExportKeyword) || false;

    const extendsList = node.heritageClauses?.flatMap(
      (clause) => clause.types.map((type) => type.expression.getText(sourceFile))
    ) || [];

    const properties: string[] = [];
    const methods: string[] = [];

    node.members.forEach((member) => {
      if (ts.isPropertySignature(member) && member.name && ts.isIdentifier(member.name)) {
        properties.push(member.name.text);
      } else if (ts.isMethodSignature(member) && member.name && ts.isIdentifier(member.name)) {
        methods.push(member.name.text);
      }
    });

    const sourceLine = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;

    result.interfaces.push({
      name,
      isExported,
      extends: extendsList,
      properties,
      methods,
      sourceLine
    });
  }

  private getDecoratorName(decorator: ts.Decorator): string | undefined {
    const expression = ts.isCallExpression(decorator.expression)
      ? decorator.expression.expression
      : decorator.expression;
    if (ts.isIdentifier(expression)) {
      return expression.text;
    }
    if (ts.isPropertyAccessExpression(expression)) {
      return expression.name.text;
    }
    return undefined;
  }

  private collectFunctionCallRelationships(sourceFile: ts.SourceFile, result: ASTParseResult): void {
    const visitFunctionBody = (node: ts.Node, currentFunctionName?: string, currentClassName?: string): void => {
      if (ts.isClassDeclaration(node) && node.name) {
        currentClassName = node.name.text;
      }

      if (ts.isFunctionDeclaration(node) && node.name) {
        currentFunctionName = node.name.text;
      } else if (ts.isMethodDeclaration(node) && currentClassName && node.name && ts.isIdentifier(node.name)) {
        currentFunctionName = `${currentClassName}.${node.name.text}`;
      } else if (
        ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        node.initializer &&
        (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))
      ) {
        currentFunctionName = node.name.text;
      }

      if (currentFunctionName) {
        const body = ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node)
          ? node.body
          : undefined;

        if (body) {
          const visitCallExpressions = (callNode: ts.Node): void => {
            if (ts.isCallExpression(callNode)) {
              const callee = callNode.expression;
              let targetName: string | undefined;

              if (ts.isIdentifier(callee)) {
                targetName = callee.text;
              } else if (ts.isPropertyAccessExpression(callee)) {
                targetName = callee.expression.kind === ts.SyntaxKind.ThisKeyword && currentClassName
                  ? `${currentClassName}.${callee.name.text}`
                  : callee.name.text;
              }

              if (targetName && targetName !== currentFunctionName) {
                this.addRelationship(result, 'calls', currentFunctionName!, targetName, sourceFile.getLineAndCharacterOfPosition(callNode.getStart()).line + 1);
              }

              for (const argument of callNode.arguments) {
                const callbackName = ts.isIdentifier(argument)
                  ? argument.text
                  : ts.isPropertyAccessExpression(argument)
                    ? argument.name.text
                    : undefined;
                if (callbackName) {
                  this.addRelationship(result, 'callback', currentFunctionName!, callbackName, sourceFile.getLineAndCharacterOfPosition(argument.getStart()).line + 1);
                }
              }
            }

            if (ts.isJsxAttribute(callNode) && callNode.name && ts.isIdentifier(callNode.name) && callNode.name.text.startsWith('on')) {
              const initializer = callNode.initializer;
              if (initializer && ts.isJsxExpression(initializer) && initializer.expression && ts.isIdentifier(initializer.expression)) {
                this.addRelationship(result, 'handles', currentFunctionName!, initializer.expression.text, sourceFile.getLineAndCharacterOfPosition(callNode.getStart()).line + 1);
              }
            }

            ts.forEachChild(callNode, visitCallExpressions);
          };

          visitCallExpressions(body);
        }
      }

      ts.forEachChild(node, (child) => visitFunctionBody(child, currentFunctionName, currentClassName));
    };

    visitFunctionBody(sourceFile);
  }

  private addRelationship(result: ASTParseResult, type: ASTRelationship['type'], source: string, target: string, sourceLine: number): void {
    if (!source || !target || source === target) {
      return;
    }

    const duplicate = result.relationships.some((relationship) => (
      relationship.type === type &&
      relationship.source === source &&
      relationship.target === target
    ));

    if (!duplicate) {
      result.relationships.push({ type, source, target, sourceLine });
    }
  }

  private containsJSX(node: ts.Node): boolean {
    if (node.kind === ts.SyntaxKind.JsxElement || node.kind === ts.SyntaxKind.JsxSelfClosingElement) {
      return true;
    }

    let hasJSX = false;
    ts.forEachChild(node, (child) => {
      if (this.containsJSX(child)) {
        hasJSX = true;
      }
    });

    return hasJSX;
  }
}
