/* Lista dinâmica de exemplares no cadastro/edição de livro. */
(function () {
  'use strict';

  var area = document.querySelector('[data-exemplares]');
  if (!area) { return; }
  var lista = area.querySelector('[data-lista-codigos]');
  var quantidade = area.querySelector('[data-quantidade]');
  var modelo = document.getElementById('modelo-linha-codigo');

  function linhas() { return Array.from(lista.querySelectorAll('.linha-codigo')); }

  // Mantém os nomes exemplares[i].id / exemplares[i].codigo em sequência, como o Spring espera.
  function renumerar() {
    linhas().forEach(function (linha, i) {
      linha.querySelector('.numero').textContent = i + 1;
      var id = linha.querySelector('input[type=hidden]');
      var codigo = linha.querySelector('input.entrada');
      id.name = 'exemplares[' + i + '].id';
      id.id = 'exemplares' + i + '.id';
      codigo.name = 'exemplares[' + i + '].codigo';
      codigo.id = 'exemplares' + i + '.codigo';
      codigo.setAttribute('aria-label', 'Código do exemplar ' + (i + 1));
    });
    quantidade.value = linhas().length;
  }

  function adicionar(focar) {
    var linha = modelo.content.firstElementChild.cloneNode(true);
    lista.appendChild(linha);
    renumerar();
    if (focar) { linha.querySelector('input.entrada').focus(); }
    return linha;
  }

  function remover(linha) {
    if (linhas().length === 1) {
      linha.querySelector('input.entrada').value = '';
      linha.querySelector('input[type=hidden]').value = '';
      return;
    }
    linha.remove();
    renumerar();
  }

  function ajustarQuantidade() {
    var desejada = parseInt(quantidade.value, 10);
    if (!desejada || desejada < 1) { return; }
    desejada = Math.min(desejada, 500);
    while (linhas().length < desejada) { adicionar(false); }
    // Ao reduzir, remove apenas linhas vazias do final, para não apagar códigos já digitados.
    var atuais = linhas();
    for (var i = atuais.length - 1; i >= desejada; i--) {
      if (!atuais[i].querySelector('input.entrada').value.trim()) { atuais[i].remove(); }
    }
    renumerar();
  }

  area.addEventListener('click', function (evento) {
    var botaoRemover = evento.target.closest('[data-remover-exemplar]');
    if (botaoRemover) { remover(botaoRemover.closest('.linha-codigo')); }
    if (evento.target.closest('[data-adicionar-exemplar]')) { adicionar(true); }
    if (evento.target.closest('[data-abrir-gerador]')) {
      area.querySelector('[data-gerador]').classList.toggle('aberto');
      area.querySelector('[data-gerador-prefixo]').focus();
    }
    if (evento.target.closest('[data-gerar]')) { gerar(); }
  });

  quantidade.addEventListener('input', ajustarQuantidade);

  // Enter num código pula para o próximo (ou cria um novo), como num leitor de código de barras.
  lista.addEventListener('keydown', function (evento) {
    if (evento.key !== 'Enter' || !evento.target.matches('input.entrada')) { return; }
    evento.preventDefault();
    var atual = evento.target.closest('.linha-codigo');
    var proxima = atual.nextElementSibling;
    (proxima ? proxima : adicionar(false)).querySelector('input.entrada').focus();
  });

  function gerar() {
    var prefixo = area.querySelector('[data-gerador-prefixo]').value.trim();
    var numero = parseInt(area.querySelector('[data-gerador-inicio]').value, 10) || 0;
    var digitos = parseInt(area.querySelector('[data-gerador-digitos]').value, 10) || 1;
    linhas().forEach(function (linha) {
      var campo = linha.querySelector('input.entrada');
      if (!campo.value.trim()) {
        campo.value = prefixo + String(numero).padStart(digitos, '0');
        numero++;
      }
    });
  }

  var limpar = document.querySelector('[data-limpar]');
  if (limpar) {
    limpar.addEventListener('click', function () {
      setTimeout(function () {
        linhas().slice(1).forEach(function (linha) { linha.remove(); });
        renumerar();
      });
    });
  }

  if (!linhas().length) { adicionar(false); }
  renumerar();
})();
