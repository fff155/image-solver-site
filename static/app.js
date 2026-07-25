const dropzone = document.querySelector("#dropzone");
const fileInput = document.querySelector("#file-input");
const preview = document.querySelector("#preview");
const emptyUpload = document.querySelector("#empty-upload");
const replaceLabel = document.querySelector("#replace-label");
const fileName = document.querySelector("#file-name");
const fileSize = document.querySelector("#file-size");
const cowMarker = new Image();
const cowMarkerReady = new Promise((resolve) => {
  cowMarker.onload = () => resolve(true);
  cowMarker.onerror = () => resolve(false);
});
cowMarker.src = "/static/assets/cow-marker.png";

const sections = {
  empty: document.querySelector("#empty-answer"),
  loading: document.querySelector("#loading-answer"),
  error: document.querySelector("#error-answer"),
  result: document.querySelector("#result-answer"),
};

function showSection(name) {
  Object.entries(sections).forEach(([key, element]) => {
    element.hidden = key !== name;
  });
}

function formatBytes(bytes) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

async function drawAnswer(result) {
  const hasCowMarker = await cowMarkerReady;
  const canvas = document.querySelector("#answer-canvas");
  const displaySize = 760;
  const scale = 2;
  canvas.width = displaySize * scale;
  canvas.height = displaySize * scale;
  const context = canvas.getContext("2d");
  context.scale(scale, scale);
  const cell = displaySize / result.size;

  result.board.forEach((row, y) => {
    row.forEach((color, x) => {
      context.fillStyle = result.colors[color];
      context.fillRect(x * cell, y * cell, cell + 0.5, cell + 0.5);
      context.strokeStyle = "rgba(255,255,255,.48)";
      context.lineWidth = Math.max(1, cell * 0.018);
      context.strokeRect(x * cell, y * cell, cell, cell);

      if (result.answer[y][x]) {
        const centerX = (x + 0.5) * cell;
        const centerY = (y + 0.5) * cell;
        if (hasCowMarker) {
          const markerSize = cell * 0.92;
          context.save();
          context.shadowColor = "rgba(23, 32, 30, 0.72)";
          context.shadowBlur = Math.max(2, cell * 0.055);
          context.shadowOffsetY = Math.max(1, cell * 0.018);
          context.drawImage(
            cowMarker,
            centerX - markerSize / 2,
            centerY - markerSize / 2,
            markerSize,
            markerSize,
          );
          context.restore();
        } else {
          const radius = cell * 0.27;
          context.beginPath();
          context.arc(centerX, centerY, radius, 0, Math.PI * 2);
          context.fillStyle = "#17201e";
          context.fill();
          context.fillStyle = "#ffffff";
          context.font =
            `700 ${Math.max(13, cell * 0.23)}px sans-serif`;
          context.textAlign = "center";
          context.textBaseline = "middle";
          context.fillText("牛", centerX, centerY + 1);
        }
      }
    });
  });
}

async function renderResult(result) {
  await drawAnswer(result);
  document.querySelector("#board-size").textContent =
    `${result.size}×${result.size}`;
  document.querySelector("#color-count").textContent =
    result.colors.length;
  document.querySelector("#answer-count").textContent =
    result.coordinates.length;

  const coordinates = document.querySelector("#coordinates");
  coordinates.replaceChildren(
    ...result.coordinates.map((item, index) => {
      const row = document.createElement("span");
      const dot = document.createElement("i");
      dot.style.backgroundColor = result.colors[item.color];
      const number = document.createElement("small");
      number.textContent = String(index + 1).padStart(2, "0");
      const value = document.createElement("b");
      value.textContent =
        `第 ${item.row} 行 · 第 ${item.column} 列`;
      row.append(dot, number, value);
      return row;
    }),
  );
  showSection("result");
}

async function uploadAndSolve(file) {
  if (!file.type.startsWith("image/")) {
    document.querySelector("#error-message").textContent =
      "请选择 PNG、JPG 或 WebP 图片";
    showSection("error");
    return;
  }
  if (file.size > 12 * 1024 * 1024) {
    document.querySelector("#error-message").textContent =
      "图片不能超过 12MB";
    showSection("error");
    return;
  }

  const previewUrl = URL.createObjectURL(file);
  preview.onload = () => URL.revokeObjectURL(previewUrl);
  preview.src = previewUrl;
  preview.hidden = false;
  emptyUpload.hidden = true;
  replaceLabel.hidden = false;
  fileName.textContent = file.name;
  fileSize.textContent = formatBytes(file.size);
  showSection("loading");

  const form = new FormData();
  form.append("image", file);

  try {
    const response = await fetch("/api/solve", {
      method: "POST",
      body: form,
    });
    const result = await response.json();
    if (!response.ok || !result.ok) {
      throw new Error(result.error || "识别失败");
    }
    await renderResult(result);
  } catch (error) {
    document.querySelector("#error-message").textContent =
      error.message || "服务器暂时无法处理图片";
    showSection("error");
  }
}

function getClipboardImage(clipboardData) {
  if (!clipboardData?.items) return null;

  const imageItem = Array.from(clipboardData.items).find(
    (item) =>
      item.kind === "file" && item.type.startsWith("image/"),
  );
  if (!imageItem) return null;

  const image = imageItem.getAsFile();
  if (!image) return null;

  const extensionByType = {
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "image/png": "png",
  };
  const extension = extensionByType[image.type] || "png";
  const timestamp = new Date()
    .toISOString()
    .replaceAll(":", "-")
    .replace(/\.\d{3}Z$/, "");

  return new File(
    [image],
    `剪贴板截图-${timestamp}.${extension}`,
    {
      type: image.type || "image/png",
      lastModified: Date.now(),
    },
  );
}

dropzone.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", () => {
  if (fileInput.files[0]) uploadAndSolve(fileInput.files[0]);
});

dropzone.addEventListener("dragover", (event) => {
  event.preventDefault();
  dropzone.classList.add("dragging");
});
dropzone.addEventListener("dragleave", () => {
  dropzone.classList.remove("dragging");
});
dropzone.addEventListener("drop", (event) => {
  event.preventDefault();
  dropzone.classList.remove("dragging");
  if (event.dataTransfer.files[0]) {
    uploadAndSolve(event.dataTransfer.files[0]);
  }
});

document.addEventListener("paste", (event) => {
  const image = getClipboardImage(event.clipboardData);
  if (!image) return;

  event.preventDefault();
  dropzone.classList.add("pasting");
  window.setTimeout(
    () => dropzone.classList.remove("pasting"),
    500,
  );
  uploadAndSolve(image);
});
