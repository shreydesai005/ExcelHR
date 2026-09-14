"use client";

import Image from "next/image";
import {
  Bell,
  Plus,
  Search,
} from "lucide-react";
import { motion } from "motion/react";

type AppHeaderProps = {
  onNewRecruitment?: () => void;
  onLogoClick?: () => void;
};

export default function AppHeader({
  onNewRecruitment,
  onLogoClick,
}: AppHeaderProps) {
  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="glass sticky top-0 z-50 border-b"
    >
      <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-6 px-6 py-4 lg:px-10">
        <button
          type="button"
          onClick={onLogoClick}
          className="flex items-center gap-4 text-left"
        >
          <Image
            src="/brand/excel-hr-logo.png"
            alt="Excel HR Consultancy"
            width={150}
            height={70}
            className="h-11 w-auto object-contain"
            priority
          />

          <div className="hidden border-l border-[var(--border)] pl-4 md:block">
            <p className="text-sm font-semibold text-[var(--text-primary)]">
              Recruitment Intelligence Platform
            </p>

            <p className="text-xs text-[var(--text-secondary)]">
              Transparent recruitment intelligence
            </p>
          </div>
        </button>

        <div className="hidden flex-1 justify-center lg:flex">
          <div className="relative w-full max-w-md">
            <Search
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
            />

            <input
              type="text"
              placeholder="Search jobs or candidates..."
              className="focus-ring w-full rounded-xl border border-[var(--border)] bg-white px-11 py-2.5 text-sm outline-none transition"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Notifications"
            className="focus-ring flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border)] bg-white text-[var(--text-secondary)] transition hover:bg-[var(--surface-soft)]"
          >
            <Bell size={18} />
          </button>

          <button
            type="button"
            onClick={onNewRecruitment}
            className="focus-ring flex items-center gap-2 rounded-xl bg-[var(--brand-primary)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--brand-primary-dark)]"
          >
            <Plus size={17} />

            <span className="hidden sm:inline">
              New Recruitment
            </span>
          </button>
        </div>
      </div>
    </motion.header>
  );
}