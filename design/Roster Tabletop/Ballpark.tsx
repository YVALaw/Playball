import { useEffect, useRef } from "react";

export function Ballpark({ tick }: { tick: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return undefined;
    let frame = 0;
    const draw = (time: number) => {
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.round(rect.width * ratio));
      const height = Math.max(1, Math.round(rect.height * ratio));
      if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      const w = rect.width;
      const h = rect.height;
      context.fillStyle = "#2f7949";
      context.fillRect(0, 0, w, h);
      context.fillStyle = "#1f5d39";
      context.beginPath(); context.moveTo(w * 0.04, h); context.lineTo(w * 0.5, h * 0.07); context.lineTo(w * 0.96, h); context.closePath(); context.fill();
      context.fillStyle = "#a8734a";
      context.beginPath(); context.moveTo(w * 0.19, h); context.lineTo(w * 0.5, h * 0.34); context.lineTo(w * 0.81, h); context.closePath(); context.fill();
      context.fillStyle = "#c89468";
      context.beginPath(); context.arc(w * 0.5, h * 0.62, Math.min(w, h) * 0.22, 0, Math.PI * 2); context.fill();
      [[0.5, 0.82], [0.67, 0.62], [0.5, 0.43], [0.33, 0.62]].forEach(([x, y]) => { context.save(); context.translate(w * x, h * y); context.rotate(Math.PI / 4); context.fillStyle = "#fff3dd"; context.fillRect(-5, -5, 10, 10); context.restore(); });
      [[0.5, 0.78, "#eee4cc"], [0.48, 0.65, "#132f22"], [0.61, 0.61, "#132f22"], [0.37, 0.61, "#132f22"], [0.5, 0.48, "#132f22"], [0.2, 0.34, "#132f22"], [0.8, 0.34, "#132f22"], [0.5, 0.22, "#132f22"]].forEach(([x, y, color]) => { context.fillStyle = String(color); context.beginPath(); context.arc(w * Number(x), h * Number(y), 5, 0, Math.PI * 2); context.fill(); });
      const progress = ((time / 1400) + tick * 0.16) % 1;
      context.fillStyle = "#fff4df";
      context.beginPath(); context.arc(w * (0.46 + progress * 0.28), h * (0.72 - Math.sin(progress * Math.PI) * 0.44), 4, 0, Math.PI * 2); context.fill();
      context.fillStyle = "#17251d"; context.fillRect(w * 0.39, h * 0.1, w * 0.22, 22);
      context.fillStyle = "#d7e5d8"; context.font = "700 8px sans-serif"; context.textAlign = "center"; context.fillText("HARBOR FIELD", w * 0.5, h * 0.1 + 14);
      frame = window.requestAnimationFrame(draw);
    };
    frame = window.requestAnimationFrame(draw);
    return () => window.cancelAnimationFrame(frame);
  }, [tick]);

  return <div className="ballpark-scene" aria-label="Live ballpark view"><canvas ref={canvasRef} /><div className="ballpark-situation"><span>RUNNERS ON 1ST / 3RD</span><b>2 OUT</b></div></div>;
}
