import { supabase, requireAuth, formatSoles, formatFecha, showToast } from '../js/supabase.js';

const user = await requireAuth();
document.getElementById('userName').textContent = user.user_metadata?.full_name?.split(' ')[0] || user.email;

document.getElementById('btnLogout').addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.replace('/index.html');
});

// ── Fórmula de amortización francesa ──────────────────
// C = P × [r(1+r)^n] / [(1+r)^n - 1]
function calcularCuota(monto, plazoMeses, tasaAnual) {
    const r = (tasaAnual / 100) / 12;    // tasa mensual
    const n = plazoMeses;
    if (r === 0) return monto / n;
    const factor = Math.pow(1 + r, n);
    return monto * (r * factor) / (factor - 1);
}

function actualizar() {
    const monto = parseInt(document.getElementById('sliderMonto').value);
    const plazo = parseInt(document.getElementById('selectPlazo').value);
    const tasa = parseFloat(document.getElementById('selectTasa').value);
    const cuota = calcularCuota(monto, plazo, tasa);
    const total = cuota * plazo;
    const intereses = total - monto;

    document.getElementById('montoLabel').textContent = formatSoles(monto);
    document.getElementById('cuotaValor').textContent = formatSoles(cuota);
    document.getElementById('totalPagar').textContent = formatSoles(total);
    document.getElementById('totalInteres').textContent = formatSoles(intereses);

    // Sincronizar con el formulario
    document.getElementById('solMonto').value = monto.toLocaleString('es-PE');
    document.getElementById('solPlazo').value = `${plazo} meses`;
    document.getElementById('solTasa').value = `${tasa}% TEA`;
    document.getElementById('solCuota').value = cuota.toFixed(2);
}

// Escuchar cambios en el simulador
['sliderMonto', 'selectPlazo', 'selectTasa'].forEach(id => {
    document.getElementById(id).addEventListener('input', actualizar);
});
actualizar(); // cálculo inicial

// ── Enviar solicitud de préstamo ───────────────────────
const modalExito = new bootstrap.Modal(document.getElementById('modalExito'));

document.getElementById('formPrestamo').addEventListener('submit', async (e) => {
    e.preventDefault();

    const proposito = document.getElementById('proposito').value;
    const ingresos = parseFloat(document.getElementById('ingresos').value);
    const monto = parseInt(document.getElementById('sliderMonto').value);
    const plazo = parseInt(document.getElementById('selectPlazo').value);
    const tasa = parseFloat(document.getElementById('selectTasa').value);
    const cuota = calcularCuota(monto, plazo, tasa);

    document.getElementById('btnSolText').classList.add('d-none');
    document.getElementById('btnSolSpinner').classList.remove('d-none');

    const { data, error } = await supabase.from('solicitudes_prestamo').insert({
        user_id: user.id,
        monto,
        plazo_meses: plazo,
        tasa_anual: tasa,
        cuota_mensual: parseFloat(cuota.toFixed(2)),
        proposito,
        estado: 'pendiente'
    }).select().single();

    document.getElementById('btnSolText').classList.remove('d-none');
    document.getElementById('btnSolSpinner').classList.add('d-none');

    if (error) {
        showToast('Error al enviar la solicitud. Intenta nuevamente.', 'danger');
        return;
    }

    // Mostrar modal de éxito con UUID
    document.getElementById('numSolicitud').textContent = data.id.slice(0, 8).toUpperCase();
    document.getElementById('exitoMonto').textContent = formatSoles(monto);
    document.getElementById('exitoCuota').textContent = formatSoles(cuota);
    modalExito.show();
    document.getElementById('formPrestamo').reset();
    actualizar();
    cargarSolicitudes();
});

// ── Historial de solicitudes ───────────────────────────
async function cargarSolicitudes() {
    const { data: sols } = await supabase
        .from('solicitudes_prestamo').select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

    const el = document.getElementById('listaSolicitudes');
    if (!sols || sols.length === 0) {
        el.innerHTML = `<p class="text-muted text-center py-3 small">Sin solicitudes previas.</p>`;
        return;
    }

    const estadoColor = { pendiente: 'warning', aprobado: 'success', rechazado: 'danger' };
    const mostrarSolicitudes = (mostrarTodas = false) => {
        const visibles = mostrarTodas ? sols : sols.slice(0, 5);
        const botonExtra = sols.length > 5
            ? `<div class="text-center mt-2"><button id="btnMostrarTodas" class="btn btn-sm btn-outline-primary">Ver todas (${sols.length})</button></div>`
            : '';

        el.innerHTML = `
          <ul class="list-group list-group-flush">
            ${visibles.map(s => `
              <li class="list-group-item d-flex justify-content-between align-items-center px-3">
                <div>
                  <div class="fw-semibold small">${formatSoles(s.monto)} · ${s.plazo_meses} meses</div>
                  <div class="text-muted" style="font-size:.75rem">
                    ID: ${s.id.slice(0, 8).toUpperCase()} · ${formatFecha(s.created_at)}
                  </div>
                </div>
                <span class="badge bg-${estadoColor[s.estado] || 'secondary'} text-capitalize">
                  ${s.estado}
                </span>
              </li>
            `).join('')}
          </ul>
          ${!mostrarTodas ? botonExtra : ''}
        `;

        if (!mostrarTodas && sols.length > 5) {
            const btn = document.getElementById('btnMostrarTodas');
            btn?.addEventListener('click', () => mostrarSolicitudes(true));
        }
    };

    mostrarSolicitudes(false);
}

cargarSolicitudes();