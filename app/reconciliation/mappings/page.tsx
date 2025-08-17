"use client"

import { useState, useEffect } from "react"
import { Header } from "@/components/v0/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { Plus, Edit2, Trash2, ArrowLeft, Save } from "lucide-react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"

interface CarrierMapping {
  id: string
  productName: string
  productCode?: string
  carrierName: string
  carrierCode?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export default function CarrierMappingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  
  const [mappings, setMappings] = useState<CarrierMapping[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingMapping, setEditingMapping] = useState<CarrierMapping | null>(null)
  const [formData, setFormData] = useState({
    productName: "",
    productCode: "",
    carrierName: "",
    carrierCode: "",
    isActive: true,
  })

  // Redirect if not authenticated
  useEffect(() => {
    if (status === "loading") return
    if (!session) {
      router.push("/auth/signin")
    }
  }, [session, status, router])

  // Fetch carrier mappings
  const fetchMappings = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/reconciliation/mappings", {
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to fetch mappings")
      }
      
      const data = await response.json()
      setMappings(data.mappings)
    } catch (error) {
      console.error("Error fetching mappings:", error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (session) {
      fetchMappings()
    }
  }, [session])

  const handleOpenDialog = (mapping?: CarrierMapping) => {
    if (mapping) {
      setEditingMapping(mapping)
      setFormData({
        productName: mapping.productName,
        productCode: mapping.productCode || "",
        carrierName: mapping.carrierName,
        carrierCode: mapping.carrierCode || "",
        isActive: mapping.isActive,
      })
    } else {
      setEditingMapping(null)
      setFormData({
        productName: "",
        productCode: "",
        carrierName: "",
        carrierCode: "",
        isActive: true,
      })
    }
    setIsDialogOpen(true)
  }

  const handleSaveMapping = async () => {
    try {
      const url = editingMapping 
        ? `/api/reconciliation/mappings/${editingMapping.id}`
        : "/api/reconciliation/mappings"
      
      const method = editingMapping ? "PUT" : "POST"
      
      const response = await fetch(url, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      if (!response.ok) throw new Error("Failed to save mapping")
      
      await fetchMappings()
      setIsDialogOpen(false)
    } catch (error) {
      console.error("Error saving mapping:", error)
      alert("Failed to save mapping")
    }
  }

  const handleDeleteMapping = async (id: string) => {
    if (!confirm("Are you sure you want to delete this mapping?")) return
    
    try {
      const response = await fetch(`/api/reconciliation/mappings/${id}`, {
        method: "DELETE",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      })

      if (!response.ok) throw new Error("Failed to delete mapping")
      
      await fetchMappings()
    } catch (error) {
      console.error("Error deleting mapping:", error)
      alert("Failed to delete mapping")
    }
  }

  const handleToggleActive = async (mapping: CarrierMapping) => {
    try {
      const response = await fetch(`/api/reconciliation/mappings/${mapping.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...mapping,
          isActive: !mapping.isActive,
        }),
      })

      if (!response.ok) throw new Error("Failed to update mapping")
      
      await fetchMappings()
    } catch (error) {
      console.error("Error updating mapping:", error)
      alert("Failed to update mapping")
    }
  }

  if (!session) {
    return null
  }

  // Group mappings by carrier
  const carrierGroups = mappings.reduce((acc, mapping) => {
    if (!acc[mapping.carrierName]) {
      acc[mapping.carrierName] = []
    }
    acc[mapping.carrierName].push(mapping)
    return acc
  }, {} as Record<string, CarrierMapping[]>)

  return (
    <div className="min-h-screen bg-cakewalk-alice-100">
      <Header />

      <main className="container mx-auto max-w-7xl px-4 py-6">
        {/* Page Title and Actions */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/reconciliation")}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Reconciliation
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-cakewalk-text-primary">
                Carrier Mappings
              </h1>
              <p className="mt-1 text-gray-600 dark:text-gray-400">
                Manage product to carrier mappings for reconciliation
              </p>
            </div>
          </div>
          <Button
            onClick={() => handleOpenDialog()}
            className="flex items-center gap-2 bg-cakewalk-primary hover:bg-cakewalk-primary-dark"
          >
            <Plus className="h-4 w-4" />
            Add Mapping
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="mb-6 grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Mappings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{mappings.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Active Mappings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {mappings.filter(m => m.isActive).length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Carriers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{Object.keys(carrierGroups).length}</div>
            </CardContent>
          </Card>
        </div>

        {/* Mappings by Carrier */}
        {Object.entries(carrierGroups).sort().map(([carrier, carrierMappings]) => (
          <Card key={carrier} className="mb-4">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{carrier}</span>
                <span className="text-sm font-normal text-gray-600">
                  {carrierMappings.length} products
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product Name</TableHead>
                    <TableHead>Product Code</TableHead>
                    <TableHead>Carrier Code</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {carrierMappings.map((mapping) => (
                    <TableRow key={mapping.id}>
                      <TableCell className="font-medium">{mapping.productName}</TableCell>
                      <TableCell>{mapping.productCode || "-"}</TableCell>
                      <TableCell>{mapping.carrierCode || "-"}</TableCell>
                      <TableCell>
                        <Switch
                          checked={mapping.isActive}
                          onCheckedChange={() => handleToggleActive(mapping)}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenDialog(mapping)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteMapping(mapping.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))}

        {/* Add/Edit Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>
                {editingMapping ? "Edit Mapping" : "Add New Mapping"}
              </DialogTitle>
              <DialogDescription>
                Map a product to a carrier for reconciliation purposes.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="productName" className="text-right">
                  Product Name
                </Label>
                <Input
                  id="productName"
                  value={formData.productName}
                  onChange={(e) => setFormData({ ...formData, productName: e.target.value })}
                  className="col-span-3"
                  placeholder="e.g., Dental"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="productCode" className="text-right">
                  Product Code
                </Label>
                <Input
                  id="productCode"
                  value={formData.productCode}
                  onChange={(e) => setFormData({ ...formData, productCode: e.target.value })}
                  className="col-span-3"
                  placeholder="e.g., DENT-001 (optional)"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="carrierName" className="text-right">
                  Carrier Name
                </Label>
                <Input
                  id="carrierName"
                  value={formData.carrierName}
                  onChange={(e) => setFormData({ ...formData, carrierName: e.target.value })}
                  className="col-span-3"
                  placeholder="e.g., SunLife"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="carrierCode" className="text-right">
                  Carrier Code
                </Label>
                <Input
                  id="carrierCode"
                  value={formData.carrierCode}
                  onChange={(e) => setFormData({ ...formData, carrierCode: e.target.value })}
                  className="col-span-3"
                  placeholder="e.g., SL-001 (optional)"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="isActive" className="text-right">
                  Active
                </Label>
                <Switch
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveMapping} className="bg-cakewalk-primary hover:bg-cakewalk-primary-dark">
                <Save className="mr-2 h-4 w-4" />
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  )
}