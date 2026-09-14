create extension if not exists pgcrypto;

-- =========================================================
-- 1. ORGANISATIONS
-- =========================================================

create table organisations (
    id uuid primary key default gen_random_uuid(),

    name text not null,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- =========================================================
-- 2. APPLICATION USERS
-- =========================================================

create table app_users (
    id uuid primary key default gen_random_uuid(),

    auth_user_id uuid unique,

    organisation_id uuid
        references organisations(id)
        on delete cascade,

    full_name text,
    email text,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- =========================================================
-- 3. JOBS
-- =========================================================

create table jobs (
    id uuid primary key default gen_random_uuid(),

    organisation_id uuid
        references organisations(id)
        on delete cascade,

    client_name text not null,
    job_title text not null,
    department text,
    location text,

    work_mode text not null default 'onsite'
        check (
            work_mode in (
                'onsite',
                'hybrid',
                'remote'
            )
        ),

    min_experience_years numeric(5,2) not null default 0,
    max_experience_years numeric(5,2) not null default 0,

    max_notice_period_days integer not null default 0,

    education_requirements text,

    jd_text text,

    jd_storage_path text,
    jd_original_file_name text,

    required_skills jsonb not null default '[]'::jsonb,
    preferred_skills jsonb not null default '[]'::jsonb,
    knockout_criteria jsonb not null default '[]'::jsonb,

    scoring_weights jsonb not null default '{}'::jsonb,

    qualifying_score numeric(5,2) not null default 70,

    workflow_stage integer not null default 1
        check (
            workflow_stage >= 1
            and workflow_stage <= 7
        ),

    job_status text not null default 'draft'
        check (
            job_status in (
                'draft',
                'active',
                'completed',
                'archived'
            )
        ),

    created_by uuid
        references app_users(id)
        on delete set null,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    check (
        max_experience_years >= min_experience_years
    ),

    check (
        qualifying_score >= 0
        and qualifying_score <= 100
    )
);

-- =========================================================
-- 4. CANDIDATES
-- =========================================================

create table candidates (
    id uuid primary key default gen_random_uuid(),

    full_name text,

    email_address text,
    phone_number text,

    normalized_email text,
    normalized_phone text,

    current_job_title text,
    current_employer text,

    total_experience_years numeric(5,2),

    current_location text,
    preferred_location text,

    notice_period_days integer,

    education_summary text,
    salary_text text,

    skills jsonb not null default '[]'::jsonb,

    duplicate_flag boolean not null default false,

    duplicate_status text not null default 'not_checked'
        check (
            duplicate_status in (
                'not_checked',
                'unique',
                'possible_duplicate',
                'confirmed_duplicate'
            )
        ),

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- =========================================================
-- 5. JOB-CANDIDATE ASSOCIATIONS
-- =========================================================

create table job_candidates (
    id uuid primary key default gen_random_uuid(),

    job_id uuid not null
        references jobs(id)
        on delete cascade,

    candidate_id uuid not null
        references candidates(id)
        on delete cascade,

    initial_score numeric(5,2),

    initial_selected boolean not null default false,

    recruiter_review_status text not null default 'pending'
        check (
            recruiter_review_status in (
                'pending',
                'in_review',
                'reviewed'
            )
        ),

    workflow_status text not null default 'initial_screening'
        check (
            workflow_status in (
                'initial_screening',
                'awaiting_cv',
                'cv_screening',
                'finalisation',
                'approved_for_outreach',
                'rejected',
                'completed'
            )
        ),

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    unique (job_id, candidate_id)
);

-- =========================================================
-- 6. CANDIDATE DOCUMENTS
-- =========================================================

create table candidate_documents (
    id uuid primary key default gen_random_uuid(),

    candidate_id uuid not null
        references candidates(id)
        on delete cascade,

    job_id uuid
        references jobs(id)
        on delete cascade,

    document_type text not null
        check (
            document_type in (
                'profile_screenshot',
                'cv_pdf',
                'cv_docx',
                'scanned_cv'
            )
        ),

    storage_bucket text not null default 'candidate-documents',
    storage_path text not null,

    original_file_name text,
    mime_type text,
    file_size_bytes bigint,

    parsing_status text not null default 'pending'
        check (
            parsing_status in (
                'pending',
                'processing',
                'completed',
                'failed'
            )
        ),

    parser_error_code text,
    parser_error_message text,

    extracted_data jsonb not null default '{}'::jsonb,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- =========================================================
-- 7. MODEL VERSIONS
-- =========================================================

create table model_versions (
    id uuid primary key default gen_random_uuid(),

    parser_version text not null,
    ocr_version text,
    taxonomy_version text not null,
    embedding_model_version text not null,
    scoring_policy_version text not null,

    is_active boolean not null default true,

    metadata jsonb not null default '{}'::jsonb,

    created_at timestamptz not null default now()
);

-- =========================================================
-- 8. CANDIDATE SCORECARDS
-- =========================================================

create table candidate_scorecards (
    id uuid primary key default gen_random_uuid(),

    job_candidate_id uuid not null
        references job_candidates(id)
        on delete cascade,

    model_version_id uuid
        references model_versions(id)
        on delete set null,

    total_score numeric(5,2),

    recommendation text
        check (
            recommendation in (
                'strong_match',
                'review_recommended',
                'weak_match',
                'insufficient_information'
            )
        ),

    confidence_score numeric(5,2),

    missing_information_count integer not null default 0,

    parser_version text,
    ocr_version text,
    taxonomy_version text,
    embedding_model_version text,
    scoring_policy_version text,

    assessment_timestamp timestamptz not null default now(),

    created_at timestamptz not null default now(),

    check (
        total_score is null
        or (
            total_score >= 0
            and total_score <= 100
        )
    ),

    check (
        confidence_score is null
        or (
            confidence_score >= 0
            and confidence_score <= 100
        )
    )
);

-- =========================================================
-- 9. SCORE COMPONENTS
-- =========================================================

create table candidate_score_components (
    id uuid primary key default gen_random_uuid(),

    scorecard_id uuid not null
        references candidate_scorecards(id)
        on delete cascade,

    component_key text not null,

    component_label text not null,

    jd_requirement text,
    candidate_value text,

    component_score numeric(5,2),

    configured_weight numeric(5,2),

    score_contribution numeric(5,2),

    evidence_excerpt text,
    evidence_location text,

    confidence_score numeric(5,2),

    missing_information boolean not null default false,

    created_at timestamptz not null default now(),

    check (
        component_score is null
        or (
            component_score >= 0
            and component_score <= 100
        )
    ),

    check (
        confidence_score is null
        or (
            confidence_score >= 0
            and confidence_score <= 100
        )
    )
);

-- =========================================================
-- 10. CANDIDATE DECISIONS
-- =========================================================

create table candidate_decisions (
    id uuid primary key default gen_random_uuid(),

    job_candidate_id uuid not null
        references job_candidates(id)
        on delete cascade,

    scorecard_id uuid
        references candidate_scorecards(id)
        on delete set null,

    ai_recommendation text,

    recruiter_decision text not null default 'pending'
        check (
            recruiter_decision in (
                'pending',
                'approved',
                'rejected'
            )
        ),

    final_workflow_decision text
        check (
            final_workflow_decision in (
                'pending',
                'proceed',
                'do_not_proceed'
            )
        ),

    recruiter_agrees_with_ai boolean,

    override_reason text,

    recruiter_notes text,

    corrected_extracted_values jsonb not null default '{}'::jsonb,
    corrected_skills jsonb not null default '[]'::jsonb,

    phone_verified boolean not null default false,
    whatsapp_consent boolean not null default false,

    created_by uuid
        references app_users(id)
        on delete set null,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- =========================================================
-- 11. RECRUITMENT EVENTS
-- =========================================================

create table recruitment_events (
    id uuid primary key default gen_random_uuid(),

    job_id uuid not null
        references jobs(id)
        on delete cascade,

    candidate_id uuid
        references candidates(id)
        on delete set null,

    job_candidate_id uuid
        references job_candidates(id)
        on delete set null,

    event_type text not null,

    event_data jsonb not null default '{}'::jsonb,

    created_by uuid
        references app_users(id)
        on delete set null,

    created_at timestamptz not null default now()
);

-- =========================================================
-- 12. COMMUNICATION EVENTS
-- =========================================================

create table communication_events (
    id uuid primary key default gen_random_uuid(),

    job_candidate_id uuid not null
        references job_candidates(id)
        on delete cascade,

    provider_name text,

    provider_message_id text,

    communication_status text not null default 'not_ready'
        check (
            communication_status in (
                'not_ready',
                'ready',
                'queued',
                'accepted',
                'sent',
                'delivered',
                'read',
                'replied',
                'interested',
                'not_interested',
                'failed',
                'opted_out'
            )
        ),

    recipient_normalized text,

    template_name text,

    provider_error_code text,
    provider_error_message text,

    provider_payload jsonb not null default '{}'::jsonb,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- =========================================================
-- 13. CALL EVENTS
-- =========================================================

create table call_events (
    id uuid primary key default gen_random_uuid(),

    job_candidate_id uuid not null
        references job_candidates(id)
        on delete cascade,

    provider_name text,
    provider_call_id text,

    call_status text not null default 'not_ready'
        check (
            call_status in (
                'not_ready',
                'scheduled',
                'initiated',
                'ringing',
                'answered',
                'completed',
                'no_answer',
                'busy',
                'failed',
                'cancelled'
            )
        ),

    call_language text
        check (
            call_language is null
            or call_language in (
                'english',
                'hindi',
                'hinglish'
            )
        ),

    scheduled_for timestamptz,

    transcript_storage_path text,
    recording_storage_path text,

    provider_error_code text,
    provider_error_message text,

    provider_payload jsonb not null default '{}'::jsonb,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- =========================================================
-- INDEXES
-- =========================================================

create index idx_jobs_organisation_id
    on jobs (organisation_id);

create index idx_jobs_job_status
    on jobs (job_status);

create index idx_jobs_workflow_stage
    on jobs (workflow_stage);

create index idx_jobs_updated_at
    on jobs (updated_at desc);

create index idx_candidates_normalized_email
    on candidates (normalized_email);

create index idx_candidates_normalized_phone
    on candidates (normalized_phone);

create index idx_job_candidates_job_id
    on job_candidates (job_id);

create index idx_job_candidates_candidate_id
    on job_candidates (candidate_id);

create index idx_candidate_documents_candidate_id
    on candidate_documents (candidate_id);

create index idx_candidate_documents_job_id
    on candidate_documents (job_id);

create index idx_candidate_scorecards_job_candidate_id
    on candidate_scorecards (job_candidate_id);

create index idx_candidate_score_components_scorecard_id
    on candidate_score_components (scorecard_id);

create index idx_candidate_decisions_job_candidate_id
    on candidate_decisions (job_candidate_id);

create index idx_recruitment_events_job_id
    on recruitment_events (job_id);

create index idx_communication_events_job_candidate_id
    on communication_events (job_candidate_id);

create index idx_call_events_job_candidate_id
    on call_events (job_candidate_id);

-- =========================================================
-- UPDATED_AT FUNCTION
-- =========================================================

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

-- =========================================================
-- UPDATED_AT TRIGGERS
-- =========================================================

create trigger trg_organisations_updated_at
before update on organisations
for each row
execute function set_updated_at();

create trigger trg_app_users_updated_at
before update on app_users
for each row
execute function set_updated_at();

create trigger trg_jobs_updated_at
before update on jobs
for each row
execute function set_updated_at();

create trigger trg_candidates_updated_at
before update on candidates
for each row
execute function set_updated_at();

create trigger trg_job_candidates_updated_at
before update on job_candidates
for each row
execute function set_updated_at();

create trigger trg_candidate_documents_updated_at
before update on candidate_documents
for each row
execute function set_updated_at();

create trigger trg_candidate_decisions_updated_at
before update on candidate_decisions
for each row
execute function set_updated_at();

create trigger trg_communication_events_updated_at
before update on communication_events
for each row
execute function set_updated_at();

create trigger trg_call_events_updated_at
before update on call_events
for each row
execute function set_updated_at();

-- =========================================================
-- PRIVATE STORAGE BUCKETS
-- =========================================================

insert into storage.buckets (
    id,
    name,
    public
)
values
    (
        'candidate-documents',
        'candidate-documents',
        false
    ),
    (
        'job-documents',
        'job-documents',
        false
    )
on conflict (id) do nothing;