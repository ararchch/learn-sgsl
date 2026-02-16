# scripts/fs_clean.py
def normalize_annotation(s: str) -> str:
    """
    Normalize a label: lowercase, keep A-Z + space.
    """
    s = (s or "").strip().lower()
    allowed = set("abcdefghijklmnopqrstuvwxyz ")
    return "".join(ch for ch in s if ch in allowed)
