import * as el from './elements';

const DEVICES: Record<string, { w: number | null; h: number | null }> = {
  desktop: { w: null, h: null },
  laptop:  { w: 1280, h: 800  },
  tablet:  { w: 768,  h: 1024 },
  mobilel: { w: 425,  h: 812  },
  mobiles: { w: 375,  h: 667  },
};

export function applyDevice(key: string) {
  const preset = DEVICES[key];
  if (!preset) { return; }

  if (!preset.w) {
    el.deviceFrame.classList.remove('emulated');
    el.deviceFrame.style.width = el.deviceFrame.style.height = '';
    el.frame.style.width       = el.frame.style.height       = '';
  } else {
    el.deviceFrame.classList.add('emulated');
    el.deviceFrame.style.width  = el.frame.style.width  = `${preset.w}px`;
    el.deviceFrame.style.height = el.frame.style.height = `${preset.h}px`;
  }
}
