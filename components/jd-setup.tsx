"use client";

import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  FileText,
  Plus,
  Save,
  Trash2,
  Upload,
} from "lucide-react";
import {
  ChangeEvent,
  useMemo,
  useState,
} from "react";

type WorkMode =
  | "onsite"
  | "hybrid"
  | "remote";

type ScoringWeights = {
  requiredSkills: number;
  preferredSkills: number;
  experience: number;
  roleRelevance: number;
  education: number;
  location: number;
  noticePeriod: number;
};

type JDFormData = {
  clientName: string;
  jobTitle: string;
  department: string;
  location: string;

  workMode: WorkMode;

  minExperience: number;
  maxExperience: number;

  maxNoticePeriod: number;

  education: string;

  jdText: string;

  requiredSkills: string[];
  preferredSkills: string[];
  knockoutCriteria: string[];

  qualifyingScore: number;

  scoringWeights: ScoringWeights;
};

type JDSetupProps = {
  jobId?: string | null;

  onJobSaved?: (
    jobId: string,
  ) => void;

  onContinue?: (
    jobId: string,
  ) => void;
};

const initialForm: JDFormData = {
  clientName: "",
  jobTitle: "",
  department: "",
  location: "",

  workMode: "onsite",

  minExperience: 0,
  maxExperience: 0,

  maxNoticePeriod: 0,

  education: "",

  jdText: "",

  requiredSkills: [""],

  preferredSkills: [""],

  knockoutCriteria: [""],

  qualifyingScore: 70,

  scoringWeights: {
    requiredSkills: 30,
    preferredSkills: 10,
    experience: 20,
    roleRelevance: 15,
    education: 10,
    location: 5,
    noticePeriod: 10,
  },
};

export default function JDSetup({
  jobId,
  onJobSaved,
  onContinue,
}: JDSetupProps) {
  const [form, setForm] =
    useState<JDFormData>(
      initialForm,
    );

  const [savedJobId, setSavedJobId] =
    useState<string | null>(
      jobId ?? null,
    );

  const [isSaving, setIsSaving] =
    useState(false);

  const [message, setMessage] =
    useState<string>("");

  const [error, setError] =
    useState<string>("");

  const [jdFile, setJdFile] =
    useState<File | null>(null);

  const totalWeight =
    useMemo(() => {
      return Object.values(
        form.scoringWeights,
      ).reduce(
        (sum, value) =>
          sum + value,
        0,
      );
    }, [form.scoringWeights]);

  function updateField<
    K extends keyof JDFormData,
  >(
    field: K,
    value: JDFormData[K],
  ) {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));

    setMessage("");
    setError("");
  }

  function updateWeight(
    field: keyof ScoringWeights,
    value: number,
  ) {
    setForm((previous) => ({
      ...previous,

      scoringWeights: {
        ...previous.scoringWeights,

        [field]: value,
      },
    }));

    setMessage("");
    setError("");
  }

  function updateListItem(
    field:
      | "requiredSkills"
      | "preferredSkills"
      | "knockoutCriteria",

    index: number,
    value: string,
  ) {
    setForm((previous) => {
      const updated = [
        ...previous[field],
      ];

      updated[index] = value;

      return {
        ...previous,
        [field]: updated,
      };
    });

    setMessage("");
    setError("");
  }

  function addListItem(
    field:
      | "requiredSkills"
      | "preferredSkills"
      | "knockoutCriteria",
  ) {
    setForm((previous) => ({
      ...previous,

      [field]: [
        ...previous[field],
        "",
      ],
    }));
  }

  function removeListItem(
    field:
      | "requiredSkills"
      | "preferredSkills"
      | "knockoutCriteria",

    index: number,
  ) {
    setForm((previous) => {
      const updated =
        previous[field].filter(
          (_, itemIndex) =>
            itemIndex !== index,
        );

      return {
        ...previous,

        [field]:
          updated.length > 0
            ? updated
            : [""],
      };
    });
  }

  function validateForm() {
    if (
      !form.clientName.trim()
    ) {
      return "Client name is required.";
    }

    if (!form.jobTitle.trim()) {
      return "Job title is required.";
    }

    if (
      !form.department.trim()
    ) {
      return "Department is required.";
    }

    if (!form.location.trim()) {
      return "Location is required.";
    }

    if (
      form.maxExperience <
      form.minExperience
    ) {
      return "Maximum experience cannot be lower than minimum experience.";
    }

    const requiredSkills =
      form.requiredSkills.filter(
        (skill) =>
          skill.trim().length > 0,
      );

    if (
      requiredSkills.length === 0
    ) {
      return "Add at least one required skill.";
    }

    if (totalWeight !== 100) {
      return `Scoring weights currently total ${totalWeight}%. They must total exactly 100%.`;
    }

    return null;
  }

  function buildPayload(
    workflowStage = 1,
  ) {
    return {
      clientName:
        form.clientName.trim(),

      jobTitle:
        form.jobTitle.trim(),

      department:
        form.department.trim(),

      location:
        form.location.trim(),

      workMode:
        form.workMode,

      minExperience:
        form.minExperience,

      maxExperience:
        form.maxExperience,

      maxNoticePeriod:
        form.maxNoticePeriod,

      education:
        form.education.trim(),

      jdText:
        form.jdText.trim(),

      requiredSkills:
        form.requiredSkills
          .map((item) =>
            item.trim(),
          )
          .filter(Boolean),

      preferredSkills:
        form.preferredSkills
          .map((item) =>
            item.trim(),
          )
          .filter(Boolean),

      knockoutCriteria:
        form.knockoutCriteria
          .map((item) =>
            item.trim(),
          )
          .filter(Boolean),

      qualifyingScore:
        form.qualifyingScore,

      scoringWeights:
        form.scoringWeights,

      workflowStage,

      jobStatus:
        workflowStage >= 2
          ? "active"
          : "draft",
    };
  }

  async function saveJob(
    workflowStage = 1,
  ) {
    const validationError =
      validateForm();

    if (validationError) {
      setError(validationError);
      return null;
    }

    setIsSaving(true);
    setError("");
    setMessage("");

    try {
      const currentJobId =
        savedJobId ?? jobId;

      const endpoint =
        currentJobId
          ? `/api/jobs/${currentJobId}`
          : "/api/jobs";

      const method =
        currentJobId
          ? "PATCH"
          : "POST";

      const payload =
        buildPayload(
          workflowStage,
        );

      const response =
        await fetch(endpoint, {
          method,

          headers: {
            "Content-Type":
              "application/json",
          },

          body:
            JSON.stringify(
              payload,
            ),
        });

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result.message ||
            result.error ||
            "Unable to save recruitment.",
        );
      }

      const returnedJobId =
        result.job?.id;

      if (!returnedJobId) {
        throw new Error(
          "Job was saved but no job ID was returned.",
        );
      }

      setSavedJobId(
        returnedJobId,
      );

      onJobSaved?.(
        returnedJobId,
      );

      return returnedJobId;
    } catch (saveError) {
      const message =
        saveError instanceof Error
          ? saveError.message
          : "Unable to save recruitment.";

      setError(message);

      return null;
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveDraft() {
    const id =
      await saveJob(1);

    if (id) {
      setMessage(
        "Recruitment draft saved successfully.",
      );
    }
  }

  async function handleContinue() {
    const id =
      await saveJob(2);

    if (!id) {
      return;
    }

    setMessage(
      "Recruitment saved. Moving to Initial Screening.",
    );

    onContinue?.(id);
  }

  function handleFileChange(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file =
      event.target.files?.[0];

    if (!file) {
      return;
    }

    const maxSize =
      10 * 1024 * 1024;

    const validTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];

    if (
      !validTypes.includes(
        file.type,
      )
    ) {
      setError(
        "Only PDF and DOCX files are supported.",
      );

      event.target.value = "";

      return;
    }

    if (file.size > maxSize) {
      setError(
        "JD file must be 10 MB or smaller.",
      );

      event.target.value = "";

      return;
    }

    setJdFile(file);

    setError("");

    setMessage(
      "JD file selected. File upload to private storage will be connected in the document-processing phase.",
    );
  }

  return (
    <section className="space-y-6">
      <div>
        <p className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--brand-primary)]">
          Stage 1
        </p>

        <h1 className="text-3xl font-semibold tracking-tight">
          Job Description Setup
        </h1>

        <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-secondary)]">
          Configure the role,
          screening requirements,
          knockout criteria and
          scoring policy before
          candidate evaluation.
        </p>
      </div>

      {error && (
        <div className="flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle
            size={19}
            className="mt-0.5 shrink-0"
          />

          <span>{error}</span>
        </div>
      )}

      {message && (
        <div className="flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          <CheckCircle2
            size={19}
            className="mt-0.5 shrink-0"
          />

          <span>{message}</span>
        </div>
      )}

      <div className="card p-6">
        <h2 className="text-lg font-semibold">
          Role Information
        </h2>

        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <Field
            label="Client Name"
            required
          >
            <input
              className="input-style"
              value={
                form.clientName
              }
              onChange={(event) =>
                updateField(
                  "clientName",
                  event.target.value,
                )
              }
              placeholder="Client or company name"
            />
          </Field>

          <Field
            label="Job Title"
            required
          >
            <input
              className="input-style"
              value={form.jobTitle}
              onChange={(event) =>
                updateField(
                  "jobTitle",
                  event.target.value,
                )
              }
              placeholder="Example: Inside Sales Engineer"
            />
          </Field>

          <Field
            label="Department"
            required
          >
            <input
              className="input-style"
              value={
                form.department
              }
              onChange={(event) =>
                updateField(
                  "department",
                  event.target.value,
                )
              }
              placeholder="Example: Sales"
            />
          </Field>

          <Field
            label="Location"
            required
          >
            <input
              className="input-style"
              value={form.location}
              onChange={(event) =>
                updateField(
                  "location",
                  event.target.value,
                )
              }
              placeholder="Example: Bengaluru"
            />
          </Field>

          <Field label="Work Mode">
            <select
              className="input-style"
              value={form.workMode}
              onChange={(event) =>
                updateField(
                  "workMode",
                  event.target
                    .value as WorkMode,
                )
              }
            >
              <option value="onsite">
                On-site
              </option>

              <option value="hybrid">
                Hybrid
              </option>

              <option value="remote">
                Remote
              </option>
            </select>
          </Field>

          <Field label="Education Requirement">
            <input
              className="input-style"
              value={
                form.education
              }
              onChange={(event) =>
                updateField(
                  "education",
                  event.target.value,
                )
              }
              placeholder="Example: Bachelor's degree"
            />
          </Field>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="text-lg font-semibold">
          Experience & Notice Period
        </h2>

        <div className="mt-5 grid gap-5 md:grid-cols-3">
          <Field label="Minimum Experience">
            <input
              type="number"
              min={0}
              step="0.5"
              className="input-style"
              value={
                form.minExperience
              }
              onChange={(event) =>
                updateField(
                  "minExperience",
                  Number(
                    event.target
                      .value,
                  ),
                )
              }
            />
          </Field>

          <Field label="Maximum Experience">
            <input
              type="number"
              min={0}
              step="0.5"
              className="input-style"
              value={
                form.maxExperience
              }
              onChange={(event) =>
                updateField(
                  "maxExperience",
                  Number(
                    event.target
                      .value,
                  ),
                )
              }
            />
          </Field>

          <Field label="Maximum Notice Period (days)">
            <input
              type="number"
              min={0}
              className="input-style"
              value={
                form.maxNoticePeriod
              }
              onChange={(event) =>
                updateField(
                  "maxNoticePeriod",
                  Number(
                    event.target
                      .value,
                  ),
                )
              }
            />
          </Field>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="text-lg font-semibold">
          Job Description
        </h2>

        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Paste the JD below. PDF
          and DOCX ingestion will
          later use the same job
          record.
        </p>

        <textarea
          value={form.jdText}
          onChange={(event) =>
            updateField(
              "jdText",
              event.target.value,
            )
          }
          rows={10}
          className="input-style mt-5 resize-y"
          placeholder="Paste the full job description here..."
        />

        <div className="mt-5">
          <label className="flex cursor-pointer items-center justify-center gap-3 rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-soft)] p-6 text-sm transition hover:border-[var(--brand-primary)]">
            <Upload
              size={19}
            />

            <span>
              {jdFile
                ? jdFile.name
                : "Select JD PDF or DOCX"}
            </span>

            <input
              type="file"
              accept=".pdf,.docx"
              onChange={
                handleFileChange
              }
              className="hidden"
            />
          </label>
        </div>
      </div>

      <ListSection
        title="Required Skills"
        description="Skills considered essential for this role."
        items={
          form.requiredSkills
        }
        placeholder="Example: B2B Sales"
        onChange={(
          index,
          value,
        ) =>
          updateListItem(
            "requiredSkills",
            index,
            value,
          )
        }
        onAdd={() =>
          addListItem(
            "requiredSkills",
          )
        }
        onRemove={(index) =>
          removeListItem(
            "requiredSkills",
            index,
          )
        }
      />

      <ListSection
        title="Preferred Skills"
        description="Skills that strengthen the candidate profile but are not mandatory."
        items={
          form.preferredSkills
        }
        placeholder="Example: Salesforce CRM"
        onChange={(
          index,
          value,
        ) =>
          updateListItem(
            "preferredSkills",
            index,
            value,
          )
        }
        onAdd={() =>
          addListItem(
            "preferredSkills",
          )
        }
        onRemove={(index) =>
          removeListItem(
            "preferredSkills",
            index,
          )
        }
      />

      <ListSection
        title="Knockout Criteria"
        description="Explicit conditions the recruiter wants reviewed during screening."
        items={
          form.knockoutCriteria
        }
        placeholder="Example: Notice period above 30 days"
        onChange={(
          index,
          value,
        ) =>
          updateListItem(
            "knockoutCriteria",
            index,
            value,
          )
        }
        onAdd={() =>
          addListItem(
            "knockoutCriteria",
          )
        }
        onRemove={(index) =>
          removeListItem(
            "knockoutCriteria",
            index,
          )
        }
      />

      <div className="card p-6">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <div>
            <h2 className="text-lg font-semibold">
              Scoring Policy
            </h2>

            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Configure how much
              each factor contributes
              to the screening score.
            </p>
          </div>

          <div
            className={`rounded-xl px-4 py-2 text-sm font-semibold ${
              totalWeight === 100
                ? "bg-emerald-50 text-emerald-700"
                : "bg-amber-50 text-amber-700"
            }`}
          >
            Total:{" "}
            {totalWeight}%
          </div>
        </div>

        <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          <WeightField
            label="Required Skills"
            value={
              form.scoringWeights
                .requiredSkills
            }
            onChange={(value) =>
              updateWeight(
                "requiredSkills",
                value,
              )
            }
          />

          <WeightField
            label="Preferred Skills"
            value={
              form.scoringWeights
                .preferredSkills
            }
            onChange={(value) =>
              updateWeight(
                "preferredSkills",
                value,
              )
            }
          />

          <WeightField
            label="Experience"
            value={
              form.scoringWeights
                .experience
            }
            onChange={(value) =>
              updateWeight(
                "experience",
                value,
              )
            }
          />

          <WeightField
            label="Role Relevance"
            value={
              form.scoringWeights
                .roleRelevance
            }
            onChange={(value) =>
              updateWeight(
                "roleRelevance",
                value,
              )
            }
          />

          <WeightField
            label="Education"
            value={
              form.scoringWeights
                .education
            }
            onChange={(value) =>
              updateWeight(
                "education",
                value,
              )
            }
          />

          <WeightField
            label="Location"
            value={
              form.scoringWeights
                .location
            }
            onChange={(value) =>
              updateWeight(
                "location",
                value,
              )
            }
          />

          <WeightField
            label="Notice Period"
            value={
              form.scoringWeights
                .noticePeriod
            }
            onChange={(value) =>
              updateWeight(
                "noticePeriod",
                value,
              )
            }
          />

          <Field label="Qualifying Score">
            <input
              type="number"
              min={0}
              max={100}
              className="input-style"
              value={
                form.qualifyingScore
              }
              onChange={(event) =>
                updateField(
                  "qualifyingScore",
                  Number(
                    event.target
                      .value,
                  ),
                )
              }
            />
          </Field>
        </div>
      </div>

      <div className="card flex flex-col justify-between gap-4 p-5 md:flex-row md:items-center">
        <div className="flex items-center gap-3">
          <FileText
            size={20}
            className="text-[var(--brand-primary)]"
          />

          <div>
            <p className="text-sm font-semibold">
              Recruitment Draft
            </p>

            <p className="text-xs text-[var(--text-secondary)]">
              {savedJobId
                ? `Saved job ID: ${savedJobId}`
                : "Not saved yet"}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={
              handleSaveDraft
            }
            disabled={isSaving}
            className="focus-ring flex items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-5 py-3 text-sm font-semibold transition hover:bg-[var(--surface-soft)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Save size={17} />

            {isSaving
              ? "Saving..."
              : "Save Draft"}
          </button>

          <button
            type="button"
            onClick={
              handleContinue
            }
            disabled={isSaving}
            className="focus-ring flex items-center justify-center gap-2 rounded-xl bg-[var(--brand-primary)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--brand-primary-dark)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving
              ? "Saving..."
              : "Continue to Initial Screening"}

            {!isSaving && (
              <ArrowRight
                size={17}
              />
            )}
          </button>
        </div>
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

function WeightField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (
    value: number,
  ) => void;
}) {
  return (
    <Field label={`${label} (%)`}>
      <input
        type="number"
        min={0}
        max={100}
        className="input-style"
        value={value}
        onChange={(event) =>
          onChange(
            Number(
              event.target.value,
            ),
          )
        }
      />
    </Field>
  );
}

function ListSection({
  title,
  description,
  items,
  placeholder,
  onChange,
  onAdd,
  onRemove,
}: {
  title: string;
  description: string;
  items: string[];
  placeholder: string;

  onChange: (
    index: number,
    value: string,
  ) => void;

  onAdd: () => void;

  onRemove: (
    index: number,
  ) => void;
}) {
  return (
    <div className="card p-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <h2 className="text-lg font-semibold">
            {title}
          </h2>

          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            {description}
          </p>
        </div>

        <button
          type="button"
          onClick={onAdd}
          className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold transition hover:bg-[var(--surface-soft)]"
        >
          <Plus size={16} />
          Add
        </button>
      </div>

      <div className="mt-5 space-y-3">
        {items.map(
          (item, index) => (
            <div
              key={index}
              className="flex gap-2"
            >
              <input
                className="input-style"
                value={item}
                onChange={(
                  event,
                ) =>
                  onChange(
                    index,
                    event.target
                      .value,
                  )
                }
                placeholder={
                  placeholder
                }
              />

              <button
                type="button"
                onClick={() =>
                  onRemove(index)
                }
                aria-label={`Remove ${title} item`}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-white text-[var(--text-secondary)] transition hover:bg-red-50 hover:text-red-600"
              >
                <Trash2
                  size={17}
                />
              </button>
            </div>
          ),
        )}
      </div>
    </div>
  );
}