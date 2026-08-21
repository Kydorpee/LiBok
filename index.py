import customtkinter as ctk

app = ctk.CTk() 

#Palet colors
color1 = '#F3D38A'
color2 = '#CAE7B9'
color3 = '#EB9486'
color4 = '#7E7F9A'

app.title('LiBok')
app.geometry('1000x900')

app.config(background=color1)

label_dashboard = ctk.CTkLabel(app,width=10, height=2,text='Dashboard',font=('Inter',20),fg_color=color2)
label_dashboard.grid(row=0,column=0)

label_search = ctk.CTkLabel(app,width=10, height=2,text='Pesquisar',font=('Inter',20),fg_color=color2)
label_search.grid(row=0,column=1)

label_register = ctk.CTkLabel(app,width=10, height=2,text='Cadastrar',font=('Inter',20),fg_color=color2)
label_register.grid(row=0,column=2)


app.mainloop()