import customtkinter as ctk

def show_page(parent):
	page = ctk.CTkFrame(parent, fg_color='#F3D38A', corner_radius=0)
	page.pack(fill='both', expand=True)
	ctk.CTkLabel(
		page,
		text='Tela Register',
		text_color='white',
		font=('Inter', 28)
	).place(relx=0.5, rely=0.5, anchor='center')
