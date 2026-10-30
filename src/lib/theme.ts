// Compartido: el script de <head> y el selector usan la misma clave y lógica.
export const THEME_KEY = "theme";
export type ThemeMode = "light" | "dark";

/**
 * Se ejecuta en <head> ANTES de pintar: aplica el tema guardado y evita el parpadeo.
 * Sin preferencia guardada (o si el almacenamiento falla) se usa el del dispositivo (prefers-color-scheme, en el CSS).
 */
export const THEME_SCRIPT = `try{var t=localStorage.getItem("${THEME_KEY}");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}`;
