import {
  PHOTO_THUMBNAIL_MAX_PX,
  PHOTO_THUMBNAIL_QUALITY,
  UPLOAD_CHUNK_SIZE_BYTES,
  validateFileClient,
} from './constants';

export interface UploadProgressState {
  id: string;
  fileName: string;
  mimeType: string;
  totalBytes: number;
  uploadedBytes: number;
  progressPct: number;
  chunkIndex: number;
  totalChunks: number;
  status: 'uploading' | 'finalizing' | 'failed' | 'cancelled' | 'completed';
  error?: string;
}

export interface CompletedUploadResult {
  fileId: string;
  url: string;
  downloadUrl: string;
  fileName: string;
  mimeType: string;
  size: number;
}

export async function generatePhotoThumbnail(file: File): Promise<string> {
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const scale = Math.min(
          1,
          PHOTO_THUMBNAIL_MAX_PX / Math.max(img.width || 1, img.height || 1)
        );
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(objectUrl);
          resolve('');
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', PHOTO_THUMBNAIL_QUALITY);
        URL.revokeObjectURL(objectUrl);
        resolve(dataUrl.length <= 170000 ? dataUrl : canvas.toDataURL('image/jpeg', 0.5));
      } catch {
        URL.revokeObjectURL(objectUrl);
        resolve('');
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve('');
    };
    img.src = objectUrl;
  });
}

export class ResumableChunkedUpload {
  private readonly file: File;
  private readonly uploaderUid: string;
  private readonly expectImageOnly: boolean;
  private readonly onProgress?: (state: UploadProgressState) => void;

  private uploadId: string | null = null;
  private nextChunkIndex = 0;
  private totalChunks: number;
  private uploadedBytes = 0;
  private abortController: AbortController | null = null;
  private cancelled = false;
  public readonly taskId: string;

  constructor(params: {
    file: File;
    uploaderUid: string;
    expectImageOnly?: boolean;
    onProgress?: (state: UploadProgressState) => void;
  }) {
    this.file = params.file;
    this.uploaderUid = params.uploaderUid;
    this.expectImageOnly = Boolean(params.expectImageOnly);
    this.onProgress = params.onProgress;
    this.totalChunks = Math.max(1, Math.ceil(this.file.size / UPLOAD_CHUNK_SIZE_BYTES));
    this.taskId = `up_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  }

  private emit(status: UploadProgressState['status'], error?: string) {
    const pct =
      this.file.size > 0
        ? Math.min(100, Math.round((this.uploadedBytes / this.file.size) * 100))
        : 0;
    this.onProgress?.({
      id: this.taskId,
      fileName: this.file.name,
      mimeType: this.file.type || 'application/octet-stream',
      totalBytes: this.file.size,
      uploadedBytes: this.uploadedBytes,
      progressPct: status === 'completed' ? 100 : pct,
      chunkIndex: this.nextChunkIndex,
      totalChunks: this.totalChunks,
      status,
      error,
    });
  }

  async run(): Promise<CompletedUploadResult> {
    const validation = validateFileClient(this.file, this.expectImageOnly);
    if (!validation.ok) {
      this.emit('failed', validation.error);
      throw new Error(validation.error);
    }

    this.cancelled = false;
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    try {
      this.emit('uploading');

      if (!this.uploadId) {
        const initRes = await fetch('/api/uploads/init', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName: this.file.name,
            mimeType: this.file.type || 'application/octet-stream',
            totalSize: this.file.size,
            totalChunks: this.totalChunks,
            uploaderUid: this.uploaderUid,
          }),
          signal,
        });
        const initBody = await initRes.json().catch(() => ({}));
        if (!initRes.ok) {
          throw new Error(initBody.error || 'Could not start upload.');
        }
        this.uploadId = initBody.uploadId;
      }

      while (this.nextChunkIndex < this.totalChunks) {
        if (this.cancelled) {
          throw new Error('Upload cancelled.');
        }
        const start = this.nextChunkIndex * UPLOAD_CHUNK_SIZE_BYTES;
        const end = Math.min(this.file.size, start + UPLOAD_CHUNK_SIZE_BYTES);
        const chunkBlob = this.file.slice(start, end);

        const chunkRes = await fetch(
          `/api/uploads/${encodeURIComponent(this.uploadId!)}/chunk/${this.nextChunkIndex}`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/octet-stream' },
            body: chunkBlob,
            signal,
          }
        );

        if (!chunkRes.ok) {
          const errBody = await chunkRes.json().catch(() => ({}));
          if (chunkRes.status === 404) {
            // Session expired on server; reset to start fresh on retry
            this.uploadId = null;
            this.nextChunkIndex = 0;
            this.uploadedBytes = 0;
          }
          throw new Error(errBody.error || `Failed uploading chunk ${this.nextChunkIndex + 1}.`);
        }

        this.nextChunkIndex += 1;
        this.uploadedBytes = end;
        this.emit('uploading');
      }

      this.emit('finalizing');
      const completeRes = await fetch(
        `/api/uploads/${encodeURIComponent(this.uploadId!)}/complete`,
        {
          method: 'POST',
          signal,
        }
      );
      const completeBody = await completeRes.json().catch(() => ({}));
      if (!completeRes.ok) {
        throw new Error(completeBody.error || 'Failed to finalize file.');
      }

      this.emit('completed');
      return completeBody as CompletedUploadResult;
    } catch (err) {
      if (this.cancelled || (err instanceof DOMException && err.name === 'AbortError')) {
        this.emit('cancelled');
        throw new Error('Upload cancelled');
      }
      const message = err instanceof Error ? err.message : 'Upload failed. Please retry.';
      this.emit('failed', message);
      throw new Error(message);
    }
  }

  async cancel(): Promise<void> {
    this.cancelled = true;
    this.abortController?.abort();
    if (this.uploadId) {
      const idToDelete = this.uploadId;
      this.uploadId = null;
      await fetch(`/api/uploads/${encodeURIComponent(idToDelete)}`, { method: 'DELETE' }).catch(
        () => {}
      );
    }
    this.emit('cancelled');
  }
}
