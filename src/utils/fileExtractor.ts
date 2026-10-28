// Utility to extract Files and their relative paths from DataTransferItemList (Drag & Drop folders)
export interface ExtractedFile {
  file: File;
  relativePath: string;
}

const IMAGE_EXTENSIONS = /\.(jpe?g|png|webp|avif|gif|bmp|svg|tiff?)$/i;

export function isImageFile(file: File): boolean {
  if (file.type.startsWith('image/')) return true;
  return IMAGE_EXTENSIONS.test(file.name);
}

export async function extractFilesFromDataTransfer(items: DataTransferItemList): Promise<ExtractedFile[]> {
  const results: ExtractedFile[] = [];
  const entries: FileSystemEntry[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.kind === 'file') {
      const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
      if (entry) {
        entries.push(entry);
      } else {
        const f = item.getAsFile();
        if (f && isImageFile(f)) {
          results.push({ file: f, relativePath: f.name });
        }
      }
    }
  }

  async function traverseEntry(entry: FileSystemEntry, pathPrefix = ''): Promise<void> {
    if (entry.isFile) {
      const fileEntry = entry as FileSystemFileEntry;
      const file = await new Promise<File>((resolve, reject) => {
        fileEntry.file(resolve, reject);
      });
      if (isImageFile(file)) {
        const rel = pathPrefix ? `${pathPrefix}/${file.name}` : file.name;
        results.push({ file, relativePath: rel });
      }
    } else if (entry.isDirectory) {
      const dirEntry = entry as FileSystemDirectoryEntry;
      const reader = dirEntry.createReader();
      const readAllEntries = async (): Promise<FileSystemEntry[]> => {
        const all: FileSystemEntry[] = [];
        let batch: FileSystemEntry[] = [];
        do {
          batch = await new Promise<FileSystemEntry[]>((resolve, reject) => {
            reader.readEntries(resolve, reject);
          });
          all.push(...batch);
        } while (batch.length > 0);
        return all;
      };

      const children = await readAllEntries();
      const nextPrefix = pathPrefix ? `${pathPrefix}/${dirEntry.name}` : dirEntry.name;
      for (const child of children) {
        await traverseEntry(child, nextPrefix);
      }
    }
  }

  for (const entry of entries) {
    await traverseEntry(entry, '');
  }

  return results;
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'Ko', 'Mo', 'Go'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
