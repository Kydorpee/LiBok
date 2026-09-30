/* Comportamentos comuns a todas as telas do LiBok. */
(function () {
  'use strict';

  // Avisos: botão de fechar e sumiço automático das mensagens de sucesso.
  document.querySelectorAll('[data-fechar-aviso]').forEach(function (botao) {
    botao.addEventListener('click', function () { botao.closest('.aviso').remove(); });
  });
  document.querySelectorAll('[data-autofechar]').forEach(function (aviso) {
    setTimeout(function () { aviso.style.transition = 'opacity .4s'; aviso.style.opacity = '0'; }, 6000);
    setTimeout(function () { aviso.remove(); }, 6500);
  });

  // Confirmação antes de ações destrutivas: <form data-confirmar="Mensagem" data-titulo="..." data-botao="...">.
  var dialogo = document.getElementById('dialogo-confirmacao');
  var formularioPendente = null;
  document.addEventListener('submit', function (evento) {
    var form = evento.target;
    if (!form.dataset || !form.dataset.confirmar || form.dataset.confirmado === 'sim') {
      return;
    }
    evento.preventDefault();
    formularioPendente = form;
    document.getElementById('dialogo-titulo').textContent = form.dataset.titulo || 'Tem certeza?';
    document.getElementById('dialogo-mensagem').textContent = form.dataset.confirmar;
    document.getElementById('dialogo-botao').textContent = form.dataset.botao || 'Confirmar';
    if (dialogo && dialogo.showModal) {
      dialogo.showModal();
    } else if (window.confirm(form.dataset.confirmar)) {
      form.dataset.confirmado = 'sim';
      form.submit();
    }
  });
  if (dialogo) {
    dialogo.addEventListener('click', function (evento) {
      var acao = evento.target.closest('[data-dialogo]');
      if (!acao) { return; }
      dialogo.close();
      if (acao.dataset.dialogo === 'confirmar' && formularioPendente) {
        formularioPendente.dataset.confirmado = 'sim';
        formularioPendente.requestSubmit ? formularioPendente.requestSubmit() : formularioPendente.submit();
      }
      formularioPendente = null;
    });
  }

  // Busca instantânea: <form data-busca-instantanea data-alvo="#resultados">, o servidor devolve só o trecho.
  document.querySelectorAll('form[data-busca-instantanea]').forEach(function (form) {
    var alvo = document.querySelector(form.dataset.alvo);
    var espera = null;
    var controle = null;

    function atualizar() {
      var parametros = new URLSearchParams(new FormData(form));
      Array.from(parametros.keys()).forEach(function (chave) {
        if (parametros.get(chave) === '') { parametros.delete(chave); }
      });
      var url = form.action + (parametros.toString() ? '?' + parametros.toString() : '');
      if (controle) { controle.abort(); }
      controle = new AbortController();
      fetch(url, { headers: { 'X-Parcial': '1' }, signal: controle.signal })
        .then(function (resposta) { return resposta.text(); })
        .then(function (html) {
          alvo.innerHTML = html;
          history.replaceState(null, '', url);
        })
        .catch(function () { /* busca cancelada por outra mais recente */ });
    }

    form.addEventListener('input', function (evento) {
      clearTimeout(espera);
      espera = setTimeout(atualizar, evento.target.type === 'search' || evento.target.type === 'text' ? 220 : 0);
    });
    form.addEventListener('change', function (evento) {
      if (evento.target.tagName === 'SELECT' || evento.target.type === 'checkbox') {
        clearTimeout(espera);
        atualizar();
      }
    });
    form.addEventListener('submit', function (evento) {
      evento.preventDefault();
      clearTimeout(espera);
      atualizar();
    });
  });

  // Áreas de envio de arquivo com arrastar e soltar.
  document.querySelectorAll('.area-envio').forEach(function (area) {
    var campo = area.querySelector('input[type=file]');
    var nome = area.querySelector('.nome-arquivo');
    function mostrarNome() {
      if (nome && campo.files.length) {
        nome.textContent = campo.files[0].name;
        nome.hidden = false;
      }
      var enviar = area.closest('form') && area.closest('form').querySelector('[data-requer-arquivo]');
      if (enviar) { enviar.disabled = !campo.files.length; }
    }
    campo.addEventListener('change', mostrarNome);
    ['dragenter', 'dragover'].forEach(function (tipo) {
      area.addEventListener(tipo, function (evento) { evento.preventDefault(); area.classList.add('arrastando'); });
    });
    ['dragleave', 'drop'].forEach(function (tipo) {
      area.addEventListener(tipo, function (evento) { evento.preventDefault(); area.classList.remove('arrastando'); });
    });
    area.addEventListener('drop', function (evento) {
      if (evento.dataTransfer.files.length) {
        campo.files = evento.dataTransfer.files;
        mostrarNome();
      }
    });
  });
})();
