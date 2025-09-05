const openBtn = document.getElementById('openCrawlPopup');
const popup = document.getElementById('crawlPopup');
const closeBtn = document.getElementById('closeCrawlPopup');

openBtn.addEventListener('click', () => popup.style.display = 'flex');
closeBtn.addEventListener('click', () => popup.style.display = 'none');
window.addEventListener('click', e => { if(e.target === popup) popup.style.display = 'none'; });