# Kedadas · cambios de seguridad

## Orden de despliegue
1. **Supabase → SQL Editor**: ejecuta `migracion_seguridad.sql` (haz backup antes).
2. **Vercel → Settings → Environment Variables**:
   `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`,
   `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (ej. `mailto:tu@correo.com`).
3. Genera las claves VAPID con `npx web-push generate-vapid-keys` y pega la **pública** también en `app.js`
   (constante `VAPID_PUBLIC_KEY`).
4. Sube a GitHub: `app.js`, `index.html`, `sw.js`, `package.json` y la carpeta `api/`.
5. **Rota la clave de Gemini** que tenías en los móviles (estuvo en localStorage) y, si la usabas, cambia el
   PIN de respaldo: ya no existe.
6. Cada persona debe tener cuenta con email. Quien siga con PIN debe registrarse (o usar "¿Olvidaste tu contraseña?").
7. Cuando todo funcione, descomenta en el SQL el `drop column grupo` de `Turnos`.

## Grupos reales (nuevo)
- `migracion_seguridad.sql` (sección 9) migra la tabla antigua `grupos` a `groups` + `group_members`, asigna los mensajes y
  votaciones antiguos a su grupo por nombre y deja chat/votaciones/coincidencias visibles **solo para miembros**.
- Quien no tenga cuenta con email no se migra como miembro: tendrá que registrarse y unirse con el código del grupo
  (los administradores ven el código en el panel del grupo).
- Mensajes o votaciones antiguos cuyo grupo no se pueda identificar por nombre quedan ocultos (solo el superadmin los ve).
- Ya no se pueden añadir "personas inventadas" a un grupo: solo cuentas reales.

## Archivos añadidos en la pasada de calidad
- `icono-maskable-192.png` / `icono-maskable-512.png` y `manifest.webmanifest`: icono con zona segura para que Android no lo recorte.
  Sube también los dos PNG y cambia la versión de caché si lo modificas (`sw.js` ya está en v17).
- `vercel.json`: cabeceras de seguridad y `sw.js` sin caché.
- `tests/`: `node tests/smoke.cjs` (arranque) y `node tests/logica.cjs` (identidad, grupos, turnos). Usan un navegador y un Supabase simulados;
  no sustituyen a probar la app real.
- El final de `migracion_seguridad.sql` avisa (con `WARNING`) si queda alguna política con `using (true)` en las tablas sensibles.

## Passkeys reales (Face ID / Touch ID)
- Nuevas funciones en `api/`: `_webauthn.js`, `passkey-register-options.js`, `passkey-register-verify.js`,
  `passkey-login-options.js`, `passkey-login-verify.js`. No necesitan librerías nuevas.
- Ejecuta también la sección 11 de `migracion_seguridad.sql` (tabla `passkey_credentials`).
- Variable opcional en Vercel: `PASSKEY_SECRET` (cualquier texto largo y aleatorio). Si no la pones, usa la service role.
- Cómo funciona: la app firma un reto con Face ID, el servidor comprueba la firma, el dominio y la verificación biométrica,
  y solo entonces entrega una sesión de Supabase. Se rechazan retos caducados, otros dominios y contadores repetidos.
- Las passkeys pertenecen a un dominio: si cambias de dominio de Vercel (o usas una URL de preview), hay que activarlas de nuevo.
- Para activarlas: entra con correo y contraseña → pestaña Usuarios → activar Face ID.
- Pruebas: `node tests/passkeys.mjs` (autenticador simulado), además de `smoke.cjs` y `logica.cjs`.

## Endurecimiento de passkeys y limpieza (última pasada)
- Sección 12 de `migracion_seguridad.sql`: tablas `passkey_retos_usados` (cada reto vale una sola vez) y `passkey_fallos`
  (máximo 10 intentos fallidos por IP cada 10 minutos). Vuelve a ejecutar el SQL; es repetible.
- Nuevo `api/_retos.js`; sube también esa carpeta `api/` completa.
- Se eliminaron los valores de ejemplo con "Cule", "Persona 2..4" y el grupo "Amigos" por defecto: ahora todo sale de tu cuenta y tus grupos.
- Pruebas: `node tests/smoke.cjs`, `logica.cjs`, `passkeys.mjs`, `retos.mjs`. Ahora el arnés usa los IDs reales de `index.html`,
  así detecta si el JS usa un elemento que ya no existe.
