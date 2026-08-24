import os
import sqlite3
import sys
from contextlib import contextmanager
from pathlib import Path
from unicodedata import combining, normalize


if getattr(sys, 'frozen', False):
    DATABASE_PATH = Path(os.environ.get('APPDATA', Path.home())) / 'LiBok' / 'libok.db'
else:
    DATABASE_PATH = Path(__file__).with_name('libok.db')


@contextmanager
def get_connection():
    DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    try:
        yield connection
    except Exception:
        connection.rollback()
        raise
    else:
        connection.commit()
    finally:
        connection.close()


def initialize_database():
    with get_connection() as connection:
        connection.execute(
            '''
            CREATE TABLE IF NOT EXISTS books (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                author TEXT NOT NULL,
                category TEXT NOT NULL,
                subject TEXT NOT NULL,
                quantity INTEGER NOT NULL,
                registration_codes TEXT NOT NULL
            )
            '''
        )


def create_book(name, author, category, subject, quantity, registration_codes):
    with get_connection() as connection:
        normalized_name = normalize_search_text(name)
        existing_names = connection.execute(
            'SELECT name FROM books'
        ).fetchall()
        if any(normalized_name == normalize_search_text(row['name']) for row in existing_names):
            return False

        connection.execute(
            '''
            INSERT INTO books
                (name, author, category, subject, quantity, registration_codes)
            VALUES (?, ?, ?, ?, ?, ?)
            ''',
            (name, author, category, subject, quantity, '\n'.join(registration_codes))
        )
    return True


def create_books_bulk(books):
    imported = 0
    skipped = 0

    with get_connection() as connection:
        existing_names = {
            normalize_search_text(row['name'])
            for row in connection.execute('SELECT name FROM books')
        }
        for name, author, category, subject, quantity, registration_codes in books:
            normalized_name = normalize_search_text(name)
            if normalized_name in existing_names:
                skipped += 1
                continue

            connection.execute(
                '''
                INSERT INTO books
                    (name, author, category, subject, quantity, registration_codes)
                VALUES (?, ?, ?, ?, ?, ?)
                ''',
                (name, author, category, subject, quantity, '\n'.join(registration_codes))
            )
            existing_names.add(normalized_name)
            imported += 1

    return imported, skipped


def list_books(search_text=''):
    with get_connection() as connection:
        books = connection.execute(
            'SELECT * FROM books ORDER BY id DESC'
        ).fetchall()

    search_value = normalize_search_text(search_text)
    if not search_value:
        return books

    return [
        book for book in books
        if any(
            search_value in normalize_search_text(book[field])
            for field in (
                'name',
                'author',
                'category',
                'subject',
                'registration_codes'
            )
        )
    ]


def normalize_search_text(value):
    normalized_value = normalize('NFKD', str(value).casefold().strip())
    return ''.join(
        character for character in normalized_value
        if not combining(character)
    )


def get_category_totals():
    with get_connection() as connection:
        rows = connection.execute(
            '''
            SELECT category, SUM(quantity) AS total
            FROM books
            GROUP BY category
            ORDER BY total DESC, category ASC
            '''
        ).fetchall()
        return [(row['category'], row['total']) for row in rows]


def update_book(book_id, name, author, category, subject, quantity, registration_codes):
    with get_connection() as connection:
        connection.execute(
            '''
            UPDATE books
            SET name = ?, author = ?, category = ?, subject = ?,
                quantity = ?, registration_codes = ?
            WHERE id = ?
            ''',
            (name, author, category, subject, quantity, '\n'.join(registration_codes), book_id)
        )


def delete_book(book_id):
    with get_connection() as connection:
        connection.execute('DELETE FROM books WHERE id = ?', (book_id,))
