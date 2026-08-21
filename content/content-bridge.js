/**
 * Content Bridge — JSLoader Extension
 *
 * La ejecución de scripts se realiza directamente desde el service worker
 * usando chrome.scripting.executeScript con world: 'MAIN', que bypasea
 * la CSP de la página web. Este fichero se mantiene por compatibilidad
 * con el manifest pero no procesa ningún mensaje de ejecución.
 */
