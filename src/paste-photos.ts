import { validatePhotos } from "./ticket-submission.ts";

export function pastedPhotos(items: ArrayLike<DataTransferItem>): File[] {
  return Array.from(items).filter(item => item.kind === "file" && item.type.startsWith("image/"))
    .map(item => item.getAsFile()).filter((file): file is File => file !== null)
    .map(file => new File([file], `Screenshot-${Date.now()}-${crypto.randomUUID().slice(0,8)}.${file.type === "image/jpeg" ? "jpg" : file.type === "image/webp" ? "webp" : "png"}`, { type: file.type }));
}

export function appendReplyPhotos(current: File[], additions: File[]) {
  const next = [...current, ...additions];
  validatePhotos(next);
  return next;
}
