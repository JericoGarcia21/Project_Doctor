import { BaseParser, ParseResult } from './Parser';
import { Engine } from 'php-parser';

export interface LaravelRoute {
  method: string;
  uri: string;
  controller?: string;
  action?: string;
  sourceLine: number;
}

export interface PHPControllerAction {
  controller: string;
  action: string;
  parameters: string[];
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
          controller: localContext.controller ?? context.controller
        };
        if (Array.isArray(current.arguments)) {
          current.arguments.forEach(argument => visit(argument, nestedContext));
        }
        return;
      }

      const route = this.extractRoute(current, controllerAliases, context.controller);
      if (route) {
        route.uri = this.joinPrefix(context.prefix, route.uri) ?? route.uri;
        routes.push(route);
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

  private extractRoute(call: PHPNode, controllerAliases: Map<string, string>, groupController?: string): LaravelRoute | undefined {
    if (call.kind !== 'call') {
      return undefined;
    }
    const lookup = this.asNode(call.what);
    if (lookup?.kind !== 'staticlookup') {
      return undefined;
    }
    const facade = this.asNode(lookup.what);
    const method = this.asNode(lookup.offset)?.name;
    if (typeof facade?.name !== 'string' || facade.name.split('\\').pop() !== 'Route' || typeof method !== 'string') {
      return undefined;
    }

    const argumentsList = Array.isArray(call.arguments) ? call.arguments : [];
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
        const controller = this.className(this.asNode(actionArgument), controllerAliases);
        return controller ? { controller, action: 'resource' } : undefined;
      })()
      : this.extractControllerAction(actionArgument, controllerAliases, groupController);
    const line = this.asNode(call.loc)?.start;
    const sourceLine = typeof line === 'object' && line !== null && typeof (line as PHPNode).line === 'number'
      ? (line as PHPNode).line as number
      : 1;

    return {
      method: methods.join('|') || upperMethod,
      uri,
      controller: controllerAction?.controller,
      action: controllerAction?.action,
      sourceLine
    };
  }

  private extractControllerAction(value: unknown, controllerAliases: Map<string, string>, groupController?: string): { controller: string; action: string } | undefined {
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
      const className = this.className(classReference, controllerAliases);
      const action = this.stringValue(entries[1]);
      return className && action ? { controller: className, action } : undefined;
    }

    const callable = this.stringValue(value);
    if (callable) {
      const separator = callable.lastIndexOf('@');
      if (separator > 0 && separator < callable.length - 1) {
        return {
          controller: controllerAliases.get(callable.slice(0, separator)) ?? callable.slice(0, separator).replace(/^\\/, ''),
          action: callable.slice(separator + 1)
        };
      }
      if (groupController) {
        return { controller: groupController, action: callable };
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
      } else if (call.method === 'group') {
        const options = this.asNode(call.arguments[0]);
        if (options?.kind === 'array' && Array.isArray(options.items)) {
          for (const item of options.items) {
            const entry = this.asNode(item);
            const key = this.stringValue(entry?.key);
            if (key === 'prefix') {
              context.prefix = this.joinPrefix(context.prefix, this.stringValue(entry?.value));
            } else if (key === 'controller') {
              context.controller = this.className(this.asNode(entry?.value), controllerAliases);
            }
          }
        }
      }
    }
    return context;
  }

  private joinPrefix(parent: string | undefined, child: string | undefined): string | undefined {
    const segments = [parent, child]
      .filter((segment): segment is string => Boolean(segment))
      .map(segment => segment.replace(/^\/+|\/+$/g, ''))
      .filter(Boolean);
    return segments.length > 0 ? `/${segments.join('/')}` : undefined;
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
