"use client";

import { useRef, useState } from "react";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { clientStorage } from "@/lib/firebase/client";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/FormError";

export type UploadedImage = { url: string; storagePath: string };

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE_BYTES = 8 * 1024 * 1024;

/**
 * Direct-to-Firebase-Storage admin image upload (T148, research.md §11):
 * the file goes straight from the admin's browser to Storage via the
 * Firebase Client SDK — never proxied through a Server Action/Next.js
 * route, avoiding the platform's request-body size limits for large image
 * files. `storage.rules` (T147) is the actual authority on who may write
 * and what content-type/size is accepted; this component's own checks are
 * a UX convenience only (Constitution Principle 13).
 */
export function ImageUploader({
  folder,
  onUploaded,
  disabled,
}: {
  /** e.g. `products/{productId}` or `showcases/{showcaseId}`. */
  folder: string;
  onUploaded: (image: UploadedImage) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setError(null);

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError("Only JPEG, PNG, or WEBP images are allowed.");
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      setError("Image must be smaller than 8MB.");
      return;
    }

    setIsUploading(true);
    try {
      const storagePath = `${folder}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const fileRef = storageRef(clientStorage, storagePath);
      await uploadBytes(fileRef, file, { contentType: file.type });
      const url = await getDownloadURL(fileRef);
      onUploaded({ url, storagePath });
    } catch {
      setError("Upload failed. Please try again.");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(",")}
        onChange={handleFileChange}
        className="hidden"
        disabled={disabled || isUploading}
      />
      <Button
        type="button"
        variant="outline"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || isUploading}
      >
        {isUploading ? "Uploading…" : "Upload Image"}
      </Button>
      <FormError message={error} />
    </div>
  );
}
