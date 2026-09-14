export type WhatsAppProviderStatus = {
  configured: boolean;
  provider: "yeti";
  missingVariables: string[];
};

export function getWhatsAppProviderStatus(): WhatsAppProviderStatus {
  const requiredVariables = [
    "YETI_API_KEY",
    "YETI_API_BASE_URL",
    "YETI_SENDER_ID",
  ] as const;

  const missingVariables = requiredVariables.filter(
    (key) => !process.env[key]?.trim(),
  );

  return {
    configured: missingVariables.length === 0,
    provider: "yeti",
    missingVariables,
  };
}

/*
 * We intentionally do NOT implement a guessed Yeti HTTP request here.
 *
 * Once we have Yeti's actual API documentation / endpoint format,
 * the provider adapter will be added here.
 *
 * This prevents the application from pretending that a WhatsApp
 * message was sent when no real provider request occurred.
 */