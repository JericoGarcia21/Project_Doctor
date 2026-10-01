import { BaseParser, ParseResult } from './Parser';
import { Engine } from 'php-parser';

export interface LaravelRoute {
  method: string;
  uri: string;
  controller?: string;
  action?: string;
  name?: string;
  sourceLine: number;
}

export interface BladeTemplateReference {
  type: 'layout' | 'include' | 'component';
  name: string;
  sourceLine: number;
  filePath: string;
  variables?: Record<string, string>;
}

export interface PHPControllerAction {
  controller: string;
  action: string;
  parameters: string[];
  sourceLine: number;
}

export interface LaravelMiddleware {
  routeUri: string;
  routeMethod: string;
  middleware: string[];
  sourceLine: number;
  controller?: string;
  action?: string;
}

export interface EloquentModel {
  className: string;
  namespace: string;
  tableName?: string;
  relationships: EloquentRelationship[];
  fillable: string[];
  hidden: string[];
  casts: Record<string, string>;
  events: string[];
  sourceLine: number;
  filePath: string;
}

export interface EloquentRelationship {
  type: 'hasOne' | 'hasMany' | 'belongsTo' | 'belongsToMany' | 'hasOneThrough' | 'hasManyThrough' | 'morphTo' | 'morphOne' | 'morphMany' | 'morphToMany' | 'morphedByMany';
  method: string;
  relatedModel: string;
  foreignKey?: string;
  localKey?: string;
  pivotTable?: string;
  sourceLine: number;
}

interface PHPNode {
  kind?: string;
  loc?: { start?: { line?: number } };
  [key: string]: unknown;
}

interface LaravelRouteContext {
  prefix?: string;
  controller?: string;
  namespace?: string;
  namePrefix?: string;
}

export class PHPParser extends BaseParser {
  readonly id = 'php-parser';
  readonly name = 'PHP Parser';
  readonly supportedExtensions = ['php'];
  private readonly engine = new Engine({
    parser: { version: '8.2', suppressErrors: false },
    ast: { withPositions: true }
  });

  async parse(content: string, filePath: string): Promise<ParseResult> {
    const result = this.createEmptyResult();

    try {
      const ast = this.engine.parseCode(content, filePath) as unknown as PHPNode;
      const visit = (node: unknown): void => {
        if (!node || typeof node !== 'object') {
          return;
        }
        const current = node as PHPNode;
        if (current.kind === 'class' && typeof current.name === 'string') {
          result.classes.push(current.name);
        } else if (current.kind === 'method' && typeof current.name === 'string') {
          result.functions.push(current.name);
        }
        for (const [key, value] of Object.entries(current)) {
          if (key === 'loc') {
            continue;
          }
          if (Array.isArray(value)) {
            value.forEach(visit);
          } else if (value && typeof value === 'object') {
            visit(value);
          }
        }
      };
      visit(ast);
    } catch (error) {
      result.errors.push({
        message: error instanceof Error ? error.message : String(error),
        line: 1,
        column: 1
      });
    }

    return result;
  }

  parseLaravelRoutes(content: string, filePath: string): LaravelRoute[] {
    const ast = this.engine.parseCode(content, filePath) as unknown as PHPNode;
    const routes: LaravelRoute[] = [];
    const controllerAliases = new Map<string, string>();
    const seenRoutes = new Map<string, LaravelRoute>();
    const collectAliases = (node: unknown): void => {
      if (!node || typeof node !== 'object') {
        return;
      }
      const current = node as PHPNode;
      if (current.kind === 'usegroup' && Array.isArray(current.items)) {
        const namespace = typeof current.name === 'string' ? current.name : '';
        for (const item of current.items) {
          const useItem = this.asNode(item);
          if (typeof useItem?.name !== 'string') {
            continue;
          }
          const importedName = namespace ? `${namespace}\\${useItem.name}` : useItem.name;
          const alias = typeof useItem.alias === 'string'
            ? useItem.alias
            : importedName.split('\\').pop();
          if (alias) {
            controllerAliases.set(alias, importedName.replace(/^\\/, ''));
          }
        }
      }
      for (const [key, value] of Object.entries(current)) {
        if (key === 'loc') {
          continue;
        }
        if (Array.isArray(value)) {
          value.forEach(collectAliases);
        } else if (value && typeof value === 'object') {
          collectAliases(value);
        }
      }
    };
    collectAliases(ast);

    const visit = (node: unknown, context: LaravelRouteContext = {}): void => {
      if (!node || typeof node !== 'object') {
        return;
      }
      const current = node as PHPNode;
      if (current.kind === 'call' && this.callMethod(current) === 'group') {
        const localContext = this.groupContext(current, controllerAliases);
        const nestedContext: LaravelRouteContext = {
          prefix: this.joinPrefix(context.prefix, localContext.prefix),
          controller: localContext.controller ?? context.controller,
          namespace: localContext.namespace ?? context.namespace,
          namePrefix: this.joinRouteName(context.namePrefix, localContext.namePrefix)
        };
        if (Array.isArray(current.arguments)) {
          current.arguments.forEach(argument => visit(argument, nestedContext));
        }
        return;
      }

      const route = this.extractRoute(current, controllerAliases, context);
      if (route) {
        route.uri = this.joinPrefix(context.prefix, route.uri) ?? route.uri;
        route.name = this.joinRouteName(context.namePrefix, route.name);

        const routeKey = `${route.method}:${route.uri}:${route.sourceLine}`;
        const existingRoute = seenRoutes.get(routeKey);
        if (existingRoute) {
          if (!existingRoute.name && route.name) {
            existingRoute.name = route.name;
          }
          if (!existingRoute.controller && route.controller) {
            existingRoute.controller = route.controller;
          }
          if (!existingRoute.action && route.action) {
            existingRoute.action = route.action;
          }
        } else {
          seenRoutes.set(routeKey, route);
          routes.push(route);
        }
      }
      for (const [key, value] of Object.entries(current)) {
        if (key === 'loc') {
          continue;
        }
        if (Array.isArray(value)) {
          value.forEach(child => visit(child, context));
        } else if (value && typeof value === 'object') {
          visit(value, context);
        }
      }
    };
    visit(ast);
    return routes;
  }

  parseBladeTemplate(content: string, filePath: string): BladeTemplateReference[] {
    const references: BladeTemplateReference[] = [];
    const lines = content.split(/\r?\n/);

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const lineNumber = index + 1;

      const includeMatch = line.match(/@(?:include(?:If|When|Unless)?|includeFirst)\s*\(\s*['\"]([^'\"]+)['\"](?:\s*,\s*(\[[^\]]*\]))?\s*\)/);
      if (includeMatch) {
        references.push({
          type: 'include',
          name: includeMatch[1].replace(/^['"]|['"]$/g, ''),
          sourceLine: lineNumber,
          filePath,
          variables: this.parseBladeVariableMap(includeMatch[2])
        });
      }

      const layoutMatch = line.match(/@extends\s*\(\s*['\"]([^'\"]+)['\"]\s*\)/);
      if (layoutMatch) {
        references.push({
          type: 'layout',
          name: layoutMatch[1],
          sourceLine: lineNumber,
          filePath
        });
      }

      const componentMatch = line.match(/@component\s*\(\s*['\"]([^'\"]+)['\"](?:\s*,\s*(\[[^\]]*\]))?\s*\)/);
      if (componentMatch) {
        references.push({
          type: 'component',
          name: componentMatch[1],
          sourceLine: lineNumber,
          filePath,
          variables: this.parseBladeVariableMap(componentMatch[2])
        });
      }

      const tagMatch = line.match(/<x-([a-z0-9.-]+)(?:\s+[^>]*?)?>/i);
      if (tagMatch) {
        references.push({
          type: 'component',
          name: tagMatch[1],
          sourceLine: lineNumber,
          filePath,
          variables: this.parseBladeTagAttributes(line)
        });
      }
    }

    return references;
  }

  private parseBladeVariableMap(value?: string): Record<string, string> | undefined {
    if (!value) {
      return undefined;
    }

    const variables: Record<string, string> = {};
    const entries = value.matchAll(/['\"]([^'\"]+)['\"]\s*=>\s*([^,\]]+)/g);

    for (const match of entries) {
      const key = match[1];
      const rawValue = match[2].trim();
      if (key && rawValue) {
        variables[key] = rawValue.replace(/^['"]|['"]$/g, '');
      }
    }

    return Object.keys(variables).length > 0 ? variables : undefined;
  }

  private parseBladeTagAttributes(line: string): Record<string, string> | undefined {
    const attrs: Record<string, string> = {};
    const regex = /([a-zA-Z0-9:_-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|\$\(([^\)]*)\)|([^\s>]+))/g;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(line)) !== null) {
      const key = match[1];
      const value = match[2] ?? match[3] ?? match[4] ?? match[5] ?? '';
      if (key && value) {
        attrs[key] = value;
      }
    }

    return Object.keys(attrs).length > 0 ? attrs : undefined;
  }

  parseControllerActions(content: string, filePath: string): PHPControllerAction[] {
    const ast = this.engine.parseCode(content, filePath) as unknown as PHPNode;
    const actions: PHPControllerAction[] = [];
    const visit = (node: unknown, namespace = ''): void => {
      if (!node || typeof node !== 'object') {
        return;
      }
      const current = node as PHPNode;
      const currentNamespace = current.kind === 'namespace' && typeof current.name === 'string'
        ? current.name.replace(/^\\/, '')
        : namespace;

      if (current.kind === 'class' && Array.isArray(current.body)) {
        const className = this.nodeName(current.name);
        if (className) {
          const controller = currentNamespace ? `${currentNamespace}\\${className}` : className;
          for (const member of current.body) {
            const method = this.asNode(member);
            if (method?.kind !== 'method' || method.visibility !== 'public') {
              continue;
            }
            const action = this.nodeName(method.name);
            if (!action) {
              continue;
            }
            const parameters = Array.isArray(method.arguments)
              ? method.arguments.map(parameter => {
                const nameNode = this.asNode(this.asNode(parameter)?.name);
                return typeof nameNode?.name === 'string' ? nameNode.name.replace(/^\$/, '') : '';
              }).filter(Boolean)
              : [];
            actions.push({
              controller,
              action,
              parameters,
              sourceLine: this.sourceLine(method)
            });
          }
        }
      }

      for (const [key, value] of Object.entries(current)) {
        if (key === 'loc') {
          continue;
        }
        if (Array.isArray(value)) {
          value.forEach(child => visit(child, currentNamespace));
        } else if (value && typeof value === 'object') {
          visit(value, currentNamespace);
        }
      }
    };
    visit(ast);
    return actions;
  }

  parseLaravelMiddleware(content: string, filePath: string): LaravelMiddleware[] {
    const ast = this.engine.parseCode(content, filePath) as unknown as PHPNode;
    const middlewares: LaravelMiddleware[] = [];
    const controllerAliases = new Map<string, string>();

    const collectAliases = (node: unknown): void => {
      if (!node || typeof node !== 'object') return;
      const current = node as PHPNode;
      if (current.kind === 'usegroup' && Array.isArray(current.items)) {
        const namespace = typeof current.name === 'string' ? current.name : '';
        for (const item of current.items) {
          const useItem = this.asNode(item);
          if (typeof useItem?.name !== 'string') continue;
          const importedName = namespace ? `${namespace}\\${useItem.name}` : useItem.name;
          const alias = typeof useItem.alias === 'string' ? useItem.alias : importedName.split('\\').pop();
          if (alias) controllerAliases.set(alias, importedName.replace(/^\\/, ''));
        }
      }
      this.traverseNode(current, collectAliases);
    };
    collectAliases(ast);

    const visit = (node: unknown, context: { prefix?: string; controller?: string; middleware: string[] } = { middleware: [] }): void => {
      if (!node || typeof node !== 'object') return;
      const current = node as PHPNode;

      if (current.kind === 'call' && this.callMethod(current) === 'group') {
        const localContext = this.groupContext(current, controllerAliases);
        const groupMiddleware = this.extractMiddlewareFromGroup(current);
        const nestedContext = {
          prefix: this.joinPrefix(context.prefix, localContext.prefix),
          controller: localContext.controller ?? context.controller,
          middleware: [...context.middleware, ...groupMiddleware]
        };
        if (Array.isArray(current.arguments)) {
          current.arguments.forEach(argument => visit(argument, nestedContext));
        }
        return;
      }

      if (current.kind === 'call' && this.isMiddlewareCall(current)) {
        const routeMiddleware = this.extractMiddlewareValues(Array.isArray(current.arguments) ? current.arguments : []);
        const innerCall = this.asNode(this.asNode(current.what)?.what);
        if (innerCall) {
          visit(innerCall, { ...context, middleware: [...context.middleware, ...routeMiddleware] });
        }
        return;
      }

      const route = this.extractRoute(current, controllerAliases, {
        prefix: context.prefix,
        controller: context.controller
      });
      if (route) {
        const routeMiddleware = this.extractMiddlewareFromRoute(current);
        const allMiddleware = [...context.middleware, ...routeMiddleware];
        middlewares.push({
          routeUri: this.joinPrefix(context.prefix, route.uri) ?? route.uri,
          routeMethod: route.method,
          middleware: allMiddleware,
          sourceLine: route.sourceLine,
          controller: route.controller,
          action: route.action
        });
      }

      this.traverseNode(current, (child) => visit(child, context));
    };
    visit(ast);
    return middlewares;
  }

  private isMiddlewareCall(call: PHPNode): boolean {
    const lookup = this.asNode(call.what);
    return lookup?.kind === 'propertylookup' && this.classNodeName(lookup.offset) === 'middleware';
  }

  parseEloquentModels(content: string, filePath: string): EloquentModel[] {
    const ast = this.engine.parseCode(content, filePath) as unknown as PHPNode;
    const models: EloquentModel[] = [];

    const visit = (node: unknown, namespace = ''): void => {
      if (!node || typeof node !== 'object') return;
      const current = node as PHPNode;
      const currentNamespace = current.kind === 'namespace' && typeof current.name === 'string'
        ? current.name.replace(/^\\/, '')
        : namespace;

      if (current.kind === 'class' && Array.isArray(current.body)) {
        const className = this.classNodeName(current.name);
        if (className && this.isEloquentModel(current)) {
          const model = this.extractEloquentModel(current, className, currentNamespace, filePath);
          if (model) {
            const source = contentForEvents;
            model.events = [...new Set([
              ...model.events,
              ...[...source.matchAll(/(?:static|self|[A-Za-z_][A-Za-z0-9_]*)::(creating|created|updating|updated|deleting|deleted|saving|saved)\s*\(/g)].map(match => match[1])
            ])];
            models.push(model);
          }
        }
      }

      this.traverseNode(current, (child) => visit(child, currentNamespace));
    };
    const contentForEvents = content;
    visit(ast);
    return models;
  }

  private traverseNode(node: PHPNode, callback: (node: unknown) => void): void {
    for (const [key, value] of Object.entries(node)) {
      if (key === 'loc' || key === 'kind' || key === 'name' || key === 'value' || key === 'raw' || key === 'unicode' || key === 'isDoubleQuote' || key === 'resolution' || key === 'curly' || key === 'byRef' || key === 'unpack' || key === 'shortForm' || key === 'readonly' || key === 'nullable' || key === 'type' || key === 'attrGroups' || key === 'hooks' || key === 'visibility' || key === 'isStatic' || key === 'isAbstract' || key === 'isFinal' || key === 'isReadonly' || key === 'visibilitySet' || key === 'isAnonymous' || key === 'withBrackets' || key === 'byref' || key === 'errors' || key === 'source' || key === 'start' || key === 'end' || key === 'offset' || key === 'column') continue;
      if (Array.isArray(value)) {
        value.forEach(item => {
          if (item && typeof item === 'object') callback(item);
        });
      } else if (value && typeof value === 'object') {
        callback(value);
      }
    }
  }

  private classNodeName(value: unknown): string | undefined {
    if (!value || typeof value !== 'object') return undefined;
    const node = value as PHPNode;
    if (node.kind === 'identifier' && typeof node.name === 'string') return node.name;
    if (node.kind === 'name' && typeof node.name === 'string') return node.name;
    return undefined;
  }

  private extractMiddlewareFromGroup(groupCall: PHPNode): string[] {
    const chain: { method: string; arguments: unknown[] }[] = [];
    let current: PHPNode | undefined = groupCall;
    while (current?.kind === 'call') {
      const lookup = this.asNode(current.what);
      const method = this.callMethod(current);
      if (method) {
        chain.push({ method: method.toLowerCase(), arguments: Array.isArray(current.arguments) ? current.arguments : [] });
      }
      current = this.asNode(lookup?.what);
    }

    const middlewares: string[] = [];
    for (const call of chain) {
      if (call.method === 'middleware') {
        middlewares.push(...this.extractMiddlewareValues(call.arguments));
      }
    }
    return middlewares;
  }

  private extractMiddlewareFromRoute(routeCall: PHPNode): string[] {
    const middlewares: string[] = [];
    let current: PHPNode | undefined = routeCall;

    while (current?.kind === 'call') {
      const lookup = this.asNode(current.what);
      if (lookup?.kind === 'propertylookup') {
        const methodName = this.classNodeName(lookup.offset);
        if (methodName === 'middleware') {
          middlewares.push(...this.extractMiddlewareValues(Array.isArray(current.arguments) ? current.arguments : []));
        }
        current = this.asNode(lookup.what);
      } else {
        break;
      }
    }

    return middlewares;
  }

  private extractMiddlewareValues(args: unknown[]): string[] {
    const middlewares: string[] = [];
    for (const arg of args) {
      const node = this.asNode(arg);
      if (node?.kind === 'string' && typeof node.value === 'string') {
        middlewares.push(node.value);
      } else if (node?.kind === 'array' && Array.isArray(node.items)) {
        for (const item of node.items) {
          const entry = this.asNode(item);
          const value = entry?.kind === 'entry' ? entry.value : item;
          const strVal = this.stringValue(value);
          if (strVal) middlewares.push(strVal);
        }
      }
    }
    return middlewares;
  }

  private isEloquentModel(classNode: PHPNode): boolean {
    const superClass = this.asNode(classNode.extends);
    if (superClass) {
      const superClassName = this.classNodeName(superClass.name) ?? (typeof superClass.name === 'string' ? superClass.name : undefined);
      if (superClassName === 'Model' || superClassName === 'Authenticatable' || superClassName?.endsWith('Model')) {
        return true;
      }
    }
    const implementsList = Array.isArray(classNode.implements) ? classNode.implements : [];
    for (const impl of implementsList) {
      const implNode = this.asNode(impl);
      const implName = this.classNodeName(implNode?.name) ?? (typeof implNode?.name === 'string' ? implNode.name : undefined);
      if (implName === 'Authenticatable') return true;
    }
    return false;
  }

  private extractEloquentModel(classNode: PHPNode, className: string, namespace: string, filePath: string): EloquentModel | undefined {
    const relationships: EloquentRelationship[] = [];
    const fillable: string[] = [];
    const hidden: string[] = [];
    const casts: Record<string, string> = {};
    const events: string[] = [];
    let tableName: string | undefined;
    const sourceLine = this.sourceLine(classNode);

    for (const member of (Array.isArray(classNode.body) ? classNode.body : [])) {
      const memberNode = this.asNode(member);

      if (memberNode?.kind === 'propertystatement' && Array.isArray(memberNode.properties)) {
        for (const prop of memberNode.properties) {
          const propNode = this.asNode(prop);
          const propName = this.classNodeName(propNode?.name);
          if (propName === 'table' && propNode?.value) {
            const strVal = this.stringValue(propNode.value);
            if (strVal) tableName = strVal;
          }
          if (propName === 'fillable' && propNode?.value) {
            const arr = this.arrayValues(propNode.value);
            for (const val of arr) {
              const str = this.stringValue(val);
              if (str) fillable.push(str);
            }
          }
          if (propName === 'hidden' && propNode?.value) {
            const arr = this.arrayValues(propNode.value);
            for (const val of arr) {
              const str = this.stringValue(val);
              if (str) hidden.push(str);
            }
          }
          if (propNode?.value) {
            const obj = this.asNode(propNode.value);
            if (obj?.kind === 'array' && Array.isArray(obj.items)) {
              for (const item of obj.items) {
                const entry = this.asNode(item);
                if (entry?.kind === 'entry') {
                  const key = this.stringValue(entry.key);
                  const val = this.stringValue(entry.value);
                  if (key && val) casts[key] = val;
                }
              }
            }
          }
        }
        continue;
      }

      if (memberNode?.kind !== 'method') continue;

      const methodName = this.classNodeName(memberNode.name);
      if (!methodName) continue;

      if (methodName === 'tableName' || methodName === 'getTable') {
        const returnStmt = this.findReturnStatement(memberNode.body);
        const strVal = this.stringValue(returnStmt);
        if (strVal) tableName = strVal;
      }

      if (methodName === 'fillable' || methodName === 'getFillable') {
        const returnStmt = this.findReturnStatement(memberNode.body);
        const arr = this.arrayValues(returnStmt);
        for (const val of arr) {
          const str = this.stringValue(val);
          if (str) fillable.push(str);
        }
      }

      if (methodName === 'hidden' || methodName === 'getHidden') {
        const returnStmt = this.findReturnStatement(memberNode.body);
        const arr = this.arrayValues(returnStmt);
        for (const val of arr) {
          const str = this.stringValue(val);
          if (str) hidden.push(str);
        }
      }

      if (methodName === 'casts' || methodName === 'getCasts') {
        const returnStmt = this.findReturnStatement(memberNode.body);
        const obj = this.asNode(returnStmt);
        if (obj?.kind === 'array' && Array.isArray(obj.items)) {
          for (const item of obj.items) {
            const entry = this.asNode(item);
            if (entry?.kind === 'entry') {
              const key = this.stringValue(entry.key);
              const val = this.stringValue(entry.value);
              if (key && val) casts[key] = val;
            }
          }
        }
      }

      const relType = this.getRelationshipType(methodName) ?? this.getRelationshipTypeFromBody(memberNode);
      if (relType) {
        const relationshipCall = this.asNode(this.findReturnStatement(memberNode.body));
        const rel = relationshipCall?.kind === 'call'
          ? this.extractRelationship(relationshipCall, relType, methodName, this.sourceLine(memberNode))
          : undefined;
        if (rel) relationships.push(rel);
      }
    }

    return {
      className,
      namespace,
      tableName,
      relationships,
      fillable,
      hidden,
      casts,
      events,
      sourceLine,
      filePath
    };
  }

  private getRelationshipType(methodName: string): EloquentRelationship['type'] | undefined {
    const relMap: Record<string, EloquentRelationship['type']> = {
      'hasOne': 'hasOne',
      'hasMany': 'hasMany',
      'belongsTo': 'belongsTo',
      'belongsToMany': 'belongsToMany',
      'hasOneThrough': 'hasOneThrough',
      'hasManyThrough': 'hasManyThrough',
      'morphTo': 'morphTo',
      'morphOne': 'morphOne',
      'morphMany': 'morphMany',
      'morphToMany': 'morphToMany',
      'morphedByMany': 'morphedByMany'
    };
    return relMap[methodName];
  }

  private getRelationshipTypeFromBody(method: PHPNode): EloquentRelationship['type'] | undefined {
    const returnStmt = this.findReturnStatement(method.body);
    if (!returnStmt) return undefined;
    const returnNode = this.asNode(returnStmt);
    if (returnNode?.kind !== 'call') return undefined;
    const lookup = this.asNode(returnNode.what);
    if (lookup?.kind !== 'propertylookup') return undefined;
    const offset = this.asNode(lookup.offset);
    const methodName = this.classNodeName(offset);
    if (!methodName) return undefined;
    return this.getRelationshipType(methodName);
  }

  private extractRelationship(method: PHPNode, type: EloquentRelationship['type'], methodName: string, sourceLine: number): EloquentRelationship | undefined {
    const args = Array.isArray(method.arguments) ? method.arguments : [];
    const firstArg = this.asNode(args[0]);
    const relatedModel = this.resolveModelName(firstArg);

    if (!relatedModel) return undefined;

    const rel: EloquentRelationship = {
      type,
      method: methodName,
      relatedModel,
      sourceLine
    };

    if (args.length > 1) {
      const secondArg = this.asNode(args[1]);
      const foreignKey = this.stringValue(secondArg);
      if (foreignKey) rel.foreignKey = foreignKey;
    }

    if (args.length > 2) {
      const thirdArg = this.asNode(args[2]);
      const localKey = this.stringValue(thirdArg);
      if (localKey) rel.localKey = localKey;
    }

    if (type === 'belongsToMany' || type === 'morphToMany' || type === 'morphedByMany') {
      if (args.length > 1) {
        const secondArg = this.asNode(args[1]);
        const pivotTable = this.stringValue(secondArg);
        if (pivotTable) rel.pivotTable = pivotTable;
      }
    }

    return rel;
  }

  private resolveModelName(node: PHPNode | undefined): string | undefined {
    if (!node) return undefined;
    if (node.kind === 'staticlookup') {
      const classRef = this.asNode(node.what);
      const classKeyword = this.classNodeName(node.offset);
      if (classKeyword === 'class') {
        const modelName = typeof classRef?.name === 'string' ? classRef.name : this.classNodeName(classRef?.name);
        if (modelName) return modelName.replace(/^\\/, '');
      }
    }
    if (node.kind === 'name' && typeof node.name === 'string') {
      return node.name.replace(/^\\/, '');
    }
    if (node.kind === 'string' && typeof node.value === 'string') {
      return node.value;
    }
    return undefined;
  }

  private findReturnStatement(body: unknown): unknown {
    if (!body || typeof body !== 'object') return undefined;
    const bodyNode = body as PHPNode;
    if (bodyNode.kind === 'return') return bodyNode.expr;
    if (Array.isArray(bodyNode)) {
      for (const item of bodyNode) {
        const result = this.findReturnStatement(item);
        if (result !== undefined) return result;
      }
    }
    if (Array.isArray(bodyNode.children)) {
      for (const child of bodyNode.children) {
        const result = this.findReturnStatement(child);
        if (result !== undefined) return result;
      }
    }
    for (const [key, value] of Object.entries(bodyNode)) {
      if (key === 'loc' || key === 'kind' || key === 'name' || key === 'value' || key === 'raw' || key === 'unicode' || key === 'isDoubleQuote' || key === 'resolution' || key === 'curly' || key === 'byRef' || key === 'unpack' || key === 'shortForm' || key === 'readonly' || key === 'nullable' || key === 'type' || key === 'attrGroups' || key === 'hooks' || key === 'visibility' || key === 'isStatic' || key === 'isAbstract' || key === 'isFinal' || key === 'isReadonly' || key === 'visibilitySet' || key === 'isAnonymous' || key === 'withBrackets' || key === 'byref' || key === 'errors' || key === 'source' || key === 'start' || key === 'end' || key === 'offset' || key === 'column') continue;
      if (Array.isArray(value)) {
        for (const item of value) {
          const result = this.findReturnStatement(item);
          if (result !== undefined) return result;
        }
      } else if (value && typeof value === 'object') {
        const result = this.findReturnStatement(value);
        if (result !== undefined) return result;
      }
    }
    return undefined;
  }

  private extractRoute(call: PHPNode, controllerAliases: Map<string, string>, context: LaravelRouteContext = {}): LaravelRoute | undefined {
    if (call.kind !== 'call') {
      return undefined;
    }

    const resolvedCall = this.resolveRouteCall(call);
    if (!resolvedCall) {
      return undefined;
    }

    const lookup = this.asNode(resolvedCall.what);
    if (lookup?.kind !== 'staticlookup') {
      return undefined;
    }
    const facade = this.asNode(lookup.what);
    const method = this.asNode(lookup.offset)?.name;
    if (typeof facade?.name !== 'string' || facade.name.split('\\').pop() !== 'Route' || typeof method !== 'string') {
      return undefined;
    }

    const argumentsList = Array.isArray(resolvedCall.arguments) ? resolvedCall.arguments : [];
    const upperMethod = method.toUpperCase();
    let uriArgument: unknown;
    let actionArgument: unknown;
    let methods = [upperMethod];

    if (upperMethod === 'MATCH') {
      methods = this.arrayValues(argumentsList[0])
        .map(value => this.stringValue(value)?.toUpperCase())
        .filter((value): value is string => Boolean(value));
      uriArgument = argumentsList[1];
      actionArgument = argumentsList[2];
    } else {
      uriArgument = argumentsList[0];
      actionArgument = argumentsList[1];
    }

    const uri = this.stringValue(uriArgument);
    if (!uri) {
      return undefined;
    }

    const controllerAction = ['RESOURCE', 'APIRESOURCE'].includes(upperMethod)
      ? (() => {
        const controller = this.resolveControllerName(this.className(this.asNode(actionArgument), controllerAliases), context.namespace, controllerAliases);
        return controller ? { controller, action: 'resource' } : undefined;
      })()
      : this.extractControllerAction(actionArgument, controllerAliases, context.controller, context.namespace);
    const line = this.asNode(call.loc)?.start;
    const sourceLine = typeof line === 'object' && line !== null && typeof (line as PHPNode).line === 'number'
      ? (line as PHPNode).line as number
      : 1;

    return {
      method: methods.join('|') || upperMethod,
      uri,
      controller: controllerAction?.controller,
      action: controllerAction?.action,
      name: this.extractRouteName(call),
      sourceLine
    };
  }

  private resolveRouteCall(call: PHPNode): PHPNode | undefined {
    let current: PHPNode | undefined = call;

    while (current?.kind === 'call') {
      const lookup = this.asNode(current.what);
      if (lookup?.kind === 'staticlookup') {
        const facade = this.asNode(lookup.what);
        const method = this.asNode(lookup.offset)?.name;
        if (typeof facade?.name === 'string' && facade.name.split('\\').pop() === 'Route' && typeof method === 'string') {
          return current;
        }
      }

      if (lookup?.kind === 'propertylookup') {
        const inner = this.asNode(lookup.what);
        if (inner?.kind === 'call') {
          current = inner;
          continue;
        }
      }

      if (lookup && lookup.kind === 'call') {
        current = lookup;
        continue;
      }

      break;
    }

    return undefined;
  }

  private extractControllerAction(value: unknown, controllerAliases: Map<string, string>, groupController?: string, groupNamespace?: string): { controller: string; action: string } | undefined {
    const node = this.asNode(value);
    if (!node) {
      return undefined;
    }

    if (node.kind === 'array' && Array.isArray(node.items)) {
      const entries = node.items.map(item => {
        const entry = this.asNode(item);
        return entry?.kind === 'entry' ? entry.value : item;
      });
      const classReference = this.asNode(entries[0]);
      const className = this.resolveControllerName(this.className(classReference, controllerAliases), groupNamespace, controllerAliases);
      const action = this.stringValue(entries[1]);
      return className && action ? { controller: className, action } : undefined;
    }

    const callable = this.stringValue(value);
    if (callable) {
      const separator = callable.lastIndexOf('@');
      if (separator > 0 && separator < callable.length - 1) {
        const controllerName = this.resolveControllerName(callable.slice(0, separator), groupNamespace, controllerAliases);
        return controllerName ? {
          controller: controllerName,
          action: callable.slice(separator + 1)
        } : undefined;
      }
      if (groupController || groupNamespace) {
        const isActionName = !/[\\/]/.test(callable) && !callable.includes('::') && !/Controller$/i.test(callable);
        if (isActionName) {
          const controllerName = this.resolveControllerName(groupController, groupNamespace, controllerAliases);
          if (controllerName) {
            return { controller: controllerName, action: callable };
          }
        }

        const controllerName = this.resolveControllerName(callable, groupNamespace, controllerAliases) ?? groupController;
        if (controllerName && controllerName !== callable && !/Controller$/i.test(callable)) {
          return { controller: controllerName, action: 'index' };
        }
      }
    }
    return undefined;
  }

  private callMethod(call: PHPNode): string | undefined {
    const lookup = this.asNode(call.what);
    return this.nodeName(lookup?.offset);
  }

  private groupContext(groupCall: PHPNode, controllerAliases: Map<string, string>): LaravelRouteContext {
    const chain: { method: string; arguments: unknown[] }[] = [];
    let current: PHPNode | undefined = groupCall;
    while (current?.kind === 'call') {
      const lookup = this.asNode(current.what);
      const method = this.callMethod(current);
      if (method) {
        chain.push({ method: method.toLowerCase(), arguments: Array.isArray(current.arguments) ? current.arguments : [] });
      }
      current = this.asNode(lookup?.what);
    }

    const context: LaravelRouteContext = {};
    for (const call of chain.reverse()) {
      if (call.method === 'prefix') {
        context.prefix = this.joinPrefix(context.prefix, this.stringValue(call.arguments[0]));
      } else if (call.method === 'controller') {
        context.controller = this.className(this.asNode(call.arguments[0]), controllerAliases);
      } else if (call.method === 'namespace') {
        context.namespace = this.stringValue(call.arguments[0]);
      } else if (call.method === 'as' || call.method === 'name') {
        const name = this.stringValue(call.arguments[0]);
        if (name) {
          context.namePrefix = this.joinRouteName(context.namePrefix, name);
        }
      } else if (call.method === 'group') {
        const options = this.asNode(call.arguments[0]);
        if (options?.kind === 'array' && Array.isArray(options.items)) {
          for (const item of options.items) {
            const entry = this.asNode(item);
            const key = this.stringValue(entry?.key);
            const value = entry?.value;
            if (key === 'prefix') {
              context.prefix = this.joinPrefix(context.prefix, this.stringValue(value));
            } else if (key === 'controller') {
              context.controller = this.className(this.asNode(value), controllerAliases);
            } else if (key === 'namespace') {
              context.namespace = this.stringValue(value);
            } else if (key === 'as' || key === 'name') {
              const routeName = this.stringValue(value);
              if (routeName) {
                context.namePrefix = this.joinRouteName(context.namePrefix, routeName);
              }
            }
          }
        }
      }
    }
    return context;
  }

  private joinRouteName(prefix: string | undefined, child: string | undefined): string | undefined {
    if (!prefix && !child) {
      return undefined;
    }
    const normalizedPrefix = prefix?.replace(/\/+$/, '') ?? '';
    const normalizedChild = child?.replace(/^\/+/, '') ?? '';
    if (!normalizedPrefix) {
      return normalizedChild;
    }
    if (!normalizedChild) {
      return normalizedPrefix;
    }
    return `${normalizedPrefix}.${normalizedChild}`.replace(/\.\./g, '.');
  }

  private extractRouteName(call: PHPNode): string | undefined {
    const chain: { method: string; arguments: unknown[] }[] = [];
    let current: PHPNode | undefined = call;
    while (current?.kind === 'call') {
      const lookup = this.asNode(current.what);
      const method = this.callMethod(current);
      if (method) {
        chain.push({ method: method.toLowerCase(), arguments: Array.isArray(current.arguments) ? current.arguments : [] });
      }
      current = this.asNode(lookup?.what);
    }

    for (const item of chain.reverse()) {
      if ((item.method === 'name' || item.method === 'as') && item.arguments[0]) {
        const routeName = this.stringValue(item.arguments[0]);
        if (routeName) {
          return routeName;
        }
      }
    }
    return undefined;
  }

  private joinPrefix(parent: string | undefined, child: string | undefined): string | undefined {
    const segments = [parent, child]
      .filter((segment): segment is string => Boolean(segment))
      .map(segment => segment.replace(/^\/+|\/+$/g, ''))
      .filter(Boolean);
    return segments.length > 0 ? `/${segments.join('/')}` : undefined;
  }

  private resolveControllerName(controller: string | undefined, groupNamespace?: string, controllerAliases: Map<string, string> = new Map()): string | undefined {
    if (!controller) {
      return groupNamespace ? groupNamespace.replace(/\\$/, '') : undefined;
    }

    const normalized = controller.replace(/^\\/, '');
    if (normalized.includes('\\') || normalized.includes('/')) {
      return controllerAliases.get(normalized) ?? normalized.replace(/^\\/, '');
    }

    if (groupNamespace) {
      const namespaced = `${groupNamespace.replace(/\\$/, '')}\\${normalized}`;
      return controllerAliases.get(namespaced) ?? namespaced;
    }

    return controllerAliases.get(normalized) ?? normalized;
  }

  private className(node: PHPNode | undefined, controllerAliases: Map<string, string>): string | undefined {
    if (node?.kind !== 'staticlookup') {
      return undefined;
    }
    const classReference = this.asNode(node.what);
    const classKeyword = this.asNode(node.offset)?.name;
    if (classKeyword !== 'class' || typeof classReference?.name !== 'string') {
      return undefined;
    }
    const name = classReference.name.replace(/^\\/, '');
    return controllerAliases.get(name) ?? name;
  }

  private arrayValues(value: unknown): unknown[] {
    const node = this.asNode(value);
    return node?.kind === 'array' && Array.isArray(node.items)
      ? node.items.map(item => {
        const entry = this.asNode(item);
        return entry?.kind === 'entry' ? entry.value : item;
      })
      : [];
  }

  private stringValue(value: unknown): string | undefined {
    const node = this.asNode(value);
    return node?.kind === 'string' && typeof node.value === 'string' ? node.value : undefined;
  }

  private asNode(value: unknown): PHPNode | undefined {
    return value && typeof value === 'object' ? value as PHPNode : undefined;
  }

  private nodeName(value: unknown): string | undefined {
    if (typeof value === 'string') {
      return value;
    }
    const node = this.asNode(value);
    return typeof node?.name === 'string' ? node.name : undefined;
  }

  private sourceLine(node: PHPNode): number {
    const location = this.asNode(node.loc);
    const start = this.asNode(location?.start);
    return typeof start?.line === 'number' ? start.line : 1;
  }
}
