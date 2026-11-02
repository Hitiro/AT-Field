import { z } from 'zod'

// Catálogo de códigos de erro da API (passo 008). Formato PREFIXO-NNN:
// - GEN: erros genéricos do HTTP, o número é o próprio status;
// - VAL: validação de payload (Zod);
// - DB: violações do Postgres traduzidas;
// - demais: domínio, sequencial a partir de 001 pelo módulo onde está o throw.
// Previstos: AUT (Firebase Auth) e PRM (permissões).
// Regra: código publicado nunca muda de status nem é reaproveitado; ao
// remover, ele vai para RETIRED_ERROR_CODES.
export const ERROR_PREFIXES = [
  'GEN',
  'VAL',
  'DB',
  'TEN',
  'USR',
  'ROL',
  'GEO',
] as const

export type ErrorPrefix = (typeof ERROR_PREFIXES)[number]

// Status de erro que a API emite: os das HttpException embutidas do Nest,
// os do body-parser e o 429 (rate limit).
export type ErrorStatus =
  | 400
  | 401
  | 403
  | 404
  | 405
  | 406
  | 408
  | 409
  | 410
  | 412
  | 413
  | 415
  | 418
  | 421
  | 422
  | 429
  | 500
  | 501
  | 502
  | 503
  | 504
  | 505

export type ErrorDefinition = {
  status: ErrorStatus
  message: string
}

// Mensagens genéricas: nunca citam o valor enviado nem dado da linha.
export const ERROR_CODES = {
  'GEN-400': { status: 400, message: 'Requisição inválida' },
  'GEN-401': { status: 401, message: 'Não autenticado' },
  'GEN-403': { status: 403, message: 'Acesso negado' },
  'GEN-404': { status: 404, message: 'Rota não encontrada' },
  'GEN-405': { status: 405, message: 'Método não permitido' },
  'GEN-406': { status: 406, message: 'Formato de resposta não aceito' },
  'GEN-408': { status: 408, message: 'Tempo da requisição esgotado' },
  'GEN-409': { status: 409, message: 'Conflito com o estado atual' },
  'GEN-410': { status: 410, message: 'Recurso não está mais disponível' },
  'GEN-412': { status: 412, message: 'Pré-condição não atendida' },
  'GEN-413': { status: 413, message: 'Requisição grande demais' },
  'GEN-415': { status: 415, message: 'Tipo de conteúdo não suportado' },
  'GEN-418': { status: 418, message: 'Sou um bule de chá' },
  'GEN-421': {
    status: 421,
    message: 'Requisição enviada ao servidor errado',
  },
  'GEN-422': { status: 422, message: 'Dados não processáveis' },
  'GEN-429': {
    status: 429,
    message: 'Muitas requisições. Tente novamente em instantes.',
  },
  'GEN-500': {
    status: 500,
    message: 'Erro interno. Informe a referência ao suporte.',
  },
  'GEN-501': { status: 501, message: 'Funcionalidade não implementada' },
  'GEN-502': {
    status: 502,
    message: 'Resposta inválida de um serviço externo',
  },
  'GEN-503': {
    status: 503,
    message: 'Serviço indisponível. Tente novamente em instantes.',
  },
  'GEN-504': {
    status: 504,
    message: 'Tempo esgotado aguardando um serviço externo',
  },
  'GEN-505': { status: 505, message: 'Versão do HTTP não suportada' },
  'VAL-001': { status: 400, message: 'Dados inválidos' },
  'DB-001': { status: 409, message: 'Registro duplicado' },
  'DB-002': {
    status: 409,
    message: 'Registro em uso ou referência inexistente',
  },
  'DB-003': { status: 400, message: 'Valor inválido' },
  'DB-004': { status: 400, message: 'Campo obrigatório ausente' },
  'DB-005': { status: 400, message: 'Valor fora das regras permitidas' },
  'DB-006': { status: 409, message: 'Conflito com registro existente' },
  'DB-007': { status: 400, message: 'Texto maior que o permitido' },
  'DB-008': { status: 400, message: 'Número fora do intervalo permitido' },
  'DB-009': { status: 400, message: 'Data ou hora inválida' },
  'DB-010': {
    status: 409,
    message: 'Conflito de concorrência, tente novamente',
  },
  'DB-011': { status: 503, message: 'Banco ocupado, tente novamente' },
  'DB-012': { status: 503, message: 'Banco de dados indisponível' },
  'DB-013': { status: 400, message: 'Texto com caractere inválido' },
  'TEN-001': { status: 403, message: 'Header X-Tenant-Id ausente ou inválido' },
  'TEN-002': { status: 403, message: 'Conta inexistente ou inativa' },
  'TEN-003': { status: 409, message: 'Já existe uma conta com este documento' },
  'USR-001': { status: 409, message: 'Usuário desativado' },
  'USR-002': { status: 409, message: 'CPF já cadastrado com outro e-mail' },
  'USR-003': { status: 409, message: 'E-mail já cadastrado para outro CPF' },
  'USR-004': { status: 400, message: 'Cidade inexistente' },
  'USR-005': { status: 409, message: 'Usuário já vinculado a esta conta' },
  'USR-006': { status: 404, message: 'Usuário não encontrado nesta conta' },
  'USR-007': { status: 400, message: 'Papel inválido para esta conta' },
  'USR-008': {
    status: 409,
    message: 'A conta precisa de ao menos um owner ativo',
  },
  'ROL-001': { status: 404, message: 'Papel não encontrado' },
  'ROL-002': { status: 409, message: 'Papel de sistema não pode ser alterado' },
  'ROL-003': { status: 409, message: 'Papel de sistema não pode ser excluído' },
  'ROL-004': { status: 409, message: 'Papel em uso por usuários da conta' },
  'ROL-005': { status: 409, message: 'Já existe um papel com este nome' },
  'ROL-006': { status: 400, message: 'Permissões inválidas' },
  'GEO-001': { status: 404, message: 'UF inexistente' },
  'GEO-002': { status: 404, message: 'Cidade inexistente' },
} as const satisfies Record<string, ErrorDefinition>

export type ErrorCode = keyof typeof ERROR_CODES

// Códigos que já existiram e foram removidos: nunca voltam a ser usados.
export const RETIRED_ERROR_CODES: readonly string[] = []

export const ERROR_CODE_PATTERN = new RegExp(
  `^(${ERROR_PREFIXES.join('|')})-\\d{3}$`,
)

export const isErrorCode = (value: unknown): value is ErrorCode =>
  typeof value === 'string' && Object.hasOwn(ERROR_CODES, value)

// Corpo de toda resposta de erro da API.
export const errorResponseSchema = z.object({
  code: z.string(),
  message: z.string(),
  requestId: z.string(),
  details: z.record(z.string(), z.unknown()).optional(),
})

export type ErrorResponse = z.infer<typeof errorResponseSchema>

// COM-06: texto que web e app mostram junto da mensagem de erro. A referência
// são os 8 primeiros caracteres do requestId; o suporte busca por prefixo.
export const formatErrorReference = (code: string, requestId: string) =>
  `Erro ${code} (ref. ${requestId.slice(0, 8)})`
