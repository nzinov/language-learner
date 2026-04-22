const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: false }); // Set to true for headless
  const page = await browser.newPage();
  
  // Load the local HTML file
  await page.goto('file:///Users/nikolay/language_learner/index.html');
  
  // Wait for page to load
  await page.waitForTimeout(2000);
  
  // Wait for AI message to appear (check for .ai-bubble)
  try {
    await page.waitForSelector('.ai-bubble', { timeout: 10000 });
    console.log('✓ AI bubble found');
  } catch (e) {
    console.log('✗ AI bubble not found');
    await browser.close();
    return;
  }
  
  // Get the text content of the first AI bubble
  const bubbleText = await page.$eval('.ai-bubble', el => el.textContent);
  console.log('AI bubble text:', bubbleText.substring(0, 50) + '...');
  
  // Try to select some text
  const result = await page.evaluate(() => {
    const bubble = document.querySelector('.ai-bubble');
    if (!bubble) return { success: false, error: 'No bubble' };
    
    // Get all text nodes
    const textNodes = [];
    const walker = document.createTreeWalker(bubble, NodeFilter.SHOW_TEXT, null, false);
    let node;
    while (node = walker.nextNode()) {
      if (node.textContent.trim().length > 5) {
        textNodes.push(node);
      }
    }
    
    if (textNodes.length === 0) return { success: false, error: 'No text nodes' };
    
    const textNode = textNodes[0];
    const text = textNode.textContent;
    const startOffset = 0;
    const endOffset = Math.min(10, text.length);
    
    // Create range and select
    const range = document.createRange();
    range.setStart(textNode, startOffset);
    range.setEnd(textNode, endOffset);
    
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    
    return { 
      success: true, 
      selectedText: text.substring(startOffset, endOffset),
      hasSelectionPopup: !!document.getElementById('selectionPopup')
    };
  });
  
  console.log('Selection result:', result);
  
  // Trigger mouseup event
  await page.mouse.up();
  await page.waitForTimeout(500);
  
  // Check if popup appeared
  const popupExists = await page.$('#selectionPopup');
  console.log('Popup exists:', !!popupExists);
  
  if (popupExists) {
    const popupStyle = await page.$eval('#selectionPopup', el => el.style.display);
    console.log('Popup display style:', popupStyle);
  }
  
  // Keep browser open for inspection
  await page.waitForTimeout(5000);
  
  await browser.close();
})();