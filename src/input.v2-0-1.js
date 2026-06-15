// nncckkrr input: WASD by event.code, mouse aim, edge-triggered actions
export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.mouseX = 0; this.mouseY = 0;
    this.fire = false;
    this.dashEdge = false;
    this.interEdge = false;
    this.weaponSel = -1;
    this.tabHeld = false;
    this.escEdge = false;
    this.numEdge = -1;   // 1/2/3 pressed this frame (for modals)
    this.blocked = false; // modal open: block game actions

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const c = e.code;
      if (c === 'Tab') { e.preventDefault(); this.tabHeld = true; return; }
      if (c === 'Escape') { this.escEdge = true; return; }
      if (c === 'Digit1' || c === 'Digit2' || c === 'Digit3') {
        this.numEdge = Number(c.slice(5)) - 1;
        if (!this.blocked) this.weaponSel = this.numEdge;
        return;
      }
      if (this.blocked) return;
      this.keys.add(c);
      if (c === 'ShiftLeft' || c === 'ShiftRight') this.dashEdge = true;
      if (c === 'KeyE') this.interEdge = true;
      if (c === 'Space') { e.preventDefault(); this.fire = true; }
    });
    window.addEventListener('keyup', (e) => {
      const c = e.code;
      if (c === 'Tab') { e.preventDefault(); this.tabHeld = false; return; }
      this.keys.delete(c);
      if (c === 'Space') this.fire = false;
    });
    window.addEventListener('blur', () => { this.keys.clear(); this.fire = false; this.tabHeld = false; });

    canvas.addEventListener('mousemove', (e) => { this.mouseX = e.clientX; this.mouseY = e.clientY; });
    canvas.addEventListener('mousedown', (e) => { if (e.button === 0 && !this.blocked) this.fire = true; });
    window.addEventListener('mouseup', (e) => { if (e.button === 0) this.fire = false; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('wheel', (e) => {
      if (this.blocked) return;
      this.wheelDir = e.deltaY > 0 ? 1 : -1;
    }, { passive: true });
    this.wheelDir = 0;
  }

  moveVec() {
    if (this.blocked) return { x: 0, y: 0 };
    let x = 0, y = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) y -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) y += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
    const l = Math.hypot(x, y);
    return l > 0 ? { x: x / l, y: y / l } : { x: 0, y: 0 };
  }

  // consume edges (call once per send tick)
  takeDash() { const v = this.dashEdge; this.dashEdge = false; return v; }
  takeInter() { const v = this.interEdge; this.interEdge = false; return v; }
  takeWeapon(count) {
    let w = this.weaponSel; this.weaponSel = -1;
    if (this.wheelDir !== 0 && count > 0) {
      w = ((this._lastW ?? 0) + this.wheelDir + count) % count;
      this.wheelDir = 0;
    }
    if (w >= 0) this._lastW = w;
    return w;
  }
  takeEsc() { const v = this.escEdge; this.escEdge = false; return v; }
  takeNum() { const v = this.numEdge; this.numEdge = -1; return v; }
}
