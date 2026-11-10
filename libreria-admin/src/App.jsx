import { useCallback, useEffect, useMemo, useState } from 'react'
import logo from './assets/logo-encabezado.svg'
import Libros from './Libros.jsx'
import {
  ErrorSesion,
  borrarPedido,
  cambiarEstado,
  cerrarSesion,
  configurado,
  iniciarSesion,
  listarPedidos,
  sesionActual,
} from './supabase.js'

const ESTADOS = ['pendiente', 'enviado', 'entregado', 'cancelado']
const ETIQUETA = { pendiente: 'Pendiente', enviado: 'Enviado', entregado: 'Entregado', cancelado: 'Cancelado' }

const dinero = (n) => Number(n).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
const fechaHora = (iso) =>
  new Date(iso).toLocaleString('es-MX', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
const normalizar = (t) => String(t ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

/* ---------- Pantalla de inicio de sesión ---------- */
function Login({ onEntrar }) {
  const [correo, setCorreo] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  async function enviar(e) {
    e.preventDefault()
    setError('')
    setCargando(true)
    try {
      onEntrar(await iniciarSesion(correo.trim(), contrasena))
    } catch (err) {
      setError(err.message)
    } finally {
      setCargando(false)
    }
  }

  return (
    <main className="login">
      <img className="login-logo" src={logo} alt="Librería Shakespeare" />
      <form className="tarjeta-form" onSubmit={enviar}>
        <h1>Panel de administración</h1>
        <label>
          Correo electrónico
          <input type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} required autoComplete="username" />
        </label>
        <label>
          Contraseña
          <input type="password" value={contrasena} onChange={(e) => setContrasena(e.target.value)} required autoComplete="current-password" />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button type="submit" className="boton" disabled={cargando}>
          {cargando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </main>
  )
}

/* ---------- Un pedido ---------- */
function Pedido({ pedido, onEstado, onBorrar, ocupado }) {
  const libros = Array.isArray(pedido.libros) ? pedido.libros : []
  return (
    <li className="pedido">
      <details>
        <summary>
          <span className="pedido-num">{pedido.numero}</span>
          <span className="pedido-cliente">{pedido.nombre}</span>
          <span className="pedido-total">{dinero(pedido.total)}</span>
          <span className={`estado ${pedido.estado}`}>{ETIQUETA[pedido.estado] || pedido.estado}</span>
        </summary>

        <div className="pedido-detalle">
          <p className="pedido-fecha">{fechaHora(pedido.creado)}</p>

          <div className="pedido-cols">
            <section>
              <h3>Cliente y entrega</h3>
              <p>{pedido.nombre}</p>
              <p><a href={`mailto:${pedido.correo}`}>{pedido.correo}</a></p>
              <p>{pedido.direccion}</p>
              <p>{pedido.ciudad}</p>
              <p><strong>Pago:</strong> {pedido.pago}</p>
            </section>

            <section>
              <h3>Libros</h3>
              <ul className="libros-pedido">
                {libros.map((l, i) => (
                  <li key={i}>
                    <span>{l.titulo} × {l.cantidad}</span>
                    {l.precio != null && <span>{dinero(l.precio * l.cantidad)}</span>}
                  </li>
                ))}
                <li className="suma">
                  <span>Total</span>
                  <span>{dinero(pedido.total)}</span>
                </li>
              </ul>
            </section>
          </div>

          <div className="pedido-acciones">
            <label>
              Estado
              <select value={pedido.estado} disabled={ocupado} onChange={(e) => onEstado(pedido, e.target.value)}>
                {ESTADOS.map((e) => (
                  <option key={e} value={e}>{ETIQUETA[e]}</option>
                ))}
              </select>
            </label>
            <button type="button" className="boton peligro" disabled={ocupado} onClick={() => onBorrar(pedido)}>
              Eliminar pedido
            </button>
          </div>
        </div>
      </details>
    </li>
  )
}

/* ---------- Panel ---------- */
function Pedidos({ onSalir }) {
  const [pedidos, setPedidos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState('')
  const [filtro, setFiltro] = useState('todos')
  const [busqueda, setBusqueda] = useState('')

  const manejar = useCallback(
    (err) => {
      if (err instanceof ErrorSesion) onSalir()
      else setError(err.message || 'Ocurrió un error.')
    },
    [onSalir],
  )

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      setPedidos(await listarPedidos())
      setError('')
    } catch (err) {
      manejar(err)
    } finally {
      setCargando(false)
    }
  }, [manejar])

  useEffect(() => {
    cargar()
    const t = setInterval(cargar, 60000)
    return () => clearInterval(t)
  }, [cargar])

  async function cambiar(pedido, estado) {
    setOcupado(true)
    try {
      await cambiarEstado(pedido.id, estado)
      setPedidos((lista) => lista.map((p) => (p.id === pedido.id ? { ...p, estado } : p)))
    } catch (err) {
      manejar(err)
    } finally {
      setOcupado(false)
    }
  }

  async function eliminar(pedido) {
    if (!window.confirm(`¿Eliminar el pedido ${pedido.numero} de ${pedido.nombre}? Esta acción no se puede deshacer.`)) return
    setOcupado(true)
    try {
      await borrarPedido(pedido.id)
      setPedidos((lista) => lista.filter((p) => p.id !== pedido.id))
    } catch (err) {
      manejar(err)
    } finally {
      setOcupado(false)
    }
  }

  const conteo = useMemo(() => {
    const c = { todos: pedidos.length }
    ESTADOS.forEach((e) => { c[e] = pedidos.filter((p) => p.estado === e).length })
    return c
  }, [pedidos])

  const visibles = useMemo(() => {
    const q = normalizar(busqueda.trim())
    return pedidos.filter(
      (p) =>
        (filtro === 'todos' || p.estado === filtro) &&
        (!q || normalizar(p.numero).includes(q) || normalizar(p.nombre).includes(q) || normalizar(p.correo).includes(q)),
    )
  }, [pedidos, filtro, busqueda])

  return (
    <>
      <div className="titulo-fila">
        <h1>Pedidos</h1>
        <button type="button" className="boton claro" onClick={cargar} disabled={cargando}>
          {cargando ? 'Actualizando…' : 'Actualizar'}
        </button>
      </div>

      <div className="filtros" role="group" aria-label="Filtrar por estado">
        {['todos', ...ESTADOS].map((e) => (
          <button key={e} type="button" className="filtro" aria-pressed={filtro === e} onClick={() => setFiltro(e)}>
            {e === 'todos' ? 'Todos' : ETIQUETA[e]} <span className="cuenta">{conteo[e]}</span>
          </button>
        ))}
      </div>

      <input
        className="buscar"
        type="search"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        placeholder="Buscar por número, nombre o correo"
        aria-label="Buscar pedidos por número, nombre o correo"
      />

      {error && <p className="error" role="alert">{error}</p>}

      <p className="conteo" aria-live="polite">
        {cargando && pedidos.length === 0
          ? 'Cargando pedidos…'
          : visibles.length === 0
            ? pedidos.length === 0 ? 'Todavía no hay pedidos.' : 'No hay pedidos con ese filtro.'
            : `${visibles.length} ${visibles.length === 1 ? 'pedido' : 'pedidos'}`}
      </p>

      <ul className="lista-pedidos">
        {visibles.map((p) => (
          <Pedido key={p.id} pedido={p} onEstado={cambiar} onBorrar={eliminar} ocupado={ocupado} />
        ))}
      </ul>
    </>
  )
}

function Panel({ sesion, onSalir }) {
  const [vista, setVista] = useState('pedidos')

  return (
    <>
      <header className="cabecera">
        <img className="cabecera-logo" src={logo} alt="Librería Shakespeare" />
        <nav className="pestanas" aria-label="Secciones del panel">
          {[['pedidos', 'Pedidos'], ['libros', 'Libros']].map(([clave, texto]) => (
            <button
              key={clave}
              type="button"
              className="pestana"
              aria-current={vista === clave ? 'page' : undefined}
              onClick={() => setVista(clave)}
            >
              {texto}
            </button>
          ))}
        </nav>
        <div className="cabecera-der">
          <span className="cabecera-usuario">{sesion.correo}</span>
          <button type="button" className="boton claro-oscuro" onClick={onSalir}>Cerrar sesión</button>
        </div>
      </header>

      <main className="contenido">
        {vista === 'pedidos' ? <Pedidos onSalir={onSalir} /> : <Libros onSalir={onSalir} />}
      </main>
    </>
  )
}

/* ---------- Aplicación ---------- */
export default function App() {
  const [sesion, setSesion] = useState(() => sesionActual())

  const salir = useCallback(() => {
    cerrarSesion()
    setSesion(null)
  }, [])

  if (!configurado) {
    return (
      <main className="login">
        <div className="tarjeta-form">
          <h1>Falta configurar la conexión</h1>
          <p>Abre <code>src/config.js</code> y pega la URL del proyecto y la clave pública de Supabase.</p>
        </div>
      </main>
    )
  }

  return sesion ? <Panel sesion={sesion} onSalir={salir} /> : <Login onEntrar={setSesion} />
}
