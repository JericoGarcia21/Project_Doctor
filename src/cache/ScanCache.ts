import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  hash: string;
}

export class ScanCache {
  private cacheDir: string;
  private memoryCache: Map<string, CacheEntry<any>>;
  private maxAge: number; // milliseconds

  constructor(cacheDir: string, maxAgeMinutes: number = 60) {
    this.cacheDir = cacheDir;
    this.memoryCache = new Map();
    this.maxAge = maxAgeMinutes * 60 * 1000;
  }

  /**
   * Initialize cache directory
   */
  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
    } catch (error) {
      console.error('[Cache] Failed to create cache directory:', error);
    }
  }

  /**
   * Generate cache key from file path
   */
  private getCacheKey(filePath: string): string {
    return crypto.createHash('md5').update(filePath).digest('hex');
  }

  /**
   * Get file hash for change detection
   */
  private async getFileHash(filePath: string): Promise<string> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return crypto.createHash('md5').update(content).digest('hex');
    } catch {
      return '';
    }
  }

  /**
   * Get cached data for a file
   */
  async get<T>(filePath: string): Promise<T | null> {
    const key = this.getCacheKey(filePath);

    // Check memory cache first
    if (this.memoryCache.has(key)) {
      const entry = this.memoryCache.get(key)!;
      
      // Check if cache is still valid
      if (Date.now() - entry.timestamp < this.maxAge) {
        // Verify file hasn't changed
        const currentHash = await this.getFileHash(filePath);
        if (currentHash === entry.hash) {
          return entry.data as T;
        }
      }
      
      // Cache expired or file changed
      this.memoryCache.delete(key);
    }

    // Check disk cache
    try {
      const cacheFilePath = path.join(this.cacheDir, `${key}.json`);
      const cacheContent = await fs.readFile(cacheFilePath, 'utf-8');
      const entry: CacheEntry<T> = JSON.parse(cacheContent);

      // Check if cache is still valid
      if (Date.now() - entry.timestamp < this.maxAge) {
        // Verify file hasn't changed
        const currentHash = await this.getFileHash(filePath);
        if (currentHash === entry.hash) {
          // Load into memory cache
          this.memoryCache.set(key, entry);
          return entry.data;
        }
      }

      // Cache expired or file changed, delete it
      await fs.unlink(cacheFilePath).catch(() => {});
    } catch {
      // Cache miss
    }

    return null;
  }

  /**
   * Set cached data for a file
   */
  async set<T>(filePath: string, data: T): Promise<void> {
    const key = this.getCacheKey(filePath);
    const hash = await this.getFileHash(filePath);

    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      hash
    };

    // Save to memory cache
    this.memoryCache.set(key, entry);

    // Save to disk cache
    try {
      const cacheFilePath = path.join(this.cacheDir, `${key}.json`);
      await fs.writeFile(cacheFilePath, JSON.stringify(entry), 'utf-8');
    } catch (error) {
      console.error('[Cache] Failed to write cache file:', error);
    }
  }

  /**
   * Check if file has valid cache
   */
  async has(filePath: string): Promise<boolean> {
    const cached = await this.get(filePath);
    return cached !== null;
  }

  /**
   * Invalidate cache for a file
   */
  async invalidate(filePath: string): Promise<void> {
    const key = this.getCacheKey(filePath);
    
    // Remove from memory
    this.memoryCache.delete(key);

    // Remove from disk
    try {
      const cacheFilePath = path.join(this.cacheDir, `${key}.json`);
      await fs.unlink(cacheFilePath);
    } catch {
      // File doesn't exist, that's fine
    }
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    // Clear memory cache
    this.memoryCache.clear();

    // Clear disk cache
    try {
      const files = await fs.readdir(this.cacheDir);
      await Promise.all(
        files.map(file => fs.unlink(path.join(this.cacheDir, file)).catch(() => {}))
      );
    } catch {
      // Directory doesn't exist or can't be read
    }
  }

  /**
   * Get cache statistics
   */
  getStatistics(): {
    memoryCacheSize: number;
    diskCacheSize: number;
    maxAge: number;
  } {
    return {
      memoryCacheSize: this.memoryCache.size,
      diskCacheSize: -1, // Would need to read directory
      maxAge: this.maxAge
    };
  }

  /**
   * Clean expired cache entries
   */
  async cleanExpired(): Promise<number> {
    let cleaned = 0;

    // Clean memory cache
    const now = Date.now();
    for (const [key, entry] of this.memoryCache.entries()) {
      if (now - entry.timestamp >= this.maxAge) {
        this.memoryCache.delete(key);
        cleaned++;
      }
    }

    // Clean disk cache
    try {
      const files = await fs.readdir(this.cacheDir);
      
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        
        const filePath = path.join(this.cacheDir, file);
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          const entry = JSON.parse(content);
          
          if (now - entry.timestamp >= this.maxAge) {
            await fs.unlink(filePath);
            cleaned++;
          }
        } catch {
          // Invalid cache file, delete it
          await fs.unlink(filePath).catch(() => {});
          cleaned++;
        }
      }
    } catch {
      // Can't read directory
    }

    return cleaned;
  }
}
