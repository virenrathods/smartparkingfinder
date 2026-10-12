const QRCode = require('qrcode');

/**
 * Generate a genuine Base64 PNG QR code from structured booking metadata
 * @param {Object} payload 
 * @returns {Promise<string>} Base64 Data URL
 */
async function generateBookingQRCode(payload) {
  try {
    const stringified = JSON.stringify(payload);
    const dataUrl = await QRCode.toDataURL(stringified, {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      quality: 0.95,
      margin: 2,
      color: {
        dark: '#0f172a', // Slate 900
        light: '#ffffff'
      },
      width: 320
    });
    return dataUrl;
  } catch (err) {
    console.error('Error generating QR code:', err);
    throw new Error('Failed to generate QR code for ticket');
  }
}

module.exports = {
  generateBookingQRCode
};
