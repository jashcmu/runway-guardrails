/**
 * GST (Goods and Services Tax) calculations for India
 */

export type GSTRate = 0 | 5 | 12 | 18 | 28

export interface GSTCalculation {
  baseAmount: number
  gstRate: GSTRate
  cgst: number // Central GST (half of GST rate)
  sgst: number // State GST (half of GST rate)
  igst: number // Integrated GST (for inter-state transactions)
  totalAmount: number
  isInterState: boolean
}

/**
 * Calculate GST for a transaction
 * @param baseAmount - Amount before GST
 * @param gstRate - GST rate (0, 5, 12, 18, or 28)
 * @param isInterState - Whether transaction is inter-state (uses IGST) or intra-state (uses CGST+SGST)
 */
export function calculateGST(
  baseAmount: number,
  gstRate: GSTRate,
  isInterState: boolean = false
): GSTCalculation {
  const gstAmount = (baseAmount * gstRate) / 100

  if (isInterState) {
    // Inter-state: IGST = full GST rate
    return {
      baseAmount,
      gstRate,
      cgst: 0,
      sgst: 0,
      igst: gstAmount,
      totalAmount: baseAmount + gstAmount,
      isInterState: true,
    }
  } else {
    // Intra-state: CGST + SGST = GST (each half)
    const cgst = gstAmount / 2
    const sgst = gstAmount / 2
    return {
      baseAmount,
      gstRate,
      cgst,
      sgst,
      igst: 0,
      totalAmount: baseAmount + gstAmount,
      isInterState: false,
    }
  }
}

/**
 * Extract GST from total amount (reverse calculation)
 */
export function extractGSTFromTotal(
  totalAmount: number,
  gstRate: GSTRate
): { baseAmount: number; gstAmount: number } {
  const baseAmount = (totalAmount * 100) / (100 + gstRate)
  const gstAmount = totalAmount - baseAmount
  return { baseAmount, gstAmount }
}

