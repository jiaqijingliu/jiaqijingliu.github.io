// ============================================================
//  个人名片交互脚本
// ============================================================

(function () {
  'use strict';

  const card = document.getElementById('card');
  const toast = document.getElementById('toast');

  // ---------- 1. 鼠标跟随的 3D 倾斜效果 ----------
  let tiltTimer = null;

  function handleTilt(e) {
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left; // 相对卡片左侧
    const y = e.clientY - rect.top;  // 相对卡片顶部

    // 归一化到 -0.5 ~ 0.5
    const px = x / rect.width - 0.5;
    const py = y / rect.height - 0.5;

    const rotateY = px * 10; // 左右倾斜
    const rotateX = -py * 10; // 上下倾斜

    card.style.transform =
      `rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg)`;
  }

  function resetTilt() {
    // 平滑回正
    card.style.transform = 'rotateX(0deg) rotateY(0deg)';
  }

  if (card && window.matchMedia('(hover: hover)').matches) {
    card.addEventListener('mousemove', handleTilt);
    card.addEventListener('mouseleave', resetTilt);
  }

  // ---------- 2. 点击联系方式复制到剪贴板 ----------
  let toastTimer = null;

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove('is-visible');
    }, 1600);
  }

  async function copyText(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        // 兼容非 https 环境
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      return true;
    } catch (err) {
      return false;
    }
  }

  document.querySelectorAll('.contact').forEach((item) => {
    item.addEventListener('click', async () => {
      const value = item.dataset.copy;
      const label = item.dataset.label || '内容';
      const ok = await copyText(value);
      showToast(ok ? `${label}已复制` : '复制失败，请手动选择');
    });
  });
})();
