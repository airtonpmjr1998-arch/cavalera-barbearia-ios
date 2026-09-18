/**
 * CAVALERA BARBEARIA - WEB APP / ADMIN
 * Google Apps Script sem Google Sheets.
 *
 * Persistência:
 * - PropertiesService: agenda, serviços e configuração.
 * - CacheService: leitura pública e sessão administrativa.
 * - LockService: proteção contra gravações simultâneas.
 *
 * IMPORTANTE:
 * 1) Publique como "Aplicativo da Web".
 * 2) Execute como: você.
 * 3) Acesso: qualquer pessoa.
 * 4) Senha inicial do painel: Cavalera@2026
 *    Troque pelo próprio painel administrativo após o primeiro acesso.
 */

const CAVALERA = Object.freeze({
  TIMEZONE: 'America/Cuiaba',

  EMPRESA: Object.freeze({
    nome: 'Cavalera Barbearia',
    avaliacao: '5,0',
    totalAvaliacoes: 74,
    endereco: 'R. Ver. Abelardo de Azevedo, 673-771 - Construmat, Várzea Grande - MT, 78115-250',
    whatsappExibicao: '(65) 99327-2829',
    whatsappNumero: '5565993272829',
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=Cavalera%20Barbearia%2C%20R.%20Ver.%20Abelardo%20de%20Azevedo%2C%20V%C3%A1rzea%20Grande%20MT'
  }),

  KEYS: Object.freeze({
    ADMIN_HASH: 'CAVALERA_ADMIN_HASH_V2',
    SERVICES: 'CAVALERA_SERVICES_V2',
    DAY_PREFIX: 'CAVALERA_DAY_V2_'
  }),

  CACHE: Object.freeze({
    PUBLIC_DATA: 'CAVALERA_PUBLIC_DATA_V2',
    ADMIN_TOKEN_PREFIX: 'CAVALERA_ADMIN_TOKEN_V2_',
    PUBLIC_SECONDS: 20,
    ADMIN_SESSION_SECONDS: 21600 // 6 horas (máximo do CacheService).
  }),

  DEFAULT_ADMIN_PASSWORD: 'Cavalera@2026'
});

function doGet(e) {
  ensureInitialized_();

  const template = HtmlService.createTemplateFromFile('Index');
  const adminRequested = Boolean(e && e.parameter && String(e.parameter.admin || '') === '1');
  template.initialView = JSON.stringify(adminRequested ? 'admin' : 'client');

  return template
    .evaluate()
    .setTitle('Cavalera Barbearia | Agendamento')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover');
}

/**
 * Rode manualmente se quiser inicializar/validar o armazenamento antes da publicação.
 * A aplicação também se auto-inicializa na primeira abertura.
 */
function setupInicial() {
  ensureInitialized_();
  return {
    ok: true,
    mensagem: 'Cavalera inicializada com sucesso.',
    senhaInicial: CAVALERA.DEFAULT_ADMIN_PASSWORD
  };
}

/**
 * Use manualmente pelo editor caso perca a senha do painel.
 * Troque o valor abaixo, execute uma vez e depois não precisa mais mexer.
 */
function resetarSenhaAdmin() {
  const NOVA_SENHA = 'Cavalera@2026';

  if (String(NOVA_SENHA).length < 6) {
    throw new Error('A nova senha precisa ter pelo menos 6 caracteres.');
  }

  PropertiesService
    .getScriptProperties()
    .setProperty(CAVALERA.KEYS.ADMIN_HASH, hash_(NOVA_SENHA));

  invalidarSessoesAdmin_();

  return 'Senha administrativa redefinida.';
}

/* ==========================================================================
 * API PÚBLICA
 * ========================================================================== */

function getPublicData() {
  ensureInitialized_();

  const cache = CacheService.getScriptCache();
  const cached = cache.get(CAVALERA.CACHE.PUBLIC_DATA);

  if (cached) {
    return JSON.parse(cached);
  }

  const payload = {
    empresa: CAVALERA.EMPRESA,
    servicos: getServicos_(true),
    disponibilidade: getDisponibilidadePublica_(),
    atualizadoEm: Utilities.formatDate(
      new Date(),
      CAVALERA.TIMEZONE,
      "dd/MM/yyyy 'às' HH:mm"
    )
  };

  cache.put(
    CAVALERA.CACHE.PUBLIC_DATA,
    JSON.stringify(payload),
    CAVALERA.CACHE.PUBLIC_SECONDS
  );

  return payload;
}

/* ==========================================================================
 * AUTENTICAÇÃO ADMIN
 * ========================================================================== */

function adminLogin(password) {
  ensureInitialized_();

  const informado = hash_(String(password || ''));
  const salvo = PropertiesService
    .getScriptProperties()
    .getProperty(CAVALERA.KEYS.ADMIN_HASH);

  if (!salvo || informado !== salvo) {
    throw new Error('Senha administrativa inválida.');
  }

  const token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');

  CacheService
    .getScriptCache()
    .put(
      CAVALERA.CACHE.ADMIN_TOKEN_PREFIX + token,
      '1',
      CAVALERA.CACHE.ADMIN_SESSION_SECONDS
    );

  return {
    token: token,
    expiresInSeconds: CAVALERA.CACHE.ADMIN_SESSION_SECONDS
  };
}

function adminLogout(token) {
  if (token) {
    CacheService
      .getScriptCache()
      .remove(CAVALERA.CACHE.ADMIN_TOKEN_PREFIX + String(token));
  }

  return true;
}

function alterarSenhaAdmin(token, novaSenha) {
  validarAdmin_(token);

  const senha = String(novaSenha || '');

  if (senha.length < 6) {
    throw new Error('A senha precisa ter pelo menos 6 caracteres.');
  }

  PropertiesService
    .getScriptProperties()
    .setProperty(CAVALERA.KEYS.ADMIN_HASH, hash_(senha));

  // Mantém a sessão atual válida até o logout/expiração.
  return { ok: true };
}

/* ==========================================================================
 * ADMIN - LEITURA
 * ========================================================================== */

function getAdminData(token) {
  validarAdmin_(token);

  return {
    empresa: CAVALERA.EMPRESA,
    servicos: getServicos_(false),
    dias: getDiasAdmin_(),
    atualizadoEm: Utilities.formatDate(
      new Date(),
      CAVALERA.TIMEZONE,
      "dd/MM/yyyy 'às' HH:mm:ss"
    )
  };
}

/* ==========================================================================
 * ADMIN - HORÁRIOS
 * ========================================================================== */

/**
 * payload:
 * {
 *   dataIso: "2026-09-20",
 *   horarios: ["09:00","09:30","10:00"],
 *   observacao: "opcional"
 * }
 */
function adminAdicionarHorarios(token, payload) {
  validarAdmin_(token);

  const dataIso = validarDataIso_(payload && payload.dataIso);
  const horarios = Array.isArray(payload && payload.horarios)
    ? payload.horarios.map(validarHorario_).filter(Boolean)
    : [];

  if (!horarios.length) {
    throw new Error('Informe pelo menos um horário válido.');
  }

  const hoje = hojeIso_();

  if (dataIso < hoje) {
    throw new Error('Não é possível adicionar horários em uma data passada.');
  }

  const agora = Utilities.formatDate(new Date(), CAVALERA.TIMEZONE, 'HH:mm');

  const validos = Array.from(new Set(horarios))
    .filter((horario) => !(dataIso === hoje && horario <= agora))
    .sort();

  if (!validos.length) {
    throw new Error('Todos os horários informados já passaram.');
  }

  const observacao = limitarTexto_(payload && payload.observacao, 80);
  const lock = LockService.getScriptLock();

  lock.waitLock(5000);

  try {
    const slots = getSlotsDoDia_(dataIso);
    const map = new Map(slots.map((slot) => [slot.horario, slot]));

    validos.forEach((horario) => {
      const existente = map.get(horario);

      if (existente) {
        existente.ativo = true;
        if (observacao) {
          existente.observacao = observacao;
        }
      } else {
        map.set(horario, {
          id: Utilities.getUuid(),
          horario: horario,
          ativo: true,
          observacao: observacao
        });
      }
    });

    salvarSlotsDoDia_(
      dataIso,
      Array.from(map.values()).sort((a, b) => a.horario.localeCompare(b.horario))
    );
  } finally {
    lock.releaseLock();
  }

  limparCachePublico_();

  return {
    ok: true,
    dia: getDiaAdmin_(dataIso)
  };
}

function adminAlternarHorario(token, dataIso, slotId, ativo) {
  validarAdmin_(token);

  const data = validarDataIso_(dataIso);
  const id = String(slotId || '');

  if (!id) {
    throw new Error('Horário inválido.');
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(5000);

  try {
    const slots = getSlotsDoDia_(data);
    const slot = slots.find((item) => item.id === id);

    if (!slot) {
      throw new Error('Horário não encontrado.');
    }

    slot.ativo = Boolean(ativo);
    salvarSlotsDoDia_(data, slots);
  } finally {
    lock.releaseLock();
  }

  limparCachePublico_();

  return {
    ok: true,
    dia: getDiaAdmin_(data)
  };
}

function adminExcluirHorario(token, dataIso, slotId) {
  validarAdmin_(token);

  const data = validarDataIso_(dataIso);
  const id = String(slotId || '');

  const lock = LockService.getScriptLock();
  lock.waitLock(5000);

  try {
    const slots = getSlotsDoDia_(data);
    const restantes = slots.filter((item) => item.id !== id);

    if (restantes.length === slots.length) {
      throw new Error('Horário não encontrado.');
    }

    salvarSlotsDoDia_(data, restantes);
  } finally {
    lock.releaseLock();
  }

  limparCachePublico_();

  return {
    ok: true,
    dia: getDiaAdmin_(data)
  };
}

function adminExcluirDia(token, dataIso) {
  validarAdmin_(token);

  const data = validarDataIso_(dataIso);

  PropertiesService
    .getScriptProperties()
    .deleteProperty(chaveDia_(data));

  limparCachePublico_();

  return { ok: true };
}

/* ==========================================================================
 * ADMIN - SERVIÇOS
 * ========================================================================== */

/**
 * payload:
 * {
 *   id: "opcional para edição",
 *   nome: "Corte Masculino",
 *   duracaoMin: 45,
 *   ativo: true
 * }
 */
function adminSalvarServico(token, payload) {
  validarAdmin_(token);

  const nome = limitarTexto_(payload && payload.nome, 60);
  const duracaoMin = Math.round(Number(payload && payload.duracaoMin));
  const ativo = payload && typeof payload.ativo !== 'undefined'
    ? Boolean(payload.ativo)
    : true;

  if (!nome) {
    throw new Error('Informe o nome do serviço.');
  }

  if (!Number.isFinite(duracaoMin) || duracaoMin < 5 || duracaoMin > 480) {
    throw new Error('A duração deve estar entre 5 e 480 minutos.');
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(5000);

  try {
    const servicos = getServicos_(false);
    const id = String(payload && payload.id || '');

    if (id) {
      const servico = servicos.find((item) => item.id === id);

      if (!servico) {
        throw new Error('Serviço não encontrado.');
      }

      servico.nome = nome;
      servico.duracaoMin = duracaoMin;
      servico.ativo = ativo;
    } else {
      servicos.push({
        id: Utilities.getUuid(),
        nome: nome,
        duracaoMin: duracaoMin,
        ativo: ativo
      });
    }

    salvarServicos_(servicos);
  } finally {
    lock.releaseLock();
  }

  limparCachePublico_();

  return {
    ok: true,
    servicos: getServicos_(false)
  };
}

function adminAlternarServico(token, servicoId, ativo) {
  validarAdmin_(token);

  const id = String(servicoId || '');
  const servicos = getServicos_(false);
  const servico = servicos.find((item) => item.id === id);

  if (!servico) {
    throw new Error('Serviço não encontrado.');
  }

  servico.ativo = Boolean(ativo);
  salvarServicos_(servicos);
  limparCachePublico_();

  return {
    ok: true,
    servicos: getServicos_(false)
  };
}

function adminExcluirServico(token, servicoId) {
  validarAdmin_(token);

  const id = String(servicoId || '');
  const servicos = getServicos_(false);
  const restantes = servicos.filter((item) => item.id !== id);

  if (restantes.length === servicos.length) {
    throw new Error('Serviço não encontrado.');
  }

  salvarServicos_(restantes);
  limparCachePublico_();

  return {
    ok: true,
    servicos: getServicos_(false)
  };
}

/* ==========================================================================
 * STORAGE / REGRAS INTERNAS
 * ========================================================================== */

function ensureInitialized_() {
  const props = PropertiesService.getScriptProperties();

  if (!props.getProperty(CAVALERA.KEYS.ADMIN_HASH)) {
    props.setProperty(
      CAVALERA.KEYS.ADMIN_HASH,
      hash_(CAVALERA.DEFAULT_ADMIN_PASSWORD)
    );
  }

  if (!props.getProperty(CAVALERA.KEYS.SERVICES)) {
    salvarServicos_([
      {
        id: Utilities.getUuid(),
        nome: 'Corte Masculino',
        duracaoMin: 45,
        ativo: true
      },
      {
        id: Utilities.getUuid(),
        nome: 'Barba',
        duracaoMin: 30,
        ativo: true
      },
      {
        id: Utilities.getUuid(),
        nome: 'Corte + Barba',
        duracaoMin: 60,
        ativo: true
      },
      {
        id: Utilities.getUuid(),
        nome: 'Acabamento / Pezinho',
        duracaoMin: 20,
        ativo: true
      }
    ]);
  }
}

function getServicos_(somenteAtivos) {
  const raw = PropertiesService
    .getScriptProperties()
    .getProperty(CAVALERA.KEYS.SERVICES);

  let servicos = [];

  try {
    servicos = raw ? JSON.parse(raw) : [];
  } catch (error) {
    servicos = [];
  }

  if (somenteAtivos) {
    servicos = servicos.filter((item) => item.ativo !== false);
  }

  return servicos
    .map((item) => ({
      id: String(item.id || Utilities.getUuid()),
      nome: String(item.nome || '').trim(),
      duracaoMin: Number(item.duracaoMin) || 0,
      ativo: item.ativo !== false
    }))
    .filter((item) => item.nome)
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

function salvarServicos_(servicos) {
  PropertiesService
    .getScriptProperties()
    .setProperty(
      CAVALERA.KEYS.SERVICES,
      JSON.stringify(servicos)
    );
}

function getDisponibilidadePublica_() {
  const hoje = hojeIso_();
  const agora = Utilities.formatDate(new Date(), CAVALERA.TIMEZONE, 'HH:mm');

  return getTodasDatas_()
    .filter((dataIso) => dataIso >= hoje)
    .sort()
    .map((dataIso) => {
      const slots = getSlotsDoDia_(dataIso)
        .filter((slot) => slot.ativo !== false)
        .filter((slot) => !(dataIso === hoje && slot.horario <= agora))
        .sort((a, b) => a.horario.localeCompare(b.horario));

      return montarDia_(dataIso, slots);
    })
    .filter((dia) => dia.horarios.length > 0);
}

function getDiasAdmin_() {
  const hoje = hojeIso_();

  return getTodasDatas_()
    .filter((dataIso) => dataIso >= hoje)
    .sort()
    .map((dataIso) => getDiaAdmin_(dataIso))
    .filter(Boolean);
}

function getDiaAdmin_(dataIso) {
  const slots = getSlotsDoDia_(dataIso)
    .sort((a, b) => a.horario.localeCompare(b.horario));

  if (!slots.length) {
    return null;
  }

  return montarDia_(dataIso, slots);
}

function montarDia_(dataIso, slots) {
  const partes = dataIso.split('-').map(Number);
  const dataUtc = new Date(Date.UTC(partes[0], partes[1] - 1, partes[2]));
  const diasCurtos = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
  const diasLongos = [
    'Domingo',
    'Segunda-feira',
    'Terça-feira',
    'Quarta-feira',
    'Quinta-feira',
    'Sexta-feira',
    'Sábado'
  ];

  return {
    dataIso: dataIso,
    diaSemana: diasCurtos[dataUtc.getUTCDay()],
    diaSemanaCompleto: diasLongos[dataUtc.getUTCDay()],
    dataCurta: `${String(partes[2]).padStart(2, '0')}/${String(partes[1]).padStart(2, '0')}`,
    dataCompleta: `${String(partes[2]).padStart(2, '0')}/${String(partes[1]).padStart(2, '0')}/${partes[0]}`,
    horarios: slots.map((slot) => ({
      id: String(slot.id || ''),
      horario: String(slot.horario || ''),
      ativo: slot.ativo !== false,
      observacao: String(slot.observacao || '')
    }))
  };
}

function getSlotsDoDia_(dataIso) {
  const raw = PropertiesService
    .getScriptProperties()
    .getProperty(chaveDia_(dataIso));

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((slot) => ({
        id: String(slot.id || Utilities.getUuid()),
        horario: validarHorario_(slot.horario),
        ativo: slot.ativo !== false,
        observacao: limitarTexto_(slot.observacao, 80)
      }))
      .filter((slot) => slot.horario);
  } catch (error) {
    return [];
  }
}

function salvarSlotsDoDia_(dataIso, slots) {
  const props = PropertiesService.getScriptProperties();
  const key = chaveDia_(dataIso);

  if (!slots || !slots.length) {
    props.deleteProperty(key);
    return;
  }

  props.setProperty(key, JSON.stringify(slots));
}

function getTodasDatas_() {
  const props = PropertiesService.getScriptProperties().getProperties();

  return Object.keys(props)
    .filter((key) => key.indexOf(CAVALERA.KEYS.DAY_PREFIX) === 0)
    .map((key) => key.substring(CAVALERA.KEYS.DAY_PREFIX.length))
    .filter((dataIso) => /^\d{4}-\d{2}-\d{2}$/.test(dataIso));
}

function chaveDia_(dataIso) {
  return CAVALERA.KEYS.DAY_PREFIX + dataIso;
}

function hojeIso_() {
  return Utilities.formatDate(new Date(), CAVALERA.TIMEZONE, 'yyyy-MM-dd');
}

function validarDataIso_(valor) {
  const texto = String(valor || '').trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
    throw new Error('Data inválida.');
  }

  const partes = texto.split('-').map(Number);
  const data = new Date(Date.UTC(partes[0], partes[1] - 1, partes[2]));

  if (
    data.getUTCFullYear() !== partes[0] ||
    data.getUTCMonth() !== partes[1] - 1 ||
    data.getUTCDate() !== partes[2]
  ) {
    throw new Error('Data inválida.');
  }

  return texto;
}

function validarHorario_(valor) {
  const texto = String(valor || '').trim();
  const match = texto.match(/^(\d{1,2}):(\d{2})$/);

  if (!match) {
    return '';
  }

  const hora = Number(match[1]);
  const minuto = Number(match[2]);

  if (hora < 0 || hora > 23 || minuto < 0 || minuto > 59) {
    return '';
  }

  return `${String(hora).padStart(2, '0')}:${String(minuto).padStart(2, '0')}`;
}

function limitarTexto_(valor, limite) {
  return String(valor || '')
    .trim()
    .substring(0, limite);
}

function validarAdmin_(token) {
  const valor = String(token || '').trim();

  if (!valor) {
    throw new Error('Sessão administrativa expirada. Entre novamente.');
  }

  const ativo = CacheService
    .getScriptCache()
    .get(CAVALERA.CACHE.ADMIN_TOKEN_PREFIX + valor);

  if (ativo !== '1') {
    throw new Error('Sessão administrativa expirada. Entre novamente.');
  }

  // Renova a sessão a cada ação válida.
  CacheService
    .getScriptCache()
    .put(
      CAVALERA.CACHE.ADMIN_TOKEN_PREFIX + valor,
      '1',
      CAVALERA.CACHE.ADMIN_SESSION_SECONDS
    );
}

function limparCachePublico_() {
  CacheService
    .getScriptCache()
    .remove(CAVALERA.CACHE.PUBLIC_DATA);
}

function invalidarSessoesAdmin_() {
  // O CacheService não permite listar chaves.
  // Sessões antigas expiram automaticamente em até 6 horas.
}

function hash_(texto) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(texto || ''),
    Utilities.Charset.UTF_8
  );

  return bytes
    .map((byte) => {
      const value = byte < 0 ? byte + 256 : byte;
      return value.toString(16).padStart(2, '0');
    })
    .join('');
}
