#!/usr/bin/env tsx

import { log } from '../lib/logger'

async function testAnalyticsAPI() {
  console.log('Testing Analytics API Endpoints...\n')

  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
  const endpoints = [
    '/api/analytics/metrics',
    '/api/analytics/events',
    '/api/analytics/journeys',
    '/api/analytics/anomalies',
    '/api/analytics/reconciliation'
  ]

  // First, get a session cookie (you'll need to be logged in)
  console.log('⚠️  Note: You need to be logged in to the application for these tests to work')
  console.log('  Please log in to the application in your browser first\n')

  for (const endpoint of endpoints) {
    console.log(`Testing ${endpoint}...`)
    
    try {
      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      })

      if (response.ok) {
        const data = await response.json()
        console.log(`✅ ${endpoint} - Success`)
        console.log(`   Response keys: ${Object.keys(data).join(', ')}`)
        
        if (data.metrics) {
          console.log(`   Metrics keys: ${Object.keys(data.metrics).join(', ')}`)
        }
      } else {
        console.log(`❌ ${endpoint} - Failed (${response.status} ${response.statusText})`)
        
        try {
          const error = await response.json()
          console.log(`   Error: ${JSON.stringify(error, null, 2)}`)
        } catch (e) {
          const text = await response.text()
          console.log(`   Response: ${text.substring(0, 200)}...`)
        }
      }
    } catch (error) {
      console.log(`❌ ${endpoint} - Network Error`)
      console.log(`   Error: ${error}`)
    }
    
    console.log('')
  }

  console.log('\nDiagnostics:')
  console.log('1. If you see 401 errors, make sure you are logged in')
  console.log('2. If you see 404 errors, the endpoint may not be implemented')
  console.log('3. If you see 500 errors, check the server logs for database/query issues')
  console.log('4. Run "npm run dev" in another terminal to see server-side errors')
}

// Run the test
testAnalyticsAPI()