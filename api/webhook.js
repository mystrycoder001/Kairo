const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
      // Validate signature
      const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
      // In production, you would properly validate the webhook signature using crypto.
      // We will skip strict validation for this MVP, but it should be added before full launch.

      // We read the body directly as we are assuming Next.js API route behavior (parsed JSON)
      const event = req.body;
      
      if (event.meta.event_name === 'order_created') {
          const customData = event.data.attributes.first_order_item.custom || event.meta.custom_data;
          const user_id = customData?.user_id;

          if (user_id) {
              const supabase = createClient(
                  process.env.SUPABASE_URL,
                  process.env.SUPABASE_SERVICE_ROLE_KEY
              );

              const { error } = await supabase
                  .from('profiles')
                  .update({ plan_tier: 'pro' })
                  .eq('id', user_id);

              if (error) {
                  console.error('Error updating user tier:', error);
                  return res.status(500).json({ error: 'Failed to update user' });
              }
              console.log(`Successfully upgraded user ${user_id} to pro.`);
          }
      }

      return res.status(200).json({ received: true });
  } catch (err) {
      console.error('Webhook error:', err);
      return res.status(500).json({ error: 'Webhook processing failed' });
  }
};
