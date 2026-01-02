import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Category } from '@prisma/client'
import Papa from 'papaparse'

function categorizeExpense(description: string): Category {
  const desc = description.toLowerCase()
  
  const hiringKeywords = ['hire', 'recruitment', 'recruiter', 'job', 'candidate', 'interview', 'hr', 'payroll', 'salary', 'employee', 'staffing']
  const marketingKeywords = ['marketing', 'ad', 'advertisement', 'campaign', 'social', 'seo', 'content', 'brand', 'pr', 'public relations', 'promotion']
  const saasKeywords = ['subscription', 'saas', 'software', 'service', 'license', 'app', 'tool', 'platform']
  const cloudKeywords = ['cloud', 'aws', 'azure', 'gcp', 'hosting', 'server', 'infrastructure', 'datacenter', 's3', 'ec2']
  const gaKeywords = ['office', 'general', 'admin', 'legal', 'accounting', 'finance', 'utility', 'utilities', 'rent', 'insurance', 'g&a', 'ga']
  
  if (hiringKeywords.some(keyword => desc.includes(keyword))) return Category.Hiring
  if (marketingKeywords.some(keyword => desc.includes(keyword))) return Category.Marketing
  if (saasKeywords.some(keyword => desc.includes(keyword))) return Category.SaaS
  if (cloudKeywords.some(keyword => desc.includes(keyword))) return Category.Cloud
  if (gaKeywords.some(keyword => desc.includes(keyword))) return Category.G_A
  
  return Category.G_A
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const companyId = formData.get('companyId') as string

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    if (!file.name.endsWith('.csv')) {
      return NextResponse.json({ error: 'File must be a CSV' }, { status: 400 })
    }

    const text = await file.text()
    
    const parseResult = Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim().toLowerCase()
    })

    if (parseResult.errors.length > 0) {
      return NextResponse.json({ error: 'CSV parsing failed', details: parseResult.errors }, { status: 400 })
    }

    const rows = parseResult.data as Array<{ date: string; description: string; amount: string }>
    
    if (rows.length === 0) {
      return NextResponse.json({ error: 'CSV file is empty' }, { status: 400 })
    }

    const transactions = rows.map(row => {
      const amount = parseFloat(row.amount?.toString().replace(/,/g, '') || '0')
      const date = new Date(row.date)
      
      if (isNaN(amount) || isNaN(date.getTime())) {
        throw new Error(`Invalid data: date=${row.date}, amount=${row.amount}`)
      }

      return {
        companyId,
        amount: amount,
        category: categorizeExpense(row.description || ''),
        description: row.description || null,
        date: date
      }
    })

    const result = await prisma.transaction.createMany({
      data: transactions
    })

    return NextResponse.json({ 
      message: 'Transactions uploaded successfully',
      count: result.count 
    }, { status: 200 })

  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json({ 
      error: 'Failed to process upload',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

