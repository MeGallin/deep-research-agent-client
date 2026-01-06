const mimeTypes = {
  md: "text/markdown",
  txt: "text/plain",
  html: "text/html"
};

function sanitizeFilename(value) {
  if (!value) {
    return "";
  }
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function downloadContent({ content, filenameBase, format }) {
  const extension = format || "md";
  const safeBase = sanitizeFilename(filenameBase) || "run";
  const filename = `${safeBase}.${extension}`;
  let payload = content || "";

  if (extension === "html") {
    const hasHtmlWrapper = /<html[\s>]/i.test(payload);
    if (!hasHtmlWrapper) {
      const escaped = escapeHtml(payload);
      payload =
        "<!doctype html>\n<html>\n<head>\n<meta charset=\"UTF-8\" />\n" +
        `<title>${safeBase}</title>\n</head>\n<body>\n<pre>\n${escaped}\n</pre>\n</body>\n</html>\n`;
    }
  }

  const mimeType = mimeTypes[extension] || "text/plain";
  const blob = new Blob([payload], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
