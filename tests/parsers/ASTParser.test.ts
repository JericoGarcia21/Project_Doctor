import { describe, it, expect } from 'vitest';
import { ASTParser } from '../../src/parsers/ASTParser';

describe('ASTParser', () => {
  const parser = new ASTParser();

  describe('Import Detection', () => {
    it('should detect default imports', () => {
      const code = `import React from 'react';`;
      const result = parser.parse(code, 'test.ts');

      expect(result.imports).toHaveLength(1);
      expect(result.imports[0].moduleName).toBe('react');
      expect(result.imports[0].importType).toBe('default');
      expect(result.imports[0].importedNames).toContain('React');
    });

    it('should detect named imports', () => {
      const code = `import { useState, useEffect } from 'react';`;
      const result = parser.parse(code, 'test.ts');

      expect(result.imports).toHaveLength(1);
      expect(result.imports[0].moduleName).toBe('react');
      expect(result.imports[0].importType).toBe('named');
      expect(result.imports[0].importedNames).toContain('useState');
      expect(result.imports[0].importedNames).toContain('useEffect');
    });

    it('should detect namespace imports', () => {
      const code = `import * as React from 'react';`;
      const result = parser.parse(code, 'test.ts');

      expect(result.imports).toHaveLength(1);
      expect(result.imports[0].moduleName).toBe('react');
      expect(result.imports[0].importType).toBe('namespace');
      expect(result.imports[0].importedNames).toContain('React');
    });

    it('should detect side-effect imports', () => {
      const code = `import './styles.css';`;
      const result = parser.parse(code, 'test.ts');

      expect(result.imports).toHaveLength(1);
      expect(result.imports[0].moduleName).toBe('./styles.css');
      expect(result.imports[0].importType).toBe('side-effect');
      expect(result.imports[0].importedNames).toHaveLength(0);
    });

    it('should detect type-only imports', () => {
      const code = `import type { User } from './types';`;
      const result = parser.parse(code, 'test.ts');

      expect(result.imports).toHaveLength(1);
      expect(result.imports[0].isTypeOnly).toBe(true);
    });

    it('should detect multiple imports', () => {
      const code = `
        import React from 'react';
        import { useState } from 'react';
        import * as Utils from './utils';
      `;
      const result = parser.parse(code, 'test.ts');

      expect(result.imports).toHaveLength(3);
    });
  });

  describe('Export Detection', () => {
    it('should detect named exports', () => {
      const code = `export { foo, bar };`;
      const result = parser.parse(code, 'test.ts');

      expect(result.exports).toHaveLength(1);
      expect(result.exports[0].exportType).toBe('named');
      expect(result.exports[0].exportedNames).toContain('foo');
      expect(result.exports[0].exportedNames).toContain('bar');
    });

    it('should detect default exports', () => {
      const code = `export default function myFunc() {}`;
      const result = parser.parse(code, 'test.ts');

      expect(result.exports).toHaveLength(1);
      expect(result.exports[0].exportType).toBe('default');
    });

    it('should detect re-exports', () => {
      const code = `export { foo } from './module';`;
      const result = parser.parse(code, 'test.ts');

      expect(result.exports).toHaveLength(1);
      expect(result.exports[0].exportType).toBe('re-export');
      expect(result.exports[0].exportedFrom).toBe('./module');
    });
  });

  describe('Function Detection', () => {
    it('should detect function declarations', () => {
      const code = `function myFunction(a, b) { return a + b; }`;
      const result = parser.parse(code, 'test.ts');

      expect(result.functions).toHaveLength(1);
      expect(result.functions[0].name).toBe('myFunction');
      expect(result.functions[0].parameters).toEqual(['a', 'b']);
    });

    it('should detect arrow functions', () => {
      const code = `const myFunc = (x, y) => x + y;`;
      const result = parser.parse(code, 'test.ts');

      expect(result.functions).toHaveLength(1);
      expect(result.functions[0].name).toBe('myFunc');
      expect(result.functions[0].parameters).toEqual(['x', 'y']);
    });

    it('should detect async functions', () => {
      const code = `async function fetchData() { return data; }`;
      const result = parser.parse(code, 'test.ts');

      expect(result.functions).toHaveLength(1);
      expect(result.functions[0].isAsync).toBe(true);
    });

    it('should detect exported functions', () => {
      const code = `export function myFunction() {}`;
      const result = parser.parse(code, 'test.ts');

      expect(result.functions).toHaveLength(1);
      expect(result.functions[0].isExported).toBe(true);
    });
  });

  describe('Class Detection', () => {
    it('should detect class declarations', () => {
      const code = `class MyClass { constructor() {} }`;
      const result = parser.parse(code, 'test.ts');

      expect(result.classes).toHaveLength(1);
      expect(result.classes[0].name).toBe('MyClass');
    });

    it('should detect class methods and properties', () => {
      const code = `
        class MyClass {
          myProperty = 'value';
          myMethod() { return 'result'; }
        }
      `;
      const result = parser.parse(code, 'test.ts');

      expect(result.classes[0].properties).toContain('myProperty');
      expect(result.classes[0].methods).toContain('myMethod');
    });

    it('should detect class inheritance', () => {
      const code = `class Child extends Parent {}`;
      const result = parser.parse(code, 'test.ts');

      expect(result.classes[0].extendsClass).toBe('Parent');
    });

    it('should detect implemented interfaces', () => {
      const code = `class MyClass implements IInterface {}`;
      const result = parser.parse(code, 'test.ts');

      expect(result.classes[0].implements).toContain('IInterface');
    });

    it('should detect abstract classes', () => {
      const code = `abstract class BaseClass {}`;
      const result = parser.parse(code, 'test.ts');

      expect(result.classes[0].isAbstract).toBe(true);
    });
  });

  describe('Interface Detection', () => {
    it('should detect interface declarations', () => {
      const code = `interface IUser { name: string; age: number; }`;
      const result = parser.parse(code, 'test.ts');

      expect(result.interfaces).toHaveLength(1);
      expect(result.interfaces[0].name).toBe('IUser');
      expect(result.interfaces[0].properties).toContain('name');
      expect(result.interfaces[0].properties).toContain('age');
    });

    it('should detect interface extension', () => {
      const code = `interface IChild extends IParent {}`;
      const result = parser.parse(code, 'test.ts');

      expect(result.interfaces[0].extends).toContain('IParent');
    });
  });

  describe('JSX Detection', () => {
    it('should detect JSX in TSX files', () => {
      const code = `
        const MyComponent = () => {
          return <div>Hello</div>;
        };
      `;
      const result = parser.parse(code, 'test.tsx');

      expect(result.hasJSX).toBe(true);
    });

    it('should not detect JSX in regular TS files', () => {
      const code = `const x = 5;`;
      const result = parser.parse(code, 'test.ts');

      expect(result.hasJSX).toBe(false);
    });
  });

  describe('TypeScript Detection', () => {
    it('should detect TypeScript files', () => {
      const code = `const x: number = 5;`;
      const result = parser.parse(code, 'test.ts');

      expect(result.hasTypeScript).toBe(true);
    });

    it('should detect TypeScript in TSX files', () => {
      const code = `const x: number = 5;`;
      const result = parser.parse(code, 'test.tsx');

      expect(result.hasTypeScript).toBe(true);
    });
  });

  describe('Relationship Detection', () => {
    it('should track function calls between local functions', () => {
      const code = `
        function helper() { return 1; }
        function app() { return helper(); }
      `;
      const result = parser.parse(code, 'test.ts');

      expect(result.relationships).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'calls',
            source: 'app',
            target: 'helper'
          })
        ])
      );
    });

    it('should track inheritance and interface implementation', () => {
      const code = `
        class Parent {}
        interface Runner {}
        class Child extends Parent implements Runner {}
      `;
      const result = parser.parse(code, 'test.ts');

      expect(result.relationships).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'extends',
            source: 'Child',
            target: 'Parent'
          }),
          expect.objectContaining({
            type: 'implements',
            source: 'Child',
            target: 'Runner'
          })
        ])
      );
    });
  });
});
