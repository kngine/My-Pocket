const { Readability } = require('@mozilla/readability');
const { JSDOM } = require('jsdom');

async function test() {
  const url = 'https://finance.yahoo.com/markets/stocks/articles/amazon-amzn-bofa-sees-q2-134830444.html';
  const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
      }
  });
  const html = await response.text();
  
  // Find lines in HTML containing the alt text
  const lines = html.split('\\n');
  const matchingLines = lines.filter(l => l.includes('Jim Cramer Discusses'));
  console.log(`Found ${matchingLines.length} lines containing the alt text.`);
  if (matchingLines.length > 0) {
      console.log("First matching line:", matchingLines[0].substring(0, 500));
  }
}

test().catch(console.error);
