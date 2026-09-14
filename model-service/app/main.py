from fastapi import (
    FastAPI,
    HTTPException,
)

from fastapi.middleware.cors import (
    CORSMiddleware,
)

from app.schemas import (
    ScreeningRequest,
    ScreeningResponse,
)

from app.scoring import (
    calculate_screening,
)


app = FastAPI(
    title=(
        "Excel HR CV "
        "Screening Service"
    ),
    version="1.0.0",
)


app.add_middleware(
    CORSMiddleware,

    allow_origins=[
        "http://localhost:3000",
    ],

    allow_credentials=True,

    allow_methods=[
        "*",
    ],

    allow_headers=[
        "*",
    ],
)


@app.get("/health")
def health():
    return {
        "status": "ok",

        "service":
            "excel-hr-cv-screening",

        "version":
            "1.0.0",
    }


@app.post(
    "/screen",
    response_model=
        ScreeningResponse,
)
def screen_candidate(
    request:
        ScreeningRequest,
):
    try:
        return (
            calculate_screening(
                request.job,
                request.candidate,
            )
        )

    except Exception as error:
        print(
            "SCREENING ERROR:",
            error,
        )

        raise HTTPException(
            status_code=500,

            detail=(
                "Unable to screen "
                "candidate."
            ),
        )