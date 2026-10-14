// Edge Function `enviar-push` (desplegar con verify_jwt = false).
// La llama un trigger de la base de datos cuando se inserta una fila en `notificaciones`
// y envía el aviso push a todos los dispositivos suscritos de ese usuario.
// Secretos necesarios: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY (y opcional VAPID_SUBJECT).
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT') ?? 'https://bomi-cyan.vercel.app',
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!,
);

Deno.serve(async (req) => {
  try {
    const { id } = await req.json();
    if (!id || typeof id !== 'string') return new Response('bad request', { status: 400 });

    // Se reserva la notificación: solo se envía una vez aunque se llame repetidamente.
    const { data: n } = await sb.from('notificaciones')
      .update({ push_enviado_at: new Date().toISOString() })
      .eq('id', id).is('push_enviado_at', null)
      .select('id, user_id, titulo, mensaje').maybeSingle();
    if (!n) return new Response('ok');

    const { data: subs } = await sb.from('push_subscriptions').select('id, endpoint, p256dh, auth').eq('user_id', n.user_id);
    const payload = JSON.stringify({ id: n.id, titulo: n.titulo, mensaje: n.mensaje });
    await Promise.all((subs ?? []).map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 86400 });
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await sb.from('push_subscriptions').delete().eq('id', s.id);
      }
    }));
    return new Response('ok');
  } catch (_e) {
    return new Response('error', { status: 500 });
  }
});
