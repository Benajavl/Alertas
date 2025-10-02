let wellsData = null;
let lastUpdateTime = null;

// Configuración de GitHub - REEMPLAZA ESTOS VALORES CON LOS TUYOS
const GITHUB_CONFIG = {
    // Opción 1: Usar archivo local (comentar la línea de GitHub abajo)
    useLocal: true,
    localPath: 'data.json',
    
    // Opción 2: Usar GitHub (descomentar y configurar)
    // useLocal: false,
    // githubUrl: 'https://raw.githubusercontent.com/TU_USUARIO/TU_REPOSITORIO/main/data.json'
};

// Cargar datos desde archivo JSON (local o GitHub)
async function loadData() {
    try {
        // Agregar timestamp para evitar caché del navegador
        const timestamp = new Date().getTime();
        const url = GITHUB_CONFIG.useLocal 
            ? `${GITHUB_CONFIG.localPath}?t=${timestamp}`
            : `${GITHUB_CONFIG.githubUrl}?t=${timestamp}`;
        
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error('No se pudo cargar el archivo data.json');
        }
        const newData = await response.json();
        
        // Verificar si los datos cambiaron
        if (lastUpdateTime !== newData.lastUpdate) {
            console.log('Datos actualizados detectados');
            wellsData = newData;
            lastUpdateTime = newData.lastUpdate;
            init();
            showUpdateNotification();
        }
    } catch (error) {
        console.error('Error al cargar los datos:', error);
        document.getElementById('wellsContainer').innerHTML = 
            '<p style="color: #e74c3c; padding: 20px;">Error: No se pudo cargar el archivo data.json. Asegúrate de que el archivo existe en el mismo directorio.</p>';
    }
}

// Mostrar notificación de actualización
function showUpdateNotification() {
    const notification = document.createElement('div');
    notification.className = 'update-notification';
    notification.textContent = '✓ Datos actualizados';
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const options = { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    };
    return date.toLocaleDateString('es-ES', options);
}

function excelDateToJSDate(serial) {
    const utc_days = Math.floor(serial - 25569);
    const utc_value = utc_days * 86400;
    const date_info = new Date(utc_value * 1000);
    
    const fractional_day = serial - Math.floor(serial) + 0.0000001;
    let total_seconds = Math.floor(86400 * fractional_day);
    
    const seconds = total_seconds % 60;
    total_seconds -= seconds;
    
    const hours = Math.floor(total_seconds / (60 * 60));
    const minutes = Math.floor(total_seconds / 60) % 60;
    
    return new Date(date_info.getFullYear(), date_info.getMonth(), date_info.getDate(), hours, minutes, seconds);
}

function formatExcelDate(serial) {
    if (!serial || serial === '') return '-';
    const date = excelDateToJSDate(parseFloat(serial));
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
}

function formatExcelTime(serial) {
    if (!serial || serial === '') return '';
    const date = excelDateToJSDate(parseFloat(serial));
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
}

function getWellLetter(index) {
    return String.fromCharCode(65 + index); // A, B, C, D, E, F
}

function hasWellData(wellIndex) {
    // Verifica si hay datos significativos para este pozo
    const props = [
        `FechaFracPozo${wellIndex}`,
        `TPNPozo${wellIndex}`,
        `SecuenciaPozo${wellIndex}`
    ];
    
    for (let item of wellsData.items) {
        for (let prop of props) {
            if (item[prop] && item[prop] !== '') {
                return true;
            }
        }
    }
    return false;
}

function renderWellCard(wellIndex) {
    const wellNum = wellIndex;
    const letter = getWellLetter(wellIndex - 1);
    
    // Obtener datos del header (primera fila)
    const headerData = wellsData.items[0];
    const wellId = headerData[`FechaFracPozo${wellNum}`] || `Pozo #${wellNum}`;
    const wellType = headerData[`TPNPozo${wellNum}`] || '';
    
    let tableRows = '';
    
    // Procesar filas de datos (desde la tercera fila en adelante)
    for (let i = 2; i < wellsData.items.length; i++) {
        const item = wellsData.items[i];
        const rowNum = item.Fila || '';
        
        const fechaFrac = item[`FechaFracPozo${wellNum}`];
        const secuencia = item[`SecuenciaPozo${wellNum}`];
        const tpn = item[`TPNPozo${wellNum}`];
        
        // Solo mostrar filas con datos
        if (rowNum && (fechaFrac || secuencia || tpn)) {
            const fechaFormatted = formatExcelDate(fechaFrac);
            const horaFormatted = formatExcelTime(secuencia);
            const fracturadoFormatted = formatExcelDate(fechaFrac);
            
            tableRows += `
                <tr>
                    <td class="row-number">${rowNum}</td>
                    <td class="fecha-cell">${fechaFormatted}${horaFormatted ? '<br><span class="hora-cell">' + horaFormatted + '</span>' : ''}</td>
                    <td class="tpn-cell">${tpn || '-'}</td>
                    <td class="fracturado-cell">${fracturadoFormatted}</td>
                </tr>
            `;
        }
    }
    
    return `
        <div class="well-card">
            <div class="well-header">
                ${wellType} ${wellId}
                <span class="well-letter">${letter}</span>
            </div>
            <table class="well-table">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>F/h TPN</th>
                        <th>TPN</th>
                        <th>FRACTURADO</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableRows || '<tr><td colspan="4" style="text-align: center; color: #666;">Sin datos</td></tr>'}
                </tbody>
            </table>
        </div>
    `;
}

function renderWells() {
    const container = document.getElementById('wellsContainer');
    container.innerHTML = '';
    
    // Renderizar solo los pozos que tienen datos
    for (let i = 1; i <= 6; i++) {
        if (hasWellData(i)) {
            container.innerHTML += renderWellCard(i);
        }
    }
}

function renderStock() {
    const stockGrid = document.getElementById('stockGrid');
    stockGrid.innerHTML = '';
    
    wellsData.stock.forEach(item => {
        const card = document.createElement('div');
        card.className = 'stock-card';
        card.innerHTML = `
            <h3>${item.ITEM}</h3>
            <div class="stock-value">${item.STOCK}</div>
        `;
        stockGrid.appendChild(card);
    });
}

function init() {
    if (!wellsData) return;
    
    document.getElementById('lastUpdate').textContent = formatDate(wellsData.lastUpdate);
    renderWells();
    renderStock();
}

// Cargar datos al iniciar
document.addEventListener('DOMContentLoaded', loadData);

// Verificar cambios cada 5 segundos
setInterval(loadData, 5000);
