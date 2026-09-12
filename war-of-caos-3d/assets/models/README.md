# Modelos GLB opcionales

La demo ya funciona sin archivos externos usando modelos 3D procedurales articulados.

Cuando tengas modelos finales `.glb`, puedes usar estos nombres:

- `barbarian.glb`
- `archer.glb`
- `giant.glb`
- `wizard.glb`
- `king.glb`
- `townhall.glb`
- `cannon.glb`
- `archer_tower.glb`
- `wall.glb`

Después cambia `USE_EXTERNAL_GLB = false` a `true` dentro de `index.html`.

En la siguiente fase se conectarán clips de animación GLB por nombre (`Idle`, `Walk`, `Attack`, `Death`) con `THREE.AnimationMixer`.
