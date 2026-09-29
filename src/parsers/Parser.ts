export interface Parser {
  readonly id: string;
  readonly name: string;
  readonly supportedExtensions: string[];
  canParse(filePath: string): boolean;
  parse(content: string, filePath: string): Promise<ParseResult>;
}

export interface ParseRelationship {
  type: 'calls' | 'callback' | 'handles' | 'decorates' | 'uses' | 'extends' | 'implements';
  source: string;
  target: string;
  sourceLine: number;
}

export interface ParseResult {
  imports: string[];
  exports: string[];
  functions: string[];
  classes: string[];
  relationships: ParseRelationship[];
  errors: ParseError[];
}

export interface ParseError {
  message: string;
  line: number;
  column: number;
}

export abstract class BaseParser implements Parser {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly supportedExtensions: string[];

  canParse(filePath: string): boolean {
    const ext = filePath.split('.').pop()?.toLowerCase();
    return ext ? this.supportedExtensions.includes(ext) : false;
  }

  abstract parse(content: string, filePath: string): Promise<ParseResult>;

  protected createEmptyResult(): ParseResult {
    return {
      imports: [],
      exports: [],
      functions: [],
      classes: [],
      relationships: [],
      errors: []
    };
  }
}
