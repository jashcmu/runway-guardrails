import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "./prisma"
import Google from "next-auth/providers/google"
import { cookies } from "next/headers"

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code"
        }
      },
      // Allow linking OAuth to existing accounts with same email
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  pages: {
    signIn: '/login',
    error: '/login',
  },
  events: {
    // Clear old sessions when a user signs in
    async signIn({ user, account, isNewUser }) {
      console.log('📣 SignIn Event:', user.email, 'isNewUser:', isNewUser)
      
      // If this is a new user OR the OAuth account doesn't match the existing session,
      // we need to ensure proper session handling
      if (user.id) {
        // Delete any existing sessions for OTHER users to prevent session hijacking
        // Keep sessions for this user
        try {
          const result = await prisma.session.deleteMany({
            where: {
              userId: { not: user.id }
            }
          })
          if (result.count > 0) {
            console.log(`🧹 Cleaned up ${result.count} sessions from other users`)
          }
        } catch (error) {
          console.error('Error cleaning sessions:', error)
        }
      }
    }
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      console.log('🔐 Sign in attempt:', user.email)
      
      if (!user.email) {
        console.log('❌ No email provided')
        return false
      }

      // Check if user exists with this email
      const existingUser = await prisma.user.findUnique({
        where: { email: user.email },
        include: { accounts: true, companies: true }
      })

      if (existingUser) {
        console.log('✅ Existing user found:', existingUser.id, existingUser.email)
        console.log('   Companies:', existingUser.companies.length)
        
        // IMPORTANT: Clear any stale sessions for other users
        // This prevents the session hijacking issue
        await prisma.session.deleteMany({
          where: {
            userId: { not: existingUser.id }
          }
        })
        
        // Check if OAuth account exists for this provider
        const existingAccount = existingUser.accounts.find(
          a => a.provider === account?.provider && a.providerAccountId === account?.providerAccountId
        )
        
        if (!existingAccount && account) {
          // Link the new OAuth account to the existing user (found by email)
          console.log('🔗 Linking OAuth account to existing user:', existingUser.id)
          try {
            await prisma.account.create({
              data: {
                userId: existingUser.id,
                type: account.type,
                provider: account.provider,
                providerAccountId: account.providerAccountId,
                access_token: account.access_token,
                refresh_token: account.refresh_token,
                expires_at: account.expires_at,
                token_type: account.token_type,
                scope: account.scope,
                id_token: account.id_token,
                session_state: account.session_state as string | undefined,
              }
            })
            console.log('✅ OAuth account linked successfully to user:', existingUser.email)
          } catch (error) {
            console.error('❌ Failed to link OAuth account:', error)
          }
        } else if (existingAccount) {
          console.log('✅ OAuth account already linked')
        }
        
        // Override the user.id to be the existing user's ID
        // This is critical to prevent linking to wrong user
        user.id = existingUser.id
        
      } else {
        // New user - NextAuth will create them automatically
        console.log('🆕 New user - will be created:', user.email)
        
        // Clear ALL existing sessions to ensure clean state
        await prisma.session.deleteMany({})
        console.log('🧹 Cleared all sessions for new user sign-in')
      }

      return true
    },
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id
        // Fetch user's companies
        const userWithCompanies = await prisma.user.findUnique({
          where: { id: user.id },
          include: {
            companies: {
              include: { company: true }
            }
          }
        })
        // @ts-ignore - extending session type
        session.user.companies = userWithCompanies?.companies?.map(c => ({
          id: c.company.id,
          name: c.company.name,
          slug: c.company.slug,
          role: c.role,
          cashBalance: c.company.cashBalance,
          targetMonths: c.company.targetMonths
        })) || []
        // @ts-ignore
        session.user.hasCompany = (userWithCompanies?.companies?.length || 0) > 0
        
        console.log(`📊 Session for ${session.user.email}: ${userWithCompanies?.companies?.length || 0} companies`)
      }
      return session
    },
    async redirect({ url, baseUrl }) {
      // If the URL is relative, prefix with baseUrl
      if (url.startsWith('/')) {
        return `${baseUrl}${url}`
      }
      // If the URL is from the same origin, allow it
      if (url.startsWith(baseUrl)) {
        return url
      }
      // Default: redirect to dashboard (will check for company there)
      return `${baseUrl}/dashboard`
    }
  },
  session: {
    strategy: "database",
    maxAge: 7 * 24 * 60 * 60, // 7 days
  },
  trustHost: true,
  debug: process.env.NODE_ENV === 'development',
})

