/**
 * SMS service for sending verification codes
 * Using httpSMS - Open Source SMS Gateway (https://httpsms.com)
 */

import HttpSms from 'httpsms';

export interface SMSOptions {
  to: string;
  body: string;
}

export class SMSService {
  private client: HttpSms | null;
  private phoneNumber: string;
  private apiKey: string;

  constructor(apiKey: string, phoneNumber: string) {
    this.apiKey = apiKey;
    this.phoneNumber = phoneNumber;

    // Only initialize client if API key is provided
    this.client = apiKey ? new HttpSms(apiKey) : null;
  }

  /**
   * Send an SMS using httpSMS API
   */
  async sendSMS(options: SMSOptions): Promise<void> {
    const { to, body } = options;

    if (!this.client) {
      throw new Error('SMS service not configured. Please set HTTPSMS_API_KEY.');
    }

    try {
      const response = await this.client.messages.send({
        from: this.phoneNumber,
        to: to,
        content: body,
      });

      console.log('SMS sent successfully:', response.id);
    } catch (error) {
      console.error('Error sending SMS:', error);
      throw error;
    }
  }

  /**
   * Send verification code SMS
   */
  async sendVerificationCode(phoneNumber: string, code: string): Promise<void> {
    // In development/test without credentials, just log the code
    if (!this.apiKey || process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
      console.log('\n🔐 ========================================');
      console.log('📱 VERIFICATION CODE (Development Mode)');
      console.log('========================================');
      console.log(`Phone: ${phoneNumber}`);
      console.log(`Code: ${code}`);
      console.log('Expires: 10 minutes');
      console.log('========================================\n');
      return;
    }

    const body = `Your Alternate Futures verification code is: ${code}\n\nThis code will expire in 10 minutes.\n\nIf you didn't request this code, please ignore this message.`;

    await this.sendSMS({
      to: phoneNumber,
      body,
    });
  }

  /**
   * Send a custom SMS message
   */
  async sendMessage(phoneNumber: string, message: string): Promise<void> {
    await this.sendSMS({
      to: phoneNumber,
      body: message,
    });
  }
}

// Export singleton instance
export const smsService = new SMSService(
  process.env.HTTPSMS_API_KEY || '',
  process.env.HTTPSMS_PHONE_NUMBER || ''
);

console.log('📱 SMS Service Config (httpSMS):');
console.log(`  API Key: ${process.env.HTTPSMS_API_KEY ? process.env.HTTPSMS_API_KEY.substring(0, 10) + '...' : 'Not configured'}`);
console.log(`  From Number: ${process.env.HTTPSMS_PHONE_NUMBER || 'Not configured'}`);
