const https = require('https');
https.get('https://uae.dubizzle.com/robots.txt', { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36' } }, (res) => {
  let b = ''; res.on('data', c => b += c); res.on('end', () => console.log(b));
});
