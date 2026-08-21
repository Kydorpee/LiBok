import sqlite3
from pathlib import Path


DATABASE_PATH = Path(__file__).with_name('libok.db')


def get_connection():
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    return connection


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
        connection.execute(
            '''
            INSERT INTO books
                (name, author, category, subject, quantity, registration_codes)
            VALUES (?, ?, ?, ?, ?, ?)
            ''',
            (name, author, category, subject, quantity, '\n'.join(registration_codes))
        )


def list_books(search_text=''):
    with get_connection() as connection:
        return connection.execute(
            '''
            SELECT * FROM books
            WHERE name LIKE ?
               OR author LIKE ?
               OR category LIKE ?
               OR subject LIKE ?
               OR registration_codes LIKE ?
            ORDER BY id DESC
            ''',
            tuple(f'%{search_text}%' for _ in range(5))
        ).fetchall()


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
