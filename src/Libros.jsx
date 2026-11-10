import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ErrorSesion,
  actualizarLibro,
  borrarLibro,
  crearLibro,
  listarLibros,
  subirPortada,
} from './supabase.js'

const dinero = (n) => Number(n).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })

const crearId = (titulo) =>
  titulo
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)

/* Reduce la imagen (máx. 1200 px de alto) y la guarda como JPG para que pese poco */
async function prepararImagen(archivo) {
  try {
    const bitmap = await createImageBitmap(archivo)
    const escala = Math.min(1, 1200 / bitmap.height)
    const lienzo = document.createElement('canvas')
    lienzo.width = Math.round(bitmap.width * escala)
    lienzo.height = Math.round(bitmap.height * escala)
    lienzo.getContext('2d').drawImage(bitmap, 0, 0, lienzo.width, lienzo.height)
    const blob = await new Promise((res) => lienzo.toBlob(res, 'image/jpeg', 0.88))
    return blob || archivo
  } catch {
    return archivo
  }
}

/* ---------- Formulario de libro ---------- */
function FormLibro({ libro, libros, onGuardado, onCancelar, onError }) {
  const esNuevo = !libro
  const [titulo, setTitulo] = useState(libro?.titulo || '')
  const [autor, setAutor] = useState(libro?.autor || '')
  const [precio, setPrecio] = useState(libro ? String(libro.precio) : '')
  const [descripcion, setDescripcion] = useState(libro?.descripcion || '')
  const [categorias, setCategorias] = useState(libro?.categorias || [])
  const [nueva, setNueva] = useState('')
  const [activo, setActivo] = useState(libro?.activo ?? true)
  const [archivo, setArchivo] = useState(null)
  const [vistaPrevia, setVistaPrevia] = useState(libro?.portada_url || '')
  const [problema, setProblema] = useState('')
  const [guardando, setGuardando] = useState(false)
  const primero = useRef(null)

  useEffect(() => {
    primero.current?.focus()
  }, [])

  const opciones = useMemo(() => {
    const todas = new Set([...libros.flatMap((l) => l.categorias || []), ...categorias])
    return [...todas].sort((a, b) => a.localeCompare(b, 'es'))
  }, [libros, categorias])

  function alternar(c) {
    setCategorias((actual) => (actual.includes(c) ? actual.filter((x) => x !== c) : [...actual, c]))
  }

  function agregarCategoria() {
    const c = nueva.trim()
    if (c && !categorias.includes(c)) setCategorias((actual) => [...actual, c])
    setNueva('')
  }

  function elegirArchivo(e) {
    const f = e.target.files?.[0]
    if (!f) return
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) {
      setProblema('La portada debe ser una imagen JPG, PNG o WEBP.')
      e.target.value = ''
      return
    }
    setProblema('')
    setArchivo(f)
    setVistaPrevia(URL.createObjectURL(f))
  }

  async function enviar(e) {
    e.preventDefault()
    setProblema('')
    const precioNum = Number(precio)
    if (!titulo.trim() || !autor.trim()) return setProblema('El título y el autor son obligatorios.')
    if (precio === '' || Number.isNaN(precioNum) || precioNum < 0) return setProblema('Escribe un precio válido.')

    setGuardando(true)
    try {
      let id = libro?.id
      if (esNuevo) {
        const base = crearId(titulo) || 'libro'
        id = base
        for (let n = 2; libros.some((l) => l.id === id); n++) id = `${base}-${n}`
      }

      let portada_url = libro?.portada_url || null
      if (archivo) portada_url = await subirPortada(await prepararImagen(archivo), id)

      const datos = {
        titulo: titulo.trim(),
        autor: autor.trim(),
        precio: precioNum,
        descripcion: descripcion.trim(),
        categorias,
        activo,
        portada_url,
      }
      if (esNuevo) {
        const orden = libros.reduce((m, l) => Math.max(m, l.orden), -1) + 1
        await crearLibro({ id, ...datos, orden })
      } else {
        await actualizarLibro(id, datos)
      }
      onGuardado()
    } catch (err) {
      if (err instanceof ErrorSesion) onError(err)
      else setProblema(err.message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <form className="form-libro" onSubmit={enviar}>
      <h2>{esNuevo ? 'Agregar libro' : 'Editar libro'}</h2>

      <div className="form-libro-cols">
        <div className="form-libro-portada">
          <div className="portada-vista" aria-hidden="true">
            {vistaPrevia ? <img src={vistaPrevia} alt="" /> : <span>Sin portada</span>}
          </div>
          <label className="boton claro archivo">
            {vistaPrevia ? 'Cambiar portada' : 'Elegir portada'}
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={elegirArchivo} />
          </label>
          <p className="ayuda">JPG, PNG o WEBP. Mejor vertical, con proporción 2:3.</p>
        </div>

        <div className="form-libro-campos">
          <label>
            Título
            <input ref={primero} value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={200} required />
          </label>
          <label>
            Autor
            <input value={autor} onChange={(e) => setAutor(e.target.value)} maxLength={160} required />
          </label>
          <label>
            Precio (MXN)
            <input type="number" min="0" step="0.01" value={precio} onChange={(e) => setPrecio(e.target.value)} required />
          </label>
          <label>
            Descripción
            <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={5} maxLength={3000} />
          </label>

          <fieldset className="categorias-campo">
            <legend>Categorías</legend>
            <div className="chips">
              {opciones.map((c) => (
                <button key={c} type="button" className="filtro" aria-pressed={categorias.includes(c)} onClick={() => alternar(c)}>
                  {c}
                </button>
              ))}
            </div>
            <div className="nueva-categoria">
              <input
                value={nueva}
                onChange={(e) => setNueva(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    agregarCategoria()
                  }
                }}
                placeholder="Nueva categoría"
                aria-label="Nueva categoría"
                maxLength={40}
              />
              <button type="button" className="boton claro" onClick={agregarCategoria}>Agregar</button>
            </div>
          </fieldset>

          <label className="casilla">
            <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} />
            Visible en la tienda
          </label>
          {!esNuevo && <p className="ayuda">Identificador: {libro.id}</p>}
        </div>
      </div>

      {problema && <p className="error" role="alert">{problema}</p>}

      <div className="form-libro-acciones">
        <button type="button" className="boton claro" onClick={onCancelar} disabled={guardando}>Cancelar</button>
        <button type="submit" className="boton" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar'}</button>
      </div>
    </form>
  )
}

/* ---------- Lista de libros ---------- */
export default function Libros({ onSalir }) {
  const [libros, setLibros] = useState([])
  const [cargando, setCargando] = useState(true)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState('')
  const [editando, setEditando] = useState(null) // null | 'nuevo' | libro
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
      setLibros(await listarLibros())
      setError('')
    } catch (err) {
      manejar(err)
    } finally {
      setCargando(false)
    }
  }, [manejar])

  useEffect(() => {
    cargar()
  }, [cargar])

  async function mover(indice, delta) {
    const destino = indice + delta
    if (destino < 0 || destino >= libros.length) return
    const nueva = [...libros]
    ;[nueva[indice], nueva[destino]] = [nueva[destino], nueva[indice]]
    setOcupado(true)
    try {
      for (let i = 0; i < nueva.length; i++) {
        if (nueva[i].orden !== i) await actualizarLibro(nueva[i].id, { orden: i })
      }
      setLibros(nueva.map((l, i) => ({ ...l, orden: i })))
    } catch (err) {
      manejar(err)
      cargar()
    } finally {
      setOcupado(false)
    }
  }

  async function alternarVisible(libro) {
    setOcupado(true)
    try {
      await actualizarLibro(libro.id, { activo: !libro.activo })
      setLibros((lista) => lista.map((l) => (l.id === libro.id ? { ...l, activo: !l.activo } : l)))
    } catch (err) {
      manejar(err)
    } finally {
      setOcupado(false)
    }
  }

  async function eliminar(libro) {
    if (!window.confirm(`¿Eliminar "${libro.titulo}" del catálogo? Esta acción no se puede deshacer.`)) return
    setOcupado(true)
    try {
      await borrarLibro(libro.id)
      setLibros((lista) => lista.filter((l) => l.id !== libro.id))
    } catch (err) {
      manejar(err)
    } finally {
      setOcupado(false)
    }
  }

  function alGuardar() {
    setEditando(null)
    cargar()
  }

  if (editando) {
    return (
      <FormLibro
        libro={editando === 'nuevo' ? null : editando}
        libros={libros}
        onGuardado={alGuardar}
        onCancelar={() => setEditando(null)}
        onError={manejar}
      />
    )
  }

  const q = busqueda.trim().toLowerCase()
  const visibles = libros.filter((l) => !q || l.titulo.toLowerCase().includes(q) || l.autor.toLowerCase().includes(q))

  return (
    <>
      <div className="titulo-fila">
        <h1>Libros</h1>
        <button type="button" className="boton" onClick={() => setEditando('nuevo')}>Agregar libro</button>
      </div>

      <input
        className="buscar"
        type="search"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        placeholder="Buscar por título o autor"
        aria-label="Buscar libros por título o autor"
      />

      {error && <p className="error" role="alert">{error}</p>}

      <p className="conteo" aria-live="polite">
        {cargando && libros.length === 0 ? 'Cargando libros…' : `${visibles.length} ${visibles.length === 1 ? 'libro' : 'libros'}`}
      </p>

      <ul className="lista-libros">
        {visibles.map((l) => {
          const indice = libros.indexOf(l)
          return (
            <li key={l.id} className={`libro-fila${l.activo ? '' : ' oculto'}`}>
              <div className="miniatura" aria-hidden="true">
                {l.portada_url ? <img src={l.portada_url} alt="" loading="lazy" /> : <span>Sin portada</span>}
              </div>
              <div className="libro-info">
                <strong>{l.titulo}</strong>
                <span>{l.autor}</span>
                <span className="libro-precio">{dinero(l.precio)}</span>
                <span className="chips-mini">
                  {(l.categorias || []).map((c) => (
                    <span key={c} className="etiqueta">{c}</span>
                  ))}
                  {!l.activo && <span className="etiqueta oculto-etiqueta">Oculto</span>}
                </span>
              </div>
              <div className="libro-acciones">
                <div className="orden">
                  <button type="button" aria-label={`Subir ${l.titulo}`} disabled={ocupado || busqueda || indice === 0} onClick={() => mover(indice, -1)}>↑</button>
                  <button type="button" aria-label={`Bajar ${l.titulo}`} disabled={ocupado || busqueda || indice === libros.length - 1} onClick={() => mover(indice, 1)}>↓</button>
                </div>
                <button type="button" className="boton claro" disabled={ocupado} onClick={() => setEditando(l)}>Editar</button>
                <button type="button" className="boton claro" disabled={ocupado} onClick={() => alternarVisible(l)}>
                  {l.activo ? 'Ocultar' : 'Mostrar'}
                </button>
                <button type="button" className="boton peligro" disabled={ocupado} onClick={() => eliminar(l)}>Eliminar</button>
              </div>
            </li>
          )
        })}
      </ul>
    </>
  )
}
