/* Conexión con Supabase usando solo fetch (sin dependencias extra). */
import { SUPABASE_URL, SUPABASE_KEY } from './config.js'

const CLAVE_SESION = 'libreria-admin-sesion'

export const configurado = Boolean(SUPABASE_URL && SUPABASE_KEY)

export class ErrorSesion extends Error {
  constructor(mensaje = 'Tu sesión terminó. Inicia sesión de nuevo.') {
    super(mensaje)
    this.name = 'ErrorSesion'
  }
}

/* ---------- Sesión ---------- */
export function sesionActual() {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_SESION))
  } catch {
    return null
  }
}

function guardarSesion(sesion) {
  try {
    if (sesion) localStorage.setItem(CLAVE_SESION, JSON.stringify(sesion))
    else localStorage.removeItem(CLAVE_SESION)
  } catch {
    /* sin almacenamiento disponible */
  }
}

async function pedirAuth(ruta, cuerpo) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/${ruta}`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
  })
  const datos = await r.json().catch(() => ({}))
  if (!r.ok) {
    const msg = datos.error_description || datos.msg || datos.message || ''
    throw new Error(/invalid login/i.test(msg) ? 'Correo o contraseña incorrectos.' : msg || 'No se pudo iniciar sesión.')
  }
  return datos
}

function armarSesion(datos, correoAnterior) {
  return {
    access_token: datos.access_token,
    refresh_token: datos.refresh_token,
    expira: Date.now() + (datos.expires_in ?? 3600) * 1000,
    correo: datos.user?.email || correoAnterior || '',
  }
}

export async function iniciarSesion(correo, contrasena) {
  const datos = await pedirAuth('token?grant_type=password', { email: correo, password: contrasena })
  const sesion = armarSesion(datos)
  guardarSesion(sesion)
  return sesion
}

async function renovarSesion() {
  const actual = sesionActual()
  if (!actual?.refresh_token) throw new ErrorSesion()
  try {
    const datos = await pedirAuth('token?grant_type=refresh_token', { refresh_token: actual.refresh_token })
    const sesion = armarSesion(datos, actual.correo)
    guardarSesion(sesion)
    return sesion
  } catch {
    guardarSesion(null)
    throw new ErrorSesion()
  }
}

export async function cerrarSesion() {
  const actual = sesionActual()
  guardarSesion(null)
  if (!actual) return
  try {
    await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${actual.access_token}` },
    })
  } catch {
    /* si no hay conexión, la sesión local ya se borró */
  }
}

/* ---------- Datos ---------- */
async function api(ruta, opciones = {}, reintentar = true) {
  let sesion = sesionActual()
  if (!sesion) throw new ErrorSesion()
  if (sesion.expira - 60000 < Date.now()) sesion = await renovarSesion()

  const r = await fetch(`${SUPABASE_URL}/rest/v1/${ruta}`, {
    ...opciones,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${sesion.access_token}`,
      'Content-Type': 'application/json',
      ...opciones.headers,
    },
  })
  if (r.status === 401 && reintentar) {
    await renovarSesion()
    return api(ruta, opciones, false)
  }
  if (r.status === 401) throw new ErrorSesion()
  if (!r.ok) throw new Error('No se pudo completar la operación (error ' + r.status + ').')
  return r
}

export async function listarPedidos() {
  const r = await api('pedidos?select=*&order=creado.desc&limit=500')
  return r.json()
}

export async function cambiarEstado(id, estado) {
  await api(`pedidos?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ estado }),
  })
}

export async function borrarPedido(id) {
  await api(`pedidos?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' })
}
