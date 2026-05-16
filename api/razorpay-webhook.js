const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://ibsngqwkaasswscqnlhl.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-role-key-here'
);

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');

  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const signature = req.headers['x-razorpay-signature'];
  const body = JSON.stringify(req.body);

  const expectedSignature = crypto.createHmac('sha256', secret).update(body).digest('hex');

  if (expectedSignature !== signature) {
      return res.status(400).send('Invalid signature');
  }

  const event = req.body;
  
  if (event.event === 'payment.captured' || event.event === 'order.paid') {
      try {
          const notes = event.payload.payment.entity.notes || event.payload.order.entity.notes;
          const user_id = notes.user_id;
          const plan_tier = notes.plan_tier || 'pro';
          const payment_id = event.payload.payment.entity.id;
          const order_id = event.payload.payment.entity.order_id;
          const customer_id = event.payload.payment.entity.customer_id;

          if (user_id && plan_tier) {
              const now = new Date();
              const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days
              
              // 1. Update Profile
              await supabase
                  .from('profiles')
                  .update({ 
                      subscription_plan: plan_tier,
                      subscription_status: 'active',
                      razorpay_customer_id: customer_id
                  })
                  .eq('id', user_id);
              
              // 2. Log Subscription
              await supabase
                  .from('subscriptions')
                  .insert({
                      user_id: user_id,
                      plan_name: plan_tier,
                      status: 'active',
                      current_period_end: expiresAt.toISOString(),
                      razorpay_payment_id: payment_id,
                      razorpay_order_id: order_id
                  });

              return res.status(200).json({ status: 'ok' });
          }
      } catch (err) {
          console.error('Webhook error:', err);
          return res.status(500).send('Server Error');
      }
  }

  res.status(200).send('Event not handled');
};
