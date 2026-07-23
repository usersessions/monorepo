const { MINIMAX_API_KEY, MINIMAX_BASE_URL } = process.env;
const BASE_URL = MINIMAX_BASE_URL || 'https://api.minimaxi.chat/v1';

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${MINIMAX_API_KEY}`
  };
}

async function testVideoGen() {
  try {
    console.log("1. Starting Video Generation Task...");
    const createRes = await fetch(`${BASE_URL}/video_generation`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        model: 'video-01', // Using the correct model name
        prompt: 'A quick 3-second camera pan over a cup of coffee on a wooden desk, photorealistic.',
      })
    });
    
    if (!createRes.ok) throw new Error(`Create Failed: ${await createRes.text()}`);
    
    const createData = await createRes.json();
    console.log("Create Response:", createData);
    
    const taskId = createData.task_id;
    if (!taskId) throw new Error("No task_id returned!");

    console.log(`\n2. Polling for status on task ${taskId}... (this may take a minute or two)`);
    let fileId = null;
    
    while (true) {
      const pollRes = await fetch(`${BASE_URL}/query/video_generation?task_id=${taskId}`, {
        headers: authHeaders()
      });
      if (!pollRes.ok) throw new Error(`Poll Failed: ${await pollRes.text()}`);
      
      const pollData = await pollRes.json();
      const status = pollData.status;
      
      process.stdout.write(`\rCurrent status: ${status}              `);
      
      if (status === 'Success') {
        fileId = pollData.file_id;
        console.log("\n\nTask completed successfully!");
        break;
      } else if (status === 'Fail' || status === 'Unknown') {
        console.error("\n\nTask failed:", pollData);
        return;
      }
      
      // Wait 10 seconds before polling again
      await delay(10000);
    }
    
    console.log(`\n3. Retrieving video URL for file ${fileId}...`);
    const fileRes = await fetch(`${BASE_URL}/files/retrieve?file_id=${fileId}`, {
      headers: authHeaders()
    });
    
    if (!fileRes.ok) throw new Error(`Retrieve Failed: ${await fileRes.text()}`);
    const fileData = await fileRes.json();
    
    console.log("\n✅ Video generation complete! Here is the URL:");
    console.log(fileData.file.download_url);
    
  } catch (err) {
    console.error("\nTest Error:", err);
  }
}

testVideoGen();
