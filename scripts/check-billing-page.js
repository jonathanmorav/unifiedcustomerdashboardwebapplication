// Simple script to check if billing page loads correctly
const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ 
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // Listen for console messages
    page.on('console', message => {
      console.log(`Console ${message.type()}: ${message.text()}`);
    });
    
    // Listen for errors
    page.on('error', err => {
      console.error('Page error:', err);
    });
    
    page.on('pageerror', err => {
      console.error('Page error:', err);
    });
    
    // Navigate to the billing page
    console.log('Navigating to billing page...');
    const response = await page.goto('http://localhost:3000/billing', { 
      waitUntil: 'networkidle0',
      timeout: 30000 
    });
    
    console.log('Response status:', response.status());
    
    // Wait for content to load
    await page.waitForTimeout(2000);
    
    // Check for error messages
    const errorElements = await page.$$eval('[class*="error"], [class*="Error"]', elements => 
      elements.map(el => ({ text: el.textContent, className: el.className }))
    );
    
    if (errorElements.length > 0) {
      console.log('Error elements found:');
      errorElements.forEach(err => console.log(`  ${err.className}: ${err.text}`));
    }
    
    // Get page title
    const title = await page.title();
    console.log('Page title:', title);
    
    // Check if main content exists
    const hasMainContent = await page.$('main') !== null;
    console.log('Has main content:', hasMainContent);
    
    // Take a screenshot
    await page.screenshot({ path: '/tmp/billing-page.png' });
    console.log('Screenshot saved to /tmp/billing-page.png');
    
  } catch (error) {
    console.error('Script error:', error);
  } finally {
    await browser.close();
  }
})();