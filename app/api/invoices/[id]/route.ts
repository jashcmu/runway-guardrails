import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateInvoicePDF } from '@/lib/invoice-generator'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const download = request.nextUrl.searchParams.get('download') === 'true'

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: { company: true },
    })

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    if (download) {
      // Generate PDF
      const company = invoice.company
      const items = invoice.items ? JSON.parse(invoice.items) : []
      
      const invoiceData = {
        invoiceNumber: invoice.invoiceNumber,
        invoiceDate: invoice.invoiceDate,
        dueDate: invoice.dueDate || undefined,
        companyName: company.name,
        companyAddress: '', // Would need to add to Company model
        companyGSTIN: undefined, // Would need to add to Company model
        customerName: invoice.customerName,
        customerAddress: '', // Would need to add to Invoice model
        customerGSTIN: invoice.customerGSTIN || undefined,
        placeOfSupply: invoice.placeOfSupply || 'Not specified',
        isInterState: invoice.isInterState,
        items: items.map((item: any) => ({
          description: item.description || 'Item',
          quantity: item.quantity || 1,
          rate: item.rate || parseFloat(String(invoice.amount)),
          hsnSac: item.hsnSac || 'N/A',
          gstRate: invoice.gstRate,
          amount: parseFloat(String(invoice.amount)),
        })),
      }

      const pdfBuffer = generateInvoicePDF(invoiceData)
      
      return new NextResponse(Buffer.from(pdfBuffer), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="invoice-${invoice.invoiceNumber}.pdf"`,
        },
      })
    }

    return NextResponse.json({ invoice }, { status: 200 })
  } catch (error) {
    console.error('Get invoice error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch invoice' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const updateData: any = {}
    
    if (body.status) updateData.status = body.status
    if (body.dueDate) updateData.dueDate = new Date(body.dueDate)

    const invoice = await prisma.invoice.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({ invoice }, { status: 200 })
  } catch (error) {
    console.error('Update invoice error:', error)
    return NextResponse.json(
      { error: 'Failed to update invoice' },
      { status: 500 }
    )
  }
}

