import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { SystemStatus } from "@/components/monitoring/system-status"

export default async function AdminDashboard() {
  const session = await getServerSession(authOptions)

  // Redirect if not authenticated or not admin
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/dashboard")
  }

  return (
    <div className="cakewalk-container mx-auto p-6">
      <div className="mb-8">
        <h1 className="cakewalk-h1 mb-2">Admin Dashboard</h1>
        <p className="cakewalk-body-large text-muted-foreground">
          System monitoring and administration
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <div className="lg:col-span-3">
          <SystemStatus />
        </div>

        {/* Placeholder for future admin components */}
        <div className="rounded-lg bg-muted/50 p-6 text-center text-muted-foreground">
          <p>User Management</p>
          <p className="mt-2 text-sm">Coming soon</p>
        </div>

        <div className="rounded-lg bg-muted/50 p-6 text-center text-muted-foreground">
          <p>Audit Logs</p>
          <p className="mt-2 text-sm">Coming soon</p>
        </div>

        <div className="rounded-lg bg-muted/50 p-6 text-center text-muted-foreground">
          <p>API Usage</p>
          <p className="mt-2 text-sm">Coming soon</p>
        </div>
      </div>
    </div>
  )
}
