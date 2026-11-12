// Model space uses X across the wings, Y up and Z toward the nose.
const paint = {
  falcon: { top: '#ecede5', mid: '#9aafba', dark: '#465567', line: '#273644', stripe: '#fa6636', light: '#ffaf5e', glass: '#368c9d', gleam: '#a5f4ee', engine: '#58d9ff' },
  wraith: { top: '#a0a6c5', mid: '#595e84', dark: '#33334e', line: '#222536', stripe: '#9165f1', light: '#dcb6ff', glass: '#7950ac', gleam: '#dbbbfc', engine: '#b07cff' },
  bastion: { top: '#ae6562', mid: '#874146', dark: '#49343f', line: '#292e3a', stripe: '#d6a16a', light: '#ffc888', glass: '#427b88', gleam: '#a7e6ec', engine: '#ffc573' },
  drone: { top: '#ec8880', mid: '#ae525d', dark: '#5b3447', line: '#382d3c', stripe: '#ffb178', light: '#ffc47b', glass: '#9e4c4a', gleam: '#ffbc83', engine: '#ff8064' },
  guard: { top: '#be819d', mid: '#865473', dark: '#4e354c', line: '#332938', stripe: '#f4ab6f', light: '#ffcb8c', glass: '#ae5468', gleam: '#ffc486', engine: '#ff8757' },
  warden: { top: '#ab8a89', mid: '#786678', dark: '#463949', line: '#2d2939', stripe: '#e59c53', light: '#ffe7a8', glass: '#d86741', gleam: '#fff2a0', engine: '#ff996a' }
};
const shapes = {
  falcon: { length: 1.98, span: 1.65, sweep: -.76, width: .35, pods: .53, radius: .205, tails: true },
  wraith: { length: 2.54, span: 1.47, sweep: -1.14, width: .28, pods: 0, radius: .32, tails: false },
  bastion: { length: 1.53, span: 1.86, sweep: -.38, width: .46, pods: .83, radius: .31, tails: true },
  drone: { length: 1.70, span: 1.23, sweep: -.85, width: .27, pods: .35, radius: .15, tails: false },
  guard: { length: 1.42, span: 1.51, sweep: -.35, width: .40, pods: .70, radius: .25, tails: true },
  warden: { length: 1.47, span: 2.18, sweep: .05, width: .57, pods: 1.06, radius: .35, tails: true }
};

function makeModel(type) {
  const c = paint[type], d = shapes[type], faces = [], exhaust = [];
  const face = (color, ...pts) => faces.push({ color, pts });
  const ring = (x, z, w, bottom, top) => [
    [x - w, 0, z], [x - w * .58, top * .84, z], [x, top, z], [x + w * .58, top * .84, z],
    [x + w, 0, z], [x + w * .65, bottom, z], [x - w * .65, bottom, z]
  ];
  function hull(rings, colors) {
    for (let j = 1; j < rings.length; j++) {
      const a = rings[j - 1], b = rings[j];
      for (let i = 0; i < a.length; i++) {
        const n = (i + 1) % a.length;
        face(colors[i % colors.length], a[i], a[n], b[n], b[i]);
      }
    }
    face(c.line, ...rings[0]);
    face(colors[1], ...rings[rings.length - 1]);
  }
  const w = d.width, l = d.length;
  hull([ring(0, -1.12, w * .73, -.21, .19), ring(0, -.55, w * 1.15, -.27, .32), ring(0, .25, w, -.24, .34), ring(0, l * .66, w * .48, -.11, .15), ring(0, l, .025, -.026, .035)],
    [c.mid, c.top, c.top, c.mid, c.dark, c.line, c.dark]);

  for (const sign of [-1, 1]) {
    const wing = (color, ...pts) => face(color, ...pts.map(([x, y, z]) => [sign * x, y, z]));
    const span = d.span, back = d.sweep;
    const root = [w * .64, .075, .85], tip = [span, .016, back], tail = [span * .78, .023, back - .28];
    const inner = [w * .8, .021, -.97], ridge = [span * .57, .108, -.28];
    wing(c.dark, [root[0], -.035, root[2]], [tip[0], -.09, tip[2]], [tail[0], -.09, tail[2]], [inner[0], -.08, inner[2]]);
    wing(c.mid, root, tip, ridge);
    wing(c.top, root, ridge, inner);
    wing(c.mid, ridge, tip, tail, inner);
    wing(c.dark, tip, tail, [tail[0], -.09, tail[2]], [tip[0], -.09, tip[2]]);
    wing(c.stripe, [w * 1.21, .127, .27], [span * .90, .057, back + .02], [span * .80, .083, back - .06], [w * 1.10, .13, .14]);
    wing(c.light, [span * .72, .09, back + .14], [span * .93, .055, back - .005], [span * .89, .068, back - .04]);
    wing(c.line, [w * .99, .085, -.5], [span * .63, .098, -.52], [span * .69, .084, -.58], [w * 1.03, .082, -.56]);
    if (d.tails) {
      const bx = Math.max(.40, d.pods), finHeight = type === 'warden' ? .74 : .61;
      wing(c.mid, [bx, .14, -.32], [bx + .22, finHeight, -.89], [bx + .18, finHeight + .03, -1.14], [bx - .04, .1, -1.01]);
      wing(c.top, [bx + .018, .14, -.33], [bx + .23, finHeight + .023, -.90], [bx + .18, finHeight + .04, -1.13]);
      wing(c.stripe, [bx + .15, finHeight * .76, -.77], [bx + .223, finHeight, -.91], [bx + .186, finHeight, -1.03]);
    }
    if (d.pods) {
      const x = sign * d.pods, r = d.radius, pz = type === 'bastion' || type === 'warden' ? .89 : .4;
      hull([ring(x, -1.20, r * .83, -r * .64, r * .65), ring(x, -.91, r, -r, r * 1.09), ring(x, .13, r * .94, -r * .8, r * 1.01), ring(x, pz, r * .70, -r * .72, r * .76)],
        [c.dark, c.mid, c.top, c.mid, c.dark, c.line, c.dark]);
      wing(c.stripe, [d.pods - r * .16, r * 1.13, -.85], [d.pods + r * .17, r * 1.13, -.85], [d.pods + r * .17, r * 1.05, .09], [d.pods - r * .16, r * 1.05, .09]);
      wing(c.line, [d.pods - r * .58, r * .68, pz + .012], [d.pods + r * .58, r * .68, pz + .012], [d.pods + r * .52, -r * .46, pz + .02], [d.pods - r * .52, -r * .46, pz + .02]);
      exhaust.push({ x, y: 0, z: -1.24, r});
    }
  }
  if (!d.pods) {
    hull([ring(0, -1.31, .31, -.22, .23), ring(0, -.73, .34, -.23, .3)], [c.mid, c.top, c.mid, c.dark, c.line, c.line, c.dark]);
    exhaust.push({x: 0, y: 0, z: -1.35, r: .28});
    face(c.mid, [-.04, .28, -.38], [.012, .82, -1.16], [.02, .61, -1.27], [.02, .23, -.93]);
  }
  // Faceted canopy and a narrow specular highlight make the dorsal side readable at small sizes.
  const canopyBase = .3, canopyH = type === 'warden' ? .73 : .54;
  const aft = [0, canopyBase, -.20], peak = [0, canopyH, .27], front = [0, canopyBase * .60, l * .73];
  for (const sign of [-1, 1]) {
    const rim = [sign * w * .74, canopyBase * .85, .28];
    face(c.line, aft, [sign * w * .81, canopyBase * .66, .16], front, peak);
    face(sign > 0 ? c.glass : c.gleam, aft, peak, rim);
    face(c.glass, rim, peak, front);
    face(c.gleam, [sign * w * .24, canopyH * .90, .31], [sign * w * .39, canopyH * .76, l * .32], [0, canopyH * .82, l * .37]);
  }
  return { faces, exhaust, color: c.engine};
}

const models = Object.fromEntries(Object.keys(shapes).map(type => [type, makeModel(type)]));

export function drawShip(ctx, type, x, y, unit, bank, yaw, time, hit = false) {
  const model = models[type];
  const cb = Math.cos(bank), sb = Math.sin(bank), cy = Math.cos(yaw), sy = Math.sin(yaw);
  const tilt = .57, upright = .82;
  function project(pt) {
    const bx = pt[0] * cb - pt[1] * sb, by = pt[0] * sb + pt[1] * cb;
    const xx = bx * cy + pt[2] * sy, zz = pt[2] * cy - bx * sy;
    const depth = zz * upright - by * tilt, scale = 8 / (8 + depth);
    return [x + xx * unit * scale, y - (by * upright + zz * tilt) * unit * scale, depth];
  }
  const polygons = model.faces.map(f => {
      const pts = f.pts.map(project);
      return { pts, color: f.color, depth: pts.reduce((sum, p) => sum + p[2], 0) / pts.length};
  });
  polygons.sort((a, b) => b.depth - a.depth);
  const drawExhaust = () => {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const e of model.exhaust) {
      const a = project([e.x, e.y, e.z]), b = project([e.x, e.y - .035, e.z - .58 - Math.sin(time * 37) * .095]);
      const radius = unit * e.r * (.87 + .09 * Math.sin(time * 31));
      const g = ctx.createRadialGradient(a[0], a[1], 0, a[0], a[1], Math.max(1, radius * 2.2));
      g.addColorStop(0, '#f4faff');
      g.addColorStop(.22, model.color);
      g.addColorStop(1, model.color + '00');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(a[0], a[1], Math.max(1, radius * 2.2), 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = model.color;
      ctx.globalAlpha = .64;
      ctx.beginPath();
      ctx.moveTo(a[0] - radius * .82, a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.lineTo(a[0] + radius * .82, a[1]);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#e5f9ff';
      ctx.beginPath();
      ctx.ellipse(a[0], a[1], Math.max(.4, radius * .58), Math.max(.4, radius * .31), 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  };
  if (cy < 0) drawExhaust();
  ctx.lineWidth = Math.min(.8, unit * .032);
  ctx.lineJoin = 'round';
  for (const f of polygons) {
    ctx.beginPath();
    ctx.moveTo(f.pts[0][0], f.pts[0][1]);
    for (let i = 1;i < f.pts.length;i++) ctx.lineTo(f.pts[i][0], f.pts[i][1]);
    ctx.closePath();
    ctx.fillStyle = hit ? '#fff1d3' : f.color;
    ctx.fill();
    if (unit > 8) {
      ctx.strokeStyle = '#10182732';
      ctx.stroke();
    }
  }
  if (cy >= 0) drawExhaust();
}
