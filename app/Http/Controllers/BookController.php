<?php

namespace App\Http\Controllers;

use App\Models\Book;
use Illuminate\Http\Request;

class BookController extends Controller
{
    public function index()
    {
        return Book::paginate(10);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'title' => 'required|string',
            'author' => 'required|string',
            'year' => 'required|digits:4|integer|min:1000|max:' . date('Y'),
            'category' => 'required|string',
            'status' => 'in:lido,não lido',
        ]);

        return Book::create($validated);
    }

    public function show($id)
    {
        return Book::findOrFail($id);
    }

    public function update(Request $request, $id)
    {
        $book = Book::findOrFail($id);
        $book->update($request->all());
        return $book;
    }

    public function destroy($id)
    {
        Book::destroy($id);
        return response()->json(['message' => 'Livro excluído com sucesso']);
    }
}
