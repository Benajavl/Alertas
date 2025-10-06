@ -249,6 +249,8 @@ document.addEventListener('DOMContentLoaded', () => {
      document.querySelectorAll('#modalWellControls input[type="checkbox"]').forEach(cb => {
        cb.checked = true;
      });
      // Recalcular ancho mínimo de la tabla
      try { updateTableMinWidth(); } catch (e) {}
      // Desactivar auto desplazamiento
  modalAutoScrollToggle.checked = false;
  autoScrollToggle.checked = false;
@ -337,7 +339,7 @@ function updateDashboard(data) {
  populateKpi(data);
  renderWellControls(data);
  renderTables(data);
  //updateFooter(data);
  updateFooter(data);
  // Actualizar controles del modal
  renderModalControls(data);
  renderStockControls(data);
@ -381,8 +383,11 @@ function updateDashboard(data) {
 * @param {object} data Objeto de datos.
 */
function populateKpi(data) {
  const kpiContainer = document.getElementById('kpi-container');
  kpiContainer.innerHTML = '';
  // Ahora las KPIs principales (Pozos, Etapas, etc.) se renderizan en el footer
  const footer = document.getElementById('footer');
  const footerContent = document.getElementById('footerContent');
  if (!footerContent) return;
  footerContent.innerHTML = '';
  if (!data || !Array.isArray(data.wells)) return;
  // Número de pozos
  const wellsCount = data.wells.length;
@ -419,16 +424,29 @@ function populateKpi(data) {
    const sum = Object.values(stagesPerDay).reduce((a, b) => a + b, 0);
    const avg = sum / uniqueDates.length;
    // calcular promedio sin redondear Math.round(avg)
    // Mantener exactamente 2 decimales como string
    avgStagesPerDay = avg.toFixed(2);
  } else {
    avgStagesPerDay = 'N/A';
    avgStagesPerDay = null; // indicar ausencia para que no se muestre
  }

  // Construir lista de KPIs
  // Construir lista de KPIs que pasaremos al footer (oculto por defecto)
  // Omitiremos KPIs cuyo valor sea null, vacío o 'N/A'
  const kpis = [];
  kpis.push({ title: 'Pozos', value: wellsCount });
  kpis.push({ title: 'Etapas totales', value: totalStagesPerformed });
  kpis.push({ title: 'Etapas promedio/día', value: avgStagesPerDay });
  const pushKpi = (title, value) => {
    if (value === null || value === undefined) return;
    const str = (typeof value === 'string') ? value.trim() : String(value);
    if (str === '' || str.toUpperCase() === 'N/A') return;
    kpis.push({ title, value });
  };
  pushKpi('Pozos', wellsCount);
  pushKpi('Etapas totales', totalStagesPerformed);
  // Asegurar que 'Etapas promedio/día' tenga exactamente 2 decimales cuando exista
  if (avgStagesPerDay !== null && avgStagesPerDay !== undefined) {
    // avgStagesPerDay ya es un string con 2 decimales por toFixed, pero normalizamos a número/formato
    const n = Number(avgStagesPerDay);
    if (!isNaN(n)) pushKpi('Etapas promedio/día', n.toFixed(2));
  }
  // Calcular etapas de hoy y de ayer usando el mapa stagesPerDay
  try {
    const now = new Date();
@ -437,8 +455,8 @@ function populateKpi(data) {
    const yesterdayStr = yesterday.toLocaleDateString();
    const todayCount = stagesPerDay[todayStr] || 0;
    const yesterdayCount = stagesPerDay[yesterdayStr] || 0;
    kpis.push({ title: 'Etapas (hoy)', value: todayCount });
    kpis.push({ title: 'Etapas (ayer)', value: yesterdayCount });
  pushKpi('Etapas (hoy)', todayCount);
  pushKpi('Etapas (ayer)', yesterdayCount);
    // Log para depuración rápida: mostrar el mapa de etapas por día
    try { console.debug('stagesPerDay', stagesPerDay, 'today', todayStr, todayCount, 'yesterday', yesterdayStr, yesterdayCount); } catch (e) {}
  } catch (e) {
@ -446,7 +464,7 @@ function populateKpi(data) {
    kpis.push({ title: 'Etapas (ayer)', value: 0 });
  }
  // No se añade profundidad promedio según los requisitos
  // Construir las tarjetas
  // Construir las tarjetas y añadirlas al footerContent, pero mantener el footer oculto
  kpis.forEach(kpi => {
    const card = document.createElement('div');
    card.className = 'kpi-card';
@ -455,11 +473,20 @@ function populateKpi(data) {
    title.textContent = kpi.title;
    const value = document.createElement('div');
    value.className = 'kpi-value';
    value.textContent = kpi.value;
    // Formatear algunas KPIs especiales
    let displayVal = kpi.value;
    // Si el KPI es 'Fecha inicio fractura' intentar formatear usando fechaFracturaDate del primer pozo disponible
    if (kpi.title.toLowerCase().includes('fecha') && typeof kpi.value === 'string') {
      // intentar detectar si el valor es un serial numérico dentro de los datos: en este context usamos el valor tal cual
      displayVal = kpi.value;
    }
    value.textContent = displayVal;
    card.appendChild(title);
    card.appendChild(value);
    kpiContainer.appendChild(card);
    footerContent.appendChild(card);
  });
  // Mantener el footer oculto para uso posterior
  if (footer) footer.hidden = true;
}

/**
@ -534,6 +561,8 @@ function renderModalControls(data) {
      cells.forEach(cell => {
        cell.style.display = ev.target.checked ? '' : 'none';
      });
      // Recalcular ancho mínimo de la tabla tras cambiar visibilidad
      try { updateTableMinWidth(); } catch (e) {}
    });
    const span = document.createElement('span');
    span.textContent = well.name;
@ -661,14 +690,20 @@ function renderTables(data) {
    data.wells.forEach((well) => {
      const etapaObj = well.etapas[rowIndex];
      const fechaStr = etapaObj ? etapaObj.fechaHora || '' : '';
      // Separar fecha y hora en dos líneas para mejor legibilidad
      // Separar fecha y hora en dos líneas para mejor legibilidad.
      // Si fechaHora contiene solo la hora (HH:MM:SS), la mostramos en timePart.
      let datePart = '';
      let timePart = '';
      if (fechaStr) {
        const parts = fechaStr.split(',');
        datePart = parts[0].trim();
        if (parts.length > 1) {
          timePart = parts.slice(1).join(',').trim();
        if (fechaStr.includes(',')) {
          const parts = fechaStr.split(',');
          datePart = parts[0].trim();
          if (parts.length > 1) {
            timePart = parts.slice(1).join(',').trim();
          }
        } else {
          // FechaHora es probable que sea solo la hora (HH:MM:SS)
          timePart = fechaStr.trim();
        }
      }
      const profundidad = etapaObj ? ((etapaObj.profundidad === null || etapaObj.profundidad === undefined) ? '' : etapaObj.profundidad) : '';
@ -875,30 +910,62 @@ function renderTables(data) {
 * adicional en los datos. Oculta el pie si no hay nada que mostrar.
 * @param {object} data Objeto de datos con metadatos.
 */
/** function updateFooter(data) {
  const footer = document.getElementById('footer');
  const footerContent = document.getElementById('footerContent');
  // Construir tarjetas KPI en el pie de página. Borrar contenido previo.
  footerContent.innerHTML = '';
function updateFooter(data) {
  // Ahora esta función coloca las tarjetas de STOCK/Actualización en el contenedor superior de KPIs
  const kpiContainer = document.getElementById('kpi-container');
  if (!kpiContainer) return;
  kpiContainer.innerHTML = '';
  const cards = [];
  // Agregar tarjeta por cada elemento de stock, considerando ocultos
  if (data && Array.isArray(data.stock) && data.stock.length > 0) {
    data.stock.forEach(item => {
      if (hiddenStockItems.includes(item.ITEM)) return;
      const name = (item.ITEM || '').toString().trim();
      const stockRaw = (item.STOCK === undefined || item.STOCK === null) ? '' : item.STOCK.toString().trim();
      if (!name || name.toUpperCase() === 'N/A') return;
      if (!stockRaw || stockRaw.toUpperCase() === 'N/A') return;
      if (hiddenStockItems.includes(name)) return;
      // Construir tarjeta con formato según tipo
      const card = document.createElement('div');
      card.className = 'kpi-card';
      const title = document.createElement('div');
      title.className = 'kpi-title';
      title.textContent = item.ITEM;
      title.textContent = name;
      const value = document.createElement('div');
      value.className = 'kpi-value';
      value.textContent = item.STOCK;
      // Intentar formatear valores numéricos
      const num = parseFloat(stockRaw.replace(/,/g, '.'));
      let display = stockRaw;
      const lname = name.toLowerCase();
      if (!isNaN(num)) {
        // Fecha / fractura: convertir serial a fecha
        if (lname.includes('fecha') || lname.includes('fractura')) {
          const d = excelSerialToDate(num);
          if (d && !isNaN(d.getTime())) {
            display = d.toLocaleDateString('es-AR');
          } else {
            display = stockRaw;
          }
        } else if (lname.includes('/') || lname.includes('etapas/d')) {
          // Ratios explícitos como 'Etapas/días' (tienen '/' o texto 'etapas/d') -> 2 decimales
          display = num.toFixed(2);
        } else if (lname.includes('etap')) {
          // KPIs de etapas que representan contadores deben mostrarse como enteros
          display = String(Math.round(num));
        } else if (lname.includes('dí') || lname.includes('dia') || lname.includes('dias')) {
          // Otros KPIs que hablan de días no relacionados con 'Etapas/días'
          display = num.toFixed(2);
        } else {
          // Por defecto mostrar número tal cual
          display = Number.isInteger(num) ? String(num) : String(num);
        }
      }
      value.textContent = display;
      card.appendChild(title);
      card.appendChild(value);
      cards.push(card);
    });
  }
  // Agregar tarjeta de última actualización
  // Agregar tarjeta de última actualización si existe
  if (data && data.lastUpdate) {
    const lastUpdateDate = new Date(data.lastUpdate);
    const card = document.createElement('div');
@ -908,21 +975,41 @@ function renderTables(data) {
    title.textContent = 'Actualización';
    const value = document.createElement('div');
    value.className = 'kpi-value';
    // Formatear la fecha de actualización en el footer como DD/MM/AAAA HH:MM:SS
    value.textContent = lastUpdateDate.toLocaleString('es-AR', { hour12: false });
    card.appendChild(title);
    card.appendChild(value);
    cards.push(card);
  }
  // Adjuntar tarjetas al footer
  // Adjuntar tarjetas al contenedor superior
  if (cards.length > 0) {
    cards.forEach(card => footerContent.appendChild(card));
    footer.hidden = false;
  } else {
    footer.hidden = true;
    cards.forEach(card => kpiContainer.appendChild(card));
  }
}

/**
 * Recalcula el minWidth de la tabla unificada según la cantidad de columnas visibles.
 * Esto permite que cuando el usuario oculta pozos, la tabla se reduzca y no
 * obligue a un scroll horizontal innecesario.
 */
function updateTableMinWidth() {
  const table = document.querySelector('#tables-wrapper table');
  if (!table) return;
  // Contar columnas visibles: la primera columna (Etapa) siempre visible + 3 por cada pozo visible
  const allTh = Array.from(table.querySelectorAll('thead tr:first-child th'));
  // Excluir el primer th (Etapa)
  const wellThs = allTh.slice(1);
  // Cada wellTh representa un pozo (colSpan=3) pero puede estar oculto via display:none
  let visibleWells = 0;
  wellThs.forEach(th => {
    if (th.style.display === 'none' || window.getComputedStyle(th).display === 'none') return;
    visibleWells++;
  });
  // Si no hay wells visibles, mantener al menos 1
  visibleWells = Math.max(1, visibleWells);
  const totalColumns = 1 + visibleWells * 3;
  const baseWidth = 140;
  table.style.minWidth = (totalColumns * baseWidth) + 'px';
}
/**
 * Activa el desplazamiento automático vertical en todas las tablas visibles.
 * Para cada tabla se crea un intervalo que incrementa la posición de scroll
@ -1096,11 +1183,16 @@ function parseWellsFromData(data) {
        const numVal = parseFloat(secVal);
        if (!isNaN(numVal)) {
          // Valor numérico: serial de Excel
          // Convertir correctamente a Date usando excelSerialToDate (evita shifts de timezone)
          const dateObj = excelSerialToDate(numVal);
          if (dateObj) {
            const datePart = dateObj.toLocaleDateString('es-AR');
            const timePart = dateObj.toLocaleTimeString('es-AR', { hour12: false });
            // Guardar fecha y hora en formato legible
            fechaHoraStr = `${datePart}, ${timePart}`;
          } else {
            // Si no se pudo convertir, usar cadena original
            fechaHoraStr = '' + secVal;
          }
        } else if (typeof secVal === 'string' && secVal.trim() !== '') {
          // Intentar parsear cadena dd/mm/aaaa hh:mm
@ -1287,6 +1379,8 @@ function applyHiddenWellState(data) {
    const name = cb.dataset.wellName;
    cb.checked = !hiddenWellNames.includes(name);
  });
  // Ajustar el ancho mínimo de la tabla según pozos visibles
  try { updateTableMinWidth(); } catch (e) {}
}

/**
