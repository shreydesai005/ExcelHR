from typing import Dict, List, Optional

from pydantic import BaseModel, Field


class ScoringWeights(BaseModel):
    requiredSkills: float = 30
    preferredSkills: float = 10
    experience: float = 20
    roleRelevance: float = 15
    education: float = 10
    location: float = 5
    noticePeriod: float = 10


class JobData(BaseModel):
    jobTitle: str
    location: Optional[str] = None

    minExperience: Optional[float] = None
    maxExperience: Optional[float] = None

    maxNoticePeriod: Optional[int] = None

    education: Optional[str] = None

    jdText: Optional[str] = None

    requiredSkills: List[str] = []
    preferredSkills: List[str] = []

    knockoutCriteria: List[str] = []

    qualifyingScore: float = 70

    scoringWeights: ScoringWeights


class CandidateData(BaseModel):
    fullName: Optional[str] = None

    currentJobTitle: Optional[str] = None

    totalExperienceYears: Optional[float] = None

    currentLocation: Optional[str] = None

    noticePeriodDays: Optional[int] = None

    educationSummary: Optional[str] = None

    skills: List[str] = []

    cvText: str


class ScreeningRequest(BaseModel):
    job: JobData
    candidate: CandidateData


class EvidenceItem(BaseModel):
    requirement: Optional[str] = None
    candidateEvidence: Optional[str] = None

    similarity: Optional[float] = None

    matched: Optional[bool] = None


class ComponentScore(BaseModel):
    key: str

    label: str

    score: Optional[float] = None

    configuredWeight: float

    contribution: float

    confidence: float

    missingInformation: bool = False

    explanation: str

    evidence: List[EvidenceItem] = []


class ScreeningResponse(BaseModel):
    totalScore: float

    recommendation: str

    confidenceScore: float

    qualifyingScore: float

    components: List[ComponentScore]

    missingInformationCount: int

    modelMetadata: Dict[str, str]