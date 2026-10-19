// API address, page elements, animated background

let API = localStorage.getItem('companion_api_host') || ((window.location.hostname && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1')
  ? `http://${window.location.hostname}:8000`
  : "http://127.0.0.1:8000");

const feedEl = document.getElementById('feed');
const goalEl = document.getElementById('goal');
const sendBtn = document.getElementById('sendBtn');
const micBtn = document.getElementById('micBtn');
const statusEl = document.getElementById('status');
const liveTicker = document.getElementById('liveTicker');
const liveTickerText = document.getElementById('liveTickerText');
const currentAgentTag = document.getElementById('currentAgentTag');
const sessionCountBadge = document.getElementById('sessionCountBadge');

// --- 2. LIVING SYNAPTIC COMPUTATIONAL SUBSTRATE ---
(function initNeuralCanvas() {
  const canvas = document.getElementById('neuralCanvas');
  if (!canvas || canvas.style.display === 'none') return;
  const ctx = canvas.getContext('2d', { alpha: true });
  let width, height, nodes = [];
  const nodeCount = 42;
  const maxDistance = 145;
  let pulses = [];

  function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  for (let i = 0; i < nodeCount; i++) {
    nodes.push({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.38,
      vy: (Math.random() - 0.5) * 0.38,
      radius: Math.random() * 1.4 + 1.1,
      phase: Math.random() * Math.PI * 2
    });
  }

  // Synaptic signal pulses flowing along links
  for (let p = 0; p < 6; p++) {
    pulses.push({
      from: Math.floor(Math.random() * nodeCount),
      to: Math.floor(Math.random() * nodeCount),
      progress: Math.random(),
      speed: Math.random() * 0.008 + 0.004
    });
  }

  let mouse = { x: -2000, y: -2000, radius: 180 };
  window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  });
  window.addEventListener('mouseleave', () => {
    mouse.x = -2000;
    mouse.y = -2000;
  });

  function render(time) {
    if (document.hidden) {
      requestAnimationFrame(render);
      return;
    }

    ctx.clearRect(0, 0, width, height);

    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    const nodeColor = isLight ? 'rgba(124, 92, 255, 0.22)' : 'rgba(124, 92, 255, 0.35)';
    const lineColor = isLight ? 'rgba(124, 92, 255, 0.05)' : 'rgba(124, 92, 255, 0.09)';
    const pulseColor = isLight ? 'rgba(124, 92, 255, 0.65)' : 'rgba(34, 211, 238, 0.75)';

    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      n.x += n.vx;
      n.y += n.vy;

      if (n.x < -10) n.x = width + 10;
      if (n.x > width + 10) n.x = -10;
      if (n.y < -10) n.y = height + 10;
      if (n.y > height + 10) n.y = -10;

      // Gentle mouse interaction
      const mdx = mouse.x - n.x;
      const mdy = mouse.y - n.y;
      const mDist = Math.sqrt(mdx * mdx + mdy * mdy);
      if (mDist < mouse.radius) {
        const force = (1 - mDist / mouse.radius) * 0.6;
        n.x -= (mdx / mDist) * force;
        n.y -= (mdy / mDist) * force;
      }

      // Draw node
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
      ctx.fillStyle = nodeColor;
      ctx.fill();

      // Connect to neighbors
      for (let j = i + 1; j < nodes.length; j++) {
        const n2 = nodes[j];
        const dx = n.x - n2.x;
        const dy = n.y - n2.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < maxDistance) {
          ctx.beginPath();
          ctx.moveTo(n.x, n.y);
          ctx.lineTo(n2.x, n2.y);
          ctx.strokeStyle = lineColor;
          ctx.lineWidth = (1 - dist / maxDistance) * 0.9;
          ctx.stroke();
        }
      }
    }

    // Render synaptic data pulses
    for (let p = 0; p < pulses.length; p++) {
      const pulse = pulses[p];
      pulse.progress += pulse.speed;
      if (pulse.progress >= 1) {
        pulse.progress = 0;
        pulse.from = Math.floor(Math.random() * nodeCount);
        pulse.to = Math.floor(Math.random() * nodeCount);
      }
      const n1 = nodes[pulse.from];
      const n2 = nodes[pulse.to];
      if (n1 && n2) {
        const dx = n2.x - n1.x;
        const dy = n2.y - n1.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < maxDistance * 1.2) {
          const px = n1.x + dx * pulse.progress;
          const py = n1.y + dy * pulse.progress;
          ctx.beginPath();
          ctx.arc(px, py, 1.8, 0, Math.PI * 2);
          ctx.fillStyle = pulseColor;
          ctx.fill();
        }
      }
    }

    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      requestAnimationFrame(render);
    }
  }
  render();
})();
