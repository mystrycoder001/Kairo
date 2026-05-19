const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || 'https://ibsngqwkaasswscqnlhl.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

let supabase;
try {
  supabase = createClient(supabaseUrl, supabaseKey);
} catch (e) {
  console.error('Supabase init failed:', e.message);
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');

  if (!supabase) return res.status(500).json({ error: 'Database unavailable' });

  // Verify webhook signature
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (secret) {
    const signature = req.headers['x-razorpay-signature'];
    const body = JSON.stringify(req.body);
    const expectedSignature = crypto.createHmac('sha256', secret).update(body).digest('hex');

    if (expectedSignature !== signature) {
      return res.status(400).send('Invalid signature');
    }
  }

  const event = req.body;
  
  if (event.event === 'payment.captured' || event.event === 'order.paid') {
    try {
      const paymentEntity = event.payload?.payment?.entity || {};
      const orderEntity = event.payload?.order?.entity || {};
      const notes = paymentEntity.notes || orderEntity.notes || {};
      
      const user_id = notes.user_id;
      const plan_tier = notes.plan_tier || 'pro';
      const payment_id = paymentEntity.id || '';
      const order_id = paymentEntity.order_id || '';
      const customer_id = paymentEntity.customer_id || '';

      if (user_id && plan_tier) {
        const now = new Date();
        const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days
        
        // 1. Update Profile — idempotent (prevents duplicate upgrades)
        const { error: profileErr } = await supabase
          .from('profiles')
          .update({ 
            subscription_plan: plan_tier,
            subscription_status: 'active',
            razorpay_customer_id: customer_id
          })
          .eq('id', user_id);
        
        if (profileErr) {
          console.error('Profile update failed:', profileErr);
        }

        // 2. Check for duplicate subscription entry
        const { data: existingSub } = await supabase
          .from('subscriptions')
          .select('id')
          .eq('razorpay_payment_id', payment_id)
          .single();

        if (!existingSub && payment_id) {
          // 3. Log Subscription (only if not duplicate)
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
        }

        return res.status(200).json({ status: 'ok' });
      }
    } catch (err) {
      console.error('Webhook error:', err);
      return res.status(500).send('Server Error');
    }
  }

  res.status(200).send('Event received');
};
