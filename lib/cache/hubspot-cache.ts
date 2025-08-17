import { logger } from "@/lib/logger"

interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

/**
 * Simple in-memory cache for HubSpot data to reduce API calls
 */
export class HubSpotCache {
  private cache = new Map<string, CacheEntry<any>>()
  private defaultTTL = 5 * 60 * 1000 // 5 minutes

  /**
   * Get cached data if available and not expired
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key)
    
    if (!entry) {
      return null
    }
    
    const now = Date.now()
    if (now - entry.timestamp > entry.ttl) {
      // Cache expired
      this.cache.delete(key)
      return null
    }
    
    logger.debug("Cache hit for HubSpot data", { key })
    return entry.data as T
  }

  /**
   * Store data in cache
   */
  set<T>(key: string, data: T, ttl?: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL
    })
    
    logger.debug("Cached HubSpot data", { key, ttl: ttl || this.defaultTTL })
  }

  /**
   * Clear specific cache entry
   */
  delete(key: string): void {
    this.cache.delete(key)
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear()
    logger.info("HubSpot cache cleared")
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    }
  }

  /**
   * Clean up expired entries
   */
  cleanup(): void {
    const now = Date.now()
    let cleaned = 0
    
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key)
        cleaned++
      }
    }
    
    if (cleaned > 0) {
      logger.debug(`Cleaned ${cleaned} expired cache entries`)
    }
  }
}

// Singleton instance
export const hubspotCache = new HubSpotCache()

// Run cleanup every minute
if (typeof window === 'undefined') {
  setInterval(() => hubspotCache.cleanup(), 60 * 1000)
}