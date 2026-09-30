/* Gráficos do painel (Chart.js). Os dados chegam em JSON no atributo data-painel. */
(function () {
  'use strict';

  var raiz = document.getElementById('painel');
  if (!raiz || !window.Chart) { return; }
  var dados = JSON.parse(raiz.dataset.painel);

  var VERDE = '#3f9b60';
  var VERDE_BARRA = '#7cc794';
  var TEXTO = '#1d2a22';
  var TEXTO_2 = '#56635b';
  var GRADE = '#edf1ec';
  var SUPERFICIE = '#ffffff';

  Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
  Chart.defaults.font.size = 12;
  Chart.defaults.color = TEXTO_2;
  Chart.defaults.plugins.legend.display = false;
  Chart.defaults.plugins.tooltip.backgroundColor = '#1d2a22';
  Chart.defaults.plugins.tooltip.padding = 10;
  Chart.defaults.plugins.tooltip.cornerRadius = 10;
  Chart.defaults.plugins.tooltip.displayColors = false;
  Chart.defaults.maintainAspectRatio = false;

  function plural(n, um, varios) { return n + ' ' + (n === 1 ? um : varios); }

  function dia(indice) {
    var data = new Date(dados.inicio + 'T00:00:00');
    data.setDate(data.getDate() + indice);
    return data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  }

  // Minigráficos dos indicadores.
  document.querySelectorAll('canvas[data-sparkline]').forEach(function (canvas) {
    var serie = dados[canvas.dataset.sparkline].sparkline;
    var contexto = canvas.getContext('2d');
    var gradiente = contexto.createLinearGradient(0, 0, 0, 34);
    gradiente.addColorStop(0, 'rgba(124, 199, 148, .35)');
    gradiente.addColorStop(1, 'rgba(124, 199, 148, 0)');
    new Chart(canvas, {
      type: 'line',
      data: {
        labels: serie.map(function (_, i) { return dia(i); }),
        datasets: [{ data: serie, borderColor: VERDE, borderWidth: 2, backgroundColor: gradiente, fill: true, cubicInterpolationMode: 'monotone', pointRadius: 0, pointHoverRadius: 4 }]
      },
      options: {
        animation: false,
        layout: { padding: { top: 3, bottom: 1 } },
        scales: { x: { display: false }, y: { display: false, beginAtZero: true } },
        interaction: { mode: 'index', intersect: false },
        plugins: { tooltip: { callbacks: { title: function (itens) { return itens[0].label; } } } }
      }
    });
  });

  // Barras horizontais: livros mais emprestados (uma única série, uma única cor).
  var barras = document.getElementById('grafico-barras');
  if (barras && dados.maisEmprestados.length) {
    var rotuloValor = {
      id: 'rotuloValor',
      afterDatasetsDraw: function (grafico) {
        var ctx = grafico.ctx;
        ctx.save();
        ctx.font = '700 12px ' + Chart.defaults.font.family;
        ctx.fillStyle = TEXTO;
        ctx.textBaseline = 'middle';
        grafico.getDatasetMeta(0).data.forEach(function (barra, i) {
          ctx.fillText(grafico.data.datasets[0].data[i], barra.x + 8, barra.y);
        });
        ctx.restore();
      }
    };
    new Chart(barras, {
      type: 'bar',
      data: {
        labels: dados.maisEmprestados.map(function (item, i) { return (i + 1) + '. ' + item.nome; }),
        datasets: [{
          data: dados.maisEmprestados.map(function (item) { return item.total; }),
          backgroundColor: VERDE_BARRA,
          hoverBackgroundColor: '#5fb87c',
          borderRadius: { topRight: 4, bottomRight: 4 },
          borderSkipped: 'left',
          maxBarThickness: 24,
          categoryPercentage: .8,
          barPercentage: .85
        }]
      },
      options: {
        indexAxis: 'y',
        layout: { padding: { right: 32 } },
        scales: {
          x: { beginAtZero: true, grid: { color: GRADE }, border: { display: false }, ticks: { precision: 0 } },
          y: {
            grid: { display: false },
            border: { color: '#d8dfd6' },
            ticks: {
              color: TEXTO,
              font: { weight: 600, size: 13 },
              // Títulos longos são encurtados conforme a largura disponível; o nome completo aparece no tooltip.
              callback: function (valor) {
                var rotulo = this.getLabelForValue(valor);
                var limite = this.chart.width < 420 ? 14 : 24;
                return rotulo.length > limite ? rotulo.slice(0, limite - 1).trim() + '…' : rotulo;
              }
            }
          }
        },
        plugins: {
          tooltip: {
            callbacks: {
              title: function (itens) { return dados.maisEmprestados[itens[0].dataIndex].nome; },
              label: function (item) {
                var livro = dados.maisEmprestados[item.dataIndex];
                return [livro.detalhe, plural(item.raw, 'empréstimo', 'empréstimos')];
              }
            }
          }
        },
        onClick: function (_, elementos) {
          if (elementos.length) { location.href = '/acervo/' + dados.maisEmprestados[elementos[0].index].id; }
        },
        onHover: function (evento, elementos) { evento.native.target.style.cursor = elementos.length ? 'pointer' : 'default'; }
      },
      plugins: [rotuloValor]
    });
  }

  // Rosca: exemplares por categoria (cores fixas por categoria, "Outras" em cinza).
  var rosca = document.getElementById('grafico-rosca');
  if (rosca && dados.categorias.length) {
    new Chart(rosca, {
      type: 'doughnut',
      data: {
        labels: dados.categorias.map(function (fatia) { return fatia.nome; }),
        datasets: [{
          data: dados.categorias.map(function (fatia) { return fatia.total; }),
          backgroundColor: dados.categorias.map(function (fatia) { return fatia.cor; }),
          borderColor: SUPERFICIE,
          borderWidth: 2,
          hoverOffset: 6
        }]
      },
      options: {
        cutout: '62%',
        layout: { padding: 6 },
        plugins: {
          tooltip: {
            displayColors: true,
            callbacks: {
              label: function (item) {
                var fatia = dados.categorias[item.dataIndex];
                return ' ' + fatia.nome + ': ' + plural(fatia.total, 'exemplar', 'exemplares') + ' (' + fatia.percentual.toLocaleString('pt-BR') + '%)';
              }
            }
          }
        }
      }
    });
  }

  // Linha: empréstimos por dia ou por mês.
  var tendencia = document.getElementById('grafico-tendencia');
  if (tendencia) {
    var ctx = tendencia.getContext('2d');
    var preenchimento = ctx.createLinearGradient(0, 0, 0, 230);
    preenchimento.addColorStop(0, 'rgba(124, 199, 148, .35)');
    preenchimento.addColorStop(1, 'rgba(124, 199, 148, 0)');
    var crosshair = {
      id: 'crosshair',
      afterDraw: function (grafico) {
        var ativos = grafico.tooltip && grafico.tooltip.getActiveElements();
        if (!ativos || !ativos.length) { return; }
        var x = ativos[0].element.x;
        var area = grafico.chartArea;
        grafico.ctx.save();
        grafico.ctx.strokeStyle = '#c3cdc0';
        grafico.ctx.lineWidth = 1;
        grafico.ctx.setLineDash([4, 4]);
        grafico.ctx.beginPath();
        grafico.ctx.moveTo(x, area.top);
        grafico.ctx.lineTo(x, area.bottom);
        grafico.ctx.stroke();
        grafico.ctx.restore();
      }
    };
    new Chart(tendencia, {
      type: 'line',
      data: {
        labels: dados.tendencia.rotulos,
        datasets: [{
          label: 'Empréstimos',
          data: dados.tendencia.valores,
          borderColor: VERDE,
          borderWidth: 2,
          backgroundColor: preenchimento,
          fill: true,
          cubicInterpolationMode: 'monotone',
          pointRadius: dados.tendencia.valores.length <= 14 ? 3 : 0,
          pointBackgroundColor: VERDE,
          pointBorderColor: SUPERFICIE,
          pointBorderWidth: 2,
          pointHoverRadius: 6,
          pointHitRadius: 12
        }]
      },
      options: {
        interaction: { mode: 'index', intersect: false },
        scales: {
          x: { grid: { display: false }, border: { color: '#d8dfd6' }, ticks: { maxRotation: 0, autoSkipPadding: 14 } },
          y: { beginAtZero: true, grid: { color: GRADE }, border: { display: false }, ticks: { precision: 0 } }
        },
        plugins: {
          tooltip: {
            callbacks: { label: function (item) { return plural(item.raw, 'empréstimo', 'empréstimos'); } }
          }
        }
      },
      plugins: [crosshair]
    });
  }

  // Período personalizado.
  var botaoPeriodo = document.querySelector('[data-abrir-periodo]');
  if (botaoPeriodo) {
    botaoPeriodo.addEventListener('click', function () {
      document.querySelector('.periodo-personalizado').classList.toggle('aberto');
    });
  }
})();
