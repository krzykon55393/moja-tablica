import { ShapeType } from '../store/useBoardStore';

export const getShapePath = (type: ShapeType, w: number, h: number, rows = 3, cols = 3) => {
  if (type === 'rhombus') return `M ${w / 2} 0 L ${w} ${h / 2} L ${w / 2} ${h} L 0 ${h / 2} Z`;
  if (type === 'triangle') return `M ${w / 2} 0 L ${w} ${h} L 0 ${h} Z`;
  if (type === 'rtriangle') return `M 0 0 L 0 ${h} L ${w} ${h} Z`;
  if (type === 'trapezoid') return `M ${w * 0.34} 0 L ${w * 0.66} 0 L ${w} ${h} L 0 ${h} Z`;
  if (type === 'rtrapezoid') return `M 0 0 L ${w * 0.62} 0 L ${w} ${h} L 0 ${h} Z`;
  if (type === 'hexagon') return `M ${w * 0.25} 0 L ${w * 0.75} 0 L ${w} ${h / 2} L ${w * 0.75} ${h} L ${w * 0.25} ${h} L 0 ${h / 2} Z`;
  if (type === 'pentagon') return `M ${w / 2} 0 L ${w} ${h * 0.4} L ${w * 0.8} ${h} L ${w * 0.2} ${h} L 0 ${h * 0.4} Z`;
  if (type === 'table') {
    let d = `M 0 0 L ${w} 0 L ${w} ${h} L 0 ${h} Z`;
    for (let row = 1; row < rows; row += 1) d += ` M 0 ${(h / rows) * row} L ${w} ${(h / rows) * row}`;
    for (let col = 1; col < cols; col += 1) d += ` M ${(w / cols) * col} 0 L ${(w / cols) * col} ${h}`;
    return d;
  }
  if (type === 'cube') return `M 0 ${h * 0.3} L ${w * 0.7} ${h * 0.3} L ${w * 0.7} ${h} L 0 ${h} Z M ${w * 0.3} 0 L ${w} 0 L ${w} ${h * 0.7} L ${w * 0.3} ${h * 0.7} Z M 0 ${h * 0.3} L ${w * 0.3} 0 M ${w * 0.7} ${h * 0.3} L ${w} 0 M ${w * 0.7} ${h} L ${w} ${h * 0.7} M 0 ${h} L ${w * 0.3} ${h * 0.7}`;
  if (type === 'prism3') return `M 0 ${h} L ${w * 0.7} ${h} L ${w * 0.35} ${h * 0.7} Z M 0 ${h * 0.3} L ${w * 0.7} ${h * 0.3} L ${w * 0.35} 0 Z M 0 ${h * 0.3} L 0 ${h} M ${w * 0.7} ${h * 0.3} L ${w * 0.7} ${h} M ${w * 0.35} 0 L ${w * 0.35} ${h * 0.7}`;
  if (type === 'prism6') return `M ${w * 0.2} ${h * 0.1} L ${w * 0.8} ${h * 0.1} L ${w} ${h * 0.2} L ${w * 0.8} ${h * 0.3} L ${w * 0.2} ${h * 0.3} L 0 ${h * 0.2} Z M ${w * 0.2} ${h * 0.8} L ${w * 0.8} ${h * 0.8} L ${w} ${h * 0.9} L ${w * 0.8} ${h} L ${w * 0.2} ${h} L 0 ${h * 0.9} Z M ${w * 0.2} ${h * 0.1} L ${w * 0.2} ${h * 0.8} M ${w * 0.8} ${h * 0.1} L ${w * 0.8} ${h * 0.8} M ${w} ${h * 0.2} L ${w} ${h * 0.9} M 0 ${h * 0.2} L 0 ${h * 0.9} M ${w * 0.8} ${h * 0.3} L ${w * 0.8} ${h} M ${w * 0.2} ${h * 0.3} L ${w * 0.2} ${h}`;
  if (type === 'pyr4') return `M 0 ${h * 0.8} L ${w * 0.7} ${h * 0.8} L ${w} ${h} L ${w * 0.3} ${h} Z M 0 ${h * 0.8} L ${w * 0.5} 0 M ${w * 0.7} ${h * 0.8} L ${w * 0.5} 0 M ${w} ${h} L ${w * 0.5} 0 M ${w * 0.3} ${h} L ${w * 0.5} 0`;
  if (type === 'pyr3') return `M 0 ${h * 0.9} L ${w * 0.8} ${h * 0.8} L ${w} ${h} Z M 0 ${h * 0.9} L ${w * 0.5} 0 M ${w * 0.8} ${h * 0.8} L ${w * 0.5} 0 M ${w} ${h} L ${w * 0.5} 0`;
  if (type === 'pyr6') return `M ${w * 0.2} ${h * 0.8} L ${w * 0.8} ${h * 0.8} L ${w} ${h * 0.9} L ${w * 0.8} ${h} L ${w * 0.2} ${h} L 0 ${h * 0.9} Z M ${w * 0.2} ${h * 0.8} L ${w * 0.5} 0 M ${w * 0.8} ${h * 0.8} L ${w * 0.5} 0 M ${w} ${h * 0.9} L ${w * 0.5} 0 M ${w * 0.8} ${h} L ${w * 0.5} 0 M ${w * 0.2} ${h} L ${w * 0.5} 0 M 0 ${h * 0.9} L ${w * 0.5} 0`;
  if (type === 'cone') return `M 0 ${h * 0.9} A ${w / 2} ${h * 0.1} 0 1 0 ${w} ${h * 0.9} A ${w / 2} ${h * 0.1} 0 1 0 0 ${h * 0.9} M 0 ${h * 0.9} L ${w / 2} 0 L ${w} ${h * 0.9}`;
  if (type === 'cylinder') return `M 0 ${h * 0.1} A ${w / 2} ${h * 0.1} 0 1 0 ${w} ${h * 0.1} A ${w / 2} ${h * 0.1} 0 1 0 0 ${h * 0.1} M 0 ${h * 0.1} L 0 ${h * 0.9} A ${w / 2} ${h * 0.1} 0 1 0 ${w} ${h * 0.9} L ${w} ${h * 0.1} M 0 ${h * 0.9} A ${w / 2} ${h * 0.1} 0 1 1 ${w} ${h * 0.9}`;
  if (type === 'sphere') return `M 0 ${h / 2} A ${w / 2} ${h / 2} 0 1 0 ${w} ${h / 2} A ${w / 2} ${h / 2} 0 1 0 0 ${h / 2} M 0 ${h / 2} A ${w / 2} ${h * 0.15} 0 1 0 ${w} ${h / 2} A ${w / 2} ${h * 0.15} 0 1 0 0 ${h / 2}`;
  return '';
};
