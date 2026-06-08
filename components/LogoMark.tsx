export function LogoMark({ size = 44, opacity = 1 }: { size?: number; opacity?: number }) {
  const MARK = { x0: 415, y0: 63, w: 553, h: 467 };
  const scale = size / MARK.h;
  const bgW   = Math.round(1382 * scale);
  const bgH   = Math.round(768  * scale);
  const offX  = -Math.round(MARK.x0 * scale);
  const offY  = -Math.round(MARK.y0 * scale);
  const width = Math.round(MARK.w  * scale);
  return (
    <div
      style={{
        width,
        height: size,
        flexShrink: 0,
        opacity,
        overflow: 'hidden',
        backgroundImage: 'url(/linezheets-logo.png)',
        backgroundSize: `${bgW}px ${bgH}px`,
        backgroundPosition: `${offX}px ${offY}px`,
        backgroundRepeat: 'no-repeat',
      }}
      aria-label="Linezheets"
      role="img"
    />
  );
}
