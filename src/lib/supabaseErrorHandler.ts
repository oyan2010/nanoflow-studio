import { toast } from "sonner";
import { PostgrestError } from "@supabase/supabase-js";

/**
 * Standard error response structure
 */
interface ErrorResult<T> {
    data: T | null;
    error: string | null;
    success: boolean;
}

/**
 * User-friendly error messages for common Supabase/Postgres errors
 */
const ERROR_MESSAGES: Record<string, string> = {
    // Auth errors
    "Invalid login credentials": "Invalid email or password. Please try again.",
    "Email not confirmed": "Please verify your email before logging in.",
    "User already registered": "An account with this email already exists.",

    // RLS errors
    "42501": "You don't have permission to perform this action.",
    "new row violates row-level security policy": "Access denied. Please contact support.",

    // Foreign key errors
    "23503": "This action references data that doesn't exist or was deleted.",

    // Unique constraint errors
    "23505": "This record already exists.",

    // Rate limiting
    "429": "Too many requests. Please wait a moment and try again.",

    // Network errors
    "Failed to fetch": "Network error. Please check your connection.",
    "TypeError: Failed to fetch": "Unable to connect to the server.",

    // Default
    "default": "An unexpected error occurred. Please try again."
};

/**
 * Get user-friendly error message from error
 */
function getUserFriendlyMessage(error: unknown): string {
    if (!error) return ERROR_MESSAGES.default;

    const errorStr = error instanceof Error ? error.message : String(error);

    // Check for exact matches first
    if (ERROR_MESSAGES[errorStr]) {
        return ERROR_MESSAGES[errorStr];
    }

    // Check for Postgres error codes
    if (error && typeof error === 'object' && 'code' in error) {
        const code = (error as PostgrestError).code;
        if (code && ERROR_MESSAGES[code]) {
            return ERROR_MESSAGES[code];
        }
    }

    // Check for partial matches
    for (const [key, message] of Object.entries(ERROR_MESSAGES)) {
        if (errorStr.toLowerCase().includes(key.toLowerCase())) {
            return message;
        }
    }

    // Return the original message if it's user-readable
    if (errorStr.length < 100 && !errorStr.includes('undefined') && !errorStr.includes('null')) {
        return errorStr;
    }

    return ERROR_MESSAGES.default;
}

/**
 * Wraps an async Supabase operation with standardized error handling
 * @param operation - The async operation to execute
 * @param options - Configuration options
 * @returns ErrorResult with data, error message, and success flag
 */
export async function withErrorHandling<T>(
    operation: () => Promise<{ data: T | null; error: PostgrestError | null }>,
    options: {
        successMessage?: string;
        errorPrefix?: string;
        showToast?: boolean;
        rethrow?: boolean;
    } = {}
): Promise<ErrorResult<T>> {
    const {
        successMessage,
        errorPrefix = "Error",
        showToast = true,
        rethrow = false
    } = options;

    try {
        const { data, error } = await operation();

        if (error) {
            const userMessage = getUserFriendlyMessage(error);
            const fullMessage = `${errorPrefix}: ${userMessage}`;

            console.error(`[${errorPrefix}]`, error);

            if (showToast) {
                toast.error(fullMessage);
            }

            if (rethrow) {
                throw new Error(fullMessage);
            }

            return { data: null, error: fullMessage, success: false };
        }

        if (successMessage && showToast) {
            toast.success(successMessage);
        }

        return { data, error: null, success: true };
    } catch (err) {
        const userMessage = getUserFriendlyMessage(err);
        const fullMessage = `${errorPrefix}: ${userMessage}`;

        console.error(`[${errorPrefix}]`, err);

        if (showToast) {
            toast.error(fullMessage);
        }

        if (rethrow) {
            throw err;
        }

        return { data: null, error: fullMessage, success: false };
    }
}

/**
 * Wraps a Supabase Edge Function call with error handling
 */
export async function invokeWithErrorHandling<T>(
    supabase: any,
    functionName: string,
    body: object = {},
    options: {
        successMessage?: string;
        errorPrefix?: string;
        showToast?: boolean;
    } = {}
): Promise<ErrorResult<T>> {
    const {
        successMessage,
        errorPrefix = functionName,
        showToast = true
    } = options;

    try {
        const { data, error } = await supabase.functions.invoke(functionName, { body });

        if (error) {
            const userMessage = getUserFriendlyMessage(error);
            console.error(`[${functionName}]`, error);

            if (showToast) {
                toast.error(`${errorPrefix}: ${userMessage}`);
            }

            return { data: null, error: userMessage, success: false };
        }

        // Check for error in response body (common pattern)
        if (data?.error) {
            const userMessage = getUserFriendlyMessage(data.error);
            console.error(`[${functionName}]`, data.error);

            if (showToast) {
                toast.error(`${errorPrefix}: ${userMessage}`);
            }

            return { data: null, error: userMessage, success: false };
        }

        if (successMessage && showToast) {
            toast.success(successMessage);
        }

        return { data, error: null, success: true };
    } catch (err) {
        const userMessage = getUserFriendlyMessage(err);
        console.error(`[${functionName}]`, err);

        if (showToast) {
            toast.error(`${errorPrefix}: ${userMessage}`);
        }

        return { data: null, error: userMessage, success: false };
    }
}

export { getUserFriendlyMessage };
