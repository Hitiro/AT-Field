// Remove o prefixo "[dd/mm, hh:mm] Remetente:" do WhatsApp e junta as mensagens.

export type MensagemWhatsApp = {
  /** YYYY-MM-DD do prefixo (ano inferido se faltar). */
  data?: string
  /** 'HH:MM' do prefixo. */
  hora?: string
  remetente?: string
  linhas: string[]
}

// iOS/desktop: [16/10, 17:16] Fulano: texto  |  [16/10/2026, 17:16:05] Fulano: texto
const PREFIXO_IOS =
  /^\[(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?,\s*(\d{1,2}):(\d{2})(?::\d{2})?\]\s+([^:]+?):\s?(.*)$/
// Android: 16/10/2026 17:16 - Fulano: texto
const PREFIXO_ANDROID =
  /^(\d{1,2})\/(\d{1,2})\/(\d{2,4}),?\s+(\d{1,2}):(\d{2})\s+-\s+([^:]+?):\s?(.*)$/

const pad = (n: number) => String(n).padStart(2, '0')

/** Ano do prefixo; sem ano, o de `hoje`, recuando um ano se a data ficar no futuro. */
export function inferirData(
  dia: number,
  mes: number,
  ano: number | undefined,
  hoje: string,
): string {
  if (ano !== undefined) {
    const a = ano < 100 ? 2000 + ano : ano
    return `${a}-${pad(mes)}-${pad(dia)}`
  }
  const anoHoje = Number(hoje.slice(0, 4))
  const data = `${anoHoje}-${pad(mes)}-${pad(dia)}`
  return data > hoje ? `${anoHoje - 1}-${pad(mes)}-${pad(dia)}` : data
}

function lerPrefixo(linha: string, hoje: string): MensagemWhatsApp | null {
  const m = PREFIXO_IOS.exec(linha) ?? PREFIXO_ANDROID.exec(linha)
  if (!m) return null
  const dia = Number(m[1])
  const mes = Number(m[2])
  const h = Number(m[4])
  if (dia < 1 || dia > 31 || mes < 1 || mes > 12 || h > 23) return null
  return {
    data: inferirData(dia, mes, m[3] ? Number(m[3]) : undefined, hoje),
    hora: `${pad(h)}:${m[5]}`,
    remetente: m[6].trim(),
    linhas: [m[7]],
  }
}

/**
 * Divide o texto colado em mensagens. Linha sem prefixo continua a mensagem
 * anterior (ou abre uma mensagem sem prefixo, se for a primeira).
 */
export function separarMensagens(
  texto: string,
  hoje: string,
): MensagemWhatsApp[] {
  const mensagens: MensagemWhatsApp[] = []
  for (const linha of texto.replace(/\r\n?/g, '\n').split('\n')) {
    const comPrefixo = lerPrefixo(linha, hoje)
    if (comPrefixo) {
      mensagens.push(comPrefixo)
    } else if (mensagens.length) {
      mensagens[mensagens.length - 1].linhas.push(linha)
    } else {
      mensagens.push({ linhas: [linha] })
    }
  }
  return mensagens
}
