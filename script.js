const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const previewContainer = document.getElementById('previewContainer');
const originalImage = document.getElementById('originalImage');
const resultImage = document.getElementById('resultImage');
const loadingSpinner = document.getElementById('loadingSpinner');
const actionButtons = document.getElementById('actionButtons');
const downloadBtn = document.getElementById('downloadBtn');
const resetBtn = document.getElementById('resetBtn');

let processedImageBlob = null;

// Click to upload
uploadArea.addEventListener('click', () => {
    fileInput.click();
});

// File input change
fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        handleFile(file);
    }
});

// Drag and drop
uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('dragover');
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
        handleFile(file);
    } else {
        alert('❌ Harap upload file gambar!');
    }
});

// Handle file
async function handleFile(file) {
    // Validate file type
    if (!file.type.startsWith('image/')) {
        alert('❌ File harus berupa gambar!');
        return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
        alert('❌ Ukuran file maksimal 10MB!');
        return;
    }

    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => {
        originalImage.src = e.target.result;
        uploadArea.style.display = 'none';
        previewContainer.style.display = 'block';
        resultImage.style.display = 'none';
        loadingSpinner.style.display = 'flex';
        actionButtons.style.display = 'none';
    };
    reader.readAsDataURL(file);

    // Process image
    await removeBackground(file);
}

// Remove background
async function removeBackground(file) {
    try {
        const formData = new FormData();
        formData.append('image', file);

        const response = await fetch('/api/remove', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error('Gagal memproses gambar');
        }

        const blob = await response.blob();
        processedImageBlob = blob;

        // Show result with fade in
        const imageUrl = URL.createObjectURL(blob);
        resultImage.onload = () => {
            loadingSpinner.style.display = 'none';
            resultImage.style.display = 'block';
            actionButtons.style.display = 'flex';
        };
        resultImage.src = imageUrl;

    } catch (error) {
        console.error('Error:', error);
        loadingSpinner.style.display = 'none';
        alert('❌ Terjadi kesalahan! ' + error.message + '\n\nSilakan coba lagi.');
        reset();
    }
}

// Download button
downloadBtn.addEventListener('click', async () => {
    if (!processedImageBlob) return;

    try {
        const response = await fetch('/api/download', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                blob: await blobToBase64(processedImageBlob)
            })
        });

        if (!response.ok) {
            throw new Error('Gagal mendownload gambar');
        }

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `removed-bg-${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

    } catch (error) {
        console.error('Error:', error);
        
        // Fallback: direct download
        const url = URL.createObjectURL(processedImageBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `removed-bg-${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
});

// Reset button
resetBtn.addEventListener('click', () => {
    reset();
});

// Reset function
function reset() {
    fileInput.value = '';
    uploadArea.style.display = 'block';
    previewContainer.style.display = 'none';
    originalImage.src = '';
    resultImage.src = '';
    processedImageBlob = null;
    
    // Revoke object URLs to free memory
    if (resultImage.src.startsWith('blob:')) {
        URL.revokeObjectURL(resultImage.src);
    }
}

// Helper: Convert blob to base64
function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}