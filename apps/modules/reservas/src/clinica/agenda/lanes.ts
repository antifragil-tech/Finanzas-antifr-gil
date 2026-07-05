// Reparto en carriles anti-solape para DayPilot Lite.
// DayPilot, cuando dos citas coinciden en hora, ENSANCHA la que empieza antes para
// rellenar el hueco que queda libre después y deja que la siguiente se le monte
// encima (no hay opción de config para evitarlo). Esta función, llamada tras cada
// render (onAfterEventRender + rAF), reescribe left/width de cada cita: por columna,
// las que se solapan en el tiempo se reparten en carriles iguales (100/nCarriles %)
// y NUNCA se pisan. Si no caben, se estrechan. Reutilizable por las vistas Semana y Día.
export function repartirCarriles(root: HTMLElement | null): void {
  if (!root) return;
  const eventos = Array.from(root.querySelectorAll<HTMLElement>('.calendar_default_event'));
  // Agrupar por columna (cada día es un contenedor posicionado = offsetParent).
  const columnas = new Map<Element, HTMLElement[]>();
  for (const el of eventos) {
    const col = (el.offsetParent as Element | null) ?? el.parentElement;
    if (!col) continue;
    const lista = columnas.get(col);
    if (lista) lista.push(el);
    else columnas.set(col, [el]);
  }
  columnas.forEach((grupo) => {
    const items = grupo
      .map((el) => ({ el, top: el.offsetTop, bot: el.offsetTop + el.offsetHeight }))
      .sort((a, b) => a.top - b.top || a.bot - b.bot);
    let i = 0;
    while (i < items.length) {
      // Cluster = citas encadenadas por solape temporal.
      const primero = items[i];
      if (!primero) break;
      let fin = primero.bot;
      let j = i;
      for (let sig = items[j + 1]; sig && sig.top < fin; sig = items[j + 1]) {
        j += 1;
        if (sig.bot > fin) fin = sig.bot;
      }
      const cluster = items.slice(i, j + 1);
      // Asignar cada cita al primer carril cuyo evento previo ya terminó.
      const finCarril: number[] = [];
      const carrilDe = new Map<HTMLElement, number>();
      for (const it of cluster) {
        let carril = finCarril.findIndex((f) => f <= it.top);
        if (carril === -1) {
          carril = finCarril.length;
          finCarril.push(it.bot);
        } else {
          finCarril[carril] = it.bot;
        }
        carrilDe.set(it.el, carril);
      }
      const ancho = 100 / finCarril.length;
      for (const it of cluster) {
        const carril = carrilDe.get(it.el) ?? 0;
        it.el.style.left = `${carril * ancho}%`;
        it.el.style.width = `${ancho}%`;
      }
      i = j + 1;
    }
  });
}
