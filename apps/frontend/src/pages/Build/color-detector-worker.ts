self.onmessage = (event) => {
  const url = event.data.url;
  if (typeof url !== "string") {
    throw new Error("Expected url to be a string");
  }
  const canvas = new OffscreenCanvas(1, 1);
  detectColors({
    canvas,
    url: event.data.url,
  }).then((zones) => {
    self.postMessage({ zones });
  });
};

interface Block {
  x: number;
  y: number;
}

interface Group {
  blocks: Block[];
}

async function fetchBitmapFromURL(url: string) {
  const response = await fetch(url);
  const blob = await response.blob();
  const bmp = await createImageBitmap(blob);
  return bmp;
}

async function detectColors(input: { canvas: OffscreenCanvas; url: string }) {
  const { canvas, url } = input;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Expected canvas to have a 2d context");
  }
  const bitmap = await fetchBitmapFromURL(url);
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  context.drawImage(bitmap, 0, 0);
  bitmap.close();

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  const blockSize = 5;
  const rows = Math.ceil(canvas.height / blockSize);
  const cols = Math.ceil(canvas.width / blockSize);
  const detectedBlocks: boolean[][] = Array.from({ length: rows }, () =>
    Array(cols).fill(false),
  );

  const containsColor = (
    x: number,
    y: number,
    width: number,
    height: number,
  ) => {
    for (let i = y; i < y + height; i++) {
      for (let j = x; j < x + width; j++) {
        const index = (i * canvas.width + j) * 4;
        const red = data[index];

        if (red) {
          return true;
        }
      }
    }
    return false;
  };

  for (let y = 0; y < canvas.height; y += blockSize) {
    for (let x = 0; x < canvas.width; x += blockSize) {
      const row = Math.floor(y / blockSize);
      const col = Math.floor(x / blockSize);
      if (containsColor(x, y, blockSize, blockSize)) {
        detectedBlocks[row]![col] = true;
      }
    }
  }

  const findGroups = () => {
    const visited = Array.from({ length: rows }, () => Array(cols).fill(false));
    const groups: Group[] = [];

    const directions = [
      { dx: 0, dy: 1 },
      { dx: 1, dy: 0 },
      { dx: 0, dy: -1 },
      { dx: -1, dy: 0 },
    ];

    const floodFill = (row: number, col: number, group: Group) => {
      const stack = [{ row, col }];
      while (stack.length > 0) {
        const { row, col } = stack.pop()!;
        if (
          row < 0 ||
          col < 0 ||
          row >= rows ||
          col >= cols ||
          visited[row]![col] ||
          !detectedBlocks[row]![col]
        ) {
          continue;
        }
        visited[row]![col] = true;
        group.blocks.push({ x: col * blockSize, y: row * blockSize });
        for (const { dx, dy } of directions) {
          stack.push({ row: row + dy, col: col + dx });
        }
      }
    };

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (detectedBlocks[row]![col] && !visited[row]![col]) {
          const newGroup: Group = { blocks: [] };
          floodFill(row, col, newGroup);
          groups.push(newGroup);
        }
      }
    }

    return groups;
  };

  const groups = findGroups();

  context.strokeStyle = "green";
  context.lineWidth = 2;
  const rects = groups.map((group) => {
    const xs = group.blocks.map((block) => block.x);
    const ys = group.blocks.map((block) => block.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs) + blockSize;
    const maxY = Math.max(...ys) + blockSize;
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  });
  rects.forEach((rect) => {
    context.strokeRect(rect.x, rect.y, rect.width, rect.height);
  });
  return rects;
}
