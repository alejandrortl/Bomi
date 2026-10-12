// js/modules/notifications.js
export async function loadNotificaciones(supabaseClient, currentUserProfile, notificacionesContainer, notifBadge) {
    if (!notificacionesContainer || !currentUserProfile) return;
    const userId = currentUserProfile.id;
    
    const { data, error } = await supabaseClient
        .from('notificaciones')
        .select('*')
        .or(`user_id.eq.${userId},user_id.is.null`)
        .order('created_at', { ascending: false })
        .limit(10);

    if (error || !data) return;

    notificacionesContainer.innerHTML = '';
    const unreadCount = data.filter(n => !n.leida).length;

    if (unreadCount > 0 && notifBadge) {
        notifBadge.classList.remove('hidden');
    } else if (notifBadge) {
        notifBadge.classList.add('hidden');
    }

    if (data.length === 0) {
        notificacionesContainer.innerHTML = '<p class="text-xs text-on-surface-variant text-center py-4">No hay notificaciones</p>';
        return;
    }

    data.forEach(notif => {
        const item = document.createElement('div');
        item.className = `p-3 text-xs flex flex-col gap-1 cursor-pointer hover:bg-surface-variant transition-colors ${notif.leida ? 'opacity-70' : 'bg-primary-container/20 font-medium'}`;
        item.innerHTML = `
            <div class="flex justify-between items-center">
                <span class="font-medium text-primary">${notif.titulo}</span>
                <span class="text-[10px] text-on-surface-variant">${new Date(notif.created_at).toLocaleDateString()}</span>
            </div>
            <p class="text-on-surface">${notif.mensaje}</p>
        `;
        item.addEventListener('click', async () => {
            if (!notif.leida) {
                await supabaseClient.from('notificaciones').update({ leida: true }).eq('id', notif.id);
                loadNotificaciones(supabaseClient, currentUserProfile, notificacionesContainer, notifBadge);
            }
        });
        notificacionesContainer.appendChild(item);
    });
}

export function initPushNotifications(btnRequestPush, currentUserProfile, supabaseClient) {
    if (!btnRequestPush) return;
    
    // Sincronizar estado visual inicial
    if (currentUserProfile.notificaciones_activas && Notification.permission === 'granted') {
        btnRequestPush.textContent = "Activadas";
        btnRequestPush.disabled = true;
        btnRequestPush.classList.add('opacity-70');
    }

    btnRequestPush.addEventListener('click', async () => {
        if (!('Notification' in window)) {
            alert("Este navegador no soporta notificaciones push.");
            return;
        }
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            currentUserProfile.notificaciones_activas = true;
            await supabaseClient
                .from('perfiles')
                .update({ notificaciones_activas: true })
                .eq('id', currentUserProfile.id);

            new Notification("Diario de Obra", { body: "¡Notificaciones activadas con éxito!" });
            btnRequestPush.textContent = "Activadas";
            btnRequestPush.disabled = true;
            btnRequestPush.classList.add('opacity-70');
        } else {
            alert("Permiso de notificaciones denegado.");
        }
    });
}
