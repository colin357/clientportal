'use client';

interface RichTextDisplayProps {
  content: string;
  className?: string;
}

// Check if content contains HTML tags
function isHtmlContent(content: string): boolean {
  const htmlTagPattern = /<[^>]+>/;
  return htmlTagPattern.test(content);
}

// Basic sanitization to prevent XSS while preserving formatting
function sanitizeHtml(html: string): string {
  // Allow only safe tags
  const allowedTags = ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'a', 'span'];
  const allowedAttributes = ['href', 'target', 'rel', 'class'];

  // Create a temporary element to parse HTML
  if (typeof window === 'undefined') {
    return html;
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  function sanitizeNode(node: Element) {
    // Remove disallowed tags but keep their content
    const children = Array.from(node.children);
    for (const child of children) {
      if (!allowedTags.includes(child.tagName.toLowerCase())) {
        // Replace with text content
        const text = document.createTextNode(child.textContent || '');
        child.replaceWith(text);
      } else {
        // Remove disallowed attributes
        const attrs = Array.from(child.attributes);
        for (const attr of attrs) {
          if (!allowedAttributes.includes(attr.name.toLowerCase())) {
            child.removeAttribute(attr.name);
          }
        }
        // Add security attributes to links
        if (child.tagName.toLowerCase() === 'a') {
          child.setAttribute('target', '_blank');
          child.setAttribute('rel', 'noopener noreferrer');
        }
        // Recursively sanitize children
        sanitizeNode(child);
      }
    }
  }

  sanitizeNode(doc.body);
  return doc.body.innerHTML;
}

export function RichTextDisplay({ content, className }: RichTextDisplayProps) {
  if (!content) {
    return null;
  }

  // Check if it's HTML content or plain text
  if (isHtmlContent(content)) {
    const sanitizedContent = sanitizeHtml(content);
    return (
      <div
        className={`rich-text-content ${className || ''}`}
        dangerouslySetInnerHTML={{ __html: sanitizedContent }}
        style={{
          lineHeight: '1.6',
        }}
      />
    );
  }

  // Plain text - preserve whitespace
  return (
    <p className={`whitespace-pre-wrap ${className || ''}`}>
      {content}
    </p>
  );
}
