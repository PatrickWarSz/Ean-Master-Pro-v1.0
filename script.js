// =========================================================
const URL_DO_PROXY = "https://proxyeanmaster.gsouzapatrick.workers.dev"; 
// =========================================================

let API_TOKEN = ''; 
let validacaoEmAndamento = false;
let isPausadoManual = false; 
let plataformaAtual = 'shopee'; 

// Cofre de Lojas
let bancoLojas = {
    'default': { nome: 'Loja Principal', ultimoEan: null, base12: null }
};

let lojaAtivaId = 'default';

let sequenciaGlobalAtual = 0n;

// ====== SISTEMA DE LOGIN FIREBASE E NUVEM ======
const firebaseConfig = {
    apiKey: "AIzaSyBXFynatu21jBHnMyM_yfoDgunE3kqDM4k",
    authDomain: "ean-master-pro.firebaseapp.com",
    projectId: "ean-master-pro",
    storageBucket: "ean-master-pro.firebasestorage.app",
    messagingSenderId: "387761437602",
    appId: "1:387761437602:web:050da0d4091c55475790fb"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// 1. Lógica para as ABAS da tela de Login funcionarem
function alternarAuth(tipo) {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('ativa'));
    document.querySelectorAll('.auth-form').forEach(f => {
        f.classList.remove('ativo');
        f.style.display = 'none';
    });

    if (tipo === 'login') {
        document.getElementById('tabLogin').classList.add('ativa');
        const form = document.getElementById('formLogin');
        form.style.display = 'block';
        setTimeout(() => form.classList.add('ativo'), 10);
    } else {
        document.getElementById('tabCadastro').classList.add('ativa');
        const form = document.getElementById('formCadastro');
        form.style.display = 'block';
        setTimeout(() => form.classList.add('ativo'), 10);
    }
}

function inicializarSistema() {
    firebase.auth().onAuthStateChanged((user) => {
        if (user) {
            sessionStorage.setItem('ean_master_sessao', user.email);
            verificarTokenCosmos();
        } else {
            sessionStorage.removeItem('ean_master_sessao');
            mostrarTela('tela-login');
        }
    });
}

function loginComGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    firebase.auth().signInWithPopup(provider)
        .then((result) => {
            sessionStorage.setItem('ean_master_sessao', result.user.email);
            verificarTokenCosmos();
        }).catch((error) => {
            uiAlert("Erro", "O login com o Google falhou: " + error.message);
        });
}

// 2. Função conectada à aba de CADASTRO
function fazerCadastro() {
    const email = document.getElementById('emailCadastro').value;
    const senha = document.getElementById('senhaCadastro').value;
    
    if(!email || !senha) return uiAlert("Atenção", "Preencha e-mail e senha para se cadastrar.");
    if(senha.length < 6) return uiAlert("Segurança", "A senha precisa ter no mínimo 6 caracteres.");

    firebase.auth().createUserWithEmailAndPassword(email, senha)
        .then((userCredential) => {
            sessionStorage.setItem('ean_master_sessao', userCredential.user.email);
            uiAlert("Sucesso 🎉", "Conta criada com sucesso!", false, () => verificarTokenCosmos());
        })
        .catch((error) => {
            let msg = error.code === 'auth/email-already-in-use' ? 'Este e-mail já está cadastrado.' : error.message;
            uiAlert("Erro no Cadastro", msg);
        });
}

// 3. Função conectada à aba de LOGIN
function fazerLogin() {
    const email = document.getElementById('emailLogin').value;
    const senha = document.getElementById('senhaLogin').value;
    
    if(!email || !senha) return uiAlert("Atenção", "Preencha e-mail e senha.");
    
    firebase.auth().signInWithEmailAndPassword(email, senha)
        .then((userCredential) => {
            sessionStorage.setItem('ean_master_sessao', userCredential.user.email);
            verificarTokenCosmos();
        }).catch((error) => {
            uiAlert("Acesso Negado 🛑", "E-mail ou senha incorretos.");
        });
}

function recuperarSenha() {
    const email = document.getElementById('emailLogin').value;
    if(email === "") return uiAlert("Esqueceu a senha?", "Digite o seu e-mail no campo acima e clique em esqueci a senha novamente.");

    firebase.auth().sendPasswordResetEmail(email)
        .then(() => uiAlert("Recuperação 📧", `E-mail enviado para: <b>${email}</b>`))
        .catch(() => uiAlert("Erro", "E-mail não encontrado."));
}

function verificarTokenCosmos() {
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

function logout() {
    firebase.auth().signOut().then(() => {
        sessionStorage.removeItem('ean_master_sessao');
        location.reload();
    }).catch(e => console.error(e));
}
// =========================================

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

function salvarSetup() {
    const token = document.getElementById('inputToken').value.trim();
    if (token.length > 10) { 
        localStorage.setItem('ean_master_token', token);
        verificarTokenCosmos(); 
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
    // 1. Carrega o que tem no PC primeiro
    const salvoLocal = localStorage.getItem('ean_master_lojas');
    if (salvoLocal) {
        bancoLojas = JSON.parse(salvoLocal);
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

    // 2. Busca da nuvem pelo UID para garantir que não perdeu a contagem
    const user = firebase.auth().currentUser;
    if (user) {
        const db = firebase.firestore();
        db.collection("usuarios").doc(user.uid).get().then((doc) => {
            if (doc.exists) {
                const dadosNuvem = doc.data();
                
                // Se a nuvem tiver dados de lojas, ele substitui
                if (dadosNuvem.bancoLojas) {
                    bancoLojas = dadosNuvem.bancoLojas;
                    lojaAtivaId = dadosNuvem.lojaAtivaId || lojaAtivaId;
                    
                    // Salva a versão da nuvem no PC atual
                    localStorage.setItem('ean_master_lojas', JSON.stringify(bancoLojas));
                    localStorage.setItem('ean_master_loja_ativa', lojaAtivaId);

                    // Atualiza a tela com os dados reais
                    atualizarSelectLojas();
                    atualizarUI_Memoria();
                    document.getElementById('codigoBase').value = obterBaseParaInput(bancoLojas[lojaAtivaId]);
                    validarPrefixoGS1();
                }
            }
        }).catch(e => console.log("Aviso: Falha ao buscar da nuvem.", e));
    }
}

function salvarCofreLojas() {
    // 1. Salva localmente (para a tela atualizar rápido)
    localStorage.setItem('ean_master_lojas', JSON.stringify(bancoLojas));
    localStorage.setItem('ean_master_loja_ativa', lojaAtivaId);

    // 2. Salva na Nuvem usando o UID seguro do Firebase Auth
    const user = firebase.auth().currentUser;
    if (user) {
        const db = firebase.firestore();
        db.collection("usuarios").doc(user.uid).set({
            bancoLojas: bancoLojas,
            lojaAtivaId: lojaAtivaId
        }, { merge: true }) // O merge evita apagar outros dados do usuário sem querer
        .catch(e => console.log("Aviso: Falha ao sincronizar na nuvem.", e));
    }
}

function atualizarSelectLojas() {
    const select = document.getElementById('selectLoja');
    if(!select) return;
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

function validarPrefixoGS1() {
    const input = document.getElementById('codigoBase');
    const aviso = document.getElementById('avisoGS1');
    const val = input.value.replace(/\D/g, '');
    
    if (val.length >= 3) {
        aviso.style.display = "block";
        const loja = bancoLojas[lojaAtivaId];
        
        if (loja.prefixoLoja && !val.startsWith(loja.prefixoLoja)) {
            // Verifica se ele fez o pulo pro 790
            let prefixo790 = '790' + loja.prefixoLoja.substring(3);
            if (val.startsWith(prefixo790)) {
                aviso.innerHTML = `✅ Prefixo 790 ativado! (A cota do 789 esgotou e o sistema pulou automaticamente).`;
                aviso.style.color = "#059669"; 
            } else {
                aviso.innerHTML = `🚨 LIMITE ULTRAPASSADO: O contador estourou o prefixo.`;
                aviso.style.color = "#dc2626"; 
            }
        } 
        else if (val.length === 12 && loja.prefixoLoja && val.startsWith(loja.prefixoLoja)) {
            const prefixoLength = loja.prefixoLoja.length;
            if (prefixoLength < 12) {
                const sequenciaAtual = parseInt(val.substring(prefixoLength));
                const limiteLote = Math.pow(10, 12 - prefixoLength);
                const faltam = limiteLote - sequenciaAtual;

                if (faltam <= 300) { 
                    aviso.innerHTML = `⚠️ ALERTA: Restam apenas <b>${faltam}</b> códigos! (Após isso, pularemos para 790).`;
                    aviso.style.color = "#ea580c"; 
                } else {
                    aviso.innerHTML = `✅ Prefixo da loja reconhecido. (Livre: <b>${faltam}</b> códigos)`;
                    aviso.style.color = "#059669"; 
                }
            } else {
                aviso.innerHTML = `✅ Base de 12 dígitos reconhecida.`;
                aviso.style.color = "#059669";
            }
        } 
        else if (!val.startsWith('789') && !val.startsWith('790')) {
            aviso.innerHTML = "⚠️ Atenção: Recomendado iniciar com 789 ou 790.";
            aviso.style.color = "#d97706"; 
        } else {
            aviso.innerHTML = "✅ Prefixo padrão detectado.";
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

// ================= INTELIGÊNCIA DE PLANILHAS (SHOPEE, TIKTOK, ML) =================

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
    if(document.getElementById('rxUnicos')) document.getElementById('rxUnicos').innerText = "0";
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
            instrucaoUnica.innerHTML = "⚫ <b>TikTok Shop:</b> Produtos > Gerenciar produtos > Ações em massa > Editar produtos em massa > Todas as informações";
        }
    }
}

// LER PLANILHA ÚNICA (V2 COM PRODUTOS ÚNICOS)
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
            let stats = { total: 0, ok: 0, vazios: 0, duplicados: 0, unicos: new Set() };
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
                if (colId !== -1 && colEan !== -1) { rowHeader = r; break; }
            }
            
            if (colId === -1 || colEan === -1) return uiAlert("Erro de Leitura", "Colunas de ID ou EAN não encontradas.");
            
           const ignorarTextos = ['obrigatório', 'não editável', 'mandatory', 'v3', 'id do produto', 'product_id', 'product id', 'sku', 'product_sku', 'sales_info'];

            originalWorksheet.eachRow((row, rowNumber) => {
                if (rowNumber > rowHeader) {
                    let idVal = row.getCell(colId).value;
                    let varVal = colVarId !== -1 ? row.getCell(colVarId).value : '';
                    let idTexto = idVal ? String(idVal).trim().toLowerCase() : '';
                    
                    if (idTexto !== '' && !ignorarTextos.includes(idTexto)) {
                        stats.total++;
                        stats.unicos.add(idTexto); // Contador de Produto Pai Único

                        let eanVal = row.getCell(colEan).value;
                        let eanAtual = eanVal ? String(eanVal).replace(/\D/g, '') : '';
                        let isVazio = (!eanAtual || eanAtual.length < 8);
                        let isDuplicado = false;
                        
                        if (isVazio) { stats.vazios++; } 
                        else {
                            if (setEansExistentesGlobal.has(eanAtual)) { stats.duplicados++; isDuplicado = true; } 
                            else { setEansExistentesGlobal.add(eanAtual); stats.ok++; }
                            if (eanAtual.length === 13 && !isNaN(eanAtual)) {
                                let base12 = BigInt(eanAtual.substring(0, 12));
                                if (base12 > maxBaseDetectada) maxBaseDetectada = base12;
                            }
                        }
                        
                        todosProdutos.push({ plataforma: plataformaAtual, idProd: String(idVal), idVar: varVal ? String(varVal) : String(idVal), isVazio, isDuplicado, rowNum: rowNumber, colEan, colGtinType });
                    }
                }
            });
            atualizarDashboardDashboard(stats, maxBaseDetectada);
        } catch (error) { uiAlert("Erro", "Falha ao ler o arquivo Excel."); }
    };
    reader.readAsArrayBuffer(file);
}

// LER PLANILHAS DUPLAS (ML)
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
    } catch (error) { uiAlert("Erro", "Falha ao ler o arquivo Excel do Mercado Livre."); }
}

function processarPlanilhasML() {
    if (!mlWorkbookFicha || !mlWorkbookFiscais) return uiAlert("Atenção", "Por favor, carregue as duas planilhas primeiro.");

    function lerTextoCelula(cell) {
        if (!cell || cell.value === null || cell.value === undefined) return '';
        let texto = cell.value.richText ? cell.value.richText.map(rt => rt.text).join('') : String(cell.value);
        return texto.toLowerCase().trim();
    }

    todosProdutos = [];
    setEansExistentesGlobal = new Set();
    let stats = { total: 0, ok: 0, vazios: 0, duplicados: 0, unicos: new Set() };
    let maxBaseDetectada = 0n;
    let mapaFiscais = {};
    let encontrouColunaFiscal = false;
    let encontrouColunaFicha = false;

    mlWorkbookFiscais.eachSheet((sheet) => {
        let colId = -1, colVar = -1, colEan = -1;
        for (let r = 1; r <= 8; r++) {
            const row = sheet.getRow(r);
            row.eachCell((cell, colNumber) => {
                const val = lerTextoCelula(cell);
                if (val === 'código do anúncio' || val === 'id') colId = colNumber;
                if (val === 'variation_id' || val === 'variação id') colVar = colNumber;
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
                        mapaFiscais[chave] = { sheetId: sheet.id, rowNum: rowNumber, colEan: colEan, ean: lerTextoCelula(row.getCell(colEan)) };
                    }
                }
            });
        }
    });

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
                        stats.total++;
                        stats.unicos.add(id);
                        let chave = id + "_" + varId;
                        let infoFiscais = mapaFiscais[chave];

                        if (infoFiscais) { 
                            let eanFicha = lerTextoCelula(row.getCell(colEan));
                            let eanAtual = (eanFicha || infoFiscais.ean).replace(/\D/g, ''); 
                            let isVazio = (!eanAtual || eanAtual.length < 8);
                            let isDuplicado = false;
                            if (isVazio) { stats.vazios++; } 
                            else {
                                if (setEansExistentesGlobal.has(eanAtual)) { stats.duplicados++; isDuplicado = true; } 
                                else { setEansExistentesGlobal.add(eanAtual); stats.ok++; }
                                if (eanAtual.length === 13 && !isNaN(eanAtual)) {
                                    let base12 = BigInt(eanAtual.substring(0, 12));
                                    if (base12 > maxBaseDetectada) maxBaseDetectada = base12;
                                }
                            }
                            todosProdutos.push({ plataforma: 'mercadolivre', idProd: id, idVar: varId || sku, isVazio, isDuplicado, sheetIdFicha: sheet.id, rowNumFicha: rowNumber, colEanFicha: colEan, sheetIdFiscais: infoFiscais.sheetId, rowNumFiscais: infoFiscais.rowNum, colEanFiscais: infoFiscais.colEan });
                        }
                    }
                }
            });
        }
    });

    if (!encontrouColunaFicha || !encontrouColunaFiscal) return uiAlert("Erro", "Colunas de EAN não encontradas no ML.");
    atualizarDashboardDashboard(stats, maxBaseDetectada);
}

function atualizarDashboardDashboard(stats, maxBaseDetectada) {
    if(document.getElementById('rxUnicos')) document.getElementById('rxUnicos').innerText = stats.unicos.size;
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
        } else { baseAutoDetectada = obterBaseParaInput(loja); }
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
    uiAlert("Raio-X Concluído! 🩻", `Planilha processada.\n\nProdutos Únicos: ${stats.unicos.size}\nTotal Variações: ${stats.total}\nEANs a gerar: ${stats.vazios}`);
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

// ================= VALIDAÇÃO E GERAÇÃO =================
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
    let loja = bancoLojas[lojaAtivaId]; // Pega os dados da loja

    while (!eanValido) {
        let b12 = sequenciaGlobalAtual.toString().padStart(12, '0');

        // SISTEMA INTELIGENTE DE PULO (789 -> 790)
        if (loja && loja.prefixoLoja && loja.prefixoLoja.startsWith('789')) {
            // Se o contador estourou e o número atual não começa mais com o prefixo original
            if (!b12.startsWith(loja.prefixoLoja)) {
                
                // Troca o 789 inicial por 790
                let novoPrefixo = '790' + loja.prefixoLoja.substring(3);
                
                // Preenche o resto com zeros até dar 12 dígitos
                let novaBase = novoPrefixo.padEnd(12, '0');
                
                // Atualiza o contador global
                sequenciaGlobalAtual = BigInt(novaBase);
                b12 = sequenciaGlobalAtual.toString();
                
                // Atualiza a loja silenciosamente para não dar erro na tela
                loja.prefixoLoja = novoPrefixo;
                salvarCofreLojas(); 
            }
        }

        // Calcula o EAN final com o dígito verificador
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
    if (filaDeInjecao.length === 0) return uiAlert("Atenção", "Fila vazia.");
    let base = document.getElementById('codigoBase').value.replace(/\D/g, '');
    if (base.length !== 12) return uiAlert("Erro", "Base precisa de 12 números.");
    document.getElementById('statusContainer').style.display = 'none';
    tbody.innerHTML = ""; 
    sequenciaGlobalAtual = BigInt(base);
    let fragment = document.createDocumentFragment();
    filaDeInjecao.forEach((item, i) => {
        let ean = obterProximoEanLivre(); 
        item.eanGerado = ean;
        item.statusValidacao = 'pendente';
        let tr = document.createElement('tr');
        tr.innerHTML = `<td>${i+1}</td><td class="codigo-ean" id="ean-visual-${i}">${ean}</td><td><span class="badge badge-pendente" id="status-badge-${i}">⏳ Aguardando</span></td><td class="produto-nome"><span class="id-label">Prod:</span> ${item.idProd}<br><span class="id-label">Var:</span> ${item.idVar}</td>`;
        fragment.appendChild(tr);
    });
    tbody.appendChild(fragment);
}

// PROTEÇÃO 2: Congela a interface para evitar erros mid-process
function travarInterface(travado) {
    // Desabilita todos os botões e inputs de configuração
    const seletores = [
        '.painel-controles input', 
        '.painel-controles button', 
        '#selectLoja', 
        '.seletor-loja button',
        '#fileUpload',
        'input[name="plataforma"]'
    ];
    
    seletores.forEach(seletor => {
        document.querySelectorAll(seletor).forEach(el => el.disabled = travado);
    });

    // Estilo visual para o usuário entender que o sistema está ocupado
    const container = document.getElementById('hl-acoes');
    if (container) {
        container.style.opacity = travado ? "0.6" : "1";
        container.style.pointerEvents = travado ? "none" : "auto";
    }
}

function alternarPausa() {
    isPausadoManual = !isPausadoManual;
    const btn = document.getElementById('btnPausar');
    if (isPausadoManual) {
        btn.innerHTML = "▶️ Retomar Validação"; btn.classList.add('modo-retomar');
    } else {
        btn.innerHTML = "⏸️ Pausar Validação"; btn.classList.remove('modo-retomar');
    }
}

async function verificarNoBanco() {
    const linhas = document.querySelectorAll('#corpoTabela tr');
    if (linhas.length === 0) return uiAlert("Erro", "Gere a lista primeiro.");
    validacaoEmAndamento = true; isPausadoManual = false; travarInterface(true);
    document.getElementById('statusContainer').style.display = 'block';
    document.getElementById('btnPausar').style.display = 'inline-flex';
    const progresso = document.getElementById('progresso');
    const timer = document.getElementById('timer');
    const conclusao = document.getElementById('horaConclusao');
    const isOffline = document.getElementById('checkOffline').checked;
    const total = linhas.length;
    let tempoInicio = Date.now(), validadosConcluidos = 0;
    const TAMANHO_LOTE = 3;

    async function processarItem(i) {
        let ean = filaDeInjecao[i].eanGerado, celulaStatus = linhas[i].querySelector('td:nth-child(3)');
        if (isOffline) {
            filaDeInjecao[i].statusValidacao = 'offline';
            celulaStatus.innerHTML = `<span class="badge badge-offline">✅ Aprovado</span>`;
            validadosConcluidos++; return;
        }
        if (i % TAMANHO_LOTE === 0) linhas[i].scrollIntoView({ behavior: "smooth", block: "center" });
        celulaStatus.innerHTML = `<span class="badge" style="background:#e0f2fe; color:#0284c7;">Buscando...</span>`;
        let processado = false;
        while (!processado) {
            while (isPausadoManual) await new Promise(r => setTimeout(r, 500));
            try {
                let res = await fetch(`${URL_DO_PROXY}/${ean}`, { 
    headers: { 
        'X-Cosmos-Token': API_TOKEN,
        'X-App-Secret': 'EanMasterPro_Segredo_2024!@#' 
    } 
});
                if (res.status === 200) { 
                    ean = obterProximoEanLivre(); filaDeInjecao[i].eanGerado = ean; 
                    linhas[i].querySelector('.codigo-ean').innerText = ean;
                    celulaStatus.innerHTML = `<span class="badge badge-buscando">🔄 Recalculando...</span>`;
                    await new Promise(r => setTimeout(r, 600));
                } else {
                    filaDeInjecao[i].statusValidacao = 'aprovado';
                    celulaStatus.innerHTML = `<span class="badge badge-livre">Livre</span>`;
                    processado = true;
                }
            } catch (e) { await new Promise(r => setTimeout(r, 2000)); }
        }
        validadosConcluidos++;
    }

    for (let i = 0; i < total; i += TAMANHO_LOTE) {
        let lote = [];
        for (let j = i; j < i + TAMANHO_LOTE && j < total; j++) lote.push(processarItem(j));
        await Promise.all(lote);
        let segsRestantes = (total - validadosConcluidos) * 1.5;
        timer.innerText = `⏱️ Restante: ${formatarTempo(segsRestantes)}`;
        conclusao.innerText = formatarHoraConclusao(segsRestantes);
        progresso.innerText = `Validando: ${Math.min(i + TAMANHO_LOTE, total)} de ${total}`;
        await new Promise(r => setTimeout(r, isOffline ? 10 : 800));
    }
    validacaoEmAndamento = false; travarInterface(false);
    document.getElementById('btnPausar').style.display = 'none';
}

async function exportarPlanilha() {
    if(filaDeInjecao.length === 0) {
        return uiAlert("Ação Negada", "Não há EANs processados para exportar. Por favor, importe a planilha e clique em 'Gerar Lista' primeiro.");
    }
    
    let logPorProduto = {}; 
    const dataAtual = new Date();
    const carimbo = `${String(dataAtual.getDate()).padStart(2, '0')}-${String(dataAtual.getMonth() + 1).padStart(2, '0')}_${String(dataAtual.getHours()).padStart(2, '0')}h${String(dataAtual.getMinutes()).padStart(2, '0')}`;

    filaDeInjecao.forEach(item => {
        if (item.statusValidacao === 'aprovado' || item.statusValidacao === 'offline') {
            if (item.plataforma !== 'mercadolivre') {
                originalWorksheet.getCell(item.rowNum, item.colEan).value = String(item.eanGerado);
                if (item.plataforma === 'tiktok' && item.colGtinType && item.colGtinType !== -1) {
                    originalWorksheet.getCell(item.rowNum, item.colGtinType).value = "EAN";
                }
            } else {
                mlWorkbookFicha.getWorksheet(item.sheetIdFicha).getCell(item.rowNumFicha, item.colEanFicha).value = String(item.eanGerado);
                mlWorkbookFiscais.getWorksheet(item.sheetIdFiscais).getCell(item.rowNumFiscais, item.colEanFiscais).value = String(item.eanGerado);
            }
            if (!logPorProduto[item.idProd]) logPorProduto[item.idProd] = [];
            logPorProduto[item.idProd].push({ var: item.idVar, ean: item.eanGerado });
        }
    });

    const ultimoEan = filaDeInjecao[filaDeInjecao.length - 1].eanGerado;
    bancoLojas[lojaAtivaId].ultimoEan = ultimoEan;
    bancoLojas[lojaAtivaId].base12 = ultimoEan.substring(0, 12);
    salvarCofreLojas(); 
    atualizarUI_Memoria();

    let prefixoModo = document.querySelector('input[name="modo_acao"]:checked').value.toUpperCase() + "_";
    
    uiAlert("📄 Preparando Arquivo ZIP", 
        "Suas planilhas e o relatório estão sendo compactados. O download começará em instantes de forma 100% segura.", 
        false, 
        async () => {
            const zip = new JSZip();

            // 1. Cria o arquivo de texto (LOG) dentro do ZIP
            let txt = `=========================================\nRELATÓRIO EAN MASTER PRO: ${plataformaAtual.toUpperCase()}\nLoja: ${bancoLojas[lojaAtivaId].nome}\nData: ${dataAtual.toLocaleString()}\n=========================================\n\n`;
            for (let id in logPorProduto) {
                txt += `Produto Pai ID: ${id}\n`;
                logPorProduto[id].forEach(v => txt += `  - Var ID: ${v.var}  ->  EAN: ${v.ean}\n`);
                txt += `\n`;
            }
            zip.file(`LOG_${plataformaAtual.toUpperCase()}_${carimbo}.txt`, txt);

            // 2. Adiciona a(s) planilha(s) preenchida(s) dentro do ZIP
            if (plataformaAtual !== 'mercadolivre') {
                let nomeBase = originalFileName.substring(0, originalFileName.lastIndexOf('.'));
                let extensao = originalFileName.substring(originalFileName.lastIndexOf('.'));
                const buffer = await originalWorkbook.xlsx.writeBuffer();
                zip.file(`${prefixoModo}${nomeBase}_${carimbo}${extensao}`, buffer);
            } else {
                const bufferFicha = await mlWorkbookFicha.xlsx.writeBuffer();
                zip.file(`${prefixoModo}ML_FICHA_${carimbo}.xlsx`, bufferFicha);
                
                const bufferFiscais = await mlWorkbookFiscais.xlsx.writeBuffer();
                zip.file(`${prefixoModo}ML_FISCAIS_${carimbo}.xlsx`, bufferFiscais);
            }

            // 3. Gera o arquivo final e força apenas UM download (Agora com Nome da Loja e Plataforma)
            zip.generateAsync({type:"blob"}).then(function(content) {
                const a = document.createElement("a");
                a.href = URL.createObjectURL(content);
                
                // Formata o nome da loja removendo espaços e adicionando a plataforma
                const nomeDaLojaLimpo = bancoLojas[lojaAtivaId].nome.replace(/\s+/g, '_');
                const nomeDaPlataforma = plataformaAtual.toUpperCase();
                
                a.download = `EAN_MASTER_${nomeDaLojaLimpo}_${nomeDaPlataforma}_${carimbo}.zip`;
                a.click();
            });
        }
    );
}

function baixarArquivoLocal(buffer, nome) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([buffer])); a.download = nome; a.click();
}