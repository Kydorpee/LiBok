import customtkinter as ctk
from pages import dashboard, search, register

app = ctk.CTk() 

#Palet colors
color1 = '#F3D38A'
color2 = '#CAE7B9'
color3 = '#EB9486'
color4 = '#7E7F9A'

app.title('LiBok')
app.geometry('1000x900')
app.minsize(600, 300)

app.configure(fg_color=color1)

app.grid_columnconfigure(0, weight=1)
app.grid_rowconfigure(0, weight=0)
app.grid_rowconfigure(1, weight=1)

content = ctk.CTkFrame(app, fg_color='black', corner_radius=0)
content.grid(row=1, column=0, padx=24, pady=24, sticky='nsew')

pages = {
	'Dashboard': dashboard.show_page,
	'Search': search.show_page,
	'Register': register.show_page
}

def select_page(page_name):
	for widget in content.winfo_children():
		widget.destroy()
	pages[page_name](content)


nav_bar = ctk.CTkFrame(
	app,
	corner_radius=18,
	fg_color='#CAE7B9'
)
nav_bar.grid(row=0, column=0, padx=24, pady=(16, 0), sticky='new')

for column in range(3):
	nav_bar.grid_columnconfigure(column, weight=1)

for column, page in enumerate(['Dashboard', 'Search', 'Register']):
	button = ctk.CTkButton(
		nav_bar,
		text=page,
		command=lambda selected_page=page: select_page(selected_page),
		corner_radius=12,
		fg_color=color2,
		hover_color=color3,
		text_color='black'
	)
	button.grid(row=0, column=column, padx=8, pady=12, sticky='ew')

select_page('Dashboard')

app.mainloop()