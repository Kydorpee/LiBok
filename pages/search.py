import customtkinter as ctk
import database.database as database
from tkinter import messagebox
from pathlib import Path


def show_page(parent):
    database.initialize_database()
    page = ctk.CTkFrame(parent, fg_color='#8284BD', corner_radius=20)
    page.pack(fill='both', expand=True)
    page.grid_columnconfigure(0, weight=1)
    page.grid_rowconfigure(2, weight=1)

    ctk.CTkLabel(
        page,
        text='Livros cadastrados',
        text_color='#000000',
        font=('Inter', 26, 'bold')
    ).grid(row=0, column=0, pady=(28, 12))

    search_entry = ctk.CTkEntry(
        page,
        placeholder_text='Filtrar por nome, autor, categoria, assunto ou codigo',
        height=42,
        corner_radius=12,
        fg_color='white',
        text_color='#000000',
        placeholder_text_color='#666666',
        font=('Inter', 14)
    )
    search_entry.grid(row=1, column=0, padx=40, pady=(0, 16), sticky='ew')

    results = ctk.CTkScrollableFrame(page, fg_color='#F1F1F4', corner_radius=18)
    results.grid(row=2, column=0, padx=40, pady=(0, 28), sticky='nsew')
    results.grid_columnconfigure(0, weight=1)

    def refresh_results(event=None):
        for widget in results.winfo_children():
            widget.destroy()
        books = database.list_books(search_entry.get().strip())
        if not books:
            ctk.CTkLabel(
                results,
                text='Nenhum livro encontrado para essa pesquisa.',
                text_color='#000000',
                font=('Inter', 16, 'bold')
            ).grid(row=0, column=0, pady=30)
            return

        for row, book in enumerate(books):
            book_card = ctk.CTkFrame(results, fg_color='white', corner_radius=16)
            book_card.grid(row=row, column=0, padx=8, pady=6, sticky='ew')
            book_card.grid_columnconfigure(0, weight=1)

            codes = book['registration_codes'].replace('\n', ', ')
            book_text = (
                f"{book['name']}\n"
                f"Autor: {book['author']} | Categoria: {book['category']} | "
                f"Assunto: {book['subject']} | Quantidade: {book['quantity']}\n"
                f"Codigos: {codes}"
            )
            ctk.CTkLabel(
                book_card,
                text=book_text,
                text_color='#000000',
                font=('Inter', 14),
                justify='left',
                anchor='w'
            ).grid(row=0, column=0, padx=16, pady=12, sticky='ew')
            ctk.CTkButton(
                book_card,
                text='Editar',
                width=90,
                height=36,
                corner_radius=10,
                fg_color='#7E7F9A',
                hover_color='#EB9486',
                font=('Inter', 13, 'bold'),
                command=lambda selected_book=book: open_edit_window(selected_book, refresh_results)
            ).grid(row=0, column=1, padx=16, pady=12)
            ctk.CTkButton(
                book_card,
                text='Excluir',
                width=90,
                height=36,
                corner_radius=10,
                fg_color='#B5443A',
                hover_color='#8F3028',
                font=('Inter', 13, 'bold'),
                command=lambda selected_book=book: delete_selected_book(selected_book, refresh_results)
            ).grid(row=0, column=2, padx=(0, 16), pady=12)
            
    search_entry.bind('<KeyRelease>', refresh_results)
    refresh_results()


def delete_selected_book(book, refresh_results):
    confirmed = messagebox.askyesno(
        'Excluir livro',
        f"Deseja excluir o livro '{book['name']}'?"
    )
    if confirmed:
        database.delete_book(book['id'])
        refresh_results()


def open_edit_window(book, refresh_results):
    window = ctk.CTkToplevel()
    window.title('Editar livro')
    window.geometry('720x780')
    window.minsize(640, 700)
    window.iconbitmap(str(Path(__file__).parent.parent / 'img' / 'icon.ico'))
    window.configure(fg_color='#8284BD')
    window.grab_set()

    form = ctk.CTkFrame(window, fg_color='white', corner_radius=18)
    form.pack(fill='both', expand=True, padx=24, pady=24)
    form.grid_columnconfigure(0, weight=1)

    fields = [
        ('Nome do livro', book['name']),
        ('Autor', book['author']),
        ('Categoria', book['category']),
        ('Assunto', book['subject']),
        ('Quantidade', str(book['quantity']))
    ]
    entries = {}

    for row, (label_text, value) in enumerate(fields):
        ctk.CTkLabel(
            form,
            text=label_text,
            text_color='#85868F',
            font=('Inter', 13, 'bold'),
            anchor='w'
        ).grid(row=row * 2, column=0, padx=20, pady=(14 if row == 0 else 4, 4), sticky='w')
        entry = ctk.CTkEntry(
            form,
            height=38,
            corner_radius=10,
            fg_color='white',
            text_color='#2D3047'
        )
        entry.insert(0, value)
        entry.grid(row=row * 2 + 1, column=0, padx=20, sticky='ew')
        entries[label_text] = entry

    ctk.CTkLabel(
        form,
        text='Codigos de registro (um por linha)',
        text_color='#85868F',
        font=('Inter', 13, 'bold'),
        anchor='w'
    ).grid(row=10, column=0, padx=20, pady=(12, 4), sticky='w')

    codes_box = ctk.CTkTextbox(
        form,
        height=90,
        corner_radius=10,
        fg_color='white',
        text_color='#2D3047'
    )
    codes_box.insert('1.0', book['registration_codes'])
    codes_box.grid(row=11, column=0, padx=20, sticky='ew')

    status = ctk.CTkLabel(form, text='', text_color='#2D3047')
    status.grid(row=12, column=0, pady=8)

    def save_changes():
        values = {name: entry.get().strip() for name, entry in entries.items()}
        codes = [code.strip() for code in codes_box.get('1.0', 'end-1c').splitlines() if code.strip()]
        try:
            quantity = int(values['Quantidade'])
        except ValueError:
            status.configure(text='Quantidade invalida.', text_color='#B5443A')
            return
        if not all(values[name] for name in ('Nome do livro', 'Autor', 'Categoria', 'Assunto')):
            status.configure(text='Preencha todos os campos.', text_color='#B5443A')
            return
        if quantity <= 0 or len(codes) != quantity:
            status.configure(text='A quantidade deve corresponder aos codigos.', text_color='#B5443A')
            return

        database.update_book(
            book['id'],
            values['Nome do livro'],
            values['Autor'],
            values['Categoria'],
            values['Assunto'],
            quantity,
            codes
        )
        window.destroy()
        refresh_results()

    ctk.CTkButton(
        form,
        text='Salvar alteracoes',
        height=40,
        corner_radius=10,
        fg_color='#7E7F9A',
        hover_color='#EB9486',
        command=save_changes
    ).grid(row=13, column=0, padx=20, pady=(4, 18), sticky='ew')
