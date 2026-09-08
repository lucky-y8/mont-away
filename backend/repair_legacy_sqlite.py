"""Repair the pre-Alembic local SQLite schema without deleting user data.

修复 Alembic 接入前由 ORM 自动建表的本地 SQLite 结构，并保留用户数据。
Run this script only after making a copy of ``shanyao.db``.
执行前必须先复制备份 ``shanyao.db``。
"""

from __future__ import annotations

import sqlite3
from pathlib import Path


DATABASE_PATH = Path(__file__).resolve().parent / "shanyao.db"
HEAD_REVISION = "20260907_0010"
REQUIRED_TABLES = {
    "users", "external_identities", "sessions", "oauth_login_codes",
    "places", "posts", "post_versions", "travel_routes", "route_nodes",
    "media_assets", "post_likes", "moderation_actions", "notifications",
    "point_ledger", "post_bookmarks", "post_comments", "post_reports",
    "email_verifications", "password_resets", "account_moderation_actions",
    "user_follows", "gifts", "gift_redemptions",
}


def columns(connection: sqlite3.Connection, table: str) -> dict[str, sqlite3.Row]:
    return {row[1]: row for row in connection.execute(f'PRAGMA table_info("{table}")')}


def add_column(connection: sqlite3.Connection, table: str, name: str, definition: str) -> None:
    if name not in columns(connection, table):
        connection.execute(f'ALTER TABLE "{table}" ADD COLUMN "{name}" {definition}')


def rebuild_media_assets(connection: sqlite3.Connection) -> None:
    old = columns(connection, "media_assets")
    already_current = {"user_id", "content_type", "size_bytes", "created_at"}.issubset(old) and old["post_version_id"][3] == 0
    if already_current:
        return

    backup_table = "media_assets_legacy_backup"
    if backup_table in {row[0] for row in connection.execute("SELECT name FROM sqlite_master WHERE type='table'")}:
        raise RuntimeError(f"{backup_table} already exists; inspect the database before retrying")
    connection.execute("ALTER TABLE media_assets RENAME TO media_assets_legacy_backup")
    connection.execute(
        """
        CREATE TABLE media_assets (
            id VARCHAR(36) NOT NULL PRIMARY KEY,
            user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            post_version_id VARCHAR(36) REFERENCES post_versions(id) ON DELETE CASCADE,
            route_node_id VARCHAR(36) REFERENCES route_nodes(id) ON DELETE CASCADE,
            media_type VARCHAR(10) NOT NULL,
            content_type VARCHAR(100) NOT NULL DEFAULT 'application/octet-stream',
            object_key VARCHAR(512) NOT NULL,
            position INTEGER NOT NULL,
            size_bytes INTEGER NOT NULL DEFAULT 0,
            created_at DATETIME
        )
        """
    )
    user_expression = "m.user_id" if "user_id" in old else "(SELECT p.author_id FROM post_versions v JOIN posts p ON p.id = v.post_id WHERE v.id = m.post_version_id)"
    content_expression = "m.content_type" if "content_type" in old else "'application/octet-stream'"
    size_expression = "m.size_bytes" if "size_bytes" in old else "0"
    created_expression = "m.created_at" if "created_at" in old else "CURRENT_TIMESTAMP"
    connection.execute(
        f"""INSERT INTO media_assets
        (id, user_id, post_version_id, route_node_id, media_type, content_type, object_key, position, size_bytes, created_at)
        SELECT m.id, {user_expression}, m.post_version_id, m.route_node_id, m.media_type,
               {content_expression}, m.object_key, m.position, {size_expression}, {created_expression}
        FROM media_assets_legacy_backup AS m"""
    )
    connection.execute("CREATE INDEX IF NOT EXISTS ix_media_assets_user_id ON media_assets(user_id)")
    connection.execute("CREATE INDEX IF NOT EXISTS ix_media_assets_post_version_id ON media_assets(post_version_id)")
    connection.execute("CREATE INDEX IF NOT EXISTS ix_media_assets_route_node_id ON media_assets(route_node_id)")


def repair() -> None:
    connection = sqlite3.connect(DATABASE_PATH)
    try:
        connection.execute("PRAGMA foreign_keys=OFF")
        existing = {row[0] for row in connection.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        missing = REQUIRED_TABLES - existing
        if missing:
            raise RuntimeError(f"Legacy repair refused; missing tables: {sorted(missing)}")

        versions = [row[0] for row in connection.execute("SELECT version_num FROM alembic_version")]
        if versions:
            raise RuntimeError(f"Database already has an Alembic revision: {versions}")

        connection.execute("BEGIN IMMEDIATE")
        add_column(connection, "users", "is_admin", "BOOLEAN NOT NULL DEFAULT 0")
        add_column(connection, "users", "is_banned", "BOOLEAN NOT NULL DEFAULT 0")
        add_column(connection, "users", "banned_until", "DATETIME")
        add_column(connection, "users", "ban_reason", "TEXT NOT NULL DEFAULT ''")
        rebuild_media_assets(connection)

        redemption_columns = columns(connection, "gift_redemptions")
        if "contact" in redemption_columns and "phone" not in redemption_columns:
            connection.execute("ALTER TABLE gift_redemptions RENAME COLUMN contact TO phone")
        connection.execute(
            "UPDATE gifts SET point_cost = CASE WHEN point_cost <= 20 THEN 20 WHEN point_cost <= 40 THEN 40 WHEN point_cost <= 60 THEN 60 WHEN point_cost <= 80 THEN 80 ELSE 100 END"
        )
        connection.execute("DELETE FROM alembic_version")
        connection.execute("INSERT INTO alembic_version(version_num) VALUES (?)", (HEAD_REVISION,))
        connection.commit()
        print(f"Repaired {DATABASE_PATH} and stamped {HEAD_REVISION}.")
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.execute("PRAGMA foreign_keys=ON")
        connection.close()


if __name__ == "__main__":
    repair()
