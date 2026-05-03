
const autoLinkify = (html: string) => {
  if (!html) return html;
  const urlPattern = /(?<!href="|src=")(https?:\/\/[^\s<]+|www\.[^\s<]+)(?![^<]*<\/a>)/g;
  return html.replace(urlPattern, (url) => {
    const href = url.startsWith('http') ? url : `https://${url}`;
    // Kiểm tra nếu là URL hình ảnh
    if (/\.(jpeg|jpg|png|gif|webp)(\?.*)?$/i.test(href)) {
      return `<img src="${href}" alt="Image" class="max-w-full h-auto rounded-lg my-2" />`;
    }
    return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="text-blue-600 underline cursor-pointer font-medium">${url}</a>`;
  });
};

const url = "https://scdn-ztb.gapowork.vn/gpw-s-image/images/f1bb0007-e204-455b-b1a6-4cda376ac397/Screen_Shot_2026-03-14_at_1301.jpeg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=F8UJR1YC9E5A8TZ8N5QE%2F20260314%2Fap-southeast-1%2Fs3%2Faws4_request&X-Amz-Date=20260314T075806Z&X-Amz-Expires=86400&X-Amz-SignedHeaders=host&response-content-disposition=inline%3B%20filename%3D%22Screen_Shot_2026-03-14_at_1301.jpeg%22&X-Amz-Signature=670b3e64c205705fba10f5838179d05d9969d3b62e7bcc9dfacb281873e4f3fa";

console.log(autoLinkify(url));
