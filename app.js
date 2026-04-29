class AppGestionVentas {
    constructor() {
        this.data = {
            caja: [],
            ventas: [],
            stats: {
                balance: 0,
                todaySales: 0,
                todayClients: 0,
                productsSold: 0,
                lastUpdate: new Date().toISOString()
            }
        };
        this.init();
    }

    init() {
        this.loadData();
        this.updateAll();
        this.bindEvents();
        console.log('✅ Sistema de Gestión iniciado');
    }

    loadData() {
        try {
            const saved = localStorage.getItem('gestionVentasPro');
            if (saved) {
                this.data = JSON.parse(saved);
                console.log('📊 Datos cargados:', this.data.stats);
            }
        } catch (e) {
            console.error('Error cargando datos:', e);
        }
    }

    saveData() {
        try {
            localStorage.setItem('gestionVentasPro', JSON.stringify(this.data));
        } catch (e) {
            console.error('Error guardando datos:', e);
        }
    }

    bindEvents() {
        // Filtros de ventas
        const filterVentas = document.getElementById('filter-ventas');
        const searchVentas = document.getElementById('search-ventas');
        
        if (filterVentas) filterVentas.addEventListener('change', () => this.updateVentasTable());
        if (searchVentas) searchVentas.addEventListener('input', () => this.updateVentasTable());
    }

    // 🔄 ACTUALIZACIONES AUTOMÁTICAS
    updateAll() {
        this.updateDashboard();
        this.updateCaja();
        this.updateVentas();
        this.autoSave();
    }

    updateDashboard() {
        const stats = this.data.stats;
        
        // Actualizar métricas
        const elements = {
            'total-balance': stats.balance,
            'today-sales': stats.todaySales,
            'current-balance': stats.balance,
            'today-clients': stats.todayClients,
            'products-sold': stats.productsSold
        };

        Object.entries(elements).forEach(([id, value]) => {
            const el = document.getElementById(id);
            if (el) {
                el.textContent = typeof value === 'number' 
                    ? this.formatCurrency(value) 
                    : value.toLocaleString();
            }
        });

        // Progreso semanal
        const weeklyProgress = Math.min((stats.todaySales * 7 / 25000) * 100, 100);
        const weeklyEl = document.getElementById('weekly-progress');
        const weeklyText = document.getElementById('weekly-text');
        
        if (weeklyEl) weeklyEl.style.width = weeklyProgress + '%';
        if (weeklyText) weeklyText.textContent = `${this.formatCurrency(stats.todaySales * 7)} / $25,000`;
    }

    updateCaja() {
        const tbody = document.getElementById('caja-movimientos');
        const totalEl = document.getElementById('caja-total');
        const countEl = document.getElementById('total-movimientos');

        if (!tbody) return;

        tbody.innerHTML = '';
        const movimientos = this.data.caja.slice(-10); // Últimos 10

        movimientos.forEach(mov => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${mov.hora}</td>
                <td><span class="badge ${mov.tipo === 'entrada' ? 'success' : 'danger'}">${mov.tipo.toUpperCase()}</span></td>
                <td>${mov.descripcion}</td>
                <td class="${mov.monto >= 0 ? 'positive' : 'negative'}">
                    ${mov.monto >= 0 ? '+' : ''}${this.formatCurrency(mov.monto)}
                </td>
                <td>${this.formatCurrency(mov.saldo)}</td>
            `;
            tbody.appendChild(row);
        });

        if (totalEl) totalEl.textContent = this.formatCurrency(this.data.stats.balance);
        if (countEl) countEl.textContent = `${this.data.caja.length} movimientos`;
    }

    updateVentasTable() {
        const tbody = document.getElementById('ventas-table');
        const countEl = document.getElementById('ventas-count');
        if (!tbody) return;

        const filter = document.getElementById('filter-ventas')?.value || 'all';
        const search = document.getElementById('search-ventas')?.value.toLowerCase() || '';

        let filtered = this.data.ventas;

        // Filtros
        if (filter === 'today') {
            filtered = filtered.filter(v => v.fecha === this.getToday());
        } else if (filter === 'week') {
            filtered = filtered.filter(v => this.isThisWeek(v.fecha));
        } else if (filter === 'month') {
            filtered = filtered.filter(v => this.isThisMonth(v.fecha));
        }

        // Búsqueda
        filtered = filtered.filter(v => 
            v.cliente.toLowerCase().includes(search) || 
            v.id.toLowerCase().includes(search)
        );

        tbody.innerHTML = '';
        filtered.forEach(venta => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><strong>${venta.id}</strong></td>
                <td>${venta.fecha}</td>
                <td>${venta.cliente}</td>
                <td>${venta.productos}</td>
                <td class="positive">${this.formatCurrency(venta.total)}</td>
                <td><span class="badge success">${venta.estado}</span></td>
                <td>
                    <button class="btn-icon" onclick="app.verVenta('${venta.id}')" title="Ver">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn-icon" onclick="app.imprimirVenta('${venta.id}')" title="Imprimir">
                        <i class="fas fa-print"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });

        if (countEl) countEl.textContent = `${filtered.length} ventas encontradas`;
    }

    // 💰 CAJA DIARIA
    addEntrada() {
        const monto = parseFloat(prompt('💰 Monto de entrada:', '100'));
        const desc = prompt('📝 Descripción:', 'Venta en efectivo');
        
        if (monto && !isNaN(monto) && monto > 0) {
            this.registrarMovimiento('entrada', desc || 'Entrada', monto);
            alert(`✅ Entrada de ${this.formatCurrency(monto)} registrada`);
        }
    }

    addSalida() {
        const monto = parseFloat(prompt('💸 Monto de salida:', '50'));
        const desc = prompt('📝 Descripción:', 'Compra de insumos');
        
        if (monto && !isNaN(monto) && monto > 0) {
            this.registrarMovimiento('salida', desc || 'Salida', -monto);
            alert(`✅ Salida de ${this.formatCurrency(monto)} registrada`);
        }
    }

    registrarMovimiento(tipo, descripcion, monto) {
        const hora = new Date().toLocaleTimeString('es-ES', {hour: '2-digit', minute: '2-digit'});
        const saldoAnterior = this.data.stats.balance;
        const saldoNuevo = saldoAnterior + monto;

        this.data.caja.unshift({
            hora, tipo, descripcion, monto, saldo: saldoNuevo
        });

        this.data.stats.balance = saldoNuevo;
        if (tipo === 'entrada') {
            this.data.stats.todaySales += monto;
        }

        this.saveData();
        this.updateAll();
    }

    cerrarCaja() {
        if (confirm(`🔒 ¿Cerrar caja?\nSaldo final: ${this.formatCurrency(this.data.stats.balance)}`)) {
            this.data.caja = [];
            this.data.stats.lastUpdate = new Date().toISOString();
            this.saveData();
            alert('✅ Caja cerrada correctamente');
            this.updateCaja();
        }
    }

    // 🛒 VENTAS
    nuevaVenta() {
        const cliente = prompt('👤 Nombre del cliente:', 'Cliente walk-in') || 'Cliente walk-in';
        const total = parseFloat(prompt('💰 Total de la venta:', '250')) || 0;
        const items = parseInt(prompt('📦 Número de productos:', '3')) || 3;

        if (total > 0) {
            const ventaId = 'V' + Date.now().toString().slice(-6);
            const venta = {
                id: ventaId,
                fecha: this.getToday(),
                cliente,
                productos: items,
                total,
                estado: 'completada'
            };

            this.data.ventas.unshift(venta);
            this.data.stats.balance += total;
            this.data.stats.todaySales += total;
            this.data.stats.todayClients++;
            this.data.stats.productsSold += items;

            // Registrar en caja automáticamente
            this.registrarMovimiento('entrada', `Venta #${ventaId}`, total);

            this.saveData();
            this.updateVentasTable();
            alert(`🎉 Venta #${ventaId} registrada!\nCliente: ${cliente}\nTotal: ${this.formatCurrency(total)}`);
        }
    }

    verVenta(id) {
        const venta = this.data.ventas.find(v => v.id === id);
        if (venta) {
            alert(`👁️ DETALLES VENTA #${venta.id}\n\nCliente: ${venta.cliente}\nFecha: ${venta.fecha}\nItems: ${venta.productos}\nTotal: ${this.formatCurrency(venta.total)}\nEstado: ${venta.estado}`);
        }
    }

    imprimirVenta(id) {
        const venta = this.data.ventas.find(v => v.id === id);
        if (venta) {
            alert(`🖨️ Imprimiendo ticket #${venta.id}...\n\n${JSON.stringify(venta, null, 2)}`);
            // Aquí iría la integración con impresora
        }
    }

    // 📅 UTILIDADES DE FECHA
    getToday() {
        return new Date().toLocaleDateString('es-ES');
    }

    isThisWeek(fecha) {
        const today = new Date();
        const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        return new Date(fecha.split('/').reverse().join('-')) >= weekAgo;
    }

    isThisMonth(fecha) {
        const today = new Date();
        const monthAgo = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
        return new Date(fecha.split('/').reverse().join('-')) >= monthAgo;
    }

    formatCurrency(monto) {
        return new Intl.NumberFormat('es-ES', {
            style: 'currency',
            currency: 'EUR',
            minimumFractionDigits: 2
        }).format(monto);
    }

    // 💾 AUTOSAVE
    autoSave() {
        this.saveData();
    }
}

// 🚀 INICIALIZAR APP
const app = new AppGestionVentas();

// Actualizar cada 2 segundos
setInterval(() => {
    app.updateAll();
}, 2000);

// Cargar datos al cambiar pestañas
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        app.loadData();
        app.updateAll();
    }
});