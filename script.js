// =========================================================
const URL_DO_PROXY = "https://proxyeanmaster.gsouzapatrick.workers.dev"; 
// =========================================================

let API_TOKEN = ''; 
let validacaoEmAndamento = false;
let isPausadoManual = false; 
let plataformaAtual = 'shopee'; // Define a plataforma inicial

// Cofre de Lojas
let bancoLojas = {
    'default': { nome: 'Loja Principal', ultimoEan: null, base12: null }
};
let lojaAtivaId = 'default';

// Variável global para controlar a Fila de EANs
let sequenciaGlobalAtual = 0n;

function uiAlert(title, message, isConfirm = false, confirmCallback = null) {
    document.getElementById('modalTitle').innerText = title;
    document.getElementById('modalMessage').innerHTML = message.replace(/\n/g, '<br>');
    document.getElementById('modalOverlay').style.display = 'flex';

    const btnCancel = document.getElementById('modalBtnCancel');
    const btnOk = document.getElementById('modalBtnOk');

    btnCancel.style.display = isConfirm ? 'inline-block' : 'none';
    btnCancel.innerText = 'Cancelar';
    btnOk.innerText = isConfirm ? 'Sim, Confirmar' : 'OK, Entendi';
    
    btnCancel.onclick = () => fecharModal();
    btnOk.onclick = () => { fecharModal(); if(confirmCallback) confirmCallback(); };
}

function uiConfirmAsync(title, message, btnOkText) {
    return new Promise((resolve) => {
        document.getElementById('modalTitle').innerText = title;
        document.getElementById('modalMessage').innerHTML = message.replace(/\n/g, '<br>');
        document.getElementById('modalOverlay').style.display = 'flex';

        const btnCancel = document.getElementById('modalBtnCancel');
        const btnOk = document.getElementById('modalBtnOk');

        btnCancel.style.display = 'inline-block';
        btnCancel.innerText = 'Parar Tudo';
        btnOk.innerText = btnOkText;

        btnCancel.onclick = () => { fecharModal(); resolve(false); };
        btnOk.onclick = () => { fecharModal(); resolve(true); };
    });
}
function fecharModal() { document.getElementById('modalOverlay').style.display = 'none'; }

window.addEventListener('beforeunload', function (e) {
    if (validacaoEmAndamento) {
        e.preventDefault();
        e.returnValue = 'A validação está em andamento. Se fechar a aba, você perderá o progresso.';
        return e.returnValue;
    }
});

function mostrarTela(idTela) {
    document.querySelectorAll('.tela').forEach(t => t.classList.remove('ativa'));
    document.getElementById(idTela).classList.add('ativa');
}

function inicializarSistema() {
    const tokenSalvo = localStorage.getItem('ean_master_token');
    if (!tokenSalvo) {
        mostrarTela('tela-setup'); 
    } else {
        API_TOKEN = tokenSalvo; 
        mostrarTela('tela-app'); 
        carregarCofreLojas();
        if (!localStorage.getItem('tutorial_final_concluido')) {
            setTimeout(() => iniciarTutorial(false), 500);
        }
    }
}

function salvarSetup() {
    const token = document.getElementById('inputToken').value.trim();
    if (token.length > 10) { 
        localStorage.setItem('ean_master_token', token);
        inicializarSistema(); 
    } else {
        uiAlert("Chave Inválida", "Cole a chave correta da plataforma Cosmos.");
    }
}

function reconfigurarSistema() {
    uiAlert("Configuração da API", "Deseja apagar sua chave atual e configurar uma nova?", true, () => {
        localStorage.removeItem('ean_master_token');
        location.reload(); 
    });
}

// ================= TUTORIAL =================
let passoAtual = 0;
const passosTutorial = [
    { el: 'hl-importar', titulo: '1. Importação & Raio-X', texto: 'Ao importar a planilha, o programa faz um raio-x revelando EANs ausentes ou duplicados. Escolha a plataforma correta antes!' },
    { el: 'hl-acoes', titulo: '2. Inteligência de Correção', texto: 'Escolha se deseja preencher os vazios, corrigir as duplicidades ou substituir a loja inteira.' },
    { el: 'hl-base', titulo: '3. Código Base & CNPJ', texto: 'O programa gerencia a sequência baseada no prefixo de cada Loja (Ex: 789 + Início CNPJ). Sem conflitos e sem misturar dados!' },
    { el: 'hl-botoes', titulo: '4. Execução', texto: 'Gere a lista, valide no Cosmos e baixe a planilha pronta para envio!' }
];

function iniciarTutorial(forcado = false) {
    passoAtual = 0;
    document.getElementById('tourOverlay').style.display = 'block';
    document.getElementById('tourBox').style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
    renderizarPasso();
    if (!forcado) localStorage.setItem('tutorial_final_concluido', 'true');
}

function renderizarPasso() {
    document.querySelectorAll('.tour-hl').forEach(el => el.classList.remove('tour-hl'));
    if (passoAtual >= passosTutorial.length) {
        document.getElementById('tourOverlay').style.display = 'none';
        document.getElementById('tourBox').style.display = 'none';
        return;
    }
    const passo = passosTutorial[passoAtual];
    document.getElementById('tourTitle').innerText = passo.titulo;
    document.getElementById('tourText').innerText = passo.texto;
    document.querySelector('.tour-btn').innerText = passoAtual === passosTutorial.length - 1 ? "Entendi, vamos lá!" : "Próximo";
    const elemento = document.getElementById(passo.el);
    if (elemento) elemento.classList.add('tour-hl');
}
function proximoPassoTutorial() { passoAtual++; renderizarPasso(); }

// ================= MEMÓRIA DE LOJAS =================
let baseAutoDetectada = "";
let fonteBaseAtual = "manual"; 

function obterBaseParaInput(loja) {
    if (loja.ultimoEan && loja.base12) {
        return (BigInt(loja.base12) + 1n).toString().padStart(12, '0');
    } else if (loja.prefixoLoja) {
        return loja.prefixoLoja.padEnd(12, '0');
    }
    return "";
}

function carregarCofreLojas() {
    const salvo = localStorage.getItem('ean_master_lojas');
    if (salvo) {
        bancoLojas = JSON.parse(salvo);
    } else {
        salvarCofreLojas();
    }
    lojaAtivaId = localStorage.getItem('ean_master_loja_ativa') || 'default';
    if (!bancoLojas[lojaAtivaId]) lojaAtivaId = 'default';

    atualizarSelectLojas();
    atualizarUI_Memoria();
    const loja = bancoLojas[lojaAtivaId];
    document.getElementById('codigoBase').value = obterBaseParaInput(loja);
    validarPrefixoGS1();
}

function salvarCofreLojas() {
    localStorage.setItem('ean_master_lojas', JSON.stringify(bancoLojas));
    localStorage.setItem('ean_master_loja_ativa', lojaAtivaId);
}

function atualizarSelectLojas() {
    const select = document.getElementById('selectLoja');
    select.innerHTML = '';
    for (let id in bancoLojas) {
        let opt = document.createElement('option');
        opt.value = id;
        opt.innerText = bancoLojas[id].nome;
        if (id === lojaAtivaId) opt.selected = true;
        select.appendChild(opt);
    }
}

function trocarLoja(silencioso = false) {
    lojaAtivaId = document.getElementById('selectLoja').value;
    salvarCofreLojas();
    limparWorkspace(); 
    atualizarUI_Memoria();
    
    const loja = bancoLojas[lojaAtivaId];
    document.getElementById('codigoBase').value = obterBaseParaInput(loja);
    
    fonteBaseAtual = "manual";
    validarPrefixoGS1();
    if(!silencioso) uiAlert("Loja Alterada", `Você agora está gerenciando o perfil: <b>${loja.nome}</b>\nO painel foi limpo para uma nova importação.`);
}

function criarNovaLoja() {
    const nome = prompt("Digite um nome para a nova Loja ou Perfil:");
    if (!nome || nome.trim() === "") return;
    
    let baseCnpj = prompt("Configuração Inicial:\nDigite o prefixo base da loja (Apenas Números. Padrão: 789 + 5 primeiros dígitos do CNPJ).\nEx: 78912345");
    if (baseCnpj) {
        baseCnpj = baseCnpj.replace(/\D/g, ''); 
        if (baseCnpj.length >= 8 && baseCnpj.length <= 12) {
            const id = 'loja_' + Date.now();
            bancoLojas[id] = { nome: nome.trim(), prefixoLoja: baseCnpj, ultimoEan: null, base12: null };
            lojaAtivaId = id;
            salvarCofreLojas();
            atualizarSelectLojas();
            trocarLoja(true);
        } else {
            uiAlert("Erro na Base", "A base precisa conter entre 8 e 12 NÚMEROS. Letras e caracteres especiais são proibidos.");
        }
    }
}

function editarLoja() {
    const lojaAtual = bancoLojas[lojaAtivaId];
    const novoNome = prompt("Digite o novo nome para a loja:", lojaAtual.nome);
    if (novoNome && novoNome.trim() !== "") {
        bancoLojas[lojaAtivaId].nome = novoNome.trim();
        salvarCofreLojas();
        atualizarSelectLojas();
    }
}

function excluirLoja() {
    if (lojaAtivaId === 'default') {
        return uiAlert("Ação Bloqueada", "A Loja Principal padrão do sistema não pode ser excluída.");
    }
    uiAlert("Excluir Loja", `Tem certeza que deseja excluir o perfil <b>${bancoLojas[lojaAtivaId].nome}</b>?`, true, () => {
        delete bancoLojas[lojaAtivaId];
        lojaAtivaId = 'default';
        salvarCofreLojas();
        atualizarSelectLojas();
        trocarLoja(true); 
    });
}

function atualizarUI_Memoria() {
    const loja = bancoLojas[lojaAtivaId];
    document.getElementById('txtUltimoEan').innerText = loja.ultimoEan ? loja.ultimoEan : "Nenhum registro";
}

function puxarMemoria(silencioso = false) {
    const loja = bancoLojas[lojaAtivaId];
    if (loja && loja.base12) {
        document.getElementById('codigoBase').value = (BigInt(loja.base12) + 1n).toString().padStart(12, '0');
        fonteBaseAtual = "memoria";
        validarPrefixoGS1();
        if(!silencioso) uiAlert("Base Sincronizada", `A base da loja <b>${loja.nome}</b> foi sincronizada com sucesso!`);
    } else if (!silencioso) {
        uiAlert("Sem Histórico", `A loja <b>${loja.nome}</b> ainda não possui histórico de cálculos salvo.`);
    }
}

function limparMemoriaInterna() {
    uiAlert("Limpar Memória da Loja", `Tem certeza que deseja apagar o histórico da loja <b>${bancoLojas[lojaAtivaId].nome}</b>?\nO contador voltará ao início.`, true, () => {
        const loja = bancoLojas[lojaAtivaId];
        loja.ultimoEan = null;
        loja.base12 = null; 
        salvarCofreLojas();
        atualizarUI_Memoria();
        document.getElementById('codigoBase').value = obterBaseParaInput(loja);
        fonteBaseAtual = "manual";
        validarPrefixoGS1();
        uiAlert("Pronto", "Memória da loja limpa com sucesso!");
    });
}

// ================= RADAR GS1 =================
function validarPrefixoGS1() {
    const input = document.getElementById('codigoBase');
    const aviso = document.getElementById('avisoGS1');
    const val = input.value.replace(/\D/g, '');
    
    if (val.length >= 3) {
        aviso.style.display = "block";
        const loja = bancoLojas[lojaAtivaId];
        
        if (loja.prefixoLoja && !val.startsWith(loja.prefixoLoja)) {
            aviso.innerHTML = `🚨 LIMITE ULTRAPASSADO: O contador estourou e o prefixo original (${loja.prefixoLoja}) mudou.`;
            aviso.style.color = "#dc2626"; 
        } 
        else if (val.length === 12 && loja.prefixoLoja && val.startsWith(loja.prefixoLoja)) {
            const prefixoLength = loja.prefixoLoja.length;
            if (prefixoLength < 12) {
                const sequenciaAtual = parseInt(val.substring(prefixoLength));
                const limiteLote = Math.pow(10, 12 - prefixoLength);
                const faltam = limiteLote - sequenciaAtual;

                if (faltam <= 300) { 
                    aviso.innerHTML = `⚠️ ALERTA DE LOTE: Restam apenas <b>${faltam} códigos</b> antes do limite ser atingido!`;
                    aviso.style.color = "#ea580c"; 
                } else {
                    aviso.innerHTML = `✅ Prefixo da loja reconhecido. (Livre: <b>${faltam}</b> códigos)`;
                    aviso.style.color = "#059669"; 
                }
            } else {
                aviso.innerHTML = `✅ Prefixo de 12 dígitos reconhecido.`;
                aviso.style.color = "#059669";
            }
        } 
        else if (!val.startsWith('789') && !val.startsWith('790')) {
            aviso.innerHTML = "⚠️ Atenção: Padrão GS1 Brasil costuma iniciar com 789 ou 790.";
            aviso.style.color = "#d97706"; 
        } else {
            aviso.innerHTML = "✅ Prefixo padrão Brasil detectado.";
            aviso.style.color = "#059669"; 
        }
    } else {
        aviso.style.display = "none";
    }
}

function atualizarContador(isManual = false) {
    let input = document.getElementById('codigoBase');
    input.value = input.value.replace(/\D/g, ''); 
    if(isManual) fonteBaseAtual = 'manual';
    validarPrefixoGS1();
}

function mudouModoAcao() {
    calcularFila();
    const modo = document.querySelector('input[name="modo_acao"]:checked').value;
    const inputBase = document.getElementById('codigoBase');
    const loja = bancoLojas[lojaAtivaId];

    if (modo === 'todos') {
        if (fonteBaseAtual === 'auto') {
            inputBase.value = obterBaseParaInput(loja);
            fonteBaseAtual = "manual";
            validarPrefixoGS1();
            uiAlert("Mudança de Estratégia", "Como você escolheu 'Substituir Tudo', a base lida da planilha foi trocada pela memória da loja para garantir uma sequência limpa.");
        }
    } else {
        if (baseAutoDetectada !== "") {
            inputBase.value = baseAutoDetectada;
            fonteBaseAtual = "auto";
            validarPrefixoGS1();
        }
    }
}

// ================= INTELIGÊNCIA DE PLANILHAS (SHOPEE, TIKTOK, SHEIN, ML) =================

// Variáveis Globais de Planilhas
let originalWorkbook = null;
let originalWorksheet = null;
let originalFileName = "";
let mlWorkbookFicha = null;
let mlWorkbookFiscais = null;

let todosProdutos = []; 
let filaDeInjecao = []; 
let setEansExistentesGlobal = new Set(); 

function limparWorkspace() {
    document.getElementById('fileUpload').value = "";
    if(document.getElementById('fileUploadMLFicha')) document.getElementById('fileUploadMLFicha').value = "";
    if(document.getElementById('fileUploadMLFiscais')) document.getElementById('fileUploadMLFiscais').value = "";
    if(document.getElementById('statusFichaML')) document.getElementById('statusFichaML').innerHTML = "❌ Pendente";
    if(document.getElementById('statusFiscaisML')) document.getElementById('statusFiscaisML').innerHTML = "❌ Pendente";
    if(document.getElementById('btnProcessarML')) document.getElementById('btnProcessarML').style.display = "none";

    originalWorkbook = null;
    originalWorksheet = null;
    mlWorkbookFicha = null;
    mlWorkbookFiscais = null;
    
    document.getElementById('dashResumo').style.display = 'none';
    document.getElementById('rxTotal').innerText = "0";
    document.getElementById('rxOk').innerText = "0";
    document.getElementById('rxVazios').innerText = "0";
    document.getElementById('rxDuplicados').innerText = "0";
    
    todosProdutos = [];
    filaDeInjecao = [];
    setEansExistentesGlobal.clear();
    document.getElementById('corpoTabela').innerHTML = "";
    document.getElementById('qtdGerar').value = "0";
    document.getElementById('statusContainer').style.display = 'none';
    baseAutoDetectada = "";
}

function mudarPlataforma() {
    plataformaAtual = document.querySelector('input[name="plataforma"]:checked').value;
    const uploadUnico = document.getElementById('uploadUnico');
    const uploadML = document.getElementById('uploadML');
    const instrucaoUnica = document.getElementById('instrucaoUnica');
    
    limparWorkspace();
    
    if (plataformaAtual === 'mercadolivre') {
        uploadUnico.style.display = 'none';
        uploadML.style.display = 'block';
    } else {
        uploadML.style.display = 'none';
        uploadUnico.style.display = 'block';
        
        if (plataformaAtual === 'shopee') {
            instrucaoUnica.innerHTML = "🛒 <b>Shopee:</b> Produtos > Ações em massa > Editar em massa > Informação de Venda";
        } else if (plataformaAtual === 'tiktok') {
            instrucaoUnica.innerHTML = "⚫ <b>TikTok Shop:</b> Ferramenta em Lote > Editar todos os atributos";
        } else if (plataformaAtual === 'shein') {
            instrucaoUnica.innerHTML = "🟢 <b>Shein:</b> Produtos > Importação/Exportação em massa > Exportar Produtos";
        }
    }
}

// LER PLANILHA ÚNICA (SUPER RADAR para Shopee, TikTok, Shein)
// LER PLANILHA ÚNICA (SUPER RADAR para Shopee, TikTok, Shein)
async function lerPlanilha(event) {
    const file = event.target.files[0];
    if (!file) return;
    originalFileName = file.name;
    
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const buffer = e.target.result;
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(buffer);
            
            originalWorkbook = workbook;
            originalWorksheet = workbook.worksheets[0]; 
            
            todosProdutos = [];
            setEansExistentesGlobal = new Set();
            let stats = { total: 0, ok: 0, vazios: 0, duplicados: 0 };
            let maxBaseDetectada = 0n;
            
            let colId = -1, colVarId = -1, colEan = -1, colGtinType = -1;
            let rowHeader = -1;
            
            for (let r = 1; r <= 10; r++) {
                const row = originalWorksheet.getRow(r);
                row.eachCell((cell, colNumber) => {
                    const val = cell.value ? String(cell.value).toLowerCase().trim() : '';
                    
                    if (val === 'product id' || val === 'produto id' || val === 'et_title_product_id') colId = colNumber;
                    if (val === 'variation id' || val === 'variação id' || val === 'variante identificador' || val === 'et_title_variation_id') colVarId = colNumber;
                    if (val === 'ps_gtin_code' || val.includes('gtin (ean)') || val === 'gtin') colEan = colNumber;
                    
                    if (val === 'id do produto' || val === 'product_id') colId = colNumber;
                    if (val === 'id do sku' || val === 'sku_id') colVarId = colNumber;
                    if (val === 'código identificador' || val === 'gtin_code') colEan = colNumber;
                    if (val === 'tipo de código identificador' || val === 'gtin_type') colGtinType = colNumber;
                    
                    if (val === 'sku' || val === 'product_sku') { if (colId === -1) colId = colNumber; }
                    if (val === 'barcode' || val === 'ean' || val === 'upc') { if (colEan === -1) colEan = colNumber; }
                });
                if (colId !== -1 && colEan !== -1) {
                    rowHeader = r;
                    break;
                }
            }
            
            if (colId === -1 || colEan === -1) {
                return uiAlert("Erro de Leitura", "Não foi possível encontrar as colunas de ID ou EAN nesta planilha. Verifique se exportou o modelo correto.");
            }
            
            // LISTA DE PALAVRAS QUE O ROBÔ DEVE IGNORAR (Para não ler o cabeçalho como produto)
            const ignorarTextos = ['obrigatório', 'não editável', 'mandatory', 'v3', 'id do produto', 'product_id', 'product id', 'sku', 'product_sku'];

            originalWorksheet.eachRow((row, rowNumber) => {
                if (rowNumber > rowHeader) {
                    let idVal = row.getCell(colId).value;
                    let varVal = colVarId !== -1 ? row.getCell(colVarId).value : '';
                    
                    let idTexto = idVal ? String(idVal).trim().toLowerCase() : '';
                    
                    // O Robô agora verifica se a palavra NÃO está na lista de ignorados
                    if (idTexto !== '' && !ignorarTextos.includes(idTexto)) {
                        
                        stats.total++;
                        let eanVal = row.getCell(colEan).value;
                        let eanAtual = eanVal ? String(eanVal).replace(/\D/g, '') : '';
                        
                        let isVazio = (!eanAtual || eanAtual.length < 8);
                        let isDuplicado = false;
                        
                        if (isVazio) {
                            stats.vazios++;
                        } else {
                            if (setEansExistentesGlobal.has(eanAtual)) {
                                stats.duplicados++;
                                isDuplicado = true;
                            } else {
                                setEansExistentesGlobal.add(eanAtual);
                                stats.ok++;
                            }
                            if (eanAtual.length === 13 && !isNaN(eanAtual)) {
                                let base12 = BigInt(eanAtual.substring(0, 12));
                                if (base12 > maxBaseDetectada) maxBaseDetectada = base12;
                            }
                        }
                        
                        todosProdutos.push({
                            plataforma: plataformaAtual,
                            idProd: String(idVal),
                            idVar: varVal ? String(varVal) : String(idVal),
                            isVazio: isVazio,
                            isDuplicado: isDuplicado,
                            rowNum: rowNumber,
                            colEan: colEan,
                            colGtinType: colGtinType 
                        });
                    }
                }
            });
            
            atualizarDashboardDashboard(stats, maxBaseDetectada);
        } catch (error) { uiAlert("Erro", "Falha ao ler o arquivo Excel."); }
    };
    reader.readAsArrayBuffer(file);
}

// LER PLANILHAS DUPLAS (MERCADO LIVRE)
async function lerPlanilhaML(tipo, event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
        const buffer = await file.arrayBuffer();
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer);

        if (tipo === 'ficha') {
            mlWorkbookFicha = workbook;
            document.getElementById('statusFichaML').innerHTML = "✅ Carregada";
            document.getElementById('statusFichaML').style.color = "#10b981";
        } else if (tipo === 'fiscais') {
            mlWorkbookFiscais = workbook;
            document.getElementById('statusFiscaisML').innerHTML = "✅ Carregada";
            document.getElementById('statusFiscaisML').style.color = "#10b981";
        }

        if (mlWorkbookFicha && mlWorkbookFiscais) {
            document.getElementById('btnProcessarML').style.display = "inline-block";
        }
    } catch (error) {
        uiAlert("Erro", "Falha ao ler o arquivo Excel do Mercado Livre.");
    }
}

// PROCESSAR AS DUAS PLANILHAS DO MERCADO LIVRE
function processarPlanilhasML() {
    if (!mlWorkbookFicha || !mlWorkbookFiscais) return uiAlert("Atenção", "Por favor, carregue as duas planilhas primeiro.");

    function lerTextoCelula(cell) {
        if (!cell || cell.value === null || cell.value === undefined) return '';
        let texto = cell.value.richText ? cell.value.richText.map(rt => rt.text).join('') : String(cell.value);
        return texto.toLowerCase().trim();
    }

    todosProdutos = [];
    setEansExistentesGlobal = new Set();
    let stats = { total: 0, ok: 0, vazios: 0, duplicados: 0 };
    let maxBaseDetectada = 0n;
    let mapaFiscais = {};
    
    let encontrouColunaFiscal = false;
    let encontrouColunaFicha = false;

    // Vasculhar TODAS as abas dos Dados Fiscais
    mlWorkbookFiscais.eachSheet((sheet) => {
        let colId = -1, colVar = -1, colSku = -1, colEan = -1;
        for (let r = 1; r <= 8; r++) {
            const row = sheet.getRow(r);
            row.eachCell((cell, colNumber) => {
                const val = lerTextoCelula(cell);
                if (val === 'código do anúncio' || val === 'id') colId = colNumber;
                if (val === 'variation_id' || val === 'variação id') colVar = colNumber;
                if (val === 'código do produto' || val === 'sku') colSku = colNumber;
                if (val === 'ean' || val.includes('código de barras')) colEan = colNumber;
            });
            if (colId !== -1 && colEan !== -1) break; 
        }

        if (colId !== -1 && colEan !== -1) {
            encontrouColunaFiscal = true;
            sheet.eachRow((row, rowNumber) => {
                if (rowNumber > 2) { 
                    let id = lerTextoCelula(row.getCell(colId)).toUpperCase();
                    let varId = lerTextoCelula(row.getCell(colVar));
                    if (id.startsWith('MLB')) {
                        let chave = id + "_" + varId; 
                        mapaFiscais[chave] = {
                            sheetId: sheet.id, 
                            rowNum: rowNumber,
                            colEan: colEan,
                            ean: lerTextoCelula(row.getCell(colEan))
                        };
                    }
                }
            });
        }
    });

    // Vasculhar TODAS as abas da Ficha Técnica
    mlWorkbookFicha.eachSheet((sheet) => {
        let colId = -1, colVar = -1, colSku = -1, colEan = -1;
        for (let r = 1; r <= 8; r++) {
            const row = sheet.getRow(r);
            row.eachCell((cell, colNumber) => {
                const val = lerTextoCelula(cell);
                if (val === 'código do anúncio' || val === 'id') colId = colNumber;
                if (val === 'variação id' || val === 'variation_id') colVar = colNumber;
                if (val === 'sku' || val === 'código do produto') colSku = colNumber;
                if (val.includes('código universal') || val === 'gtin') colEan = colNumber;
            });
            if (colId !== -1 && colEan !== -1) break;
        }

        if (colId !== -1 && colEan !== -1) {
            encontrouColunaFicha = true;
            sheet.eachRow((row, rowNumber) => {
                if (rowNumber > 2) {
                    let id = lerTextoCelula(row.getCell(colId)).toUpperCase();
                    let varId = lerTextoCelula(row.getCell(colVar));
                    let sku = lerTextoCelula(row.getCell(colSku));

                    if (id.startsWith('MLB')) {
                        let chave = id + "_" + varId;
                        let infoFiscais = mapaFiscais[chave];

                        if (infoFiscais) { 
                            stats.total++;
                            let eanFicha = lerTextoCelula(row.getCell(colEan));
                            let eanAtual = eanFicha || infoFiscais.ean; 
                            eanAtual = eanAtual.replace(/\D/g, ''); 

                            let isVazio = (!eanAtual || eanAtual.length < 8);
                            let isDuplicado = false;

                            if (isVazio) {
                                stats.vazios++;
                            } else {
                                if (setEansExistentesGlobal.has(eanAtual)) {
                                    stats.duplicados++;
                                    isDuplicado = true;
                                } else {
                                    setEansExistentesGlobal.add(eanAtual);
                                    stats.ok++;
                                }
                                if (eanAtual.length === 13 && !isNaN(eanAtual)) {
                                    let base12 = BigInt(eanAtual.substring(0, 12));
                                    if (base12 > maxBaseDetectada) maxBaseDetectada = base12;
                                }
                            }

                            todosProdutos.push({
                                plataforma: 'mercadolivre',
                                idProd: id,
                                idVar: varId || sku,
                                isVazio: isVazio,
                                isDuplicado: isDuplicado,
                                sheetIdFicha: sheet.id,
                                rowNumFicha: rowNumber,
                                colEanFicha: colEan,
                                sheetIdFiscais: infoFiscais.sheetId,
                                rowNumFiscais: infoFiscais.rowNum,
                                colEanFiscais: infoFiscais.colEan
                            });
                        }
                    }
                }
            });
        }
    });

    if (!encontrouColunaFicha || !encontrouColunaFiscal) {
        return uiAlert("Erro de Leitura", "Colunas de EAN não encontradas nas planilhas do Mercado Livre. Certifique-se de baixar as planilhas corretas.");
    }
    
    atualizarDashboardDashboard(stats, maxBaseDetectada);
}

// Atualiza o painel verde após ler qualquer planilha
function atualizarDashboardDashboard(stats, maxBaseDetectada) {
    document.getElementById('rxTotal').innerText = stats.total;
    document.getElementById('rxOk').innerText = stats.ok;
    document.getElementById('rxVazios').innerText = stats.vazios;
    document.getElementById('rxDuplicados').innerText = stats.duplicados;
    document.getElementById('dashResumo').style.display = 'grid';
    
    const loja = bancoLojas[lojaAtivaId];
    if (loja.prefixoLoja) {
        let prefixInt = BigInt(loja.prefixoLoja.padEnd(12, '0'));
        if (maxBaseDetectada >= prefixInt && String(maxBaseDetectada).startsWith(loja.prefixoLoja)) {
            baseAutoDetectada = (maxBaseDetectada + 1n).toString().padStart(12, '0');
        } else {
            baseAutoDetectada = obterBaseParaInput(loja);
        }
        document.getElementById('codigoBase').value = baseAutoDetectada;
        fonteBaseAtual = "auto";
    } else if (maxBaseDetectada > 0n) {
        baseAutoDetectada = (maxBaseDetectada + 1n).toString().padStart(12, '0');
        document.getElementById('codigoBase').value = baseAutoDetectada;
        fonteBaseAtual = "auto";
    } else {
        baseAutoDetectada = "";
        puxarMemoria(true);
    }

    validarPrefixoGS1();
    calcularFila();
    uiAlert("Raio-X Concluído! 🩻", `Planilha processada com sucesso.\n\nTotal de Produtos: ${stats.total}\nEANs a gerar: ${stats.vazios}\n\nAgora já pode clicar em 'Gerar Lista'.`);
}

function calcularFila() {
    if (todosProdutos.length === 0) return;
    const modoSelecionado = document.querySelector('input[name="modo_acao"]:checked').value;
    filaDeInjecao = [];

    todosProdutos.forEach(prod => {
        if (modoSelecionado === 'todos') { filaDeInjecao.push(prod); } 
        else if (modoSelecionado === 'erros') { if (prod.isVazio || prod.isDuplicado) filaDeInjecao.push(prod); } 
        else { if (prod.isVazio) filaDeInjecao.push(prod); }
    });

    document.getElementById('qtdGerar').value = filaDeInjecao.length;
}

// ================= VALIDAÇÃO E GERAÇÃO DA LISTA =================
function calcularDigitoVerificador(base12) {
    let soma = 0;
    for (let i = 0; i < 12; i++) soma += parseInt(base12[i]) * (i % 2 === 0 ? 1 : 3);
    return (Math.ceil(soma / 10) * 10) - soma;
}

function formatarTempo(segs) { return segs <= 0 ? "Finalizando..." : `${Math.floor(segs/60)}m ${Math.floor(segs%60)}s`; }
function formatarHoraConclusao(segs) {
    if (segs <= 0) return "Concluído!";
    let d = new Date(Date.now() + (segs * 1000));
    return `Término previsto: ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
}

function obterProximoEanLivre() {
    let eanValido = false;
    let novoEan = "";
    let b12 = "";
    
    while (!eanValido) {
        b12 = sequenciaGlobalAtual.toString().padStart(12, '0');
        novoEan = b12 + calcularDigitoVerificador(b12);
        sequenciaGlobalAtual++; 
        
        if (!setEansExistentesGlobal.has(novoEan)) {
            setEansExistentesGlobal.add(novoEan);
            eanValido = true;
        }
    }
    return novoEan;
}

function gerarTabela() {
    if (validacaoEmAndamento) return;
    const tbody = document.getElementById('corpoTabela');
    if (filaDeInjecao.length === 0) return uiAlert("Atenção", "Não há produtos na fila para a regra selecionada.\nVerifique a planilha ou altere o Modo de Correção.");
    
    let base = document.getElementById('codigoBase').value.replace(/\D/g, '');
    if (base.length !== 12) return uiAlert("Formato Incorreto", "O Código Base precisa ter exatamente 12 números.");

    document.getElementById('statusContainer').style.display = 'none';
    tbody.innerHTML = ""; 
    
    sequenciaGlobalAtual = BigInt(base);
    let fragment = document.createDocumentFragment();

    filaDeInjecao.forEach((item, i) => {
        let ean = obterProximoEanLivre(); 
        item.eanGerado = ean;
        item.statusValidacao = 'pendente';

        let tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${i+1}</td>
            <td class="codigo-ean" id="ean-visual-${i}">${ean}</td>
            <td><span class="badge badge-pendente" id="status-badge-${i}">⏳ Aguardando</span></td>
            <td class="produto-nome">
                <span class="id-label">Prod:</span> ${item.idProd}<br>
                <span class="id-label">Var:</span> ${item.idVar}
            </td>
        `;
        fragment.appendChild(tr);
    });
    tbody.appendChild(fragment);
}

function travarInterface(travado) {
    document.querySelectorAll('.painel-controles input, .painel-controles button').forEach(el => el.disabled = travado);
    document.getElementById('selectLoja').disabled = travado;
    document.querySelectorAll('.seletor-loja button').forEach(el => el.disabled = travado);
}

function alternarPausa() {
    isPausadoManual = !isPausadoManual;
    const btn = document.getElementById('btnPausar');
    const timer = document.getElementById('timer');
    const progresso = document.getElementById('progresso');

    if (isPausadoManual) {
        btn.innerHTML = "▶️ Retomar Validação";
        btn.classList.add('modo-retomar');
        timer.innerText = "⏸️ PAUSADO PELO USUÁRIO";
        progresso.innerText = "Aguardando retomada...";
    } else {
        btn.innerHTML = "⏸️ Pausar Validação";
        btn.classList.remove('modo-retomar');
    }
}

async function verificarNoBanco() {
    const linhas = document.querySelectorAll('#corpoTabela tr');
    if (linhas.length === 0) return uiAlert("Passo Ausente", "Gere a lista primeiro clicando no botão 'Gerar Lista'.");
    
    validacaoEmAndamento = true;
    isPausadoManual = false;
    let validacaoCancelada = false;
    travarInterface(true);

    document.getElementById('statusContainer').style.display = 'block';
    document.getElementById('btnPausar').style.display = 'inline-flex';
    document.getElementById('btnPausar').innerHTML = "⏸️ Pausar Validação";
    document.getElementById('btnPausar').classList.remove('modo-retomar');

    const progresso = document.getElementById('progresso');
    const timer = document.getElementById('timer');
    const conclusao = document.getElementById('horaConclusao');

    const isModoOfflineRisk = document.getElementById('checkOffline').checked;
    const total = linhas.length;
    let tempoInicio = Date.now();
    let limiteAtingido = false;
    let validadosConcluidos = 0;
    const TAMANHO_LOTE = 3;

    async function processarItem(i) {
        if (limiteAtingido || validacaoCancelada) return;

        let linha = linhas[i];
        let ean = filaDeInjecao[i].eanGerado; 
        let celulaStatus = linha.querySelector('td:nth-child(3)');

        if (isModoOfflineRisk) {
            filaDeInjecao[i].statusValidacao = 'offline';
            celulaStatus.innerHTML = `<span class="badge badge-offline">✅ Aprovado</span>`;
            validadosConcluidos++;
            return;
        }

        if (i % TAMANHO_LOTE === 0) linha.scrollIntoView({ behavior: "smooth", block: "center" });
        celulaStatus.innerHTML = `<span class="badge" style="background:#e0f2fe; color:#0284c7;">Buscando...</span>`;

        let processado = false;
        while (!processado && !validacaoCancelada && !limiteAtingido) {
            while (isPausadoManual) { await new Promise(r => setTimeout(r, 500)); }
            if (validacaoCancelada || limiteAtingido) break;

            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 10000); 

                let res = await fetch(`${URL_DO_PROXY}/${ean}`, { 
                    headers: { 'X-Cosmos-Token': API_TOKEN },
                    signal: controller.signal
                });
                clearTimeout(timeoutId);

                if (res.status === 200) { 
                    ean = obterProximoEanLivre();
                    filaDeInjecao[i].eanGerado = ean; 
                    linha.querySelector('.codigo-ean').innerText = ean; 
                    celulaStatus.innerHTML = `<span class="badge badge-buscando">🔄 Recalculando...</span>`;
                    await new Promise(r => setTimeout(r, 600)); 
                } 
                else if (res.status === 404) { 
                    filaDeInjecao[i].statusValidacao = 'aprovado';
                    celulaStatus.innerHTML = `<span class="badge badge-livre">Livre</span>`; 
                    processado = true; 
                } 
                else if (res.status === 429) {
                    for(let j = validadosConcluidos; j < total; j++) {
                        if(filaDeInjecao[j].statusValidacao !== 'aprovado' && filaDeInjecao[j].statusValidacao !== 'em_uso') {
                            filaDeInjecao[j].statusValidacao = 'offline';
                            linhas[j].querySelector('td:nth-child(3)').innerHTML = `<span class="badge badge-offline">✅ Aprovado (Limite API)</span>`;
                        }
                    }
                    processado = true;
                    limiteAtingido = true;
                    break; 
                }
                else if (res.status === 401) {
                    validacaoCancelada = true;
                    uiAlert("Erro de Autenticação 🛑", "O seu Token da API Cosmos é inválido ou expirou.");
                    celulaStatus.innerHTML = `<span class="badge badge-erro">Erro de Token</span>`;
                    break;
                }
                else { 
                    filaDeInjecao[i].statusValidacao = 'aprovado';
                    celulaStatus.innerHTML = `<span class="badge badge-offline">✅ Aprovado (Forçado)</span>`; 
                    processado = true; 
                }
            } catch (e) { 
                if (e.name === 'AbortError') {
                    filaDeInjecao[i].statusValidacao = 'offline';
                    celulaStatus.innerHTML = `<span class="badge badge-offline">✅ Aprovado (Timeout)</span>`;
                    processado = true;
                } else {
                    celulaStatus.innerHTML = `<span class="badge badge-erro">🛑 Pausado</span>`;
                    if (!isPausadoManual && !validacaoCancelada) {
                        alternarPausa(); 
                        let retomar = await uiConfirmAsync("Conexão Interrompida", "A comunicação com o banco falhou. Tentar de novo?", "✅ Conexão ok, retomar!");
                        if (retomar) alternarPausa(); 
                        else validacaoCancelada = true;
                    } else {
                        while (isPausadoManual && !validacaoCancelada) { await new Promise(r => setTimeout(r, 500)); }
                    }
                    if(!validacaoCancelada) celulaStatus.innerHTML = `<span class="badge badge-buscando">🔄 Retomando...</span>`;
                }
            }
        } 
        validadosConcluidos++;
    }

    for (let i = 0; i < total; i += TAMANHO_LOTE) {
        if (validacaoCancelada || limiteAtingido) break;
        while (isPausadoManual) { await new Promise(r => setTimeout(r, 500)); tempoInicio += 500; }

        let tempoPassado = (Date.now() - tempoInicio) / 1000;
        let media = validadosConcluidos > 0 ? tempoPassado / validadosConcluidos : 1.5; 
        let segsRestantes = (total - validadosConcluidos) * media;

        timer.innerText = `⏱️ Restante: ${formatarTempo(segsRestantes)}`;
        conclusao.innerText = formatarHoraConclusao(segsRestantes);
        progresso.innerText = `Validando no Banco: ${Math.min(i + TAMANHO_LOTE, total)} de ${total}`;

        let lote = [];
        for (let j = i; j < i + TAMANHO_LOTE && j < total; j++) { lote.push(processarItem(j)); }
        await Promise.all(lote); 

        if (isModoOfflineRisk && validadosConcluidos >= total) break;
        if (!isModoOfflineRisk) await new Promise(r => setTimeout(r, 800)); 
        else await new Promise(r => setTimeout(r, 10)); 
    }
    
    if (validacaoCancelada) {
        progresso.innerText = "Processo Cancelado pelo Usuário.";
        timer.innerText = "-"; conclusao.innerText = "-";
    } else if (limiteAtingido) {
        progresso.innerText = "Validação Concluída! (Cota da API Atingida)";
        timer.innerText = "✅ Finalizado!"; conclusao.innerText = "-";
    } else {
        progresso.innerText = "Validação Concluída! Pode baixar a planilha.";
        timer.innerText = "✅ Finalizado!"; conclusao.innerText = "-";
    }

    validacaoEmAndamento = false;
    travarInterface(false);
    document.getElementById('btnPausar').style.display = 'none';
}

// ================= EXPORTAÇÃO INTELIGENTE (TODAS AS PLATAFORMAS) =================
async function exportarPlanilha() {
    if(filaDeInjecao.length === 0) return;
    if(plataformaAtual !== 'mercadolivre' && !originalWorkbook) return;
    if(plataformaAtual === 'mercadolivre' && (!mlWorkbookFicha || !mlWorkbookFiscais)) return;

    let eansValidados = [];
    let logConteudo = "ID_Produto\tID_Variante\tEAN_Atribuido\tPlataforma\n"; 
    let possuiErro = false;

    filaDeInjecao.forEach(item => {
        if (item.statusValidacao === 'em_uso' || item.statusValidacao === 'erro') possuiErro = true;
        
        if (item.statusValidacao === 'aprovado' || item.statusValidacao === 'offline') {
            eansValidados.push(item.eanGerado);

            if (item.plataforma !== 'mercadolivre') {
                originalWorksheet.getCell(item.rowNum, item.colEan).value = String(item.eanGerado);
                if (item.plataforma === 'tiktok' && item.colGtinType && item.colGtinType !== -1) {
                    originalWorksheet.getCell(item.rowNum, item.colGtinType).value = "EAN";
                }
            } else {
                let sheetFicha = mlWorkbookFicha.getWorksheet(item.sheetIdFicha);
                sheetFicha.getCell(item.rowNumFicha, item.colEanFicha).value = String(item.eanGerado);
                
                let sheetFiscais = mlWorkbookFiscais.getWorksheet(item.sheetIdFiscais);
                sheetFiscais.getCell(item.rowNumFiscais, item.colEanFiscais).value = String(item.eanGerado);
            }
            logConteudo += `${item.idProd}\t${item.idVar}\t${item.eanGerado}\t${plataformaAtual}\n`;
        }
    });

    if (possuiErro) return uiAlert("Atenção", "Códigos 'Em Uso' foram encontrados.\nPor favor, altere o Código Base e gere novamente.");
    if (eansValidados.length < filaDeInjecao.length) return uiAlert("Atenção", "Precisa de validar a lista completa antes de descarregar o ficheiro.");

    const ultimoEan = eansValidados[eansValidados.length - 1];
    bancoLojas[lojaAtivaId].ultimoEan = ultimoEan;
    bancoLojas[lojaAtivaId].base12 = ultimoEan.substring(0, 12);
    salvarCofreLojas();
    atualizarUI_Memoria(); 

    let prefixo = "";
    let modo = document.querySelector('input[name="modo_acao"]:checked').value;
    if (modo === 'todos') prefixo = "COMPLETA_";
    if (modo === 'erros') prefixo = "CORRIGIDA_";
    if (modo === 'vazios') prefixo = "VAZIOS_";

    if (plataformaAtual !== 'mercadolivre') {
        let nomeFinal = prefixo + originalFileName;
        const buffer = await originalWorkbook.xlsx.writeBuffer();
        baixarArquivoLocal(buffer, nomeFinal);
    } else {
        let nomeFicha = prefixo + "Ficha_Tecnica.xlsx";
        let nomeFiscais = prefixo + "Dados_Fiscais.xlsx";
        const bufferFicha = await mlWorkbookFicha.xlsx.writeBuffer();
        baixarArquivoLocal(bufferFicha, nomeFicha);

        setTimeout(async () => {
            const bufferFiscais = await mlWorkbookFiscais.xlsx.writeBuffer();
            baixarArquivoLocal(bufferFiscais, nomeFiscais);
        }, 1000);
    }

    uiAlert("🎉 CONCLUÍDO COM SUCESSO!", `Os seus EANs foram processados e a planilha transferida!`);

    setTimeout(() => {
        const blobLog = new Blob([logConteudo], { type: 'text/plain' });
        const linkLog = document.createElement("a");
        linkLog.href = URL.createObjectURL(blobLog);
        let nomeLog = plataformaAtual === 'mercadolivre' ? 'MercadoLivre' : originalFileName;
        linkLog.download = `LOG_${nomeLog.replace('.xlsx', '.txt')}`;
        document.body.appendChild(linkLog);
        linkLog.click();
        document.body.removeChild(linkLog);
    }, 2500);
}

function baixarArquivoLocal(buffer, nomeFinal) {
    const linkExcel = document.createElement("a");
    linkExcel.href = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    linkExcel.download = nomeFinal;
    document.body.appendChild(linkExcel);
    linkExcel.click();
    document.body.removeChild(linkExcel);
}