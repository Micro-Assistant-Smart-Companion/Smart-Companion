from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity

_model = SentenceTransformer("all-MiniLM-L6-v2")  # small, fast, free, local


def find_relevant_pages(query: str, page_texts: list, top_k: int = 3) -> list:
    """Returns indices of the top_k pages most semantically similar to the
    query. Pages that are None (not yet read) are skipped."""
    candidates = [(i, t) for i, t in enumerate(page_texts) if t]
    if not candidates:
        return []

    indices, texts = zip(*candidates)
    query_vec = _model.encode([query])
    page_vecs = _model.encode(list(texts))

    scores = cosine_similarity(query_vec, page_vecs)[0]
    ranked = sorted(zip(indices, scores), key=lambda x: x[1], reverse=True)
    return [i for i, _ in ranked[:top_k]]