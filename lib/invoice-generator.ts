/**
 * Invoice generator for Indian format with GST compliance
 */

import { jsPDF } from 'jspdf'

export interface InvoiceItem {
  description: string
  quantity: number
  rate: number
  hsnSac: string
  gstRate: number
  amount: number
}

export interface InvoiceData {
  invoiceNumber: string
  invoiceDate: Date
  dueDate?: Date
  companyName: string
  companyAddress: string
  companyGSTIN?: string
  customerName: string
  customerAddress: string
  customerGSTIN?: string
  placeOfSupply: string
  isInterState: boolean
  items: InvoiceItem[]
}

/**
 * Calculate GST amounts for invoice
 */
function calculateGST(item: InvoiceItem, isInterState: boolean) {
  const gstAmount = (item.amount * item.gstRate) / 100
  
  if (isInterState) {
    return {
      cgst: 0,
      sgst: 0,
      igst: gstAmount,
    }
  } else {
    return {
      cgst: gstAmount / 2,
      sgst: gstAmount / 2,
      igst: 0,
    }
  }
}

/**
 * Generate PDF invoice in Indian format
 */
export function generateInvoicePDF(data: InvoiceData): Uint8Array {
  const doc = new jsPDF()
  
  // Header
  doc.setFontSize(20)
  doc.text('TAX INVOICE', 105, 20, { align: 'center' })
  
  // Company details (left side)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text(data.companyName, 20, 35)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(data.companyAddress, 20, 42)
  if (data.companyGSTIN) {
    doc.text(`GSTIN: ${data.companyGSTIN}`, 20, 49)
  }
  
  // Invoice details (right side)
  doc.setFontSize(10)
  doc.text(`Invoice No: ${data.invoiceNumber}`, 150, 35)
  doc.text(`Date: ${data.invoiceDate.toLocaleDateString('en-IN')}`, 150, 42)
  if (data.dueDate) {
    doc.text(`Due Date: ${data.dueDate.toLocaleDateString('en-IN')}`, 150, 49)
  }
  
  // Customer details
  doc.setFont('helvetica', 'bold')
  doc.text('Bill To:', 20, 65)
  doc.setFont('helvetica', 'normal')
  doc.text(data.customerName, 20, 72)
  doc.text(data.customerAddress, 20, 79)
  if (data.customerGSTIN) {
    doc.text(`GSTIN: ${data.customerGSTIN}`, 20, 86)
  }
  doc.text(`Place of Supply: ${data.placeOfSupply}`, 20, 93)
  
  // Table header
  let yPos = 110
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('S.No.', 20, yPos)
  doc.text('Description', 35, yPos)
  doc.text('HSN/SAC', 100, yPos)
  doc.text('Qty', 125, yPos)
  doc.text('Rate', 140, yPos)
  doc.text('Amount', 160, yPos)
  doc.text('GST%', 180, yPos)
  
  yPos += 5
  doc.line(20, yPos, 190, yPos)
  yPos += 5
  
  // Items
  doc.setFont('helvetica', 'normal')
  let totalAmount = 0
  let totalCGST = 0
  let totalSGST = 0
  let totalIGST = 0
  
  data.items.forEach((item, index) => {
    const gst = calculateGST(item, data.isInterState)
    totalAmount += item.amount
    totalCGST += gst.cgst
    totalSGST += gst.sgst
    totalIGST += gst.igst
    
    doc.text(String(index + 1), 20, yPos)
    doc.text(item.description.substring(0, 30), 35, yPos)
    doc.text(item.hsnSac, 100, yPos)
    doc.text(item.quantity.toString(), 125, yPos)
    doc.text(`₹${item.rate.toFixed(2)}`, 140, yPos)
    doc.text(`₹${item.amount.toFixed(2)}`, 160, yPos)
    doc.text(`${item.gstRate}%`, 180, yPos)
    yPos += 7
    
    if (yPos > 250) {
      doc.addPage()
      yPos = 20
    }
  })
  
  // Totals
  yPos = Math.max(yPos, 240)
  doc.line(20, yPos, 190, yPos)
  yPos += 7
  
  doc.setFont('helvetica', 'bold')
  doc.text('Subtotal:', 140, yPos)
  doc.text(`₹${totalAmount.toFixed(2)}`, 180, yPos)
  yPos += 7
  
  if (data.isInterState) {
    doc.text('IGST:', 140, yPos)
    doc.text(`₹${totalIGST.toFixed(2)}`, 180, yPos)
  } else {
    doc.text('CGST:', 140, yPos)
    doc.text(`₹${totalCGST.toFixed(2)}`, 180, yPos)
    yPos += 7
    doc.text('SGST:', 140, yPos)
    doc.text(`₹${totalSGST.toFixed(2)}`, 180, yPos)
  }
  
  yPos += 7
  doc.line(140, yPos, 190, yPos)
  yPos += 7
  
  const grandTotal = totalAmount + totalCGST + totalSGST + totalIGST
  doc.setFontSize(12)
  doc.text('Total:', 140, yPos)
  doc.text(`₹${grandTotal.toFixed(2)}`, 180, yPos)
  
  // Footer
  yPos += 15
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.text('This is a computer-generated invoice.', 105, yPos, { align: 'center' })
  
  return doc.output('arraybuffer') as unknown as Uint8Array
}

