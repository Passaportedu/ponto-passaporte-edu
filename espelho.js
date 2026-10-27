/* =====================================================================
   ESPELHO DE PONTO ELETRÔNICO (Portaria MTP 671/2021, art. 84)
   Usado pelo painel (admin.html) e pelo app do colaborador (index.html).
   Espelho.montar(dados) devolve o HTML de uma folha A4.
   ===================================================================== */
(function () {
  var TIPOS = ['Entrada', 'Saída intervalo', 'Retorno intervalo', 'Saída'];
  var DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  var MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  var MARCA = { incluida: 'I', desconsiderada: 'D', pre_assinalada: 'P' };

  var CSS = [
    '.folha{background:#fff;width:190mm;margin:0 auto 16px;padding:7mm;font-family:Arial,sans-serif;font-size:8.6pt;color:#000;box-shadow:0 1px 3px rgba(0,0,0,.15)}',
    '.folha h3{text-align:center;margin:0;font-size:12pt;color:#000179}',
    '.folha h4{text-align:center;margin:1px 0 5px;font-size:10pt}',
    '.folha .bloco{border:1px solid #9aa0ad;border-radius:3px;padding:3px 6px;margin-bottom:4px}',
    '.folha .bloco b.t{display:block;font-size:7.5pt;color:#000179;text-transform:uppercase;letter-spacing:.3px;margin-bottom:1px}',
    '.folha .grade2{display:grid;grid-template-columns:1fr 1fr;gap:0 10px}',
    '.folha .falta{color:#c5221f;font-weight:bold}',
    '.folha table{width:100%;border-collapse:collapse}',
    '.folha th,.folha td{border:1px solid #808080;padding:1px 3px;text-align:center;font-size:7.8pt;height:4.6mm}',
    '.folha th{background:#000179;color:#fff;font-weight:bold}',
    '.folha td.reg{font-size:7pt;color:#444;text-align:left}',
    '.folha td.obs{text-align:left;font-size:7pt;color:#c5221f}',
    '.folha td.obs.ok{color:#000}',
    '.folha tr.fds td{background:#eee}',
    '.folha tr.fora td{background:#bfbfbf}',
    '.folha tr.total td{background:#d9e2f3;font-weight:bold}',
    '.folha .trat{font-weight:bold}',
    '.folha .leg{font-size:6.8pt;color:#333;margin-top:3px;line-height:1.35}',
    '.folha .decl{margin:6px 0 18px;font-size:8pt}',
    '.folha .ass{display:flex;justify-content:space-between;gap:20px}',
    '.folha .ass div{flex:1;border-top:1px solid #000;text-align:center;padding-top:2px;font-size:8pt}',
    '.folha .local{text-align:center;margin-top:10px;font-size:8pt}',
    '.esp-aviso{max-width:190mm;margin:0 auto 10px;background:#fff4cc;border-radius:8px;padding:8px 12px;font:13px system-ui,Arial,sans-serif;color:#5f4700}',
    '@media print{@page{size:A4 portrait;margin:7mm}.folha{box-shadow:none;margin:0;width:auto;padding:0;page-break-after:always}.folha:last-child{page-break-after:auto}.esp-aviso{display:none}}'
  ].join('\n');

  function injetarCss() {
    if (document.getElementById('esp-css')) return;
    var st = document.createElement('style'); st.id = 'esp-css'; st.textContent = CSS;
    document.head.appendChild(st);
  }

  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function min(h) { if (!h) return null; return parseInt(h.slice(0, 2), 10) * 60 + parseInt(h.slice(3, 5), 10); }
  function hhmm(m) { m = Math.round(m); return Math.floor(m / 60) + ':' + ('0' + (m % 60)).slice(-2); }
  function dataBr(iso) { if (!iso) return ''; var p = String(iso).slice(0, 10).split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }
  function fmtCpf(c) { c = String(c || '').replace(/\D/g, ''); return c.length === 11 ? c.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : c; }
  function fmtCnpj(c) {
    c = String(c || '').replace(/\D/g, '');
    if (c.length === 14) return c.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    return fmtCpf(c);
  }
  function campo(valor, rotuloFalta) {
    return valor ? esc(valor) : '<span class="falta">' + esc(rotuloFalta || 'não informado') + '</span>';
  }

  // Minutos entre 22:00 e 05:00 dentro de um trecho [a, b] (b pode passar da meia-noite)
  function minutosNoturnos(a, b) {
    var n = 0;
    for (var t = a; t < b; t++) { var h = t % 1440; if (h >= 1320 || h < 300) n++; }
    return n;
  }

  // Duração da jornada de um dia a partir das marcações tratadas (art. 84, VI).
  // Hora noturna reduzida (CLT art. 73): cada 52min30s noturnos contam 1 hora.
  function duracao(f) {
    var e = min(f['Entrada']), si = min(f['Saída intervalo']), ri = min(f['Retorno intervalo']), s = min(f['Saída']);
    if (e === null || s === null) return null;
    var trechos = (si !== null && ri !== null) ? [[e, si], [ri, s]] : [[e, s]];
    var total = 0, noturno = 0;
    trechos.forEach(function (tr) {
      var a = tr[0], b = tr[1]; if (b < a) b += 1440;
      total += b - a; noturno += minutosNoturnos(a, b);
    });
    var acrescimo = noturno * (60 / 52.5) - noturno;
    return { minutos: total + acrescimo, noturno: noturno };
  }

  /* dados = { escola, colaborador, ym:'AAAA-MM', registros[], tratamentos[] (ativos), ocorrencias[], emissao (ISO local), hoje:'AAAA-MM-DD', nomeRede } */
  function montar(d) {
    injetarCss();
    var esc0 = d.escola || {}, c = d.colaborador || {};
    var p = d.ym.split('-').map(Number), ano = p[0], mes = p[1], nDias = new Date(ano, mes, 0).getDate();
    var ini = d.ym + '-01', fimIso = d.ym + '-' + ('0' + nDias).slice(-2);
    var inicioContrato = c.data_admissao || (c.criado_em ? String(c.criado_em).slice(0, 10) : null);

    var regDia = {}, tratDia = {}, ocDia = {}, desc = {};
    (d.tratamentos || []).forEach(function (t) {
      if (t.acao === 'desconsiderada') desc[t.registro_id] = t;
      else (tratDia[t.data] = tratDia[t.data] || {})[t.tipo] = t;
    });
    (d.registros || []).forEach(function (r) { (regDia[r.data_local] = regDia[r.data_local] || []).push(r); });
    (d.ocorrencias || []).forEach(function (o) { ocDia[o.data] = o; });

    var total = 0, trab = 0, pend = 0, usouNoturno = false, usouTrat = false, linhas = '';
    for (var dia = 1; dia <= 31; dia++) {
      if (dia > nDias) { linhas += '<tr class="fora">' + new Array(10).join('<td></td>') + '</tr>'; continue; }
      var iso = d.ym + '-' + ('0' + dia).slice(-2), dow = new Date(ano, mes - 1, dia).getDay(), fds = dow === 0 || dow === 6;
      var regs = (regDia[iso] || []).slice().sort(function (a, b) { return a.hora_local < b.hora_local ? -1 : 1; });
      var trat = tratDia[iso] || {}, oc = ocDia[iso];

      // Marcações registradas no REP (como foram feitas), com D nas desconsideradas
      var regTxt = regs.map(function (r) {
        return esc(r.hora_local.slice(0, 5)) + (desc[r.id] ? ' D' : '');
      }).join('  ');

      // Marcações tratadas: o que vale para o cálculo
      var final = {}, celulas = '';
      TIPOS.forEach(function (tp) {
        var t = trat[tp];
        if (t) { final[tp] = String(t.hora).slice(0, 5); usouTrat = true; celulas += '<td class="trat">' + final[tp] + ' ' + MARCA[t.acao] + '</td>'; return; }
        var r = regs.filter(function (x) { return x.tipo === tp && !desc[x.id]; })[0];
        if (r) { final[tp] = r.hora_local.slice(0, 5); celulas += '<td>' + final[tp] + '</td>'; }
        else celulas += '<td></td>';
      });
      if (regs.some(function (r) { return desc[r.id]; })) usouTrat = true;

      var obs = [], horas = '', algo = TIPOS.some(function (tp) { return final[tp]; });
      if (algo) {
        trab++;
        if (!final['Entrada']) obs.push('Sem entrada');
        if (!final['Saída']) obs.push('Sem saída');
        if (!!final['Saída intervalo'] !== !!final['Retorno intervalo']) obs.push('Intervalo incompleto');
        var du = duracao(final);
        if (du && du.minutos > 0) { total += du.minutos; horas = hhmm(du.minutos) + (du.noturno ? ' N' : ''); if (du.noturno) usouNoturno = true; }
        if (regs.some(function (r) { return r.no_local === 'Não'; })) obs.push('Fora do local');
      } else if (!fds && iso <= d.hoje && !oc && (!inicioContrato || iso >= inicioContrato)) obs.push('Sem registro');
      var motivos = TIPOS.filter(function (tp) { return trat[tp]; }).map(function (tp) { return MARCA[trat[tp].acao] + ': ' + trat[tp].motivo; })
        .concat(regs.filter(function (r) { return desc[r.id]; }).map(function (r) { return 'D: ' + desc[r.id].motivo; }));
      if (obs.length) pend++;
      var ocTxt = oc ? oc.codigo + (oc.observacao ? ': ' + oc.observacao : '') + (oc.anexo_path ? ' (doc. anexado)' : '') : '';
      var obsTxt = [ocTxt].concat(motivos).concat(obs).filter(Boolean).join('; ');
      linhas += '<tr' + (fds ? ' class="fds"' : '') + '><td>' + ('0' + dia).slice(-2) + '/' + ('0' + mes).slice(-2) + '</td><td>' + DIAS[dow] +
        '</td><td class="reg">' + regTxt + '</td>' + celulas + '<td>' + horas + '</td><td class="obs' + (obs.length ? '' : ' ok') + '">' + esc(obsTxt) + '</td></tr>';
    }

    var emissao = d.emissao ? dataBr(d.emissao) + ' ' + String(d.emissao).slice(11, 16) : '';
    var titulo = (d.nomeRede && String(esc0.nome || '').toLowerCase().indexOf(String(d.nomeRede).toLowerCase()) !== 0 ? d.nomeRede + ' · ' : '') + (esc0.nome || '');
    var jornadaTxt = c.carga_semanal ? String(c.carga_semanal).replace('.', ',') + ' horas semanais' : '';

    return '<div class="folha">' +
      '<h3>ESPELHO DE PONTO ELETRÔNICO</h3>' +
      '<h4>' + esc(titulo.toUpperCase()) + '</h4>' +
      '<div class="bloco"><b class="t">Empregador</b><div class="grade2">' +
        '<div><b>Nome / razão social:</b> ' + campo(esc0.razao_social || '', 'razão social não informada') + '</div>' +
        '<div><b>CNPJ/CPF:</b> ' + campo(fmtCnpj(esc0.cnpj), 'não informado') + '</div>' +
        '<div><b>Estabelecimento:</b> ' + esc(esc0.nome) + (esc0.cidade ? ' · ' + esc(esc0.cidade) + (esc0.uf ? '/' + esc(esc0.uf) : '') : '') + '</div>' +
        (esc0.cei_caepf_cno ? '<div><b>CEI/CAEPF/CNO:</b> ' + esc(esc0.cei_caepf_cno) + '</div>' : '<div></div>') +
      '</div></div>' +
      '<div class="bloco"><b class="t">Trabalhador</b><div class="grade2">' +
        '<div><b>Nome:</b> ' + esc(c.nome) + '</div>' +
        '<div><b>CPF:</b> ' + campo(fmtCpf(c.cpf)) + '</div>' +
        '<div><b>Data de admissão:</b> ' + campo(dataBr(c.data_admissao)) + '</div>' +
        '<div><b>Cargo/função:</b> ' + campo(c.cargo) + '</div>' +
      '</div></div>' +
      '<div class="bloco"><div class="grade2">' +
        '<div><b>Período:</b> ' + dataBr(ini) + ' a ' + dataBr(fimIso) + ' (' + MESES[mes - 1] + '/' + ano + ')</div>' +
        '<div><b>Data de emissão:</b> ' + esc(emissao) + '</div>' +
        '<div><b>Horário contratual:</b> ' + campo(c.jornada) + '</div>' +
        '<div><b>Jornada contratual:</b> ' + campo(jornadaTxt) + '</div>' +
      '</div></div>' +
      '<table><tr><th rowspan="2">Data</th><th rowspan="2">Dia</th><th rowspan="2" style="width:17%">Marcações registradas</th>' +
        '<th colspan="4">Marcações tratadas</th><th rowspan="2">Jornada realizada</th><th rowspan="2" style="width:26%">Observação</th></tr>' +
        '<tr><th>Entrada</th><th>Saída int.</th><th>Retorno int.</th><th>Saída</th></tr>' +
      linhas +
      '<tr class="total"><td colspan="7" style="text-align:right">TOTAL DE HORAS NO PERÍODO</td><td>' + hhmm(total) + '</td><td style="text-align:left">Dias trabalhados: ' + trab + ' · Pendências: ' + pend + '</td></tr></table>' +
      '<div class="leg"><b>Legenda:</b> I = marcação incluída · D = marcação desconsiderada · P = marcação pré-assinalada (o motivo de cada tratamento está na Observação)' +
        ' · N = jornada com hora noturna reduzida (22h às 5h, art. 73 da CLT).' +
        ' Ocorrências: F falta · FJ falta justificada · AT atestado · FE férias · FER feriado · PF ponto facultativo · SE serviço externo · AJ ajuste.</div>' +
      '<div class="decl">Declaro que conferi as marcações acima e que elas correspondem à jornada que cumpri no período.</div>' +
      '<div class="ass"><div>Assinatura do(a) trabalhador(a)</div><div>Assinatura do empregador</div></div>' +
      '<div class="local">' + esc((esc0.cidade || '______________') + (esc0.uf ? ' - ' + esc0.uf : '')) + ', ______ de ____________________ de ________.</div>' +
    '</div>';
  }

  // Campos do art. 84 que ainda faltam no cadastro (para avisar quem gera o espelho)
  function pendenciasCadastro(escola, colab) {
    var f = [];
    if (!escola.razao_social) f.push('razão social da escola');
    if (!escola.cnpj) f.push('CNPJ da escola');
    if (!colab.cpf) f.push('CPF de ' + colab.nome);
    if (!colab.data_admissao) f.push('data de admissão de ' + colab.nome);
    if (!colab.cargo) f.push('cargo de ' + colab.nome);
    if (!colab.jornada) f.push('horário contratual de ' + colab.nome);
    if (!colab.carga_semanal) f.push('jornada semanal de ' + colab.nome);
    return f;
  }

  function cpfValido(c) {
    c = String(c || '').replace(/\D/g, '');
    if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
    for (var t = 9; t < 11; t++) {
      var s = 0; for (var i = 0; i < t; i++) s += +c[i] * (t + 1 - i);
      var r = (s * 10) % 11; if (r === 10) r = 0;
      if (r !== +c[t]) return false;
    }
    return true;
  }
  function cnpjValido(c) {
    c = String(c || '').replace(/\D/g, '');
    if (c.length === 11) return cpfValido(c);
    if (c.length !== 14 || /^(\d)\1{13}$/.test(c)) return false;
    var pesos = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    for (var t = 12; t < 14; t++) {
      var s = 0; for (var i = 0; i < t; i++) s += +c[i] * pesos[i + 13 - t];
      var r = s % 11; r = r < 2 ? 0 : 11 - r;
      if (r !== +c[t]) return false;
    }
    return true;
  }

  window.Espelho = { montar: montar, pendenciasCadastro: pendenciasCadastro, cpfValido: cpfValido, cnpjValido: cnpjValido,
    fmtCpf: fmtCpf, fmtCnpj: fmtCnpj, duracao: duracao, injetarCss: injetarCss };
})();
