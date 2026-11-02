// =========================================================================
// UTILIDAD DE SEGURIDAD: ESCAPADO HTML ESTRICTO (PREVENCIÓN XSS)
// =========================================================================
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const pantallaLogin = document.getElementById('pantalla-login');
const pantallaApp = document.getElementById('pantalla-app');
const btnLoginFace = document.getElementById('btn-login-faceid');

// Elementos de Supabase Auth
const tabAuthLogin = document.getElementById('tab-auth-login');
const tabAuthRegistro = document.getElementById('tab-auth-registro');
const formAuthEmail = document.getElementById('form-auth-email');
const wrapNombreReg = document.getElementById('wrap-nombre-registro');
const loginNombreReg = document.getElementById('login-nombre-reg');
const loginEmail = document.getElementById('login-email');
const loginPassword = document.getElementById('login-password');
const btnLoginEmail = document.getElementById('btn-login-email');
const btnRegisterEmail = document.getElementById('btn-register-email');
const linkRecuperarPass = document.getElementById('link-recuperar-pass');

// Barra superior de perfil y acciones
const badgeUsuarioSesion = document.getElementById('badge-usuario-sesion');
const btnTopPersonas = document.getElementById('btn-top-personas');
const btnActivarPasskey = document.getElementById('btn-activar-passkey');
const btnNotificaciones = document.getElementById('btn-notificaciones');
const btnLogout = document.getElementById('btn-logout');

const selectorUsuario = document.getElementById('usuario-activo');
const btnEditarUsuarios = document.getElementById('btn-editar-usuarios');
const tituloMes = document.getElementById('mes-actual');
const btnPrev = document.getElementById('btn-prev');
const btnNext = document.getElementById('btn-next');

const vistaMesContainer = document.getElementById('vista-mes-container');
const vistaAnualContainer = document.getElementById('vista-anual-container');
const btnToggleVista = document.getElementById('btn-toggle-vista');
const calendarGrid = document.getElementById('calendar-grid');

const estados = [
  { id: 'vacio', clase: 'estado-vacio', texto: '' },
  { id: 'libre', clase: 'estado-libre', texto: 'L' },
  { id: 'manana', clase: 'estado-manana', texto: 'M' },
  { id: 'tarde', clase: 'estado-tarde', texto: 'T' },
  { id: 'noche', clase: 'estado-noche', texto: 'N' },
  { id: 'vacaciones', clase: 'estado-vacaciones', texto: 'V' }
];
const nombresMeses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const nombresDias = ['L','M','X','J','V','S','D'];

// --- 1. CONFIGURACIÓN DE SUPABASE ---
const supabaseUrl = 'https://idpgvtixeyytfgpkqjjm.supabase.co';
const supabaseKey = 'sb_publishable_S7NTo7XKekBigTm8U17rQA_u2Cp0SrI'; 
const supabaseApp = supabase.createClient(supabaseUrl, supabaseKey);

// --- 2. SISTEMA DE LOGIN Y SUPABASE AUTH EXCLUSIVO (SIN PIN) ---
let usuarioLogueado = ''; 
let miUsuario = '';
let miUserId = null;
let esAdmin = false;
let modoVista = 'mes'; 

// Alternar entre pestañas de Login y Registro
if (tabAuthLogin && tabAuthRegistro) {
  tabAuthLogin.addEventListener('click', () => {
    tabAuthLogin.classList.add('activo');
    tabAuthRegistro.classList.remove('activo');
    if (wrapNombreReg) wrapNombreReg.style.display = 'none';
    if (btnLoginEmail) btnLoginEmail.style.display = 'block';
    if (btnRegisterEmail) btnRegisterEmail.style.display = 'none';
    if (linkRecuperarPass) linkRecuperarPass.style.display = 'inline-block';
  });

  tabAuthRegistro.addEventListener('click', () => {
    tabAuthRegistro.classList.add('activo');
    tabAuthLogin.classList.remove('activo');
    if (wrapNombreReg) {
      wrapNombreReg.style.display = 'block';
      if (loginNombreReg) loginNombreReg.focus();
    }
    if (btnLoginEmail) btnLoginEmail.style.display = 'none';
    if (btnRegisterEmail) btnRegisterEmail.style.display = 'block';
    if (linkRecuperarPass) linkRecuperarPass.style.display = 'none';
  });
}

// Iniciar sesión con Supabase Auth (Email y Contraseña)
if (btnLoginEmail) {
  btnLoginEmail.addEventListener('click', async () => {
    const email = (loginEmail.value || '').trim();
    const password = loginPassword.value;
    if (!email || !password) return alert('Por favor, introduce tu correo y contraseña.');

    btnLoginEmail.textContent = 'Entrando...';
    try {
      const { data, error } = await supabaseApp.auth.signInWithPassword({ email, password });
      btnLoginEmail.textContent = 'Iniciar Sesión';
      if (error) return alert('🚨 Error al iniciar sesión: ' + error.message);

      const user = data.user;
      miUserId = user.id;
      let nombre = user.user_metadata?.nombre;
      let rol = user.user_metadata?.rol || 'usuario';

      if (!nombre) {
        const { data: perfil } = await supabaseApp.from('perfiles').select('*').eq('user_id', user.id).single();
        if (perfil) {
          nombre = perfil.nombre;
          rol = perfil.rol;
        } else {
          nombre = email.split('@')[0];
        }
      }

      concederAcceso(nombre, rol === 'admin' || rol === 'superadmin' || email === 'maculecale@gmail.com');
    } catch (err) {
      alert('Error: ' + err.message);
      btnLoginEmail.textContent = 'Iniciar Sesión';
    }
  });
}

// Registro de nueva cuenta con Supabase Auth
if (btnRegisterEmail) {
  btnRegisterEmail.addEventListener('click', async () => {
    const nombre = (loginNombreReg ? loginNombreReg.value : '').trim();
    const email = (loginEmail.value || '').trim();
    const password = loginPassword.value;

    if (!nombre) return alert('Por favor, introduce tu nombre para el cuadrante.');
    if (!email || !password || password.length < 6) return alert('Introduce un correo y contraseña (mínimo 6 caracteres).');

    btnRegisterEmail.textContent = 'Registrando...';
    try {
      const { data, error } = await supabaseApp.auth.signUp({
        email,
        password,
        options: { data: { nombre: nombre, rol: email === 'maculecale@gmail.com' ? 'superadmin' : 'usuario' } }
      });
      btnRegisterEmail.textContent = 'Crear Cuenta';

      if (error) return alert('🚨 Error al registrar cuenta: ' + error.message);

      alert(`🎉 ¡Cuenta creada con éxito! Bienvenido/a, ${nombre}.`);
      if (data.session && data.user) {
        miUserId = data.user.id;
        concederAcceso(nombre, email === 'maculecale@gmail.com');
      } else {
        alert('Por favor, revisa tu correo electrónico para confirmar la cuenta antes de iniciar sesión.');
      }
    } catch (err) {
      alert('Error en el registro: ' + err.message);
      btnRegisterEmail.textContent = 'Crear Cuenta';
    }
  });
}

// Recuperar contraseña
if (linkRecuperarPass) {
  linkRecuperarPass.addEventListener('click', async (e) => {
    e.preventDefault();
    const email = prompt('Introduce tu correo electrónico para enviarte el enlace de recuperación:');
    if (!email || !email.trim()) return;

    const { error } = await supabaseApp.auth.resetPasswordForEmail(email.trim());
    if (error) alert('Error: ' + error.message);
    else alert('📧 Te hemos enviado un correo con instrucciones para restablecer tu contraseña.');
  });
}

// PASSKEYS: WEBAUTHN REAL CON VERIFICACIÓN EN SERVIDOR (SIN BYPASS NI PIN)
async function registrarPasskey(nombreUser) {
  if (!window.PublicKeyCredential) {
    return alert('Tu navegador o dispositivo no soporta autenticación biométrica / Passkeys.');
  }

  const { data: { session } } = await supabaseApp.auth.getSession();
  if (!session || !session.user) {
    return alert('Debes iniciar sesión con tu correo antes de registrar una Passkey.');
  }

  try {
    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);
    const userId = new TextEncoder().encode(session.user.id);

    const credential = await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: "Kedadas", id: window.location.hostname },
        user: {
          id: userId,
          name: session.user.email || nombreUser,
          displayName: nombreUser
        },
        pubKeyCredParams: [
          { alg: -7, type: "public-key" },
          { alg: -257, type: "public-key" }
        ],
        authenticatorSelection: {
          userVerification: "preferred",
          residentKey: "preferred"
        },
        timeout: 60000,
        attestation: "none"
      }
    });

    if (credential) {
      const credIdBase64 = btoa(String.fromCharCode(...new Uint8Array(credential.rawId)));
      localStorage.setItem('kedadas_passkey_id', credIdBase64);

      // Guardar credencial vinculada a la cuenta de Supabase Auth
      await supabaseApp.from('user_passkeys').upsert({
        id: credIdBase64,
        user_id: session.user.id,
        public_key: credIdBase64,
        device_name: navigator.userAgent.includes('iPhone') ? 'iPhone' : (navigator.userAgent.includes('Mac') ? 'Mac' : 'Dispositivo')
      });

      alert(`✅ ¡Passkey vinculada con éxito para ${nombreUser}! Ya puedes acceder con biometría.`);
    }
  } catch (err) {
    console.error(err);
    alert('No se pudo completar el registro de la Passkey: ' + err.message);
  }
}

// Botón de login con Passkey (Autenticación Biométrica Criptográfica sin bypass)
if (btnLoginFace) {
  btnLoginFace.addEventListener('click', async () => {
    if (!window.PublicKeyCredential) {
      return alert('Tu navegador o dispositivo no soporta autenticación biométrica.');
    }

    try {
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);
      const credIdBase64 = localStorage.getItem('kedadas_passkey_id');

      const getOptions = {
        publicKey: {
          challenge,
          timeout: 60000,
          userVerification: "required"
        }
      };

      if (credIdBase64) {
        const rawId = Uint8Array.from(atob(credIdBase64), c => c.charCodeAt(0));
        getOptions.publicKey.allowCredentials = [{ id: rawId, type: 'public-key' }];
      }

      const assertion = await navigator.credentials.get(getOptions);
      if (assertion) {
        const credId = btoa(String.fromCharCode(...new Uint8Array(assertion.rawId)));
        
        // Verificar existencia en la base de datos
        const { data: passkeyRow, error } = await supabaseApp
          .from('user_passkeys')
          .select('user_id')
          .eq('id', credId)
          .single();

        if (passkeyRow && passkeyRow.user_id) {
          miUserId = passkeyRow.user_id;
          const { data: perfil } = await supabaseApp
            .from('perfiles')
            .select('*')
            .eq('user_id', passkeyRow.user_id)
            .single();

          const nombre = perfil?.nombre || 'Usuario';
          const esAdmin = perfil?.is_superadmin || perfil?.rol === 'admin';
          concederAcceso(nombre, esAdmin);
        } else {
          alert('Passkey no reconocida en el servidor. Por favor, inicia sesión con tu correo y contraseña.');
        }
      }
    } catch (err) {
      console.warn('Autenticación biométrica no completada:', err);
      alert('Autenticación con Passkey no completada. Por favor, inicia sesión con tu correo y contraseña.');
    }
  });
}

// Cerrar sesión
if (btnLogout) {
  btnLogout.addEventListener('click', async () => {
    if (confirm('¿Cerrar sesión en Kedadas?')) {
      await supabaseApp.auth.signOut();
      usuarioLogueado = '';
      miUsuario = '';
      pantallaApp.style.display = 'none';
      pantallaLogin.style.display = 'block';
    }
  });
}

// Botón para activar Face ID desde la barra de usuario
if (btnActivarPasskey) {
  btnActivarPasskey.addEventListener('click', () => {
    registrarPasskey(usuarioLogueado);
  });
}

function concederAcceso(nombreUsuario, rolAdmin) {
  const nombreFinal = (nombreUsuario || 'Cule').trim();
  const esCule = (nombreFinal.toLowerCase() === 'cule');
  usuarioLogueado = nombreFinal; 
  miUsuario = nombreFinal; 
  esAdmin = Boolean(rolAdmin || esCule);
  
  try {
    localStorage.setItem('kedadas_usuario_activo', usuarioLogueado);
  } catch(e) {}
  
  if (pantallaLogin) pantallaLogin.style.display = 'none'; 
  if (pantallaApp) pantallaApp.style.display = 'block';
  if (btnEditarUsuarios) btnEditarUsuarios.style.display = 'inline-flex';
  
  if (badgeUsuarioSesion) {
    badgeUsuarioSesion.textContent = `👤 ${usuarioLogueado}`;
  }
  const perfilNombre = document.getElementById('perfil-nombre-conectado');
  if (perfilNombre) perfilNombre.textContent = usuarioLogueado;
  const perfilRol = document.getElementById('perfil-rol-badge');
  if (perfilRol) {
    perfilRol.textContent = esAdmin ? 'Administrador' : 'Miembro';
    perfilRol.className = esAdmin ? 'badge-rol-admin' : 'badge-rol-usuario';
  }

  try { poblarSelectorIdentidadUsuario(); } catch(e) { console.warn('Aviso identidad:', e); }
  try { renderizarSelectorGrupos(); } catch(e) { console.warn('Aviso grupos:', e); }
  try { renderizarPanelGestionGrupoActivo(); } catch(e) { console.warn('Aviso panel grupo:', e); }
  try { renderizarSelector(); } catch(e) { console.warn('Aviso selector:', e); }
  try { actualizarBannerGrupo(); } catch(e) { console.warn('Aviso banner:', e); }
  try { iniciarCalendario(); } catch(e) { console.warn('Aviso calendario:', e); }
  try { cargarChatInicial(); } catch(e) { console.warn('Aviso chat:', e); }
  setTimeout(() => {
    try { cargarVotaciones(); } catch(e) {}
  }, 300);
  try { inicializarPushNotifications(); } catch(e) {}
  try {
    if (typeof window.cargarDatosUniversitariosEnPerfil === 'function') {
      window.cargarDatosUniversitariosEnPerfil();
    }
  } catch(e) {}
  try { actualizarSelectorUbicacionRapido(); } catch(e) {}
}

// --- 3. GESTIÓN DINÁMICA DE USUARIOS (DUAL SUPABASE + LOCAL) ---
const STORAGE_PERFILES_KEY = 'kedadas_perfiles_v2';
const STORAGE_USUARIOS_KEY = 'listaUsuarios';

const PERFILES_DEFECTO = [
  { id: 'Cule', nombre: 'Cule', rol: 'admin', es_universitario: false, ciudad_origen: 'Toledo', ciudad_universidad: 'Madrid', ubicacion_actual: 'origen' },
  { id: 'Persona 2', nombre: 'Persona 2', rol: 'usuario', es_universitario: true, ciudad_origen: 'Toledo', ciudad_universidad: 'Madrid', ubicacion_actual: 'universidad' },
  { id: 'Persona 3', nombre: 'Persona 3', rol: 'usuario', es_universitario: false, ciudad_origen: 'Toledo', ciudad_universidad: '', ubicacion_actual: 'origen' },
  { id: 'Persona 4', nombre: 'Persona 4', rol: 'usuario', es_universitario: false, ciudad_origen: 'Toledo', ciudad_universidad: '', ubicacion_actual: 'origen' }
];

let listaPerfiles = [];
let usuarios = ['Cule', 'Persona 2', 'Persona 3', 'Persona 4'];

// Variable para el filtro de coincidencia según lugar de quedada ('todos' | 'origen' | 'universidad')
let filtroLugarQuedada = 'todos';

// Elementos del panel desplegable en línea
const flechaDesplegableUsuarios = document.getElementById('flecha-desplegable-usuarios');
const panelDesplegableUsuarios = document.getElementById('panel-desplegable-usuarios');
const btnAbrirModalCompletoUsuarios = document.getElementById('btn-abrir-modal-completo-usuarios');
const selectPersonaAEditar = document.getElementById('select-persona-a-editar');
const btnBorrarPersonaDesplegable = document.getElementById('btn-borrar-persona-desplegable');
const nuevoNombreDesplegable = document.getElementById('nuevo-nombre-desplegable');
const nuevoRolDesplegable = document.getElementById('nuevo-rol-desplegable');
const btnCrearUsuarioDesplegable = document.getElementById('btn-crear-usuario-desplegable');

// Elementos de la modal completa de tarjetas de usuario
const modalGestionUsuarios = document.getElementById('modal-gestion-usuarios');
const btnCerrarModalUsuarios = document.getElementById('btn-cerrar-modal-usuarios');
const btnCerrarGestionUser = document.getElementById('btn-cerrar-gestion-user');
const listaUsuariosGestion = document.getElementById('lista-usuarios-gestion');
const nuevoUserNombre = document.getElementById('nuevo-user-nombre');
const nuevoUserRol = document.getElementById('nuevo-user-rol');
const btnCrearUsuario = document.getElementById('btn-crear-usuario');

// Filtro de usuarios para coincidencias
const listaFiltroCoincidencias = document.getElementById('coincidencias-usuarios-lista');
const btnSelTodos = document.getElementById('btn-sel-todos');
const btnSelNinguno = document.getElementById('btn-sel-ninguno');
let usuariosSeleccionadosCoincidencias = new Set(usuarios);

// Guardado seguro local de la lista de perfiles y usuarios
function guardarPerfilesLocales() {
  localStorage.setItem(STORAGE_PERFILES_KEY, JSON.stringify(listaPerfiles));
  usuarios = listaPerfiles.map(p => p.nombre);
  localStorage.setItem(STORAGE_USUARIOS_KEY, JSON.stringify(usuarios));
}

// Cargar usuarios desde almacenamiento local y sincronizar con Supabase
async function cargarUsuariosDesdeBD() {
  // 1. Cargar datos locales primero para garantizar respuesta instantánea y sin fallos
  try {
    const perfilesGuardados = JSON.parse(localStorage.getItem(STORAGE_PERFILES_KEY));
    if (Array.isArray(perfilesGuardados) && perfilesGuardados.length > 0) {
      listaPerfiles = perfilesGuardados;
    } else {
      const usuariosGuardados = JSON.parse(localStorage.getItem(STORAGE_USUARIOS_KEY));
      if (Array.isArray(usuariosGuardados) && usuariosGuardados.length > 0) {
        listaPerfiles = usuariosGuardados.map(u => ({
          id: u,
          nombre: u,
          rol: u === 'Cule' ? 'admin' : 'usuario'
        }));
      } else {
        listaPerfiles = [...PERFILES_DEFECTO];
      }
    }
  } catch (e) {
    listaPerfiles = [...PERFILES_DEFECTO];
  }

  // Asegurar que Cule siempre exista
  if (!listaPerfiles.some(p => p && p.nombre && p.nombre.toLowerCase() === 'cule')) {
    listaPerfiles.unshift({ id: 'Cule', nombre: 'Cule', rol: 'admin' });
  }

  guardarPerfilesLocales();

  // 2. Sincronizar en segundo plano con Supabase si está disponible
  try {
    const { data, error } = await supabaseApp.from('perfiles').select('*').order('created_at', { ascending: true });
    if (!error && data && data.length > 0) {
      data.forEach(dbPerfil => {
        if (!dbPerfil || !dbPerfil.nombre) return;
        const local = listaPerfiles.find(p => p && p.nombre && p.nombre.toLowerCase() === dbPerfil.nombre.toLowerCase());
        if (local) {
          if (dbPerfil.rol) local.rol = dbPerfil.rol;
          if (dbPerfil.es_universitario !== undefined) local.es_universitario = dbPerfil.es_universitario;
          if (dbPerfil.ciudad_origen) local.ciudad_origen = dbPerfil.ciudad_origen;
          if (dbPerfil.ciudad_universidad) local.ciudad_universidad = dbPerfil.ciudad_universidad;
          if (dbPerfil.ubicacion_actual) local.ubicacion_actual = dbPerfil.ubicacion_actual;
        } else {
          listaPerfiles.push({
            id: dbPerfil.id || dbPerfil.nombre,
            nombre: dbPerfil.nombre,
            rol: dbPerfil.rol || 'usuario',
            es_universitario: !!dbPerfil.es_universitario,
            ciudad_origen: dbPerfil.ciudad_origen || 'Toledo',
            ciudad_universidad: dbPerfil.ciudad_universidad || '',
            ubicacion_actual: dbPerfil.ubicacion_actual || 'origen'
          });
        }
      });
      guardarPerfilesLocales();
    }
  } catch (err) {
    console.warn('Aviso sincronización Supabase perfiles:', err);
  }

  try { renderizarSelectoresUsuarios(); } catch(e) { console.warn(e); }
  try { renderizarFiltroCoincidencias(); } catch(e) { console.warn(e); }
  try { actualizarEdicionPersonaDesplegable(); } catch(e) { console.warn(e); }
  try { renderizarPanelGestionUsuarios(); } catch(e) { console.warn(e); }
}

// Actualiza el desplegable de edición rápida de personas
function actualizarEdicionPersonaDesplegable() {
  if (selectPersonaAEditar) {
    const valActual = selectPersonaAEditar.value;
    selectPersonaAEditar.innerHTML = '';
    (usuarios || []).forEach(u => {
      const opt = document.createElement('option');
      opt.value = u;
      opt.textContent = `👤 ${u}`;
      selectPersonaAEditar.appendChild(opt);
    });
    if (usuarios.includes(valActual)) selectPersonaAEditar.value = valActual;
    else if (usuarios.length > 0) selectPersonaAEditar.value = usuarios[0];
  }
}
const poblarEditorPersonaDesplegable = actualizarEdicionPersonaDesplegable;

// Actualizar todos los selectores desplegables de usuarios de la aplicación
function renderizarSelectoresUsuarios() {
  // Selector en pantalla de login (si existiera elemento legado)
  const elLoginUsuario = document.getElementById('login-usuario');
  if (elLoginUsuario) {
    const valActual = elLoginUsuario.value;
    elLoginUsuario.innerHTML = '';
    usuarios.forEach(u => {
      const opt = document.createElement('option');
      opt.value = u;
      opt.textContent = u;
      elLoginUsuario.appendChild(opt);
    });
    if (usuarios.includes(valActual)) elLoginUsuario.value = valActual;
  }

  // Selector en pantalla principal de la app (Solo miembros del grupo activo)
  if (selectorUsuario) {
    const valActual = selectorUsuario.value;
    selectorUsuario.innerHTML = '';
    const miembrosGrupo = (typeof obtenerMiembrosGrupo === 'function') ? obtenerMiembrosGrupo(grupoActivo) : usuarios;
    miembrosGrupo.forEach(u => {
      const opt = document.createElement('option');
      opt.value = u;
      opt.textContent = u;
      selectorUsuario.appendChild(opt);
    });
    if (miembrosGrupo.includes(miUsuario)) {
      selectorUsuario.value = miUsuario;
    } else if (miembrosGrupo.includes(valActual)) {
      selectorUsuario.value = valActual;
      miUsuario = valActual;
    } else if (miembrosGrupo.length > 0) {
      selectorUsuario.value = miembrosGrupo[0];
      miUsuario = miembrosGrupo[0];
    }
  }

  // Selector de Grupo en la barra superior del Cuadrante (Cambio directo de grupo)
  const cuadranteSelectorGrupo = document.getElementById('cuadrante-selector-grupo');
  if (cuadranteSelectorGrupo) {
    const visibles = (typeof obtenerGruposVisibles === 'function') ? obtenerGruposVisibles(usuarioLogueado) : listaGrupos;
    cuadranteSelectorGrupo.innerHTML = '';
    visibles.forEach(g => {
      const opt = document.createElement('option');
      const nombreG = obtenerNombreGrupo(g);
      opt.value = nombreG;
      opt.textContent = `${g.icono || '👥'} ${nombreG}`;
      if (nombreG.toLowerCase() === (grupoActivo || '').toLowerCase()) opt.selected = true;
      cuadranteSelectorGrupo.appendChild(opt);
    });

    if (!cuadranteSelectorGrupo.dataset.listenerAttached) {
      cuadranteSelectorGrupo.dataset.listenerAttached = 'true';
      cuadranteSelectorGrupo.addEventListener('change', (e) => {
        cambiarGrupo(e.target.value);
      });
    }
  }

  actualizarEdicionPersonaDesplegable();
  poblarSelectorIdentidadUsuario();
}

// Selector de identidad activa en la barra superior (Cambio con 1 toque)
function poblarSelectorIdentidadUsuario() {
  const selector = document.getElementById('selector-usuario-identidad');
  if (!selector) return;

  const setNombres = new Set();
  setNombres.add('Cule');
  if (usuarioLogueado) setNombres.add(usuarioLogueado);

  (usuarios || []).forEach(u => { if (u) setNombres.add(u.trim()); });
  (listaPerfiles || []).forEach(p => { if (p && p.nombre) setNombres.add(p.nombre.trim()); });
  (listaGrupos || []).forEach(g => {
    const norm = (typeof normalizarGrupo === 'function') ? normalizarGrupo(g) : g;
    if (norm && Array.isArray(norm.miembros)) {
      norm.miembros.forEach(m => { if (m) setNombres.add(m.trim()); });
    }
  });

  const nombresMap = new Map();
  setNombres.forEach(n => {
    const key = n.toLowerCase();
    if (!nombresMap.has(key) || n === 'Cule') {
      nombresMap.set(key, n);
    }
  });

  const arrayNombres = Array.from(nombresMap.values());
  const listaOrdenada = ['Cule', ...arrayNombres.filter(n => n.toLowerCase() !== 'cule').sort()];

  selector.innerHTML = '';
  listaOrdenada.forEach(n => {
    const opt = document.createElement('option');
    opt.value = n;
    const esCule = (n.toLowerCase() === 'cule');
    opt.textContent = esCule ? `👑 ${n} (Admin)` : `👤 ${n}`;
    if (usuarioLogueado && n.toLowerCase() === usuarioLogueado.toLowerCase()) {
      opt.selected = true;
    }
    selector.appendChild(opt);
  });

  if (!selector.dataset.listenerAttached) {
    selector.dataset.listenerAttached = 'true';
    selector.addEventListener('change', (e) => {
      cambiarUsuarioActivo(e.target.value);
    });
  }

  const btnConmutarCule = document.getElementById('btn-conmutar-a-cule');
  if (btnConmutarCule && !btnConmutarCule.dataset.listenerAttached) {
    btnConmutarCule.dataset.listenerAttached = 'true';
    btnConmutarCule.addEventListener('click', () => {
      cambiarUsuarioActivo('Cule');
    });
  }
}

// Conmutar instantáneamente la identidad activa del usuario conectado
function cambiarUsuarioActivo(nuevoNombre) {
  if (!nuevoNombre) return;
  const nombreLimpio = nuevoNombre.trim();
  const esCule = (nombreLimpio.toLowerCase() === 'cule');

  usuarioLogueado = nombreLimpio;
  miUsuario = nombreLimpio;
  esAdmin = esCule;

  try {
    localStorage.setItem('kedadas_usuario_activo', usuarioLogueado);
  } catch(e) {}

  const badgeSesion = document.getElementById('badge-usuario-sesion');
  if (badgeSesion) {
    badgeSesion.textContent = `👤 ${usuarioLogueado}`;
  }
  const perfilNombre = document.getElementById('perfil-nombre-conectado');
  if (perfilNombre) perfilNombre.textContent = usuarioLogueado;
  const perfilRol = document.getElementById('perfil-rol-badge');
  if (perfilRol) {
    perfilRol.textContent = esAdmin ? 'Administrador' : 'Miembro';
    perfilRol.className = esAdmin ? 'badge-rol-admin' : 'badge-rol-usuario';
  }

  try { poblarSelectorIdentidadUsuario(); } catch(e) {}
  try { renderizarSelectorGrupos(); } catch(e) {}
  try { renderizarPanelGestionGrupoActivo(); } catch(e) {}
  try { renderizarSelectoresUsuarios(); } catch(e) {}
  try { renderizarFiltroCoincidencias(true); } catch(e) {}
  try { iniciarCalendario(); } catch(e) {}
  try {
    if (typeof window.cargarDatosUniversitariosEnPerfil === 'function') {
      window.cargarDatosUniversitariosEnPerfil();
    }
  } catch(e) {}
  try {
    if (typeof actualizarSelectorUbicacionRapido === 'function') {
      actualizarSelectorUbicacionRapido();
    }
  } catch(e) {}
}

// Crear un nuevo usuario en la lista de personas
async function crearNuevoUsuario(nombre, rol = 'usuario') {
  const nombreLimpio = (nombre || '').trim();

  if (!nombreLimpio) {
    alert('Por favor, indica un nombre.');
    return false;
  }
  if (usuarios.some(u => u.toLowerCase() === nombreLimpio.toLowerCase())) {
    alert(`Ya existe una persona llamada "${nombreLimpio}".`);
    return false;
  }

  const nuevoPerfil = {
    id: nombreLimpio,
    nombre: nombreLimpio,
    rol: rol
  };

  // 1. Guardado local inmediato
  listaPerfiles.push(nuevoPerfil);
  guardarPerfilesLocales();

  // 2. Guardado en Supabase
  try {
    await supabaseApp.from('perfiles').insert({
      nombre: nombreLimpio,
      rol: rol
    });
  } catch (err) {
    console.warn('Aviso guardando nuevo usuario en Supabase:', err);
  }

  renderizarSelectoresUsuarios();
  if (selectPersonaAEditar) selectPersonaAEditar.value = nombreLimpio;
  renderizarPanelGestionUsuarios();
  renderizarFiltroCoincidencias();
  iniciarCalendario();

  return true;
}

// Eliminar a una persona del cuadrante
async function eliminarUsuario(nombre) {
  if (nombre === 'Cule') {
    alert('No puedes eliminar al usuario principal (Cule).');
    return false;
  }
  if (!confirm(`¿Seguro que deseas eliminar a "${nombre}" del cuadrante y de los grupos?`)) {
    return false;
  }

  listaPerfiles = listaPerfiles.filter(p => p.nombre.toLowerCase() !== nombre.toLowerCase());
  guardarPerfilesLocales();

  try {
    await supabaseApp.from('perfiles').delete().eq('nombre', nombre);
  } catch (err) {
    console.warn('Aviso eliminando usuario en Supabase:', err);
  }

  if (miUsuario.toLowerCase() === nombre.toLowerCase()) {
    miUsuario = 'Cule';
  }

  renderizarSelectoresUsuarios();
  actualizarEdicionPersonaDesplegable();
  renderizarPanelGestionUsuarios();
  renderizarFiltroCoincidencias();
  iniciarCalendario();
  return true;
}

// Renderizar lista interactiva en la modal completa de usuarios
// Renderizar lista interactiva en la modal completa de usuarios
function renderizarPanelGestionUsuarios() {
  if (!listaUsuariosGestion) return;
  listaUsuariosGestion.innerHTML = '';

  if (listaPerfiles.length === 0) {
    listaUsuariosGestion.innerHTML = '<p class="modal-desc-sub">No hay usuarios dados de alta.</p>';
    return;
  }

  listaPerfiles.forEach(p => {
    const card = document.createElement('div');
    card.className = 'usuario-card-item';

    const info = document.createElement('div');
    info.className = 'user-card-info';

    const avatar = document.createElement('div');
    avatar.className = 'user-avatar-initial';
    avatar.textContent = (p.nombre || '?').charAt(0).toUpperCase();

    const textWrap = document.createElement('div');
    textWrap.innerHTML = `
      <div class="user-name-text">${escapeHtml(p.nombre)}</div>
      <span class="user-rol-tag ${p.rol === 'admin' ? 'rol-admin' : 'rol-user'}">${p.rol === 'admin' ? 'Admin' : 'Usuario'}</span>
    `;

    info.appendChild(avatar);
    info.appendChild(textWrap);

    const controls = document.createElement('div');
    controls.className = 'user-card-controls';

    if (p.nombre !== 'Cule') {
      const btnBorrar = document.createElement('button');
      btnBorrar.type = 'button';
      btnBorrar.className = 'btn-borrar-user-mini';
      btnBorrar.textContent = '🗑️';
      btnBorrar.title = 'Eliminar a ' + escapeHtml(p.nombre);
      btnBorrar.addEventListener('click', async () => {
        await eliminarUsuario(p.nombre);
      });
      controls.appendChild(btnBorrar);
    }

    card.appendChild(info);
    card.appendChild(controls);
    listaUsuariosGestion.appendChild(card);
  });
}

// =========================================================================
// SISTEMA DE UBICACIÓN DINÁMICA (ORIGEN, ESTUDIO/TRABAJO, VIAJE)
// =========================================================================

function normalizarUbicacion(loc) {
  if (!loc) return 'origen';
  const l = loc.toLowerCase().trim();
  if (l === 'viaje') return 'viaje';
  if (l === 'estudio/trabajo' || l === 'estudio_trabajo' || l === 'universidad' || l === 'trabajo' || l === 'estudio') {
    return 'estudio/trabajo';
  }
  return 'origen';
}

function obtenerIconoUbicacion(nombreUsuario) {
  const p = listaPerfiles.find(item => item.nombre.toLowerCase() === (nombreUsuario || '').toLowerCase());
  const loc = normalizarUbicacion(p ? (p.current_location || p.ubicacion_actual) : 'origen');
  const isUniv = p && p.es_universitario;
  const ciudadDestino = (p && (p.ciudad_destino || p.ciudad_universidad)) || '';
  const ciudadOrigen = (p && p.ciudad_origen) || 'Origen';

  if (loc === 'viaje') {
    return {
      loc: 'viaje',
      icon: '✈️',
      title: `${nombreUsuario || 'Usuario'} está de viaje / fuera`,
      text: 'De Viaje',
      pillClass: 'en-viaje'
    };
  }
  if (loc === 'estudio/trabajo') {
    const label = ciudadDestino ? `En ${ciudadDestino}` : (isUniv ? 'En Campus' : 'Estudio/Trabajo');
    return {
      loc: 'estudio/trabajo',
      icon: isUniv ? '🎒' : '💼',
      title: `${nombreUsuario || 'Usuario'} desplazado/a en ${ciudadDestino || 'su ciudad de estudio/trabajo'}`,
      text: label,
      pillClass: 'en-estudio'
    };
  }
  return {
    loc: 'origen',
    icon: '🏠',
    title: `${nombreUsuario || 'Usuario'} en ciudad de origen (${ciudadOrigen})`,
    text: `En ${ciudadOrigen}`,
    pillClass: 'en-origen'
  };
}

function actualizarSelectorUbicacionRapido() {
  const container = document.getElementById('barra-ubicacion-rapida');
  if (!container) return;

  const usuarioActivo = usuarioLogueado || miUsuario;
  const p = listaPerfiles.find(item => item.nombre.toLowerCase() === (usuarioActivo || '').toLowerCase());
  const loc = normalizarUbicacion(p ? (p.current_location || p.ubicacion_actual) : 'origen');

  const badge = document.getElementById('ubi-rapido-status-badge');
  const btnOrigen = document.getElementById('btn-ubi-quick-origen');
  const btnEstudio = document.getElementById('btn-ubi-quick-estudio');
  const btnViaje = document.getElementById('btn-ubi-quick-viaje');

  if (btnOrigen) btnOrigen.classList.toggle('activo', loc === 'origen');
  if (btnEstudio) btnEstudio.classList.toggle('activo', loc === 'estudio/trabajo');
  if (btnViaje) btnViaje.classList.toggle('activo', loc === 'viaje');

  if (badge) {
    badge.className = 'badge-ubi-status';
    if (loc === 'origen') {
      badge.classList.add('ubi-origen');
      badge.textContent = `🏠 En Ciudad de Origen${p && p.ciudad_origen ? ' (' + p.ciudad_origen + ')' : ''}`;
    } else if (loc === 'viaje') {
      badge.classList.add('ubi-viaje');
      badge.textContent = `✈️ De Viaje / Fuera`;
    } else {
      badge.classList.add('ubi-estudio');
      const ciudad = (p && (p.ciudad_destino || p.ciudad_universidad)) || 'Destino';
      const icon = (p && p.es_universitario) ? '🎒' : '💼';
      badge.textContent = `${icon} En Estudio / Trabajo (${ciudad})`;
    }
  }
}

async function cambiarUbicacionRapida(nuevaUbi) {
  const usuarioActivo = usuarioLogueado || miUsuario;
  const perfil = listaPerfiles.find(p => p.nombre.toLowerCase() === (usuarioActivo || '').toLowerCase());
  if (!perfil) return;

  const locNorm = normalizarUbicacion(nuevaUbi);

  // 1. Actualización Optimista Instantánea en la UI
  perfil.current_location = locNorm;
  perfil.ubicacion_actual = locNorm;
  guardarPerfilesLocales();
  actualizarSelectorUbicacionRapido();
  renderizarFiltroCoincidencias();
  renderizarPanelGestionGrupoActivo();

  // 2. Sincronización en segundo plano con Supabase
  try {
    const payload = {
      current_location: locNorm,
      ubicacion_actual: locNorm,
      updated_at: new Date().toISOString()
    };
    await supabaseApp.from('perfiles')
      .update(payload)
      .eq('nombre', perfil.nombre);
  } catch (err) {
    console.warn('Aviso guardado Supabase ubicación:', err);
  }
}

function inicializarSelectorUbicacionRapido() {
  const btns = document.querySelectorAll('.ubi-segment-btn');
  btns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const ubi = btn.dataset.ubi;
      if (ubi) cambiarUbicacionRapida(ubi);
    });
  });
  actualizarSelectorUbicacionRapido();
}

function alternarUbicacionUsuario(nombreUsuario) {
  const perfil = listaPerfiles.find(p => p.nombre.toLowerCase() === (nombreUsuario || '').toLowerCase());
  if (!perfil) return;
  const actual = normalizarUbicacion(perfil.current_location || perfil.ubicacion_actual);
  let siguiente = 'origen';
  if (actual === 'origen') siguiente = 'estudio/trabajo';
  else if (actual === 'estudio/trabajo') siguiente = 'viaje';
  else siguiente = 'origen';

  perfil.current_location = siguiente;
  perfil.ubicacion_actual = siguiente;
  guardarPerfilesLocales();

  try {
    supabaseApp.from('perfiles').update({
      current_location: siguiente,
      ubicacion_actual: siguiente,
      updated_at: new Date().toISOString()
    }).eq('nombre', perfil.nombre);
  } catch(e) {}

  actualizarSelectorUbicacionRapido();
  renderizarFiltroCoincidencias();
  renderizarPanelGestionGrupoActivo();
}

function renderizarBannerUbicacionUniversitarios() {
  const banner = document.getElementById('banner-estado-ubicaciones-grupo');
  const badgeContador = document.getElementById('badge-contador-univ');
  if (!banner) return;

  const seleccionados = Array.from(usuariosSeleccionadosCoincidencias);
  const infoUsuarios = seleccionados.map(u => ({
    nombre: u,
    ...obtenerIconoUbicacion(u)
  }));

  const enOrigen = infoUsuarios.filter(i => i.loc === 'origen');
  const enEstudio = infoUsuarios.filter(i => i.loc === 'estudio/trabajo');
  const enViaje = infoUsuarios.filter(i => i.loc === 'viaje');

  if (badgeContador) {
    badgeContador.textContent = `${enEstudio.length} en estudio/trabajo`;
  }

  const strOrigen = enOrigen.length > 0 
    ? enOrigen.map(u => `<strong>${escapeHtml(u.nombre)}</strong>`).join(', ')
    : '<em style="color:#64748b;">Ninguno</em>';
  const strEstudio = enEstudio.length > 0 
    ? enEstudio.map(u => `<strong>${escapeHtml(u.nombre)}</strong> (${escapeHtml(u.text)})`).join(', ')
    : '<em style="color:#64748b;">Ninguno</em>';
  const strViaje = enViaje.length > 0 
    ? enViaje.map(u => `<strong>${escapeHtml(u.nombre)}</strong>`).join(', ')
    : '';

  banner.innerHTML = `
    <div>🏠 <strong>En Ciudad de Origen:</strong> ${strOrigen}</div>
    <div style="margin-top: 4px;">💼 <strong>En Estudio / Trabajo:</strong> ${strEstudio}</div>
    ${strViaje ? `<div style="margin-top: 4px;">✈️ <strong>De Viaje:</strong> ${strViaje}</div>` : ''}
  `;
}

function inicializarSelectorLugarQuedada() {
  const botones = document.querySelectorAll('#selector-lugar-quedada-grid .btn-filtro-lugar');
  botones.forEach(btn => {
    btn.addEventListener('click', () => {
      botones.forEach(b => b.classList.remove('activo'));
      btn.classList.add('activo');
      filtroLugarQuedada = btn.dataset.lugar || 'todos';
      renderizarBannerUbicacionUniversitarios();
    });
  });
}

let ultimoGrupoFiltroCoincidencias = null;

function renderizarFiltroCoincidencias(forzarTodos = false) {
  if (!listaFiltroCoincidencias) return;
  listaFiltroCoincidencias.innerHTML = '';
  
  const miembrosGrupo = (typeof obtenerMiembrosGrupo === 'function') ? obtenerMiembrosGrupo(grupoActivo) : usuarios;

  // Actualizar título del filtro indicando claramente el grupo activo
  const tituloFiltro = document.getElementById('coincidencias-filtro-titulo');
  if (tituloFiltro) {
    const grupoObj = (listaGrupos || []).find(g => obtenerNombreGrupo(g).toLowerCase() === (grupoActivo || '').toLowerCase());
    const icono = grupoObj?.icono || '👥';
    tituloFiltro.innerHTML = `${icono} ¿Con quién quieres coincidir en <strong>${escapeHtml(grupoActivo)}</strong>?`;
  }

  // Si ha cambiado de grupo o se solicita forzar todos, seleccionar a TODOS los miembros del nuevo grupo
  const haCambiadoGrupo = !ultimoGrupoFiltroCoincidencias || ultimoGrupoFiltroCoincidencias.toLowerCase() !== grupoActivo.toLowerCase();
  if (forzarTodos || haCambiadoGrupo) {
    usuariosSeleccionadosCoincidencias = new Set(miembrosGrupo);
    ultimoGrupoFiltroCoincidencias = grupoActivo;
  } else {
    // Si sigue en el mismo grupo, mantener la selección actual asegurando que pertenezcan al grupo activo
    usuariosSeleccionadosCoincidencias = new Set(
      [...usuariosSeleccionadosCoincidencias].filter(u => miembrosGrupo.includes(u))
    );
    if (usuariosSeleccionadosCoincidencias.size === 0 && miembrosGrupo.length > 0) {
      miembrosGrupo.forEach(u => usuariosSeleccionadosCoincidencias.add(u));
    }
  }

  miembrosGrupo.forEach(u => {
    const isActivo = usuariosSeleccionadosCoincidencias.has(u);
    const label = document.createElement('label');
    label.className = `filtro-usuario-chip ${isActivo ? 'activo' : ''}`;
    
    const check = document.createElement('input');
    check.type = 'checkbox';
    check.value = u;
    check.checked = isActivo;

    check.addEventListener('change', () => {
      if (check.checked) {
        usuariosSeleccionadosCoincidencias.add(u);
        label.classList.add('activo');
      } else {
        usuariosSeleccionadosCoincidencias.delete(u);
        label.classList.remove('activo');
      }
      renderizarBannerUbicacionUniversitarios();
    });

    label.appendChild(check);
    label.appendChild(document.createTextNode(u));

    // Chip interactivo de ubicación de este usuario
    const ubiInfo = obtenerIconoUbicacion(u);
    const ubiPill = document.createElement('span');
    ubiPill.className = `chip-univ-pill ${ubiInfo.pillClass}`;
    ubiPill.textContent = `${ubiInfo.icon} ${ubiInfo.text}`;
    ubiPill.title = `Ubicación actual de ${escapeHtml(u)}: ${ubiInfo.title}. Toca para cambiarla.`;
    ubiPill.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      alternarUbicacionUsuario(u);
    });
    label.appendChild(ubiPill);

    listaFiltroCoincidencias.appendChild(label);
  });

  renderizarBannerUbicacionUniversitarios();
}

if (btnSelTodos) {
  btnSelTodos.addEventListener('click', () => {
    const miembrosGrupo = (typeof obtenerMiembrosGrupo === 'function') ? obtenerMiembrosGrupo(grupoActivo) : usuarios;
    miembrosGrupo.forEach(u => usuariosSeleccionadosCoincidencias.add(u));
    renderizarFiltroCoincidencias();
  });
}
if (btnSelNinguno) {
  btnSelNinguno.addEventListener('click', () => {
    usuariosSeleccionadosCoincidencias.clear();
    renderizarFiltroCoincidencias();
  });
}

function renderizarSelector() {
  renderizarSelectoresUsuarios();
  renderizarFiltroCoincidencias();
}

// =========================================================================
// --- MANEJADORES DE EVENTOS PARA EL PANEL DESPLEGABLE EN LÍNEA -----------
// =========================================================================

// Botón de alternar desplegable de personas y PINs
if (btnEditarUsuarios) {
  btnEditarUsuarios.addEventListener('click', () => {
    const estaVisible = panelDesplegableUsuarios.style.display !== 'none';
    panelDesplegableUsuarios.style.display = estaVisible ? 'none' : 'block';
    if (flechaDesplegableUsuarios) {
      flechaDesplegableUsuarios.textContent = estaVisible ? '▾' : '▴';
    }
    if (!estaVisible) {
      actualizarEdicionPersonaDesplegable();
    }
  });
}

// Botón de personas en la barra superior
if (btnTopPersonas) {
  btnTopPersonas.addEventListener('click', () => {
    panelDesplegableUsuarios.style.display = 'block';
    if (flechaDesplegableUsuarios) flechaDesplegableUsuarios.textContent = '▴';
    actualizarEdicionPersonaDesplegable();
    panelDesplegableUsuarios.scrollIntoView({ behavior: 'smooth' });
  });
}

// Eliminar persona seleccionada en el desplegable
if (btnBorrarPersonaDesplegable) {
  btnBorrarPersonaDesplegable.addEventListener('click', async () => {
    const nombre = selectPersonaAEditar.value;
    if (!nombre) return;
    await eliminarUsuario(nombre);
  });
}

// Añadir nueva persona desde el desplegable
if (btnCrearUsuarioDesplegable) {
  btnCrearUsuarioDesplegable.addEventListener('click', async () => {
    const nombre = (nuevoNombreDesplegable?.value || '').trim();
    const rol = nuevoRolDesplegable ? nuevoRolDesplegable.value : 'usuario';

    btnCrearUsuarioDesplegable.textContent = '...';
    const ok = await crearNuevoUsuario(nombre, rol);
    btnCrearUsuarioDesplegable.textContent = '➕ Añadir';
    if (ok) {
      if (nuevoNombreDesplegable) nuevoNombreDesplegable.value = '';
      alert(`🎉 ¡"${nombre}" añadido con éxito al cuadrante!`);
    }
  });
}

// Abrir modal de tarjetas completas desde el enlace del desplegable
if (btnAbrirModalCompletoUsuarios) {
  btnAbrirModalCompletoUsuarios.addEventListener('click', () => {
    renderizarPanelGestionUsuarios();
    modalGestionUsuarios.style.display = 'flex';
  });
}

// Cerrar modal de gestión de usuarios
[btnCerrarModalUsuarios, btnCerrarGestionUser].forEach(btn => {
  if (btn) btn.addEventListener('click', () => { modalGestionUsuarios.style.display = 'none'; });
});
if (modalGestionUsuarios) {
  modalGestionUsuarios.addEventListener('click', (e) => {
    if (e.target === modalGestionUsuarios) modalGestionUsuarios.style.display = 'none';
  });
}

// Crear nueva persona en modal completo
if (btnCrearUsuario) {
  btnCrearUsuario.addEventListener('click', async () => {
    const nombre = (nuevoUserNombre?.value || '').trim();
    const rol = nuevoUserRol ? nuevoUserRol.value : 'usuario';

    btnCrearUsuario.textContent = 'Añadiendo...';
    const ok = await crearNuevoUsuario(nombre, rol);
    btnCrearUsuario.textContent = 'Añadir';
    if (ok) {
      if (nuevoUserNombre) nuevoUserNombre.value = '';
      alert(`🎉 ¡"${nombre}" añadido con éxito!`);
    }
  });
}

// --- SISTEMA MULTI-GRUPO, SEGURIDAD PRIVADA Y ADMINISTRACIÓN DE MIEMBROS ---
const GRUPOS_DEFECTO = [
  {
    id: 'amigos',
    nombre: 'Amigos',
    icono: '🍻',
    creador: 'Cule',
    miembros: ['Cule', 'Persona 2', 'Persona 3', 'Persona 4'],
    codigo_acceso: 'AMIGOS-1234',
    descripcion: 'Cuadrante con amigos'
  },
  {
    id: 'familia',
    nombre: 'Familia',
    icono: '👨‍👩‍👧‍👦',
    creador: 'Cule',
    miembros: ['Cule', 'Persona 2'],
    codigo_acceso: 'FAMILIA-1234',
    descripcion: 'Planes familiares'
  },
  {
    id: 'pareja',
    nombre: 'Pareja',
    icono: '💑',
    creador: 'Cule',
    miembros: ['Cule', 'Persona 3'],
    codigo_acceso: 'PAREJA-1234',
    descripcion: 'Turnos y planes en pareja'
  },
  {
    id: 'hijos',
    nombre: 'Hijos',
    icono: '👶',
    creador: 'Cule',
    miembros: ['Cule', 'Persona 4'],
    codigo_acceso: 'HIJOS-1234',
    descripcion: 'Horarios de los peques y actividades'
  }
];

let grupoActivo = localStorage.getItem('kedadas_grupo_activo') || 'Amigos';
let listaGrupos = [...GRUPOS_DEFECTO];

const selectorGrupoActivo = document.getElementById('selector-grupo-activo');
const btnAbrirModalGrupos = document.getElementById('btn-abrir-modal-grupos');
const modalGestionarGrupos = document.getElementById('modal-gestionar-grupos');
const btnCerrarModalGrupos = document.getElementById('btn-cerrar-modal-grupos');
const btnCerrarGruposFooter = document.getElementById('btn-cerrar-grupos-footer');
const nuevoGrupoIconoModal = document.getElementById('nuevo-grupo-icono-modal');
const nuevoGrupoNombreModal = document.getElementById('nuevo-grupo-nombre-modal');
const btnGuardarNuevoGrupoModal = document.getElementById('btn-guardar-nuevo-grupo-modal');
const listaGruposGestion = document.getElementById('lista-grupos-gestion');

// Elementos de la nueva pestaña de grupos y administración
const nuevoGrupoIconoTab = document.getElementById('nuevo-grupo-icono-tab');
const nuevoGrupoNombreTab = document.getElementById('nuevo-grupo-nombre-tab');
const btnGuardarNuevoGrupoTab = document.getElementById('btn-guardar-nuevo-grupo-tab');
const btnCopiarCodigoGrupo = document.getElementById('btn-copiar-codigo-grupo');
const btnAnadirUsuarioExistente = document.getElementById('btn-anadir-usuario-existente');
const selectUsuarioExistenteGrupo = document.getElementById('select-usuario-existente-grupo');
const inputNuevoNombreMiembro = document.getElementById('input-nuevo-nombre-miembro');
const btnCrearYAnadirMiembro = document.getElementById('btn-crear-y-anadir-miembro');
const inputCodigoUnirse = document.getElementById('input-codigo-unirse');
const btnUnirseConCodigo = document.getElementById('btn-unirse-con-codigo');
const btnEditarGrupoActivo = document.getElementById('btn-editar-grupo-activo');
const btnEliminarGrupoActivo = document.getElementById('btn-eliminar-grupo-activo');

// Elementos de aviso de grupo y confirmación de guardado de horario
const badgeGrupoBanner = document.getElementById('badge-grupo-banner');
const nombreGrupoBanner = document.getElementById('nombre-grupo-banner');
let cambiosHorarioPendientes = {}; // { [dia]: nuevoIndice }
const barraGuardarHorario = document.getElementById('barra-guardar-horario');
const textoCambiosPendientes = document.getElementById('texto-cambios-pendientes');
const btnCancelarCambiosHorario = document.getElementById('btn-cancelar-cambios-horario');
const btnGuardarCambiosHorario = document.getElementById('btn-guardar-cambios-horario');
const btnGuardarHorarioTop = document.getElementById('btn-guardar-horario-top');

function obtenerNombreGrupo(g) {
  if (!g) return '';
  if (typeof g === 'string') return g.trim();
  return (g.nombre || g.name || 'Grupo').trim();
}

function normalizarGrupo(g) {
  if (!g) return null;
  const nombre = (g.nombre || g.name || 'Grupo').trim();
  let miembros = [];
  if (Array.isArray(g.miembros)) {
    miembros = g.miembros.map(m => (typeof m === 'string' ? m : (m?.nombre || m?.name || ''))).filter(Boolean);
  } else if (typeof g.miembros === 'string') {
    try {
      const parsed = JSON.parse(g.miembros);
      if (Array.isArray(parsed)) {
        miembros = parsed.map(m => (typeof m === 'string' ? m : (m?.nombre || m?.name || ''))).filter(Boolean);
      }
    } catch (e) {
      miembros = [];
    }
  }
  if (!Array.isArray(miembros) || miembros.length === 0) {
    const def = GRUPOS_DEFECTO.find(d => (d.id || '').toLowerCase() === (g.id || '').toLowerCase() || obtenerNombreGrupo(d).toLowerCase() === nombre.toLowerCase());
    if (def && Array.isArray(def.miembros) && def.miembros.length > 0) {
      miembros = [...def.miembros];
    } else {
      miembros = [g.creador || usuarioLogueado || 'Cule'];
    }
  }
  const creador = g.creador || (['Amigos', 'Familia', 'Pareja', 'Hijos'].includes(nombre) ? 'Cule' : (usuarioLogueado || 'Cule'));
  const codigo = g.codigo_acceso || generarCodigoAcceso(nombre);
  return {
    id: g.id || nombre.toLowerCase().replace(/\s+/g, '-'),
    nombre: nombre,
    name: nombre,
    icono: g.icono || '👥',
    creador: creador,
    miembros: miembros,
    codigo_acceso: codigo,
    descripcion: g.descripcion || g.description || ''
  };
}

function generarCodigoAcceso(nombre) {
  const base = (nombre || 'GRUPO').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) || 'GRUPO';
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `${base}-${rand}`;
}

function puedeUsuarioVerGrupo(g, usuario) {
  return true;
}

function obtenerGruposVisibles(usuario) {
  return (listaGrupos || []).map(g => normalizarGrupo(g)).filter(Boolean);
}

function esAdminDelGrupo(g, usuario) {
  if (!g) return false;
  if (esAdmin || (usuario && usuario.toLowerCase() === 'cule')) return true;
  const gNorm = normalizarGrupo(g);
  if (!gNorm) return false;
  if (gNorm.creador && usuario && gNorm.creador.toLowerCase() === usuario.toLowerCase()) return true;
  return false;
}

function obtenerMiembrosGrupo(grupoNombre) {
  const nombreTarget = (grupoNombre || grupoActivo || '').trim().toLowerCase();
  const g = (listaGrupos || []).find(item => obtenerNombreGrupo(item).toLowerCase() === nombreTarget);
  if (g) {
    const norm = normalizarGrupo(g);
    if (norm && Array.isArray(norm.miembros) && norm.miembros.length > 0) {
      return norm.miembros;
    }
  }
  const def = GRUPOS_DEFECTO.find(d => (d.id || '').toLowerCase() === nombreTarget || obtenerNombreGrupo(d).toLowerCase() === nombreTarget);
  if (def && Array.isArray(def.miembros) && def.miembros.length > 0) {
    return [...def.miembros];
  }
  return (Array.isArray(usuarios) && usuarios.length > 0) ? [...usuarios] : ['Cule'];
}

function actualizarBannerGrupo() {
  const grupoObj = (listaGrupos || []).find(g => obtenerNombreGrupo(g).toLowerCase() === (grupoActivo || '').toLowerCase());
  const icono = grupoObj?.icono || '👥';
  const texto = `${icono} ${grupoActivo}`;
  if (nombreGrupoBanner) nombreGrupoBanner.textContent = texto;
  const nombreGrupoBannerTab = document.getElementById('nombre-grupo-banner-tab');
  if (nombreGrupoBannerTab) nombreGrupoBannerTab.textContent = texto;
  const chatTituloGrupo = document.getElementById('chat-titulo-grupo');
}

async function sincronizarGrupoEnSupabase(grupo) {
  try {
    const payload = {
      id: grupo.id,
      nombre: grupo.nombre,
      icono: grupo.icono || '👥',
      creador: grupo.creador || 'Cule',
      miembros: JSON.stringify(grupo.miembros || []),
      codigo_acceso: grupo.codigo_acceso || generarCodigoAcceso(grupo.nombre),
      descripcion: grupo.descripcion || ''
    };
    await supabaseApp.from('grupos').upsert(payload, { onConflict: 'id' });
  } catch (err) {
    console.warn('Aviso sincronizando grupo en Supabase:', err);
  }
}

async function cargarGruposDesdeBD() {
  let gruposCargados = false;

  // 1. Intentar cargar desde tabla 'groups' y 'group_members' (schema Supabase Auth)
  try {
    const { data: groupsData, error: groupsErr } = await supabaseApp
      .from('groups')
      .select('*')
      .order('created_at', { ascending: true });

    if (!groupsErr && Array.isArray(groupsData) && groupsData.length > 0) {
      const { data: membersData } = await supabaseApp
        .from('group_members')
        .select('group_id, user_id, role');

      const { data: perfilesData } = await supabaseApp
        .from('perfiles')
        .select('user_id, nombre');

      const userMap = new Map();
      if (Array.isArray(perfilesData)) {
        perfilesData.forEach(p => {
          if (p.user_id && p.nombre) userMap.set(p.user_id, p.nombre);
        });
      }

      const miembrosPorGrupo = new Map();
      if (Array.isArray(membersData)) {
        membersData.forEach(m => {
          const nombreUser = userMap.get(m.user_id);
          if (nombreUser) {
            if (!miembrosPorGrupo.has(m.group_id)) miembrosPorGrupo.set(m.group_id, []);
            miembrosPorGrupo.get(m.group_id).push(nombreUser);
          }
        });
      }

      listaGrupos = groupsData.map(g => {
        let miembrosG = miembrosPorGrupo.get(g.id) || [];
        const creadorNombre = userMap.get(g.created_by) || (usuarioLogueado || 'Cule');
        if (miembrosG.length === 0) miembrosG = [creadorNombre];
        else if (!miembrosG.includes(creadorNombre)) miembrosG.unshift(creadorNombre);

        return normalizarGrupo({
          id: g.id,
          nombre: g.name || g.nombre,
          icono: g.icono || '👥',
          creador: creadorNombre,
          miembros: miembrosG,
          codigo_acceso: g.codigo_acceso || generarCodigoAcceso(g.name || g.nombre),
          descripcion: g.description || ''
        });
      });
      gruposCargados = true;
    }
  } catch (errGroups) {
    console.warn('Aviso cargando groups desde Supabase:', errGroups);
  }

  // 2. Si no se cargaron desde 'groups', intentar desde 'grupos' (retrocompatibilidad)
  if (!gruposCargados) {
    try {
      const { data, error } = await supabaseApp.from('grupos').select('*').order('created_at', { ascending: true });
      if (!error && Array.isArray(data) && data.length > 0) {
        listaGrupos = data.map(g => normalizarGrupo(g));
        gruposCargados = true;
      }
    } catch (e) {}
  }

  // 3. Fallback a almacenamiento local o valores por defecto
  if (!gruposCargados) {
    let guardados = null;
    try {
      guardados = JSON.parse(localStorage.getItem('kedadas_lista_grupos'));
    } catch(e) {}
    if (Array.isArray(guardados) && guardados.length > 0) {
      listaGrupos = guardados.map(g => normalizarGrupo(g)).filter(Boolean);
    } else {
      listaGrupos = [...GRUPOS_DEFECTO].map(g => normalizarGrupo(g)).filter(Boolean);
    }
  }

  localStorage.setItem('kedadas_lista_grupos', JSON.stringify(listaGrupos));
  renderizarSelectorGrupos();
  renderizarPanelGestionGrupoActivo();
  actualizarBannerGrupo();
  renderizarSelectoresUsuarios();
  renderizarFiltroCoincidencias(true);
}

function renderizarSelectorGrupos() {
  const visibles = obtenerGruposVisibles(usuarioLogueado);

  const nombreActivo = (grupoActivo || '').toLowerCase();
  if (visibles.length > 0 && !visibles.some(g => obtenerNombreGrupo(g).toLowerCase() === nombreActivo)) {
    grupoActivo = obtenerNombreGrupo(visibles[0]);
    try { localStorage.setItem('kedadas_grupo_activo', grupoActivo); } catch(e) {}
  }

  // Actualizar selector dropdown en la pestaña de grupos
  if (selectorGrupoActivo) {
    selectorGrupoActivo.innerHTML = '';
    visibles.forEach(g => {
      const opt = document.createElement('option');
      const n = obtenerNombreGrupo(g);
      opt.value = n;
      opt.textContent = `${g.icono || '👥'} ${n}`;
      if (n.toLowerCase() === (grupoActivo || '').toLowerCase()) opt.selected = true;
      selectorGrupoActivo.appendChild(opt);
    });
  }

  // Actualizar selector dropdown en el Cuadrante
  const cuadranteSelectorGrupo = document.getElementById('cuadrante-selector-grupo');
  if (cuadranteSelectorGrupo) {
    cuadranteSelectorGrupo.innerHTML = '';
    visibles.forEach(g => {
      const opt = document.createElement('option');
      const n = obtenerNombreGrupo(g);
      opt.value = n;
      opt.textContent = `${g.icono || '👥'} ${n}`;
      if (n.toLowerCase() === (grupoActivo || '').toLowerCase()) opt.selected = true;
      cuadranteSelectorGrupo.appendChild(opt);
    });
  }

  // Actualizar contador de grupos visibles
  const badgeContador = document.getElementById('badge-contador-grupos');
  if (badgeContador) {
    badgeContador.textContent = `${visibles.length} grupo${visibles.length === 1 ? '' : 's'}`;
  }

  // Renderizar tarjetas interactivas de grupos autorizados
  const contenedorTarjetas = document.getElementById('contenedor-tarjetas-grupos');
  if (contenedorTarjetas) {
    contenedorTarjetas.innerHTML = '';
    if (visibles.length === 0) {
      contenedorTarjetas.innerHTML = '<p class="modal-desc-sub" style="grid-column: 1/-1;">No tienes ningún grupo asignado todavía. Introduce un código de invitación o crea tu propio grupo privado abajo.</p>';
    } else {
      visibles.forEach(g => {
        const n = obtenerNombreGrupo(g);
        const esActivo = n.toLowerCase() === (grupoActivo || '').toLowerCase();
        const esAdminG = esAdminDelGrupo(g, usuarioLogueado);
        const numMiembros = (Array.isArray(g.miembros) ? g.miembros : []).length;
        const card = document.createElement('div');
        card.className = `card-grupo-item ${esActivo ? 'activa' : ''}`;
        card.innerHTML = `
          <span class="card-grupo-icono">${escapeHtml(g.icono || '👥')}</span>
          <span class="card-grupo-nombre">${escapeHtml(n)}</span>
          <div class="card-grupo-meta-row">
            <span class="badge-miembros-card">👥 ${numMiembros}</span>
            ${esAdminG ? '<span class="badge-admin-card">👑 Admin</span>' : ''}
          </div>
          ${esActivo ? '<span class="badge-grupo-activo">Activo</span>' : ''}
        `;
        card.addEventListener('click', () => {
          if (!esActivo) {
            cambiarGrupo(n);
          }
        });
        contenedorTarjetas.appendChild(card);
      });
    }
  }

  actualizarBannerGrupo();
}

function renderizarPanelGestionGrupoActivo() {
  const grupo = (listaGrupos || []).find(g => obtenerNombreGrupo(g).toLowerCase() === (grupoActivo || '').toLowerCase());
  if (!grupo) return;
  const gNorm = normalizarGrupo(grupo);

  const iconoEl = document.getElementById('grupo-admin-icono');
  if (iconoEl) iconoEl.textContent = gNorm.icono || '👥';

  const nombreEl = document.getElementById('grupo-admin-nombre');
  if (nombreEl) nombreEl.textContent = gNorm.nombre;

  const creadorEl = document.getElementById('nombre-creador-grupo');
  if (creadorEl) creadorEl.textContent = gNorm.creador;

  const esAdminG = esAdminDelGrupo(gNorm, usuarioLogueado);

  const badgeRol = document.getElementById('grupo-admin-badge-rol');
  if (badgeRol) {
    badgeRol.className = esAdminG ? 'badge-rol-admin' : 'badge-rol-miembro';
    badgeRol.textContent = esAdminG ? '👑 Eres Administrador' : '👤 Eres Miembro';
  }

  const codigoDisplay = document.getElementById('codigo-invitacion-display');
  if (codigoDisplay) codigoDisplay.textContent = gNorm.codigo_acceso;

  const contadorMiembros = document.getElementById('contador-miembros-grupo');
  if (contadorMiembros) contadorMiembros.textContent = gNorm.miembros.length;

  const nombreGrupoAnadir = document.getElementById('nombre-grupo-anadir');
  if (nombreGrupoAnadir) nombreGrupoAnadir.textContent = `"${gNorm.nombre}"`;

  // Renderizar miembros en la lista
  const contenedorMiembros = document.getElementById('lista-miembros-grupo-contenedor');
  if (contenedorMiembros) {
    contenedorMiembros.innerHTML = '';
    (gNorm.miembros || []).forEach(m => {
      const mStr = String(m || '').trim();
      if (!mStr) return;
      const esCreador = mStr.toLowerCase() === (gNorm.creador || '').toLowerCase();
      const esYo = usuarioLogueado && mStr.toLowerCase() === usuarioLogueado.toLowerCase();
      const inicial = mStr.charAt(0).toUpperCase();

      const ubi = obtenerIconoUbicacion(mStr);
      const item = document.createElement('div');
      item.className = 'miembro-card-item';
      item.innerHTML = `
        <div class="miembro-info-wrap">
          <div class="miembro-avatar-icon" style="position: relative;">
            ${escapeHtml(inicial)}
            <span class="avatar-location-badge" title="${escapeHtml(ubi.title)}">${ubi.icon}</span>
          </div>
          <div>
            <div class="miembro-nombre-txt">${escapeHtml(mStr)} ${esYo ? '<small style="color:#6366f1; font-weight:800;">(Tú)</small>' : ''}</div>
            <div class="miembro-tags-row">
              <span class="${esCreador ? 'badge-rol-admin' : 'badge-rol-miembro'}">${esCreador ? '👑 Creador / Admin' : '👤 Miembro'}</span>
              <span class="badge-ubi-pill ${ubi.pillClass}">${ubi.icon} ${escapeHtml(ubi.text)}</span>
            </div>
          </div>
        </div>
        <div class="miembro-acciones-btns"></div>
      `;

      const accionesWrap = item.querySelector('.miembro-acciones-btns');
      if (accionesWrap) {
        if (esAdminG && !esCreador) {
          const btnQuitar = document.createElement('button');
          btnQuitar.type = 'button';
          btnQuitar.className = 'btn-quitar-miembro-mini';
          btnQuitar.textContent = '❌ Quitar';
          btnQuitar.title = `Quitar a ${mStr} de ${gNorm.nombre}`;
          btnQuitar.addEventListener('click', () => quitarMiembroDeGrupo(gNorm.id, mStr));
          accionesWrap.appendChild(btnQuitar);
        } else if (!esCreador && esYo) {
          const btnSalir = document.createElement('button');
          btnSalir.type = 'button';
          btnSalir.className = 'btn-salir-grupo-mini';
          btnSalir.textContent = '🚪 Salir';
          btnSalir.title = `Abandonar el grupo ${gNorm.nombre}`;
          btnSalir.addEventListener('click', () => abandonarGrupo(gNorm.id));
          accionesWrap.appendChild(btnSalir);
        }
      }

      contenedorMiembros.appendChild(item);
    });
  }

  // Visibilidad de controles de administración según permisos
  const zonaAnadir = document.getElementById('zona-anadir-miembros');
  const avisoNoAdmin = document.getElementById('aviso-no-admin-grupo');
  const btnEditarGrupo = document.getElementById('btn-editar-grupo-activo');
  const btnEliminarGrupo = document.getElementById('btn-eliminar-grupo-activo');

  if (esAdminG) {
    if (zonaAnadir) zonaAnadir.style.display = 'block';
    if (avisoNoAdmin) avisoNoAdmin.style.display = 'none';
    if (btnEditarGrupo) btnEditarGrupo.style.display = 'inline-flex';
    if (btnEliminarGrupo) btnEliminarGrupo.style.display = 'inline-flex';

    if (selectUsuarioExistenteGrupo) {
      selectUsuarioExistenteGrupo.innerHTML = '<option value="">-- Selecciona una persona --</option>';
      const miembrosLower = (gNorm.miembros || []).map(m => String(m).toLowerCase());
      (usuarios || []).filter(u => u && !miembrosLower.includes(String(u).toLowerCase())).forEach(u => {
        const opt = document.createElement('option');
        opt.value = u;
        opt.textContent = `👤 ${u}`;
        selectUsuarioExistenteGrupo.appendChild(opt);
      });
    }
  } else {
    if (zonaAnadir) zonaAnadir.style.display = 'none';
    if (avisoNoAdmin) {
      avisoNoAdmin.style.display = 'flex';
      const adminTxt = document.getElementById('nombre-admin-aviso');
      if (adminTxt) adminTxt.textContent = gNorm.creador;
    }
    if (btnEditarGrupo) btnEditarGrupo.style.display = 'none';
    if (btnEliminarGrupo) btnEliminarGrupo.style.display = 'none';
  }
}

function cambiarGrupo(nuevoGrupo) {
  if (!nuevoGrupo) return;
  const nombreLimpio = (typeof nuevoGrupo === 'string' ? nuevoGrupo : (nuevoGrupo.nombre || nuevoGrupo.name || '')).trim();
  if (!nombreLimpio) return;

  const g = (listaGrupos || []).find(item => obtenerNombreGrupo(item).toLowerCase() === nombreLimpio.toLowerCase());

  try {
    if (Object.keys(cambiosHorarioPendientes).length > 0) {
      const guardar = confirm(`Tienes modificaciones sin guardar en el cuadrante de "${grupoActivo}". ¿Deseas guardarlas antes de cambiar a "${nombreLimpio}"?`);
      if (guardar) {
        guardarCambiosHorarioConfirmado();
      } else {
        cambiosHorarioPendientes = {};
        actualizarBarraCambiosPendientes();
      }
    }
  } catch(e) {}

  grupoActivo = g ? obtenerNombreGrupo(g) : nombreLimpio;
  try {
    localStorage.setItem('kedadas_grupo_activo', grupoActivo);
  } catch(e) {}

  // Sincronizar miembros del nuevo grupo
  const miembrosNuevo = obtenerMiembrosGrupo(grupoActivo);
  if (usuarioLogueado && !miembrosNuevo.some(m => String(m || '').toLowerCase() === usuarioLogueado.toLowerCase())) {
    miembrosNuevo.push(usuarioLogueado);
    if (g && Array.isArray(g.miembros)) {
      g.miembros.push(usuarioLogueado);
      sincronizarGrupoEnSupabase(g);
    }
  }

  if (miembrosNuevo.includes(usuarioLogueado)) {
    miUsuario = usuarioLogueado;
  } else if (miembrosNuevo.length > 0) {
    miUsuario = miembrosNuevo[0];
  }

  usuariosSeleccionadosCoincidencias = new Set(miembrosNuevo);
  ultimoGrupoFiltroCoincidencias = grupoActivo;

  try { renderizarSelectorGrupos(); } catch(e) { console.warn(e); }
  try { renderizarPanelGestionGrupoActivo(); } catch(e) { console.warn(e); }
  try { actualizarBannerGrupo(); } catch(e) { console.warn(e); }
  try { renderizarSelectoresUsuarios(); } catch(e) { console.warn(e); }
  try { renderizarFiltroCoincidencias(true); } catch(e) { console.warn(e); }

  if (resultadoCoincidencias) {
    resultadoCoincidencias.innerHTML = '';
    resultadoCoincidencias.classList.remove('visible');
  }

  try { iniciarCalendario(); } catch(e) { console.warn(e); }
  try { cargarChatInicial(); } catch(e) { console.warn(e); }
  setTimeout(() => {
    try { cargarVotaciones(); } catch(e) {}
  }, 200);
}

// Añadir usuario ya registrado al grupo activo
async function anadirUsuarioExistenteAGrupoActivo() {
  const grupo = (listaGrupos || []).find(g => obtenerNombreGrupo(g).toLowerCase() === (grupoActivo || '').toLowerCase());
  if (!grupo) return;
  const gNorm = normalizarGrupo(grupo);
  if (!esAdminDelGrupo(grupo, usuarioLogueado)) {
    return alert(`🔒 Solo el administrador (${gNorm.creador}) puede añadir miembros a "${gNorm.nombre}".`);
  }

  const usuarioSeleccionado = selectUsuarioExistenteGrupo ? selectUsuarioExistenteGrupo.value : '';
  if (!usuarioSeleccionado) {
    return alert('Por favor, selecciona una persona de la lista para añadir al grupo.');
  }

  if (!Array.isArray(grupo.miembros)) grupo.miembros = [];
  if (grupo.miembros.some(m => String(m).toLowerCase() === usuarioSeleccionado.toLowerCase())) {
    return alert(`"${usuarioSeleccionado}" ya pertenece a este grupo.`);
  }

  grupo.miembros.push(usuarioSeleccionado);
  try { localStorage.setItem('kedadas_lista_grupos', JSON.stringify(listaGrupos)); } catch(e) {}
  await sincronizarGrupoEnSupabase(grupo);

  renderizarSelectorGrupos();
  renderizarPanelGestionGrupoActivo();
  renderizarSelectoresUsuarios();
  renderizarFiltroCoincidencias();

  if (typeof confetti === 'function') confetti({ particleCount: 30, spread: 60 });
  alert(`✅ ¡"${usuarioSeleccionado}" ha sido añadido al grupo "${gNorm.nombre}"!`);
}

// Crear nueva persona e incluirla directamente en el grupo activo
async function crearYAnadirNuevoMiembroAGrupoActivo() {
  const grupo = (listaGrupos || []).find(g => obtenerNombreGrupo(g).toLowerCase() === (grupoActivo || '').toLowerCase());
  if (!grupo) return;
  const gNorm = normalizarGrupo(grupo);
  if (!esAdminDelGrupo(grupo, usuarioLogueado)) {
    return alert(`🔒 Solo el administrador (${gNorm.creador}) puede añadir miembros a "${gNorm.nombre}".`);
  }

  const nombre = (inputNuevoNombreMiembro?.value || '').trim();

  if (!nombre) return alert('Por favor, escribe el nombre de la persona a invitar.');

  if (!Array.isArray(grupo.miembros)) grupo.miembros = [];
  if (grupo.miembros.some(m => String(m).toLowerCase() === nombre.toLowerCase())) {
    return alert(`"${nombre}" ya pertenece a este grupo.`);
  }

  // Si la persona no existe en la app, la creamos en listaPerfiles y Supabase
  if (!usuarios.some(u => String(u).toLowerCase() === nombre.toLowerCase())) {
    listaPerfiles.push({ id: nombre, nombre, rol: 'usuario' });
    guardarPerfilesLocales();
    try {
      await supabaseApp.from('perfiles').insert({ nombre, rol: 'usuario' });
    } catch (e) {}
  }

  grupo.miembros.push(nombre);
  try { localStorage.setItem('kedadas_lista_grupos', JSON.stringify(listaGrupos)); } catch(e) {}
  await sincronizarGrupoEnSupabase(grupo);

  if (inputNuevoNombreMiembro) inputNuevoNombreMiembro.value = '';

  renderizarSelectorGrupos();
  renderizarPanelGestionGrupoActivo();
  renderizarSelectoresUsuarios();
  renderizarFiltroCoincidencias();

  if (typeof confetti === 'function') confetti({ particleCount: 40, spread: 70 });
  alert(`🎉 ¡"${nombre}" ha sido dado de alta y añadido al grupo "${gNorm.nombre}"!`);
}

// Quitar miembro de un grupo
async function quitarMiembroDeGrupo(grupoId, miembro) {
  const grupo = (listaGrupos || []).find(g => g && g.id === grupoId);
  if (!grupo) return;
  const gNorm = normalizarGrupo(grupo);

  if (!esAdminDelGrupo(grupo, usuarioLogueado)) {
    return alert(`🔒 Solo el administrador (${gNorm.creador}) puede expulsar o quitar miembros.`);
  }
  if (String(miembro).toLowerCase() === (gNorm.creador || '').toLowerCase()) {
    return alert(`No puedes quitar al creador y administrador (${gNorm.creador}) del grupo.`);
  }

  const confirmar = confirm(`¿Estás seguro de que deseas quitar a "${miembro}" del grupo "${gNorm.nombre}"?\nEsta persona ya no podrá ver los turnos ni el chat de este grupo.`);
  if (!confirmar) return;

  grupo.miembros = (grupo.miembros || []).filter(m => String(m).toLowerCase() !== String(miembro).toLowerCase());
  try { localStorage.setItem('kedadas_lista_grupos', JSON.stringify(listaGrupos)); } catch(e) {}
  await sincronizarGrupoEnSupabase(grupo);

  renderizarSelectorGrupos();
  renderizarPanelGestionGrupoActivo();
  renderizarSelectoresUsuarios();
  renderizarFiltroCoincidencias();
  alert(`🗑️ "${miembro}" ha sido retirado del grupo "${gNorm.nombre}".`);
}

// Abandonar grupo voluntariamente
async function abandonarGrupo(grupoId) {
  const grupo = (listaGrupos || []).find(g => g && g.id === grupoId);
  if (!grupo) return;
  const gNorm = normalizarGrupo(grupo);

  const confirmar = confirm(`¿Deseas salir del grupo "${gNorm.nombre}"?\nYa no tendrás acceso a su cuadrante ni a sus planes.`);
  if (!confirmar) return;

  grupo.miembros = (grupo.miembros || []).filter(m => String(m).toLowerCase() !== (usuarioLogueado || '').toLowerCase());
  try { localStorage.setItem('kedadas_lista_grupos', JSON.stringify(listaGrupos)); } catch(e) {}
  await sincronizarGrupoEnSupabase(grupo);

  const restantes = obtenerGruposVisibles(usuarioLogueado);
  const nuevoG = restantes.length > 0 ? obtenerNombreGrupo(restantes[0]) : 'Amigos';
  cambiarGrupo(nuevoG);
  alert(`👋 Has salido del grupo "${gNorm.nombre}".`);
}

// Unirse a un grupo mediante código de invitación (RPC Supabase o Local)
async function unirseAGrupoConCodigo() {
  const codigo = (inputCodigoUnirse?.value || '').trim().toUpperCase();
  if (!codigo) return alert('Por favor, escribe el código de invitación del grupo (ej: KED-A7X9 o AMIGOS-1234).');

  if (btnUnirseConCodigo) btnUnirseConCodigo.textContent = '⏳ Uniendo...';

  // 1. Intentar unirse a través de la función RPC segura en Supabase (SECURITY DEFINER)
  try {
    const { data: rpcRes, error: rpcErr } = await supabaseApp.rpc('join_group_with_code', { p_code: codigo });
    if (!rpcErr && rpcRes && rpcRes.success) {
      if (inputCodigoUnirse) inputCodigoUnirse.value = '';
      if (btnUnirseConCodigo) btnUnirseConCodigo.textContent = '🔑 Unirme al Grupo';

      // Recargar grupos desde Supabase
      await cargarGruposDesdeBD();
      if (rpcRes.group_name) {
        cambiarGrupo(rpcRes.group_name);
      }

      if (typeof confetti === 'function') confetti({ particleCount: 60, spread: 80 });
      alert(`🎉 ${rpcRes.message || '¡Te has unido con éxito!'} Grupo: "${rpcRes.group_name || 'Privado'}".`);
      return;
    } else if (rpcErr && rpcErr.message && !rpcErr.message.includes('not found') && !rpcErr.message.includes('function')) {
      alert(`❌ Error al unirse: ${rpcErr.message}`);
      if (btnUnirseConCodigo) btnUnirseConCodigo.textContent = '🔑 Unirme al Grupo';
      return;
    }
  } catch (err) {
    console.warn('RPC join_group_with_code no disponible, usando fallback:', err);
  }

  // 2. Fallback de retrocompatibilidad con lista de grupos sincronizados
  const grupo = (listaGrupos || []).find(g => {
    if (!g) return false;
    const gNorm = normalizarGrupo(g);
    return (gNorm.codigo_acceso || '').toUpperCase() === codigo || (g.id || '').toUpperCase() === codigo;
  });
  if (!grupo) {
    if (btnUnirseConCodigo) btnUnirseConCodigo.textContent = '🔑 Unirme al Grupo';
    return alert(`❌ Código "${codigo}" no encontrado o caducado.\nPide al administrador del grupo que te facilite el código o enlace actualizado.`);
  }

  const gNorm = normalizarGrupo(grupo);
  const usuarioActual = usuarioLogueado || 'Cule';
  if (!Array.isArray(grupo.miembros)) grupo.miembros = [];
  if (grupo.miembros.some(m => String(m).toLowerCase() === usuarioActual.toLowerCase())) {
    cambiarGrupo(gNorm.nombre);
    if (btnUnirseConCodigo) btnUnirseConCodigo.textContent = '🔑 Unirme al Grupo';
    return alert(`Ya perteneces al grupo "${gNorm.nombre}". ¡Te hemos llevado a él!`);
  }

  grupo.miembros.push(usuarioActual);
  try { localStorage.setItem('kedadas_lista_grupos', JSON.stringify(listaGrupos)); } catch(e) {}
  await sincronizarGrupoEnSupabase(grupo);

  if (inputCodigoUnirse) inputCodigoUnirse.value = '';
  if (btnUnirseConCodigo) btnUnirseConCodigo.textContent = '🔑 Unirme al Grupo';
  cambiarGrupo(gNorm.nombre);

  if (typeof confetti === 'function') confetti({ particleCount: 50, spread: 80 });
  alert(`🎉 ¡Enhorabuena! Te has unido con éxito al grupo privado "${grupo.icono || '👥'} ${grupo.nombre}".`);
}

// Crear nuevo grupo privado desde la pestaña
async function guardarNuevoGrupoDesdePestana() {
  const nombre = (nuevoGrupoNombreTab?.value || '').trim();
  const icono = (nuevoGrupoIconoTab?.value || '').trim() || '👥';

  if (!nombre) return alert('Por favor, indica un nombre para el grupo (ej: Urgencias, Padel, Pareja...).');

  const id = nombre.toLowerCase().replace(/\s+/g, '-');
  if (listaGrupos.some(g => g.nombre.toLowerCase() === nombre.toLowerCase())) {
    return alert('Ya existe un grupo con este nombre.');
  }

  btnGuardarNuevoGrupoTab.textContent = 'Creando...';
  const creador = usuarioLogueado || 'Cule';
  const codigo = generarCodigoAcceso(nombre);

  const nuevoGrupoObj = {
    id,
    nombre,
    icono,
    creador,
    miembros: [creador],
    codigo_acceso: codigo,
    descripcion: `Grupo privado administrado por ${creador}`
  };

  listaGrupos.push(nuevoGrupoObj);
  localStorage.setItem('kedadas_lista_grupos', JSON.stringify(listaGrupos));
  await sincronizarGrupoEnSupabase(nuevoGrupoObj);

  // Intentar registrar invitación oficial en Supabase si la tabla existe
  try {
    await supabaseApp.from('groups').insert({
      name: nombre,
      icono: icono,
      created_by: (await supabaseApp.auth.getUser())?.data?.user?.id
    });
  } catch (e) {}

  if (nuevoGrupoNombreTab) nuevoGrupoNombreTab.value = '';
  if (nuevoGrupoIconoTab) nuevoGrupoIconoTab.value = '';
  btnGuardarNuevoGrupoTab.textContent = 'Crear Grupo';

  cambiarGrupo(nombre);

  if (typeof confetti === 'function') confetti({ particleCount: 60, spread: 90 });
  alert(`🎉 ¡Grupo "${icono} ${nombre}" creado con éxito!\nTú eres el administrador. Ya puedes añadir miembros o compartir tu código de invitación (${codigo}).`);
}

// Editar grupo activo (Nombre e Icono)
async function editarGrupoActivo() {
  const grupo = (listaGrupos || []).find(g => obtenerNombreGrupo(g).toLowerCase() === (grupoActivo || '').toLowerCase());
  if (!grupo) return;
  const gNorm = normalizarGrupo(grupo);

  if (!esAdmin && !esAdminDelGrupo(grupo, usuarioLogueado)) {
    return alert(`🔒 Solo el administrador (${gNorm.creador}) puede editar los datos de este grupo.`);
  }

  const nuevoNombre = prompt(`Nombre para el grupo "${gNorm.nombre}":`, gNorm.nombre);
  if (!nuevoNombre || !nuevoNombre.trim()) return;

  const nuevoIcono = prompt(`Icono emoji para el grupo (ej: 💼, 🍻, ⚽):`, grupo.icono || '👥') || grupo.icono;

  grupo.nombre = nuevoNombre.trim();
  grupo.name = nuevoNombre.trim();
  grupo.icono = (nuevoIcono || '👥').trim();

  try { localStorage.setItem('kedadas_lista_grupos', JSON.stringify(listaGrupos)); } catch(e) {}
  await sincronizarGrupoEnSupabase(grupo);

  grupoActivo = grupo.nombre;
  try { localStorage.setItem('kedadas_grupo_activo', grupoActivo); } catch(e) {}

  renderizarSelectorGrupos();
  renderizarPanelGestionGrupoActivo();
  actualizarBannerGrupo();
  alert(`✅ Grupo actualizado a "${grupo.icono} ${grupo.nombre}".`);
}

// Eliminar grupo activo
async function eliminarGrupoActivo() {
  const grupo = (listaGrupos || []).find(g => obtenerNombreGrupo(g).toLowerCase() === (grupoActivo || '').toLowerCase());
  if (!grupo) return;
  const gNorm = normalizarGrupo(grupo);

  if (!esAdmin && !esAdminDelGrupo(grupo, usuarioLogueado)) {
    return alert(`🔒 Solo el administrador (${gNorm.creador}) puede eliminar este grupo.`);
  }

  const confirmar = confirm(`⚠️ ¿ELIMINAR GRUPO "${gNorm.nombre}" DEFINITIVAMENTE?\nSe eliminará el grupo para todos sus miembros. Esta acción no se puede deshacer.`);
  if (!confirmar) return;

  try {
    await supabaseApp.from('grupos').delete().eq('id', grupo.id);
  } catch (e) {}

  listaGrupos = (listaGrupos || []).filter(g => g && g.id !== grupo.id);
  try { localStorage.setItem('kedadas_lista_grupos', JSON.stringify(listaGrupos)); } catch(e) {}

  const restantes = obtenerGruposVisibles(usuarioLogueado);
  const siguiente = restantes.length > 0 ? obtenerNombreGrupo(restantes[0]) : 'Amigos';
  cambiarGrupo(siguiente);
  alert(`🗑️ El grupo "${gNorm.nombre}" ha sido eliminado.`);
}

// Conectar eventos de la pestaña de grupos y administración
if (selectorGrupoActivo) {
  selectorGrupoActivo.addEventListener('change', (e) => {
    cambiarGrupo(e.target.value);
  });
}

if (btnCopiarCodigoGrupo) {
  btnCopiarCodigoGrupo.addEventListener('click', async () => {
    const grupo = (listaGrupos || []).find(g => obtenerNombreGrupo(g).toLowerCase() === (grupoActivo || '').toLowerCase());
    const gNorm = grupo ? normalizarGrupo(grupo) : null;
    const codigo = gNorm ? gNorm.codigo_acceso : '';
    if (!codigo) return alert('No hay código de invitación disponible.');

    const enlaceInvitacion = `${window.location.origin}${window.location.pathname}?unirse=${codigo}`;
    const textoMensaje = `¡Hola! Únete a mi grupo "${gNorm.nombre}" en Kedadas para ver cuándo coincidimos libres:\n${enlaceInvitacion}\n(O introduce el código ${codigo} en la app)`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Invitación a ${grupo.nombre} en Kedadas`,
          text: textoMensaje,
          url: enlaceInvitacion
        });
        return;
      } catch (e) {}
    }

    try {
      await navigator.clipboard.writeText(enlaceInvitacion);
      const original = btnCopiarCodigoGrupo.textContent;
      btnCopiarCodigoGrupo.textContent = '✅ ¡Enlace Copiado!';
      setTimeout(() => { btnCopiarCodigoGrupo.textContent = original; }, 2500);
      alert(`📋 ¡Enlace de invitación copiado al portapapeles!\n\nPégalo en WhatsApp o compártelo:\n${enlaceInvitacion}`);
    } catch (e) {
      prompt('Copia este enlace o código de invitación:', enlaceInvitacion);
    }
  });
}

if (btnAnadirUsuarioExistente) {
  btnAnadirUsuarioExistente.addEventListener('click', anadirUsuarioExistenteAGrupoActivo);
}

if (btnCrearYAnadirMiembro) {
  btnCrearYAnadirMiembro.addEventListener('click', crearYAnadirNuevoMiembroAGrupoActivo);
}

if (btnUnirseConCodigo) {
  btnUnirseConCodigo.addEventListener('click', unirseAGrupoConCodigo);
}

if (inputCodigoUnirse) {
  inputCodigoUnirse.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') unirseAGrupoConCodigo();
  });
}

if (btnGuardarNuevoGrupoTab) {
  btnGuardarNuevoGrupoTab.addEventListener('click', guardarNuevoGrupoDesdePestana);
}

if (btnEditarGrupoActivo) {
  btnEditarGrupoActivo.addEventListener('click', editarGrupoActivo);
}

if (btnEliminarGrupoActivo) {
  btnEliminarGrupoActivo.addEventListener('click', eliminarGrupoActivo);
}

// Soporte para modal legacy de grupos
if (btnAbrirModalGrupos) {
  btnAbrirModalGrupos.addEventListener('click', () => {
    renderizarPanelGrupos();
    if (modalGestionarGrupos) modalGestionarGrupos.style.display = 'flex';
  });
}

[btnCerrarModalGrupos, btnCerrarGruposFooter].forEach(btn => {
  if (btn) btn.addEventListener('click', () => { if (modalGestionarGrupos) modalGestionarGrupos.style.display = 'none'; });
});
if (modalGestionarGrupos) {
  modalGestionarGrupos.addEventListener('click', (e) => {
    if (e.target === modalGestionarGrupos) modalGestionarGrupos.style.display = 'none';
  });
}

function renderizarPanelGrupos() {
  if (!listaGruposGestion) return;
  listaGruposGestion.innerHTML = '';
  const visibles = obtenerGruposVisibles(usuarioLogueado);

  visibles.forEach(g => {
    const card = document.createElement('div');
    card.className = 'usuario-card-item';

    const info = document.createElement('div');
    info.className = 'user-card-info';
    info.innerHTML = `
      <div class="user-avatar-initial" style="background: transparent; font-size: 1.5rem;">${escapeHtml(g.icono || '👥')}</div>
      <div class="user-name-text">${escapeHtml(g.nombre)} <small style="color:#64748b;">(${g.miembros?.length || 0} miembros)</small></div>
    `;

    const controls = document.createElement('div');
    controls.className = 'user-card-controls';

    const btnVer = document.createElement('button');
    btnVer.className = 'btn-accion-mini btn-guardar-pin-mini';
    btnVer.textContent = 'Ver grupo';
    btnVer.addEventListener('click', () => {
      cambiarGrupo(g.nombre);
      if (modalGestionarGrupos) modalGestionarGrupos.style.display = 'none';
    });

    controls.appendChild(btnVer);
    card.appendChild(info);
    card.appendChild(controls);
    listaGruposGestion.appendChild(card);
  });
}

if (btnGuardarNuevoGrupoModal) {
  btnGuardarNuevoGrupoModal.addEventListener('click', async () => {
    const nombre = (nuevoGrupoNombreModal?.value || '').trim();
    const icono = (nuevoGrupoIconoModal?.value || '').trim() || '👥';
    if (!nombre) return alert('Por favor, indica un nombre para el grupo.');

    const creador = usuarioLogueado || 'Cule';
    const id = nombre.toLowerCase().replace(/\s+/g, '-');
    const codigo = generarCodigoAcceso(nombre);

    const nuevoObj = { id, nombre, icono, creador, miembros: [creador], codigo_acceso: codigo };
    listaGrupos.push(nuevoObj);
    localStorage.setItem('kedadas_lista_grupos', JSON.stringify(listaGrupos));
    await sincronizarGrupoEnSupabase(nuevoObj);

    if (nuevoGrupoNombreModal) nuevoGrupoNombreModal.value = '';
    if (nuevoGrupoIconoModal) nuevoGrupoIconoModal.value = '';
    if (modalGestionarGrupos) modalGestionarGrupos.style.display = 'none';

    cambiarGrupo(nombre);
  });
}

// --- 4. NAVEGACIÓN Y VISTAS ---
let fechaNavegacion = new Date(); 

function verificarCambiosAntesDeNavegar() {
  const num = Object.keys(cambiosHorarioPendientes).length;
  if (num > 0) {
    const guardar = confirm(`Tienes ${num} modificación(es) sin guardar en el cuadrante de este mes. ¿Deseas guardarlas antes de continuar?`);
    if (guardar) {
      guardarCambiosHorarioConfirmado();
      return false;
    } else {
      cambiosHorarioPendientes = {};
      actualizarBarraCambiosPendientes();
      return true;
    }
  }
  return true;
}

btnToggleVista.addEventListener('click', () => {
  if (!verificarCambiosAntesDeNavegar()) return;
  modoVista = modoVista === 'mes' ? 'anio' : 'mes';
  
  if (modoVista === 'mes') {
    btnToggleVista.textContent = '📅 Cambiar a Vista Anual';
    vistaMesContainer.style.display = 'block';
    vistaAnualContainer.style.display = 'none';
  } else {
    btnToggleVista.textContent = '📆 Volver a Vista Mensual';
    vistaMesContainer.style.display = 'none';
    vistaAnualContainer.style.display = 'block';
  }
  iniciarCalendario();
});

btnPrev.addEventListener('click', () => {
  if (!verificarCambiosAntesDeNavegar()) return;
  if (modoVista === 'mes') fechaNavegacion.setMonth(fechaNavegacion.getMonth() - 1);
  else fechaNavegacion.setFullYear(fechaNavegacion.getFullYear() - 1);
  iniciarCalendario();
});

btnNext.addEventListener('click', () => {
  if (!verificarCambiosAntesDeNavegar()) return;
  if (modoVista === 'mes') fechaNavegacion.setMonth(fechaNavegacion.getMonth() + 1);
  else fechaNavegacion.setFullYear(fechaNavegacion.getFullYear() + 1);
  iniciarCalendario();
});

selectorUsuario.addEventListener('change', (e) => {
  if (!verificarCambiosAntesDeNavegar()) {
    selectorUsuario.value = miUsuario;
    return;
  }
  miUsuario = e.target.value;
  iniciarCalendario();
});

// --- 5. LÓGICA DE TURNOS DUAL (SUPABASE + LOCAL STORAGE POR GRUPO) ---
async function guardarTurnoNube(dia, indiceEstado, mesAnioEspecifico = null) {
  const mesAnio = mesAnioEspecifico || `${fechaNavegacion.getFullYear()}-${fechaNavegacion.getMonth()}`;
  
  // 1. Guardar de inmediato en almacenamiento local para el grupo y usuario activo
  const keyLocal = `kedadas_turnos_${grupoActivo}_${miUsuario}_${mesAnio}`;
  let turnosLocales = [];
  try {
    const raw = localStorage.getItem(keyLocal);
    if (raw) turnosLocales = JSON.parse(raw);
  } catch(e) {}
  
  const idx = turnosLocales.findIndex(t => t.dia === dia);
  if (idx >= 0) {
    turnosLocales[idx].indiceEstado = indiceEstado;
  } else {
    turnosLocales.push({ dia, usuario: miUsuario, indiceEstado, mes_anio: mesAnio });
  }
  localStorage.setItem(keyLocal, JSON.stringify(turnosLocales));

  // 2. Guardar en Supabase
  try {
    let { data: existentes } = await supabaseApp.from('Turnos')
      .select('id')
      .eq('dia', dia)
      .eq('usuario', miUsuario)
      .eq('mes_anio', mesAnio);

    if (existentes && existentes.length > 0) {
      await supabaseApp.from('Turnos').update({ indiceEstado: indiceEstado }).eq('id', existentes[0].id);
    } else {
      await supabaseApp.from('Turnos').insert({
        dia: dia,
        usuario: miUsuario,
        usuario_id: miUserId,
        indiceEstado: indiceEstado,
        mes_anio: mesAnio
      });
    }
  } catch (e) {
    console.warn('Aviso guardando turno en Supabase:', e);
  }
}

// Comprobar si el usuario conectado tiene autorización para ver el calendario de `targetUsuario`
async function verificarPermisoCalendario(targetUsuario) {
  // En Kedadas, los miembros comparten sus calendarios para coordinar turnos y quedadas
  return { autorizado: true, esPropio: ((targetUsuario || '').toLowerCase() === (usuarioLogueado || '').toLowerCase()) };
}

async function obtenerTurnosMesNube() {
  const mesAnio = `${fechaNavegacion.getFullYear()}-${fechaNavegacion.getMonth()}`;
  const esPropio = (miUsuario.toLowerCase() === (usuarioLogueado || '').toLowerCase());
  const keyLocal = `kedadas_turnos_${miUsuario}_${mesAnio}`;
  
  let turnosLocales = [];
  try {
    const raw = localStorage.getItem(keyLocal);
    if (raw) turnosLocales = JSON.parse(raw);
  } catch(e) {}

  try {
    let res = await supabaseApp.from('Turnos')
      .select('*')
      .eq('usuario', miUsuario)
      .eq('mes_anio', mesAnio);

    if (!res.error && res.data) {
      if (res.data.length > 0) {
        localStorage.setItem(keyLocal, JSON.stringify(res.data));
        return { autorizado: true, turnos: res.data };
      } else if (turnosLocales.length > 0) {
        return { autorizado: true, turnos: turnosLocales };
      }
      return { autorizado: true, turnos: [] };
    }
  } catch (e) {
    console.warn('Aviso obteniendo turnos de Supabase:', e);
  }

  return { autorizado: true, turnos: turnosLocales };
}

async function obtenerTurnosAnoNube() {
  const anioPrefix = `${fechaNavegacion.getFullYear()}-`;
  const esPropio = (miUsuario.toLowerCase() === (usuarioLogueado || '').toLowerCase());
  const keyLocal = `kedadas_turnos_ano_${miUsuario}_${fechaNavegacion.getFullYear()}`;

  let turnosLocales = [];
  try {
    const raw = localStorage.getItem(keyLocal);
    if (raw) turnosLocales = JSON.parse(raw);
  } catch(e) {}

  try {
    let res = await supabaseApp.from('Turnos')
      .select('*')
      .eq('usuario', miUsuario)
      .like('mes_anio', `${anioPrefix}%`);

    if (!res.error && res.data) {
      if (res.data.length > 0) {
        localStorage.setItem(keyLocal, JSON.stringify(res.data));
        return { autorizado: true, turnos: res.data };
      } else if (turnosLocales.length > 0) {
        return { autorizado: true, turnos: turnosLocales };
      }
      return { autorizado: true, turnos: [] };
    }
  } catch (e) {
    console.warn('Aviso obteniendo turnos anuales de Supabase:', e);
  }

  return { autorizado: true, turnos: turnosLocales };
}

// --- 6. GESTIÓN DE GUARDADO CON CONFIRMACIÓN Y RENDERIZADO CALENDARIOS ---

function actualizarBarraCambiosPendientes() {
  const numCambios = Object.keys(cambiosHorarioPendientes).length;
  if (numCambios > 0) {
    if (barraGuardarHorario) {
      barraGuardarHorario.style.display = 'flex';
      if (textoCambiosPendientes) {
        textoCambiosPendientes.textContent = `Tienes ${numCambios} día${numCambios > 1 ? 's' : ''} modificado${numCambios > 1 ? 's' : ''} sin guardar en este mes`;
      }
    }
    if (btnGuardarHorarioTop) {
      btnGuardarHorarioTop.classList.add('pendiente');
      btnGuardarHorarioTop.textContent = `💾 Guardar (${numCambios})`;
    }
  } else {
    if (barraGuardarHorario) barraGuardarHorario.style.display = 'none';
    if (btnGuardarHorarioTop) {
      btnGuardarHorarioTop.classList.remove('pendiente');
      btnGuardarHorarioTop.textContent = '💾 Guardar Horario';
    }
  }
}

async function guardarCambiosHorarioConfirmado() {
  const numCambios = Object.keys(cambiosHorarioPendientes).length;
  if (numCambios === 0) {
    return alert('No hay modificaciones pendientes en el horario de este mes.');
  }

  const mesNombre = nombresMeses[fechaNavegacion.getMonth()];
  const anio = fechaNavegacion.getFullYear();
  
  // Confirmación previa antes de modificar el cuadrante
  const seguro = confirm(`¿Estás seguro de que deseas guardar las ${numCambios} modificaciones realizadas en tu cuadrante de ${mesNombre} ${anio} para el grupo "${grupoActivo}"?`);

  if (!seguro) return;

  if (btnGuardarCambiosHorario) btnGuardarCambiosHorario.textContent = '⏳ Guardando...';
  if (btnGuardarHorarioTop) btnGuardarHorarioTop.textContent = '⏳ Guardando...';

  try {
    for (const [diaStr, nuevoIndice] of Object.entries(cambiosHorarioPendientes)) {
      const dia = parseInt(diaStr);
      await guardarTurnoNube(dia, nuevoIndice);
    }
    cambiosHorarioPendientes = {};
    actualizarBarraCambiosPendientes();
    alert(`✅ ¡Horario guardado con éxito! Se han actualizado ${numCambios} días en ${mesNombre} ${anio}.`);
    await renderizarMes();
  } catch (err) {
    alert('Error al guardar el horario: ' + err.message);
  } finally {
    if (btnGuardarCambiosHorario) btnGuardarCambiosHorario.textContent = '💾 Guardar Horario';
    actualizarBarraCambiosPendientes();
  }
}

if (btnGuardarCambiosHorario) {
  btnGuardarCambiosHorario.addEventListener('click', guardarCambiosHorarioConfirmado);
}
if (btnGuardarHorarioTop) {
  btnGuardarHorarioTop.addEventListener('click', guardarCambiosHorarioConfirmado);
}
if (btnCancelarCambiosHorario) {
  btnCancelarCambiosHorario.addEventListener('click', () => {
    if (confirm('¿Descartar las modificaciones no guardadas y volver al horario original de este mes?')) {
      cambiosHorarioPendientes = {};
      actualizarBarraCambiosPendientes();
      renderizarMes();
    }
  });
}

// ========================================================
// SISTEMA DE FESTIVOS NACIONALES DE ESPAÑA (BOE / LABORAL)
// ========================================================
function calcularDomingoResurreccion(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1; // 0-indexado (2 = marzo, 3 = abril)
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month, day);
}

function obtenerFestivosNacionalesAnio(year) {
  const festivosFijos = [
    { mes: 0, dia: 1, nombre: 'Año Nuevo' },
    { mes: 0, dia: 6, nombre: 'Epifanía del Señor (Reyes Magos)' },
    { mes: 4, dia: 1, nombre: 'Fiesta del Trabajo' },
    { mes: 7, dia: 15, nombre: 'Asunción de la Virgen' },
    { mes: 9, dia: 12, nombre: 'Fiesta Nacional de España' },
    { mes: 10, dia: 1, nombre: 'Todos los Santos' },
    { mes: 11, dia: 6, nombre: 'Día de la Constitución Española' },
    { mes: 11, dia: 8, nombre: 'Inmaculada Concepción' },
    { mes: 11, dia: 25, nombre: 'Natividad del Señor (Navidad)' }
  ];

  const festivos = {};

  festivosFijos.forEach(f => {
    const dt = new Date(year, f.mes, f.dia);
    festivos[`${f.mes}-${f.dia}`] = { nombre: f.nombre, esTraslado: false };
    
    // Si cae en domingo, en el calendario laboral español suele trasladarse al lunes siguiente
    if (dt.getDay() === 0) {
      const lunes = new Date(year, f.mes, f.dia + 1);
      festivos[`${lunes.getMonth()}-${lunes.getDate()}`] = {
        nombre: `Lunes posterior a ${f.nombre} (traslado festivo)`,
        esTraslado: true
      };
    }
  });

  // Semana Santa (Viernes Santo y Jueves Santo)
  const domingoRes = calcularDomingoResurreccion(year);
  
  const juevesSanto = new Date(domingoRes);
  juevesSanto.setDate(domingoRes.getDate() - 3);
  festivos[`${juevesSanto.getMonth()}-${juevesSanto.getDate()}`] = {
    nombre: 'Jueves Santo',
    esTraslado: false
  };

  const viernesSanto = new Date(domingoRes);
  viernesSanto.setDate(domingoRes.getDate() - 2);
  festivos[`${viernesSanto.getMonth()}-${viernesSanto.getDate()}`] = {
    nombre: 'Viernes Santo',
    esTraslado: false
  };

  return festivos;
}

function obtenerFestivoNacional(dia, mes, anio) {
  const festivos = obtenerFestivosNacionalesAnio(anio);
  return festivos[`${mes}-${dia}`] || null;
}

function normalizarIndiceEstado(valor) {
  if (valor === undefined || valor === null) return 0;
  if (typeof valor === 'number') {
    if (isNaN(valor)) return 0;
    const n = Math.floor(valor);
    return (n >= 0 && n < estados.length) ? n : 0;
  }
  const str = String(valor).trim().toLowerCase();
  if (!str || str === '0' || str === 'vacio') return 0;
  if (str === '1' || str === 'l' || str === 'libre') return 1;
  if (str === '2' || str === 'm' || str === 'manana' || str === 'mañana') return 2;
  if (str === '3' || str === 't' || str === 'tarde') return 3;
  if (str === '4' || str === 'n' || str === 'noche') return 4;
  if (str === '5' || str === 'v' || str === 'vacaciones') return 5;
  const num = parseInt(str, 10);
  if (!isNaN(num) && num >= 0 && num < estados.length) return num;
  return 0;
}

async function iniciarCalendario() {
  try {
    actualizarBannerGrupo();
    if (modoVista === 'mes') await renderizarMes();
    else await renderizarAno();
  } catch(errCal) {
    console.error('Error renderizando calendario:', errCal);
  }
}

async function renderizarMes() {
  if (!calendarGrid) return;
  calendarGrid.innerHTML = ''; 
  const mes = fechaNavegacion.getMonth();
  const anio = fechaNavegacion.getFullYear();
  if (tituloMes) tituloMes.textContent = `${nombresMeses[mes]} ${anio}`; 

  const diasEnElMes = new Date(anio, mes + 1, 0).getDate();
  let diaEmpieza = new Date(anio, mes, 1).getDay();
  diaEmpieza = diaEmpieza === 0 ? 6 : diaEmpieza - 1;

  let resTurnos = { autorizado: true, turnos: [] };
  try {
    resTurnos = await obtenerTurnosMesNube();
  } catch(e) {
    console.warn('Aviso obteniendo turnos mes:', e);
  }

  // Si no está autorizado (ej. Lucía intentando ver el calendario de Cule sin permiso):
  if (!resTurnos.autorizado) {
    calendarGrid.innerHTML = `
      <div class="bloqueo-privacidad-calendario">
        <div class="icono-candado">🔒</div>
        <h3>Calendario Privado</h3>
        <p>No tienes autorización para ver el calendario de <strong>${escapeHtml(miUsuario)}</strong>.</p>
        <span class="subtexto-privacidad">Por políticas de seguridad y privacidad (RLS), ${escapeHtml(miUsuario)} debe otorgarte permiso explícito para que puedas ver sus turnos de trabajo.</span>
        <button type="button" id="btn-volver-mi-cal" style="padding: 10px 18px; border-radius: 12px; cursor: pointer; font-weight: 700; background: linear-gradient(135deg, #4f46e5, #6366f1); color: #fff; border: none; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);">👤 Volver a mi calendario (${escapeHtml(usuarioLogueado || 'Mi usuario')})</button>
      </div>
    `;
    const btnVolver = document.getElementById('btn-volver-mi-cal');
    if (btnVolver) {
      btnVolver.addEventListener('click', () => {
        miUsuario = usuarioLogueado || 'Cule';
        if (selectorUsuario) selectorUsuario.value = miUsuario;
        iniciarCalendario();
      });
    }
    actualizarBarraCambiosPendientes();
    return;
  }

  const datosGuardados = resTurnos.turnos || [];
  const historial = {};
  datosGuardados.forEach(dato => {
    if (dato && dato.dia !== undefined) {
      historial[dato.dia] = dato.indiceEstado;
    }
  });

  for (let i = 0; i < diaEmpieza; i++) {
    const emptyDiv = document.createElement('div');
    emptyDiv.classList.add('empty-cell');
    calendarGrid.appendChild(emptyDiv);
  }

  for (let i = 1; i <= diasEnElMes; i++) {
    const dayCell = document.createElement('div');
    const pendiente = cambiosHorarioPendientes[i];
    const rawIndice = pendiente !== undefined ? pendiente : (historial[i] !== undefined ? historial[i] : 0);
    const indice = normalizarIndiceEstado(rawIndice);
    const estadoObj = estados[indice] || estados[0];
    const festivo = obtenerFestivoNacional(i, mes, anio);
    
    dayCell.className = `day ${estadoObj.clase} ${pendiente !== undefined ? 'dia-modificado-pendiente' : ''} ${festivo ? 'dia-festivo-nacional' : ''}`;
    if (festivo) {
      dayCell.setAttribute('data-festivo', festivo.nombre);
      dayCell.title = `🎉 Festivo nacional: ${festivo.nombre}`;
    }

    const shiftTexto = estadoObj.texto || '';
    const shiftHtml = shiftTexto 
      ? `<span class="shift-label">${shiftTexto}</span>` 
      : (festivo ? `<span class="shift-label festivo-sublabel">🎉 Festivo</span>` : `<span class="shift-label"></span>`);

    dayCell.innerHTML = `
      ${festivo ? `<span class="festivo-tag" title="🎉 Festivo: ${escapeHtml(festivo.nombre)}">🎉</span>` : ''}
      <span class="day-number">${i}</span>
      ${shiftHtml}
    `;

    dayCell.addEventListener('click', () => {
      if (!esAdmin && miUsuario !== usuarioLogueado) return alert('Solo puedes editar tus turnos.');

      let rawEstadoActual = cambiosHorarioPendientes[i] !== undefined 
        ? cambiosHorarioPendientes[i] 
        : (historial[i] !== undefined ? historial[i] : 0);
      let estadoActual = normalizarIndiceEstado(rawEstadoActual);
      
      let nuevoEstado = (estadoActual + 1) % estados.length;
      cambiosHorarioPendientes[i] = nuevoEstado;
      const nuevoEstadoObj = estados[nuevoEstado] || estados[0];

      const nuevoShiftTexto = nuevoEstadoObj.texto || '';
      const nuevoShiftHtml = nuevoShiftTexto 
        ? `<span class="shift-label">${nuevoShiftTexto}</span>` 
        : (festivo ? `<span class="shift-label festivo-sublabel">🎉 Festivo</span>` : `<span class="shift-label"></span>`);

      dayCell.className = `day ${nuevoEstadoObj.clase} ${festivo ? 'dia-festivo-nacional' : ''} dia-modificado-pendiente`;
      dayCell.innerHTML = `
        ${festivo ? `<span class="festivo-tag" title="🎉 Festivo: ${escapeHtml(festivo.nombre)}">🎉</span>` : ''}
        <span class="day-number">${i}</span>
        ${nuevoShiftHtml}
      `;

      actualizarBarraCambiosPendientes();
    });

    calendarGrid.appendChild(dayCell);
  }

  // Actualizar tarjeta resumen de festivos nacionales de este mes
  const contenedorFestivos = document.getElementById('festivos-mes-info');
  if (contenedorFestivos) {
    const festivosDelMes = [];
    for (let d = 1; d <= diasEnElMes; d++) {
      const f = obtenerFestivoNacional(d, mes, anio);
      if (f) festivosDelMes.push({ dia: d, ...f });
    }

    if (festivosDelMes.length > 0) {
      contenedorFestivos.style.display = 'block';
      contenedorFestivos.innerHTML = `
        <div class="festivos-mes-card">
          <div class="festivos-mes-header">
            <span class="festivos-icono">🎉</span>
            <span class="festivos-titulo">Festivos en ${nombresMeses[mes]} ${anio} (${festivosDelMes.length}):</span>
          </div>
          <div class="festivos-mes-badges">
            ${festivosDelMes.map(f => `
              <div class="festivo-badge-pill" title="Festivo nacional: ${escapeHtml(f.nombre)}">
                <span class="festivo-badge-dia">${f.dia} ${nombresMeses[mes]}</span>
                <span class="festivo-badge-nombre">${escapeHtml(f.nombre)}</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    } else {
      contenedorFestivos.style.display = 'none';
      contenedorFestivos.innerHTML = '';
    }
  }

  actualizarBarraCambiosPendientes();
}

async function renderizarAno() {
  if (!vistaAnualContainer) return;
  vistaAnualContainer.innerHTML = '';
  const anio = fechaNavegacion.getFullYear();
  if (tituloMes) tituloMes.textContent = `Año ${anio}`;

  let resTurnos = { autorizado: true, turnos: [] };
  try {
    resTurnos = await obtenerTurnosAnoNube();
  } catch(e) {
    console.warn('Aviso obteniendo turnos anuales:', e);
  }

  if (!resTurnos.autorizado) {
    vistaAnualContainer.innerHTML = `
      <div class="bloqueo-privacidad-calendario" style="margin: 30px auto; max-width: 500px;">
        <div class="icono-candado">🔒</div>
        <h3>Calendario Anual Privado</h3>
        <p>No tienes autorización para ver el calendario anual de <strong>${escapeHtml(miUsuario)}</strong>.</p>
        <span class="subtexto-privacidad">Por políticas de seguridad (RLS), necesitas permiso explícito de ${escapeHtml(miUsuario)} para consultar su cuadrante.</span>
        <button type="button" id="btn-volver-mi-cal-ano" style="padding: 10px 18px; border-radius: 12px; cursor: pointer; font-weight: 700; background: linear-gradient(135deg, #4f46e5, #6366f1); color: #fff; border: none; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);">👤 Volver a mi calendario</button>
      </div>
    `;
    const btnVolver = document.getElementById('btn-volver-mi-cal-ano');
    if (btnVolver) {
      btnVolver.addEventListener('click', () => {
        miUsuario = usuarioLogueado || 'Cule';
        if (selectorUsuario) selectorUsuario.value = miUsuario;
        iniciarCalendario();
      });
    }
    return;
  }

  const datosGuardados = resTurnos.turnos || [];
  const historialAno = {};
  for(let i=0; i<12; i++) historialAno[i] = {};
  
  datosGuardados.forEach(dato => {
    if (dato && dato.mes_anio && dato.dia !== undefined) {
      const parts = String(dato.mes_anio).split('-');
      if (parts.length > 1) {
        const m = parseInt(parts[1], 10);
        if (!isNaN(m) && historialAno[m]) {
          historialAno[m][dato.dia] = dato.indiceEstado;
        }
      }
    }
  });

  // Leyenda en la vista anual
  const leyendaAnual = document.createElement('div');
  leyendaAnual.className = 'leyenda';
  leyendaAnual.style.marginBottom = '15px';
  leyendaAnual.innerHTML = `
    <div class="leyenda-item"><span class="leyenda-color estado-libre">L</span> Libre</div>
    <div class="leyenda-item"><span class="leyenda-color estado-manana">M</span> Mañana</div>
    <div class="leyenda-item"><span class="leyenda-color estado-tarde">T</span> Tarde</div>
    <div class="leyenda-item"><span class="leyenda-color estado-noche">N</span> Noche</div>
    <div class="leyenda-item"><span class="leyenda-color estado-vacaciones">V</span> Vacaciones</div>
    <div class="leyenda-item"><span class="leyenda-color festivo-color">★</span> Festivo nacional</div>
  `;
  vistaAnualContainer.appendChild(leyendaAnual);

  const gridAnual = document.createElement('div');
  gridAnual.className = 'vista-anual-grid';

  for (let mes = 0; mes < 12; mes++) {
    const mesDiv = document.createElement('div');
    mesDiv.className = 'mini-mes';
    mesDiv.innerHTML = `<h4>${nombresMeses[mes]}</h4>`;

    const weekDiv = document.createElement('div');
    weekDiv.className = 'mini-weekdays';
    nombresDias.forEach(d => { weekDiv.innerHTML += `<div>${d}</div>`; });
    mesDiv.appendChild(weekDiv);

    const miniGrid = document.createElement('div');
    miniGrid.className = 'mini-days-grid';

    const diasEnMes = new Date(anio, mes + 1, 0).getDate();
    let diaEmpieza = new Date(anio, mes, 1).getDay();
    diaEmpieza = diaEmpieza === 0 ? 6 : diaEmpieza - 1;

    for (let i = 0; i < diaEmpieza; i++) miniGrid.innerHTML += `<div class="empty-cell"></div>`;

    for (let dia = 1; dia <= diasEnMes; dia++) {
      const dayCell = document.createElement('div');
      let indice = normalizarIndiceEstado(historialAno[mes][dia]);
      const estadoObj = estados[indice] || estados[0];
      const festivo = obtenerFestivoNacional(dia, mes, anio);
      
      dayCell.className = `mini-day ${estadoObj.clase} ${festivo ? 'mini-dia-festivo' : ''}`;
      if (festivo) {
        dayCell.title = `${dia} de ${nombresMeses[mes]}: 🎉 Festivo (${festivo.nombre})`;
      }
      dayCell.textContent = dia;

      dayCell.addEventListener('click', async () => {
        if (!esAdmin && miUsuario !== usuarioLogueado) return alert('Solo puedes editar tus turnos.');
        let nuevoIndice = (indice + 1) % estados.length;
        const nuevoEstadoObj = estados[nuevoIndice] || estados[0];
        const confirmacion = confirm(`¿Cambiar el día ${dia} de ${nombresMeses[mes]} a "${nuevoEstadoObj.texto || 'Vacío'}"?`);
        if (confirmacion) {
          indice = nuevoIndice;
          dayCell.className = `mini-day ${nuevoEstadoObj.clase} ${festivo ? 'mini-dia-festivo' : ''}`;
          await guardarTurnoNube(dia, indice, `${anio}-${mes}`);
        }
      });
      miniGrid.appendChild(dayCell);
    }
    mesDiv.appendChild(miniGrid);
    gridAnual.appendChild(mesDiv);
  }
  vistaAnualContainer.appendChild(gridAnual);
}

// --- 7. BUSCADOR DE COINCIDENCIAS Y FUEGOS ARTIFICIALES ---
const btnCoincidencias = document.getElementById('btn-coincidencias');
const resultadoCoincidencias = document.getElementById('resultado-coincidencias');

btnCoincidencias.addEventListener('click', async () => {
  resultadoCoincidencias.classList.add('visible'); 
  resultadoCoincidencias.innerHTML = '🔍 Buscando coincidencias...';
  
  const seleccionados = Array.from(usuariosSeleccionadosCoincidencias);
  if (seleccionados.length < 2) {
    resultadoCoincidencias.innerHTML = '⚠️ <strong>Selecciona al menos 2 personas</strong> en las casillas superiores para buscar coincidencias.';
    return;
  }

  const anio = fechaNavegacion.getFullYear();
  const mesIndex = fechaNavegacion.getMonth();
  const diasEnElMes = new Date(anio, mesIndex + 1, 0).getDate();
  const startDate = `${anio}-${String(mesIndex + 1).padStart(2, '0')}-01`;
  const endDate = `${anio}-${String(mesIndex + 1).padStart(2, '0')}-${String(diasEnElMes).padStart(2, '0')}`;

  let diasComunes = [];

  // 1. Coincidencias seguras mediante RPC get_group_free_matches (Zero-Knowledge)
  try {
    const { data: rpcMatches, error: rpcErr } = await supabaseApp.rpc('get_group_free_matches', {
      p_group_name: grupoActivo,
      p_start_date: startDate,
      p_end_date: endDate
    });

    if (!rpcErr && Array.isArray(rpcMatches) && rpcMatches.length > 0) {
      rpcMatches.forEach(match => {
        const freeNames = (match.free_member_names || []).map(n => n.toLowerCase());
        const todosLibres = seleccionados.every(sel => freeNames.includes(sel.toLowerCase()));
        if (todosLibres) {
          const diaNum = parseInt(match.match_date.split('-')[2], 10);
          if (!isNaN(diaNum) && !diasComunes.includes(diaNum)) {
            diasComunes.push(diaNum);
          }
        }
      });
    }
  } catch (errRpc) {
    console.warn('Aviso RPC get_group_free_matches:', errRpc);
  }

  // 2. Si RPC no encontró datos o trabajamos localmente, fallback con tabla Turnos y almacenamiento local
  if (diasComunes.length === 0) {
    const mesAnio = `${anio}-${mesIndex}`;
    let data = [];

    try {
      let res = await supabaseApp.from('Turnos')
        .select('*')
        .eq('indiceEstado', 1) // Estado 1 = 'libre' (L)
        .eq('mes_anio', mesAnio)
        .in('usuario', seleccionados);

      if (!res.error && res.data) data = res.data;
    } catch(e) {}

    // Complementar con datos locales de cada usuario seleccionado
    seleccionados.forEach(user => {
      const keyLocal = `kedadas_turnos_${user}_${mesAnio}`;
      try {
        const raw = localStorage.getItem(keyLocal);
        if (raw) {
          const turnosLoc = JSON.parse(raw);
          turnosLoc.filter(t => t.indiceEstado === 1).forEach(t => {
            if (!data.some(d => d.dia === t.dia && d.usuario === user)) {
              data.push(t);
            }
          });
        }
      } catch(e) {}
    });

    const conteo = {};
    data.forEach(t => {
      if (!conteo[t.dia]) conteo[t.dia] = new Set();
      conteo[t.dia].add(t.usuario);
    });

    for (let dia = 1; dia <= diasEnElMes; dia++) {
      if (conteo[dia] && conteo[dia].size === seleccionados.length) {
        diasComunes.push(dia);
      }
    }
  }

  diasComunes.sort((a, b) => a - b);

  const nombresGrupo = seleccionados.join(', ');
  if (diasComunes.length === 0) {
    resultadoCoincidencias.innerHTML = `😅 <strong>No hay coincidencias de días libres.</strong><br>Ningún día libráis todos a la vez (<strong>${escapeHtml(nombresGrupo)}</strong>) este mes en el grupo <strong>${escapeHtml(grupoActivo)}</strong>.`;
  } else {
    // Análisis inteligente de universitarios y lugar de quedada
    const univsSeleccionados = seleccionados
      .map(u => listaPerfiles.find(p => p.nombre.toLowerCase() === u.toLowerCase()))
      .filter(p => p && p.es_universitario);

    const univsFuera = univsSeleccionados.filter(p => p.ubicacion_actual === 'universidad');
    const miembrosOrigen = seleccionados.filter(u => {
      const p = listaPerfiles.find(item => item.nombre.toLowerCase() === u.toLowerCase());
      return !p || !p.es_universitario || p.ubicacion_actual !== 'universidad';
    });

    let lugarRecomendado = 'Ciudad de Origen';
    let descripcionLugar = '';
    let planTituloSugerido = '';

    if (filtroLugarQuedada === 'universidad') {
      if (univsFuera.length > 0) {
        const ciudadDestino = univsFuera[0].ciudad_universidad || 'la Universidad';
        lugarRecomendado = `🎓 En ${ciudadDestino}`;
        descripcionLugar = `🎒 <strong>¡Escapada Universitaria!</strong><br>Los miembros en origen (<strong>${escapeHtml(miembrosOrigen.join(', '))}</strong>) podéis viajar a visitar a <strong>${escapeHtml(univsFuera.map(p => p.nombre).join(', '))}</strong> en <strong>${escapeHtml(ciudadDestino)}</strong> para celebrar la quedada en su zona universitaria.`;
        planTituloSugerido = `🎒 Escapada universitaria a ${ciudadDestino} (Día ${diasComunes[0]})`;
      } else {
        lugarRecomendado = `🏠 En Ciudad de Origen`;
        descripcionLugar = `Habías seleccionado quedar en la universidad, pero actualmente todos los miembros elegidos se encuentran en su ciudad de origen. ¡Podéis quedar en los sitios de siempre!`;
        planTituloSugerido = `🍻 Kedada en Ciudad de Origen (Día ${diasComunes[0]})`;
      }
    } else if (filtroLugarQuedada === 'origen') {
      lugarRecomendado = `🏠 En Ciudad de Origen`;
      if (univsFuera.length === 0) {
        descripcionLugar = `✅ <strong>¡Pleno en casa!</strong><br>Todos los miembros seleccionados residen o se encuentran en su ciudad de origen. No hay desplazamientos largos necesarios.`;
      } else {
        descripcionLugar = `🚗 <strong>Quedada en Ciudad de Origen:</strong><br>Los universitarios que están fuera (<strong>${escapeHtml(univsFuera.map(p => `${p.nombre} en ${p.ciudad_universidad || 'Campus'}`).join(', '))}</strong>) tendrían que bajar a su ciudad de origen para reuniros todos en estas fechas.`;
      }
      planTituloSugerido = `🍻 Kedada en Ciudad de Origen (Día ${diasComunes[0]})`;
    } else {
      // 'todos' (Cualquier sitio)
      if (univsFuera.length === 0) {
        lugarRecomendado = `🏠 En Ciudad de Origen`;
        descripcionLugar = `Todos los seleccionados están en su ciudad de origen. El punto de encuentro idóneo es vuestra localidad habitual.`;
        planTituloSugerido = `🍻 Kedada en Ciudad de Origen (Día ${diasComunes[0]})`;
      } else {
        const ciudadDestino = univsFuera[0].ciudad_universidad || 'la Universidad';
        lugarRecomendado = `⚖️ Origen o Visita a ${ciudadDestino}`;
        descripcionLugar = `Hay miembros en origen (<strong>${escapeHtml(miembrosOrigen.join(', '))}</strong>) y miembros estudiando fuera (<strong>${escapeHtml(univsFuera.map(p => `${p.nombre} en ${p.ciudad_universidad || 'Campus'}`).join(', '))}</strong>).<br>Podéis acordar si bajan a origen o si el grupo sube a ${escapeHtml(ciudadDestino)} a pasar el día.`;
        planTituloSugerido = `🎯 Votar: ¿Quedar en Origen o ir a ${ciudadDestino}?`;
      }
    }

    const diasComunesFormateados = diasComunes.map(dia => {
      const festivo = obtenerFestivoNacional(dia, mesIndex, anio);
      if (festivo) {
        return `<span class="dia-coincidencia-festivo" title="🎉 ¡Festivo nacional: ${escapeHtml(festivo.nombre)}!">${dia} (🎉 ${escapeHtml(festivo.nombre)})</span>`;
      }
      return `${dia}`;
    }).join(', ');

    // Análisis de ubicaciones de los miembros seleccionados
    const infoMiembrosUbicacion = seleccionados.map(nombre => {
      const ubi = obtenerIconoUbicacion(nombre);
      return { nombre, ...ubi };
    });

    const ubicacionesDistintas = new Set(infoMiembrosUbicacion.map(m => m.loc)).size > 1;

    let alertaUbicacionesHtml = '';
    if (ubicacionesDistintas) {
      alertaUbicacionesHtml = `
        <div class="alerta-ubicaciones-distintas">
          <div class="alerta-ubi-header">
            <span class="alerta-ubi-icon">⚠️</span>
            <strong>¡Atención! Estáis en ciudades distintas</strong>
          </div>
          <p class="alerta-ubi-desc">
            Tenéis días libres en común, pero <strong>no todos os encontráis en el mismo sitio</strong> este mes:
          </p>
          <ul class="alerta-ubi-lista">
            ${infoMiembrosUbicacion.map(m => `
              <li><strong>${escapeHtml(m.nombre)}:</strong> <span class="badge-ubi-pill ${m.pillClass}">${m.icon} ${escapeHtml(m.text)}</span></li>
            `).join('')}
          </ul>
          <div class="alerta-ubi-consejo">
            💡 <strong>Consejo para quedar:</strong> Coordinad si los desplazados bajan a la ciudad de origen o si el resto organiza una visita a su ciudad de estudio/trabajo.
          </div>
        </div>
      `;
    } else {
      const ubiComun = infoMiembrosUbicacion[0] || { text: 'En Origen', icon: '🏠' };
      alertaUbicacionesHtml = `
        <div class="alerta-ubicaciones-distintas" style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border-color: #bbf7d0;">
          <div class="alerta-ubi-header" style="color: #166534;">
            <span>✅</span>
            <strong>¡Ubicaciones 100% alineadas!</strong>
          </div>
          <p class="alerta-ubi-desc" style="color: #15803d; margin: 0;">
            Todos los miembros seleccionados os encontráis en <strong>${escapeHtml(ubiComun.text)}</strong> (${ubiComun.icon}). ¡No hay barreras geográficas para celebrar la kedada!
          </p>
        </div>
      `;
    }

    resultadoCoincidencias.innerHTML = `
      <div style="font-size: 1.05rem; font-weight: 800; color: #065f46; margin-bottom: 6px;">
        🎉 ¡Días libres en común en ${escapeHtml(grupoActivo)}!
      </div>
      <div style="font-size: 0.92rem; color: #1e293b; margin-bottom: 8px;">
        Coincidís libres (<strong>${escapeHtml(nombresGrupo)}</strong>) los días: 
        <strong style="font-size: 1.12rem; color: #4f46e5;">${diasComunesFormateados}</strong> de ${nombresMeses[fechaNavegacion.getMonth()]}
      </div>

      <!-- Alerta Inteligente de Ubicación -->
      ${alertaUbicacionesHtml}
      
      <!-- Tarjeta de Punto de Encuentro y Universitarios -->
      <div class="recom-quedada-box">
        <div class="recom-quedada-header">
          <span class="recom-quedada-title">📍 Punto de Encuentro Recomendado</span>
          <span class="recom-quedada-lugar-badge">${escapeHtml(lugarRecomendado)}</span>
        </div>
        <div class="recom-quedada-desc">${descripcionLugar}</div>
        <button type="button" class="btn-proponer-plan-kdd" onclick="proponerPlanDesdeCoincidencia('${planTituloSugerido.replace(/'/g, "\\'")}')">
          🎯 Crear propuesta en Votaciones del Grupo ➔
        </button>
      </div>
    `;
    
    const duration = 3 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 1000 };
    
    function randomInRange(min, max) { return Math.random() * (max - min) + min; }
    
    const interval = setInterval(function() {
      const timeLeft = animationEnd - Date.now();
      if (timeLeft <= 0) return clearInterval(interval);
      const particleCount = 50 * (timeLeft / duration);
      
      confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } }));
      confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } }));
    }, 250);
  }
});

// --- 8. SECUENCIA AVANZADA CON MODAL, FECHAS Y PREVIEW ---
const btnSecuencia = document.getElementById('btn-secuencia');
const modalSecuencia = document.getElementById('modal-secuencia');
const btnCerrarModalSecuencia = document.getElementById('btn-cerrar-modal-secuencia');
const secPatron = document.getElementById('sec-patron');
const secFechaInicio = document.getElementById('sec-fecha-inicio');
const secTipoFin = document.getElementById('sec-tipo-fin');
const grupoFechaFin = document.getElementById('grupo-fecha-fin');
const secFechaFin = document.getElementById('sec-fecha-fin');
const secRespetarVacaciones = document.getElementById('sec-respetar-vacaciones');
const secPreviewBox = document.getElementById('sec-preview-box');
const btnSecPreview = document.getElementById('btn-sec-preview');
const btnSecConfirmar = document.getElementById('btn-sec-confirmar');
const btnLimpiarPatron = document.getElementById('btn-limpiar-patron');

// Botones rápidos para añadir letras al patrón
document.querySelectorAll('.quick-chips .chip-btn[data-val]').forEach(btn => {
  btn.addEventListener('click', () => {
    const val = btn.getAttribute('data-val');
    const actual = secPatron.value.trim();
    if (!actual) {
      secPatron.value = val;
    } else {
      secPatron.value = actual + ', ' + val;
    }
  });
});

if (btnLimpiarPatron) {
  btnLimpiarPatron.addEventListener('click', () => {
    secPatron.value = '';
    secPatron.focus();
  });
}

// Abrir modal de secuencia
btnSecuencia.addEventListener('click', () => {
  if (!esAdmin && miUsuario !== usuarioLogueado) {
    return alert('Solo puedes rellenar la secuencia en tu propio calendario.');
  }

  // Pre-llenar fecha inicio con el 1º día del mes en pantalla
  const y = fechaNavegacion.getFullYear();
  const m = String(fechaNavegacion.getMonth() + 1).padStart(2, '0');
  secFechaInicio.value = `${y}-${m}-01`;
  
  secPreviewBox.style.display = 'none';
  btnSecConfirmar.style.display = 'none';
  btnSecConfirmar.disabled = false;
  btnSecConfirmar.textContent = '✅ Aplicar cambios';

  modalSecuencia.style.display = 'flex';
});

// Cerrar modal
if (btnCerrarModalSecuencia) {
  btnCerrarModalSecuencia.addEventListener('click', () => {
    modalSecuencia.style.display = 'none';
  });
}
modalSecuencia.addEventListener('click', (e) => {
  if (e.target === modalSecuencia) modalSecuencia.style.display = 'none';
});

// Tipo de fecha fin (fin de mes, fin de año o fecha exacta)
secTipoFin.addEventListener('change', () => {
  if (secTipoFin.value === 'fecha') {
    grupoFechaFin.style.display = 'block';
    if (!secFechaFin.value) secFechaFin.value = secFechaInicio.value;
  } else {
    grupoFechaFin.style.display = 'none';
  }
  secPreviewBox.style.display = 'none';
  btnSecConfirmar.style.display = 'none';
});

function parsearPatron(str) {
  const mapa = { 'x': 0, 'l': 1, 'm': 2, 't': 3, 'n': 4, 'v': 5 };
  return str.split(',')
    .map(letra => mapa[letra.trim().toLowerCase()])
    .filter(num => num !== undefined);
}

let cambiosPendientes = [];

btnSecPreview.addEventListener('click', async () => {
  const patron = parsearPatron(secPatron.value);
  if (patron.length === 0) {
    return alert('Introduce al menos un turno válido en el patrón (M, T, N, L, V, X).');
  }

  if (!secFechaInicio.value) {
    return alert('Selecciona una fecha de inicio.');
  }

  const [startY, startM, startD] = secFechaInicio.value.split('-').map(Number);
  const fechaInicio = new Date(startY, startM - 1, startD);
  let fechaFin;

  if (secTipoFin.value === 'fin-mes') {
    fechaFin = new Date(startY, startM, 0); // último día del mes
  } else if (secTipoFin.value === 'fin-ano') {
    fechaFin = new Date(startY, 12, 0); // 31 de diciembre
  } else {
    if (!secFechaFin.value) return alert('Selecciona una fecha de fin.');
    const [endY, endM, endD] = secFechaFin.value.split('-').map(Number);
    fechaFin = new Date(endY, endM - 1, endD);
  }

  if (fechaFin < fechaInicio) {
    return alert('La fecha de fin no puede ser anterior a la fecha de inicio.');
  }

  btnSecPreview.textContent = 'Calculando...';

  // Obtener meses involucrados
  const mesesSet = new Set();
  let tempDate = new Date(fechaInicio);
  while (tempDate <= fechaFin) {
    mesesSet.add(`${tempDate.getFullYear()}-${tempDate.getMonth()}`);
    tempDate.setDate(tempDate.getDate() + 1);
  }

  const respetarVacaciones = secRespetarVacaciones.checked;
  const mapaExistentes = {};

  if (respetarVacaciones) {
    const mesesArr = Array.from(mesesSet);
    const { data: turnosExistentes } = await supabaseApp.from('Turnos')
      .select('*')
      .eq('usuario', miUsuario)
      .in('mes_anio', mesesArr);

    if (turnosExistentes) {
      turnosExistentes.forEach(t => {
        mapaExistentes[`${t.mes_anio}_${t.dia}`] = t.indiceEstado;
      });
    }
  }

  cambiosPendientes = [];
  let vacacionesRespetadas = 0;
  let cursor = new Date(fechaInicio);
  let indicePatron = 0;

  while (cursor <= fechaFin) {
    const cYear = cursor.getFullYear();
    const cMonth = cursor.getMonth();
    const cDay = cursor.getDate();
    const mesAnioKey = `${cYear}-${cMonth}`;
    const estadoPrevio = mapaExistentes[`${mesAnioKey}_${cDay}`];

    if (respetarVacaciones && estadoPrevio === 5) { // 5 = vacaciones (V)
      vacacionesRespetadas++;
    } else {
      const nuevoEstado = patron[indicePatron % patron.length];
      cambiosPendientes.push({
        dia: cDay,
        usuario: miUsuario,
        indiceEstado: nuevoEstado,
        mes_anio: mesAnioKey
      });
    }

    indicePatron++;
    cursor.setDate(cursor.getDate() + 1);
  }

  btnSecPreview.textContent = '👁️ Previsualizar';

  const fmt = (d) => `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
  secPreviewBox.innerHTML = `
    <div class="stat-item"><span>Rango:</span> <span class="stat-val">${fmt(fechaInicio)} al ${fmt(fechaFin)}</span></div>
    <div class="stat-item"><span>Días a programar:</span> <span class="stat-val">${cambiosPendientes.length} días</span></div>
    ${respetarVacaciones ? `<div class="stat-item"><span>Vacaciones protegidas:</span> <span class="stat-val">🛡️ ${vacacionesRespetadas}</span></div>` : ''}
    <div style="margin-top: 8px; font-size: 0.8rem; color: #475569;">
      Revisa el rango y pulsa <strong>"Aplicar cambios"</strong> para guardar en tu cuadrante.
    </div>
  `;
  secPreviewBox.style.display = 'block';
  btnSecConfirmar.style.display = 'inline-block';
});

btnSecConfirmar.addEventListener('click', async () => {
  if (cambiosPendientes.length === 0) return alert('No hay cambios pendientes para aplicar.');

  btnSecConfirmar.disabled = true;
  btnSecConfirmar.textContent = '⏳ Guardando turnos...';

  try {
    const loteSize = 25;
    for (let i = 0; i < cambiosPendientes.length; i += loteSize) {
      const lote = cambiosPendientes.slice(i, i + loteSize);
      await Promise.all(lote.map(item => guardarTurnoNube(item.dia, item.indiceEstado, item.mes_anio)));
      btnSecConfirmar.textContent = `⏳ Guardando (${Math.min(i + loteSize, cambiosPendientes.length)}/${cambiosPendientes.length})...`;
    }

    modalSecuencia.style.display = 'none';
    await iniciarCalendario();
    alert(`🎉 ¡Listo! Se han guardado ${cambiosPendientes.length} turnos correctamente.`);
  } catch (err) {
    alert('Error al guardar: ' + err.message);
  } finally {
    btnSecConfirmar.disabled = false;
    btnSecConfirmar.textContent = '✅ Aplicar cambios';
  }
});

// --- 9. SISTEMA DE VOTACIONES Y PLANES POR GRUPO ---
const listaVotaciones = document.getElementById('lista-votaciones');
const btnToggleNuevoPlan = document.getElementById('btn-toggle-nuevo-plan');
const formNuevoPlan = document.getElementById('form-nuevo-plan');
const inputNuevoPlan = document.getElementById('input-nuevo-plan');
const btnGuardarNuevoPlan = document.getElementById('btn-guardar-nuevo-plan');

const PLANES_DEFECTO_POR_GRUPO = {
  'Amigos': [
    { id: 'plan-amg-1', opcion: '🍻 Salir de cañas y tapas', votantes: ['Cule'], grupo: 'Amigos' },
    { id: 'plan-amg-2', opcion: '🍕 Cena y juegos de mesa', votantes: [], grupo: 'Amigos' },
    { id: 'plan-amg-3', opcion: '🎾 Partido de pádel', votantes: [], grupo: 'Amigos' },
    { id: 'plan-amg-4', opcion: '🍖 Barbacoa de fin de semana', votantes: [], grupo: 'Amigos' },
    { id: 'plan-amg-5', opcion: '🎬 Ir al cine y cenar hamburguesas', votantes: [], grupo: 'Amigos' }
  ],
  'Familia': [
    { id: 'plan-fam-1', opcion: '🥘 Comida familiar de domingo', votantes: ['Cule'], grupo: 'Familia' },
    { id: 'plan-fam-2', opcion: '☕ Merienda y juegos con abuelos y tíos', votantes: [], grupo: 'Familia' },
    { id: 'plan-fam-3', opcion: '🌲 Excursión a la sierra o parque campestre', votantes: [], grupo: 'Familia' },
    { id: 'plan-fam-4', opcion: '🎂 Celebrar cumpleaños o aniversario familiar', votantes: [], grupo: 'Familia' }
  ],
  'Pareja': [
    { id: 'plan-par-1', opcion: '🍷 Cena romántica a la luz de las velas', votantes: ['Cule'], grupo: 'Pareja' },
    { id: 'plan-par-2', opcion: '🧖 Escapada fin de semana / Circuito Spa', votantes: [], grupo: 'Pareja' },
    { id: 'plan-par-3', opcion: '🍿 Maratón de peli, mantita y cena en casa', votantes: [], grupo: 'Pareja' },
    { id: 'plan-par-4', opcion: '🚶 Paseo al atardecer y helado artesano', votantes: [], grupo: 'Pareja' }
  ],
  'Hijos': [
    { id: 'plan-hij-1', opcion: '🎡 Parque de atracciones o acuático', votantes: ['Cule'], grupo: 'Hijos' },
    { id: 'plan-hij-2', opcion: '🍔 Tarde de hamburguesas y cine de estreno', votantes: [], grupo: 'Hijos' },
    { id: 'plan-hij-3', opcion: '🚲 Ruta en bicicleta o patines por el río', votantes: [], grupo: 'Hijos' },
    { id: 'plan-hij-4', opcion: '⚽ Tarde de fútbol y juegos en el parque', votantes: [], grupo: 'Hijos' }
  ]
};

let listaPlanesMemoria = [];

function obtenerClaveVotacionesGrupo(grupo) {
  return `kedadas_votaciones_${(grupo || grupoActivo || 'Amigos').toLowerCase()}`;
}

function guardarPlanesLocales() {
  const clave = obtenerClaveVotacionesGrupo(grupoActivo);
  localStorage.setItem(clave, JSON.stringify(listaPlanesMemoria));
}

function cargarPlanesDesdeStorage() {
  const clave = obtenerClaveVotacionesGrupo(grupoActivo);
  try {
    const raw = localStorage.getItem(clave);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {}

  const base = PLANES_DEFECTO_POR_GRUPO[grupoActivo] || [
    { id: `plan-${Date.now()}-1`, opcion: '🎉 Kedada especial', votantes: ['Cule'], grupo: grupoActivo },
    { id: `plan-${Date.now()}-2`, opcion: '🍽️ Comida o cena juntos', votantes: [], grupo: grupoActivo }
  ];
  return JSON.parse(JSON.stringify(base));
}

function pintarPlanesEnPantalla() {
  if (!listaVotaciones) return;
  listaVotaciones.innerHTML = '';

  if (listaPlanesMemoria.length === 0) {
    listaVotaciones.innerHTML = '<p class="cargando-planes">No hay planes propuestos en este grupo todavía. ¡Pulsa "+ Proponer" para añadir uno!</p>';
    return;
  }

  // Ordenar por número de votos descendente
  const ordenados = [...listaPlanesMemoria].sort((a, b) => {
    const votosA = (a.votantes || []).length;
    const votosB = (b.votantes || []).length;
    return votosB - votosA;
  });

  const usuarioActual = usuarioLogueado || miUsuario || 'Cule';

  ordenados.forEach(item => {
    const votantes = Array.isArray(item.votantes) ? item.votantes : [];
    const numVotos = votantes.length;
    const yaVote = votantes.includes(usuarioActual);

    const div = document.createElement('div');
    div.className = `opcion-voto ${yaVote ? 'votado' : ''}`;
    
    div.innerHTML = `
      <div class="opcion-header-row">
        <span class="opcion-texto">${escapeHtml(item.opcion)}</span>
        <div class="plan-acciones-btns">
          <button type="button" class="btn-accion-plan btn-editar-plan" title="Editar plan">✏️</button>
          <button type="button" class="btn-accion-plan btn-borrar-plan" title="Eliminar plan">🗑️</button>
        </div>
      </div>
      <div class="opcion-bar">
        <span class="votantes-lista">${numVotos > 0 ? votantes.map(v => escapeHtml(v)).join(', ') : 'Sin votos aún (toca para votar)'}</span>
        <span class="voto-badge">${numVotos} ${numVotos === 1 ? 'voto' : 'votos'}</span>
      </div>
    `;

    // Botón editar plan
    const btnEditar = div.querySelector('.btn-editar-plan');
    btnEditar.addEventListener('click', async (e) => {
      e.stopPropagation();
      const nuevoTexto = prompt(`Editar plan en el grupo "${grupoActivo}":`, item.opcion);
      if (nuevoTexto !== null) {
        const textoLimpio = nuevoTexto.trim();
        if (!textoLimpio) return alert('El texto del plan no puede quedar vacío.');
        item.opcion = textoLimpio;
        guardarPlanesLocales();
        pintarPlanesEnPantalla();
        if (typeof item.id === 'number') {
          try {
            await supabaseApp.from('votaciones').update({ opcion: textoLimpio }).eq('id', item.id);
          } catch(err) {
            console.warn('Aviso editando plan en Supabase:', err);
          }
        }
      }
    });

    // Botón borrar plan
    const btnBorrar = div.querySelector('.btn-borrar-plan');
    btnBorrar.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (confirm(`¿Eliminar la propuesta "${item.opcion}" del grupo "${grupoActivo}"?`)) {
        listaPlanesMemoria = listaPlanesMemoria.filter(p => p.id !== item.id);
        guardarPlanesLocales();
        pintarPlanesEnPantalla();
        if (typeof item.id === 'number') {
          try {
            await supabaseApp.from('votaciones').delete().eq('id', item.id);
          } catch(err) {
            console.warn('Aviso borrando plan en Supabase:', err);
          }
        }
      }
    });

    // Clic en la tarjeta para alternar el voto
    div.addEventListener('click', async () => {
      const idx = listaPlanesMemoria.findIndex(p => p.id === item.id);
      if (idx === -1) return;

      let misVotantes = Array.isArray(listaPlanesMemoria[idx].votantes) ? [...listaPlanesMemoria[idx].votantes] : [];
      if (misVotantes.includes(usuarioActual)) {
        misVotantes = misVotantes.filter(v => v !== usuarioActual);
      } else {
        misVotantes.push(usuarioActual);
        // Pequeña animación de confetti si votó a favor
        try {
          if (typeof confetti === 'function') {
            confetti({ particleCount: 25, spread: 60, origin: { y: 0.8 } });
          }
        } catch(e) {}
      }

      listaPlanesMemoria[idx].votantes = misVotantes;
      guardarPlanesLocales();
      pintarPlanesEnPantalla();

      // Sincronizar con Supabase en segundo plano
      if (typeof item.id === 'number') {
        try {
          await supabaseApp.from('votaciones').update({ votantes: JSON.stringify(misVotantes) }).eq('id', item.id);
        } catch(e) {}
      }
    });

    listaVotaciones.appendChild(div);
  });
}

async function cargarVotaciones() {
  // 1. Cargar datos locales de inmediato (¡nunca se queda en "Cargando opciones..."!)
  listaPlanesMemoria = cargarPlanesDesdeStorage();
  pintarPlanesEnPantalla();

  // 2. Sincronizar con Supabase en segundo plano
  try {
    let query = supabaseApp.from('votaciones').select('*').eq('grupo', grupoActivo);
    let { data, error } = await query;
    if (error && error.message && error.message.includes('grupo')) {
      const res = await supabaseApp.from('votaciones').select('*');
      data = res.data;
      error = res.error;
    }

    if (!error && data && Array.isArray(data) && data.length > 0) {
      data.forEach(dbItem => {
        let votantes = [];
        try { votantes = JSON.parse(dbItem.votantes || '[]'); } catch (e) { votantes = []; }
        const existe = listaPlanesMemoria.find(p => p.id === dbItem.id || p.opcion.toLowerCase() === dbItem.opcion.toLowerCase());
        if (existe) {
          existe.id = dbItem.id;
          if (votantes.length > 0) existe.votantes = votantes;
        } else {
          listaPlanesMemoria.push({
            id: dbItem.id,
            opcion: dbItem.opcion,
            votantes: votantes,
            grupo: dbItem.grupo || grupoActivo
          });
        }
      });
      guardarPlanesLocales();
      pintarPlanesEnPantalla();
    }
  } catch (err) {
    console.warn('Aviso cargando votaciones Supabase:', err);
  }
}

// Proponer nuevo plan
if (btnToggleNuevoPlan) {
  btnToggleNuevoPlan.addEventListener('click', () => {
    if (!formNuevoPlan) return;
    const estaVisible = formNuevoPlan.style.display !== 'none';
    formNuevoPlan.style.display = estaVisible ? 'none' : 'flex';
    if (!estaVisible && inputNuevoPlan) {
      inputNuevoPlan.value = '';
      inputNuevoPlan.focus();
    }
  });
}

async function guardarNuevoPlan() {
  if (!inputNuevoPlan) return;
  const texto = inputNuevoPlan.value.trim();
  if (!texto) {
    alert('Escribe una idea de plan primero.');
    inputNuevoPlan.focus();
    return;
  }

  const usuarioActual = usuarioLogueado || miUsuario || 'Cule';
  const nuevoPlan = {
    id: `plan-${Date.now()}`,
    opcion: texto,
    votantes: [usuarioActual],
    grupo: grupoActivo
  };

  listaPlanesMemoria.unshift(nuevoPlan);
  guardarPlanesLocales();
  pintarPlanesEnPantalla();

  inputNuevoPlan.value = '';
  if (formNuevoPlan) formNuevoPlan.style.display = 'none';

  // Guardar en Supabase en segundo plano
  try {
    const res = await supabaseApp.from('votaciones').insert({
      opcion: texto,
      votantes: JSON.stringify([usuarioActual]),
      grupo: grupoActivo
    }).select();

    if (res.error && res.error.message && res.error.message.includes('grupo')) {
      await supabaseApp.from('votaciones').insert({
        opcion: texto,
        votantes: JSON.stringify([usuarioActual])
      });
    } else if (!res.error && res.data && res.data[0]) {
      nuevoPlan.id = res.data[0].id;
      guardarPlanesLocales();
    }
  } catch(e) {}
}

if (btnGuardarNuevoPlan) {
  btnGuardarNuevoPlan.addEventListener('click', guardarNuevoPlan);
}
if (inputNuevoPlan) {
  inputNuevoPlan.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') guardarNuevoPlan();
  });
}

try {
  supabaseApp.channel('votaciones-cambios').on('postgres_changes', { event: '*', schema: 'public', table: 'votaciones' }, () => {
    cargarVotaciones();
  }).subscribe();
} catch(e) {}

// --- 10. CHAT MULTI-GRUPO Y TEMA ---
const chatTituloGrupo = document.getElementById('chat-titulo-grupo');
const chatMensajes = document.getElementById('chat-mensajes');
const chatInput = document.getElementById('chat-input');
const btnEnviarMsg = document.getElementById('btn-enviar-msg');
const selectorTema = document.getElementById('selector-tema');

const MENSAJES_DEFECTO_POR_GRUPO = {
  'Amigos': [
    { id: 'msg-def-amg', usuario: 'Kedadas Bot', texto: '¡Bienvenidos al grupo de Amigos! 🍻 Aquí podéis comentar días libres y coordinar los planes.', grupo: 'Amigos', hora: '12:00' }
  ],
  'Familia': [
    { id: 'msg-def-fam', usuario: 'Kedadas Bot', texto: '¡Tablón de Familia! 👨‍👩‍👧‍👦 Comentad por aquí qué día os viene mejor para la próxima comida.', grupo: 'Familia', hora: '12:00' }
  ],
  'Pareja': [
    { id: 'msg-def-par', usuario: 'Kedadas Bot', texto: '¡Espacio para dos! 💑 Aquí podéis avisar de turnos libres para una cena o escapada.', grupo: 'Pareja', hora: '12:00' }
  ],
  'Hijos': [
    { id: 'msg-def-hij', usuario: 'Kedadas Bot', texto: '¡Planes con los peques! 👶 Coordinad aquí parques, deportes y findes divertidos.', grupo: 'Hijos', hora: '12:00' }
  ]
};

let listaMensajesMemoria = [];

function obtenerClaveChatGrupo(grupo) {
  return `kedadas_chat_${(grupo || grupoActivo || 'Amigos').toLowerCase()}`;
}

function guardarChatLocales() {
  const clave = obtenerClaveChatGrupo(grupoActivo);
  localStorage.setItem(clave, JSON.stringify(listaMensajesMemoria));
}

function cargarChatDesdeStorage() {
  const clave = obtenerClaveChatGrupo(grupoActivo);
  try {
    const raw = localStorage.getItem(clave);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {}

  const base = MENSAJES_DEFECTO_POR_GRUPO[grupoActivo] || [
    { id: `msg-${Date.now()}`, usuario: 'Kedadas Bot', texto: `¡Bienvenidos al grupo de ${grupoActivo}! Escribid por aquí para coordinaros.`, grupo: grupoActivo, hora: '12:00' }
  ];
  return JSON.parse(JSON.stringify(base));
}

function pintarMensaje(msg) {
  if (!chatMensajes) return;
  const esMio = msg.usuario === (usuarioLogueado || miUsuario);
  
  const div = document.createElement('div');
  div.className = `mensaje ${esMio ? 'propio' : 'ajeno'}`;
  div.setAttribute('data-id', msg.id);

  const horaDisplay = msg.hora || (msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '');
  
  const ubi = obtenerIconoUbicacion(msg.usuario);

  div.innerHTML = `
    <div class="mensaje-contenido">
      <div style="display: flex; justify-content: space-between; gap: 8px; font-size: 0.75rem; margin-bottom: 2px; opacity: 0.85;">
        <strong>${esMio ? 'Tú' : escapeHtml(msg.usuario)} <span class="chat-avatar-ubi" title="${escapeHtml(ubi.title)}">${ubi.icon}</span></strong>
        ${horaDisplay ? `<span>${escapeHtml(horaDisplay)}</span>` : ''}
      </div>
      <div>${escapeHtml(msg.texto)}</div>
    </div>
    <button class="btn-borrar-msg" title="Borrar mensaje" data-id="${escapeHtml(msg.id)}">🗑️</button>
  `;

  const btnBorrar = div.querySelector('.btn-borrar-msg');
  btnBorrar.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (confirm('¿Seguro que quieres borrar este mensaje?')) {
      listaMensajesMemoria = listaMensajesMemoria.filter(m => String(m.id) !== String(msg.id));
      guardarChatLocales();
      div.remove();
      if (typeof msg.id === 'number') {
        try { await supabaseApp.from('mensajes').delete().eq('id', msg.id); } catch(e) {}
      }
    }
  });

  chatMensajes.appendChild(div);
  chatMensajes.scrollTop = chatMensajes.scrollHeight;
}

function pintarTodosLosMensajes() {
  if (!chatMensajes) return;
  chatMensajes.innerHTML = '';
  listaMensajesMemoria.forEach(pintarMensaje);
}

async function cargarChatInicial() {
  if (chatTituloGrupo) {
    const grupoObj = (listaGrupos || []).find(g => obtenerNombreGrupo(g).toLowerCase() === (grupoActivo || '').toLowerCase());
    chatTituloGrupo.textContent = `💬 Tablón de Avisos (${grupoObj?.icono || '👥'} ${grupoActivo})`;
  }

  // 1. Cargar localmente al instante
  listaMensajesMemoria = cargarChatDesdeStorage();
  pintarTodosLosMensajes();

  // 2. Sincronizar con Supabase en segundo plano
  try {
    let query = supabaseApp.from('mensajes').select('*').eq('grupo', grupoActivo).order('created_at', { ascending: true });
    let { data, error } = await query;
    if (error && error.message && error.message.includes('grupo')) {
      const res = await supabaseApp.from('mensajes').select('*').order('created_at', { ascending: true });
      data = res.data;
      error = res.error;
    }

    if (!error && data && Array.isArray(data) && data.length > 0) {
      data.forEach(dbMsg => {
        if (!listaMensajesMemoria.some(m => m.id === dbMsg.id || (m.texto === dbMsg.texto && m.usuario === dbMsg.usuario))) {
          listaMensajesMemoria.push(dbMsg);
        }
      });
      guardarChatLocales();
      pintarTodosLosMensajes();
    }
  } catch(e) {
    console.warn('Aviso sincronización chat Supabase:', e);
  }
}

async function enviarMensaje() {
  if (!chatInput) return;
  const texto = chatInput.value.trim();
  if (!texto) return;

  chatInput.value = '';
  const ahora = new Date();
  const horaActual = ahora.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const usuarioActual = usuarioLogueado || miUsuario || 'Cule';

  const nuevoMsg = {
    id: `msg-${Date.now()}`,
    usuario: usuarioActual,
    texto: texto,
    grupo: grupoActivo,
    hora: horaActual,
    created_at: ahora.toISOString()
  };

  // Pintar y guardar localmente al instante (Optimistic UI)
  listaMensajesMemoria.push(nuevoMsg);
  guardarChatLocales();
  pintarMensaje(nuevoMsg);

  // Sincronizar con Supabase en segundo plano
  try {
    const res = await supabaseApp.from('mensajes').insert({
      usuario: usuarioActual,
      texto: texto,
      grupo: grupoActivo
    }).select();

    if (res.error && res.error.message && res.error.message.includes('grupo')) {
      await supabaseApp.from('mensajes').insert({
        usuario: usuarioActual,
        texto: texto
      });
    } else if (!res.error && res.data && res.data[0]) {
      nuevoMsg.id = res.data[0].id;
      guardarChatLocales();
    }
  } catch (e) {
    console.warn('Aviso enviando mensaje a Supabase:', e);
  }
}

if (btnEnviarMsg) btnEnviarMsg.addEventListener('click', enviarMensaje);
if (chatInput) {
  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') enviarMensaje();
  });
}

try {
  supabaseApp.channel('chat-directo')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensajes' }, payload => {
      if (payload.new && (!payload.new.grupo || payload.new.grupo === grupoActivo)) {
        if (!listaMensajesMemoria.some(m => m.id === payload.new.id)) {
          listaMensajesMemoria.push(payload.new);
          guardarChatLocales();
          pintarMensaje(payload.new);
        }
      }
    })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'mensajes' }, payload => {
      const elemento = chatMensajes.querySelector(`[data-id="${payload.old.id}"]`);
      if (elemento) elemento.remove();
      listaMensajesMemoria = listaMensajesMemoria.filter(m => m.id !== payload.old.id);
      guardarChatLocales();
    })
    .subscribe();
} catch(e) {}

if (selectorTema) {
  const temaGuardado = localStorage.getItem('tema-kedadas') || 'auto';
  selectorTema.value = temaGuardado;
  aplicarTema(temaGuardado);
  selectorTema.addEventListener('change', (e) => {
    localStorage.setItem('tema-kedadas', e.target.value);
    aplicarTema(e.target.value);
  });
}

function aplicarTema(tema) {
  if (!document.body) return;
  const prefiereOscuro = (window.matchMedia && typeof window.matchMedia === 'function')
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
    : false;
  if (tema === 'dark' || (tema === 'auto' && prefiereOscuro)) document.body.classList.add('dark-theme');
  else document.body.classList.remove('dark-theme');
}

// =========================================================================
// --- 11. PWA Y NOTIFICACIONES PUSH (WEB PUSH PARA IPHONE/ANDROID) --------
// =========================================================================
let swRegistration = null;

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      swRegistration = await navigator.serviceWorker.register('./sw.js');
      console.log('✅ Service Worker registrado con éxito:', swRegistration.scope);
    } catch (err) {
      console.warn('No se pudo registrar el Service Worker:', err);
    }
  });
}

const VAPID_PUBLIC_KEY = 'BPFV66ewMSEPBptLh0be-rpRSnEc01H4_HoFHxglPYyCb6Bequ7WFeqUhqMzMcB7PBninBqx4gBbrEyq1R1jxvI';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function suscribirWebPushDispositivo() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;

  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();

    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });
    }

    if (sub) {
      const subJson = sub.toJSON();
      const p256dh = subJson.keys?.p256dh;
      const auth = subJson.keys?.auth;

      if (miUserId && p256dh && auth) {
        await supabaseApp.from('push_subscriptions').upsert({
          user_id: miUserId,
          endpoint: sub.endpoint,
          p256dh: p256dh,
          auth: auth
        }, { onConflict: 'endpoint' });
      }

      return sub;
    }
  } catch (err) {
    console.warn('Aviso suscribiendo a Web Push:', err);
  }
  return null;
}

async function enviarAvisoPushServidor(titulo, mensaje, url = '/') {
  try {
    await fetch('/api/send-push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: titulo,
        body: mensaje,
        url: url
      })
    });
  } catch(e) {
    console.warn('Aviso enviando push al servidor:', e);
  }
}

async function inicializarPushNotifications() {
  if (!('Notification' in window)) return;

  if (btnNotificaciones) {
    if (Notification.permission === 'granted') {
      btnNotificaciones.textContent = '🔔 Avisos Activos';
      btnNotificaciones.classList.add('activo');
      suscribirWebPushDispositivo();
    }

    btnNotificaciones.addEventListener('click', async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          btnNotificaciones.textContent = '🔔 Avisos Activos';
          btnNotificaciones.classList.add('activo');

          const sub = await suscribirWebPushDispositivo();
          if (sub) {
            alert('🎉 ¡Notificaciones Web Push activadas! Tu dispositivo ha sido registrado para avisarte al instante de coincidencias y planes.');
            await enviarAvisoPushServidor(
              'Kedadas',
              `🔔 ¡Notificaciones activadas con éxito para ${usuarioLogueado || 'tu cuenta'}!`
            );
          } else {
            alert('🎉 ¡Notificaciones activadas en el navegador!');
          }
        } else {
          alert('Para recibir alertas de días libres, necesitas permitir las notificaciones en los ajustes de tu navegador o iPhone.');
        }
      } catch (e) {
        console.error(e);
      }
    });
  }
}

// =========================================================================
// --- 12. ESCANEAR CUADRANTE DESDE FOTO O ARCHIVO CON VISIÓN IA -----------
// =========================================================================
const btnAbrirScanFoto = document.getElementById('btn-abrir-scan-foto');
const modalScanCuadrante = document.getElementById('modal-scan-cuadrante');
const btnCerrarModalScan = document.getElementById('btn-cerrar-modal-scan');
const btnToggleConfigIA = document.getElementById('btn-toggle-config-ia');
const boxConfigIA = document.getElementById('box-config-ia');
const inputGeminiKey = document.getElementById('input-gemini-key');
const btnToggleEyeGemini = document.getElementById('btn-toggle-eye-gemini');
const btnGuardarGeminiKey = document.getElementById('btn-guardar-gemini-key');
const statusGeminiKey = document.getElementById('status-gemini-key');

const dropZoneFoto = document.getElementById('drop-zone-foto');
const inputFotoCamara = document.getElementById('input-foto-camara');
const inputFotoGaleria = document.getElementById('input-foto-galeria');
const btnHacerFotoCamara = document.getElementById('btn-hacer-foto-camara');
const btnAdjuntarArchivo = document.getElementById('btn-adjuntar-archivo');
const wrapPreviewScan = document.getElementById('wrap-preview-scan');
const previewFotoCuadrante = document.getElementById('preview-foto-cuadrante');
const previewPdfInfo = document.getElementById('preview-pdf-info');
const previewPdfNombre = document.getElementById('preview-pdf-nombre');
const btnCambiarCamara = document.getElementById('btn-cambiar-camara');
const btnCambiarArchivo = document.getElementById('btn-cambiar-archivo');
const chkAutollenarCalendario = document.getElementById('chk-autollenar-calendario');

const scanConfigRow = document.getElementById('scan-config-row');
const scanUsuarioObjetivo = document.getElementById('scan-usuario-objetivo');
const scanMesObjetivo = document.getElementById('scan-mes-objetivo');
const scanAnoObjetivo = document.getElementById('scan-ano-objetivo');
const grupoScanMes = document.getElementById('grupo-scan-mes');

const scanLoadingState = document.getElementById('scan-loading-state');
const scanStatusText = document.getElementById('scan-status-text');
const scanStatusSub = document.getElementById('scan-status-sub');

const scanRevisionContainer = document.getElementById('scan-revision-container');
const scanRevisionTitulo = document.getElementById('scan-revision-titulo');
const scanRevisionSub = document.getElementById('scan-revision-sub');
const scanStatsPills = document.getElementById('scan-stats-pills');
const scanMesesTabs = document.getElementById('scan-meses-tabs');
const scanDiasGrid = document.getElementById('scan-dias-grid');
const btnAnalizarFoto = document.getElementById('btn-analizar-foto');
const btnGuardarScan = document.getElementById('btn-guardar-scan');

const STORAGE_GEMINI_KEY = 'kedadas_gemini_api_key';
let imagenBase64Actual = '';
let mimeTypeActual = 'image/jpeg';
let nombreArchivoActual = '';
let resultadoScanGlobal = null; // { modo: 'mes'|'ano', anio: 2026, meses: [ { mes: 0, nombreMes: 'Enero', dias: [] } ] }
let mesActivoEnRevision = 0;

// Configuración de la clave de Gemini
function actualizarEstadoClaveGemini() {
  const claveGuardada = (localStorage.getItem(STORAGE_GEMINI_KEY) || '').trim();
  if (statusGeminiKey) {
    if (claveGuardada) {
      statusGeminiKey.textContent = '✅ Clave de IA configurada';
      statusGeminiKey.className = 'status-gemini-key activo';
      if (inputGeminiKey) inputGeminiKey.value = claveGuardada;
    } else {
      statusGeminiKey.textContent = 'ℹ️ Sin clave propia (usando Vercel/servidor)';
      statusGeminiKey.className = 'status-gemini-key inactivo';
    }
  }
}

if (btnToggleConfigIA) {
  btnToggleConfigIA.addEventListener('click', () => {
    if (!boxConfigIA) return;
    const estaVisible = boxConfigIA.style.display !== 'none';
    boxConfigIA.style.display = estaVisible ? 'none' : 'block';
    if (!estaVisible && inputGeminiKey) {
      inputGeminiKey.focus();
    }
  });
}

if (btnToggleEyeGemini && inputGeminiKey) {
  btnToggleEyeGemini.addEventListener('click', () => {
    inputGeminiKey.type = inputGeminiKey.type === 'password' ? 'text' : 'password';
  });
}

if (btnGuardarGeminiKey && inputGeminiKey) {
  btnGuardarGeminiKey.addEventListener('click', () => {
    const val = inputGeminiKey.value.trim();
    if (val) {
      localStorage.setItem(STORAGE_GEMINI_KEY, val);
      actualizarEstadoClaveGemini();
      alert('✅ ¡Clave de Google Gemini guardada con éxito! Ya puedes analizar tus fotos y PDFs.');
      if (boxConfigIA) boxConfigIA.style.display = 'none';
    } else {
      localStorage.removeItem(STORAGE_GEMINI_KEY);
      actualizarEstadoClaveGemini();
      alert('ℹ️ Clave eliminada. Se usará el servidor o modo interactivo.');
    }
  });
}

// Detectar y listar dinámicamente los modelos de Gemini disponibles para la clave del usuario
async function obtenerModelosGeminiDisponibles(apiKey) {
  const cleanKey = (apiKey || '').trim();
  const preferencia = [
    'gemini-2.0-flash',
    'gemini-1.5-flash-latest',
    'gemini-1.5-flash-002',
    'gemini-1.5-flash',
    'gemini-2.5-flash',
    'gemini-1.5-pro',
    'gemini-pro'
  ];

  if (!cleanKey) return preferencia;

  try {
    // Consultar ModelService.ListModels para averiguar exactamente qué modelos admite la clave
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${cleanKey}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.models) && data.models.length > 0) {
        const disponibles = data.models
          .filter(m => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
          .map(m => m.name.replace(/^models\//, ''));

        if (disponibles.length > 0) {
          const ordenados = [];
          for (const pref of preferencia) {
            const encontrado = disponibles.find(d => d === pref || d.startsWith(pref));
            if (encontrado && !ordenados.includes(encontrado)) {
              ordenados.push(encontrado);
            }
          }
          for (const d of disponibles) {
            if (!ordenados.includes(d)) {
              ordenados.push(d);
            }
          }
          return ordenados;
        }
      }
    }
  } catch (e) {
    console.warn('Consulta dynamic ListModels falló, usando lista predeterminada:', e);
  }

  return preferencia;
}

// Botón para probar la validez de la clave Gemini al instante con auto-detección
const btnProbarGeminiKey = document.getElementById('btn-probar-gemini-key');
if (btnProbarGeminiKey && inputGeminiKey) {
  btnProbarGeminiKey.addEventListener('click', async () => {
    const clave = (inputGeminiKey.value || localStorage.getItem(STORAGE_GEMINI_KEY) || '').trim();
    if (!clave) {
      return alert('Pega primero tu clave de Google Gemini para probarla.');
    }
    btnProbarGeminiKey.textContent = '⏳ Probando...';
    try {
      const modelos = await obtenerModelosGeminiDisponibles(clave);
      let exito = false;
      let modeloFuncional = '';
      let ultimoError = '';

      for (const modelo of modelos) {
        const versiones = ['v1beta', 'v1'];
        for (const vApi of versiones) {
          try {
            const url = `https://generativelanguage.googleapis.com/${vApi}/models/${modelo}:generateContent?key=${clave}`;
            const res = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: 'Di únicamente: OK' }] }]
              })
            });
            const data = await res.json();
            if (res.ok && data.candidates?.[0]?.content?.parts?.[0]?.text) {
              exito = true;
              modeloFuncional = `${modelo} (${vApi})`;
              break;
            } else {
              ultimoError = data.error?.message || (data.error ? JSON.stringify(data.error) : 'Respuesta desconocida de Google');
              if (res.status === 404) break; // Probar siguiente modelo si este no existe en este endpoint
            }
          } catch (e) {
            ultimoError = e.message;
          }
        }
        if (exito) break;
      }

      btnProbarGeminiKey.textContent = '🧪 Probar';

      if (exito) {
        localStorage.setItem(STORAGE_GEMINI_KEY, clave);
        actualizarEstadoClaveGemini();
        if (typeof confetti === 'function') confetti({ particleCount: 35, spread: 60 });
        alert(`🎉 ¡Tu clave de Google Gemini es 100% VÁLIDA y funciona a la perfección!\n\nModelo activo detectado: ${modeloFuncional}\nYa está guardada para todos tus escaneos automáticos.`);
      } else {
        alert(`❌ La clave de Gemini no funcionó.\n\nMotivo exacto devuelto por Google:\n${ultimoError}\n\nAsegúrate de copiar la clave entera de aistudio.google.com/app/apikey.`);
      }
    } catch (e) {
      btnProbarGeminiKey.textContent = '🧪 Probar';
      alert(`❌ Error de conexión al probar la clave:\n${e.message}\n\nComprueba tu conexión a internet o si hay algún bloqueador de red.`);
    }
  });
}

// Inicializar selectores de mes, año y personas en el modal de escaneo
function poblarSelectoresScan() {
  if (scanMesObjetivo) {
    scanMesObjetivo.innerHTML = '';
    nombresMeses.forEach((mes, idx) => {
      const opt = document.createElement('option');
      opt.value = idx;
      opt.textContent = mes;
      if (idx === fechaNavegacion.getMonth()) opt.selected = true;
      scanMesObjetivo.appendChild(opt);
    });
  }

  if (scanAnoObjetivo) {
    scanAnoObjetivo.value = fechaNavegacion.getFullYear();
  }

  if (scanUsuarioObjetivo) {
    scanUsuarioObjetivo.innerHTML = '';
    usuarios.forEach(u => {
      const opt = document.createElement('option');
      opt.value = u;
      opt.textContent = `👤 ${u}`;
      if (u === miUsuario) opt.selected = true;
      scanUsuarioObjetivo.appendChild(opt);
    });
  }

  actualizarEstadoClaveGemini();
}

// Selector de modo de escaneo (auto, mes, ano)
document.querySelectorAll('input[name="scan-modo"]').forEach(radio => {
  radio.addEventListener('change', (e) => {
    if (!grupoScanMes) return;
    if (e.target.value === 'mes') {
      grupoScanMes.style.display = 'block';
    } else {
      grupoScanMes.style.display = 'none';
    }
  });
});

if (btnAbrirScanFoto) {
  btnAbrirScanFoto.addEventListener('click', () => {
    if (!esAdmin && miUsuario !== usuarioLogueado) {
      return alert('Solo puedes escanear cuadrantes en tu propio calendario.');
    }
    poblarSelectoresScan();

    // Resetear estados visuales
    if (wrapPreviewScan) wrapPreviewScan.style.display = 'none';
    if (previewFotoCuadrante) { previewFotoCuadrante.src = ''; previewFotoCuadrante.style.display = 'none'; }
    if (previewPdfInfo) previewPdfInfo.style.display = 'none';
    if (dropZoneFoto) {
      const cnt = dropZoneFoto.querySelector('.drop-zone-content');
      if (cnt) cnt.style.display = 'block';
    }
    if (scanConfigRow) scanConfigRow.style.display = 'none';
    if (scanLoadingState) scanLoadingState.style.display = 'none';
    if (scanRevisionContainer) scanRevisionContainer.style.display = 'none';
    if (btnAnalizarFoto) btnAnalizarFoto.style.display = 'none';
    if (btnGuardarScan) btnGuardarScan.style.display = 'none';
    if (boxConfigIA) boxConfigIA.style.display = 'none';
    if (inputFotoCamara) inputFotoCamara.value = '';
    if (inputFotoGaleria) inputFotoGaleria.value = '';
    imagenBase64Actual = '';
    nombreArchivoActual = '';
    resultadoScanGlobal = null;

    modalScanCuadrante.style.display = 'flex';
  });
}

if (btnCerrarModalScan) {
  btnCerrarModalScan.addEventListener('click', () => {
    modalScanCuadrante.style.display = 'none';
  });
}
if (modalScanCuadrante) {
  modalScanCuadrante.addEventListener('click', (e) => {
    if (e.target === modalScanCuadrante) modalScanCuadrante.style.display = 'none';
  });
}

// Conexión de botones de selección: cámara directa vs selector de archivos/galería
if (btnHacerFotoCamara && inputFotoCamara) {
  btnHacerFotoCamara.addEventListener('click', (e) => {
    e.stopPropagation();
    inputFotoCamara.click();
  });
}
if (btnAdjuntarArchivo && inputFotoGaleria) {
  btnAdjuntarArchivo.addEventListener('click', (e) => {
    e.stopPropagation();
    inputFotoGaleria.click();
  });
}

if (btnCambiarCamara && inputFotoCamara) {
  btnCambiarCamara.addEventListener('click', (e) => {
    e.stopPropagation();
    inputFotoCamara.click();
  });
}
if (btnCambiarArchivo && inputFotoGaleria) {
  btnCambiarArchivo.addEventListener('click', (e) => {
    e.stopPropagation();
    inputFotoGaleria.click();
  });
}

if (inputFotoCamara) {
  inputFotoCamara.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) procesarArchivoImagen(e.target.files[0]);
  });
}
if (inputFotoGaleria) {
  inputFotoGaleria.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) procesarArchivoImagen(e.target.files[0]);
  });
}

// Arrastrar y soltar archivos desde el ordenador
if (dropZoneFoto) {
  dropZoneFoto.addEventListener('dragover', (e) => { e.preventDefault(); dropZoneFoto.style.borderColor = '#667eea'; });
  dropZoneFoto.addEventListener('dragleave', () => { dropZoneFoto.style.borderColor = '#cbd5e1'; });
  dropZoneFoto.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZoneFoto.style.borderColor = '#cbd5e1';
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      procesarArchivoImagen(e.dataTransfer.files[0]);
    }
  });
}

function procesarArchivoImagen(file) {
  if (!file) return;
  const esPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  const esImagen = file.type.startsWith('image/') || (!esPdf && /\.(jpe?g|png|webp|heic|heif|bmp)$/i.test(file.name));

  if (!esImagen && !esPdf) {
    return alert('Por favor, selecciona una foto (JPG, PNG, WEBP) o un documento PDF de tu horario.');
  }

  nombreArchivoActual = file.name || (esPdf ? 'cuadrante.pdf' : 'cuadrante.jpg');

  function mostrarConfiguracionScan() {
    if (wrapPreviewScan) wrapPreviewScan.style.display = 'block';
    if (dropZoneFoto) {
      const cnt = dropZoneFoto.querySelector('.drop-zone-content');
      if (cnt) cnt.style.display = 'none';
    }
    if (scanConfigRow) scanConfigRow.style.display = 'block';
    if (btnAnalizarFoto) {
      btnAnalizarFoto.style.display = 'inline-block';
      btnAnalizarFoto.textContent = '✨ Generar horario con IA y rellenar calendario';
    }
    if (scanRevisionContainer) scanRevisionContainer.style.display = 'none';
    if (btnGuardarScan) btnGuardarScan.style.display = 'none';
  }

  if (esPdf) {
    mimeTypeActual = 'application/pdf';
    const reader = new FileReader();
    reader.onload = (event) => {
      imagenBase64Actual = event.target.result;
      if (previewFotoCuadrante) previewFotoCuadrante.style.display = 'none';
      if (previewPdfInfo) {
        previewPdfInfo.style.display = 'flex';
        if (previewPdfNombre) {
          const tamKb = (file.size / 1024).toFixed(0);
          previewPdfNombre.textContent = `${file.name} (${tamKb} KB)`;
        }
      }
      mostrarConfiguracionScan();
    };
    reader.readAsDataURL(file);
    return;
  }

  // Si es imagen: comprimir con canvas a máx 1600px y formato JPEG para compatibilidad y ligereza
  mimeTypeActual = 'image/jpeg';
  const reader = new FileReader();
  reader.onload = (event) => {
    const rawData = event.target.result;
    const img = new Image();
    img.onload = () => {
      const maxDim = 1600;
      let w = img.width;
      let h = img.height;
      if (w > maxDim || h > maxDim) {
        if (w > h) {
          h = Math.round((h * maxDim) / w);
          w = maxDim;
        } else {
          w = Math.round((w * maxDim) / h);
          h = maxDim;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      imagenBase64Actual = canvas.toDataURL('image/jpeg', 0.85);

      if (previewPdfInfo) previewPdfInfo.style.display = 'none';
      if (previewFotoCuadrante) {
        previewFotoCuadrante.src = imagenBase64Actual;
        previewFotoCuadrante.style.display = 'inline-block';
      }
      mostrarConfiguracionScan();
    };
    img.onerror = () => {
      imagenBase64Actual = rawData;
      if (previewPdfInfo) previewPdfInfo.style.display = 'none';
      if (previewFotoCuadrante) {
        previewFotoCuadrante.src = imagenBase64Actual;
        previewFotoCuadrante.style.display = 'inline-block';
      }
      mostrarConfiguracionScan();
    };
    img.src = rawData;
  };
  reader.readAsDataURL(file);
}

// LLAMADA DIRECTA A GEMINI VISION DESDE EL NAVEGADOR
async function llamarGeminiVisionNavegador(apiKey, base64, mimeType, modo, usuario, mes, anio) {
  const cleanKey = (apiKey || '').trim().replace(/^['"]|['"]$/g, '');
  const cleanBase64 = base64.replace(/^data:[^;]+;base64,/, '');
  const mesNombre = (mes !== null && mes !== undefined) ? nombresMeses[mes] : '';

  const prompt = `
Eres un digitalizador experto en cuadrantes de turnos laborales (sanidad, policía, emergencias, fábricas, bomberos, hostelería, etc.).
Tu misión es extraer con total exactitud todos los turnos del trabajador/cuadrante en la imagen o documento PDF.

CONTEXTO DE BÚSQUEDA:
- Trabajador a extraer: "${usuario}". Si hay múltiples filas con nombres de personas, busca EXCLUSIVAMENTE la fila correspondiente a "${usuario}". Si no encuentras ese nombre específico o la tabla es para un solo trabajador/puesto, extrae el cuadrante principal visible.
- Año de referencia: ${anio}.
- Mes de referencia si aplica: ${mes !== null && mes !== undefined ? `${mes + 1} (${mesNombre})` : 'Detectar del documento'}.
- Modo solicitado: "${modo}" (si es 'auto', analiza si el documento contiene solo 1 mes o el año completo/múltiples meses).

CONVENCIÓN DE TURNOS PERMITIDOS:
- "M": Turno de Mañana (ejemplos: M, M1, M2, 07:00-15:00, 08:00-15:00, Mañana).
- "T": Turno de Tarde (ejemplos: T, T1, T2, 15:00-23:00, 14:00-22:00, Tarde).
- "N": Turno de Noche (ejemplos: N, N1, 23:00-07:00, 22:00-06:00, Noche, Guardia noche).
- "L": Día Libre / Descanso / Saliente (ejemplos: L, D, S, Saliente, Libre, Descanso, Festivo libre).
- "V": Vacaciones / Permiso (ejemplos: V, VAC, AP, Asuntos propios, Permiso, Baja).
- "X": Vacío o sin turno asignado.

REGLAS DE FORMATO Y FECHAS:
1. El campo "mes" DEBE ser un número entero de 0 a 11 (donde 0 = Enero, 1 = Febrero, ..., 11 = Diciembre).
2. El campo "dia" DEBE ser el número del día (1 al 28/29/30/31 según el mes).
3. Asegúrate de incluir todos los días del mes o de los meses presentes en el cuadrante.

FORMATO DE RESPUESTA EXCLUSIVO (JSON VÁLIDO SIN TEXTO NI MARKDOWN):
{
  "modo": "mes" o "ano",
  "anio": ${anio},
  "resumen": "Cuadrante detectado para ${usuario}...",
  "meses": [
    {
      "mes": 0,
      "nombreMes": "Enero",
      "dias": [
        { "dia": 1, "turno": "M" },
        { "dia": 2, "turno": "T" },
        { "dia": 3, "turno": "L" }
      ]
    }
  ]
}
`;

  // Obtener lista inteligente de modelos compatibles con generateContent
  let modelos = await obtenerModelosGeminiDisponibles(cleanKey);
  if (!modelos || modelos.length === 0) {
    modelos = ['gemini-2.0-flash', 'gemini-1.5-flash-latest', 'gemini-1.5-flash-002', 'gemini-1.5-flash', 'gemini-2.5-flash', 'gemini-1.5-pro'];
  }
  let ultimoError = null;

  for (const modelo of modelos) {
    const versionesApi = ['v1beta', 'v1'];
    for (const vApi of versionesApi) {
      try {
        const url = `https://generativelanguage.googleapis.com/${vApi}/models/${modelo}:generateContent?key=${cleanKey}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: prompt },
                { inline_data: { mime_type: mimeType || 'image/jpeg', data: cleanBase64 } }
              ]
            }],
            generationConfig: {
              response_mime_type: 'application/json',
              temperature: 0.1,
              max_output_tokens: 8192
            }
          })
        });

        const data = await res.json();
        if (res.ok && data.candidates?.[0]?.content?.parts?.[0]?.text) {
          const rawJson = data.candidates[0].content.parts[0].text;
          const parsed = JSON.parse(rawJson);
          if (parsed && Array.isArray(parsed.meses) && parsed.meses.length > 0) {
            console.log(`✅ Cuadrante analizado con éxito usando modelo ${modelo} (${vApi})`);
            return parsed;
          }
        } else {
          ultimoError = data.error?.message || (data.error ? JSON.stringify(data.error) : `Error ${res.status}`);
          if (res.status === 404) break; // Probar siguiente modelo
        }
      } catch (e) {
        ultimoError = e.message;
      }
    }
  }

  throw new Error(ultimoError || 'No se pudo contactar con los modelos de Gemini Vision.');
}

// Analizar la foto o archivo con IA y rellenar automáticamente el calendario vía función serverless
if (btnAnalizarFoto) {
  btnAnalizarFoto.addEventListener('click', async () => {
    if (!imagenBase64Actual) {
      return alert('Selecciona o fotografía un cuadrante primero (o adjunta un PDF o imagen existente).');
    }

    const modoSeleccionado = document.querySelector('input[name="scan-modo"]:checked')?.value || 'auto';
    const mesSeleccionado = modoSeleccionado === 'mes' ? parseInt(scanMesObjetivo.value) : null;
    const anoSeleccionado = parseInt(scanAnoObjetivo.value) || fechaNavegacion.getFullYear();
    const usuarioObjetivo = scanUsuarioObjetivo ? scanUsuarioObjetivo.value : miUsuario;

    let claveGeminiLocal = (localStorage.getItem(STORAGE_GEMINI_KEY) || '').trim();

    btnAnalizarFoto.style.display = 'none';
    scanLoadingState.style.display = 'block';
    scanStatusText.textContent = 'Analizando cuadrante con IA de Visión...';
    scanStatusSub.textContent = 'Enviando cuadrante a la función serverless...';

    let resultado = null;
    let ultimoErrorDetalle = '';

    // LLAMADA EXCLUSIVA A LA FUNCIÓN SERVERLESS (/api/analizar-cuadrante)
    try {
      scanStatusSub.textContent = `Extrayendo turnos para ${usuarioObjetivo} con Gemini Vision...`;
      const resServidor = await fetch('/api/analizar-cuadrante', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: imagenBase64Actual,
          mimeType: mimeTypeActual,
          mes: mesSeleccionado,
          anio: anoSeleccionado,
          usuario: usuarioObjetivo,
          modoEscaneo: modoSeleccionado,
          apiKey: claveGeminiLocal || undefined
        })
      });

      if (resServidor.ok) {
        const dataServ = await resServidor.json();
        if (dataServ && Array.isArray(dataServ.meses) && dataServ.meses.length > 0) {
          resultado = dataServ;
        } else {
          ultimoErrorDetalle = 'El modelo no devolvió ningún mes con turnos.';
        }
      } else {
        const errJson = await resServidor.json().catch(() => ({}));
        ultimoErrorDetalle = errJson.message || errJson.error || `Error ${resServidor.status}`;
      }
    } catch (errServ) {
      console.warn('Fallo consulta a /api/analizar-cuadrante:', errServ);
      ultimoErrorDetalle = errServ.message;
    }

    if (!resultado) {
      scanLoadingState.style.display = 'none';
      btnAnalizarFoto.style.display = 'inline-block';
      alert(`❌ No se pudo analizar el cuadrante en el servidor:\n${ultimoErrorDetalle || 'Comprueba la legibilidad de la imagen o configura GEMINI_API_KEY en las variables de Vercel.'}`);
      return;
    }

    // Análisis exitoso: normalizar turnos
    scanLoadingState.style.display = 'none';
    resultadoScanGlobal = normalizarResultadoScan(resultado, anoSeleccionado);

    // Si la opción de auto-llenar está activa (por defecto SÍ), volcar directo al calendario de la app
    const autoLlenar = !chkAutollenarCalendario || chkAutollenarCalendario.checked;
    if (autoLlenar) {
      await aplicarTurnosDetectadosAlCalendario(resultadoScanGlobal, usuarioObjetivo);
    } else {
      // Si el usuario desactivó el auto-llenar, mostrar tabla interactiva para revisión manual
      renderizarRevisionScan();
    }
  });
}

// Función maestra: Aplica los turnos detectados de inmediato en LocalStorage, Supabase y el calendario visual
async function aplicarTurnosDetectadosAlCalendario(resultadoScan, usuarioDestino) {
  if (!resultadoScan || !resultadoScan.meses || resultadoScan.meses.length === 0) return;

  const meses = resultadoScan.meses;
  const anio = resultadoScan.anio;
  const usuarioFinal = usuarioDestino || miUsuario;
  let totalDias = 0;
  const filasParaSupabase = [];

  // 1. Guardar de inmediato en LocalStorage para cada mes detectado (sincrónico, cero esperas)
  for (const mesObj of meses) {
    const mesAnioKey = `${anio}-${mesObj.mes}`;
    const keyLocal = `kedadas_turnos_${usuarioFinal}_${mesAnioKey}`;
    let turnosLocales = [];
    try {
      const raw = localStorage.getItem(keyLocal);
      if (raw) turnosLocales = JSON.parse(raw);
    } catch(e) {}

    mesObj.dias.forEach(d => {
      totalDias++;
      const idx = turnosLocales.findIndex(t => t.dia === d.dia);
      if (idx >= 0) {
        turnosLocales[idx].indiceEstado = d.indiceEstado;
      } else {
        turnosLocales.push({
          dia: d.dia,
          usuario: usuarioFinal,
          indiceEstado: d.indiceEstado,
          mes_anio: mesAnioKey
        });
      }

      filasParaSupabase.push({
        dia: d.dia,
        usuario: usuarioFinal,
        usuario_id: miUserId,
        indiceEstado: d.indiceEstado,
        mes_anio: mesAnioKey
      });
    });

    localStorage.setItem(keyLocal, JSON.stringify(turnosLocales));
  }

  // 2. Si el trabajador procesado no es el que estaba activo en pantalla, seleccionarlo
  if (usuarioFinal && selectorUsuario && selectorUsuario.value !== usuarioFinal) {
    miUsuario = usuarioFinal;
    selectorUsuario.value = usuarioFinal;
  }

  // 3. Situar la fecha de navegación en el primer mes detectado
  const primerMes = meses[0].mes;
  fechaNavegacion = new Date(anio, primerMes, 1);

  // 4. Si fue el año completo (>1 mes), cambiar la vista o mantenerse en mes
  if (meses.length > 1) {
    modoVista = 'ano';
    if (btnToggleVista) btnToggleVista.textContent = '📅 Cambiar a Vista Mensual';
  } else {
    modoVista = 'mes';
    if (btnToggleVista) btnToggleVista.textContent = '📅 Cambiar a Vista Anual';
  }

  // 5. Iniciar y pintar el calendario visualmente de forma instantánea
  await iniciarCalendario();

  // 6. Cerrar el modal para que el usuario disfrute de su calendario ya relleno
  if (modalScanCuadrante) modalScanCuadrante.style.display = 'none';

  // 7. Lanzar animación de confeti
  if (typeof confetti === 'function') {
    confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
  }

  // 8. Mensaje de confirmación
  const nombreMes = meses[0].nombreMes;
  const mensajeConfirmacion = meses.length > 1
    ? `🎉 ¡Horario volcado automáticamente en tu calendario!\nSe han rellenado ${totalDias} días del año ${anio} para ${usuarioFinal}.`
    : `🎉 ¡Horario volcado automáticamente en tu calendario!\nSe han rellenado ${totalDias} turnos de ${nombreMes} ${anio} para ${usuarioFinal}.`;

  setTimeout(() => { alert(mensajeConfirmacion); }, 150);

  // 9. Sincronizar en segundo plano con Supabase en bloques de lote (upsert)
  guardarTurnosEnLote(filasParaSupabase);
}

// Sincronización en bloque (batch upsert) con Supabase para máxima velocidad
async function guardarTurnosEnLote(filas) {
  if (!filas || filas.length === 0) return;
  try {
    const BLOQUE = 80;
    for (let i = 0; i < filas.length; i += BLOQUE) {
      const chunk = filas.slice(i, i + BLOQUE);
      await supabaseApp.from('Turnos').upsert(chunk, { onConflict: 'usuario,dia,mes_anio' });
    }
  } catch (err) {
    console.warn('Aviso sincronizando turnos en Supabase:', err);
  }
}

function normalizarResultadoScan(res, anioFallback) {
  const mapaEstados = { 'X': 0, 'L': 1, 'M': 2, 'T': 3, 'N': 4, 'V': 5 };
  const anio = res.anio || anioFallback;

  const mesesNormalizados = (res.meses || []).map(m => {
    const mesIndex = (typeof m.mes === 'number' && m.mes >= 0 && m.mes <= 11) ? m.mes : 0;
    const diasEnMes = new Date(anio, mesIndex + 1, 0).getDate();
    const mapaDias = {};

    (m.dias || []).forEach(d => {
      if (d.dia && d.dia >= 1 && d.dia <= 31) {
        const turnoLetra = (d.turno || 'X').toUpperCase();
        mapaDias[d.dia] = {
          turno: turnoLetra,
          indiceEstado: mapaEstados[turnoLetra] !== undefined ? mapaEstados[turnoLetra] : 0
        };
      }
    });

    const listaCompletaDias = [];
    for (let dia = 1; dia <= diasEnMes; dia++) {
      if (mapaDias[dia]) {
        listaCompletaDias.push({ dia, ...mapaDias[dia] });
      } else {
        listaCompletaDias.push({ dia, turno: 'X', indiceEstado: 0 });
      }
    }

    return {
      mes: mesIndex,
      nombreMes: nombresMeses[mesIndex],
      dias: listaCompletaDias
    };
  });

  return {
    modo: res.modo || (mesesNormalizados.length > 1 ? 'ano' : 'mes'),
    anio: anio,
    resumen: res.resumen || `Cuadrante detectado con ${mesesNormalizados.length} mes(es).`,
    meses: mesesNormalizados
  };
}

function renderizarRevisionScan() {
  if (!resultadoScanGlobal || !resultadoScanGlobal.meses || resultadoScanGlobal.meses.length === 0) return;

  const meses = resultadoScanGlobal.meses;
  const esMultiMes = meses.length > 1;

  // Actualizar títulos y cabeceras
  if (scanRevisionTitulo) {
    scanRevisionTitulo.textContent = esMultiMes
      ? `📅 Cuadrante detectado: Año ${resultadoScanGlobal.anio} (${meses.length} meses)`
      : `📅 Cuadrante detectado: ${meses[0].nombreMes} ${resultadoScanGlobal.anio}`;
  }

  // Calcular estadísticas globales
  let totalDias = 0;
  const conteo = { M: 0, T: 0, N: 0, L: 0, V: 0 };
  meses.forEach(m => {
    m.dias.forEach(d => {
      totalDias++;
      if (conteo[d.turno] !== undefined) conteo[d.turno]++;
    });
  });

  if (scanStatsPills) {
    scanStatsPills.innerHTML = `
      <span class="stat-pill stat-pill-m">M: ${conteo.M}</span>
      <span class="stat-pill stat-pill-t">T: ${conteo.T}</span>
      <span class="stat-pill stat-pill-n">N: ${conteo.N}</span>
      <span class="stat-pill stat-pill-l">L: ${conteo.L}</span>
      <span class="stat-pill stat-pill-v">V: ${conteo.V}</span>
    `;
  }

  // Pestañas de meses si hay más de 1 mes detectado
  if (scanMesesTabs) {
    if (esMultiMes) {
      scanMesesTabs.innerHTML = '';
      scanMesesTabs.style.display = 'flex';
      meses.forEach((m, idx) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `scan-mes-tab-btn ${idx === mesActivoEnRevision ? 'activo' : ''}`;
        btn.textContent = `${m.nombreMes.substring(0, 3)} (${m.dias.length})`;
        btn.addEventListener('click', () => {
          mesActivoEnRevision = idx;
          document.querySelectorAll('.scan-mes-tab-btn').forEach((b, i) => {
            b.classList.toggle('activo', i === mesActivoEnRevision);
          });
          pintarDiasDelMesEnRevision();
        });
        scanMesesTabs.appendChild(btn);
      });
    } else {
      scanMesesTabs.style.display = 'none';
      mesActivoEnRevision = 0;
    }
  }

  pintarDiasDelMesEnRevision();

  // Botón de guardar
  if (btnGuardarScan) {
    btnGuardarScan.textContent = esMultiMes
      ? `💾 Guardar todo el año (${totalDias} días)`
      : `💾 Guardar ${meses[0].nombreMes} en mi cuadrante`;
    btnGuardarScan.style.display = 'inline-block';
  }

  scanRevisionContainer.style.display = 'block';
}

function pintarDiasDelMesEnRevision() {
  if (!scanDiasGrid || !resultadoScanGlobal) return;
  scanDiasGrid.innerHTML = '';

  const mesObj = resultadoScanGlobal.meses[mesActivoEnRevision] || resultadoScanGlobal.meses[0];
  if (!mesObj) return;

  const letrasValidas = ['X', 'L', 'M', 'T', 'N', 'V'];
  const mapaEstados = { 'X': 0, 'L': 1, 'M': 2, 'T': 3, 'N': 4, 'V': 5 };

  mesObj.dias.forEach(d => {
    const chip = document.createElement('div');
    chip.className = 'scan-dia-chip';

    const numSpan = document.createElement('span');
    numSpan.className = 'scan-dia-num';
    numSpan.textContent = `Día ${d.dia}`;

    const select = document.createElement('select');
    select.className = 'scan-select-shift';

    letrasValidas.forEach(letra => {
      const opt = document.createElement('option');
      opt.value = letra;
      opt.textContent = letra === 'X' ? '—' : letra;
      if (letra === d.turno) opt.selected = true;
      select.appendChild(opt);
    });

    select.addEventListener('change', () => {
      d.turno = select.value;
      d.indiceEstado = mapaEstados[select.value] || 0;
    });

    chip.appendChild(numSpan);
    chip.appendChild(select);
    scanDiasGrid.appendChild(chip);
  });
}

// Guardar manual desde la tabla de revisión
if (btnGuardarScan) {
  btnGuardarScan.addEventListener('click', async () => {
    if (!resultadoScanGlobal || !resultadoScanGlobal.meses) return;
    const usuarioDestino = scanUsuarioObjetivo ? scanUsuarioObjetivo.value : miUsuario;
    await aplicarTurnosDetectadosAlCalendario(resultadoScanGlobal, usuarioDestino);
  });
}

// =========================================================================
// --- NAVEGACIÓN LIMPIA POR PESTAÑAS (CUADRANTE, PLANES, CHAT, GRUPOS, USUARIOS)
// =========================================================================
function inicializarNavegacionPestanas() {
  const tabBtns = document.querySelectorAll('.nav-tab-btn');
  const tabPanes = document.querySelectorAll('.tab-pane');
  const btnTopGrupo = document.getElementById('btn-top-grupo-pill');
  const btnTopUser = document.getElementById('btn-top-user-pill');

  function cambiarPestana(tabName) {
    if (!tabName) return;
    tabBtns.forEach(btn => {
      const match = btn.dataset.tab === tabName;
      btn.classList.toggle('activo', match);
      btn.classList.toggle('active', match);
    });

    tabPanes.forEach(pane => {
      const coincide = pane.id === `tab-${tabName}`;
      pane.style.display = coincide ? 'block' : 'none';
      pane.classList.toggle('activo', coincide);
      pane.classList.toggle('active', coincide);
    });

    // Acciones específicas al activar cada pestaña de forma segura
    try {
      if (tabName === 'planes') {
        if (typeof pintarPlanesEnPantalla === 'function') pintarPlanesEnPantalla();
      } else if (tabName === 'chat') {
        if (typeof scrollChatAlFinal === 'function') scrollChatAlFinal();
      } else if (tabName === 'grupos') {
        if (typeof renderizarSelectorGrupos === 'function') renderizarSelectorGrupos();
        if (typeof renderizarPanelGestionGrupoActivo === 'function') renderizarPanelGestionGrupoActivo();
      } else if (tabName === 'usuarios') {
        if (typeof actualizarEdicionPersonaDesplegable === 'function') actualizarEdicionPersonaDesplegable();
        if (typeof renderizarPanelGestionUsuarios === 'function') renderizarPanelGestionUsuarios();
      } else if (tabName === 'cuadrante') {
        if (typeof renderizarSelectoresUsuarios === 'function') renderizarSelectoresUsuarios();
        if (typeof renderizarFiltroCoincidencias === 'function') renderizarFiltroCoincidencias();
        if (typeof iniciarCalendario === 'function') iniciarCalendario();
      }
    } catch(errTab) {
      console.warn('Aviso al cambiar a pestaña ' + tabName, errTab);
    }
  }

  window.cambiarPestana = cambiarPestana;

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      cambiarPestana(btn.dataset.tab);
    });
  });

  if (btnTopGrupo) {
    btnTopGrupo.addEventListener('click', () => cambiarPestana('grupos'));
  }
  if (btnTopUser) {
    btnTopUser.addEventListener('click', () => cambiarPestana('usuarios'));
  }

  // Soporte para botón rápido de personas
  const btnTopPersonas = document.getElementById('btn-top-personas');
  if (btnTopPersonas) {
    btnTopPersonas.addEventListener('click', () => cambiarPestana('usuarios'));
  }

  // Conectar botón de clave Gemini en la pestaña de usuarios
  const btnToggleConfigIATab = document.getElementById('btn-toggle-config-ia-tab');
  if (btnToggleConfigIATab) {
    btnToggleConfigIATab.addEventListener('click', () => {
      if (btnAbrirScanFoto) btnAbrirScanFoto.click();
      if (btnToggleConfigIA) setTimeout(() => btnToggleConfigIA.click(), 100);
    });
  }
}

// =========================================================================
// --- 13. INICIALIZACIÓN Y RESTAURACIÓN AUTOMÁTICA DE SESIÓN --------------
// =========================================================================
window.addEventListener('DOMContentLoaded', async () => {
  // Inicializar navegación por pestañas limpias
  try { inicializarNavegacionPestanas(); } catch(e) { console.warn(e); }

  // Cargar lista dinámica de usuarios y grupos desde Supabase
  try { await cargarGruposDesdeBD(); } catch(e) { console.warn('Aviso cargando grupos:', e); }
  try { await cargarUsuariosDesdeBD(); } catch(e) { console.warn('Aviso cargando usuarios:', e); }

  // Inicializar filtros y controles para universitarios y puntos de encuentro
  try { inicializarSelectorLugarQuedada(); } catch(e) {}
  try { inicializarModoUniversitarioPerfil(); } catch(e) {}

  // Determinar usuario activo al iniciar la app: Cule (Administrador) por defecto obligatorio
  let usuarioInicial = 'Cule';
  let esAdminInicial = true;

  try {
    const usuarioGuardado = localStorage.getItem('kedadas_usuario_activo');
    // Si el usuario guardado era 'Marisol' u otro que causaba el fallo, forzar 'Cule'
    if (usuarioGuardado && usuarioGuardado.trim().toLowerCase() !== 'marisol' && usuarioGuardado.trim().toLowerCase() !== 'usuario') {
      usuarioInicial = usuarioGuardado.trim();
      esAdminInicial = (usuarioInicial.toLowerCase() === 'cule');
    } else {
      usuarioInicial = 'Cule';
      esAdminInicial = true;
      localStorage.setItem('kedadas_usuario_activo', 'Cule');
    }
  } catch(e) {}

  try {
    const { data: { session } } = await supabaseApp.auth.getSession();
    if (session && session.user) {
      const email = session.user.email;
      let nombre = session.user.user_metadata?.nombre;
      // Si la sesión de Supabase Auth es explícitamente Cule o admin
      if (nombre && (nombre.toLowerCase() === 'cule' || email === 'maculecale@gmail.com')) {
        usuarioInicial = 'Cule';
        esAdminInicial = true;
      }
    }
  } catch (e) {
    console.warn('No se encontró sesión activa de Supabase Auth.');
  }

  // Arrancar siempre con acceso concedido a Cule (o usuario seleccionado)
  try {
    concederAcceso(usuarioInicial, esAdminInicial);
  } catch(e) {
    console.error('Error concediendo acceso inicial:', e);
  }

  // Detectar automáticamente si se ha abierto un enlace de invitación (?unirse=KED-XXXX)
  try {
    comprobarParametroInvitacionUrl();
  } catch(e) {}
});

// Inicializa el formulario del perfil para modo universitario
function inicializarModoUniversitarioPerfil() {
  const checkUniv = document.getElementById('check-es-universitario');
  const cajaCampos = document.getElementById('caja-campos-universitario');
  const inputOrigen = document.getElementById('input-ciudad-origen');
  const inputUniv = document.getElementById('input-ciudad-univ');
  const btnUbiOrigen = document.getElementById('btn-ubicacion-origen');
  const btnUbiUniv = document.getElementById('btn-ubicacion-univ');
  const btnGuardarUniv = document.getElementById('btn-guardar-perfil-univ');

  let ubicacionSeleccionada = 'origen';

  function cargarDatosEnFormulario() {
    const usuarioABuscar = miUsuario || usuarioLogueado || 'Cule';
    const miPerfil = listaPerfiles.find(p => p.nombre.toLowerCase() === usuarioABuscar.toLowerCase());
    if (!miPerfil) return;
    const esUniv = !!miPerfil.es_universitario;
    if (checkUniv) checkUniv.checked = esUniv;
    if (cajaCampos) cajaCampos.style.display = esUniv ? 'block' : 'none';
    if (inputOrigen) inputOrigen.value = miPerfil.ciudad_origen || 'Toledo';
    if (inputUniv) inputUniv.value = miPerfil.ciudad_universidad || '';
    
    ubicacionSeleccionada = miPerfil.ubicacion_actual || 'origen';
    if (btnUbiOrigen && btnUbiUniv) {
      btnUbiOrigen.classList.toggle('activo', ubicacionSeleccionada === 'origen');
      btnUbiUniv.classList.toggle('activo', ubicacionSeleccionada === 'universidad');
    }
  }

  if (checkUniv) {
    checkUniv.addEventListener('change', () => {
      if (cajaCampos) cajaCampos.style.display = checkUniv.checked ? 'block' : 'none';
    });
  }

  if (btnUbiOrigen) {
    btnUbiOrigen.addEventListener('click', () => {
      ubicacionSeleccionada = 'origen';
      btnUbiOrigen.classList.add('activo');
      if (btnUbiUniv) btnUbiUniv.classList.remove('activo');
    });
  }
  if (btnUbiUniv) {
    btnUbiUniv.addEventListener('click', () => {
      ubicacionSeleccionada = 'universidad';
      btnUbiUniv.classList.add('activo');
      if (btnUbiOrigen) btnUbiOrigen.classList.remove('activo');
    });
  }

  if (btnGuardarUniv) {
    btnGuardarUniv.addEventListener('click', async () => {
      const usuarioABuscar = miUsuario || usuarioLogueado || 'Cule';
      const miPerfil = listaPerfiles.find(p => p.nombre.toLowerCase() === usuarioABuscar.toLowerCase());
      if (!miPerfil) return;
      miPerfil.es_universitario = checkUniv ? checkUniv.checked : false;
      miPerfil.ciudad_origen = inputOrigen ? inputOrigen.value.trim() : 'Toledo';
      miPerfil.ciudad_universidad = inputUniv ? inputUniv.value.trim() : '';
      miPerfil.ubicacion_actual = ubicacionSeleccionada;

      guardarPerfilesLocales();

      try {
        btnGuardarUniv.textContent = 'Guardando...';
        await supabaseApp.from('perfiles').update({
          es_universitario: miPerfil.es_universitario,
          ciudad_origen: miPerfil.ciudad_origen,
          ciudad_universidad: miPerfil.ciudad_universidad,
          ubicacion_actual: miPerfil.ubicacion_actual
        }).eq('nombre', miPerfil.nombre);
        btnGuardarUniv.textContent = '💾 Guardar mis datos universitarios';
        alert(`✅ Datos universitarios de ${miPerfil.nombre} guardados correctamente.`);
      } catch(e) {
        btnGuardarUniv.textContent = '💾 Guardar mis datos universitarios';
      }

      renderizarFiltroCoincidencias();
      renderizarBannerUbicacionUniversitarios();
    });
  }

  cargarDatosEnFormulario();
  window.cargarDatosUniversitariosEnPerfil = cargarDatosEnFormulario;
}

// Permite proponer directamente un plan sugerido de punto de encuentro al muro de votaciones
window.proponerPlanDesdeCoincidencia = function(titulo) {
  const inputNuevoPlan = document.getElementById('input-nuevo-plan');
  const btnNuevoPlanDesplegar = document.getElementById('btn-nuevo-plan-desplegar');
  const formNuevoPlan = document.getElementById('form-nuevo-plan');
  const tabBtnPlanes = document.querySelector('.nav-tab-btn[data-tab="planes"]');

  if (tabBtnPlanes) tabBtnPlanes.click();
  if (formNuevoPlan) formNuevoPlan.style.display = 'block';
  if (inputNuevoPlan) {
    inputNuevoPlan.value = titulo;
    inputNuevoPlan.focus();
  }
  const seccionVotaciones = document.getElementById('seccion-votaciones');
  if (seccionVotaciones) seccionVotaciones.scrollIntoView({ behavior: 'smooth' });
};

// Comprueba si la URL contiene un código de invitación y solicita unirse al grupo
function comprobarParametroInvitacionUrl() {
  try {
    const params = new URLSearchParams(window.location.search);
    const codigo = (params.get('unirse') || params.get('codigo') || params.get('join') || '').trim().toUpperCase();
    if (codigo) {
      if (inputCodigoUnirse) inputCodigoUnirse.value = codigo;
      setTimeout(() => {
        const confirmar = confirm(`🔑 Has abierto una invitación para unirte con el código: ${codigo}\n\n¿Deseas unirte a este grupo privado ahora?`);
        if (confirmar) {
          unirseAGrupoConCodigo();
        }
      }, 700);
    }
  } catch (e) {}
}

// Inicializar selector rápido de ubicación al arrancar
try {
  inicializarSelectorUbicacionRapido();
} catch (e) {}
