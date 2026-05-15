export const fitImageToViewport = (
  width: number,
  height: number,
  stageScale = 1,
  maxViewportRatio = 0.62,
) => {
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  const safeScale = Math.max(0.1, stageScale || 1);
  const viewportWidth = typeof window === 'undefined' ? 1200 : window.innerWidth;
  const viewportHeight = typeof window === 'undefined' ? 800 : window.innerHeight;
  const maxWidth = Math.max(160, (viewportWidth * maxViewportRatio) / safeScale);
  const maxHeight = Math.max(120, (viewportHeight * maxViewportRatio) / safeScale);
  const ratio = Math.min(1, maxWidth / safeWidth, maxHeight / safeHeight);

  return {
    width: Math.round(safeWidth * ratio),
    height: Math.round(safeHeight * ratio),
  };
};
