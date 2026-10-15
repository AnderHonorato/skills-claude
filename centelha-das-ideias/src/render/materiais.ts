/**
 * Materiais em estilo cartoon (toon) e o vento: grama, árvores e moitas balançam
 * com rajadas que atravessam o mundo, deformando os vértices no shader.
 */
import * as THREE from 'three';

/** Uniformes globais compartilhados por todos os materiais com vento. */
export const VENTO = {
  tempo: { value: 0 },
  forca: { value: 0.6 },
  direcao: { value: new THREE.Vector2(0.8, -0.6).normalize() },
  jogador: { value: new THREE.Vector3(0, -100, 0) },
  /** Ponto que a câmera enquadra (as árvores na frente dele ficam vazadas). */
  foco: { value: new THREE.Vector3(0, -100, 0) },
  /** Foco projetado na tela (pixels do buffer), profundidade e altura do buffer. */
  focoTela: { value: new THREE.Vector3(0, 0, 0) },
  alturaTela: { value: 720 },
};

let gradiente: THREE.DataTexture | null = null;

/** Rampa de 4 tons para o sombreamento cartoon. */
export function gradienteToon(): THREE.DataTexture {
  if (gradiente) return gradiente;
  const dados = new Uint8Array([
    92, 92, 92, 255, 168, 168, 168, 255, 225, 225, 225, 255, 255, 255, 255, 255,
  ]);
  gradiente = new THREE.DataTexture(dados, 4, 1, THREE.RGBAFormat);
  gradiente.minFilter = THREE.NearestFilter;
  gradiente.magFilter = THREE.NearestFilter;
  gradiente.generateMipmaps = false;
  gradiente.needsUpdate = true;
  return gradiente;
}

const cache = new Map<string, THREE.MeshToonMaterial>();

export function toon(
  cor: THREE.ColorRepresentation,
  opcoes: THREE.MeshToonMaterialParameters = {}
): THREE.MeshToonMaterial {
  const chave = `${new THREE.Color(cor).getHexString()}|${JSON.stringify(opcoes)}`;
  const existente = cache.get(chave);
  if (existente) return existente;
  const m = new THREE.MeshToonMaterial({ color: cor, gradientMap: gradienteToon(), ...opcoes });
  cache.set(chave, m);
  return m;
}

export function toonNovo(
  cor: THREE.ColorRepresentation,
  opcoes: THREE.MeshToonMaterialParameters = {}
): THREE.MeshToonMaterial {
  return new THREE.MeshToonMaterial({ color: cor, gradientMap: gradienteToon(), ...opcoes });
}

export interface OpcoesVento {
  /** Quanto a altura amplifica o balanço (por metro). */
  flex: number;
  /** Altura a partir da qual começa a balançar. */
  inicio?: number;
  /** Afastar do jogador (grama pisada). */
  pisada?: boolean;
  /** Atributo por instância "aAgito" (moitas que mexem quando alguém passa). */
  agito?: boolean;
  /** Usa a altura absoluta no mundo (copas instanciadas soltas do tronco). */
  absoluta?: boolean;
  /** Fica vazado (pontilhado) quando está entre a câmera e o Claude. */
  vazar?: boolean;
}

const VERTICE_VENTO = /* glsl */ `
vec4 posMundo = vec4( transformed, 1.0 );
#ifdef USE_INSTANCING
  posMundo = instanceMatrix * posMundo;
  vec4 origemV = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
#else
  vec4 origemV = modelMatrix * vec4(0.0, 0.0, 0.0, 1.0);
#endif
posMundo = modelMatrix * posMundo;
#ifdef VENTO_ABSOLUTO
  float alturaV = max(posMundo.y - uInicioVento, 0.0);
  float curva = alturaV * uFlexVento;
#else
  float alturaV = max(posMundo.y - origemV.y - uInicioVento, 0.0);
  float curva = alturaV * alturaV * uFlexVento;
#endif
float fase = dot(origemV.xz, uDirVento) * 0.12 - uTempoVento * 1.6;
float rajada = 0.55 + 0.45 * sin(fase) * sin(fase * 0.37 + 1.3);
float tremido = sin(uTempoVento * 3.1 + origemV.x * 0.9 + origemV.z * 0.7) * 0.25;
vec2 desloc = uDirVento * curva * uForcaVento * (rajada + tremido);
#ifdef VENTO_AGITO
  desloc += vec2(sin(uTempoVento * 28.0 + origemV.x), cos(uTempoVento * 23.0 + origemV.z)) * aAgito * curva * 0.9;
#endif
#ifdef VENTO_PISADA
  vec2 doJogador = origemV.xz - uJogador.xz;
  float dj = length(doJogador);
  float empurra = (1.0 - smoothstep(0.2, 1.1, dj)) * step(abs(uJogador.y - origemV.y), 1.2);
  desloc += (dj > 0.001 ? doJogador / dj : vec2(0.0)) * empurra * alturaV * 1.4;
  posMundo.y -= empurra * alturaV * 0.45;
#endif
posMundo.xz += desloc;
vMundoVento = posMundo.xyz;
vec4 mvPosition = viewMatrix * posMundo;
gl_Position = projectionMatrix * mvPosition;
`;

/** Injeta o vento em qualquer material (inclusive o de profundidade das sombras). */
export function aplicarVento<T extends THREE.Material>(material: T, o: OpcoesVento): T {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTempoVento = VENTO.tempo;
    shader.uniforms.uForcaVento = VENTO.forca;
    shader.uniforms.uDirVento = VENTO.direcao;
    shader.uniforms.uJogador = VENTO.jogador;
    shader.uniforms.uFoco = VENTO.foco;
    shader.uniforms.uFocoTela = VENTO.focoTela;
    shader.uniforms.uAlturaTela = VENTO.alturaTela;
    shader.uniforms.uFlexVento = { value: o.flex };
    shader.uniforms.uInicioVento = { value: o.inicio ?? 0 };
    const defs = [
      o.agito ? '#define VENTO_AGITO' : '',
      o.pisada ? '#define VENTO_PISADA' : '',
      o.absoluta ? '#define VENTO_ABSOLUTO' : '',
    ].join('\n');
    if (o.vazar) {
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          '#include <common>\nuniform vec3 uFocoTela;\nuniform float uAlturaTela;\nvarying vec3 vMundoVento;'
        )
        .replace(
          'void main() {',
          `void main() {
  // vazado: o que está entre a câmera e o Claude vira pontilhado
  float distTela = length(gl_FragCoord.xy - uFocoTela.xy) / uAlturaTela;
  float prof = -vViewPosition.z;
  // muito perto da câmera: some (não tampa a tela)
  if (prof < uFocoTela.z * 0.5) discard;
  if (prof < uFocoTela.z * 0.62 && mod(floor(gl_FragCoord.x) + floor(gl_FragCoord.y), 2.0) < 1.0) discard;
  if (prof < uFocoTela.z - 1.2 && distTela < 0.26) {
    float forca = 1.0 - smoothstep(0.12, 0.26, distTela);
    float p1 = mod(floor(gl_FragCoord.x) + floor(gl_FragCoord.y), 2.0);
    float p2 = mod(floor(gl_FragCoord.x * 0.5) + floor(gl_FragCoord.y * 0.5), 2.0);
    if (forca > 0.15 && p1 < 1.0) discard;
    if (forca > 0.6 && p2 < 1.0) discard;
  }`
        );
    } else {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        '#include <common>\nvarying vec3 vMundoVento;'
      );
    }
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
${defs}
uniform float uTempoVento; uniform float uForcaVento; uniform vec2 uDirVento; uniform vec3 uJogador;
uniform float uFlexVento; uniform float uInicioVento;
varying vec3 vMundoVento;
${o.agito ? 'attribute float aAgito;' : ''}`
      )
      .replace('#include <project_vertex>', VERTICE_VENTO);
  };
  material.customProgramCacheKey = () =>
    `vento-${o.flex}-${o.inicio ?? 0}-${o.pisada ? 1 : 0}-${o.agito ? 1 : 0}-${o.absoluta ? 1 : 0}-${o.vazar ? 1 : 0}`;
  return material;
}

/** Material de profundidade com o mesmo vento (para a sombra balançar junto). */
export function profundidadeComVento(o: OpcoesVento): THREE.MeshDepthMaterial {
  const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  return aplicarVento(m, o);
}

/** Textura de círculo suave para partículas e brilhos. */
let texturaBrilho: THREE.Texture | null = null;
export function texturaCirculo(): THREE.Texture {
  if (texturaBrilho) return texturaBrilho;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.85)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  texturaBrilho = new THREE.CanvasTexture(c);
  texturaBrilho.colorSpace = THREE.SRGBColorSpace;
  return texturaBrilho;
}
