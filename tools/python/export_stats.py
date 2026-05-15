"""
export_stats.py — 사이트 통계 리포트 생성 (JSON + 텍스트)

사용법:
  python export_stats.py
  python export_stats.py --output report.json
"""
import argparse
import json
from collections import Counter
from datetime import datetime, timezone

CATEGORIES = {"golra": "골라봐", "usgyo": "웃겨봐", "malhe": "말해봐"}
TYPES = {
    "balance":"밸런스게임","vote":"민심투표","battle":"선택지배틀",
    "ox":"OX퀴즈","quiz":"내맘대로퀴즈","naming":"미친작명소",
    "acrostic":"삼행시짓기","cbattle":"댓글배틀","laugh":"웃참챌린지",
    "drip":"한줄드립","howto":"나만의노하우","story":"경험담",
    "fail":"실패담","concern":"고민/질문","relay":"막장릴레이",
}


def fetch_all_feeds(db):
    return [{"id": d.id, **d.to_dict()} for d in db.collection("feeds").stream()]


def build_report(posts: list) -> dict:
    now   = datetime.now(timezone.utc)
    total = len(posts)

    cat_counter  = Counter(p.get("cat", "unknown")  for p in posts)
    type_counter = Counter(p.get("type", "unknown") for p in posts)

    top_reactions = sorted(
        posts,
        key=lambda p: p.get("reactions", {}).get("total", 0),
        reverse=True,
    )[:10]

    top_comments = sorted(
        posts,
        key=lambda p: p.get("commentCount", 0),
        reverse=True,
    )[:10]

    return {
        "generatedAt":  now.isoformat(),
        "totalPosts":   total,
        "byCategory":   {CATEGORIES.get(k, k): v for k, v in cat_counter.most_common()},
        "byType":       {TYPES.get(k, k): v for k, v in type_counter.most_common()},
        "topByReaction": [
            {"id": p["id"], "title": p.get("title", ""), "reactions": p.get("reactions", {}).get("total", 0)}
            for p in top_reactions
        ],
        "topByComment": [
            {"id": p["id"], "title": p.get("title", ""), "comments": p.get("commentCount", 0)}
            for p in top_comments
        ],
    }


def print_report(report: dict):
    print("=" * 50)
    print(f"소소킹 통계 리포트  ({report['generatedAt'][:10]})")
    print("=" * 50)
    print(f"총 게시물: {report['totalPosts']}개")
    print("\n[ 카테고리별 ]")
    for k, v in report["byCategory"].items():
        print(f"  {k}: {v}개")
    print("\n[ 유형별 상위 5 ]")
    for k, v in list(report["byType"].items())[:5]:
        print(f"  {k}: {v}개")
    print("\n[ 반응 많은 글 Top 5 ]")
    for i, p in enumerate(report["topByReaction"][:5], 1):
        print(f"  {i}. {p['title'][:30]} (❤️ {p['reactions']})")
    print("=" * 50)


def main():
    import firebase_admin
    from firebase_admin import credentials, firestore
    import os

    parser = argparse.ArgumentParser()
    parser.add_argument("--output", default="stats_report.json")
    args = parser.parse_args()

    if not firebase_admin._apps:
        cred_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
        cred = credentials.Certificate(cred_path) if cred_path else credentials.ApplicationDefault()
        firebase_admin.initialize_app(cred)

    db     = firestore.client()
    posts  = fetch_all_feeds(db)
    report = build_report(posts)

    print_report(report)

    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\nJSON 저장: {args.output}")


if __name__ == "__main__":
    main()
