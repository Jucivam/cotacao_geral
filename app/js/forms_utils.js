import { globais } from './main.js';
import { formatToBRL, converterStringParaDecimal } from './utils.js';

let numeroParcela = 1;

// Configura o workerSrc para o pdf.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.10.377/pdf.worker.min.js';

/**
 * Mostra/oculta campos de pagamento com base na forma de pagamento selecionada
 * 
 * @function mostrarCamposPagamento
 * @returns {void}
 * 
 * @description
 * Esta função:
 * - Obtém a forma de pagamento selecionada (Boleto, Dep. em CC ou Dep. em CP)
 * - Oculta todos os campos de boleto e depósito inicialmente
 * - Se selecionado Boleto, mostra apenas os campos de boleto
 * - Se selecionado Depósito (CC ou CP), mostra apenas os campos de depósito
 * - Utiliza a classe CSS "hidden" para controlar a visibilidade
 */
export function mostrarCamposPagamento() {
    const formaPagamento = document.querySelector('input[name="Forma_de_pagamento"]:checked').value;

    let camposBoleto = document.querySelectorAll("#campos-boleto > *");
    camposBoleto.forEach(campo => campo.classList.add("hidden"));

    let camposDeposito = document.querySelectorAll("#campos-deposito > *");
    camposDeposito.forEach(campo => campo.classList.add("hidden"));

    let camposPix = document.querySelectorAll("#campos-pix > *");
    camposPix.forEach(campo => campo.classList.add("hidden"));

    if (formaPagamento === "Boleto") {

        camposBoleto.forEach(campo => campo.classList.remove("hidden"));
    } else if (formaPagamento === "Dep. em CC" || formaPagamento === "Dep. em CP") {

        camposDeposito.forEach(campo => campo.classList.remove("hidden"));
    } else if (formaPagamento === "Pix") {
        camposPix.forEach(campo => campo.classList.remove("hidden"));
    }
}

//=============================================================//
//====================PREENCHE DADOS DO PDC====================//
//=============================================================//
/**
 * Preenche os campos do formulário PDC com dados de uma cotação existente
 * 
 * @function preencherDadosPDC
 * @param {Object} resp - Resposta da API contendo os dados do PDC
 * @returns {void}
 * 
 * @description
 * Esta função:
 * - Define a flag global indicando que existe uma cotação
 * - Preenche os campos da Sessão 1 (Entidade, Descrição, Utilização)
 * - Preenche os campos da Sessão 3 (Forma de Pagamento)
 * - Configura campos específicos baseado na forma de pagamento:
 *   - Para Boleto: favorecido
 *   - Para Depósito: banco, agência, conta e favorecido
 * - Preenche as datas de vencimento, recriando os campos necessários
 * - Ajusta a visibilidade dos campos conforme a forma de pagamento
 */
export function preencherDadosPDC(resp) {
    globais.cotacaoExiste = true;
    const data = resp.data[0];
    globais.idPDC = data.ID;
    globais.numPDC = data.Numero_do_PDC;

    //==========SESSÃO 1==========//
    const formDadosPDC = document.querySelector('#dados-PDC');

    // Select da Entidade
    const selectEntidade = formDadosPDC.querySelector('#entidade');
    if (data.Entidade?.ID) {
        selectEntidade.value = data.Entidade.ID;
    }

    // Select do tipo
    const selectTipo = formDadosPDC.querySelector('#tipo');
    if (globais.pag === "editar_cotacao_DP") {
        selectTipo.innerHTML = '';
    }

    // Acessando as propriedades corretamente
    const tipoSolicitacaoID = data["Tipo_de_solicitacao.ID"];
    const tipoSolicitacaoDescr = data["Tipo_de_solicitacao.descr_tipo_compra"];

    if (tipoSolicitacaoID) {
        // Verifica se o tipo já existe no select
        const optionExistente = Array.from(selectTipo.options).some(option => option.value === tipoSolicitacaoID);

        // Se não existir, cria uma nova opção
        if (!optionExistente) {
            const novaOpcao = document.createElement('option');
            novaOpcao.value = tipoSolicitacaoID;
            novaOpcao.textContent = tipoSolicitacaoDescr.toUpperCase();
            selectTipo.appendChild(novaOpcao);
        }

        // Seleciona a opção
        selectTipo.value = tipoSolicitacaoID;
    }

    // Descrição da Compra
    const textareaDescricao = formDadosPDC.querySelector('#descricao');
    if (data.Descricao_da_compra) {
        textareaDescricao.value = data.Descricao_da_compra;
    }

    // Utilizaão
    const textareaUtilizacao = formDadosPDC.querySelector('#utilizacao');
    if (data.Utilizacao) {
        textareaUtilizacao.value = data.Utilizacao;
    }

    // Justificativa
    const textareaJustificativa = formDadosPDC.querySelector('#justificativa');
    if (data.Justificativa) {
        textareaJustificativa.value = data.Justificativa;
    }

    // =====[SESSÃO 3]=====//
    const formPagamento = document.querySelector('#form-pagamento');

    // Forma de Pagamento
    if (data.Forma_de_pagamento) {
        const radioFormaPagamento = formPagamento.querySelector(`input[name="Forma_de_pagamento"][value="${data.Forma_de_pagamento}"]`);
        if (radioFormaPagamento) {
            radioFormaPagamento.checked = true;
            mostrarCamposPagamento();
        }
    }

    // Campos específicos para Depósito
    if (data.Forma_de_pagamento === 'Dep. em CC' || data.Forma_de_pagamento === 'Dep. em CP') {
        const inputBanco = formPagamento.querySelector('#banco');
        const inputAgencia = formPagamento.querySelector('#agencia');
        const inputConta = formPagamento.querySelector('#conta');
        const inputFavorecidoDeposito = formPagamento.querySelector('#favorecido-deposito');

        if (data.Banco) inputBanco.value = data.Banco;
        if (data.AG) inputAgencia.value = data.AG;
        if (data.N_Conta) inputConta.value = data.N_Conta;
        if (data.Favorecido) inputFavorecidoDeposito.value = data.Favorecido;
    }

    // Preenche as datas de vencimento
    if (data.Datas && Array.isArray(data.Datas)) {
        const camposData = document.getElementById('camposData');

        // Remove campos existentes
        while (camposData.firstChild) {
            camposData.removeChild(camposData.firstChild);
        }

        // Adiciona campos para cada data
        data.Datas.forEach((dataObj, index) => {
            if (!dataObj.display_value) {
                return;
            }

            const [dataStr, valor, numPDC] = dataObj.display_value.split('|SPLITKEY|');
            const [dia, mes, ano] = dataStr.split('/');
            const dataFormatada = `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;

            adicionarCampoVenc(dataFormatada, valor, numPDC);
        });
    }

    // =====[SESSÃO DE RETENÇÕES]=====//
    const inputDataEmissaoNF = document.querySelector('#data-emissao-nf');
    const inputNumeroNF = document.querySelector('#numero-nf');
    const inputInss = document.querySelector('#inss');
    const inputIss = document.querySelector('#iss');
    const inputPisConfinsCssl = document.querySelector('#pis-confins-cssl');
    const inputDescontoComercial = document.querySelector('#desconto-comercial');
    const inputAcrescimo = document.querySelector('#acrescimo');

    // Preenche os campos de retenção com os dados da resposta
    if (data.Data_emissao_N_Fiscal) {
        const [dia, mes, ano] = data.Data_emissao_N_Fiscal.split('/');
        inputDataEmissaoNF.value = `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;

    }

    if (data.Numero_N_Fiscal) inputNumeroNF.value = data.Numero_N_Fiscal;
    if (data.INSS) inputInss.value = formatToBRL(data.INSS);
    if (data.ISS) inputIss.value = formatToBRL(data.ISS);
    if (data.PIS_COFINS_CSSL) inputPisConfinsCssl.value = formatToBRL(data.PIS_COFINS_CSSL);
    if (data.Desconto_comercial_ou_parcela) inputDescontoComercial.value = formatToBRL(data.Desconto_comercial_ou_parcela);
    if (data.Acrescimo_tarifa_bancaria) inputAcrescimo.value = formatToBRL(data.Acrescimo_tarifa_bancaria);

    // Mostra os campos relevantes baseado na forma de pagamento
    const formaPagamentoSelecionada = formPagamento.querySelector('input[name="Forma_de_pagamento"]:checked');
    if (formaPagamentoSelecionada) {
        mostrarCamposPagamento();
    }

    if (data.anexo_arquivos && data.anexo_arquivos.length > 0) {
        console.log("ANEXOS EXISTENTES, CARREGANDO...")
        console.log(data.anexo_arquivos);
        preencherListaAnexosV2(data.anexo_arquivos);
    }


    preencherDadosClassificacao(data.Classificacao_contabil);

    atualizarValorOriginal();
    calcularValorTotalPagar();
    atualizarValorTotalParcelas();
    atualizarValorTotalClassificacoes();
}

//==============================================================================//
//====================FUNÇÕES PARA TRATAR CAMPOS DE PARCELAS====================//
//==============================================================================//
/**
 * Adiciona um campo de data para parcelas de pagamento
 * 
 * @function adicionarCampoVenc
 * @returns {void}
 * 
 * @description
 * - Cria um novo campo de data para parcelas de pagamento
 */
export function adicionarCampoVenc(data = null, valor = null, numPDC = null) {

    numeroParcela++;

    //====================CRIA UM NOVO CONTAINER PARA O CAMPO DE DATA E O BOTÃO DE REMOVER====================//
    const novoCampo = document.createElement('div');
    novoCampo.classList.add('parcela');

    //====================CRIA O RÓTULO PARA O CAMPO DE DATA====================//
    const novoLabel = document.createElement('label');
    novoLabel.innerText = `Parcela nº ${numeroParcela}:`;

    //====================CRIA O CAMPO DE DATA====================//
    const novoInput = document.createElement('input');
    novoInput.type = 'date';
    novoInput.name = 'Datas';
    if (data) novoInput.value = data;

    //====================CRIA O CAMPO DE VALOR====================//
    const novoInputValor = document.createElement('input');
    novoInputValor.type = 'text';
    novoInputValor.name = 'Valor';
    novoInputValor.classList.add('input-number', 'valor-parcela');
    novoInputValor.placeholder = 'R$ 0,00';
    if (valor) novoInputValor.value = formatToBRL(valor);
    novoInputValor.addEventListener('blur', () => {
        formatToBRL(novoInputValor);
        atualizarValorTotalParcelas();
    });

    //====================CRIA UM CAMPO DE NÚMERO DO PDC====================//
    let novoInputNumPDC;
    if (numPDC) {
        novoInputNumPDC = document.createElement('input');
        novoInputNumPDC.type = 'text';
        novoInputNumPDC.name = 'Num_PDC_parcela';
        novoInputNumPDC.classList.add('campo-datas', "num-pdc");
        // Verifica se numPDC já possui a parte /NN

        if (!numPDC.includes('/')) {
            novoInputNumPDC.value = `${numPDC}/${String(numeroParcela).padStart(2, '0')}`;
        } else {
            novoInputNumPDC.value = numPDC; // Mantém o valor original se já tiver a parte /NN
        }
    }

    //====================CRIA O BOTÃO DE REMOVER====================//
    const removerButton = document.createElement('button');
    removerButton.type = 'button';
    removerButton.classList.add('remover-parcela', 'close-icon', 'remove-btn');

    //====================ADICIONA A FUNÇÃO DE REMOVER AO BOTÃO DE REMOVER====================//
    removerButton.addEventListener('click', function () {
        novoCampo.remove();
        numeroParcela--;
        atualizarValorTotalParcelas();
        atualizarLabels();
    });

    //====================ADICIONA O CAMPO DE DATA, O RÓTULO E O BOTÃO DE REMOVER AO CONTAINER====================//
    novoCampo.appendChild(novoLabel);
    novoCampo.appendChild(novoInput);
    novoCampo.appendChild(novoInputValor);
    if (novoInputNumPDC) novoCampo.appendChild(novoInputNumPDC);
    novoCampo.appendChild(removerButton);

    //====================ADICIONA O NOVO CAMPO AO CONTAINER DE CAMPOS====================//
    document.getElementById('camposData').appendChild(novoCampo);

    //====================ATUALIZA OS RÓTULOS DE PARCELA PARA MANTER A SEQUÊNCIA CORRETA====================//
    atualizarLabels();
}

/**
 * Adiciona um campo de data para parcelas de pagamento
 * 
 * @function adicionarCampoVenc
 * @returns {void}
 * 
 * @description
 * - Cria um novo campo de data para parcelas de pagamento
 */
export function removerCampoVenc(elemento) {
    const parentElement = elemento.parentElement;
    const parentClass = parentElement.className;

    const elementosSimilares = document.getElementsByClassName(parentClass);
    if (elementosSimilares.length > 1) {

        parentElement.remove();
        numeroParcela--;

        atualizarLabels();
        atualizarValorTotalParcelas();
    }
}

/**
 * Atualiza os rótulos das parcelas para manter a sequência correta
 * 
 * @function atualizarLabels
 * @returns {void}
 * 
 * @description
 * Esta função:
 * - Busca todas as parcelas existentes no container de campos de data
 * - Atualiza o texto do rótulo de cada parcela para manter a numeração sequencial
 * - Garante que as parcelas sejam numeradas de 1 até N, onde N é o total de parcelas
 */
function atualizarLabels() {
    const parcelas = document.querySelectorAll('#camposData .parcela');
    parcelas.forEach((parcela, index) => {
        parcela.querySelector('label').innerText = `Parcela nº ${index + 1}:`;
        /*
        // Atualiza o campo de número do PDC
        const inputNumPDC = parcela.querySelector('input[name="Num_PDC_parcela"]');
        if (inputNumPDC) {
            const numPDC = globais.numPDC; // Supondo que globais.numPDC contém o número do PDC
            inputNumPDC.value = `${numPDC}/${String(index + 1).padStart(2, '0')}`;
        }
            */
    });
}

//============================================================================================//
//====================FUNÇÕES PARA TRATAR CAMPOS DE CLASSIFICAÇÃO CONTÁBIL====================//
//============================================================================================//
/**
 * Adiciona uma nova linha de classificação contábil
 * 
 * @function adicionarLinhaClassificacao
 * @returns {void}
 * 
 * @description
 * - Verifica se o container está oculto e o torna visível se necessário
 * - Cria uma nova linha com todos os campos necessários
 * - Mantém a mesma estrutura e estilo das linhas existentes
 */
export function adicionarLinhaClassificacao() {
    const camposClassificacao = document.getElementById('camposClassificacao');

    // Verifica se o container está oculto e o torna visível
    if (camposClassificacao.classList.contains('hidden')) {
        camposClassificacao.classList.remove('hidden');
    }

    // Cria a nova linha
    const novaLinha = document.createElement('div');
    novaLinha.classList.add('linha-classificacao');

    // Função auxiliar para criar campos
    const criarCampo = ({ inputType, inputName, id = null, options = null }) => {
        const campo = document.createElement('div');
        campo.id = id;
        campo.classList.add('campo');

        let input;
        if (inputType === 'select') {
            input = document.createElement('select');
            const optionPadrao = document.createElement('option');
            optionPadrao.value = '';
            optionPadrao.disabled = true;
            optionPadrao.selected = true;
            optionPadrao.textContent = 'Selecione...';
            input.appendChild(optionPadrao);

            // Adiciona as opções se fornecidas
            if (options) {
                options.forEach(([value, text]) => {
                    const option = document.createElement('option');
                    option.value = value;
                    option.textContent = text;
                    input.appendChild(option);
                });
            }
        } else {
            input = document.createElement('input');
            input.type = inputType;
            if (inputType === 'number') {
                input.classList.add('input-number');
                input.type = 'text';
                input.addEventListener('blur', () => { formatToBRL(input); atualizarValorTotalClassificacoes(); });
            }
        }
        input.name = inputName;

        campo.appendChild(input);
        return campo;
    };

    // Adiciona as opções de conta
    const opcoesConta = [
        ['CUSTEIO', 'CUSTEIO'],
        ['INVESTIMENTO', 'INVESTIMENTO'],
        ['FUNDO DE RESERVA', 'FUNDO DE RESERVA']
    ];

    // Prepara as opções para os selects
    const opcoesClasse = Array.from(globais.baseClassesOperacionais.entries()).map(([id, dados]) => [
        id,
        `${dados.codigoClasse} - ${dados.nomeClasse}`
    ]);

    const opcoesCentro = Array.from(globais.baseCentrosCusto.entries()).map(([id, dados]) => [
        id,
        `${dados.codigoCentro} - ${dados.nomeCentro}`
    ]);

    // Cria os campos
    const campoConta = criarCampo({ inputType: 'select', inputName: 'Conta_a_debitar', id: 'conta', options: opcoesConta });
    const campoCentro = criarCampo({ inputType: 'select', inputName: 'Centro_de_custo', id: 'centro', options: opcoesCentro });
    const campoClasse = criarCampo({ inputType: 'select', inputName: 'Classe_operacional', id: 'classe', options: opcoesClasse });
    const campoValor = criarCampo({ inputType: 'number', inputName: 'Valor', id: 'valor' });

    // Adiciona evento de mudança na classe para filtrar centro de custo
    // Cria o botão de remoção
    const botaoRemover = document.createElement('button');
    botaoRemover.type = 'button';
    botaoRemover.classList.add('remover-classificacao', 'close-icon', 'remove-btn');
    botaoRemover.addEventListener('click', () => removerLinhaClassificacao(botaoRemover));

    // Adiciona todos os elementos à nova linha
    novaLinha.appendChild(campoConta);
    novaLinha.appendChild(campoCentro);
    novaLinha.appendChild(campoClasse);
    novaLinha.appendChild(campoValor);
    novaLinha.appendChild(botaoRemover);

    // Adiciona a nova linha ao container
    camposClassificacao.appendChild(novaLinha);
    //popularSelects(globais.classificacoes,globais.centrosCusto);
}

/**
 * Remove uma linha de classificação contábil
 * 
 * @function removerLinhaClassificacao
 * @param {HTMLElement} botao - O botão de remoção que foi clicado
 * @returns {void}
 * 
 * @description
 * - Verifica se existe mais de uma linha antes de permitir a remoção
 * - Remove a linha de classificação contábil correspondente ao botão clicado
 */
export function removerLinhaClassificacao(botao) {
    // Busca o form pai mais próximo
    const formPai = botao.closest('form');

    // Busca todas as linhas de classificão dentro deste form específico
    const linhas = formPai.getElementsByClassName('linha-classificacao');

    // Impede a remoção se houver apenas uma linha
    if (linhas.length <= 1) {
        return;
    }

    // Remove a linha específica
    const linhaAtual = botao.closest('.linha-classificacao');
    linhaAtual.remove();
}

//===================================================================================//
//====================PREENCHE OS DADOS DE CLASSIFICAÇÃO CONTÁBIL====================//
//===================================================================================//
function preencherDadosClassificacao(classificacoes) {
    const formClassificacao = document.querySelector('#form-classificacao');

    // Limpa as linhas existentes
    formClassificacao.querySelectorAll('.linha-classificacao').forEach(linha => {
        linha.remove();
    });

    // Para cada classificação, cria uma nova linha
    classificacoes.forEach(classificacao => {
        // Extrai os valores do display_value
        const [conta, centro, classe, valor, id] = classificacao.display_value.split('|SPLITKEY|');

        // Adiciona uma nova linha
        adicionarLinhaClassificacao();

        // Pega a última linha adicionada
        const ultimaLinha = formClassificacao.querySelector('.linha-classificacao:last-child');

        // Preenche os campos
        const selectConta = ultimaLinha.querySelector('select[name="Conta_a_debitar"]');
        const selectCentro = ultimaLinha.querySelector('select[name="Centro_de_custo"]');
        const selectClasse = ultimaLinha.querySelector('select[name="Classe_operacional"]');
        const inputValor = ultimaLinha.querySelector('input[name="Valor"]');

        // Extrai apenas o código antes do hífen para fazer o match
        const codigoClasse = classe.split(' - ')[0].trim();
        const codigoCentro = centro.split(' - ')[0].trim();



        // Encontra e seleciona a opção correta em cada select
        Array.from(selectCentro.options).forEach(option => {
            if (option.text.startsWith(codigoCentro)) {
                option.selected = true;
            }
        });

        Array.from(selectClasse.options).forEach(option => {
            if (option.text.startsWith(codigoClasse)) {
                option.selected = true;
            }
        });

        // Adiciona seleção da conta a debitar
        Array.from(selectConta.options).forEach(option => {
            if (option.text === conta.trim()) {
                option.selected = true;
            }
        });

        // Formata e define o valor
        inputValor.value = formatToBRL({ target: { value: valor } });
    });
}

/**
 * Inicializa o formulário de classificação após carregar os dados
 * 
 * @function initClassificacaoForm
 * @param {Map} classificacoes - Map contendo as classificações operacionais
 * @param {Map} centrosCusto - Map contendo os centros de custo
 * @returns {void}
 */
export function initClassificacaoForm(classificacoes, centrosCusto) {

    // Oculta mensagem de carregamento
    const loadingMessage = document.getElementById('loading-classificacao');
    loadingMessage.style.display = 'none';

    // Mostra o formulário
    const form = document.getElementById('form-classificacao');
    // Adiciona ouvinte para formatar o campo valor como moeda brasileira
    const camposValor = form.querySelectorAll('input[name="Valor"]');
    camposValor.forEach(campo => {
        campo.type = 'text';
        campo.addEventListener('blur', function () {
            formatToBRL(this);
        });
    });

    // Adiciona ouvinte para formatar o campo valor como moeda brasileira
    form.style.display = 'block';

    // Popula os selects
    popularSelects(classificacoes, centrosCusto);

    // Mostra o primeiro conjunto de campos de classificação
    const camposClassificacao = document.getElementById('camposClassificacao');
    camposClassificacao.classList.remove('hidden');
}

/**
 * Popula os selects de classificação contábil e centro de custo
 * 
 * @function popularSelects
 * @param {Map} classificacoes - Map contendo as classificações operacionais
 * @param {Map} centrosCusto - Map contendo os centros de custo
 * @returns {void}
 */
export function popularSelects(classificacoes, centrosCusto) {
    // Busca todos os conjuntos de selects dentro do form-classificacao
    const classificacaoForm = document.getElementById('form-classificacao');
    const todasClassificacoes = classificacaoForm.querySelectorAll('.linha-classificacao');

    todasClassificacoes.forEach(container => {
        // Seleciona os selects dentro de cada container de classificação
        const selectCentro = container.querySelector('select[name="Centro_de_custo"]');
        const selectClassificacao = container.querySelector('select[name="Classe_operacional"]');

        // Popula select de centros de custo
        if (selectCentro) {
            selectCentro.innerHTML = '<option value="" disabled selected>Selecione...</option>';
            centrosCusto.forEach((dados, id) => {
                const option = document.createElement('option');
                option.value = id;
                option.textContent = `${dados.codigoCentro} - ${dados.nomeCentro}`;
                selectCentro.appendChild(option);
            });
        }

        // Popula select de classificações
        if (selectClassificacao) {
            selectClassificacao.innerHTML = '<option value="" disabled selected>Selecione...</option>';
            classificacoes.forEach((dados, id) => {
                const option = document.createElement('option');
                option.value = id;
                option.textContent = `${dados.codigoClasse} - ${dados.nomeClasse}`;
                selectClassificacao.appendChild(option);
            });
        }
    });
}

/**
 * Atualiza o valor total das classificações contábeis sempre que um campo de valor é alterado
 * 
 * @function atualizarValorTotalClassificacoes
 * @returns {void}
 */
export function atualizarValorTotalClassificacoes() {

    const labelTotal = document.getElementById('valor-total-classificacoes');
    if (globais.idFornAprovado) {
        const table = document.getElementById('priceTable');
        const headerRow = table.rows[0];
        const totalRow = table.rows[table.rows.length - 2];

        const colIndex = Array.from(headerRow.cells).findIndex(cell => cell.dataset.id_forn === globais.idFornAprovado);

        if (colIndex !== -1) {
            const valorTotalFornecedor = totalRow.cells[colIndex - 2].innerText;

            let total = converterStringParaDecimal(valorTotalFornecedor).toFixed(2);

            const valoresClassificacoes = document.querySelectorAll('#form-classificacao input[name="Valor"]');
            valoresClassificacoes.forEach(input => {

                const valor = converterStringParaDecimal(input.value).toFixed(2) || 0;
                total -= valor; // Reduz o valor da classificação do total
                total = parseFloat(total).toFixed(2); // Converte total para número antes de usar toFixed
            });


            labelTotal.innerText = formatToBRL(total);

            if (total == 0) {
                labelTotal.classList.add('valor-igual');
                labelTotal.classList.remove('valor-diferente');
            } else {
                labelTotal.classList.add('valor-diferente');
                labelTotal.classList.remove('valor-igual');
            }
        } else {
            labelTotal.innerText = "-";
            labelTotal.classList.add('valor-diferente');
            labelTotal.classList.remove('valor-igual');
        }
    } else {
        labelTotal.innerText = "-";
        labelTotal.classList.add('valor-diferente');
        labelTotal.classList.remove('valor-igual');
    }







}

//===============================================================//
//====================OUTRAS FUNÇÕES DE APOIO====================//
//===============================================================//

export function setupPixValidation() {
    const tipoPix = document.getElementById('tipo-pix');
    const chavePix = document.getElementById('pix-chave');

    // Cria elemento para mensagem de erro
    const errorMessage = document.createElement('span');
    errorMessage.classList.add('error-message');
    errorMessage.style.color = 'red';
    errorMessage.style.fontSize = '12px';
    errorMessage.style.display = 'none';
    chavePix.parentNode.appendChild(errorMessage);

    const formatacoes = {
        CPF: {
            mascara: (valor) => {
                valor = valor.replace(/\D/g, '');
                return valor.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
            },
            validacao: /^[0-9.-]*$/,
            validacaoCompleta: /^\d{3}\.\d{3}\.\d{3}-\d{2}$/,
            maxLength: 14,
            mensagemErro: 'CPF inválido. Use o formato: 123.456.789-00'
        },
        CNPJ: {
            mascara: (valor) => {
                valor = valor.replace(/\D/g, '');
                return valor.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
            },
            validacao: /^[0-9./-]*$/,
            validacaoCompleta: /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/,
            maxLength: 18,
            mensagemErro: 'CNPJ inválido. Use o formato: 12.345.678/0001-90'
        },
        Email: {
            mascara: (valor) => valor,
            validacao: /^[a-zA-Z0-9@._-]*$/,
            validacaoCompleta: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
            maxLength: 100,
            mensagemErro: 'E-mail inválido. Use um formato válido: exemplo@dominio.com'
        },
        Telefone: {
            mascara: (valor) => {
                valor = valor.replace(/\D/g, '');
                return valor.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
            },
            validacao: /^[0-9() -]*$/,
            validacaoCompleta: /^\(\d{2}\) \d{5}-\d{4}$/,
            maxLength: 15,
            mensagemErro: 'Telefone inválido. Use o formato: (24) 98765-4321'
        },
        'Chave Aleatória': {
            mascara: (valor) => valor,
            validacao: /^[a-zA-Z0-9-]*$/,
            validacaoCompleta: /^[a-zA-Z0-9-]{32,36}$/,
            maxLength: 36,
            mensagemErro: 'Chave aleatória inválida. Deve conter entre 32 e 36 caracteres alfanuméricos'
        }
    };

    tipoPix.addEventListener('change', () => {
        const tipo = tipoPix.value;
        chavePix.value = '';
        chavePix.maxLength = formatacoes[tipo].maxLength;
        errorMessage.style.display = 'none';
        chavePix.classList.remove('invalid');
    });

    chavePix.addEventListener('input', (e) => {
        const tipo = tipoPix.value;
        let valor = e.target.value;

        if (!formatacoes[tipo].validacao.test(valor)) {
            valor = valor.slice(0, -1);
        }

        e.target.value = formatacoes[tipo].mascara(valor);
    });

    // Adiciona validação no blur (quando o campo perde o foco)
    chavePix.addEventListener('blur', (e) => {
        const tipo = tipoPix.value;
        const valor = e.target.value;

        if (valor && !formatacoes[tipo].validacaoCompleta.test(valor)) {
            errorMessage.textContent = formatacoes[tipo].mensagemErro;
            errorMessage.style.display = 'block';
            chavePix.classList.add('invalid');
        } else {
            errorMessage.style.display = 'none';
            chavePix.classList.remove('invalid');
        }
    });
}

/**
 * Atualiza o valor total das parcelas sempre que um campo de valor é alterado
 * 
 * @function atualizarValorTotalParcelas
 * @returns {void}
 * 
 * @description
 * Esta função:
 * - Obtém a tabela de preços e a linha de total
 * - Verifica se um fornecedor aprovado está definido
 * - Se sim, encontra o índice da coluna correspondente ao fornecedor
 * - Calcula o total subtraindo os valores das parcelas do valor total do fornecedor
 * - Atualiza o rótulo do total com o valor formatado
 * - Adiciona classes CSS para indicar se o total é igual ou diferente do esperado
 */
export function atualizarValorTotalParcelas() {

    const table = document.getElementById('priceTable');
    const headerRow = table.rows[0]; // Primeira linha do cabeçalho
    const totalRow = table.rows[table.rows.length - 2]; // Última linha (linha de total)

    const labelTotal = document.getElementById('valor-total-parcelas');

    if (globais.idFornAprovado) {
        const colIndex = Array.from(headerRow.cells).findIndex(cell => cell.dataset.id_forn === globais.idFornAprovado); // Encontra o índice da coluna do fornecedor aprovado

        if (colIndex !== -1) {
            // Obtém o valor total do fornecedor na linha de total
            const valorTotalFornecedor = totalRow.cells[colIndex - 2].innerText; // +1 para pegar a célula correta

            const valoresParcelas = document.querySelectorAll('#camposData input[name="Valor"]');

            let total = converterStringParaDecimal(valorTotalFornecedor).toFixed(2) || 0; // Inicializa o total com o valor do fornecedor aprovado

            valoresParcelas.forEach(input => {
                const valor = converterStringParaDecimal(input.value).toFixed(2) || 0;
                total -= valor; // Reduz o valor da parcela do total
                total = total.toFixed(2);
            });
            labelTotal.innerText = formatToBRL(total);

            // Compara os valores
            if (total == 0) {
                labelTotal.classList.add('valor-igual');
                labelTotal.classList.remove('valor-diferente');
            } else {
                labelTotal.classList.add('valor-diferente');
                labelTotal.classList.remove('valor-igual');
            }
        } else {
            //DEIXA ZERADO
            labelTotal.innerText = "-";
            labelTotal.classList.add('valor-diferente');
            labelTotal.classList.remove('valor-igual');

        }
    } else {
        labelTotal.innerText = "-";
        labelTotal.classList.add('valor-diferente');
        labelTotal.classList.remove('valor-igual');
    }
}

//=========================================================//
//====================DADOS DE RETENÇÃO====================//
//=========================================================//
// Função para atualizar o valor original com o total do fornecedor aprovado
export function atualizarValorOriginal() {
    const totalFornecedor = calcularTotalFornecedorAprovado(); // Função que você deve implementar
    const valorOriginalCell = document.getElementById('valor-original');
    valorOriginalCell.innerText = formatToBRL(totalFornecedor);
}

// Função para calcular o total do fornecedor aprovado
function calcularTotalFornecedorAprovado() {
    const table = document.getElementById('priceTable').getElementsByTagName('tbody')[0];
    let total = 0;
    const totalCells = table.querySelectorAll('.total-fornecedor');

    totalCells.forEach(cell => {
        total += converterStringParaDecimal(cell.innerText) || 0;
    });

    return total;
}

// Função para calcular o valor total a pagar com base nos descontos
export function calcularValorTotalPagar() {
    const valorOriginal = converterStringParaDecimal(document.getElementById('valor-original').innerText) || 0;
    const descontoCells = document.querySelectorAll('.campos-ret-desc'); // Selecione os inputs de desconto
    let totalDescontos = 0;

    descontoCells.forEach(cell => {
        totalDescontos += converterStringParaDecimal(cell.value) || 0; // Acesse o valor do input
    });

    // Atualiza o valor total de descontos no campo "campos-ret-total-desc"
    const totalDescElements = document.getElementsByClassName('campos-ret-total-desc');
    if (totalDescElements.length > 0) {
        totalDescElements[0].innerText = formatToBRL(totalDescontos); // Acessa o primeiro elemento da coleção
    }

    // Inicializa o valor total a pagar com o valor original
    const valorTotalPagar = valorOriginal - totalDescontos;

    // Soma todos os campos "campos-ret-acr"
    const acrescimoCells = document.querySelectorAll('.campos-ret-acr'); // Selecione os inputs de acréscimo
    let totalAcrescimos = 0;

    acrescimoCells.forEach(cell => {
        totalAcrescimos += converterStringParaDecimal(cell.value) || 0; // Acesse o valor do input
    });

    // Atualiza o valor total a pagar com os acréscimos
    const valorTotalFinal = valorTotalPagar + totalAcrescimos;
    document.getElementById('valor-total-pagar').innerText = formatToBRL(valorTotalFinal);
}

export async function preencherListaAnexosV2(anexos) {
    console.log("[COMEÇOU A RODAR A FUNÇÃO DE CRIAR LISTA DE ANEXOS]");
    await ZOHO.CREATOR.init();
    const galleryElement = document.getElementById('gallery');
    
    if (!galleryElement) {
        console.error('Elemento gallery não encontrado');
        return;
    }

    galleryElement.innerHTML = '';
    
    await new Promise(async (resolve) => {
        
        if (anexos && anexos.length > 0) {
            console.log("==========> TEM ARQUIVOS");
            async function adicionarImagem(img) {
                console.log("=====> ADICIONADO A IMAGEM");
                return new Promise((resolve) => {
                    const newImgEl = document.createElement('img');
                    newImgEl.src = img.src;
                    newImgEl.href = img.src;
                    
                    newImgEl.onload = () => {
                        console.log("=> IMAGEM CARREGADA, ADICIONANDO ATRIBUTOS");
                        const imgContainer = document.createElement('div');
                        imgContainer.classList.add('gallery-item');
                        
                        newImgEl.setAttribute('data-fancybox', 'gallery');
                        newImgEl.setAttribute('data-src', img.src);
                        newImgEl.setAttribute('data-download-src', img.src);
                        
                        imgContainer.appendChild(newImgEl);
                        galleryElement.appendChild(imgContainer);

                        resolve();
                    };
                });
            }
    
            // Carrega todas as imagens primeiro
            let index = 1;
            const promises = []; // Array para armazenar as promessas
            for (const anexo of anexos) {
                console.log("==========> ARUIVO " + index);
                index++;
                const newAnexo = anexo.display_value;
                const fileType = newAnexo.split('.').pop().toLowerCase();
    
                if (['jpg', 'jpeg', 'png', 'gif'].includes(fileType)) {
                    console.log("==========> É IMAGEM ");
                    const imgEl = document.createElement('img');
                    const loadingSpinner = document.createElement('div');
                    loadingSpinner.className = 'customConfirm-loading-spinner';
                    galleryElement.appendChild(loadingSpinner);
                    
                    imgEl.style.display = 'none';
                    console.log("==========> VINCULANDO IMAGEM COM ZOHO");
                    await ZOHO.CREATOR.UTIL.setImageData(imgEl, newAnexo);
                    console.log("==========> IMAGEM VINCULADA");

                    const promise = new Promise((resolve) => {
                        imgEl.onload = async () => {
                            console.log("==========> IMAGEM CARREGADA");
                            loadingSpinner.remove();
                            console.log("==========> EXECUTANDO O ADICIONAR IMAGEM");
                            await adicionarImagem(imgEl);
                            console.log("==========> ADICIONAR IMAGEM EXECUTADA COM SUCESSO");
                            imgEl.style.display = 'block';
                            resolve(); // Resolve a promessa quando a imagem é adicionada
                        };
                    });
                    promises.push(promise); // Adiciona a promessa ao array
                } else {
                    console.log("==========> É ARQUIVO ");
                    const regexID = /\/(\d+)\/anexo_arquivos\.Arquivos/;
                    const regexParentID = /anexo_arquivos\.Arquivos\/(\d+)\/download/;
    
                    const matchPrimeiroID = newAnexo.match(regexID);
                    const parentID = matchPrimeiroID ? matchPrimeiroID[1] : null;
                    const matchSegundoID = newAnexo.match(regexParentID);
                    const fileID = matchSegundoID ? matchSegundoID[1] : null;
                }
            }

            // Aguarda todas as promessas de adição de imagens serem resolvidas
            await Promise.all(promises);
    
            // Inicializa o Fancybox DEPOIS que todas as imagens foram carregadas
            setTimeout(() => {
                console.log("==========> SETANDO PARÂMETROS DA FANCY");
                $.fancybox.defaults.hash = false;
                $('[data-fancybox="gallery"]').fancybox({
                    buttons: [
                        "download",
                        "close"
                    ],
                    modal: false,
                    touch: false,
                    download: true
                });
            }, 500); // Pequeno delay para garantir que todas as imagens foram processadas
    
        } else {
            const p = document.createElement('p');
            p.classList.add('mensagem-anexos');
            p.textContent = 'Não há anexos...';
            galleryElement.appendChild(p);
        }
        resolve();
    });

    // Adiciona o botão de "+" para carregar novos arquivos
    console.log("==========> ADICIONANDO BOTÃO DE ADICIONAR ARQUIVO");
    const botaoAdicionar = document.createElement('button');
    botaoAdicionar.classList.add('botao-adicionar', 'add-btn', 'add-icon');
    botaoAdicionar.style.padding = '10px 20px';
    botaoAdicionar.style.fontSize = '60px';
    botaoAdicionar.style.cursor = 'pointer';

    // Cria um input oculto para seleção de arquivos
    const inputFile = document.createElement('input');
    inputFile.type = 'file';
    inputFile.style.display = 'none'; // Oculta o input

    botaoAdicionar.addEventListener('click', () => {
        inputFile.click(); // Abre o explorador de arquivos
    });

    inputFile.addEventListener('change', async (event) => {
        const files = event.target.files;
        if (files.length > 0) {
            const file = files[0];

            // Verifica o tipo de arquivo
            if (file.type === 'application/pdf') {
                // Converte PDF para JPEG
                const jpegFile = await converterPdfParaJpeg(file);
                await adicionarArquivoAGaleria(jpegFile);
            } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
                       file.type === 'application/msword') {
                // Aqui você pode adicionar a lógica para converter DOC/DOCX para JPEG
                // const jpegFile = await converterDocParaJpeg(file);
                // await adicionarArquivoAGaleria(jpegFile);
            } else {
                await adicionarArquivoAGaleria(file);
            }
        }
    });

    galleryElement.appendChild(inputFile); // Adiciona o input ao DOM
    galleryElement.appendChild(botaoAdicionar);
}

async function adicionarArquivoAGaleria(file) {
    const galleryElement = document.getElementById('gallery');
    // Lógica para adicionar o arquivo à galeria
    const imgContainer = document.createElement('div');
    imgContainer.classList.add('gallery-item');

    const newImgEl = document.createElement('img');
    newImgEl.src = URL.createObjectURL(file); // Cria um URL temporário para o arquivo
    newImgEl.setAttribute('data-fancybox', 'gallery');
    newImgEl.setAttribute('data-src', newImgEl.src);
    newImgEl.setAttribute('data-download-src', newImgEl.src);

    const addBtn = galleryElement.getElementsByClassName('botao-adicionar')[0];

    imgContainer.appendChild(newImgEl);
    galleryElement.insertBefore(imgContainer, addBtn);

    // Inicializa o Fancybox para o novo item
    $.fancybox.defaults.hash = false;
    $('[data-fancybox="gallery"]').fancybox({
        buttons: [
            "download",
            "close"
        ],
        modal: false,
        touch: false,
        download: true
    });
}

// Função para converter PDF para JPEG
async function converterPdfParaJpeg(pdfFile) {
    const pdfData = await pdfFile.arrayBuffer();
    const pdfDoc = await pdfjsLib.getDocument({ data: pdfData }).promise; // Carrega o PDF
    const numPages = pdfDoc.numPages; // Obtém o número total de páginas
    const jpegFiles = []; // Array para armazenar os arquivos JPEG

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        const page = await pdfDoc.getPage(pageNum); // Pega a página atual
        const viewport = page.getViewport({ scale: 2 }); // Define a escala
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const context = canvas.getContext('2d');

        // Renderiza a página no canvas
        await page.render({ canvasContext: context, viewport: viewport }).promise;

        // Converte o canvas para um Blob
        const jpegBlob = await new Promise((resolve) => {
            canvas.toBlob((blob) => {
                resolve(blob);
            }, 'image/jpeg');
        });

        // Adiciona o arquivo JPEG ao array
        jpegFiles.push(new File([jpegBlob], `converted-image-page-${pageNum}.jpeg`, { type: 'image/jpeg' }));
    }

    return jpegFiles; // Retorna o array de arquivos JPEG
}
