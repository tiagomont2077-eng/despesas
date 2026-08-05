// Gera os icones PNG do app sem nenhuma dependencia externa.
// Uso:  node ferramentas/gerar-icones.mjs
//
// Escreve em icons/: icone-192.png, icone-512.png e icone-mascara-512.png.
// So precisa rodar de novo se voce quiser mudar o desenho ou as cores.

import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const SAIDA = join(AQUI, '..', 'icons');

const VERDE = [0x2f, 0x6f, 0x4e];
const BRANCO = [0xff, 0xff, 0xff];
const AMBAR = [0xd9, 0x9a, 0x00];

// --- Codificacao PNG --------------------------------------------------------

const TABELA_CRC = (() => {
  const tabela = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    tabela[n] = c >>> 0;
  }
  return tabela;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = TABELA_CRC[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pedaco(tipo, dados) {
  const tamanho = Buffer.alloc(4);
  tamanho.writeUInt32BE(dados.length);
  const corpo = Buffer.concat([Buffer.from(tipo, 'ascii'), dados]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(corpo));
  return Buffer.concat([tamanho, corpo, crc]);
}

/** pixels = Uint8Array RGBA de tamanho lado*lado*4 */
function montarPng(lado, pixels) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(lado, 0);
  ihdr.writeUInt32BE(lado, 4);
  ihdr[8] = 8; // 8 bits por canal
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0; // compressao padrao
  ihdr[11] = 0; // filtro padrao
  ihdr[12] = 0; // sem entrelacamento

  // Cada linha do PNG comeca com um byte de filtro (0 = sem filtro).
  const bruto = Buffer.alloc(lado * (lado * 4 + 1));
  for (let y = 0; y < lado; y++) {
    const destino = y * (lado * 4 + 1);
    bruto[destino] = 0;
    Buffer.from(pixels.buffer, y * lado * 4, lado * 4).copy(bruto, destino + 1);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pedaco('IHDR', ihdr),
    pedaco('IDAT', deflateSync(bruto, { level: 9 })),
    pedaco('IEND', Buffer.alloc(0)),
  ]);
}

// --- Desenho ----------------------------------------------------------------

function dentroRetanguloArredondado(px, py, x, y, largura, altura, raio) {
  if (px < x || py < y || px > x + largura || py > y + altura) return false;
  const dx = Math.max(x + raio - px, 0, px - (x + largura - raio));
  const dy = Math.max(y + raio - py, 0, py - (y + altura - raio));
  return dx * dx + dy * dy <= raio * raio;
}

function dentroCirculo(px, py, cx, cy, raio) {
  const dx = px - cx;
  const dy = py - cy;
  return dx * dx + dy * dy <= raio * raio;
}

/**
 * @param {number} lado    tamanho em pixels
 * @param {boolean} mascara  true = full bleed (purpose "maskable"),
 *                           false = cantos arredondados com fundo transparente
 */
function desenhar(lado, mascara) {
  const pixels = new Uint8Array(lado * lado * 4);
  const raioFundo = mascara ? 0 : lado * 0.22;

  // O conteudo fica menor no icone mascarado: o sistema pode cortar as bordas.
  const escala = mascara ? 0.60 : 0.74;
  const c = lado / 2;

  const carteiraL = lado * escala;
  const carteiraA = carteiraL * 0.68;
  const carteiraX = c - carteiraL / 2;
  const carteiraY = c - carteiraA / 2;
  const carteiraR = carteiraA * 0.22;

  // Faixa inferior da carteira, em verde mais claro
  const faixaA = carteiraA * 0.30;
  const faixaY = carteiraY + carteiraA - faixaA;

  // Moeda encostada na lateral direita
  const moedaR = carteiraA * 0.26;
  const moedaX = carteiraX + carteiraL - moedaR * 0.55;
  const moedaY = carteiraY + carteiraA * 0.5;

  // Amostragem 3x3 por pixel: suaviza as bordas curvas sem biblioteca grafica.
  const AMOSTRAS = 3;
  const passo = 1 / (AMOSTRAS + 1);

  for (let y = 0; y < lado; y++) {
    for (let x = 0; x < lado; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;

      for (let sy = 1; sy <= AMOSTRAS; sy++) {
        for (let sx = 1; sx <= AMOSTRAS; sx++) {
          const px = x + sx * passo;
          const py = y + sy * passo;

          let cor = null;

          const noFundo =
            mascara || dentroRetanguloArredondado(px, py, 0, 0, lado, lado, raioFundo);

          if (noFundo) {
            cor = VERDE;
            if (dentroCirculo(px, py, moedaX, moedaY, moedaR)) {
              cor = AMBAR;
            } else if (
              dentroRetanguloArredondado(px, py, carteiraX, carteiraY, carteiraL, carteiraA, carteiraR)
            ) {
              cor = py >= faixaY ? [0xe8, 0xf1, 0xec] : BRANCO;
            }
          }

          if (cor) {
            r += cor[0];
            g += cor[1];
            b += cor[2];
            a += 255;
          }
        }
      }

      const total = AMOSTRAS * AMOSTRAS;
      const i = (y * lado + x) * 4;
      // Cor media ponderada apenas pelas amostras que pintaram algo.
      const pintadas = a / 255 || 1;
      pixels[i] = Math.round(r / pintadas);
      pixels[i + 1] = Math.round(g / pintadas);
      pixels[i + 2] = Math.round(b / pintadas);
      pixels[i + 3] = Math.round(a / total);
    }
  }

  return montarPng(lado, pixels);
}

// --- Execucao ---------------------------------------------------------------

mkdirSync(SAIDA, { recursive: true });

const arquivos = [
  ['icone-192.png', desenhar(192, false)],
  ['icone-512.png', desenhar(512, false)],
  ['icone-mascara-512.png', desenhar(512, true)],
];

for (const [nome, conteudo] of arquivos) {
  writeFileSync(join(SAIDA, nome), conteudo);
  console.log(`gerado  icons/${nome}  (${conteudo.length} bytes)`);
}
