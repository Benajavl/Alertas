/*
 * Archivo principal de JavaScript para el dashboard de pozos.
 * Se encarga de leer el JSON con los datos de los pozos, construir
 * dinámicamente las tarjetas KPI, tablas y controles de selección,
 * así como gestionar los eventos de tema oscuro, auto desplazamiento
 * y cambios en los datos.
 */

// Mantendrá la data actual para detectar cambios.
let currentData = null;
// Lista de nombres de pozos que el usuario ha ocultado; se almacena en localStorage
let hiddenWellNames = [];
// Lista de ítems de stock que el usuario ha ocultado; se almacena en localStorage
let hiddenStockItems = [];
// Mapeará los datos de auto-scroll por tabla (interval y listener)
const autoScrollData = new Map();

/**
 * Al cargar el contenido del documento, configuramos los eventos
 * iniciales y solicitamos los datos.
 */
document.addEventListener('DOMContentLoaded', () => {
  // Cargar la lista de pozos ocultos desde localStorage
  try {
    const storedHidden = localStorage.getItem('hiddenWellNames');
    hiddenWellNames = storedHidden ? JSON.parse(storedHidden) : [];
  } catch (e) {
    hiddenWellNames = [];
  }
  // Cargar la lista de ítems de stock ocultos desde localStorage
  try {
    const storedStockHidden = localStorage.getItem('hiddenStockItems');
    hiddenStockItems = storedStockHidden ? JSON.parse(storedStockHidden) : [];
  } catch (e) {
    hiddenStockItems = [];
  }
  // Configurar el toggle de tema oscuro/claro
  const themeToggle = document.getElementById('themeToggle');
  // Forzar modo oscuro por defecto en cada carga
  document.body.classList.add('dark');
  themeToggle.checked = true;
  try {
    localStorage.setItem('theme', 'dark');
  } catch (e) {}
  // Permitir cambiar entre modo oscuro y claro; actualizar localStorage
  themeToggle.addEventListener('change', () => {
    if (themeToggle.checked) {
      document.body.classList.add('dark');
      try { localStorage.setItem('theme', 'dark'); } catch (e) {}
    } else {
      document.body.classList.remove('dark');
      try { localStorage.setItem('theme', 'light'); } catch (e) {}
    }
  });

  // Configurar el botón de configuración para abrir el modal
  const settingsButton = document.getElementById('settingsButton');
  const settingsModal = document.getElementById('settingsModal');
  const closeSettings = document.getElementById('closeSettings');
  const modalAutoScrollToggle = document.getElementById('modalAutoScrollToggle');
  const autoScrollToggle = document.getElementById('autoScrollToggle');
  settingsButton.addEventListener('click', () => {
    settingsModal.classList.add('show');
    settingsModal.setAttribute('aria-hidden', 'false');
    // Sincronizar estado de auto-scroll entre modal y control oculto
    if (modalAutoScrollToggle) {
      modalAutoScrollToggle.checked = autoScrollToggle.checked;
    }
  });
  closeSettings.addEventListener('click', () => {
    settingsModal.classList.remove('show');
    settingsModal.setAttribute('aria-hidden', 'true');
  });
  // Cerrar modal al hacer clic fuera del contenido
  settingsModal.addEventListener('click', (ev) => {
    if (ev.target === settingsModal) {
      settingsModal.classList.remove('show');
      settingsModal.setAttribute('aria-hidden', 'true');
    }
  });
  // Configurar el toggle de auto-scroll dentro del modal
  modalAutoScrollToggle.addEventListener('change', () => {
    autoScrollToggle.checked = modalAutoScrollToggle.checked;
    if (modalAutoScrollToggle.checked) {
      enableAutoScroll();
    } else {
      disableAutoScroll();
    }
  });

  // Configurar botones de acciones en el modal
  const resetBtn = document.getElementById('resetSettings');
  const saveBtn = document.getElementById('saveSettings');
  const settingsModalEl = document.getElementById('settingsModal');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      // Restablecer lista de pozos ocultos
      hiddenWellNames = [];
      try {
        localStorage.setItem('hiddenWellNames', JSON.stringify(hiddenWellNames));
      } catch (e) {}
      // Mostrar todas las celdas de pozos
      document.querySelectorAll('[data-well-name]').forEach(cell => {
        cell.style.display = '';
      });
      // Actualizar checkboxes del modal
      document.querySelectorAll('#modalWellControls input[type="checkbox"]').forEach(cb => {
        cb.checked = true;
      });
      // Desactivar auto desplazamiento
      modalAutoScrollToggle.checked = false;
      autoScrollToggle.checked = false;
      disableAutoScroll();
    });
  }
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      // Cerrar modal al guardar
      if (settingsModalEl) {
        settingsModalEl.classList.remove('show');
        settingsModalEl.setAttribute('aria-hidden', 'true');
      }
    });
  }

  // Cargar datos iniciales
  fetchData();
  // Revisar datos cada minuto para detectar cambios en el JSON
  setInterval(() => fetchData(true), 60000);
});

/**
 * Obtiene el JSON de datos. Si se llama como actualización,
 * solo refresca la interfaz si los datos cambiaron.
 * @param {boolean} isUpdate Indica si es un chequeo de actualización.
 */
function fetchData(isUpdate = false) {
  // Determinar la URL del JSON. Si estamos sirviendo desde archivo (file://), no
  // podemos añadir parámetros de consulta porque los sistemas de archivos
  // interpretan la ruta literalmente. En servidores HTTP agregamos un timestamp
  // para evitar el cache.
  const isFileProtocol = window.location.protocol === 'file:';
  // Usar ruta relativa explícita con ./ para que funcione tanto en directorio raíz como en subcarpetas
  const dataUrl = isFileProtocol ? './data.json' : './data.json?ts=' + Date.now();
  fetch(dataUrl, { cache: 'no-store' })
    .then(resp => resp.json())
    .then(data => {
      if (!isUpdate || !currentData || JSON.stringify(data) !== JSON.stringify(currentData)) {
        currentData = data;
        updateDashboard(data);
      }
    })
    .catch(err => {
      console.error('No se pudieron cargar los datos.', err);
      // Mostrar mensaje de error en la interfaz
      const errorDiv = document.getElementById('error');
      if (errorDiv) {
        errorDiv.textContent = 'No se pudieron cargar los datos JSON. Si estás abriendo el archivo localmente, utiliza un servidor web como python -m http.server para evitar bloqueos del navegador.';
        errorDiv.hidden = false;
      }
    });
}

/**
 * Renderiza todas las partes del dashboard de acuerdo a los datos
 * proporcionados.
 * @param {object} data Objeto con información de pozos y metadatos.
 */
function updateDashboard(data) {
  // Ocultar mensaje de error al actualizar la vista
  const errorDiv = document.getElementById('error');
  if (errorDiv) {
    errorDiv.hidden = true;
    errorDiv.textContent = '';
  }
  // Estructurar los datos para obtener la propiedad wells a partir de items
  const structured = parseWellsFromData(data);
  // Insertar la propiedad wells en data para compatibilidad con funciones existentes
  data.wells = structured.wells;
  // Llenar la interfaz
  populateKpi(data);
  renderWellControls(data);
  renderTables(data);
  updateFooter(data);
  // Actualizar controles del modal
  renderModalControls(data);
  renderStockControls(data);
  // Aplicar estado de ocultación de pozos (mantener ocultos los pozos que el usuario desactivó)
  applyHiddenWellState(data);
  // Posicionar las tablas al final para mostrar las últimas etapas si el auto-scroll no está activo
  scrollTablesToBottom();
  // Si el auto-scroll estaba activado, reiniciar intervalos para que
  // se apliquen a las nuevas tablas.
  const autoScrollToggle = document.getElementById('autoScrollToggle');
  if (autoScrollToggle.checked) {
    enableAutoScroll();
  } else {
    disableAutoScroll();
  }
}

/**
 * Crea tarjetas KPI en el encabezado basadas en las métricas calculadas a partir
 * de los datos de los pozos.
 * @param {object} data Objeto de datos.
 */
function populateKpi(data) {
  const kpiContainer = document.getElementById('kpi-container');
  kpiContainer.innerHTML = '';
  if (!data || !Array.isArray(data.wells)) return;
  // Número de pozos
  const wellsCount = data.wells.length;
  // Calcular profundidad promedio considerando solo valores numéricos
  let totalDepth = 0;
  let depthCount = 0;
  // Total de etapas realizadas (fecha de fractura presente)
  let totalStagesPerformed = 0;
  // Agrupar etapas por día de fractura (solo fechas válidas)
  const stagesPerDay = {};
  data.wells.forEach(well => {
    well.etapas.forEach(etapa => {
      // Profundidad
      if (typeof etapa.profundidad === 'number') {
        totalDepth += etapa.profundidad;
        depthCount++;
      }
      // Etapas realizadas: contar si hay fecha de fractura (texto o numérico)
      if (etapa.fechaFractura && etapa.fechaFractura !== '') {
        totalStagesPerformed++;
      }
      // Agrupar por día si la fecha de fractura es numérica/valida
      if (etapa.fechaFractura) {
        // Intentar parsear como número para detectar serial de Excel
        const num = parseFloat(etapa.fechaFractura);
        let dateObj = null;
        if (!isNaN(num)) {
          dateObj = excelSerialToDate(num);
        } else {
          // Intentar parsear strings como fechas ISO
          const parsed = Date.parse(etapa.fechaFractura);
          if (!isNaN(parsed)) {
            dateObj = new Date(parsed);
          }
        }
        if (dateObj) {
          const dayKey = dateObj.toLocaleDateString();
          stagesPerDay[dayKey] = (stagesPerDay[dayKey] || 0) + 1;
        }
      }
    });
  });
  const avgDepth = depthCount > 0 ? Math.round(totalDepth / depthCount) : 0;
  // Calcular promedio de etapas por día
  const uniqueDates = Object.keys(stagesPerDay);
  let avgStagesPerDay;
  if (uniqueDates.length > 0) {
    const sum = Object.values(stagesPerDay).reduce((a, b) => a + b, 0);
    const avg = sum / uniqueDates.length;
    avgStagesPerDay = Math.round(avg);
  } else {
    avgStagesPerDay = 'N/A';
  }

  // Calcular etapas realizadas el día anterior (ayer).
  // Se toma la fecha local actual, se resta un día y se cuenta cuántas
  // etapas tienen una fecha de fractura que coincide con ese día.
  let prevDayStages = 0;
  try {
    const now = new Date();
    // Restar un día
    const prev = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    const prevDayStr = prev.toLocaleDateString();
    data.wells.forEach(well => {
      well.etapas.forEach(etapa => {
        if (etapa.fechaFractura && etapa.fechaFractura === prevDayStr) {
          prevDayStages++;
        }
      });
    });
  } catch (e) {
    prevDayStages = 0;
  }
  // Construir lista de KPIs
  const kpis = [];
  kpis.push({ title: 'Pozos', value: wellsCount });
  kpis.push({ title: 'Etapas totales', value: totalStagesPerformed });
  kpis.push({ title: 'Etapas promedio/día', value: avgStagesPerDay });
  kpis.push({ title: 'Etapas día anterior', value: prevDayStages });
  // No se añade profundidad promedio según los requisitos
  // Construir las tarjetas
  kpis.forEach(kpi => {
    const card = document.createElement('div');
    card.className = 'kpi-card';
    const title = document.createElement('div');
    title.className = 'kpi-title';
    title.textContent = kpi.title;
    const value = document.createElement('div');
    value.className = 'kpi-value';
    value.textContent = kpi.value;
    card.appendChild(title);
    card.appendChild(value);
    kpiContainer.appendChild(card);
  });
}

/**
 * Genera los controles (checkboxes) para que el usuario
 * pueda elegir qué pozos visualizar.
 * @param {object} data Objeto de datos con la lista de pozos.
 */
function renderWellControls(data) {
  const wellControlsContainer = document.getElementById('wellControls');
  // Si no existe el contenedor (porque la UI oculta esta sección), no hacer nada
  if (!wellControlsContainer) return;
  wellControlsContainer.innerHTML = '';
  if (!data || !data.wells) return;
  data.wells.forEach((well, index) => {
    const label = document.createElement('label');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = true;
    checkbox.dataset.wellIndex = index;
    checkbox.addEventListener('change', (ev) => {
      const idx = ev.target.dataset.wellIndex;
      const tableContainer = document.querySelector(`.table-container[data-well-index="${idx}"]`);
      if (tableContainer) {
        tableContainer.style.display = ev.target.checked ? '' : 'none';
      }
    });
    const span = document.createElement('span');
    span.textContent = well.name;
    label.appendChild(checkbox);
    label.appendChild(span);
    wellControlsContainer.appendChild(label);
  });
}

/**
 * Construye los controles dentro del modal para seleccionar qué pozos
 * visualizar y actualiza la visibilidad de las tablas.
 * @param {object} data Datos estructurados con la propiedad wells.
 */
function renderModalControls(data) {
  const modalContainer = document.getElementById('modalWellControls');
  if (!modalContainer) return;
  modalContainer.innerHTML = '';
  if (!data || !data.wells) return;
  data.wells.forEach((well, index) => {
    const label = document.createElement('label');
    label.style.display = 'flex';
    label.style.alignItems = 'center';
    label.style.gap = '0.25rem';
    label.style.marginRight = '1rem';
    label.style.fontSize = '0.9rem';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    // Guardar nombre del pozo en dataset
    checkbox.dataset.wellName = well.name;
    // Establecer el checked según lista de pozos ocultos
    checkbox.checked = !hiddenWellNames.includes(well.name);
    checkbox.addEventListener('change', (ev) => {
      const wellName = ev.target.dataset.wellName;
      // Actualizar lista de pozos ocultos
      if (ev.target.checked) {
        hiddenWellNames = hiddenWellNames.filter(name => name !== wellName);
      } else {
        if (!hiddenWellNames.includes(wellName)) hiddenWellNames.push(wellName);
      }
      // Guardar cambios
      try {
        localStorage.setItem('hiddenWellNames', JSON.stringify(hiddenWellNames));
      } catch (e) {}
      // Mostrar u ocultar las celdas correspondientes en la tabla unificada
      const cells = document.querySelectorAll(`[data-well-name="${wellName}"]`);
      cells.forEach(cell => {
        cell.style.display = ev.target.checked ? '' : 'none';
      });
    });
    const span = document.createElement('span');
    span.textContent = well.name;
    label.appendChild(checkbox);
    label.appendChild(span);
    modalContainer.appendChild(label);
  });
}

/**
 * Construye los controles dentro del modal para seleccionar qué tarjetas de stock
 * mostrar en el pie de página. Similar a los controles de pozos.
 * @param {object} data Datos con la lista de stock.
 */
function renderStockControls(data) {
  const stockContainer = document.getElementById('modalStockControls');
  if (!stockContainer) return;
  stockContainer.innerHTML = '';
  if (!data || !Array.isArray(data.stock)) return;
  data.stock.forEach(item => {
    const name = item.ITEM;
    const label = document.createElement('label');
    label.style.display = 'flex';
    label.style.alignItems = 'center';
    label.style.gap = '0.25rem';
    label.style.marginRight = '1rem';
    label.style.fontSize = '0.9rem';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.dataset.itemName = name;
    checkbox.checked = !hiddenStockItems.includes(name);
    checkbox.addEventListener('change', (ev) => {
      const itemName = ev.target.dataset.itemName;
      if (ev.target.checked) {
        // Mostrar y eliminar de la lista oculta
        hiddenStockItems = hiddenStockItems.filter(n => n !== itemName);
      } else {
        if (!hiddenStockItems.includes(itemName)) hiddenStockItems.push(itemName);
      }
      try {
        localStorage.setItem('hiddenStockItems', JSON.stringify(hiddenStockItems));
      } catch (e) {}
      // Actualizar el pie de página
      updateFooter(currentData);
    });
    const span = document.createElement('span');
    span.textContent = name;
    label.appendChild(checkbox);
    label.appendChild(span);
    stockContainer.appendChild(label);
  });
}

/**
 * Construye y muestra las tablas para cada pozo. Si hay más pozos
 * que el ancho de la pantalla, se mostrará una barra de desplazamiento
 * horizontal en el contenedor.
 * @param {object} data Objeto de datos con pozos y etapas.
 */
function renderTables(data) {
  const wrapper = document.getElementById('tables-wrapper');
  wrapper.innerHTML = '';
  if (!data || !data.wells) return;
  // Unificar todas las tablas en una sola gran tabla con columnas por pozo.
  // Calcular la cantidad máxima de filas entre todos los pozos
  const maxRows = data.wells.reduce((max, well) => Math.max(max, well.etapas.length), 0);
  // Construir contenedor y tabla unificada
  const container = document.createElement('div');
  container.className = 'table-container';
  // Contenedor interior para auto-scroll vertical
  const inner = document.createElement('div');
  inner.className = 'table-wrapper-inner';
  const table = document.createElement('table');
  const thead = document.createElement('thead');
  // Primera fila de cabecera: encabezado vacío para etapa y encabezados de pozos (colspan)
  const headerRow1 = document.createElement('tr');
  const etapaHeader = document.createElement('th');
  etapaHeader.rowSpan = 2;
  etapaHeader.textContent = 'Etapa';
  headerRow1.appendChild(etapaHeader);
  data.wells.forEach((well, index) => {
    const th = document.createElement('th');
    th.colSpan = 3;
    th.textContent = well.name;
    th.setAttribute('data-well-name', well.name);
    headerRow1.appendChild(th);
  });
  thead.appendChild(headerRow1);
  // Segunda fila de cabecera: sub columnas para cada pozo
  const headerRow2 = document.createElement('tr');
  data.wells.forEach((well, index) => {
    ['Fecha y hora', 'Profundidad (m)', 'Fecha fractura'].forEach(subName => {
      const th = document.createElement('th');
      th.textContent = subName;
      th.setAttribute('data-well-name', well.name);
      headerRow2.appendChild(th);
    });
  });
  thead.appendChild(headerRow2);
  table.appendChild(thead);
  // Cuerpo de la tabla
  const tbody = document.createElement('tbody');
  for (let rowIndex = 0; rowIndex < maxRows; rowIndex++) {
    const tr = document.createElement('tr');
    // Celda para el número de etapa (usar primera etapa encontrada)
    let etapaLabel = '';
    // Buscar la etiqueta de etapa en el primer pozo que tenga esa fila
    for (let w = 0; w < data.wells.length; w++) {
      const etapaObj = data.wells[w].etapas[rowIndex];
      if (etapaObj && etapaObj.etapa) {
        etapaLabel = etapaObj.etapa;
        break;
      }
    }
    const etapaTd = document.createElement('td');
    etapaTd.textContent = etapaLabel;
    tr.appendChild(etapaTd);
    // Celdas de cada pozo
    data.wells.forEach((well) => {
      const etapaObj = well.etapas[rowIndex];
      const fechaStr = etapaObj ? etapaObj.fechaHora || '' : '';
      // Separar fecha y hora en dos líneas para mejor legibilidad
      let datePart = '';
      let timePart = '';
      if (fechaStr) {
        const parts = fechaStr.split(',');
        datePart = parts[0].trim();
        if (parts.length > 1) {
          timePart = parts.slice(1).join(',').trim();
        }
      }
      const profundidad = etapaObj ? ((etapaObj.profundidad === null || etapaObj.profundidad === undefined) ? '' : etapaObj.profundidad) : '';
      const fractura = etapaObj ? etapaObj.fechaFractura || '' : '';
      // Fecha y hora
      const tdFecha = document.createElement('td');
      tdFecha.innerHTML = `<div class="date-part">${datePart}</div><div class="time-part">${timePart}</div>`;
      tdFecha.setAttribute('data-well-name', well.name);
      tr.appendChild(tdFecha);
      // Profundidad
      const tdProf = document.createElement('td');
      tdProf.textContent = profundidad;
      tdProf.setAttribute('data-well-name', well.name);
      tr.appendChild(tdProf);
      // Fecha fractura
      const tdFrac = document.createElement('td');
      tdFrac.textContent = fractura;
      tdFrac.setAttribute('data-well-name', well.name);
      tr.appendChild(tdFrac);
    });
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  inner.appendChild(table);
  container.appendChild(inner);
  // Vaciar contenedor y añadir la tabla unificada
  wrapper.innerHTML = '';
  wrapper.appendChild(container);
}

/**
 * Actualiza el contenido del pie de página si hay información
 * adicional en los datos. Oculta el pie si no hay nada que mostrar.
 * @param {object} data Objeto de datos con metadatos.
 */
function updateFooter(data) {
  const footer = document.getElementById('footer');
  const footerContent = document.getElementById('footerContent');
  // Construir tarjetas KPI en el pie de página. Borrar contenido previo.
  footerContent.innerHTML = '';
  const cards = [];
  // Agregar tarjeta por cada elemento de stock, considerando ocultos
  if (data && Array.isArray(data.stock) && data.stock.length > 0) {
    data.stock.forEach(item => {
      if (hiddenStockItems.includes(item.ITEM)) return;
      const card = document.createElement('div');
      card.className = 'kpi-card';
      const title = document.createElement('div');
      title.className = 'kpi-title';
      title.textContent = item.ITEM;
      const value = document.createElement('div');
      value.className = 'kpi-value';
      value.textContent = item.STOCK;
      card.appendChild(title);
      card.appendChild(value);
      cards.push(card);
    });
  }
  // Agregar tarjeta de última actualización
  if (data && data.lastUpdate) {
    const lastUpdateDate = new Date(data.lastUpdate);
    const card = document.createElement('div');
    card.className = 'kpi-card';
    const title = document.createElement('div');
    title.className = 'kpi-title';
    title.textContent = 'Actualización';
    const value = document.createElement('div');
    value.className = 'kpi-value';
    value.textContent = lastUpdateDate.toLocaleString();
    card.appendChild(title);
    card.appendChild(value);
    cards.push(card);
  }
  // Adjuntar tarjetas al footer
  if (cards.length > 0) {
    cards.forEach(card => footerContent.appendChild(card));
    footer.hidden = false;
  } else {
    footer.hidden = true;
  }
}

/**
 * Activa el desplazamiento automático vertical en todas las tablas visibles.
 * Para cada tabla se crea un intervalo que incrementa la posición de scroll
 * y vuelve al inicio al alcanzar el final. Si ya existe un intervalo para
 * una tabla, primero se limpia.
 */
function enableAutoScroll() {
  // Limpiar intervalos y listeners previos para evitar duplicados
  disableAutoScroll();
  const containers = document.querySelectorAll('.table-container');
  containers.forEach(container => {
    const inner = container.querySelector('.table-wrapper-inner');
    if (!inner) return;
    // Inicializar marca de tiempo del último scroll del usuario
    inner.dataset.lastUserScroll = '0';
    const scrollListener = () => {
      inner.dataset.lastUserScroll = Date.now().toString();
    };
    inner.addEventListener('scroll', scrollListener);
    // Posicionar al final inicialmente para mostrar valores recientes
    const maxScrollTop = inner.scrollHeight - inner.clientHeight;
    if (maxScrollTop > 0) {
      inner.scrollTop = maxScrollTop;
    }
    // Crear intervalo que desplaza lentamente hacia abajo salvo que el usuario interactúe
    const intervalId = setInterval(() => {
      // Si el contenedor está oculto, omitir
      if (container.style.display === 'none') return;
      const last = parseInt(inner.dataset.lastUserScroll || '0');
      // Si el usuario ha interactuado en los últimos 3 segundos, no forzar scroll
      if (Date.now() - last < 3000) return;
      const maxScroll = inner.scrollHeight - inner.clientHeight;
      if (maxScroll <= 0) return;
      if (inner.scrollTop < maxScroll - 2) {
        inner.scrollTop += 1;
      } else {
        inner.scrollTop = maxScroll;
      }
    }, 50); // ajustar velocidad de desplazamiento
    autoScrollData.set(inner, { intervalId, scrollListener });
  });
}

/**
 * Detiene y limpia todos los intervalos de desplazamiento automático
 * de todas las tablas.
 */
function disableAutoScroll() {
  autoScrollData.forEach((data, element) => {
    if (data.intervalId) clearInterval(data.intervalId);
    if (data.scrollListener) element.removeEventListener('scroll', data.scrollListener);
  });
  autoScrollData.clear();
}

/**
 * Convierte una fecha en formato Excel (número serial) a objeto Date.
 * Excel cuenta los días desde 1899-12-31; se resta 25569 para convertir
 * a la época Unix (1970-01-01). Si no es numérico, retorna null.
 * @param {string|number} serial
 * @returns {Date|null}
 */
function excelSerialToDate(serial) {
  const num = parseFloat(serial);
  if (isNaN(num)) return null;
  const unixTimestamp = (num - 25569) * 86400 * 1000;
  return new Date(unixTimestamp);
}

/**
 * Transforma la estructura del JSON original en un formato con la propiedad
 * "wells", cada una con su nombre y lista de etapas. Una etapa contiene
 * el número de etapa (fila), la fecha y hora convertidas, la profundidad (numérica
 * si aplica) y la fecha de fractura. Las filas sin número se omiten.
 * @param {object} data Objeto original con la propiedad items.
 * @returns {object} Objeto con un array "wells".
 */
function parseWellsFromData(data) {
  const result = { wells: [] };
  if (!data || !Array.isArray(data.items) || data.items.length === 0) {
    return result;
  }
  // La primera fila contiene los nombres de los pozos (TPNPozoX)
  const headerRow = data.items[0] || {};
  // Crear hasta seis pozos con nombres extraídos de la cabecera
  for (let i = 1; i <= 6; i++) {
    const nameKey = `TPNPozo${i}`;
    const altKey = `FechaFracPozo${i}`;
    // Se utiliza primero el nombre alternativo (FechaFracPozoX) ya que contiene el identificador del pozo (por ejemplo Lca-3001(h)).
    // Utilizar primero el nombre alternativo (FechaFracPozoX) siempre que sea válido y no sea "X"
    let name = headerRow[altKey];
    if (!name || name.toString().trim() === '' || name.toString().trim().toUpperCase() === 'X') {
      name = headerRow[nameKey];
    }
    if (!name || name.toString().trim() === '' || name.toString().trim().toUpperCase() === 'X') {
      name = `Pozo ${i}`;
    }
    result.wells.push({ name: name, etapas: [] });
  }
  // Recorrer filas a partir de la tercera fila (índice 2) para etapas
  for (let j = 2; j < data.items.length; j++) {
    const row = data.items[j];
    if (!row) continue;
    const stageLabel = (row.Fila || '').trim();
    if (!stageLabel) continue;
    for (let i = 1; i <= 6; i++) {
      const well = result.wells[i - 1];
      const secKey = `SecuenciaPozo${i}`;
      const tpnKey = `TPNPozo${i}`;
      const fracKey = `FechaFracPozo${i}`;
      const secVal = row[secKey];
      const tpnVal = row[tpnKey];
      const fracVal = row[fracKey];
      // Convertir fecha y hora
      let fechaHoraStr = '';
      if (secVal && !isNaN(parseFloat(secVal))) {
        const dateObj = excelSerialToDate(secVal);
        fechaHoraStr = dateObj ? dateObj.toLocaleString() : '';
      }
      // Convertir profundidad si es numérica
      let profundidadVal = null;
      if (tpnVal && !isNaN(parseFloat(tpnVal))) {
        profundidadVal = parseFloat(tpnVal);
      }
      // Convertir fecha de fractura (puede ser numérica o texto)
      let fechaFracStr = '';
      if (fracVal) {
        if (!isNaN(parseFloat(fracVal))) {
          const fracDate = excelSerialToDate(fracVal);
          fechaFracStr = fracDate ? fracDate.toLocaleDateString() : '';
        } else {
          fechaFracStr = fracVal;
        }
      }
      well.etapas.push({
        etapa: stageLabel,
        fechaHora: fechaHoraStr,
        profundidad: profundidadVal,
        fechaFractura: fechaFracStr
      });
    }
  }
  // No filtrar pozos sin etapas para poder mostrar columnas vacías y controles para todos los pozos
  return result;
}

/**
 * Desplaza todas las tablas unificadas al final para mostrar las últimas filas.
 * Se utiliza al cargar o actualizar datos cuando el auto-scroll no está activado.
 */
function scrollTablesToBottom() {
  const inners = document.querySelectorAll('.table-container .table-wrapper-inner');
  inners.forEach(inner => {
    const maxScroll = inner.scrollHeight - inner.clientHeight;
    if (maxScroll > 0) {
      inner.scrollTop = maxScroll;
    }
  });
}

/**
 * Aplica el estado de pozos ocultos guardado en localStorage. Esta función
 * se ejecuta después de renderizar las tablas y los controles del modal. Se
 * encarga de ocultar las tablas correspondientes a los pozos que el
 * usuario desactivó previamente y de sincronizar el estado de los
 * checkboxes del modal. Además, depura la lista de nombres ocultos
 * eliminando aquellos que ya no existen en la data actual.
 * @param {object} data Datos estructurados con la propiedad wells.
 */
function applyHiddenWellState(data) {
  if (!data || !Array.isArray(data.wells)) return;
  // Asegurarse de que hiddenWellNames esté inicializado
  if (!Array.isArray(hiddenWellNames)) hiddenWellNames = [];
  // Obtener los nombres válidos de pozos en la data
  const validNames = data.wells.map(well => well.name);
  // Filtrar nombres ocultos que ya no existan en la data
  const updatedHidden = hiddenWellNames.filter(name => validNames.includes(name));
  // Actualizar la variable global y persistir
  hiddenWellNames = updatedHidden;
  try {
    localStorage.setItem('hiddenWellNames', JSON.stringify(hiddenWellNames));
  } catch (e) {}
  // Ocultar o mostrar celdas correspondientes a cada pozo en la tabla unificada
  const allCells = document.querySelectorAll('[data-well-name]');
  allCells.forEach(cell => {
    const name = cell.getAttribute('data-well-name');
    if (hiddenWellNames.includes(name)) {
      cell.style.display = 'none';
    } else {
      cell.style.display = '';
    }
  });
  // Sincronizar estado de checkboxes del modal
  document.querySelectorAll('#modalWellControls input[type="checkbox"]').forEach(cb => {
    const name = cb.dataset.wellName;
    cb.checked = !hiddenWellNames.includes(name);
  });
}
