import { converterStringParaDecimal, executar_apiZoho } from './utils.js';
import { globais } from './main.js'

const qlt = 4; //Total de linhas de totalizadores, considerando linha com botão de adicionar produto
const ipcv = 3; //Indice da primeira coluna de valores (Valor unitário do primeiro fornecedor)
const qtdCssDecimais = 2; //Quantidade de casas decimais dos campos decimais (Atualmente o campo do zoho suporta apenas 2, para alterar precisa MEXER NO ZOHO)

//==================================================================================================//
//===========================MESCLA OS DADOS DO PDC, TOTAL OU POR PARCELA===========================//
//==================================================================================================//
async function splitDataByInstallments(status = null) {
    const log = true;
    const reqType = document.querySelector('select[name="Tipo_de_solicitacao"]').options[document.querySelector('select[name="Tipo_de_solicitacao"]').selectedIndex].text;
    const pgtoAnt = document.getElementById('pag_antecipado').checked;

    if(log) console.log("++++++++++CRIANDO DADOS DE CADA UMA DAS PARCELAS NÃO CRIADAS++++++++++");
    if(log) console.log("status => ", status);
    if(log) console.log("reqType => ", reqType);
    if(log) console.log("pgtoAnt => ", pgtoAnt);

    const advInstallment = document.getElementById('pag_antecipado').checked;
    if(log) console.log("advInstallment => ", advInstallment);

    let installments = [];
    console.log("pag => ", globais.pag);
    console.log("reqType => ", reqType);
    console.log("advInstallment => ", advInstallment);
    if ((["confirmar_compra"].includes(globais.pag) && reqType != "SERVIÇO") || (["criar_numero_de_PDC"].includes(globais.pag) && globais.perfilResponsavel.includes("Depto. Pessoal")) && advInstallment === true) {
        installments = [document.querySelectorAll('.parcela')[0]];
    } else {
        installments = document.querySelectorAll('.parcela');
    }

    const numInstallments = installments.length;
    if(log) console.log("numInstallments => ", numInstallments);

    const newPDCs = new Map();
    if(log) console.log("=> PEGANDO ARQUIVOS <=");
    const files = await getGalleryFiles();
    if(log) console.log("=> PEGANDO DADOS DA NF <=");
    const NFData = pegarDadosNF_V2();
    
    if(log) console.log("=> PEGANDO DADOS DE PARCELAS <=");
    installments.forEach((installment, index) => {

        if(log) console.log("indexInstallment => ", index);
        const isCreated = installment.querySelector('input[name="parcela_criada"]').hasAttribute('checked');
        if(log) console.log("isCreated => ", isCreated);

        if (!isCreated) {

            if(log) console.log("=> PARCELA AINDA NÃO CRIADA, PEGANDO DADOS <=");
            const currTempPDC = numInstallments > 1 || pgtoAnt === true ? `${globais.numPDC_temp}/${(index + 1).toString().padStart(2, '0')}` : globais.numPDC_temp;
            if(log) console.log("currTempPDC => ", currTempPDC);

            const initialDataPDC = pegarDadosPDC_V2(index, currTempPDC);

            const currPDCInstallment = initialDataPDC.Datas[0].Num_PDC_parcela ? initialDataPDC.Datas[0].Num_PDC_parcela : globais.numPDC;
            if(log) console.log("initialDataPDC.Num_PDC_parcela => ", initialDataPDC.Datas[0].Num_PDC_parcela);
            if(log) console.log("currPDCInstallment => ", currPDCInstallment);

            const [priceTableData, extraDataPDC] = pegarDadostabPrecos(currTempPDC, currPDCInstallment, numInstallments);
            if(log) console.log("priceTableData => ", priceTableData);
            if(log) console.log("extraDataPDC => ", extraDataPDC);

            const classData = pegarDadosClassificacao_V2(numInstallments);

            const allDataPDC = { ...initialDataPDC, ...extraDataPDC, ...classData, ...NFData };
            if (status !== null) allDataPDC.Status_geral = status;
            newPDCs.set(index, { 'priceTableData': priceTableData, 'PDCsData': allDataPDC, 'Files': { ...files } });
            //
            const parcelaCriadaInput = installment.querySelector('input[name="parcela_criada"]');
            if (parcelaCriadaInput) {
                parcelaCriadaInput.setAttribute('checked', 'checked');
            }
        }
    });
    if(log) console.log("----------DADOS CRIADOS, RETORNANDO MAPA----------");
    return newPDCs
}

async function meshData(status = null) {

    const NFData = pegarDadosNF_V2();
    const [priceTableData, extraDataPDC] = pegarDadostabPrecos();
    const initialDataPDC = pegarDadosPDC_V2();
    const classData = pegarDadosClassificacao_V2();
    console.log("NFDdata => ", NFData);
    const allDataPDC = { ...initialDataPDC, ...extraDataPDC, ...classData, ...NFData };
    if (status !== null) allDataPDC.Status_geral = status;
    console.log("allDataPDC => ", JSON.stringify(allDataPDC));
    const newPDCs = new Map();
    newPDCs.set(0, { 'priceTableData': priceTableData, 'PDCsData': allDataPDC, 'Files': {} });
    return newPDCs
}

//===========================================================================//
//===========================BUSCA OS DADOS DO PDC===========================//
//===========================================================================//
/**
 * Busca os dados do PDC.
 * 
 * @function pegarDadosPDC_V2
 * @param {number} ttlParc - Número total de parcelas.
 * @param {number} indiceParc - Índice da parcela a ser buscada.
 * @function pegarDadosPDC
 * @returns {Object} Os dados do PDC.
 * 
 * @description
 * Esta função busca os dados iniciais e detalhes do PDC a partir de formulários e os organiza em um objeto.
 * 
 * - Se ttlParc for informado, a função busca os dados de todas as parcelas.
 * - Se indiceParc for informado, a função busca os dados apenas da parcela com o índice especificado.
 */
function pegarDadosPDC_V2(indiceParc = null, currTempPDC = null) {
    
    const log = true;

    if(log) console.log("++++++++++BUSCANDO DADOS DO PDC++++++++++");
    //====================BUSCA OS DADOS INICIAIS DO PDC====================//
    if(log) console.log("=> BUSCANDO DADOS INICIAIS DO PDC <=");
    const formDdsInicais = document.querySelector('#dados-PDC');
    const dadosIniciaisPdc = {};

    // Obter todos os elementos do formulário
    const elementos = formDdsInicais.elements;
    for (let elemento of elementos) {
        // Verifica se o campo tem um valor e se está visível (caso de campos ocultos)
        if (elemento.name && (elemento.type !== 'radio' || elemento.checked)) {
            dadosIniciaisPdc[elemento.name] = elemento.value;
            if(log) console.log("Nome: " + elemento.name + ", Valor: " + elemento.value);
        }
    }
    dadosIniciaisPdc["id_temp"] = currTempPDC ? currTempPDC : globais.numPDC_temp;
    if(log) console.log("Nome: " + "id_temp" + ", Valor: " + JSON.stringify(dadosIniciaisPdc.id_temp));


    //====================BUSCA OS DADOS DETALHES DO PDC====================//
    if(log) console.log("=> BUSCANDO DETALHES DO PDC <=");
    const formDdsDetalhes = document.querySelector('#form-pagamento');

    // Obter todos os elementos do formulário
    const parcelas = indiceParc !== null ? [formDdsDetalhes.querySelectorAll('.parcela')[indiceParc]] : formDdsDetalhes.querySelectorAll('.parcela');
    const vencimentos = [];

    parcelas.forEach(parcela => {
        const numParc = parcela.querySelector('label');
        const dataInput = parcela.querySelector('input[type="date"]');
        const valorInput = parcela.querySelector('input[name="Valor"]');
        const numPDC = parcela.querySelector('input[name="Num_PDC_parcela"]');
        const parcCriada = parcela.querySelector('input[name="parcela_criada"]');
        

        const vencimentoObj = {};
        if (numParc?.textContent) {
            vencimentoObj["Numero_da_parcela"] = parseInt(numParc.textContent.match(/\d+/)[0]);
        }
        if (dataInput?.value) {
            const [ano, mes, dia] = dataInput.value.split('-');
            vencimentoObj["Vencimento_previsto"] = `${dia}/${mes}/${ano}`;
        }
        if (valorInput?.value) {
            vencimentoObj["Valor"] = converterStringParaDecimal(valorInput.value, qtdCssDecimais);
        }
        if (numPDC?.value) {
            vencimentoObj["Num_PDC_parcela"] = numPDC.value;
            
        }

        vencimentoObj["parcela_criada"] = indiceParc !== null || parcCriada?.checked?true:false;

        // Adiciona o objeto ao array apenas se tiver pelo menos uma propriedade
        if (Object.keys(vencimentoObj).length > 0) {
            vencimentos.push(vencimentoObj);
        }

        if(log) console.log("Nome: " + "Numero_da_parcela" + ", Valor: " + vencimentoObj["Numero_da_parcela"]);
        if(log) console.log("Nome: " + "Vencimento_previsto" + ", Valor: " + vencimentoObj["Vencimento_previsto"]);
        if(log) console.log("Nome: " + "Valor" + ", Valor: " + vencimentoObj["Valor"]);
        if(log) console.log("Nome: " + "Num_PDC_parcela" + ", Valor: " + vencimentoObj["Num_PDC_parcela"]);
        if(log) console.log("Nome: " + "parcela_criada" + ", Valor: " + vencimentoObj["parcela_criada"]);
    });

    // Adiciona outros campos do formulário
    const elementosDetalhes = formDdsDetalhes.elements;
    for (let elemento of elementosDetalhes) {
        if (!elemento.classList.contains("campo-datas")) {
            if (elemento.type !== 'radio') {
                if (elemento.checked) {
                    dadosIniciaisPdc[elemento.name] = elemento.checked;
                } else {
                    dadosIniciaisPdc[elemento.name] = elemento.value;
                }
                if(log) console.log("Nome: " + elemento.name + ", Valor: " + elemento.value);

            } else if (elemento.checked) {
                dadosIniciaisPdc[elemento.name] = elemento.value;
                if(log) console.log("Nome: " + elemento.name + ", Valor: " + elemento.value);

            }
        }
    }

    if(log) console.log("=> BUSCANDO DETALHES DA PARCELA <=");
    if (vencimentos.length > 0) {
        dadosIniciaisPdc["Datas"] = vencimentos;
        // Adiciona o primeiro vencimento em um campo separado para referência
        if (vencimentos[0].Vencimento_previsto) {
            dadosIniciaisPdc["Vencimento_previsto"] = vencimentos[0].Vencimento_previsto;

        }
        if (vencimentos[0].Num_PDC_parcela) {
            dadosIniciaisPdc["Numero_do_PDC"] = indiceParc == null && vencimentos[0].Num_PDC_parcela.includes("/")?globais.numPDC:vencimentos[0].Num_PDC_parcela;
        }

        if(log) console.log("Nome: " + "Vencimento_previsto" + ", Valor: " + vencimentos[0].Vencimento_previsto);
        if(log) console.log("Nome: " + "Num_PDC_parcela" + ", Valor: " + vencimentos[0].Num_PDC_parcela);

    }
    if (globais.perfilResponsavel != null) {
        dadosIniciaisPdc["Perfil_responsavel"] = globais.perfilResponsavel;
        if(log) console.log("Nome: " + "Perfil_responsavel" + ", Valor: " + globais.perfilResponsavel);
    }

    if(log) console.log("----------RETORNANDO DADOS DO PDC----------");
    return dadosIniciaisPdc;
}

//================================================================================//
//====================BUSCA OS DADOS DA CLASSIFICAÇÃO CONTÁBIL====================//
//================================================================================//
/**
 * Busca os dados de classificação.
 * 
 * @function pegarDadosClassificacao
 * @returns {Object} Os dados de classificação.
 * 
 * @description
 * Esta função busca os dados de classificação a partir de um formulário e os organiza em um objeto.
 */
function pegarDadosClassificacao_V2(qtdParc = 1) {
    const log = true;

    if(log) console.log("++++++++++BUSCANDO DADOS DE CLASSIFICAÇÃO CONTÁBIL++++++++++");

    // Busca o formulário de classificação
    const formClassificacao = document.getElementById('form-classificacao');
    const linhasClassificacao = formClassificacao.querySelectorAll('.linha-classificacao');
    const dadosClassificacao = {};
    const classificacoes = [];

    // Itera sobre cada linha de classificação
    linhasClassificacao.forEach(linha => {
        const classificacao = {};

        // Busca os selects e inputs da linha atual
        const selects = linha.querySelectorAll('input[type="select"]');
        const inputs = linha.querySelectorAll('input[type="text"], input[type="number"]');

        // Adiciona os valores dos selects ao objeto da classificação
        selects.forEach(select => {
            if (select.name && select.dataset.id_opcao) {
                classificacao[select.name] = select.dataset.id_opcao;
            } else {
                classificacao[select.name] = select.value;
            }
            if(log) console.log("Nome: " + select.name + ", Valor: " + classificacao[select.name]);
        });

        // Adiciona os valores dos inputs ao objeto da classificação
        inputs.forEach(input => {
            if (input.name && input.value) {
                // Se for um campo de valor, converte para decimal
                if (input.classList.contains('input-number')) {
                    classificacao[input.name] = converterStringParaDecimal(converterStringParaDecimal(input.value) / qtdParc, qtdCssDecimais);
                } else {
                    classificacao[input.name] = input.value;
                }
                if(log) console.log("Nome: " + input.name + ", Valor: " + classificacao[input.name]);
            }

        });

        // Adiciona a classificação ao array apenas se tiver algum valor preenchido
        if (Object.keys(classificacao).length > 0) {
            classificacoes.push(classificacao);
        }
    });

    // Adiciona o array de classificações ao objeto final apenas se houver dados
    if (classificacoes.length > 0) {
        dadosClassificacao["Classificacao_contabil"] = classificacoes;
    }
    if(log) console.log("----------RETORNANDO DADOS DE CLASSIFICAÇÃO CONTÁBIL----------");
    return dadosClassificacao;
}

//===================================================================================//
//====================BUSCA OS DADOS DO FORMULÁRIO DE NOTA FISCAL====================//
//===================================================================================//
/**
 * Busca os dados do formulário de Nota Fiscal.
 * 
 * @function pegarDadosNF
 * @returns {Object} Os dados do formulário de Nota Fiscal.
 * 
 * @description
 * Esta função busca os dados do formulário de Nota Fiscal e os organiza em um objeto.
 */
function pegarDadosNF_V2() {
    const log = true;
    if(log) console.log("++++++++++BUSCANDO DADOS DA NOTA FISCAL++++++++++");
    const formDdsNF = document.querySelector('#dados-nf');
    const dadosNF = {};

    // Obter todos os elementos do formulário, exceto os das linhas dinâmicas de NF
    const elementosNF = formDdsNF.querySelectorAll(':scope > :not(#linhas-nf) input, :scope > :not(#linhas-nf) select, :scope > :not(#linhas-nf) textarea');
    elementosNF.forEach(elemento => {
        if (elemento.classList.contains('input-number')) {
            dadosNF[elemento.name] = converterStringParaDecimal(elemento.value, qtdCssDecimais);
        } else if (elemento.type == "date" && elemento.value) { // Verifica se o campo não está vazio
            const [ano, mes, dia] = elemento.value.split('-');
            dadosNF[elemento.name] = `${dia}/${mes}/${ano}`;
        } else {
            dadosNF[elemento.name] = elemento.value;
        }
    });

    // Adicionar dados das linhas dinâmicas de NF
    const linhasNF = document.querySelectorAll('#linhas-nf .linha-nf');
    dadosNF.Dados_da_nota_fiscal1 = [];
    linhasNF.forEach(linha => {
        const linhaDados = {};
        const inputs = linha.querySelectorAll('input');
        inputs.forEach(input => {
            if (input.type === 'date' && input.value) {
                const [ano, mes, dia] = input.value.split('-');
                linhaDados[input.name] = `${dia}/${mes}/${ano}`;
            } else {
                linhaDados[input.name] = input.value;
            }
        });
        dadosNF.Dados_da_nota_fiscal1.push(linhaDados);
    });

    // Adiciona os dados dos tds usando o atributo name como chave
    const valorOriginal = document.querySelector('#valor-original');
    const totalDescontos = document.querySelector('#descontos-total');
    const valorTotalPagar = document.querySelector('#valor-total-pagar');

    if (valorOriginal && valorOriginal.hasAttribute('name')) {
        dadosNF[valorOriginal.getAttribute('name')] = converterStringParaDecimal(valorOriginal.textContent || '', qtdCssDecimais);
    }
    if (totalDescontos && totalDescontos.hasAttribute('name')) {
        dadosNF[totalDescontos.getAttribute('name')] = converterStringParaDecimal(totalDescontos.textContent || '', qtdCssDecimais);
    }
    if (valorTotalPagar && valorTotalPagar.hasAttribute('name')) {
        dadosNF[valorTotalPagar.getAttribute('name')] = converterStringParaDecimal(valorTotalPagar.textContent || '', qtdCssDecimais);
    }
    if(log) console.log("dadosNF => ", JSON.stringify(dadosNF));

    //throw new Error("Erro forçado, para teste");

    return dadosNF;
}



//====================================================================================//
//====================BUSCA OS DADOS DA TABELA DE PREÇOS (COTAÇÃO)====================//
//====================================================================================//
/**
 * Busca os dados da tab de preços.
 * 
 * @function pegarDadostabPrecos
 * @returns {Object} Os dados da tab de preços e dados extras do PDC.
 * 
 * @description
 * Esta função busca os dados da tab de preços, incluindo os fornecedores, valores unitários, totais, frete, descontos e outros detalhes.
 */
function pegarDadostabPrecos(currTempPDC = null, currPDC = null, qtdParc = 1) {
    //====================BUSCA OS DADOS DA TAB DE PREÇOS====================//
    const tab = document.getElementById('priceTable');

    // Variáveis da primeira tab (Tabela de Preços)
    const cabecalho1 = tab.rows[0];
    const linhaFrete = tab.rows[tab.rows.length - qlt];
    const linhaDescontos = tab.rows[tab.rows.length - (qlt - 1)];
    const linhaTotal = tab.rows[tab.rows.length - (qlt - 2)];

    const corpoTab = tab.getElementsByTagName('tbody')[0].rows;
    const dadosExtras = {};
    const dados = [];

    // Variáveis da segunda tab (Detalhes das Cotações)
    const tabDetalhes = document.getElementById('otherDataTable');
    const linhasDetalhes = tabDetalhes.getElementsByTagName('tbody')[0].rows;

    const fornecedores = [];
    const custosFrete = [];
    const descontos = [];
    const totalGeral = [];
    const idsFornecedores = [];

    // Captura os fornecedores da tab
    for (let i = 0; i < cabecalho1.cells.length; i++) {
        if (cabecalho1.cells[i].colSpan > 1) {
            const nomeFornecedor = cabecalho1.cells[i].innerText.trim().replace(/ \u00d7$/, '');
            const idFornecedor = cabecalho1.cells[i].dataset.id_forn;
            idsFornecedores.push(idFornecedor);
            fornecedores.push(nomeFornecedor);

            const frete = converterStringParaDecimal((linhaFrete.cells[i - (ipcv - 1)].innerText) || '0', qtdCssDecimais);//É -1 PORQUE BUSCA O INDICE DA ULTIMA LINHA DE APOIO E NÃO DA PRIMEIRA LINHA DE VALORES
            custosFrete.push(frete);

            const desconto = converterStringParaDecimal((linhaDescontos.cells[i - (ipcv - 1)].innerText) || '0', qtdCssDecimais);//É -1 PORQUE BUSCA O INDICE DA ULTIMA LINHA DE APOIO E NÃO DA PRIMEIRA LINHA DE VALORES
            descontos.push(desconto);

            const total = converterStringParaDecimal((linhaTotal.cells[i - (ipcv - 1)].innerText) || '0', qtdCssDecimais);//É -1 PORQUE BUSCA O INDICE DA ULTIMA LINHA DE APOIO E NÃO DA PRIMEIRA LINHA DE VALORES
            totalGeral.push(total);
        }
    }

    // Captura os produtos e valores da tab //
    for (let i = 0; i < corpoTab.length - qlt; i++) {
        const linha = corpoTab[i];
        const idProduto = linha.dataset.id_produto;
        const produto = linha.cells[0]?.innerText || '';
        const quantidade = converterStringParaDecimal(linha.cells[1]?.innerText || '0', qtdCssDecimais);
        const unidade = linha.cells[2]?.innerText || '';

        if (fornecedores.length > 0) {
            for (let j = 0; j < fornecedores.length; j++) {
                const idFornecedor = idsFornecedores[j];
                const indicePrecoUnitario = ipcv + j * 2;
                const indicePrecoTotal = indicePrecoUnitario + 1;
                const fornecedor = fornecedores[j];
                const valorFrete = custosFrete[j];
                const valorDesconto = descontos[j];
                const valorTotalGeral = totalGeral[j];

                const valorUnitario = converterStringParaDecimal((linha.cells[indicePrecoUnitario]?.innerText) || '0', qtdCssDecimais);
                const valorTotal = converterStringParaDecimal((linha.cells[indicePrecoTotal]?.innerText) || '0', qtdCssDecimais);

                const condicaoPagamento = linhasDetalhes[j].cells[1]?.innerText || '';
                const observacao = linhasDetalhes[j].cells[2]?.innerText || '';

                const fornecedorAprovado = cabecalho1.cells[j + ipcv].querySelector('input[type="checkbox"]')?.checked || fornecedores.length === 1;
                if (fornecedorAprovado) {
                    dadosExtras["Beneficiario"] = fornecedor;
                    dadosExtras["Valor_orcado"] = converterStringParaDecimal((valorTotalGeral / qtdParc) || 0, qtdCssDecimais);
                }

                const dadosLinha = {
                    id_produto: idProduto,
                    id_fornecedor: idFornecedor,
                    Produto: produto,
                    Quantidade: quantidade,
                    Unidade: unidade,
                    Fornecedor: fornecedor,
                    Valor_unitario: valorUnitario,
                    Valor_total: valorTotal,
                    Valor_do_frete: valorFrete,
                    Descontos: valorDesconto,
                    Total_geral: valorTotalGeral,
                    Condicoes_de_pagamento: condicaoPagamento,
                    Observacoes: observacao,
                    numero_de_PDC: currPDC ? currPDC : globais.numPDC,
                    num_PDC_temp: currTempPDC ? currTempPDC : globais.numPDC_temp,
                    Aprovado: fornecedorAprovado,
                    Versao: 1,
                    Ativo: true
                };
                dados.push(dadosLinha);
            }
        } else {
            const dadosLinha = {
                id_produto: idProduto,
                Produto: produto,
                Quantidade: quantidade,
                Unidade: unidade,
                numero_de_PDC: currPDC ? currPDC : globais.numPDC,
                num_PDC_temp: currTempPDC ? currTempPDC : globais.numPDC_temp,
                Versao: 1,
                Ativo: true,
            };
            dados.push(dadosLinha);
        }
    }
    return [dados, dadosExtras];
}

//=================================================================================================//
//===========================BUSCA OS ARQUIVOS PARA CARREGAR NO NOVO PDC===========================//
//=================================================================================================//
async function getGalleryFiles() {

    return await new Promise((resolve, reject) => {

        const apGalleryItems = document.querySelectorAll('.gallery-item');
        const galleryItems = Array.prototype.slice.call(apGalleryItems, 0, -2);
        const files = Array.from(galleryItems).map(item => {
            if (item.firstChild && item.firstChild.hasAttribute('data-src')) {
                const dataSrc = item.firstChild.getAttribute('data-src');
                return {
                    type: getItemType(dataSrc),
                    data: getItemData(dataSrc),
                };
            } else {
                return {};
            }
        });

        const promises = files.map(file => {
            if (file.data) {
                return Promise.resolve({ ...file, data: file.data });
            } else {
                return Promise.resolve(file);
            }
        });

        Promise.all(promises).then(resolve).catch(reject);
    });
}

function getItemType(base64String) {
    const match = base64String.match(/^data:([^;]+);base64,/);
    return match && match[1];
}

function getItemData(base64String) {
    const fileType = getItemType(base64String);
    const fileContent = atob(base64String.replace(`data:${fileType};base64,`, ''));
    const fileContentArray = new Uint8Array(fileContent.length);
    for (let i = 0; i < fileContent.length; i++) {
        fileContentArray[i] = fileContent.charCodeAt(i);
    }

    const file = new File([fileContentArray], `arquivo.${fileType.split('/')[1]}`, {
        type: fileType,
        lastModified: new Date().getTime(),
        size: fileContentArray.length,
    });
    /*
    setTimeout(() => {
        downloadFile(file);
    }, 100);
    */
    return file;
}

//================================================================//
//===========================SALVA TUDO===========================//
//================================================================//
/**
 * Salva os dados da tab.
 * 
 * @function saveTableData
 * @param {Object} options - Opções para a função.
 * @param {String} options.tipo - Tipo de ação a ser realizada (editar ou criar).
 * @returns {Promise} Uma promessa que resolve após a conclusão da ação.
 * 
 * @description
 * Esta função é responsável por salvar os dados da tab. Se uma cotação já existe, ela limpa a cotação antiga e salva a nova. Caso contrário, cria uma nova cotação.
 */
export async function saveTableData_V2({status = null, sepPorParc = false, paramsExtraPDC = {}}) {
    const log = true;
    if(log) console.log("++++++++++SALVANDO COTAÇÃO++++++++++");
    if(log) console.log("status => ", status);
    if(log) console.log("sepPorParc => ", sepPorParc);
    if(log) console.log("paramsExtraPDC => ", paramsExtraPDC);

    if (globais.cotacaoExiste) {
        if(log) console.log("=> COTAÇÃO EXISTE <=");
        if (sepPorParc === false) {
            if(log) console.log("*Não é separação por parcela, limpando dados da cotação");
            for (const id of globais.idsCotacao) {
                let payload = {
                    data: {
                        Ativo: false
                    }
                };
                await executar_apiZoho({ tipo: "atualizar_reg", ID: id, corpo: payload });
            }

            globais.cotacaoExiste = false;

        } else {
            if(log) console.log("*É separação por parcela");
            globais.cotacaoExiste = false;

        }

        if(log) console.log("*Marca que cotação não existe");
        await saveTableData_V2({status, sepPorParc, paramsExtraPDC});

    } else {
        if(log) console.log("=> COTACAO NÃO EXISTE <=");

        const PDCsToSave = sepPorParc ? await splitDataByInstallments(status) : await meshData(status);

        const apoioTipoAnt = globais.tipo;
        if (sepPorParc === true) globais.tipo = 'criar_pdc';
    
        for (let i = 0; i < PDCsToSave.size; i++) {

            //====================CRIA O REGISTRO DO PDC====================//
            const chave = Array.from(PDCsToSave.keys())[i];
            const pdcData = PDCsToSave.get(chave);
            const dadostabPrecos = pdcData.priceTableData;
            const dadosPDC = {
                ...pdcData.PDCsData,
                ...paramsExtraPDC
            };
            const arquivos = Object.keys(pdcData.Files).reduce((acc, curr) => {
                if (pdcData.Files[curr].data) acc[curr] = pdcData.Files[curr];
                return acc;
            }, {});

            if(log) console.log("1. dadostabPrecos => ", dadostabPrecos);
            if(log) console.log("2. dadosPDC => ", JSON.stringify(dadosPDC, null, 2));
            if(log) console.log("3. arquivos => ", arquivos);

            let respPDC;
            let idNovoPDC = null;
            if (globais.tipo === 'editar_pdc') {
                if(log) console.log("É EDIÇÃO DE PDC!");
                let payload = {
                    data: dadosPDC
                };

                respPDC = await executar_apiZoho({ tipo: "atualizar_reg", ID: globais.idPDC, corpo: payload, nomeR: globais.nomeRelPDC });
            } else {
                if(log) console.log("É CRIAÇÃO DE PDC!");
                if(log) console.log("DADOS DO PDC ===> ", JSON.stringify(dadosPDC, null, 2));
                respPDC = await executar_apiZoho({ tipo: "add_reg", corpo: JSON.stringify(dadosPDC, null, 2), nomeF: globais.nomeFormPDC });

                //Verifica se a resposta foi bem-sucedida e se globais.idPDC é null
                if (respPDC.code === 3000) {
                    if (globais.idPDC === null) globais.idPDC = respPDC.data.ID; // Preenche globais.idPDC com o ID retornado
                    idNovoPDC = respPDC.data.ID;
                }

            }
            if(log) console.log("respPDC => ", JSON.stringify(respPDC, null, 2));

            //====================CRIA O REGISTRO DOS ARQUIVOS GALERIA================//
            const qtdFiles = sepPorParc === true ? Object.keys(arquivos).length : globais.arquivosGaleria.length;

            if (qtdFiles > 0) {
                const dataList = [];

                for (let i = 0; i < qtdFiles; i++) {
                    dataList.push({ PDC_Digital: idNovoPDC !== null ? idNovoPDC : globais.idPDC });
                }

                const respFilesRec = await executar_apiZoho({ tipo: "add_reg", corpo: dataList, nomeF: "laranj_arquivos_pdc" });
                if(log) console.log("respFilesRec => ", JSON.stringify(respFilesRec, null, 2));
                if (respFilesRec.result.every(item => item.code === 3000)) {

                    const idArquivos = respFilesRec.result.map(item => item.data.ID);

                    let indexFile = 0;
                    for (const id of idArquivos) {
                        let blob;
                        if (sepPorParc === true) {
                            blob = arquivos[indexFile++].data;
                        } else {
                            blob = globais.arquivosGaleria[indexFile++];
                        }

                        const respFileUpload = await executar_apiZoho({ tipo: "subir_arq", nomeR: "laranj_arquivos_pdc_Report", ID: id, corpo: blob });
                        if (respFileUpload.code !== 3000) {
                            if(log) console.log("Erro ao subir o arquivo, erro: ", respFileUpload);
                            if(log) console.log("Arquivo: ", blob);
                            break;
                        }
                    }

                } else {
                    if(log) console.log("Erro ao criar o registro de arquivos, erro: ", respFilesRec);
                    if(log) console.log("Arquivo: ", blob);
                }
            }

            //====================CRIA O REGISTRO DA COTAÇÃO====================//
            const json = JSON.stringify(dadostabPrecos, null, 2);
            let respCot = await executar_apiZoho({ tipo: "add_reg", corpo: json });

        }
        globais.cotacaoExiste = true;
        globais.tipo = apoioTipoAnt;
    }
}

export async function tratarSalvamentoPDC({ acao = null }) {
    //TODOS OS DADOS//
    /**
     * Dados iniciais do PDC
     * Toda a tabela de cotação
     * Tabela do fornecedor aprovado
     * Detalhes dos fornecedores
     * Dados de forma de pagamento
     * Dados de parcelas (Sem separar)
     * Dados de parcelas separando as marcadas (Pagamento de sinal)
     * Dados de parcelas separando as não separadas (Compra recebida)
     * Dados de nota fiscal
     * Dados de retenção
     * Dados de classificação (Sem separar)
     * Dados de classificação separando as marcadas (Pagamento de sinal)
     * Dados de classificação separando as não separadas (Compra recebida)
     * Anexos novos e removidos
     * Duplicar anexos (Pagamento de sinal)
     * Duplicar anexos (Compra recebida)
     * Alterar Status
     */

}