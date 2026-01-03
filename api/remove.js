import axios from 'axios';
import FormData from 'form-data';
import { Readable } from 'stream';

export const config = {
  api: {
    bodyParser: false,
  },
};

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
    // Read raw body
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    // Parse multipart form data manually
    const contentType = req.headers['content-type'] || '';
    const boundary = contentType.split('boundary=')[1];
    
    if (!boundary) {
      return res.status(400).json({ error: 'Invalid content type' });
    }

    // Split by boundary
    const parts = buffer.toString('binary').split(`--${boundary}`);
    
    let fileBuffer = null;
    let filename = 'image.jpg';

    // Extract file from parts
    for (const part of parts) {
      if (part.includes('Content-Disposition') && part.includes('name="image"')) {
        // Extract filename
        const filenameMatch = part.match(/filename="([^"]+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
        
        // Extract file content
        const contentStart = part.indexOf('\r\n\r\n') + 4;
        const contentEnd = part.lastIndexOf('\r\n');
        
        if (contentStart > 3 && contentEnd > contentStart) {
          const binaryContent = part.substring(contentStart, contentEnd);
          fileBuffer = Buffer.from(binaryContent, 'binary');
        }
        break;
      }
    }

    if (!fileBuffer || fileBuffer.length === 0) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    console.log(`[REMOVEBG] File received: ${filename}, size: ${(fileBuffer.length / 1024).toFixed(2)} KB`);

    // Get token and task ID from iloveimg
    console.log('[REMOVEBG] Getting token...');
    const html = await axios.get('https://www.iloveimg.com/remove-background', {
      timeout: 15000
    });
    
    const token = html.data.match(/"token":"([^"]+)"/)?.[1];
    const task = html.data.match(/taskId\s*=\s*'([^']+)'/)?.[1];

    if (!token || !task) {
      throw new Error('Failed to get token or task ID from iloveimg');
    }
    
    console.log('[REMOVEBG] Token obtained successfully');

    // Upload image to iloveimg
    console.log('[REMOVEBG] Uploading image...');
    
    const uploadForm = new FormData();
    uploadForm.append('name', filename);
    uploadForm.append('chunk', '0');
    uploadForm.append('chunks', '1');
    uploadForm.append('task', task);
    uploadForm.append('preview', '1');
    uploadForm.append('pdfinfo', '0');
    uploadForm.append('pdfforms', '0');
    uploadForm.append('pdfresetforms', '0');
    uploadForm.append('v', 'web.0');
    uploadForm.append('file', fileBuffer, {
      filename: filename,
      contentType: 'image/jpeg'
    });

    const upload = await axios.post(
      'https://api5g.iloveimg.com/v1/upload',
      uploadForm,
      {
        timeout: 30000,
        headers: {
          ...uploadForm.getHeaders(),
          Authorization: `Bearer ${token}`,
          origin: 'https://www.iloveimg.com',
          referer: 'https://www.iloveimg.com/'
        }
      }
    );

    console.log('[REMOVEBG] Upload successful');

    // Process remove background
    console.log('[REMOVEBG] Processing background removal...');
    
    const params = new URLSearchParams({
      task,
      server_filename: upload.data.server_filename
    });

    const process = await axios.post(
      'https://api5g.iloveimg.com/v1/removebackground',
      params.toString(),
      {
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

    console.log('[REMOVEBG] Background removal complete!');

    // Return processed image
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Length', process.data.length);
    res.status(200).send(Buffer.from(process.data));

  } catch (error) {
    console.error('[REMOVEBG ERROR]', error.message);
    
    // Return detailed error
    const errorMessage = error.response?.data?.error || error.message || 'Unknown error';
    res.status(500).json({ 
      error: 'Failed to process image',
      message: errorMessage,
      details: error.response?.status ? `HTTP ${error.response.status}` : 'Network error'
    });
  }
}
