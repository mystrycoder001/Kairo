const Razorpay = require('razorpay');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  
  if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
  }

  const { plan_tier, user_id } = req.body;
  if (!plan_tier || !user_id) {
      return res.status(400).json({ error: 'Missing plan_tier or user_id' });
  }

  const amounts = {
      'pro': 499, // $4.99
      'ultra': 999 // $9.99
  };

  const amount = amounts[plan_tier];
  if (!amount) return res.status(400).json({ error: 'Invalid plan tier' });

  try {
      const razorpay = new Razorpay({
          key_id: process.env.RAZORPAY_KEY_ID,
          key_secret: process.env.RAZORPAY_SECRET
      });

      const options = {
          amount: amount, 
          currency: 'USD',
          receipt: `receipt_${user_id.substring(0, 10)}_${Date.now()}`,
          notes: {
              user_id: user_id,
              plan_tier: plan_tier
          }
      };

      const order = await razorpay.orders.create(options);
      
      return res.status(200).json({ 
          order_id: order.id, 
          amount: order.amount,
          currency: order.currency,
          key_id: process.env.RAZORPAY_KEY_ID 
      });
  } catch (err) {
      console.error('create-order error:', err);
      return res.status(500).json({ error: err.message });
  }
};
