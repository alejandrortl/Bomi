// js/modules/autocompletar.js — buscador desplegable para los campos Cliente y Obra de los formularios
// (Diario, Partes, Materiales, Bitácora). Script clásico: expone window.BomiAuto.
//
//  - Campo Cliente: busca por nombre de cliente (y también por el nombre de sus obras).
//  - Campo Obra: si hay un cliente elegido, solo ofrece sus obras; si no hay ninguno, busca entre TODAS las obras
//    (por obra, cliente, dirección o localidad). Al elegir una, se rellenan cliente, obra, dirección y localidad.
//  - Funciona por delegación: vale para formularios que se vuelven a pintar. Para pasar los datos al módulo se
//    lanzan eventos "input" en los campos, como si se hubiera escrito (cada módulo ya reacciona a ellos).
(function () {
    'use strict';
    const MAX = 40;
    const registros = [];          // { cliente, obra, fuente() -> [{ nombre, obras: [{ nombre, direccion, localidad }] }] }
    let lista = null;              // contenedor del desplegable (único)
    let activo = null;             // { el, tipo, reg, items, sel }

    const norm = (v) => String(v ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
    const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const coincide = (texto, consulta) => { const h = norm(texto); return norm(consulta).split(' ').filter(Boolean).every((t) => h.includes(t)); };
    const direccionDe = (o) => [o.direccion, o.localidad].map((x) => String(x || '').trim()).filter(Boolean).join(', ');

    // ---------- Resultados ----------
    function sugerencias(reg, tipo, consulta) {
        const clientes = (reg.fuente() || []).filter((c) => c && c.nombre);
        const salida = [];
        if (tipo === 'cliente') {
            for (const c of clientes) {
                const porNombre = coincide(c.nombre, consulta);
                const obra = porNombre ? null : (c.obras || []).find((o) => coincide([o.nombre, o.direccion, o.localidad].join(' '), consulta));
                if (!porNombre && !obra) continue;
                salida.push({ titulo: c.nombre, detalle: obra ? 'Obra: ' + obra.nombre : ((c.obras || []).length + ((c.obras || []).length === 1 ? ' obra' : ' obras')), cliente: c.nombre });
            }
            return salida.sort((a, b) => a.titulo.localeCompare(b.titulo, 'es', { sensitivity: 'base' }));
        }
        // Obra: solo las del cliente elegido; sin cliente elegido, todas.
        const elegido = clientes.find((c) => norm(c.nombre) === norm(document.getElementById(reg.cliente)?.value));
        const origen = elegido ? [elegido] : clientes;
        for (const c of origen) {
            for (const o of (c.obras || [])) {
                if (!o || !o.nombre) continue;
                const texto = elegido ? [o.nombre, o.direccion, o.localidad].join(' ') : [o.nombre, c.nombre, o.direccion, o.localidad].join(' ');
                if (!coincide(texto, consulta)) continue;
                salida.push({ titulo: o.nombre, detalle: [elegido ? '' : c.nombre, direccionDe(o)].filter(Boolean).join(' · '), cliente: c.nombre, obra: o.nombre, direccion: o.direccion || '', localidad: o.localidad || '' });
            }
        }
        return salida.sort((a, b) => a.titulo.localeCompare(b.titulo, 'es', { sensitivity: 'base' }) || a.detalle.localeCompare(b.detalle, 'es', { sensitivity: 'base' }));
    }

    // ---------- Desplegable ----------
    function asegurarLista() {
        if (lista) return lista;
        lista = document.createElement('ul');
        lista.id = 'bomi-auto';
        lista.setAttribute('role', 'listbox');
        lista.className = 'hidden';
        // pointerdown + preventDefault: el campo no pierde el foco al tocar una opción (también en el móvil).
        lista.addEventListener('pointerdown', (e) => {
            const li = e.target.closest('li[data-i]');
            e.preventDefault();
            if (li && activo) elegir(Number(li.dataset.i));
        });
        document.body.appendChild(lista);
        return lista;
    }

    function colocar() {
        if (!activo || !lista) return;
        const r = activo.el.getBoundingClientRect();
        const abajo = window.innerHeight - r.bottom, arriba = r.top;
        const alto = Math.min(256, Math.max(abajo, arriba) - 12);
        const bajar = abajo >= 140 || abajo >= arriba;
        lista.style.left = Math.max(8, r.left) + 'px';
        lista.style.width = Math.min(r.width, window.innerWidth - 16) + 'px';
        lista.style.maxHeight = Math.max(96, alto) + 'px';
        if (bajar) { lista.style.top = r.bottom + 4 + 'px'; lista.style.bottom = ''; }
        else { lista.style.bottom = window.innerHeight - r.top + 4 + 'px'; lista.style.top = ''; }
    }

    function pintar() {
        const ul = asegurarLista();
        if (!activo || !activo.items.length) { cerrar(); return; }
        ul.className = 'fixed z-[95] overflow-y-auto bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 rounded-2xl shadow-2xl py-1';
        ul.innerHTML = activo.items.map((it, i) => `
            <li data-i="${i}" role="option" class="px-3 py-2 cursor-pointer text-sm ${i === activo.sel ? 'bg-blue-100 dark:bg-blue-950' : 'hover:bg-slate-100 dark:hover:bg-zinc-800'}">
                <span class="block font-medium break-words">${esc(it.titulo)}</span>
                ${it.detalle ? `<span class="block text-xs text-slate-500 dark:text-slate-400 break-words">${esc(it.detalle)}</span>` : ''}
            </li>`).join('');
        colocar();
        const s = ul.querySelector('li[data-i="' + activo.sel + '"]');
        if (s) s.scrollIntoView({ block: 'nearest' });
    }

    function cerrar() {
        activo = null;
        if (lista) { lista.className = 'hidden'; lista.innerHTML = ''; }
    }

    function buscar(el, tipo, reg) {
        const items = sugerencias(reg, tipo, el.value).slice(0, MAX);
        activo = { el, tipo, reg, items, sel: -1 };
        pintar();
    }

    let ignorar = false;
    function lanzar(el) { ignorar = true; try { el.dispatchEvent(new Event('input', { bubbles: true })); } finally { ignorar = false; } }

    function elegir(i) {
        if (!activo) return;
        const { el, tipo, reg, items } = activo;
        const it = items[i];
        if (!it) return;
        const cli = document.getElementById(reg.cliente), obra = document.getElementById(reg.obra);
        cerrar();
        if (tipo === 'cliente') {
            cli.value = it.cliente;
            lanzar(cli);
            if (obra) obra.focus();
        } else {
            // Primero el cliente (así se distingue entre obras que se llaman igual) y después la obra: el módulo
            // rellena dirección y localidad con los datos guardados.
            if (cli && norm(cli.value) !== norm(it.cliente)) { cli.value = it.cliente; lanzar(cli); }
            obra.value = it.obra;
            lanzar(obra);
        }
    }

    // ---------- Eventos (delegados en el documento) ----------
    function registroDe(el) {
        if (!el || !el.id) return null;
        for (const r of registros) {
            if (el.id === r.cliente) return { reg: r, tipo: 'cliente' };
            if (el.id === r.obra) return { reg: r, tipo: 'obra' };
        }
        return null;
    }

    function enlazar() {
        // Los buscadores propios sustituyen a la lista nativa del navegador (que no distingue clientes y se ve mal en el móvil).
        document.addEventListener('input', (e) => {
            const d = registroDe(e.target);
            if (!d) return;
            if (e.target.hasAttribute('list')) e.target.removeAttribute('list');
            if (ignorar) return;   // los cambios hechos al elegir una opción no vuelven a abrir la lista
            buscar(e.target, d.tipo, d.reg);
        });
        // Al tocar el campo se abre la lista con todas las opciones (no al enfocarlo por código al abrir el formulario).
        document.addEventListener('click', (e) => {
            const d = registroDe(e.target);
            if (!d) return;
            if (e.target.hasAttribute('list')) e.target.removeAttribute('list');
            buscar(e.target, d.tipo, d.reg);
        });
        document.addEventListener('pointerdown', (e) => {
            if ((lista && lista.contains(e.target)) || registroDe(e.target)) return;
            cerrar();
        }, true);
        document.addEventListener('focusout', (e) => { if (activo && e.target === activo.el) setTimeout(() => { if (activo && document.activeElement !== activo.el) cerrar(); }, 120); });
        document.addEventListener('keydown', (e) => {
            if (!activo) return;
            if (e.key === 'Escape') { cerrar(); return; }
            if (e.key === 'ArrowDown') { e.preventDefault(); activo.sel = Math.min(activo.items.length - 1, activo.sel + 1); pintar(); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); activo.sel = Math.max(0, activo.sel - 1); pintar(); }
            else if (e.key === 'Enter' && activo.sel >= 0) { e.preventDefault(); elegir(activo.sel); }
        }, true);
        window.addEventListener('resize', () => { if (activo) colocar(); });
        document.addEventListener('scroll', (e) => { if (activo && !(lista && lista.contains(e.target))) cerrar(); }, true);
    }

    // reg: { cliente: 'id-del-campo-cliente', obra: 'id-del-campo-obra', fuente: () => [{ nombre, obras: [{ nombre, direccion, localidad }] }] }
    function registrar(reg) { registros.push(reg); }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', enlazar); else enlazar();
    window.BomiAuto = { registrar, sugerencias };
})();
