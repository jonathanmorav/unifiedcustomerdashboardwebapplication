export function formatCurrency(amount: string | number, currency: string = "USD"): string {
  const numAmount = typeof amount === "string" ? parseFloat(amount) : amount

  if (isNaN(numAmount) || !isFinite(numAmount)) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(0)
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(numAmount)
}
