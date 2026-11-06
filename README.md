# Panel de administración · Librería Shakespeare

Página aparte (solo para ti) donde ves los pedidos de la tienda y cambias su estado
(pendiente, enviado, entregado, cancelado). Se conecta a la misma base de datos de Supabase que la tienda.

## Configurar
1. Abre `src/config.js` y pega la **Project URL** y la clave **publishable** (`sb_publishable_...`)
   o **anon** (`eyJ...`) de tu proyecto de Supabase. Son los mismos valores que en la tienda.
   Nunca pongas la clave `secret` ni `service_role`.
2. Instala y prueba:
   ```bash
   npm install
   npm run dev
   ```
3. Entra con el correo y la contraseña del usuario que creaste en Supabase (Authentication → Users).

## Publicar en GitHub Pages
1. Crea un repositorio nuevo llamado `libreria-admin` (vacío, sin README).
2. Desde esta carpeta:
   ```bash
   git init
   git add .
   git commit -m "Panel de administración"
   git branch -M main
   git remote add origin https://github.com/TU-USUARIO-REAL/libreria-admin.git
   git push -u origin main
   ```
3. En GitHub: Settings → Pages → Source: **GitHub Actions**. Si el primer despliegue falla, pulsa **Re-run**.
4. Tu panel queda en `https://TU-USUARIO.github.io/libreria-admin/`.

Aunque la página sea pública, sin el correo y la contraseña no se puede ver ni cambiar nada:
la protección la dan el inicio de sesión y las reglas de seguridad de la base de datos.
