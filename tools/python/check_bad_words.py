"""
check_bad_words.py — 금칙어/스팸 게시물 검사 보조 도구

사용법:
  python check_bad_words.py
  python check_bad_words.py --output flagged.json
"""
import argparse
import json
from datetime import datetime, timezone

# 기본 금칙어 목록 (운영 시 확장)
BAD_WORDS = [
    "욕설1", "스팸키워드", "광고",
]

SPAM_PATTERNS = [
    "http://", "https://bit.ly", "클릭하세요", "무료분양",
]


def check_post(post: dict) -> list[str]:
    """위반 이유 목록 반환 (빈 리스트 = 정상)"""
    reasons = []
    text = " ".join([
        str(post.get("title", "")),
        str(post.get("desc", "")),
    ]).lower()

    for w in BAD_WORDS:
        if w.lower() in text:
            reasons.append(f"금칙어: {w}")

    for p in SPAM_PATTERNS:
        if p.lower() in text:
            reasons.append(f"스팸패턴: {p}")

    return reasons


def scan(db) -> list[dict]:
    flagged = []
    for d in db.collection("feeds").stream():
        post = {"id": d.id, **d.to_dict()}
        reasons = check_post(post)
        if reasons:
            flagged.append({
                "id":       post["id"],
                "title":    post.get("title", ""),
                "author":   post.get("authorName", ""),
                "reasons":  reasons,
            })
    return flagged


def main():
    import firebase_admin
    from firebase_admin import credentials, firestore
    import os

    parser = argparse.ArgumentParser()
    parser.add_argument("--output", default="")
    args = parser.parse_args()

    if not firebase_admin._apps:
        cred_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
        cred = credentials.Certificate(cred_path) if cred_path else credentials.ApplicationDefault()
        firebase_admin.initialize_app(cred)

    db      = firestore.client()
    flagged = scan(db)

    print(f"검사 완료: {len(flagged)}개 플래그됨")
    for item in flagged:
        print(f"  [{item['id']}] {item['title'][:30]} — {', '.join(item['reasons'])}")

    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump({"generatedAt": datetime.now(timezone.utc).isoformat(), "flagged": flagged},
                      f, ensure_ascii=False, indent=2)
        print(f"결과 저장: {args.output}")


if __name__ == "__main__":
    main()
