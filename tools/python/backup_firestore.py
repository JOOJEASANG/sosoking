"""
backup_firestore.py — Firestore 주요 컬렉션 JSON 백업

사용법:
  python backup_firestore.py
  python backup_firestore.py --collections feeds,missions,users
  python backup_firestore.py --output-dir ./backups
"""
import argparse
import json
import os
from datetime import datetime, timezone


def to_serializable(val):
    """Firestore 타입 → JSON 직렬화 가능 타입 변환"""
    if hasattr(val, "isoformat"):  # datetime
        return val.isoformat()
    if hasattr(val, "_seconds"):   # Firestore Timestamp
        return datetime.fromtimestamp(val.seconds, tz=timezone.utc).isoformat()
    if isinstance(val, dict):
        return {k: to_serializable(v) for k, v in val.items()}
    if isinstance(val, list):
        return [to_serializable(v) for v in val]
    return val


def backup_collection(db, col_name: str, output_dir: str):
    docs = []
    for d in db.collection(col_name).stream():
        data = to_serializable(d.to_dict())
        docs.append({"id": d.id, **data})

    date_str  = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    filename  = os.path.join(output_dir, f"{col_name}_{date_str}.json")
    with open(filename, "w", encoding="utf-8") as f:
        json.dump(docs, f, ensure_ascii=False, indent=2)

    print(f"  백업 완료: {col_name} ({len(docs)}개) → {filename}")
    return len(docs)


def main():
    import firebase_admin
    from firebase_admin import credentials, firestore

    parser = argparse.ArgumentParser()
    parser.add_argument("--collections", default="feeds,missions,users")
    parser.add_argument("--output-dir",  default="./backups")
    args = parser.parse_args()

    os.makedirs(args.output_dir, exist_ok=True)

    if not firebase_admin._apps:
        cred_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
        cred = credentials.Certificate(cred_path) if cred_path else credentials.ApplicationDefault()
        firebase_admin.initialize_app(cred)

    db = firestore.client()
    collections = [c.strip() for c in args.collections.split(",")]

    total = 0
    for col in collections:
        total += backup_collection(db, col, args.output_dir)

    print(f"\n백업 완료: {len(collections)}개 컬렉션, 총 {total}개 문서")


if __name__ == "__main__":
    main()
