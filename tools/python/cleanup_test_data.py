"""
cleanup_test_data.py — 테스트/가상 데이터 정리

사용법:
  python cleanup_test_data.py --dry-run          (삭제 대상 확인만)
  python cleanup_test_data.py --collection feeds  (실제 삭제)
"""
import argparse

TEST_AUTHOR_NAMES = ["테스트", "test", "Test", "가상유저", "dummy", "seed"]
TEST_TITLE_KEYWORDS = ["테스트", "test", "[seed]", "[dummy]"]


def is_test_post(post: dict) -> bool:
    author = str(post.get("authorName", "")).lower()
    title  = str(post.get("title", "")).lower()

    if any(k.lower() in author for k in TEST_AUTHOR_NAMES):
        return True
    if any(k.lower() in title for k in TEST_TITLE_KEYWORDS):
        return True
    return False


def cleanup(db, collection: str, dry_run: bool):
    docs = list(db.collection(collection).stream())
    to_delete = [d for d in docs if is_test_post({"id": d.id, **d.to_dict()})]

    print(f"전체 {len(docs)}개 중 테스트 데이터 {len(to_delete)}개 발견")

    for d in to_delete:
        data = d.to_dict()
        print(f"  {'[DRY]' if dry_run else '[DEL]'} {d.id} — {data.get('title','')[:40]}")
        if not dry_run:
            d.reference.delete()

    if dry_run:
        print("(dry-run 모드: 실제 삭제 없음)")
    else:
        print(f"{len(to_delete)}개 삭제 완료")


def main():
    import firebase_admin
    from firebase_admin import credentials, firestore
    import os

    parser = argparse.ArgumentParser()
    parser.add_argument("--collection", default="feeds")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    if not firebase_admin._apps:
        cred_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
        cred = credentials.Certificate(cred_path) if cred_path else credentials.ApplicationDefault()
        firebase_admin.initialize_app(cred)

    db = firestore.client()
    cleanup(db, args.collection, args.dry_run)


if __name__ == "__main__":
    main()
