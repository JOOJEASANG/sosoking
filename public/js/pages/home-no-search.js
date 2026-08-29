import { renderHome as renderBaseHome } from './home-judge-assignment.js?v=20260730-judge-board-search-1';

function removeHomeSearch(container) {
  const search = container.querySelector('#feed-search');
  if (!search) return;
  const searchRow = search.parentElement;
  if (searchRow) searchRow.remove();
  else search.remove();
}

export async function renderHome(container) {
  await renderBaseHome(container);
  removeHomeSearch(container);
}
