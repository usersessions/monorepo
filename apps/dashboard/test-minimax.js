require('dotenv').config();
fetch('https://api.minimaxi.chat/v1/video_generation', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + process.env.MINIMAX_API_KEY
  },
  body: JSON.stringify({
    model: 'MiniMax-Hailuo-2.3-Fast',
    prompt: 'A scenic shot of the beach at sunset.',
    callback_url: 'https://example.com/webhook'
  })
}).then(r => r.json()).then(console.log).catch(console.error);
