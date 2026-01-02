// Fix session hijacking issue - clean up wrongly linked OAuth accounts
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  console.log('🔧 Fixing session hijacking issues...\n')

  // 1. Delete ALL sessions to force fresh login
  console.log('1️⃣ Deleting all sessions...')
  const sessionResult = await prisma.session.deleteMany({})
  console.log(`   Deleted ${sessionResult.count} sessions\n`)

  // 2. List all users and their OAuth accounts
  console.log('2️⃣ Checking users and OAuth accounts...')
  const users = await prisma.user.findMany({
    include: {
      accounts: true,
      companies: {
        include: { company: true }
      }
    }
  })

  for (const user of users) {
    console.log(`\n   👤 User: ${user.email} (${user.id})`)
    console.log(`      Name: ${user.name || 'Not set'}`)
    console.log(`      Companies: ${user.companies.length}`)
    user.companies.forEach(c => {
      console.log(`        - ${c.company.name} (${c.company.slug})`)
    })
    console.log(`      OAuth Accounts: ${user.accounts.length}`)
    user.accounts.forEach(acc => {
      console.log(`        - ${acc.provider}: ${acc.providerAccountId}`)
    })
  }

  // 3. Find and fix wrongly linked OAuth accounts
  console.log('\n3️⃣ Checking for wrongly linked OAuth accounts...')
  
  // Get all OAuth accounts
  const allAccounts = await prisma.account.findMany({
    include: { user: true }
  })

  // Known Google provider account IDs and their correct emails (from logs)
  const correctMappings = {
    '116559528882982639382': 'jashvng@gmail.com',       // Jash
    '108187068928138045816': 'neepagandhi19@gmail.com', // Neepa
    '116227588462389522154': 'evginfinity0@gmail.com',  // Geeky (new user)
  }

  for (const account of allAccounts) {
    const expectedEmail = correctMappings[account.providerAccountId]
    if (expectedEmail && account.user.email !== expectedEmail) {
      console.log(`\n   ❌ WRONG: Account ${account.providerAccountId} is linked to ${account.user.email}`)
      console.log(`      Should be linked to: ${expectedEmail}`)
      
      // Find the correct user
      const correctUser = await prisma.user.findUnique({
        where: { email: expectedEmail }
      })
      
      if (correctUser) {
        // Delete the wrong link
        await prisma.account.delete({ where: { id: account.id } })
        console.log(`      ✅ Deleted wrong link`)
        
        // Create correct link
        await prisma.account.create({
          data: {
            userId: correctUser.id,
            type: account.type,
            provider: account.provider,
            providerAccountId: account.providerAccountId,
            access_token: account.access_token,
            refresh_token: account.refresh_token,
            expires_at: account.expires_at,
            token_type: account.token_type,
            scope: account.scope,
            id_token: account.id_token,
            session_state: account.session_state,
          }
        })
        console.log(`      ✅ Created correct link to ${expectedEmail}`)
      } else {
        console.log(`      ⚠️ User ${expectedEmail} not found - deleting orphan OAuth account`)
        await prisma.account.delete({ where: { id: account.id } })
      }
    } else if (expectedEmail) {
      console.log(`   ✅ Correct: ${account.providerAccountId} -> ${account.user.email}`)
    }
  }

  // 4. Check for orphan OAuth accounts linked to wrong users
  console.log('\n4️⃣ Final OAuth account state:')
  const finalAccounts = await prisma.account.findMany({
    include: { user: true }
  })
  
  for (const acc of finalAccounts) {
    console.log(`   - ${acc.user.email}: ${acc.provider} (${acc.providerAccountId})`)
  }

  console.log('\n✅ Done! Please restart the server and clear browser cookies before testing.')
  console.log('   Each user should now only see their own data.')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())



