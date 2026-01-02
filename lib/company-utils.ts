// Utility function to fetch user's company ID
export async function getUserCompanyId(): Promise<string | null> {
  try {
    const res = await fetch('/api/auth/me');
    if (!res.ok) {
      return null;
    }
    const data = await res.json();
    
    if (data.user.companies && data.user.companies.length > 0) {
      return data.user.companies[0].id;
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching company ID:', error);
    return null;
  }
}

// Utility to check if user has a company, redirect to onboarding if not
export async function ensureUserHasCompany(): Promise<string | null> {
  const companyId = await getUserCompanyId();
  
  if (!companyId) {
    window.location.href = '/onboarding';
    return null;
  }
  
  return companyId;
}


