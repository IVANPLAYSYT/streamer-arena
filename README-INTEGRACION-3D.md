# Streamer Arena — War of Caos 3D integrado

Esta actualización parte de **War of Caos Social + TH15** y añade el prototipo 3D dentro del propio Streamer Arena.

## Qué cambia
- War of Caos sigue siendo un juego de Streamer Arena, no una web separada.
- Al iniciar War of Caos se abre primero la pestaña **🎮 Aldea 3D**.
- Se conservan las pestañas de Gestión, Construir, Ejército, Atacar, Héroes, Chat global y Clan.
- El motor 3D vive en `/war-of-caos-3d/` y se muestra integrado mediante un panel interno.
- Usa el mismo `sa_id`, nickname y Gems de Streamer Arena.
- Usa el mismo `firebase-config.js` de la raíz.
- El progreso 3D se guarda bajo `warOfCaos/threeD/` para no romper la aldea antigua mientras terminamos la migración.

## Firebase
**NO reemplaces tu `firebase-config.js`.** Conserva el que ya te funciona.

## Archivos que debes subir/reemplazar
- `index.html`
- `app.js`
- `styles.css`
- carpeta completa `war-of-caos-3d/`

No borres tus otros archivos, especialmente `firebase-config.js` y `cards-sprite.png`.

## Siguiente fase recomendada
Migrar las funciones 2D restantes (chat/clanes/ejército/ataques sociales) para que controlen directamente la aldea 3D y dejar una sola representación de la aldea.
