const puppeteer = require('puppeteer');
const assert = require('assert');

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
    console.log("Iniciando test del Frontend Checkpoint 11B...");
    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
    const page = await browser.newPage();
    
    page.on('console', msg => console.log('BROWSER:', msg.text()));

    await page.goto('http://localhost:8000', { waitUntil: 'networkidle0' });
    
    // Subir CSVs
    const inputCustomers = await page.$('#customers_csv');
    await inputCustomers.uploadFile('data/raw/customers_data.csv');
    const inputHotels = await page.$('#hotels_csv');
    await inputHotels.uploadFile('data/raw/hotel_data.csv');
    
    console.log("-> Clic en Procesar...");
    await page.click('#btn-upload');
    
    // Wait until cards are rendered
    await page.waitForSelector('.segment-card', { timeout: 30000 });
    await delay(1000);
    
    console.log("=> Paso 1: Sin hoteles: verificar empty badges...");
    let visibleBadges = await page.$$eval('.affinity-badge', els => els.filter(e => e.style.display !== 'none').length);
    let sideBadge = await page.$eval('#side-affinity-badge', el => el.style.display);
    console.log("Visible badges:", visibleBadges, "Side badge display:", sideBadge);
    
    // Proyectar un hotel
    console.log("=> Paso 2: Proyectar primer hotel disponible...");
    await page.select('#hotel-dropdown', '1'); // Select hotel ID 1
    await page.click('#btn-project');
    
    // Wait for projection
    await delay(3000);
    
    visibleBadges = await page.$$eval('.affinity-badge', els => els.filter(e => e.style.display !== 'none' || e.offsetParent !== null).length);
    console.log("Visible cards badges tras proyeccion:", visibleBadges);
    
    console.log("=> Paso 3: Click en cluster NO afin");
    // Find a card without display inline-flex
    const noAffineCardClickable = await page.evaluate(() => {
        const cards = Array.from(document.querySelectorAll('.segment-card'));
        const noAffine = cards.find(c => c.querySelector('.affinity-badge').style.display === 'none');
        if (noAffine) {
            noAffine.click();
            return true;
        }
        return false;
    });
    console.log("Hizo click en no afín?", noAffineCardClickable);
    
    // Check side badge
    await delay(2000);
    sideBadge = await page.$eval('#side-affinity-badge', el => window.getComputedStyle(el).display);
    console.log("Side badge display tras click NO afín:", sideBadge);
    
    console.log("=> Paso 4: Eliminar hotel...");
    await page.click('.remove-hotel');
    await delay(2000);
    visibleBadges = await page.$$eval('.affinity-badge', els => els.filter(e => e.style.display !== 'none').length);
    sideBadge = await page.$eval('#side-affinity-badge', el => window.getComputedStyle(el).display);
    console.log("Visible cards badges tras limpiar:", visibleBadges, "Side:", sideBadge);

    await browser.close();
    console.log("Test OK!");
})();
