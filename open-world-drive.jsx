import { useState, useEffect, useRef, useCallback } from "react";
import * as THREE from "three";

const WORLD_SIZE = 800;
const ROAD_WIDTH = 12;
const CAR_ACCEL = 0.08;
const CAR_BRAKE = 0.05;
const CAR_FRICTION = 0.015;
const CAR_MAX_SPEED = 2.8;
const CAR_REVERSE_MAX = -1.0;
const STEER_SPEED = 0.035;

function buildCar(scene) {
  const car = new THREE.Group();

  // Body
  const bodyGeo = new THREE.BoxGeometry(2.2, 0.8, 4.5);
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xe63946, metalness: 0.6, roughness: 0.3 });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 0.7;
  body.castShadow = true;
  car.add(body);

  // Cabin
  const cabinGeo = new THREE.BoxGeometry(1.8, 0.7, 2.2);
  const cabinMat = new THREE.MeshStandardMaterial({ color: 0x1d3557, metalness: 0.4, roughness: 0.2 });
  const cabin = new THREE.Mesh(cabinGeo, cabinMat);
  cabin.position.set(0, 1.35, -0.3);
  cabin.castShadow = true;
  car.add(cabin);

  // Windshield
  const windGeo = new THREE.BoxGeometry(1.6, 0.55, 0.1);
  const windMat = new THREE.MeshStandardMaterial({ color: 0xa8dadc, metalness: 0.8, roughness: 0.1, transparent: true, opacity: 0.6 });
  const windshield = new THREE.Mesh(windGeo, windMat);
  windshield.position.set(0, 1.35, 0.75);
  windshield.rotation.x = -0.15;
  car.add(windshield);

  // Wheels
  const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.3, 12);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x2b2d42, roughness: 0.8 });
  const wheelPositions = [
    [-1.15, 0.35, 1.4], [1.15, 0.35, 1.4],
    [-1.15, 0.35, -1.4], [1.15, 0.35, -1.4]
  ];
  wheelPositions.forEach(pos => {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.position.set(...pos);
    wheel.rotation.z = Math.PI / 2;
    wheel.castShadow = true;
    car.add(wheel);
  });

  // Headlights
  const lightGeo = new THREE.SphereGeometry(0.15, 8, 8);
  const lightMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffaa, emissiveIntensity: 0.8 });
  [[-0.7, 0.65, 2.25], [0.7, 0.65, 2.25]].forEach(pos => {
    const hl = new THREE.Mesh(lightGeo, lightMat);
    hl.position.set(...pos);
    car.add(hl);
  });

  // Tail lights
  const tailMat = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 0.5 });
  [[-0.7, 0.65, -2.25], [0.7, 0.65, -2.25]].forEach(pos => {
    const tl = new THREE.Mesh(lightGeo, tailMat);
    tl.position.set(...pos);
    car.add(tl);
  });

  scene.add(car);
  return car;
}

function buildWorld(scene) {
  // Ground
  const groundGeo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, 64, 64);
  const vertices = groundGeo.attributes.position.array;
  for (let i = 2; i < vertices.length; i += 3) {
    const x = vertices[i - 2];
    const z = vertices[i - 1];
    const distFromCenter = Math.sqrt(x * x + z * z);
    if (distFromCenter > 80) {
      vertices[i] = (Math.sin(x * 0.02) * Math.cos(z * 0.03) * 3) + (Math.sin(x * 0.05 + z * 0.04) * 1.5);
    }
  }
  groundGeo.computeVertexNormals();
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x4a7c59, roughness: 0.9, flatShading: true });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Roads
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.7 });
  const lineMat = new THREE.MeshStandardMaterial({ color: 0xf1faee, roughness: 0.5 });

  const createRoad = (x, z, w, d) => {
    const road = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, d), roadMat);
    road.position.set(x, 0.02, z);
    road.receiveShadow = true;
    scene.add(road);

    // Dashed center line
    const isHorizontal = w > d;
    const length = isHorizontal ? w : d;
    const dashCount = Math.floor(length / 8);
    for (let i = 0; i < dashCount; i++) {
      const dash = new THREE.Mesh(
        new THREE.BoxGeometry(isHorizontal ? 3 : 0.3, 0.06, isHorizontal ? 0.3 : 3),
        lineMat
      );
      if (isHorizontal) {
        dash.position.set(x - length / 2 + i * 8 + 4, 0.05, z);
      } else {
        dash.position.set(x, 0.05, z - length / 2 + i * 8 + 4);
      }
      scene.add(dash);
    }
  };

  // Main roads grid
  createRoad(0, 0, ROAD_WIDTH, WORLD_SIZE * 0.8);
  createRoad(0, 0, WORLD_SIZE * 0.8, ROAD_WIDTH);
  createRoad(120, 0, ROAD_WIDTH, WORLD_SIZE * 0.6);
  createRoad(-120, 0, ROAD_WIDTH, WORLD_SIZE * 0.6);
  createRoad(0, 120, WORLD_SIZE * 0.6, ROAD_WIDTH);
  createRoad(0, -120, WORLD_SIZE * 0.6, ROAD_WIDTH);
  // Cross roads
  createRoad(60, 60, ROAD_WIDTH, 130);
  createRoad(60, 60, 130, ROAD_WIDTH);
  createRoad(-60, -60, ROAD_WIDTH, 130);
  createRoad(-60, -60, 130, ROAD_WIDTH);

  // Buildings
  const buildingColors = [0x457b9d, 0x6d6875, 0xb5838d, 0xe5989b, 0x8d99ae, 0x2b2d42, 0x606c38, 0xbc6c25];
  const buildings = [];

  const isOnRoad = (x, z) => {
    const roads = [
      { cx: 0, cz: 0, hw: ROAD_WIDTH / 2 + 2, hd: WORLD_SIZE * 0.4 + 2 },
      { cx: 0, cz: 0, hw: WORLD_SIZE * 0.4 + 2, hd: ROAD_WIDTH / 2 + 2 },
      { cx: 120, cz: 0, hw: ROAD_WIDTH / 2 + 2, hd: WORLD_SIZE * 0.3 + 2 },
      { cx: -120, cz: 0, hw: ROAD_WIDTH / 2 + 2, hd: WORLD_SIZE * 0.3 + 2 },
      { cx: 0, cz: 120, hw: WORLD_SIZE * 0.3 + 2, hd: ROAD_WIDTH / 2 + 2 },
      { cx: 0, cz: -120, hw: WORLD_SIZE * 0.3 + 2, hd: ROAD_WIDTH / 2 + 2 },
      { cx: 60, cz: 60, hw: ROAD_WIDTH / 2 + 2, hd: 67 },
      { cx: 60, cz: 60, hw: 67, hd: ROAD_WIDTH / 2 + 2 },
      { cx: -60, cz: -60, hw: ROAD_WIDTH / 2 + 2, hd: 67 },
      { cx: -60, cz: -60, hw: 67, hd: ROAD_WIDTH / 2 + 2 },
    ];
    return roads.some(r => Math.abs(x - r.cx) < r.hw && Math.abs(z - r.cz) < r.hd);
  };

  for (let i = 0; i < 120; i++) {
    const bx = (Math.random() - 0.5) * WORLD_SIZE * 0.65;
    const bz = (Math.random() - 0.5) * WORLD_SIZE * 0.65;
    if (isOnRoad(bx, bz)) continue;

    const w = 6 + Math.random() * 14;
    const h = 5 + Math.random() * 25;
    const d = 6 + Math.random() * 14;
    const color = buildingColors[Math.floor(Math.random() * buildingColors.length)];

    const bGeo = new THREE.BoxGeometry(w, h, d);
    const bMat = new THREE.MeshStandardMaterial({ color, roughness: 0.7, flatShading: true });
    const building = new THREE.Mesh(bGeo, bMat);
    building.position.set(bx, h / 2, bz);
    building.castShadow = true;
    building.receiveShadow = true;
    scene.add(building);
    buildings.push({ x: bx, z: bz, hw: w / 2 + 1.5, hd: d / 2 + 1.5 });

    // Windows
    const windowMat = new THREE.MeshStandardMaterial({ color: 0xf1faee, emissive: 0xffffcc, emissiveIntensity: Math.random() * 0.3 + 0.1 });
    const floors = Math.floor(h / 3.5);
    for (let f = 0; f < floors; f++) {
      const windowsPerSide = Math.floor(w / 3);
      for (let wi = 0; wi < windowsPerSide; wi++) {
        const wMesh = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.4, 0.1), windowMat);
        wMesh.position.set(
          bx - w / 2 + 2 + wi * (w - 3) / Math.max(windowsPerSide - 1, 1),
          2 + f * 3.5,
          bz + d / 2 + 0.06
        );
        scene.add(wMesh);
      }
    }
  }

  // Trees
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4226, roughness: 0.9 });
  const leafColors = [0x2d6a4f, 0x40916c, 0x52b788, 0x74c69d];

  for (let i = 0; i < 200; i++) {
    const tx = (Math.random() - 0.5) * WORLD_SIZE * 0.75;
    const tz = (Math.random() - 0.5) * WORLD_SIZE * 0.75;
    if (isOnRoad(tx, tz)) continue;
    if (buildings.some(b => Math.abs(tx - b.x) < b.hw && Math.abs(tz - b.z) < b.hd)) continue;

    const trunkH = 2 + Math.random() * 2;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, trunkH, 6), trunkMat);
    trunk.position.set(tx, trunkH / 2, tz);
    trunk.castShadow = true;
    scene.add(trunk);

    const leafColor = leafColors[Math.floor(Math.random() * leafColors.length)];
    const leafMat = new THREE.MeshStandardMaterial({ color: leafColor, roughness: 0.8, flatShading: true });
    const crownSize = 1.5 + Math.random() * 2;
    const crown = new THREE.Mesh(new THREE.SphereGeometry(crownSize, 6, 5), leafMat);
    crown.position.set(tx, trunkH + crownSize * 0.6, tz);
    crown.castShadow = true;
    scene.add(crown);
  }

  // Street lamps
  const lampMat = new THREE.MeshStandardMaterial({ color: 0x555555 });
  const bulbMat = new THREE.MeshStandardMaterial({ color: 0xfff3b0, emissive: 0xfff3b0, emissiveIntensity: 1 });
  for (let i = -280; i < 280; i += 40) {
    [8, -8].forEach(offset => {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 5, 6), lampMat);
      pole.position.set(offset, 2.5, i);
      scene.add(pole);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.4, 6, 6), bulbMat);
      bulb.position.set(offset, 5.2, i);
      scene.add(bulb);
    });
  }

  // Skybox color
  scene.background = new THREE.Color(0x87ceeb);
  scene.fog = new THREE.Fog(0x87ceeb, 150, WORLD_SIZE * 0.55);

  return buildings;
}

export default function OpenWorldDrive() {
  const mountRef = useRef(null);
  const stateRef = useRef({
    speed: 0,
    angle: 0,
    keys: {},
    cam: { distance: 14, height: 7, smoothX: 0, smoothZ: 0 },
  });
  const [speed, setSpeed] = useState(0);
  const [started, setStarted] = useState(false);
  const [nightMode, setNightMode] = useState(false);

  const startGame = useCallback(() => setStarted(true), []);
  const toggleNight = useCallback(() => setNightMode(n => !n), []);

  useEffect(() => {
    if (!started || !mountRef.current) return;

    const container = mountRef.current;
    const w = container.clientWidth;
    const h = container.clientHeight;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // Scene & Camera
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, w / h, 0.5, 600);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffffff, 1.0);
    sunLight.position.set(100, 120, 80);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(2048, 2048);
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 400;
    sunLight.shadow.camera.left = -150;
    sunLight.shadow.camera.right = 150;
    sunLight.shadow.camera.top = 150;
    sunLight.shadow.camera.bottom = -150;
    scene.add(sunLight);

    const hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x4a7c59, 0.3);
    scene.add(hemiLight);

    // Headlight
    const headlight = new THREE.SpotLight(0xffffee, 0, 60, Math.PI / 5, 0.5, 1.5);
    scene.add(headlight);
    scene.add(headlight.target);

    // Build world
    const buildings = buildWorld(scene);
    const car = buildCar(scene);
    car.position.set(0, 0, 0);

    // Input
    const st = stateRef.current;
    const onKeyDown = (e) => { st.keys[e.code] = true; };
    const onKeyUp = (e) => { st.keys[e.code] = false; };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    // Touch
    let touchAccel = false, touchBrake = false, touchLeft = false, touchRight = false;

    // Resize
    const onResize = () => {
      const nw = container.clientWidth;
      const nh = container.clientHeight;
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
    };
    window.addEventListener("resize", onResize);

    // Night mode ref
    let isNight = false;

    // Game loop
    let animId;
    const clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const delta = Math.min(clock.getDelta(), 0.05);
      const keys = st.keys;

      // Accelerate / Brake
      const accel = keys["ArrowUp"] || keys["KeyW"] || touchAccel;
      const brake = keys["ArrowDown"] || keys["KeyS"] || touchBrake;
      const left = keys["ArrowLeft"] || keys["KeyA"] || touchLeft;
      const right = keys["ArrowRight"] || keys["KeyD"] || touchRight;

      if (accel) {
        st.speed = Math.min(st.speed + CAR_ACCEL, CAR_MAX_SPEED);
      } else if (brake) {
        st.speed = Math.max(st.speed - CAR_BRAKE, CAR_REVERSE_MAX);
      } else {
        if (st.speed > 0) st.speed = Math.max(0, st.speed - CAR_FRICTION);
        else if (st.speed < 0) st.speed = Math.min(0, st.speed + CAR_FRICTION);
      }

      // Steering
      const steerFactor = Math.min(Math.abs(st.speed) / 1.5, 1);
      if (left) st.angle += STEER_SPEED * steerFactor * (st.speed >= 0 ? 1 : -1);
      if (right) st.angle -= STEER_SPEED * steerFactor * (st.speed >= 0 ? 1 : -1);

      // Move
      const dx = Math.sin(st.angle) * st.speed;
      const dz = Math.cos(st.angle) * st.speed;
      let nx = car.position.x + dx;
      let nz = car.position.z + dz;

      // Building collision
      for (const b of buildings) {
        if (Math.abs(nx - b.x) < b.hw && Math.abs(nz - b.z) < b.hd) {
          st.speed *= -0.3;
          nx = car.position.x;
          nz = car.position.z;
          break;
        }
      }

      // World bounds
      const bound = WORLD_SIZE * 0.42;
      nx = Math.max(-bound, Math.min(bound, nx));
      nz = Math.max(-bound, Math.min(bound, nz));

      car.position.x = nx;
      car.position.z = nz;
      car.rotation.y = st.angle;

      // Body tilt
      const tilt = left ? 0.04 : right ? -0.04 : 0;
      car.rotation.z += (tilt - car.rotation.z) * 0.1;

      // Headlight
      headlight.position.set(
        car.position.x + Math.sin(st.angle) * 3,
        2.5,
        car.position.z + Math.cos(st.angle) * 3
      );
      headlight.target.position.set(
        car.position.x + Math.sin(st.angle) * 20,
        0,
        car.position.z + Math.cos(st.angle) * 20
      );

      // Camera follow
      const camDist = st.cam.distance + Math.abs(st.speed) * 2;
      const targetX = car.position.x - Math.sin(st.angle) * camDist;
      const targetZ = car.position.z - Math.cos(st.angle) * camDist;
      st.cam.smoothX += (targetX - st.cam.smoothX) * 0.05;
      st.cam.smoothZ += (targetZ - st.cam.smoothZ) * 0.05;

      camera.position.set(
        st.cam.smoothX,
        st.cam.height + Math.abs(st.speed) * 1.5,
        st.cam.smoothZ
      );
      camera.lookAt(car.position.x, 1.5, car.position.z);

      // Shadow follow
      sunLight.position.set(car.position.x + 100, 120, car.position.z + 80);
      sunLight.target.position.copy(car.position);

      // Night mode
      if (isNight) {
        scene.background = new THREE.Color(0x0a0a1a);
        scene.fog.color.set(0x0a0a1a);
        ambientLight.intensity = 0.08;
        sunLight.intensity = 0.05;
        hemiLight.intensity = 0.05;
        headlight.intensity = 2.5;
      } else {
        scene.background = new THREE.Color(0x87ceeb);
        scene.fog.color.set(0x87ceeb);
        ambientLight.intensity = 0.5;
        sunLight.intensity = 1.0;
        hemiLight.intensity = 0.3;
        headlight.intensity = 0;
      }

      // UI speed
      setSpeed(Math.abs(Math.round(st.speed * 60)));

      renderer.render(scene, camera);
    };

    animate();

    // Expose night toggle
    container._setNight = (v) => { isNight = v; };
    // Touch handlers
    container._setTouch = (a, b, l, r) => { touchAccel = a; touchBrake = b; touchLeft = l; touchRight = r; };

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
    };
  }, [started]);

  useEffect(() => {
    if (mountRef.current && mountRef.current._setNight) {
      mountRef.current._setNight(nightMode);
    }
  }, [nightMode]);

  if (!started) {
    return (
      <div style={{
        width: "100vw", height: "100vh", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        background: "linear-gradient(135deg, #0a0a1a 0%, #1a1a2e 40%, #16213e 70%, #0f3460 100%)",
        fontFamily: "'Segoe UI', system-ui, sans-serif", color: "#fff", overflow: "hidden",
        position: "relative"
      }}>
        <div style={{
          position: "absolute", inset: 0, opacity: 0.06,
          backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 40px, #fff 40px, #fff 41px), repeating-linear-gradient(90deg, transparent, transparent 40px, #fff 40px, #fff 41px)"
        }} />
        <div style={{ fontSize: "clamp(2.5rem, 6vw, 5rem)", fontWeight: 900, letterSpacing: "-2px", marginBottom: 8, textShadow: "0 0 40px rgba(230,57,70,0.5)" }}>
          🚗 OPEN DRIVE
        </div>
        <div style={{ fontSize: "clamp(0.9rem, 2vw, 1.1rem)", opacity: 0.6, marginBottom: 40, letterSpacing: "4px", textTransform: "uppercase" }}>
          explore the city
        </div>
        <button onClick={startGame} style={{
          padding: "16px 48px", fontSize: "1.2rem", fontWeight: 700, letterSpacing: "3px",
          background: "linear-gradient(135deg, #e63946, #c1121f)", color: "#fff",
          border: "none", borderRadius: 12, cursor: "pointer", textTransform: "uppercase",
          boxShadow: "0 8px 32px rgba(230,57,70,0.4)", transition: "transform 0.2s, box-shadow 0.2s"
        }}
          onMouseEnter={e => { e.target.style.transform = "scale(1.05)"; e.target.style.boxShadow = "0 12px 40px rgba(230,57,70,0.6)"; }}
          onMouseLeave={e => { e.target.style.transform = "scale(1)"; e.target.style.boxShadow = "0 8px 32px rgba(230,57,70,0.4)"; }}
        >
          Start
        </button>
        <div style={{ marginTop: 50, opacity: 0.5, fontSize: "0.85rem", textAlign: "center", lineHeight: 1.8 }}>
          <div><b>W / ↑</b> — Accelerate &nbsp;&nbsp; <b>S / ↓</b> — Brake / Reverse</div>
          <div><b>A / ↑</b> — Steer Left &nbsp;&nbsp; <b>D / →</b> — Steer Right</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative", overflow: "hidden", background: "#000" }}>
      <div ref={mountRef} style={{ width: "100%", height: "100%" }} />

      {/* HUD */}
      <div style={{
        position: "absolute", bottom: 24, left: "50%", transform: "translateX(-50%)",
        display: "flex", alignItems: "center", gap: 16, padding: "10px 24px",
        background: "rgba(0,0,0,0.65)", borderRadius: 16, backdropFilter: "blur(10px)",
        fontFamily: "'Segoe UI', system-ui, sans-serif", color: "#fff"
      }}>
        <div style={{ fontSize: "2rem", fontWeight: 900, fontVariantNumeric: "tabular-nums", minWidth: 80, textAlign: "right" }}>
          {speed}
        </div>
        <div style={{ fontSize: "0.75rem", opacity: 0.6, letterSpacing: 1 }}>KM/H</div>
        <div style={{ width: 1, height: 30, background: "rgba(255,255,255,0.2)", margin: "0 4px" }} />
        <button onClick={toggleNight} style={{
          padding: "6px 14px", fontSize: "0.8rem", background: nightMode ? "#f1faee" : "#2b2d42",
          color: nightMode ? "#2b2d42" : "#f1faee", border: "none", borderRadius: 8, cursor: "pointer",
          fontWeight: 600, letterSpacing: 1
        }}>
          {nightMode ? "☀️ DAY" : "🌙 NIGHT"}
        </button>
      </div>

      {/* Mobile touch controls */}
      <div style={{
        position: "absolute", bottom: 90, left: 20, display: "flex", gap: 8,
        userSelect: "none", WebkitUserSelect: "none"
      }}>
        {[
          { label: "◀", key: "left" },
          { label: "▶", key: "right" },
        ].map(btn => (
          <button key={btn.key}
            onTouchStart={() => {
              if (mountRef.current?._setTouch) {
                if (btn.key === "left") mountRef.current._setTouch(false, false, true, false);
                if (btn.key === "right") mountRef.current._setTouch(false, false, false, true);
              }
            }}
            onTouchEnd={() => mountRef.current?._setTouch?.(false, false, false, false)}
            style={{
              width: 56, height: 56, borderRadius: 12, border: "2px solid rgba(255,255,255,0.3)",
              background: "rgba(255,255,255,0.15)", color: "#fff", fontSize: "1.4rem",
              display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
              backdropFilter: "blur(4px)"
            }}
          >
            {btn.label}
          </button>
        ))}
      </div>

      <div style={{
        position: "absolute", bottom: 90, right: 20, display: "flex", gap: 8,
        userSelect: "none", WebkitUserSelect: "none"
      }}>
        {[
          { label: "▲", key: "gas" },
          { label: "▼", key: "brake" },
        ].map(btn => (
          <button key={btn.key}
            onTouchStart={() => {
              if (mountRef.current?._setTouch) {
                if (btn.key === "gas") mountRef.current._setTouch(true, false, false, false);
                if (btn.key === "brake") mountRef.current._setTouch(false, true, false, false);
              }
            }}
            onTouchEnd={() => mountRef.current?._setTouch?.(false, false, false, false)}
            style={{
              width: 56, height: 56, borderRadius: 12, border: "2px solid rgba(255,255,255,0.3)",
              background: "rgba(255,255,255,0.15)", color: "#fff", fontSize: "1.4rem",
              display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
              backdropFilter: "blur(4px)"
            }}
          >
            {btn.label}
          </button>
        ))}
      </div>
    </div>
  );
}
