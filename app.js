class AppGestionVentas {
    constructor() {
        this.data = {
            caja: [],
            ventas: [],
            ventasEliminadas: [],
            cuentasPorCobrar: [], // 🆕 CUENTAS POR COBRAR
            stats: {
                balance: 0,
                todaySales: 0,
                todayClients: 0,
                productsSold: 0,
                lastUpdate: new Date().toISOString()
            }
        };
        this.selectedCuentas = new Set();
        this.selectedEliminadas = new Set();
        this.init();
    }

    // 🆕 MÉTODOS CUENTAS POR COBRAR
    updateCuentasTable() {
        const tbody = document.getElementById('cuentas-table');
        if (!tbody) return;

        const filterEstado = document.getElementById('filter-estado')?.value || 'all';
        const filterFecha = document.getElementById('filter-fecha')?.value || '';
        const search = document.getElementById('search-cuentas')?.value.toLowerCase() || '';
        const orden = document.getElementById('filter-orden')?.value || 'fecha';

        let filtered = [...this.data.cuentasPorCobrar];

        // Filtros
        if (filterEstado !== 'all') {
            filtered = filtered.filter(c => c.estado === filterEstado);
        }
        if (filterFecha) {
            filtered = filtered.filter(c => c.fecha.includes(filterFecha));
        }
        if (search) {
            filtered = filtered.filter(c => 
                c.cliente.toLowerCase().includes(search) || 
                c.id.toLowerCase().includes(search)
            );
        }

        // Ordenar
        filtered.sort((a, b) => {
            if (orden === 'monto') return b.saldo - a.saldo;
            if (orden === 'dias') return b.diasPendientes - a.diasPendientes;
            return new Date(b.fecha) - new Date(a.fecha);
        });

        // Calcular totales por estado
        const stats = { pendiente: 0, parcial: 0, pagada: 0, counts: { pendiente: 0, parcial: 0, pagada: 0 } };
        let totalPendiente = 0, totalCuentas = 0, diasPromedio = 0;

        filtered.forEach(cuenta => {
            stats.counts[cuenta.estado]++;
            stats[cuenta.estado] += cuenta.saldo;
            totalPendiente += cuenta.saldo;
            totalCuentas++;
            diasPromedio += cuenta.diasPendientes;
        });

        diasPromedio = totalCuentas ? Math.round(diasPromedio / totalCuentas) : 0;

        // Actualizar dashboard
        document.getElementById('total-cuentas').textContent = this.formatCurrency(totalPendiente);
        document.getElementById('cuentas-count').textContent = totalCuentas;
        document.getElementById('dias-promedio').textContent = diasPromedio;

        // Status cards
        ['pendiente', 'parcial', 'pagada'].forEach(estado => {
            document.getElementById(`${estado}s-count`).textContent = stats.counts[estado];
            document.getElementById(`${estado}s-total`).textContent = this.formatCurrency(stats[estado]);
        });

        // Tabla
        tbody.innerHTML = '';
        filtered.forEach(cuenta => {
            const row = this.createCuentaRow(cuenta);
            tbody.appendChild(row);
        });
    }

    createCuentaRow(cuenta) {
        const row = document.createElement('tr');
        row.className = `cuenta-row ${cuenta.estado}`;
        row.dataset.id = cuenta.id;
        row.innerHTML = `
            <td>
                <input type="checkbox" class="row-checkbox" onchange="app.toggleCuenta('${cuenta.id}')"
                       ${this.selectedCuentas.has(cuenta.id) ? 'checked' : ''}>
            </td>
            <td><strong>#${cuenta.id}</strong></td>
            <td>
                <div class="cliente-info">
                    <strong>${cuenta.cliente}</strong>
                    <small>${cuenta.telefono || 'Sin teléfono'}</small>
                </div>
            </td>
            <td>${cuenta.fecha}</td>
            <td>
                <span class="dias-badge ${cuenta.diasPendientes > 30 ? 'warning' : ''}">
                    ${cuenta.diasPendientes} días
                </span>
            </td>
            <td class="positive">${this.formatCurrency(cuenta.montoOriginal)}</td>
            <td class="success">${this.formatCurrency(cuenta.abonado)}</td>
            <td class="${cuenta.saldo > 0 ? 'warning' : 'success'}">${this.formatCurrency(cuenta.saldo)}</td>
            <td><span class="badge ${cuenta.estado}">${cuenta.estado.toUpperCase()}</span></td>
            <td>
                <button class="btn-icon" onclick="app.abonarCuenta('${cuenta.id}')" title="Abonar">
                    <i class="fas fa-coins"></i>
                </button>
                <button class="btn-icon" onclick="app.verCuenta('${cuenta.id}')" title="Detalles">
                    <i class="fas fa-eye"></i>
                </button>
                ${cuenta.saldo === 0 ? '' : `
                <button class="btn-icon danger-icon" onclick="app.marcarImpaga('${cuenta.id}')" title="Marcar impaga">
                    <i class="fas fa-exclamation-triangle"></i>
                </button>
                `}
            </td>
        `;
        return row;
    }

    // 🆕 ACCIONES CUENTAS
    nuevaCuenta() {
        const cliente = prompt('👤 Nombre del cliente:', 'Cliente fiado') || 'Cliente fiado';
        const telefono = prompt('📱 Teléfono (opcional):', '');
        const monto = parseFloat(prompt('💰 Monto total:', '500')) || 0;
        const dias = parseInt(prompt('📅 Días de plazo:', '30')) || 30;

        if (monto > 0) {
            const cuentaId = 'CC' + Date.now().toString().slice(-6);
            const cuenta = {
                id: cuentaId,
                cliente,
                telefono: telefono || '',
                fecha: this.getToday(),
                montoOriginal: monto,
                abonado: 0,
                saldo: monto,
                estado: 'pendiente',
                diasPlazo: dias,
                diasPendientes: 0,
                pagos: []
            };

            this.data.cuentasPorCobrar.unshift(cuenta);
            // NO afecta caja (es fiado)
            
            this.saveData();
            this.updateCuentasTable();
            alert(`✅ Cuenta #${cuentaId} creada por ${this.formatCurrency(monto)}\nCliente: ${cliente}`);
        }
    }

    abonarCuenta(id) {
        const cuenta = this.data.cuentasPorCobrar.find(c => c.id === id);
        if (!cuenta || cuenta.saldo <= 0) return;

        const abono = parseFloat(prompt(`Abono para ${cuenta.cliente}\nSaldo actual: ${this.formatCurrency(cuenta.saldo)}`, '100')) || 0;
        
        if (abono > 0 && abono <= cuenta.saldo) {
            const pago = {
                fecha: this.getToday(),
                hora: new Date().toLocaleTimeString('es-ES'),
                monto: abono
            };

            cuenta.pagos.push(pago);
            cuenta.abonado += abono;
            cuenta.saldo -= abono;
            
            // Registrar entrada en caja
            this.registrarMovimiento('entrada', `Abono cuenta #${cuenta.id}`, abono);

            // Actualizar estado
            if (cuenta.saldo === 0) {
                cuenta.estado = 'pagada';
                cuenta.diasPendientes = this.calcularDiasPendientes(cuenta.fecha);
            } else {
                cuenta.estado = 'parcial';
            }

            this.saveData();
            this.updateAll();
            alert(`💰 Abono de ${this.formatCurrency(abono)} registrado\nNuevo saldo: ${this.formatCurrency(cuenta.saldo)}`);
        }
    }

    abonarSeleccionadas() {
        if (this.selectedCuentas.size === 0) {
            alert('⚠️ Selecciona al menos una cuenta');
            return;
        }
        alert(`💰 Abonar ${this.selectedCuentas.size} cuentas seleccionadas\n(Usa abonar individual por ahora)`);
    }

    toggleCuenta(id) {
        const checkbox = event.target;
        if (checkbox.checked) {
            this.selectedCuentas.add(id);
        } else {
            this.selectedCuentas.delete(id);
        }
    }

    toggleAllCuentas() {
        const selectAll = document.getElementById('select-all-cuentas');
        document.querySelectorAll('#cuentas-table .row-checkbox').forEach(cb => {
            cb.checked = selectAll.checked;
            if (selectAll.checked) {
                this.selectedCuentas.add(cb.closest('tr').dataset.id);
            } else {
                this.selectedCuentas.delete(cb.closest('tr').dataset.id);
            }
        });
    }

    verCuenta(id) {
        const cuenta = this.data.cuentasPorCobrar.find(c => c.id === id);
        if (cuenta) {
            let pagosInfo = cuenta.pagos.map(p => `${p.fecha} ${p.hora}: ${this.formatCurrency(p.monto)}`).join('\n');
            if (!pagosInfo) pagosInfo = 'Sin pagos';
            
            alert(`📋 DETALLES CUENTA #${cuenta.id}\n\n` +
                  `Cliente: ${cuenta.cliente}\n` +
                  `Teléfono: ${cuenta.telefono || 'N/A'}\n` +
                  `Fecha: ${cuenta.fecha}\n` +
                  `Días pendientes: ${cuenta.diasPendientes}\n\n` +
                  `💰 MONTO ORIGINAL: ${this.formatCurrency(cuenta.montoOriginal)}\n` +
                  `💵 ABONADO: ${this.formatCurrency(cuenta.abonado)}\n` +
                  `📊 SALDO: ${this.formatCurrency(cuenta.saldo)}\n` +
                  `Estado: ${cuenta.estado.toUpperCase()}\n\n` +
                  `📄 PAGOS:\n${pagosInfo}`);
        }
    }

    marcarImpaga(id) {
        const cuenta = this.data.cuentasPorCobrar.find(c => c.id === id);
        if (cuenta && confirm(`¿Marcar como impaga?\nSe revertirán pagos de #${cuenta.id}`)) {
            cuenta.abonado = 0;
            cuenta.saldo = cuenta.montoOriginal;
            cuenta.estado = 'pendiente';
            cuenta.pagos = [];
            this.saveData();
            this.updateCuentasTable();
            alert('⚠️ Cuenta marcada como impaga');
        }
    }

    eliminarCuentas() {
        if (this.selectedCuentas.size === 0) return alert('Selecciona cuentas');
        if (confirm(`Eliminar ${this.selectedCuentas.size} cuentas permanentemente?`)) {
            this.data.cuentasPorCobrar = this.data.cuentasPorCobrar.filter(c => 
                !this.selectedCuentas.has(c.id)
            );
            this.selectedCuentas.clear();
            this.saveData();
            this.updateCuentasTable();
        }
    }

    exportarCuentas() {
        const dataStr = JSON.stringify(this.data.cuentasPorCobrar, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `cuentas-cobrar-${this.getToday()}.json`;
        link.click();
    }

    enviarRecordatorios() {
        const pendientes = this.data.cuentasPorCobrar.filter(c => c.estado === 'pendiente');
        alert(`📧 Enviando recordatorios a ${pendientes.length} clientes pendientes...\n(Integración WhatsApp/SMS pendiente)`);
    }

    calcularDiasPendientes(fecha) {
        const hoy = new Date();
        const fechaCuenta = new Date(fecha.split('/').reverse().join('-'));
        return Math.floor((hoy - fechaCuenta) / (1000 * 60 * 60 * 24));
    }

    // UTILIDADES
    getToday() {
        return new Date().toLocaleDateString('es-ES');
    }

    // ... resto de métodos existentes (sin cambios)
}

// Inicializar
const app = new AppGestionVentas();