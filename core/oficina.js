// Oficina 3D «Órbita»: el Panel de Orvia en el ordenador (y, a petición, en el móvil).
// Un campus circular flotando en la oscuridad: tu despacho es el núcleo, en el centro, y
// cada departamento es una plataforma redonda a distinta altura, unida al núcleo por un
// puente de luz. Un toque acerca la cámara; un segundo toque (o el botón de la ficha)
// abre el módulo.
// La librería 3D se carga solo cuando se muestra la oficina.
// Al salir, destruir() libera la tarjeta gráfica y para la animación.

import { escapar } from './ui/componentes.js';

// Distribución en órbita alrededor del núcleo: ángulo (grados, 0 = hacia la cámara),
// distancia al centro y altura de cada plataforma. Si se añade un cuarto módulo, se añade aquí.
const ORBITA = 10.4;
const HUECOS_MODULOS = [
  { angulo: -74, altura: 1.0 },
  { angulo: 0, altura: 0.35 },
  { angulo: 74, altura: 1.45 },
];
const enOrbita = (angulo, distancia = ORBITA) => {
  const a = (angulo * Math.PI) / 180;
  return { x: Math.sin(a) * distancia, z: Math.cos(a) * distancia };
};

export async function montarOficina(escena, { modulos, nombreUsuario, datos, alAbrirModulo }) {
  const THREE = await import('../vendor/three/three.module.min.js');
  const { OrbitControls } = await import('../vendor/three/OrbitControls.js');
  // Brillo de las luces (solo en el ordenador: en el móvil se ahorra batería)
  const conBrillo = !matchMedia('(pointer: coarse)').matches;
  const post = conBrillo ? await Promise.all([
    import('../vendor/three/EffectComposer.js'), import('../vendor/three/RenderPass.js'),
    import('../vendor/three/UnrealBloomPass.js'), import('../vendor/three/OutputPass.js'),
  ]).catch(() => null) : null;

  const reducirMovimiento = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const esMovil = matchMedia('(pointer: coarse)').matches;

  const SALAS = [
    { id: 'direccion', nombre: nombreUsuario || 'Tu despacho', puesto: 'Director general', area: 'Dirección', situacion: 'Tu despacho',
      tarea: 'Desde aquí ves cómo va todo: en la pantalla de la pared, los datos clave de cada área.',
      color: '#4d8dff', x: 0, z: -0.6, angulo: 180, altura: 0.6, radio: 4.8, tipo: 'direccion' },
    ...modulos.slice(0, 3).map((m, i) => ({
      id: m.id, nombre: m.agente.nombre, puesto: m.agente.puesto, area: m.nombre, situacion: m.agente.situacion,
      tarea: m.agente.tarea, color: m.agente.color, ...HUECOS_MODULOS[i], ...enOrbita(HUECOS_MODULOS[i].angulo), radio: 3.7, tipo: 'agente', modulo: m,
    })),
    { id: 'cafe', nombre: 'Zona de café', puesto: 'Espacio común', area: 'Común', situacion: 'Abierta',
      tarea: 'Un rincón para desconectar entre tarea y tarea.',
      color: '#ff9a62', angulo: 180, altura: 0.25, ...enOrbita(148, 9.4), radio: 2.9, tipo: 'cafe' },
  ];

  // ---------- Capas de interfaz sobre la escena ----------
  escena.innerHTML = `
    <div class="oficina-estado" id="of-estado">Montando la oficina…</div>
    <button class="oficina-volver" id="of-volver" type="button" hidden>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>
      Ver toda la oficina
    </button>
    <div class="oficina-info" id="of-info" hidden aria-live="polite"></div>
    <p class="oficina-pista" id="of-pista">${esMovil ? 'Arrastra para girar · pellizca para acercarte · toca un despacho' : 'Arrastra para girar · rueda para acercarte · haz clic en un despacho'}</p>`;
  const $ = (sel) => escena.querySelector(sel);

  // ---------- Motor ----------
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, esMovil ? 1.75 : 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.domElement.className = 'oficina-lienzo';
  renderer.domElement.setAttribute('role', 'img');
  renderer.domElement.setAttribute('aria-label', 'Oficina en 3D. Usa las fichas del equipo para entrar en cada despacho.');
  escena.prepend(renderer.domElement);

  const mundo = new THREE.Scene();
  mundo.background = new THREE.Color('#04060b');
  mundo.fog = new THREE.FogExp2('#04060b', 0.021);

  const camara = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
  const VISTA_ANCHA = { pos: new THREE.Vector3(0, 21, 27), obj: new THREE.Vector3(0, 0.2, 1.4) };
  const VISTA_ALTA = { pos: new THREE.Vector3(0, 33, 14), obj: new THREE.Vector3(0, 0, 1) };
  let vistaGeneral = VISTA_ANCHA;
  camara.position.copy(vistaGeneral.pos);

  const controles = new OrbitControls(camara, renderer.domElement);
  controles.target.copy(vistaGeneral.obj);
  controles.enableDamping = true;
  controles.dampingFactor = 0.08;
  controles.minDistance = 7;
  controles.maxDistance = 46;
  controles.minPolarAngle = 0.12;
  controles.maxPolarAngle = 1.22;
  controles.enablePan = !esMovil;
  controles.rotateSpeed = esMovil ? 0.7 : 0.9;
  controles.update();

  let compositor = null, brillo = null;
  if (post) {
    const [{ EffectComposer }, { RenderPass }, { UnrealBloomPass }, { OutputPass }] = post;
    compositor = new EffectComposer(renderer);
    compositor.addPass(new RenderPass(mundo, camara));
    brillo = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.58, 0.5, 0.86);
    compositor.addPass(brillo);
    compositor.addPass(new OutputPass());
  }

  mundo.add(new THREE.HemisphereLight('#8fa8ff', '#0a1020', 1.05));
  const sol = new THREE.DirectionalLight('#e6eeff', 2.3);
  sol.position.set(-10, 24, 12);
  sol.castShadow = true;
  sol.shadow.mapSize.set(esMovil ? 1024 : 2048, esMovil ? 1024 : 2048);
  Object.assign(sol.shadow.camera, { left: -17, right: 17, top: 17, bottom: -17, near: 1, far: 70 });
  sol.shadow.bias = -0.0005;
  mundo.add(sol);

  // Todo lo creado se apunta aquí para liberarlo al salir.
  const recursos = new Set();
  const apuntar = (r) => (recursos.add(r), r);

  const mat = (color, extra = {}) => apuntar(new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.05, ...extra }));
  const MAT = {
    base: mat('#0a0e17', { roughness: 0.55, metalness: 0.35 }),
    zocalo: mat('#0c1220', { roughness: 0.4, metalness: 0.6 }),
    mueble: mat('#1f2533', { roughness: 0.45, metalness: 0.15 }),
    muebleClaro: mat('#2c3446', { roughness: 0.4, metalness: 0.2 }),
    pata: mat('#141a26', { metalness: 0.7, roughness: 0.3 }),
    silla: mat('#1a2030', { roughness: 0.55 }),
    piel: mat('#d9b08c', { roughness: 0.65 }),
    pelo: mat('#2a1f1a', { roughness: 0.8 }),
    pantalon: mat('#1e2230'),
    maceta: mat('#2f333c', { roughness: 0.6 }),
    hoja: mat('#3f8f5e', { roughness: 0.8, flatShading: true }),
    marcoMonitor: mat('#0b0f18', { roughness: 0.35, metalness: 0.5 }),
    blanco: mat('#f2f4f7'),
  };
  const geo = (g) => apuntar(g);

  function caja(w, h, d, material, x = 0, y = 0, z = 0, sombra = true) {
    const m = new THREE.Mesh(geo(new THREE.BoxGeometry(w, h, d)), material);
    m.position.set(x, y, z);
    m.castShadow = sombra;
    m.receiveShadow = true;
    return m;
  }

  // ---------- Suelo: un disco oscuro con anillos y radios de luz que se pierden en la niebla ----------
  {
    const c = document.createElement('canvas');
    c.width = c.height = 1024;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#05080f';
    ctx.fillRect(0, 0, 1024, 1024);
    ctx.translate(512, 512);
    for (let r = 1; r <= 13; r++) {
      ctx.strokeStyle = `rgba(90,140,255,${r % 4 === 0 ? 0.32 : 0.11})`;
      ctx.lineWidth = r % 4 === 0 ? 2.2 : 1.2;
      ctx.beginPath(); ctx.arc(0, 0, r * 38, 0, Math.PI * 2); ctx.stroke();
    }
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * Math.PI * 2;
      ctx.strokeStyle = `rgba(90,140,255,${i % 6 === 0 ? 0.16 : 0.06})`;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(Math.cos(a) * 60, Math.sin(a) * 60); ctx.lineTo(Math.cos(a) * 500, Math.sin(a) * 500); ctx.stroke();
    }
    const tex = apuntar(new THREE.CanvasTexture(c));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    const suelo = new THREE.Mesh(geo(new THREE.CircleGeometry(26, 96)), apuntar(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.35, metalness: 0.4 })));
    suelo.rotation.x = -Math.PI / 2;
    suelo.receiveShadow = true;
    mundo.add(suelo);
  }

  // Polvo de luz flotando (se queda quieto con «Reducir movimiento»)
  const polvo = (() => {
    const n = esMovil ? 140 : 320, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const r = 3 + Math.random() * 20, a = Math.random() * Math.PI * 2;
      pos.set([Math.cos(a) * r, 0.4 + Math.random() * 7, Math.sin(a) * r], i * 3);
    }
    const g = geo(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(g, apuntar(new THREE.PointsMaterial({ color: '#7fb0ff', size: 0.06, transparent: true, opacity: 0.55, depthWrite: false })));
    mundo.add(pts);
    return pts;
  })();

  // ---------- Pantallas y carteles (dibujados en un lienzo) ----------
  const lienzo = (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h });
  function redondeado(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function texturaDe(c) {
    const t = apuntar(new THREE.CanvasTexture(c));
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }

  // Etiqueta holográfica de cada plataforma: cristal oscuro, línea de luz del departamento.
  function cartel(sala) {
    const c = lienzo(640, 200), ctx = c.getContext('2d');
    redondeado(ctx, 8, 8, 624, 184, 30);
    const fondo = ctx.createLinearGradient(0, 0, 0, 200);
    fondo.addColorStop(0, 'rgba(18,26,44,0.92)');
    fondo.addColorStop(1, 'rgba(6,9,16,0.92)');
    ctx.fillStyle = fondo;
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = 'rgba(160,185,255,0.28)';
    ctx.stroke();
    // Línea de luz superior en el color del departamento
    const linea = ctx.createLinearGradient(40, 0, 600, 0);
    linea.addColorStop(0, 'rgba(0,0,0,0)');
    linea.addColorStop(0.5, sala.color);
    linea.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = linea;
    ctx.fillRect(60, 9, 520, 4);
    ctx.shadowColor = sala.color;
    ctx.shadowBlur = 22;
    ctx.fillStyle = sala.color;
    ctx.beginPath(); ctx.arc(64, 100, 14, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#eef3fc';
    ctx.font = '600 62px Geist, system-ui, sans-serif';
    ctx.fillText(sala.nombre, 104, 96, 500);
    ctx.fillStyle = '#9fb0c8';
    ctx.font = '400 38px Geist, system-ui, sans-serif';
    ctx.fillText(sala.tipo === 'cafe' ? sala.puesto : `${sala.puesto} · ${sala.area}`, 104, 150, 500);
    const sprite = new THREE.Sprite(apuntar(new THREE.SpriteMaterial({ map: texturaDe(c), transparent: true, depthTest: false })));
    const k = esMovil ? 1.3 : 1;
    sprite.scale.set(3.4 * k, 1.06 * k, 1);
    sprite.renderOrder = 10;
    return sprite;
  }

  const pantallas = [];
  function pantalla(tipo, color) {
    const c = lienzo(tipo === 'datos' ? 768 : 384, tipo === 'datos' ? 432 : 240);
    const p = { c, ctx: c.getContext('2d'), tex: texturaDe(c), tipo, color, t: Math.random() * 10 };
    pintarPantalla(p);
    pantallas.push(p);
    return p.tex;
  }
  function pintarPantalla(p) {
    const { ctx, tipo, color, t } = p;
    const W = p.c.width, H = p.c.height;
    const fondoP = ctx.createLinearGradient(0, 0, 0, H);
    fondoP.addColorStop(0, '#0b1426');
    fondoP.addColorStop(1, '#050a14');
    ctx.fillStyle = fondoP;
    ctx.fillRect(0, 0, W, H);
    if (tipo === 'datos') {
      // Pantalla de tu despacho: los datos clave de Orvia.
      ctx.fillStyle = '#f2f4f7';
      ctx.font = '800 34px Geist, system-ui, sans-serif';
      ctx.fillText('Orvia · hoy', 40, 62);
      const filas = [
        [datos.etiquetaQueda || 'Te quedan este mes', datos.queda, '#8b7bff'],
        ['Patrimonio', datos.patrimonio, '#4d8dff'],
        ['Tareas de hoy', datos.tareas, '#2fd28f'],
      ];
      filas.forEach(([etiqueta, valor, c2], i) => {
        const y = 100 + i * 106;
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        redondeado(ctx, 40, y, W - 80, 88, 16); ctx.fill();
        ctx.fillStyle = c2;
        ctx.fillRect(40, y + 18, 6, 52);
        ctx.fillStyle = '#9aa1ad';
        ctx.font = '600 24px Geist, system-ui, sans-serif';
        ctx.fillText(etiqueta, 66, y + 36);
        ctx.fillStyle = '#f2f4f7';
        ctx.font = '300 36px Geist, system-ui, sans-serif';
        ctx.fillText(valor, 66, y + 74, W - 130);
      });
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fillRect(0, 0, W, 26);
      ctx.fillStyle = color;
      ctx.fillRect(14, 10, 60, 6);
      if (tipo === 'finanzas') {
        ctx.lineWidth = 16;
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.beginPath(); ctx.arc(90, 132, 54, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = color;
        ctx.beginPath(); ctx.arc(90, 132, 54, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (0.55 + 0.03 * Math.sin(t))); ctx.stroke();
        for (let i = 0; i < 6; i++) {
          const h = 30 + 50 * (0.5 + 0.5 * Math.sin(t * 0.8 + i * 1.3));
          ctx.fillStyle = i % 2 ? '#c084fc' : color;
          ctx.fillRect(190 + i * 28, 200 - h, 18, h);
        }
      } else if (tipo === 'accion' && datos.accion) {
        pintarDiaAccion(ctx, W, H, color, datos.accion);
      } else if (tipo === 'cerebro' && datos.cerebro) {
        pintarBiblioteca(ctx, W, H, color, datos.cerebro);
      } else if (tipo === 'accion') {
        for (let col = 0; col < 3; col++) {
          ctx.fillStyle = 'rgba(255,255,255,0.05)';
          ctx.fillRect(14 + col * 122, 38, 110, 190);
          const n = 2 + ((col + Math.floor(t * 0.3)) % 3);
          for (let i = 0; i < n; i++) {
            ctx.fillStyle = col === 2 ? color : col === 1 ? '#86efac' : 'rgba(255,255,255,0.35)';
            ctx.globalAlpha = col === 0 ? 0.6 : 0.9;
            ctx.fillRect(22 + col * 122, 48 + i * 44, 94, 34);
            ctx.globalAlpha = 1;
          }
        }
      } else {
        for (let i = 0; i < 6; i++) {
          const x = 14 + (i % 3) * 122, y = 40 + Math.floor(i / 3) * 98;
          ctx.fillStyle = i === Math.floor(t * 0.5) % 6 ? 'rgba(251,191,36,0.35)' : 'rgba(255,255,255,0.06)';
          ctx.fillRect(x, y, 110, 88);
          ctx.fillStyle = 'rgba(255,255,255,0.45)';
          for (let l = 0; l < 4; l++) ctx.fillRect(x + 10, y + 14 + l * 16, 90 - l * 14, 6);
        }
      }
    }
    p.tex.needsUpdate = true;
  }

  // Monitor de Jude: tu biblioteca (notas, ideas vivas, aprendizajes y la última nota).
  function pintarBiblioteca(ctx, W, H, color, c) {
    const fuente = (peso, px) => `${peso} ${px}px Geist, system-ui, sans-serif`;
    ctx.fillStyle = '#f2f4f7';
    ctx.font = fuente(800, 15);
    ctx.fillText('BIBLIOTECA', W - 112, 19);
    const cifras = [[c.notas, 'notas', color], [c.ideas, 'ideas vivas', '#fcd34d'], [c.aprendizajes, 'aprendizajes', '#5eead4']];
    cifras.forEach(([n, texto, tono], i) => {
      const x = 16 + i * ((W - 32) / 3);
      ctx.fillStyle = tono;
      ctx.font = fuente(800, 40);
      ctx.fillText(String(n), x, 92);
      ctx.fillStyle = '#9aa1ad';
      ctx.font = fuente(600, 13);
      ctx.fillText(texto, x, 114);
    });
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(16, 136, W - 32, 1);
    ctx.fillStyle = '#9aa1ad';
    ctx.font = fuente(600, 13);
    ctx.fillText(c.ultima ? 'Última nota' : 'Sin notas todavía', 16, 164);
    if (c.ultima) {
      ctx.fillStyle = '#f2f4f7';
      ctx.font = fuente(600, 19);
      ctx.fillText(c.ultima.titulo, 16, 190, W - 32);
    }
  }

  // Monitor de Endrick: tu día (próximo evento, tareas y hábitos de la semana).
  function pintarDiaAccion(ctx, W, H, color, a) {
    const fuente = (peso, px) => `${peso} ${px}px Geist, system-ui, sans-serif`;
    ctx.fillStyle = '#f2f4f7';
    ctx.font = fuente(800, 15);
    ctx.fillText('HOY', W - 52, 19);
    let y = 54;
    const p = a.proximo;
    ctx.fillStyle = p ? (p.color || '#93c5fd') : '#9aa1ad';
    ctx.font = fuente(700, 16);
    ctx.fillText(p ? (p.todoElDia ? 'Todo el día' : p.inicio.slice(11, 16)) : 'Calendario', 16, y);
    ctx.fillStyle = '#f2f4f7';
    ctx.font = fuente(600, 19);
    ctx.fillText(p ? p.titulo : 'Sin más eventos', 16, y + 24, W - 32);
    y += 50;
    const n = a.tareas.length;
    ctx.fillStyle = '#9aa1ad';
    ctx.font = fuente(600, 15);
    ctx.fillText('Tareas', 16, y + 6);
    ctx.fillStyle = n ? '#f2f4f7' : '#4ade80';
    ctx.font = fuente(700, 19);
    ctx.fillText(n ? `${n} pendiente${n === 1 ? '' : 's'}` : 'Todo hecho', 90, y + 7, W - 106);
    y += 26;
    for (const h of a.habitos.slice(0, 3)) {
      const k = Math.max(0, Math.min(1, h.meta ? h.total / h.meta : 0));
      ctx.fillStyle = '#9aa1ad';
      ctx.font = fuente(600, 13);
      ctx.fillText(h.titulo, 16, y + 13, 110);
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      redondeado(ctx, 130, y + 4, W - 146, 10, 5); ctx.fill();
      ctx.fillStyle = k >= 1 ? '#4ade80' : color;
      redondeado(ctx, 130, y + 4, Math.max(10, (W - 146) * k), 10, 5); ctx.fill();
      y += 22;
    }
  }

  // ---------- Personas y muebles ----------
  function persona(colorRopa) {
    const g = new THREE.Group();
    const ropa = mat(colorRopa, { roughness: 0.75 });
    const torso = new THREE.Mesh(geo(new THREE.CapsuleGeometry(0.2, 0.34, 6, 12)), ropa);
    torso.position.set(0, 0.86, 0);
    torso.castShadow = true;
    g.add(torso);
    g.add(caja(0.36, 0.14, 0.5, MAT.pantalon, 0, 0.5, -0.18));
    const cabeza = new THREE.Group();
    cabeza.position.set(0, 1.3, 0);
    const craneo = new THREE.Mesh(geo(new THREE.SphereGeometry(0.16, 20, 16)), MAT.piel);
    craneo.castShadow = true;
    const pelo = new THREE.Mesh(geo(new THREE.SphereGeometry(0.168, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.55)), MAT.pelo);
    pelo.rotation.x = 0.35;
    cabeza.add(craneo, pelo);
    g.add(cabeza);
    const brazos = [];
    for (const lado of [-1, 1]) {
      const hombro = new THREE.Group();
      hombro.position.set(0.24 * lado, 1.04, 0);
      const brazo = new THREE.Mesh(geo(new THREE.CapsuleGeometry(0.055, 0.32, 4, 8)), ropa);
      brazo.position.set(0, -0.2, 0);
      brazo.castShadow = true;
      const mano = new THREE.Mesh(geo(new THREE.SphereGeometry(0.05, 10, 8)), MAT.piel);
      mano.position.set(0, -0.4, 0);
      hombro.add(brazo, mano);
      hombro.rotation.x = -1.15;
      hombro.rotation.z = -0.12 * lado;
      g.add(hombro);
      brazos.push(hombro);
    }
    g.userData = { cabeza, brazos, fase: Math.random() * 10 };
    return g;
  }
  function silla() {
    const g = new THREE.Group();
    g.add(caja(0.5, 0.07, 0.5, MAT.silla, 0, 0.45, 0));
    g.add(caja(0.5, 0.55, 0.07, MAT.silla, 0, 0.75, 0.24));
    g.add(caja(0.06, 0.42, 0.06, MAT.pata, 0, 0.22, 0, false));
    g.add(caja(0.5, 0.04, 0.06, MAT.pata, 0, 0.03, 0, false));
    g.add(caja(0.06, 0.04, 0.5, MAT.pata, 0, 0.03, 0, false));
    return g;
  }
  function mesa(ancho, fondo) {
    const g = new THREE.Group();
    g.add(caja(ancho, 0.06, fondo, MAT.mueble, 0, 0.75, 0));
    for (const sx of [-1, 1]) g.add(caja(0.06, 0.72, fondo - 0.1, MAT.pata, sx * (ancho / 2 - 0.08), 0.36, 0));
    return g;
  }
  function monitor(tex, ancho = 0.9) {
    const g = new THREE.Group();
    const alto = ancho * 0.62;
    g.add(caja(ancho + 0.05, alto + 0.05, 0.04, MAT.marcoMonitor, 0, 0.82 + alto / 2 + 0.12, 0));
    const panel = new THREE.Mesh(geo(new THREE.PlaneGeometry(ancho, alto)), apuntar(new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })));
    panel.position.set(0, 0.82 + alto / 2 + 0.12, 0.022);
    g.add(panel);
    g.add(caja(0.05, 0.14, 0.05, MAT.pata, 0, 0.85, -0.02, false));
    g.add(caja(0.28, 0.02, 0.18, MAT.pata, 0, 0.79, -0.02, false));
    return g;
  }
  function planta(x, z, alto = 1) {
    const g = new THREE.Group();
    g.add(caja(0.42, 0.45, 0.42, MAT.maceta, 0, 0.225, 0));
    const hojas = new THREE.Mesh(geo(new THREE.IcosahedronGeometry(0.42 * alto, 0)), MAT.hoja);
    hojas.position.y = 0.45 + 0.4 * alto;
    hojas.castShadow = true;
    g.add(hojas);
    g.position.set(x, 0, z);
    return g;
  }
  function estanteria(colores) {
    const g = new THREE.Group();
    g.add(caja(2.2, 1.9, 0.4, MAT.mueble, 0, 0.95, 0));
    const mats = colores.map((c) => mat(c));
    let semilla = 7;
    const azar = () => ((semilla = (semilla * 9301 + 49297) % 233280) / 233280);
    for (let fila = 0; fila < 4; fila++) {
      let x = -0.95;
      while (x < 0.95) {
        const w = 0.08 + azar() * 0.08, h = 0.28 + azar() * 0.1;
        g.add(caja(w, h, 0.28, mats[Math.floor(azar() * mats.length)], x + w / 2, 0.15 + fila * 0.45 + h / 2, 0.08, false));
        x += w + 0.015;
      }
    }
    return g;
  }

  // Despacho de Endrick: objetos que aparecen al subir de nivel en tus hábitos.
  const DECORACION_ACCION = [
    { nivel: 3, nombre: 'una planta grande' },
    { nivel: 5, nombre: 'una estantería' },
    { nivel: 8, nombre: 'un trofeo' },
    { nivel: 12, nombre: 'alfombra y lámpara' },
  ];
  const decoracion = [];
  function decoracionAccion(w, d, mz) {
    const g = new THREE.Group();
    const poner = (nivel, obj) => { obj.visible = false; obj.userData.nivel = nivel; decoracion.push(obj); g.add(obj); };
    poner(3, planta(w / 2 - 0.6, d / 2 - 0.9, 1.35));
    const e = estanteria(['#4ade80', '#fbbf24', '#e5e7eb', '#0d9488', '#86efac']);
    e.position.set(w / 2 - 0.35, 0, -0.3); e.rotation.y = -Math.PI / 2;
    poner(5, e);
    const trofeo = new THREE.Group();
    const oro = mat('#fbbf24', { metalness: 0.75, roughness: 0.25, emissive: '#7c4a03', emissiveIntensity: 0.25 });
    trofeo.add(caja(0.2, 0.05, 0.2, MAT.marcoMonitor, 0, 0.025, 0, false));
    const copa = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.11, 0.05, 0.18, 16)), oro);
    copa.position.y = 0.2; copa.castShadow = true;
    trofeo.add(copa);
    trofeo.add(caja(0.035, 0.08, 0.035, oro, 0, 0.09, 0, false));
    trofeo.position.set(0.72, 0.8, mz + 0.05);
    poner(8, trofeo);
    const zona = new THREE.Group();
    zona.add(caja(2.8, 0.012, 1.8, mat('#14532d', { roughness: 0.95 }), 0, 0.046, 0.7, false));
    zona.add(caja(0.05, 1.6, 0.05, MAT.pata, -w / 2 + 0.55, 0.8, -d / 2 + 0.55, false));
    const pantallaLampara = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.16, 0.24, 0.26, 18, 1, true)), apuntar(new THREE.MeshStandardMaterial({ color: '#fde68a', emissive: '#fbbf24', emissiveIntensity: 0.8, side: THREE.DoubleSide })));
    pantallaLampara.position.set(-w / 2 + 0.55, 1.68, -d / 2 + 0.55);
    zona.add(pantallaLampara);
    const calida = new THREE.PointLight('#fbbf24', 3, 4, 1.8);
    calida.position.set(-w / 2 + 0.55, 1.6, -d / 2 + 0.55);
    zona.add(calida);
    poner(12, zona);
    return g;
  }
  function ponerNivel(nivel) {
    for (const obj of decoracion) obj.visible = nivel >= obj.userData.nivel;
  }

  // ---------- Plataformas ----------
  const objetivosClic = [];
  const personas = [];
  const salas = {};
  const giratorios = []; // hologramas que giran despacio
  const ARCO_ABIERTO = (125 * Math.PI) / 180; // la abertura mira al núcleo

  // Charco de luz en el suelo, bajo cada plataforma
  function charco(color, radio) {
    const c = lienzo(256, 256), ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
    const m = new THREE.Mesh(geo(new THREE.CircleGeometry(radio, 48)), apuntar(new THREE.MeshBasicMaterial({ map: texturaDe(c), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
    m.rotation.x = -Math.PI / 2;
    return m;
  }
  // Aro de luz (o arco) en el plano horizontal. `desde`: ángulo de inicio con el criterio de CylinderGeometry.
  function aro(radio, grosor, material, arco = Math.PI * 2, desde = 0) {
    const t = new THREE.Mesh(geo(new THREE.TorusGeometry(radio, grosor, 8, 96, arco)), material);
    t.rotation.x = -Math.PI / 2;
    const g = new THREE.Group();
    g.rotation.y = desde - Math.PI / 2;
    g.add(t);
    return g;
  }
  // Ángulo local para mirar hacia el centro de la plataforma
  const haciaDentro = (x, z) => Math.atan2(-x, -z);
  const enArco = (angulo, radio) => ({ x: Math.sin(angulo) * radio, z: Math.cos(angulo) * radio });

  for (const sala of SALAS) {
    const r = sala.radio, h = sala.altura;
    const g = new THREE.Group();
    g.position.set(sala.x, h, sala.z);
    g.rotation.y = sala.tipo === 'direccion' ? 0 : Math.atan2(-sala.x, -sala.z); // la abertura (+z local) mira al núcleo
    mundo.add(g);
    const color = new THREE.Color(sala.color);
    const luzMat = apuntar(new THREE.MeshBasicMaterial({ color, toneMapped: false }));
    const luzSuave = apuntar(new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, toneMapped: false }));

    // Zócalo metálico desde el suelo y aros de luz
    const zocalo = new THREE.Mesh(geo(new THREE.CylinderGeometry(r, r + 0.12, h, 72)), MAT.zocalo);
    zocalo.position.y = -h / 2;
    zocalo.castShadow = true;
    zocalo.receiveShadow = true;
    g.add(zocalo);
    const aroAlto = aro(r + 0.005, 0.03, luzMat);
    g.add(aroAlto);
    const aroBajo = aro(r + 0.16, 0.02, luzSuave);
    aroBajo.position.y = -h + 0.02;
    g.add(aroBajo);
    const luzSuelo = charco(sala.color, r * 2.1);
    luzSuelo.position.y = -h + 0.01;
    g.add(luzSuelo);

    // Suelo de la plataforma (es lo que se toca)
    const suelo = new THREE.Mesh(geo(new THREE.CircleGeometry(r - 0.01, 72)),
      apuntar(new THREE.MeshStandardMaterial({ color: new THREE.Color('#1a2234').lerp(color, 0.1), emissive: color, emissiveIntensity: 0.05, roughness: 0.55, metalness: 0.2 })));
    suelo.rotation.x = -Math.PI / 2;
    suelo.position.y = 0.004;
    suelo.receiveShadow = true;
    suelo.userData.sala = sala.id;
    g.add(suelo);
    objetivosClic.push(suelo);
    const aroInterior = aro(r - 0.45, 0.008, luzSuave);
    aroInterior.position.y = 0.01;
    g.add(aroInterior);

    // Pared curva de cristal con su canto de luz; abierta hacia el núcleo
    const inicioArco = ARCO_ABIERTO / 2, largoArco = Math.PI * 2 - ARCO_ABIERTO;
    const ALTO = sala.tipo === 'cafe' ? 1.0 : 1.55;
    const cristal = new THREE.Mesh(geo(new THREE.CylinderGeometry(r - 0.1, r - 0.1, ALTO, 72, 1, true, inicioArco, largoArco)),
      apuntar(new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.11, roughness: 0.05, metalness: 0.3, side: THREE.DoubleSide, depthWrite: false })));
    cristal.position.y = ALTO / 2;
    g.add(cristal);
    const canto = aro(r - 0.1, 0.022, luzMat, largoArco, inicioArco);
    canto.position.y = ALTO;
    g.add(canto);
    // Montantes de la pared
    const montantes = sala.tipo === 'direccion' ? 9 : 7;
    for (let i = 0; i <= montantes; i++) {
      const ang = inicioArco + (largoArco * i) / montantes;
      const { x, z } = enArco(ang, r - 0.1);
      g.add(caja(0.05, ALTO, 0.05, MAT.pata, x, ALTO / 2, z, false));
    }
    const luz = new THREE.PointLight(color, sala.tipo === 'direccion' ? 14 : 9, r * 2.8, 1.5);
    luz.position.set(0, 2.6, -0.4);
    g.add(luz);

    if (sala.tipo === 'agente') {
      const tipoPantalla = ['finanzas', 'accion', 'cerebro'].includes(sala.id) ? sala.id : 'cerebro';
      const mz = -1.75;
      const m1 = mesa(2, 0.85); m1.position.set(0, 0, mz); g.add(m1);
      const mon = monitor(pantalla(tipoPantalla, sala.color)); mon.position.set(0, 0, mz - 0.15); g.add(mon);
      g.add(caja(0.55, 0.02, 0.18, MAT.muebleClaro, 0, 0.79, mz + 0.2, false));
      const s1 = silla(); s1.position.set(0, 0, mz + 0.85); g.add(s1);
      const p = persona(sala.color); p.position.set(0, 0, mz + 0.8); g.add(p); personas.push(p);
      g.add(planta(-2.15, -1.85));
      if (tipoPantalla === 'cerebro') {
        for (const [ang, cols] of [[(-112 * Math.PI) / 180, ['#f2b33d', '#b45309', '#e5e7eb', '#78350f', '#ffd27a']], [(112 * Math.PI) / 180, ['#f2b33d', '#e5e7eb', '#92400e']]]) {
          const e = estanteria(cols);
          const { x, z } = enArco(ang, r - 0.48);
          e.position.set(x, 0, z);
          e.rotation.y = haciaDentro(x, z);
          g.add(e);
        }
      } else if (tipoPantalla === 'accion') {
        const pizarra = caja(2.0, 1.1, 0.05, mat('#e8eaee', { roughness: 0.4 }));
        const { x, z } = enArco((-108 * Math.PI) / 180, r - 0.32);
        const giro = haciaDentro(x, z);
        const panel = new THREE.Group();
        panel.position.set(x, 0, z);
        panel.rotation.y = giro;
        pizarra.position.set(0, 1.3, 0);
        panel.add(pizarra);
        ['#2fd28f', '#ffb547', '#7cf0bd', '#f472b6', '#2fd28f', '#b3a9ff'].forEach((c2, i) => {
          const n = caja(0.22, 0.22, 0.02, apuntar(new THREE.MeshBasicMaterial({ color: c2 })), 0, 0, 0, false);
          n.position.set(-0.6 + (i % 3) * 0.6, 1.55 - Math.floor(i / 3) * 0.42, 0.04);
          panel.add(n);
        });
        g.add(panel);
        g.add(decoracionAccion(5.0, 5.0, mz));
      } else {
        const m2 = monitor(pantalla('finanzas', '#b3a9ff'), 0.7);
        m2.position.set(0.85, 0, mz - 0.1); m2.rotation.y = -0.45; g.add(m2);
        g.add(caja(0.6, 1, 0.6, MAT.muebleClaro, 2.0, 0.5, -1.9));
      }
    } else if (sala.tipo === 'direccion') {
      const mz = -2.3;
      const m1 = mesa(3.2, 1.2); m1.position.set(0, 0, mz); g.add(m1);
      const s1 = silla(); s1.position.set(0, 0, mz - 0.95); s1.rotation.y = Math.PI; g.add(s1);
      // Pantalla grande al fondo con los datos clave, apoyada en la pared curva
      const grande = new THREE.Mesh(geo(new THREE.PlaneGeometry(3.6, 2.025)), apuntar(new THREE.MeshBasicMaterial({ map: pantalla('datos', sala.color), toneMapped: false })));
      grande.position.set(0, 2.15, -r + 0.45);
      g.add(grande);
      g.add(caja(3.75, 2.15, 0.06, MAT.marcoMonitor, 0, 2.15, -r + 0.41, false));
      const sofa = new THREE.Group();
      const tapiz = mat('#1e2a48');
      sofa.add(caja(2.4, 0.42, 0.9, tapiz, 0, 0.21, 0));
      sofa.add(caja(2.4, 0.5, 0.22, tapiz, 0, 0.55, -0.34));
      const ps = enArco((-62 * Math.PI) / 180, r - 1.25);
      sofa.position.set(ps.x, 0, ps.z); sofa.rotation.y = haciaDentro(ps.x, ps.z);
      g.add(sofa);
      const mesita = enArco((-62 * Math.PI) / 180, r - 2.5);
      g.add(caja(1.1, 0.32, 0.6, MAT.muebleClaro, mesita.x, 0.16, mesita.z));
      g.add(planta(r - 1.3, -r + 1.6, 1.3));
      g.add(planta(-r + 1.3, -r + 1.6, 1.1));
      const alfombra = new THREE.Mesh(geo(new THREE.CircleGeometry(2.1, 64)), mat('#111a30', { roughness: 1 }));
      alfombra.rotation.x = -Math.PI / 2; alfombra.position.set(0, 0.012, mz + 0.4); alfombra.receiveShadow = true;
      g.add(alfombra);
      const pe = enArco((62 * Math.PI) / 180, r - 0.5);
      const e1 = estanteria(['#4d8dff', '#e5e7eb', '#475569']);
      e1.position.set(pe.x, 0, pe.z); e1.rotation.y = haciaDentro(pe.x, pe.z); g.add(e1);
      // Holograma de Orvia: una esfera de líneas con su órbita, girando sobre el núcleo
      const holo = new THREE.Group();
      const lineas = apuntar(new THREE.LineBasicMaterial({ color: '#7fb0ff', transparent: true, opacity: 0.55, toneMapped: false }));
      holo.add(new THREE.LineSegments(geo(new THREE.WireframeGeometry(geo(new THREE.IcosahedronGeometry(0.85, 2)))), lineas));
      const orbita = aro(1.25, 0.012, apuntar(new THREE.MeshBasicMaterial({ color: '#48e2ff', toneMapped: false })));
      orbita.rotation.z = 0.42;
      holo.add(orbita);
      const nucleo = new THREE.Mesh(geo(new THREE.SphereGeometry(0.22, 24, 16)), apuntar(new THREE.MeshBasicMaterial({ color: '#bfe0ff', toneMapped: false })));
      holo.add(nucleo);
      holo.position.set(0, 5.0, 0.2);
      holo.scale.setScalar(0.8);
      g.add(holo);
      giratorios.push(holo);
    } else {
      g.add(caja(2.6, 0.95, 0.6, MAT.muebleClaro, 0, 0.475, -r + 0.75));
      g.add(caja(0.45, 0.5, 0.36, mat('#141a26', { metalness: 0.6, roughness: 0.3 }), -0.8, 1.2, -r + 0.75));
      const piloto = new THREE.Mesh(geo(new THREE.SphereGeometry(0.04, 8, 8)), apuntar(new THREE.MeshBasicMaterial({ color: '#ffb547' })));
      piloto.position.set(-0.8, 1.28, -r + 0.95);
      g.add(piloto);
      for (let i = 0; i < 3; i++) g.add(caja(0.09, 0.11, 0.09, MAT.blanco, 0.1 + i * 0.25, 1.0, -r + 0.7, false));
      const tablero = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.62, 0.62, 0.05, 32)), MAT.mueble);
      tablero.position.set(0, 0.75, 0.3); tablero.castShadow = true; tablero.receiveShadow = true;
      g.add(tablero);
      g.add(caja(0.08, 0.72, 0.08, MAT.pata, 0, 0.36, 0.3));
      const asiento = mat(sala.color, { roughness: 0.6 });
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 + 0.4;
        const taburete = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.2, 0.2, 0.06, 20)), asiento);
        taburete.position.set(Math.cos(a) * 0.95, 0.5, 0.3 + Math.sin(a) * 0.95);
        taburete.castShadow = true;
        g.add(taburete);
        g.add(caja(0.05, 0.48, 0.05, MAT.pata, taburete.position.x, 0.24, taburete.position.z, false));
      }
      const lampara = new THREE.Mesh(geo(new THREE.SphereGeometry(0.2, 20, 14)), apuntar(new THREE.MeshBasicMaterial({ color: '#ffe6c2', toneMapped: false })));
      lampara.position.set(0, 2.3, 0.3);
      g.add(lampara);
      g.add(planta(1.6, -1.3, 1.1));
    }

    // Etiqueta flotante con su hilo de luz
    const c = cartel(sala);
    const altoCartel = sala.tipo === 'direccion' ? 3.1 : 3.0;
    const zCartel = sala.tipo === 'direccion' ? r - 0.9 : 0.2;
    c.position.set(0, altoCartel, zCartel);
    c.userData.sala = sala.id;
    g.add(c);
    objetivosClic.push(c);
    const hilo = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.008, 0.008, altoCartel - 0.6 - ALTO * 0.2, 6)), luzSuave);
    hilo.position.set(0, (altoCartel - 0.55 + ALTO * 0.2) / 2, zCartel);
    g.add(hilo);

    g.updateMatrixWorld(true);
    const desde = sala.tipo === 'agente' ? new THREE.Vector3(1.9, 3.4, 3.4)
      : sala.tipo === 'direccion' ? new THREE.Vector3(0.9, 4.6, 3.6)
      : new THREE.Vector3(0.5, 3.6, 3.6);
    const hacia = sala.tipo === 'agente' ? new THREE.Vector3(0, 0.9, -1.4)
      : sala.tipo === 'direccion' ? new THREE.Vector3(0, 1.4, -2.4)
      : new THREE.Vector3(0, 0.8, -0.4);
    salas[sala.id] = { sala, grupo: g, suelo, aro: aroAlto, cartel: c, hilo, pos: g.localToWorld(desde.clone()), obj: g.localToWorld(hacia.clone()) };
  }

  // Puentes de luz: del borde del núcleo al borde de cada plataforma
  {
    const nucleo = SALAS.find((x) => x.tipo === 'direccion');
    for (const sala of SALAS) {
      if (sala === nucleo) continue;
      const dir = new THREE.Vector3(sala.x - nucleo.x, 0, sala.z - nucleo.z).normalize();
      const a = new THREE.Vector3(nucleo.x, nucleo.altura, nucleo.z).addScaledVector(dir, nucleo.radio - 0.05);
      const b = new THREE.Vector3(sala.x, sala.altura, sala.z).addScaledVector(dir, -(sala.radio - 0.05));
      const largo = a.distanceTo(b);
      const puente = new THREE.Group();
      puente.position.copy(a).lerp(b, 0.5);
      puente.lookAt(b);
      const ancho = sala.tipo === 'cafe' ? 0.9 : 1.2;
      puente.add(caja(ancho, 0.06, largo, MAT.zocalo, 0, -0.03, 0));
      const borde = apuntar(new THREE.MeshBasicMaterial({ color: new THREE.Color(sala.color), toneMapped: false }));
      for (const lado of [-1, 1]) puente.add(caja(0.035, 0.035, largo, borde, lado * (ancho / 2 - 0.02), 0.01, 0, false));
      const centro = apuntar(new THREE.MeshBasicMaterial({ color: new THREE.Color(sala.color), transparent: true, opacity: 0.18, toneMapped: false }));
      for (let i = 0; i < Math.floor(largo / 0.7); i++) puente.add(caja(0.2, 0.012, 0.28, centro, 0, 0.012, -largo / 2 + 0.45 + i * 0.7, false));
      mundo.add(puente);
    }
  }

  // ---------- Cámara: vista general y entrada en salas ----------
  let vuelo = null;
  let salaActual = null;
  const facil = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  function volarA(pos, obj, alTerminar) {
    if (reducirMovimiento) {
      camara.position.copy(pos);
      controles.target.copy(obj);
      controles.update();
      alTerminar && alTerminar();
      return;
    }
    vuelo = { p0: camara.position.clone(), o0: controles.target.clone(), p1: pos.clone(), o1: obj.clone(), t0: performance.now(), dur: 1100, alTerminar };
    controles.enabled = false;
  }

  function mostrarInfo(sala) {
    const info = $('#of-info');
    if (!sala) { info.hidden = true; return; }
    info.style.setProperty('--c', sala.color);
    const boton = sala.modulo
      ? `<button class="boton" type="button" data-abrir="${sala.id}">Abrir ${escapar(sala.area)}</button>`
      : '';
    info.innerHTML = `
      <span class="nombre">${escapar(sala.nombre)}</span>
      <span class="puesto">${escapar(sala.puesto)}</span>
      <span class="tarea">${escapar(sala.tarea)}</span>
      <span class="chip">${escapar(sala.area)} · ${escapar(sala.situacion)}</span>
      ${boton}`;
    info.hidden = false;
  }
  $('#of-info').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-abrir]');
    if (b) alAbrirModulo(b.dataset.abrir);
  });

  // Dentro de una plataforma, las etiquetas se esconden para no tapar la vista.
  const mostrarCarteles = (dentro) => { for (const x of Object.values(salas)) { x.cartel.visible = !dentro; x.hilo.visible = !dentro; } };
  function entrar(id) {
    const s = salas[id];
    if (!s) return;
    salaActual = id;
    mostrarCarteles(id);
    controles.minDistance = 1.5;
    volarA(s.pos, s.obj, () => { controles.enabled = true; });
    $('#of-volver').hidden = false;
    $('#of-pista').hidden = true;
    mostrarInfo(s.sala);
    escena.dispatchEvent(new CustomEvent('sala', { detail: id }));
  }
  function verOficina() {
    salaActual = null;
    mostrarCarteles(null);
    volarA(vistaGeneral.pos, vistaGeneral.obj, () => { controles.enabled = true; controles.minDistance = 7; });
    $('#of-volver').hidden = true;
    $('#of-pista').hidden = false;
    mostrarInfo(null);
    escena.dispatchEvent(new CustomEvent('sala', { detail: null }));
  }
  $('#of-volver').addEventListener('click', verOficina);
  const alTecla = (e) => { if (e.key === 'Escape' && salaActual) verOficina(); };
  addEventListener('keydown', alTecla);

  // Un toque (no un arrastre): primero acerca; si ya estás dentro, abre el módulo.
  const rayo = new THREE.Raycaster();
  const puntero = new THREE.Vector2();
  let inicio = null;
  let resaltada = null;
  function salaBajo(ev) {
    const r = renderer.domElement.getBoundingClientRect();
    puntero.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    rayo.setFromCamera(puntero, camara);
    const hit = rayo.intersectObjects(objetivosClic, false)[0];
    return hit ? hit.object.userData.sala : null;
  }
  function resaltar(id) {
    if (resaltada === id) return;
    if (resaltada) { salas[resaltada].suelo.material.emissiveIntensity = 0.05; salas[resaltada].aro.scale.setScalar(1); }
    resaltada = id;
    if (id) { salas[id].suelo.material.emissiveIntensity = 0.2; salas[id].aro.scale.setScalar(1.012); }
    renderer.domElement.style.cursor = id ? 'pointer' : 'grab';
  }
  renderer.domElement.addEventListener('pointerdown', (ev) => { inicio = { x: ev.clientX, y: ev.clientY, t: performance.now() }; });
  renderer.domElement.addEventListener('pointerup', (ev) => {
    if (!inicio) return;
    const movido = Math.hypot(ev.clientX - inicio.x, ev.clientY - inicio.y);
    const rapido = performance.now() - inicio.t < 600;
    inicio = null;
    if (movido > 8 || !rapido || vuelo) return;
    const id = salaBajo(ev);
    if (!id) return;
    if (id !== salaActual) entrar(id);
    else if (salas[id].sala.modulo) alAbrirModulo(id);
  });
  renderer.domElement.addEventListener('pointermove', (ev) => {
    if (ev.pointerType !== 'mouse' || ev.buttons) return;
    const id = salaBajo(ev);
    resaltar(id && (id !== salaActual || salas[id].sala.modulo) ? id : null);
  });
  renderer.domElement.addEventListener('pointerleave', () => resaltar(null));

  // ---------- Tamaño y animación ----------
  function ajustar() {
    const r = escena.getBoundingClientRect();
    if (!r.width || !r.height) return;
    renderer.setSize(r.width, r.height, false);
    if (compositor) { compositor.setPixelRatio(renderer.getPixelRatio()); compositor.setSize(r.width, r.height); }
    camara.aspect = r.width / r.height;
    const vertical = r.width / r.height < 0.9;
    camara.fov = vertical ? 48 : r.width >= 900 ? 43 : 40;
    // En el ordenador el equipo flota a la derecha: la maqueta se centra en el hueco libre.
    const hueco = !vertical && r.width >= 900 ? 150 : 0;
    if (hueco) camara.setViewOffset(r.width, r.height, hueco, 0, r.width, r.height);
    else camara.clearViewOffset();
    camara.updateProjectionMatrix();
    const nueva = vertical ? VISTA_ALTA : VISTA_ANCHA;
    if (nueva !== vistaGeneral) {
      vistaGeneral = nueva;
      if (!salaActual && !vuelo) {
        camara.position.copy(vistaGeneral.pos);
        controles.target.copy(vistaGeneral.obj);
        controles.update();
      }
    }
  }
  const observador = new ResizeObserver(ajustar);
  observador.observe(escena);
  ajustar();

  let marco = 0;
  let ultimoPintado = 0;
  function animar(ahora) {
    marco = requestAnimationFrame(animar);
    const t = ahora / 1000;
    if (vuelo) {
      const k = Math.min(1, (ahora - vuelo.t0) / vuelo.dur), e = facil(k);
      camara.position.lerpVectors(vuelo.p0, vuelo.p1, e);
      controles.target.lerpVectors(vuelo.o0, vuelo.o1, e);
      if (k >= 1) { const fin = vuelo.alTerminar; vuelo = null; fin && fin(); }
    }
    if (!reducirMovimiento) {
      for (const p of personas) {
        const { cabeza, brazos, fase } = p.userData;
        brazos[0].rotation.x = -1.15 + Math.sin(t * 11 + fase) * 0.07;
        brazos[1].rotation.x = -1.15 + Math.sin(t * 11 + fase + 1.7) * 0.07;
        cabeza.rotation.x = 0.12 + Math.sin(t * 0.9 + fase) * 0.05;
        cabeza.rotation.y = Math.sin(t * 0.45 + fase) * 0.18;
      }
      for (const holo of giratorios) { holo.rotation.y = t * 0.25; holo.position.y = 5.0 + Math.sin(t * 0.8) * 0.08; }
      polvo.rotation.y = t * 0.012;
      polvo.position.y = Math.sin(t * 0.3) * 0.15;
      if (ahora - ultimoPintado > 450) {
        ultimoPintado = ahora;
        for (const p of pantallas) if (p.tipo !== 'datos') { p.t += 0.45; pintarPantalla(p); }
      }
    }
    controles.update();
    if (compositor) compositor.render();
    else renderer.render(mundo, camara);
  }

  // Cuando la fuente Geist está lista, se repintan carteles y pantallas.
  document.fonts?.ready.then(() => {
    if (!marco) return;
    for (const s of Object.values(salas)) {
      const nuevo = cartel(s.sala);
      nuevo.position.copy(s.cartel.position);
      nuevo.userData.sala = s.sala.id;
      nuevo.visible = s.cartel.visible;
      s.grupo.remove(s.cartel);
      objetivosClic.splice(objetivosClic.indexOf(s.cartel), 1, nuevo);
      s.grupo.add(nuevo);
      s.cartel = nuevo;
    }
    pantallas.forEach(pintarPantalla);
  });

  $('#of-estado').remove();
  marco = requestAnimationFrame(animar);

  return {
    entrar,
    verOficina,
    /** Cambia los datos clave de la pantalla de tu despacho (llegan después de montar). */
    actualizarDatos(nuevos) {
      Object.assign(datos, nuevos);
      for (const p of pantallas) if (p.tipo === 'datos' || (nuevos.accion && p.tipo === 'accion') || (nuevos.cerebro && p.tipo === 'cerebro')) pintarPantalla(p);
      if (nuevos.accion) {
        const nivel = nuevos.accion.nivel?.nivel || 1;
        ponerNivel(nivel);
        const sala = SALAS.find((x) => x.id === 'accion');
        if (sala) {
          const siguiente = DECORACION_ACCION.find((x) => x.nivel > nivel);
          sala.tarea = `${sala.tareaBase || (sala.tareaBase = sala.tarea)} Despacho de nivel ${nivel}${siguiente ? `: a nivel ${siguiente.nivel} llega ${siguiente.nombre}.` : ': completo.'}`;
          if (salaActual === 'accion') mostrarInfo(sala);
        }
      }
    },
    destruir() {
      cancelAnimationFrame(marco);
      marco = 0;
      observador.disconnect();
      removeEventListener('keydown', alTecla);
      controles.dispose();
      brillo?.dispose();
      compositor?.dispose?.();
      for (const r of recursos) r.dispose?.();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}
