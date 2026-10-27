// Pluggable SMS sender. Select with SMS_PROVIDER = console | semaphore | twilio.
// Every provider resolves to { messageId } or throws on failure.

const providers = {
  async console(to, message) {
    console.log(`[SMS -> ${to}] ${message}`);
    return { messageId: `console-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` };
  },

  // https://semaphore.co/docs (Philippine SMS gateway)
  async semaphore(to, message) {
    const body = new URLSearchParams({
      apikey: process.env.SEMAPHORE_API_KEY,
      number: to.replace('+63', '0'),
      message,
    });
    if (process.env.SEMAPHORE_SENDER_NAME) body.set('sendername', process.env.SEMAPHORE_SENDER_NAME);

    const res = await fetch('https://api.semaphore.co/api/v4/messages', { method: 'POST', body });
    const data = await res.json().catch(() => null);
    if (!res.ok || !Array.isArray(data) || !data[0]?.message_id) {
      throw new Error(`Semaphore error: ${JSON.stringify(data) || res.status}`);
    }
    return { messageId: String(data[0].message_id) };
  },

  async twilio(to, message) {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const auth = Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64');
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}` },
      body: new URLSearchParams({ To: to, From: process.env.TWILIO_FROM_NUMBER, Body: message }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(`Twilio error: ${data?.message || res.status}`);
    return { messageId: data.sid };
  },
};

function providerName() {
  return process.env.SMS_PROVIDER || 'console';
}

async function sendSms(to, message) {
  const send = providers[providerName()];
  if (!send) throw new Error(`Unknown SMS_PROVIDER "${providerName()}"`);
  return send(to, message);
}

module.exports = { sendSms, providerName };
