// Fix OAuth linking issue - remove wrongly linked account
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  // Find the wrongly linked OAuth account for neepagandhi19
  // It was linked to jashvng@gmail.com user (694bf9c90c3d0ac8420d7de3)
  
  const wrongAccount = await prisma.account.findFirst({
    where: {
      providerAccountId: '108187068928138045816', // neepagandhi19's Google ID
      userId: '694bf9c90c3d0ac8420d7de3' // jashvng's user ID
    }
  })

  if (wrongAccount) {
    console.log('❌ Found wrongly linked OAuth account:', wrongAccount.id)
    await prisma.account.delete({
      where: { id: wrongAccount.id }
    })
    console.log('✅ Deleted wrongly linked account')
  }

  // Check if neepagandhi19@gmail.com user exists
  const neepaUser = await prisma.user.findUnique({
    where: { email: 'neepagandhi19@gmail.com' },
    include: { accounts: true, companies: true }
  })

  if (neepaUser) {
    console.log('\n✅ User neepagandhi19@gmail.com exists:')
    console.log('   ID:', neepaUser.id)
    console.log('   OAuth accounts:', neepaUser.accounts.length)
    console.log('   Companies:', neepaUser.companies.length)
  } else {
    console.log('\n⚠️ User neepagandhi19@gmail.com does not exist yet')
    console.log('   They will be created on next Google sign-in')
  }

  // Delete all stale sessions
  console.log('\n🧹 Cleaning up all sessions...')
  const deleted = await prisma.session.deleteMany({})
  console.log(`   Deleted ${deleted.count} sessions`)

  // List all OAuth accounts
  const allAccounts = await prisma.account.findMany({
    include: { user: { select: { email: true } } }
  })
  console.log('\n📊 Current OAuth accounts:')
  allAccounts.forEach(acc => {
    console.log(`   - ${acc.user.email}: ${acc.provider} (${acc.providerAccountId})`)
  })

  console.log('\n✅ Done! Please restart the server and try signing in again.')
  console.log('   Make sure to use an incognito window or clear cookies first.')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())


