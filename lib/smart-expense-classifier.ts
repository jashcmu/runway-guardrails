import { Category } from '@prisma/client';

export interface ExpenseClassification {
  expenseType: 'one-time' | 'recurring';
  frequency?: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  confidence: 'high' | 'medium' | 'low';
  reason: string;
  suggestedEndDate?: Date | null;
}

interface HistoricalTransaction {
  description: string;
  amount: number;
  date: Date;
  category: Category;
}

/**
 * Smart expense classifier that determines if an expense is recurring or one-time
 * Uses pattern detection, keywords, and historical data
 */
export function classifyExpense(
  description: string,
  amount: number,
  category: Category,
  historicalTransactions: HistoricalTransaction[]
): ExpenseClassification {
  const desc = description.toLowerCase();

  // 1. EXPLICIT ONE-TIME KEYWORDS (Highest priority)
  const oneTimeKeywords = [
    'laptop', 'computer', 'macbook', 'pc', 'monitor', 'keyboard', 'mouse',
    'furniture', 'desk', 'chair', 'table', 'equipment',
    'setup', 'installation', 'initial', 'onboard', 'onboarding',
    'deposit', 'security deposit', 'advance',
    'purchase', 'buy', 'bought', 'acquisition', 'procure',
    'repair', 'fix', 'maintenance',
    'conference', 'event', 'seminar', 'training', 'course',
    'bonus', 'one-time', 'adhoc', 'ad-hoc', 'special',
    'license fee', 'registration', 'incorporation'
  ];

  for (const keyword of oneTimeKeywords) {
    if (desc.includes(keyword)) {
      return {
        expenseType: 'one-time',
        confidence: 'high',
        reason: `Contains one-time keyword: "${keyword}"`
      };
    }
  }

  // 2. EXPLICIT RECURRING KEYWORDS (High priority)
  const recurringKeywords = [
    { keyword: 'subscription', frequency: 'monthly' as const },
    { keyword: 'monthly', frequency: 'monthly' as const },
    { keyword: 'annual', frequency: 'yearly' as const },
    { keyword: 'yearly', frequency: 'yearly' as const },
    { keyword: 'quarterly', frequency: 'quarterly' as const },
    { keyword: 'rent', frequency: 'monthly' as const },
    { keyword: 'salary', frequency: 'monthly' as const },
    { keyword: 'payroll', frequency: 'monthly' as const },
    { keyword: 'retainer', frequency: 'monthly' as const },
    { keyword: 'saas', frequency: 'monthly' as const },
    { keyword: 'membership', frequency: 'monthly' as const },
    { keyword: 'recurring', frequency: 'monthly' as const }
  ];

  for (const { keyword, frequency } of recurringKeywords) {
    if (desc.includes(keyword)) {
      return {
        expenseType: 'recurring',
        frequency,
        confidence: 'high',
        reason: `Contains recurring keyword: "${keyword}"`
      };
    }
  }

  // 3. CHECK HISTORICAL PATTERNS (Pattern detection)
  // Only mark as recurring if we have STRONG evidence from historical data
  const vendor = extractVendorName(description);
  if (vendor && historicalTransactions.length >= 3) { // Need at least 3 historical transactions
    const similarTransactions = historicalTransactions.filter(t => {
      const tVendor = extractVendorName(t.description);
      return tVendor === vendor && 
             Math.abs(t.amount - amount) < amount * 0.15; // Within 15%
    });

    // Require at least 3 similar transactions (including current one = 4 total) to establish a pattern
    if (similarTransactions.length >= 3) {
      // Found potential recurring pattern
      const pattern = analyzePattern(similarTransactions);
      
      // Only mark as recurring if pattern is regular AND confidence is medium or high
      if (pattern.isRegular && pattern.confidence !== 'low') {
        return {
          expenseType: 'recurring',
          frequency: pattern.frequency,
          confidence: pattern.confidence,
          reason: `Vendor "${vendor}" appears ${similarTransactions.length + 1} times with regular ${pattern.frequency} pattern`
        };
      }
    }
  }

  // 4. AMOUNT-BASED HEURISTICS
  // Very high amounts are often one-time
  const avgMonthlySpend = calculateAverageMonthlySpend(historicalTransactions);
  if (avgMonthlySpend > 0 && amount > avgMonthlySpend * 2) {
    return {
      expenseType: 'one-time',
      confidence: 'medium',
      reason: `Large amount (₹${amount.toLocaleString()}) relative to average spend`
    };
  }

  // 5. CATEGORY-BASED HINTS (Only if we have historical data suggesting it)
  // REMOVED: Aggressive category-based defaults that marked everything as recurring
  // Now we only use category as a hint if there's some historical evidence
  
  const recurringCategories: Category[] = [Category.SaaS, Category.Hiring, Category.Cloud];
  
  if (recurringCategories.includes(category) && historicalTransactions.length >= 5) {
    // Only suggest recurring if we have enough historical data AND it's a typically recurring category
    // This is a weak signal, so confidence is very low
    return {
      expenseType: 'recurring',
      frequency: 'monthly',
      confidence: 'low',
      reason: `Category "${category}" is typically recurring (but no pattern detected yet)`
    };
  }

  // 6. DEFAULT TO ONE-TIME (Conservative approach)
  // This is the safest default - better to miss a recurring expense than to incorrectly mark one-time as recurring
  return {
    expenseType: 'one-time',
    confidence: 'low',
    reason: 'No recurring patterns detected, defaulting to one-time'
  };
}

/**
 * Extract vendor name from transaction description
 */
function extractVendorName(description: string): string {
  // Remove common transaction prefixes/suffixes
  let cleaned = description
    .toLowerCase()
    .replace(/^(payment to|paid to|transfer to|payment for|paid for)/i, '')
    .replace(/(payment|invoice|bill|receipt|transaction)$/i, '')
    .trim();

  // Take first significant word(s)
  const words = cleaned.split(/\s+/);
  return words.slice(0, Math.min(3, words.length)).join(' ');
}

/**
 * Analyze transaction pattern to detect frequency
 */
function analyzePattern(transactions: HistoricalTransaction[]): {
  isRegular: boolean;
  frequency: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  confidence: 'high' | 'medium' | 'low';
} {
  if (transactions.length < 2) {
    return { isRegular: false, frequency: 'monthly', confidence: 'low' };
  }

  // Sort by date
  const sorted = transactions.sort((a, b) => a.date.getTime() - b.date.getTime());
  
  // Calculate intervals between transactions (in days)
  const intervals: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const daysDiff = (sorted[i].date.getTime() - sorted[i - 1].date.getTime()) / (1000 * 60 * 60 * 24);
    intervals.push(daysDiff);
  }

  if (intervals.length === 0) {
    return { isRegular: false, frequency: 'monthly', confidence: 'low' };
  }

  // Calculate average interval
  const avgInterval = intervals.reduce((sum, i) => sum + i, 0) / intervals.length;
  
  // Calculate standard deviation
  const variance = intervals.reduce((sum, i) => sum + Math.pow(i - avgInterval, 2), 0) / intervals.length;
  const stdDev = Math.sqrt(variance);
  
  // Check if intervals are regular (low variance)
  const isRegular = stdDev < avgInterval * 0.2; // Less than 20% variation

  // Determine frequency based on average interval
  let frequency: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  let confidence: 'high' | 'medium' | 'low';

  if (avgInterval >= 5 && avgInterval <= 9) {
    frequency = 'weekly';
    confidence = isRegular ? 'high' : 'medium';
  } else if (avgInterval >= 25 && avgInterval <= 35) {
    frequency = 'monthly';
    confidence = isRegular ? 'high' : 'medium';
  } else if (avgInterval >= 80 && avgInterval <= 100) {
    frequency = 'quarterly';
    confidence = isRegular ? 'high' : 'medium';
  } else if (avgInterval >= 350 && avgInterval <= 380) {
    frequency = 'yearly';
    confidence = isRegular ? 'high' : 'medium';
  } else {
    // Irregular pattern
    frequency = 'monthly'; // Default
    confidence = 'low';
  }

  return { isRegular, frequency, confidence };
}

/**
 * Calculate average monthly spend from historical transactions
 */
function calculateAverageMonthlySpend(transactions: HistoricalTransaction[]): number {
  if (transactions.length === 0) return 0;

  const totalSpend = transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
  
  // Calculate months of history
  const dates = transactions.map(t => t.date.getTime());
  const oldestDate = new Date(Math.min(...dates));
  const newestDate = new Date(Math.max(...dates));
  const monthsOfHistory = Math.max(1, (newestDate.getTime() - oldestDate.getTime()) / (30 * 24 * 60 * 60 * 1000));
  
  return totalSpend / monthsOfHistory;
}

/**
 * Detect if this is a subscription based on vendor patterns
 */
export function detectSubscription(
  description: string,
  amount: number,
  historicalTransactions: HistoricalTransaction[]
): {
  isSubscription: boolean;
  subscriptionName: string;
  billingCycle: 'monthly' | 'quarterly' | 'yearly';
  confidence: 'high' | 'medium' | 'low';
} {
  const vendor = extractVendorName(description);
  
  // Subscription keywords
  const subscriptionKeywords = [
    'netflix', 'spotify', 'amazon prime', 'prime video',
    'slack', 'zoom', 'github', 'gitlab', 'jira',
    'aws', 'azure', 'google cloud', 'digitalocean', 'heroku',
    'dropbox', 'google workspace', 'microsoft 365', 'office 365',
    'adobe', 'canva', 'figma', 'notion', 'trello',
    'salesforce', 'hubspot', 'mailchimp', 'sendgrid',
    'subscription', 'membership', 'saas'
  ];

  const desc = description.toLowerCase();
  const hasSubscriptionKeyword = subscriptionKeywords.some(kw => desc.includes(kw));

  // Check historical pattern
  const similarTransactions = historicalTransactions.filter(t => {
    const tVendor = extractVendorName(t.description);
    return tVendor === vendor && Math.abs(t.amount - amount) < amount * 0.1;
  });

  if (similarTransactions.length >= 2) {
    const pattern = analyzePattern(similarTransactions);
    
    if (pattern.isRegular && (pattern.frequency === 'monthly' || pattern.frequency === 'quarterly' || pattern.frequency === 'yearly')) {
      return {
        isSubscription: true,
        subscriptionName: vendor,
        billingCycle: pattern.frequency,
        confidence: pattern.confidence
      };
    }
  }

  // If has keyword but no pattern yet
  if (hasSubscriptionKeyword) {
    return {
      isSubscription: true,
      subscriptionName: vendor,
      billingCycle: 'monthly',
      confidence: 'medium'
    };
  }

  return {
    isSubscription: false,
    subscriptionName: vendor,
    billingCycle: 'monthly',
    confidence: 'low'
  };
}

