"""
generate_sitemap.py — Firestore 게시물 기반 sitemap.xml 생성

사용법:
  GOOGLE_APPLICATION_CREDENTIALS=serviceAccount.json python generate_sitemap.py
"""
import os
from datetime import datetime, timezone
import firebase_admin
from firebase_admin import credentials, firestore

SITE_URL   = "https://sosoking.co.kr"
OUTPUT     = os.path.join(os.path.dirname(__file__), "../../public/sitemap.xml")
COLLECTION = "feeds"
LIMIT      = 1000

STATIC_PAGES = [
    ("",          "1.0",  "daily"),
    ("/feed",     "0.9",  "daily"),
    ("/mission",  "0.8",  "daily"),
    ("/guide",    "0.5",  "monthly"),
]


def init_firebase():
    if not firebase_admin._apps:
        cred_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
        cred = credentials.Certificate(cred_path) if cred_path else credentials.ApplicationDefault()
        firebase_admin.initialize_app(cred)
    return firestore.client()


def fetch_posts(db):
    col = db.collection(COLLECTION).order_by("createdAt", direction=firestore.Query.DESCENDING).limit(LIMIT)
    return [{"id": doc.id, **doc.to_dict()} for doc in col.stream()]


def ts_to_date(ts) -> str:
    if ts is None:
        return datetime.now(timezone.utc).strftime("%Y-%m-%d")
    try:
        return ts.strftime("%Y-%m-%d")
    except Exception:
        return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def build_sitemap(posts: list) -> str:
    lines = ['<?xml version="1.0" encoding="UTF-8"?>',
             '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']

    for path, priority, changefreq in STATIC_PAGES:
        lines += [
            "  <url>",
            f"    <loc>{SITE_URL}#{path}</loc>",
            f"    <changefreq>{changefreq}</changefreq>",
            f"    <priority>{priority}</priority>",
            "  </url>",
        ]

    for post in posts:
        post_id  = post.get("id", "")
        mod_date = ts_to_date(post.get("createdAt"))
        lines += [
            "  <url>",
            f"    <loc>{SITE_URL}#/detail/{post_id}</loc>",
            f"    <lastmod>{mod_date}</lastmod>",
            "    <changefreq>weekly</changefreq>",
            "    <priority>0.7</priority>",
            "  </url>",
        ]

    lines.append("</urlset>")
    return "\n".join(lines)


def main():
    db    = init_firebase()
    posts = fetch_posts(db)
    xml   = build_sitemap(posts)

    with open(OUTPUT, "w", encoding="utf-8") as f:
        f.write(xml)

    print(f"sitemap.xml 생성 완료: {len(posts)}개 게시물, 경로={OUTPUT}")


if __name__ == "__main__":
    main()
