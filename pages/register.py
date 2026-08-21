import customtkinter as ctk
import database.database as database


def show_page(parent):
	database.initialize_database()
	page = ctk.CTkFrame(parent, fg_color='#F3D38A', corner_radius=20)
	page.pack(fill='both', expand=True)
	page.grid_columnconfigure(0, weight=1)
	page.grid_rowconfigure(1, weight=1)

	ctk.CTkLabel(
		page,
		text='Cadastro de livro',
		text_color='#2D3047',
		font=('Inter', 26, 'bold')
	).grid(row=0, column=0, pady=(32, 16))

	form = ctk.CTkFrame(page, fg_color="#E7DAD8", corner_radius=18)
	form.grid(row=1, column=0, padx=40, pady=(0, 32), sticky='nsew')
	form.grid_columnconfigure((0, 1), weight=1)

	fields = [
		('Nome do livro', 'Digite o nome do livro'),
		('Autor', 'Digite o nome do autor'),
		('Categoria', 'Ex.: Romance, Ficcao, Historia'),
		('Assunto', 'Digite o assunto principal'),
		('Quantidade', 'Digite a quantidade')
	]
	entries = {}

	for index, (label_text, placeholder) in enumerate(fields):
		row = index // 2
		column = index % 2
		field = ctk.CTkFrame(form, fg_color='transparent')
		field.grid(row=row, column=column, padx=20, pady=(24 if row == 0 else 8, 8), sticky='ew')
		field.grid_columnconfigure(0, weight=1)

		ctk.CTkLabel(
			field,
			text=label_text,
			text_color="#85868F",
			font=('Inter', 14, 'bold'),
			anchor='w'
		).grid(row=0, column=0, sticky='w', pady=(0, 6))

		entry = ctk.CTkEntry(
			field,
			placeholder_text=placeholder,
			height=42,
			corner_radius=12
		)
		entry.grid(row=1, column=0, sticky='ew')
		entries[label_text] = entry

	code_frame = ctk.CTkFrame(form, fg_color='transparent')
	code_frame.grid(row=3, column=0, columnspan=2, padx=20, pady=(12, 4), sticky='ew')
	code_frame.grid_columnconfigure(0, weight=1)

	ctk.CTkLabel(
		code_frame,
		text='Codigos de registro',
		text_color='#85868F',
		font=('Inter', 14, 'bold'),
		anchor='w'
	).grid(row=0, column=0, sticky='w', pady=(0, 6))

	code_entries = []
	quantity_entry = entries['Quantidade']
	quantity_entry.bind(
		'<KeyRelease>',
		lambda event: update_code_fields(quantity_entry, code_frame, code_entries, status)
	)

	status = ctk.CTkLabel(form, text='', text_color='#2D3047', font=('Inter', 13))
	status.grid(row=4, column=0, columnspan=2, pady=(4, 8))

	ctk.CTkButton(
		form,
		text='Cadastrar',
		height=44,
		corner_radius=12,
		fg_color='#7E7F9A',
		hover_color='#EB9486',
		command=lambda: register_book(entries, code_entries, status)
	).grid(row=5, column=0, columnspan=2, padx=20, pady=(4, 24), sticky='ew')


def register_book(entries, code_entries, status):
	if any(not entry.get().strip() for entry in entries.values()):
		status.configure(text='Preencha todos os campos.', text_color='#B5443A')
		return

	if not code_entries or any(not entry.get().strip() for entry in code_entries):
		status.configure(text='Informe um codigo para cada exemplar.', text_color='#B5443A')
		return

	try:
		quantity = int(entries['Quantidade'].get())
	except ValueError:
		status.configure(text='A quantidade deve ser um numero inteiro.', text_color='#B5443A')
		return

	if quantity <= 0 or quantity != len(code_entries):
		status.configure(text='A quantidade deve corresponder aos codigos.', text_color='#B5443A')
		return

	database.create_book(
		entries['Nome do livro'].get().strip(),
		entries['Autor'].get().strip(),
		entries['Categoria'].get().strip(),
		entries['Assunto'].get().strip(),
		quantity,
		[entry.get().strip() for entry in code_entries]
	)
	status.configure(text='Livro cadastrado com sucesso.', text_color='#2D6A4F')


def update_code_fields(quantity_entry, code_frame, code_entries, status):
	for entry in code_entries:
		entry.destroy()
	code_entries.clear()

	try:
		quantity = int(quantity_entry.get())
	except ValueError:
		status.configure(text='Digite uma quantidade inteira maior que zero.', text_color='#B5443A')
		return

	if quantity <= 0:
		status.configure(text='Digite uma quantidade inteira maior que zero.', text_color='#B5443A')
		return

	for index in range(quantity):
		entry = ctk.CTkEntry(
			code_frame,
			placeholder_text=f'Codigo do exemplar {index + 1}',
			height=42,
			corner_radius=12
		)
		entry.grid(row=index + 1, column=0, padx=4, pady=4, sticky='ew')
		code_entries.append(entry)

	status.configure(text=f'{quantity} campo(s) de codigo criado(s).', text_color='#2D6A4F')
