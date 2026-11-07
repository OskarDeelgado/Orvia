// Oficina 3D: el Panel de Orvia en el ordenador (y, a petición, en el móvil).
// Cada módulo es un despacho con su agente. Un toque acerca la cámara;
// un segundo toque (o el botón de la ficha) abre el módulo.
// La librería 3D se carga solo cuando se muestra la oficina.
// Al salir, destruir() libera la tarjeta gráfica y para la animación.

import { escapar } from './ui/componentes.js';

// Distribución fija para tres módulos (abajo), tu despacho y el café (arriba).
// Si se añade un cuarto módulo, hay que ampliar esta distribución.
const HUECOS_MODULOS = [
  { x: -8, z: 4.75 },
  { x: 0, z: 4.75 },
  { x: 8, z: 4.75 },
];

export async function montarOficina(escena, { modulos, nombreUsuario, datos, alAbrirModulo }) {
  const THREE = await import('../vendor/three/three.module.min.js');
  const { OrbitControls } = await import('../vendor/three/OrbitControls.js');

  const reducirMovimiento = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const esMovil = matchMedia('(pointer: coarse)').matches;

  const SALAS = [
    { id: 'direccion', nombre: nombreUsuario || 'Tu despacho', puesto: 'Director general', area: 'Dirección', situacion: 'Tu despacho',
      tarea: 'Desde aquí ves cómo va todo: en la pantalla de la pared, los datos clave de cada área.',
      color: '#8ab4ff', x: -5, z: -4.75, w: 14, d: 6.5, lado: 'arriba', tipo: 'direccion' },
    ...modulos.slice(0, 3).map((m, i) => ({
      id: m.id, nombre: m.agente.nombre, puesto: m.agente.puesto, area: m.nombre, situacion: m.agente.situacion,
      tarea: m.agente.tarea, color: m.agente.color, ...HUECOS_MODULOS[i], w: 8, d: 6.5, lado: 'abajo', tipo: 'agente', modulo: m,
    })),
    { id: 'cafe', nombre: 'Zona de café', puesto: 'Espacio común', area: 'Común', situacion: 'Abierta',
      tarea: 'Un rincón para desconectar entre tarea y tarea.',
      color: '#e0a96d', x: 7, z: -4.75, w: 10, d: 6.5, lado: 'arriba', tipo: 'cafe' },
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
  renderer.toneMappingExposure = 1.05;
  renderer.domElement.className = 'oficina-lienzo';
  renderer.domElement.setAttribute('role', 'img');
  renderer.domElement.setAttribute('aria-label', 'Oficina en 3D. Usa las fichas del equipo para entrar en cada despacho.');
  escena.prepend(renderer.domElement);

  const mundo = new THREE.Scene();
  mundo.background = new THREE.Color('#0b0c0f');
  mundo.fog = new THREE.Fog('#0b0c0f', 38, 75);

  const camara = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
  const VISTA_ANCHA = { pos: new THREE.Vector3(0, 24, 19), obj: new THREE.Vector3(0, 0, 0.5) };
  const VISTA_ALTA = { pos: new THREE.Vector3(19, 30, 0.5), obj: new THREE.Vector3(0, 0, 0.5) };
  let vistaGeneral = VISTA_ANCHA;
  camara.position.copy(vistaGeneral.pos);

  const controles = new OrbitControls(camara, renderer.domElement);
  controles.target.copy(vistaGeneral.obj);
  controles.enableDamping = true;
  controles.dampingFactor = 0.08;
  controles.minDistance = 7;
  controles.maxDistance = 42;
  controles.minPolarAngle = 0.12;
  controles.maxPolarAngle = 1.22;
  controles.enablePan = !esMovil;
  controles.rotateSpeed = esMovil ? 0.7 : 0.9;
  controles.update();

  mundo.add(new THREE.HemisphereLight('#9db8ff', '#0e0f12', 0.9));
  const sol = new THREE.DirectionalLight('#fff4e6', 2.4);
  sol.position.set(-12, 22, 10);
  sol.castShadow = true;
  sol.shadow.mapSize.set(esMovil ? 1024 : 2048, esMovil ? 1024 : 2048);
  Object.assign(sol.shadow.camera, { left: -16, right: 16, top: 12, bottom: -12, near: 1, far: 60 });
  sol.shadow.bias = -0.0005;
  mundo.add(sol);

  // Todo lo creado se apunta aquí para liberarlo al salir.
  const recursos = new Set();
  const apuntar = (r) => (recursos.add(r), r);

  const mat = (color, extra = {}) => apuntar(new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.05, ...extra }));
  const MAT = {
    base: mat('#111318', { roughness: 0.9 }),
    pasillo: mat('#14171d', { roughness: 0.85 }),
    mueble: mat('#2b2f38', { roughness: 0.55 }),
    muebleClaro: mat('#3a3f4a', { roughness: 0.5 }),
    pata: mat('#1b1e24', { metalness: 0.5, roughness: 0.4 }),
    silla: mat('#22252d', { roughness: 0.6 }),
    piel: mat('#d9b08c', { roughness: 0.65 }),
    pelo: mat('#2a1f1a', { roughness: 0.8 }),
    pantalon: mat('#1e2230'),
    maceta: mat('#2f333c', { roughness: 0.6 }),
    hoja: mat('#3f8f5e', { roughness: 0.8, flatShading: true }),
    marcoMonitor: mat('#15171c', { roughness: 0.4, metalness: 0.3 }),
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

  mundo.add(caja(28.5, 0.5, 20.5, MAT.base, 0, -0.25, 0, false));
  const borde = new THREE.LineSegments(
    geo(new THREE.EdgesGeometry(geo(new THREE.BoxGeometry(28.5, 0.5, 20.5)))),
    apuntar(new THREE.LineBasicMaterial({ color: '#8ab4ff', transparent: true, opacity: 0.35 })),
  );
  borde.position.y = -0.25;
  mundo.add(borde);
  mundo.add(caja(26, 0.03, 3, MAT.pasillo, 0, 0.015, 0, false));
  mundo.add(caja(24, 0.01, 0.06, apuntar(new THREE.MeshBasicMaterial({ color: '#8ab4ff', transparent: true, opacity: 0.5 })), 0, 0.04, 0, false));

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

  function cartel(sala) {
    const c = lienzo(640, 200), ctx = c.getContext('2d');
    redondeado(ctx, 6, 6, 628, 188, 36);
    ctx.fillStyle = 'rgba(14,15,18,0.88)';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = sala.color;
    ctx.stroke();
    ctx.fillStyle = sala.color;
    ctx.beginPath(); ctx.arc(62, 100, 18, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f2f4f7';
    ctx.font = '800 64px Manrope, system-ui, sans-serif';
    ctx.fillText(sala.nombre, 104, 96);
    ctx.fillStyle = '#b5bcc8';
    ctx.font = '600 40px Manrope, system-ui, sans-serif';
    ctx.fillText(sala.tipo === 'cafe' ? sala.puesto : `${sala.puesto} · ${sala.area}`, 104, 150);
    const sprite = new THREE.Sprite(apuntar(new THREE.SpriteMaterial({ map: texturaDe(c), transparent: true, depthTest: false })));
    const k = esMovil ? 1.3 : 1;
    sprite.scale.set(3.6 * k, 1.125 * k, 1);
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
    ctx.fillStyle = '#0b1020';
    ctx.fillRect(0, 0, W, H);
    if (tipo === 'datos') {
      // Pantalla de tu despacho: los datos clave de Orvia.
      ctx.fillStyle = '#f2f4f7';
      ctx.font = '800 34px Manrope, system-ui, sans-serif';
      ctx.fillText('Orvia · hoy', 40, 62);
      const filas = [
        [datos.etiquetaQueda || 'Te quedan este mes', datos.queda, '#818cf8'],
        ['Patrimonio', datos.patrimonio, '#8ab4ff'],
        ['Tareas de hoy', datos.tareas, '#4ade80'],
      ];
      filas.forEach(([etiqueta, valor, c2], i) => {
        const y = 100 + i * 106;
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        redondeado(ctx, 40, y, W - 80, 88, 16); ctx.fill();
        ctx.fillStyle = c2;
        ctx.fillRect(40, y + 18, 6, 52);
        ctx.fillStyle = '#9aa1ad';
        ctx.font = '600 24px Manrope, system-ui, sans-serif';
        ctx.fillText(etiqueta, 66, y + 36);
        ctx.fillStyle = '#f2f4f7';
        ctx.font = '300 36px Manrope, system-ui, sans-serif';
        ctx.fillText(valor, 66, y + 74);
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

  // ---------- Salas ----------
  const objetivosClic = [];
  const personas = [];
  const salas = {};

  for (const sala of SALAS) {
    const g = new THREE.Group();
    g.position.set(sala.x, 0, sala.z);
    g.rotation.y = sala.lado === 'abajo' ? Math.PI : 0; // la puerta queda en +z local
    mundo.add(g);
    const { w, d } = sala;
    const color = new THREE.Color(sala.color);

    const suelo = caja(w - 0.12, 0.04, d - 0.12,
      apuntar(new THREE.MeshStandardMaterial({ color: new THREE.Color('#15171c').lerp(color, 0.07), emissive: color, emissiveIntensity: 0.03, roughness: 0.8 })),
      0, 0.02, 0, false);
    suelo.userData.sala = sala.id;
    g.add(suelo);
    objetivosClic.push(suelo);

    const cristal = apuntar(new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.13, roughness: 0.1, metalness: 0.2, depthWrite: false, side: THREE.DoubleSide }));
    const canto = apuntar(new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 }));
    const ALTO = 1.25, PUERTA = 1.8, m = 0.06;
    const pared = (largo, x, z, rot) => {
      const p = new THREE.Group();
      p.add(caja(largo, ALTO, 0.05, cristal, 0, ALTO / 2, 0, false));
      p.add(caja(largo, 0.035, 0.07, canto, 0, ALTO, 0, false));
      p.add(caja(largo, 0.06, 0.08, MAT.pata, 0, 0.03, 0, false));
      p.position.set(x, 0, z);
      p.rotation.y = rot;
      g.add(p);
    };
    pared(w - m * 2, 0, -d / 2 + m, 0);
    pared(d - m * 2, -w / 2 + m, 0, Math.PI / 2);
    pared(d - m * 2, w / 2 - m, 0, Math.PI / 2);
    const tramo = (w - PUERTA) / 2 - m;
    pared(tramo, -(PUERTA / 2 + tramo / 2), d / 2 - m, 0);
    pared(tramo, PUERTA / 2 + tramo / 2, d / 2 - m, 0);

    const luz = new THREE.PointLight(color, 9, 9, 1.6);
    luz.position.set(0, 2.6, -0.5);
    g.add(luz);

    if (sala.tipo === 'agente') {
      const tipoPantalla = ['finanzas', 'accion', 'cerebro'].includes(sala.id) ? sala.id : 'cerebro';
      const mz = -d / 2 + 0.9;
      const m1 = mesa(2, 0.85); m1.position.set(0, 0, mz); g.add(m1);
      const mon = monitor(pantalla(tipoPantalla, sala.color)); mon.position.set(0, 0, mz - 0.15); g.add(mon);
      g.add(caja(0.55, 0.02, 0.18, MAT.muebleClaro, 0, 0.79, mz + 0.2, false));
      const s1 = silla(); s1.position.set(0, 0, mz + 0.85); g.add(s1);
      const p = persona(sala.color); p.position.set(0, 0, mz + 0.8); g.add(p); personas.push(p);
      g.add(planta(w / 2 - 0.6, -d / 2 + 0.6));
      if (tipoPantalla === 'cerebro') {
        const e1 = estanteria(['#fbbf24', '#b45309', '#e5e7eb', '#78350f', '#f59e0b']);
        e1.position.set(-w / 2 + 0.35, 0, -0.2); e1.rotation.y = Math.PI / 2; g.add(e1);
        const e2 = estanteria(['#fbbf24', '#e5e7eb', '#92400e']);
        e2.position.set(w / 2 - 0.35, 0, 0.6); e2.rotation.y = -Math.PI / 2; g.add(e2);
      } else if (tipoPantalla === 'accion') {
        const pizarra = caja(2.4, 1.2, 0.05, mat('#e8eaee', { roughness: 0.4 }));
        pizarra.position.set(-w / 2 + 0.12, 1.35, 0.2); pizarra.rotation.y = Math.PI / 2; g.add(pizarra);
        ['#4ade80', '#fbbf24', '#86efac', '#f472b6', '#4ade80', '#a5b4fc'].forEach((c2, i) => {
          const n = caja(0.22, 0.22, 0.02, apuntar(new THREE.MeshBasicMaterial({ color: c2 })), 0, 0, 0, false);
          n.position.set(-w / 2 + 0.16, 1.6 - Math.floor(i / 3) * 0.4, -0.5 + (i % 3) * 0.6);
          n.rotation.y = Math.PI / 2;
          g.add(n);
        });
        g.add(planta(-w / 2 + 0.6, d / 2 - 0.8, 0.8));
      } else {
        const m2 = monitor(pantalla('finanzas', '#c084fc'), 0.7);
        m2.position.set(0.85, 0, mz - 0.1); m2.rotation.y = -0.45; g.add(m2);
        g.add(caja(0.6, 1, 0.6, MAT.muebleClaro, -w / 2 + 0.5, 0.5, -d / 2 + 0.5));
      }
    } else if (sala.tipo === 'direccion') {
      const mz = -d / 2 + 1.6;
      const m1 = mesa(3.2, 1.2); m1.position.set(0, 0, mz); g.add(m1);
      const s1 = silla(); s1.position.set(0, 0, mz - 0.95); s1.rotation.y = Math.PI; g.add(s1);
      // Pantalla grande en la pared del fondo con los datos clave
      const grande = new THREE.Mesh(geo(new THREE.PlaneGeometry(3.6, 2.025)), apuntar(new THREE.MeshBasicMaterial({ map: pantalla('datos', sala.color), toneMapped: false })));
      grande.position.set(0, 1.9, -d / 2 + 0.12);
      g.add(grande);
      const sofa = new THREE.Group();
      const tapiz = mat('#2c3550');
      sofa.add(caja(2.4, 0.42, 0.9, tapiz, 0, 0.21, 0));
      sofa.add(caja(2.4, 0.5, 0.22, tapiz, 0, 0.55, -0.34));
      sofa.position.set(-w / 2 + 2.2, 0, d / 2 - 1.3); sofa.rotation.y = Math.PI;
      g.add(sofa);
      g.add(caja(1.3, 0.35, 0.7, MAT.muebleClaro, -w / 2 + 2.2, 0.175, d / 2 - 2.5));
      g.add(planta(w / 2 - 0.7, -d / 2 + 0.7, 1.3));
      g.add(planta(-w / 2 + 0.7, -d / 2 + 0.7, 1.1));
      g.add(caja(4.2, 0.012, 2.6, mat('#1a2236', { roughness: 1 }), 0, 0.045, mz + 0.2, false));
      const e1 = estanteria(['#8ab4ff', '#e5e7eb', '#475569']);
      e1.position.set(w / 2 - 0.35, 0, 0.6); e1.rotation.y = -Math.PI / 2; g.add(e1);
    } else {
      g.add(caja(4.2, 0.95, 0.7, MAT.muebleClaro, -1, 0.475, -d / 2 + 0.55));
      g.add(caja(0.5, 0.55, 0.4, mat('#1b1e24', { metalness: 0.6, roughness: 0.3 }), -2.3, 1.22, -d / 2 + 0.55));
      const piloto = new THREE.Mesh(geo(new THREE.SphereGeometry(0.04, 8, 8)), apuntar(new THREE.MeshBasicMaterial({ color: '#fbbf24' })));
      piloto.position.set(-2.3, 1.3, -d / 2 + 0.76);
      g.add(piloto);
      for (let i = 0; i < 3; i++) g.add(caja(0.09, 0.11, 0.09, MAT.blanco, -1.4 + i * 0.25, 1.0, -d / 2 + 0.5, false));
      const tablero = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.75, 0.75, 0.05, 32)), MAT.mueble);
      tablero.position.set(1, 0.75, 0.4); tablero.castShadow = true; tablero.receiveShadow = true;
      g.add(tablero);
      g.add(caja(0.08, 0.72, 0.08, MAT.pata, 1, 0.36, 0.4));
      const asiento = mat(sala.color, { roughness: 0.6 });
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 + 0.4;
        const taburete = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.22, 0.22, 0.06, 20)), asiento);
        taburete.position.set(1 + Math.cos(a) * 1.1, 0.5, 0.4 + Math.sin(a) * 1.1);
        taburete.castShadow = true;
        g.add(taburete);
        g.add(caja(0.05, 0.48, 0.05, MAT.pata, taburete.position.x, 0.24, taburete.position.z, false));
      }
      const lampara = new THREE.Mesh(geo(new THREE.SphereGeometry(0.22, 20, 14)), apuntar(new THREE.MeshBasicMaterial({ color: '#ffe6c2' })));
      lampara.position.set(1, 2.6, 0.4);
      g.add(lampara);
      g.add(planta(w / 2 - 0.6, -d / 2 + 0.6, 1.2));
      g.add(planta(w / 2 - 0.6, d / 2 - 0.9, 0.9));
    }

    const c = cartel(sala);
    c.position.set(0, 2.35, d / 2 - 0.1);
    c.userData.sala = sala.id;
    g.add(c);
    objetivosClic.push(c);

    g.updateMatrixWorld(true);
    const desde = sala.tipo === 'agente' ? new THREE.Vector3(1.5, 2.5, -d / 2 + 3.4)
      : sala.tipo === 'direccion' ? new THREE.Vector3(0.8, 4.4, d / 2 + 1.0)
      : new THREE.Vector3(0.4, 4.6, d / 2 + 1.4);
    const hacia = sala.tipo === 'agente' ? new THREE.Vector3(0, 1.0, -d / 2 + 0.95)
      : sala.tipo === 'direccion' ? new THREE.Vector3(0, 1.1, -1.6)
      : new THREE.Vector3(0, 0.8, -0.9);
    salas[sala.id] = { sala, grupo: g, suelo, cartel: c, pos: g.localToWorld(desde.clone()), obj: g.localToWorld(hacia.clone()) };
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

  function entrar(id) {
    const s = salas[id];
    if (!s) return;
    salaActual = id;
    controles.minDistance = 1.5;
    volarA(s.pos, s.obj, () => { controles.enabled = true; });
    $('#of-volver').hidden = false;
    $('#of-pista').hidden = true;
    mostrarInfo(s.sala);
    escena.dispatchEvent(new CustomEvent('sala', { detail: id }));
  }
  function verOficina() {
    salaActual = null;
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
    if (resaltada) salas[resaltada].suelo.material.emissiveIntensity = 0.03;
    resaltada = id;
    if (id) salas[id].suelo.material.emissiveIntensity = 0.16;
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
    camara.aspect = r.width / r.height;
    const vertical = r.width / r.height < 0.9;
    camara.fov = vertical ? 48 : 40;
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
      if (ahora - ultimoPintado > 450) {
        ultimoPintado = ahora;
        for (const p of pantallas) if (p.tipo !== 'datos') { p.t += 0.45; pintarPantalla(p); }
      }
    }
    controles.update();
    renderer.render(mundo, camara);
  }

  // Cuando la fuente Manrope está lista, se repintan carteles y pantallas.
  document.fonts?.ready.then(() => {
    if (!marco) return;
    for (const s of Object.values(salas)) {
      const nuevo = cartel(s.sala);
      nuevo.position.copy(s.cartel.position);
      nuevo.userData.sala = s.sala.id;
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
      for (const p of pantallas) if (p.tipo === 'datos') pintarPantalla(p);
    },
    destruir() {
      cancelAnimationFrame(marco);
      marco = 0;
      observador.disconnect();
      removeEventListener('keydown', alTecla);
      controles.dispose();
      for (const r of recursos) r.dispose?.();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}
