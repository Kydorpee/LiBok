import customtkinter as ctk
from pathlib import Path
from tkinter import PhotoImage
from pages import dashboard, search, register

try:
	from PIL import Image
except ImportError:
	Image = None

app = ctk.CTk() 

# Palette colors
color1 = '#8284BD'
color2 = '#68754F'
color3 = '#F3D38A'
color4 = '#8284BD'

app.title('LiBok')
app.geometry('1000x900')
app.iconbitmap(str(Path(__file__).parent / 'img' / 'icon.ico'))
app.minsize(1000, 400)

app.configure(fg_color=color1)

app.grid_columnconfigure(0, weight=1)
app.grid_rowconfigure(0, weight=0)
app.grid_rowconfigure(1, weight=1)

content = ctk.CTkFrame(app, fg_color=color1, corner_radius=20)
content.grid(row=1, column=0, padx=24, pady=24, sticky='nsew')
content.grid_columnconfigure(0, weight=1)
content.grid_rowconfigure(0, weight=1)

pages = {
	'Dashboard': dashboard.show_page,
	'Search': search.show_page,
	'Register': register.show_page
}

def select_page(page_name):
	for widget in content.winfo_children():
		widget.destroy()
	pages[page_name](content)


def show_start_screen():
	image_path = Path(__file__).parent / 'img' / 'icon.png'
	if Image is not None:
		start_image = ctk.CTkImage(
			light_image=Image.open(image_path),
			size=(320, 320)
		)
	else:
		start_image = PhotoImage(file=image_path)
	ctk.CTkLabel(
		content,
		text='',
		image=start_image,
		fg_color=color1
	).grid(row=0, column=0, sticky='nsew')


nav_bar = ctk.CTkFrame(app, corner_radius=18, fg_color=color2)
nav_bar.grid(row=0, column=0, padx=24, pady=(16, 0), sticky='new')
for column in range(3):
	nav_bar.grid_columnconfigure(column, weight=1)

tooltip_window = None
tooltip_after_id = None

def show_tooltip(widget, text):
	global tooltip_window, tooltip_after_id
	hide_tooltip()
	tooltip_after_id = app.after(400, lambda: create_tooltip(widget, text))


def create_tooltip(widget, text):
	global tooltip_window
	tooltip_window = ctk.CTkToplevel(app)
	tooltip_window.overrideredirect(True)
	tooltip_window.attributes('-topmost', True)
	tooltip_window.configure(fg_color='#FFF8E7')
	tooltip_window.geometry(f'+{widget.winfo_rootx()}+{widget.winfo_rooty() + widget.winfo_height() + 8}')
	ctk.CTkLabel(
		tooltip_window,
		text=text,
		text_color='#2D3047',
		font=('Segoe UI', 14),
		fg_color='#FFF8E7',
		corner_radius=8
	).pack(padx=12, pady=8)


def hide_tooltip():
	global tooltip_window, tooltip_after_id
	if tooltip_after_id is not None:
		app.after_cancel(tooltip_after_id)
		tooltip_after_id = None
	if tooltip_window is not None:
		tooltip_window.destroy()
		tooltip_window = None


for column, (page_name, page_label, tooltip_text) in enumerate([
	('Dashboard', 'Dashboard', 'Visualize o resumo dos livros cadastrados.'),
	('Search', 'Pesquisar', 'Consulte, edite ou exclua livros cadastrados.'),
	('Register', 'Cadastrar', 'Adicione um novo livro ao acervo.')
]):
	button = ctk.CTkButton(
		nav_bar,
		text=page_label,
		width=150,
		height=42,
		command=lambda selected_page=page_name: select_page(selected_page),
		corner_radius=12,
		fg_color=color2,
		hover_color='#7D8B5F',
		text_color='white',
		font=('Segoe UI', 20)
	)
	button.grid(row=0, column=column, padx=8, pady=12, sticky='ew')
	button.bind('<Enter>', lambda event, text=tooltip_text: show_tooltip(event.widget, text))
	button.bind('<Leave>', lambda event: hide_tooltip())

show_start_screen()

app.mainloop()