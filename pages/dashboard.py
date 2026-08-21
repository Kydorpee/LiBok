import customtkinter as ctk
import database.database as database
from math import cos, radians, sin
from unicodedata import combining, normalize


CATEGORY_COLORS = {
    'tecnologia': '#4F6D7A',
    'infantil': '#EB9486',
    'juvenil': '#7E7F9A',
    'educativo': '#CAE7B9',
    'romance': '#D98E04',
    'ficcao': '#5B8E7D',
    'historia': '#C08497'
}
FALLBACK_COLORS = [
    '#8C6E5D', '#4F6D7A', '#A44A3F', '#6B705C',
    '#6D597A', '#277DA1', '#F9844A', '#43AA8B'
]
AUTO_CATEGORY_COLORS = {}


def show_page(parent):
    database.initialize_database()
    page = ctk.CTkFrame(parent, fg_color='#8284BD', corner_radius=20)
    page.pack(fill='both', expand=True)
    page.grid_columnconfigure(0, weight=1)
    page.grid_rowconfigure(1, weight=1)

    categories = database.get_category_totals()
    total_books = sum(total for _, total in categories)

    ctk.CTkLabel(
        page,
        text=f'Total de livros cadastrados: {total_books}',
        text_color='#000000',
        font=('Inter', 20, 'bold')
    ).grid(row=0, column=0, pady=(20, 0))

    chart = ctk.CTkCanvas(
        page,
        width=420,
        height=420,
        background='#8284BD',
        highlightthickness=0
    )
    chart.grid(row=1, column=0, padx=24, pady=16)

    def redraw(event=None):
        draw_pie_chart(chart, categories, total_books)

    chart.bind('<Configure>', redraw)
    page.after_idle(redraw)

    ctk.CTkLabel(
        page,
        text='Legenda',
        text_color='#000000',
        font=('Inter', 17, 'bold')
    ).grid(row=2, column=0, pady=(0, 6))

    legend = ctk.CTkScrollableFrame(
        page,
        height=46,
        fg_color='#F7F7F7',
        corner_radius=6,
        scrollbar_button_color='#BDBDBD',
        scrollbar_button_hover_color='#8F8F8F'
    )
    legend.grid(row=3, column=0, padx=64, pady=(0, 6), sticky='ew')
    legend.grid_columnconfigure((0, 1, 2), weight=1)

    if categories and total_books > 0:
        for index, (category, amount) in enumerate(categories):
            color = category_color(category, index)
            item = ctk.CTkFrame(legend, fg_color='transparent')
            item.grid(row=index // 3, column=index % 3, padx=6, pady=3, sticky='w')
            ctk.CTkLabel(
                item,
                text='',
                width=12,
                height=12,
                fg_color=color,
                corner_radius=3
            ).pack(side='left', padx=(0, 4))
            ctk.CTkLabel(
                item,
                text=f'{category}: {amount} ({amount / total_books * 100:.1f}%)',
                text_color='#000000',
                font=('Inter', 12)
            ).pack(side='left')
    else:
        ctk.CTkLabel(
            legend,
            text='Nenhuma categoria cadastrada.',
            text_color='#000000',
            font=('Inter', 13)
        ).grid(row=0, column=0, columnspan=2, pady=10)


def category_color(category, index=0):
    normalized_category = normalize('NFKD', category.strip().casefold())
    normalized_category = ''.join(
        character for character in normalized_category
        if not combining(character)
    )
    if normalized_category in CATEGORY_COLORS:
        return CATEGORY_COLORS[normalized_category]
    if normalized_category not in AUTO_CATEGORY_COLORS:
        color_index = len(AUTO_CATEGORY_COLORS) % len(FALLBACK_COLORS)
        AUTO_CATEGORY_COLORS[normalized_category] = FALLBACK_COLORS[color_index]
    return AUTO_CATEGORY_COLORS[normalized_category]


def draw_pie_chart(chart, categories, total_books):
    chart.delete('all')
    if not categories or total_books <= 0:
        chart.create_text(
            chart.winfo_width() / 2,
            chart.winfo_height() / 2,
            text='Sem dados',
            fill='#000000',
            font=('Inter', 22, 'bold')
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
        color = category_color(category, index)
        tag = f'category_{index}'
        chart.create_arc(
            left,
            top,
            right,
            bottom,
            start=start_angle,
            extent=extent,
            fill=color,
            outline='#8284BD',
            width=3,
            tags=tag
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

