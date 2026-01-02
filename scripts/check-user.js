// Check user and company link
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  // Find user
  const user = await prisma.user.findUnique({
    where: { email: 'jashvng@gmail.com' },
    include: {
      companies: {
        include: { company: true }
      }
    }
  })

  if (!user) {
    console.log('❌ User not found with email: jashvng@gmail.com')
    
    // List all users
    const allUsers = await prisma.user.findMany({
      select: { id: true, email: true, name: true }
    })
    console.log('\nAll users in database:')
    allUsers.forEach(u => console.log(`  - ${u.email} (${u.name || 'no name'})`))
    return
  }

  console.log('✅ User found:')
  console.log(`   ID: ${user.id}`)
  console.log(`   Email: ${user.email}`)
  console.log(`   Name: ${user.name || 'Not set'}`)
  console.log(`   Companies linked: ${user.companies.length}`)

  if (user.companies.length > 0) {
    console.log('\n📦 Companies:')
    user.companies.forEach(cu => {
      console.log(`   - ${cu.company.name} (${cu.company.slug}) - Role: ${cu.role}`)
    })
  } else {
    console.log('\n⚠️  User has no companies linked!')
    
    // Find test4 company
    const test4 = await prisma.company.findUnique({
      where: { slug: 'test4' }
    })
    
    if (test4) {
      console.log(`\nLinking to test4 (${test4.name})...`)
      await prisma.companyUser.create({
        data: {
          userId: user.id,
          companyId: test4.id,
          role: 'admin'
        }
      })
      console.log('✅ Successfully linked!')
    } else {
      console.log('❌ Company test4 not found')
      
      // List all companies
      const companies = await prisma.company.findMany({
        select: { slug: true, name: true }
      })
      console.log('\nAll companies:')
      companies.forEach(c => console.log(`  - ${c.slug}: ${c.name}`))
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())


