import { NextRequest, NextResponse } from 'next/server'
import { reconcileBankStatement } from '@/lib/reconciliation'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const companyId = formData.get('companyId') as string
    const bankAccountId = formData.get('bankAccountId') as string
    const file = formData.get('file') as File

    if (!companyId || !bankAccountId || !file) {
      return NextResponse.json(
        { error: 'Missing required fields: companyId, bankAccountId, file' },
        { status: 400 }
      )
    }

    const fileContent = await file.text()
    const fileType = file.name.endsWith('.pdf') ? 'pdf' : 'csv'

    const result = await reconcileBankStatement(companyId, bankAccountId, fileContent, fileType)

    return NextResponse.json({
      message: 'Reconciliation complete',
      result,
    }, { status: 200 })
  } catch (error) {
    console.error('Reconciliation error:', error)
    return NextResponse.json(
      { error: 'Failed to reconcile', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}




