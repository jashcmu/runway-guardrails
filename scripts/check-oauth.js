// Check OAuth accounts for user
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  const userId = '694bf9c90c3d0ac8420d7de3'
  
  // Check OAuth accounts
  const accounts = await prisma.account.findMany({
    where: { userId }
  })

  console.log(`\n🔐 OAuth Accounts for user ${userId}:`)
  if (accounts.length === 0) {
    console.log('   No OAuth accounts found!')
    console.log('   This means Google Sign-In will fail for this existing user.')
    console.log('   The user needs to sign in with Google to create an OAuth link.')
  } else {
    accounts.forEach(acc => {
      console.log(`   - Provider: ${acc.provider}`)
      console.log(`     Account ID: ${acc.providerAccountId}`)
    })
  }

  // Check sessions
  const sessions = await prisma.session.findMany({
    where: { userId }
  })

  console.log(`\n📱 Active Sessions: ${sessions.length}`)
  sessions.forEach(s => {
    console.log(`   - Token: ${s.sessionToken.substring(0, 20)}...`)
    console.log(`     Expires: ${s.expires}`)
  })

  // List all OAuth accounts in DB
  const allAccounts = await prisma.account.findMany()
  console.log(`\n📊 Total OAuth accounts in database: ${allAccounts.length}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())



