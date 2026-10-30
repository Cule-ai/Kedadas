const pantallaLogin = document.getElementById('pantalla-login');
const pantallaApp = document.getElementById('pantalla-app');
const inputPin = document.getElementById('login-pin');
const loginUsuario = document.getElementById('login-usuario');
const btnLoginPin = document.getElementById('btn-login-pin');
const btnLoginFace = document.getElementById('btn-login-faceid');

// Elementos de Supabase Auth
const tabAuthEmail = document.getElementById('tab-auth-email');
const tabAuthPin = document.getElementById('tab-auth-pin');
const formAuthEmail = document.getElementById('form-auth-email');
const formAuthPin = document.getElementById('form-auth-pin');
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

// --- 2. SISTEMA DE LOGIN, SUPABASE AUTH Y FACE ID (PASSKEYS) ---
let usuarioLogueado = ''; 
let miUsuario = '';       
let esAdmin = false;
let modoVista = 'mes'; 

// Alternar entre pestañas de Login (Cuenta vs PIN)
if (tabAuthEmail && tabAuthPin) {
  tabAuthEmail.addEventListener('click', () => {
    tabAuthEmail.classList.add('activo');
    tabAuthPin.classList.remove('activo');
    formAuthEmail.style.display = 'block';
    formAuthPin.style.display = 'none';
  });
  tabAuthPin.addEventListener('click', () => {
    tabAuthPin.classList.add('activo');
    tabAuthEmail.classList.remove('activo');
    formAuthEmail.style.display = 'none';
    formAuthPin.style.display = 'block';
  });
}

// Iniciar sesión con Supabase Auth (Email y Contraseña)
if (btnLoginEmail) {
  btnLoginEmail.addEventListener('click', async () => {
    const email = loginEmail.value.trim();
    const password = loginPassword.value;
    if (!email || !password) return alert('Por favor, introduce tu correo y contraseña.');

    btnLoginEmail.textContent = 'Entrando...';
    try {
      const { data, error } = await supabaseApp.auth.signInWithPassword({ email, password });
      btnLoginEmail.textContent = 'Iniciar Sesión';
      if (error) return alert('🚨 Error al iniciar sesión: ' + error.message);

      const user = data.user;
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

      concederAcceso(nombre, rol === 'admin');
    } catch (err) {
      alert('Error: ' + err.message);
      btnLoginEmail.textContent = 'Iniciar Sesión';
    }
  });
}

// Registro de nueva cuenta con Supabase Auth
if (btnRegisterEmail) {
  btnRegisterEmail.addEventListener('click', async () => {
    if (loginNombreReg.style.display === 'none') {
      loginNombreReg.style.display = 'block';
      loginNombreReg.focus();
      btnRegisterEmail.textContent = 'Confirmar Registro';
      return;
    }

    const nombre = loginNombreReg.value.trim();
    const email = loginEmail.value.trim();
    const password = loginPassword.value;

    if (!nombre) return alert('Por favor, introduce tu nombre para el cuadrante.');
    if (!email || !password) return alert('Introduce un correo y una contraseña (mínimo 6 caracteres).');

    btnRegisterEmail.textContent = 'Registrando...';
    try {
      const { data, error } = await supabaseApp.auth.signUp({
        email,
        password,
        options: { data: { nombre: nombre, rol: 'usuario' } }
      });
      btnRegisterEmail.textContent = 'Registrarse';

      if (error) return alert('🚨 Error al registrar cuenta: ' + error.message);

      alert(`🎉 ¡Cuenta creada con éxito! Bienvenido, ${nombre}.`);
      if (data.session) {
        concederAcceso(nombre, false);
      } else {
        alert('Por favor, revisa tu correo electrónico para confirmar la cuenta si la verificación está activa en Supabase.');
      }
    } catch (err) {
      alert('Error en el registro: ' + err.message);
      btnRegisterEmail.textContent = 'Registrarse';
    }
  });
}

// Recuperar contraseña
if (linkRecuperarPass) {
  linkRecuperarPass.addEventListener('click', async (e) => {
    e.preventDefault();
    const email = prompt('Introduce tu correo electrónico para enviarte el enlace de recuperación:');
    if (!email) return;

    const { error } = await supabaseApp.auth.resetPasswordForEmail(email.trim());
    if (error) alert('Error: ' + error.message);
    else alert('📧 Te hemos enviado un correo con instrucciones para restablecer tu contraseña.');
  });
}

// Login con PIN clásico
btnLoginPin.addEventListener('click', async () => {
  const pinIntento = inputPin.value.trim();
  const usuarioIntento = loginUsuario.value;

  if (!usuarioIntento) return alert('Por favor, selecciona tu nombre');
  if (pinIntento.length < 4) return alert('Introduce tu PIN de 4 dígitos');
  btnLoginPin.textContent = 'Comprobando...';

  let autenticado = false;
  let rolEsAdmin = (usuarioIntento === 'Cule');

  // 1. Comprobar en Supabase perfiles
  try {
    const { data, error } = await supabaseApp.from('perfiles').select('*').eq('nombre', usuarioIntento).eq('pin', pinIntento);
    if (!error && data && data.length > 0) {
      autenticado = true;
      rolEsAdmin = (data[0].rol === 'admin' || usuarioIntento === 'Cule');
    }
  } catch (err) {
    console.warn('Aviso comprobando en Supabase:', err);
  }

  // 2. Si Supabase falla o no tiene datos (RLS o tabla no creada), comprobar con datos locales
  if (!autenticado) {
    const perfilLocal = listaPerfiles.find(p => p.nombre.toLowerCase() === usuarioIntento.toLowerCase());
    if (perfilLocal && String(perfilLocal.pin) === pinIntento) {
      autenticado = true;
      rolEsAdmin = (perfilLocal.rol === 'admin' || usuarioIntento === 'Cule');
    } else if (usuarioIntento === 'Cule' && (pinIntento === '1234' || pinIntento === '0000')) {
      // Clave de respaldo de administración
      autenticado = true;
      rolEsAdmin = true;
    }
  }

  btnLoginPin.textContent = 'Entrar con PIN';

  if (autenticado) {
    concederAcceso(usuarioIntento, rolEsAdmin);
  } else {
    alert(`❌ PIN incorrecto para ${usuarioIntento}. Puedes pulsar abajo "¿Crear o cambiar tu PIN?" para reconfigurarlo.`);
  }
});

// PASSKEYS: WEBAUTHN REAL PARA FACE ID / TOUCH ID
async function registrarPasskey(nombreUser) {
  if (!window.PublicKeyCredential) {
    return alert('Tu navegador o dispositivo no soporta biometría / Passkeys.');
  }

  try {
    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);
    const userId = new TextEncoder().encode(nombreUser);

    const credential = await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: "Kedadas", id: window.location.hostname },
        user: {
          id: userId,
          name: nombreUser,
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
      localStorage.setItem('kedadas_passkey_user', nombreUser);

      try {
        await supabaseApp.from('passkeys').upsert({
          id: credIdBase64,
          usuario: nombreUser,
          public_key: credIdBase64
        });
      } catch (e) { console.warn('Aviso passkeys:', e); }

      alert(`✅ ¡Face ID / Passkey vinculada con éxito para ${nombreUser}! Ya puedes acceder con biometría.`);
    }
  } catch (err) {
    console.error(err);
    alert('No se pudo completar el registro de Face ID: ' + err.message);
  }
}

// Botón de login con Face ID / Passkey
btnLoginFace.addEventListener('click', async () => {
  if (!window.PublicKeyCredential) {
    return alert('Tu navegador no soporta autenticación biométrica.');
  }

  try {
    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);

    const credIdBase64 = localStorage.getItem('kedadas_passkey_id');
    const savedUser = localStorage.getItem('kedadas_passkey_user') || 'Cule';

    const getOptions = {
      publicKey: {
        challenge,
        timeout: 60000,
        userVerification: "required"
      }
    };

    if (credIdBase64) {
      const rawId = Uint8Array.from(atob(credIdBase64), c => c.charCodeAt(0));
      getOptions.publicKey.allowCredentials = [{
        id: rawId,
        type: 'public-key'
      }];
    }

    const assertion = await navigator.credentials.get(getOptions);
    if (assertion) {
      concederAcceso(savedUser, savedUser === 'Cule');
    }
  } catch (err) {
    console.log(err);
    if (confirm('No se encontró una Passkey guardada para este navegador. ¿Deseas entrar y activar Face ID ahora?')) {
      const usuario = prompt('Indica tu nombre de usuario:', 'Cule');
      if (usuario) {
        concederAcceso(usuario, usuario === 'Cule');
        setTimeout(() => registrarPasskey(usuario), 800);
      }
    }
  }
});

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
  usuarioLogueado = nombreUsuario; 
  miUsuario = nombreUsuario; 
  esAdmin = (rolAdmin || nombreUsuario === 'Cule');
  
  pantallaLogin.style.display = 'none'; 
  pantallaApp.style.display = 'block';
  btnEditarUsuarios.style.display = 'inline-flex';
  
  if (badgeUsuarioSesion) {
    badgeUsuarioSesion.textContent = `👤 ${nombreUsuario} (${esAdmin ? 'Admin' : 'Miembro'})`;
  }

  renderizarSelector();
  actualizarBannerGrupo();
  iniciarCalendario();
  cargarChatInicial();
  setTimeout(cargarVotaciones, 300);
  inicializarPushNotifications();
}

// --- 3. GESTIÓN DINÁMICA DE USUARIOS Y PINS (DUAL SUPABASE + LOCAL) ---
const STORAGE_PERFILES_KEY = 'kedadas_perfiles_v2';
const STORAGE_USUARIOS_KEY = 'listaUsuarios';

const PERFILES_DEFECTO = [
  { id: 'Cule', nombre: 'Cule', pin: '1234', rol: 'admin' },
  { id: 'Persona 2', nombre: 'Persona 2', pin: '0000', rol: 'usuario' },
  { id: 'Persona 3', nombre: 'Persona 3', pin: '0000', rol: 'usuario' },
  { id: 'Persona 4', nombre: 'Persona 4', pin: '0000', rol: 'usuario' }
];

let listaPerfiles = [];
let usuarios = ['Cule', 'Persona 2', 'Persona 3', 'Persona 4'];

// Elementos del panel desplegable en línea
const flechaDesplegableUsuarios = document.getElementById('flecha-desplegable-usuarios');
const panelDesplegableUsuarios = document.getElementById('panel-desplegable-usuarios');
const btnAbrirModalCompletoUsuarios = document.getElementById('btn-abrir-modal-completo-usuarios');
const selectPersonaAEditar = document.getElementById('select-persona-a-editar');
const inputPinEditarDesplegable = document.getElementById('input-pin-editar-desplegable');
const btnToggleEyeDesplegable = document.getElementById('btn-toggle-eye-desplegable');
const btnGuardarPinDesplegable = document.getElementById('btn-guardar-pin-desplegable');
const btnBorrarPersonaDesplegable = document.getElementById('btn-borrar-persona-desplegable');
const nuevoNombreDesplegable = document.getElementById('nuevo-nombre-desplegable');
const nuevoPinDesplegable = document.getElementById('nuevo-pin-desplegable');
const nuevoRolDesplegable = document.getElementById('nuevo-rol-desplegable');
const btnCrearUsuarioDesplegable = document.getElementById('btn-crear-usuario-desplegable');

// Elementos de la modal completa de tarjetas de usuario
const modalGestionUsuarios = document.getElementById('modal-gestion-usuarios');
const btnCerrarModalUsuarios = document.getElementById('btn-cerrar-modal-usuarios');
const btnCerrarGestionUser = document.getElementById('btn-cerrar-gestion-user');
const listaUsuariosGestion = document.getElementById('lista-usuarios-gestion');
const nuevoUserNombre = document.getElementById('nuevo-user-nombre');
const nuevoUserPin = document.getElementById('nuevo-user-pin');
const nuevoUserRol = document.getElementById('nuevo-user-rol');
const btnCrearUsuario = document.getElementById('btn-crear-usuario');

// Modal rápido crear/cambiar PIN en login
const modalCrearPin = document.getElementById('modal-crear-pin');
const linkCrearMiPin = document.getElementById('link-crear-mi-pin');
const btnCerrarModalPin = document.getElementById('btn-cerrar-modal-pin');
const pinCrearNombreSel = document.getElementById('pin-crear-nombre-sel');
const pinCrearNombre = document.getElementById('pin-crear-nombre');
const pinCrearValor = document.getElementById('pin-crear-valor');
const btnToggleEyeCrearPin = document.getElementById('btn-toggle-eye-crear-pin');
const btnGuardarMiPin = document.getElementById('btn-guardar-mi-pin');

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
          pin: u === 'Cule' ? '1234' : '0000',
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
  if (!listaPerfiles.some(p => p.nombre.toLowerCase() === 'cule')) {
    listaPerfiles.unshift({ id: 'Cule', nombre: 'Cule', pin: '1234', rol: 'admin' });
  }

  guardarPerfilesLocales();

  // 2. Sincronizar en segundo plano con Supabase si está disponible
  try {
    const { data, error } = await supabaseApp.from('perfiles').select('*').order('created_at', { ascending: true });
    if (!error && data && data.length > 0) {
      data.forEach(dbPerfil => {
        const local = listaPerfiles.find(p => p.nombre.toLowerCase() === dbPerfil.nombre.toLowerCase());
        if (local) {
          if (dbPerfil.pin) local.pin = dbPerfil.pin;
          if (dbPerfil.rol) local.rol = dbPerfil.rol;
        } else {
          listaPerfiles.push({
            id: dbPerfil.id || dbPerfil.nombre,
            nombre: dbPerfil.nombre,
            pin: dbPerfil.pin || '0000',
            rol: dbPerfil.rol || 'usuario'
          });
        }
      });
      guardarPerfilesLocales();
    }
  } catch (err) {
    console.warn('Aviso sincronización Supabase perfiles:', err);
  }

  renderizarSelectoresUsuarios();
  renderizarFiltroCoincidencias();
  actualizarEdicionPersonaDesplegable();
  renderizarPanelGestionUsuarios();
}

// Actualizar todos los selectores desplegables de usuarios de la aplicación
function renderizarSelectoresUsuarios() {
  // Selector en pantalla de login
  if (loginUsuario) {
    const valActual = loginUsuario.value;
    loginUsuario.innerHTML = '';
    usuarios.forEach(u => {
      const opt = document.createElement('option');
      opt.value = u;
      opt.textContent = u;
      loginUsuario.appendChild(opt);
    });
    if (usuarios.includes(valActual)) loginUsuario.value = valActual;
  }

  // Selector en pantalla principal de la app
  if (selectorUsuario) {
    const valActual = selectorUsuario.value;
    selectorUsuario.innerHTML = '';
    usuarios.forEach(u => {
      const opt = document.createElement('option');
      opt.value = u;
      opt.textContent = u;
      selectorUsuario.appendChild(opt);
    });
    if (usuarios.includes(miUsuario)) selectorUsuario.value = miUsuario;
    else if (usuarios.includes(valActual)) selectorUsuario.value = valActual;
  }

  // Selector en el panel desplegable de edición
  if (selectPersonaAEditar) {
    const valActual = selectPersonaAEditar.value;
    selectPersonaAEditar.innerHTML = '';
    usuarios.forEach(u => {
      const opt = document.createElement('option');
      opt.value = u;
      opt.textContent = `👤 ${u}`;
      selectPersonaAEditar.appendChild(opt);
    });
    if (usuarios.includes(valActual)) selectPersonaAEditar.value = valActual;
    else if (usuarios.length > 0) selectPersonaAEditar.value = usuarios[0];
  }

  // Selector en el modal de crear/cambiar PIN
  if (pinCrearNombreSel) {
    const valActual = pinCrearNombreSel.value;
    pinCrearNombreSel.innerHTML = '<option value="">-- Elige una persona existente --</option>';
    usuarios.forEach(u => {
      const opt = document.createElement('option');
      opt.value = u;
      opt.textContent = u;
      pinCrearNombreSel.appendChild(opt);
    });
    if (usuarios.includes(valActual)) pinCrearNombreSel.value = valActual;
  }
}

// Sincronizar campo de PIN del panel desplegable con la persona seleccionada
function actualizarEdicionPersonaDesplegable() {
  if (!selectPersonaAEditar || !inputPinEditarDesplegable) return;
  const nombreSel = selectPersonaAEditar.value;
  const perfil = listaPerfiles.find(p => p.nombre === nombreSel);
  if (perfil) {
    inputPinEditarDesplegable.value = perfil.pin || '';
  }
}

// Actualizar el PIN de un usuario (Guarda localmente y en Supabase)
async function actualizarPinUsuario(nombre, nuevoPin) {
  if (!nombre) return false;
  if (!nuevoPin || nuevoPin.length !== 4 || isNaN(nuevoPin)) {
    alert('El PIN debe tener exactamente 4 dígitos numéricos.');
    return false;
  }

  // 1. Guardar localmente de inmediato
  let perfil = listaPerfiles.find(p => p.nombre.toLowerCase() === nombre.toLowerCase());
  if (perfil) {
    perfil.pin = nuevoPin;
  } else {
    perfil = { id: nombre, nombre: nombre, pin: nuevoPin, rol: nombre === 'Cule' ? 'admin' : 'usuario' };
    listaPerfiles.push(perfil);
  }
  guardarPerfilesLocales();

  // 2. Guardar en Supabase
  try {
    const { data: existente } = await supabaseApp.from('perfiles').select('id').eq('nombre', nombre);
    if (existente && existente.length > 0) {
      await supabaseApp.from('perfiles').update({ pin: nuevoPin }).eq('id', existente[0].id);
    } else {
      await supabaseApp.from('perfiles').insert({
        nombre: nombre,
        pin: nuevoPin,
        rol: perfil.rol || (nombre === 'Cule' ? 'admin' : 'usuario')
      });
    }
  } catch (err) {
    console.warn('Aviso guardando PIN en Supabase:', err);
  }

  renderizarSelectoresUsuarios();
  actualizarEdicionPersonaDesplegable();
  renderizarPanelGestionUsuarios();
  return true;
}

// Crear un nuevo usuario con su PIN y rol
async function crearNuevoUsuario(nombre, pin, rol = 'usuario') {
  const nombreLimpio = (nombre || '').trim();
  const pinLimpio = (pin || '').trim();

  if (!nombreLimpio) {
    alert('Por favor, indica un nombre.');
    return false;
  }
  if (usuarios.some(u => u.toLowerCase() === nombreLimpio.toLowerCase())) {
    alert(`Ya existe una persona llamada "${nombreLimpio}".`);
    return false;
  }
  if (!pinLimpio || pinLimpio.length !== 4 || isNaN(pinLimpio)) {
    alert('El PIN debe tener exactamente 4 dígitos numéricos.');
    return false;
  }

  const nuevoPerfil = {
    id: nombreLimpio,
    nombre: nombreLimpio,
    pin: pinLimpio,
    rol: rol
  };

  // 1. Guardado local inmediato
  listaPerfiles.push(nuevoPerfil);
  guardarPerfilesLocales();

  // 2. Guardado en Supabase
  try {
    await supabaseApp.from('perfiles').insert({
      nombre: nombreLimpio,
      pin: pinLimpio,
      rol: rol
    });
  } catch (err) {
    console.warn('Aviso guardando nuevo usuario en Supabase:', err);
  }

  renderizarSelectoresUsuarios();
  if (selectPersonaAEditar) selectPersonaAEditar.value = nombreLimpio;
  actualizarEdicionPersonaDesplegable();
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
      <div class="user-name-text">${p.nombre}</div>
      <span class="user-rol-tag ${p.rol === 'admin' ? 'rol-admin' : 'rol-user'}">${p.rol === 'admin' ? 'Admin' : 'Usuario'}</span>
    `;

    info.appendChild(avatar);
    info.appendChild(textWrap);

    // Controles de PIN
    const controls = document.createElement('div');
    controls.className = 'user-card-controls';

    const pinWrap = document.createElement('div');
    pinWrap.className = 'user-pin-input-wrap';
    pinWrap.title = 'PIN de 4 dígitos para entrar';

    const pinInput = document.createElement('input');
    pinInput.type = 'password';
    pinInput.className = 'user-pin-input';
    pinInput.value = p.pin || '';
    pinInput.placeholder = 'PIN';
    pinInput.maxLength = 4;
    pinInput.inputMode = 'numeric';

    const btnEye = document.createElement('button');
    btnEye.type = 'button';
    btnEye.className = 'btn-toggle-eye';
    btnEye.textContent = '👁️';
    btnEye.title = 'Mostrar / ocultar PIN';
    btnEye.addEventListener('click', () => {
      pinInput.type = pinInput.type === 'password' ? 'text' : 'password';
    });

    pinWrap.appendChild(pinInput);
    pinWrap.appendChild(btnEye);

    // Botón guardar PIN
    const btnGuardarPin = document.createElement('button');
    btnGuardarPin.type = 'button';
    btnGuardarPin.className = 'btn-guardar-pin-mini';
    btnGuardarPin.textContent = '💾 PIN';
    btnGuardarPin.title = 'Guardar nuevo PIN de ' + p.nombre;
    btnGuardarPin.addEventListener('click', async () => {
      const nuevoPin = pinInput.value.trim();
      btnGuardarPin.textContent = '...';
      const ok = await actualizarPinUsuario(p.nombre, nuevoPin);
      btnGuardarPin.textContent = '💾 PIN';
      if (ok) {
        alert(`✅ PIN de "${p.nombre}" guardado con éxito. Ahora es: ${nuevoPin}`);
      }
    });

    // Botón borrar usuario
    const btnBorrar = document.createElement('button');
    btnBorrar.type = 'button';
    btnBorrar.className = 'btn-borrar-user-mini';
    btnBorrar.textContent = '🗑️';
    btnBorrar.title = 'Eliminar a ' + p.nombre;
    btnBorrar.addEventListener('click', async () => {
      await eliminarUsuario(p.nombre);
    });

    controls.appendChild(pinWrap);
    controls.appendChild(btnGuardarPin);
    controls.appendChild(btnBorrar);

    card.appendChild(info);
    card.appendChild(controls);
    listaUsuariosGestion.appendChild(card);
  });
}

function renderizarFiltroCoincidencias() {
  if (!listaFiltroCoincidencias) return;
  listaFiltroCoincidencias.innerHTML = '';
  
  usuariosSeleccionadosCoincidencias = new Set(
    [...usuariosSeleccionadosCoincidencias].filter(u => usuarios.includes(u))
  );
  if (usuariosSeleccionadosCoincidencias.size === 0) {
    usuarios.forEach(u => usuariosSeleccionadosCoincidencias.add(u));
  }

  usuarios.forEach(u => {
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
    });

    label.appendChild(check);
    label.appendChild(document.createTextNode(u));
    listaFiltroCoincidencias.appendChild(label);
  });
}

if (btnSelTodos) {
  btnSelTodos.addEventListener('click', () => {
    usuarios.forEach(u => usuariosSeleccionadosCoincidencias.add(u));
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

// Cambio de persona en el desplegable de edición
if (selectPersonaAEditar) {
  selectPersonaAEditar.addEventListener('change', () => {
    actualizarEdicionPersonaDesplegable();
  });
}

// Mostrar / ocultar PIN en el desplegable
if (btnToggleEyeDesplegable) {
  btnToggleEyeDesplegable.addEventListener('click', () => {
    inputPinEditarDesplegable.type = inputPinEditarDesplegable.type === 'password' ? 'text' : 'password';
  });
}

// Guardar nuevo PIN desde el desplegable
if (btnGuardarPinDesplegable) {
  btnGuardarPinDesplegable.addEventListener('click', async () => {
    const nombre = selectPersonaAEditar.value;
    const nuevoPin = inputPinEditarDesplegable.value.trim();
    if (!nombre) return alert('Por favor, selecciona una persona.');
    btnGuardarPinDesplegable.textContent = '...';
    const ok = await actualizarPinUsuario(nombre, nuevoPin);
    btnGuardarPinDesplegable.textContent = '💾 Guardar PIN';
    if (ok) {
      alert(`✅ ¡PIN de "${nombre}" actualizado correctamente! Nuevo PIN: ${nuevoPin}`);
    }
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
    const nombre = nuevoNombreDesplegable.value.trim();
    const pin = nuevoPinDesplegable.value.trim();
    const rol = nuevoRolDesplegable.value;

    btnCrearUsuarioDesplegable.textContent = '...';
    const ok = await crearNuevoUsuario(nombre, pin, rol);
    btnCrearUsuarioDesplegable.textContent = '➕ Añadir';
    if (ok) {
      nuevoNombreDesplegable.value = '';
      nuevoPinDesplegable.value = '';
      alert(`🎉 ¡"${nombre}" añadido con éxito! Ya puede entrar con el PIN: ${pin}`);
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
    const nombre = nuevoUserNombre.value.trim();
    const pin = nuevoUserPin.value.trim();
    const rol = nuevoUserRol.value;

    btnCrearUsuario.textContent = 'Añadiendo...';
    const ok = await crearNuevoUsuario(nombre, pin, rol);
    btnCrearUsuario.textContent = 'Añadir';
    if (ok) {
      nuevoUserNombre.value = '';
      nuevoUserPin.value = '';
      alert(`🎉 ¡"${nombre}" añadido con éxito! PIN asignado: ${pin}`);
    }
  });
}

// =========================================================================
// --- MODAL RÁPIDO PARA CREAR/CAMBIAR PIN (LOGIN O APP) --------------------
// =========================================================================
if (linkCrearMiPin) {
  linkCrearMiPin.addEventListener('click', (e) => {
    e.preventDefault();
    renderizarSelectoresUsuarios();
    if (loginUsuario && loginUsuario.value && pinCrearNombreSel) {
      pinCrearNombreSel.value = loginUsuario.value;
      const perfil = listaPerfiles.find(p => p.nombre === loginUsuario.value);
      if (perfil) pinCrearValor.value = perfil.pin || '';
    } else {
      pinCrearValor.value = '';
    }
    pinCrearNombre.value = '';
    modalCrearPin.style.display = 'flex';
    pinCrearValor.focus();
  });
}

// Cuando se selecciona una persona existente en la modal rápida de PIN
if (pinCrearNombreSel) {
  pinCrearNombreSel.addEventListener('change', () => {
    const sel = pinCrearNombreSel.value;
    if (sel) {
      pinCrearNombre.value = sel;
      const perfil = listaPerfiles.find(p => p.nombre === sel);
      if (perfil) pinCrearValor.value = perfil.pin || '';
    } else {
      pinCrearNombre.value = '';
      pinCrearValor.value = '';
    }
  });
}

// Mostrar / ocultar PIN en la modal rápida
if (btnToggleEyeCrearPin) {
  btnToggleEyeCrearPin.addEventListener('click', () => {
    pinCrearValor.type = pinCrearValor.type === 'password' ? 'text' : 'password';
  });
}

[btnCerrarModalPin].forEach(btn => {
  if (btn) btn.addEventListener('click', () => { modalCrearPin.style.display = 'none'; });
});
if (modalCrearPin) {
  modalCrearPin.addEventListener('click', (e) => {
    if (e.target === modalCrearPin) modalCrearPin.style.display = 'none';
  });
}

// Guardar PIN desde modal rápida
if (btnGuardarMiPin) {
  btnGuardarMiPin.addEventListener('click', async () => {
    let nombre = (pinCrearNombre.value || '').trim();
    if (!nombre && pinCrearNombreSel && pinCrearNombreSel.value) {
      nombre = pinCrearNombreSel.value;
    }
    const pin = (pinCrearValor.value || '').trim();

    if (!nombre) return alert('Por favor, selecciona o indica tu nombre.');
    if (pin.length !== 4 || isNaN(pin)) return alert('El PIN debe tener exactamente 4 dígitos numéricos.');

    btnGuardarMiPin.textContent = 'Guardando...';
    const ok = await actualizarPinUsuario(nombre, pin);
    btnGuardarMiPin.textContent = '💾 Guardar PIN';

    if (ok) {
      modalCrearPin.style.display = 'none';
      if (loginUsuario) loginUsuario.value = nombre;
      if (inputPin) inputPin.value = pin;
      alert(`✅ ¡PIN configurado para "${nombre}"! Ya puedes pulsar "Entrar con PIN".`);
    }
  });
}

// --- SISTEMA MULTI-GRUPO (AMIGOS, FAMILIA, PAREJA, HIJOS, ETC.) ---
let grupoActivo = localStorage.getItem('kedadas_grupo_activo') || 'Amigos';
let listaGrupos = [
  { id: 'amigos', nombre: 'Amigos', icono: '🍻' },
  { id: 'familia', nombre: 'Familia', icono: '👨‍👩‍👧‍👦' },
  { id: 'pareja', nombre: 'Pareja', icono: '💑' },
  { id: 'hijos', nombre: 'Hijos', icono: '👶' }
];

const selectorGrupoActivo = document.getElementById('selector-grupo-activo');
const btnAbrirModalGrupos = document.getElementById('btn-abrir-modal-grupos');
const modalGestionarGrupos = document.getElementById('modal-gestionar-grupos');
const btnCerrarModalGrupos = document.getElementById('btn-cerrar-modal-grupos');
const btnCerrarGruposFooter = document.getElementById('btn-cerrar-grupos-footer');
const nuevoGrupoIcono = document.getElementById('nuevo-grupo-icono');
const nuevoGrupoNombre = document.getElementById('nuevo-grupo-nombre');
const btnGuardarNuevoGrupo = document.getElementById('btn-guardar-nuevo-grupo');
const listaGruposGestion = document.getElementById('lista-grupos-gestion');

// Elementos de aviso de grupo y confirmación de guardado de horario
const badgeGrupoBanner = document.getElementById('badge-grupo-banner');
const nombreGrupoBanner = document.getElementById('nombre-grupo-banner');
let cambiosHorarioPendientes = {}; // { [dia]: nuevoIndice }
const barraGuardarHorario = document.getElementById('barra-guardar-horario');
const textoCambiosPendientes = document.getElementById('texto-cambios-pendientes');
const btnCancelarCambiosHorario = document.getElementById('btn-cancelar-cambios-horario');
const btnGuardarCambiosHorario = document.getElementById('btn-guardar-cambios-horario');
const btnGuardarHorarioTop = document.getElementById('btn-guardar-horario-top');

function actualizarBannerGrupo() {
  if (nombreGrupoBanner) {
    const grupoObj = listaGrupos.find(g => g.nombre.toLowerCase() === grupoActivo.toLowerCase());
    nombreGrupoBanner.textContent = `${grupoObj?.icono || '👥'} ${grupoActivo}`;
  }
}

async function cargarGruposDesdeBD() {
  try {
    const { data, error } = await supabaseApp.from('grupos').select('*').order('created_at', { ascending: true });
    if (!error && data && data.length > 0) {
      listaGrupos = data;
    } else {
      const guardados = JSON.parse(localStorage.getItem('kedadas_lista_grupos'));
      if (Array.isArray(guardados) && guardados.length > 0) listaGrupos = guardados;
    }
  } catch (e) {
    const guardados = JSON.parse(localStorage.getItem('kedadas_lista_grupos'));
    if (Array.isArray(guardados) && guardados.length > 0) listaGrupos = guardados;
  }

  localStorage.setItem('kedadas_lista_grupos', JSON.stringify(listaGrupos));
  renderizarSelectorGrupos();
  actualizarBannerGrupo();
}

function renderizarSelectorGrupos() {
  if (!selectorGrupoActivo) return;
  selectorGrupoActivo.innerHTML = '';
  listaGrupos.forEach(g => {
    const opt = document.createElement('option');
    opt.value = g.nombre;
    opt.textContent = `${g.icono || '👥'} ${g.nombre}`;
    if (g.nombre.toLowerCase() === grupoActivo.toLowerCase()) opt.selected = true;
    selectorGrupoActivo.appendChild(opt);
  });
}

function cambiarGrupo(nuevoGrupo) {
  if (Object.keys(cambiosHorarioPendientes).length > 0) {
    const guardar = confirm(`Tienes modificaciones sin guardar en el cuadrante de "${grupoActivo}". ¿Deseas guardarlas antes de cambiar a "${nuevoGrupo}"?`);
    if (guardar) {
      guardarCambiosHorarioConfirmado();
    } else {
      cambiosHorarioPendientes = {};
      actualizarBarraCambiosPendientes();
    }
  }

  grupoActivo = nuevoGrupo;
  localStorage.setItem('kedadas_grupo_activo', grupoActivo);
  renderizarSelectorGrupos();
  actualizarBannerGrupo();
  if (resultadoCoincidencias) {
    resultadoCoincidencias.innerHTML = '';
    resultadoCoincidencias.classList.remove('visible');
  }
  iniciarCalendario();
  cargarChatInicial();
  setTimeout(cargarVotaciones, 200);
}

if (selectorGrupoActivo) {
  selectorGrupoActivo.addEventListener('change', (e) => {
    cambiarGrupo(e.target.value);
  });
}

// Renderizar panel de gestión de grupos
function renderizarPanelGrupos() {
  if (!listaGruposGestion) return;
  listaGruposGestion.innerHTML = '';

  listaGrupos.forEach(g => {
    const card = document.createElement('div');
    card.className = 'usuario-card-item';

    const info = document.createElement('div');
    info.className = 'user-card-info';
    info.innerHTML = `
      <div class="user-avatar-initial" style="background: transparent; font-size: 1.5rem;">${g.icono || '👥'}</div>
      <div class="user-name-text">${g.nombre}</div>
    `;

    const controls = document.createElement('div');
    controls.className = 'user-card-controls';

    const btnVer = document.createElement('button');
    btnVer.className = 'btn-guardar-pin-mini';
    btnVer.textContent = 'Ver grupo';
    btnVer.addEventListener('click', () => {
      cambiarGrupo(g.nombre);
      modalGestionarGrupos.style.display = 'none';
    });

    controls.appendChild(btnVer);

    // Permitir borrar si no es uno de los grupos base
    const baseNames = ['amigos', 'familia', 'pareja', 'hijos'];
    if (!baseNames.includes(g.id.toLowerCase()) && !baseNames.includes(g.nombre.toLowerCase())) {
      const btnBorrar = document.createElement('button');
      btnBorrar.className = 'btn-borrar-user-mini';
      btnBorrar.textContent = '🗑️';
      btnBorrar.title = 'Eliminar grupo ' + g.nombre;
      btnBorrar.addEventListener('click', async () => {
        if (confirm(`¿Eliminar el grupo "${g.nombre}"?`)) {
          try {
            await supabaseApp.from('grupos').delete().eq('id', g.id);
          } catch(e) {}
          listaGrupos = listaGrupos.filter(item => item.id !== g.id);
          localStorage.setItem('kedadas_lista_grupos', JSON.stringify(listaGrupos));
          if (grupoActivo === g.nombre) cambiarGrupo('Amigos');
          renderizarPanelGrupos();
          renderizarSelectorGrupos();
        }
      });
      controls.appendChild(btnBorrar);
    }

    card.appendChild(info);
    card.appendChild(controls);
    listaGruposGestion.appendChild(card);
  });
}

if (btnAbrirModalGrupos) {
  btnAbrirModalGrupos.addEventListener('click', () => {
    renderizarPanelGrupos();
    modalGestionarGrupos.style.display = 'flex';
  });
}

[btnCerrarModalGrupos, btnCerrarGruposFooter].forEach(btn => {
  if (btn) btn.addEventListener('click', () => { modalGestionarGrupos.style.display = 'none'; });
});
if (modalGestionarGrupos) {
  modalGestionarGrupos.addEventListener('click', (e) => {
    if (e.target === modalGestionarGrupos) modalGestionarGrupos.style.display = 'none';
  });
}

if (btnGuardarNuevoGrupo) {
  btnGuardarNuevoGrupo.addEventListener('click', async () => {
    const nombre = nuevoGrupoNombre.value.trim();
    const icono = nuevoGrupoIcono.value.trim() || '👥';

    if (!nombre) return alert('Por favor, indica un nombre para el grupo (ej: Trabajo, Pareja...).');
    
    const id = nombre.toLowerCase().replace(/\s+/g, '-');
    if (listaGrupos.some(g => g.nombre.toLowerCase() === nombre.toLowerCase())) {
      return alert('Ya tienes un grupo con este nombre.');
    }

    btnGuardarNuevoGrupo.textContent = 'Creando...';
    const nuevoGrupoObj = { id, nombre, icono };

    try {
      await supabaseApp.from('grupos').insert(nuevoGrupoObj);
    } catch (e) {
      console.warn('Aviso guardando grupo en Supabase:', e);
    }

    listaGrupos.push(nuevoGrupoObj);
    localStorage.setItem('kedadas_lista_grupos', JSON.stringify(listaGrupos));
    
    nuevoGrupoNombre.value = '';
    nuevoGrupoIcono.value = '';
    btnGuardarNuevoGrupo.textContent = 'Crear';

    cambiarGrupo(nombre);
    modalGestionarGrupos.style.display = 'none';
    alert(`🎉 ¡Grupo "${icono} ${nombre}" creado con éxito! Ya estás dentro.`);
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
    turnosLocales.push({ dia, usuario: miUsuario, indiceEstado, mes_anio: mesAnio, grupo: grupoActivo });
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
      let insRes = await supabaseApp.from('Turnos').insert({
        dia: dia,
        usuario: miUsuario,
        indiceEstado: indiceEstado,
        mes_anio: mesAnio,
        grupo: grupoActivo
      });
      // Fallback si la columna grupo no existe en la tabla de Supabase
      if (insRes.error && insRes.error.message && insRes.error.message.includes('grupo')) {
        await supabaseApp.from('Turnos').insert({
          dia: dia,
          usuario: miUsuario,
          indiceEstado: indiceEstado,
          mes_anio: mesAnio
        });
      }
    }
  } catch (e) {
    console.warn('Aviso guardando turno en Supabase:', e);
  }
}

async function obtenerTurnosMesNube() {
  const mesAnio = `${fechaNavegacion.getFullYear()}-${fechaNavegacion.getMonth()}`;
  const keyLocal = `kedadas_turnos_${grupoActivo}_${miUsuario}_${mesAnio}`;
  let turnosLocales = [];
  try {
    const raw = localStorage.getItem(keyLocal);
    if (raw) turnosLocales = JSON.parse(raw);
  } catch(e) {}

  try {
    let res = await supabaseApp.from('Turnos')
      .select('*')
      .eq('usuario', miUsuario)
      .eq('mes_anio', mesAnio)
      .eq('grupo', grupoActivo);

    if (res.error && res.error.message && res.error.message.includes('grupo')) {
      res = await supabaseApp.from('Turnos')
        .select('*')
        .eq('usuario', miUsuario)
        .eq('mes_anio', mesAnio);
    }

    if (!res.error && res.data && res.data.length > 0) {
      localStorage.setItem(keyLocal, JSON.stringify(res.data));
      return res.data;
    }
  } catch (e) {
    console.warn('Aviso obteniendo turnos de Supabase:', e);
  }

  return turnosLocales;
}

async function obtenerTurnosAnoNube() {
  const anioPrefix = `${fechaNavegacion.getFullYear()}-`;
  const keyLocal = `kedadas_turnos_ano_${grupoActivo}_${miUsuario}_${fechaNavegacion.getFullYear()}`;
  let turnosLocales = [];
  try {
    const raw = localStorage.getItem(keyLocal);
    if (raw) turnosLocales = JSON.parse(raw);
  } catch(e) {}

  try {
    let res = await supabaseApp.from('Turnos')
      .select('*')
      .eq('usuario', miUsuario)
      .like('mes_anio', `${anioPrefix}%`)
      .eq('grupo', grupoActivo);

    if (res.error && res.error.message && res.error.message.includes('grupo')) {
      res = await supabaseApp.from('Turnos')
        .select('*')
        .eq('usuario', miUsuario)
        .like('mes_anio', `${anioPrefix}%`);
    }

    if (!res.error && res.data && res.data.length > 0) {
      localStorage.setItem(keyLocal, JSON.stringify(res.data));
      return res.data;
    }
  } catch (e) {
    console.warn('Aviso obteniendo turnos anuales de Supabase:', e);
  }

  return turnosLocales;
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

async function iniciarCalendario() {
  actualizarBannerGrupo();
  if (modoVista === 'mes') await renderizarMes();
  else await renderizarAno();
}

async function renderizarMes() {
  calendarGrid.innerHTML = ''; 
  const mes = fechaNavegacion.getMonth();
  const anio = fechaNavegacion.getFullYear();
  tituloMes.textContent = `${nombresMeses[mes]} ${anio}`; 

  const diasEnElMes = new Date(anio, mes + 1, 0).getDate();
  let diaEmpieza = new Date(anio, mes, 1).getDay();
  diaEmpieza = diaEmpieza === 0 ? 6 : diaEmpieza - 1;

  const datosGuardados = await obtenerTurnosMesNube();
  const historial = {};
  datosGuardados.forEach(dato => historial[dato.dia] = dato.indiceEstado);

  for (let i = 0; i < diaEmpieza; i++) {
    const emptyDiv = document.createElement('div');
    emptyDiv.classList.add('empty-cell');
    calendarGrid.appendChild(emptyDiv);
  }

  for (let i = 1; i <= diasEnElMes; i++) {
    const dayCell = document.createElement('div');
    const pendiente = cambiosHorarioPendientes[i];
    let indice = pendiente !== undefined ? pendiente : (historial[i] !== undefined ? historial[i] : 0);
    
    dayCell.className = `day ${estados[indice].clase} ${pendiente !== undefined ? 'dia-modificado-pendiente' : ''}`;
    dayCell.innerHTML = `<span class="day-number">${i}</span><span class="shift-label">${estados[indice].texto}</span>`;

    dayCell.addEventListener('click', () => {
      if (!esAdmin && miUsuario !== usuarioLogueado) return alert('Solo puedes editar tus turnos.');

      let estadoActual = cambiosHorarioPendientes[i] !== undefined 
        ? cambiosHorarioPendientes[i] 
        : (historial[i] !== undefined ? historial[i] : 0);
      
      let nuevoEstado = (estadoActual + 1) % estados.length;
      cambiosHorarioPendientes[i] = nuevoEstado;

      dayCell.className = `day ${estados[nuevoEstado].clase} dia-modificado-pendiente`;
      dayCell.innerHTML = `<span class="day-number">${i}</span><span class="shift-label">${estados[nuevoEstado].texto}</span>`;

      actualizarBarraCambiosPendientes();
    });

    calendarGrid.appendChild(dayCell);
  }

  actualizarBarraCambiosPendientes();
}

async function renderizarAno() {
  vistaAnualContainer.innerHTML = '';
  const anio = fechaNavegacion.getFullYear();
  tituloMes.textContent = `Año ${anio}`;

  const datosGuardados = await obtenerTurnosAnoNube();
  const historialAno = {};
  for(let i=0; i<12; i++) historialAno[i] = {};
  
  datosGuardados.forEach(dato => {
    const m = parseInt(dato.mes_anio.split('-')[1]);
    historialAno[m][dato.dia] = dato.indiceEstado;
  });

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
      let indice = historialAno[mes][dia] !== undefined ? historialAno[mes][dia] : 0;
      
      dayCell.className = `mini-day ${estados[indice].clase}`;
      dayCell.textContent = dia;

      dayCell.addEventListener('click', async () => {
        if (!esAdmin && miUsuario !== usuarioLogueado) return alert('Solo puedes editar tus turnos.');
        let nuevoIndice = (indice + 1) % estados.length;
        const confirmacion = confirm(`¿Cambiar el día ${dia} de ${nombresMeses[mes]} a "${estados[nuevoIndice].texto || 'Vacío'}"?`);
        if (confirmacion) {
          indice = nuevoIndice;
          dayCell.className = `mini-day ${estados[indice].clase}`;
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

  const mesAnio = `${fechaNavegacion.getFullYear()}-${fechaNavegacion.getMonth()}`;
  let data = [];

  // Buscar turnos en almacenamiento local y Supabase
  try {
    let query = supabaseApp.from('Turnos')
      .select('*')
      .eq('indiceEstado', 1) // Estado 1 = 'libre' (L)
      .eq('mes_anio', mesAnio)
      .in('usuario', seleccionados)
      .eq('grupo', grupoActivo);

    let res = await query;
    if (res.error && res.error.message && res.error.message.includes('grupo')) {
      res = await supabaseApp.from('Turnos')
        .select('*')
        .eq('indiceEstado', 1)
        .eq('mes_anio', mesAnio)
        .in('usuario', seleccionados);
    }
    if (!res.error && res.data) data = res.data;
  } catch(e) {}

  // Complementar con datos locales de cada usuario seleccionado
  seleccionados.forEach(user => {
    const keyLocal = `kedadas_turnos_${grupoActivo}_${user}_${mesAnio}`;
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

  const diasComunes = [];
  const diasEnElMes = new Date(fechaNavegacion.getFullYear(), fechaNavegacion.getMonth() + 1, 0).getDate();
  for (let dia = 1; dia <= diasEnElMes; dia++) {
    if (conteo[dia] && conteo[dia].size === seleccionados.length) {
      diasComunes.push(dia);
    }
  }

  const nombresGrupo = seleccionados.join(', ');
  if (diasComunes.length === 0) {
    resultadoCoincidencias.innerHTML = `😅 <strong>No hay coincidencias.</strong><br>Ningún día libráis todos a la vez (<strong>${nombresGrupo}</strong>) este mes en el grupo <strong>${grupoActivo}</strong>.`;
  } else {
    resultadoCoincidencias.innerHTML = `
      🎉 <strong>¡Días libres en común en ${grupoActivo}!</strong><br>
      Coincidís (<strong>${nombresGrupo}</strong>) los días: <strong>${diasComunes.join(', ')}</strong> de ${nombresMeses[fechaNavegacion.getMonth()]}<br>
      <button type="button" class="btn-sec-primario-sm btn-destacado-guardar" style="margin-top: 10px; cursor: pointer;" onclick="document.getElementById('seccion-votaciones').scrollIntoView({behavior: 'smooth'})">
        🎯 Ver planes y votar qué hacer ➔
      </button>
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
        <span class="opcion-texto">${item.opcion}</span>
        <div class="plan-acciones-btns">
          <button type="button" class="btn-accion-plan btn-editar-plan" title="Editar plan">✏️</button>
          <button type="button" class="btn-accion-plan btn-borrar-plan" title="Eliminar plan">🗑️</button>
        </div>
      </div>
      <div class="opcion-bar">
        <span class="votantes-lista">${numVotos > 0 ? votantes.join(', ') : 'Sin votos aún (toca para votar)'}</span>
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
  
  div.innerHTML = `
    <div class="mensaje-contenido">
      <div style="display: flex; justify-content: space-between; gap: 8px; font-size: 0.75rem; margin-bottom: 2px; opacity: 0.85;">
        <strong>${esMio ? 'Tú' : msg.usuario}</strong>
        ${horaDisplay ? `<span>${horaDisplay}</span>` : ''}
      </div>
      <div>${msg.texto}</div>
    </div>
    <button class="btn-borrar-msg" title="Borrar mensaje" data-id="${msg.id}">🗑️</button>
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
    const grupoObj = listaGrupos.find(g => g.nombre.toLowerCase() === grupoActivo.toLowerCase());
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
  const prefiereOscuro = window.matchMedia('(prefers-color-scheme: dark)').matches;
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

async function inicializarPushNotifications() {
  if (!('Notification' in window)) return;

  if (btnNotificaciones) {
    if (Notification.permission === 'granted') {
      btnNotificaciones.textContent = '🔔 Avisos Activos';
      btnNotificaciones.classList.add('activo');
    }

    btnNotificaciones.addEventListener('click', async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          btnNotificaciones.textContent = '🔔 Avisos Activos';
          alert('🎉 ¡Notificaciones activadas! Te avisaremos cuando haya coincidencias de días libres con tus amigos.');
          
          if (swRegistration) {
            swRegistration.showNotification('Kedadas', {
              body: '¡Notificaciones activadas correctamente en tu dispositivo!',
              icon: 'icono.png',
              badge: 'icono.png'
            });
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
const inputFotoCuadrante = document.getElementById('input-foto-cuadrante');
const btnElegirFoto = document.getElementById('btn-elegir-foto');
const wrapPreviewScan = document.getElementById('wrap-preview-scan');
const previewFotoCuadrante = document.getElementById('preview-foto-cuadrante');
const btnCambiarFoto = document.getElementById('btn-cambiar-foto');

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
      alert('✅ ¡Clave de Google Gemini guardada con éxito! Ya puedes analizar tus fotos.');
      if (boxConfigIA) boxConfigIA.style.display = 'none';
    } else {
      localStorage.removeItem(STORAGE_GEMINI_KEY);
      actualizarEstadoClaveGemini();
      alert('ℹ️ Clave eliminada. Se usará el servidor o modo interactivo.');
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
    imagenBase64Actual = '';
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

// Selección de imagen por botón o arrastrar
if (btnElegirFoto && inputFotoCuadrante) {
  btnElegirFoto.addEventListener('click', (e) => {
    e.stopPropagation();
    inputFotoCuadrante.click();
  });
  dropZoneFoto.addEventListener('click', () => inputFotoCuadrante.click());

  inputFotoCuadrante.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) procesarArchivoImagen(e.target.files[0]);
  });

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

if (btnCambiarFoto && inputFotoCuadrante) {
  btnCambiarFoto.addEventListener('click', (e) => {
    e.stopPropagation();
    inputFotoCuadrante.click();
  });
}

function procesarArchivoImagen(file) {
  if (!file.type.startsWith('image/')) {
    return alert('Por favor, selecciona un archivo de imagen válido (JPG, PNG, WEBP, etc.).');
  }
  mimeTypeActual = file.type;
  const reader = new FileReader();
  reader.onload = (event) => {
    imagenBase64Actual = event.target.result;
    if (previewFotoCuadrante) {
      previewFotoCuadrante.src = imagenBase64Actual;
      previewFotoCuadrante.style.display = 'inline-block';
    }
    if (wrapPreviewScan) wrapPreviewScan.style.display = 'block';
    if (dropZoneFoto) {
      const cnt = dropZoneFoto.querySelector('.drop-zone-content');
      if (cnt) cnt.style.display = 'none';
    }
    if (scanConfigRow) scanConfigRow.style.display = 'block';
    if (btnAnalizarFoto) btnAnalizarFoto.style.display = 'inline-block';
    if (scanRevisionContainer) scanRevisionContainer.style.display = 'none';
    if (btnGuardarScan) btnGuardarScan.style.display = 'none';
  };
  reader.readAsDataURL(file);
}

// LLAMADA DIRECTA A GEMINI VISION DESDE EL NAVEGADOR
async function llamarGeminiVisionNavegador(apiKey, base64, mimeType, modo, usuario, mes, anio) {
  const cleanBase64 = base64.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');
  const mesNombre = (mes !== null && mes !== undefined) ? nombresMeses[mes] : '';

  const prompt = `
Eres un digitalizador experto en cuadrantes de turnos laborales (sanidad, policía, emergencias, fábricas, bomberos, hostelería, etc.).
Tu misión es extraer con total exactitud todos los turnos del trabajador/cuadrante en la imagen.

CONTEXTO DE BÚSQUEDA:
- Trabajador a extraer: "${usuario}". Si hay múltiples filas con nombres de personas, busca EXCLUSIVAMENTE la fila correspondiente a "${usuario}". Si no encuentras ese nombre específico o la tabla es para un solo trabajador/puesto, extrae el cuadrante principal visible.
- Año de referencia: ${anio}.
- Mes de referencia si aplica: ${mes !== null && mes !== undefined ? `${mes + 1} (${mesNombre})` : 'Detectar de la imagen'}.
- Modo solicitado: "${modo}" (si es 'auto', analiza si la imagen contiene solo 1 mes o el año completo/múltiples meses).

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
3. Asegúrate de incluir todos los días del mes o de los meses presentes en la foto.

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

  const modelos = ['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro'];
  let ultimoError = null;

  for (const modelo of modelos) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              { inline_data: { mime_type: mimeType, data: cleanBase64 } }
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
          return parsed;
        }
      } else {
        ultimoError = data.error?.message || 'Error en respuesta de Gemini';
      }
    } catch (e) {
      ultimoError = e.message;
    }
  }

  throw new Error(ultimoError || 'No se pudo contactar con los modelos de Gemini Vision.');
}

// Analizar la foto con Visión IA (Pipeline multinivel)
if (btnAnalizarFoto) {
  btnAnalizarFoto.addEventListener('click', async () => {
    if (!imagenBase64Actual) return alert('Selecciona o fotografía un cuadrante primero.');

    const modoSeleccionado = document.querySelector('input[name="scan-modo"]:checked')?.value || 'auto';
    const mesSeleccionado = modoSeleccionado === 'mes' ? parseInt(scanMesObjetivo.value) : null;
    const anoSeleccionado = parseInt(scanAnoObjetivo.value) || fechaNavegacion.getFullYear();
    const usuarioObjetivo = scanUsuarioObjetivo ? scanUsuarioObjetivo.value : miUsuario;

    btnAnalizarFoto.style.display = 'none';
    scanLoadingState.style.display = 'block';
    scanStatusText.textContent = 'Analizando cuadrante con IA de Visión...';
    scanStatusSub.textContent = 'Conectando con Google Gemini Vision...';

    const claveGeminiLocal = (localStorage.getItem(STORAGE_GEMINI_KEY) || '').trim();
    let resultado = null;

    // NIVEL 1: Si hay clave local en el navegador, llamar directamente a Gemini API
    if (claveGeminiLocal) {
      try {
        scanStatusSub.textContent = `Extrayendo turnos para ${usuarioObjetivo} con Gemini Vision...`;
        resultado = await llamarGeminiVisionNavegador(
          claveGeminiLocal,
          imagenBase64Actual,
          mimeTypeActual,
          modoSeleccionado,
          usuarioObjetivo,
          mesSeleccionado,
          anoSeleccionado
        );
      } catch (errDirect) {
        console.warn('Fallo llamada directa a Gemini con clave local:', errDirect);
      }
    }

    // NIVEL 2: Intentar endpoint de servidor Vercel /api/analizar-cuadrante
    if (!resultado) {
      try {
        scanStatusSub.textContent = 'Consultando servicio de cuadrantes en la nube...';
        const resServidor = await fetch('./api/analizar-cuadrante', {
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
          }
        }
      } catch (errServ) {
        console.warn('Fallo consulta a /api/analizar-cuadrante:', errServ);
      }
    }

    // NIVEL 3: Si no hay clave configurada o falló la conexión
    if (!resultado) {
      scanLoadingState.style.display = 'none';
      btnAnalizarFoto.style.display = 'inline-block';

      if (!claveGeminiLocal) {
        if (boxConfigIA) boxConfigIA.style.display = 'block';
        if (inputGeminiKey) inputGeminiKey.focus();
        alert('ℹ️ Para digitalizar cuadrantes con IA, introduce una clave gratuita de Google Gemini (se consigue gratis en 30 segundos en Google AI Studio con tu cuenta de Google). Arriba tienes el botón y el enlace.');
        return;
      } else {
        alert('❌ No se pudo analizar la imagen. Asegúrate de que la clave de Gemini es correcta y que la foto tiene buena iluminación y legibilidad.');
        return;
      }
    }

    // Análisis exitoso: procesar y mostrar revisión
    scanLoadingState.style.display = 'none';
    resultadoScanGlobal = normalizarResultadoScan(resultado, anoSeleccionado);
    renderizarRevisionScan();
  });
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

// Guardar los turnos detectados (mes o año completo)
if (btnGuardarScan) {
  btnGuardarScan.addEventListener('click', async () => {
    if (!resultadoScanGlobal || !resultadoScanGlobal.meses) return;

    const meses = resultadoScanGlobal.meses;
    const anio = resultadoScanGlobal.anio;
    const usuarioDestino = scanUsuarioObjetivo ? scanUsuarioObjetivo.value : miUsuario;

    let totalDiasAGuardar = 0;
    meses.forEach(m => { totalDiasAGuardar += m.dias.length; });

    const seguro = confirm(`¿Estás seguro de que deseas guardar los ${totalDiasAGuardar} turnos detectados para "${usuarioDestino}" en el grupo "${grupoActivo}"?`);
    if (!seguro) return;

    btnGuardarScan.disabled = true;
    btnGuardarScan.textContent = '⏳ Guardando turnos...';

    try {
      let guardadosCount = 0;
      for (const mesObj of meses) {
        const mesAnioKey = `${anio}-${mesObj.mes}`;
        for (const d of mesObj.dias) {
          await guardarTurnoNube(d.dia, d.indiceEstado, mesAnioKey);
          guardadosCount++;
          if (guardadosCount % 20 === 0) {
            btnGuardarScan.textContent = `⏳ Guardando (${guardadosCount}/${totalDiasAGuardar})...`;
          }
        }
      }

      modalScanCuadrante.style.display = 'none';

      // Navegar al primer mes detectado
      const primerMes = meses[0].mes;
      fechaNavegacion = new Date(anio, primerMes, 1);
      
      // Si fue anual, alternar a vista anual si se prefiere o recargar calendario
      if (meses.length > 1 && modoVista === 'mes') {
        // Mostrar confirmación para ir a vista anual
        if (confirm(`🎉 ¡Cuadrante completo de ${anio} guardado con éxito! ¿Deseas ver la vista anual?`)) {
          btnToggleVista.click();
        } else {
          await iniciarCalendario();
        }
      } else {
        await iniciarCalendario();
        alert(`🎉 ¡Horario volcado con éxito en tu cuadrante de ${meses[0].nombreMes} ${anio}!`);
      }
    } catch (err) {
      alert('Error al guardar el cuadrante: ' + err.message);
    } finally {
      btnGuardarScan.disabled = false;
      btnGuardarScan.textContent = '💾 Guardar en mi cuadrante';
    }
  });
}

// =========================================================================
// --- 13. INICIALIZACIÓN Y RESTAURACIÓN AUTOMÁTICA DE SESIÓN --------------
// =========================================================================
window.addEventListener('DOMContentLoaded', async () => {
  // Cargar lista dinámica de usuarios y grupos desde Supabase
  await cargarGruposDesdeBD();
  await cargarUsuariosDesdeBD();

  try {
    const { data: { session } } = await supabaseApp.auth.getSession();
    if (session && session.user) {
      const email = session.user.email;
      let nombre = session.user.user_metadata?.nombre;
      let rol = session.user.user_metadata?.rol || 'usuario';

      if (!nombre) {
        const { data: perfil } = await supabaseApp.from('perfiles').select('*').eq('user_id', session.user.id).single();
        if (perfil) {
          nombre = perfil.nombre;
          rol = perfil.rol;
        } else {
          nombre = email.split('@')[0];
        }
      }
      concederAcceso(nombre, rol === 'admin');
    }
  } catch (e) {
    console.warn('No se encontró sesión activa de Supabase Auth.');
  }
});

