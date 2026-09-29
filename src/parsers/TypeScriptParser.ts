import { BaseParser, ParseResult } from './Parser';
import { ASTParser, ASTParseResult } from './ASTParser';

export class TypeScriptParser extends BaseParser {
  readonly id = 'typescript-parser';
  readonly name = 'TypeScript Parser';
  readonly supportedExtensions = ['ts', 'tsx', 'js', 'jsx'];
  
  private astParser: ASTParser;

  constructor() {
    super();
    this.astParser = new ASTParser();
  }

  async parse(content: string, filePath: string): Promise<ParseResult> {
    const result = this.createEmptyResult();

    try {
      // Use AST parser for full TypeScript analysis
      const astResult: ASTParseResult = this.astParser.parse(content, filePath);

      // Convert AST imports to simple string array
      result.imports = astResult.imports.map(imp => imp.moduleName);

      // Convert AST exports to simple string array
      result.exports = astResult.exports.flatMap(exp => exp.exportedNames);

      // Convert AST functions to simple string array
      result.functions = astResult.functions.map(func => func.name);

      // Convert AST classes to simple string array
      result.classes = astResult.classes.map(cls => cls.name);

      // Store full AST result for advanced analysis
      (result as ParseResult & { astResult?: ASTParseResult }).astResult = astResult;

    } catch (error) {
      console.error(`[TypeScriptParser] Error parsing ${filePath}:`, error);
      
      // Fallback to basic regex parsing
      const importRegex = /import\s+.*?\s+from\s+['"](.+?)['"]/g;
      let match;
      
      while ((match = importRegex.exec(content)) !== null) {
        result.imports.push(match[1]);
      }
    }

    return result;
  }
  
  /**
   * Get detailed AST parse result
   */
  async parseDetailed(content: string, filePath: string): Promise<ASTParseResult> {
    return this.astParser.parse(content, filePath);
  }
}
