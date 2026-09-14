# Gastos

PWA para controlar pagos mensuales: seguros, préstamos, servicios y suscripciones.

## Qué hace

- **Mes**: pagos agrupados por categoría; un toque en el círculo los marca como pagados.
- **Por método**: los mismos pagos agrupados por forma de pago (tarjeta, efectivo...), para saber cuánto sale de cada una.
- **Año**: gráfica de tendencia de los últimos 12 meses (pagos + gastos diarios, promedio, mes más alto, comparación con el mes anterior; los meses futuros son proyección) y tabla tipo hoja de cálculo; verde = pagado, rojo = vencido. Tocar un mes lo abre.
- La vista **Mes** indica cuánto subió o bajó el gasto frente al mes anterior.
- **Suscripciones** (vista Año): activas del mes, costo al mes y al año, y aviso de servicios parecidos pagados a la vez (música, video, IA, nube, juegos). Se detectan por nombre o categoría y se ajustan con la casilla «Suscripción» de cada pago.
- **Historial de monto**: cada pago fijo muestra cuándo cambió su monto ("Ago 2026 · $1,208 → $1,696.26 · ↑ 40%"); la vista Año lista los cambios de los últimos 12 meses con su efecto al mes, y la vista Mes marca los pagos que cambiaron ese mes. Al editar el monto fijo, el cambio aplica desde el mes abierto y los anteriores conservan el monto viejo.
- Resumen: por pagar, total, pagado, vencido y, con ingresos registrados, cuánto queda disponible.
- **Ingresos variables**: varios ingresos al mes (quincenas, bonos, ventas), fijos o de monto variable, recurrentes o únicos, marcados como recibidos. "Después de cada ingreso" muestra cuánto queda tras los pagos y gastos diarios que caen hasta el siguiente ingreso.
- Cada pago tiene monto fijo, día de pago, meses desde/hasta y monto distinto para un mes concreto (servicios variables, aumentos).
- **Préstamos**: con el número de pagos muestra "pago 7 de 12", cuánto falta y el mes del último pago; el resumen suma la deuda restante.
- **Tarjetas de crédito**: con día de corte y día límite calcula el estado de cuenta (pagos recurrentes + gastos diarios con esa tarjeta), la fecha límite y el periodo en curso; se marca como pagada y entra en los recordatorios.
- **Presupuestos** por categoría de gasto diario, con barra de avance y aviso al llegar al 80% y al 100%.
- **Duplicar** un pago: desde el formulario, crea uno nuevo con la misma categoría, método, día, monto y número de pagos, empezando en el mes abierto y sin historial.
- **Deshabilitar** un pago: sigue en la lista, pero no suma en ningún total hasta reactivarlo.
- **Diario**: gastos del día a día (gasolina, tienda, comida...) con total del mes, promedio por día y totales por categoría.
- **Buscar y filtrar** gastos diarios por texto (categoría, nota, método o monto, sin importar acentos), categoría, método y periodo (este mes o todo), con número de resultados y total.
- **Atajos** (iOS Atajos / Android): enlaces `?gasto=150&cat=Gasolina&metodo=Efectivo&nota=Pemex` registran el gasto al abrirse; con `?gasto=&cat=Gasolina` se abre el formulario prellenado. Los enlaces se copian desde Ajustes.
- **Recordatorios**: lista de "Próximos pagos" (hoy, mañana, en N días, vencidos), número en el icono de la app y una notificación al día al abrirla. Como no hay servidor, para avisos con la app cerrada se exporta un `.ics` con eventos mensuales y alarma para el calendario del teléfono.
- Tema claro, oscuro o automático.
- **Copia automática en Google Sheets** (opcional): sincroniza al abrir la app y unos segundos después de cada cambio, guarda una copia por día (últimas 60) y permite que la app instalada y Safari compartan datos.
- **Exportar a CSV** (Ajustes) para Excel o Google Sheets: una fila por pago e ingreso de cada mes (hasta diciembre del año en curso) y por gasto diario, con fecha, mes, tipo, concepto, categoría, método, monto, estado y nota. Con filtros activos en Diario, "CSV" exporta solo los gastos filtrados.
- Exportar/importar copia en JSON, con aviso si pasan 7 días sin copia y no hay sincronización.
- Funciona sin conexión (service worker, cache-first). Los datos viven en `localStorage` del dispositivo.

## Copia automática con Google Sheets

1. Crea una hoja nueva en <https://sheets.new>.
2. Menú **Extensiones > Apps Script**. Borra lo que haya y pega el contenido de `google-apps-script.gs`.
3. Cambia `TOKEN` por una clave larga que solo tú conozcas y guarda.
4. **Implementar > Nueva implementación > Aplicación web**:
   - Ejecutar como: **Yo**
   - Quién tiene acceso: **Cualquier usuario**
5. Autoriza los permisos y copia la URL que termina en `/exec`.
6. En la app: **Ajustes > Copia automática**, pega la URL y el token, y toca **Conectar y sincronizar**.
7. Repite el paso 6 en cada copia de la app (instalada, Safari, otro teléfono).

La URL es pública, pero sin el token la hoja no entrega ni acepta datos. Si cambias el script, crea una **nueva versión** de la implementación (Implementar > Administrar implementaciones) para que la URL use el código nuevo.

Cómo resuelve conflictos: gana la copia modificada más recientemente; los gastos diarios de ambas copias se combinan. Un gasto borrado en un dispositivo puede reaparecer si otro aún lo tenía.

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
| `google-apps-script.gs` | Backend opcional para la copia automática en Google Sheets |

Los `.json` de copias de seguridad están en `.gitignore` para no subir datos personales.
