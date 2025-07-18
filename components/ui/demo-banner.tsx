export function DemoBanner() {
  const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true" || !process.env.NEXT_PUBLIC_HUBSPOT_CONFIGURED

  if (!isDemoMode) return null

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-center text-sm text-amber-800">
      <strong>Demo Mode:</strong> Using mock data. Configure API credentials to see real data.
    </div>
  )
}