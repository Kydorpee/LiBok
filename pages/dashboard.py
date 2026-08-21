import customtkinter as ctk
import database
import tkinter as tk
from math import cos, radians, sin
from pathlib import Path


COLORS = ['#7E7F9A', '#EB9486', '#CAE7B9', '#D98E04', '#5B8E7D', '#C08497']


def show_page(parent):
    database.initialize_database()
    page = ctk.CTkFrame(parent, fg_color='#F3D38A', corner_radius=20)
    page.pack(fill='both', expand=True)
    page.grid_columnconfigure((0, 1), weight=1)
    page.grid_rowconfigure(2, weight=1)

    ctk.CTkLabel(
        page,
        text='Resumo dos livros',
        text_color='#2D3047',
        font=('Inter', 26, 'bold')
    ).grid(row=0, column=0, columnspan=2, pady=(28, 2))

    categories = database.get_category_totals()
    total_books = sum(total for _, total in categories)
    total_label = ctk.CTkLabel(
        page,
        text=f'Total de livros cadastrados: {total_books}',
        text_color='#2D3047',
        font=('Inter', 15)
    )
    total_label.grid(row=1, column=0, columnspan=2, pady=(0, 8))

    profile = ctk.CTkFrame(page, fg_color='#E7DAD8', corner_radius=18)
    profile.grid(row=2, column=1, padx=(8, 32), pady=8, sticky='nsew')
    profile.grid_columnconfigure(0, weight=1)

    image_path = Path(__file__).parent.parent / 'img' / 'icon.png'
    profile_image = tk.PhotoImage(file=image_path)
    profile_label = ctk.CTkLabel(profile, text='', image=profile_image)
    profile_label.image = profile_image
    profile_label.grid(row=0, column=0, pady=(28, 12))
    ctk.CTkLabel(
        profile,
        text='LiBok',
        text_color='#2D3047',
        font=('Inter', 24, 'bold')
    ).grid(row=1, column=0, pady=(0, 6))
    ctk.CTkLabel(
        profile,
        text='Gerenciador de livros',
        text_color='#2D3047',
        font=('Inter', 14)
    ).grid(row=2, column=0, pady=(0, 28))

    chart = ctk.CTkCanvas(
        page,
        width=420,
        height=380,
        background='#F3D38A',
        highlightthickness=0
    )
    chart.grid(row=2, column=0, sticky='nsew', padx=(32, 8), pady=8)

    tooltip = ctk.CTkLabel(
        page,
        text='Passe o mouse sobre uma categoria',
        text_color='#2D3047',
        font=('Inter', 13)
    )
    tooltip.grid(row=3, column=0, columnspan=2, pady=(0, 4))

    legend = ctk.CTkFrame(page, fg_color='transparent')
    legend.grid(row=4, column=0, columnspan=2, pady=(4, 24))

    def redraw(event=None):
        draw_pie_chart(chart, categories, total_books, tooltip)

    for column, (category, amount) in enumerate(categories):
        color = COLORS[column % len(COLORS)]
        item = ctk.CTkFrame(legend, fg_color='transparent')
        item.grid(row=0, column=column, padx=8)
        ctk.CTkLabel(
            item,
            text='  ',
            fg_color=color,
            corner_radius=4,
            width=18
        ).pack(side='left', padx=(0, 5))
        ctk.CTkLabel(
            item,
            text=f'{category}: {amount} ({amount / total_books * 100:.1f}%)',
            text_color='#2D3047'
        ).pack(side='left')

    if not categories:
        tooltip.configure(text='Cadastre livros para visualizar as categorias.')

    chart.bind('<Configure>', redraw)
    page.after_idle(redraw)


def draw_pie_chart(chart, categories, total_books, tooltip):
    chart.delete('all')
    if not categories or total_books <= 0:
        chart.create_text(
            chart.winfo_width() / 2,
            chart.winfo_height() / 2,
            text='Nenhum livro cadastrado',
            fill='#2D3047',
            font=('Inter', 16)
        )
        return

    size = max(40, min(chart.winfo_width(), chart.winfo_height()) - 40)
    left = (chart.winfo_width() - size) / 2
    top = (chart.winfo_height() - size) / 2
    right = left + size
    bottom = top + size
    start_angle = 0

    center_x = (left + right) / 2
    center_y = (top + bottom) / 2
    label_radius = size * 0.38

    for index, (category, amount) in enumerate(categories):
        extent = amount / total_books * 360
        color = COLORS[index % len(COLORS)]
        tag = f'category_{index}'
        chart.create_arc(
            left,
            top,
            right,
            bottom,
            start=start_angle,
            extent=extent,
            fill=color,
            outline='#F3D38A',
            width=3,
            tags=tag
        )
        chart.tag_bind(
            tag,
            '<Enter>',
            lambda event, name=category, value=amount: tooltip.configure(
                text=f'{name}: {value} livro(s)'
            )
        )
        chart.tag_bind(
            tag,
            '<Leave>',
            lambda event: tooltip.configure(text='Passe o mouse sobre uma categoria')
        )
        label_angle = radians(start_angle + extent / 2)
        chart.create_text(
            center_x + label_radius * cos(label_angle),
            center_y - label_radius * sin(label_angle),
            text=f'{amount / total_books * 100:.1f}%',
            fill='#FFFFFF',
            font=('Inter', 11, 'bold'),
            tags=tag
        )
        start_angle += extent

    chart.create_oval(
        left + size * 0.28,
        top + size * 0.28,
        right - size * 0.28,
        bottom - size * 0.28,
        fill='#F3D38A',
        outline='#F3D38A'
    )
    chart.create_text(
        chart.winfo_width() / 2,
        chart.winfo_height() / 2,
        text=f'{total_books}\nlivros',
        fill='#2D3047',
        font=('Inter', 18, 'bold')
    )
