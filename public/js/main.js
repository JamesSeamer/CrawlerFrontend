const openBtn = document.getElementById('openCrawlPopup');
const popup = document.getElementById('crawlPopup');
const closeBtn = document.getElementById('closeCrawlPopup');

openBtn.addEventListener('click', () => popup.style.display = 'flex');
closeBtn.addEventListener('click', () => popup.style.display = 'none');
window.addEventListener('click', e => { if(e.target === popup) popup.style.display = 'none'; });

openBtn.addEventListener('click', () => {
  popup.style.display = 'flex';
  initCrawlTable(); // initialize DataTable once the popup opens
});

closeBtn.addEventListener('click', () => popup.style.display = 'none');

window.addEventListener('click', e => {
  if (e.target === popup) popup.style.display = 'none';
});

// DataTables init + search (needs jQuery + DataTables loaded globally)
let crawlDT = null;

function initCrawlTable() {
  if (!crawlDT) {
    crawlDT = $('#crawlTable').DataTable({
      dom: 'rt<"bottom"p>',
      pageLength: 10,
      order: [[0, 'desc']],
      responsive: true
    });

    // Hook custom search bar to DataTables
    $('#crawlSearch').on('input', function () {
      crawlDT.search(this.value).draw();
    });
  } else {
    crawlDT.columns.adjust().responsive.recalc();
  }
}