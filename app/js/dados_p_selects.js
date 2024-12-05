import { executar_apiZoho } from "./utils.js";
import { globais } from "./main.js";

const nomeRelFornecedores = "Base_de_fornecedores_Laranjeiras_Report";
const nomeRelCentroCusto = "Laranj_Centros_de_custo";
const nomeRelClasseOperacional = "Laranj_Classes_operaicionais";

/**
 * Busca e armazena todos os fornecedores na base de dados
 * 
 * @function buscarFornecedores
 * @async
 * @returns {Promise<Map>} Map contendo os dados dos fornecedores
 * 
 * @description
 * Esta função realiza uma busca recursiva na API do Zoho para obter todos os fornecedores cadastrados.
 * Para cada fornecedor encontrado, armazena em um Map os seguintes dados:
 * - Chave: Número do fornecedor 
 * - Valor: Array contendo:
 *   [0] Nome do fornecedor
 *   [1] CPF/CNPJ
 *   [2] Valor do frete
 *   [3] Condições de pagamento
 *   [4] Observações
 * 
 * Em caso de erro na busca, retorna um Map vazio e registra o erro no console.
 * 
 * @example
 * const fornecedores = await buscarFornecedores();
 * // fornecedores.get("123") retorna:
 * // ["Empresa ABC", "12.345.678/0001-90", "100.00", "30 dias", "Obs..."]
 */
export async function buscarFornecedores() {
    let cFornecedores = "(ID!=0)";
    
    try {
        const resp = await executar_apiZoho({
            tipo: "busc_reg_recursivo", 
            criterios: cFornecedores, 
            nomeR: nomeRelFornecedores
        });
        
        let baseFornecedores = new Map();
        resp.forEach((item) => {
            baseFornecedores.set(item.ID, [
                item["Numero_do_fornecedor"],
                item["Nome_do_fornecedor"],
                item["Cpf_Cnpj_do_fornecedor"], 
                item["Telefone"], 
                item["E_mail"],
                item["Dados_bancarios"]
            ]);
        });
        console.log("============BASE FORNECEDORES || ", JSON.stringify(baseFornecedores));
        return baseFornecedores;
    } catch (error) {
        console.error("Erro ao buscar fornecedores:", error);
        return new Map();
    }
}

/**
 * Busca e mapeia os centros de custo cadastrados
 * 
 * @function buscarCentrosCusto
 * @async
 * @returns {Promise<Map>} Map contendo os dados dos centros de custo
 * 
 * @description
 * Esta função realiza uma busca recursiva na API do Zoho para obter todos os centros de custo.
 * Para cada centro encontrado, armazena em um Map os seguintes dados:
 * - Chave: ID do centro de custo
 * - Valor: Objeto contendo:
 *   - codigoCentro: Código do centro de custo
 *   - nomeCentro: Nome do centro de custo
 * 
 * Em caso de erro na busca, retorna null e registra o erro no console.
 */
export async function buscarCentrosCusto() {
    let crit = "(ID!=0)";
    
    try {
        // Aguarda a resposta da API
        const resp = await executar_apiZoho({
            tipo: "busc_reg_recursivo", 
            criterios: crit, 
            nomeR: nomeRelCentroCusto
        });
        
        // Mapeia os centros de custo
        const centrosCustoMap = new Map();
        
        resp.forEach((item) => {
            // Monta o par centro de custo
            const codigoCentro = item.Cod_do_centro_de_custo;
            const nomeCentro = item.Nome_do_centro_de_custo;
            centrosCustoMap.set(item.ID, {codigoCentro, nomeCentro});
        });

        return centrosCustoMap;
    } catch (error) {
        console.error("Erro ao buscar centros de custo:", error);
        return null;
    }
}

/**
 * Busca e mapeia as classes operacionais cadastradas
 * 
 * @function buscarClassesOperacionais
 * @async
 * @returns {Promise<Map>} Map contendo os dados das classes operacionais
 * 
 * @description
 * Esta função realiza uma busca recursiva na API do Zoho para obter todas as classes operacionais.
 * Para cada classe encontrada, armazena em um Map os seguintes dados:
 * - Chave: ID da classe operacional
 * - Valor: Objeto contendo:
 *   - codigoClasse: Código da classe operacional
 *   - nomeClasse: Nome da classe operacional
 * 
 * Em caso de erro na busca, retorna null e registra o erro no console.
 */
export async function buscarClassesOperacionais() {
    let crit = "(ID!=0)";
    
    try {
        // Aguarda a resposta da API
        const resp = await executar_apiZoho({
            tipo: "busc_reg_recursivo", 
            criterios: crit, 
            nomeR: nomeRelClasseOperacional
        });
        
        // Mapeia apenas as classificações
        const classificacoesMap = new Map();

        resp.forEach((item) => {
            // Monta o par classe operacional
            const codigoClasse = item.C_digo_da_classe_operacional;
            const nomeClasse = item.Nome_da_classe;
            classificacoesMap.set(item.ID, {codigoClasse, nomeClasse});
        });

        return classificacoesMap;
    } catch (error) {
        console.error("Erro ao buscar plano de contas:", error);
        return null;
    }
}