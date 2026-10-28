// Bomi: guarda en Google Drive los PDF de los partes bloqueados y las fotos de obra.
// Se pega en script.google.com (con la cuenta de Google del Drive que sincroniza el WD) y se implementa
// como "Aplicación web" (Ejecutar como: Yo · Quién tiene acceso: Cualquier usuario).
// Las Edge Functions de Supabase (`guardar-parte-nube` y `fotos-obra`) le mandan cada archivo con la CLAVE de abajo.
// Al cambiar este código: Implementar > Gestionar implementaciones > editar (lápiz) > Versión: Nueva versión.
// Así la URL de la aplicación web no cambia.
//
// 1) Cambia CLAVE por una contraseña larga inventada (la misma que pondrás en Supabase como GOOGLE_SCRIPT_CLAVE).
const CLAVE = 'CAMBIA-ESTO-por-una-clave-larga';
const CARPETA_PRINCIPAL = 'Bomi - Partes bloqueados';

function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);
    if (CLAVE.indexOf('CAMBIA-ESTO') === 0 || d.clave !== CLAVE) return respuesta({ error: 'Clave incorrecta' });
    // Carpeta principal y subcarpetas (partes: año / primer operario; fotos: cliente / obra); las que no existen se crean.
    const principal = d.carpeta === 'Bomi - Fotos' ? 'Bomi - Fotos' : CARPETA_PRINCIPAL;
    let carpeta = buscarOCrear(DriveApp.getRootFolder(), principal);
    (d.ruta || []).forEach(function (nombre) { carpeta = buscarOCrear(carpeta, String(nombre)); });
    const tipo = d.tipo === 'image/jpeg' ? 'image/jpeg' : 'application/pdf';
    const blob = Utilities.newBlob(Utilities.base64Decode(d.base64 || d.pdf_base64), tipo, String(d.nombre));
    const archivo = carpeta.createFile(blob);
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
