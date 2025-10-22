// Simple webhook test endpoint to verify webhook is receiving requests
module.exports = async (req, res) => {
  console.log('🔍 Webhook test endpoint called');
  console.log('Method:', req.method);
  console.log('Headers:', req.headers);
  console.log('Body:', req.body);
  
  if (req.method === 'POST') {
    const sig = req.headers['stripe-signature'];
    console.log('Stripe signature:', sig);
    
    if (sig) {
      res.json({ 
        success: true, 
        message: 'Webhook received with Stripe signature',
        signature: sig,
        bodyLength: JSON.stringify(req.body).length
      });
    } else {
      res.json({ 
        success: false, 
        message: 'No Stripe signature found',
        headers: req.headers
      });
    }
  } else {
    res.json({ 
      success: true, 
      message: 'Webhook test endpoint is working',
      method: req.method
    });
  }
};

