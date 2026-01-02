import { NextRequest, NextResponse } from 'next/server'
import { chatCompletion } from '@/lib/openai-client'
import { buildFinancialContext, formatContextForPrompt } from '@/lib/chatbot-context'
import { simulateScenario, ScenarioAction } from '@/lib/scenario-simulation'
import { prisma } from '@/lib/prisma'
import { Category } from '@prisma/client'

const SYSTEM_PROMPT = `You are a financial advisor AI assistant for Indian startups and businesses. Your role is to help users understand their financial situation, especially regarding cash runway, burn rate, and spending decisions.

Key capabilities:
1. Answer questions about current financial status (runway, burn rate, cash balance)
2. Analyze spending impact on runway when users ask "what happens if I spend X"
3. Provide insights on budget vs actual spending
4. Suggest cost optimization strategies
5. Explain financial metrics in simple terms
6. **EXECUTE ACTIONS**: Add expenses, run scenarios when explicitly requested

Always:
- Use Indian Rupees (₹) for all currency amounts
- Be clear and concise
- Provide actionable insights
- Calculate runway impacts when asked about spending
- Reference actual data from the financial context provided

**Action Detection:**
- If user says "add expense", "record expense", "log expense" → Execute expense addition
- If user says "show me", "what if", "simulate" → Run scenario analysis only (don't add to database)

When executing actions, confirm completion clearly.`

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { message, companyId, cashBalance } = body

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    if (!cashBalance || isNaN(parseFloat(cashBalance))) {
      return NextResponse.json({ error: 'Valid cashBalance is required' }, { status: 400 })
    }

    // Build financial context
    const context = await buildFinancialContext(companyId, parseFloat(cashBalance))
    const contextText = formatContextForPrompt(context)

    // Detect if user wants to ADD an expense (action) vs just analyze (scenario)
    const addExpensePattern = /(?:add|record|log|enter|create)\s+(?:expense|transaction|payment|cost)/i
    const isAddingExpense = addExpensePattern.test(message)

    // Extract amount and category
    const spendingPattern = /(?:₹|rs|rupees?|inr)?\s*([\d,]+(?:\.[\d]+)?)/i
    const match = message.match(spendingPattern)
    
    let enhancedMessage = message
    let scenarioResult = null
    let actionResult = null

    if (match) {
      const amount = parseFloat(match[1].replace(/,/g, ''))
      
      // Detect category from message
      let category: Category = 'Marketing' as Category
      if (message.toLowerCase().includes('salary') || message.toLowerCase().includes('hire') || message.toLowerCase().includes('employee') || message.toLowerCase().includes('staff')) {
        category = 'Hiring_Salaries' as Category
      } else if (message.toLowerCase().includes('marketing') || message.toLowerCase().includes('ad') || message.toLowerCase().includes('campaign')) {
        category = 'Marketing' as Category
      } else if (message.toLowerCase().includes('tech') || message.toLowerCase().includes('technology')) {
        category = 'Technology' as Category
      } else if (message.toLowerCase().includes('operations') || message.toLowerCase().includes('ops')) {
        category = 'Operations' as Category
      } else if (message.toLowerCase().includes('office') || message.toLowerCase().includes('rent')) {
        category = 'Office_Rent' as Category
      } else if (message.toLowerCase().includes('legal') || message.toLowerCase().includes('compliance')) {
        category = 'Legal_Compliance' as Category
      } else if (message.toLowerCase().includes('travel')) {
        category = 'Travel' as Category
      } else {
        category = 'Miscellaneous' as Category
      }

      // Extract description (everything before the amount pattern)
      const descriptionMatch = message.match(/(?:add|record|log)?\s+(?:expense|transaction)?\s+(?:for|of)?\s+([^₹\d]+?)(?=₹|rs|\d)/i)
      const description = descriptionMatch ? descriptionMatch[1].trim() : `${category} expense`

      if (isAddingExpense) {
        // ACTION: Actually add the expense to database
        try {
          const newExpense = await prisma.transaction.create({
            data: {
              companyId,
              date: new Date(),
              description: description || `${category} expense via chatbot`,
              amount,
              category,
              currency: 'INR',
              gstRate: 0,
            },
          })

          actionResult = {
            type: 'expense_added',
            expense: newExpense,
          }

          enhancedMessage = `${message}\n\n[ACTION EXECUTED: Added expense of ₹${amount.toLocaleString('en-IN')} for ${category}. Transaction ID: ${newExpense.id}. User should see this reflected in their dashboard.]`
        } catch (err) {
          console.error('Failed to add expense:', err)
          enhancedMessage = `${message}\n\n[ERROR: Failed to add expense to database. ${err instanceof Error ? err.message : 'Unknown error'}]`
        }
      } else {
        // SCENARIO ANALYSIS ONLY: Simulate but don't add to database
        try {
          const actions: ScenarioAction[] = [{ type: 'marketing', additionalSpend: amount }]
          scenarioResult = await simulateScenario(companyId, parseFloat(cashBalance), actions)
          
          enhancedMessage = `${message}\n\n[SCENARIO ANALYSIS: User asking "what if" about spending ₹${amount.toLocaleString('en-IN')} on ${category}. Current runway: ${context.runway === null ? 'infinite' : context.runway.toFixed(1)} months. Projected runway: ${scenarioResult.projectedRunway === null ? 'infinite' : scenarioResult.projectedRunway.toFixed(1)} months. Risk level: ${scenarioResult.riskLevel}. This is a simulation only - nothing added to database.]`
        } catch (err) {
          console.error('Scenario simulation error:', err)
        }
      }
    }

    // Check for other action requests
    const generateReportPattern = /generate|create|make.*report/i
    if (generateReportPattern.test(message) && message.toLowerCase().includes('report')) {
      enhancedMessage = `${message}\n\n[User requesting report generation. Inform them that PDF report generation is available from the Reports page in the dashboard.]`
    }

    // Build messages for OpenAI
    const messages = [
      { role: 'system' as const, content: SYSTEM_PROMPT },
      { role: 'user' as const, content: `Financial Context:\n${contextText}\n\nUser Question: ${enhancedMessage}` },
    ]

    // Get AI response
    const response = await chatCompletion(messages)

    return NextResponse.json({
      response,
      scenario: scenarioResult ? {
        riskLevel: scenarioResult.riskLevel,
        currentRunway: scenarioResult.currentRunway,
        projectedRunway: scenarioResult.projectedRunway,
        message: scenarioResult.message,
      } : null,
      action: actionResult,
    })
  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json(
      {
        error: 'Failed to process chat message',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

