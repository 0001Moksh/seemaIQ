/**
 * Cache Service Layer
 * Industry-standard in-memory caching for improved performance
 * Uses LRU (Least Recently Used) strategy for cache eviction
 */

interface CacheItem<T> {
  value: T
  expiry: number
}

interface CacheOptions {
  ttl?: number // Time to live in seconds
  maxSize?: number // Maximum cache size
}

export class CacheService {
  private static instance: CacheService
  private cache: Map<string, CacheItem<any>>
  private readonly defaultTTL: number = 300 // 5 minutes
  private readonly maxSize: number = 1000

  private constructor() {
    this.cache = new Map()
  }

  static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService()
    }
    return CacheService.instance
  }

  /**
   * Set cache value with optional TTL
   */
  set<T>(key: string, value: T, options?: CacheOptions): void {
    const ttl = options?.ttl || this.defaultTTL
    const expiry = Date.now() + ttl * 1000

    // Implement LRU eviction if cache is full
    if (this.cache.size >= (options?.maxSize || this.maxSize)) {
      const firstKey = this.cache.keys().next().value
      if (firstKey) {
        this.cache.delete(firstKey)
      }
    }

    this.cache.set(key, { value, expiry })
  }

  /**
   * Get cache value, return null if expired or not found
   */
  get<T>(key: string): T | null {
    const item = this.cache.get(key)

    if (!item) {
      return null
    }

    if (Date.now() > item.expiry) {
      this.cache.delete(key)
      return null
    }

    return item.value as T
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    const item = this.cache.get(key)
    if (!item) return false

    if (Date.now() > item.expiry) {
      this.cache.delete(key)
      return false
    }

    return true
  }

  /**
   * Delete a specific cache key
   */
  delete(key: string): void {
    this.cache.delete(key)
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * Invalidate cache by pattern (e.g., "user:*")
   */
  invalidatePattern(pattern: string): void {
    const regex = new RegExp(pattern.replace(/\*/g, ".*"))
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key)
      }
    }
  }

  /**
   * Get or set pattern (cache-aside pattern)
   */
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    options?: CacheOptions
  ): Promise<T> {
    const cached = this.get<T>(key)
    if (cached !== null) {
      return cached
    }

    const value = await fetcher()
    this.set(key, value, options)
    return value
  }

  /**
   * Get cache statistics
   */
  getStats() {
    let expired = 0
    const now = Date.now()

    for (const [_, item] of this.cache.entries()) {
      if (now > item.expiry) {
        expired++
      }
    }

    return {
      size: this.cache.size,
      expired,
      active: this.cache.size - expired,
    }
  }

  /**
   * Clean expired entries
   */
  cleanup(): void {
    const now = Date.now()
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiry) {
        this.cache.delete(key)
      }
    }
  }
}

// Export singleton instance
export const cache = CacheService.getInstance()

// Auto-cleanup every 10 minutes
if (typeof window === "undefined") {
  // Server-side only
  setInterval(() => {
    cache.cleanup()
  }, 10 * 60 * 1000)
}
