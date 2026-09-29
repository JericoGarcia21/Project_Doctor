import simpleGit, { SimpleGit } from 'simple-git';

export interface GitInfo {
  isRepository: boolean;
  currentBranch?: string;
  currentCommit?: string;
  repositoryRoot?: string;
  hasUncommittedChanges?: boolean;
}

export class GitService {
  private git: SimpleGit;

  constructor(workspacePath: string) {
    this.git = simpleGit(workspacePath);
  }

  async getGitInfo(): Promise<GitInfo> {
    try {
      const isRepo = await this.git.checkIsRepo();
      
      if (!isRepo) {
        return { isRepository: false };
      }

      const [branch, commit, status, root] = await Promise.all([
        this.getCurrentBranch(),
        this.getCurrentCommit(),
        this.git.status(),
        this.getRepositoryRoot()
      ]);

      return {
        isRepository: true,
        currentBranch: branch,
        currentCommit: commit,
        repositoryRoot: root,
        hasUncommittedChanges: !status.isClean()
      };
    } catch (error) {
      console.error('[GitService] Error getting Git info:', error);
      return { isRepository: false };
    }
  }

  async getCurrentBranch(): Promise<string | undefined> {
    try {
      const branch = await this.git.branch();
      return branch.current;
    } catch {
      return undefined;
    }
  }

  async getCurrentCommit(): Promise<string | undefined> {
    try {
      const log = await this.git.log({ maxCount: 1 });
      return log.latest?.hash;
    } catch {
      return undefined;
    }
  }

  async getRepositoryRoot(): Promise<string | undefined> {
    try {
      const root = await this.git.revparse(['--show-toplevel']);
      return root.trim();
    } catch {
      return undefined;
    }
  }

  async getFileHistory(filePath: string, maxCount: number = 10): Promise<string[]> {
    try {
      const log = await this.git.log({ file: filePath, maxCount });
      return log.all.map(commit => commit.hash);
    } catch {
      return [];
    }
  }
}
