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

windows.mainloop()