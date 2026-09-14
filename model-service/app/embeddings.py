from functools import lru_cache
from typing import List

import numpy as np

from sentence_transformers import SentenceTransformer


MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"


@lru_cache(maxsize=1)
def get_embedding_model():
    return SentenceTransformer(
        MODEL_NAME
    )


def encode_texts(
    texts: List[str],
):
    model = get_embedding_model()

    return model.encode(
        texts,
        normalize_embeddings=True,
        convert_to_numpy=True,
    )


def cosine_similarity(
    text_a: str,
    text_b: str,
) -> float:
    if not text_a.strip():
        return 0.0

    if not text_b.strip():
        return 0.0

    vectors = encode_texts(
        [
            text_a,
            text_b,
        ]
    )

    score = float(
        np.dot(
            vectors[0],
            vectors[1],
        )
    )

    return max(
        0.0,
        min(
            1.0,
            score,
        ),
    )


def best_semantic_match(
    requirement: str,
    evidence_items: List[str],
):
    clean_items = [
        item.strip()
        for item in evidence_items
        if item.strip()
    ]

    if not clean_items:
        return None, 0.0

    model = get_embedding_model()

    requirement_vector = model.encode(
        [requirement],
        normalize_embeddings=True,
        convert_to_numpy=True,
    )[0]

    evidence_vectors = model.encode(
        clean_items,
        normalize_embeddings=True,
        convert_to_numpy=True,
    )

    scores = np.dot(
        evidence_vectors,
        requirement_vector,
    )

    best_index = int(
        np.argmax(scores)
    )

    best_score = float(
        scores[best_index]
    )

    return (
        clean_items[
            best_index
        ],
        max(
            0.0,
            min(
                1.0,
                best_score,
            ),
        ),
    )