import axios from 'axios';
import FormData from 'form-data';

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { image, filename } = req.body;

    if (!image) {
      return res.status(400).json({ error: 'No image provided' });
    }

    // Convert base64 to buffer
    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
    const fileBuffer = Buffer.from(base64Data, 'base64');
    const fname = filename || 'image.jpg';

    // Get token and task ID
    console.log('[REMOVEBG] Getting token...');
    const html = await axios.get('https://www.iloveimg.com/remove-background', {
      timeout: 15000
    });
    
    const token = html.data.match(/"token":"([^"]+)"/)?.[1];
    const task = html.data.match(/taskId\s*=\s*'([^']+)'/)?.[1];

    if (!token || !task) {
      throw new Error('Failed to get token or task ID');
    }
    
    console.log('[REMOVEBG] Token obtained');

    // Upload image
    console.log('[REMOVEBG] Uploading...');
    
    const uploadForm = new FormData();
    uploadForm.append('name', fname);
    uploadForm.append('chunk', '0');
    uploadForm.append('chunks', '1');
    uploadForm.append('task', task);
    uploadForm.append('preview', '1');
    uploadForm.append('pdfinfo', '0');
    uploadForm.append('pdfforms', '0');
    uploadForm.append('pdfresetforms', '0');
    uploadForm.append('v', 'web.0');
    uploadForm.append('file', fileBuffer, {
      filename: fname,
      contentType: 'image/jpeg'
    });

    const upload = await axios.post('https://api5g.iloveimg.com/v1/upload',
      uploadForm, {
        timeout: 30000,
        headers: {
          ...uploadForm.getHeaders(),
          Authorization: `Bearer ${token}`,
          origin: 'https://www.iloveimg.com',
          referer: 'https://www.iloveimg.com/'
        }
      }
    );

    console.log('[REMOVEBG] Upload success');

    // Process remove background
    console.log('[REMOVEBG] Processing...');
    
    const params = new URLSearchParams({
      task,
      server_filename: upload.data.server_filename
    });

    const process = await axios.post('https://api5g.iloveimg.com/v1/removebackground',
      params.toString(), {
        timeout: 60000,
        responseType: 'arraybuffer',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          origin: 'https://www.iloveimg.com',
          referer: 'https://www.iloveimg.com/'
        }
      }
    );

    console.log('[REMOVEBG] Process complete!');

    // Return processed image
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Length', process.data.length);
    res.status(200).send(Buffer.from(process.data));

  } catch (error) {
    console.error('[REMOVEBG ERROR]', error.message);
    res.status(500).json({ 
      error: 'Failed to process image',
      message: error.message 
    });
  }
      }
