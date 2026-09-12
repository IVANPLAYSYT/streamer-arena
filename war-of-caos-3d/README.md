# War of Caos 3D — Firebase Online

Esta fase mueve el progreso persistente a Firebase Realtime Database.

## Nuevo
- War ID + PIN para usar la misma aldea desde otro dispositivo.
- Guardado automático local + Firebase.
- Aldea, recursos, niveles, tropas, héroes, constructores y temporizadores sincronizados.
- Lista de aldeas públicas de otros jugadores.
- Puedes cargar una aldea real de otro jugador como objetivo de ataque.
- Registro básico de resultados de ataque en Firebase.
- Indicador de jugadores online.

## IMPORTANTE
Necesitas copiar tu `firebase-config.js` REAL, el mismo que ya usas en Streamer Arena, junto a `index.html`.

No se incluye dentro del ZIP para evitar sobrescribir tus claves/configuración actual.

## Seguridad
Esta fase está pensada para pruebas con tu Realtime Database. El War ID + PIN se verifica en el cliente.
Antes de abrir War of Caos al público se debe migrar a Firebase Authentication y reglas de seguridad estrictas.

## Estructura Firebase usada
- `warOfCaos3D/accounts/{WAR_ID}`
- `warOfCaos3D/publicVillages/{WAR_ID}`
- `warOfCaos3D/attacks/{DEFENDER_ID}`

## Probar con dos dispositivos
1. En el PC crea un War ID.
2. Guarda el War ID y el PIN.
3. Construye o mejora algo y pulsa Guardar.
4. En el móvil abre la misma página.
5. Introduce el mismo War ID y PIN.
6. La aldea del PC debe cargarse en el móvil.
