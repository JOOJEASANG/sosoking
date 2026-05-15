"""
generate_daily_missions.py — 오늘의 미션 자동 생성 (Firestore에 업로드)

사용법:
  python generate_daily_missions.py
  python generate_daily_missions.py --dry-run   (Firestore 미업로드, 내용만 출력)
"""
import argparse
import random
from datetime import datetime, timezone

MISSION_POOL = [
    # 골라봐
    {"type": "balance",  "title": "평생 하나만 먹어야 한다면? 라면 vs 치킨"},
    {"type": "balance",  "title": "무인도에서 딱 한 명 데려갈 수 있다면?"},
    {"type": "vote",     "title": "카톡 답장 3시간 뒤면 서운하다?"},
    {"type": "ox",       "title": "물은 마실수록 살이 빠진다? OX"},
    {"type": "quiz",     "title": "이 사진에서 제일 어색한 것은?"},
    # 웃겨봐
    {"type": "naming",   "title": "이 사진 제목 뭐가 제일 웃김?"},
    {"type": "acrostic", "title": "소소킹으로 삼행시 지어봐!"},
    {"type": "cbattle",  "title": "상사한테 가장 킹받는 말은?"},
    {"type": "drip",     "title": "월요일 아침을 한 줄로 표현한다면?"},
    {"type": "laugh",    "title": "이 상황에서 웃참할 수 있어?"},
    # 말해봐
    {"type": "howto",    "title": "나만의 꿀잠 자는 방법"},
    {"type": "story",    "title": "생애 최고로 당황했던 순간"},
    {"type": "fail",     "title": "내 최대 실패담 + 그래서 알게 된 것"},
    {"type": "concern",  "title": "이직할까요, 버텨야 할까요?"},
    {"type": "relay",    "title": "막장 드라마를 함께 써봅시다"},
]


def pick_missions(n=3) -> list:
    return random.sample(MISSION_POOL, min(n, len(MISSION_POOL)))


def upload_missions(missions: list):
    import firebase_admin
    from firebase_admin import credentials, firestore
    import os

    if not firebase_admin._apps:
        cred_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
        cred = credentials.Certificate(cred_path) if cred_path else credentials.ApplicationDefault()
        firebase_admin.initialize_app(cred)

    db = firestore.client()
    now = datetime.now(timezone.utc)
    date_str = now.strftime("%Y-%m-%d")

    for m in missions:
        db.collection("missions").add({
            **m,
            "date":      date_str,
            "createdAt": now,
            "active":    True,
        })
        print(f"  업로드: [{m['type']}] {m['title']}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--count",   type=int, default=3)
    args = parser.parse_args()

    missions = pick_missions(args.count)

    print(f"오늘의 미션 {len(missions)}개 선정:")
    for m in missions:
        print(f"  [{m['type']}] {m['title']}")

    if args.dry_run:
        print("(dry-run 모드: Firestore 미업로드)")
    else:
        upload_missions(missions)
        print("Firestore 업로드 완료!")


if __name__ == "__main__":
    main()
