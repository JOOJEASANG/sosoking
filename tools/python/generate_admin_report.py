"""
generate_admin_report.py — 관리자용 주간 리포트 생성

사용법:
  python generate_admin_report.py
  python generate_admin_report.py --days 7 --output weekly_report.json
"""
import argparse
import json
from collections import Counter
from datetime import datetime, timedelta, timezone

TYPES = {
    "balance":"밸런스게임","vote":"민심투표","battle":"선택지배틀",
    "ox":"OX퀴즈","quiz":"내맘대로퀴즈","naming":"미친작명소",
    "acrostic":"삼행시짓기","cbattle":"댓글배틀","laugh":"웃참챌린지",
    "drip":"한줄드립","howto":"나만의노하우","story":"경험담",
    "fail":"실패담","concern":"고민/질문","relay":"막장릴레이",
}


def get_ts(post, key="createdAt"):
    ts = post.get(key)
    if ts is None:
        return None
    if hasattr(ts, "isoformat"):
        return ts.replace(tzinfo=timezone.utc) if ts.tzinfo is None else ts
    if hasattr(ts, "_seconds"):
        return datetime.fromtimestamp(ts.seconds, tz=timezone.utc)
    return None


def main():
    import firebase_admin
    from firebase_admin import credentials, firestore
    import os

    parser = argparse.ArgumentParser()
    parser.add_argument("--days",   type=int, default=7)
    parser.add_argument("--output", default="admin_report.json")
    args = parser.parse_args()

    if not firebase_admin._apps:
        cred_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
        cred = credentials.Certificate(cred_path) if cred_path else credentials.ApplicationDefault()
        firebase_admin.initialize_app(cred)

    db    = firestore.client()
    now   = datetime.now(timezone.utc)
    since = now - timedelta(days=args.days)

    all_posts = [{"id": d.id, **d.to_dict()} for d in db.collection("feeds").stream()]
    recent    = [p for p in all_posts if (get_ts(p) or datetime.min.replace(tzinfo=timezone.utc)) >= since]

    type_counter = Counter(p.get("type") for p in recent)
    new_by_day: dict[str, int] = Counter()
    for p in recent:
        ts = get_ts(p)
        if ts:
            new_by_day[ts.strftime("%Y-%m-%d")] += 1

    top_posts = sorted(recent, key=lambda p: p.get("reactions", {}).get("total", 0), reverse=True)[:5]

    report = {
        "period":       f"{since.strftime('%Y-%m-%d')} ~ {now.strftime('%Y-%m-%d')}",
        "totalPosts":   len(all_posts),
        "newPosts":     len(recent),
        "byType":       {TYPES.get(k, k): v for k, v in type_counter.most_common()},
        "newByDay":     dict(sorted(new_by_day.items())),
        "topPosts":     [
            {"id": p["id"], "title": p.get("title",""), "reactions": p.get("reactions",{}).get("total",0)}
            for p in top_posts
        ],
        "generatedAt":  now.isoformat(),
    }

    print("=" * 50)
    print(f"관리자 리포트 ({report['period']})")
    print("=" * 50)
    print(f"총 게시물: {report['totalPosts']}  /  기간 내 신규: {report['newPosts']}")
    print("\n[ 유형별 신규 ]")
    for k, v in list(report["byType"].items())[:8]:
        print(f"  {k}: {v}")
    print("\n[ 일별 신규 ]")
    for day, cnt in report["newByDay"].items():
        print(f"  {day}: {cnt}개")
    print("=" * 50)

    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"리포트 저장: {args.output}")


if __name__ == "__main__":
    main()
