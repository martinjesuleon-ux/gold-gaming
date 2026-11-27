# GOLD GAMING · Fase 1

Juego espacial 2D PvE multijugador de navegador. Recursos gráficos vectoriales originales y generados por Canvas; no se requieren imágenes externas. Node.js 22, Express 5, Socket.io 4, HTML/CSS/JS sin framework.

## Instalar en PC

1. Instala Node.js 22 LTS (https://nodejs.org/) y Git (https://git-scm.com/). Descomprime el ZIP y abre una terminal dentro de `gold-gaming`.
2. Ejecuta `npm install` (requiere internet). Esto genera `package-lock.json`; consérvalo en el repositorio.
3. Copia `.env.example` a `.env` (Windows PowerShell: `Copy-Item .env.example .env`; Linux/macOS: `cp .env.example .env`). Abre `.env` y establece `ADMIN_PASSWORD` a una contraseña larga y aleatoria de caracteres ASCII, sin espacios. Ejemplo para generar una: `node -e "console.log(require('node:crypto').randomBytes(24).toString('hex'))"`. No publiques `.env`.
4. `npm start`. Visita http://localhost:3000 y http://localhost:3000/admin.
5. `npm run check` valida sintaxis; `npm test` ejecuta pruebas de integración (instala también las dependencias de desarrollo).

## Controles

- Nickname único de 2–18 caracteres, letras/números/espacio/guion/guion bajo.
- Clic en espacio vacío: mover. Mantener clic y arrastrar: actualizar destino.
- Clic en enemigo: seleccionarlo; Ctrl o botón LÁSER: alternar ataque; Esc: deseleccionar. Alcance 650 unidades. Acércate si estás lejos.
- El escudo absorbe primero el daño; se regenera tras 6,5 s sin recibir daño. La nave reaparece tras 4 s, conserva créditos mientras siga conectada.
- Pasa cerca de una caja dorada (52 unidades) para recogerla. Da 35–100 créditos; reaparece otra caja en una posición aleatoria después de 6,5 s.
- Minimap: clic para viajar; verde = tú, celeste = pilotos, rojo = NPC, azul intenso = jefe, dorado = caja.
- En /admin, ingresa ADMIN_PASSWORD. Envía créditos a jugadores conectados o crea un jefe cerca de un piloto o en el centro.

## GitHub

Crea un repositorio vacío en https://github.com/new (público o privado). Dentro de la carpeta del proyecto:

```sh
git init
git add .
git commit -m "GOLD GAMING fase 1"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/gold-gaming.git
git push -u origin main
```

Sustituye TU_USUARIO. Si Git requiere identidad, configura `git config user.name` y `git config user.email`. Alternativa sin Git: descomprime y sube los archivos a GitHub desde Add file > Upload files, preservando `public/` y `test/`; no subas `.env` ni `node_modules`. Incluye los archivos ocultos `.gitignore` y `.env.example`.

## Render (recomendado para la prueba gratuita)

1. https://dashboard.render.com/ > New > Web Service > conecta el repositorio GitHub.
2. Runtime Node, branch main, Root Directory vacío si los archivos están en la raíz, instancia Free.
3. Build: `npm install` (o `npm ci` si ya subiste package-lock.json). Start: `npm start`. Health check: `/health`.
4. Environment: añade `ADMIN_PASSWORD` con tu secreto y opcionalmente `NODE_ENV=production`. No fijes PORT: Render lo asigna.
5. Deploy. Abre el dominio HTTPS asignado y añade `/admin` para administrar.

También puedes usar New > Blueprint y el `render.yaml` incluido. Deberás indicar la contraseña cuando Render lo solicite.

Plan gratuito sujeto a disponibilidad y límites: duerme tras 15 minutos sin tráfico entrante, incluidas conexiones/mensajes WebSocket según la documentación vigente. El mundo no persiste tras apagados. Consulta https://render.com/docs/free y https://render.com/docs/websocket.

## Railway

1. https://railway.com/ > New Project > Deploy from GitHub repo.
2. Selecciona el repositorio, define `ADMIN_PASSWORD` en Variables. No fijes PORT. Build y Start se detectan desde package.json; si necesitas fijar el inicio, usa `npm start`.
3. Settings > Networking > Generate Domain. Configura health check `/health` si está disponible.
4. Abre el dominio HTTPS público asignado. /admin para administración.

Railway ofrece prueba y plan Free con crédito mensual limitado; no garantiza que un juego activo se mantenga gratis todo el mes. Consulta https://docs.railway.com/pricing/free-plan y https://docs.railway.com/pricing/free-trial.

## VPS

Instala Node.js 22, ejecuta `npm ci --omit=dev` si existe lockfile (si no, `npm install --omit=dev`), establece ADMIN_PASSWORD y PORT mediante un servicio systemd o gestor de procesos; usa proxy inverso Caddy/Nginx con HTTPS y soporte WebSocket. No expongas el panel sin HTTPS. Mantén una instancia única.

## Arquitectura y límites

- Un proceso, mapa compartido de 12000 x 8000, 42 NPC normales, 75 cajas, máximo 40 jugadores configurado (no es capacidad certificada); hasta 5 jefes.
- Simulación a 20 Hz, snapshots a 10 Hz, suavizado Canvas por requestAnimationFrame. Socket.io usa el mismo origen, sin URL fija ni CORS abierto. No hay base de datos ni balanceador distribuido.
- El servidor verifica comandos, distancia, cooldown, daño, recompensas y créditos. Los datos del mundo están en memoria y el cliente puede leer el estado completo del sector. No es un sistema antitrampas completo.
- Admin: contraseña desde entorno, comparación constante de hashes, límite global de intentos fallidos (20/min; puede bloquear temporalmente al administrador), APIs protegidas con Bearer, sin contraseña guardada en localStorage. La pantalla de login es pública; las acciones y datos administrativos están protegidos. Usa HTTPS en internet.
- No hay cuentas permanentes, PvP, chat, inventario, VANT, tienda, portales ni persistencia. Al desconectarse, reiniciar o desplegar, el progreso se pierde. La reconexión vuelve a entrar como una sesión nueva. El jefe puede necesitar varios pilotos.
- Antes de abrir al público: persistencia, sesiones, autenticación de jugadores, límites por origen/IP fiables, protección DDoS, auditoría y pruebas de carga.
- El código pasa comprobación sintáctica. La ejecución integrada no pudo verificarse en el entorno de generación porque npm no tuvo acceso al registro. Ejecuta `npm install`, `npm test` y la prueba manual de abajo.

## Prueba manual

Abre dos pestañas con nicknames distintos; verifica movimiento simultáneo, selección y ataque, recolección de caja y aumento de créditos. Abre /admin, prueba una contraseña incorrecta y luego la real, envía 1.000 créditos y crea un TITAN cerca de un piloto. Comprueba que ambos clientes ven el jefe. Cierra una pestaña y verifica que disminuye la lista de conectados. Repite desde dos equipos en el dominio HTTPS para verificar el despliegue. No uses la contraseña de ejemplo en producción.
