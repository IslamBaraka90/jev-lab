import { useLayoutEffect, useRef, useState } from 'react';

const PASSES = 8;
const SUPPORTS_ZOOM = typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports('zoom', '0.5');

/**
 * Shrinks its content to fit the height it is given, the way a slide does. Presenter mode uses it so a
 * tall item is seen whole rather than cut off; below `floor` the text would stop being readable on a
 * recording, so past that point the box scrolls instead.
 *
 * Two things here are less obvious than they look.
 *
 * Shrinking reflows the content, so the height depends on the scale that was chosen from the height,
 * and the fixed point often does not exist: a table 642px tall at one scale is 663px at the next,
 * which asks for the first scale back, and it flips between the two for as long as anything watches.
 * So the search only ever steps *down*. It starts at full size and shrinks until the content fits,
 * which cannot cycle however the content reflows on the way, and every step is measured after it is
 * applied rather than predicted. Nothing observes the inner element either — resizing the thing you
 * are observing is the same loop by another route.
 *
 * It scales with `zoom` rather than `transform` where the browser has it. A transform rasterises the
 * text at its laid-out size and then shrinks the picture, which is what makes small tables look hazy;
 * zoom reflows, so the glyphs are drawn at the size they end up.
 */
export function FitBox({ children, className = '', floor = 0.5 }) {
  const outer = useRef(null);
  const inner = useRef(null);
  const [scale, setScale] = useState(1);
  const [natural, setNatural] = useState(0);

  useLayoutEffect(() => {
    const apply = (node, value) => {
      if (SUPPORTS_ZOOM) node.style.zoom = String(value);
      else {
        node.style.transform = `scale(${value})`;
        node.style.width = `${100 / value}%`;
      }
    };

    const fit = () => {
      const box = outer.current;
      const node = inner.current;
      if (!box || !node) return;

      const style = getComputedStyle(box);
      const available = box.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
      if (!available) return;

      let value = 1;
      let height = 0;

      for (let pass = 0; pass < PASSES; pass++) {
        apply(node, value);
        // Reading offsetHeight forces the layout, so this is the height at this very scale, not a
        // guess about it. Under zoom the value is in the element's own units, hence the multiply.
        height = node.offsetHeight;
        if (!height) return;

        const rendered = height * value;
        if (rendered <= available || value <= floor) break;

        // Step down to what the measurement says would fit, a shade under so a reflow that gains a
        // line does not immediately push it back over. Only ever smaller, so this cannot cycle.
        const next = Math.max(floor, Math.min(value - 0.005, (available / rendered) * value * 0.995));
        if (next >= value) break;
        value = Number(next.toFixed(4));
      }

      setScale(value);
      setNatural(height);
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(outer.current);
    return () => observer.disconnect();
  }, [floor, children]);

  // `zoom` shrinks the box the content really occupies, so the sizer has nothing left to correct.
  // A transform does not, so there the sizer has to stand in for the scaled height.
  const sizer = SUPPORTS_ZOOM || !natural ? undefined : Math.ceil(natural * scale);

  return (
    <div ref={outer} className={`fit-box ${className}`}>
      <div className="fit-box-sizer" style={{ height: sizer }}>
        <div ref={inner} className="fit-box-inner">
          {children}
        </div>
      </div>
    </div>
  );
}
