// js/modules/clientes.js
export function initClientesModule(supabaseClient) {
    const viewClientes = document.getElementById('view-clientes');
    const navClientes = document.getElementById('nav-clientes');
    const clientesContainer = document.getElementById('clientes-container');
    const clientesCount = document.getElementById('clientes-count');
    const searchClientesInput = document.getElementById('search-clientes');
    const fabNewCliente = document.getElementById('fab-new-cliente');
    
    // Modal de Cliente / Obra
    const modalCliente = document.getElementById('modal-cliente');
    const formCliente = document.getElementById('form-cliente');
    const modalClienteTitle = document.getElementById('modal-cliente-title');
    const editClienteId = document.getElementById('edit-cliente-id');
    const cliNombre = document.getElementById('cli-nombre');
    const cliObra = document.getElementById('cli-obra');
    const cliDireccion = document.getElementById('cli-direccion');
    const cliLocalidad = document.getElementById('cli-localidad');
    const cliTelefono = document.getElementById('cli-telefono');
    const cliEmail = document.getElementById('cli-email');
    const btnCloseModalCliente = document.getElementById('btn-close-modal-cliente');
    const btnCancelModalCliente = document.getElementById('btn-cancel-modal-cliente');

    let allClientes = [];

    if (navClientes) {
        navClientes.addEventListener('click', () => {
            window.hideAllViews?.();
            viewClientes.classList.remove('hidden');
            viewClientes.classList.add('flex');
            navClientes.classList.add('text-primary');
            loadClientes();
        });
    }

    if (fabNewCliente) {
        fabNewCliente.addEventListener('click', () => {
            modalClienteTitle.textContent = "Nuevo Cliente / Obra";
            formCliente.reset();
            editClienteId.value = "";
            modalCliente.classList.remove('hidden');
        });
    }

    if (btnCloseModalCliente) btnCloseModalCliente.addEventListener('click', () => modalCliente.classList.add('hidden'));
    if (btnCancelModalCliente) btnCancelModalCliente.addEventListener('click', () => modalCliente.classList.add('hidden'));

    if (formCliente) {
        formCliente.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btnSubmit = formCliente.querySelector('button[type="submit"]');
            btnSubmit.disabled = true;
            btnSubmit.textContent = "Guardando...";

            const clienteData = {
                nombre_cliente: cliNombre.value.trim(),
                obra: cliObra.value.trim(),
                direccion: cliDireccion.value.trim(),
                localidad: cliLocalidad.value.trim(),
                telefono: cliTelefono.value.trim(),
                email: cliEmail.value.trim()
            };

            const id = editClienteId.value;
            let error;
            if (id) {
                const res = await supabaseClient.from('clientes').update(clienteData).eq('id', id);
                error = res.error;
            } else {
                const res = await supabaseClient.from('clientes').insert([clienteData]);
                error = res.error;
            }

            if (error) {
                alert("Error al guardar cliente: " + error.message);
            } else {
                modalCliente.classList.add('hidden');
                loadClientes();
            }
            btnSubmit.disabled = false;
            btnSubmit.textContent = "Guardar Cliente";
        });
    }

    async function loadClientes() {
        if (!clientesContainer) return;
        clientesContainer.innerHTML = '<div class="text-center p-4"><span class="material-symbols-outlined animate-spin text-primary text-3xl">sync</span></div>';
        
        const { data, error } = await supabaseClient.from('clientes').select('*').order('nombre_cliente', { ascending: true });
        if (error) {
            clientesContainer.innerHTML = '<p class="text-error text-center">Error al cargar clientes.</p>';
            return;
        }
        allClientes = data || [];
        renderClientes(allClientes);
    }

    function renderClientes(clientesToRender) {
        clientesContainer.innerHTML = '';
        if (clientesCount) clientesCount.textContent = `${clientesToRender.length} registros`;

        if (clientesToRender.length === 0) {
            clientesContainer.innerHTML = '<p class="text-on-surface-variant text-center mt-4">No se encontraron clientes u obras.</p>';
            return;
        }

        const isAdmin = window.currentUserProfile && (window.currentUserProfile.rol === 'Admin' || window.currentUserProfile.rol === 'SuperAdmin');

        clientesToRender.forEach(cli => {
            const telefonoLink = cli.telefono ? `tel:${cli.telefono}` : '#';
            const mapsQuery = encodeURIComponent(`${cli.direccion}, ${cli.localidad}`);
            const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`;

            const card = document.createElement('div');
            card.className = "p-4 rounded-2xl shadow-sm bg-surface-container-low flex flex-col gap-3";
            card.innerHTML = `
                <div class="flex justify-between items-start">
                    <div>
                        <h3 class="font-medium text-base text-on-surface">${cli.nombre_cliente}</h3>
                        <p class="text-xs text-primary font-medium bg-primary-container/40 px-2 py-0.5 rounded-md inline-block mt-1">Obra: ${cli.obra}</p>
                    </div>
                    ${isAdmin ? `
                        <button onclick="window.abrirModalEditarCliente('${cli.id}')" class="text-xs bg-surface-variant text-on-surface px-3 py-1.5 rounded-lg font-medium flex items-center gap-1 hover:opacity-80">
                            <span class="material-symbols-outlined text-[14px]">edit</span> Editar
                        </button>
                    ` : ''}
                </div>

                <div class="flex flex-wrap gap-2 items-center text-sm pt-1">
                    <a href="${telefonoLink}" class="flex items-center gap-1.5 bg-surface px-3 py-1.5 rounded-xl border border-outline-variant text-primary font-medium hover:bg-surface-variant transition-colors shadow-xs">
                        <span class="material-symbols-outlined text-[16px]">call</span> ${cli.telefono || 'Sin teléfono'}
                    </a>
                    <a href="${mapsUrl}" target="_blank" class="flex items-center gap-1.5 bg-surface px-3 py-1.5 rounded-xl border border-outline-variant text-primary font-medium hover:bg-surface-variant transition-colors shadow-xs">
                        <span class="material-symbols-outlined text-[16px]">map</span> ${cli.direccion}, ${cli.localidad}
                    </a>
                </div>
            `;
            clientesContainer.appendChild(card);
        });
    }

    if (searchClientesInput) {
        searchClientesInput.addEventListener('input', (e) => {
            const q = e.target.value.toLowerCase();
            const filtrados = allClientes.filter(cli => 
                (cli.nombre_cliente && cli.nombre_cliente.toLowerCase().includes(q)) || 
                (cli.obra && cli.obra.toLowerCase().includes(q)) || 
                (cli.direccion && cli.direccion.toLowerCase().includes(q)) || 
                (cli.localidad && cli.localidad.toLowerCase().includes(q))
            );
            renderClientes(filtrados);
        });
    }

    window.abrirModalEditarCliente = function(id) {
        const cli = allClientes.find(c => c.id === id);
        if (!cli) return;

        modalClienteTitle.textContent = "Editar Cliente / Obra";
        editClienteId.value = cli.id;
        cliNombre.value = cli.nombre_cliente || '';
        cliObra.value = cli.obra || '';
        cliDireccion.value = cli.direccion || '';
        cliLocalidad.value = cli.localidad || '';
        cliTelefono.value = cli.telefono || '';
        cliEmail.value = cli.email || '';

        modalCliente.classList.add('hidden'); // Reset
        modalCliente.classList.remove('hidden');
    };
}
