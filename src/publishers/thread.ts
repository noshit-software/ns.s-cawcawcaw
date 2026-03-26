/** Split text into thread chunks at sentence or word boundaries. */
export function splitThread(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text];

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxChars) {
      chunks.push(remaining.trim());
      break;
    }

    // Find best split point: last sentence-ending punctuation within limit
    let splitAt = -1;
    const searchZone = remaining.slice(0, maxChars);

    // Try splitting at sentence boundaries (. ! ? followed by space or newline)
    for (let j = searchZone.length - 1; j >= maxChars * 0.4; j--) {
      if ('.!?\n'.includes(searchZone[j]) && (j + 1 >= searchZone.length || ' \n\t'.includes(searchZone[j + 1]))) {
        splitAt = j + 1;
        break;
      }
    }

    // Fall back to last space
    if (splitAt === -1) {
      splitAt = searchZone.lastIndexOf(' ');
    }

    // Last resort: hard cut
    if (splitAt <= 0) {
      splitAt = maxChars;
    }

    chunks.push(remaining.slice(0, splitAt).trim());
    remaining = remaining.slice(splitAt).trim();
  }

  return chunks;
}
