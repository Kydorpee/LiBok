from tkinter import *

windows = Tk() 

#Palet colors
color1 = '#F3D38A'
color2 = '#CAE7B9'
color3 = '#EB9486'
color4 = '#7E7F9A'

windows.title('LiBok')
windows.geometry('1000x900')

windows.config(background=color1)
windows.iconphoto(False, PhotoImage(file='img/icon.png'))

label_dashboard = Label  (windows,width=10, height=2,text='Dashboard',font=('Inter'),bg=color2)
label_dashboard.grid(row=0,column=0)

label_search = Label  (windows,width=10, height=2,text='Pesquisar',font=('Inter'),bg=color2)
label_search.grid(row=0,column=1)

label_register = Label  (windows,width=10, height=2,text='Cadastrar',font=('Inter'),bg=color2)
label_register.grid(row=0,column=2)


windows.mainloop()