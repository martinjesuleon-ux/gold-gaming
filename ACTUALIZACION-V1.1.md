# GOLD GAMING — Actualización V1.1 (candidata de prueba)

No es una versión desplegada. Conserva public/game.js, public/style.css, public/admin.html, public/admin.js y render.yaml del repositorio existente. No borres esos archivos ni el repositorio.

## 1. Configurar Neon en Render antes de subir los archivos
- En https://console.neon.tech selecciona el proyecto gold-gaming y la base gold_gaming. En Connect copia la cadena PostgreSQL (preferiblemente pooled, con SSL). No publiques esa cadena ni la compartas por chat.
- En https://dashboard.render.com abre el servicio gold-gaming > Environment. Añade DATABASE_URL con la cadena completa y guarda. Conserva ADMIN_PASSWORD y el plan Free.
- La estructura de cuentas, progreso, inventario y sesiones ya se creó en Neon. No necesitas crear otra base.

## 2. Actualizar GitHub
- Abre https://github.com/martinjesuleon-ux/gold-gaming/upload/main
- Descomprime el ZIP y arrastra su contenido (no el ZIP ni una carpeta exterior). Deben quedar accounts.js, server.js y package.json en la raíz; index.html y auth.js dentro de public; persistence.test.js dentro de test.
- Comprueba que se van a sustituir los archivos existentes en sus rutas correctas y no se va a añadir una carpeta duplicada. Confirma los cambios una sola vez. Render debería reconstruir el servicio. Si no, despliega el último commit manualmente.
- Build: npm install. Start: npm start. Si hay problemas vuelve a desplegar el commit previo desde Render.

## 3. Prueba de aceptación
- Abre https://gold-gaming.onrender.com/health y comprueba ok y database en true.
- Abre el juego e intenta registrarte con un usuario y correo de prueba propios, contraseña de al menos 10 caracteres. Verifica que no permite entrar sin autenticación.
- Recoge cajas o derrota un NPC. Anota créditos y EXP una vez que aparezcan confirmados. Pulsa Salir, vuelve a iniciar sesión y compara los valores. Reinicia el servicio desde Render y repite la comparación. Si no coinciden, no des por concluida la prueba.
- Prueba una contraseña equivocada y un usuario duplicado. Verifica que no inicia sesión. Prueba el panel administrativo y una recompensa administrativa.

## Alcance y límites
- Registro obligatorio, sesión mediante cookie HttpOnly, hash scrypt con sal aleatoria, créditos y EXP guardados en PostgreSQL al confirmar recompensas. Nivel: 1 + parte entera de EXP / 500. Cajas: 10 EXP; NPC: 50 EXP; jefe: 500 EXP. La nave inicial queda asociada a la cuenta. Estos valores son provisionales.
- La tabla de inventario existe, pero todavía no hay tienda ni lógica de equipamiento/inventario. Tampoco hay verificación de correo, recuperación de contraseña, cambios de nave ni persistencia de coordenadas/vida/escudo. Los créditos temporales de la V1.0 no pueden asociarse a cuentas nuevas automáticamente.
- La actualización requiere instalar pg, express y socket.io. Se verificó sintaxis de los archivos JS nuevos/modificados, pero no se pudo ejecutar el servidor ni realizar pruebas integrales en este entorno sin dependencias de npm. La prueba de contraseñas incluida se ejecuta con npm test después de instalar dependencias. No ejecutar las pruebas antiguas de invitado como prueba de compatibilidad: ese acceso se eliminó deliberadamente.
