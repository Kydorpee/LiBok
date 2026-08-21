import customtkinter as ctk

def show_page(parent):
	page = ctk.CTkFrame(parent, fg_color='#F3D38A', corner_radius=20)
	page.pack(fill='both', expand=True)
	page.grid_columnconfigure(0, weight=1)
	page.grid_rowconfigure(2, weight=1)

	ctk.CTkLabel(
		page,
		text='Livros cadastrados',
		text_color='#2D3047',
		font=('Inter', 26, 'bold')
	).grid(row=0, column=0, pady=(32, 4))

	chart = ctk.CTkCanvas(
		page,
		width=360,
		height=360,
		background='#F3D38A',
		highlightthickness=0
	)
	chart.grid(row=2, column=0, sticky='nsew', padx=24, pady=8)
	chart.bind('<Configure>', lambda event: draw_pie_chart(chart))

	legend = ctk.CTkFrame(page, fg_color='transparent')
	legend.grid(row=3, column=0, pady=(4, 28))

	for column, (file_type, color, amount) in enumerate([
		('Juvenil', '#7E7F9A', '42%'),
		('Infantil', '#EB9486', '28%'),
		('Diversos', '#CAE7B9', '18%'),
		('Educativo', '#D98E04', '12%')
	]):
		item = ctk.CTkFrame(legend, fg_color='transparent')
		item.grid(row=0, column=column, padx=10)
		ctk.CTkLabel(item, text='  ', fg_color=color, corner_radius=4, width=18).pack(side='left', padx=(0, 5))
		ctk.CTkLabel(item, text=f'{file_type} {amount}', text_color='#2D3047').pack(side='left')


def draw_pie_chart(chart):
	chart.delete('all')
	size = min(chart.winfo_width(), chart.winfo_height()) - 40
	left = (chart.winfo_width() - size) / 2
	top = (chart.winfo_height() - size) / 2
	right = left + size
	bottom = top + size

	start_angle = 0
	for value, color in [
		(42, '#7E7F9A'),
		(28, '#EB9486'),
		(18, '#CAE7B9'),
		(12, '#D98E04')
	]:
		extent = value * 3.6
		chart.create_arc(
			left, top, right, bottom,
			start=start_angle,
			extent=extent,
			fill=color,
			outline='#F3D38A',
			width=3
		)
		start_angle += extent
