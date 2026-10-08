(() => {
  const grid = document.querySelector('#project-grid');
  if (!grid) return;

  const cards = [...grid.querySelectorAll('.case-card')];
  const buttons = [...document.querySelectorAll('[data-filter-group]')];
  const search = document.querySelector('#project-search');
  const count = document.querySelector('#result-count');
  const empty = document.querySelector('#empty-results');
  const clear = document.querySelector('#clear-filters');
  const keys = {kind: 'kind', domain: 'domains', capability: 'capabilities', technology: 'technologies'};
  const selected = {kind: new Set(), domain: new Set(), capability: new Set(), technology: new Set()};
  const params = new URLSearchParams(location.search);
  for (const key of Object.keys(keys)) {
    for (const value of params.getAll(key)) {
      if (buttons.some(button => button.dataset.filterGroup === key && button.dataset.filterValue === value)) selected[key].add(value);
    }
  }
  search.value = params.get('q') || '';
  if (selected.technology.size) document.querySelector('.technology-filter').open = true;

  function render() {
    const query = search.value.trim().toLocaleLowerCase();
    let shown = 0;
    for (const card of cards) {
      const match = Object.entries(keys).every(([key, field]) => !selected[key].size || [...selected[key]].some(value => (field === 'kind' ? [card.dataset.kind] : card.dataset[field].split('|')).includes(value)));
      card.hidden = !(match && card.dataset.search.includes(query));
      if (!card.hidden) shown++;
    }
    for (const button of buttons) button.setAttribute('aria-pressed', String(selected[button.dataset.filterGroup].has(button.dataset.filterValue)));
    count.textContent = `${shown} ${shown === 1 ? 'project' : 'projects'}`;
    empty.hidden = shown !== 0;
    const next = new URLSearchParams();
    for (const key of Object.keys(keys)) for (const value of selected[key]) next.append(key, value);
    if (search.value.trim()) next.set('q', search.value.trim());
    history.replaceState(null, '', `${location.pathname}${next.size ? `?${next}` : ''}`);
  }
  for (const button of buttons) button.addEventListener('click', () => {
    const set = selected[button.dataset.filterGroup];
    const value = button.dataset.filterValue;
    set.has(value) ? set.delete(value) : set.add(value);
    render();
  });
  search.addEventListener('input', render);
  clear.addEventListener('click', () => {
    Object.values(selected).forEach(set => set.clear());
    search.value = '';
    render();
    search.focus();
  });
  addEventListener('popstate', () => location.reload());
  render();
})();

(() => {
  const cv = document.querySelector('[data-cv]');
  if (!cv) return;

  const hiddenStorageKey = 'henrik-verkist-cv-hidden-v1';
  const orderStorageKey = 'henrik-verkist-cv-order-v1';
  const readJson = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch { return fallback; }
  };
  const writeJson = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); }
    catch { /* Ignore storage failures; the current layout still works. */ }
  };
  const removeJson = key => {
    try { localStorage.removeItem(key); }
    catch { /* Ignore storage failures. */ }
  };
  let hidden = new Set(readJson(hiddenStorageKey, []));
  let order = readJson(orderStorageKey, {});
  let dragState = null;
  let suppressClick = false;
  const sortableContainers = [...cv.querySelectorAll('[data-cv-sortable]')];
  const defaultOrders = new Map(sortableContainers.map(container => [container.dataset.cvSortable, [...container.querySelectorAll('[data-cv-draggable]')].map(item => item.dataset.cvKey)]));
  const persistHidden = () => writeJson(hiddenStorageKey, [...hidden]);
  const collectOrder = () => Object.fromEntries(sortableContainers.map(container => [container.dataset.cvSortable, [...container.querySelectorAll('[data-cv-draggable]')].map(item => item.dataset.cvKey)]));
  const persistOrder = () => {
    order = collectOrder();
    writeJson(orderStorageKey, order);
  };
  const reorderContainer = (container, keys = []) => {
    const items = [...container.querySelectorAll('[data-cv-draggable]')];
    const byKey = new Map(items.map(item => [item.dataset.cvKey, item]));
    const seen = new Set();
    const ordered = [];
    for (const key of keys) if (byKey.has(key)) {
      ordered.push(byKey.get(key));
      seen.add(key);
    }
    for (const item of items) if (!seen.has(item.dataset.cvKey)) ordered.push(item);
    for (const item of ordered) container.appendChild(item);
  };
  const applyOrder = () => {
    for (const container of sortableContainers) reorderContainer(container, order[container.dataset.cvSortable] || defaultOrders.get(container.dataset.cvSortable));
  };
  const applyHidden = () => {
    cv.querySelectorAll('[data-cv-key]').forEach(item => item.classList.toggle('cv-hidden', hidden.has(item.dataset.cvKey)));
  };
  const resetCustomisation = () => {
    hidden = new Set();
    order = {};
    removeJson(hiddenStorageKey);
    removeJson(orderStorageKey);
    for (const container of sortableContainers) reorderContainer(container, defaultOrders.get(container.dataset.cvSortable));
    applyHidden();
  };
  const dragAfterElement = (container, y) => [...container.querySelectorAll('[data-cv-draggable]:not(.cv-dragging):not(.cv-hidden)')]
    .reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      return offset < 0 && offset > closest.offset ? {offset, element: child} : closest;
    }, {offset: Number.NEGATIVE_INFINITY, element: null}).element;
  const finishDrag = event => {
    if (!dragState || (event?.pointerId != null && event.pointerId !== dragState.pointerId)) return;
    const wasActive = dragState.active;
    dragState.item.classList.remove('cv-dragging');
    cv.classList.remove('cv-is-dragging');
    if (wasActive) {
      persistOrder();
      suppressClick = true;
      setTimeout(() => { suppressClick = false; }, 0);
      event?.preventDefault();
    }
    dragState = null;
  };

  cv.addEventListener('click', event => {
    if (suppressClick) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    const hideButton = event.target.closest('[data-cv-hide]');
    if (hideButton) {
      const item = hideButton.closest('[data-cv-key]');
      if (item) {
        hidden.add(item.dataset.cvKey);
        persistHidden();
        applyHidden();
      }
      return;
    }
    if (event.target.closest('[data-cv-reset]')) {
      resetCustomisation();
      return;
    }
    if (event.target.closest('[data-cv-print]')) window.print();
  });

  cv.addEventListener('pointerdown', event => {
    if (event.button !== 0 || event.target.closest('button,a,input,textarea,select')) return;
    const item = event.target.closest('[data-cv-draggable]');
    const container = item?.closest('[data-cv-sortable]');
    if (!item || !container) return;
    dragState = {item, container, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, active: false};
  });
  cv.addEventListener('pointermove', event => {
    if (!dragState || event.pointerId !== dragState.pointerId) return;
    const distance = Math.hypot(event.clientX - dragState.startX, event.clientY - dragState.startY);
    if (!dragState.active) {
      if (distance < 6) return;
      dragState.active = true;
      dragState.item.classList.add('cv-dragging');
      cv.classList.add('cv-is-dragging');
      dragState.item.setPointerCapture?.(event.pointerId);
    }
    event.preventDefault();
    const after = dragAfterElement(dragState.container, event.clientY);
    if (after) dragState.container.insertBefore(dragState.item, after);
    else dragState.container.appendChild(dragState.item);
  });
  cv.addEventListener('pointerup', finishDrag);
  cv.addEventListener('pointercancel', finishDrag);

  applyOrder();
  applyHidden();
})();
