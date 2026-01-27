/**
 * Nimmt ein Foto vom Video-Element auf und gibt einen Blob zurück.
 * @param {HTMLVideoElement} video
 * @returns {Promise<Blob>}
 */
export async function capturePhotoFromVideo(video) {
  if (!video || video.readyState < 4) {
    throw new Error('Video ist nicht bereit zum Fotografieren.')
  }

  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight

  const ctx = canvas.getContext('2d')
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('Fehler beim Erstellen des Bild-Blobs'))
    }, 'image/jpeg', 0.92)
  })
}

/**
 * Konvertiert einen Blob oder File in Base64.
 * @param {Blob|File} blob
 * @returns {Promise<string>} Base64-String ohne Prefix
 */
export function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      if (reader.result) {
        resolve(reader.result.toString().split(',')[1])
      } else {
        reject(new Error('Fehler beim Lesen des Blobs'))
      }
    }
    reader.onerror = () => reject(new Error('Fehler beim Lesen des Blobs'))
    reader.readAsDataURL(blob)
  })
}
