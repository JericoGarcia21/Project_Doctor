import { BaseAnalyzer } from './Analyzer';
import { ProjectContext } from '../core/types';
import { Finding } from '../diagnostics/Finding';
import { TSConfigValidator } from '../validators/TSConfigValidator';
import { PackageJsonValidator } from '../validators/PackageJsonValidator';

export class ConfigurationAnalyzer extends BaseAnalyzer {
  readonly id = 'configuration-analyzer';
  readonly name = 'Configuration Analyzer';
  readonly description = 'Validates project configuration files';

  private tsconfigValidator: TSConfigValidator;
  private packageJsonValidator: PackageJsonValidator;

  constructor() {
    super();
    this.tsconfigValidator = new TSConfigValidator();
    this.packageJsonValidator = new PackageJsonValidator();
  }

  async analyze(context: ProjectContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    this.log('Starting configuration analysis...');

    // Validate tsconfig.json
    const tsconfigFindings = await this.tsconfigValidator.validate(context.rootPath);
    findings.push(...tsconfigFindings);
    this.log(`TSConfig validation: ${tsconfigFindings.length} issues found`);

    // Validate package.json
    const packageJsonFindings = await this.packageJsonValidator.validate(context.rootPath);
    findings.push(...packageJsonFindings);
    this.log(`package.json validation: ${packageJsonFindings.length} issues found`);

    this.log(`Configuration analysis complete. Found ${findings.length} total issues.`);
    return findings;
  }
}
