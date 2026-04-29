class AppGestionVentas {
    constructor() {
        this.data = {
            caja: [],
            ventas: [],
            ventasEliminadas: [], // 🆕 NUEVA PROPIEDAD
            stats: {
                balance: 0,
                todaySales: 0,
                todayClients: 0,
                productsSold: 0,
                lastUpdate: new Date().toISOString()
            }
        };
        this.selectedEliminadas = new Set();
        this.init();
    }

    init() {
        this.loadData();
        this.updateAll();
        this.bindEvents();
        console.log('✅ Sistema de Gestión iniciado (con ventas eliminadas)');
    }

    // 🆕 MÉTODOS PARA VENTAS ELIMINADAS
    updateEliminadasTable() {
        const tbody = document.getElementById('eliminadas-table');
        const countEl = document.getElementById('eliminadas-count');
        const totalEl = document.getElementById('eliminadas-total');
        
        if (!tbody) return;

        const filter = document.getElementById('filter-eliminadas')?.value || 'all';
        const search = document.getElementById('search-eliminadas')?.value.toLowerCase() || '';

        let filtered = this.data.ventasEliminadas;

        // Filtros
        if (filter === 'today') {
            filtered = filtered.filter(v => v.fechaEliminacion === this.getToday());
        } else if (filter === 'week') {
            filtered = filtered.filter(v => this.isThisWeek(v.fechaEliminacion));
        } else if (filter === 'month') {
            filtered = filtered.filter(v => this.isThisMonth(v.fechaEliminacion));
        }

        // Búsqueda
        filtered = filtered.filter(v => 
            v.cliente.toLowerCase().includes(search) || 
            v.id.toLowerCase().includes(search)
        );

        let totalImpacto = 0;
        tbody.innerHTML = '';

        filtered.forEach(venta => {
            totalImpacto += Math.abs(venta.total);
            const row = this.createEliminadaRow(venta);
            tbody.appendChild(row);
        });

        if (countEl) countEl.textContent = filtered.length;
        if (totalEl) totalEl.textContent = this.formatCurrency(totalImpacto);
    }

    createEliminadaRow(venta) {
        const row = document.createElement('tr');
        row.className = 'eliminada-row';
        row.dataset.id = venta.id;
        row.innerHTML = `
            <td>
                <input type="checkbox" class="row-checkbox" onchange="app.toggleEliminada('${venta.id}')" 
                       ${this.selectedEliminadas.has(venta.id) ? 'checked' : ''}>
            </td>
            <td><strong style="color: var(--danger);">${venta.id}</strong></td>
            <td>${venta.fechaEliminacion}</td>
            <td>${venta.fecha}</td>
            <td>${venta.cliente}</td>
            <td>${venta.productos}</td>
            <td class="negative">${this.formatCurrency(venta.total)}</td>
            <td><span class="badge warning">${venta.motivo}</span></td>
            <td>
                <button class="btn-icon" onclick="app.recuperarVenta('${venta.id}')" title="Recuperar">
                    <i class="fas fa-undo"></i>
                </button>
                <button class="btn-icon" onclick="app.verEliminada('${venta.id}')" title="Detalles">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="btn-icon danger-icon" onclick="app.permanecerEliminada('${venta.id}')" title="Eliminar permanentemente">
                    <i class="fas fa-times"></i>
                </button>
            </td>
        `;
        return row;
    }

    // 🆕 ACCIONES VENTAS ELIMINADAS
    eliminarVenta(id) {
        const ventaIndex = this.data.ventas.findIndex(v => v.id === id);
        if (ventaIndex === -1) return;

        const venta = this.data.ventas[ventaIndex];
        const motivo = prompt('Motivo de eliminación:', 'Error en registro');
        
        if (motivo) {
            // Mover a eliminadas
            this.data.ventasEliminadas.unshift({
                ...venta,
                fechaEliminacion: this.getToday(),
                horaEliminacion: new Date().toLocaleTimeString('es-ES'),
                motivo: motivo.substring(0, 50)
            });

            // Actualizar stats (restar)
            this.data.stats.todaySales -= venta.total;
            this.data.stats.todayClients--;
            this.data.stats.productsSold -= venta.productos;
            this.data.stats.balance -= venta.total;

            // Remover de ventas activas
            this.data.ventas.splice(ventaIndex, 1);

            this.saveData();
            this.updateAll();
            
            // Registrar salida en caja
            this.registrarMovimiento('salida', `Anulación venta #${venta.id}`, -venta.total);
            
            alert(`🗑️ Venta #${id} movida a eliminadas\nMotivo: ${motivo}`);
        }
    }

    recuperarVenta(id) {
        const eliminadaIndex = this.data.ventasEliminadas.findIndex(v => v.id === id);
        if (eliminadaIndex === -1) return;

        const venta = this.data.ventasEliminadas[eliminadaIndex];

        if (confirm(`¿Recuperar venta #${id}?\nCliente: ${venta.cliente}\nTotal: ${this.formatCurrency(venta.total)}`)) {
            // Restaurar a ventas
            delete venta.fechaEliminacion;
            delete venta.horaEliminacion;
            delete venta.motivo;
            this.data.ventas.unshift(venta);

            // Actualizar stats
            this.data.stats.todaySales += venta.total;
            this.data.stats.todayClients++;
            this.data.stats.productsSold += venta.productos;
            this.data.stats.balance += venta.total;

            // Remover de eliminadas
            this.data.ventasEliminadas.splice(eliminadaIndex, 1);

            // Registrar entrada en caja
            this.registrarMovimiento('entrada', `Recuperación venta #${venta.id}`, venta.total);

            this.saveData();
            this.updateAll();
            alert(`✅ Venta #${id} recuperada exitosamente`);
        }
    }

    toggleEliminada(id) {
        const checkbox = event.target;
        if (checkbox.checked) {
            this.selectedEliminadas.add(id);
        } else {
            this.selectedEliminadas.delete(id);
        }
    }

    toggleAllEliminadas() {
        const selectAll = document.getElementById('select-all-eliminadas');
        document.querySelectorAll('.row-checkbox').forEach(cb => {
            cb.checked = selectAll.checked;
            if (selectAll.checked) {
                this.selectedEliminadas.add(cb.closest('tr').dataset.id);
            } else {
                this.selectedEliminadas.delete(cb.closest('tr').dataset.id);
            }
        });
    }

    recuperarSeleccionadas() {
        if (this.selectedEliminadas.size === 0) {
            alert('⚠️ Selecciona al menos una venta');
            return;
        }

        const ids = Array.from(this.selectedEliminadas);
        if (confirm(`¿Recuperar ${ids.length} ventas seleccionadas?`)) {
            ids.forEach(id => this.recuperarVenta(id));
            this.selectedEliminadas.clear();
            document.getElementById('select-all-eliminadas').checked = false;
        }
    }

    limpiarEliminadas() {
        if (confirm(`¿Eliminar permanentemente ${this.data.ventasEliminadas.length} ventas?\nEsta acción no se puede deshacer.`)) {
            this.data.ventasEliminadas = [];
            this.saveData();
            this.updateEliminadasTable();
            alert('🧹 Todas las ventas eliminadas borradas permanentemente');
        }
    }

    permanecerEliminada(id) {
        const index = this.data.ventasEliminadas.findIndex(v => v.id === id);
        if (index > -1) {
            this.data.ventasEliminadas.splice(index, 1);
            this.saveData();
            this.updateEliminadasTable();
            alert(`🗑️ Venta #${id} eliminada permanentemente`);
        }
    }

    verEliminada(id) {
        const venta = this.data.ventasEliminadas.find(v => v.id === id);
        if (venta) {
            alert(`👁️ VENTA ELIMINADA #${venta.id}\n\n` +
                  `Cliente: ${venta.cliente}\n` +
                  `Fecha original: ${venta.fecha}\n` +
                  `Eliminada: ${venta.fechaEliminacion} ${venta.horaEliminacion}\n` +
                  `Total: ${this.formatCurrency(venta.total)}\n` +
                  `Motivo: ${venta.motivo}\n\n` +
                  `📊 Items: ${venta.productos}`);
        }
    }

    exportarEliminadas() {
        const dataStr = JSON.stringify(this.data.ventasEliminadas, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `ventas-eliminadas-${this.getToday()}.json`;
        link.click();
        alert('📥 Archivo exportado: ventas-eliminadas.json');
    }

    // 🆕 MODALES
    mostrarModal(titulo, mensaje, callback) {
        document.getElementById('modal-title').textContent = titulo;
        document.getElementById('modal-body').innerHTML = mensaje;
        document.getElementById('modal-confirm-btn').onclick = callback;
        document.getElementById('confirm-modal').classList.add('active');
    }

    cerrarModal() {
        document.getElementById('confirm-modal').classList.remove('active');
    }

    // MÉTODOS ORIGINALES (sin cambios)
    updateVentasTable() {
        // ... (mantener igual que antes)
        const tbody = document.getElementById('ventas-table');
        if (tbody) {
            // Código existente de ventas...
            // AGREGAR BOTÓN ELIMINAR
            // En createVentaRow agregar:
            // <button class="btn-icon danger-icon" onclick="app.eliminarVenta('${venta.id}')" title="Eliminar">
            //     <i class="fas fa-trash"></i>
            // </button>
        }
    }

    // Resto de métodos sin cambios...
    // (addEntrada, addSalida, nuevaVenta, etc. permanecen iguales)
}

// Inicializar
const app = new AppGestionVentas();