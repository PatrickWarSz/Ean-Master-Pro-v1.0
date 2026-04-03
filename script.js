// =========================================================
const URL_DO_PROXY = "https://proxyeanmaster.gsouzapatrick.workers.dev"; 
// =========================================================

let API_TOKEN = ''; 
let validacaoEmAndamento = false;
let isPausadoManual = false; 

// Cofre de Lojas
let bancoLojas = {
    'default': { nome: 'Loja Principal', ultimoEan: null, base12: null }
};
let lojaAtivaId = 'default';

// Variável global para controlar a Fila de EANs com Trava de Repetição
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

let passoAtual = 0;
const passosTutorial = [
    { el: 'hl-importar', titulo: '1. Importação & Raio-X', texto: 'Ao importar a planilha "Informação de Venda", o programa faz um raio-x revelando EANs ausentes ou duplicados. Trocar de loja limpa o painel para não misturar dados!' },
    { el: 'hl-acoes', titulo: '2. Inteligência de Correção', texto: 'Escolha se deseja preencher os vazios, corrigir as duplicidades ou substituir a loja inteira.' },
    { el: 'hl-base', titulo: '3. Código Base & CNPJ', texto: 'O programa gerencia a sequência baseada no prefixo de cada Loja (Ex: 789 + Início CNPJ). Sem conflitos e sem misturar dados!' },
    { el: 'hl-botoes', titulo: '4. Execução', texto: 'Gere a lista, valide e baixe a planilha. Envie o arquivo pronto na aba de Envio da Shopee!' }
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
        const memAntiga = JSON.parse(localStorage.getItem('ean_memoria_interna'));
        if (memAntiga) {
            bancoLojas['default'].ultimoEan = memAntiga.ean;
            bancoLojas['default'].base12 = memAntiga.base12;
            localStorage.removeItem('ean_memoria_interna');
        }
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

function limparWorkspace() {
    document.getElementById('fileUpload').value = "";
    originalWorkbook = null;
    originalWorksheet = null;
    
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
            bancoLojas[id] = { 
                nome: nome.trim(), 
                prefixoLoja: baseCnpj, 
                ultimoEan: null, 
                base12: null 
            };
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
        return uiAlert("Ação Bloqueada", "A Loja Principal padrão do sistema não pode ser excluída, mas você pode renomeá-la clicando no botão ✏️ ao lado.");
    }
    uiAlert("Excluir Loja", `Tem certeza que deseja excluir o perfil <b>${bancoLojas[lojaAtivaId].nome}</b>?\nTodo o histórico de EANs desta loja será perdido.`, true, () => {
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
        uiAlert("Sem Histórico", `A loja <b>${loja.nome}</b> ainda não possui histórico de cálculos salvo. Comece com a base gerada na configuração inicial.`);
    }
}

function limparMemoriaInterna() {
    uiAlert("Limpar Memória da Loja", `Tem certeza que deseja apagar o histórico da loja <b>${bancoLojas[lojaAtivaId].nome}</b>?\nUse isso apenas se quiser recomeçar a sequência desta loja do zero.`, true, () => {
        const loja = bancoLojas[lojaAtivaId];
        loja.ultimoEan = null;
        loja.base12 = null; 
        
        salvarCofreLojas();
        atualizarUI_Memoria();
        document.getElementById('codigoBase').value = obterBaseParaInput(loja);
        fonteBaseAtual = "manual";
        validarPrefixoGS1();
        uiAlert("Pronto", "Memória da loja limpa com sucesso! O contador voltará ao início (0000).");
    });
}

function validarPrefixoGS1() {
    const input = document.getElementById('codigoBase');
    const aviso = document.getElementById('avisoGS1');
    const val = input.value.replace(/\D/g, '');
    
    if (val.length >= 3) {
        aviso.style.display = "block";
        const loja = bancoLojas[lojaAtivaId];
        
        // 1. Se a base já transbordou o limite do perfil
        if (loja.prefixoLoja && !val.startsWith(loja.prefixoLoja)) {
            aviso.innerHTML = `🚨 LIMITE ULTRAPASSADO: O contador estourou e o prefixo original (${loja.prefixoLoja}) mudou.`;
            aviso.style.color = "#dc2626"; // Vermelho
        } 
        // 2. Se a base está certa, calcula quantos códigos faltam para bater o teto
        else if (val.length === 12 && loja.prefixoLoja && val.startsWith(loja.prefixoLoja)) {
            const prefixoLength = loja.prefixoLoja.length;
            
            // Só faz o cálculo de sobra se o prefixo da loja for menor que 12 dígitos
            if (prefixoLength < 12) {
                const sequenciaAtual = parseInt(val.substring(prefixoLength));
                const limiteLote = Math.pow(10, 12 - prefixoLength);
                const faltam = limiteLote - sequenciaAtual;

                if (faltam <= 300) { 
                    aviso.innerHTML = `⚠️ ALERTA DE LOTE: Restam apenas <b>${faltam} códigos</b> antes do limite de ${limiteLote.toLocaleString('pt-BR')} ser atingido!`;
                    aviso.style.color = "#ea580c"; // Laranja forte
                } else {
                    aviso.innerHTML = `✅ Prefixo da loja reconhecido. (Livre: <b>${faltam}</b> códigos)`;
                    aviso.style.color = "#059669"; // Verde
                }
            } else {
                aviso.innerHTML = `✅ Prefixo de 12 dígitos reconhecido.`;
                aviso.style.color = "#059669";
            }
        } 
        // 3. Validação comum GS1
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
            uiAlert("Mudança de Estratégia", "Como você escolheu 'Substituir Tudo', a base lida da planilha foi trocada pela memória da loja para garantir uma sequência limpa e nova.");
        }
    } else {
        if (baseAutoDetectada !== "") {
            inputBase.value = baseAutoDetectada;
            fonteBaseAtual = "auto";
            validarPrefixoGS1();
        }
    }
}

let originalWorkbook = null;
let originalWorksheet = null;
let originalFileName = "";
let shopeeGtinColNumber = -1; 
let shopeeProductIdCol = 1;
let shopeeVarIdCol = 3;
let todosProdutos = []; 
let filaDeInjecao = []; 
let setEansExistentesGlobal = new Set(); 

async function lerPlanilha(event) {
    const file = event.target.files[0];
    if(!file) return;
    originalFileName = file.name; 

    try {
        const buffer = await file.arrayBuffer();
        originalWorkbook = new ExcelJS.Workbook();
        await originalWorkbook.xlsx.load(buffer);
        originalWorksheet = originalWorkbook.worksheets[0]; 

        shopeeGtinColNumber = -1;
        shopeeProductIdCol = 1; 
        shopeeVarIdCol = 3; 

        for (let r = 1; r <= 3; r++) {
            const row = originalWorksheet.getRow(r);
            row.eachCell((cell, colNumber) => {
                const cellValue = String(cell.value || '').toLowerCase().trim();
                if (cellValue.includes('ps_gtin_code') || cellValue.includes('gtin (ean)')) shopeeGtinColNumber = colNumber;
                if (cellValue === 'id do produto' || cellValue === 'et_title_product_id') shopeeProductIdCol = colNumber;
                if (cellValue === 'variante identificador' || cellValue === 'et_title_variation_id') shopeeVarIdCol = colNumber;
            });
        }

        if (shopeeGtinColNumber === -1) {
            return uiAlert("Atenção", "Coluna GTIN não encontrada.\nVerifique se é a planilha 'Informação de Venda'.");
        }

        todosProdutos = [];
        setEansExistentesGlobal = new Set(); 
        let stats = { total: 0, ok: 0, vazios: 0, duplicados: 0 };
        let maxBaseDetectada = 0n;

        originalWorksheet.eachRow((row, rowNumber) => {
            if (rowNumber > 3) { 
                const idProdRaw = String(row.getCell(shopeeProductIdCol).value || '').trim();
                if (idProdRaw && !isNaN(idProdRaw) && idProdRaw.length > 5) {
                    
                    const eanAtual = String(row.getCell(shopeeGtinColNumber).value || '').trim();
                    const idVarRaw = String(row.getCell(shopeeVarIdCol).value || '0').trim();
                    
                    stats.total++;
                    let isVazio = (!eanAtual || eanAtual.length < 8 || eanAtual.includes('Obrigat'));
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

                    todosProdutos.push({ rowNum: rowNumber, idProd: idProdRaw, idVar: idVarRaw, isVazio: isVazio, isDuplicado: isDuplicado });
                }
            }
        });

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

    } catch (error) { uiAlert("Erro", "Falha ao ler o arquivo Excel."); }
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
    if (base.length !== 12) return uiAlert("Formato Incorreto", "O Código Base precisa ter exatamente 12 números (Prefixo da Loja + Sequência).");

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
            while (isPausadoManual) {
                await new Promise(r => setTimeout(r, 500));
            }
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
                    uiAlert("Erro de Autenticação 🛑", "O seu Token da API Cosmos é inválido ou expirou.\n\nPor favor, clique no botão '⚙️ API' no topo da tela para reconfigurar sua chave.");
                    celulaStatus.innerHTML = `<span class="badge badge-erro">Erro de Token</span>`;
                    break;
                }
                else if (res.status >= 500) {
                    throw new Error("Erro no Servidor Cosmos");
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
                        let mensagemQueda = "A comunicação com o banco de dados falhou (Sem internet ou servidor instável).\n\n1. Verifique sua conexão.\n2. Clique em Retomar para tentar novamente.";
                        
                        let retomar = await uiConfirmAsync("Conexão Interrompida ⚠️", mensagemQueda, "✅ Conexão ok, retomar!");
                        
                        if (retomar) {
                            alternarPausa(); 
                        } else {
                            validacaoCancelada = true;
                        }
                    } else {
                        while (isPausadoManual && !validacaoCancelada) {
                            await new Promise(r => setTimeout(r, 500));
                        }
                    }
                    
                    if(!validacaoCancelada) celulaStatus.innerHTML = `<span class="badge badge-buscando">🔄 Retomando...</span>`;
                }
            }
        } 
        validadosConcluidos++;
    }

    for (let i = 0; i < total; i += TAMANHO_LOTE) {
        if (validacaoCancelada || limiteAtingido) break;

        while (isPausadoManual) {
            await new Promise(r => setTimeout(r, 500));
            tempoInicio += 500; 
        }

        let tempoPassado = (Date.now() - tempoInicio) / 1000;
        let media = validadosConcluidos > 0 ? tempoPassado / validadosConcluidos : 1.5; 
        let segsRestantes = (total - validadosConcluidos) * media;

        timer.innerText = `⏱️ Restante: ${formatarTempo(segsRestantes)}`;
        conclusao.innerText = formatarHoraConclusao(segsRestantes);
        progresso.innerText = `Validando no Banco: ${Math.min(i + TAMANHO_LOTE, total)} de ${total}`;

        let lote = [];
        for (let j = i; j < i + TAMANHO_LOTE && j < total; j++) {
            lote.push(processarItem(j));
        }

        await Promise.all(lote); 

        if (isModoOfflineRisk && validadosConcluidos >= total) break;

        if (!isModoOfflineRisk) {
            await new Promise(r => setTimeout(r, 800)); 
        } else {
            await new Promise(r => setTimeout(r, 10)); 
        }
    }
    
    if (validacaoCancelada) {
        progresso.innerText = "Processo Cancelado pelo Usuário.";
        timer.innerText = "-";
        conclusao.innerText = "-";
    } else if (limiteAtingido) {
        progresso.innerText = "Validação Concluída! (Cota da API Atingida)";
        timer.innerText = "✅ Finalizado!";
        conclusao.innerText = "-";
    } else {
        progresso.innerText = "Validação Concluída! Pode baixar a planilha.";
        timer.innerText = "✅ Finalizado!";
        conclusao.innerText = "-";
    }

    validacaoEmAndamento = false;
    travarInterface(false);
    document.getElementById('btnPausar').style.display = 'none';
}

async function exportarPlanilha() {
    if(!originalWorkbook || filaDeInjecao.length === 0) return;

    let eansValidados = [];
    let logConteudo = "ID_Produto\tID_Variante\tEAN_Atribuido\n"; 
    let possuiErro = false;

    filaDeInjecao.forEach(item => {
        if (item.statusValidacao === 'em_uso' || item.statusValidacao === 'erro') {
            possuiErro = true;
        }
        if (item.statusValidacao === 'aprovado' || item.statusValidacao === 'offline') {
            eansValidados.push(item.eanGerado);
            originalWorksheet.getCell(item.rowNum, shopeeGtinColNumber).value = String(item.eanGerado);
            logConteudo += `${item.idProd}\t${item.idVar}\t${item.eanGerado}\n`;
        }
    });

    if (possuiErro) return uiAlert("Atenção", "Códigos 'Em Uso' foram encontrados.\nPor favor, altere o Código Base e gere novamente.");
    if (eansValidados.length < filaDeInjecao.length) return uiAlert("Atenção", "Você precisa validar a lista completa antes de baixar o arquivo.");

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

    let nomeFinal = prefixo + originalFileName;

    const buffer = await originalWorkbook.xlsx.writeBuffer();
    const linkExcel = document.createElement("a");
    linkExcel.href = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    linkExcel.download = nomeFinal;
    document.body.appendChild(linkExcel);
    linkExcel.click();
    document.body.removeChild(linkExcel);

    uiAlert("🎉 PLANILHA BAIXADA COM SUCESSO!", `A sua planilha Excel já foi gerada e transferida.\n\n⚠️ Atenção: O navegador pode pedir a sua permissão (no canto superior direito) para baixar múltiplos arquivos e gerar o seu Log de Auditoria em formato .txt.\n\nPor favor, clique em <b>"Permitir"</b> caso o aviso apareça.\n\nCOMO ENVIAR PARA A SHOPEE:\n1. Acesse <b>Ações em Massa > Editar em Massa</b>.\n2. Clique na aba <b>'Envio'</b>.\n3. Envie a planilha gerada e aguarde a conclusão!`);

    setTimeout(() => {
        const blobLog = new Blob([logConteudo], { type: 'text/plain' });
        const linkLog = document.createElement("a");
        linkLog.href = URL.createObjectURL(blobLog);
        linkLog.download = `LOG_${nomeFinal.replace('.xlsx', '.txt')}`;
        document.body.appendChild(linkLog);
        linkLog.click();
        document.body.removeChild(linkLog);
    }, 1500);
}