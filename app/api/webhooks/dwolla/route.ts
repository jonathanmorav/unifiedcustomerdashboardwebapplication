import { NextRequest, NextResponse } from "next/server"
import { log } from "@/lib/logger"

/**
 * Legacy Dwolla webhook endpoint - redirects to v2
 * This endpoint is deprecated but maintained for backwards compatibility
 */
export async function POST(request: NextRequest) {
  log.info("Legacy webhook endpoint called - redirecting to v2")
  
  try {
    // Forward the request to the v2 endpoint
    const v2Url = new URL('/api/webhooks/dwolla/v2', request.url)
    
    const response = await fetch(v2Url, {
      method: 'POST',
      headers: request.headers,
      body: await request.arrayBuffer()
    })

    return response
  } catch (error) {
    log.error("Failed to proxy webhook request to v2 endpoint", error instanceof Error ? error : new Error(String(error)))
    
    return new NextResponse(
      JSON.stringify({
        error: "Internal server error",
        message: "Failed to process webhook request"
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json"
        }
      }
    )
  }
}

/**
 * Handle OPTIONS request for CORS
 */
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Dwolla-Signature",
    },
  })
}