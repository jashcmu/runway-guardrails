import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Vendor Contract Management
 * Track renewals, commitments, and send alerts
 */

// Get all vendor contracts
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('companyId')
    const status = searchParams.get('status') // active, cancelled, expired

    if (!companyId) {
      return NextResponse.json({ error: 'Company ID required' }, { status: 400 })
    }

    const where: any = { companyId }
    if (status) {
      where.status = status
    }

    const contracts = await prisma.vendorContract.findMany({
      where,
      orderBy: { renewalDate: 'asc' },
    })

    // Calculate upcoming renewals (next 30 days)
    const now = new Date()
    const thirtyDaysFromNow = new Date()
    thirtyDaysFromNow.setDate(now.getDate() + 30)

    const upcomingRenewals = contracts.filter(
      contract =>
        contract.status === 'active' &&
        new Date(contract.renewalDate) >= now &&
        new Date(contract.renewalDate) <= thirtyDaysFromNow
    )

    // Calculate total commitments
    const totalMonthlyCommitment = contracts
      .filter(c => c.status === 'active')
      .reduce((sum, c) => sum + c.monthlyAmount, 0)

    const totalAnnualCommitment = contracts
      .filter(c => c.status === 'active')
      .reduce((sum, c) => sum + (c.annualCommitment || c.monthlyAmount * 12), 0)

    return NextResponse.json({
      contracts,
      summary: {
        totalContracts: contracts.length,
        activeContracts: contracts.filter(c => c.status === 'active').length,
        totalMonthlyCommitment,
        totalAnnualCommitment,
        upcomingRenewals: upcomingRenewals.length,
      },
      upcomingRenewals,
    })
  } catch (error) {
    console.error('Get vendor contracts error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch contracts' },
      { status: 500 }
    )
  }
}

// Create vendor contract
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      companyId,
      vendorName,
      service,
      category,
      monthlyAmount,
      annualCommitment,
      startDate,
      renewalDate,
      cancellationDeadline,
      autoRenews,
      contractUrl,
      notes,
    } = body

    if (!companyId || !vendorName || !service || !monthlyAmount) {
      return NextResponse.json(
        { error: 'Company ID, vendor name, service, and monthly amount required' },
        { status: 400 }
      )
    }

    const contract = await prisma.vendorContract.create({
      data: {
        companyId,
        vendorName,
        service,
        category: category || 'SaaS',
        monthlyAmount,
        annualCommitment,
        startDate: new Date(startDate),
        renewalDate: new Date(renewalDate),
        cancellationDeadline: cancellationDeadline ? new Date(cancellationDeadline) : null,
        autoRenews: autoRenews !== false,
        contractUrl,
        notes,
        status: 'active',
      },
    })

    // Create alert if renewal is within 45 days
    const daysUntilRenewal = Math.ceil(
      (new Date(renewalDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    )

    if (daysUntilRenewal <= 45 && daysUntilRenewal > 0) {
      await prisma.alert.create({
        data: {
          companyId,
          message: `Contract renewal for ${vendorName} (${service}) in ${daysUntilRenewal} days`,
          severity: daysUntilRenewal <= 15 ? 'high' : 'medium',
          riskLevel: 'medium',
        },
      })
    }

    return NextResponse.json({
      success: true,
      contract,
      message: 'Contract created successfully',
    })
  } catch (error) {
    console.error('Create vendor contract error:', error)
    return NextResponse.json(
      { error: 'Failed to create contract' },
      { status: 500 }
    )
  }
}

// Update vendor contract
export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { id, ...updateData } = body

    if (!id) {
      return NextResponse.json({ error: 'Contract ID required' }, { status: 400 })
    }

    // Convert date strings to Date objects
    if (updateData.startDate) updateData.startDate = new Date(updateData.startDate)
    if (updateData.renewalDate) updateData.renewalDate = new Date(updateData.renewalDate)
    if (updateData.cancellationDeadline)
      updateData.cancellationDeadline = new Date(updateData.cancellationDeadline)

    const contract = await prisma.vendorContract.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({
      success: true,
      contract,
      message: 'Contract updated successfully',
    })
  } catch (error) {
    console.error('Update vendor contract error:', error)
    return NextResponse.json(
      { error: 'Failed to update contract' },
      { status: 500 }
    )
  }
}

// Delete/Cancel vendor contract
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Contract ID required' }, { status: 400 })
    }

    // Mark as cancelled instead of deleting
    const contract = await prisma.vendorContract.update({
      where: { id },
      data: {
        status: 'cancelled',
      },
    })

    return NextResponse.json({
      success: true,
      contract,
      message: 'Contract cancelled successfully',
    })
  } catch (error) {
    console.error('Cancel vendor contract error:', error)
    return NextResponse.json(
      { error: 'Failed to cancel contract' },
      { status: 500 }
    )
  }
}



