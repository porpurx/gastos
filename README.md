# Gastos

PWA para controlar pagos mensuales: seguros, préstamos, servicios y suscripciones.

## Qué hace

- **Mes**: pagos agrupados por categoría; un toque en el círculo los marca como pagados.
- **Por método**: los mismos pagos agrupados por forma de pago (tarjeta, efectivo...), para saber cuánto sale de cada una.
- **Año**: tabla tipo hoja de cálculo; verde = pagado, rojo = vencido. Tocar un mes lo abre.
- Resumen: por pagar, total, pagado, vencido y, si capturas tu ingreso, cuánto queda disponible.
- Cada pago tiene monto fijo, día de pago, meses desde/hasta y monto distinto para un mes concreto (servicios variables, aumentos).
- Tema claro, oscuro o automático.
- Exportar/importar copia en JSON.
- Funciona sin conexión (service worker, cache-first). Los datos viven solo en `localStorage` del dispositivo.

## Uso

HTML/CSS/JS sin dependencias ni paso de build. Sírvelo desde cualquier servidor estático:

```bash
python -m http.server 8000
```

Y abre <http://localhost:8000>.

Para instalarla como app en el teléfono hace falta **HTTPS** (GitHub Pages, Netlify, etc.).

Al publicar cambios, sube `VERSION` en `sw.js`; si no, las apps instaladas siguen usando los archivos viejos.

## Estructura

| Archivo | Contenido |
|---|---|
| `index.html` | Vistas, formulario de pago y ajustes |
| `style.css` | Estilos y temas |
| `app.js` | Datos, cálculos de montos y vencidos, render |
| `sw.js` | Service worker (cache-first) |
| `manifest.json` | Manifiesto PWA |

Los `.json` de copias de seguridad están en `.gitignore` para no subir datos personales.
