// The Fintech Builder Open Core mark, reversed for dark backgrounds (original geometry, not redrawn).
export function Logo({ size = 48 }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width={size} height={size} role="img" aria-label="The Fintech Builder">
      <g fill="none" stroke="#FAF7F3" strokeWidth="28" strokeLinecap="butt" strokeLinejoin="miter">
        <path d="M286.5,63.4 A195,195 0 0 1 286.5,448.6" />
        <path d="M225.5,448.6 A195,195 0 0 1 225.5,63.4" />
        <path d="M218,133 L218,181 L166,217" />
        <path d="M294,133 L294,181 L346,217" />
        <path d="M218,379 L218,331 L166,295" />
        <path d="M294,379 L294,331 L346,295" />
        <path d="M134,201 L177,226 L177,286 L134,311" />
        <path d="M378,201 L335,226 L335,286 L378,311" />
      </g>
      <g fill="#FF0050">
        <path d="M247,131 L256,120 L265,131 L265,204 L256,215 L247,204 Z" />
        <path d="M247,308 L256,297 L265,308 L265,381 L256,392 L247,381 Z" />
      </g>
    </svg>
  );
}
