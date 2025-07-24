import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  
  const debug = {
    timestamp: new Date().toISOString(),
    url: request.url,
    method: request.method,
    params: Object.fromEntries(searchParams),
    headers: {
      host: request.headers.get("host"),
      referer: request.headers.get("referer"),
      userAgent: request.headers.get("user-agent"),
    },
    cookies: request.cookies.getAll().map(c => ({ name: c.name, hasValue: !!c.value }))
  }
  
  console.log("[OAuth Debug] Callback received:", debug)
  
  return NextResponse.json(debug, { 
    status: 200,
    headers: {
      "Content-Type": "application/json"
    }
  })
}