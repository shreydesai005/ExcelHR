"use client";

import {
  AlertTriangle,
  ArrowRight,
  Check,
  FileImage,
  Plus,
  Upload,
  UserRound,
} from "lucide-react";

import {
  ChangeEvent,
  FormEvent,
  useState,
} from "react";

type CandidateRow = {
  candidateId: string;
  jobCandidateId: string;

  fullName: string;
  emailAddress: string;
  phoneNumber: string;

  currentJobTitle: string;
  currentEmployer: string;

  totalExperienceYears:
    number | null;

  currentLocation: string;

  duplicateFlag: boolean;

  selected: boolean;
};

type InitialScreeningProps = {
  jobId: string;

  onContinue: () => void;
};

const emptyForm = {
  fullName: "",
  emailAddress: "",
  phoneNumber: "",

  currentJobTitle: "",
  currentEmployer: "",

  totalExperienceYears: "",

  currentLocation: "",
  preferredLocation: "",

  noticePeriodDays: "",

  educationSummary: "",
  salaryText: "",

  skills: "",
};

export default function InitialScreening({
  jobId,
  onContinue,
}: InitialScreeningProps) {
  const [form, setForm] =
    useState(emptyForm);

  const [screenshot, setScreenshot] =
    useState<File | null>(null);

  const [candidates, setCandidates] =
    useState<CandidateRow[]>([]);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [message, setMessage] =
    useState("");

  function updateField(
    field: keyof typeof emptyForm,
    value: string
  ) {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));

    setError("");
    setMessage("");
  }

  function handleScreenshot(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target.files?.[0];

    if (!file) {
      return;
    }

    const validTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (
      !validTypes.includes(
        file.type
      )
    ) {
      setError(
        "Only JPG, PNG and WEBP screenshots are supported."
      );

      event.target.value = "";
      return;
    }

    if (
      file.size >
      5 * 1024 * 1024
    ) {
      setError(
        "Screenshot must be 5 MB or smaller."
      );

      event.target.value = "";
      return;
    }

    setScreenshot(file);
    setError("");
  }

  async function handleAddCandidate(
    event: FormEvent
  ) {
    event.preventDefault();

    if (!form.fullName.trim()) {
      setError(
        "Candidate name is required."
      );
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const data =
        new FormData();

      Object.entries(form).forEach(
        ([key, value]) => {
          data.append(
            key,
            value
          );
        }
      );

      const skills =
        form.skills
          .split(",")
          .map((skill) =>
            skill.trim()
          )
          .filter(Boolean);

      data.set(
        "skills",
        JSON.stringify(skills)
      );

      if (screenshot) {
        data.append(
          "profileScreenshot",
          screenshot
        );
      }

      const response =
        await fetch(
          `/api/jobs/${jobId}/candidates`,
          {
            method: "POST",
            body: data,
          }
        );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Unable to save candidate."
        );
      }

      const candidate =
        result.candidate;

      const jobCandidate =
        result.jobCandidate;

      setCandidates(
        (previous) => [
          ...previous,
          {
            candidateId:
              candidate.id,

            jobCandidateId:
              jobCandidate.id,

            fullName:
              candidate.full_name ??
              "",

            emailAddress:
              candidate.email_address ??
              "",

            phoneNumber:
              candidate.phone_number ??
              "",

            currentJobTitle:
              candidate.current_job_title ??
              "",

            currentEmployer:
              candidate.current_employer ??
              "",

            totalExperienceYears:
              candidate.total_experience_years,

            currentLocation:
              candidate.current_location ??
              "",

            duplicateFlag:
              candidate.duplicate_flag,

            selected:
              false,
          },
        ]
      );

      setForm(emptyForm);
      setScreenshot(null);

      setMessage(
        "Candidate added successfully."
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to save candidate."
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleCandidate(
    candidate: CandidateRow
  ) {
    const nextValue =
      !candidate.selected;

    try {
      const response =
        await fetch(
          `/api/job-candidates/${candidate.jobCandidateId}`,
          {
            method: "PATCH",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              initialSelected:
                nextValue,
            }),
          }
        );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Unable to update candidate."
        );
      }

      setCandidates(
        (previous) =>
          previous.map(
            (item) =>
              item.jobCandidateId ===
              candidate.jobCandidateId
                ? {
                    ...item,
                    selected:
                      nextValue,
                  }
                : item
          )
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to update candidate."
      );
    }
  }

  const selectedCount =
    candidates.filter(
      (candidate) =>
        candidate.selected
    ).length;

  function handleContinue() {
    if (selectedCount === 0) {
      setError(
        "Select at least one candidate before continuing to CV Screening."
      );

      return;
    }

    onContinue();
  }

  return (
    <section className="space-y-6">
      <div>
        <p className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--brand-primary)]">
          Stage 2
        </p>

        <h1 className="text-3xl font-semibold tracking-tight">
          Initial Screening
        </h1>

        <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-secondary)]">
          Add candidate profile
          information and optionally
          attach the candidate&apos;s
          profile screenshot. Recruiter
          selection determines who
          proceeds to CV screening.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {message && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          {message}
        </div>
      )}

      <form
        onSubmit={
          handleAddCandidate
        }
        className="card p-6"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--surface-soft)] text-[var(--brand-primary)]">
            <UserRound size={20} />
          </div>

          <div>
            <h2 className="text-lg font-semibold">
              Candidate Profile
            </h2>

            <p className="text-sm text-[var(--text-secondary)]">
              Enter information
              available from the
              candidate profile.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          <Field
            label="Full Name"
            required
          >
            <input
              className="input-style"
              value={form.fullName}
              onChange={(event) =>
                updateField(
                  "fullName",
                  event.target.value
                )
              }
            />
          </Field>

          <Field label="Email">
            <input
              type="email"
              className="input-style"
              value={
                form.emailAddress
              }
              onChange={(event) =>
                updateField(
                  "emailAddress",
                  event.target.value
                )
              }
            />
          </Field>

          <Field label="Phone Number">
            <input
              className="input-style"
              value={
                form.phoneNumber
              }
              onChange={(event) =>
                updateField(
                  "phoneNumber",
                  event.target.value
                )
              }
            />
          </Field>

          <Field label="Current Job Title">
            <input
              className="input-style"
              value={
                form.currentJobTitle
              }
              onChange={(event) =>
                updateField(
                  "currentJobTitle",
                  event.target.value
                )
              }
            />
          </Field>

          <Field label="Current Employer">
            <input
              className="input-style"
              value={
                form.currentEmployer
              }
              onChange={(event) =>
                updateField(
                  "currentEmployer",
                  event.target.value
                )
              }
            />
          </Field>

          <Field label="Experience (Years)">
            <input
              type="number"
              min="0"
              step="0.1"
              className="input-style"
              value={
                form.totalExperienceYears
              }
              onChange={(event) =>
                updateField(
                  "totalExperienceYears",
                  event.target.value
                )
              }
            />
          </Field>

          <Field label="Current Location">
            <input
              className="input-style"
              value={
                form.currentLocation
              }
              onChange={(event) =>
                updateField(
                  "currentLocation",
                  event.target.value
                )
              }
            />
          </Field>

          <Field label="Preferred Location">
            <input
              className="input-style"
              value={
                form.preferredLocation
              }
              onChange={(event) =>
                updateField(
                  "preferredLocation",
                  event.target.value
                )
              }
            />
          </Field>

          <Field label="Notice Period (Days)">
            <input
              type="number"
              min="0"
              className="input-style"
              value={
                form.noticePeriodDays
              }
              onChange={(event) =>
                updateField(
                  "noticePeriodDays",
                  event.target.value
                )
              }
            />
          </Field>

          <Field label="Education">
            <input
              className="input-style"
              value={
                form.educationSummary
              }
              onChange={(event) =>
                updateField(
                  "educationSummary",
                  event.target.value
                )
              }
            />
          </Field>

          <Field label="Salary / CTC">
            <input
              className="input-style"
              value={
                form.salaryText
              }
              onChange={(event) =>
                updateField(
                  "salaryText",
                  event.target.value
                )
              }
            />
          </Field>

          <Field label="Skills">
            <input
              className="input-style"
              value={form.skills}
              onChange={(event) =>
                updateField(
                  "skills",
                  event.target.value
                )
              }
              placeholder="Sales, CRM, SaaS"
            />
          </Field>
        </div>

        <div className="mt-6">
          <p className="mb-2 text-sm font-medium">
            Profile Screenshot
          </p>

          <label className="flex cursor-pointer items-center justify-center gap-3 rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-soft)] p-6 transition hover:border-[var(--brand-primary)]">
            <Upload size={18} />

            <span className="text-sm">
              {screenshot
                ? screenshot.name
                : "Upload Naukri/profile screenshot"}
            </span>

            <input
              type="file"
              accept=".jpg,.jpeg,.png,.webp"
              className="hidden"
              onChange={
                handleScreenshot
              }
            />
          </label>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-[var(--brand-primary)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            <Plus size={17} />

            {saving
              ? "Saving Candidate..."
              : "Add Candidate"}
          </button>
        </div>
      </form>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--border)] p-5">
          <div>
            <h2 className="font-semibold">
              Candidates
            </h2>

            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              {
                candidates.length
              }{" "}
              candidate(s) added
            </p>
          </div>

          <div className="rounded-xl bg-[var(--surface-soft)] px-4 py-2 text-sm font-semibold text-[var(--brand-primary)]">
            {selectedCount} selected
          </div>
        </div>

        {candidates.length ===
        0 ? (
          <div className="flex min-h-[220px] flex-col items-center justify-center p-8 text-center">
            <FileImage
              size={28}
              className="text-[var(--text-muted)]"
            />

            <p className="mt-4 font-semibold">
              No candidates added
              yet
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-[var(--surface-soft)]">
                <tr>
                  <th className="p-4">
                    Candidate
                  </th>

                  <th className="p-4">
                    Current Role
                  </th>

                  <th className="p-4">
                    Experience
                  </th>

                  <th className="p-4">
                    Location
                  </th>

                  <th className="p-4">
                    Duplicate
                  </th>

                  <th className="p-4">
                    CV Screening
                  </th>
                </tr>
              </thead>

              <tbody>
                {candidates.map(
                  (candidate) => (
                    <tr
                      key={
                        candidate.jobCandidateId
                      }
                      className="border-t border-[var(--border)]"
                    >
                      <td className="p-4">
                        <p className="font-semibold">
                          {
                            candidate.fullName
                          }
                        </p>

                        <p className="mt-1 text-xs text-[var(--text-secondary)]">
                          {
                            candidate.emailAddress ||
                            candidate.phoneNumber ||
                            "No contact information"
                          }
                        </p>
                      </td>

                      <td className="p-4">
                        {
                          candidate.currentJobTitle ||
                          "—"
                        }

                        {candidate.currentEmployer && (
                          <p className="mt-1 text-xs text-[var(--text-secondary)]">
                            {
                              candidate.currentEmployer
                            }
                          </p>
                        )}
                      </td>

                      <td className="p-4">
                        {candidate.totalExperienceYears ??
                          "—"}
                      </td>

                      <td className="p-4">
                        {candidate.currentLocation ||
                          "—"}
                      </td>

                      <td className="p-4">
                        {candidate.duplicateFlag ? (
                          <span className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">
                            <AlertTriangle
                              size={13}
                            />
                            Possible
                          </span>
                        ) : (
                          <span className="text-[var(--text-secondary)]">
                            No
                          </span>
                        )}
                      </td>

                      <td className="p-4">
                        <button
                          type="button"
                          onClick={() =>
                            toggleCandidate(
                              candidate
                            )
                          }
                          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition ${
                            candidate.selected
                              ? "bg-[var(--brand-primary)] text-white"
                              : "border border-[var(--border)] bg-white"
                          }`}
                        >
                          {candidate.selected && (
                            <Check
                              size={14}
                            />
                          )}

                          {candidate.selected
                            ? "Selected"
                            : "Select"}
                        </button>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={
            handleContinue
          }
          className="flex items-center gap-2 rounded-xl bg-[var(--brand-primary)] px-5 py-3 text-sm font-semibold text-white"
        >
          Continue to CV Screening

          <ArrowRight
            size={17}
          />
        </button>
      </div>
    </section>
  );
}

function Field({
  label,
  required = false,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium">
        {label}

        {required && (
          <span className="ml-1 text-red-500">
            *
          </span>
        )}
      </span>

      {children}
    </label>
  );
}