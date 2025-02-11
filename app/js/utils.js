import { saveTableData_V2 } from './save_utils.js';
import { globais } from './main.js';

/**
 * Executa requisições para a API do Zoho Creator
 * 
 * @async
 * @function executar_apiZoho
 * @param {Object} params - Parâmetros da requisição
 * @param {string} [params.tipo] - Tipo de operação: "add_reg", "atualizar_reg", "busc_reg", "busc_reg_recursivo"
 * @param {string} [params.criterios] - Critérios de busca para operações de consulta
 * @param {string} [params.ID] - ID do registro para atualização
 * @param {Object} [params.corpo] - Dados para criação/atualização de registros
 * @param {string} [params.nomeR] - Nome do relatório (report) no Zoho
 * @param {string} [params.nomeF] - Nome do formulário no Zoho
 * @returns {Promise<Object>} Resultado da operação na API
 * 
 * @description
 * Esta função centraliza as operações com a API do Zoho Creator, permitindo:
 * - Buscar registros (simples ou recursivamente)
 * - Criar novos registros
 * - Atualizar registros existentes
 * - Buscar e armazenar dados de fornecedores
 * 
 * Funções internas:
 * - busc_reg: Busca registros com paginação
 * - criar_reg: Cria novo registro
 * - atualizar_reg: Atualiza registro existente
 * - buscarFornecedores: Popula o Map baseFornecedores
 * - buscarRecursivamente: Busca registros recursivamente com paginação
 */
export async function executar_apiZoho({ tipo = null, criterios = null, ID = null, corpo = null, nomeR = null, nomeF = null } = {}) {
    try {
        nomeR = nomeR ? nomeR : globais.nomeRelCot;
        nomeF = nomeF ? nomeF : globais.nomeFormCot;
        await ZOHO.CREATOR.init();
        let recOps = await ZOHO.CREATOR.API;

        // Função de buscar registro
        async function busc_reg(nomeR, criterio, numPag) {
            const config = {
                appName: globais.nomeApp,
                reportName: nomeR,
                criteria: criterio,
                page: numPag,
                pageSize: 200
            };
            return recOps.getAllRecords(config);
        }

        // Função de criar registro
        async function criar_reg(ddsCriacao) {

            ddsCriacao = { "data": ddsCriacao };
            const config = {
                appName: globais.nomeApp,
                formName: nomeF,
                data: ddsCriacao
            };
            return recOps.addRecord(config);
        }

        // Função de atualizar registro
        async function atualizar_reg(nomeR, ID, corpo) {

            return await recOps.updateRecord({
                appName: globais.nomeApp,
                reportName: nomeR,
                id: ID,
                data: corpo
            });
        }

        async function buscarRecursivamente(nomeR, criterio) {
            let baseApoio = new Map();
            let paginaAtual = 1;

            try {
                while (true) {
                    const resp = await busc_reg(nomeR, criterio, paginaAtual);

                    // Verifica se é a resposta de "nenhum registro encontrado" (código 3100)
                    if (resp && resp.code === 3100) {
                        break;
                    }

                    // Verifica outras condições de parada
                    if (!resp || resp.code !== 3000 || !Array.isArray(resp.data) || resp.data.length === 0) {
                        break;
                    }

                    // Processa os dados recebidos
                    resp.data.forEach((item) => {
                        const id = item.ID || item.C_digo_da_classe_operacional;
                        baseApoio.set(id, item);
                    });

                    paginaAtual++;
                }
            } catch (err) {
                // Loga apenas erros que não sejam do tipo "nenhum registro encontrado"
                if (!err.responseText?.includes('"code":3100')) {
                    console.error("Erro ao buscar dados:", err);
                }
            }

            return Array.from(baseApoio.values());
        }

        async function subirArquivos() {
            const config = {
                appName: globais.nomeApp,
                reportName: nomeR,
                id: ID,
                fieldName: 'Arquivos',
                file: corpo
            }

            return await recOps.uploadFile(config);
        }

        // Funções solicitadas conforme tipo
        if (tipo === "add_reg") {

            return await criar_reg(corpo);
        } else if (tipo === "atualizar_reg") {

            return await atualizar_reg(nomeR, ID, corpo);
        } else if (tipo === "busc_reg") {

            return await busc_reg(nomeR, criterios, 1);
        } else if (tipo === "busc_reg_recursivo") {

            return await buscarRecursivamente(nomeR, criterios);
        } else if (tipo === "subir_arq") {
            return await subirArquivos();
        }
    } catch (err) {
        return err;
    }
}

export function formatToBRL_V2(v, nd = 2) {
    const log = false;
    if (log) console.log("[+++++FORMATANDO PARA BRL+++++]");
    if (log) console.log("Número de decimais => ", nd);

    if (v.dataset && v.dataset.valor_original) {
        delete v.dataset.valor_original;
    }

    if (!v) return "0,00";//Se for vazio, volta 0,00


    let av; //Apoio ao valor
    let int = false; //Flag para inteiro
    let isNeg = false; //Flag para negativo

    //Busca o valor do evento e verifica se é um inteiro
    const elemento = v.target || v;
    if ((typeof elemento == "string" || typeof elemento == "number")) {
        av = converterStringParaDecimal(elemento);
    } else {

        av = elemento.innerText || elemento.value;
        int = elemento.classList?.contains("integer-cell") || false;
    }
    if (!av) return "0,00";

    const vo = av; //Valor original, sem ajuste, para evitar arredondamento
    if (log) console.log("Valor original VO => ", vo);
    if (log) console.log("Valor em decimal => ", av);
    // Verifica se é negativo
    if (av.toString().startsWith('-')) {
        isNeg = true;
        av = av.toString().substring(1);
    }

    if (log) console.log("Valor bruto sem sinal => ", av);
    // Ajusta o tipo (Inteiro ou decimal) e adiciona os zeros
    av = int ? av : converterStringParaDecimal(av);
    const [pi, pd] = av.toString().split('.');


    if (log) console.log("Parte inteira => ", pi);
    if (log) console.log("Parte decimal => ", pd);
    //AJUSTA PARTE DECIMAL PARA O NUMERO DE CASAS DECIMAIS INDICADO
    let apd;
    if (pd && pd.length > nd) {
        apd = pd.slice(0, nd);
    } else {
        apd = (pd || '') + '0'.repeat(nd - (pd || '').length);
    }
    if (log) console.log("Apoio decimal => ", apd);

    // Cria o valor final em formato de BRL
    let vf;
    if ((pi === undefined && pd === undefined)) {
        vf = `0,${apd}`;
    } else if (int) {
        vf = `${pi || 0}${apd || ''}`;
    } else {
        vf = `${pi || 0},${apd}`;
    }

    //let vf = (pi === undefined && pd === undefined) ? '0,00' : int ? `${pi || 0}${pd || ''}` : `${pi || 0},${(pd || '').slice(0, nd)}`;
    if (log) console.log("Valor final sem sinal=> ", vf);
    // Adiciona o sinal negativo de volta se necessário
    if (isNeg) {
        vf = `-${vf}`;
    }

    if (log) console.log("Valor original => ", vo);
    if (log) console.log("Valor final => ", vf);
    if (log) console.log("[-----FORMATAÇÃO CONCLUÍDA-----]");

    if (v.innerText || v.value) {
        const target = 'value' in v ? 'value' : 'innerText';
        v[target] = vf;
        v.dataset.valor_original = vo;
        v.addEventListener('focus', () => { if (log) console.log("[+++++FOCUS+++++]"); v[target] = v.dataset.valor_original || '' });
        return;
    } else {
        return vf;
    }
}

/**
 * Converte uma string em um valor decimal, removendo caracteres não numéricos
 * e padronizando a formatação
 * 
 * @function converterStringParaDecimal 
 * @param {string|number|HTMLElement} valor - Valor ou elemento a ser convertido
 * @returns {number} Valor decimal formatado
 *
 * @example
 * converterStringParaDecimal("ABC123") // retorna 123.00
 * converterStringParaDecimal("ABC123.12") // retorna 123.12
 * converterStringParaDecimal(elementoHTML) // atualiza o innerText e retorna o valor
 */
export function converterStringParaDecimal(valor, nd = null) {

    const log = false;

    if (log) console.log("[+++++CONVERTENDO STRING PARA DECIMAL+++++]");
    // Verifica se é um elemento HTML
    const isElement = valor && typeof valor === 'object' && 'innerText' in valor;
    const valorOriginal = isElement ? valor.innerText : valor;

    if (!valorOriginal) return 0.00;
    // Remove todos os caracteres não numéricos exceto ponto e vírgula
    let numeroLimpo = valorOriginal.toString().replace(/[^\d.,\-]/g, '');

    if (log) console.log("Valor limpo => ", numeroLimpo);

    // Trata números negativos
    const isNegative = numeroLimpo.startsWith('-');
    numeroLimpo = numeroLimpo.replace('-', '');

    if (log) console.log("Valor limpo sem sinal => ", numeroLimpo);

    // Conta quantos pontos e vírgulas existem
    const qtdPontos = (numeroLimpo.match(/\./g) || []).length;
    const qtdVirgulas = (numeroLimpo.match(/,/g) || []).length;

    if (log) console.log("Quantidade de pontos => ", qtdPontos);
    if (log) console.log("Quantidade de vírgulas => ", qtdVirgulas);

    // Se tiver mais de um separador do mesmo tipo, considera como separador de milhar
    if (qtdPontos > 1 || qtdVirgulas > 1) {
        numeroLimpo = numeroLimpo.replace(/[.,]/g, '');
    } else if (qtdPontos === 1 && qtdVirgulas === 1) {
        const posicaoPonto = numeroLimpo.lastIndexOf('.');
        const posicaoVirgula = numeroLimpo.lastIndexOf(',');

        if (posicaoPonto > posicaoVirgula) {
            numeroLimpo = numeroLimpo.replace(',', '');
        } else {
            numeroLimpo = numeroLimpo.replace('.', '').replace(',', '.');
        }
    } else if (qtdVirgulas === 1) {
        numeroLimpo = numeroLimpo.replace(',', '.');
    }

    if (log) console.log("Valor limpo apenas com ponto => ", numeroLimpo);

    let [pi, pd] = numeroLimpo.toString().split('.');

    // Ajusta a quantidade de casas decimais
    if (nd !== null) {
        pd = pd ? pd.slice(0, nd) : '0'.repeat(nd);
    }

    if (log) console.log("Parte inteira => ", pi);
    if (log) console.log("Parte decimal => ", pd);
    // Converte para número e fixa em nd casas decimais
    const numConcat = (pi || '0') + '.' + pd;
    if (log) console.log("Numero concatenado => ", numConcat);
    let numeroFinal = parseFloat(numConcat);

    //if(log) console.log("Valor final sem ajuste de casas decimais => ", numeroFinal);

    //numeroFinal = isNaN(numeroFinal) ? 0.00 : nd !== null ? Math.floor(numeroFinal * 10**nd) / 10**nd : numeroFinal;

    if (log) console.log("Valor final => ", numeroFinal);

    // Aplica o sinal negativo se necessário
    if (isNegative) {
        numeroFinal = -numeroFinal;
    }

    if (log) console.log("Valor final com sinal => ", numeroFinal);
    if (log) console.log("[------CONVERSÃO FINALIZADA------]");

    // Se for um elemento HTML, atualiza o innerText com o valor formatado
    if (isElement) {
        valor.innerText = numeroFinal
    }

    return numeroFinal;
}

/**
 * Converte um número positivo para negativo
 * 
 * @function convertToNegative
 * @param {number} v - Valor numérico a ser convertido
 * @returns {number} Valor convertido para negativo se positivo, ou mantém o valor se já for negativo
 */
export function convertToNegative(v) {
    return v > 0 ? (v * -1) : v;
}

/**
 * Restringe o conteúdo de células a apenas valores numéricos
 * 
 * @function restrictNumericInput
 * @param {HTMLElement} obj - Elemento HTML que contém o texto a ser filtrado
 * @description
 * - Remove todos os caracteres não numéricos, exceto pontos e vírgulas
 * - Atualiza o innerText do elemento com o valor filtrado
 */
export function restrictNumericInput(obj) {
    const input = obj.innerText;
    const filteredInput = input.replace(/[^0-9.,]/g, '');
    if (input !== filteredInput) {
        obj.innerText = filteredInput;
    }
}

/**
 * Restringe o conteúdo de células a apenas números inteiros
 * 
 * @function restrictIntegerInput
 * @param {Event|HTMLElement} event - Evento do DOM ou elemento HTML direto
 * @description
 * - Aceita tanto um evento quanto um elemento HTML direto
 * - Remove todos os caracteres não numéricos
 * - Atualiza o innerText do elemento com o valor filtrado
 */
export function restrictIntegerInput(event) {
    // Verifica se recebeu um evento ou um elemento direto
    const element = event.target || event;

    if (!element || !element.innerText) return;

    const input = element.innerText;
    const filteredInput = input.replace(/[^0-9]/g, '');

    if (input !== filteredInput) {
        element.innerText = filteredInput;
    }
}

/**
 * Converte um número para o formato brasileiro (0.000,00)
 * 
 * @function convertNumberFormat
 * @param {string|number} number - Número a ser formatado
 * @returns {string} Número formatado no padrão brasileiro ou string vazia em caso de erro
 * @description
 * - Remove formatação anterior de pontos e vírgulas
 * - Converte para número e formata com 2 casas decimais
 * - Retorna o valor formatado usando toLocaleString
 */
export function convertNumberFormat(number) {
    try {
        if (typeof number === 'string') {
            // Remove qualquer formatação anterior de pontos e vírgulas
            number = number.replace(/[^\d.-]/g, '');
        }
        let numericValue = parseFloat(number);
        if (!isNaN(numericValue)) {
            return numericValue.toLocaleString('pt-BR', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });
        } else {
            return '';
        }
    } catch (err) {
        return '';
    }
}

function createEl(tag, className = '', innerHTML = '') {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (innerHTML) element.innerHTML = innerHTML;
    return element;
}

/**
 * Cria e exibe um modal customizado com diferentes funcionalidades
 * 
 * @async
 * @function customModal
 * @param {Object} params - Parâmetros de configuração do modal
 * @param {HTMLElement} [params.botao=null] - Botão que acionou o modal (opcional)
 * @param {string} params.tipo - Tipo do modal ('ajustar_cot', 'arquivar_cot', 'salvar_cot', etc)
 * @param {string} [params.titulo=null] - Título do modal (opcional)
 * @param {string} params.mensagem - Mensagem principal do modal
 * @param {string} [params.confirmText='Confirmar'] - Texto do botão de confirmação
 * @param {string} [params.cancelText='Cancelar'] - Texto do botão de cancelamento
 * @param {string} [params.loadingText='Carregando, aguarde...'] - Texto exibido durante carregamento
 * 
 * @description
 * Esta função cria um modal customizado com as seguintes características:
 * 
 * - Estrutura base:
 *   - Overlay que cobre a tela
 *   - Popup central com título (opcional)
 *   - Mensagem principal
 *   - Área de input (para tipos específicos)
 *   - Botões de confirmação e cancelamento
 *   - Indicador de carregamento
 * 
 * - Tipos de modal suportados:
 *   - ajustar_cot: Modal para solicitar ajustes na cotação
 *   - arquivar_cot: Modal para arquivar cotação
 *   - salvar_cot: Modal para salvar cotação
 * 
 * - Funcionalidades:
 *   - Validação de campos obrigatórios
 *   - Feedback visual de erros
 *   - Estado de carregamento durante operações
 *   - Integração com API Zoho para atualizações
 *   - Recarregamento da página após operações bem-sucedidas
 * 
 * @example
 * // Modal básico de confirmação
 * customModal({
 *   tipo: 'salvar_cot',
 *   mensagem: 'Deseja salvar as alterações?'
 * });
 * 
 * // Modal com input e título
 * customModal({
 *   tipo: 'ajustar_cot',
 *   titulo: 'Solicitar Ajuste',
 *   mensagem: 'Descreva o ajuste necessário:',
 *   confirmText: 'Enviar'
 * });
 */
export async function customModal({ botao = null, tipo = null, titulo = null, mensagem, confirmText = 'Confirmar', cancelText = 'Cancelar', loadingText = 'Carregando, aguarde...' }) {
    if (tipo === null) {
        tipo = 'editar_pdc';
    }

    const pgtoAnt = document.getElementById('pag_antecipado').checked;
    /*
    if(globais.pag === "criar_cotacao_DP" || globais.pag === "editar_cotacao_DP")
    {
        tipo = globais.pag;
    }
    */

    // Criação da estrutura base
    const overlay = createEl('div', 'customConfirm-overlay-div');
    const popup = createEl('div', 'customConfirm-div');
    const messageElement = createEl('p', 'customConfirm-message', mensagem);
    // Cria o elemento de loading
    const loadingElement = createEl('div', 'customConfirm-loading',
        `<div class="customConfirm-loading-spinner"></div> ${loadingText}`);

    // Adiciona título se fornecido
    if (titulo) {
        popup.appendChild(createEl('h3', 'customConfirm-title', titulo));
    }

    // Configuração do input para tipos específicos
    const inputConfig = {
        'ajustar_cot': {
            placeholder: 'Ex.: Gostaria que o valor de frete fosse alterado...',
            buttonClass: 'customAdjust-confirmButton'
        },
        'arquivar_cot': {
            placeholder: 'Ex.: Arquivo devido a não resposta do fornecedor...',
            buttonClass: 'customArchive-confirmButton'
        },
        'solicitar_ajuste_ao_compras': {
            placeholder: 'Ex.: Produto veio quebrado, não recebido...',
            buttonClass: 'customAdjust-confirmButton'
        }
    };

    // Adiciona input se necessário
    let inputElement;
    if (inputConfig[tipo]) {
        inputElement = createEl('textarea', 'customAdjust-textarea');
        inputElement.placeholder = inputConfig[tipo].placeholder;
        Object.assign(inputElement.style, {
            width: '300px',
            height: '100px',
            resize: 'none',
        });
    }

    // Criação dos botões
    const buttonContainer = createEl('div', 'customConfirm-button-container');
    const confirmButton = createEl('button', `customConfirm-confirmButton ${inputConfig[tipo]?.buttonClass || ''}`, confirmText);
    const cancelButton = createEl('button', 'customConfirm-cancelButton', cancelText);

    // Aplica estilo ao container dos botões
    Object.assign(buttonContainer.style, {
        display: 'flex',
        gap: '10px',
        justifyContent: 'center',
        marginTop: '20px'
    });

    // Adiciona os botões ao container
    buttonContainer.append(confirmButton, cancelButton);

    // Função para esconder/mostrar elementos
    const toggleElements = (show) => {
        // Esconde/mostra o título se existir
        const titleElement = popup.querySelector('.customConfirm-title');
        if (titleElement) titleElement.style.display = show ? 'block' : 'none';

        // Esconde/mostra a mensagem
        messageElement.style.display = show ? 'block' : 'none';

        // Esconde/mostra a textarea se existir
        if (inputElement) {
            inputElement.style.display = show ? 'block' : 'none';
        }

        // Esconde/mostra os botões
        buttonContainer.style.display = show ? 'flex' : 'none';

        // Esconde/mostra o loading (inverso dos outros elementos)
        loadingElement.style.display = show ? 'none' : 'flex';

        // Remove a mensagem de erro quando mostrar o loading
        const errorMessage = popup.querySelector('.customConfirm-error-message');
        if (errorMessage) {
            errorMessage.style.display = show ? 'block' : 'none';
        }
    };

    // Handlers dos botões
    const handleConfirm = async () => {
        // Verifica se o tipo de solicitação é "SERVIÇO"
        const tipoSolicitacao = document.querySelector('select[name="Tipo_de_solicitacao"]').options[document.querySelector('select[name="Tipo_de_solicitacao"]').selectedIndex].text;

        function getDates(t = null) {
            console.log("\\\\\\\\\\\\\\\\\\\\\\\\\\\\\ESTÁ USANDO O GETDATES//////////////////////////////////")
            let listDatas = [];
            const formDdsDetalhes = document.querySelector('#form-pagamento');
            const parcelas = formDdsDetalhes.querySelectorAll('.parcela');

            let indiceParcela = 0;
            parcelas.forEach(parcela => {
                const numParc = parcela.querySelector('label');
                const dataInput = parcela.querySelector('input[type="date"]');
                const valorInput = parcela.querySelector('input[name="Valor"]');
                const numPDC = parcela.querySelector('input[name="Num_PDC_parcela"]');

                const dadosParcela = {};
                if (numParc?.textContent) {
                    dadosParcela.Numero_da_parcela = parseInt(numParc.textContent.match(/\d+/)[0])
                }
                if (pgtoAnt && indiceParcela === 0 && t === "confirmar_compra") {
                    dadosParcela.parcela_criada = true
                } else {
                    dadosParcela.parcela_criada = false
                }
                if (dataInput?.value) {
                    const [ano, mes, dia] = dataInput.value.split('-');
                    dadosParcela.Vencimento_previsto = `${dia}/${mes}/${ano}`
                }
                if (valorInput?.value) {
                    dadosParcela.Valor = converterStringParaDecimal(valorInput.value)
                }
                if (numPDC?.value) {
                    dadosParcela.Num_PDC_parcela = numPDC.value
                }

                listDatas.push(dadosParcela);
                indiceParcela++;
            })
            return listDatas;
        }

        if (inputElement && !inputElement.value.trim()) {
            // Remove mensagem de erro anterior se existir
            const existingError = popup.querySelector('.customConfirm-error-message');
            if (existingError) {
                existingError.remove();
            }

            const errorMessage = createEl('p', 'customConfirm-error-message', "Preencha o campo de observação...");
            // Inserir após o inputElement ao invés de antes
            inputElement.insertAdjacentElement('afterend', errorMessage);

            // Aplicar estilos mantendo o textarea centralizado
            Object.assign(inputElement.style, {
                width: '300px',
                height: '100px',
                resize: 'none',
                border: '1px solid #ff5a5a',
                borderRadius: '4px',
                transition: 'border 0.2s ease',
                margin: '0 auto',  // Mantém centralizado
                display: 'block'   // Garante que ocupe a linha inteira
            });

            Object.assign(errorMessage.style, {
                margin: '5px 0 0 0',
                fontSize: '10pt',
                color: '#ff5a5a',
                textAlign: 'center' // Centraliza o texto de erro
            });

            return;
        }

        const url = 'https://guillaumon.zohocreatorportal.com/';
        toggleElements(false);

        // Determina o payload baseado no tipo de ação
        let payload;
        // Mapeia os tipos de ação   para os payloads correspondentes
        const payloadMap = {
            'enviar_p_checagem_final': {
                Status_geral: 'Enviado para checagem final'
            },
            'enviar_p_assinatura':
            {
                Status_geral: 'Assinatura Confirmada Controladoria'
            },
            'autorizar_pagamento_sindico': {
                Status_geral: 'Assinatura Confirmada Sindico'
            },
            'autorizar_pagamento_subsindico': {
                Status_geral: 'Assinatura Confirmada Sub Sindico'
            },
            'confirmar_todas_as_assinaturas': {
                Status_geral: 'Autorizado para pagamento'
            }
        };

        // Verifica se o tipo está no mapa e cria o payload
        if (payloadMap[tipo]) {

            // Verifica se o tipo é valido//
            ////{Ação:seprara por parcela}////
            const tiposValidos = {
                "criar_cotacao_DP": false,
                "editar_cotacao_DP": false,
                "criar_cotacao_controladoria": false,
                "editar_cotacao_controladoria": false,
                "solicitar_aprovacao_sindico": false,
                "finalizar_provisionamento": false,
                "enviar_p_checagem_final": false,
                "enviar_p_assinatura": false,
                "confirmar_compra": pgtoAnt ? true : false,
                "confirmar_recebimento": true
            };

            if (Object.keys(tiposValidos).includes(tipo)) {
                let status = null;
                if (tipo === "confirmar_recebimento") {
                    status = "Recebimento confirmado";
                } else if (tipo === "criar_cotacao_controladoria" || tipo === "editar_cotacao_controladoria") {
                    status = "Propostas criadas controladoria";
                } else if (tipo === "confirmar_compra") {
                    status = "Enviado para checagem final";
                }
                await saveTableData_V2(status, tiposValidos[tipo]);
            }

            payload = { data: [{ ...payloadMap[tipo] }] };
            //payload = { data: [{ ...payloadMap[tipo], Datas: getDates(tipo) }] };

        } else if (tipo === 'salvar_cot' || tipo === 'editar_pdc') {

            toggleElements(false);
            try {
                console.log("TENTANDO SALVAR COTACAO")
                await saveTableData_V2();

                window.open(`${url}#Script:page.refresh`, '_top');
                return;
            } catch (erro) {
                console.error('Erro ao salvar cotação:', erro);
                toggleElements(true);
                messageElement.innerHTML = 'Ocorreu um erro ao salvar a cotação. Tente novamente.';
                return;
            }
        } else if (tipo === 'remover_fornecedor' || tipo === 'remover_produto') {
            overlay.remove();
            return Promise.resolve(true);
        } else if (tipo === 'duplicar_pdc') {
            //MODIFICA PARA QUE UMA CÓPIA SEJA CRIADA
            globais.cotacaoExiste = false;

            //CRIA UM NOVO ID TEMPORÁRIO PARA A CÓPIA E LIMPA O NUMERO DO PDC
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            const seconds = String(now.getSeconds()).padStart(2, '0');

            globais.numPDC_temp = `${year}_${month}_${day}_${hours}_${minutes}_${seconds}`;
            globais.numPDC = null;

            //MUDA O TIPO DE SALVAMENTO
            globais.tipo = "criar_pdc";

            //LIMPA AS CÉLULAS DE QUANTIDADE E VALOR UNITÁRIO
            const quantidadeTds = document.querySelectorAll('td.quantidade');
            const valorUnitTds = document.querySelectorAll('td.valor-unit');
            const totalForns = document.querySelectorAll('td.total-fornecedor');
            [...quantidadeTds, ...valorUnitTds, ...totalForns].forEach(td => {
                td.textContent = '';
                if (td.dataset.valor_original) delete td.dataset.valor_original;

                // Limpar a célula do lado direito se for valor unitário
                if (td.classList.contains('valor-unit')) {
                    const nextTd = td.nextElementSibling;
                    if (nextTd) {
                        nextTd.textContent = '';
                        if (nextTd.dataset.valor_original) delete nextTd.dataset.valor_original;
                    }
                }
            });

            //LIMPA OS FORNECEDORES APROVADOS
            const elemsAprovados = document.querySelectorAll('.forn-aprovado');
            elemsAprovados.forEach(elem => {
                elem.classList.remove('forn-aprovado');
            });

            //LIMPA AS LINHAS DE PARCELAS
            const divsParcela = document.querySelectorAll('div.parcela');
            divsParcela.forEach(div => {
                div.remove();
            });
            //LIMPA AS CÉLULAS DE VALOR DA CLASSIFICAÇÃO CONTÁBIL
            const formClassificacao = document.querySelector('#form-classificacao');
            const inputsValor = formClassificacao.querySelectorAll('input[name="Valor"]');
            inputsValor.forEach(input => {
                input.value = '';
            });

            await saveTableData_V2("Propostas criadas");
            window.open(`${url}#Report:Laranj_sol_em_andamento`, '_top');
            return;
        }

        try {
            console.log("PAYLOAD => ", JSON.stringify(payload));
            const resposta = await executar_apiZoho({
                tipo: "atualizar_reg",
                ID: globais.idPDC,
                corpo: payload,
                nomeR: globais.nomeRelPDC
            });
            console.log("RESPOSTA => ", JSON.stringify(resposta));

            // Fecha o modal após sucesso
            if (resposta && resposta.code === 3000) {
                overlay.remove();
                if (tipo == "confirmar_compra") {

                    // Obtém o valor da entidade selecionada
                    const entidadeSelecionada = document.getElementById('entidade').value;

                    let link_layout;
                    // [LAYOUT]
                    if (entidadeSelecionada == "3938561000066182591") {
                        link_layout = `${url}guillaumon/app-envio-de-notas-boletos-guillaumon/pdf/Laranj_layout_impressao_pedido?ID_entry=${globais.idPDC}&id_pdc=${globais.idPDC}&zc_PdfSize=A4&zc_FileName=${globais.numPDC}_Laranjeiras`;
                    }
                    else if (entidadeSelecionada == "3938561000066182595") {
                        link_layout = `${url}guillaumon/app-envio-de-notas-boletos-guillaumon/pdf/AssociacaoServir_layout_impressao_pedido?ID_entry=${globais.idPDC}&id_pdc=${globais.idPDC}&zc_PdfSize=A4&zc_FileName=${globais.numPDC}_Ass_Servir`;
                    }

                    window.open(`${link_layout}`, '_blank', 'noopener,noreferrer');
                }

                // Opcional: recarregar a página ou atualizar a interface
                window.open(`${url}#Script:page.refresh`, '_top');
            } else {
                throw new Error('Falha na atualização');
            }
        } catch (erro) {
            console.error('Erro ao processar requisição:', erro);
            // Volta para o estado normal do modal em caso de erro
            toggleElements(true);
            // Opcional: mostrar mensagem de erro para o usuário
            messageElement.innerHTML = 'Ocorreu um erro ao processar sua solicitação. Tente novamente.';
        }
    };

    // Montagem final do popup
    popup.append(
        messageElement,
        ...(inputElement ? [inputElement] : []),
        buttonContainer,
        loadingElement
    );

    overlay.appendChild(popup);
    document.body.appendChild(overlay);

    // Retorna uma Promise que será resolvida quando o usuário interagir com o modal
    return new Promise((resolve) => {
        confirmButton.addEventListener('click', () => {
            handleConfirm().then(result => {
                resolve(result);
            });
        });
        cancelButton.addEventListener('click', () => {
            overlay.remove();
            resolve(false);
        });
    });
}

export async function customModal_V2({ acao = null, tipoAcao = 'confirm', titulo = null, mensagem, confirmText = 'Confirmar', cancelText = 'Cancelar', loadingText = 'Carregando, aguarde...' }) {
    const log = true;
    if (log) console.log("++++++++++CRIANDO MODAL CUSTOMIZADO++++++++++");
    if (log) console.log("+++ACAO => ", acao);
    if (log) console.log("+++TIPO DE ACAO => ", tipoAcao);
    if (log) console.log("+++TITULO => ", titulo);
    if (log) console.log("+++MENSAGEM => ", mensagem);
    if (log) console.log("+++CONFIRM TEXT => ", confirmText);
    if (log) console.log("+++CANCEL TEXT => ", cancelText);
    if (log) console.log("+++LOADING TEXT => ", loadingText);

    //==========CRIA OS ELEMENTOS DO MODAL==========\\
    const overlay = createEl('div', 'customConfirm-overlay-div');
    const popup = createEl('div', 'customConfirm-div');
    const messageElement = createEl('p', 'customConfirm-message', mensagem);

    const loadingElement = createEl('div', 'customConfirm-loading',
        `<div class="customConfirm-loading-spinner"></div> ${loadingText}`);

    if (titulo) {
        popup.appendChild(createEl('h3', 'customConfirm-title', titulo));
    }
    //==========DEFINE CONFIGURAÇÕES PARA CAMPO DE INPUT, CASO PRECISE==========\\
    const inputConfig = {
        'ajustar_cot': {
            placeholder: 'Ex.: Gostaria que o valor de frete fosse alterado...',
            buttonClass: 'customAdjust-confirmButton'
        },
        'arquivar_cot': {
            placeholder: 'Ex.: Arquivo devido a não resposta do fornecedor...',
            buttonClass: 'customArchive-confirmButton'
        },
        'solicitar_ajuste_ao_compras': {
            placeholder: 'Ex.: Produto veio quebrado, não recebido...',
            buttonClass: 'customAdjust-confirmButton'
        },
        'lancar_pdc_ahreas': {
            placeholder: 'Número do lançamento no ahreas, Ex.: 9712345...',
            buttonClass: 'customAdjust-confirmButton'
        }
    };

    //==========CRIA O ELEMENTO DE INPUT, CASO PRECISE==========\\
    let inputElement;
    if (inputConfig[acao]) {
        inputElement = createEl('textarea', 'customAdjust-textarea');
        inputElement.placeholder = inputConfig[acao].placeholder;
        Object.assign(inputElement.style, {
            width: '300px',
            height: '100px',
            resize: 'none',
        });
        if (log) console.log("Input criado!");
    }
    if (log) console.log("Passou do input!");

    //==========CRIA OS BOTÕES BASEADO NA AÇÃO (ALERT OU CONFIRM)==========\\
    const buttonContainer = createEl('div', 'customConfirm-button-container');
    const confirmButton = createEl('button', `customConfirm-confirmButton ${inputConfig[tipo]?.buttonClass || ''}`, confirmText);
    buttonContainer.append(confirmButton);

    let cancelButton;
    if (tipoAcao === 'confirm') {
        cancelButton = createEl('button', 'customConfirm-cancelButton', cancelText);
        buttonContainer.append(cancelButton);
    }

    //==========ALTERNAR VISIBILIDADE DE ELEMENTOS==========\\
    const alternVisibEl = (show) => {
        // Esconde/mostra o título se existir
        const titleElement = popup.querySelector('.customConfirm-title');
        if (titleElement) titleElement.style.display = show ? 'block' : 'none';

        // Esconde/mostra a mensagem
        messageElement.style.display = show ? 'block' : 'none';

        // Esconde/mostra a textarea se existir
        if (inputElement) {
            inputElement.style.display = show ? 'block' : 'none';
        }

        // Esconde/mostra os botões
        buttonContainer.style.display = show ? 'flex' : 'none';

        // Esconde/mostra o loading (inverso dos outros elementos)
        loadingElement.style.display = show ? 'none' : 'flex';
        // Remove a mensagem de erro quando mostrar o loading
        const errorMessage = popup.querySelector('.customConfirm-error-message');
        if (errorMessage) {
            errorMessage.style.display = show ? 'block' : 'none';
        }
    };

    //==========FINALIZADA CRIAÇÃO DO MODAL E APLICA A PÁGINA PRINCIPAL==========\\
    popup.append(
        messageElement,
        ...(inputElement ? [inputElement] : []),
        buttonContainer,
        loadingElement
    );

    overlay.appendChild(popup);
    document.body.appendChild(overlay);

    //==========RETORNA UMA PROMISE QUE SERÁ RESOLVIDA QUANDO O USUÁRIO INTERAGIR COM O MODAL==========\\
    return new Promise((resolve) => {
        confirmButton.addEventListener('click', () => {
            alternVisibEl(false);
            tratarRespModal({ acao: acao, infoInserida: inputElement ? inputElement.value : null }).then(result => {
                if (result === true) {
                    overlay.remove();
                }
                resolve(result);
            });
        });
        if (cancelButton) {
            cancelButton.addEventListener('click', () => {
                overlay.remove();
                resolve(false);
            });
        }
    });
}


export async function tratarRespModal({ acao, infoInserida = null }) {
    const log = false;
    if (log) console.log("++++++++++TRATANDO RESPOSTA POSITIVA DO MODAL++++++++++");
    if (log) console.log("acao => ", acao);
    if (log) console.log("infoInserida => ", infoInserida);

    if (
        [
            'salvar_cot',
            'criar_cotacao',
            'editar_cot',
            'solicitar_aprovacao_sindico',
            'corrigir_erros',
            'ajustar_cot',
            'aprov_cot',
            'arquivar_cot',
            'finalizar_provisionamento',
            'confirmar_compra',
            'confirmar_recebimento',
            'solicitar_ajuste_ao_compras',
            'enviar_p_checagem_final',
            'tratar_control',
            'enviar_p_assinatura',
            'autorizar_pagamento_sindico',
            'autorizar_pagamento_subsindico',
            'confirmar_todas_as_assinaturas',
            "lancar_pdc_ahreas",
            "confirmar_pag_ahreas",
            "suspender_pagamento"
        ].includes(acao)) {
            /*
        const valido = validateFields(acao);
        if (!valido) return false;
        */
        await prepararParaSalvar(acao, infoInserida);
    }
    if (log) console.log("----------RESPOSTA TRATADA, RETORNANDO TRUE----------");
    return true;
}

async function prepararParaSalvar(acao, infoInserida = null) {
    const tipoSolicitacao = document.querySelector('select[name="Tipo_de_solicitacao"]').options[document.querySelector('select[name="Tipo_de_solicitacao"]').selectedIndex].text;
    const parcelaCriada = document.getElementsByName('parcela_criada')[0].checked;
    const log = false;
    if (log) console.log("++++++++++PREPARANDO PARA SALVAR++++++++++");
    if (log) console.log("acao => ", acao);
    if (log) console.log("infoInserida => ", infoInserida);
    let alcada_temp = null;

    /*
    if(acao === "autorizar_pagamento_subsindico")
    {
        let crit = `(ID!=0)`;
        
        const resp = await executar_apiZoho({
            tipo: "busc_reg", 
            criterios: crit, 
            nomeR: "ADM_Alcadas_temporarias_cadastradas"
        });
    }
    */

    const paramExtra = {};
    const url = 'https://guillaumon.zohocreatorportal.com/';
    const pgtoAnt = document.getElementById('pag_antecipado').checked;
    const statusMap = {
        salvar_cot: { 
            status: globais.pag === "criar_numero_de_PDC" ? 
                null : 
                globais.pag === "ajustar_compra_compras"?
                    "Recebimento confirmado":
                    "Propostas criadas" 
        },
        criar_cotacao: { status: globais.pag === "criar_numero_de_PDC" ? null : "Propostas criadas" },
        editar_cot: { status: globais.pag === "criar_numero_de_PDC" ? null : "Propostas criadas" },
        corrigir_erros: { status: globais.pag === "criar_numero_de_PDC" ? null : "Propostas criadas" },
        solicitar_aprovacao_sindico: { status: "Aguardando aprovação de uma proposta" },
        ajustar_cot: { status: "Ajuste solicitado", paramsExtraPDC: { Solicitacao_de_ajuste: infoInserida } },
        aprov_cot: {
            status:
                globais.perfilResponsavel.includes("Depto. Pessoal") &&
                    parcelaCriada ? "Enviado para checagem final" :
                    "Proposta aprovada"
        },
        arquivar_cot: { status: "Proposta arquivada" },
        finalizar_provisionamento: {
            status:
                globais.perfilResponsavel.includes("Depto. Pessoal") &&
                    !parcelaCriada ? "Separado em parcelas" :
                    "Lançado no orçamento"
        },
        confirmar_compra: {
            status: tipoSolicitacao === 'SERVIÇO' || pgtoAnt ? 'Recebimento confirmado' : 'Compra realizada',
            sepPorParc: tipoSolicitacao === 'SERVIÇO' || pgtoAnt,
            paramsExtraPDC: { pag_antecipado: false }
        },
        confirmar_recebimento: { status: "Recebimento confirmado", sepPorParc: true },
        solicitar_ajuste_ao_compras: { status: "Ajuste solicitado pós checagem", paramsExtraPDC: { Solicitacao_de_ajuste: infoInserida } },
        enviar_p_checagem_final: { status: "Enviado para checagem final"},
        tratar_control: { paramsExtraPDC: {Status_controladoria: "Tratado" } },
        enviar_p_assinatura: { status: "Assinatura Confirmada Controladoria" },
        autorizar_pagamento_subsindico: { status: "Autorizado para pagamento" },
        autorizar_pagamento_sindico: { status: "Assinatura Confirmada Sindico" },
        confirmar_todas_as_assinaturas: { status: "Autorizado para pagamento" },
        lancar_pdc_ahreas: { paramsExtraPDC: { Status_Guillaumon: "Lançado no ahreas", num_lanc_ahreas : infoInserida} },
        confirmar_pag_ahreas: { status: "Pagamento realizado", paramsExtraPDC: {Status_Guillaumon: "Pagamento confirmado"}},
        suspender_pagamento:{ status: "Pagamento suspenso"}
    };

    if (acao in statusMap) {
        const params = statusMap[acao];

        await saveTableData_V2(params);

        if (acao.includes("finalizar_provisionamento")) {
            if (globais.perfilResponsavel.includes("Depto. Pessoal")) {
                document.getElementById('pag_antecipado').setAttribute('checked', 'checked');
                await saveTableData_V2({ status: "Enviado para checagem final", sepPorParc: true });
                //=====REMOVE ALGUNS DADOS DO PDC E FAZ A COPIA DAS PARCELAS=====\\
                //CRIA UM NOVO ID TEMPORÁRIO PARA A CÓPIA E LIMPA O NUMERO DO PDC
                const now = new Date();
                const year = now.getFullYear();
                const month = String(now.getMonth() + 1).padStart(2, '0');
                const day = String(now.getDate()).padStart(2, '0');
                const hours = String(now.getHours()).padStart(2, '0');
                const minutes = String(now.getMinutes()).padStart(2, '0');
                const seconds = String(now.getSeconds()).padStart(2, '0');

                globais.numPDC_temp = `${year}_${month}_${day}_${hours}_${minutes}_${seconds}`;
                globais.numPDC = null;

                //LIMPA AS CÉLULAS DE QUANTIDADE E VALOR UNITÁRIO
                const valorUnitTds = document.querySelectorAll('td.valor-unit');
                const totalForns = document.querySelectorAll('td.total-fornecedor');
                [...valorUnitTds, ...totalForns].forEach(td => {
                    td.textContent = '';
                    if (td.dataset.valor_original) delete td.dataset.valor_original;

                    // Limpar a célula do lado direito se for valor unitário
                    if (td.classList.contains('valor-unit')) {
                        const nextTd = td.nextElementSibling;
                        if (nextTd) {
                            nextTd.textContent = '';
                            if (nextTd.dataset.valor_original) delete nextTd.dataset.valor_original;
                        }
                    }
                });

                //LIMPA AS CÉLULAS DE VALOR DA CLASSIFICAÇÃO CONTÁBIL
                const formClassificacao = document.querySelector('#form-classificacao');
                const inputsValor = formClassificacao.querySelectorAll('input[name="Valor"]');
                inputsValor.forEach(input => {
                    input.value = '';
                });
                document.getElementById('pag_antecipado').removeAttribute('checked');

                await saveTableData_V2({ status: "Propostas criadas", sepPorParc: true, paramExtra: { pag_antecipado: false } });

            }
        } else if (acao === 'confirmar_compra') {
            if (tipoSolicitacao === 'SERVIÇO') {
                await saveTableData_V2({ status: "Separado em parcelas" });
            } else if (pgtoAnt) {
                await saveTableData_V2({ status: "Compra realizada", paramExtra: { pag_antecipado: false } });
            }

            const entidadeSelecionada = document.getElementById('entidade').value;
            const layoutMap = {
                "3938561000066182591": "Laranj_layout_impressao_pedido",
                "3938561000066182595": "AssociacaoServir_layout_impressao_pedido"
            };
            const layoutName = layoutMap[entidadeSelecionada];
            if (layoutName) {
                const link_layout = `${url}guillaumon/app-envio-de-notas-boletos-guillaumon/pdf/${layoutName}?ID_entry=${globais.idPDC}&id_pdc=${globais.idPDC}&zc_PdfSize=A4&zc_FileName=${globais.numPDC}_${layoutName.split('_')[0]}`;
                window.open(link_layout, '_blank', 'noopener,noreferrer');
            }
        } else if (acao === 'confirmar_recebimento') {
            await saveTableData_V2({ status: "Separado em parcelas" });
        }
        window.open(`${url}#Script:page.refresh`, '_top');
    }
    if (log) console.log("----------PROCESSO DE SALVAMENTO CONCLUÍDO----------");
}

/**
 * Oculta todos os campos da página, exceto os especificados
 * 
 * @function ocultarCamposExcessao
 * @description
 * Esta função oculta todos os campos da página, exceto:
 * - Entidade
 * - Datas
 * - Valor
 * - Campos que precisam estar habilitados:
 *   let campos = ["Entidade", "Datas", "Valor", "Valor"];
 *   let camposCond = {"quantidade": "Poder alterar somente para menos", "valor-unit": "Poder alterar somente para menos, ou até um real a mais"};
 *   let botoes = ["add-parcela", "remover-parcela"];
 *   let forms = ["form-pagamento", "dados-nf"];
 */
export function desabilitarCampos() {

    let camposParaManterHabilitados = [];
    let botoesParaManterHabilitados = [];
    let formsParaManterHabilitados = [];
    let aTagsParaManterHabilitados = [];

    if (globais.pag === 'editar_cotacao') {
        return;
    }
    if (globais.pag === "ajustar_compra_compras" || globais.pag === "checagem_final") {
        camposParaManterHabilitados = ["Entidade", "Datas", "Valor", "quantidade", "valor-unit"];//name
        botoesParaManterHabilitados = ["add-parcela", "remover-parcela", "add-linha-nf", "remover-linha-nf"];//classe
        formsParaManterHabilitados = ["form-pagamento", "dados-nf", "form-classificacao"];//forms
    } else if (globais.pag === "criar_numero_de_PDC") {
        camposParaManterHabilitados = ["Num_PDC_parcela"];
        botoesParaManterHabilitados = ["add-parcela", "remover-parcela"];
        formsParaManterHabilitados = ["form-classificacao"];
    }

    // Seleciona todos os elementos de input, textarea e select
    const campos = document.querySelectorAll('input, textarea, select');
    campos.forEach(elemento => {
        // Verifica se o elemento deve ser mantido visível
        if (!camposParaManterHabilitados.includes(elemento.name)) {
            elemento.disabled = true;
            elemento.readOnly = true; // Adiciona o atributo readonly
            elemento.style.cursor = 'not-allowed';
        }
    });
    const botoes = document.querySelectorAll('button');
    botoes.forEach(botao => {
        if (!botao.closest('.save-btn-container') && !botao.classList.contains('toggle-section')) {

            // Verifica se o botão deve ser mantido visível
            const deveManterVisivel = botoesParaManterHabilitados.some(classe => botao.classList.contains(classe));
            if (!deveManterVisivel) {
                const computedStyle = getComputedStyle(botao);
                const placeholder = document.createElement('div'); // Cria um elemento vazio

                // Verifica o tamanho do before
                const beforeWidth = parseFloat(computedStyle.getPropertyValue('width')) + parseFloat(computedStyle.getPropertyValue('padding-left')) + parseFloat(computedStyle.getPropertyValue('padding-right'));
                const beforeHeight = parseFloat(computedStyle.getPropertyValue('height')) + parseFloat(computedStyle.getPropertyValue('padding-top')) + parseFloat(computedStyle.getPropertyValue('padding-bottom'));

                // Verifica o tamanho do after
                const afterWidth = parseFloat(computedStyle.getPropertyValue('width')) + parseFloat(computedStyle.getPropertyValue('padding-left')) + parseFloat(computedStyle.getPropertyValue('padding-right'));
                const afterHeight = parseFloat(computedStyle.getPropertyValue('height')) + parseFloat(computedStyle.getPropertyValue('padding-top')) + parseFloat(computedStyle.getPropertyValue('padding-bottom'));

                // Define o tamanho do placeholder com base nos tamanhos verificados
                placeholder.style.width = `${Math.max(beforeWidth, afterWidth, botao.offsetWidth)}px`;
                placeholder.style.height = `${Math.max(beforeHeight, afterHeight, botao.offsetHeight)}px`;
                placeholder.style.display = 'inline-block'; // Mantém o layout
                botao.parentNode.replaceChild(placeholder, botao); // Substitui o botão pelo placeholder
            }
        }
    });

    // Seleciona todos os elementos com contenteditable
    const elementosEditaveis = document.querySelectorAll('[contenteditable="true"], [contenteditable="false"]');
    elementosEditaveis.forEach(elemento => {
        // Verifica se o elemento deve ser mantido visível
        const temClasseVisivel = camposParaManterHabilitados.some(classe => elemento.classList.contains(classe));
        if (temClasseVisivel) {

            elemento.contentEditable = true; // Habilita para edição
            elemento.style.cursor = 'text'; // Altera o cursor para indicar que é editável

        } else {
            elemento.contentEditable = false; // Desabilita para edição
            elemento.style.cursor = 'not-allowed'; // Altera o cursor para indicar que não é editável
        }
    });

    // Seleciona todos os elementos a tag
    const elementosComHref = document.querySelectorAll('a');
    elementosComHref.forEach(elemento => {
        // Verifica se o elemento deve ser mantido visível
        const temClasseVisivel = aTagsParaManterHabilitados.some(classe => elemento.classList.contains(classe));
        if (temClasseVisivel) {
            elemento.style.cursor = 'pointer'; // Altera o cursor para indicar que é clicável
            elemento.style.removeProperty('pointer-events');
        } else {
            elemento.style.cursor = 'not-allowed'; // Altera o cursor para indicar que não é clicável
            elemento.style.pointerEvents = 'none';
        }
    });

    // Habilita campos nos formulários que devem ser mantidos Habilitados
    formsParaManterHabilitados.forEach(formClass => {
        const formulario = document.querySelector(`#${formClass}`);
        if (formulario) {
            const camposFormulario = formulario.querySelectorAll('input, textarea, select');
            camposFormulario.forEach(campo => {
                campo.disabled = false; // Habilita o campo
                campo.readOnly = false; // Remove o atributo readonly
                // Altera o cursor dependendo do tipo de campo
                campo.style.cursor = campo.tagName.toLowerCase() === 'select' ? 'pointer' : 'text';
            });
        }
    });
}

export function validateFields(action) {
    let all = {};
    let atLeastOne = {};
    let otherFormats = {};

    switch (action) {
        case 'solicitar_aprovacao_sindico':
            all = {
                'Entidade': 'name',
                'Tipo_de_solicitacao': 'name',
                'Descricao_da_compra': 'name',
                'Utilizacao': 'name',
                'id_forn': 'dataset',
                'quantidade': 'class',
                'valor-unit': 'class',
                'dp-field-input': 'class'
            };
            atLeastOne = {
                'supplier-checkbox': 'class',
            };

            otherFormats = {
                'tipo-pag': 'name',
                'parcela': 'class'
            }



            break;
        case '':
            break;
        default:
            break;
    }

    function validateField(field) {
        const errorMessage = document.createElement('span');
        errorMessage.id = 'error-message';
        errorMessage.textContent = 'Este campo é obrigatório';
        errorMessage.style.color = 'red';

        if (field.tagName === 'INPUT' || field.tagName === 'TEXTAREA') {
            // Verifica o valor do campo
            if (field.value === '') {
                field.addEventListener('input', () => errorMessage.remove());
                field.parentNode.appendChild(errorMessage);
                field.parentNode.style.display = 'grid';
                
                field.focus();

                const overlayElement = document.querySelector(".customConfirm-overlay-div");
                if (overlayElement) {
                    overlayElement.remove();
                }
            }

        } else if (field.tagName === 'SELECT') {
            // Verifica se o campo select tem um valor selecionado
            const selectedOption = field.options[field.selectedIndex];
            if (selectedOption.classList.contains('invalid')) {
                field.addEventListener('input', () => errorMessage.remove());
                field.parentNode.appendChild(errorMessage);
                field.parentNode.style.display = 'grid';
                
                field.focus();

                const overlayElement = document.querySelector(".customConfirm-overlay-div");
                if (overlayElement) {
                    overlayElement.remove();
                }
            }

        } else if (field.tagName === 'TD') {
            // Verifica o texto do campo TD
            if (field.innerText === '') {
                throw new Error(`O campo "${field.name}" deve ser preenchido.`);
            }

        } else {
            // Se o campo não for reconhecido, lança um erro
            throw new Error(`Tipo de campo não reconhecido: ${field.tagName}`);

        }
    }

    //=====All values are required=====\\
    for (let [key, value] of Object.entries(all)) {
        if (value === 'dataset') {
            if (!document.querySelector(`[data-${key}]`)) {
                alert(`O campo "${key}" deve ser preenchido.`);
                document.getElementsByClassName("customConfirm-overlay-div").remove();
            }
        } else {
            let campos;
            if (['name'].includes(value))//Busca por atributos
            {
                campos = document.querySelectorAll(`[${value}="${key}"]`);

            } else if (['class'].includes(value))//busca por classe (Aparentemente não é um atributo)
            {
                campos = document.querySelectorAll(`.${key}`);

            }

            campos.forEach(campo => {
                console.log("campo: ", campo);
                console.log("campo.innerText: ", campo.innerText);
                console.log("campo.value: ", campo.value);

                validateField(campo);
            })
        }
    }

    //=====At least one value is required=====\\
    for (let [key, value] of Object.entries(atLeastOne)) {
        console.log("key: ", key, "value: ", value);
        if (value === 'class') {
            const elements = document.querySelectorAll(`.${key}`);
            if (![...elements].some(element => element.checked || element.value.trim() !== '')) {
                throw new Error(`O campo "${key}" deve ser preenchido.`);
                return false;
            }
        }
    }

    //=====Other formats=====\\
    for (let [key, value] of Object.entries(otherFormats)) {
        console.log("key: ", key, "value: ", value);

        const campos = document.querySelectorAll(`[${value}="${key}"]`);
        campos.forEach(campo => {
            console.log("campo: ", campo);
            console.log("campo.innerText: ", campo.innerText);
            console.log("campo.value: ", campo.value);
        })

        if (["tipo-pag"].includes(key)) {
            const opcaoMarcada = campos[0].querySelector('input:checked');
            console.log("opcaoMarcada: ", opcaoMarcada);
            console.log("opcaoMarcada.value: ", opcaoMarcada.value);
            if (!opcaoMarcada) {
                throw new Error(`O campo "${key}" deve ser preenchido.`);
                return false;
            }

            if (opcaoMarcada.value.includes("Dep. em")) {
                // Verificar se todos os inputs estão preenchidos
                const inputs = document.getElementById('campos-deposito').querySelectorAll('input');
                inputs.forEach(input => {
                    console.log("input: ", input);
                    if(input.value.trim() === '') {
                        throw new Error(`Os campos de depósito devem ser preenchidos.`);
                        return false;
                    }
                })

                if (![...inputs].every(input => input.value.trim() !== '')) {
                    throw new Error(`Os campos de depósito devem ser preenchidos.`);
                    return false;
                }
            }

            if (["Pix"].some(valor => opcaoMarcada.value.includes(valor))) {
                // Verificar se todos os inputs do tipo text dentro do elemento #campos-pix estão preenchidos
                const inputs = document.querySelectorAll('#campos-pix input[type="text"]');
                if (![...inputs].every(input => input.value.trim() !== '')) {
                    throw new Error(`Os campos de pix devem ser preenchidos.`);
                    return false;
                }
                // Verificar se o select do tipo de pix está preenchido
                const select = document.querySelector('#campos-pix select[name="Tipo_de_chave_pix"]');
                if (select.value === '') {
                    throw new Error(`O tipo de pix deve ser selecionado.`);
                    return false;
                }
            }
        }

        if (["parcela"].includes(key)) {
            campos.forEach(campo => {

                const inputs = [...campo.querySelectorAll('input')].filter(input => input.name !== 'parcela_criada');
                if (![...inputs].some(input => input.value.trim() !== '')) {
                    throw new Error(`O campo "${key}" deve ser preenchido.`);
                    return false;
                }
            });
        }
    }

    throw new Error(`TODOS OS CAMPOS ESTÃO PREENCHIDOS`);

    return true;
}
