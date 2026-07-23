async function testPaystack() {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  const planCode = process.env.PAYSTACK_PLAN_STARTER_MONTHLY;
  
  console.log('Using secret:', secret ? secret.substring(0, 10) + '...' : 'undefined');
  console.log('Using plan:', planCode);

  try {
    const res = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'test@usersessions.io',
        amount: 10000, 
        plan: planCode,
        callback_url: 'http://localhost:3000/settings'
      })
    });
    
    const data = await res.json();
    console.log('Paystack Response:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Fetch error:', err);
  }
}

testPaystack();
