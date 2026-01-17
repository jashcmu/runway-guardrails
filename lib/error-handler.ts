/**
 * Comprehensive Error Handler Module
 * Graceful error handling for all application components
 */

export interface AppError {
  code: string
  message: string
  userMessage: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  category: 'database' | 'api' | 'llm' | 'validation' | 'auth' | 'network' | 'unknown'
  context?: Record<string, unknown>
  stack?: string
  timestamp: Date
}

export interface ErrorLogEntry extends AppError {
  id: string
  userId?: string
  companyId?: string
  endpoint?: string
  resolved: boolean
}

// Error codes for categorization
export const ERROR_CODES = {
  // Database errors
  DB_CONNECTION_ERROR: 'E1001',
  DB_QUERY_FAILED: 'E1002',
  DB_RECORD_NOT_FOUND: 'E1003',
  DB_DUPLICATE_ENTRY: 'E1004',
  DB_VALIDATION_ERROR: 'E1005',
  
  // API errors
  API_RATE_LIMIT: 'E2001',
  API_TIMEOUT: 'E2002',
  API_INVALID_REQUEST: 'E2003',
  API_UNAUTHORIZED: 'E2004',
  API_FORBIDDEN: 'E2005',
  API_NOT_FOUND: 'E2006',
  
  // LLM errors
  LLM_API_ERROR: 'E3001',
  LLM_RATE_LIMIT: 'E3002',
  LLM_INVALID_RESPONSE: 'E3003',
  LLM_CONTENT_FILTER: 'E3004',
  
  // Validation errors
  VALIDATION_REQUIRED_FIELD: 'E4001',
  VALIDATION_INVALID_FORMAT: 'E4002',
  VALIDATION_OUT_OF_RANGE: 'E4003',
  
  // Auth errors
  AUTH_INVALID_TOKEN: 'E5001',
  AUTH_EXPIRED_SESSION: 'E5002',
  AUTH_INSUFFICIENT_PERMISSIONS: 'E5003',
  
  // Network errors
  NETWORK_TIMEOUT: 'E6001',
  NETWORK_UNAVAILABLE: 'E6002',
  
  // Unknown
  UNKNOWN_ERROR: 'E9999'
} as const

// User-friendly error messages
const USER_MESSAGES: Record<string, string> = {
  [ERROR_CODES.DB_CONNECTION_ERROR]: 'Unable to connect to the database. Please try again in a few moments.',
  [ERROR_CODES.DB_QUERY_FAILED]: 'An error occurred while fetching data. Please refresh and try again.',
  [ERROR_CODES.DB_RECORD_NOT_FOUND]: 'The requested record could not be found.',
  [ERROR_CODES.DB_DUPLICATE_ENTRY]: 'This record already exists.',
  [ERROR_CODES.DB_VALIDATION_ERROR]: 'The data provided is invalid. Please check and try again.',
  
  [ERROR_CODES.API_RATE_LIMIT]: 'Too many requests. Please wait a moment and try again.',
  [ERROR_CODES.API_TIMEOUT]: 'The request took too long. Please try again.',
  [ERROR_CODES.API_INVALID_REQUEST]: 'Invalid request. Please check your input.',
  [ERROR_CODES.API_UNAUTHORIZED]: 'Please log in to continue.',
  [ERROR_CODES.API_FORBIDDEN]: 'You do not have permission to perform this action.',
  [ERROR_CODES.API_NOT_FOUND]: 'The requested resource was not found.',
  
  [ERROR_CODES.LLM_API_ERROR]: 'AI service is temporarily unavailable. Using fallback methods.',
  [ERROR_CODES.LLM_RATE_LIMIT]: 'AI service is busy. Please try again shortly.',
  [ERROR_CODES.LLM_INVALID_RESPONSE]: 'Received unexpected response from AI. Using fallback.',
  
  [ERROR_CODES.AUTH_INVALID_TOKEN]: 'Your session is invalid. Please log in again.',
  [ERROR_CODES.AUTH_EXPIRED_SESSION]: 'Your session has expired. Please log in again.',
  [ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS]: 'You do not have permission to access this.',
  
  [ERROR_CODES.NETWORK_TIMEOUT]: 'Connection timed out. Please check your internet connection.',
  [ERROR_CODES.NETWORK_UNAVAILABLE]: 'Unable to connect. Please check your internet connection.',
  
  [ERROR_CODES.UNKNOWN_ERROR]: 'An unexpected error occurred. Please try again.'
}

/**
 * Create a standardized AppError from any error
 */
export function createAppError(
  error: unknown,
  context?: Record<string, unknown>
): AppError {
  const timestamp = new Date()
  
  if (error instanceof AppErrorClass) {
    return { ...error.toJSON(), context: { ...error.context, ...context }, timestamp }
  }
  
  const errorObj = error instanceof Error ? error : new Error(String(error))
  const errorInfo = analyzeError(errorObj)
  
  return {
    code: errorInfo.code,
    message: errorObj.message,
    userMessage: USER_MESSAGES[errorInfo.code] || USER_MESSAGES[ERROR_CODES.UNKNOWN_ERROR],
    severity: errorInfo.severity,
    category: errorInfo.category,
    context,
    stack: errorObj.stack,
    timestamp
  }
}

/**
 * Analyze error to determine type and severity
 */
function analyzeError(error: Error): { 
  code: string
  category: AppError['category']
  severity: AppError['severity']
} {
  const message = error.message.toLowerCase()
  const name = error.name.toLowerCase()
  
  // Database errors
  if (message.includes('prisma') || message.includes('database') || 
      message.includes('connection') || message.includes('mongodb')) {
    if (message.includes('connection') || message.includes('p1001')) {
      return { code: ERROR_CODES.DB_CONNECTION_ERROR, category: 'database', severity: 'critical' }
    }
    if (message.includes('not found') || message.includes('p2025')) {
      return { code: ERROR_CODES.DB_RECORD_NOT_FOUND, category: 'database', severity: 'low' }
    }
    if (message.includes('unique') || message.includes('duplicate') || message.includes('p2002')) {
      return { code: ERROR_CODES.DB_DUPLICATE_ENTRY, category: 'database', severity: 'low' }
    }
    if (message.includes('validation') || message.includes('p2011')) {
      return { code: ERROR_CODES.DB_VALIDATION_ERROR, category: 'database', severity: 'medium' }
    }
    return { code: ERROR_CODES.DB_QUERY_FAILED, category: 'database', severity: 'high' }
  }
  
  // OpenAI/LLM errors
  if (message.includes('openai') || message.includes('gpt') || 
      name.includes('openai') || message.includes('completion')) {
    if (message.includes('rate') || message.includes('429')) {
      return { code: ERROR_CODES.LLM_RATE_LIMIT, category: 'llm', severity: 'medium' }
    }
    if (message.includes('content') || message.includes('filter')) {
      return { code: ERROR_CODES.LLM_CONTENT_FILTER, category: 'llm', severity: 'low' }
    }
    return { code: ERROR_CODES.LLM_API_ERROR, category: 'llm', severity: 'medium' }
  }
  
  // Network errors
  if (message.includes('timeout') || message.includes('etimedout')) {
    return { code: ERROR_CODES.NETWORK_TIMEOUT, category: 'network', severity: 'medium' }
  }
  if (message.includes('econnrefused') || message.includes('network')) {
    return { code: ERROR_CODES.NETWORK_UNAVAILABLE, category: 'network', severity: 'high' }
  }
  
  // Auth errors
  if (message.includes('unauthorized') || message.includes('401')) {
    return { code: ERROR_CODES.AUTH_INVALID_TOKEN, category: 'auth', severity: 'medium' }
  }
  if (message.includes('forbidden') || message.includes('403')) {
    return { code: ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS, category: 'auth', severity: 'medium' }
  }
  
  // API errors
  if (message.includes('rate limit') || message.includes('too many requests')) {
    return { code: ERROR_CODES.API_RATE_LIMIT, category: 'api', severity: 'medium' }
  }
  if (message.includes('not found') || message.includes('404')) {
    return { code: ERROR_CODES.API_NOT_FOUND, category: 'api', severity: 'low' }
  }
  
  return { code: ERROR_CODES.UNKNOWN_ERROR, category: 'unknown', severity: 'medium' }
}

/**
 * AppError class for throwing typed errors
 */
export class AppErrorClass extends Error {
  code: string
  userMessage: string
  severity: AppError['severity']
  category: AppError['category']
  context?: Record<string, unknown>
  
  constructor(
    code: keyof typeof ERROR_CODES | string,
    options?: {
      message?: string
      severity?: AppError['severity']
      category?: AppError['category']
      context?: Record<string, unknown>
    }
  ) {
    const errorCode = ERROR_CODES[code as keyof typeof ERROR_CODES] || code
    super(options?.message || `Error: ${errorCode}`)
    
    this.code = errorCode
    this.userMessage = USER_MESSAGES[errorCode] || USER_MESSAGES[ERROR_CODES.UNKNOWN_ERROR]
    this.severity = options?.severity || 'medium'
    this.category = options?.category || 'unknown'
    this.context = options?.context
    
    this.name = 'AppError'
  }
  
  toJSON(): AppError {
    return {
      code: this.code,
      message: this.message,
      userMessage: this.userMessage,
      severity: this.severity,
      category: this.category,
      context: this.context,
      stack: this.stack,
      timestamp: new Date()
    }
  }
}

/**
 * Safe async wrapper with error handling
 */
export async function safeAsync<T>(
  operation: () => Promise<T>,
  fallback?: T,
  context?: Record<string, unknown>
): Promise<{ result: T | undefined; error: AppError | null }> {
  try {
    const result = await operation()
    return { result, error: null }
  } catch (error) {
    const appError = createAppError(error, context)
    logError(appError)
    return { result: fallback, error: appError }
  }
}

/**
 * Log error (could be extended to send to monitoring service)
 */
export function logError(error: AppError): void {
  const logLevel = error.severity === 'critical' ? 'error' : 
                   error.severity === 'high' ? 'error' :
                   error.severity === 'medium' ? 'warn' : 'info'
  
  console[logLevel](`[${error.code}] ${error.category}: ${error.message}`, {
    severity: error.severity,
    context: error.context,
    timestamp: error.timestamp
  })
  
  // In production, send to monitoring service
  if (process.env.NODE_ENV === 'production' && 
      (error.severity === 'critical' || error.severity === 'high')) {
    // TODO: Send to monitoring service (Sentry, DataDog, etc.)
    // sendToMonitoring(error)
  }
}

/**
 * Create a JSON response for API errors
 */
export function createErrorResponse(
  error: unknown,
  context?: Record<string, unknown>
): { 
  body: { error: string; message: string; code: string; details?: unknown }
  status: number 
} {
  const appError = createAppError(error, context)
  logError(appError)
  
  const status = getHttpStatus(appError)
  
  return {
    body: {
      error: appError.userMessage,
      message: process.env.NODE_ENV === 'development' ? appError.message : undefined,
      code: appError.code,
      details: process.env.NODE_ENV === 'development' ? appError.context : undefined
    } as any,
    status
  }
}

/**
 * Get HTTP status code from error
 */
function getHttpStatus(error: AppError): number {
  switch (error.code) {
    case ERROR_CODES.API_UNAUTHORIZED:
    case ERROR_CODES.AUTH_INVALID_TOKEN:
    case ERROR_CODES.AUTH_EXPIRED_SESSION:
      return 401
    case ERROR_CODES.API_FORBIDDEN:
    case ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS:
      return 403
    case ERROR_CODES.API_NOT_FOUND:
    case ERROR_CODES.DB_RECORD_NOT_FOUND:
      return 404
    case ERROR_CODES.API_RATE_LIMIT:
    case ERROR_CODES.LLM_RATE_LIMIT:
      return 429
    case ERROR_CODES.DB_VALIDATION_ERROR:
    case ERROR_CODES.VALIDATION_REQUIRED_FIELD:
    case ERROR_CODES.VALIDATION_INVALID_FORMAT:
    case ERROR_CODES.VALIDATION_OUT_OF_RANGE:
    case ERROR_CODES.API_INVALID_REQUEST:
      return 400
    case ERROR_CODES.DB_DUPLICATE_ENTRY:
      return 409
    default:
      return 500
  }
}

/**
 * Retry function with exponential backoff
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries?: number
    initialDelay?: number
    maxDelay?: number
    retryableErrors?: string[]
  } = {}
): Promise<T> {
  const { 
    maxRetries = 3, 
    initialDelay = 1000, 
    maxDelay = 10000,
    retryableErrors = [
      ERROR_CODES.DB_CONNECTION_ERROR,
      ERROR_CODES.NETWORK_TIMEOUT,
      ERROR_CODES.API_RATE_LIMIT,
      ERROR_CODES.LLM_RATE_LIMIT
    ]
  } = options
  
  let lastError: Error | undefined
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      const appError = createAppError(error)
      
      // Check if error is retryable
      if (!retryableErrors.includes(appError.code) || attempt === maxRetries) {
        throw error
      }
      
      // Calculate delay with exponential backoff
      const delay = Math.min(initialDelay * Math.pow(2, attempt), maxDelay)
      console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`)
      
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  
  throw lastError
}
