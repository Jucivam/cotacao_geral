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

        async function subirArquivos()
        {
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
        }else if(tipo === "subir_arq"){
            return await subirArquivos();
        }
    } catch (err) {
        return err;
    }
}

export function formatToBRL_V2(v, nd = 2) {
    const log = true;
    if(log) console.log("[+++++FORMATANDO PARA BRL+++++]");
    if(log) console.log("Número de decimais => ", nd);
    
    if (v.dataset && v.dataset.valor_original) {
        delete v.dataset.valor_original;
    }

    if (!v)  return "0,00";//Se for vazio, volta 0,00
    

    let av; //Apoio ao valor
    let int = false; //Flag para inteiro
    let isNeg = false; //Flag para negativo

    //Busca o valor do evento e verifica se é um inteiro
    const elemento = v.target || v;
    if ((typeof elemento == "string" || typeof elemento == "number")) {

        if(log) console.log("Valor original => ", elemento);
        av = converterStringParaDecimal(elemento);
    } else {

        av = elemento.innerText || elemento.value;
        if(log) console.log("Valor original => ", av);
        int = elemento.classList?.contains("integer-cell") || false;
    }
    const vo = av; //Valor original, sem ajuste, para evitar arredondamento
    if(log) console.log("Valor original VO => ", vo);
    if(log) console.log("Valor em decimal => ", av);
    // Verifica se é negativo
    if (av.toString().startsWith('-')) {
        isNeg = true;
        av = av.toString().substring(1);
    }
    
    if(log) console.log("Valor bruto sem sinal => ", av);
    // Ajusta o tipo (Inteiro ou decimal) e adiciona os zeros
    av = int ? av : converterStringParaDecimal(av);
    const [pi, pd] = av.toString().split('.');

    
    if(log) console.log("Parte inteira => ", pi);
    if(log) console.log("Parte decimal => ", pd);
    //AJUSTA PARTE DECIMAL PARA O NUMERO DE CASAS DECIMAIS INDICADO
    let apd;
    if (pd && pd.length > nd) {
        apd = pd.slice(0, nd);
    }else{
        apd = (pd || '') + '0'.repeat(nd - (pd || '').length);
    }
    if(log) console.log("Apoio decimal => ", apd);

    // Cria o valor final em formato de BRL
    let vf;
    if((pi === undefined && pd === undefined))
    {
        vf = `0,${apd}`;
    }else if(int)
    {
        vf = `${pi || 0}${apd || ''}`;
    }else
    {
        vf = `${pi || 0},${apd}`;
    }

    //let vf = (pi === undefined && pd === undefined) ? '0,00' : int ? `${pi || 0}${pd || ''}` : `${pi || 0},${(pd || '').slice(0, nd)}`;
    if(log) console.log("Valor final sem sinal=> ", vf);
    // Adiciona o sinal negativo de volta se necessário
    if (isNeg) {
        vf = `-${vf}`;
    }
    
    if(log) console.log("Valor original => ", vo);
    if(log) console.log("Valor final => ", vf);
    if(log) console.log("[-----FORMATAÇÃO CONCLUÍDA-----]");
    if (v.innerText || v.value) {
        const target = 'value' in v ? 'value' : 'innerText';
        v[target] = vf;
        v.dataset.valor_original = vo;
        v.addEventListener('focus', () => {console.log("[+++++FOCUS+++++]");v[target] = v.dataset.valor_original || ''});
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

    if(log) console.log("[+++++CONVERTENDO STRING PARA DECIMAL+++++]");
    // Verifica se é um elemento HTML
    const isElement = valor && typeof valor === 'object' && 'innerText' in valor;
    const valorOriginal = isElement ? valor.innerText : valor;

    if (!valorOriginal) return 0.00;
    console.log("Valor original => ", valorOriginal);
    // Remove todos os caracteres não numéricos exceto ponto e vírgula
    let numeroLimpo = valorOriginal.toString().replace(/[^\d.,\-]/g, '');

    if(log) console.log("Valor limpo => ", numeroLimpo);

    // Trata números negativos
    const isNegative = numeroLimpo.startsWith('-');
    numeroLimpo = numeroLimpo.replace('-', '');

    if(log) console.log("Valor limpo sem sinal => ", numeroLimpo);

    // Conta quantos pontos e vírgulas existem
    const qtdPontos = (numeroLimpo.match(/\./g) || []).length;
    const qtdVirgulas = (numeroLimpo.match(/,/g) || []).length;

    if(log) console.log("Quantidade de pontos => ", qtdPontos);
    if(log) console.log("Quantidade de vírgulas => ", qtdVirgulas);

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

    if(log) console.log("Valor limpo apenas com ponto => ", numeroLimpo);

    // Converte para número e fixa em nd casas decimais
    let numeroFinal = parseFloat(numeroLimpo);

    if(log) console.log("Valor final sem ajuste de casas decimais => ", numeroFinal);

    numeroFinal = isNaN(numeroFinal) ? 0.00 : nd !== null ? Math.trunc(numeroFinal * Math.pow(10, nd)) / Math.pow(10, nd) : numeroFinal;
    
    if(log) console.log("Valor final => ", numeroFinal);

    // Aplica o sinal negativo se necessário
    if (isNegative) {
        numeroFinal = -numeroFinal;
    }

    if(log) console.log("Valor final com sinal => ", numeroFinal);
    if(log) console.log("[------CONVERSÃO FINALIZADA------]");

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
export async function customModal({botao = null, tipo = null, titulo = null, mensagem,confirmText = 'Confirmar',cancelText = 'Cancelar',loadingText = 'Carregando, aguarde...'}) {
    console.log("Entrou no customModal");
    console.log("tipo => ", tipo);
    if(tipo === null){
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

        function getDates(t = null){
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
                if(numParc?.textContent)
                {
                    dadosParcela.Numero_da_parcela = parseInt(numParc.textContent.match(/\d+/)[0])
                }
                if(pgtoAnt && indiceParcela === 0 && t === "confirmar_compra")
                {
                    dadosParcela.parcela_criada = true
                }else
                {
                    dadosParcela.parcela_criada = false
                }
                if(dataInput?.value){
                    const [ano, mes, dia] = dataInput.value.split('-');
                    dadosParcela.Vencimento_previsto = `${dia}/${mes}/${ano}`
                }
                if(valorInput?.value){
                    dadosParcela.Valor = converterStringParaDecimal(valorInput.value)
                }
                if(numPDC?.value)
                {
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

        // Mapeia os tipos de ação para os payloads correspondentes
        const payloadMap = {
            'criar_cotacao_DP':
            {
                Status_geral: 'Propostas criadas DP'
            },
            'editar_cotacao_DP':
            {
                Status_geral: 'Propostas criadas DP'
            },
            "criar_cotacao_controladoria":{
                Status_geral: 'Propostas criadas controladoria'
            },
            "editar_cotacao_controladoria":{
                Status_geral: 'Propostas criadas controladoria'
            },
            'solicitar_aprovacao_sindico': {
                Status_geral: 'Aguardando aprovação de uma proposta'
            },
            'ajustar_cot': {
                Status_geral: 'Ajuste solicitado',
                Solicitacao_de_ajuste: inputElement ? inputElement.value : null
            },
            'aprov_cot': {
                Status_geral: 'Proposta aprovada'
            },
            'arquivar_cot': {
                Status_geral: 'Proposta arquivada',
                motivo_arquivamento: inputElement ? inputElement.value : null
            },
            'finalizar_provisionamento':
            {
                Status_geral: 'Lançado no orçamento'
            },
            'confirmar_compra': {
                Status_geral: 'Compra realizada',
                pag_antecipado: false,
                Datas: getDates(tipo)
            },
            'confirmar_recebimento': {
                Status_geral: 'Separado em parcelas'
                /*Função splitar PDC*/
            },
            'solicitar_ajuste_ao_compras': {
                Status_geral: 'Ajuste Solicitado Pelo Almoxarifado',
                Solicitacao_de_ajuste: inputElement ? inputElement.value : null
            },
            'enviar_p_checagem_final': {
                Status_geral: 'Enviado para checagem final'
            },
            'enviar_p_assinatura':
            {
                Status_geral:'Assinatura Confirmada Controladoria'
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
                "criar_cotacao_DP":false,
                "editar_cotacao_DP":false,
                "criar_cotacao_controladoria":false,
                "editar_cotacao_controladoria":false,
                "solicitar_aprovacao_sindico":false,
                "finalizar_provisionamento":false,
                "enviar_p_checagem_final":false,
                "enviar_p_assinatura":false,
                "confirmar_compra": pgtoAnt?true:false,
                "confirmar_recebimento": true
            };

            if (Object.keys(tiposValidos).includes(tipo)) 
            {
                let status = null;
                if(tipo === "confirmar_recebimento")
                {
                    status = "Recebimento confirmado";
                }else if(tipo === "criar_cotacao_controladoria" || tipo === "editar_cotacao_controladoria")
                {
                    status = "Propostas criadas controladoria";
                }else if(tipo === "confirmar_compra")
                {
                    status = "Enviado para checagem final";
                }
                await saveTableData_V2(status, tiposValidos[tipo]);
            }

            payload = { data: [{ ...payloadMap[tipo]}] };
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
                if(tipo == "confirmar_compra")
                {

                    // Obtém o valor da entidade selecionada
                    const entidadeSelecionada = document.getElementById('entidade').value;
    
                    let link_layout;
                    // [LAYOUT]
                    if(entidadeSelecionada == "3938561000066182591")
                    {
                        link_layout= `${url}guillaumon/app-envio-de-notas-boletos-guillaumon/pdf/Laranj_layout_impressao_pedido?ID_entry=${globais.idPDC}&id_pdc=${globais.idPDC}&zc_PdfSize=A4&zc_FileName=${globais.numPDC}_Laranjeiras`;
                    }
                    else if(entidadeSelecionada == "3938561000066182595")
                    {
                        link_layout= `${url}guillaumon/app-envio-de-notas-boletos-guillaumon/pdf/AssociacaoServir_layout_impressao_pedido?ID_entry=${globais.idPDC}&id_pdc=${globais.idPDC}&zc_PdfSize=A4&zc_FileName=${globais.numPDC}_Ass_Servir`;
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

/*Não está sendo utilizada ainda, estou tentando refatorar*/
/*
export async function customModal2({action = '', saveContentType = '',alertModal = false, title = null, message}) {

    ///Caracteristicas de um modal customizável:
     // - Título (caso exista)
     // - Mensagem
     // - Formulário (caso exista)
     // - Botões ("Não há", "ok" ou "sim ou não")
     // Possíveis retornos:
     // - "sim" ou "não"
     // - "sim" ou "não" com conteúdo do formulário
     // - null (Alerta, mas este não tem retorno)
    ///

    //==========VARIÁVEIS DE APOIO E ELEMNTOS INICIAIS==========//
    const confirmText = "Ok";
    const cancelText = "Não";

    const overlay = createEl('div', 'customConfirm-overlay-div');
    const popup = createEl('div', 'customConfirm-div');
    const messageElement = createEl('p', 'customConfirm-message', message);

    //==========CRIA O TÍTULO, CASO EXISTA==========//
    let titleElement;
    if (title) {
        titleElement = createEl('h3', 'customConfirm-title', title)
    }

    //==========CRIA INPUTS DE VALORES EM CASOS ESPECÍFICOS==========//
    const inputConfigs = {
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
    }

    let inputElement;
    if (inputConfigs[tipo]) {
        inputElement = createEl('textarea', 'customAdjust-textarea');
        inputElement.placeholder = inputConfigs[tipo].placeholder;
        Object.assign(inputElement.style, {
            width: '300px',
            height: '100px',
            resize: 'none',
        });
    }

    
    //==========CRIA OS BOTÕES BASEADO NA AÇÃO (ALERT OU CONFIRM)==========//
    const buttonContainer = createEl('div', 'customConfirm-button-container');
    const confirmButton = createEl('button', `customConfirm-confirmButton ${inputConfigs[tipo]?.buttonClass || ''}`, confirmText);
    buttonContainer.append(confirmButton);

    if (!alertModal === true) {
        confirmButton.innerHTML = "Sim";
        confirmButton.addEventListener('click', () => {clickConfirm().then((resp)=>{return resp;});});

        const cancelButton = createEl('button', 'customConfirm-cancelButton', cancelText);
        cancelButton.addEventListener('click', () => {clickCancel()});

        buttonContainer.append(cancelButton);
    }

    Object.assign(buttonContainer.style, {
        display: 'flex',
        gap: '10px',
        justifyContent: 'center',
        marginTop: '20px'
    });

    //==========CRIA UM MODAL DE LOADING==========//
    const loadingElement = createEl('div', 'customConfirm-loading',
        `<div class="customConfirm-loading-spinner"></div> Carregando...`);

    //==========ADICIONANDO ELEMENTOS NO POPUP==========//
    popup.append(
        ...(titleElement ? [titleElement] : []),
        messageElement,
        ...(inputElement ? [inputElement] : []),
        buttonContainer,
        loadingElement
    );

    overlay.appendChild(popup);
    document.body.appendChild(overlay);

    async function clickConfirm()
    {
        if(alertModal === true)
        {
            overlay.remove();
            return;
        }

        return new Promise((resolve) => {
            executePageActions({action: action, saveContentType:saveContentType, inputElValue:inputElement?inputElement.value:null}).then(result => {
                resolve(result);
            });
        });

    }

    function clickCancel()
    {
        overlay.remove();
        return false;
    }

    function createEl(tag, className = '', innerHTML = '') {
        const element = document.createElement(tag);
        if (className) element.className = className;
        if (innerHTML) element.innerHTML = innerHTML;
        return element;
    }

    function toggleElements(show = false)
    {
        // Alterna visibilidade do título, caso exista
        if (titleElement) titleElement.style.display = show ? 'block' : 'none';

        // Alterna visibilidade da mensagem
        messageElement.style.display = show ? 'block' : 'none';

        // Alterna visibilidade do campo de input, caso exista
        if (inputElement) {
            inputElement.style.display = show ? 'block' : 'none';
        }

        // Alterana visibilidade dos botões
        buttonContainer.style.display = show ? 'flex' : 'none';

        // Alterana a visibilidade do modal de loading...
        loadingElement.style.display = show ? 'none' : 'flex';
    }
}
async function executePageActions({action = null, saveContentType = null, inputElValue = null})
{   
    const initUrl = 'https://guillaumon.zohocreatorportal.com/';
    console.log("Chegou aqui!");

    let Status_geral = '';
    let inputValue = {};
    let urlToOpen = `${initUrl}#Script:page.refresh`;
    //==========SWITCH QUE VALIDA O STATU GERAL==========//
    switch (action)
    {
        case 'criar_cotacao':
        case 'editar_cotacao':
            Status_geral = 'Propostas criadas';
            break;
        
        case 'criar_cotacao_DP':
        case 'editar_cotacao_DP':
            Status_geral = 'Propostas criadas DP';
            break;

        case 'solicitar_aprovacao_sindico':
            Status_geral = 'Aguardando aprovação de uma proposta';
            break;
        
        case 'ajustar_cot':
            Status_geral = 'Ajuste solicitado';
            inputValue = {"Solicitacao_de_ajuste": inputElValue};
            break;
        
        case 'aprov_cot':
            Status_geral = 'Proposta aprovada';
            break;

        case 'arquivar_cot':
            Status_geral = 'Proposta arquivada';
            inputValue = {"motivo_arquivamento": inputElValue};
            break;

        case 'finalizar_provisionamento':
            Status_geral = 'Lançado no orçamento';
            break;

        case 'confirmar_compra':
            Status_geral = 'Compra realizada';
            break;
        
        case 'confirmar_recebimento':
            Status_geral = 'Recebimento confirmado';
            break;

        case 'solicitar_ajuste_ao_compras':
            Status_geral = 'Ajuste Solicitado Pelo Almoxarifado';
            inputValue = {"Solicitacao_de_ajuste": inputElValue};
            break;

        case 'enviar_p_checagem_final':
            Status_geral = 'Enviado para checagem final';
            break;

        case 'enviar_p_assinatura':
            Status_geral = 'Assinatura Confirmada Controladoria';
            break;
        
        case 'autorizar_pagamento_sindico':
            Status_geral = 'Assinatura Confirmada Sindico';
            break;

        case 'autorizar_pagamento_subsindico':
            Status_geral = 'Assinatura Confirmada Sub Sindico';
            break;
        
        case 'confirmar_todas_as_assinaturas':
            Status_geral = 'Autorizado para pagamento';
            break;
        
        case 'remover_fornecedor':
            return true;
        
        case 'remover_produto':
            console.log("Removendo linha de produto");
            return true;

        default:
            break;
    }

    try
    {
        //==========CASO EXISTA UM SAVECONTENTTYPE, ACIONA A SAVETABLEDATA==========//
        if(saveContentType !== '')
        {
            await saveTableData(saveContentType);
        }
    
        if(Status_geral != '')
        {
            payload = {
                Status_geral: Status_geral,
                ...inputValue
            };
    
            const resposta = await executar_apiZoho({
                tipo: "atualizar_reg",
                ID: globais.idPDC,
                corpo: payload,
                nomeR: globais.nomeRelPDC
            });
    
            if(resposta && resposta.code === 3000)
            {
                if (action == "confirmar_compra") {
    
                    // Obtém o valor da entidade selecionada
                    const entidadeSelecionada = document.getElementById('entidade').value;
                    let link_layout;
                    // [LAYOUT]
                    if (entidadeSelecionada == "3938561000066182591") {
                        link_layout = `${initUrl}guillaumon/app-envio-de-notas-boletos-guillaumon/pdf/Laranj_layout_impressao_pedido?ID_entry=${globais.idPDC}&id_pdc=${globais.idPDC}&zc_PdfSize=A4&zc_FileName=${globais.numPDC}_Laranjeiras`;
                    }
                    else if (entidadeSelecionada == "3938561000066182595") {
                        link_layout = `${initUrl}guillaumon/app-envio-de-notas-boletos-guillaumon/pdf/AssociacaoServir_layout_impressao_pedido?ID_entry=${globais.idPDC}&id_pdc=${globais.idPDC}&zc_PdfSize=A4&zc_FileName=${globais.numPDC}_Ass_Servir`;
                    }
                    
                    window.open(`${link_layout}`, '_blank', 'noopener,noreferrer');
                }
                window.open(urlToOpen, '_top');
    
            }else
            {
                return `Ocorreu um erro ao tentar alterar o status, contate o administrador do sistema!\nErro: `;
            }
        }
    }catch(err)
    {
        return `Ocorreu um erro inesperado, contate o administrador do sistema!\nErro: ${err}`;
    }
}
*/

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

    if (globais.pag === "ajustar_compra_compras" || globais.pag === "checagem_final") {
        camposParaManterHabilitados = ["Entidade", "Datas", "Valor", "quantidade", "valor-unit"];//name
        botoesParaManterHabilitados = ["add-parcela", "remover-parcela"];//classe
        formsParaManterHabilitados = ["form-pagamento", "dados-nf", "form-classificacao"];//forms
    } else if (globais.pag === "criar_numero_de_PDC") {
        camposParaManterHabilitados = ["Num_PDC_parcela"];
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
    const elementosComHref =  document.querySelectorAll('a');
    elementosComHref.forEach(elemento => {
        // Verifica se o elemento deve ser mantido visível
        const temClasseVisivel = aTagsParaManterHabilitados.some(classe => elemento.classList.contains(classe));
        if (temClasseVisivel) {
            elemento.style.cursor = 'pointer'; // Altera o cursor para indicar que é clicável
        } else {
            elemento.style.cursor = 'not-allowed'; // Altera o cursor para indicar que não é clicável
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

    switch (action) {
        case 'solicitar_aprovacao_sindico':
            all = {
                'Entidade': 'name',
                'Tipo_de_solicitacao': 'name',
                'Descricao_da_compra': 'name',
                'Utilizacao': 'name',
                'id_forn': 'dataset',
                'tipo-pag': 'name',
                'Datas': 'name',
                'Valor': 'name',
                'Conta_a_debitar': 'name',
                'Centro_de_custo': 'name',
                'Classe_operacional': 'name',
                'Valor': 'name',
            };
            atLeastOne = {
                'supplier-checkbox': 'class',
            };
            break;
        case '':
            break;
        default:
            break;
    }

    for (let [key, value] of Object.entries(all)) {
        if (value === 'name') {
            const campos = document.querySelectorAll(`[name="${key}"]`);
            if ([...campos].some(campo => campo.value.trim() === '')) {
                return false;
            }
        } else if (value === 'dataset') {
            if (!document.querySelector(`[data-${key}]`)) {
                return false;
            }
        }
    }

    for (let [key, value] of Object.entries(atLeastOne)) {
        if (value === 'class') {
            const elements = document.querySelectorAll(`.${key}`);
            if (![...elements].some(element => element.checked || element.value.trim() !== '')) {
                return false;
            }
        }
    }

    return true;
}
