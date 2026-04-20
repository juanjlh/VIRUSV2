(function initThreeBackground() {
  const canvas = document.getElementById('bg-three');
  if (!canvas || typeof THREE === 'undefined') return;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 1, 200);
  camera.position.z = 50;

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

  /* ── Virus-like icosahedrons ─────────────────────── */
  const virusGroup = new THREE.Group();
  scene.add(virusGroup);

  const palette = [0x00ff88, 0x3b9eff, 0xff3f5b, 0xffd026, 0xc04cff];

  for (let i = 0; i < 28; i++) {
    const geo = new THREE.IcosahedronGeometry(Math.random() * 0.7 + 0.25, 1);
    const mat = new THREE.MeshBasicMaterial({
      color: palette[i % palette.length],
      wireframe: true,
      transparent: true,
      opacity: 0.1 + Math.random() * 0.12
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(
      (Math.random() - 0.5) * 80,
      (Math.random() - 0.5) * 60,
      (Math.random() - 0.5) * 30 - 10
    );
    mesh.userData = {
      rotSpeed: new THREE.Vector3(
        (Math.random() - 0.5) * 0.014,
        (Math.random() - 0.5) * 0.014,
        (Math.random() - 0.5) * 0.008
      ),
      drift: new THREE.Vector3(
        (Math.random() - 0.5) * 0.014,
        (Math.random() - 0.5) * 0.011,
        0
      )
    };
    virusGroup.add(mesh);
  }

  /* ── DNA double helix ────────────────────────────── */
  const strandN = 100;
  const s1 = new Float32Array(strandN * 3);
  const s2 = new Float32Array(strandN * 3);
  for (let i = 0; i < strandN; i++) {
    const a = (i / strandN) * Math.PI * 8;
    const y = (i / strandN) * 60 - 30;
    s1[i * 3]     = Math.cos(a) * 4;
    s1[i * 3 + 1] = y;
    s1[i * 3 + 2] = Math.sin(a) * 4;
    s2[i * 3]     = Math.cos(a + Math.PI) * 4;
    s2[i * 3 + 1] = y;
    s2[i * 3 + 2] = Math.sin(a + Math.PI) * 4;
  }
  const g1 = new THREE.BufferGeometry();
  g1.setAttribute('position', new THREE.BufferAttribute(s1, 3));
  const g2 = new THREE.BufferGeometry();
  g2.setAttribute('position', new THREE.BufferAttribute(s2, 3));

  const helixGroup = new THREE.Group();
  helixGroup.add(
    new THREE.Points(g1, new THREE.PointsMaterial({ color: 0x00ff88, size: 0.18, transparent: true, opacity: 0.22 })),
    new THREE.Points(g2, new THREE.PointsMaterial({ color: 0x3b9eff, size: 0.18, transparent: true, opacity: 0.22 }))
  );
  helixGroup.position.set(34, 0, -15);
  scene.add(helixGroup);

  /* ── Ambient dust ────────────────────────────────── */
  const dustN = 300;
  const dp = new Float32Array(dustN * 3);
  for (let i = 0; i < dustN; i++) {
    dp[i * 3]     = (Math.random() - 0.5) * 120;
    dp[i * 3 + 1] = (Math.random() - 0.5) * 80;
    dp[i * 3 + 2] = (Math.random() - 0.5) * 60;
  }
  const dGeo = new THREE.BufferGeometry();
  dGeo.setAttribute('position', new THREE.BufferAttribute(dp, 3));
  const dust = new THREE.Points(dGeo, new THREE.PointsMaterial({
    color: 0x4488cc, size: 0.06, transparent: true, opacity: 0.32
  }));
  scene.add(dust);

  /* ── Render loop ─────────────────────────────────── */
  let t = 0;
  function animate() {
    requestAnimationFrame(animate);
    t += 0.004;

    virusGroup.children.forEach(function (v) {
      v.rotation.x += v.userData.rotSpeed.x;
      v.rotation.y += v.userData.rotSpeed.y;
      v.position.x += v.userData.drift.x;
      v.position.y += v.userData.drift.y;
      if (v.position.x >  45) v.position.x = -45;
      if (v.position.x < -45) v.position.x =  45;
      if (v.position.y >  35) v.position.y = -35;
      if (v.position.y < -35) v.position.y =  35;
    });

    helixGroup.rotation.y += 0.004;
    dust.rotation.y += 0.0003;

    camera.position.x = Math.sin(t * 0.3) * 2.5;
    camera.position.y = Math.cos(t * 0.2) * 1.5;
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
  }
  animate();

  window.addEventListener('resize', function () {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });
})();
