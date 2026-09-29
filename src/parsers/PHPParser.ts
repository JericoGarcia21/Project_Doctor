import { BaseParser, ParseResult } from './Parser';

export class PHPParser extends BaseParser {
  readonly id = 'php-parser';
  readonly name = 'PHP Parser';
  readonly supportedExtensions = ['php'];

  async parse(_content: string, _filePath: string): Promise<ParseResult> {
    // Placeholder - will be implemented in Phase 3 for Laravel support
    const result = this.createEmptyResult();
    
    return result;
  }
}
