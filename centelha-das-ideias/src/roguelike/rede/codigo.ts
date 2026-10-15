/**
 * Códigos de conexão: a descrição WebRTC (SDP) comprimida em texto curto para
 * copiar, colar ou ler por QR. Prefixo "C1" = comprimido, "C0" = texto puro.
 */

function paraBase64Url(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function deBase64Url(texto: string): Uint8Array {
  const b = texto.replace(/-/g, '+').replace(/_/g, '/');
  const s = atob(b + '='.repeat((4 - (b.length % 4)) % 4));
  const r = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) r[i] = s.charCodeAt(i);
  return r;
}

async function transformar(dados: Uint8Array, fluxo: GenericTransformStream): Promise<Uint8Array> {
  const resposta = new Response(new Blob([dados as BlobPart]).stream().pipeThrough(fluxo));
  return new Uint8Array(await resposta.arrayBuffer());
}

const temCompressao =
  typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';

export async function codificar(texto: string): Promise<string> {
  const bytes = new TextEncoder().encode(texto);
  if (temCompressao) {
    try {
      return 'C1' + paraBase64Url(await transformar(bytes, new CompressionStream('deflate-raw')));
    } catch {
      /* cai para o texto puro */
    }
  }
  return 'C0' + paraBase64Url(bytes);
}

export async function decodificar(codigo: string): Promise<string> {
  const limpo = codigo.replace(/\s+/g, '');
  const tipo = limpo.slice(0, 2);
  const corpo = deBase64Url(limpo.slice(2));
  if (tipo === 'C1') {
    if (!temCompressao) throw new Error('Este navegador não abre códigos comprimidos.');
    return new TextDecoder().decode(
      await transformar(corpo, new DecompressionStream('deflate-raw'))
    );
  }
  if (tipo === 'C0') return new TextDecoder().decode(corpo);
  throw new Error('Código inválido.');
}
