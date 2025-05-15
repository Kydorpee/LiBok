# 📚 Livro API

Uma API RESTful desenvolvida com Laravel para cadastro, listagem e gerenciamento de livros.
## 🚀 Funcionalidades

- ✅ Criar livros
- ✅ Listar livros com paginação
- ✅ Buscar por título ou autor
- ✅ Filtrar por categoria ou status (lido/não lido)
- ✅ Editar e excluir livros

## 🧪 Tecnologias Utilizadas

- PHP 8
- Laravel 10
- MySQL
- Validação de dados

## 🛠️ Instalação e Uso

1. Clone o repositório:

```bash
git clone https://github.com/seu-usuario/livro-api.git
cd livro-api
```

2. Instale as dependências:

```bash
composer install
```

3. Configure o ambiente:

```bash
cp .env.example .env
php artisan key:generate
```

4. Configure o banco de dados em `.env`:

```env
DB_DATABASE=livros
DB_USERNAME=seu_usuario
DB_PASSWORD=sua_senha
```

5. Inicie o servidor local:

```bash
Acesse em: `http://localhost:8000`

```



---

## 📬 Endpoints da API

| Método | Rota           | Ação             |
|--------|----------------|------------------|
| GET    | /api/books     | Listar livros    |
| POST   | /api/books     | Criar livro      |
| GET    | /api/books/{id}| Ver detalhes     |
| PUT    | /api/books/{id}| Atualizar livro  |
| DELETE | /api/books/{id}| Deletar livro    |

---

## 🧠 Possibilidades de Expansão

- Autenticação com Laravel Sanctum
- Upload de imagem de capa do livro
- Sistema de favoritos
- Painel com Laravel Blade ou Vue.js

---

## 👨‍🎓 Feito por

Pedro Vinícius  
 [LinkedIn](https://www.linkedin.com/in/pedro-vinícius-4292a41b7)  

