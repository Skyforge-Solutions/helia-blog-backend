/**
 * Simple in-memory cache with automatic expiration
 * Used to reduce database load for frequently accessed data
 */

type CacheEntry<T> = {
  value: T;
  expiry: number;
};

class MemoryCache {
  private cache: Map<string, CacheEntry<any>> = new Map();

  /**
   * Set a value in the cache with expiration
   * @param key Cache key
   * @param value Value to store
   * @param ttlSeconds Time to live in seconds (default: 60s)
   */
  set<T>(key: string, value: T, ttlSeconds: number = 60): void {
    const expiry = Date.now() + ttlSeconds * 1000;
    this.cache.set(key, { value, expiry });

    // Auto cleanup after expiry
    if (ttlSeconds > 0) {
      setTimeout(() => {
        this.deleteIfExpired(key);
      }, ttlSeconds * 1000);
    }
  }

  /**
   * Get a value from the cache
   * @param key Cache key
   * @returns The cached value or null if not found or expired
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    // Return null if entry doesn't exist or is expired
    if (!entry || entry.expiry < Date.now()) {
      if (entry) this.cache.delete(key);
      return null;
    }

    return entry.value as T;
  }

  /**
   * Delete a key from the cache
   * @param key Cache key
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Delete a key if it's expired
   * @param key Cache key
   */
  private deleteIfExpired(key: string): void {
    const entry = this.cache.get(key);
    if (entry && entry.expiry < Date.now()) {
      this.cache.delete(key);
    }
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get size of cache
   */
  size(): number {
    return this.cache.size;
  }
}

// Export a singleton cache instance
export const cache = new MemoryCache();
