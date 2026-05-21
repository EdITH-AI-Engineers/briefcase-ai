import { useEffect, useRef, useState, type ReactNode } from "react";

export function Popover({ trigger, children }: { trigger: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<number | null>(null);
  const openTimer = useRef<number | null>(null);

  const cancelClose = () => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  const cancelOpen = () => {
    if (openTimer.current !== null) {
      window.clearTimeout(openTimer.current);
      openTimer.current = null;
    }
  };

  const openPopover = () => {
    cancelClose();
    cancelOpen();
    openTimer.current = window.setTimeout(() => setOpen(true), 120);
  };

  const scheduleClose = () => {
    cancelOpen();
    cancelClose();
    closeTimer.current = window.setTimeout(() => setOpen(false), 120);
  };

  useEffect(() => () => {
    cancelOpen();
    cancelClose();
  }, []);

  return (
    <span
      className="popover-root"
      onMouseEnter={() => {
        openPopover();
      }}
      onMouseLeave={scheduleClose}
      onFocus={() => {
        cancelOpen();
        cancelClose();
        setOpen(true);
      }}
      onBlur={scheduleClose}
      tabIndex={0}
    >
      {trigger}
      {open && (
        <span
          role="tooltip"
          className="popover-body"
          onMouseEnter={() => {
            cancelClose();
            setOpen(true);
          }}
          onMouseLeave={scheduleClose}
        >
          {children}
        </span>
      )}
    </span>
  );
}
