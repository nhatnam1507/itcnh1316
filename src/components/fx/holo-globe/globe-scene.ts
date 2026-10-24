import * as THREE from "three";

// Vietnamese cities the signals converge on, and the world hubs they come from.
const TARGETS: [number, number][] = [
  [21.03, 105.85], // Hà Nội
  [16.05, 108.22], // Đà Nẵng
  [10.78, 106.7], // TP. Hồ Chí Minh
];
const HUBS: [number, number][] = [
  [38.9, -77.0],
  [51.5, -0.1],
  [55.75, 37.6],
  [35.7, 139.7],
  [-33.9, 151.2],
  [1.35, 103.8],
  [48.85, 2.35],
  [37.77, -122.4],
  [28.6, 77.2],
  [-23.5, -46.6],
  [25.2, 55.3],
  [37.57, 126.98],
];

const MINT = new THREE.Color("#2ef2b0");
const BLUE = new THREE.Color("#5aa9ff");
const VIOLET = new THREE.Color("#b18cff");
const ALERT = new THREE.Color("#ff3355");
const CORE = new THREE.Color("#06090c");

const REVEAL_SECONDS = 2.4;
const DEG = Math.PI / 180;

export type GlobeHandle = { dispose: () => void };

function toVector(lat: number, lng: number, radius = 1): THREE.Vector3 {
  const phi = (90 - lat) * DEG;
  const theta = (lng + 180) * DEG;
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

/** Soft round glowing dots; fades dots on the far limb and materializes them top-down. */
function dotMaterial(size: number, colorA: THREE.Color, colorB: THREE.Color): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uSize: { value: size },
      uTime: { value: 0 },
      uReveal: { value: 0 },
      uColorA: { value: colorA },
      uColorB: { value: colorB },
    },
    vertexShader: /* glsl */ `
      uniform float uSize;
      attribute float aRand;
      varying float vFacing;
      varying float vRand;
      varying float vHeight;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vec3 normal = normalize(normalMatrix * normalize(position));
        vFacing = dot(normal, normalize(-mv.xyz));
        vRand = aRand;
        vHeight = normalize(position).y;
        gl_PointSize = uSize / -mv.z;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uReveal;
      uniform vec3 uColorA;
      uniform vec3 uColorB;
      varying float vFacing;
      varying float vRand;
      varying float vHeight;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        if (d > 0.5) discard;
        float twinkle = 0.7 + 0.3 * sin(uTime * 1.6 + vRand * 40.0);
        float limb = smoothstep(-0.05, 0.45, vFacing);
        float reveal = smoothstep(-0.04, 0.04, vHeight - (1.15 - 2.3 * uReveal));
        float alpha = smoothstep(0.5, 0.1, d) * limb * twinkle * reveal;
        gl_FragColor = vec4(mix(uColorA, uColorB, vRand), alpha);
      }
    `,
  });
}

/** Rim light: bright at the globe's silhouette, clear in the middle. */
function fresnelMaterial(color: THREE.Color, power: number, strength: number, side: THREE.Side): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side,
    blending: THREE.AdditiveBlending,
    uniforms: { uColor: { value: color }, uPower: { value: power }, uStrength: { value: strength } },
    vertexShader: /* glsl */ `
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uPower;
      uniform float uStrength;
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        float facing = abs(dot(vNormal, vView));
        float glow = pow(1.0 - facing, uPower) * uStrength;
        gl_FragColor = vec4(uColor * glow, glow);
      }
    `,
  });
}

/** A line whose bright head travels from start to end, leaving a fading tail. */
function signalMaterial(color: THREE.Color, offset: number, speed: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uOffset: { value: offset }, uSpeed: { value: speed }, uColor: { value: color } },
    vertexShader: /* glsl */ `
      attribute float aProgress;
      varying float vProgress;
      void main() {
        vProgress = aProgress;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uOffset;
      uniform float uSpeed;
      uniform vec3 uColor;
      varying float vProgress;
      void main() {
        float head = fract(uTime * uSpeed + uOffset) * 1.4;
        float behind = head - vProgress;
        float trail = behind >= 0.0 && behind < 0.35 ? 1.0 - behind / 0.35 : 0.0;
        gl_FragColor = vec4(uColor, 0.07 + trail * 0.95);
      }
    `,
  });
}

function circlePoints(radius: number, segments = 160): THREE.Vector3[] {
  return Array.from({ length: segments }, (_, i) => {
    const angle = (i / segments) * Math.PI * 2;
    return new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
  });
}

function gridGeometry(): THREE.BufferGeometry {
  const positions: number[] = [];
  const push = (a: THREE.Vector3, b: THREE.Vector3) => positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
  for (let lat = -60; lat <= 60; lat += 30) {
    for (let lng = -180; lng < 180; lng += 4) push(toVector(lat, lng, 1.003), toVector(lat, lng + 4, 1.003));
  }
  for (let lng = -180; lng < 180; lng += 30) {
    for (let lat = -88; lat < 88; lat += 4) push(toVector(lat, lng, 1.003), toVector(lat + 4, lng, 1.003));
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  return geometry;
}

function landGeometry(latLng: number[]): THREE.BufferGeometry {
  const count = latLng.length / 2;
  const positions = new Float32Array(count * 3);
  const random = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    toVector(latLng[i * 2], latLng[i * 2 + 1], 1.006).toArray(positions, i * 3);
    random[i] = Math.random();
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aRand", new THREE.BufferAttribute(random, 1));
  return geometry;
}

function arcGeometry(from: [number, number], to: [number, number]): THREE.BufferGeometry {
  const start = toVector(from[0], from[1], 1.006);
  const end = toVector(to[0], to[1], 1.006);
  const lift = 1.05 + start.distanceTo(end) * 0.32;
  const mid = start.clone().add(end).normalize().multiplyScalar(lift);
  const points = new THREE.QuadraticBezierCurve3(start, mid, end).getPoints(80);
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  geometry.setAttribute(
    "aProgress",
    new THREE.BufferAttribute(Float32Array.from(points, (_, i) => i / (points.length - 1)), 1),
  );
  return geometry;
}

/**
 * Mounts a holographic globe into `container`: dotted continents, rim glow, a lat/long grid,
 * signal arcs converging on Vietnam, pulsing target rings and orbiting satellites. Returns
 * null when WebGL is unavailable, so the page simply shows no globe.
 */
export function mountGlobe(
  container: HTMLElement,
  landLatLng: number[],
  { reducedMotion }: { reducedMotion: boolean },
): GlobeHandle | null {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
  } catch {
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  const globe = new THREE.Group();
  scene.add(globe);

  // Opaque core hides the dots and lines on the far side.
  globe.add(new THREE.Mesh(new THREE.SphereGeometry(1, 64, 64), new THREE.MeshBasicMaterial({ color: CORE })));
  globe.add(
    new THREE.LineSegments(
      gridGeometry(),
      new THREE.LineBasicMaterial({ color: MINT, transparent: true, opacity: 0.07, depthWrite: false }),
    ),
  );

  const landMaterial = dotMaterial(0, MINT, BLUE);
  globe.add(new THREE.Points(landGeometry(landLatLng), landMaterial));

  scene.add(new THREE.Mesh(new THREE.SphereGeometry(1.0, 64, 64), fresnelMaterial(MINT, 3.2, 0.9, THREE.FrontSide)));
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(1.16, 64, 64), fresnelMaterial(BLUE, 5.0, 0.6, THREE.BackSide)));

  // Signals from world hubs to the targets, each on its own rhythm.
  const signalMaterials = HUBS.map((hub, index) => {
    const material = signalMaterial(index % 3 === 0 ? VIOLET : MINT, index / HUBS.length, 0.16 + (index % 4) * 0.03);
    globe.add(new THREE.Line(arcGeometry(hub, TARGETS[index % TARGETS.length]), material));
    return material;
  });

  // Target markers: a beam out of the surface and a ring that pulses outward.
  const pulses = TARGETS.map(([lat, lng], index) => {
    const surface = toVector(lat, lng, 1.008);
    const beam = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([surface, toVector(lat, lng, 1.16)]),
      new THREE.LineBasicMaterial({ color: ALERT, transparent: true, opacity: 0.85 }),
    );
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: ALERT,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.018, 0.024, 48), ringMaterial);
    ring.position.copy(surface);
    ring.lookAt(surface.clone().multiplyScalar(2));
    globe.add(beam, ring);
    return { ring, material: ringMaterial, offset: index / TARGETS.length };
  });
  const targetDots = new THREE.Points(
    new THREE.BufferGeometry()
      .setFromPoints(TARGETS.map(([lat, lng]) => toVector(lat, lng, 1.01)))
      .setAttribute("aRand", new THREE.BufferAttribute(new Float32Array(TARGETS.length), 1)),
    dotMaterial(0, ALERT, ALERT),
  );
  globe.add(targetDots);

  // Two tilted orbits, each carrying two satellites.
  const orbits = [
    { radius: 1.45, tiltX: 1.15, tiltZ: 0.35, speed: 0.22 },
    { radius: 1.72, tiltX: 1.9, tiltZ: -0.5, speed: -0.14 },
  ].map(({ radius, tiltX, tiltZ, speed }) => {
    const orbit = new THREE.Group();
    orbit.rotation.set(tiltX, 0, tiltZ);
    orbit.add(
      new THREE.LineLoop(
        new THREE.BufferGeometry().setFromPoints(circlePoints(radius)),
        new THREE.LineBasicMaterial({ color: BLUE, transparent: true, opacity: 0.16, depthWrite: false }),
      ),
    );
    const satellites = new THREE.Points(
      new THREE.BufferGeometry()
        .setFromPoints([new THREE.Vector3(radius, 0, 0), new THREE.Vector3(-radius, 0, 0)])
        .setAttribute("aRand", new THREE.BufferAttribute(new Float32Array([0.2, 0.8]), 1)),
      dotMaterial(0, MINT, VIOLET),
    );
    const carrier = new THREE.Group();
    carrier.add(satellites);
    orbit.add(carrier);
    scene.add(orbit);
    return { carrier, speed, material: satellites.material as THREE.ShaderMaterial };
  });

  // Horizontal scan ring that sweeps down while the continents materialize.
  const scanMaterial = new THREE.LineBasicMaterial({ color: MINT, transparent: true, opacity: 0.9, depthWrite: false });
  const scanRing = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(circlePoints(1, 128)), scanMaterial);
  scene.add(scanRing);

  // Face Vietnam, tilted slightly so the northern hemisphere leans toward the viewer.
  const focus = toVector(16, 106);
  const baseYaw = Math.atan2(-focus.x, focus.z);
  globe.rotation.set(0.28, baseYaw, 0);

  const pointer = { x: 0, y: 0 };
  const onPointerMove = (event: PointerEvent) => {
    pointer.x = event.clientX / window.innerWidth - 0.5;
    pointer.y = event.clientY / window.innerHeight - 0.5;
  };

  let distance = 4;
  const resize = () => {
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (!width || !height) return;
    const aspect = width / height;
    renderer.setSize(width, height, false);
    camera.aspect = aspect;
    // Wide screens: globe sits right of the card. Tall screens: globe fills the width, raised.
    distance = Math.max(3.9, 2.25 / (0.728 * aspect));
    if (aspect > 1.1) camera.setViewOffset(width, height, -width * 0.2, 0, width, height);
    else camera.setViewOffset(width, height, 0, height * 0.16, width, height);
    camera.updateProjectionMatrix();
    const pointScale = renderer.getPixelRatio() * Math.min(height, 1100) * 0.009;
    landMaterial.uniforms.uSize.value = 1.6 * pointScale;
    (targetDots.material as THREE.ShaderMaterial).uniforms.uSize.value = 7 * pointScale;
    for (const orbit of orbits) orbit.material.uniforms.uSize.value = 5 * pointScale;
  };

  const render = (time: number) => {
    const reveal = reducedMotion ? 1 : Math.min(1, time / REVEAL_SECONDS);
    for (const material of [landMaterial, targetDots.material as THREE.ShaderMaterial, ...orbits.map((o) => o.material)]) {
      material.uniforms.uTime.value = time;
      material.uniforms.uReveal.value = reveal;
    }
    for (const material of signalMaterials) material.uniforms.uTime.value = time;

    globe.rotation.y = baseYaw + Math.sin(time * 0.11) * 0.55;
    for (const orbit of orbits) orbit.carrier.rotation.y = time * orbit.speed;
    for (const pulse of pulses) {
      const phase = (time * 0.6 + pulse.offset) % 1;
      pulse.ring.scale.setScalar(1 + phase * 3.2);
      pulse.material.opacity = (1 - phase) * 0.9;
    }

    const scanY = 1.15 - 2.3 * reveal;
    const scanRadius = Math.sqrt(Math.max(0, 1 - scanY * scanY)) * 1.02;
    scanRing.position.y = scanY;
    scanRing.scale.set(scanRadius || 0.001, 1, scanRadius || 0.001);
    scanMaterial.opacity = reveal < 1 ? 0.9 : 0;

    camera.position.x += (pointer.x * 0.5 - camera.position.x) * 0.04;
    camera.position.y += (-pointer.y * 0.3 + 0.15 - camera.position.y) * 0.04;
    camera.position.z = distance;
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
  };

  const observer = new ResizeObserver(() => {
    resize();
    if (reducedMotion) render(0);
  });
  observer.observe(container);
  resize();

  let frame = 0;
  if (reducedMotion) {
    camera.position.set(0, 0.15, distance);
    render(0);
  } else {
    window.addEventListener("pointermove", onPointerMove);
    let started: number | undefined;
    const loop = (now: number) => {
      started ??= now;
      render((now - started) / 1000);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
  }

  return {
    dispose() {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Points || object instanceof THREE.Line) {
          object.geometry.dispose();
          (object.material as THREE.Material).dispose();
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
