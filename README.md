# Streamer Arena

Web de minijuegos para streamers, chat y seguidores, preparada para GitHub Pages.

## Incluye

- Diseño responsive para PC y móvil.
- Salas por código.
- Modo demo sin servidor (funciona entre pestañas del mismo navegador).
- Modo online con Firebase Realtime Database.
- Chat de sala.
- Sistema de jugadores.
- Coins virtuales.
- Gems premium.
- Adivina el juego por pistas.
- Trivia relámpago.
- Mesa base de **Las 40** con baraja española de 40 cartas.
- Tienda premium preparada para conectar Stripe.
- URL de invitación `?room=CODIGO`.

## Probar sin instalar nada

Abre `index.html`.

Para evitar restricciones de algunos navegadores, también puedes usar un servidor local:

```bash
python -m http.server 8080
```

Después entra en `http://localhost:8080`.

## Publicar en GitHub Pages

1. Crea un repositorio en GitHub.
2. Sube todos los archivos de esta carpeta a la raíz.
3. En GitHub abre **Settings > Pages**.
4. En **Build and deployment**, elige **Deploy from a branch**.
5. Selecciona `main` y `/ (root)`.
6. Guarda.

GitHub Pages publicará el `index.html`.

## Activar multijugador real por Internet

El modo demo solo sincroniza pestañas del mismo navegador. Para que los seguidores entren desde sus propios móviles/PC:

1. Crea un proyecto en Firebase.
2. Crea una aplicación **Web**.
3. Activa **Realtime Database**.
4. Abre `firebase-config.js` y sustituye `null` por tu configuración de Firebase.
5. Puedes usar `firebase-config.example.js` como plantilla.
6. Configura reglas de seguridad antes de lanzar la web.

La aplicación usa Firebase JS SDK 12.18.0 desde el CDN oficial de Google.

> `firebase-rules.demo.json` permite lectura/escritura pública para prototipos. NO es una configuración final segura.

## Dinero real / Stripe

Los botones de compra son solo de demostración. **No metas una Secret Key de Stripe en JavaScript ni en GitHub.**

Arquitectura recomendada:

GitHub Pages (frontend)
→ endpoint seguro /create-checkout-session
→ Stripe Checkout
→ webhook de Stripe en servidor
→ servidor valida el pago
→ servidor añade Gems al usuario en la base de datos

El webhook es importante: no debes entregar Gems únicamente porque el navegador diga que el pago terminó.

Puedes alojar la parte segura en:
- Firebase Functions
- Cloudflare Workers
- Vercel Functions
- Netlify Functions
- Supabase Edge Functions

## Siguiente fase recomendada

- Login con Twitch / Google / Discord.
- Integración con Twitch chat/EventSub.
- Roles Host / Mod / VIP.
- Reglas completas de Las 40.
- Más juegos.
- Inventario y cosméticos.
- Panel de administración del streamer.
- Torneos.
- Ranking y temporadas.
- Anti-cheat y rate limiting.
- Stripe Checkout + webhook.
