// Bomi: guarda en Google Drive los PDF de los partes bloqueados.
// Se pega en script.google.com (con la cuenta de Google del Drive que sincroniza el WD) y se implementa
// como "Aplicación web" (Ejecutar como: Yo · Quién tiene acceso: Cualquier usuario).
// La Edge Function `guardar-parte-nube` de Supabase le manda cada PDF con la CLAVE de abajo.
//
// 1) Cambia CLAVE por una contraseña larga inventada (la misma que pondrás en Supabase como GOOGLE_SCRIPT_CLAVE).
const CLAVE = 'CAMBIA-ESTO-por-una-clave-larga';
const CARPETA_PRINCIPAL = 'Bomi - Partes bloqueados';

function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);
    if (CLAVE.indexOf('CAMBIA-ESTO') === 0 || d.clave !== CLAVE) return respuesta({ error: 'Clave incorrecta' });
    // Carpeta principal y subcarpetas (año / primer operario); las que no existen se crean.
    let carpeta = buscarOCrear(DriveApp.getRootFolder(), CARPETA_PRINCIPAL);
    (d.ruta || []).forEach(function (nombre) { carpeta = buscarOCrear(carpeta, String(nombre)); });
    const pdf = Utilities.newBlob(Utilities.base64Decode(d.pdf_base64), 'application/pdf', String(d.nombre));
    const archivo = carpeta.createFile(pdf);
    return respuesta({ id: archivo.getId(), enlace: archivo.getUrl() });
  } catch (err) {
    return respuesta({ error: String(err && err.message || err) });
  }
}

// La carpeta principal se busca en todo el Drive (por si la mueves de sitio); las subcarpetas, dentro de su carpeta.
function buscarOCrear(padre, nombre) {
  const it = padre.getId() === DriveApp.getRootFolder().getId() ? DriveApp.getFoldersByName(nombre) : padre.getFoldersByName(nombre);
  while (it.hasNext()) { const f = it.next(); if (!f.isTrashed()) return f; }
  return padre.createFolder(nombre);
}

function respuesta(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

// Para comprobar los permisos la primera vez: selecciona "autorizar" arriba y pulsa Ejecutar.
function autorizar() {
  DriveApp.getRootFolder().getName();
}
