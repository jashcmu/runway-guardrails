import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'

/**
 * GST Report Automation
 * Auto-generate GSTR-1 and GSTR-3B reports
 */

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('companyId')
    const month = searchParams.get('month') // YYYY-MM format

    if (!companyId) {
      return NextResponse.json({ error: 'Company ID required' }, { status: 400 })
    }

    // If month specified, get that report
    if (month) {
      const report = await prisma.gSTReport.findUnique({
        where: {
          companyId_month: {
            companyId,
            month,
          },
        },
      })

      if (!report) {
        return NextResponse.json({ error: 'Report not found' }, { status: 404 })
      }

      return NextResponse.json({ report })
    }

    // Otherwise, get all reports
    const reports = await prisma.gSTReport.findMany({
      where: { companyId },
      orderBy: { month: 'desc' },
      take: 12,
    })

    return NextResponse.json({ reports })
  } catch (error) {
    console.error('Get GST reports error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch reports' },
      { status: 500 }
    )
  }
}

// Generate GST report for a month
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { companyId, month } = body // month in YYYY-MM format

    if (!companyId || !month) {
      return NextResponse.json(
        { error: 'Company ID and month required' },
        { status: 400 }
      )
    }

    // Parse month
    const [year, monthNum] = month.split('-').map(Number)
    const startDate = new Date(year, monthNum - 1, 1)
    const endDate = new Date(year, monthNum, 0, 23, 59, 59) // Last day of month

    // Get all invoices (GST collected)
    const invoices = await prisma.invoice.findMany({
      where: {
        companyId,
        invoiceDate: {
          gte: startDate,
          lte: endDate,
        },
      },
    })

    // Get all expenses with GST (GST paid)
    const expenses = await prisma.transaction.findMany({
      where: {
        companyId,
        date: {
          gte: startDate,
          lte: endDate,
        },
        gstRate: {
          gt: 0,
        },
      },
    })

    // Calculate GST collected (from sales)
    const gstCollected = invoices.reduce((sum, inv) => sum + inv.gstAmount, 0)

    // Calculate GST paid (from purchases)
    const gstPaid = expenses.reduce((sum, exp) => sum + (exp.gstAmount || 0), 0)

    // Net GST (to pay or claim)
    const netGST = gstCollected - gstPaid

    // Generate GSTR-1 data (outward supplies)
    const gstr1Data = generateGSTR1(invoices)

    // Generate GSTR-3B data (summary)
    const gstr3bData = generateGSTR3B(invoices, expenses, gstCollected, gstPaid, netGST)

    // Save report
    const report = await prisma.gSTReport.upsert({
      where: {
        companyId_month: {
          companyId,
          month,
        },
      },
      create: {
        companyId,
        month,
        gstCollected,
        gstPaid,
        netGST,
        gstr1Status: 'generated',
        gstr3bStatus: 'generated',
      },
      update: {
        gstCollected,
        gstPaid,
        netGST,
        gstr1Status: 'generated',
        gstr3bStatus: 'generated',
      },
    })

    return NextResponse.json({
      report,
      gstr1Data,
      gstr3bData,
      summary: {
        totalInvoices: invoices.length,
        totalExpenses: expenses.length,
        gstCollected,
        gstPaid,
        netGST,
        status: netGST > 0 ? 'To Pay' : 'Claim/Refund',
      },
    })
  } catch (error) {
    console.error('Generate GST report error:', error)
    return NextResponse.json(
      { error: 'Failed to generate report' },
      { status: 500 }
    )
  }
}

function generateGSTR1(invoices: any[]) {
  // GSTR-1 format: Outward supplies
  const gstr1 = {
    gstin: '', // Company GSTIN (to be filled)
    fp: '', // Filing period (MM-YYYY)
    b2b: [] as any[], // B2B supplies
    b2cl: [] as any[], // B2C Large (>2.5L)
    b2cs: [] as any[], // B2C Small
  }

  invoices.forEach(invoice => {
    const entry = {
      inum: invoice.invoiceNumber,
      idt: invoice.invoiceDate.toISOString().split('T')[0],
      val: invoice.totalAmount,
      pos: invoice.placeOfSupply || '29', // Default Karnataka
      rchrg: 'N',
      inv_typ: 'R',
      itms: [
        {
          num: 1,
          itm_det: {
            txval: invoice.amount,
            rt: invoice.gstRate,
            csamt: 0,
            camt: invoice.cgst || 0,
            samt: invoice.sgst || 0,
            iamt: invoice.igst || 0,
          },
        },
      ],
    }

    if (invoice.customerGSTIN) {
      // B2B transaction
      gstr1.b2b.push({
        ctin: invoice.customerGSTIN,
        inv: [entry],
      })
    } else if (invoice.totalAmount > 250000) {
      // B2C Large (>2.5L)
      gstr1.b2cl.push(entry)
    } else {
      // B2C Small
      gstr1.b2cs.push({
        sply_ty: invoice.isInterState ? 'INTER' : 'INTRA',
        ...entry,
      })
    }
  })

  return gstr1
}

function generateGSTR3B(
  invoices: any[],
  expenses: any[],
  gstCollected: number,
  gstPaid: number,
  netGST: number
) {
  // GSTR-3B format: Monthly return summary
  
  // Calculate tax liability
  const taxLiability = {
    outwardTaxableSupplies: invoices.reduce((sum, inv) => sum + inv.amount, 0),
    outwardTaxableSuppliesWithITC: 0,
    outwardTaxableSuppliesWithoutITC: 0,
    inwardSuppliesLiableToRCM: 0,
    nonGSTOutwardSupplies: 0,
  }

  // Calculate ITC (Input Tax Credit)
  const itc = {
    inputsITC: expenses.reduce((sum, exp) => sum + (exp.gstAmount || 0), 0),
    capitalGoodsITC: 0,
    inputServicesITC: 0,
    itcReversed: 0,
    netITC: gstPaid,
  }

  // Tax payable
  const taxPayable = {
    integratedTax: invoices.reduce((sum, inv) => sum + (inv.igst || 0), 0),
    centralTax: invoices.reduce((sum, inv) => sum + (inv.cgst || 0), 0),
    stateTax: invoices.reduce((sum, inv) => sum + (inv.sgst || 0), 0),
    cess: 0,
  }

  // Tax paid
  const taxPaid = {
    integratedTax: expenses.reduce((sum, exp) => sum + (exp.igst || 0), 0),
    centralTax: expenses.reduce((sum, exp) => sum + (exp.cgst || 0), 0),
    stateTax: expenses.reduce((sum, exp) => sum + (exp.sgst || 0), 0),
    cess: 0,
  }

  return {
    gstin: '', // Company GSTIN
    ret_period: '', // MM-YYYY
    taxLiability,
    itc,
    taxPayable,
    taxPaid,
    netTaxLiability: netGST,
    interestLatePayment: 0,
    lateFeesPayable: 0,
  }
}

// Mark report as filed
export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { companyId, month, reportType, filedBy } = body

    if (!companyId || !month || !reportType) {
      return NextResponse.json(
        { error: 'Company ID, month, and report type required' },
        { status: 400 }
      )
    }

    const updateData: any = {
      filedAt: new Date(),
      filedBy: filedBy || 'User',
    }

    if (reportType === 'gstr1') {
      updateData.gstr1Status = 'filed'
    } else if (reportType === 'gstr3b') {
      updateData.gstr3bStatus = 'filed'
    }

    const report = await prisma.gSTReport.update({
      where: {
        companyId_month: {
          companyId,
          month,
        },
      },
      data: updateData,
    })

    return NextResponse.json({
      success: true,
      report,
      message: `${reportType.toUpperCase()} marked as filed`,
    })
  } catch (error) {
    console.error('Mark GST report as filed error:', error)
    return NextResponse.json(
      { error: 'Failed to update report' },
      { status: 500 }
    )
  }
}




