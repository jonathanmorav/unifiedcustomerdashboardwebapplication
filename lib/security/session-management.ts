import { prisma } from "@/lib/db"
import crypto from "crypto"
import { AccountSecurity } from "./account-security"

export interface SessionDevice {
  fingerprint: string
  userAgent: string
  ipAddress: string
  country?: string
  city?: string
  lastSeen: Date
}

export interface SessionAnomaly {
  type: "new_device" | "new_location" | "impossible_travel" | "concurrent_sessions"
  severity: "low" | "medium" | "high"
  description: string
  metadata?: Record<string, any>
}

export class SessionManagement {
  private static readonly CONCURRENT_SESSION_LIMIT = 3
  private static readonly SESSION_IDLE_TIMEOUT = 30 * 60 * 1000 // 30 minutes
  private static readonly IMPOSSIBLE_TRAVEL_SPEED = 500 // km/h

  /**
   * Create device fingerprint from request data
   */
  static createDeviceFingerprint(
    userAgent: string,
    acceptLanguage?: string,
    acceptEncoding?: string
  ): string {
    const fingerprintData = [userAgent, acceptLanguage || "", acceptEncoding || ""].join("|")

    return crypto.createHash("sha256").update(fingerprintData).digest("hex").substring(0, 16)
  }

  /**
   * Track session with device information
   */
  static async trackSession(
    userId: string,
    sessionToken: string,
    device: Partial<SessionDevice>
  ): Promise<void> {
    // Store session metadata (in production, use Redis or similar)
    await prisma.session.update({
      where: { sessionToken },
      data: {
        // We'll extend the Session model in production
        // For now, log to audit trail
      },
    })

    await prisma.auditLog.create({
      data: {
        userId,
        action: "SESSION_CREATED",
        resource: "auth",
        ipAddress: device.ipAddress,
        userAgent: device.userAgent,
        metadata: {
          fingerprint: device.fingerprint,
          timestamp: new Date().toISOString(),
        },
      },
    })
  }

  /**
   * Get active sessions for a user
   */
  static async getActiveSessions(userId: string): Promise<
    Array<{
      id: string
      device: SessionDevice
      createdAt: Date
      lastActivity: Date
      current: boolean
    }>
  > {
    const sessions = await prisma.session.findMany({
      where: {
        userId,
        expires: { gte: new Date() },
      },
      orderBy: { expires: "desc" },
    })

    // In production, we'd have more detailed session metadata
    // For now, return basic session info
    return sessions.map((session) => ({
      id: session.id,
      device: {
        fingerprint: "unknown",
        userAgent: "unknown",
        ipAddress: "unknown",
        lastSeen: session.expires,
      },
      createdAt: session.expires,
      lastActivity: session.expires,
      current: false,
    }))
  }

  /**
   * Revoke specific session
   */
  static async revokeSession(userId: string, sessionId: string, revokedBy?: string): Promise<void> {
    await prisma.session.delete({
      where: {
        id: sessionId,
        userId,
      },
    })

    await prisma.auditLog.create({
      data: {
        userId: revokedBy || userId,
        action: "SESSION_REVOKED",
        resource: "auth",
        resourceId: sessionId,
        metadata: {
          targetUserId: userId,
          sessionId,
          timestamp: new Date().toISOString(),
        },
      },
    })
  }

  /**
   * Revoke all sessions for a user (logout everywhere)
   */
  static async revokeAllSessions(userId: string, exceptSessionId?: string): Promise<number> {
    const sessions = await prisma.session.findMany({
      where: {
        userId,
        id: exceptSessionId ? { not: exceptSessionId } : undefined,
      },
      select: { id: true },
    })

    if (sessions.length === 0) return 0

    await prisma.session.deleteMany({
      where: {
        userId,
        id: exceptSessionId ? { not: exceptSessionId } : undefined,
      },
    })

    await prisma.auditLog.create({
      data: {
        userId,
        action: "ALL_SESSIONS_REVOKED",
        resource: "auth",
        metadata: {
          sessionCount: sessions.length,
          exceptSessionId,
          timestamp: new Date().toISOString(),
        },
      },
    })

    return sessions.length
  }

  /**
   * Check for session anomalies
   */
  static async detectSessionAnomalies(
    userId: string,
    currentDevice: SessionDevice
  ): Promise<SessionAnomaly[]> {
    const anomalies: SessionAnomaly[] = []

    // Get recent login history
    const recentLogins = await prisma.loginAttempt.findMany({
      where: {
        userId,
        success: true,
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }, // Last 7 days
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    })

    // Check for new device
    const knownDevices = new Set(recentLogins.map((login) => login.userAgent).filter(Boolean))

    if (!knownDevices.has(currentDevice.userAgent)) {
      anomalies.push({
        type: "new_device",
        severity: "medium",
        description: "Login from previously unseen device",
        metadata: { userAgent: currentDevice.userAgent },
      })
    }

    // Check for new location (IP-based, simplified)
    const knownIPs = new Set(recentLogins.map((login) => login.ipAddress).filter(Boolean))

    if (!knownIPs.has(currentDevice.ipAddress)) {
      anomalies.push({
        type: "new_location",
        severity: "low",
        description: "Login from new IP address",
        metadata: { ipAddress: currentDevice.ipAddress },
      })
    }

    // Check for concurrent sessions from different locations
    const activeSessions = await this.getActiveSessions(userId)
    const concurrentLocations = new Set(activeSessions.map((s) => s.device.ipAddress))

    if (concurrentLocations.size > 1) {
      anomalies.push({
        type: "concurrent_sessions",
        severity: "medium",
        description: "Multiple active sessions from different locations",
        metadata: {
          locations: Array.from(concurrentLocations),
          sessionCount: activeSessions.length,
        },
      })
    }

    // Check for impossible travel (would need geolocation API)
    // This is a simplified check based on time between different IPs
    if (recentLogins.length > 1) {
      const lastLogin = recentLogins[1]
      if (lastLogin.ipAddress && lastLogin.ipAddress !== currentDevice.ipAddress) {
        const timeDiff = Date.now() - lastLogin.createdAt.getTime()
        const hoursDiff = timeDiff / (1000 * 60 * 60)

        // If login from different IP within 1 hour, flag as potential impossible travel
        if (hoursDiff < 1) {
          anomalies.push({
            type: "impossible_travel",
            severity: "high",
            description: "Login from different location too quickly",
            metadata: {
              previousIP: lastLogin.ipAddress,
              currentIP: currentDevice.ipAddress,
              hoursBetween: hoursDiff.toFixed(2),
            },
          })
        }
      }
    }

    return anomalies
  }

  /**
   * Handle detected anomalies
   */
  static async handleSessionAnomalies(userId: string, anomalies: SessionAnomaly[]): Promise<void> {
    // High severity anomalies trigger immediate action
    const highSeverity = anomalies.filter((a) => a.severity === "high")

    if (highSeverity.length > 0) {
      await AccountSecurity.escalateSecurityEvent(userId, "HIGH_SEVERITY_SESSION_ANOMALY", {
        anomalies: highSeverity,
        timestamp: new Date().toISOString(),
      })

      // Consider forcing MFA re-verification or temporary account lock
    }

    // Log all anomalies
    for (const anomaly of anomalies) {
      await prisma.auditLog.create({
        data: {
          userId,
          action: `SESSION_ANOMALY_${anomaly.type.toUpperCase()}`,
          resource: "auth",
          metadata: {
            severity: anomaly.severity,
            description: anomaly.description,
            ...anomaly.metadata,
          },
        },
      })
    }
  }

  /**
   * Enforce session limits
   */
  static async enforceSessionLimits(userId: string): Promise<void> {
    const sessions = await prisma.session.findMany({
      where: {
        userId,
        expires: { gte: new Date() },
      },
      orderBy: { expires: "asc" }, // Oldest first
    })

    if (sessions.length > this.CONCURRENT_SESSION_LIMIT) {
      // Revoke oldest sessions
      const sessionsToRevoke = sessions.slice(0, sessions.length - this.CONCURRENT_SESSION_LIMIT)

      for (const session of sessionsToRevoke) {
        await this.revokeSession(userId, session.id)
      }

      await prisma.auditLog.create({
        data: {
          userId,
          action: "SESSION_LIMIT_ENFORCED",
          resource: "auth",
          metadata: {
            limit: this.CONCURRENT_SESSION_LIMIT,
            revoked: sessionsToRevoke.length,
            timestamp: new Date().toISOString(),
          },
        },
      })
    }
  }

  /**
   * Check session health and activity
   */
  static async checkSessionHealth(sessionToken: string): Promise<{
    healthy: boolean
    reason?: string
  }> {
    const session = await prisma.session.findUnique({
      where: { sessionToken },
      include: { user: true },
    })

    if (!session) {
      return { healthy: false, reason: "Session not found" }
    }

    if (session.expires < new Date()) {
      return { healthy: false, reason: "Session expired" }
    }

    if (!session.user.isActive) {
      return { healthy: false, reason: "User account deactivated" }
    }

    if (session.user.lockedUntil && session.user.lockedUntil > new Date()) {
      return { healthy: false, reason: "User account locked" }
    }

    // Check for idle timeout (would need last activity tracking)
    // For now, consider session healthy if not expired

    return { healthy: true }
  }
}
