# Gastos

PWA para controlar pagos mensuales: seguros, préstamos, servicios y suscripciones.

## Qué hace

- **Mes**: pagos agrupados por categoría; un toque en el círculo los marca como pagados.
- **Por método**: los mismos pagos agrupados por forma de pago (tarjeta, efectivo...), para saber cuánto sale de cada una.
- **Año**: tabla tipo hoja de cálculo; verde = pagado, rojo = vencido. Tocar un mes lo abre.
- Resumen: por pagar, total, pagado, vencido y, si capturas tu ingreso, cuánto queda disponible.
- Cada pago tiene monto fijo, día de pago, meses desde/hasta y monto distinto para un mes concreto (servicios variables, aumentos).
- **Deshabilitar** un pago: sigue en la lista, pero no suma en ningún total hasta reactivarlo.
- **Diario**: gastos del día a día (gasolina, tienda, comida...) con total del mes, promedio por día y totales por categoría.
- **Atajos** (iOS Atajos / Android): enlaces `?gasto=150&cat=Gasolina&metodo=Efectivo&nota=Pemex` registran el gasto al abrirse; con `?gasto=&cat=Gasolina` se abre el formulario prellenado. Los enlaces se copian desde Ajustes.
- **Recordatorios**: lista de "Próximos pagos" (hoy, mañana, en N días, vencidos), número en el icono de la app y una notificación al día al abrirla. Como no hay servidor, para avisos con la app cerrada se exporta un `.ics` con eventos mensuales y alarma para el calendario del teléfono.
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
