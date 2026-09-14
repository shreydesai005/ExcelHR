"use client";

import {
  Archive,
  BriefcaseBusiness,
  Clock3,
  Search,
  Users,
  Plus,
  ArrowRight,
} from "lucide-react";
import { motion } from "motion/react";

type RecruitmentDashboardProps = {
  onCreateRecruitment?: () => void;
};

const dashboardCards = [
  {
    label: "Active Jobs",
    value: "—",
    icon: BriefcaseBusiness,
    description: "Currently open recruitments",
  },
  {
    label: "Total Candidates",
    value: "—",
    icon: Users,
    description: "Candidates across all jobs",
  },
  {
    label: "Awaiting Review",
    value: "—",
    icon: Clock3,
    description: "Candidates requiring recruiter review",
  },
  {
    label: "Archived Jobs",
    value: "—",
    icon: Archive,
    description: "Closed or archived recruitments",
  },
];

export default function RecruitmentDashboard({
  onCreateRecruitment,
}: RecruitmentDashboardProps) {
  return (
    <section className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--brand-primary)]">
            Recruitment Workspace
          </p>

          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
            Recruitment Dashboard
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">
            Manage jobs, candidates, screening, recruiter decisions, and
            recruitment progress from one workspace.
          </p>
        </div>

        <button
          type="button"
          onClick={onCreateRecruitment}
          className="focus-ring flex items-center justify-center gap-2 rounded-xl bg-[var(--brand-primary)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--brand-primary-dark)]"
        >
          <Plus size={17} />
          Create Recruitment
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {dashboardCards.map((card, index) => {
          const Icon = card.icon;

          return (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.35,
                delay: index * 0.06,
              }}
              className="card p-5"
            >
              <div className="mb-6 flex items-center justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--surface-soft)] text-[var(--brand-primary)]">
                  <Icon size={20} />
                </div>
              </div>

              <p className="text-3xl font-semibold text-[var(--text-primary)]">
                {card.value}
              </p>

              <p className="mt-2 text-sm font-semibold">
                {card.label}
              </p>

              <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                {card.description}
              </p>
            </motion.div>
          );
        })}
      </div>

      <div className="card overflow-hidden">
        <div className="flex flex-col justify-between gap-4 border-b border-[var(--border)] p-5 md:flex-row md:items-center">
          <div>
            <h2 className="text-lg font-semibold">
              Recruitments
            </h2>

            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Your saved recruitment projects will appear here.
            </p>
          </div>

          <div className="flex w-full flex-col gap-3 sm:flex-row md:w-auto">
            <div className="relative w-full md:w-72">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
              />

              <input
                type="text"
                placeholder="Search recruitments..."
                className="focus-ring w-full rounded-xl border border-[var(--border)] bg-white py-2.5 pl-10 pr-3 text-sm outline-none"
              />
            </div>

            <select
              defaultValue="all"
              aria-label="Filter recruitments"
              className="focus-ring rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none"
            >
              <option value="all">
                All statuses
              </option>

              <option value="draft">
                Draft
              </option>

              <option value="active">
                Active
              </option>

              <option value="completed">
                Completed
              </option>

              <option value="archived">
                Archived
              </option>
            </select>
          </div>
        </div>

        <div className="flex min-h-[300px] flex-col items-center justify-center px-6 py-12 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--surface-soft)] text-[var(--brand-primary)]">
            <BriefcaseBusiness size={27} />
          </div>

          <h3 className="text-lg font-semibold">
            No recruitments yet
          </h3>

          <p className="mt-2 max-w-md text-sm leading-6 text-[var(--text-secondary)]">
            Create your first recruitment project to configure the job
            description, define screening criteria, and begin candidate
            evaluation.
          </p>

          <button
            type="button"
            onClick={onCreateRecruitment}
            className="mt-5 flex items-center gap-2 rounded-xl bg-[var(--brand-primary)] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--brand-primary-dark)]"
          >
            Create Recruitment
            <ArrowRight size={16} />
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-5">
          <p className="text-sm font-semibold">
            Database
          </p>

          <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
            Supabase is not connected yet. Recruitment metrics will populate
            automatically once persistence is configured.
          </p>
        </div>

        <div className="card p-5">
          <p className="text-sm font-semibold">
            Candidate Intelligence
          </p>

          <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
            Candidate scores will only appear after CV parsing and the in-house
            screening model are connected.
          </p>
        </div>

        <div className="card p-5">
          <p className="text-sm font-semibold">
            Recruiter Control
          </p>

          <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
            AI recommendations remain advisory. Final decisions will always be
            controlled and recorded by the recruiter.
          </p>
        </div>
      </div>
    </section>
  );
}