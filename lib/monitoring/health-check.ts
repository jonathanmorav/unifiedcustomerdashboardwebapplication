import { prisma } from '@/lib/db'
import { HubSpotClient } from '@/lib/api/hubspot/client'
import { DwollaClient } from '@/lib/api/dwolla/client'
import { log } from '@/lib/logger'

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  version: string
  uptime: number
  checks: {
    database: ComponentHealth
    hubspot: ComponentHealth
    dwolla: ComponentHealth
    memory: ComponentHealth
  }
}

export interface ComponentHealth {
  status: 'up' | 'down' | 'degraded'
  responseTime?: number
  message?: string
  details?: Record<string, any>
}

export interface ReadinessCheckResult extends HealthCheckResult {
  ready: boolean
  errors: string[]
}

// Track application start time
const startTime = Date.now()

export class HealthCheckService {
  private static hubspotClient: HubSpotClient | null = null
  private static dwollaClient: DwollaClient | null = null
  
  private static getHubSpotClient(): HubSpotClient | null {
    if (!this.hubspotClient) {
      try {
        this.hubspotClient = new HubSpotClient()
      } catch (error) {
        // In test environment, clients may fail to initialize
        if (process.env.NODE_ENV === 'test') {
          return null
        }
        throw error
      }
    }
    return this.hubspotClient
  }
  
  private static getDwollaClient(): DwollaClient | null {
    if (!this.dwollaClient) {
      try {
        this.dwollaClient = new DwollaClient()
      } catch (error) {
        // In test environment, clients may fail to initialize
        if (process.env.NODE_ENV === 'test') {
          return null
        }
        throw error
      }
    }
    return this.dwollaClient
  }

  /**
   * Basic health check - just confirms the service is running
   */
  static async checkLiveness(): Promise<{ status: 'ok'; timestamp: string }> {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    }
  }

  /**
   * Comprehensive health check including all dependencies
   */
  static async checkHealth(): Promise<HealthCheckResult> {
    const checks = await Promise.all([
      this.checkDatabase(),
      this.checkHubSpotAPI(),
      this.checkDwollaAPI(),
      this.checkMemory(),
    ])

    const [database, hubspot, dwolla, memory] = checks

    // Determine overall status
    const hasDown = checks.some(check => check.status === 'down')
    const hasDegraded = checks.some(check => check.status === 'degraded')
    
    let status: 'healthy' | 'degraded' | 'unhealthy'
    if (hasDown) {
      status = 'unhealthy'
    } else if (hasDegraded) {
      status = 'degraded'
    } else {
      status = 'healthy'
    }

    return {
      status,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '0.3.0',
      uptime: Math.floor((Date.now() - startTime) / 1000), // seconds
      checks: {
        database,
        hubspot,
        dwolla,
        memory,
      },
    }
  }

  /**
   * Readiness check - determines if the service is ready to handle requests
   */
  static async checkReadiness(): Promise<ReadinessCheckResult> {
    const health = await this.checkHealth()
    const errors: string[] = []

    // Check critical components
    if (health.checks.database.status === 'down') {
      errors.push('Database connection failed')
    }

    // Memory threshold - warn if over 90% used
    const memoryUsage = health.checks.memory.details?.percentUsed || 0
    if (memoryUsage > 90) {
      errors.push(`Memory usage critical: ${memoryUsage.toFixed(1)}%`)
    }

    // External APIs being down is not critical for readiness
    // but we log warnings
    if (health.checks.hubspot.status === 'down') {
      log.warn('HubSpot API is unavailable', {
        operation: 'readiness_check',
        component: 'hubspot'
      })
    }

    if (health.checks.dwolla.status === 'down') {
      log.warn('Dwolla API is unavailable', {
        operation: 'readiness_check',
        component: 'dwolla'
      })
    }

    return {
      ...health,
      ready: errors.length === 0,
      errors,
    }
  }

  /**
   * Check database connectivity
   */
  private static async checkDatabase(): Promise<ComponentHealth> {
    const start = Date.now()
    
    try {
      // Simple query to check connection
      await prisma.$queryRaw`SELECT 1`
      
      const responseTime = Date.now() - start
      
      return {
        status: responseTime > 1000 ? 'degraded' : 'up',
        responseTime,
        message: responseTime > 1000 ? 'Slow database response' : 'Database is healthy',
      }
    } catch (error) {
      log.error('Database health check failed', error as Error, {
        operation: 'health_check_database'
      })
      
      return {
        status: 'down',
        responseTime: Date.now() - start,
        message: 'Database connection failed',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      }
    }
  }

  /**
   * Check HubSpot API availability
   */
  private static async checkHubSpotAPI(): Promise<ComponentHealth> {
    const start = Date.now()
    
    try {
      // Make a lightweight API call
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000) // 5s timeout
      
      try {
        const client = this.getHubSpotClient()
        if (!client) {
          return {
            status: 'down',
            message: 'HubSpot client not initialized',
          }
        }
        
        // Search with a non-existent ID to minimize response size
        await client.searchCompanies('health-check-test', 'email')
        
        const responseTime = Date.now() - start
        
        return {
          status: responseTime > 3000 ? 'degraded' : 'up',
          responseTime,
          message: responseTime > 3000 ? 'Slow HubSpot API response' : 'HubSpot API is healthy',
        }
      } finally {
        clearTimeout(timeoutId)
      }
    } catch (error) {
      // Don't log every health check failure to avoid log spam
      if (Math.random() < 0.1) { // Log 10% of failures
        log.warn('HubSpot health check failed', {
          error: error instanceof Error ? error.message : 'Unknown error',
          operation: 'health_check_hubspot'
        })
      }
      
      return {
        status: 'down',
        responseTime: Date.now() - start,
        message: 'HubSpot API unavailable',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      }
    }
  }

  /**
   * Check Dwolla API availability
   */
  private static async checkDwollaAPI(): Promise<ComponentHealth> {
    const start = Date.now()
    
    try {
      const client = this.getDwollaClient()
      if (!client) {
        return {
          status: 'down',
          message: 'Dwolla client not initialized',
        }
      }
      
      // Check if we can get a valid token
      const isTokenValid = client.isRateLimited() ? false : true
      
      if (!isTokenValid) {
        return {
          status: 'degraded',
          message: 'Dwolla API rate limited',
          details: {
            resetTime: client.getRateLimitResetTime()?.toISOString(),
          },
        }
      }
      
      // Make a lightweight API call
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000) // 5s timeout
      
      try {
        // Search with a non-existent email to minimize response size
        await client.searchCustomers(
          { email: 'health-check@example.com' },
          controller.signal
        )
        
        const responseTime = Date.now() - start
        
        return {
          status: responseTime > 3000 ? 'degraded' : 'up',
          responseTime,
          message: responseTime > 3000 ? 'Slow Dwolla API response' : 'Dwolla API is healthy',
        }
      } finally {
        clearTimeout(timeoutId)
      }
    } catch (error) {
      // Don't log every health check failure to avoid log spam
      if (Math.random() < 0.1) { // Log 10% of failures
        log.warn('Dwolla health check failed', {
          error: error instanceof Error ? error.message : 'Unknown error',
          operation: 'health_check_dwolla'
        })
      }
      
      return {
        status: 'down',
        responseTime: Date.now() - start,
        message: 'Dwolla API unavailable',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      }
    }
  }

  /**
   * Check memory usage
   */
  private static async checkMemory(): Promise<ComponentHealth> {
    const usage = process.memoryUsage()
    const heapUsed = usage.heapUsed
    const heapTotal = usage.heapTotal
    const percentUsed = (heapUsed / heapTotal) * 100
    
    let status: 'up' | 'degraded' | 'down'
    let message: string
    
    if (percentUsed > 95) {
      status = 'down'
      message = 'Memory usage critical'
    } else if (percentUsed > 80) {
      status = 'degraded'
      message = 'Memory usage high'
    } else {
      status = 'up'
      message = 'Memory usage normal'
    }
    
    return {
      status,
      message,
      details: {
        heapUsed: Math.round(heapUsed / 1024 / 1024), // MB
        heapTotal: Math.round(heapTotal / 1024 / 1024), // MB
        rss: Math.round(usage.rss / 1024 / 1024), // MB
        external: Math.round(usage.external / 1024 / 1024), // MB
        percentUsed: parseFloat(percentUsed.toFixed(2)),
      },
    }
  }
}