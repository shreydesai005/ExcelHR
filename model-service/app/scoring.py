import re

from typing import List

from app.embeddings import (
    best_semantic_match,
    cosine_similarity,
)

from app.schemas import (
    CandidateData,
    ComponentScore,
    EvidenceItem,
    JobData,
    ScreeningResponse,
)


REQUIRED_SKILL_THRESHOLD = 0.62
PREFERRED_SKILL_THRESHOLD = 0.62


def round_score(
    value: float,
) -> float:
    return round(
        max(
            0,
            min(
                100,
                value,
            ),
        ),
        2,
    )


def normalize_text(
    value: str | None,
) -> str:
    if not value:
        return ""

    return re.sub(
        r"\s+",
        " ",
        value.strip().lower(),
    )


def candidate_evidence_pool(
    candidate: CandidateData,
) -> List[str]:
    evidence = []

    for skill in candidate.skills:
        if skill.strip():
            evidence.append(
                skill.strip()
            )

    if (
        candidate.currentJobTitle
    ):
        evidence.append(
            candidate.currentJobTitle
        )

    cv_text = (
        candidate.cvText or ""
    )

    lines = [
        line.strip()
        for line in cv_text.splitlines()
        if len(
            line.strip()
        ) >= 3
    ]

    evidence.extend(
        lines[:500]
    )

    return evidence


def score_skill_group(
    skills: List[str],
    candidate: CandidateData,
    weight: float,
    key: str,
    label: str,
    threshold: float,
):
    if not skills:
        return ComponentScore(
            key=key,
            label=label,
            score=None,
            configuredWeight=weight,
            contribution=0,
            confidence=100,
            missingInformation=True,
            explanation=(
                "No requirements were configured "
                "for this component."
            ),
            evidence=[],
        )

    evidence_pool = (
        candidate_evidence_pool(
            candidate
        )
    )

    if not evidence_pool:
        return ComponentScore(
            key=key,
            label=label,
            score=None,
            configuredWeight=weight,
            contribution=0,
            confidence=0,
            missingInformation=True,
            explanation=(
                "Candidate evidence was not "
                "available for this component."
            ),
            evidence=[],
        )

    results = []

    for skill in skills:
        (
            best_evidence,
            similarity,
        ) = best_semantic_match(
            skill,
            evidence_pool,
        )

        matched = (
            similarity >=
            threshold
        )

        results.append(
            EvidenceItem(
                requirement=skill,
                candidateEvidence=best_evidence,
                similarity=round(
                    similarity,
                    4,
                ),
                matched=matched,
            )
        )

    matched_count = sum(
        1
        for item in results
        if item.matched
    )

    score = (
        matched_count
        / len(skills)
    ) * 100

    contribution = (
        score / 100
    ) * weight

    similarities = [
        item.similarity or 0
        for item in results
    ]

    average_similarity = (
        sum(similarities)
        / len(similarities)
    )

    confidence = (
        average_similarity
        * 100
    )

    return ComponentScore(
        key=key,
        label=label,
        score=round_score(
            score
        ),
        configuredWeight=weight,
        contribution=round(
            contribution,
            2,
        ),
        confidence=round_score(
            confidence
        ),
        missingInformation=False,
        explanation=(
            f"{matched_count} of "
            f"{len(skills)} configured "
            f"skills matched above "
            f"the semantic threshold."
        ),
        evidence=results,
    )


def score_experience(
    job: JobData,
    candidate: CandidateData,
):
    weight = (
        job.scoringWeights
        .experience
    )

    experience = (
        candidate
        .totalExperienceYears
    )

    if experience is None:
        return ComponentScore(
            key="experience",
            label="Experience",
            score=None,
            configuredWeight=weight,
            contribution=0,
            confidence=0,
            missingInformation=True,
            explanation=(
                "Candidate experience "
                "was not available."
            ),
            evidence=[],
        )

    minimum = (
        job.minExperience
        if job.minExperience
        is not None
        else 0
    )

    maximum = (
        job.maxExperience
        if job.maxExperience
        is not None
        else None
    )

    if experience >= minimum:
        if (
            maximum is None
            or maximum <= 0
            or experience <= maximum
        ):
            score = 100
        else:
            excess = (
                experience
                - maximum
            )

            score = max(
                70,
                100 -
                (
                    excess * 5
                ),
            )
    else:
        if minimum <= 0:
            score = 100

        else:
            ratio = (
                experience /
                minimum
            )

            score = (
                ratio * 100
            )

    contribution = (
        score / 100
    ) * weight

    return ComponentScore(
        key="experience",
        label="Experience",
        score=round_score(
            score
        ),
        configuredWeight=weight,
        contribution=round(
            contribution,
            2,
        ),
        confidence=100,
        missingInformation=False,
        explanation=(
            f"Candidate has "
            f"{experience} years of "
            f"experience. Job range "
            f"is {minimum} to "
            f"{maximum if maximum is not None else 'not specified'} years."
        ),
        evidence=[
            EvidenceItem(
                requirement=(
                    f"{minimum} - "
                    f"{maximum}"
                    if maximum
                    is not None
                    else f"{minimum}+ years"
                ),
                candidateEvidence=(
                    f"{experience} years"
                ),
                matched=(
                    score >= 70
                ),
            )
        ],
    )


def score_role_relevance(
    job: JobData,
    candidate: CandidateData,
):
    weight = (
        job.scoringWeights
        .roleRelevance
    )

    candidate_role = (
        candidate
        .currentJobTitle
    )

    if not candidate_role:
        return ComponentScore(
            key="roleRelevance",
            label="Role Relevance",
            score=None,
            configuredWeight=weight,
            contribution=0,
            confidence=0,
            missingInformation=True,
            explanation=(
                "Candidate current role "
                "was not available."
            ),
            evidence=[],
        )

    similarity = (
        cosine_similarity(
            job.jobTitle,
            candidate_role,
        )
    )

    score = (
        similarity * 100
    )

    contribution = (
        score / 100
    ) * weight

    return ComponentScore(
        key="roleRelevance",
        label="Role Relevance",
        score=round_score(
            score
        ),
        configuredWeight=weight,
        contribution=round(
            contribution,
            2,
        ),
        confidence=round_score(
            similarity * 100
        ),
        missingInformation=False,
        explanation=(
            "Semantic similarity between "
            "the target job title and "
            "candidate current role."
        ),
        evidence=[
            EvidenceItem(
                requirement=
                    job.jobTitle,
                candidateEvidence=
                    candidate_role,
                similarity=round(
                    similarity,
                    4,
                ),
                matched=(
                    similarity
                    >= 0.60
                ),
            )
        ],
    )


def score_education(
    job: JobData,
    candidate: CandidateData,
):
    weight = (
        job.scoringWeights
        .education
    )

    requirement = (
        job.education or ""
    ).strip()

    candidate_education = (
        candidate
        .educationSummary
        or ""
    ).strip()

    if not requirement:
        return ComponentScore(
            key="education",
            label="Education",
            score=None,
            configuredWeight=weight,
            contribution=0,
            confidence=100,
            missingInformation=True,
            explanation=(
                "No education requirement "
                "was configured."
            ),
            evidence=[],
        )

    if not candidate_education:
        return ComponentScore(
            key="education",
            label="Education",
            score=None,
            configuredWeight=weight,
            contribution=0,
            confidence=0,
            missingInformation=True,
            explanation=(
                "Candidate education "
                "information is unavailable."
            ),
            evidence=[],
        )

    similarity = (
        cosine_similarity(
            requirement,
            candidate_education,
        )
    )

    score = (
        similarity * 100
    )

    contribution = (
        score / 100
    ) * weight

    return ComponentScore(
        key="education",
        label="Education",
        score=round_score(
            score
        ),
        configuredWeight=weight,
        contribution=round(
            contribution,
            2,
        ),
        confidence=round_score(
            similarity * 100
        ),
        missingInformation=False,
        explanation=(
            "Semantic comparison of "
            "education requirement and "
            "candidate education."
        ),
        evidence=[
            EvidenceItem(
                requirement=
                    requirement,
                candidateEvidence=
                    candidate_education,
                similarity=round(
                    similarity,
                    4,
                ),
                matched=(
                    similarity
                    >= 0.55
                ),
            )
        ],
    )


def score_location(
    job: JobData,
    candidate: CandidateData,
):
    weight = (
        job.scoringWeights
        .location
    )

    required = (
        job.location or ""
    ).strip()

    candidate_location = (
        candidate
        .currentLocation
        or ""
    ).strip()

    if not required:
        return ComponentScore(
            key="location",
            label="Location",
            score=None,
            configuredWeight=weight,
            contribution=0,
            confidence=100,
            missingInformation=True,
            explanation=(
                "No job location "
                "was configured."
            ),
            evidence=[],
        )

    if not candidate_location:
        return ComponentScore(
            key="location",
            label="Location",
            score=None,
            configuredWeight=weight,
            contribution=0,
            confidence=0,
            missingInformation=True,
            explanation=(
                "Candidate location "
                "is unavailable."
            ),
            evidence=[],
        )

    required_norm = (
        normalize_text(
            required
        )
    )

    candidate_norm = (
        normalize_text(
            candidate_location
        )
    )

    exact = (
        required_norm ==
        candidate_norm
    )

    partial = (
        required_norm
        in candidate_norm
        or candidate_norm
        in required_norm
    )

    if exact:
        score = 100

    elif partial:
        score = 90

    else:
        similarity = (
            cosine_similarity(
                required,
                candidate_location,
            )
        )

        score = (
            similarity * 100
        )

    contribution = (
        score / 100
    ) * weight

    return ComponentScore(
        key="location",
        label="Location",
        score=round_score(
            score
        ),
        configuredWeight=weight,
        contribution=round(
            contribution,
            2,
        ),
        confidence=100,
        missingInformation=False,
        explanation=(
            "Comparison of configured "
            "job location with candidate "
            "current location."
        ),
        evidence=[
            EvidenceItem(
                requirement=
                    required,
                candidateEvidence=
                    candidate_location,
                matched=(
                    score >= 70
                ),
            )
        ],
    )


def score_notice_period(
    job: JobData,
    candidate: CandidateData,
):
    weight = (
        job.scoringWeights
        .noticePeriod
    )

    maximum = (
        job.maxNoticePeriod
    )

    actual = (
        candidate
        .noticePeriodDays
    )

    if maximum is None:
        return ComponentScore(
            key="noticePeriod",
            label="Notice Period",
            score=None,
            configuredWeight=weight,
            contribution=0,
            confidence=100,
            missingInformation=True,
            explanation=(
                "Maximum notice period "
                "was not configured."
            ),
            evidence=[],
        )

    if actual is None:
        return ComponentScore(
            key="noticePeriod",
            label="Notice Period",
            score=None,
            configuredWeight=weight,
            contribution=0,
            confidence=0,
            missingInformation=True,
            explanation=(
                "Candidate notice period "
                "is unavailable."
            ),
            evidence=[],
        )

    if actual <= maximum:
        score = 100

    else:
        excess = (
            actual - maximum
        )

        score = max(
            0,
            100 -
            (
                excess * 2
            ),
        )

    contribution = (
        score / 100
    ) * weight

    return ComponentScore(
        key="noticePeriod",
        label="Notice Period",
        score=round_score(
            score
        ),
        configuredWeight=weight,
        contribution=round(
            contribution,
            2,
        ),
        confidence=100,
        missingInformation=False,
        explanation=(
            f"Candidate notice period "
            f"is {actual} days. Maximum "
            f"configured notice period "
            f"is {maximum} days."
        ),
        evidence=[
            EvidenceItem(
                requirement=
                    f"Maximum {maximum} days",
                candidateEvidence=
                    f"{actual} days",
                matched=(
                    actual <=
                    maximum
                ),
            )
        ],
    )


def calculate_screening(
    job: JobData,
    candidate: CandidateData,
):
    components = [
        score_skill_group(
            job.requiredSkills,
            candidate,
            job.scoringWeights.requiredSkills,
            "requiredSkills",
            "Required Skills",
            REQUIRED_SKILL_THRESHOLD,
        ),

        score_skill_group(
            job.preferredSkills,
            candidate,
            job.scoringWeights.preferredSkills,
            "preferredSkills",
            "Preferred Skills",
            PREFERRED_SKILL_THRESHOLD,
        ),

        score_experience(
            job,
            candidate,
        ),

        score_role_relevance(
            job,
            candidate,
        ),

        score_education(
            job,
            candidate,
        ),

        score_location(
            job,
            candidate,
        ),

        score_notice_period(
            job,
            candidate,
        ),
    ]

    total_contribution = sum(
        component.contribution
        for component
        in components
    )

    configured_weight = sum(
        component.configuredWeight
        for component
        in components
        if not component.missingInformation
    )

    missing_count = sum(
        1
        for component
        in components
        if component.missingInformation
    )

    if configured_weight > 0:
        normalized_score = (
            total_contribution
            / configured_weight
        ) * 100
    else:
        normalized_score = 0

    final_score = round_score(
        normalized_score
    )

    available_components = [
        component
        for component
        in components
        if not component.missingInformation
    ]

    if available_components:
        confidence_score = (
            sum(
                component.confidence
                for component
                in available_components
            )
            / len(
                available_components
            )
        )
    else:
        confidence_score = 0

    if (
        len(
            available_components
        )
        < 3
    ):
        recommendation = (
            "insufficient_information"
        )

    elif (
        final_score >=
        max(
            job.qualifyingScore,
            80,
        )
    ):
        recommendation = (
            "strong_match"
        )

    elif (
        final_score >=
        job.qualifyingScore
    ):
        recommendation = (
            "review_recommended"
        )

    else:
        recommendation = (
            "weak_match"
        )

    return ScreeningResponse(
        totalScore=
            final_score,

        recommendation=
            recommendation,

        confidenceScore=
            round_score(
                confidence_score
            ),

        qualifyingScore=
            job.qualifyingScore,

        components=
            components,

        missingInformationCount=
            missing_count,

        modelMetadata={
            "embeddingModel":
                "sentence-transformers/all-MiniLM-L6-v2",

            "scoringPolicy":
                "excel-hr-v1",

            "skillMatchPolicy":
                "semantic-threshold-v1",
        },
    )