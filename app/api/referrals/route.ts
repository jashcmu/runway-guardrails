import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Referral Program API
 * Track referrals and rewards
 */

// Create a referral
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { referrerEmail, referredEmail } = body

    if (!referrerEmail || !referredEmail) {
      return NextResponse.json(
        { error: 'Referrer and referred emails required' },
        { status: 400 }
      )
    }

    // Check if already referred
    const existing = await prisma.referral.findUnique({
      where: {
        referrerEmail_referredEmail: {
          referrerEmail,
          referredEmail,
        },
      },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'This referral already exists' },
        { status: 400 }
      )
    }

    // Set expiration (90 days from now)
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 90)

    const referral = await prisma.referral.create({
      data: {
        referrerEmail,
        referredEmail,
        status: 'pending',
        referrerReward: '3 months free',
        referredReward: '1 month free',
        expiresAt,
      },
    })

    // Send referral email to referred user
    await sendReferralEmail(referredEmail, referrerEmail)

    return NextResponse.json({
      success: true,
      referral,
      message: `Referral sent to ${referredEmail}`,
    })
  } catch (error) {
    console.error('Create referral error:', error)
    return NextResponse.json(
      { error: 'Failed to create referral' },
      { status: 500 }
    )
  }
}

// Get referrals for a user
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email')

    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 })
    }

    // Get referrals made by this user
    const sentReferrals = await prisma.referral.findMany({
      where: { referrerEmail: email },
      orderBy: { createdAt: 'desc' },
    })

    // Get referrals received by this user
    const receivedReferrals = await prisma.referral.findMany({
      where: { referredEmail: email },
      orderBy: { createdAt: 'desc' },
    })

    // Calculate stats
    const stats = {
      totalSent: sentReferrals.length,
      totalConverted: sentReferrals.filter((r) => r.status === 'converted').length,
      totalPending: sentReferrals.filter((r) => r.status === 'pending').length,
      totalRewards: sentReferrals.filter((r) => r.status === 'converted').length * 3, // 3 months per conversion
    }

    return NextResponse.json({
      sent: sentReferrals,
      received: receivedReferrals,
      stats,
    })
  } catch (error) {
    console.error('Get referrals error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch referrals' },
      { status: 500 }
    )
  }
}

// Mark referral as converted (when referred user signs up)
export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { referredEmail } = body

    if (!referredEmail) {
      return NextResponse.json({ error: 'Referred email required' }, { status: 400 })
    }

    // Find pending referral
    const referral = await prisma.referral.findFirst({
      where: {
        referredEmail,
        status: 'pending',
      },
    })

    if (!referral) {
      return NextResponse.json({ error: 'No pending referral found' }, { status: 404 })
    }

    // Check if expired
    if (new Date() > new Date(referral.expiresAt)) {
      await prisma.referral.update({
        where: { id: referral.id },
        data: { status: 'expired' },
      })
      return NextResponse.json({ error: 'Referral expired' }, { status: 400 })
    }

    // Mark as converted
    const updatedReferral = await prisma.referral.update({
      where: { id: referral.id },
      data: {
        status: 'converted',
        convertedAt: new Date(),
      },
    })

    // Send notification to referrer
    await sendConversionEmail(referral.referrerEmail, referredEmail)

    return NextResponse.json({
      success: true,
      referral: updatedReferral,
      message: 'Referral converted! Both users will receive their rewards.',
    })
  } catch (error) {
    console.error('Convert referral error:', error)
    return NextResponse.json(
      { error: 'Failed to convert referral' },
      { status: 500 }
    )
  }
}

// Get referral stats (leaderboard)
export async function PUT(request: Request) {
  try {
    // Get top referrers
    const referrals = await prisma.referral.findMany({
      where: { status: 'converted' },
    })

    // Group by referrer
    const leaderboard: { [email: string]: number } = {}
    referrals.forEach((r) => {
      leaderboard[r.referrerEmail] = (leaderboard[r.referrerEmail] || 0) + 1
    })

    // Sort and format
    const topReferrers = Object.entries(leaderboard)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([email, count], index) => ({
        rank: index + 1,
        email: maskEmail(email),
        referrals: count,
        reward: `${count * 3} months free`,
      }))

    // Overall stats
    const totalReferrals = referrals.length
    const totalPending = await prisma.referral.count({
      where: { status: 'pending' },
    })

    return NextResponse.json({
      leaderboard: topReferrers,
      stats: {
        totalConverted: totalReferrals,
        totalPending,
        conversionRate:
          totalPending > 0
            ? Math.round((totalReferrals / (totalReferrals + totalPending)) * 100)
            : 0,
      },
    })
  } catch (error) {
    console.error('Get referral leaderboard error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch leaderboard' },
      { status: 500 }
    )
  }
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (local.length <= 3) {
    return `${local[0]}***@${domain}`
  }
  return `${local.substring(0, 3)}***@${domain}`
}

async function sendReferralEmail(to: string, from: string) {
  // TODO: Implement with email service
  console.log(`Sending referral email from ${from} to ${to}`)
  
  const referralLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/register?ref=${encodeURIComponent(from)}`
  
  // In production, send actual email with referral link
  // await sendgrid.send({
  //   to,
  //   from: 'hello@runwayguardrails.com',
  //   subject: `${from} invited you to Runway Guardrails`,
  //   html: `
  //     <p>${from} thinks you'd love Runway Guardrails!</p>
  //     <p>Sign up using this link to get 1 month free:</p>
  //     <a href="${referralLink}">${referralLink}</a>
  //   `
  // })
  
  return true
}

async function sendConversionEmail(referrer: string, referred: string) {
  // TODO: Implement with email service
  console.log(`${referred} signed up via ${referrer}'s referral!`)
  
  // In production, send actual email
  // await sendgrid.send({
  //   to: referrer,
  //   from: 'hello@runwayguardrails.com',
  //   subject: '🎉 Your referral signed up!',
  //   html: `
  //     <p>Great news! ${referred} just signed up using your referral link.</p>
  //     <p>You've both received your rewards:</p>
  //     <ul>
  //       <li>You: 3 months free</li>
  //       <li>${referred}: 1 month free</li>
  //     </ul>
  //     <p>Keep referring to unlock more rewards!</p>
  //   `
  // })
  
  return true
}




