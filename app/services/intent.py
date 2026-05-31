import re
from enum import StrEnum


class Intent(StrEnum):
    DSA = "dsa"
    CORE = "core_subject"
    RESUME = "resume"
    INTERVIEW = "interview"
    GENERAL = "general"


DSA_PATTERNS = (
    r"\b(dsa|data structure|algorithm|leetcode|codeforces|hackerrank)\b",
    r"\b(array|string|linked list|tree|graph|heap|stack|queue|trie|dp|dynamic programming)\b",
    r"\b(binary search|two pointer|sliding window|recursion|backtracking|sorting)\b",
    r"\b(time complexity|space complexity|dry run|optimized solution)\b",
    r"\b(solve|write code|coding problem|program)\b.*\b(python|java|c\+\+|javascript)\b",
)

CORE_PATTERNS = (
    r"\b(cn|computer networks|networking|tcp|udp|ip|osi|http|dns|routing|subnet)\b",
    r"\b(os|operating system|process|thread|deadlock|scheduling|paging|segmentation|memory management)\b",
    r"\b(dbms|database|sql|normalization|transaction|acid|indexing|joins|rdbms)\b",
)

RESUME_PATTERNS = (
    r"\b(resume|cv|ats|portfolio|job profile|shortlist|recruiter)\b",
)

INTERVIEW_PATTERNS = (
    r"\b(interview|mock interview|ask me questions|practice questions|viva)\b",
)


def _matches(message: str, patterns: tuple[str, ...]) -> bool:
    return any(re.search(pattern, message, flags=re.IGNORECASE) for pattern in patterns)


def detect_intent(message: str) -> Intent:
    clean_message = message.strip()
    if _matches(clean_message, INTERVIEW_PATTERNS):
        return Intent.INTERVIEW
    if _matches(clean_message, RESUME_PATTERNS):
        return Intent.RESUME
    if _matches(clean_message, DSA_PATTERNS):
        return Intent.DSA
    if _matches(clean_message, CORE_PATTERNS):
        return Intent.CORE
    return Intent.GENERAL
