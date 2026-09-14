export type CallingProviderStatus = {
  configured: boolean;
  provider: "ai-calling";
  missingVariables: string[];
};

export function getCallingProviderStatus(): CallingProviderStatus {
  const requiredVariables = [
    "AI_CALLING_API_KEY",
    "AI_CALLING_API_BASE_URL",
  ] as const;

  const missingVariables = requiredVariables.filter(
    (key) => !process.env[key]?.trim(),
  );

  return {
    configured: missingVariables.length === 0,
    provider: "ai-calling",
    missingVariables,
  };
}

/*
 * Actual provider calling is intentionally NOT implemented yet.
 *
 * Once we choose/connect the calling provider, this file becomes
 * the adapter between Excel HR Consultancy and that provider.
 *
 * We will NOT guess:
 * - endpoint URLs
 * - authentication format
 * - request payload
 * - webhook payload
 * - call IDs
 * - call status
 *
 * Therefore no fake call can accidentally be recorded as successful.
 */