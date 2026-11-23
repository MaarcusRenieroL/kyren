import { apiPath } from "~/src/lib/paths";

/** Uploads one file with progress, answering with its stored id. */
export function uploadFile(file: File, onProgress: (value: number) => void) {
  return new Promise<{ id: string }>((resolve, reject) => {
    const request = new XMLHttpRequest();
    const form = new FormData();

    form.append("file", file);
    request.open("POST", apiPath("/api/files"));
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    request.onload = () => {
      try {
        const data = JSON.parse(request.responseText) as {
          id?: string;
          error?: string;
        };

        if (request.status >= 200 && request.status < 300 && data.id) {
          resolve({ id: data.id });
        } else {
          reject(new Error(data.error ?? "Could not upload the file."));
        }
      } catch {
        reject(new Error("Could not upload the file."));
      }
    };
    request.onerror = () => reject(new Error("The upload was interrupted."));
    request.send(form);
  });
}
