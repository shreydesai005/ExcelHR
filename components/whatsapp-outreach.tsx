"use client";

import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Loader2,
  LockKeyhole,
  MessageCircle,
  Phone,
  RefreshCw,
  Send,
  ShieldCheck,
} from "lucide-react";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

type ProviderStatus = {
  configured: boolean;
  provider: "yeti";
  missingVariables: string[];
};

type CandidateInfo = {
  id: string;
  full_name: string | null;
  email_address: string | null;
  phone_number: string | null;
  normalized_phone: string | null;
  current_job_title: string | null;
  current_employer: string | null;
  total_experience_years: number | null;
  current_location: string | null;
};

type Decision = {
  id: string;
  recruiter_decision: string;
  final_workflow_decision: string;
  phone_verified: boolean;
  whatsapp_consent: boolean;
};

type Communication = {
  id: string;
  provider_name: string | null;
  provider_message_id: string | null;
  communication_status: string;
  recipient_normalized: string | null;
  template_name: string | null;
  provider_error_code: string | null;
  provider_error_message: string | null;
  created_at: string;
  updated_at: string;
};

type OutreachCandidate = {
  id: string;
  candidateId: string;
  workflowStatus: string;
  candidate: CandidateInfo | null;
  decision: Decision | null;
  communication: Communication | null;
  eligible: boolean;
  blockers: string[];
};

type Props = {
  jobId: string;
  onContinue?: () => void;
};

export default function WhatsAppOutreach({
  jobId,
  onContinue,
}: Props) {
  const [candidates, setCandidates] = useState<OutreachCandidate[]>([]);
  const [provider, setProvider] = useState<ProviderStatus | null>(null);

  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");

  const [templateNames, setTemplateNames] = useState<
    Record<string, string>
  >({});

  const [preparing, setPreparing] = useState<
    Record<string, boolean>
  >({});

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState<Record<string, string>>({});

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setPageError("");

    try {
      const response = await fetch(
        `/api/jobs/${jobId}/outreach`,
        {
          cache: "no-store",
        },
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Unable to load WhatsApp outreach queue.",
        );
      }

      setCandidates(result.candidates ?? []);
      setProvider(result.provider ?? null);

      const initialTemplates: Record<string, string> = {};

      for (const item of result.candidates ?? []) {
        initialTemplates[item.id] =
          item.communication?.template_name ?? "";
      }

      setTemplateNames(initialTemplates);
    } catch (error) {
      setPageError(
        error instanceof Error
          ? error.message
          : "Unable to load outreach queue.",
      );
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  async function prepareOutreach(item: OutreachCandidate) {
    const templateName = templateNames[item.id]?.trim();

    if (!templateName) {
      setErrors((previous) => ({
        ...previous,
        [item.id]: "Enter the approved WhatsApp template name.",
      }));

      return;
    }

    setPreparing((previous) => ({
      ...previous,
      [item.id]: true,
    }));

    setErrors((previous) => ({
      ...previous,
      [item.id]: "",
    }));

    setSuccess((previous) => ({
      ...previous,
      [item.id]: "",
    }));

    try {
      const response = await fetch(
        `/api/job-candidates/${item.id}/outreach`,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            templateName,
          }),
        },
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Unable to prepare WhatsApp outreach.",
        );
      }

      setSuccess((previous) => ({
        ...previous,
        [item.id]:
          result.message ||
          "Outreach preparation completed.",
      }));

      await loadQueue();
    } catch (error) {
      setErrors((previous) => ({
        ...previous,

        [item.id]:
          error instanceof Error
            ? error.message
            : "Unable to prepare outreach.",
      }));

      await loadQueue();
    } finally {
      setPreparing((previous) => ({
        ...previous,
        [item.id]: false,
      }));
    }
  }

  const eligibleCount = candidates.filter(
    (item) => item.eligible,
  ).length;

  const readyCount = candidates.filter(
    (item) =>
      item.communication?.communication_status === "ready",
  ).length;

  if (loading) {
    return (
      <div className="card flex min-h-[300px] items-center justify-center p-8">
        <div className="text-center">
          <Loader2
            size={28}
            className="mx-auto animate-spin text-[var(--brand-primary)]"
          />

          <p className="mt-3 text-sm text-[var(--text-secondary)]">
            Loading WhatsApp outreach queue...
          </p>
        </div>
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--brand-primary)]">
            Stage 5
          </p>

          <h1 className="text-3xl font-semibold">
            WhatsApp Outreach
          </h1>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-secondary)]">
            Prepare recruiter-approved candidates for controlled WhatsApp
            outreach. Messages are never marked as sent unless the provider
            confirms a real request.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadQueue()}
          className="flex items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-semibold"
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Metric
          label="Approved for Outreach"
          value={String(candidates.length)}
        />

        <Metric
          label="Eligible"
          value={String(eligibleCount)}
        />

        <Metric
          label="Ready"
          value={String(readyCount)}
        />
      </div>

      {provider && (
        <div
          className={`rounded-2xl border p-5 ${
            provider.configured
              ? "border-emerald-200 bg-emerald-50"
              : "border-amber-200 bg-amber-50"
          }`}
        >
          <div className="flex items-start gap-3">
            {provider.configured ? (
              <CheckCircle2
                size={20}
                className="mt-0.5 shrink-0 text-emerald-700"
              />
            ) : (
              <LockKeyhole
                size={20}
                className="mt-0.5 shrink-0 text-amber-700"
              />
            )}

            <div>
              <p className="font-semibold">
                {provider.configured
                  ? "Yeti credentials detected"
                  : "Yeti WhatsApp is not configured"}
              </p>

              <p className="mt-1 text-sm leading-6 opacity-80">
                {provider.configured
                  ? "Eligible candidates can be prepared for sending. Actual sending remains disabled until the Yeti request contract is connected."
                  : "No WhatsApp message can be sent. Configure the required server-side Yeti credentials first."}
              </p>

              {!provider.configured &&
                provider.missingVariables.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {provider.missingVariables.map((variable) => (
                      <span
                        key={variable}
                        className="rounded-lg border border-amber-200 bg-white px-2.5 py-1 font-mono text-xs"
                      >
                        {variable}
                      </span>
                    ))}
                  </div>
                )}
            </div>
          </div>
        </div>
      )}

      {pageError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {pageError}
        </div>
      )}

      {candidates.length === 0 && (
        <div className="card p-10 text-center">
          <MessageCircle
            size={32}
            className="mx-auto text-[var(--text-muted)]"
          />

          <p className="mt-4 font-semibold">
            No candidates approved for outreach.
          </p>

          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            Approve candidates in Stage 4 and mark them as Proceed first.
          </p>
        </div>
      )}

      {candidates.map((item) => {
        const candidate = item.candidate;

        if (!candidate) {
          return null;
        }

        const status =
          item.communication?.communication_status ?? "not_ready";

        const isPreparing = preparing[item.id];

        return (
          <article
            key={item.id}
            className="card overflow-hidden"
          >
            <div className="grid gap-6 p-6 xl:grid-cols-[1fr_420px]">
              <div>
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-soft)] text-lg font-semibold text-[var(--brand-primary)]">
                    {candidate.full_name
                      ?.charAt(0)
                      .toUpperCase() ?? "C"}
                  </div>

                  <div>
                    <h2 className="text-lg font-semibold">
                      {candidate.full_name || "Unnamed Candidate"}
                    </h2>

                    <p className="mt-1 text-sm text-[var(--text-secondary)]">
                      {candidate.current_job_title || "Role not provided"}

                      {candidate.current_employer
                        ? ` · ${candidate.current_employer}`
                        : ""}
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <SmallMetric
                    label="Phone"
                    value={
                      candidate.phone_number ||
                      candidate.normalized_phone ||
                      "Not available"
                    }
                  />

                  <SmallMetric
                    label="Phone Verified"
                    value={
                      item.decision?.phone_verified ? "Yes" : "No"
                    }
                  />

                  <SmallMetric
                    label="WhatsApp Consent"
                    value={
                      item.decision?.whatsapp_consent ? "Yes" : "No"
                    }
                  />

                  <SmallMetric
                    label="Status"
                    value={formatStatus(status)}
                  />
                </div>

                {!item.eligible && (
                  <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <div className="flex gap-3">
                      <AlertCircle
                        size={18}
                        className="mt-0.5 shrink-0 text-amber-700"
                      />

                      <div>
                        <p className="text-sm font-semibold text-amber-900">
                          Outreach blocked
                        </p>

                        <div className="mt-2 space-y-1 text-xs text-amber-800">
                          {item.blockers.map((blocker) => (
                            <p key={blocker}>• {blocker}</p>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {item.communication && (
                  <div className="mt-5 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
                    <div className="flex items-center gap-2">
                      <Clock3
                        size={16}
                        className="text-[var(--brand-primary)]"
                      />

                      <p className="text-sm font-semibold">
                        Latest Communication Record
                      </p>
                    </div>

                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <SmallMetric
                        label="Provider"
                        value={
                          item.communication.provider_name || "—"
                        }
                      />

                      <SmallMetric
                        label="Template"
                        value={
                          item.communication.template_name || "—"
                        }
                      />

                      <SmallMetric
                        label="Provider Message ID"
                        value={
                          item.communication.provider_message_id ||
                          "Not assigned"
                        }
                      />

                      <SmallMetric
                        label="Provider Status"
                        value={formatStatus(
                          item.communication.communication_status,
                        )}
                      />
                    </div>

                    {item.communication.provider_error_message && (
                      <p className="mt-3 text-xs text-red-600">
                        {item.communication.provider_error_message}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-5">
                <div className="flex items-center gap-2">
                  <Send
                    size={18}
                    className="text-[var(--brand-primary)]"
                  />

                  <p className="font-semibold">
                    Prepare Outreach
                  </p>
                </div>

                <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">
                  Enter the exact approved template identifier from your
                  WhatsApp provider. Do not invent a template name.
                </p>

                <label className="mt-5 block text-sm font-medium">
                  Approved Template Name
                </label>

                <input
                  type="text"
                  value={templateNames[item.id] ?? ""}
                  onChange={(event) =>
                    setTemplateNames((previous) => ({
                      ...previous,
                      [item.id]: event.target.value,
                    }))
                  }
                  placeholder="Enter real approved template name"
                  className="input-style mt-2"
                />

                <div className="mt-4 rounded-xl border border-[var(--border)] bg-white p-4">
                  <div className="flex gap-3">
                    <ShieldCheck
                      size={17}
                      className="mt-0.5 shrink-0 text-[var(--brand-primary)]"
                    />

                    <p className="text-xs leading-5 text-[var(--text-secondary)]">
                      Preparing outreach validates candidate eligibility and
                      creates a communication record. It does not fabricate a
                      successful WhatsApp send.
                    </p>
                  </div>
                </div>

                {errors[item.id] && (
                  <div className="mt-4 flex gap-2 rounded-lg bg-red-50 p-3 text-xs text-red-600">
                    <AlertCircle
                      size={14}
                      className="mt-0.5 shrink-0"
                    />

                    {errors[item.id]}
                  </div>
                )}

                {success[item.id] && (
                  <div className="mt-4 flex gap-2 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-700">
                    <CheckCircle2
                      size={14}
                      className="mt-0.5 shrink-0"
                    />

                    {success[item.id]}
                  </div>
                )}

                <button
                  type="button"
                  disabled={!item.eligible || isPreparing}
                  onClick={() => void prepareOutreach(item)}
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand-primary)] px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isPreparing ? (
                    <Loader2
                      size={17}
                      className="animate-spin"
                    />
                  ) : (
                    <MessageCircle size={17} />
                  )}

                  {isPreparing
                    ? "Preparing..."
                    : "Prepare WhatsApp Outreach"}
                </button>

                <button
                  type="button"
                  disabled
                  title="Actual sending will be enabled after the Yeti API contract is connected."
                  className="mt-3 flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--text-muted)] opacity-60"
                >
                  <Send size={17} />
                  Send WhatsApp
                </button>
              </div>
            </div>
          </article>
        );
      })}

      {readyCount > 0 && onContinue && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onContinue}
            className="flex items-center gap-2 rounded-xl bg-[var(--brand-primary)] px-5 py-3 text-sm font-semibold text-white"
          >
            Continue to AI Calling
            <Phone size={17} />
          </button>
        </div>
      )}
    </section>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="card p-5">
      <p className="text-xs font-medium text-[var(--text-secondary)]">
        {label}
      </p>

      <p className="mt-2 text-2xl font-semibold">
        {value}
      </p>
    </div>
  );
}

function SmallMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-xs text-[var(--text-secondary)]">
        {label}
      </p>

      <p className="mt-1 break-words text-sm font-semibold">
        {value}
      </p>
    </div>
  );
}

function formatStatus(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}