import { useLayoutEffect, useRef, useState } from 'react';

/**
 * Shrinks its content to fit the height it is given, the way a slide does. Presenter mode uses it so a
 * tall item is seen whole rather than cut off; below `floor` the text would stop being readable on a
 * recording, so past that point the box scrolls instead.
 */
export function FitBox({ children, className = '', floor = 0.5 }) {
  const outer = useRef(null);
  const inner = useRef(null);
  const [scale, setScale] = useState(1);
  const [natural, setNatural] = useState(0);

  useLayoutEffect(() => {
    const measure = () => {
      if (!outer.current || !inner.current) return;
      const style = getComputedStyle(outer.current);
      const available = outer.current.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
      const natural = inner.current.offsetHeight;
      if (!available || !natural) return;
      // The content is laid out at 1/scale of the box's width, so its height is measured at that width.
      const next = Math.max(floor, Math.min(1, available / natural));
      setNatural(natural);
      setScale((current) => (Math.abs(current - next) > 0.01 ? Number(next.toFixed(3)) : current));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(outer.current);
    observer.observe(inner.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={outer} className={`fit-box ${className}`}>
      {/* A transform does not shrink the space an element takes, so the sizer holds the scaled height. */}
      <div className="fit-box-sizer" style={{ height: natural ? Math.ceil(natural * scale) : undefined }}>
        <div ref={inner} className="fit-box-inner" style={{ transform: `scale(${scale})`, width: `${100 / scale}%` }}>
          {children}
        </div>
      </div>
    </div>
  );
}
