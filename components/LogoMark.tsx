export function LogoMark({ size = 44, opacity = 1 }: { size?: number; opacity?: number }) {
  return (
    <img
      src="/logo-mark-transparent.png"
      alt="Linezheets"
      width={size}
      height={size}
      style={{
        width: size,
        height: size,
        objectFit: 'contain',
        flexShrink: 0,
        opacity,
        display: 'block',
      }}
    />
  );
}
